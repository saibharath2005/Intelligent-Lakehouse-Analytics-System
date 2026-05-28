from sqlalchemy.orm import Session
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI

from db.models.project_api_key import ProjectAPIKey
from core.crypto import decrypt_key

DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "gemini": "gemini-1.5-flash",
    "groq": "llama-3.1-8b-instant",
}


def load_model(project_id: int, db: Session, provider: str | None = None):

    query = db.query(ProjectAPIKey).filter_by(project_id=project_id)
    provider = provider.strip().lower() if provider else None

    if provider:
        record = query.filter_by(provider=provider).first()
    else:
        record = query.filter_by(is_default=True).first()
        if not record:
            record = query.first()
    
    if not record:
        raise Exception("API key not configured for this project")

    api_key = decrypt_key(record.encrypted_key)
    provider = (record.provider or "").strip().lower()
    model_name = record.model_name or DEFAULT_MODELS.get(provider)
    temperature = record.temperature or 0.2

    if not model_name:
        raise ValueError(f"No default model configured for provider '{provider}'")
 
    if provider == "openai":
        return ChatOpenAI(
            model=model_name,
            temperature=temperature,
            api_key=api_key
        )

    if provider == "gemini":
        return ChatGoogleGenerativeAI(
            model=model_name,
            temperature=temperature,
            google_api_key=api_key
        )

    if provider == "groq":
        return ChatOpenAI(
            model=model_name,
            temperature=temperature,
            api_key=api_key,
            base_url="https://api.groq.com/openai/v1",
        )
    

    raise ValueError(f"Unsupported model provider: {provider}")
