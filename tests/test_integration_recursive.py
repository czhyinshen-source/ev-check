import asyncio
import pytest
from unittest.mock import AsyncMock
from app.services.check_executor import FileSystemCheckExecutor

@pytest.mark.asyncio
async def test_integration_recursive_flow():
    # 模拟 SSH 客户端
    mock_ssh = AsyncMock()
    executor = FileSystemCheckExecutor(ssh_client=mock_ssh)
    
    path = "/opt/app"
    attrs = {
        "is_recursive": True,
        "exclude_patterns": ["*.log"]
    }
    check_item = {
        "target_path": path,
        "check_attributes": attrs
    }

    # --- 场景 1: 首次采集 (建立基准) ---
    baseline_output = (
        "/opt/app|755|root|root|4096|1000\n"
        "/opt/app/bin|755|root|root|1024|1001\n"
        "/opt/app/config|644|root|root|512|1002\n"
    )
    # 模拟 find 命令的返回
    async def mock_execute(cmd):
        if "find" in cmd:
            return (0, baseline_output, "")
        return (0, "", "")
    
    from app.utils.ssh_client import SSHClientWrapper
    # 我们需要一个真实的解析逻辑，但 mock 掉底层的 execute
    real_ssh = SSHClientWrapper(host="localhost")
    with AsyncMock() as mock_exec:
        real_ssh.execute = AsyncMock(return_value=(0, baseline_output, ""))
        executor.ssh_client = real_ssh
        
        result_initial = await executor.check(check_item, None)
        assert result_initial.status == "pass"
        assert len(result_initial.actual_value) == 3
        
        baseline_data = result_initial.actual_value

        # --- 场景 2: 再次检查 (发现变更) ---
        # 模拟：bin 权限变了，config 被删了，多了一个 new.txt
        new_output = (
            "/opt/app|755|root|root|4096|1000\n"
            "/opt/app/bin|700|root|root|1024|1001\n" # 权限 755 -> 700
            "/opt/app/new.txt|644|user|user|10|1005\n" # 新增
        )
        real_ssh.execute = AsyncMock(return_value=(0, new_output, ""))
        
        result_check = await executor.check(check_item, baseline_data)
        
        assert result_check.status == "fail"
        assert "新增 1 个" in result_check.message
        assert "减少 1 个" in result_check.message
        assert "修改 1 个" in result_check.message
        
        # 验证差异具体内容 (通过调试 internal _compare_flat_lists 可知)
        diff = executor._compare_flat_lists(baseline_data, result_check.actual_value)
        assert "/opt/app/new.txt" in diff["added"]
        assert "/opt/app/config" in diff["removed"]
        assert diff["modified"][0]["path"] == "/opt/app/bin"
        assert "permissions" in diff["modified"][0]["fields"]

if __name__ == "__main__":
    asyncio.run(test_integration_recursive_flow())
