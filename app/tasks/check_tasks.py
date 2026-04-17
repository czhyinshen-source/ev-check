# 检查执行 Celery 任务
from celery import Task
from celery.exceptions import SoftTimeLimitExceeded

from app.celery_config import celery_app
from app.database import async_session_maker
from app.services.check_service import CheckExecutionService, CheckExecutionError


class CheckTaskCallback(Task):
    """检查任务回调"""

    def on_success(self, retval, task_id, args, kwargs):
        """任务成功完成时的回调"""
        print(f"检查任务 {task_id} 成功完成: {retval}")

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """任务失败时的回调"""
        print(f"检查任务 {task_id} 失败: {exc}")


def run_check(result_id: int, rule_id: int, communication_id: int, snapshot_id: int = None, check_item_ids: list = None):
    import asyncio
    import traceback

    async def _execute():
        from app.database import create_session_maker
        session_maker, local_engine = create_session_maker(use_null_pool=True)
        async with session_maker() as db:
            service = CheckExecutionService(db)
            try:
                result = await service.execute_check(
                    result_id=result_id,
                    rule_id=rule_id,
                    communication_id=communication_id,
                    snapshot_id=snapshot_id,
                    check_item_ids=check_item_ids,
                )
                return {
                    "status": "success",
                    "result_id": result.id,
                    "message": f"检查完成，状态: {result.status}",
                }
            except CheckExecutionError as e:
                return {
                    "status": "error",
                    "result_id": result_id,
                    "message": str(e),
                }
            except SoftTimeLimitExceeded:
                return {
                    "status": "error",
                    "result_id": result_id,
                    "message": "检查任务超时",
                }
            except Exception as e:
                traceback.print_exc()
                return {
                    "status": "error",
                    "result_id": result_id,
                    "message": f"检查执行异常: {str(e)}",
                }
            finally:
                await local_engine.dispose()

    return asyncio.run(_execute())

@celery_app.task(
    bind=True,
    base=CheckTaskCallback,
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 3, "countdown": 60},
    soft_time_limit=3600,
    time_limit=3900,
)
def execute_check_task(
    self,
    result_id: int,
    rule_id: int,
    communication_id: int,
    snapshot_id: int = None,
    check_item_ids: list = None,
):
    return run_check(result_id, rule_id, communication_id, snapshot_id, check_item_ids)


@celery_app.task(
    bind=True,
    base=CheckTaskCallback,
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 3, "countdown": 60},
)
def execute_batch_check_task(
    self,
    rule_id: int,
):
    import asyncio

    async def _execute():
        from app.database import create_session_maker
        session_maker, local_engine = create_session_maker(use_null_pool=True)
        async with session_maker() as db:
            service = CheckExecutionService(db)
            results = await service.execute_rule(rule_id)

            return {
                "status": "success",
                "created_results": len(results),
                "task_ids": [r.id for r in results],
            }
        await local_engine.dispose()

    return asyncio.run(_execute())


@celery_app.task
def cancel_check_task(result_id: int):
    """
    取消检查任务

    Args:
        result_id: 检查结果ID
    """
    import asyncio

    async def _execute():
        from app.database import create_session_maker
        session_maker, local_engine = create_session_maker(use_null_pool=True)
        async with session_maker() as db:
            service = CheckExecutionService(db)
            cancelled = await service.cancel_check(result_id)
            return {
                "status": "success" if cancelled else "not_cancelled",
                "result_id": result_id,
            }
        await local_engine.dispose()

    return asyncio.run(_execute())


@celery_app.task
def cleanup_temporary_files():
    """
    定期清理大文件对比产生的临时文件 (/tmp/ev_check_runs/)
    """
    import os
    import time
    import shutil

    target_dir = "/tmp/ev_check_runs"
    if not os.path.exists(target_dir):
        return {"status": "skipped", "reason": "directory_not_exists"}

    # 保留 24 小时
    RETENTION_SECONDS = 24 * 3600
    now = time.time()
    count = 0

    for filename in os.listdir(target_dir):
        file_path = os.path.join(target_dir, filename)
        try:
            # 检查文件修改时间
            if os.path.isfile(file_path):
                if now - os.path.getmtime(file_path) > RETENTION_SECONDS:
                    os.remove(file_path)
                    count += 1
            elif os.path.isdir(file_path):
                # 如果是目录，也要检查并清理
                if now - os.path.getmtime(file_path) > RETENTION_SECONDS:
                    shutil.rmtree(file_path)
                    count += 1
        except Exception as e:
            print(f"Failed to delete {file_path}: {e}")

    return {"status": "success", "deleted_count": count}

