# 进度记录

## 2026-03-26

### 当前会话完成的工作

#### 1. 添加 /status API 端点
- 文件: `app/api/communications.py`
- 添加了 `GET /api/v1/communications/{id}/status` 端点
- 支持密码认证和 SSH 密钥认证
- 从 SSHKey 表获取私钥内容

#### 2. 数据库迁移
- 文件: `add_auth_method_column.py`
- 在 `communications` 表添加 `auth_method` 字段
- 迁移执行成功 ✅
- 模型已更新: `app/models/communication.py`

#### 3. 前端修复
- `communications.js`: 重写 `editComm` 函数
  - 改为异步函数
  - 从 API 获取完整通信机信息
  - 正确设置 auth_method 和 SSH 密钥
- `dashboard.js`: 修复 authMethod 字段名 (commAuthType)
- `dashboard.html`: 更新选项值 (key → private_key)

#### 4. 测试页面
- 创建: `app/static/test_comm_connection.html`
- 添加路由: `/test_comm_connection.html`

### 遇到的错误
无

### 待验证
- [ ] 诊断脚本运行结果
- [ ] 通信机测试连接功能
- [ ] 编辑通信机功能

## 2026-03-26 (下午)

### 快照构建对话框排版优化

#### 问题
- 快照构建对话框中选择通信机区域的排版不够清晰
- 需要更好的视觉层次和用��体验

#### 优化内容（第一版）
1. **dashboard.html** - 扩大对话框宽度
   - 将 `max-width` 从 700px 增加到 900px
   - 增加通信机组树的高度从 300px 到 400px
   - 添加提示文字说明操作方式
   - 优化选中计数显示样式（添加蓝色边框和背景）

2. **style.css** - 增强视觉效果
   - 添加渐变背景和过渡动画
   - 优化悬停效果
   - 改进内边距和间距
   - 添加圆角和阴影效果
   - 增强检查项列表选择器的样式

3. **snapshots.js** - 改进信息显示
   - 在组名后显示通信机数量
   - 通信机显示格式：`名称 (IP:端口)`
   - 优化空状态提示（使用 emoji）
   - 检查项列表标签前添加 📋 emoji

4. **版本更新**
   - 更新 JS 版本号到 v=11

#### 优化内容（第二版 - 左对齐）
1. **style.css** - 优化勾选框和对齐
   - 固定勾选框尺寸为 16x16px
   - 添加 `flex-shrink: 0` 防止勾选框被压缩
   - 减小 gap 从 10px 到 8px
   - 确保所有文本左对齐
   - 调整左侧内边距从 40px 到 44px

2. **版本更新**
   - 更新 JS 版本号到 v=12

## 2026-03-27

### 快照组未加载问题修复

#### 问题
- 点击导航栏"快照管理"时，快照组管理区域为空
- 快照组列表没有加载出来

#### 根本原因
- `refreshData()` 函数中缺少 `loadSnapshotGroups()` 调用
- 只调用了 `loadSnapshots()` 而没有加载快照组

#### 修复内容
1. **dashboard.js** - 添加快照组加载
   - 在 `refreshData()` 函数中添加 `loadSnapshotGroups()` 调用
   - 确保在加载快照之前先加载快照组

2. **版本更新**
   - 更新 JS 版本号到 v=13

#### 修改的文件
- `app/static/js/dashboard.js` - 添加快照组加载调用
- `app/static/dashboard.html` - 优化对话框布局
- `app/static/css/style.css` - 增强样式 + 左对齐优化
- `app/static/js/snapshots.js` - 改进信息显示

#### 问题
- 快照构建对话框中选择通信机区域的排版不够清晰
- 需要更好的视觉层次和用户体验

#### 优化内容
1. **dashboard.html** - 扩大对话框宽度
   - 将 `max-width` 从 700px 增加到 900px
   - 增加通信机组树的高度从 300px 到 400px
   - 添加提示文字说明操作方式
   - 优化选中计数显示样式（添加蓝色边框和背景）

