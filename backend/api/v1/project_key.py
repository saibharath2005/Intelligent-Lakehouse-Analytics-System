from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from db.session import SessionLocal
from db.models.project_api_key import ProjectAPIKey
from db.models.project_member import ProjectMember
from schemas.project_key import APIKeyResponse
from core.dependencies import get_current_user
from core.crypto import encrypt_key
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

router = APIRouter(prefix="/project-key", tags=["Project API Keys"])

DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "gemini": "gemini-1.5-flash",
    "groq": "llama-3.1-8b-instant",
    "anthropic": "claude-3-5-haiku-latest",
    "mistral": "mistral-small-latest",
    "cohere": "command-r-plus",
}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _normalise_provider(provider: str) -> str:
    return provider.strip().lower()


def _default_model(provider: str) -> str:
    return DEFAULT_MODELS.get(provider, "gpt-4o-mini")


def _payload_value(payload: dict, *names: str):
    for name in names:
        value = payload.get(name)
        if value is not None:
            return value
    return None


def _parse_set_payload(payload: dict):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="JSON object body is required")

    try:
        project_id = int(_payload_value(payload, "project_id", "projectId"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="project_id is required")

    provider = str(_payload_value(payload, "provider") or "").strip().lower()
    api_key = str(_payload_value(payload, "api_key", "apiKey", "key") or "").strip()
    model_name = str(_payload_value(payload, "model_name", "modelName") or "").strip()
    temperature = _payload_value(payload, "temperature")
    is_default = _payload_value(payload, "is_default", "isDefault")

    if not provider:
        raise HTTPException(status_code=400, detail="Provider is required")
    if not api_key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")

    try:
        temperature = float(temperature) if temperature is not None else 0.2
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="temperature must be a number")

    if isinstance(is_default, str):
        is_default = is_default.strip().lower() not in {"0", "false", "no", "off"}
    elif is_default is None:
        is_default = True

    return {
        "project_id": project_id,
        "provider": provider,
        "api_key": api_key,
        "model_name": model_name,
        "temperature": temperature,
        "is_default": bool(is_default),
    }


def _ensure_api_key_columns(db: Session):
    statements = [
        "ALTER TABLE project_api_keys ADD COLUMN IF NOT EXISTS model_name VARCHAR",
        "ALTER TABLE project_api_keys ADD COLUMN IF NOT EXISTS temperature FLOAT DEFAULT 0.2",
        "ALTER TABLE project_api_keys ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE",
    ]
    for statement in statements:
        db.execute(text(statement))


@router.post("/set")
def set_api_key(
    payload: dict = Body(...),
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    data = _parse_set_payload(payload)
    project_id = data["project_id"]
    provider = data["provider"]

    member = db.query(ProjectMember).filter_by(
        project_id=project_id,
        user_id=user_id,
        role="owner"
    ).first()

    if not member:
        raise HTTPException(status_code=403, detail="Only owner can set API key")

    try:
        _ensure_api_key_columns(db)
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"API key storage is not ready: {e}") from e

    model_name = data["model_name"] or _default_model(provider)
    temperature = data["temperature"]
    encrypted = encrypt_key(data["api_key"])

    existing = db.query(ProjectAPIKey).filter_by(
        project_id=project_id,
        provider=provider
    ).first()

    make_default = data["is_default"]
    if make_default:
        db.query(ProjectAPIKey).filter_by(project_id=project_id).update(
            {"is_default": False}
        )
    elif not db.query(ProjectAPIKey).filter_by(project_id=project_id).first():
        make_default = True

    if existing:
        existing.encrypted_key = encrypted
        existing.model_name = model_name
        existing.temperature = temperature
        existing.is_default = make_default
    else:
        record = ProjectAPIKey(
            project_id=project_id,
            provider=provider,
            encrypted_key=encrypted,
            model_name=model_name,
            temperature=temperature,
            is_default=make_default,
        )
        db.add(record)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Key already exists")
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Could not save API key: {e}") from e

    return {
        "message": "API key saved securely",
        "project_id": project_id,
        "provider": provider,
        "model_name": model_name,
        "temperature": temperature,
        "is_default": make_default,
    }


@router.get("/{project_id}/{provider}", response_model=APIKeyResponse)
def get_api_key(
    project_id: int,
    provider: str,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    member = db.query(ProjectMember).filter_by(
        project_id=project_id,
        user_id=user_id,
        role="owner"
    ).first()

    if not member:
        raise HTTPException(status_code=403)

    record = db.query(ProjectAPIKey).filter_by(
        project_id=project_id,
        provider=_normalise_provider(provider)
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="No key found")

    masked = "****" + record.encrypted_key[-4:]

    return APIKeyResponse(
        project_id=project_id,
        provider=record.provider,
        masked_key=masked,
        model_name=record.model_name,
        temperature=record.temperature or 0.2,
        is_default=bool(record.is_default),
    )

@router.delete("/{project_id}/{provider}")
def delete_api_key(
    project_id: int,
    provider: str,
    user_id: int = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    member = db.query(ProjectMember).filter_by(
        project_id=project_id,
        user_id=user_id,
        role="owner"
    ).first()

    if not member:
        raise HTTPException(status_code=403)

    record = db.query(ProjectAPIKey).filter_by(
        project_id=project_id,
        provider=_normalise_provider(provider)
    ).first()

    if not record:
        raise HTTPException(status_code=404)

    db.delete(record)
    db.commit()

    return {"message": "API key deleted"}
