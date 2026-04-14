# 大文件比对与存储的架构设计方案

## 1. 业务背景
在现有的 `ev_check` 系统中，针对配置、日志等“文件内容”的采集核对，我们使用了将文本全量保存于 MySQL `JSON` 字段的策略。
该机制目前受限于数据库性能与传输设计，仅适合处理 **< 1MB** 的极轻量文本（如 `README.md`、小配置）。若检查目标为 **10MB - 100MB** 的较大型服务日志与配置文件：
- 强行存入 DB 将触发 `Packet too large` 而造成执行或快照挂载失败。
- 前端在尝试单行渲染百兆字符串时往往直接内存溢出。
本方案旨在彻底剥离并解耦这类文件的下行存储与 Diff 运算链路。

## 2. 混合存储架构 (Storage Routing)
引入针对文件容量探测的 **智能边界下放（SFTP Fallback）** 策略：

1. **阈值界定**：设定文件内容软采集上限为 **1MB** (`1024 * 1024 bytes`)。
2. **容量预探测**：执行器调用 `ls -l` / `stat` 检测目标下发的文件体积。
3. **轻量级小文件**：< 1MB，一切照旧，直接被 `cat` 拉为内存数据变量后通过 JSON 塞入 MySQL 库。
4. **重量级大文件**：> 1MB，开启 SFTP 通道直接将其传输至物理宿主机的缓存持久化目录：
   - 快照基准归档：`/app/data/snapshots/{snapshot_id}/{node_id}_{md5}.file`
   - MySQL 内录入的不再是本体文本，而变成一个引用包装结构：
     ```json
     {
        "_is_large_file": true,
        "path": "/app/data/snapshots/...",
        "size": 52428800
     }
     ```

## 3. 执行层及流式比对机制 (Native Diff Execution)
为了避免大文件直接在 Python 执行上下文中吃爆内存引发 OOM，执行侧必须完全剔除字符串比较 `actual_content == expected_content` 这种危险写法。

1. **大文件下载流程**：手动触发或定时任务触发执行检查大文件时，再次利用 SFTP 将新版本的 Remote 文件下载至本地独立区，如：`/tmp/ev_check_runs/{run_id}/{node_id}_actual.file`。
2. **底层原生 Diff 代理运算**：在服务端获取好两条大文件路径后，无需引入复杂的 Python `difflib` 流处理或库依赖：
   - 采用标准 `subprocess` 触发宿主机系统自带 Diff 工具：`diff -u [基准文件绝对路径] [本次执行的最新文件路径]`
3. **安全截断输出**：如果一个 100MB 文件面貌全非被清空，那生成的统一行级别差异日志也会暴增。为此我们需要利用 `diff` 的标准输出管道并在 Python 中增加拦截器：
   - 设置最大收集上限，如 **最大 10000 行 Diff 数据** 或者 **3MB**。
   - 超出部分予以抛弃并在末尾强制标记 `... [差异日志数据量过于庞大，已被安全折叠截断] ...`。
4. **差异回填数据库**：这串安全摘取的高密度红绿差异被存放到 MySQL 当前任务详情单对应的 `actual_value/diff_record` 中，供 前端直接采用类似 `generateUnifiedDiff` 的原生高亮显示组件套壳渲染。

## 4. 后期清理 (GC/Lifecycle)
为避免日久天黑，落盘数据占满磁盘：
配置并向 Celery 中增加类似 `cleanup_orphaned_snapshots_data` 或 `clear_temp_run_files` 的轻量级周期任务，删除游离的大文件残骸，从而收束存储空间。
