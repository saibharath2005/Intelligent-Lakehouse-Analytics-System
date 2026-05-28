from sqlalchemy import Integer
from sqlalchemy.types import TypeDecorator

class DuckDBInteger(TypeDecorator):
    """DuckDB-safe auto-increment integer. Avoids SERIAL/BIGSERIAL."""
    impl = Integer
    cache_ok = True

    def load_dialect_impl(self, dialect):
        return dialect.type_descriptor(Integer())