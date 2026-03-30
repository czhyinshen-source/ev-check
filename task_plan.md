# 任务计划：通信机连接测试修复

## 任务目标
修复通信机"测试连接"功能，解决连接失败问题。

## 问题分析
- 点击"测试"按钮时返回 `{"detail":"未找到"}`
- 后端缺少 `/api/v1/communications/{id}/status` API 端点
- 数据库缺少 `auth_method` 字段

## 修复步骤

### 阶段 1：后端 API 实现
- [x] 添加 `GET /api/v1/communications/{id}/status` 端点
- [x] 在数据库添加 `auth_method` 字段
- [x] 更新 Communication 模型
- [x] 执行数据库迁移脚本

### 阶段 2：前端代码修复
- [x] 修复 `editComm` 函数从 API 获取完整信息
- [x] 统一认证方式值（password/private_key）
- [x] 更新表单提交逻辑
- [x] 添加测试页面路由

### 阶段 3：验证测试
- [ ] 强制刷新浏览器 (Ctrl+Shift+F5)
- [ ] 运行诊断脚本
- [ ] 测试通信机连接功能
- [ ] 验证编辑功能正常

## 修改的文件
- `app/api/communications.py` - 添加 /status 端点
- `app/models/communication.py` - 添加 auth_method 字段
- `app/database.py` - 数据库迁移
- `app/static/js/communications.js` - 修复 editComm
- `app/static/js/dashboard.js` - 修复表单提交
- `app/static/dashboard.html` - 更新认证选项
- `app/main.py` - 添加测试页面路由

## 测试地址
- 诊断页面: http://localhost:8000/test_comm_connection.html
- Dashboard: http://localhost:8000/dashboard.html

## 状态
**进行中** - 等待用户测试验证

---

## 附加任务：快照构建对话框排版优化

### 问题
- 快照构建对话框中选择通信机区域的排版不够清晰
- 需要更好的视觉层次和用户体验

### 优化步骤
- [x] 扩大对话框宽度和高度
- [x] 优化 CSS 样式（渐变、动画、悬停效果）
- [x] 改进信息显示（数量、格式、emoji）
- [x] 更新 JS 版本号

### 修改的文件
- `app/static/dashboard.html` - 优化对话框布局
- `app/static/css/style.css` - 增强样式
- `app/static/js/snapshots.js` - 改进信息显示

### 状态
**已完成** - 等待用户查看效果

---

## 附加任务：快照分组模态框修复

### 问题
- 点击快照分组的"分组"按钮时报错
- `Cannot set properties of null (setting 'value')`

### 修复步骤
- [x] 在 dashboard.html 中添加快照分组模态框
- [x] 在 dashboard.js 中添加快照分组表单处理
- [x] 添加快照表单处理
- [x] 更新 JS 版本号

### 修改的文件
- `app/static/dashboard.html` - 添加模态框
- `app/static/js/dashboard.js` - 添加表单处理

### 状态
**已完成** - 等待用户测试验证

---

## 附加任务：快照构建问题全面修复

### 问题列表
1. 删除快照组：500 错误
2. 构建快照：500 错误
3. 构建快照实际成功但提示失败

### 根本原因
- **SQLAlchemy 关系访问**：在异步会话中访问关系属性没有预加载
- **延迟加载问题**：访问 `task.snapshot.name`、`group.children` 等触发延迟加载导致错误
- **Redis 依赖**：Celery 和 Redis 未启动不影响核心功能，但需要容错处理

### 修复步骤
- [x] 删除快照组 API 添加 selectinload 预加载
- [x] 构建快照服务添加 selectinload 预加载
- [x] 修复 API 返回时的延迟加载问题
- [x] 添加 Redis 和 Celery 容错处理
- [x] 重启后端服务

### 修改的文件
- `app/api/snapshots.py` - 添加关系预加载和容错
- `app/services/snapshot_build_service.py` - 添加关系预加载和容错

### 状态
**已完成** - 后端已重启，可以测试

---

## 附加任务：快照组未加载修复

### 问题
- 点击导航栏"快照管理"时，快照组管理区域为空
- 快照组列表没有加载出来

### 修复步骤
- [x] 在 `refreshData()` 中添加 `loadSnapshotGroups()` 调用
- [x] 更新 JS 版本号

### 修改的文件
- `app/static/js/dashboard.js` - 添加快照组加载调用

### 状态
**已完成** - 等待用户测试验证

---

## 附加任务：检查项管理修复

### 问题
- 新建/克隆/编辑检查项时表单没有提交事件处理

### 修复步骤
- [x] 添加检查项列表表单处理
- [x] 添加检查项表单处理
- [x] 添加检查项列表选择器
- [x] 修改编辑和克隆函数加载列表

### 修改的文件
- `app/static/js/dashboard.js` - 表单事件绑定
- `app/static/js/checkitems.js` - 列表选择器加载
- `app/static/dashboard.html` - 添加列表选择器元素
