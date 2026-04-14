# 检查执行器
# 支持所有检查项类型的执行逻辑
import os
import uuid
import subprocess
from abc import ABC, abstractmethod
from typing import Any, Optional
from dataclasses import dataclass
import re

from app.utils.ssh_client import SSHClientWrapper


@dataclass
class CheckResult:
    """检查结果"""
    status: str  # pass, fail, error
    message: str
    expected_value: Optional[Any] = None
    actual_value: Optional[Any] = None

    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "message": self.message,
            "expected_value": self.expected_value,
            "actual_value": self.actual_value,
        }


class BaseCheckExecutor(ABC):
    """检查执行器基类"""

    def __init__(self, ssh_client: SSHClientWrapper):
        self.ssh_client = ssh_client

    @abstractmethod
    async def check(self, check_item: dict, baseline_data: Optional[dict] = None) -> CheckResult:
        """执行检查"""
        pass

    async def close(self):
        """关闭 SSH 连接"""
        await self.ssh_client.close()


class FileSystemCheckExecutor(BaseCheckExecutor):
    """文件系统检查执行器 - 支持多种文件检查类型"""

    # 检查类型到方法的映射
    CHECK_METHODS = {
        "file_exists": "_check_exists",
        "exists": "_check_exists",
        "file_permissions": "_check_permissions",
        "permissions": "_check_permissions",
        "file_owner": "_check_owner",
        "owner": "_check_owner",
        "file_group": "_check_group",
        "group": "_check_group",
        "file_size": "_check_size",
        "size": "_check_size",
        "file_mtime": "_check_mtime",
        "mtime": "_check_mtime",
        "file_md5": "_check_md5",
        "md5": "_check_md5",
    }

    async def check(self, check_item: dict, baseline_data: Optional[dict] = None) -> CheckResult:
        check_attributes = check_item.get("check_attributes", {}) or {}
        target_path = check_item.get("target_path", "")
        check_type = check_attributes.get("type", "exists")

        # 始终尝试获取全量文件信息 (用于丰富快照数据)
        file_info = await self.ssh_client.get_file_info(target_path)
        md5 = await self.ssh_client.get_file_md5(target_path) if file_info else None
        
        full_data = {
            "exists": file_info is not None,
            "path": target_path
        }
        if file_info:
            full_data.update(file_info)
            if md5:
                full_data["md5"] = md5

        # 获取具体的检查方法执行逻辑 (用于判定 status)
        method_name = self.CHECK_METHODS.get(check_type)
        if method_name and hasattr(self, method_name):
            result = await getattr(self, method_name)(target_path, check_attributes, baseline_data)
            # 将全量数据覆盖到 actual_value 中，确保快照存根完整
            result.actual_value = full_data
            return result

        return CheckResult(
            status="error",
            message=f"未知的文件系统检查类型: {check_type}",
            actual_value=full_data
        )

    def _get_expected(self, attrs: dict, baseline: Optional[dict], field: str, default: Any = None) -> Any:
        """从属性或基准数据获取期望值"""
        if attrs.get(field):
            return attrs[field]
        if baseline and baseline.get(field):
            return baseline[field]
        return default

    async def _check_exists(self, path: str, attrs: dict, baseline: Optional[dict]) -> CheckResult:
        """文件存在性检查"""
        if not path:
            return CheckResult(
                status="error",
                message="文件路径不能为空"
            )
        file_info = await self.ssh_client.get_file_info(path)
        actual_exists = file_info is not None
        
        expected_exists = True
        if attrs and "exists" in attrs:
            expected_exists = bool(attrs["exists"])
        elif baseline and "exists" in baseline:
            expected_exists = bool(baseline["exists"])

        if actual_exists == expected_exists:
            return CheckResult(
                status="pass",
                message=f"状态匹配(期望={'存在' if expected_exists else '不存在'}): {path}",
                expected_value={"exists": expected_exists, "path": path},
                actual_value={"exists": actual_exists, "path": path}
            )
        return CheckResult(
            status="fail",
            message=f"状态不匹配(期望={'存在' if expected_exists else '不存在'}, 实际={'存在' if actual_exists else '不存在'}): {path}",
            expected_value={"exists": expected_exists, "path": path},
            actual_value={"exists": actual_exists, "path": path}
        )

    async def _check_permissions(self, path: str, attrs: dict, baseline: Optional[dict]) -> CheckResult:
        """文件权限检查"""
        file_info = await self.ssh_client.get_file_info(path)
        if not file_info:
            return CheckResult(
                status="error",
                message=f"无法获取文件权限信息: {path}"
            )
        actual = file_info.get("permissions", "")
        expected = self._get_expected(attrs, baseline, "permissions", actual)

        if actual == expected:
            return CheckResult(
                status="pass",
                message=f"权限匹配: {actual}",
                expected_value={"permissions": expected},
                actual_value={"permissions": actual}
            )
        return CheckResult(
            status="fail",
            message=f"权限不匹配: 期望 {expected}, 实际 {actual}",
            expected_value={"permissions": expected},
            actual_value={"permissions": actual}
        )

    async def _check_owner(self, path: str, attrs: dict, baseline: Optional[dict]) -> CheckResult:
        """文件属主检查"""
        file_info = await self.ssh_client.get_file_info(path)
        if not file_info:
            return CheckResult(
                status="error",
                message=f"无法获取文件属主信息: {path}"
            )
        actual = file_info.get("owner", "")
        expected = self._get_expected(attrs, baseline, "owner", actual)

        if actual == expected:
            return CheckResult(
                status="pass",
                message=f"属主匹配: {actual}",
                expected_value={"owner": expected},
                actual_value={"owner": actual}
            )
        return CheckResult(
            status="fail",
            message=f"属主不匹配: 期望 {expected}, 实际 {actual}",
            expected_value={"owner": expected},
            actual_value={"owner": actual}
        )

    async def _check_group(self, path: str, attrs: dict, baseline: Optional[dict]) -> CheckResult:
        """文件属组检查"""
        file_info = await self.ssh_client.get_file_info(path)
        if not file_info:
            return CheckResult(
                status="error",
                message=f"无法获取文件属组信息: {path}"
            )
        actual = file_info.get("group", "")
        expected = self._get_expected(attrs, baseline, "group", actual)

        if actual == expected:
            return CheckResult(
                status="pass",
                message=f"属组匹配: {actual}",
                expected_value={"group": expected},
                actual_value={"group": actual}
            )
        return CheckResult(
            status="fail",
            message=f"属组不匹配: 期望 {expected}, 实际 {actual}",
            expected_value={"group": expected},
            actual_value={"group": actual}
        )

    async def _check_size(self, path: str, attrs: dict, baseline: Optional[dict]) -> CheckResult:
        """文件大小检查 - 支持范围"""
        file_info = await self.ssh_client.get_file_info(path)
        if not file_info:
            return CheckResult(
                status="error",
                message=f"无法获取文件大小信息: {path}"
            )
        actual = file_info.get("size", 0)

        # 获取范围
        min_size = attrs.get("min_size") or (baseline.get("min_size") if baseline else None)
        max_size = attrs.get("max_size") or (baseline.get("max_size") if baseline else None)

        if min_size is None and max_size is None:
            return CheckResult(
                status="pass",
                message=f"文件大小: {actual} 字节",
                actual_value={"size": actual}
            )

        min_ok = min_size is None or actual >= min_size
        max_ok = max_size is None or actual <= max_size

        if min_ok and max_ok:
            return CheckResult(
                status="pass",
                message=f"文件大小在范围内: {actual} 字节",
                expected_value={"min_size": min_size, "max_size": max_size},
                actual_value={"size": actual}
            )
        return CheckResult(
            status="fail",
            message=f"文件大小超出范围: {actual} 字节 (期望 {min_size}-{max_size})",
            expected_value={"min_size": min_size, "max_size": max_size},
            actual_value={"size": actual}
        )

    async def _check_mtime(self, path: str, attrs: dict, baseline: Optional[dict]) -> CheckResult:
        """文件修改时间检查 - 支持时间戳范围"""
        file_info = await self.ssh_client.get_file_info(path)
        if not file_info:
            return CheckResult(
                status="error",
                message=f"无法获取文件修改时间: {path}"
            )
        actual = file_info.get("mtime", 0)

        # 获取时间范围（秒级时间戳）
        start_ts = attrs.get("start_time") or (baseline.get("start_time") if baseline else None)
        end_ts = attrs.get("end_time") or (baseline.get("end_time") if baseline else None)

        if start_ts is not None:
            try:
                start_ts = int(start_ts)
            except (ValueError, TypeError):
                start_ts = None
        if end_ts is not None:
            try:
                end_ts = int(end_ts)
            except (ValueError, TypeError):
                end_ts = None

        if start_ts is None and end_ts is None:
            return CheckResult(
                status="pass",
                message=f"文件修改时间: {actual}",
                actual_value={"mtime": actual}
            )

        from_ok = start_ts is None or actual >= start_ts
        to_ok = end_ts is None or actual <= end_ts

        if from_ok and to_ok:
            return CheckResult(
                status="pass",
                message=f"修改时间在范围内: {actual}",
                expected_value={"start_time": start_ts, "end_time": end_ts},
                actual_value={"mtime": actual}
            )
        return CheckResult(
            status="fail",
            message=f"修改时间超出范围: {actual} (期望 {start_ts}-{end_ts})",
            expected_value={"start_time": start_ts, "end_time": end_ts},
            actual_value={"mtime": actual}
        )

    async def _check_md5(self, path: str, attrs: dict, baseline: Optional[dict]) -> CheckResult:
        """文件 MD5 检查"""
        if not path:
            return CheckResult(
                status="error",
                message="文件路径不能为空"
            )
        actual = await self.ssh_client.get_file_md5(path)
        if not actual:
            return CheckResult(
                status="error",
                message=f"无法获取文件 MD5: {path}"
            )
        expected = attrs.get("md5_value") or (baseline.get("md5") if baseline else None)

        if not expected:
            return CheckResult(
                status="pass",
                message=f"MD5: {actual}",
                actual_value={"md5": actual}
            )

        if actual.lower() == expected.lower():
            return CheckResult(
                status="pass",
                message="MD5 匹配",
                expected_value={"md5": expected},
                actual_value={"md5": actual}
            )
        return CheckResult(
            status="fail",
            message=f"MD5 不匹配: 期望 {expected}, 实际 {actual}",
            expected_value={"md5": expected},
            actual_value={"md5": actual}
        )


