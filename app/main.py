# FastAPI 应用入口
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings
from app.database import init_db
from app.api import users, communications, check_items, snapshots, checks, ssh_keys, check_rules, config


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    await init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api/v1/users", tags=["用户管理"])
app.include_router(communications.router, prefix="/api/v1/communications", tags=["通信机管理"])
app.include_router(check_items.router, prefix="/api/v1/check-items", tags=["检查项管理"])
app.include_router(snapshots.router, prefix="/api/v1/snapshots", tags=["快照管理"])
app.include_router(checks.router, prefix="/api/v1/checks", tags=["环境检查"])
app.include_router(ssh_keys.router, prefix="/api/v1", tags=["SSH 密钥管理"])
app.include_router(check_rules.router, prefix="/api/v1", tags=["检查规则管理"])
app.include_router(config.router, prefix="/api/v1", tags=["配置管理"])

app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/")
async def root():
    """根路径 - 跳转到登录页"""
    return FileResponse("app/static/login.html")


@app.get("/login")
async def login():
    """登录页面"""
    return FileResponse("app/static/login.html")


@app.get("/dashboard")
async def dashboard():
    """控制台页面"""
    return FileResponse("app/static/dashboard.html")


@app.get("/dashboard.html")
async def dashboard_html():
    """控制台页面html"""
    return FileResponse("app/static/dashboard.html")


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "healthy"}
