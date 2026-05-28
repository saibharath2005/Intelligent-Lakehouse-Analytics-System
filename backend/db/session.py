import os
from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from core.config import settings


def _duckdb_path_from_url(database_url: str) -> Path | None:
    url = make_url(database_url)
    if url.drivername != "duckdb" or not url.database:
        return None
    return Path(url.database).resolve()


def _engine_kwargs(database_url: str) -> dict:
    url = make_url(database_url)
    if url.drivername == "duckdb":
        return {"poolclass": NullPool}
    return {}


def _recover_duckdb_wal(database_url: str, error: Exception) -> bool:
    message = str(error)
    if "Failure while replaying WAL file" not in message:
        return False

    db_path = _duckdb_path_from_url(database_url)
    if not db_path:
        return False

    wal_path = Path(str(db_path) + ".wal")
    if not wal_path.exists():
        return False

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = wal_path.with_name(f"{wal_path.name}.{stamp}.bak")
    os.replace(wal_path, backup_path)
    print(f"Recovered DuckDB startup by moving corrupt WAL to {backup_path}")
    return True


def _create_engine_with_recovery(database_url: str):
    db_engine = create_engine(database_url, **_engine_kwargs(database_url))
    try:
        with db_engine.connect():
            pass
    except Exception as e:
        db_engine.dispose()
        if not _recover_duckdb_wal(database_url, e):
            raise
        db_engine = create_engine(database_url, **_engine_kwargs(database_url))
        with db_engine.connect():
            pass
    return db_engine


engine = _create_engine_with_recovery(settings.DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)
