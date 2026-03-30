#!/usr/bin/env python3
"""手动重新提交构建任务"""
import sys
sys.path.insert(0, '/Users/chenzhihui/Documents/trae_projects/ev_check')

from app.tasks.snapshot_build_tasks import execute_snapshot_build_task

print("重新提交任务17和18...")

try:
    # 提交任务17
    result17 = execute_snapshot_build_task.delay(task_id=17)
    print(f"✓ 任务17已重新提交: {result17.id}")

    # 提交任务18
    result18 = execute_snapshot_build_task.delay(task_id=18)
    print(f"✓ 任务18已重新提交: {result18.id}")

except Exception as e:
    print(f"✗ 提交失败: {e}")
    import traceback
    traceback.print_exc()