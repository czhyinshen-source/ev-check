# 检查执行服务
# 业务流程编排，协调检查执行
from datetime import datetime
from typing import List, Optional, Dict, Any, Set

from app.utils.datetime_util import get_now

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    CheckRule,
    CheckResult,
    CheckResultDetail,
    CheckItem,
    CheckItemList,
    Snapshot,
    SnapshotInstance,
    EnvironmentData,
    Communication,
    CommunicationGroup,
)
from app.services.check_executor import execute_check, CheckResult as ExecutorResult
from app.services.check_lock import get_check_lock_manager
from app.services.check_progress import get_progress_tracker
from app.utils.ssh_client import SSHClientWrapper


class CheckExecutionError(Exception):
    """检查执行错误"""
    pass


class CheckExecutionService:
    """检查执行服务 - 业务流程编排"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.lock_manager = get_check_lock_manager()
        self.progress_tracker = get_progress_tracker()

    async def execute_rule(self, rule_id: int) -> List[CheckResult]:
        """根据规则执行"""
        result = await self.db.execute(select(CheckRule).where(CheckRule.id == rule_id))
        rule = result.scalar_one_or_none()
        
        if not rule:
            raise CheckExecutionError("规则不存在")
            
        if not rule.execution_targets:
            raise CheckExecutionError("规则未配置任何执行目标")
            
        from app.models import CheckReport
        report = CheckReport(
            rule_id=rule_id,
            name=f"{rule.name}_{get_now().strftime('%Y%m%d_%H%M%S')}",
            trigger_type="manual",
            status="pending",
            total_nodes=0,
            start_time=get_now()
        )
        self.db.add(report)
        await self.db.flush()
        
        results = []
        is_first = True
        total_nodes = 0
        
        for target in rule.execution_targets:
            comm_ids = await self._resolve_communication_ids(target.get("communications", {}))
            c_item_ids = await self._resolve_check_item_ids(target.get("check_items", {}))
            snapshot_id = target.get("snapshot_id")
            
            if not comm_ids or not c_item_ids:
                continue
                
            for comm_id in comm_ids:
                try:
                    res = await self._start_check_internal(
                        rule_id, comm_id, c_item_ids, snapshot_id, report.id, skip_lock_check=not is_first
                    )
                    results.append(res)
                    total_nodes += 1
                    is_first = False
                except CheckExecutionError as e:
                    print(f"启动检查失败: {e}")
                    
        report.total_nodes = total_nodes
        if total_nodes == 0:
            report.status = "failed"
            report.end_time = get_now()
            
        await self.db.commit()
        return results

    async def _start_check_internal(
        self,
        rule_id: int,
        communication_id: int,
        check_item_ids: List[int],
        snapshot_id: Optional[int],
        report_id: Optional[int],
        skip_lock_check: bool = False,
    ) -> CheckResult:
        """
        启动单机检查
        """
        if not skip_lock_check and await self.lock_manager.is_locked():
            current_task_id = await self.lock_manager.get_current_task_id()
            raise CheckExecutionError(f"已有检查任务在执行中 (任务ID: {current_task_id})，请等待完成后重试")

        rule = await self._get_rule(rule_id)
        if not rule:
            raise CheckExecutionError(f"检查规则不存在: {rule_id}")

        communication = await self._get_communication(communication_id)
        if not communication:
            raise CheckExecutionError(f"通信机不存在: {communication_id}")

        check_result = CheckResult(
            report_id=report_id,
            rule_id=rule_id,
            communication_id=communication_id,
            status="pending",
            start_time=get_now(),
            progress=0,
        )
        self.db.add(check_result)
        await self.db.commit()
        await self.db.refresh(check_result)

        if not skip_lock_check:
            lock_acquired = await self.lock_manager.acquire_lock(check_result.id)
            if not lock_acquired:
                check_result.status = "failed"
                check_result.error_message = "无法获取执行锁"
                await self.db.commit()
                # If we fail, ensure we don't proceed
                raise CheckExecutionError("无法获取执行锁，可能有其他任务正在执行")
                
        # Fire celery task here
        from app.tasks.check_tasks import execute_check_task
        execute_check_task.delay(
            result_id=check_result.id,
            rule_id=rule_id,
            communication_id=communication_id,
            snapshot_id=snapshot_id,
            check_item_ids=check_item_ids
        )

        return check_result

    async def execute_check(
        self,
        result_id: int,
        rule_id: int,
        communication_id: int,
        snapshot_id: Optional[int] = None,
        check_item_ids: Optional[List[int]] = None,
    ) -> CheckResult:
        """
        执行检查（由 Celery 任务调用）
        """
        result = await self.db.execute(select(CheckResult).where(CheckResult.id == result_id))
        check_result = result.scalar_one_or_none()
        if not check_result:
            raise CheckExecutionError(f"检查结果不存在: {result_id}")

        check_result.status = "running"
        report_id = check_result.report_id
        if report_id:
            from sqlalchemy import update
            from app.models import CheckReport
            stmt = update(CheckReport).where(CheckReport.id == report_id).values(status="running")
            await self.db.execute(stmt)
            
        await self.db.commit()

        try:
            # 1. 获取检查规则和展平后的检查项列表
            if not check_item_ids:
                raise CheckExecutionError("执行目标未指定检查项")
                
            res = await self.db.execute(select(CheckItem).where(CheckItem.id.in_(check_item_ids)))
            check_items = res.scalars().all()
            if not check_items:
                raise CheckExecutionError("提取检查项目录全部为空")

            snapshot_ids = [snapshot_id] if snapshot_id else []

            # 3. 建立 SSH 连接
            communication = await self._get_communication(communication_id)
            if not communication:
                raise CheckExecutionError("通信机不存在")
            ssh_client = await self._create_ssh_client(communication)

            try:
                connected = await ssh_client.connect()
                if not connected:
                    raise CheckExecutionError(f"无法连接到通信机: {communication.ip_address}")
            except Exception as e:
                raise CheckExecutionError(f"SSH 连接失败: {str(e)}")

            # 4. 设置进度追踪
            total_items = len(check_items)
            await self.progress_tracker.set_total_items(result_id, total_items)
            await self.progress_tracker.update_progress(result_id, 0, "开始检查...")

            # 5. 逐个执行检查项
            passed = 0
            failed = 0
            errors = 0

            for idx, check_item in enumerate(check_items):
                await self.db.refresh(check_result)
                if check_result.status == "cancelled":
                    await self.progress_tracker.update_progress(result_id, (idx / total_items) * 100, "检查已取消")
                    break

                baseline_data = None
                # We attempt to find the appropriate baseline data across snapshots
                if snapshot_ids:
                    # simplistic resolution: find any snapshot instance for this item and comm
                    env_data = await self._get_any_environment_data(snapshot_ids, communication_id, check_item.id)
                    if env_data:
                        baseline_data = env_data.data_value

                item_name = check_item.name
                await self.progress_tracker.set_current_item(result_id, item_name)

                check_item_dict = {
                    "id": check_item.id,
                    "name": check_item.name,
                    "type": check_item.type,
                    "target_path": check_item.target_path,
                    "check_attributes": check_item.check_attributes,
                }

                executor_result = await execute_check(ssh_client, check_item_dict, baseline_data)

                if executor_result.status == "pass":
                    passed += 1
                elif executor_result.status == "fail":
                    failed += 1
                else:
                    errors += 1

                detail = CheckResultDetail(
                    result_id=result_id,
                    check_item_id=check_item.id,
                    status=executor_result.status,
                    expected_value=executor_result.expected_value,
                    actual_value=executor_result.actual_value,
                    message=executor_result.message,
                )
                self.db.add(detail)

                progress = int(((idx + 1) / total_items) * 100)
                await self.progress_tracker.increment_completed(result_id)
                await self.progress_tracker.update_progress(result_id, progress, f"已检查 {idx + 1}/{total_items} 项")
                check_result.progress = progress
                await self.db.commit()

            await ssh_client.close()
            await self.progress_tracker.clear_progress(result_id)
            await self.lock_manager.release_lock(result_id)

            # 6. 确定最终状态
            check_result.end_time = get_now()
            check_result.progress = 100

            if errors > 0:
                if passed == 0 and failed == 0:
                    check_result.status = "failed"
                    check_result.error_message = "所有检查项执行遇到系统错误"
                else:
                    check_result.status = "completed_with_errors"
            elif failed > 0:
                check_result.status = "failed"
                check_result.error_message = f"有 {failed} 项检查不通过"
            else:
                check_result.status = "success"

            await self.db.commit()
            await self.db.refresh(check_result)
            
            if report_id:
                await self.update_report_progress(report_id, check_result.status == "success")
                
            return check_result

        except CheckExecutionError:
            await self.db.rollback()
            await self.lock_manager.release_lock(result_id)
            check_result.status = "failed"
            check_result.end_time = get_now()
            await self.db.commit()
            if report_id:
                await self.update_report_progress(report_id, False)
            raise
        except Exception as e:
            await self.db.rollback()
            await self.lock_manager.release_lock(result_id)
            check_result.status = "failed"
            check_result.error_message = str(e)
            check_result.end_time = get_now()
            await self.db.commit()
            if report_id:
                await self.update_report_progress(report_id, False)
            raise CheckExecutionError(f"检查执行异常: {str(e)}")

    async def update_report_progress(self, report_id: int, is_success: bool):
        """更新报表执行进度，若已完成则更新报表状态"""
        from sqlalchemy import update, select
        from app.models import CheckReport
        stmt = update(CheckReport).where(CheckReport.id == report_id).values(
            completed_nodes=CheckReport.completed_nodes + 1,
            success_nodes=CheckReport.success_nodes + (1 if is_success else 0),
            failed_nodes=CheckReport.failed_nodes + (0 if is_success else 1)
        )
        await self.db.execute(stmt)
        await self.db.commit()
        
        result = await self.db.execute(select(CheckReport).where(CheckReport.id == report_id))
        report = result.scalar_one_or_none()
        if report and report.completed_nodes >= report.total_nodes:
            report.status = "failed" if report.failed_nodes > 0 else "success"
            report.end_time = get_now()
            await self.db.commit()

    async def _resolve_communication_ids(self, data: dict) -> List[int]:
        ids = set(data.get("ids", []))
        group_ids = data.get("group_ids", [])
        if group_ids:
            res = await self.db.execute(
                select(Communication)
                .where(Communication.group_id.in_(group_ids))
            )
            for c in res.scalars().all():
                ids.add(c.id)
        return list(ids)
        
    async def _resolve_check_item_ids(self, data: dict) -> List[int]:
        ids = set(data.get("ids", []))
        list_ids = data.get("list_ids", [])
        if list_ids:
            res = await self.db.execute(
                select(CheckItem)
                .where(CheckItem.list_id.in_(list_ids))
            )
            for itm in res.scalars().all():
                ids.add(itm.id)
        return list(ids)

    async def get_current_task(self) -> Optional[Dict[str, Any]]:
        task_id = await self.lock_manager.get_current_task_id()
        if not task_id: return None

        result = await self.db.execute(select(CheckResult).where(CheckResult.id == task_id))
        check_result = result.scalar_one_or_none()
        if not check_result: return None

        progress = await self.progress_tracker.get_progress(task_id)

        return {
            "id": check_result.id,
            "rule_id": check_result.rule_id,
            "communication_id": check_result.communication_id,
            "status": check_result.status,
            "progress": check_result.progress,
            "total_items": progress.get("total_items", 0),
            "completed_items": progress.get("completed_items", 0),
            "current_item": progress.get("current_item"),
            "message": progress.get("message"),
            "start_time": check_result.start_time.isoformat() if check_result.start_time else None,
        }

    async def cancel_check(self, result_id: int) -> bool:
        result = await self.db.execute(select(CheckResult).where(CheckResult.id == result_id))
        check_result = result.scalar_one_or_none()
        if not check_result: return False

        if check_result.status == "running":
            check_result.status = "cancelled"
            check_result.end_time = get_now()
            await self.db.commit()
            await self.progress_tracker.update_progress(result_id, 0, "检查已取消")
            return True

        if check_result.status == "pending":
            await self.db.delete(check_result)
            await self.db.commit()
            return True

        return False



    # ==================== 私有方法 ====================
    async def _get_rule(self, rule_id: int) -> Optional[CheckRule]:
        result = await self.db.execute(select(CheckRule).where(CheckRule.id == rule_id))
        return result.scalar_one_or_none()

    async def _get_communication(self, comm_id: int) -> Optional[Communication]:
        result = await self.db.execute(select(Communication).where(Communication.id == comm_id))
        return result.scalar_one_or_none()

    async def _get_any_environment_data(self, snapshot_ids: List[int], comm_id: int, item_id: int) -> Optional[EnvironmentData]:
        # 1. 先查找匹配的快照实例 ID (这些 ID 是唯一的，结果集很小)
        instance_q = select(SnapshotInstance).where(
            SnapshotInstance.snapshot_id.in_(snapshot_ids),
            SnapshotInstance.communication_id == comm_id
        ).order_by(SnapshotInstance.id.desc())
        instance_res = await self.db.execute(instance_q)
        instances = instance_res.scalars().all()
        
        if not instances:
            return None
            
        instance_ids = [inst.id for inst in instances]
        instance_map = {inst.id: inst for inst in instances}

        # 2. 从环境数据表中通过实例 ID 查找
        q = select(EnvironmentData).where(
            EnvironmentData.snapshot_instance_id.in_(instance_ids),
            EnvironmentData.check_item_id == item_id
        ).order_by(EnvironmentData.created_at.desc()).limit(1)
        res = await self.db.execute(q)
        env_data = res.scalar_one_or_none()
        
        if not env_data:
            return None
            
        # 3. 如果数据在文件中，动态加载
        if env_data.has_file_data:
            inst = instance_map.get(env_data.snapshot_instance_id)
            if inst and inst.data_path:
                import os
                import json
                if os.path.exists(inst.data_path):
                    try:
                        with open(inst.data_path, 'r', encoding='utf-8') as f:
                            all_data = json.load(f)
                            # 从文件中提取当前检查项的数据
                            env_data.data_value = all_data.get(str(item_id))
                    except Exception as e:
                        print(f"警告: 加载快照文件失败 {inst.data_path} - {e}")
                else:
                    print(f"警告: 快照文件不存在 {inst.data_path}")
                    
        return env_data

    async def _create_ssh_client(self, communication: Communication) -> SSHClientWrapper:
        # 处理密钥库引用
        private_key = None
        private_key_path = communication.private_key_path
        
        if private_key_path and private_key_path.startswith("key_"):
            try:
                from app.models import SSHKey
                key_id = int(private_key_path.replace("key_", ""))
                result = await self.db.execute(select(SSHKey).where(SSHKey.id == key_id))
                ssh_key = result.scalar_one_or_none()
                if ssh_key:
                    private_key = ssh_key.private_key
                    private_key_path = None
            except (ValueError, Exception):
                pass

        return SSHClientWrapper(
            host=communication.ip_address,
            port=communication.port or 22,
            username=communication.username or "root",
            password=communication.password,
            private_key_path=private_key_path,
            private_key=private_key,
        )
