from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.dependencies import get_current_user
from db.session import SessionLocal
from db.models.project_member import ProjectMember
from db.models.dashboard import Dashboard
from db.models.dashboard_page import DashboardPage
from db.models.dashboard_widget import DashboardWidget
from schemas.dashboard import (
    DashboardCreate, DashboardUpdate,
    PageCreate, PageUpdate,
    WidgetCreate, WidgetUpdate, BulkLayoutUpdate,
)
from query_engine.engine import query_dataset
import time

CACHE = {}
CACHE_TTL = 60 

def get_cache(key):
    item = CACHE.get(key)
    if not item:
        return None

    value, timestamp = item

    if time.time() - timestamp > CACHE_TTL:
        del CACHE[key]
        return None

    return value


def set_cache(key, value):
    CACHE[key] = (value, time.time())

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _require_member(db, project_id, user_id, roles=("owner", "editor", "viewer")):
    """Return the ProjectMember or raise 403."""
    member = db.query(ProjectMember).filter_by(
        project_id=project_id, user_id=user_id
    ).first()
    if not member or member.role not in roles:
        raise HTTPException(status_code=403, detail="Not allowed")
    return member


@router.post("/")
def create_dashboard(
    data: DashboardCreate,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = db.query(ProjectMember).filter_by(
        project_id=data.project_id,
        user_id=user_id
    ).first()

    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    dashboard = Dashboard(
        name=data.name,
        project_id=data.project_id,
        created_by=user_id
    )

    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)

    default_page = DashboardPage(
        dashboard_id=dashboard.id,
        name="Page 1",
        page_order=1
    )

    db.add(default_page)
    db.commit()

    return dashboard


# ── Dashboard rename ──────────────────────────────────────────────────────────

