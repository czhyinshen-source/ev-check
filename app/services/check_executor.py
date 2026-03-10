# 检查执行器基类
from abc import ABC, abstractmethod
from typing import Any, Optional
from dataclasses import dataclass

from app.utils.ssh_client import SSHClientWrapper


@dataclass
class CheckResult:
    """检查结果"""
    status: str  # success, warning, error
    message: str
    expected_value: Optional[Any] = None
    actual_value: Optional[Any] = None


class BaseCheckExecutor(ABC):
    """检查执行器基类"""

    def __init__(self, ssh_client: SSHClientWrapper):
        self.ssh_client = ssh_client

    @abstractmethod
    async def check(self, check_item: dict) -> CheckResult:
        """执行检查"""
        pass

    async def close(self):
        """关闭 SSH 连接"""
        await self.ssh_client.close()


class FileSystemCheckExecutor(BaseCheckExecutor):
    """文件系统检查执行器"""

    async def check(self, check_item: dict) -> CheckResult:
        check_type = check_item.get("check_attributes", {}).get("type", "exists")
        target_path = check_item.get("target_path", "")

        if not target_path:
            return CheckResult(
                status="error",
                message="目标路径未指定"
            )

        if check_type == "exists":
            return await self._check_exists(target_path)
        elif check_type == "permissions":
            expected = check_item.get("check_attributes", {}).get("permissions")
            return await self._check_permissions(target_path, expected)
        elif check_type == "size":
            expected = check_item.get("check_attributes", {}).get("max_size")
            return await self._check_size(target_path, expected)
        elif check_type == "md5":
            expected = check_item.get("check_attributes", {}).get("md5")
            return await self._check_md5(target_path, expected)
        elif check_type == "disk_usage":
            expected = check_item.get("check_attributes", {}).get("max_percent")
            return await self._check_disk_usage(target_path, expected)
        else:
            return CheckResult(
                status="error",
                message=f"未知的检查类型: {check_type}"
            )

    async def _check_exists(self, path: str) -> CheckResult:
        exit_code, stdout, stderr = await self.ssh_client.execute(f"test -e {path} && echo 'exists'")
        if exit_code == 0:
            return CheckResult(
                status="success",
                message=f"路径 {path} 存在",
                expected_value={"exists": True},
                actual_value={"exists": True}
            )
        else:
            return CheckResult(
                status="error",
                message=f"路径 {path} 不存在",
                expected_value={"exists": True},
                actual_value={"exists": False}
            )

    async def _check_permissions(self, path: str, expected: str) -> CheckResult:
        file_info = await self.ssh_client.get_file_info(path)
        if not file_info:
            return CheckResult(
                status="error",
                message=f"无法获取 {path} 的权限信息"
            )
        
        actual = file_info.get("permissions", "")
        if expected == actual:
            return CheckResult(
                status="success",
                message=f"权限检查通过: {actual}",
                expected_value=expected,
                actual_value=actual
            )
        else:
            return CheckResult(
                status="error",
                message=f"权限不匹配: 期望 {expected}, 实际 {actual}",
                expected_value=expected,
                actual_value=actual
            )

    async def _check_size(self, path: str, max_size: int) -> CheckResult:
        file_info = await self.ssh_client.get_file_info(path)
        if not file_info:
            return CheckResult(
                status="error",
                message=f"无法获取 {path} 的大小信息"
            )
        
        actual_size = file_info.get("size", 0)
        if actual_size <= max_size:
            return CheckResult(
                status="success",
                message=f"文件大小检查通过: {actual_size} bytes",
                expected_value={"max_size": max_size},
                actual_value={"size": actual_size}
            )
        else:
            return CheckResult(
                status="warning",
                message=f"文件大小超过限制: {actual_size} > {max_size}",
                expected_value={"max_size": max_size},
                actual_value={"size": actual_size}
            )

    async def _check_md5(self, path: str, expected_md5: str) -> CheckResult:
        actual_md5 = await self.ssh_client.get_file_md5(path)
        if not actual_md5:
            return CheckResult(
                status="error",
                message=f"无法获取 {path} 的 MD5"
            )
        
        if expected_md5 == actual_md5:
            return CheckResult(
                status="success",
                message=f"MD5 校验通过",
                expected_value=expected_md5,
                actual_value=actual_md5
            )
        else:
            return CheckResult(
                status="error",
                message=f"MD5 不匹配",
                expected_value=expected_md5,
                actual_value=actual_md5
            )

    async def _check_disk_usage(self, path: str, max_percent: str) -> CheckResult:
        disk_info = await self.ssh_client.get_disk_usage(path)
        if not disk_info:
            return CheckResult(
                status="error",
                message=f"无法获取磁盘使用情况"
            )
        
        actual_percent = disk_info.get("use_percent", "0%").rstrip("%")
        try:
            actual_percent_int = int(actual_percent)
            max_percent_int = int(max_percent.rstrip("%"))
            
            if actual_percent_int <= max_percent_int:
                return CheckResult(
                    status="success",
                    message=f"磁盘使用率检查通过: {actual_percent}%",
                    expected_value={"max_percent": max_percent},
                    actual_value={"percent": f"{actual_percent}%"}
                )
            elif actual_percent_int <= max_percent_int + 10:
                return CheckResult(
                    status="warning",
                    message=f"磁盘使用率较高: {actual_percent}%",
                    expected_value={"max_percent": max_percent},
                    actual_value={"percent": f"{actual_percent}%"}
                )
            else:
                return CheckResult(
                    status="error",
                    message=f"磁盘使用率超过限制: {actual_percent}%",
                    expected_value={"max_percent": max_percent},
                    actual_value={"percent": f"{actual_percent}%"}
                )
        except ValueError:
            return CheckResult(
                status="error",
                message=f"无效的磁盘使用率: {actual_percent}%"
            )


