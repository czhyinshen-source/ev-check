# 快照构建 Celery 任务
from celery import Task

from app.celery_config import celery_app
from app.database import async_session_maker
from app.services.snapshot_build_service import SnapshotBuildService, SnapshotBuildError


class SnapshotBuildCallback(Task):
    """快照构建任务回调"""

    def on_success(self, retval, task_id, args, kwargs):
        print(f"快照构建任务 {task_id} 成功完成: {retval}")

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        print(f"快照构建任务 {task_id} 失败: {exc}")


def run_build(task_id: int):
    """执行快照构建的同步包装"""
    import asyncio
    import traceback

    async def _execute():
        from app.database import create_session_maker
        session_maker, local_engine = create_session_maker(use_null_pool=True)
        async with session_maker() as db:
            service = SnapshotBuildService(db)
            try:
                result = await service.execute_build(task_id)
                return {
                    "status": "success",
                    "task_id": result.id,
                    "snapshot_id": result.snapshot_id,
                    "message": f"构建完成，状态: {result.status}",
                }
            except SnapshotBuildError as e:
                return {
                    "status": "error",
                    "task_id": task_id,
                    "message": str(e),
                }
            except Exception as e:
                traceback.print_exc()
                return {
                    "status": "error",
                    "task_id": task_id,
                    "message": f"构建异常: {str(e)}",
                }
            finally:
                await local_engine.dispose()

    return asyncio.run(_execute())


@celery_app.task(
    bind=True,
    base=SnapshotBuildCallback,
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 3, "countdown": 60},
    soft_time_limit=7200,  # 2小时软限制
    time_limit=7800,  # 2小时10分钟硬限制
)
def execute_snapshot_build_task(self, task_id: int):
    """执行快照构建任务"""
    return run_build(task_id)
