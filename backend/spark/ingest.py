import logging
import traceback

from spark.session import get_spark
from db.session import SessionLocal
from db.models.dataset import Dataset

logger = logging.getLogger(__name__)


def ingest_dataset(project_id: int, filename: str, dataset_id: int):
    """
    Background task: read the uploaded file, convert it to a Delta table,
    then update the Dataset record:
      - status = "ready"   on success
      - status = "failed"  on error (error message stored in error_message)

    Supported formats: CSV, JSON
    """

    db = SessionLocal()

    try:
        spark = get_spark()

        raw_path = f"uploads/project_{project_id}/{filename}"
        table_name = filename.rsplit(".", 1)[0]   # strip extension robustly
        lake_path = f"data_lake/project_{project_id}/{table_name}"

        logger.info("Ingesting dataset %d: %s → %s", dataset_id, raw_path, lake_path)

        ext = filename.rsplit(".", 1)[-1].lower()

        if ext == "csv":
            df = spark.read.csv(raw_path, header=True, inferSchema=True)
        elif ext == "json":
            df = spark.read.json(raw_path)
        else:
            raise ValueError(f"Unsupported file type: .{ext}")

        if len(df.columns) == 0:
            raise ValueError("File has no columns — it may be empty or malformed")

        df.write.format("delta").mode("overwrite").save(lake_path)

        row_count = df.count()
        col_count = len(df.columns)

        logger.info(
            "Dataset %d ingested successfully: %d rows × %d columns",
            dataset_id, row_count, col_count,
        )

        dataset = db.query(Dataset).filter_by(id=dataset_id).first()
        if dataset:
            dataset.status = "ready"
            dataset.row_count = row_count
            dataset.col_count = col_count
            db.commit()

    except Exception as exc:
        tb = traceback.format_exc()
        logger.error("Ingestion failed for dataset %d:\n%s", dataset_id, tb)

        # Mark as failed and store the error message
        try:
            dataset = db.query(Dataset).filter_by(id=dataset_id).first()
            if dataset:
                dataset.status = "failed"
                dataset.error_message = str(exc)[:500]   # cap at 500 chars
                db.commit()
        except Exception:
            logger.exception("Could not update dataset %d status to 'failed'", dataset_id)

    finally:
        db.close()