# 快照构建服务
from datetime import datetime
from typing import Optional, Dict, Any, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Snapshot, SnapshotGroup, SnapshotInstance, EnvironmentData,
    SnapshotBuildTask, Communication, CheckItem
)
from app.services.check_executor import execute_check
from app.services.snapshot_progress import get_snapshot_progress_tracker
from app.utils.ssh_client import SSHClientWrapper


class SnapshotBuildError(Exception):
    """快照构建错误"""
    pass


class SnapshotBuildService:
    """快照构建服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.progress_tracker = get_snapshot_progress_tracker()

    async def start_build(
        self,
        snapshot_name: str,
        snapshot_group_id: int,
        build_config: List[Dict],
    ) -> SnapshotBuildTask:
        """
        启动快照构建

        Args:
            snapshot_name: 用户输入的名称
            snapshot_group_id: 目标快照组ID
            build_config: 构建配置列表

        Returns:
            SnapshotBuildTask: 构建任务
        """
        # 1. 验证快照组存在
        group = await self._get_snapshot_group(snapshot_group_id)
        if not group:
            raise SnapshotBuildError(f"快照组不存在: {snapshot_group_id}")

        # 2. 计算总通信机数和组数
        total_communications = 0
        groups_config = []
        for config in build_config:
            comm_ids = config.get("communication_ids")
            comms = await self._get_group_communications(
                config["group_id"],
                comm_ids
            )
            total_communications += len(comms)
            group_name = comms[0].group.name if comms and comms[0].group else "未知组"
            groups_config.append({
                "group_id": config["group_id"],
                "group_name": group_name,
                "status": "pending",
                "progress": 0,
                "communications": [
                    {"id": c.id, "name": c.name, "status": "pending"}
                    for c in comms
                ]
            })

        # 3. 生成快照名称（附加时间戳）
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M")
        full_name = f"{snapshot_name}_{timestamp}"

        # 4. 创建快照记录
        snapshot = Snapshot(
            group_id=snapshot_group_id,
            name=full_name,
            snapshot_time=datetime.utcnow(),
            is_default=False,
        )
        self.db.add(snapshot)
        await self.db.flush()

        # 5. 创建构建任务
        task = SnapshotBuildTask(
            snapshot_id=snapshot.id,
            status="pending",
            progress=0,
            total_groups=len(build_config),
            completed_groups=0,
            total_communications=total_communications,
            completed_communications=0,
            start_time=datetime.utcnow(),
            build_config=build_config,
        )
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)

        # 6. 初始化进度追踪（如果 Redis 不可用也继续）
        try:
            await self.progress_tracker.set_initial_progress(
                task_id=task.id,
                total_groups=len(build_config),
                total_communications=total_communications,
                groups_config=groups_config,
            )
        except Exception as e:
            print(f"警告: Redis 进度追踪初始化失败 - {e}")
            # 继续执行，不阻塞快照创建

        return task

    async def execute_build(self, task_id: int) -> SnapshotBuildTask:
        """
        执行快照构建（由 Celery 调用）

        Args:
            task_id: 任务ID

        Returns:
            SnapshotBuildTask: 更新后的任务
        """
        # 1. 获取任务
        task = await self._get_build_task(task_id)
        if not task:
            raise SnapshotBuildError(f"构建任务不存在: {task_id}")

        # 2. 更新状态为运行中
        task.status = "running"
        await self.db.commit()
        await self.progress_tracker.update_progress(
            task_id, 0, 0, status="running"
        )

        try:
            completed_comm = 0
            completed_groups = 0

            # 3. 遍历每个组
            for config in task.build_config:
                group_id = config["group_id"]
                comm_ids = config.get("communication_ids")
                check_list_id = config["check_item_list_id"]

                # 获取通信机列表
                comms = await self._get_group_communications(group_id, comm_ids)

                # 获取检查项列表
                check_items = await self._get_check_items(check_list_id)

                # 获取组内通信机进度索引
                comms_progress = []
                for c in comms:
                    comms_progress.append({
                        "id": c.id,
                        "name": c.name,
                        "status": "pending"
                    })

                await self.progress_tracker.update_group_status(
                    task_id, group_id, "running", comms_progress
                )

                group_success = True

                # 4. 遍历每台通信机
                for idx, comm in enumerate(comms):
                    # 更新当前通信机
                    comms_progress[idx]["status"] = "running"
                    await self.progress_tracker.update_group_status(
                        task_id, group_id, "running", comms_progress
                    )
                    await self.progress_tracker.update_progress(
                        task_id, completed_comm, completed_groups,
                        current_communication=comm.name, status="running"
                    )

                    # 先创建快照实例（无论连接是否成功）
                    instance = SnapshotInstance(
                        snapshot_id=task.snapshot_id,
                        communication_id=comm.id,
                        check_item_list_id=check_list_id,
                    )
                    self.db.add(instance)
                    await self.db.flush()

                    # 连接错误信息
                    connection_error = None
                    ssh_client = None

                    try:
                        # SSH 连接
                        ssh_client = await self._create_ssh_client(comm)
                        connected = await ssh_client.connect()

                        if not connected:
                            # 获取具体的连接错误信息
                            connection_error = getattr(ssh_client, 'last_error', 'SSH 连接失败')
                            if not connection_error or connection_error == 'SSH 连接失败':
                                # 尝试从 SSH 客户端获取更详细的错误
                                if hasattr(ssh_client, 'connect_exception'):
                                    connection_error = f"SSH 连接失败: {str(ssh_client.connect_exception)}"
                                else:
                                    connection_error = "SSH 连接失败: 请检查通信机地址、端口、用户名和密码/密钥配置"

                        # 采集数据
                        for item in check_items:
                            item_dict = {
                                "id": item.id,
                                "name": item.name,
                                "type": item.type,
                                "target_path": item.target_path,
                                "check_attributes": item.check_attributes,
                            }

                            if connection_error:
                                # 连接失败时，记录错误信息
                                result_data = {
                                    "_error": connection_error,
                                    "_status": "connection_failed"
                                }
                            else:
                                # 正常采集
                                result = await execute_check(ssh_client, item_dict, None)
                                result_data = result.actual_value or {}

                            # 保存环境数据
                            env_data = EnvironmentData(
                                snapshot_instance_id=instance.id,
                                check_item_id=item.id,
                                data_value=result_data,
                            )
                            self.db.add(env_data)

                        await self.db.commit()
                        comms_progress[idx]["status"] = "success" if not connection_error else "failed"

                    except Exception as e:
                        connection_error = str(e)
                        comms_progress[idx]["status"] = "failed"
                        group_success = False

                        # 记录异常到环境数据
                        for item in check_items:
                            env_data = EnvironmentData(
                                snapshot_instance_id=instance.id,
                                check_item_id=item.id,
                                data_value={
                                    "_error": connection_error,
                                    "_status": "error",
                                    "_error_type": type(e).__name__
                                },
                            )
                            self.db.add(env_data)
                        await self.db.commit()

                    finally:
                        if ssh_client:
                            try:
                                await ssh_client.close()
                            except Exception:
                                pass

                    # 更新进度
                    completed_comm += 1
                    await self.progress_tracker.update_progress(
                        task_id, completed_comm, completed_groups,
                        current_communication=None, status="running"
                    )
                    await self.progress_tracker.update_group_status(
                        task_id, group_id, "running", comms_progress
                    )

                # 组完成
                if group_success:
                    completed_groups += 1
                    await self.progress_tracker.update_group_status(
                        task_id, group_id, "completed", comms_progress
                    )

            # 5. 完成
            await self.progress_tracker.update_progress(
                task_id, completed_comm, completed_groups,
                status="completed"
            )
            task.status = "completed"
            task.progress = 100
            task.completed_groups = completed_groups
            task.completed_communications = completed_comm
            task.end_time = datetime.utcnow()
            await self.db.commit()

            return task

        except Exception as e:
            task.status = "failed"
            task.error_message = str(e)
            task.end_time = datetime.utcnow()
            await self.db.commit()
            await self.progress_tracker.update_progress(
                task_id, task.completed_communications, task.completed_groups,
                status="failed"
            )
            raise SnapshotBuildError(f"构建失败: {str(e)}")

    async def get_progress(self, task_id: int) -> Optional[Dict[str, Any]]:
        """获取构建进度"""
        return await self.progress_tracker.get_progress(task_id)

    async def cancel_build(self, task_id: int) -> bool:
        """取消构建"""
        task = await self._get_build_task(task_id)
        if not task:
            return False

        if task.status in ["pending", "running"]:
            task.status = "cancelled"
            task.end_time = datetime.utcnow()
            await self.db.commit()
            await self.progress_tracker.update_progress(
                task_id, task.completed_communications, task.completed_groups,
                status="cancelled"
            )
            return True
        return False

    # ========== 私有方法 ==========

    async def _get_snapshot_group(self, group_id: int) -> Optional[SnapshotGroup]:
        result = await self.db.execute(
            select(SnapshotGroup).where(SnapshotGroup.id == group_id)
        )
        return result.scalar_one_or_none()

    async def _get_build_task(self, task_id: int) -> Optional[SnapshotBuildTask]:
        result = await self.db.execute(
            select(SnapshotBuildTask).where(SnapshotBuildTask.id == task_id)
        )
        return result.scalar_one_or_none()

    async def _get_group_communications(
        self,
        group_id: int,
        comm_ids: Optional[List[int]] = None
    ) -> List[Communication]:
        query = select(Communication).options(
            selectinload(Communication.group)
        ).where(Communication.group_id == group_id)
        if comm_ids:
            query = query.where(Communication.id.in_(comm_ids))
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def _get_check_items(self, list_id: int) -> List[CheckItem]:
        result = await self.db.execute(
            select(CheckItem).where(CheckItem.list_id == list_id)
        )
        return list(result.scalars().all())

    async def _create_ssh_client(self, comm: Communication) -> SSHClientWrapper:
        # 解析密钥库引用
        private_key = None
        private_key_path = comm.private_key_path
        
        if private_key_path and private_key_path.startswith("key_"):
            try:
                from app.models import SSHKey
                key_id = int(private_key_path.replace("key_", ""))
                result = await self.db.execute(select(SSHKey).where(SSHKey.id == key_id))
                ssh_key = result.scalar_one_or_none()
                if ssh_key:
                    private_key = ssh_key.private_key
                    private_key_path = None # 既然拿到了内容，就不再使用路径
            except (ValueError, Exception):
                pass

        return SSHClientWrapper(
            host=comm.ip_address,
            port=comm.port or 22,
            username=comm.username or "root",
            password=comm.password,
            private_key_path=private_key_path,
            private_key=private_key,
        )