class ProcessCheckExecutor(BaseCheckExecutor):
    """进程检查执行器"""

    async def check(self, check_item: dict) -> CheckResult:
        check_type = check_item.get("check_attributes", {}).get("type", "exists")
        process_name = check_item.get("target_path", "")

        if not process_name:
            return CheckResult(
                status="error",
                message="进程名称未指定"
            )

        if check_type == "exists":
            return await self._check_process_exists(process_name)
        elif check_type == "running":
            return await self._check_process_running(process_name)
        elif check_type == "count":
            expected = check_item.get("check_attributes", {}).get("min_count", 1)
            return await self._check_process_count(process_name, expected)
        else:
            return CheckResult(
                status="error",
                message=f"未知的检查类型: {check_type}"
            )

    async def _check_process_exists(self, process_name: str) -> CheckResult:
        exists = await self.ssh_client.check_process_exists(process_name)
        if exists:
            return CheckResult(
                status="success",
                message=f"进程 {process_name} 存在",
                expected_value=True,
                actual_value=True
            )
        else:
            return CheckResult(
                status="error",
                message=f"进程 {process_name} 不存在",
                expected_value=True,
                actual_value=False
            )

    async def _check_process_running(self, process_name: str) -> CheckResult:
        exists = await self.ssh_client.check_process_exists(process_name)
        if exists:
            return CheckResult(
                status="success",
                message=f"进程 {process_name} 运行中",
                expected_value="running",
                actual_value="running"
            )
        else:
            return CheckResult(
                status="error",
                message=f"进程 {process_name} 未运行",
                expected_value="running",
                actual_value="not running"
            )

    async def _check_process_count(self, process_name: str, min_count: int) -> CheckResult:
        command = f"pgrep -c -f '{process_name}'"
        exit_code, stdout, stderr = await self.ssh_client.execute(command)
        
        try:
            count = int(stdout.strip()) if stdout.strip() else 0
            if count >= min_count:
                return CheckResult(
                    status="success",
                    message=f"进程数量检查通过: {count} >= {min_count}",
                    expected_value={"min_count": min_count},
                    actual_value={"count": count}
                )
            else:
                return CheckResult(
                    status="error",
                    message=f"进程数量不足: {count} < {min_count}",
                    expected_value={"min_count": min_count},
                    actual_value={"count": count}
                )
        except ValueError:
            return CheckResult(
                status="error",
                message=f"无法获取进程数量"
            )


