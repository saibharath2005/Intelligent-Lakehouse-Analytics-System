import json
import logging
from typing import Optional
from langchain_core.tools import Tool
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from sqlalchemy.orm import Session

from ai.model_loader import load_model
from ai.prompt import DASHBOARD_SYSTEM_PROMPT, DASHBOARD_FINAL_PROMPT
from spark.analyze import analyze_dataset, get_dataset_schema
from db.models.dashboard import Dashboard
from db.models.dashboard_page import DashboardPage
from db.models.dashboard_widget import DashboardWidget

logger = logging.getLogger(__name__)

# Helpers

def _extract_text(content) -> str:
    """
    Safely extract a plain string from an LLM response's .content field.
    .content can be:
      - a plain str                          -> return as-is
      - a list of content blocks             -> join all "text" blocks
      - an empty list / None                 -> return ""
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
            elif isinstance(block, str):
                parts.append(block)
        return "".join(parts)
    return ""


def _extract_tool_arg(args: dict) -> str:
    """
    LangChain passes tool arguments as a named dict, e.g.:
      {"dataset_name": "airline_data"}  or  {"query_spec": "{...}"}
    We always define single-arg tools, so just grab the first value.
    """
    if not args:
        return ""
    return str(list(args.values())[0])


def _parse_json(text: str) -> dict:
    """
    Parse a JSON object from LLM output, tolerating markdown code fences
    and surrounding prose.
    """
    cleaned = text.strip()

    # Strip ```json ... ``` or ``` ... ``` fences
    if "```" in cleaned:
        # grab content between first and last fence pair
        inner = cleaned.split("```")
        # parts: ['pre', 'json\n{...}', 'post'] or ['pre', '{...}', 'post']
        for part in inner[1::2]:          # odd-indexed parts are inside fences
            candidate = part.strip()
            if candidate.startswith("json"):
                candidate = candidate[4:].strip()
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue

    # Try the whole string
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Last resort: find the outermost { ... }
    start = cleaned.find("{")
    end   = cleaned.rfind("}") + 1
    if start != -1 and end > start:
        return json.loads(cleaned[start:end])

    raise ValueError(f"Could not parse agent response as JSON.\nRaw response:\n{text}")


# SQL query builder
def build_widget_query(widget: dict) -> str:
    """Convert an AI widget spec into a Spark SQL query."""
    x_axis = widget.get("x_axis")
    y_axis = widget.get("y_axis")
    agg    = (widget.get("aggregation") or "count").upper()
    w_type = widget.get("type", "bar")

    if w_type == "kpi":
        if y_axis:
            return f"SELECT {agg}({y_axis}) AS value FROM data"
        return "SELECT COUNT(*) AS value FROM data"

    if x_axis and y_axis:
        return (
            f"SELECT {x_axis}, {agg}({y_axis}) AS {y_axis} "
            f"FROM data GROUP BY {x_axis} ORDER BY {y_axis} DESC"
        )
    if x_axis:
        return (
            f"SELECT {x_axis}, COUNT(*) AS count "
            f"FROM data GROUP BY {x_axis} ORDER BY count DESC"
        )

    return "SELECT * FROM data LIMIT 100"


# Tool definitions
def make_tools(project_id: int, db: Session):

    def get_schema(dataset_name: str) -> str:
        try:
            schema = get_dataset_schema(project_id, dataset_name.strip())
            return json.dumps(schema)
        except Exception as e:
            return json.dumps({"error": str(e)})

    def preview_data(query_spec: str) -> str:
        try:
            spec   = json.loads(query_spec)
            result = analyze_dataset(project_id, spec["dataset"], spec["query"])
            rows   = result if isinstance(result, list) else []
            return json.dumps(rows[:5])
        except Exception as e:
            return json.dumps({"error": str(e)})

    return [
        Tool(
            name="GetDatasetSchema",
            func=get_schema,
            description=(
                "Get column names and data types for a dataset. "
                "Input: dataset name as a plain string. "
                "Always call this first so you can choose correct x_axis / y_axis values."
            ),
        ),
        Tool(
            name="PreviewData",
            func=preview_data,
            description=(
                "Preview a small sample of query results from a dataset. "
                'Input: JSON string with keys "dataset" and "query". '
                'Example: {"dataset": "airline_data", "query": "SELECT airline, COUNT(*) FROM data GROUP BY airline LIMIT 5"}'
            ),
        ),
    ]


# ──────────────────────────────────────────────
# Agent runner
# ──────────────────────────────────────────────

def run_dashboard_agent(
    project_id: int,
    user_prompt: str,
    available_datasets: list,
    db: Session,
    dashboard_id: Optional[int] = None,
) -> dict:
    """
    Invoke the LLM agent with an agentic tool-call loop, then parse
    the final JSON dashboard plan from the model's last text response.
    """
    llm   = load_model(project_id, db)
    tools = make_tools(project_id, db)

    llm_with_tools = llm.bind_tools(tools)
    tool_map       = {t.name: t for t in tools}

    context = f"Available datasets: {', '.join(available_datasets)}."
    if dashboard_id:
        context += f" You are modifying dashboard ID {dashboard_id}."

    messages = [
        SystemMessage(content=DASHBOARD_SYSTEM_PROMPT),
        HumanMessage(content=f"{context}\n\nUser request: {user_prompt}"),
    ]

    # ── Phase 1: tool-call loop (schema inspection) ───────────────────────
    for iteration in range(5):
        response = llm_with_tools.invoke(messages)
        messages.append(response)

        tool_calls = getattr(response, "tool_calls", None) or []

        if not tool_calls:
            # Model stopped calling tools — check if it produced a JSON plan
            candidate = _extract_text(response.content).strip()
            if candidate:
                logger.debug("Agent produced final answer after %d iteration(s).", iteration + 1)
                return _parse_json(candidate)
            # Stopped with no text — fall through to forced final call
            logger.debug("Agent stopped tool calls with no text. Forcing final call.")
            break

        logger.debug("Agent iteration %d: %d tool call(s)", iteration + 1, len(tool_calls))
        for tc in tool_calls:
            tool_name = tc["name"]
            tool_fn   = tool_map.get(tool_name)
            raw_arg   = _extract_tool_arg(tc.get("args", {}))

            logger.debug("  Tool: %s  Arg: %r", tool_name, raw_arg)

            tool_result = tool_fn.func(raw_arg) if tool_fn else json.dumps(
                {"error": f"Unknown tool: {tool_name}"}
            )
            logger.debug("  Result: %s", tool_result[:300])
            messages.append(ToolMessage(content=tool_result, tool_call_id=tc["id"]))

    # ── Phase 2: forced final call — plain LLM, no tools ─────────────────
    messages.append(HumanMessage(content=DASHBOARD_FINAL_PROMPT))
    final_response = llm.invoke(messages)
    final_text     = _extract_text(final_response.content).strip()

    logger.debug("Forced final response:\n%s", final_text)

    if not final_text:
        raise ValueError(
            "Agent returned an empty response even after the forced final call. "
            "Check that the LLM API key is valid and the model is reachable."
        )

    return _parse_json(final_text)


# ──────────────────────────────────────────────
# Dashboard persistence helpers
# ──────────────────────────────────────────────

def apply_dashboard_plan(
    plan: dict,
    project_id: int,
    user_id: int,
    db: Session,
) -> dict:
    """
    Persist an AI-generated dashboard plan to the database.
    Returns a summary of what was created / modified.
    """
    action  = plan.get("action", "create")
    widgets = plan.get("widgets", [])
    result  = {"action": action}

    if action == "create":
        dashboard = Dashboard(
            name=plan.get("title", "AI Dashboard"),
            project_id=project_id,
            created_by=user_id,
        )
        db.add(dashboard)
        db.flush()

        page = DashboardPage(
            dashboard_id=dashboard.id,
            name="Page 1",
            page_order=0,
        )
        db.add(page)
        db.flush()

        _persist_widgets(widgets, page.id, db)

        result.update({
            "dashboard_id":  dashboard.id,
            "page_id":       page.id,
            "widgets_added": len(widgets),
        })

    elif action in ("modify", "add_widget"):
        dashboard_id = plan.get("dashboard_id")
        if not dashboard_id:
            raise ValueError("dashboard_id is required for modify / add_widget actions")

        page = db.query(DashboardPage).filter_by(dashboard_id=dashboard_id).first()
        if not page:
            page = DashboardPage(
                dashboard_id=dashboard_id, name="Page 1", page_order=0
            )
            db.add(page)
            db.flush()

        _persist_widgets(widgets, page.id, db)

        result.update({
            "dashboard_id":  dashboard_id,
            "page_id":       page.id,
            "widgets_added": len(widgets),
        })

    elif action == "remove_widget":
        widget_ids = plan.get("widget_ids", [])
        removed    = 0
        for wid in widget_ids:
            w = db.query(DashboardWidget).filter_by(id=wid).first()
            if w:
                db.delete(w)
                removed += 1
        result["widgets_removed"] = removed

    else:
        raise ValueError(f"Unknown action: {action}")

    db.commit()
    return result


def _persist_widgets(widgets: list, page_id: int, db: Session):
    """Persist a list of AI widget specs as DashboardWidget rows."""
    for idx, w in enumerate(widgets):
        db.add(DashboardWidget(
            page_id=page_id,
            dataset_name=w.get("dataset", ""),
            query=build_widget_query(w),
            chart_type=w.get("type", "bar"),
            x_axis=w.get("x_axis"),
            y_axis=w.get("y_axis"),
            pos_x=(idx % 3) * 4,
            pos_y=(idx // 3) * 3,
            width=4,
            height=3,
        ))