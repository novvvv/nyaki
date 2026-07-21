from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import initialize_firebase
from .config import get_settings
from .routes import router


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_firebase()
    yield


settings = get_settings()
app = FastAPI(
    title="Nyaki Sync Hub",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
