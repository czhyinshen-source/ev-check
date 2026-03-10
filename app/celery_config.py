# Celery 配置文件
from celery import Celery

from app.config import settings

celery_app = Celery(
    "ev_check",
    broker=settings.CELERY_BROKER_URL or "redis://localhost:6379/0",
    backend=settings.CELERY_RESULT_BACKEND or "redis://localhost:6379/0",
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    beat_schedule={},
)

celery_app.autodiscover_tasks(["app.tasks"])