2. **style.css** - 增强视觉效果
   - 添加渐变背景和过渡动画
   - 优化悬停效果
   - 改进内边距和间距
   - 添加圆角和阴影效果
   - 增强检查项列表选择器的样式

3. **snapshots.js** - 改进信息显示
   - 在组名后显示通信机数量
   - 通信机显示格式：`名称 (IP:端口)`
   - 优化空状态提示（使用 emoji）
   - 检查项列表标签前添加 📋 emoji

4. **版本更新**
   - 更新 JS 版本号到 v=11

#### 修改的文件
- `app/static/dashboard.html` - 优化对话框布局
- `app/static/css/style.css` - 增强样式
- `app/static/js/snapshots.js` - 改进信息显示

### 快照分组模态框缺失修复

#### 问题
- 点击快照分组的"分组"按钮时报错
- 错误: `Cannot set properties of null (setting 'value')`
- snapshots.js:6 行尝试访问不存在的 DOM 元素

#### 根本原因
- dashboard.html 中缺少 `snapshotGroupModal` 模态框
- 缺少必需的表单元素：
  - `snapshotGroupId`
  - `snapshotGroupName`
  - `snapshotGroupParent`
  - `snapshotGroupCheckItemList`
  - `snapshotGroupDesc`

#### 修复内容
1. **dashboard.html** - 添加快照分组模态框
   - 在快照弹窗前添加 `snapshotGroupModal`
   - 包含所有必需的表单元素
   - 使用与通信机分组相同的结构

2. **dashboard.js** - 添加表单处理
   - 添加 `snapshotGroupForm` 提交事件处理
   - 添加 `snapshotForm` 提交事件处理
   - 处理快照组的创建和编辑

3. **版本更新**
   - 更新 JS 版本号到 v=10

#### 修改的文件
- `app/static/dashboard.html` - 添加快照分组模态框
- `app/static/js/dashboard.js` - 添加表单事件处理

### 检查项管理修复

#### 问题
- 新建/克隆/编辑检查项时表单没有提交事件处理

#### 修复内容
1. **dashboard.js** - 添加表单处理
   - 添加 `checkItemListForm` 提交事件处理
   - 添加 `checkItemForm` 提交事件处理
   - 处理文件/目录检查、内容检查、路由表检查三种类型

2. **checkitems.js** - 增强功能
   - 添加 `loadCheckItemListSelect()` 函数加载列表选项
   - 修改 `openCheckItemModal()` 调用列表加载
   - 修改 `editCheckItem()` 调用列表加载并设置选中项
   - 修改 `cloneCheckItem()` 调用列表加载并设置选中项

3. **dashboard.html** - 添加列表选择器
   - 在检查项表单中添加 `checkItemListSelect` 下拉框

#### 修改的文件
- `app/static/js/dashboard.js`
- `app/static/js/checkitems.js`
- `app/static/dashboard.html`

### 修复：type 字段 JSON 解析错误

#### 问题
- 编辑/克隆检查项时，`item.type` 可能是 JSON 字符串格式
- 直接使用 `querySelector` 时会出错

#### 修复内容
1. 添加 `parseItemType()` 函数统一解析 type 字段
2. 修改 `loadCheckItems()` 显示类型时使用解析函数
3. 修改 `editCheckItem()` 编辑时使用解析函数
4. 修改 `cloneCheckItem()` 克隆时使用解析函数

## 之前的会话 (2026-03-25)

### 完成的功能
- 前端模块化重构（shared.js, communications.js, checkitems.js, snapshots.js, checks.js）
- DOM 空值检查和 safeGet/safeVal 工具函数
- 通信机测试连接 API 端点
- 检查项列表和检查项的增删改查
- 深交所风格 UI 组件

## 2026-03-27

### 快照功能多项问题修复

#### 问题1：构建快照报错
- 错误: `Unexpected token 'I', "Internal S"... is not valid JSON`
- 错误: `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`

