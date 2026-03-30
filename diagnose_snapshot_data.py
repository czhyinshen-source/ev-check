#!/usr/bin/env python3
"""诊断快照数据采集情况"""
import asyncio
import sys
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

sys.path.insert(0, '/Users/chenzhihui/Documents/trae_projects/ev_check')

from app.database import async_session_maker
from app.models import Snapshot, SnapshotInstance, EnvironmentData, SnapshotBuildTask


async def diagnose():
    async with async_session_maker() as db:
        # 1. 检查最新的快照
        result = await db.execute(
            select(Snapshot)
            .order_by(Snapshot.created_at.desc())
            .limit(5)
        )
        snapshots = result.scalars().all()

        print("=" * 60)
        print("最近5个快照:")
        print("=" * 60)
        for snap in snapshots:
            print(f"ID: {snap.id}, 名称: {snap.name}, 时间: {snap.snapshot_time}")

        if not snapshots:
            print("❌ 数据库中没有快照记录")
            return

        # 2. 检查最新快照的构建任务
        latest_snapshot = snapshots[0]
        print(f"\n{'=' * 60}")
        print(f"检查快照 ID={latest_snapshot.id} 的构建任务:")
        print("=" * 60)

        result = await db.execute(
            select(SnapshotBuildTask)
            .where(SnapshotBuildTask.snapshot_id == latest_snapshot.id)
        )
        tasks = result.scalars().all()

        for task in tasks:
            print(f"任务ID: {task.id}")
            print(f"  状态: {task.status}")
            print(f"  进度: {task.progress}%")
            print(f"  总组数: {task.total_groups}, 完成: {task.completed_groups}")
            print(f"  总通信机: {task.total_communications}, 完成: {task.completed_communications}")
            if task.error_message:
                print(f"  错误: {task.error_message}")

        # 3. 检查快照实例
        print(f"\n{'=' * 60}")
        print(f"检查快照 ID={latest_snapshot.id} 的实例:")
        print("=" * 60)

        result = await db.execute(
            select(SnapshotInstance)
            .options(selectinload(SnapshotInstance.communication))
            .where(SnapshotInstance.snapshot_id == latest_snapshot.id)
        )
        instances = result.scalars().all()

        print(f"实例总数: {len(instances)}")

        if not instances:
            print("❌ 该快照没有任何实例记录")
            return

        # 4. 检查每个实例的环境数据
        print(f"\n{'=' * 60}")
        print("检查各实例的环境数据:")
        print("=" * 60)

        for instance in instances:
            result = await db.execute(
                select(EnvironmentData)
                .options(selectinload(EnvironmentData.check_item))
                .where(EnvironmentData.snapshot_instance_id == instance.id)
            )
            env_data_list = result.scalars().all()

            print(f"\n实例 ID={instance.id}, 通信机: {instance.communication.name}")
            print(f"  环境数据条数: {len(env_data_list)}")

            if env_data_list:
                for env_data in env_data_list[:3]:  # 只显示前3条
                    print(f"    - 检查项: {env_data.check_item.name}")
                    print(f"      数据: {str(env_data.data_value)[:100]}...")
                    if '_error' in env_data.data_value:
                        print(f"      ⚠️  包含错误: {env_data.data_value.get('_error')}")
            else:
                print("    ❌ 没有环境数据")


if __name__ == "__main__":
    asyncio.run(diagnose())
