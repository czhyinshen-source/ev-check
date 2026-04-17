import pytest
from app.services.check_executor import FileSystemCheckExecutor, CheckResult
from unittest.mock import MagicMock

def test_compare_flat_lists_logic():
    executor = FileSystemCheckExecutor(ssh_client=None)
    
    baseline = {
        "/etc/passwd": {"permissions": "644", "owner": "root", "group": "root", "size": 1000},
        "/etc/shadow": {"permissions": "600", "owner": "root", "group": "root", "size": 500}
    }
    
    actual = {
        "/etc/passwd": {"permissions": "644", "owner": "root", "group": "root", "size": 1000}, # 没变
        "/etc/shadow": {"permissions": "644", "owner": "root", "group": "root", "size": 500}, # 权限变了
        "/etc/new_file": {"permissions": "644", "owner": "user", "group": "user", "size": 10} # 新增
        # /etc/passwd 被删除了 (这里模拟实际没删)
    }
    
    # 手动构造一个减少的情况
    actual_with_removal = {
        "/etc/passwd": {"permissions": "644", "owner": "root", "group": "root", "size": 1000}
    }
    
    # 测试修改和新增
    diff1 = executor._compare_flat_lists(baseline, actual)
    assert "/etc/new_file" in diff1["added"]
    assert len(diff1["modified"]) == 1
    assert diff1["modified"][0]["path"] == "/etc/shadow"
    assert "permissions" in diff1["modified"][0]["fields"]
    
    # 测试删除
    diff2 = executor._compare_flat_lists(baseline, actual_with_removal)
    assert "/etc/shadow" in diff2["removed"]

@pytest.mark.asyncio
async def test_check_recursive_status_flow():
    from unittest.mock import AsyncMock
    mock_ssh = AsyncMock()
    executor = FileSystemCheckExecutor(ssh_client=mock_ssh)
    
    # 模拟递归数据返回
    actual_data = {"/tmp/a": {"permissions": "755", "owner": "root", "group": "root", "size": 0, "mtime": 123}}
    mock_ssh.get_recursive_file_info.return_value = actual_data
    
    check_item = {
        "target_path": "/tmp",
        "check_attributes": {"is_recursive": True}
    }
    
    # 1. 首次采集 (无基准)
    result = await executor.check(check_item, None)
    assert result.status == "pass"
    assert "已成功采集" in result.message
    assert result.actual_value == actual_data
    
    # 2. 有基准且匹配
    result2 = await executor.check(check_item, actual_data)
    assert result2.status == "pass"
    assert "完全匹配" in result2.message
    
    # 3. 有基准且不匹配
    baseline_diff = {"/tmp/a": {"permissions": "644", "owner": "root", "group": "root", "size": 0, "mtime": 123}}
    result3 = await executor.check(check_item, baseline_diff)
    assert result3.status == "fail"
    assert "修改 1 个" in result3.message
