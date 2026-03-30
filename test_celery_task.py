#!/usr/bin/env python3
"""测试Celery任务执行"""
import sys
sys.path.insert(0, '/Users/chenzhihui/Documents/trae_projects/ev_check')

from app.tasks.snapshot_build_tasks import execute_snapshot_build_task

# 测试任务ID 15（最新的构建任务）
print("尝试手动执行Celery任务...")
try:
    result = execute_snapshot_build_task.delay(task_id=15)
    print(f"✓ 任务已提交到Celery队列")
    print(f"  任务ID: {result.id}")
    print(f"  状态: {result.state}")
except Exception as e:
    print(f"✗ 任务提交失败: {e}")
    import traceback
    traceback.print_exc()
