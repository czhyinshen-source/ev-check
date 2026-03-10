"""检查执行器单元测试"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.check_executor import (
    CheckResult,
    FileSystemCheckExecutor,
    ProcessCheckExecutor,
    NetworkCheckExecutor,
    LogCheckExecutor,
    ServiceCheckExecutor,
    get_executor,
    execute_check,
)


class MockSSHClient:
    """Mock SSH 客户端"""
    
    def __init__(self):
        self.commands = {}
        self.file_info = {}
        self.file_md5 = {}
        self.disk_usage = {}
    
    async def execute(self, command):
        """执行命令"""
        if command in self.commands:
            return self.commands[command]
        return (0, "", "")
    
    async def get_file_info(self, path):
        """获取文件信息"""
        return self.file_info.get(path)
    
    async def get_file_md5(self, path):
        """获取文件 MD5"""
        return self.file_md5.get(path)
    
    async def get_disk_usage(self, path):
        """获取磁盘使用情况"""
        return self.disk_usage.get(path)
    
    async def check_process_exists(self, process_name):
        """检查进程是否存在"""
        return process_name in self.commands
    
    async def check_port_listening(self, port):
        """检查端口是否监听"""
        return f"port_{port}" in self.commands
    
    async def get_service_status(self, service_name):
        """获取服务状态"""
        return self.commands.get(f"service_{service_name}")
    
    async def scan_log_file(self, log_path, pattern, max_matches):
        """扫描日志文件"""
        return self.commands.get(f"log_{log_path}_{pattern}", [])
    
    async def close(self):
        """关闭连接"""
        pass


class TestFileSystemCheckExecutor:
    """文件系统检查执行器测试"""
    
    @pytest.fixture
    def ssh_client(self):
        return MockSSHClient()
    
    @pytest.fixture
    def executor(self, ssh_client):
        return FileSystemCheckExecutor(ssh_client)
    
    @pytest.mark.asyncio
    async def test_check_exists_success(self, executor, ssh_client):
        """检查文件存在 - 成功"""
        ssh_client.commands["test -e /etc/nginx/nginx.conf && echo 'exists'"] = (0, "exists", "")
        
        check_item = {
            "target_path": "/etc/nginx/nginx.conf",
            "check_attributes": {"type": "exists"}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "success"
        assert "存在" in result.message
        assert result.actual_value["exists"] is True
    
    @pytest.mark.asyncio
    async def test_check_exists_not_found(self, executor, ssh_client):
        """检查文件存在 - 未找到"""
        ssh_client.commands["test -e /nonexistent/file && echo 'exists'"] = (1, "", "")
        
        check_item = {
            "target_path": "/nonexistent/file",
            "check_attributes": {"type": "exists"}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "error"
        assert "不存在" in result.message
        assert result.actual_value["exists"] is False
    
    @pytest.mark.asyncio
    async def test_check_permissions_match(self, executor, ssh_client):
        """检查权限 - 匹配"""
        ssh_client.file_info["/etc/nginx/nginx.conf"] = {
            "permissions": "644",
            "size": 1024
        }
        
        check_item = {
            "target_path": "/etc/nginx/nginx.conf",
            "check_attributes": {"type": "permissions", "permissions": "644"}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "success"
        assert result.actual_value == "644"
    
    @pytest.mark.asyncio
    async def test_check_permissions_mismatch(self, executor, ssh_client):
        """检查权限 - 不匹配"""
        ssh_client.file_info["/etc/nginx/nginx.conf"] = {
            "permissions": "755",
            "size": 1024
        }
        
        check_item = {
            "target_path": "/etc/nginx/nginx.conf",
            "check_attributes": {"type": "permissions", "permissions": "644"}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "error"
        assert "不匹配" in result.message
        assert result.actual_value == "755"
    
    @pytest.mark.asyncio
    async def test_check_size_within_limit(self, executor, ssh_client):
        """检查文件大小 - 在限制内"""
        ssh_client.file_info["/var/log/test.log"] = {
            "permissions": "644",
            "size": 5000
        }
        
        check_item = {
            "target_path": "/var/log/test.log",
            "check_attributes": {"type": "size", "max_size": 10000}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "success"
        assert result.actual_value["size"] == 5000
    
    @pytest.mark.asyncio
    async def test_check_size_exceeds_limit(self, executor, ssh_client):
        """检查文件大小 - 超出限制"""
        ssh_client.file_info["/var/log/test.log"] = {
            "permissions": "644",
            "size": 15000
        }
        
        check_item = {
            "target_path": "/var/log/test.log",
            "check_attributes": {"type": "size", "max_size": 10000}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "warning"
        assert "超过" in result.message
    
    @pytest.mark.asyncio
    async def test_check_md5_match(self, executor, ssh_client):
        """检查 MD5 - 匹配"""
        ssh_client.file_md5["/etc/nginx/nginx.conf"] = "d41d8cd98f00b204e9800998ecf8427e"
        
        check_item = {
            "target_path": "/etc/nginx/nginx.conf",
            "check_attributes": {"type": "md5", "md5": "d41d8cd98f00b204e9800998ecf8427e"}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "success"
        assert "通过" in result.message
    
    @pytest.mark.asyncio
    async def test_check_md5_mismatch(self, executor, ssh_client):
        """检查 MD5 - 不匹配"""
        ssh_client.file_md5["/etc/nginx/nginx.conf"] = "d41d8cd98f00b204e9800998ecf8427e"
        
        check_item = {
            "target_path": "/etc/nginx/nginx.conf",
            "check_attributes": {"type": "md5", "md5": "different_md5"}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "error"
        assert "不匹配" in result.message
    
    @pytest.mark.asyncio
    async def test_check_disk_usage_low(self, executor, ssh_client):
        """检查磁盘使用率 - 低"""
        ssh_client.disk_usage["/"] = {"use_percent": "45%"}
        
        check_item = {
            "target_path": "/",
            "check_attributes": {"type": "disk_usage", "max_percent": "80%"}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "success"
        assert "通过" in result.message
    
    @pytest.mark.asyncio
    async def test_check_disk_usage_high(self, executor, ssh_client):
        """检查磁盘使用率 - 高"""
        ssh_client.disk_usage["/"] = {"use_percent": "95%"}
        
        check_item = {
            "target_path": "/",
            "check_attributes": {"type": "disk_usage", "max_percent": "80%"}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "error"
        assert "超过" in result.message
    
    @pytest.mark.asyncio
    async def test_check_no_target_path(self, executor):
        """检查 - 无目标路径"""
        check_item = {
            "check_attributes": {"type": "exists"}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "error"
        assert "未指定" in result.message


class TestProcessCheckExecutor:
    """进程检查执行器测试"""
    
    @pytest.fixture
    def ssh_client(self):
        return MockSSHClient()
    
    @pytest.fixture
    def executor(self, ssh_client):
        return ProcessCheckExecutor(ssh_client)
    
    @pytest.mark.asyncio
    async def test_check_process_exists(self, executor, ssh_client):
        """检查进程存在"""
        ssh_client.commands["nginx"] = True
        
        check_item = {
            "target_path": "nginx",
            "check_attributes": {"type": "exists"}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "success"
        assert result.actual_value is True
    
    @pytest.mark.asyncio
    async def test_check_process_not_exists(self, executor, ssh_client):
        """检查进程不存在"""
        check_item = {
            "target_path": "nonexistent_process",
            "check_attributes": {"type": "exists"}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "error"
        assert "不存在" in result.message
    
    @pytest.mark.asyncio
    async def test_check_process_running(self, executor, ssh_client):
        """检查进程运行中"""
        ssh_client.commands["nginx"] = True
        
        check_item = {
            "target_path": "nginx",
            "check_attributes": {"type": "running"}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "success"
        assert "运行中" in result.message
    
    @pytest.mark.asyncio
    async def test_check_process_count(self, executor, ssh_client):
        """检查进程数量"""
        ssh_client.commands["pgrep -c -f 'nginx'"] = (0, "3", "")
        
        check_item = {
            "target_path": "nginx",
            "check_attributes": {"type": "count", "min_count": 2}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "success"
        assert result.actual_value["count"] == 3


class TestNetworkCheckExecutor:
    """网络检查执行器测试"""
    
    @pytest.fixture
    def ssh_client(self):
        return MockSSHClient()
    
    @pytest.fixture
    def executor(self, ssh_client):
        return NetworkCheckExecutor(ssh_client)
    
    @pytest.mark.asyncio
    async def test_check_port_listening(self, executor, ssh_client):
        """检查端口监听"""
        ssh_client.commands["port_80"] = True
        
        check_item = {
            "target_path": "80",
            "check_attributes": {"type": "port_listening"}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "success"
        assert result.actual_value["listening"] is True
    
    @pytest.mark.asyncio
    async def test_check_port_not_listening(self, executor, ssh_client):
        """检查端口未监听"""
        check_item = {
            "target_path": "9999",
            "check_attributes": {"type": "port_listening"}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "error"
        assert "未监听" in result.message
    
    @pytest.mark.asyncio
    async def test_check_port_connect_success(self, executor, ssh_client):
        """检查端口连接 - 成功"""
        ssh_client.commands["nc -zv -w5 192.168.1.1 80 2>&1"] = (0, "succeeded", "")
        
        check_item = {
            "target_path": "192.168.1.1:80",
            "check_attributes": {"type": "port_connect"}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "success"
        assert "可以连接" in result.message
    
    @pytest.mark.asyncio
    async def test_check_port_connect_failed(self, executor, ssh_client):
        """检查端口连接 - 失败"""
        ssh_client.commands["nc -zv -w5 192.168.1.1 80 2>&1"] = (1, "", "failed")
        
        check_item = {
            "target_path": "192.168.1.1:80",
            "check_attributes": {"type": "port_connect"}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "error"
        assert "无法连接" in result.message


class TestLogCheckExecutor:
    """日志检查执行器测试"""
    
    @pytest.fixture
    def ssh_client(self):
        return MockSSHClient()
    
    @pytest.fixture
    def executor(self, ssh_client):
        return LogCheckExecutor(ssh_client)
    
    @pytest.mark.asyncio
    async def test_check_pattern_no_matches(self, executor, ssh_client):
        """检查日志模式 - 无匹配"""
        ssh_client.commands["log_/var/log/syslog_ERROR"] = []
        
        check_item = {
            "target_path": "/var/log/syslog",
            "check_attributes": {"type": "pattern", "pattern": "ERROR"}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "success"
        assert "未找到" in result.message
    
    @pytest.mark.asyncio
    async def test_check_pattern_with_matches(self, executor, ssh_client):
        """检查日志模式 - 有匹配"""
        ssh_client.commands["log_/var/log/syslog_ERROR"] = ["ERROR line1", "ERROR line2"]
        
        check_item = {
            "target_path": "/var/log/syslog",
            "check_attributes": {"type": "pattern", "pattern": "ERROR", "max_matches": 5}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "success"
        assert "找到" in result.message
    
    @pytest.mark.asyncio
    async def test_check_error_count_within_threshold(self, executor, ssh_client):
        """检查错误数量 - 在阈值内"""
        ssh_client.commands["log_/var/log/syslog_ERROR|FATAL|CRITICAL"] = ["ERROR1", "ERROR2"]
        
        check_item = {
            "target_path": "/var/log/syslog",
            "check_attributes": {
                "type": "error_count",
                "threshold": 5,
                "error_pattern": "ERROR|FATAL|CRITICAL"
            }
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "success"
        assert result.actual_value["error_count"] == 2


class TestServiceCheckExecutor:
    """服务检查执行器测试"""
    
    @pytest.fixture
    def ssh_client(self):
        return MockSSHClient()
    
    @pytest.fixture
    def executor(self, ssh_client):
        return ServiceCheckExecutor(ssh_client)
    
    @pytest.mark.asyncio
    async def test_check_service_active(self, executor, ssh_client):
        """检查服务 - 运行正常"""
        ssh_client.commands["service_nginx"] = "active"
        
        check_item = {
            "target_path": "nginx",
            "check_attributes": {}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "success"
        assert result.actual_value == "active"
    
    @pytest.mark.asyncio
    async def test_check_service_inactive(self, executor, ssh_client):
        """检查服务 - 未运行"""
        ssh_client.commands["service_nginx"] = "inactive"
        
        check_item = {
            "target_path": "nginx",
            "check_attributes": {}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "warning"
        assert result.actual_value == "inactive"
    
    @pytest.mark.asyncio
    async def test_check_service_unknown(self, executor, ssh_client):
        """检查服务 - 未知"""
        check_item = {
            "target_path": "nonexistent_service",
            "check_attributes": {}
        }
        
        result = await executor.check(check_item)
        
        assert result.status == "error"
        assert "不存在" in result.message


class TestGetExecutor:
    """获取执行器工厂函数测试"""
    
    def test_get_filesystem_executor(self):
        """获取文件系统执行器"""
        ssh_client = MockSSHClient()
        executor = get_executor("filesystem", ssh_client)
        
        assert isinstance(executor, FileSystemCheckExecutor)
    
    def test_get_process_executor(self):
        """获取进程执行器"""
        ssh_client = MockSSHClient()
        executor = get_executor("process", ssh_client)
        
        assert isinstance(executor, ProcessCheckExecutor)
    
    def test_get_network_executor(self):
        """获取网络执行器"""
        ssh_client = MockSSHClient()
        executor = get_executor("network", ssh_client)
        
        assert isinstance(executor, NetworkCheckExecutor)
    
    def test_get_log_executor(self):
        """获取日志执行器"""
        ssh_client = MockSSHClient()
        executor = get_executor("log", ssh_client)
        
        assert isinstance(executor, LogCheckExecutor)
    
    def test_get_service_executor(self):
        """获取服务执行器"""
        ssh_client = MockSSHClient()
        executor = get_executor("service", ssh_client)
        
        assert isinstance(executor, ServiceCheckExecutor)
    
    def test_get_invalid_executor(self):
        """获取无效执行器"""
        ssh_client = MockSSHClient()
        
        with pytest.raises(ValueError) as exc_info:
            get_executor("invalid_type", ssh_client)
        
        assert "未知的检查类型" in str(exc_info.value)


class TestExecuteCheck:
    """执行检查函数测试"""
    
    @pytest.mark.asyncio
    async def test_execute_check_success(self):
        """执行检查 - 成功"""
        ssh_client = MockSSHClient()
        ssh_client.commands["test -e /etc/test && echo 'exists'"] = (0, "exists", "")
        
        check_item = {
            "type": "filesystem",
            "target_path": "/etc/test",
            "check_attributes": {"type": "exists"}
        }
        
        result = await execute_check(ssh_client, check_item)
        
        assert result.status == "success"
    
    @pytest.mark.asyncio
    async def test_execute_check_error(self):
        """执行检查 - 错误"""
        ssh_client = MockSSHClient()
        
        check_item = {
            "type": "invalid_type",
            "target_path": "/etc/test"
        }
        
        result = await execute_check(ssh_client, check_item)
        
        assert result.status == "error"
        assert "失败" in result.message
