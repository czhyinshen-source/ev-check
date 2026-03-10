# 任务列表

## 阶段一：基础架构

- [x] Task 1.1: 项目初始化：创建 FastAPI 项目结构，配置依赖
  - [x] SubTask 1.1.1: 创建项目目录结构
  - [x] SubTask 1.1.2: 创建 requirements.txt 和依赖配置
  - [x] SubTask 1.1.3: 配置日志和异常处理

- [x] Task 1.2: 数据库模型实现：创建所有数据库模型和表结构
  - [x] SubTask 1.2.1: 创建通信机相关模型（分组、通信机）
  - [x] SubTask 1.2.2: 创建检查项相关模型（检查项、检查项列表）
  - [x] SubTask 1.2.3: 创建快照相关模型（快照组、快照、快照实例、环境数据）
  - [x] SubTask 1.2.4: 创建检查规则和结果模型
  - [x] SubTask 1.2.5: 创建用户和定时任务模型

- [x] Task 1.3: 基础 API 框架搭建：创建 API 路由和依赖
  - [x] SubTask 1.3.1: 创建 FastAPI 应用入口
  - [x] SubTask 1.3.2: 创建数据库连接和会话管理
  - [x] SubTask 1.3.3: 创建 Pydantic 模式定义

- [x] Task 1.4: 用户认证系统：实现 JWT 认证和 RBAC
  - [x] SubTask 1.4.1: 创建用户模型和密码哈希
  - [x] SubTask 1.4.2: 实现登录和 Token 生成
  - [x] SubTask 1.4.3: 实现权限验证中间件

- [x] Task 1.5: 前端界面：实现登录页面和控制台
  - [x] SubTask 1.5.1: 创建登录页面 login.html
  - [x] SubTask 1.5.2: 创建控制台页面 dashboard.html
  - [x] SubTask 1.5.3: 配置静态文件路由和页面跳转
  - [x] SubTask 1.5.4: 实现退出登录功能，退出后回到登录页面
  - [x] SubTask 1.5.5: 实现注册功能，支持输入用户名（唯一）、密码、确认密码
  - [x] SubTask 1.5.6: 实现忘记密码功能，点击后弹出提示对话框
  - [x] SubTask 1.5.7: 实现修改密码功能，支持输入用户名（唯一）、旧密码、新密码、确认密码

## 阶段二：核心功能

- [x] Task 2.1: 检查项管理：实现检查项的 CRUD 操作
  - [x] SubTask 2.1.1: 实现检查项 API（创建、查询、更新、删除）
  - [x] SubTask 2.1.2: 实现检查项列表 API
  - [x] SubTask 2.1.3: 实现检查项与列表的关联管理
  - [x] Task 2.1.4: 检查项列表复制功能
  - [x] SubTask 2.1.4: 实现检查项列表复制功能 (FUN-002-005)

- [x] Task 2.2: 快照管理：实现快照的创建和管理
  - [x] SubTask 2.2.1: 实现快照组 API
  - [x] SubTask 2.2.2: 实现快照 API
  - [x] Task 2.2.3: 快照构建功能
  - [x] SubTask 2.2.3: 实现快照构建功能（通过 SSH 收集数据）

- [x] Task 2.3: SSH 客户端实现：实现远程连接和数据收集
  - [x] SubTask 2.3.1: 实现基础 SSH 连接管理
  - [x] SubTask 2.3.2: 实现命令执行功能
  - [x] SubTask 2.3.3: 实现文件传输功能

- [x] Task 2.4: 检查引擎开发：实现环境检查核心逻辑
  - [x] SubTask 2.4.1: 实现检查项执行器基类
  - [x] SubTask 2.4.2: 实现文件系统检查执行器
  - [x] SubTask 2.4.3: 实现进程和服务检查执行器
  - [x] SubTask 2.4.4: 实现网络和端口检查执行器
  - [x] SubTask 2.4.5: 实现日志检查执行器

- [x] Task 2.5: 环境检查 API：实现检查任务的提交和进度查询
  - [x] SubTask 2.5.1: 实现启动检查 API
  - [x] SubTask 2.5.2: 实现检查进度查询 API
  - [x] SubTask 2.5.3: 实现检查结果查询 API

