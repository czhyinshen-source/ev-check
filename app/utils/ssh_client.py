# SSH 客户端工具
import asyncio
from typing import Optional

import paramiko
from paramiko import SSHClient, AutoAddPolicy

from app.config import settings


class SSHClientWrapper:
    """SSH 客户端包装器"""

    def __init__(
        self,
        host: str,
        port: int = 22,
        username: str = "root",
        password: Optional[str] = None,
        private_key_path: Optional[str] = None,
        private_key: Optional[str] = None,
        passphrase: Optional[str] = None,
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.private_key_path = private_key_path
        self.private_key = private_key
        self.passphrase = passphrase
        self.client: Optional[SSHClient] = None

    async def connect(self) -> bool:
        """建立 SSH 连接"""
        try:
            self.client = SSHClient()
            self.client.set_missing_host_key_policy(AutoAddPolicy())

            connect_kwargs = {
                "hostname": self.host,
                "port": self.port,
                "username": self.username,
                "timeout": settings.SSH_CONNECT_TIMEOUT,
            }

            if self.private_key:
                from io import StringIO
                try:
                    # 尝试加载 RSA 密钥
                    key_obj = paramiko.RSAKey.from_private_key(
                        StringIO(self.private_key),
                        password=self.passphrase
                    )
                    connect_kwargs["pkey"] = key_obj
                except paramiko.SSHException:
                    try:
                        # 尝试加载 ED25519 密钥
                        key_obj = paramiko.Ed25519Key.from_private_key(
                            StringIO(self.private_key),
                            password=self.passphrase
                        )
                        connect_kwargs["pkey"] = key_obj
                    except Exception as e:
                        print(f"加载私钥失败: {e}")
                        raise
            elif self.private_key_path:
                connect_kwargs["key_filename"] = self.private_key_path
            elif self.password:
                connect_kwargs["password"] = self.password
                connect_kwargs["look_for_keys"] = False
                connect_kwargs["allow_agent"] = False

            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: self.client.connect(**connect_kwargs)
            )
            return True
        except Exception as e:
            import traceback
            print(f"SSH 连接失败: {e}")
            print(f"连接详情: host={self.host}, port={self.port}, username={self.username}")
            traceback.print_exc()
            return False

    async def execute(self, command: str) -> tuple[int, str, str]:
        """执行命令"""
        if not self.client:
            return (1, "", "未连接")

        try:
            loop = asyncio.get_event_loop()
            stdin, stdout, stderr = await loop.run_in_executor(
                None,
                lambda: self.client.exec_command(command, timeout=settings.SSH_TIMEOUT)
            )

            exit_code = stdout.channel.recv_exit_status()
            stdout_data = stdout.read().decode("utf-8")
            stderr_data = stderr.read().decode("utf-8")

            return (exit_code, stdout_data, stderr_data)
        except Exception as e:
            return (1, "", str(e))

    async def get_file_info(self, path: str) -> Optional[dict]:
        """获取文件信息"""
        command = f"stat -c '%a %U %G %s %Y' {path}"
        exit_code, stdout, stderr = await self.execute(command)

        if exit_code != 0:
            return None

        parts = stdout.strip().split()
        if len(parts) < 5:
            return None

        return {
            "permissions": parts[0],
            "owner": parts[1],
            "group": parts[2],
            "size": int(parts[3]),
            "mtime": int(parts[4]),
        }

    async def get_file_md5(self, path: str) -> Optional[str]:
        """获取文件 MD5"""
        command = f"md5sum {path}"
        exit_code, stdout, stderr = await self.execute(command)

        if exit_code != 0:
            return None

        return stdout.strip().split()[0] if stdout.strip() else None

    async def get_disk_usage(self, path: str = "/") -> Optional[dict]:
        """获取磁盘使用情况"""
        command = f"df -B1 {path} | tail -1"
        exit_code, stdout, stderr = await self.execute(command)

        if exit_code != 0:
            return None

        parts = stdout.split()
        if len(parts) < 6:
            return None

        return {
            "total": int(parts[1]),
            "used": int(parts[2]),
            "available": int(parts[3]),
            "use_percent": parts[4],
            "mounted_on": parts[5],
        }

    async def check_port_listening(self, port: int) -> bool:
        """检查端口是否监听"""
        command = f"netstat -tuln | grep ':{port} '"
        exit_code, stdout, stderr = await self.execute(command)
        return exit_code == 0 and stdout != ""

    async def check_process_exists(self, process_name: str) -> bool:
        """检查进程是否存在"""
        command = f"pgrep -f '{process_name}'"
        exit_code, stdout, stderr = await self.execute(command)
        return exit_code == 0

    async def get_service_status(self, service_name: str) -> Optional[str]:
        """获取服务状态"""
        command = f"systemctl is-active {service_name}"
        exit_code, stdout, stderr = await self.execute(command)
        return stdout.strip() if exit_code == 0 else None

    async def get_mounted_filesystems(self) -> list[dict]:
        """获取挂载的文件系统"""
        command = "mount | grep -E '^/dev' | awk '{print $1, $3, $5}'"
        exit_code, stdout, stderr = await self.execute(command)

        if exit_code != 0:
            return []

        result = []
        for line in stdout.strip().split("\n"):
            if line:
                parts = line.split()
                if len(parts) >= 3:
                    result.append({
                        "device": parts[0],
                        "mount_point": parts[1],
                        "type": parts[2],
                    })
        return result

    async def get_kernel_parameters(self) -> dict:
        """获取内核参数"""
        command = "sysctl -a"
        exit_code, stdout, stderr = await self.execute(command)

        if exit_code != 0:
            return {}

        result = {}
        for line in stdout.strip().split("\n"):
            if "=" in line:
                key, value = line.split("=", 1)
                result[key.strip()] = value.strip()
        return result

    async def get_routes(self) -> list[dict]:
        """获取路由表"""
        command = "ip route"
        exit_code, stdout, stderr = await self.execute(command)

        if exit_code != 0:
            return []

        result = []
        for line in stdout.strip().split("\n"):
            if line:
                result.append({"route": line})
        return result

    async def scan_log_file(
        self,
        path: str,
        pattern: str,
        max_lines: int = 100,
    ) -> list[str]:
        """扫描日志文件"""
        command = f"grep -E '{pattern}' {path} | tail -n {max_lines}"
        exit_code, stdout, stderr = await self.execute(command)

        if exit_code != 0:
            return []

        return stdout.strip().split("\n")

    async def close(self):
        """关闭连接"""
        if self.client:
            self.client.close()
            self.client = None

    async def __aenter__(self):
        """异步上下文管理器入口"""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """异步上下文管理器出口"""
        await self.close()