class FileContentCheckExecutor(BaseCheckExecutor):
    """文件内容检查执行器"""

    async def check(self, check_item: dict, baseline_data: Optional[dict] = None) -> CheckResult:
        file_path = check_item.get("target_path", "")
        attrs = check_item.get("check_attributes", {}) or {}
        content_attrs = attrs.get("content", {})

        if not file_path:
            return CheckResult(
                status="error",
                message="文件路径不能为空"
            )

        FILE_SIZE_LIMIT = 1024 * 1024  # 1MB 软上限
        file_size = await self.ssh_client.get_file_size(file_path)

        if file_size > FILE_SIZE_LIMIT:
            local_hash_name = f"{uuid.uuid4().hex}.file"
            local_dir = "/tmp/ev_check_runs"
            local_dest = os.path.join(local_dir, local_hash_name)

            download_ok = await self.ssh_client.download_file(file_path, local_dest)
            if not download_ok:
                return CheckResult(
                    status="error",
                    message="大文件（>1MB）下载失败"
                )

            actual_payload = {
                "_is_large_file": True,
                "path": local_dest,
                "size": file_size
            }

            compare_mode = content_attrs.get("compare_mode", "full")
            if compare_mode in ("full", "snapshot"):
                if baseline_data and baseline_data.get("_is_large_file"):
                    expected_path = baseline_data.get("path")
                    if os.path.exists(expected_path):
                        try:
                            # 跑原生 diff
                            diff_proc = subprocess.run(
                                ["diff", "-u", expected_path, local_dest],
                                capture_output=True, text=True
                            )
                            diff_lines = diff_proc.stdout.splitlines()
                            if len(diff_lines) > 5000:
                                diff_output = "\n".join(diff_lines[:5000]) + "\n... [差异行数过多，安全截取前 5000 行展示] ..."
                            else:
                                diff_output = diff_proc.stdout

                            pass_status = "pass" if diff_proc.returncode == 0 else "fail"

                            return CheckResult(
                                status=pass_status,
                                message="大文件内容完全匹配" if pass_status == "pass" else "大文件内容不匹配",
                                expected_value=baseline_data,
                                actual_value={**actual_payload, "diff_record": diff_output} if pass_status == "fail" else actual_payload
                            )
                        except Exception as e:
                            return CheckResult(status="error", message=f"大文件差异生成失败: {e}")
                    else:
                        return CheckResult(status="error", message="大文件基准快照实存文件已丢失")
                else:
                    return CheckResult(
                        status="pass",
                        message=f"大文件初步归档，大小: {file_size} 字节",
                        actual_value=actual_payload
                    )
            else:
                return CheckResult(status="error", message="超大文件暂不支持部分(partial)或包含(contains)比对模式")


        # 读取小文件内容 (< 1MB)
        exit_code, stdout, stderr = await self.ssh_client.execute(f"cat {file_path}")
        if exit_code != 0:
            return CheckResult(
                status="error",
                message=f"无法读取文件: {stderr or '未知错误'}"
            )

        # 获取期望内容
        expected_content = content_attrs.get("content")
        if baseline_data is not None and "content" in baseline_data:
            expected_content = baseline_data["content"]

        actual_content = stdout
        compare_mode = content_attrs.get("compare_mode", "full")

        # 完整比较或快照比对
        if compare_mode in ("full", "snapshot"):
            if expected_content is None:
                return CheckResult(
                    status="pass",
                    message=f"文件内容长度: {len(actual_content)} 字符",
                    actual_value={
                        "content": actual_content,
                        "content_length": len(actual_content)
                    }
                )

            if actual_content == expected_content:
                return CheckResult(
                    status="pass",
                    message="文件内容完全匹配",
                    expected_value={"content": expected_content},
                    actual_value={"content": actual_content}
                )
            return CheckResult(
                status="fail",
                message="文件内容不匹配",
                expected_value={"content": expected_content},
                actual_value={"content": actual_content}
            )

        # 部分内容比较
        if compare_mode == "partial":
            pattern = content_attrs.get("pattern") or content_attrs.get("content")
            if not pattern:
                return CheckResult(
                    status="error",
                    message="部分比较需要指定 pattern"
                )
            found = pattern in actual_content
            if found:
                return CheckResult(
                    status="pass",
                    message=f"找到指定内容",
                    expected_value={"pattern": pattern},
                    actual_value={"found": True}
                )
            return CheckResult(
                status="fail",
                message=f"未找到指定内容",
                expected_value={"pattern": pattern},
                actual_value={"found": False}
            )

        # 包含检查
        if compare_mode == "contains":
            pattern = content_attrs.get("pattern") or content_attrs.get("content")
            if not pattern:
                return CheckResult(
                    status="error",
                    message="包含检查需要指定 pattern"
                )
            if pattern in actual_content:
                return CheckResult(
                    status="pass",
                    message="文件包含指定文本",
                    expected_value={"contains": pattern},
                    actual_value={"found": True}
                )
            return CheckResult(
                status="fail",
                message="文件不包含指定文本",
                expected_value={"contains": pattern},
                actual_value={"found": False}
            )

        # 不包含检查
        if compare_mode == "not_contains":
            pattern = attrs.get("pattern") or attrs.get("content")
            if not pattern:
                return CheckResult(
                    status="error",
                    message="不包含检查需要指定 pattern"
                )
            if pattern not in actual_content:
                return CheckResult(
                    status="pass",
                    message="文件不包含指定文本",
                    expected_value={"not_contains": pattern},
                    actual_value={"found": False}
                )
            return CheckResult(
                status="fail",
                message="文件包含指定文本（不应包含）",
                expected_value={"not_contains": pattern},
                actual_value={"found": True}
            )

        return CheckResult(
            status="error",
            message=f"未知的比较模式: {compare_mode}"
        )


