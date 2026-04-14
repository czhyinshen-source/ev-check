# 大文件比对与存储 (Large File Diff Storage) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 剥离大于 1MB 的 `file_content`，不再通过 MySQL 直接保存长文本，而是采用宿主机 SFTP 落盘 + 操作系统级别 `diff -u` 动态对比出结果。

**Architecture:** 
1. 在 `app/utils/ssh_client.py` 提供封装好的 `download_file` 与检查大小函数。
2. 在快照采集 `app/services/snapshot_build_service.py` 识别超大特征，并下载归档。
3. 在调度器 `app/services/check_executor.py` 触发检查时下载当前副本并调用内建的 `diff -u` 获取截断结果存入 MySQL JSON 当中。

**Tech Stack:** Python 3.11, asyncssh, subprocess

---

### Task 1: 扩展 SSH Client 工具支持大小获取与 SFTP

**Files:**
- Modify: `app/utils/ssh_client.py:L1-L200` （待确认具体行号）

- [ ] **Step 1: 增加获取文件大小 `get_file_size` 方法**
```python
async def get_file_size(self, file_path: str) -> int:
    """获取远程文件大小，使用 stat 命令"""
    exit_code, stdout, stderr = await self.execute(f"stat -c %s '{file_path}'")
    if exit_code == 0 and stdout.strip().isdigit():
        return int(stdout.strip())
    return -1
```

- [ ] **Step 2: 增加 SFTP 下载 `download_file` 方法**
```python
async def download_file(self, remote_path: str, local_path: str) -> bool:
    """使用 asyncssh SFTP 通道下载文件"""
    import asyncssh
    import os
    try:
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        async with self._conn.start_sftp_client() as sftp:
            await sftp.get(remote_path, local_path)
        return True
    except Exception as e:
        self.last_error = f"SFTP 下载失败: {str(e)}"
        return False
```

- [ ] **Step 3: Commit**
```bash
git add app/utils/ssh_client.py
git commit -m "feat(ssh): support fetching file size and sftp download"
```

---

### Task 2: 优化快照采集的物理拦截逻辑

**Files:**
- Modify: `app/services/snapshot_build_service.py:L215-L240`

- [ ] **Step 1: 更新文件检查时的调用判断逻辑**
针对 `file_content`，提前判断并走专门的下载落盘。需要建立存放基准快照的目录架构。

```python
import os
import hashlib

# 增加特殊判断 (大概在 `execute_check` 调用前或替换 FileContentCheckExecutor)
```
*注：为了架构解耦，我们最好将“大文件判断”逻辑直接写进 `FileContentCheckExecutor`，由它在 `compare_mode="full" or "snapshot"` 决定是返回值还是返回引用路径，从而不必干涉 `execute_check` 通用接口的轮廓！这意味着 Task 2 应该被合并到 Task 3。*

---

### Task 3: 改造 FileContentCheckExecutor (处理大文件存盘)

**Files:**
- Modify: `app/services/check_executor.py`

- [ ] **Step 1: 判断与落盘处理**
```python
import os
import subprocess
import uuid

# 在 check() 中开始处理
FILE_SIZE_LIMIT = 1024 * 1024  # 1MB 软上限

class FileContentCheckExecutor(BaseCheckExecutor):
    ...
```

- [ ] **Step 2: 改写 `check` 方法以识别大文件与 `diff -u` 命令流**
```python
# 判断大文件
file_size = await self.ssh_client.get_file_size(file_path)
if file_size > FILE_SIZE_LIMIT:
    local_hash_name = f"{uuid.uuid4().hex}.file"
    local_dir = "/tmp/ev_check_runs"
    local_dest = os.path.join(local_dir, local_hash_name)
    await self.ssh_client.download_file(file_path, local_dest)
    
    # 构建当前实际值
    actual_payload = {
        "_is_large_file": True,
        "path": local_dest,
        "size": file_size
    }
    
    # 接着如果 baseline_data 也是大型文件，采用 subprocess 
    if baseline_data and baseline_data.get("_is_large_file"):
        expected_path = baseline_data.get("path")
        # diff -u expected_path local_dest
        try:
            diff_proc = subprocess.run(
                ["diff", "-u", expected_path, local_dest], 
                capture_output=True, text=True
            )
            # 截取前 10000 行
            diff_lines = diff_proc.stdout.splitlines()
            if len(diff_lines) > 5000:
                diff_output = "\n".join(diff_lines[:5000]) + "\n... [差异行数过多，安全截取前 5000 行展示] ..."
            else:
                diff_output = diff_proc.stdout
                
            if diff_proc.returncode == 0:
                pass_status = "pass"
            else:
                pass_status = "fail"
                
            return CheckResult(
                status=pass_status,
                message="大文件比对完成",
                expected_value=baseline_data,
                actual_value={**actual_payload, "diff_record": diff_output}
            )
        except Exception as e:
            return CheckResult(status="error", message=f"大文件差异生成失败: {e}")
```

- [ ] **Step 3: Commit**
```bash
git add app/services/check_executor.py
git commit -m "feat(execution): implement large file offloading and diff streaming"
```

---

### Task 4: 前端兼容 `_is_large_file` 与差异直出渲染

**Files:**
- Modify: `app/static/js/reports.js`

- [ ] **Step 1: 在 `reports.js` 的 `isCommFail` 分支里判断 `diff_record`**
```javascript
let diffHtmlContent = "";
if (avObj && avObj._is_large_file && avObj.diff_record) {
    // 后端已经帮我们算好了 Diff 文本，直接套壳展示！
    diffHtmlContent = `<div style="font-family: monospace; font-size: 13px; line-height: 1.5; background: #0f172a; padding: 10px; border-radius: 6px; overflow-x: auto; white-space: pre; color: #cbd5e1;">` 
                      + escapeHtml(avObj.diff_record) 
                      + `</div>`;
} else {
    diffHtmlContent = generateUnifiedDiff(evStr, avStr, 5);
}
```

- [ ] **Step 2: Commit**
```bash
git add app/static/js/reports.js
git commit -m "feat(ui): support native streaming backend diff viewer"
```