## 阶段三：高级功能

- [x] Task 3.1: 定时任务：实现自动定时检查
  - [x] SubTask 3.1.1: 配置 Celery Beat
  - [x] SubTask 3.1.2: 实现定时任务调度逻辑
  - [x] SubTask 3.1.3: 实现定时任务管理 API

- [x] Task 3.2: 报表生成：实现检查结果的报表展示
  - [x] SubTask 3.2.1: 实现检查结果统计
  - [x] SubTask 3.2.2: 实现报表详情 API
  - [x] SubTask 3.2.3: 实现报表导出功能（PDF/Excel）

- [x] Task 3.3: 配置导入导出：实现系统配置管理
  - [x] SubTask 3.3.1: 实现配置导出 API
  - [x] SubTask 3.3.2: 实现配置导入 API

- [x] Task 3.4: 历史数据管理：实现数据清理策略
  - [x] SubTask 3.4.1: 实现数据保留策略配置
  - [x] SubTask 3.4.2: 实现自动数据清理任务

- [x] Task 3.5: 通信机管理 API：实现通信机的完整管理
  - [x] SubTask 3.5.1: 实现通信机分组管理
  - [x] SubTask 3.5.2: 实现通信机 CRUD API
  - [x] SubTask 3.5.3: 实现 SSH 免密认证配置 API
  - [x] SubTask 3.5.4: 实现测试连接 API
  - [x] SubTask 3.5.5: 实现 SSH 密钥管理 API

- [x] Task 3.6: 检查规则管理：实现检查规则的配置
  - [x] SubTask 3.6.1: 实现检查规则 CRUD API
  - [x] SubTask 3.6.2: 实现检查规则项管理
  - [x] SubTask 3.6.3: 实现检查时间段配置

## 阶段四：前端开发

- [x] Task 4.1: 前端框架搭建：初始化前端项目
  - [x] SubTask 4.1.1: 创建 React/Vue 项目 (使用原生 HTML+JS)
  - [x] SubTask 4.1.2: 配置 UI 样式
  - [x] SubTask 4.1.3: 配置路由和页面跳转
  - [x] SubTask 4.1.4: 实现深交所设计系统 (色彩、字体、间距)

- [x] Task 4.2: 管理界面：实现系统管理功能界面
  - [x] SubTask 4.2.1: 实现登录页面
  - [x] SubTask 4.2.2: 实现仪表盘
  - [x] SubTask 4.2.3: 实现通信机管理界面
  - [x] SubTask 4.2.4: 实现用户管理界面 (通过 API)

- [x] Task 4.3: 检查执行界面：实现快照和检查功能界面
  - [x] SubTask 4.3.1: 实现检查项管理界面
  - [x] SubTask 4.3.2: 实现快照管理界面
  - [x] SubTask 4.3.20: 实现快照管理页面左右布局，左侧为快照组管理，右侧为快照列表
  - [x] SubTask 4.3.21: 实现快照管理页面按快照组筛选功能
  - [x] SubTask 4.3.22: 实现快照管理页面按快照名称搜索功能
  - [x] SubTask 4.3.3: 实现检查执行界面
  - [x] SubTask 4.3.4: 实现检查项菜单页面 (导航栏进入、左右布局)
  - [x] SubTask 4.3.5: 实现检查项列表管理功能 (新建、修改、克隆、删除)
  - [x] SubTask 4.3.6: 实现检查项管理功能 (新增、修改、克隆、删除)
  - [x] SubTask 4.3.7: 实现检查项必须在检查项列表下创建的约束
  - [x] SubTask 4.3.8: 实现全部检查项功能，显示所有检查项列表包含的检查项
  - [x] SubTask 4.3.9: 实现必须选中检查项列表才能新建检查项的逻辑
  - [x] SubTask 4.3.10: 实现检查项表格显示所属检查项列表列
  - [x] SubTask 4.3.11: 实现文件内容检查项配置 (文件类型选择、内核参数比较)
  - [x] SubTask 4.3.12: 实现检查项类型多选功能，支持同时选择多个检查类型
  - [x] SubTask 4.3.13: 实现检查类型比对制定值功能，支持设置具体的比对值和范围