class KernelCheckExecutor(BaseCheckExecutor):
    """内核参数检查执行器"""

    async def check(self, check_item: dict, baseline_data: Optional[dict] = None) -> CheckResult:
        attrs = check_item.get("check_attributes", {}) or {}
        # 优先使用 attrs 中的 param_name，否则使用 target_path
        param_name = attrs.get("param_name") or check_item.get("target_path", "")

        if not param_name:
            return CheckResult(
                status="error",
                message="内核参数名称未指定"
            )

        compare_mode = attrs.get("compare_mode", "snapshot")
        expected_value = attrs.get("param_value")

        # 从基准数据获取
        if compare_mode == "snapshot" and baseline_data:
            expected_value = baseline_data.get("param_value")
            if not param_name:
                param_name = baseline_data.get("param_name")

        # 读取内核参数
        exit_code, stdout, stderr = await self.ssh_client.execute(f"cat {param_name}")
        if exit_code != 0:
            exit_code, stdout, stderr = await self.ssh_client.execute(f"sysctl -n {param_name}")

        if exit_code != 0:
            return CheckResult(
                status="error",
                message=f"无法获取内核参数 {param_name}: {stderr}"
            )

        actual_value = stdout.strip()

        if expected_value is None:
            return CheckResult(
                status="pass",
                message=f"内核参数值: {actual_value}",
                actual_value={"param_name": param_name, "value": actual_value}
            )

        # 支持正则表达式匹配 (~ 开头)
        if isinstance(expected_value, str) and expected_value.startswith("~"):
            pattern = expected_value[1:]
            if re.search(pattern, actual_value):
                return CheckResult(
                    status="pass",
                    message=f"参数值匹配正则: {pattern}",
                    expected_value={"param_name": param_name, "value": expected_value},
                    actual_value={"param_name": param_name, "value": actual_value}
                )
            return CheckResult(
                status="fail",
                message=f"参数值不匹配正则: {pattern}",
                expected_value={"param_name": param_name, "value": expected_value},
                actual_value={"param_name": param_name, "value": actual_value}
            )

        # 精确匹配
        if actual_value == expected_value:
            return CheckResult(
                status="pass",
                message="参数值匹配",
                expected_value={"param_name": param_name, "value": expected_value},
                actual_value={"param_name": param_name, "value": actual_value}
            )
        return CheckResult(
            status="fail",
            message=f"参数值不匹配: 期望 {expected_value}, 实际 {actual_value}",
            expected_value={"param_name": param_name, "value": expected_value},
            actual_value={"param_name": param_name, "value": actual_value}
        )