#### 问题2：功能重复
- "创建快照"和"构建快照"是重复功能
- 应该只保留"构建快照"

#### 问题3：快照组无法删除
- 提示成功但实际不删除

#### 修复内容

**1. snapshots.js - 修复构建快照**
- 修正 `getHeaders()` 为 `window.shared.getHeaders()`
- 增强错误处理，支持非 JSON 错误响应
- 添加详细的错误日志输出

**2. dashboard.html - 移除重复功能**
- 隐藏"创建快照"按钮
- 只保留"构建快照"按钮（重命名为"+ 构建快照"）

**3. snapshots.js - 修复快照组删除**
- 添加响应状态检查
- 针对 404、400 状态码提供具体错误提示
- 成功删除后显示确认消息

**4. 版本更新**
- 更新 JS 版本号到 v=14

#### 修改的文件
- `app/static/js/snapshots.js` - 修复构建和删除功能
- `app/static/dashboard.html` - 移除重复按钮

#### 说明
**创建快照 vs 构建快照的区别：**
- **创建快照**：手动创建空快照记录，需要手动填写信息
- **构建快照**：自动化流程，连接到通信机采集环境数据并生成快照

**推荐使用"构建快照"**，因为它是自动化的完整流程。

### 快照组未加载问题修复

#### 问题
- 点击导航栏"快照管理"时，快照组管理区域为空
- 快照组列表没有加载出来

#### 根本原因
- `refreshData()` 函数中缺少 `loadSnapshotGroups()` 调用
- 只调用了 `loadSnapshots()` 而没有加载快照组

#### 修复内容
1. **dashboard.js** - 添加快照组加载
   - 在 `refreshData()` 函数中添加 `loadSnapshotGroups()` 调用
   - 确保在加载快照之前先加载快照组

2. **版本更新**
   - 更新 JS 版本号到 v=13

#### 修改的文件
- `app/static/js/dashboard.js` - 添加快照组加载调用


### 快照后端 500 错误修复

#### 问题
- 删除快照组：500 错误
- 构建快照：500 错误

#### 根本原因
- SQLAlchemy 关系访问没有预加载
- 访问 `group.children`、`group.snapshots` 时触发延迟加载
- 访问 `comm.group.name` 时没有预加载 `group` 关系

#### 修复内容

**1. app/api/snapshots.py - 修复删除快照组**
- 在查询时使用 `selectinload` 预加载关系
- 预加载 `children` 和 `snapshots` 关系

**2. app/services/snapshot_build_service.py - 修复构建快照**
- 导入 `selectinload`
- 在 `_get_group_communications` 中预加载 `Communication.group` 关系

#### 修改的文件
- `app/api/snapshots.py` - 添加关系预加载
- `app/services/snapshot_build_service.py` - 添加关系预加载

#### 说明
**需要重启后端服务**以加载修复后的代码！


### 构建快照实际成功但提示失败问题修复

#### 问题
- 构建快照时提示 "Internal Server Error"
- 实际上刷新后发现快照记录已经创建成功
- 说明后端创建成功但返回时出错

#### 根本原因
- API 返回时访问 `task.snapshot.name` 触发延迟加载
- 进度追踪器初始化时 Redis 连接失败可能导致异常

#### 修复内容

**1. app/api/snapshots.py - 修复构建启动 API**
- 单独查询 Snapshot 获取名称，避免延迟加载
- 捕获 Celery 调度失败，不影响快照创建
- 添加全局异常处理和详细日志

**2. app/services/snapshot_build_service.py - 容错处理**
- 进度追踪器初始化失败不影响快照创建
- 添加 try-except 捕获 Redis 连接异常

#### 修改的文件
- `app/api/snapshots.py` - 修复返回时的延迟加载
- `app/services/snapshot_build_service.py` - 添加容错处理

#### 说明
**需要重启后端服务**以加载修复后的代码！

