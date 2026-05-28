import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.dependencies import get_current_user
from db.session import SessionLocal
from db.models.project_member import ProjectMember
from db.models.dataset import Dataset
from spark.session import get_spark
from query_engine.engine import query_dataset, validate_sql
from schemas.analyze import AnalyzeRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/smart/query", tags=["Analyze"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


#Routes

@router.post("/")
def run_query(
    data: AnalyzeRequest,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Execute a read-only SQL query against a project dataset using the
    dual-engine runner (DuckDB → Spark fallback).

    The query must reference the table as `data`.
    Only SELECT / WITH / SHOW / DESCRIBE / EXPLAIN are permitted.

    Returns rows, column schema, row count, and which engine was used.
    """

    # ── 1. Membership check ───────────────────────────────────────────────
    member = db.query(ProjectMember).filter_by(
        project_id=data.project_id,
        user_id=user_id,
    ).first()

    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    # ── 2. Locate dataset ─────────────────────────────────────────────────
    dataset_record = db.query(Dataset).filter_by(
        project_id=data.project_id,
        name=data.dataset,
    ).first()

    if not dataset_record:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{data.dataset}' not found in this project",
        )

    if dataset_record.status == "failed":
        raise HTTPException(
            status_code=400,
            detail=f"Dataset ingestion failed: {dataset_record.error_message or 'unknown error'}",
        )

    if dataset_record.status != "ready":
        raise HTTPException(
            status_code=400,
            detail=f"Dataset is not ready yet (status: '{dataset_record.status}'). Try again shortly.",
        )

    # ── 3. Validate SQL (guard) ───────────────────────────────────────────
    try:
        validate_sql(data.query)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # ── 4. Execute via smart engine ───────────────────────────────────────
    try:
        result = query_dataset(
            sql=data.query,
            project_id=data.project_id,
            dataset_name=data.dataset,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(
            "Query execution failed for dataset '%s' (project %d): %s",
            data.dataset, data.project_id, str(e),
        )
        raise HTTPException(status_code=500, detail=f"Query execution failed: {str(e)}")

    return {
        "project_id": data.project_id,
        "dataset": data.dataset,
        "query": data.query,
        **result,   # engine, row_count, columns, rows
    }


@router.get("/schema")
def get_dataset_schema(
    project_id: int,
    dataset: str,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return the column schema of a dataset's Delta table without running
    a full query. Useful for building queries in the UI.
    """

    member = db.query(ProjectMember).filter_by(
        project_id=project_id,
        user_id=user_id,
    ).first()

    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    dataset_record = db.query(Dataset).filter_by(
        project_id=project_id,
        name=dataset,
    ).first()

    if not dataset_record:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset}' not found")

    if dataset_record.status != "ready":
        raise HTTPException(
            status_code=400,
            detail=f"Dataset is not ready (status: '{dataset_record.status}')",
        )

    table_name = dataset.rsplit(".", 1)[0]
    lake_path = f"data_lake/project_{project_id}/{table_name}"

    try:
        spark = get_spark()
        df = spark.read.format("delta").load(lake_path)
        return {
            "dataset": dataset,
            "columns": [
                {
                    "name": f.name,
                    "type": str(f.dataType.simpleString()),
                    "nullable": f.nullable,
                }
                for f in df.schema.fields
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read schema: {str(e)}")