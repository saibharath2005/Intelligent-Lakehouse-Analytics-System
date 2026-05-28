from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from db.session import SessionLocal
from db.models.dataset import Dataset
from core.dependencies import get_current_user
from db.models.project_member import ProjectMember
from query_engine.engine import query_dataset
from spark.ingest import ingest_dataset
from spark.session import get_spark
from fastapi import BackgroundTasks

import os, shutil

router = APIRouter(prefix="/dataset", tags=["Dataset"])

UPLOAD_DIR = "uploads"

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/project/{project_id}")
def list_project_datasets(
    project_id: int,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return all datasets belonging to a project.
    Any project member (viewer, editor, owner) may call this.
    """

    # ── 1. Verify membership─────
    member = db.query(ProjectMember).filter_by(
        project_id=project_id,
        user_id=user_id,
    ).first()

    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this project")

    # ── 2. Fetch datasets ordered by newest first ─────────────────────────
    datasets = (
        db.query(Dataset)
        .filter_by(project_id=project_id)
        .order_by(Dataset.created_at.desc())
        .all()
    )

    return [
        {
            "id": d.id,
            "name": d.name,
            "status": d.status,
            "row_count": d.row_count,
            "col_count": d.col_count,
            "error_message": d.error_message if d.status == "failed" else None,
            "uploaded_by": d.uploaded_by,
            "created_at": d.created_at,
        }
        for d in datasets
    ]

@router.post("/upload")
async def upload_dataset(
    background_tasks: BackgroundTasks,
    project_id: int = Form(...),
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Role check
    member = db.query(ProjectMember).filter_by(
        project_id=project_id,
        user_id=user_id
    ).first()

    if not member or member.role not in ["owner", "admin", "editor"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    # File validation
    ALLOWED_EXTENSIONS = {"csv", "json"}
    ext = file.filename.split(".")[-1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type")

    # Save file
    folder = f"{UPLOAD_DIR}/project_{project_id}"
    os.makedirs(folder, exist_ok=True)

    file_path = os.path.join(folder, file.filename)

    contents = await file.read()

    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")

    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    # Save metadata
    dataset = Dataset(
        project_id=project_id,
        uploaded_by=user_id,
        name=file.filename,
        file_path=file_path,
        status="processing"
    )

    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    # Background Spark ingestion
    background_tasks.add_task(
        ingest_dataset,
        project_id,
        file.filename,
        dataset.id,
    )

    return {
        "message": "File uploaded. Processing started.",
        "dataset_id": dataset.id
    }


@router.delete("/{dataset_id}")
def delete_dataset(
    dataset_id: int,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a dataset and all associated files:
      - Uploaded source file (uploads/project_{id}/filename)
      - Data-lake Delta table (data_lake/project_{id}/name_without_ext)

    Only project owners and editors may delete datasets.
    """

    # 1. Fetch dataset
    dataset = db.query(Dataset).filter_by(id=dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # 2. Permission check (owner / editor)
    member = db.query(ProjectMember).filter_by(
        project_id=dataset.project_id,
        user_id=user_id,
    ).first()

    if not member or member.role not in ["owner", "admin", "editor"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    warnings = []

    # 3. Remove uploaded source file
    if dataset.file_path and os.path.exists(dataset.file_path):
        try:
            os.remove(dataset.file_path)
        except Exception as e:
            warnings.append(f"Could not remove upload file: {e}")

    # 4. Remove Delta table from data lake
    table_name = dataset.name.rsplit(".", 1)[0]
    lake_path = f"data_lake/project_{dataset.project_id}/{table_name}"
    if os.path.isdir(lake_path):
        try:
            shutil.rmtree(lake_path)
        except Exception as e:
            warnings.append(f"Could not remove Delta table: {e}")

    # 5. Delete DB record
    db.delete(dataset)
    db.commit()

    return {
        "message": f"Dataset '{dataset.name}' deleted",
        "dataset_id": dataset_id,
        **({"warnings": warnings} if warnings else {}),
    }


@router.get("/{dataset_id}/preview")
def preview_dataset(
    dataset_id: int,
    limit: int = Query(default=50, ge=1, le=500, description="Number of rows to return (1-500)"),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return a preview of a dataset's data from the Delta table:
      - Column names and their data types
      - Up to `limit` rows (default 50, max 500)
      - Row count and basic null counts per column

    Any project member may call this endpoint.
    """
    limit = min(limit, 200)
    
    # 1. Fetch dataset
    dataset = db.query(Dataset).filter_by(id=dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # 2. Verify membership
    member = db.query(ProjectMember).filter_by(
        project_id=dataset.project_id,
        user_id=user_id,
    ).first()

    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this project")

    # 3. Check dataset is ready
    if dataset.status == "failed":
        raise HTTPException(
            status_code=400,
            detail=f"Dataset ingestion failed: {dataset.error_message or 'unknown error'}",
        )

    if dataset.status != "ready":
        raise HTTPException(
            status_code=400,
            detail=f"Dataset is not ready for preview (current status: '{dataset.status}')",
        )

    # 4. Read from Delta table
    table_name = dataset.name.rsplit(".", 1)[0]
    lake_path = f"data_lake/project_{dataset.project_id}/{table_name}"

    sql = f"""
        SELECT *
        FROM {table_name}
        LIMIT {limit}
    """

    try:
        result = query_dataset(
            sql=sql,
            project_id=dataset.project_id,
            dataset_name=dataset.name,
            table_name=table_name,
        )
        rows = result["rows"]
        columns = result["columns"]

        count_sql = f"SELECT COUNT(*) as total FROM {table_name}"
        count_result = query_dataset(
            sql=count_sql,
            project_id=dataset.project_id,
            dataset_name=dataset.name,
            table_name=table_name,
        )
        total_rows = count_result["rows"][0]["total"]
        null_sql_parts = [
            f"COUNT(*) - COUNT({col['name']}) AS {col['name']}"
            for col in columns
        ]

        null_sql = f"""
            SELECT {", ".join(null_sql_parts)}
            FROM {table_name}
        """
        null_result = query_dataset(
            sql=null_sql,
            project_id=dataset.project_id,
            dataset_name=dataset.name,
            table_name=table_name,
        )

        null_counts = null_result["rows"][0]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read dataset: {str(e)}",
        )

    return {
        "dataset_id": dataset_id,
        "name": dataset.name,
        "engine": result["engine"],
        "total_rows": total_rows,
        "preview_rows": len(rows),
        "columns": columns,
        "null_counts": null_counts,
        "rows": rows,
    }