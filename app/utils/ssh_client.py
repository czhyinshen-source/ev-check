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

    async def get_file_size(self, path: str) -> int:
        """获取结构简单的远程文件大小"""
        # Mac 用 stat -f %z, Linux 用 stat -c %s
        command = f"stat -c %s '{path}' 2>/dev/null || stat -f %z '{path}' 2>/dev/null"
        exit_code, stdout, stderr = await self.execute(command)
        if exit_code == 0 and stdout.strip().isdigit():
            return int(stdout.strip())
        return -1

    async def download_file(self, remote_path: str, local_path: str) -> bool:
        """使用 SFTP 极速下载文件至本地"""
        import os
        if not self.client:
            return False
            
        try:
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            # 使用 Paramiko 的 sftp 子系统
            loop = asyncio.get_event_loop()
            
            def _sftp_get():
                sftp = self.client.open_sftp()
                try:
                    sftp.get(remote_path, local_path)
                finally:
                    sftp.close()
                    
            await loop.run_in_executor(None, _sftp_get)
            return True
        except Exception as e:
            import traceback
            print(f"SFTP 下载失败: {e}")
            traceback.print_exc()
            return False

    async def get_file_info(self, path: str) -> Optional[dict]:
        """获取文件信息 (兼容 Linux/Mac)"""
        # Linux 用 stat -c, Mac 用 stat -f
        # 权限统一使用八进制: Linux %a, Mac %Lp
        # 使用单引号包裹路径以支持空格
        command = f"stat -c '%a %U %G %s %Y' '{path}' 2>/dev/null || stat -f '%Lp %Su %Sg %z %m' '{path}' 2>/dev/null"
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
        command = f"md5sum {path} 2>/dev/null || md5 -q {path} 2>/dev/null"
        exit_code, stdout, stderr = await self.execute(command)

        if exit_code != 0:
            return None

        return stdout.strip().split()[0] if stdout.strip() else None

    async def get_disk_usage(self, path: str = "/") -> Optional[dict]:
        """获取磁盘使用情况 (兼容 Linux/Mac)"""
        # 尝试 Linux 风格 (-B1 为 1-byte blocks)
        command = f"df -B1 {path} 2>/dev/null | tail -1"
        exit_code, stdout, stderr = await self.execute(command)
        
        parts = stdout.split()
        if exit_code == 0 and len(parts) >= 6 and parts[1].isdigit():
            return {
                "total": int(parts[1]),
                "used": int(parts[2]),
                "available": int(parts[3]),
                "use_percent": parts[4],
                "mounted_on": parts[5],
            }
            
        # 尝试 Mac 风格 (-k 并手动转换为 bytes)
        command = f"df -k {path} 2>/dev/null | tail -1"
        exit_code, stdout, stderr = await self.execute(command)
        parts = stdout.split()
        if exit_code == 0 and len(parts) >= 9:
            # Mac 格式: Filesystem 1024-blocks Used Available Capacity iused ifree %iused Mounted on
            try:
                return {
                    "total": int(parts[1]) * 1024,
                    "used": int(parts[2]) * 1024,
                    "available": int(parts[3]) * 1024,
                    "use_percent": parts[4],
                    "mounted_on": parts[8],
                }
            except (ValueError, IndexError):
                pass
        return None

    async def check_port_listening(self, port: int) -> bool:
        """检查端口是否监听 (兼容 Linux/Mac)"""
        # Linux: netstat -tuln
        # Mac: netstat -an -p tcp / -p udp
        command = f"netstat -tuln 2>/dev/null | grep ':{port} ' || netstat -an 2>/dev/null | grep LISTEN | grep '.{port} '"
        exit_code, stdout, stderr = await self.execute(command)
        return exit_code == 0 and stdout.strip() != ""

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
        """获取挂载的文件系统 (兼容 Linux/Mac)"""
        # 统一使用 awk 提取关键字段
        command = "mount | grep -E '^/dev' | awk '{print $1, $3, $5}'"
        exit_code, stdout, stderr = await self.execute(command)
        
        if exit_code != 0:
            return []

        result = []
        for line in stdout.strip().split("\n"):
            if line:
                parts = line.split()
                if len(parts) >= 3:
                    # 清理 Mac 风格的逗号和括号: (apfs, -> apfs
                    fs_type = parts[2].strip("(),")
                    result.append({
                        "device": parts[0],
                        "mount_point": parts[1],
                        "type": fs_type,
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
        """获取路由表 (兼容 Linux/Mac)"""
        # 尝试 ip route (Linux)
        exit_code, stdout, stderr = await self.execute("ip route")
        
        # 如果失败，尝试 netstat -rn (Mac/BSD)
        if exit_code != 0:
            exit_code, stdout, stderr = await self.execute("netstat -rn")
            
        if exit_code != 0:
            return []

        result = []
        for line in stdout.strip().split("\n"):
            line = line.strip()
            # 跳过空行和 netstat 的标题行
            if not line or "Routing tables" in line or "Destination" in line or "Internet" in line:
                continue
            result.append({"route": line})
        return result

    async def get_recursive_file_info(self, path: str, exclude_patterns: Optional[list[str]] = None) -> dict[str, dict]:
        """递归获取文件信息 (兼容 Linux/Mac)"""
        # 构建排除逻辑
        exclude_args = ""
        if exclude_patterns:
            for pattern in exclude_patterns:
                exclude_args += f' -not -path "{pattern}"'
        
        # 针对路径进行转义处理（简单单引号包裹）
        safe_path = f"'{path}'"
        
        # 1. 尝试 Linux 风格 (GNU find)
        # %p:路径, %m:权限(八进制), %u:属主, %g:属组, %s:大小, %T@:修改时间
        cmd_linux = f'find {safe_path} {exclude_args} -printf "%p|%m|%u|%g|%s|%T@\\n"'
        
        # 2. 尝试 Mac 风格 (BSD find + stat)
        # %N:路径, %Lp:权限(八进制), %Su:属主, %Sg:属组, %z:大小, %m:时间
        cmd_mac = f'find {safe_path} {exclude_args} -exec stat -f "%N|%Lp|%Su|%Sg|%z|%m" {{}} +'
        
        # 合并命令，优先使用 Linux 风格，失败则尝试 Mac 风格
        # 注意：这里保留 stderr 以便在完全失败时能够看到原因
        command = f'({cmd_linux} 2>/dev/null) || ({cmd_mac})'
        
        exit_code, stdout, stderr = await self.execute(command)
        
        if exit_code != 0 and not stdout:
            # 如果失败，返回错误信息以便前端展示
            error_msg = stderr.strip() or "未知采集错误 (请检查路径是否存在或权限是否足够)"
            return {"_error": error_msg}
            
        results = {}
        for line in stdout.strip().split("\n"):
            if not line:
                continue
            # 从右往左切分，防止路径中包含 |
            parts = line.split("|")
            if len(parts) < 6:
                continue
            
            try:
                # 最后的 5 个字段是确定长度的，前面的所有内容都视为路径
                mtime = parts[-1]
                size = parts[-2]
                group = parts[-3]
                owner = parts[-4]
                perm = parts[-5]
                filepath = "|".join(parts[:-5])
                
                results[filepath] = {
                    "permissions": perm,
                    "owner": owner,
                    "group": group,
                    "size": int(size),
                    "mtime": int(float(mtime)),
                    "md5": None # 预留 MD5
                }
            except (ValueError, IndexError):
                continue

        # 3. 异步获取 MD5 (仅针对文件)
        # Linux: find ... -type f -exec md5sum {} +
        # Mac: find ... -type f -exec md5 -r {} +
        md5_linux = f'find {safe_path} {exclude_args} -type f -exec md5sum {{}} +'
        md5_mac = f'find {safe_path} {exclude_args} -type f -exec md5 -r {{}} +'
        md5_command = f'({md5_linux} 2>/dev/null) || ({md5_mac} 2>/dev/null)'
        
        _, md5_stdout, _ = await self.execute(md5_command)
        if md5_stdout:
            for line in md5_stdout.strip().split("\n"):
                if not line: continue
                # md5sum 输出: "hash  path"
                # md5 -r 输出: "hash path"
                parts = line.split(maxsplit=1)
                if len(parts) == 2:
                    h, p = parts
                    if p in results:
                        results[p]["md5"] = h
        
        return results

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