class RouteCheckExecutor(BaseCheckExecutor):
    """路由表检查执行器"""

    async def check(self, check_item: dict, baseline_data: Optional[dict] = None) -> CheckResult:
        attrs = check_item.get("check_attributes", {}) or {}
        mode = attrs.get("mode", "full")

        routes = await self.ssh_client.get_routes()
        if not routes:
            return CheckResult(
                status="error",
                message="无法获取路由表"
            )

        actual_routes = [r.get("route", "") for r in routes]

        # 全量路由表比较
        if mode == "full":
            if baseline_data:
                expected_routes = baseline_data.get("routes", [])
                expected_set = set(expected_routes)
                actual_set = set(actual_routes)
                missing = expected_set - actual_set
                extra = actual_set - expected_set

                if not missing and not extra:
                    return CheckResult(
                        status="pass",
                        message="路由表完全匹配",
                        expected_value={"routes": expected_routes},
                        actual_value={"routes": actual_routes}
                    )
                return CheckResult(
                    status="fail",
                    message=f"路由表不匹配: 缺少 {len(missing)} 条, 多出 {len(extra)} 条",
                    expected_value={"routes": expected_routes},
                    actual_value={"routes": actual_routes}
                )
            return CheckResult(
                status="pass",
                message=f"路由表包含 {len(actual_routes)} 条规则",
                actual_value={"routes": actual_routes, "count": len(actual_routes)}
            )

        # 检查指定路由规则
        route_rule = attrs.get("route_rule")
        if not route_rule:
            return CheckResult(
                status="error",
                message="未指定要检查的路由规则"
            )

        found = any(route_rule in route for route in actual_routes)
        if found:
            return CheckResult(
                status="pass",
                message=f"找到指定路由: {route_rule}",
                expected_value={"route_rule": route_rule},
                actual_value={"found": True, "routes": actual_routes}
            )
        return CheckResult(
            status="fail",
            message=f"未找到指定路由: {route_rule}",
            expected_value={"route_rule": route_rule},
            actual_value={"found": False, "routes": actual_routes}
        )


