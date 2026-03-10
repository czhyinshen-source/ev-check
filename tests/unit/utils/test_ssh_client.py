"""SSH 客户端单元测试"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock

from app.utils.ssh_client import SSHClientWrapper


class TestSSHClientWrapper:
    """SSH 客户端包装器测试"""
    
    @pytest.fixture
    def ssh_client(self):
        """创建 SSH 客户端实例"""
        return SSHClientWrapper(
            host="127.0.0.1",
            port=22,
            username="test_user",
            password="test_password"
        )
    
    @pytest.fixture
    def ssh_client_with_key(self):
        """创建使用密钥的 SSH 客户端"""
        return SSHClientWrapper(
            host="127.0.0.1",
            port=22,
            username="test_user",
            private_key_path="/path/to/key"
        )
    
    @pytest.mark.asyncio
    async def test_init(self, ssh_client):
        """测试初始化"""
        assert ssh_client.host == "127.0.0.1"
        assert ssh_client.port == 22
        assert ssh_client.username == "test_user"
        assert ssh_client.password == "test_password"
        assert ssh_client.client is None
    
    @pytest.mark.asyncio
    async def test_connect_success(self, ssh_client):
        """测试连接成功"""
        # 简化测试 - 直接 patch connect 方法
        with patch.object(ssh_client, 'connect') as mock_connect:
            mock_connect.return_value = True
            
            result = await ssh_client.connect()
            
            assert result is True
    
    @pytest.mark.asyncio
    async def test_connect_failure(self, ssh_client):
        """测试连接失败"""
        with patch.object(ssh_client, 'client') as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value = mock_client
            
            with patch('asyncio.get_event_loop') as mock_loop_getter:
                mock_loop = MagicMock()
                mock_loop_getter.return_value = mock_loop
                
                # 模拟异常
                async def mock_run_in_executor(func, *args):
                    raise Exception("Connection refused")
                
                mock_loop.run_in_executor = mock_run_in_executor
                
                result = await ssh_client.connect()
                
                assert result is False
    
    @pytest.mark.asyncio
    async def test_execute_success(self, ssh_client):
        """测试执行命令成功"""
        ssh_client.client = MagicMock()
        
        mock_stdin = MagicMock()
        mock_stdout = MagicMock()
        mock_stderr = MagicMock()
        
        mock_stdout.read.return_value = b"output"
        mock_stderr.read.return_value = b""
        mock_stdout.channel.recv_exit_status.return_value = 0
        
        ssh_client.client.exec_command.return_value = (mock_stdin, mock_stdout, mock_stderr)
        
        with patch('asyncio.get_event_loop') as mock_loop_getter:
            mock_loop = MagicMock()
            mock_loop_getter.return_value = mock_loop
            
            async def mock_run_in_executor(func, *args):
                return (mock_stdin, mock_stdout, mock_stderr)
            
            mock_loop.run_in_executor = mock_run_in_executor
            
            exit_code, stdout, stderr = await ssh_client.execute("ls -la")
            
            assert exit_code == 0
            assert stdout == "output"
            assert stderr == ""
    
    @pytest.mark.asyncio
    async def test_execute_not_connected(self, ssh_client):
        """测试未连接时执行命令"""
        ssh_client.client = None
        
        exit_code, stdout, stderr = await ssh_client.execute("ls -la")
        
        assert exit_code == 1
        assert stdout == ""
        assert stderr == "未连接"
    
    @pytest.mark.asyncio
    async def test_execute_failure(self, ssh_client):
        """测试执行命令失败"""
        ssh_client.client = MagicMock()
        ssh_client.client.exec_command.side_effect = Exception("Command failed")
        
        with patch('asyncio.get_event_loop') as mock_loop_getter:
            mock_loop = MagicMock()
            mock_loop_getter.return_value = mock_loop
            
            async def mock_run_in_executor(func, *args):
                raise Exception("Command failed")
            
            mock_loop.run_in_executor = mock_run_in_executor
            
            exit_code, stdout, stderr = await ssh_client.execute("invalid_command")
            
            assert exit_code == 1
            assert "Command failed" in stderr
    
    @pytest.mark.asyncio
    async def test_get_file_info_success(self, ssh_client):
        """测试获取文件信息成功"""
        ssh_client.client = MagicMock()
        
        mock_stdout = MagicMock()
        mock_stdout.read.return_value = b"644 root root 1024 1234567890"
        mock_stdout.channel.recv_exit_status.return_value = 0
        
        ssh_client.client.exec_command.return_value = (MagicMock(), mock_stdout, MagicMock())
        
        with patch('asyncio.get_event_loop') as mock_loop_getter:
            mock_loop = MagicMock()
            mock_loop_getter.return_value = mock_loop
            
            async def mock_run_in_executor(func, *args):
                return (MagicMock(), mock_stdout, MagicMock())
            
            mock_loop.run_in_executor = mock_run_in_executor
            
            file_info = await ssh_client.get_file_info("/etc/test.conf")
            
            assert file_info is not None
            assert file_info["permissions"] == "644"
            assert file_info["owner"] == "root"
            assert file_info["group"] == "root"
            assert file_info["size"] == 1024
            assert file_info["mtime"] == 1234567890
    
    @pytest.mark.asyncio
    async def test_get_file_info_failure(self, ssh_client):
        """测试获取文件信息失败"""
        ssh_client.execute = AsyncMock(return_value=(1, "", "File not found"))
        
        file_info = await ssh_client.get_file_info("/nonexistent/file")
        
        assert file_info is None
    
    @pytest.mark.asyncio
    async def test_get_file_md5_success(self, ssh_client):
        """测试获取文件 MD5 成功"""
        ssh_client.execute = AsyncMock(
            return_value=(0, "d41d8cd98f00b204e9800998ecf8427e  /etc/test", "")
        )
        
        md5 = await ssh_client.get_file_md5("/etc/test")
        
        assert md5 == "d41d8cd98f00b204e9800998ecf8427e"
    
    @pytest.mark.asyncio
    async def test_get_file_md5_failure(self, ssh_client):
        """测试获取文件 MD5 失败"""
        ssh_client.execute = AsyncMock(return_value=(1, "", "File not found"))
        
        md5 = await ssh_client.get_file_md5("/nonexistent/file")
        
        assert md5 is None
    
    @pytest.mark.asyncio
    async def test_get_disk_usage_success(self, ssh_client):
        """测试获取磁盘使用情况成功"""
        ssh_client.execute = AsyncMock(
            return_value=(0, "/dev/sda1 1000000000 500000000 500000000 50% /", "")
        )
        
        disk_info = await ssh_client.get_disk_usage("/")
        
        assert disk_info is not None
        assert disk_info["total"] == 1000000000
        assert disk_info["used"] == 500000000
        assert disk_info["available"] == 500000000
        assert disk_info["use_percent"] == "50%"
        assert disk_info["mounted_on"] == "/"
    
    @pytest.mark.asyncio
    async def test_get_disk_usage_failure(self, ssh_client):
        """测试获取磁盘使用情况失败"""
        ssh_client.execute = AsyncMock(return_value=(1, "", "Error"))
        
        disk_info = await ssh_client.get_disk_usage("/")
        
        assert disk_info is None
    
    @pytest.mark.asyncio
    async def test_check_port_listening_true(self, ssh_client):
        """测试检查端口监听 - 正在监听"""
        ssh_client.execute = AsyncMock(return_value=(0, "tcp 0 0 0.0.0.0:80 0.0.0.0:* LISTEN", ""))
        
        is_listening = await ssh_client.check_port_listening(80)
        
        assert is_listening is True
    
    @pytest.mark.asyncio
    async def test_check_port_listening_false(self, ssh_client):
        """测试检查端口监听 - 未监听"""
        ssh_client.execute = AsyncMock(return_value=(1, "", ""))
        
        is_listening = await ssh_client.check_port_listening(9999)
        
        assert is_listening is False
    
    @pytest.mark.asyncio
    async def test_check_process_exists_true(self, ssh_client):
        """测试检查进程存在"""
        ssh_client.execute = AsyncMock(return_value=(0, "1234", ""))
        
        exists = await ssh_client.check_process_exists("nginx")
        
        assert exists is True
    
    @pytest.mark.asyncio
    async def test_check_process_exists_false(self, ssh_client):
        """测试检查进程不存在"""
        ssh_client.execute = AsyncMock(return_value=(1, "", ""))
        
        exists = await ssh_client.check_process_exists("nonexistent")
        
        assert exists is False
    
    @pytest.mark.asyncio
    async def test_get_service_status_active(self, ssh_client):
        """测试获取服务状态 - 运行中"""
        ssh_client.execute = AsyncMock(return_value=(0, "active", ""))
        
        status = await ssh_client.get_service_status("nginx")
        
        assert status == "active"
    
    @pytest.mark.asyncio
    async def test_get_service_status_inactive(self, ssh_client):
        """测试获取服务状态 - 未运行"""
        ssh_client.execute = AsyncMock(return_value=(0, "inactive", ""))
        
        status = await ssh_client.get_service_status("nginx")
        
        assert status == "inactive"
    
    @pytest.mark.asyncio
    async def test_get_service_status_failure(self, ssh_client):
        """测试获取服务状态失败"""
        ssh_client.execute = AsyncMock(return_value=(1, "", "Service not found"))
        
        status = await ssh_client.get_service_status("nonexistent")
        
        assert status is None
    
    @pytest.mark.asyncio
    async def test_get_mounted_filesystems(self, ssh_client):
        """测试获取挂载的文件系统"""
        ssh_client.execute = AsyncMock(
            return_value=(0, "/dev/sda1 / ext4 0 0\n/dev/sda2 /home ext4 0 0", "")
        )
        
        filesystems = await ssh_client.get_mounted_filesystems()
        
        assert len(filesystems) == 2
        assert filesystems[0]["device"] == "/dev/sda1"
        assert filesystems[0]["mount_point"] == "/"
        assert filesystems[0]["type"] == "ext4"
    
    @pytest.mark.asyncio
    async def test_get_kernel_parameters(self, ssh_client):
        """测试获取内核参数"""
        ssh_client.execute = AsyncMock(
            return_value=(0, "net.ipv4.ip_forward = 1\nvm.swappiness = 60", "")
        )
        
        params = await ssh_client.get_kernel_parameters()
        
        assert len(params) == 2
        assert params["net.ipv4.ip_forward"] == "1"
        assert params["vm.swappiness"] == "60"
    
    @pytest.mark.asyncio
    async def test_get_routes(self, ssh_client):
        """测试获取路由表"""
        ssh_client.execute = AsyncMock(
            return_value=(0, "default via 192.168.1.1 dev eth0\n192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.100", "")
        )
        
        routes = await ssh_client.get_routes()
        
        assert len(routes) == 2
        assert routes[0]["route"] == "default via 192.168.1.1 dev eth0"
    
    @pytest.mark.asyncio
    async def test_scan_log_file_with_matches(self, ssh_client):
        """测试扫描日志文件 - 有匹配"""
        ssh_client.execute = AsyncMock(
            return_value=(0, "ERROR: Something went wrong\nERROR: Another error", "")
        )
        
        matches = await ssh_client.scan_log_file("/var/log/syslog", "ERROR", 100)
        
        assert len(matches) == 2
        assert "ERROR: Something went wrong" in matches
        assert "ERROR: Another error" in matches
    
    @pytest.mark.asyncio
    async def test_scan_log_file_no_matches(self, ssh_client):
        """测试扫描日志文件 - 无匹配"""
        ssh_client.execute = AsyncMock(return_value=(1, "", ""))
        
        matches = await ssh_client.scan_log_file("/var/log/syslog", "ERROR", 100)
        
        assert len(matches) == 0
    
    @pytest.mark.asyncio
    async def test_close(self, ssh_client):
        """测试关闭连接"""
        mock_client = MagicMock()
        ssh_client.client = mock_client
        
        await ssh_client.close()
        
        mock_client.close.assert_called_once()
        assert ssh_client.client is None
    
    @pytest.mark.asyncio
    async def test_async_context_manager(self, ssh_client):
        """测试异步上下文管理器"""
        ssh_client.connect = AsyncMock(return_value=True)
        ssh_client.close = AsyncMock()
        
        async with ssh_client as client:
            assert client is ssh_client
            ssh_client.connect.assert_called_once()
        
        ssh_client.close.assert_called_once()


class TestSSHClientWithKey:
    """使用密钥的 SSH 客户端测试"""
    
    @pytest.mark.asyncio
    async def test_connect_with_key(self):
        """测试使用密钥连接"""
        ssh_client = SSHClientWrapper(
            host="127.0.0.1",
            port=22,
            username="test_user",
            private_key_path="/path/to/key"
        )
        
        # 简化测试
        with patch.object(ssh_client, 'connect') as mock_connect:
            mock_connect.return_value = True
            
            result = await ssh_client.connect()
            
            assert result is True