@router.patch("/{dashboard_id}")
def update_dashboard(
    dashboard_id: int,
    data: DashboardUpdate,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rename a dashboard. Owners and editors only."""
    dashboard = db.query(Dashboard).filter_by(id=dashboard_id).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    _require_member(db, dashboard.project_id, user_id, roles=("owner", "admin", "editor"))

    dashboard.name = data.name
    db.commit()
    db.refresh(dashboard)

    return {"dashboard_id": dashboard.id, "name": dashboard.name}


@router.post("/{dashboard_id}/page")
def add_page(
    dashboard_id: int,
    data: PageCreate,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    page = DashboardPage(
        dashboard_id=dashboard_id,
        name=data.name,
        page_order=data.page_order
    )

    db.add(page)
    db.commit()
    db.refresh(page)

    return page


# ── Page update & delete ──────────────────────────────────────────────────────

@router.patch("/page/{page_id}")
def update_page(
    page_id: int,
    data: PageUpdate,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rename or reorder a page. Owners and editors only."""
    page = db.query(DashboardPage).filter_by(id=page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    dashboard = db.query(Dashboard).filter_by(id=page.dashboard_id).first()
    _require_member(db, dashboard.project_id, user_id, roles=("owner", "admin", "editor"))

    if data.name is not None:
        page.name = data.name
    if data.page_order is not None:
        page.page_order = data.page_order

    db.commit()
    db.refresh(page)

    return {"page_id": page.id, "name": page.name, "page_order": page.page_order}


@router.delete("/page/{page_id}")
def delete_page(
    page_id: int,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a page and all its widgets. Owners and editors only."""
    page = db.query(DashboardPage).filter_by(id=page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    dashboard = db.query(Dashboard).filter_by(id=page.dashboard_id).first()
    _require_member(db, dashboard.project_id, user_id, roles=("owner", "admin", "editor"))

    db.query(DashboardWidget).filter_by(page_id=page_id).delete()
    db.delete(page)
    db.commit()

    return {"message": f"Page '{page.name}' deleted", "page_id": page_id}


@router.post("/page/{page_id}/widget")
def add_widget(
    page_id: int,
    data: WidgetCreate,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    widget = DashboardWidget(
        page_id=page_id,
        dataset_name=data.dataset_name,
        query=data.query,
        chart_type=data.chart_type,
        x_axis=data.x_axis,
        y_axis=data.y_axis,
        pos_x=data.pos_x,
        pos_y=data.pos_y,
        width=data.width,
        height=data.height
    )

    db.add(widget)
    db.commit()
    db.refresh(widget)

    return widget


# ── Widget update, layout & delete ───────────────────────────────────────────

@router.patch("/widget/{widget_id}")
def update_widget(
    widget_id: int,
    data: WidgetUpdate,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    widget = db.query(DashboardWidget).filter_by(id=widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    page = db.query(DashboardPage).filter_by(id=widget.page_id).first()
    dashboard = db.query(Dashboard).filter_by(id=page.dashboard_id).first()
    _require_member(db, dashboard.project_id, user_id, roles=("owner", "admin", "editor"))

    payload = data.model_dump(exclude_none=True)

    if "query" in payload and not payload["query"]:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    if "dataset_name" in payload and not payload["dataset_name"]:
        raise HTTPException(status_code=400, detail="Dataset required")

    for field, value in payload.items():
        setattr(widget, field, value)

    db.commit()
    db.refresh(widget)

    return {
        "widget_id": widget.id,
        "dataset_name": widget.dataset_name,
        "query": widget.query,
        "chart_type": widget.chart_type,
        "x_axis": widget.x_axis,
        "y_axis": widget.y_axis,
        "layout": {
            "x": widget.pos_x,
            "y": widget.pos_y,
            "w": widget.width,
            "h": widget.height,
        },
    }


@router.patch("/page/{page_id}/layout")
def update_page_layout(
    page_id: int,
    data: BulkLayoutUpdate,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Bulk-update widget positions/sizes for a page in one request.
    Ideal for drag-and-drop grid saves. Owners and editors only.
    """
    page = db.query(DashboardPage).filter_by(id=page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    dashboard = db.query(Dashboard).filter_by(id=page.dashboard_id).first()
    _require_member(db, dashboard.project_id, user_id, roles=("owner", "admin", "editor"))

    updated = []
    for item in data.widgets:
        widget = db.query(DashboardWidget).filter_by(
            id=item.widget_id, page_id=page_id
        ).first()
        if not widget:
            raise HTTPException(
                status_code=404,
                detail=f"Widget {item.widget_id} not found on this page",
            )
        widget.pos_x  = item.pos_x
        widget.pos_y  = item.pos_y
        widget.width  = item.width
        widget.height = item.height
        updated.append(item.widget_id)

    db.commit()
    return {"message": "Layout updated", "updated_widgets": updated}


@router.delete("/widget/{widget_id}")
def delete_widget(
    widget_id: int,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a single widget. Owners and editors only."""
    widget = db.query(DashboardWidget).filter_by(id=widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    page = db.query(DashboardPage).filter_by(id=widget.page_id).first()
    dashboard = db.query(Dashboard).filter_by(id=page.dashboard_id).first()
    _require_member(db, dashboard.project_id, user_id, roles=("owner", "admin", "editor"))

    db.delete(widget)
    db.commit()

    return {"message": "Widget deleted", "widget_id": widget_id}


@router.get("/{dashboard_id}")
def get_dashboard(
    dashboard_id: int,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dashboard = db.query(Dashboard).filter_by(id=dashboard_id).first()

    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # 🔐 Permission check
    _require_member(db, dashboard.project_id, user_id)

    pages = db.query(DashboardPage).filter_by(
        dashboard_id=dashboard_id
    ).order_by(DashboardPage.page_order).all()

    response_pages = []

    for page in pages:
        widgets = db.query(DashboardWidget).filter_by(
            page_id=page.id
        ).all()

        widget_results = []

        for widget in widgets:
            try:
                cache_key = f"{dashboard.project_id}:{widget.id}:{widget.query}"
                cached = get_cache(cache_key)

                if cached:
                    result = cached
                else:
                    result = query_dataset(
                        sql=widget.query,
                        project_id=dashboard.project_id,
                        dataset_name=widget.dataset_name,
                    )
                    set_cache(cache_key, result)

                rows = result.get("rows", [])
                columns = result.get("columns", [])
                engine_used = result.get("engine", "unknown")

                # 🧠 Format based on chart type
                if widget.chart_type == "kpi":
                    first_row = rows[0] if rows else {}
                    data = {
                        "type": "kpi",
                        "value": first_row.get("value") if "value" in first_row else next(iter(first_row.values()), None)
                    }

                elif widget.chart_type in ["bar", "line", "area", "pie"]:
                    data = {
                        "type": widget.chart_type,
                        "x_axis": widget.x_axis,
                        "y_axis": widget.y_axis,
                        "data": rows
                    }

                elif widget.chart_type == "table":
                    data = {
                        "type": "table",
                        "columns": columns,
                        "rows": rows
                    }

                else:
                    data = {"data": rows}

            except Exception as e:
                data = {"error": str(e)}
                engine_used = "error"

            widget_results.append({
                "widget_id": widget.id,
                "chart_type": widget.chart_type,
                "query":widget.query,
                "engine": engine_used,
                "layout": {
                    "x": widget.pos_x,
                    "y": widget.pos_y,
                    "w": widget.width,
                    "h": widget.height
                },
                "labels": {
                    "x": widget.x_axis,
                    "y": widget.y_axis,
                },
                "data": data
            })

        response_pages.append({
            "page_id": page.id,
            "name": page.name,
            "widgets": widget_results
        })

    return {
        "dashboard_id": dashboard.id,
        "name": dashboard.name,
        "pages": response_pages
    }


@router.delete("/{dashboard_id}")
def delete_dashboard(
    dashboard_id: int,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a dashboard and all its pages and widgets.
    Only project owners and editors may perform this action.
    """

    # ── 1. Fetch dashboard ────────────────────────────────────────────────
    dashboard = db.query(Dashboard).filter_by(id=dashboard_id).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # ── 2. Permission check (owner or editor) ─────────────────────────────
    _require_member(db, dashboard.project_id, user_id, roles=("owner", "admin", "editor"))

    # ── 3. Cascade: widgets → pages → dashboard ───────────────────────────
    pages = db.query(DashboardPage).filter_by(dashboard_id=dashboard_id).all()
    for page in pages:
        db.query(DashboardWidget).filter_by(page_id=page.id).delete()
    db.query(DashboardPage).filter_by(dashboard_id=dashboard_id).delete()
    db.delete(dashboard)
    db.commit()

    return {
        "message": f"Dashboard '{dashboard.name}' deleted",
        "dashboard_id": dashboard_id,
    }