class ProcessCheckExecutor(BaseCheckExecutor):
    """进程检查执行器"""

    async def check(self, check_item: dict, baseline_data: Optional[dict] = None) -> CheckResult:
        attrs = check_item.get("check_attributes", {}) or {}
        process_name = check_item.get("target_path", "")
        check_type = attrs.get("type", "exists")

        if not process_name:
            return CheckResult(
                status="error",
                message="进程名称未指定"
            )

        if check_type == "exists" or check_type == "running":
            exists = await self.ssh_client.check_process_exists(process_name)
            
            expected_exists = True
            if attrs and "exists" in attrs:
                expected_exists = bool(attrs["exists"])
            elif baseline_data is not None:
                if isinstance(baseline_data, bool):
                     expected_exists = baseline_data
                elif isinstance(baseline_data, str):
                     expected_exists = (baseline_data == "running")
                elif isinstance(baseline_data, dict):
                     expected_exists = bool(baseline_data.get("exists", baseline_data.get("running", True)))

            if exists == expected_exists:
                return CheckResult(
                    status="pass",
                    message=f"进程状态匹配(期望={'运行中' if expected_exists else '未运行'}): {process_name}",
                    expected_value={"running": expected_exists},
                    actual_value={"running": exists}
                )
            return CheckResult(
                status="fail",
                message=f"进程状态不匹配(期望={'运行中' if expected_exists else '未运行'}, 实际={'运行中' if exists else '未运行'}): {process_name}",
                expected_value={"running": expected_exists},
                actual_value={"running": exists}
            )

        if check_type == "count":
            min_count = attrs.get("min_count", 1)
            command = f"pgrep -c -f '{process_name}'"
            exit_code, stdout, stderr = await self.ssh_client.execute(command)
            try:
                count = int(stdout.strip()) if stdout.strip() else 0
                if count >= min_count:
                    return CheckResult(
                        status="pass",
                        message=f"进程数量检查通过: {count} >= {min_count}",
                        expected_value={"min_count": min_count},
                        actual_value={"count": count}
                    )
                return CheckResult(
                    status="fail",
                    message=f"进程数量不足: {count} < {min_count}",
                    expected_value={"min_count": min_count},
                    actual_value={"count": count}
                )
            except ValueError:
                return CheckResult(
                    status="error",
                    message="无法获取进程数量"
                )

        return CheckResult(
            status="error",
            message=f"未知的进程检查类型: {check_type}"
        )


