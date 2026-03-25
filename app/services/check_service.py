# 检查执行服务
# 业务流程编排，协调检查执行
from datetime import datetime
from typing import List, Optional, Dict, Any

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

    async def start_check(
        self,
        rule_id: int,
        communication_id: int,
        snapshot_id: int,
    ) -> CheckResult:
        """
        启动单机检查

        Args:
            rule_id: 检查规则ID
            communication_id: 通信机ID
            snapshot_id: 快照ID

        Returns:
            CheckResult: 检查结果记录

        Raises:
            CheckExecutionError: 检查启动失败
        """
        # 1. 检查是否已有任务在执行
        if await self.lock_manager.is_locked():
            current_task_id = await self.lock_manager.get_current_task_id()
            raise CheckExecutionError(
                f"已有检查任务在执行中 (任务ID: {current_task_id})，请等待完成后重试"
            )

        # 2. 验证规则、快照、通信机是否存在
        rule = await self._get_rule(rule_id)
        if not rule:
            raise CheckExecutionError(f"检查规则不存在: {rule_id}")

        snapshot = await self._get_snapshot(snapshot_id)
        if not snapshot:
            raise CheckExecutionError(f"快照不存在: {snapshot_id}")

        communication = await self._get_communication(communication_id)
        if not communication:
            raise CheckExecutionError(f"通信机不存在: {communication_id}")

        # 3. 创建检查结果记录
        check_result = CheckResult(
            rule_id=rule_id,
            communication_id=communication_id,
            status="pending",
            start_time=datetime.utcnow(),
            progress=0,
        )
        self.db.add(check_result)
        await self.db.commit()
        await self.db.refresh(check_result)

        # 4. 获取锁
        lock_acquired = await self.lock_manager.acquire_lock(check_result.id)
        if not lock_acquired:
            check_result.status = "failed"
            check_result.error_message = "无法获取执行锁"
            await self.db.commit()
            raise CheckExecutionError("无法获取执行锁，可能有其他任务正在执行")

        return check_result

    async def execute_check(
        self,
        result_id: int,
        rule_id: int,
        communication_id: int,
        snapshot_id: int,
    ) -> CheckResult:
        """
        执行检查（由 Celery 任务调用）

        Args:
            result_id: 检查结果ID
            rule_id: 检查规则ID
            communication_id: 通信机ID
            snapshot_id: 快照ID

        Returns:
            CheckResult: 更新后的检查结果
        """
        # 获取检查结果记录
        result = await self.db.execute(
            select(CheckResult).where(CheckResult.id == result_id)
        )
        check_result = result.scalar_one_or_none()
        if not check_result:
            raise CheckExecutionError(f"检查结果不存在: {result_id}")

        check_result.status = "running"
        await self.db.commit()

        try:
            # 1. 获取检查规则和检查项列表
            rule = await self._get_rule_with_items(rule_id)
            if not rule or not rule.check_item_list:
                raise CheckExecutionError("检查规则未关联检查项列表")

            check_items = rule.check_item_list.items
            if not check_items:
                raise CheckExecutionError("检查项列表为空")

            # 2. 获取快照基准数据
            snapshot_instance = await self._get_snapshot_instance(
                snapshot_id, communication_id, rule.check_item_list_id
            )

            # 3. 建立 SSH 连接
            communication = await self._get_communication(communication_id)
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
                # 检查是否被取消
                await self.db.refresh(check_result)
                if check_result.status == "cancelled":
                    await self.progress_tracker.update_progress(
                        result_id, (idx / total_items) * 100, "检查已取消"
                    )
                    break

                # 获取基准数据
                baseline_data = None
                if snapshot_instance:
                    env_data = await self._get_environment_data(
                        snapshot_instance.id, check_item.id
                    )
                    if env_data:
                        baseline_data = env_data.data_value

                # 执行检查
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

                # 统计结果
                if executor_result.status == "pass":
                    passed += 1
                elif executor_result.status == "fail":
                    failed += 1
                else:
                    errors += 1

                # 保存检查结果详情
                detail = CheckResultDetail(
                    result_id=result_id,
                    check_item_id=check_item.id,
                    status=executor_result.status,
                    expected_value=executor_result.expected_value,
                    actual_value=executor_result.actual_value,
                    message=executor_result.message,
                )
                self.db.add(detail)

                # 更新进度
                progress = int(((idx + 1) / total_items) * 100)
                completed = idx + 1
                await self.progress_tracker.increment_completed(result_id)
                await self.progress_tracker.update_progress(
                    result_id,
                    progress,
                    f"已检查 {completed}/{total_items} 项"
                )
                check_result.progress = progress
                await self.db.commit()

            # 6. 完成检查
            await ssh_client.close()
            await self.progress_tracker.clear_progress(result_id)
            await self.lock_manager.release_lock(result_id)

            check_result.status = "success" if errors == 0 else "completed_with_errors"
            check_result.end_time = datetime.utcnow()
            check_result.progress = 100

            # 如果全部错误，标记为失败
            if errors > 0 and passed == 0 and failed == 0:
                check_result.status = "failed"
                check_result.error_message = f"所有检查项执行失败"

            await self.db.commit()
            await self.db.refresh(check_result)
            return check_result

        except CheckExecutionError:
            await self.lock_manager.release_lock(result_id)
            check_result.status = "failed"
            check_result.end_time = datetime.utcnow()
            await self.db.commit()
            raise
        except Exception as e:
            await self.lock_manager.release_lock(result_id)
            check_result.status = "failed"
            check_result.error_message = str(e)
            check_result.end_time = datetime.utcnow()
            await self.db.commit()
            raise CheckExecutionError(f"检查执行异常: {str(e)}")

    async def start_batch_check(
        self,
        rule_id: int,
        communication_ids: List[int],
        snapshot_id: int,
    ) -> List[CheckResult]:
        """
        启动批量检查（为每台通信机创建独立任务）

        Args:
            rule_id: 检查规则ID
            communication_ids: 通信机ID列表
            snapshot_id: 快照ID

        Returns:
            List[CheckResult]: 检查结果记录列表
        """
        results = []
        for comm_id in communication_ids:
            try:
                result = await self.start_check(rule_id, comm_id, snapshot_id)
                results.append(result)
            except CheckExecutionError as e:
                # 记录失败但不中断其他任务
                print(f"启动检查失败: {e}")
        return results

    async def get_current_task(self) -> Optional[Dict[str, Any]]:
        """获取当前正在执行的任务"""
        task_id = await self.lock_manager.get_current_task_id()
        if not task_id:
            return None

        result = await self.db.execute(
            select(CheckResult).where(CheckResult.id == task_id)
        )
        check_result = result.scalar_one_or_none()
        if not check_result:
            return None

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
        """取消检查"""
        result = await self.db.execute(
            select(CheckResult).where(CheckResult.id == result_id)
        )
        check_result = result.scalar_one_or_none()
        if not check_result:
            return False

        if check_result.status == "running":
            check_result.status = "cancelled"
            check_result.end_time = datetime.utcnow()
            await self.db.commit()
            await self.progress_tracker.update_progress(result_id, 0, "检查已取消")
            return True

        if check_result.status == "pending":
            # 尚未开始，直接删除
            await self.db.delete(check_result)
            await self.db.commit()
            return True

        return False

    # ==================== 私有方法 ====================

    async def _get_rule(self, rule_id: int) -> Optional[CheckRule]:
        """获取检查规则"""
        result = await self.db.execute(
            select(CheckRule).where(CheckRule.id == rule_id)
        )
        return result.scalar_one_or_none()

    async def _get_rule_with_items(self, rule_id: int) -> Optional[CheckRule]:
        """获取检查规则及其检查项列表"""
        result = await self.db.execute(
            select(CheckRule)
            .options(selectinload(CheckRule.check_item_list)
                    .selectinload(CheckItemList.items))
            .where(CheckRule.id == rule_id)
        )
        return result.scalar_one_or_none()

    async def _get_snapshot(self, snapshot_id: int) -> Optional[Snapshot]:
        """获取快照"""
        result = await self.db.execute(
            select(Snapshot).where(Snapshot.id == snapshot_id)
        )
        return result.scalar_one_or_none()

    async def _get_communication(self, comm_id: int) -> Optional[Communication]:
        """获取通信机"""
        result = await self.db.execute(
            select(Communication).where(Communication.id == comm_id)
        )
        return result.scalar_one_or_none()

    async def _get_snapshot_instance(
        self,
        snapshot_id: int,
        communication_id: int,
        check_item_list_id: int,
    ) -> Optional[SnapshotInstance]:
        """获取快照实例"""
        result = await self.db.execute(
            select(SnapshotInstance).where(
                SnapshotInstance.snapshot_id == snapshot_id,
                SnapshotInstance.communication_id == communication_id,
                SnapshotInstance.check_item_list_id == check_item_list_id,
            )
        )
        return result.scalar_one_or_none()

    async def _get_environment_data(
        self,
        snapshot_instance_id: int,
        check_item_id: int,
    ) -> Optional[EnvironmentData]:
        """获取环境数据"""
        result = await self.db.execute(
            select(EnvironmentData).where(
                EnvironmentData.snapshot_instance_id == snapshot_instance_id,
                EnvironmentData.check_item_id == check_item_id,
            )
        )
        return result.scalar_one_or_none()

    async def _create_ssh_client(self, communication: Communication) -> SSHClientWrapper:
        """创建 SSH 客户端"""
        return SSHClientWrapper(
            host=communication.ip_address,
            port=communication.port or 22,
            username=communication.username or "root",
            password=communication.password,
            private_key_path=communication.private_key_path,
        )
