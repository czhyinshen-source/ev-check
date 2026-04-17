import asyncio
import pytest
from unittest.mock import MagicMock, patch
from app.utils.ssh_client import SSHClientWrapper

@pytest.mark.asyncio
async def test_get_recursive_file_info_parsing():
    # 模拟 SSH 响应
    # 格式: path|permissions|owner|group|size|mtime
    mock_stdout = (
        "/tmp/test|755|root|root|4096|1618280000\n"
        "/tmp/test/file1|644|user|user|1024|1618280001\n"
        "/tmp/test/subdir|700|root|root|0|1618280002\n"
    )
    
    with patch.object(SSHClientWrapper, 'execute', return_value=(0, mock_stdout, "")):
        client = SSHClientWrapper(host="localhost")
        client.client = MagicMock() # 模拟已连接
        
        results = await client.get_recursive_file_info("/tmp/test")
        
        assert len(results) == 3
        assert results["/tmp/test"]["permissions"] == "755"
        assert results["/tmp/test/file1"]["size"] == 1024
        assert results["/tmp/test/subdir"]["owner"] == "root"

@pytest.mark.asyncio
async def test_get_recursive_file_info_exclusion():
    # 验证排除规则是否正确构建命令行
    client = SSHClientWrapper(host="localhost")
    client.client = MagicMock()
    
    with patch.object(SSHClientWrapper, 'execute', return_value=(0, "", "")) as mock_exec:
        # 只测试命令构建，不关心结果解析
        await client.get_recursive_file_info("/tmp/test", exclude_patterns=["logs/**", "*.bak"])
        
        call_args = mock_exec.call_args[0][0]
        # 验证命令中包含排除逻辑
        assert "-not -path" in call_args
        assert "/tmp/test" in call_args