class NetworkCheckExecutor(BaseCheckExecutor):
    """网络检查执行器"""

    async def check(self, check_item: dict, baseline_data: Optional[dict] = None) -> CheckResult:
        attrs = check_item.get("check_attributes", {}) or {}
        target = check_item.get("target_path", "")
        check_type = attrs.get("type", "port_listening")

        if not target:
            return CheckResult(
                status="error",
                message="目标未指定"
            )

        if check_type == "port_listening":
            try:
                port = int(target)
                actual_listening = await self.ssh_client.check_port_listening(port)
                
                expected_listening = True
                if attrs and "listening" in attrs:
                    expected_listening = bool(attrs["listening"])
                elif baseline_data is not None:
                    if isinstance(baseline_data, dict):
                        expected_listening = bool(baseline_data.get("listening", True))
                    else:
                        expected_listening = bool(baseline_data)

                if actual_listening == expected_listening:
                    return CheckResult(
                        status="pass",
                        message=f"监听状态匹配(期望={'监听' if expected_listening else '未监听'}): {port}",
                        expected_value={"listening": expected_listening},
                        actual_value={"listening": actual_listening}
                    )
                return CheckResult(
                    status="fail",
                    message=f"监听状态不匹配(期望={'监听' if expected_listening else '未监听'}, 实际={'监听' if actual_listening else '未监听'}): {port}",
                    expected_value={"listening": expected_listening},
                    actual_value={"listening": actual_listening}
                )
            except ValueError:
                return CheckResult(
                    status="error",
                    message=f"无效的端口号: {target}"
                )

        if check_type == "port_connect":
            parts = target.split(":")
            if len(parts) != 2:
                return CheckResult(
                    status="error",
                    message="端口连接检查格式应为 host:port"
                )
            try:
                host, port_str = parts
                port = int(port_str)
                command = f"nc -zv -w5 {host} {port} 2>&1"
                exit_code, stdout, stderr = await self.ssh_client.execute(command)
                if exit_code == 0:
                    return CheckResult(
                        status="pass",
                        message=f"可以连接到 {host}:{port}",
                        expected_value={"connectable": True},
                        actual_value={"connectable": True}
                    )
                return CheckResult(
                    status="fail",
                    message=f"无法连接到 {host}:{port}",
                    expected_value={"connectable": True},
                    actual_value={"connectable": False}
                )
            except ValueError:
                return CheckResult(
                    status="error",
                    message=f"无效的端口号: {port_str}"
                )

        return CheckResult(
            status="error",
            message=f"未知的网络检查类型: {check_type}"
        )


