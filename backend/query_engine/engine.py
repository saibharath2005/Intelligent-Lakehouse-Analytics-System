import logging
import re
import threading
import time
from pathlib import Path

import duckdb
import polars as pl

logger = logging.getLogger(__name__)

MAX_ROWS = 10_000
CACHE_TTL = 60
DEFAULT_TABLE_ALIASES = {"data", "your_table", "table", "dataset"}


# Thread-safe DuckDB connections
_local = threading.local()


def _get_duck_con():
    if not getattr(_local, "con", None):
        con = duckdb.connect()
        con.execute("INSTALL delta; LOAD delta;")
        _local.con = con
        logger.debug("DuckDB connection created")
    return _local.con


# Cache
QUERY_CACHE = {}


def get_cache(key):
    item = QUERY_CACHE.get(key)
    if not item:
        return None

    value, ts = item
    if time.time() - ts > CACHE_TTL:
        del QUERY_CACHE[key]
        return None

    return value


def set_cache(key, value):
    QUERY_CACHE[key] = (value, time.time())


# SQL Guard
ALLOWED = {"SELECT", "WITH", "SHOW", "DESCRIBE", "EXPLAIN"}

FORBIDDEN = [
    r"\bDROP\b",
    r"\bDELETE\b",
    r"\bINSERT\b",
    r"\bUPDATE\b",
    r"\bALTER\b",
    r"\bCREATE\b",
    r"\bMERGE\b",
    r";\s*\w",
    r"--",
    r"/\*",
]

FORBIDDEN_RE = [re.compile(p, re.IGNORECASE) for p in FORBIDDEN]


def validate_sql(sql: str):
    sql = sql.strip()
    if not sql:
        raise ValueError("Empty query")

    first = sql.split()[0].upper()
    if first not in ALLOWED:
        raise ValueError(f"Only read queries allowed. Got: {first}")

    for p in FORBIDDEN_RE:
        if p.search(sql):
            raise ValueError(f"Forbidden SQL pattern: {p.pattern}")


def ensure_single_limit(sql: str, max_rows: int):
    limits = re.findall(r"\bLIMIT\s+\d+", sql, re.IGNORECASE)

    if len(limits) > 1:
        first = limits[0]
        sql = re.sub(r"\bLIMIT\s+\d+", "", sql, flags=re.IGNORECASE)
        return f"{sql.strip()} {first}"

    if not limits:
        return f"{sql.rstrip(';').strip()} LIMIT {max_rows}"

    return sql


# SQL Adapter
def _normalise_identifier(name: str | None) -> str | None:
    if not name:
        return None
    return re.sub(r"\W+", "_", name.rsplit(".", 1)[0]).strip("_")


def _quote_literal(value: str) -> str:
    return value.replace("'", "''")


def _table_aliases(table_name: str, dataset_name: str | None = None) -> set[str]:
    aliases = set(DEFAULT_TABLE_ALIASES)
    aliases.add(table_name)
    aliases.add(_normalise_identifier(table_name))
    aliases.add(_normalise_identifier(dataset_name))
    return {alias for alias in aliases if alias}


def _replace_relation_aliases(sql: str, delta_path: str, aliases: set[str]) -> str:
    relation = f"delta_scan('{_quote_literal(delta_path)}')"

    for alias in sorted(aliases, key=len, reverse=True):
        escaped = re.escape(alias)
        sql = re.sub(
            rf"(\b(?:FROM|JOIN)\s+)([`\"]?){escaped}\2\b",
            lambda match: f"{match.group(1)}{relation}",
            sql,
            flags=re.IGNORECASE,
        )

    return sql


def adapt_for_duckdb(
    sql: str,
    delta_path: str,
    table_name: str,
    dataset_name: str | None = None,
):
    adapted = _replace_relation_aliases(
        sql,
        delta_path,
        _table_aliases(table_name, dataset_name),
    )

    function_map = {
        r"\bnow\(\)": "CURRENT_TIMESTAMP",
        r"\bcurrent_timestamp\(\)": "CURRENT_TIMESTAMP",
        r"\bnvl\(": "ifnull(",
        r"\bdate_format\(": "strftime(",
    }

    for k, v in function_map.items():
        adapted = re.sub(k, v, adapted, flags=re.IGNORECASE)

    return ensure_single_limit(adapted, MAX_ROWS)


# DuckDB Execution
def run_duckdb(sql, delta_path, table_name, dataset_name=None):
    con = _get_duck_con()

    adapted = adapt_for_duckdb(sql, delta_path, table_name, dataset_name)
    logger.debug(f"DuckDB SQL: {adapted}")

    result = con.execute(adapted)
    df = pl.from_arrow(result.arrow())

    logger.info(f"DuckDB rows: {df.shape[0]}")
    return df


# Smart Execution
def execute(sql, delta_path, table_name="data", dataset_name=None):
    try:
        df = run_duckdb(sql, delta_path, table_name, dataset_name)

        if df.shape[0] >= MAX_ROWS:
            logger.warning("DuckDB returned the maximum configured rows")

        return df, "duckdb"

    except Exception as e:
        logger.warning(f"DuckDB query failed: {e}")
        raise ValueError(f"Query failed: {e}") from e


# Serialization
def serialise(df: pl.DataFrame):
    rows = df.to_dicts()
    safe = []

    for row in rows:
        safe.append(
            {
                k: (
                    str(v)
                    if not isinstance(v, (int, float, bool, str, type(None)))
                    else v
                )
                for k, v in row.items()
            }
        )

    return safe


# Public API
def query_dataset(sql, project_id, dataset_name, table_name="data"):
    validate_sql(sql)

    base = dataset_name.rsplit(".", 1)[0]
    delta_path = Path(f"data_lake/project_{project_id}/{base}").resolve()

    if not delta_path.exists():
        raise FileNotFoundError(f"Dataset storage not found: {delta_path}")

    cache_key = f"{project_id}:{dataset_name}:{sql}"

    cached = get_cache(cache_key)
    if cached:
        logger.info("Cache hit")
        return cached

    df, engine = execute(sql, str(delta_path), table_name, dataset_name)

    result = {
        "engine": engine,
        "row_count": df.shape[0],
        "columns": [{"name": c, "type": str(df.schema[c])} for c in df.columns],
        "rows": serialise(df),
    }

    set_cache(cache_key, result)

    return result