class NetworkCheckExecutor(BaseCheckExecutor):
    """网络检查执行器"""

    async def check(self, check_item: dict) -> CheckResult:
        check_type = check_item.get("check_attributes", {}).get("type", "port_listening")
        target = check_item.get("target_path", "")

        if not target:
            return CheckResult(
                status="error",
                message="目标未指定"
            )

        if check_type == "port_listening":
            try:
                port = int(target)
                return await self._check_port_listening(port)
            except ValueError:
                return CheckResult(
                    status="error",
                    message=f"无效的端口号: {target}"
                )
        elif check_type == "port_connect":
            parts = target.split(":")
            if len(parts) != 2:
                return CheckResult(
                    status="error",
                    message="端口连接检查格式应为 host:port"
                )
            try:
                host, port = parts
                port_int = int(port)
                return await self._check_port_connect(host, port_int)
            except ValueError:
                return CheckResult(
                    status="error",
                    message=f"无效的端口号: {port}"
                )
        elif check_type == "route":
            return await self._check_route(target)
        else:
            return CheckResult(
                status="error",
                message=f"未知的检查类型: {check_type}"
            )

    async def _check_port_listening(self, port: int) -> CheckResult:
        is_listening = await self.ssh_client.check_port_listening(port)
        if is_listening:
            return CheckResult(
                status="success",
                message=f"端口 {port} 正在监听",
                expected_value={"listening": True},
                actual_value={"listening": True}
            )
        else:
            return CheckResult(
                status="error",
                message=f"端口 {port} 未监听",
                expected_value={"listening": True},
                actual_value={"listening": False}
            )

    async def _check_port_connect(self, host: str, port: int) -> CheckResult:
        command = f"nc -zv -w5 {host} {port} 2>&1"
        exit_code, stdout, stderr = await self.ssh_client.execute(command)
        
        if exit_code == 0:
            return CheckResult(
                status="success",
                message=f"可以连接到 {host}:{port}",
                expected_value={"connectable": True},
                actual_value={"connectable": True}
            )
        else:
            return CheckResult(
                status="error",
                message=f"无法连接到 {host}:{port}",
                expected_value={"connectable": True},
                actual_value={"connectable": False}
            )

    async def _check_route(self, destination: str) -> CheckResult:
        command = f"ip route get {destination}"
        exit_code, stdout, stderr = await self.ssh_client.execute(command)
        
        if exit_code == 0:
            return CheckResult(
                status="success",
                message=f"路由正常: {stdout.strip()}",
                expected_value={"route_exists": True},
                actual_value={"route": stdout.strip()}
            )
        else:
            return CheckResult(
                status="error",
                message=f"路由不可达: {destination}",
                expected_value={"route_exists": True},
                actual_value={"route_exists": False}
            )


class LogCheckExecutor(BaseCheckExecutor):
    """日志检查执行器"""

    async def check(self, check_item: dict) -> CheckResult:
        check_type = check_item.get("check_attributes", {}).get("type", "pattern")
        log_path = check_item.get("target_path", "")
        pattern = check_item.get("check_attributes", {}).get("pattern", "")

        if not log_path:
            return CheckResult(
                status="error",
                message="日志路径未指定"
            )

        if check_type == "pattern":
            max_matches = check_item.get("check_attributes", {}).get("max_matches", 0)
            return await self._check_pattern(log_path, pattern, max_matches)
        elif check_type == "error_count":
            threshold = check_item.get("check_attributes", {}).get("threshold", 0)
            check_attributes = check_item.get("check_attributes", {})
            return await self._check_error_count(log_path, threshold, check_attributes)
        else:
            return CheckResult(
                status="error",
                message=f"未知的检查类型: {check_type}"
            )

    async def _check_pattern(self, log_path: str, pattern: str, max_matches: int) -> CheckResult:
        matches = await self.ssh_client.scan_log_file(log_path, pattern, max_matches + 1)
        match_count = len(matches)
        
        if match_count == 0:
            return CheckResult(
                status="success",
                message=f"未找到匹配模式 '{pattern}' 的日志",
                expected_value={"max_matches": max_matches},
                actual_value={"matches": 0}
            )
        elif match_count <= max_matches:
            return CheckResult(
                status="success",
                message=f"找到 {match_count} 条匹配日志",
                expected_value={"max_matches": max_matches},
                actual_value={"matches": match_count}
            )
        else:
            return CheckResult(
                status="error",
                message=f"找到过多匹配日志: {match_count} > {max_matches}",
                expected_value={"max_matches": max_matches},
                actual_value={"matches": match_count}
            )

    async def _check_error_count(self, log_path: str, threshold: int, check_attributes: dict) -> CheckResult:
        error_pattern = check_attributes.get("error_pattern", "ERROR|FATAL|CRITICAL")
        matches = await self.ssh_client.scan_log_file(log_path, error_pattern, threshold + 1)
        error_count = len(matches)
        
        if error_count <= threshold:
            return CheckResult(
                status="success",
                message=f"错误数量在允许范围内: {error_count}",
                expected_value={"max_errors": threshold},
                actual_value={"error_count": error_count}
            )
        else:
            return CheckResult(
                status="error",
                message=f"错误数量超过阈值: {error_count} > {threshold}",
                expected_value={"max_errors": threshold},
                actual_value={"error_count": error_count}
            )