class ServiceCheckExecutor(BaseCheckExecutor):
    """服务检查执行器"""

    async def check(self, check_item: dict, baseline_data: Optional[dict] = None) -> CheckResult:
        service_name = check_item.get("target_path", "")

        if not service_name:
            return CheckResult(
                status="error",
                message="服务名称未指定"
            )

        status = await self.ssh_client.get_service_status(service_name)
        
        expected_status = "active"
        if attrs and "status" in attrs:
            expected_status = attrs["status"]
        elif baseline_data is not None:
            if isinstance(baseline_data, str):
                expected_status = baseline_data
            elif isinstance(baseline_data, dict):
                expected_status = baseline_data.get("status", "active")
        
        if status == expected_status:
            return CheckResult(
                status="pass",
                message=f"服务状态匹配(期望={expected_status}): {service_name}",
                expected_value=expected_status,
                actual_value=status
            )
        elif status:
            return CheckResult(
                status="fail",
                message=f"服务状态不匹配: 期望 {expected_status}, 实际 {status}",
                expected_value=expected_status,
                actual_value=status
            )
        return CheckResult(
            status="error",
            message=f"服务 {service_name} 不存在或无法获取状态",
            expected_value="active",
            actual_value="unknown"
        )


class LogCheckExecutor(BaseCheckExecutor):
    """日志检查执行器"""

    async def check(self, check_item: dict, baseline_data: Optional[dict] = None) -> CheckResult:
        attrs = check_item.get("check_attributes", {}) or {}
        log_path = check_item.get("target_path", "")
        check_type = attrs.get("type", "pattern")

        if not log_path:
            return CheckResult(
                status="error",
                message="日志路径未指定"
            )

        if check_type == "pattern":
            pattern = attrs.get("pattern", "")
            max_matches = attrs.get("max_matches", 0)
            matches = await self.ssh_client.scan_log_file(log_path, pattern, max_matches + 1)
            count = len(matches)

            if count == 0:
                return CheckResult(
                    status="pass",
                    message=f"未找到匹配模式 '{pattern}' 的日志",
                    expected_value={"max_matches": max_matches},
                    actual_value={"matches": 0}
                )
            if count <= max_matches:
                return CheckResult(
                    status="pass",
                    message=f"找到 {count} 条匹配日志",
                    expected_value={"max_matches": max_matches},
                    actual_value={"matches": count}
                )
            return CheckResult(
                status="fail",
                message=f"找到过多匹配日志: {count} > {max_matches}",
                expected_value={"max_matches": max_matches},
                actual_value={"matches": count}
            )

        if check_type == "error_count":
            threshold = attrs.get("threshold", 0)
            error_pattern = attrs.get("error_pattern", "ERROR|FATAL|CRITICAL")
            matches = await self.ssh_client.scan_log_file(log_path, error_pattern, threshold + 1)
            count = len(matches)

            if count <= threshold:
                return CheckResult(
                    status="pass",
                    message=f"错误数量在允许范围内: {count}",
                    expected_value={"max_errors": threshold},
                    actual_value={"error_count": count}
                )
            return CheckResult(
                status="fail",
                message=f"错误数量超过阈值: {count} > {threshold}",
                expected_value={"max_errors": threshold},
                actual_value={"error_count": count}
            )

        return CheckResult(
            status="error",
            message=f"未知的日志检查类型: {check_type}"
        )


