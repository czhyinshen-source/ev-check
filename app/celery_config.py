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
    enable_utc=False,
    broker_connection_retry_on_startup=True,
    beat_schedule={
        "cleanup-temp-files-every-hour": {
            "task": "app.tasks.check_tasks.cleanup_temporary_files",
            "schedule": 3600.0,  # 每小时执行一次
        },
    },
)

# 导入任务模块以注册任务
from app.tasks import snapshot_build_tasks  # noqa: E402
from app.tasks import check_tasks  # noqa: E402
from app.tasks import scheduled_tasks  # noqa: E402