class ServiceCheckExecutor(BaseCheckExecutor):
    """服务检查执行器"""

    async def check(self, check_item: dict) -> CheckResult:
        service_name = check_item.get("target_path", "")

        if not service_name:
            return CheckResult(
                status="error",
                message="服务名称未指定"
            )

        status = await self.ssh_client.get_service_status(service_name)
        
        if status == "active":
            return CheckResult(
                status="success",
                message=f"服务 {service_name} 运行正常",
                expected_value="active",
                actual_value=status
            )
        elif status:
            return CheckResult(
                status="warning",
                message=f"服务 {service_name} 状态: {status}",
                expected_value="active",
                actual_value=status
            )
        else:
            return CheckResult(
                status="error",
                message=f"服务 {service_name} 不存在或无法获取状态",
                expected_value="active",
                actual_value="unknown"
            )


class FileContentCheckExecutor(BaseCheckExecutor):
    """文件内容检查执行器"""

    async def check(self, check_item: dict) -> CheckResult:
        file_path = check_item.get("target_path", "")
        pattern = check_item.get("check_attributes", {}).get("pattern", "")

        if not file_path:
            return CheckResult(
                status="error",
                message="文件路径未指定"
            )

        if not pattern:
            return CheckResult(
                status="error",
                message="搜索模式未指定"
            )

        command = f"grep -q '{pattern}' {file_path}"
        exit_code, stdout, stderr = await self.ssh_client.execute(command)
        
        if exit_code == 0:
            return CheckResult(
                status="success",
                message=f"文件 {file_path} 包含模式 '{pattern}'",
                expected_value={"pattern": pattern},
                actual_value={"found": True}
            )
        else:
            return CheckResult(
                status="error",
                message=f"文件 {file_path} 不包含模式 '{pattern}'",
                expected_value={"pattern": pattern},
                actual_value={"found": False}
            )


class KernelCheckExecutor(BaseCheckExecutor):
    """内核参数检查执行器"""

    async def check(self, check_item: dict) -> CheckResult:
        param_name = check_item.get("target_path", "")
        expected_value = check_item.get("check_attributes", {}).get("value", "")

        if not param_name:
            return CheckResult(
                status="error",
                message="内核参数名称未指定"
            )

        kernel_params = await self.ssh_client.get_kernel_parameters()
        actual_value = kernel_params.get(param_name)
        
        if actual_value is None:
            return CheckResult(
                status="error",
                message=f"内核参数 {param_name} 不存在",
                expected_value=expected_value,
                actual_value="not found"
            )
        
        if expected_value and actual_value == expected_value:
            return CheckResult(
                status="success",
                message=f"内核参数 {param_name} 检查通过: {actual_value}",
                expected_value=expected_value,
                actual_value=actual_value
            )
        elif expected_value:
            return CheckResult(
                status="error",
                message=f"内核参数 {param_name} 不匹配: 期望 {expected_value}, 实际 {actual_value}",
                expected_value=expected_value,
                actual_value=actual_value
            )
        else:
            return CheckResult(
                status="success",
                message=f"内核参数 {param_name} 值: {actual_value}",
                expected_value=None,
                actual_value=actual_value
            )


def get_executor(check_type: str, ssh_client: SSHClientWrapper) -> BaseCheckExecutor:
    """获取检查执行器"""
    executors = {
        "file": FileSystemCheckExecutor,
        "filesystem": FileSystemCheckExecutor,
        "file_content": FileContentCheckExecutor,
        "process": ProcessCheckExecutor,
        "network": NetworkCheckExecutor,
        "log": LogCheckExecutor,
        "service": ServiceCheckExecutor,
        "route": NetworkCheckExecutor,
        "kernel": KernelCheckExecutor,
    }
    
    executor_class = executors.get(check_type.lower())
    if not executor_class:
        raise ValueError(f"未知的检查类型: {check_type}")
    
    return executor_class(ssh_client)


async def execute_check(
    ssh_client: SSHClientWrapper,
    check_item: dict,
) -> list[CheckResult]:
    """执行单个检查项，支持多个检查类型"""
    check_types = check_item.get("type", [])
    
    # 确保 check_types 是列表
    if not isinstance(check_types, list):
        check_types = [check_types]
    
    results = []
    for check_type in check_types:
        try:
            executor = get_executor(check_type, ssh_client)
            result = await executor.check(check_item)
            results.append(result)
        except Exception as e:
            results.append(CheckResult(
                status="error",
                message=f"检查执行失败: {str(e)}"
            ))
    
    return results