class DiskCheckExecutor(BaseCheckExecutor):
    """磁盘使用检查执行器"""

    async def check(self, check_item: dict, baseline_data: Optional[dict] = None) -> CheckResult:
        attrs = check_item.get("check_attributes", {}) or {}
        path = check_item.get("target_path", "/")
        max_percent = attrs.get("max_percent", "90%")

        disk_info = await self.ssh_client.get_disk_usage(path)
        if not disk_info:
            return CheckResult(
                status="error",
                message=f"无法获取磁盘使用情况: {path}"
            )

        actual_percent = disk_info.get("use_percent", "0%").rstrip("%")
        try:
            actual_int = int(actual_percent)
            max_int = int(max_percent.rstrip("%"))

            if actual_int <= max_int:
                return CheckResult(
                    status="pass",
                    message=f"磁盘使用率检查通过: {actual_percent}",
                    expected_value={"max_percent": max_percent},
                    actual_value={"percent": f"{actual_percent}%"}
                )
            if actual_int <= max_int + 10:
                return CheckResult(
                    status="fail",
                    message=f"磁盘使用率较高: {actual_percent}",
                    expected_value={"max_percent": max_percent},
                    actual_value={"percent": f"{actual_percent}%"}
                )
            return CheckResult(
                status="fail",
                message=f"磁盘使用率超过限制: {actual_percent}",
                expected_value={"max_percent": max_percent},
                actual_value={"percent": f"{actual_percent}%"}
            )
        except ValueError:
            return CheckResult(
                status="error",
                message=f"无效的磁盘使用率: {actual_percent}"
            )


# 检查类型到执行器的映射
EXECUTOR_MAP = {
    # 文件系统检查
    "file": FileSystemCheckExecutor,
    "filesystem": FileSystemCheckExecutor,
    "file_exists": FileSystemCheckExecutor,
    "file_permissions": FileSystemCheckExecutor,
    "file_owner": FileSystemCheckExecutor,
    "file_group": FileSystemCheckExecutor,
    "file_size": FileSystemCheckExecutor,
    "file_mtime": FileSystemCheckExecutor,
    "file_md5": FileSystemCheckExecutor,
    "exists": FileSystemCheckExecutor,
    "permissions": FileSystemCheckExecutor,
    "owner": FileSystemCheckExecutor,
    "group": FileSystemCheckExecutor,
    "size": FileSystemCheckExecutor,
    "mtime": FileSystemCheckExecutor,
    "md5": FileSystemCheckExecutor,
    "disk_usage": DiskCheckExecutor,
    # 文件内容
    "file_content": FileContentCheckExecutor,
    "content": FileContentCheckExecutor,
    # 进程
    "process": ProcessCheckExecutor,
    # 网络
    "network": NetworkCheckExecutor,
    "port": NetworkCheckExecutor,
    "port_listening": NetworkCheckExecutor,
    # 服务
    "service": ServiceCheckExecutor,
    # 日志
    "log": LogCheckExecutor,
    # 内核参数
    "kernel": KernelCheckExecutor,
    "kernel_param": KernelCheckExecutor,
    # 路由
    "route": RouteCheckExecutor,
    "route_table": RouteCheckExecutor,
    "routes": RouteCheckExecutor,
}


def get_executor(check_type: str, ssh_client: SSHClientWrapper) -> BaseCheckExecutor:
    """获取检查执行器"""
    if isinstance(check_type, list):
        check_type = check_type[0] if check_type else "file"

    executor_class = EXECUTOR_MAP.get(check_type.lower())
    if not executor_class:
        raise ValueError(f"未知的检查类型: {check_type}")
    return executor_class(ssh_client)


async def execute_check(
    ssh_client: SSHClientWrapper,
    check_item: dict,
    baseline_data: Optional[dict] = None,
) -> CheckResult:
    """
    执行单个检查项

    Args:
        ssh_client: SSH 客户端
        check_item: 检查项数据
        baseline_data: 基准快照数据

    Returns:
        CheckResult: 检查结果
    """
    check_types = check_item.get("type", [])

    # 确保 check_types 是列表
    if not isinstance(check_types, list):
        check_types = [check_types]

    # 如果没有指定类型，默认为文件检查
    if not check_types or check_types == [None]:
        check_types = ["file"]

    results = []
    for check_type in check_types:
        try:
            executor = get_executor(check_type, ssh_client)
            result = await executor.check(check_item, baseline_data)
            results.append(result)
        except Exception as e:
            results.append(CheckResult(
                status="error",
                message=f"检查执行失败: {str(e)}"
            ))

    # 汇总结果：任一失败则整体失败，任一错误则整体错误
    for result in results:
        if result.status == "error":
            return result
    for result in results:
        if result.status == "fail":
            return result
    return results[0] if results else CheckResult(
        status="pass",
        message="检查完成"
    )