---

## 2026-03-27 (下午)

### 快照构建5个问题全面修复

#### 问题1：构建窗口关闭慢
- **根本原因**：Redis 连接没有超时设置，连接失败时阻塞
- **修复**：在 `snapshot_progress.py` 中添加 3 秒连接超时和操作超时
- **文件**：`app/services/snapshot_progress.py`

#### 问题2：进度条不动
- **根本原因**：Redis 不可用时 `get_progress()` 返回 None，没有回退到数据库
- **修复**：在 API 端添加数据库回退逻辑，当 Redis 不可用时从数据库计算进度
- **文件**：`app/api/snapshots.py`

#### 问题3：操作卡顿
- **根本原因**：轮询间隔 2 秒 + Redis 无超时可能导致长时间阻塞
- **修复**：结合问题1的 Redis 超时设置，已缓解

#### 问题4：无法查看快照详情
- **新增功能**：
  - 添加 `GET /api/v1/snapshots/instances` API
  - 添加快照详情模态框
  - 添加 `viewSnapshotDetail()` 和 `loadInstanceData()` 函数
  - 添加相关 CSS 样式
- **文件**：`app/api/snapshots.py`、`app/static/dashboard.html`、`app/static/js/snapshots.js`、`app/static/css/style.css`

#### 问题5：快照组列显示数字
- **根本原因**：`loadSnapshots()` 没有解析组名
- **修复**：同时获取快照列表和快照组列表，构建映射后渲染
- **文件**：`app/static/js/snapshots.js`

#### 修改的文件汇总
- `app/services/snapshot_progress.py` - Redis 超时设置
- `app/api/snapshots.py` - 进度回退 + 实例列表 API
- `app/static/js/snapshots.js` - 组名解析 + 详情查看
- `app/static/dashboard.html` - 详情模态框 + 版本更新
- `app/static/css/style.css` - 详情样式

#### 状态
**已完成** - 需要重启后端服务

## 2026-03-27 (晚)

### 移除构建进度弹窗，改为表格内状态列

#### 问题
- 构建快照后弹出单独的进度窗口，体验不够简洁
- 用户需要在弹窗和表格之间切换查看

#### 修复内容

1. **后端 - app/api/snapshots.py**
   - 修改 `GET /api/v1/snapshots` 返回数据，附加 `build_status` 字段
   - 新增 `GET /api/v1/snapshots/build/tasks/active` API，返回所有活跃构建任务
   - 快照列表 API 同时查询活跃任务，自动匹配快照的构建状态

2. **前端 - snapshots.js**
   - 移除 `snapshotBuildProgressModal` 弹窗相关代码
   - 移除 `showBuildProgress`, `pollBuildProgress`, `closeBuildProgressModal` 等函数
   - 重构 `startSnapshotBuild()`：关闭对话框后插入临时行 + 启动轮询
   - `loadSnapshots()` 添加"状态"列（第6列），显示构建状态
   - 新增轮询函数：`startBuildPolling()`, `stopBuildPolling()`, `pollActiveBuildTasks()`
   - 新增行更新函数：`updateSnapshotBuildStatus()`, `insertBuildingRow()`, `removeBuildingRow()`
   - 状态类型：⏳ 等待启动、🌀 进度%、✓ 已完成、✗ 构建异常、- 已取消

3. **前端 - dashboard.html**
   - 移除 `snapshotBuildProgressModal` 弹窗 HTML
   - 快照表格添加"状态"列标题
   - 版本更新 v=17

4. **CSS - style.css**
   - 添加 `.build-spinner` 转圈动画样式

#### 修改的文件
- `app/api/snapshots.py` - API 返回构建状态
- `app/static/js/snapshots.js` - 重构为表格内状态
- `app/static/dashboard.html` - 移除弹窗，添加列标题
- `app/static/css/style.css` - 添加转圈动画

#### 说明
**需要重启后端服务**以加载新的 API 端点。



