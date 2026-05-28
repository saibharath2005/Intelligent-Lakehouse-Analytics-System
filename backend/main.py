from fastapi import FastAPI
from db.base import Base
from db.session import engine
from spark.session import get_spark, stop_spark
from api.v1 import auth, project, chat, dataset, analyze, project_key, dashboard, dashboard_ai, analyze_manual
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting up...")
    Base.metadata.create_all(bind=engine)  # ✅ moved here
    get_spark()
    yield
    print("Shutting down...")
    stop_spark()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ❌ Remove: Base.metadata.create_all(bind=engine)  ← delete this line

app.include_router(auth.router, prefix="/api/v1")
app.include_router(project.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(dataset.router, prefix="/api/v1")
app.include_router(analyze.router, prefix="/api/v1")
app.include_router(project_key.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(dashboard_ai.router, prefix="/api/v1")
app.include_router(analyze_manual.router, prefix="/api/v1")