- [x] Task 4.4: 报表展示界面：实现检查结果展示
  - [x] SubTask 4.4.1: 实现检查结果列表
  - [x] SubTask 4.4.2: 实现检查详情展示
  - [x] SubTask 4.4.3: 实现报表导出功能

- [x] Task 4.5: 通信机管理增强界面
  - [x] SubTask 4.5.1: 实现通信机分组树形导航
  - [x] SubTask 4.5.2: 实现添加/编辑通信机对话框
  - [x] SubTask 4.5.3: 实现 SSH 免密认证配置对话框
  - [x] SubTask 4.5.4: 实现测试连接功能
  - [x] SubTask 4.5.5: 实现按名称/IP 搜索功能
  - [x] SubTask 4.5.6: 实现 Excel 导入通信机功能，支持批量添加通信机
  - [x] SubTask 4.5.7: 实现批量部署公钥功能，部署后弹窗提示成功和失败数量
  - [x] SubTask 4.5.8: 实现通信机状态显示，根据测试连接结果判断状态
  - [x] SubTask 4.5.9: 实现定时测试通信机连接功能，后端服务每分钟自动测试连接状态
  - [x] SubTask 4.5.10: 实现通信机分组处理，Excel模板中填写分组名称，系统自动匹配分组ID

- [x] Task 4.6: 深交所风格 UI 组件实现
  - [x] SubTask 4.6.1: 实现深交所红主按钮组件
  - [x] SubTask 4.6.2: 实现深蓝导航栏组件
  - [x] SubTask 4.6.3: 实现状态指示器组件 (绿/黄/红/灰)
  - [x] SubTask 4.6.4: 实现表格斑马纹和悬停效果
  - [x] SubTask 4.6.5: 实现卡片圆角和阴影样式
  - [x] SubTask 4.6.6: 实现响应式布局适配

## 阶段五：测试与优化

- [ ] Task 5.1: 单元测试：编写核心模块测试
  - [ ] SubTask 5.1.1: 测试数据库模型
  - [ ] SubTask 5.1.2: 测试 API 端点
  - [ ] SubTask 5.1.3: 测试业务逻辑服务

- [ ] Task 5.2: 集成测试：编写集成测试用例
  - [ ] SubTask 5.2.1: 测试完整检查流程
  - [ ] SubTask 5.2.2: 测试定时任务

- [ ] Task 5.3: 性能优化：优化系统性能
  - [ ] SubTask 5.3.1: 优化数据库查询
  - [ ] SubTask 5.3.2: 优化 SSH 连接池

- [ ] Task 5.4: 文档完善：编写使用文档
  - [ ] SubTask 5.4.1: 编写 API 文档
  - [ ] SubTask 5.4.2: 编写部署文档

## 任务依赖关系

- Task 1.2 依赖 Task 1.1
- Task 1.3 依赖 Task 1.2
- Task 1.4 依赖 Task 1.3
- Task 1.5 依赖 Task 1.4
- Task 2.1 依赖 Task 1.4
- Task 2.2 依赖 Task 1.4
- Task 2.3 依赖 Task 1.4
- Task 2.4 依赖 Task 2.3
- Task 2.5 依赖 Task 2.1, Task 2.2, Task 2.4
- Task 3.1 依赖 Task 2.5
- Task 3.2 依赖 Task 2.5
- Task 3.3 依赖 Task 1.4
- Task 3.4 依赖 Task 1.4
- Task 3.5 依赖 Task 1.4
- Task 3.6 依赖 Task 2.1, Task 2.2
- Task 4.1 依赖 Task 2.5
- Task 4.2 依赖 Task 4.1, Task 3.5
- Task 4.3 依赖 Task 4.1, Task 2.1, Task 2.2
- Task 4.4 依赖 Task 4.1, Task 3.2
- Task 4.5 依赖 Task 3.5, Task 4.1
- Task 4.6 依赖 Task 4.1
- Task 5.1 依赖 Task 2.5
- Task 5.2 依赖 Task 5.1
- Task 5.3 依赖 Task 5.2
- Task 5.4 依赖 Task 5.3

```