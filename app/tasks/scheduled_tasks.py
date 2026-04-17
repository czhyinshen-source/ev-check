# 定时任务
from datetime import datetime
from typing import Optional
from app.utils.datetime_util import get_now

from celery import Task
from celery.schedules import crontab

from app.celery_config import celery_app
from app.database import async_session_maker
from app.models import CheckResult, Communication, CheckRule
from app.models.check_result import ScheduledTask
from app.utils.ssh_client import SSHClientWrapper
from sqlalchemy import select, update


class CallbackTask(Task):
    """带回调的任务"""
    def on_success(self, retval, task_id, args, kwargs):
        pass

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        pass


@celery_app.task(bind=True, base=CallbackTask)
def execute_scheduled_check(self, task_id: int):
    """执行定时检查任务"""
    import asyncio
    
    async def _execute():
        from app.database import create_session_maker
        session_maker, local_engine = create_session_maker(use_null_pool=True)
        async with session_maker() as db:
            result = await db.execute(select(ScheduledTask).where(ScheduledTask.id == task_id))
            scheduled_task = result.scalar_one_or_none()
            
            if not scheduled_task or not scheduled_task.is_active:
                return {"status": "skipped", "message": "任务未激活或不存在"}
            
            if not scheduled_task.rule_id:
                return {"status": "error", "message": "未关联检查规则"}
            
            result = await db.execute(select(CheckRule).where(CheckRule.id == scheduled_task.rule_id))
            rule = result.scalar_one_or_none()
            
            if not rule:
                return {"status": "error", "message": "检查规则不存在"}
            
            from app.tasks.check_tasks import execute_batch_check_task
            
            # 委托给 batch_check_task 去创建报告并分发 celery 任务
            execute_batch_check_task.delay(rule.id)
            
            scheduled_task.last_run_at = get_now()
            await db.commit()
            
        await local_engine.dispose()
        return {"status": "success", "message": f"已触发规则 {rule.name} 的批量检查"}
    
    return asyncio.run(_execute())


@celery_app.task
def cleanup_old_check_results():
    """清理旧的检查结果"""
    import asyncio
    
    async def _cleanup():
        from app.database import create_session_maker
        session_maker, local_engine = create_session_maker(use_null_pool=True)
        async with session_maker() as db:
            result = await db.execute(
                select(CheckResult)
                .order_by(CheckResult.start_time.desc())
                .offset(100)
            )
            old_results = result.scalars().all()
            
            count = 0
            for result_obj in old_results:
                await db.delete(result_obj)
                count += 1
            
            await db.commit()
            await local_engine.dispose()
            return {"deleted": count}
    
    return asyncio.run(_cleanup())


def parse_cron_expression(cron_expr: str) -> dict:
    """解析 cron 表达式为 Celery schedule"""
    parts = cron_expr.split()
    if len(parts) != 5:
        raise ValueError("无效的 cron 表达式")
    
    minute, hour, day, month, day_of_week = parts
    
    return {
        "minute": minute,
        "hour": hour,
        "day_of_month": day,
        "month_of_year": month,
        "day_of_week": day_of_week,
    }


def update_celery_schedule(scheduled_task_id: int, cron_expr: str, task_name: str):
    """更新 Celery 定时调度"""
    schedule = crontab(**parse_cron_expression(cron_expr))
    
    celery_app.conf.beat_schedule[task_name] = {
        "task": "app.tasks.scheduled_tasks.execute_scheduled_check",
        "schedule": schedule,
        "args": (scheduled_task_id,),
    }


def remove_from_schedule(task_name: str):
    """从调度中移除任务"""
    if task_name in celery_app.conf.beat_schedule:
        del celery_app.conf.beat_schedule[task_name]


@celery_app.task
def check_communication_statuses():
    """检查所有通信机的连接状态（每分钟执行一次）"""
    import asyncio
    
    async def _check():
        from app.database import create_session_maker
        session_maker, local_engine = create_session_maker(use_null_pool=True)
        async with session_maker() as db:
            result = await db.execute(select(Communication))
            communications = result.scalars().all()
            
            for comm in communications:
                ssh_client = None
                try:
                    # 处理密钥库引用
                    private_key = None
                    private_key_path = comm.private_key_path
                    
                    if private_key_path and private_key_path.startswith("key_"):
                        try:
                            from app.models import SSHKey
                            key_id = int(private_key_path.replace("key_", ""))
                            result = await db.execute(select(SSHKey).where(SSHKey.id == key_id))
                            ssh_key = result.scalar_one_or_none()
                            if ssh_key:
                                private_key = ssh_key.private_key
                                private_key_path = None
                        except (ValueError, Exception):
                            pass

                    ssh_client = SSHClientWrapper(
                        host=comm.ip_address,
                        port=comm.port,
                        username=comm.username,
                        password=comm.password,
                        private_key_path=private_key_path,
                        private_key=private_key,
                    )
                    
                    connected = await ssh_client.connect()
                    # 检查connection_status属性是否存在
                    if hasattr(comm, 'connection_status'):
                        comm.connection_status = 'online' if connected else 'offline'
                        await db.commit()
                except Exception as e:
                    logger.error(f"检查通信机 {comm.name} 状态时出错: {str(e)}")
                    # 检查connection_status属性是否存在
                    if hasattr(comm, 'connection_status'):
                        comm.connection_status = 'offline'
                        await db.commit()
                finally:
                    if ssh_client:
                        await ssh_client.close()
            await local_engine.dispose()
    
    return asyncio.run(_check())


from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

# 配置定时任务
@celery_app.on_after_finalize.connect
def setup_periodic_tasks(sender, **kwargs):
    """应用启动时，从数据库加载所有激活的检查规则定时配置到 Celery Beat 调度器中"""
    logger.info("🔖 正在从数据库同步规则定时配置至 Celery Beat...")
    
    # 静态任务：检查通信机状态
    sender.add_periodic_task(
        crontab(minute='*/1'),
        check_communication_statuses.s(),
        name='check-communication-statuses'
    )
    
    from app.config import settings
    from sqlalchemy import create_engine, text
    
    try:
        # 使用同步引擎直接读取规则表中的 cron 配置
        sync_url = settings.DATABASE_URL.replace("aiomysql", "pymysql").replace("aiosqlite", "")
        engine = create_engine(sync_url)
        with engine.connect() as conn:
            query = text("SELECT id, name, cron_expression FROM check_rules WHERE is_active = 1 AND cron_expression IS NOT NULL")
            result = conn.execute(query)
            for row in result:
                rule_id, rule_name, cron_expr = row
                try:
                    # 容错处理：确保 cron 表达式不为空且有效
                    if not cron_expr or len(cron_expr.split()) != 5:
                        continue
                        
                    schedule = crontab(**parse_cron_expression(cron_expr))
                    # 动态注册任务，直接调用执行规则的任务
                    from app.tasks.check_tasks import execute_batch_check_task
                    sender.add_periodic_task(
                        schedule,
                        execute_batch_check_task.s(rule_id=rule_id), # 直接传 rule_id 给执行任务
                        name=f"rule_schedule_{rule_id}"
                    )
                    logger.info(f"✅ 已加载规则定时: {rule_name} (ID={rule_id}), Cron='{cron_expr}'")
                except Exception as e:
                    logger.error(f"❌ 解析规则 {rule_name} 的 Cron 失败: {e}")
    except Exception as e:
        logger.error(f"⚠️ 同步数据库任务失败: {e}")
