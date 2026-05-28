import json
import re
from typing import Any, Dict, List, Optional

from langchain.agents import create_agent
from langchain_core.tools import Tool
from sqlalchemy.orm import Session

from ai.model_loader import load_model
from query_engine.engine import query_dataset


def _message_type(message: Any) -> str:
    kind = getattr(message, "type", None)
    if kind:
        return kind

    name = message.__class__.__name__.lower()
    if "human" in name:
        return "human"
    if "tool" in name:
        return "tool"
    return "ai"


def _serialise_message(message: Any) -> Dict[str, Any]:
    if isinstance(message, dict):
        return {
            "type": message.get("type") or message.get("role") or "ai",
            "content": message.get("content", "") or "",
            "additional_kwargs": message.get("additional_kwargs", {}) or {},
            "response_metadata": message.get("response_metadata", {}) or {},
            "name": message.get("name"),
            "tool_calls": message.get("tool_calls", []) or [],
            "usage_metadata": message.get("usage_metadata"),
        }

    return {
        "type": _message_type(message),
        "content": getattr(message, "content", "") or "",
        "additional_kwargs": getattr(message, "additional_kwargs", {}) or {},
        "response_metadata": getattr(message, "response_metadata", {}) or {},
        "name": getattr(message, "name", None),
        "tool_calls": getattr(message, "tool_calls", []) or [],
        "usage_metadata": getattr(message, "usage_metadata", None),
    }


def _markdown_table(rows: List[Dict[str, Any]], max_rows: int = 10) -> str:
    if not rows:
        return "No rows were returned."

    visible_rows = rows[:max_rows]
    columns = list(visible_rows[0].keys())
    header = "| " + " | ".join(columns) + " |"
    divider = "| " + " | ".join("---" for _ in columns) + " |"
    body = []

    for row in visible_rows:
        body.append(
            "| "
            + " | ".join("" if row.get(col) is None else str(row.get(col)) for col in columns)
            + " |"
        )

    return "\n".join([header, divider] + body)


def _direct_sql_for_question(question: str) -> Optional[str]:
    q = question.lower()

    if any(word in q for word in ("columns", "column names", "schema", "fields")):
        return "__SCHEMA__"

    if (
        "how many" in q
        or "row count" in q
        or "number of rows" in q
        or "count rows" in q
    ):
        return "SELECT COUNT(*) AS row_count FROM data"

    limit_match = re.search(r"\btop\s+(\d+)|\bfirst\s+(\d+)|\b(\d+)\s+records?\b", q)
    limit_values = limit_match.groups() if limit_match else []
    limit = next((int(value) for value in limit_values if value), 10)
    limit = max(1, min(limit, 50))

    if any(phrase in q for phrase in ("top", "first", "records", "rows", "show me")):
        return "SELECT * FROM data LIMIT {}".format(limit)

    return None


def _schema_result(project_id: int, dataset: str) -> Dict[str, Any]:
    result = query_dataset(
        sql="SELECT * FROM data LIMIT 1",
        project_id=project_id,
        dataset_name=dataset,
    )
    rows = [
        {"column_name": col.get("name"), "type": col.get("type")}
        for col in result.get("columns", [])
    ]
    return {
        "engine": result.get("engine"),
        "row_count": len(rows),
        "columns": [
            {"name": "column_name", "type": "String"},
            {"name": "type", "type": "String"},
        ],
        "rows": rows,
    }


def _is_placeholder_column_query(sql_query: str) -> bool:
    return bool(
        re.search(r"\bSELECT\s+[`\"]?column_name[`\"]?\s+FROM\b", sql_query, re.IGNORECASE)
    )


def _run_query(project_id: int, dataset: str, sql_query: str) -> Dict[str, Any]:
    if sql_query == "__SCHEMA__" or _is_placeholder_column_query(sql_query):
        return _schema_result(project_id, dataset)

    result = query_dataset(
        sql=sql_query,
        project_id=project_id,
        dataset_name=dataset,
    )

    return {
        "engine": result.get("engine"),
        "row_count": result.get("row_count"),
        "columns": result.get("columns"),
        "rows": result.get("rows", [])[:20],
    }


def _direct_answer(project_id: int, dataset: str, question: str) -> Optional[Dict[str, Any]]:
    sql = _direct_sql_for_question(question)
    if not sql:
        return None

    tool_result = _run_query(project_id, dataset, sql)
    rows = tool_result.get("rows", [])

    if sql == "__SCHEMA__":
        answer = "This dataset has {} columns:\n\n{}".format(
            len(rows),
            _markdown_table(rows, len(rows)),
        )
        display_sql = "SELECT * FROM data LIMIT 1"
    elif sql.upper().startswith("SELECT COUNT"):
        count = rows[0].get("row_count", 0) if rows else 0
        answer = "This dataset has {} rows.".format(count)
        display_sql = sql
    else:
        answer = "Here are the first {} records:\n\n{}".format(
            len(rows),
            _markdown_table(rows, len(rows)),
        )
        display_sql = sql

    return {
        "messages": [
            {"type": "human", "content": question},
            {
                "type": "ai",
                "content": "",
                "tool_calls": [{"name": "SmartQueryExecutor", "args": {"__arg1": display_sql}}],
            },
            {
                "type": "tool",
                "name": "SmartQueryExecutor",
                "content": json.dumps(tool_result, default=str),
            },
            {"type": "ai", "content": answer, "tool_calls": []},
        ],
        "answer": answer,
        "sql": display_sql,
        "data": tool_result,
    }


def build_agent(
    project_id: int,
    dataset: str,
    db: Session,
    provider: Optional[str] = None,
):
    llm = load_model(project_id, db, provider=provider)

    def smart_query_tool(sql_query: str):
        try:
            return _run_query(project_id, dataset, sql_query)
        except Exception as e:
            return {"error": str(e)}

    tools = [
        Tool(
            name="SmartQueryExecutor",
            func=smart_query_tool,
            description="""
            Execute read-only SQL queries on the selected dataset.

            Rules:
            - Table name is always data.
            - Never query a fake column named column_name.
            - To list columns/schema, call this tool with __SCHEMA__.
            - Use simple standard SQL.
            - Include LIMIT 50 for record previews.
            - For counts and totals, return one aggregated value.
            """,
        )
    ]

    return create_agent(model=llm, tools=tools)


def run_agent(
    project_id: int,
    dataset: str,
    query: str,
    db: Session,
    provider: Optional[str] = None,
):
    direct = _direct_answer(project_id, dataset, query)
    if direct:
        return direct

    agent = build_agent(project_id, dataset, db, provider=provider)

    response = agent.invoke(
        {
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a concise data analyst AI. Use SmartQueryExecutor "
                        "whenever answering questions about the dataset. The SQL table "
                        "name is always data. Return a clear final answer."
                    ),
                },
                {"role": "user", "content": query},
            ]
        }
    )

    if isinstance(response, dict) and "messages" in response:
        messages = [_serialise_message(message) for message in response["messages"]]
    else:
        messages = [{"type": "ai", "content": str(response), "tool_calls": []}]

    final = next(
        (
            message.get("content")
            for message in reversed(messages)
            if message.get("type") == "ai"
            and not message.get("tool_calls")
            and str(message.get("content", "")).strip()
        ),
        "",
    )

    if not final:
        final = (
            "I ran the analysis, but the model did not return a final explanation. "
            "Please try rephrasing the question."
        )
        messages.append({"type": "ai", "content": final, "tool_calls": []})

    return {"messages": messages, "answer": final}
