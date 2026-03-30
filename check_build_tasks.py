#!/usr/bin/env python3
"""检查快照构建任务状态"""
import asyncio
import sys
from sqlalchemy import select
from sqlalchemy.orm import selectinload

sys.path.insert(0, '/Users/chenzhihui/Documents/trae_projects/ev_check')

from app.database import async_session_maker
from app.models import SnapshotBuildTask, Snapshot


async def check_tasks():
    async with async_session_maker() as db:
        # 获取最新的构建任务
        result = await db.execute(
            select(SnapshotBuildTask)
            .options(selectinload(SnapshotBuildTask.snapshot))
            .order_by(SnapshotBuildTask.id.desc())
            .limit(10)
        )
        tasks = result.scalars().all()

        print("=" * 80)
        print("最近10个构建任务:")
        print("=" * 80)

        for task in tasks:
            print(f"任务ID: {task.id}")
            print(f"  快照ID: {task.snapshot_id} ({task.snapshot.name if task.snapshot else '未知'})")
            print(f"  状态: {task.status}")
            print(f"  进度: {task.progress}%")
            print(f"  开始时间: {task.start_time}")
            print(f"  结束时间: {task.end_time}")
            print(f"  总组数: {task.total_groups}, 完成: {task.completed_groups}")
            print(f"  总通信机: {task.total_communications}, 完成: {task.completed_communications}")
            if task.current_communication:
                print(f"  当前通信机: {task.current_communication}")
            if task.error_message:
                print(f"  错误信息: {task.error_message}")
            print(f"  构建配置: {task.build_config}")
            print("-" * 40)


if __name__ == "__main__":
    asyncio.run(check_tasks())