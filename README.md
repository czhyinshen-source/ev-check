# 运行环境检查系统 (EV Check)

[![Python Version](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109.0-green.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 项目简介

运行环境检查系统是一个自动化的服务器环境检查工具，用于替代人工检查方式，提高检查效率和质量，防止程序、配置等信息被有意或无意改动。

### 核心功能

- ✅ **通信机管理**: 支持通信机分组、SSH 免密认证、批量导入、连接测试
- ✅ **检查项管理**: 支持多种检查类型（文件、进程、端口、日志等）
- ✅ **快照管理**: 支持环境快照创建、分组管理、快照对比
- ⏳ **检查规则**: 配置检查规则、时间段、检查项关联
- ⏳ **环境检查**: 手动/定时执行环境检查，实时进度显示
- ⏳ **报表生成**: 检查结果统计、详细报告、PDF/Excel 导出
- ✅ **用户认证**: JWT Token 认证、角色权限控制
- ✅ **前端界面**: 深交所风格设计、响应式布局

### 技术栈

**后端**:
- FastAPI 0.109.0 - 高性能异步 Web 框架
- SQLAlchemy 2.0.25 - ORM 数据库操作
- Celery 5.3.6 - 异步任务队列
- Redis 5.0.1 - 缓存和消息队列
- Paramiko 3.4.0 - SSH 连接管理

**前端**:
- 原生 HTML/CSS/JavaScript
- 深交所设计系统
- 响应式布局

**数据库**:
- SQLite (开发环境)
- PostgreSQL (生产环境)

## 快速开始

### 环境要求

- Python 3.11+
- Redis 5.0+
- SQLite 3 / PostgreSQL 14+

### 安装步骤

1. **克隆项目**

```bash
git clone <repository-url>
cd ev_check
```

2. **创建虚拟环境**

```bash
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# 或
.venv\Scripts\activate  # Windows
```

3. **安装依赖**

```bash
pip install -r requirements.txt
```

4. **配置环境变量**

```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等信息
```

5. **初始化数据库**

```bash
# 创建数据库表
python -m app.database
```

6. **启动服务**

```bash
# 启动 Web 服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 启动 Celery Worker (新终端)
celery -A app.celery_config worker --loglevel=info

# 启动 Celery Beat (新终端)
celery -A app.celery_config beat --loglevel=info
```

7. **访问系统**

打开浏览器访问: http://localhost:8000

默认管理员账号:
- 用户名: admin
- 密码: admin123

## Docker 部署

### 使用 Docker Compose

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 服务端口

- Web 服务: http://localhost:8000
- Redis: localhost:6379
- PostgreSQL: localhost:5432

## 项目结构

```
ev_check/
├── app/                      # 应用主目录
│   ├── api/                  # API 路由
│   │   ├── check_items.py    # 检查项 API
│   │   ├── checks.py         # 检查执行 API
│   │   ├── communications.py # 通信机 API
│   │   ├── snapshots.py      # 快照 API
│   │   └── users.py          # 用户 API
│   ├── models/               # 数据模型
│   │   ├── check_item.py     # 检查项模型
│   │   ├── check_result.py   # 检查结果模型
│   │   ├── communication.py  # 通信机模型
│   │   ├── snapshot.py       # 快照模型
│   │   └── user.py           # 用户模型
│   ├── schemas/              # Pydantic 模式
│   ├── services/             # 业务逻辑
│   │   ├── auth_service.py   # 认证服务
│   │   ├── check_executor.py # 检查执行器
│   │   ├── check_service.py  # 检查服务
│   │   └── snapshot_service.py # 快照服务
│   ├── tasks/                # Celery 任务
│   │   ├── check_tasks.py    # 检查任务
│   │   └── scheduled_tasks.py # 定时任务
│   ├── utils/                # 工具函数
│   │   ├── ssh_client.py     # SSH 客户端
│   │   └── file_checker.py   # 文件检查器
│   ├── static/               # 静态文件
│   │   ├── css/              # 样式文件
│   │   ├── js/               # JavaScript 文件
│   │   ├── login.html        # 登录页面
│   │   └── dashboard.html    # 控制台页面
│   ├── config.py             # 配置管理
│   ├── database.py           # 数据库连接
│   └── main.py               # 应用入口
├── tests/                    # 测试代码
│   ├── unit/                 # 单元测试
│   └── integration/          # 集成测试
├── docs/                     # 文档
│   ├── 开发文档.md           # 详细开发文档
│   ├── 最终测试报告.md       # 测试报告
│   └── 深交所设计系统.md     # 设计系统文档
├── .env.example              # 环境变量示例
├── docker-compose.yml        # Docker 配置
├── requirements.txt          # Python 依赖
├── pyproject.toml            # 项目配置
└── README.md                 # 本文件
```

## API 文档

启动服务后访问:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 主要 API 端点

#### 用户认证
- `POST /api/v1/users/register` - 用户注册
- `POST /api/v1/users/login` - 用户登录
- `GET /api/v1/users/me` - 获取当前用户信息

#### 通信机管理
- `GET /api/v1/communications` - 获取通信机列表
- `POST /api/v1/communications` - 创建通信机
- `PUT /api/v1/communications/{id}` - 更新通信机
- `DELETE /api/v1/communications/{id}` - 删除通信机
- `POST /api/v1/communications/{id}/test` - 测试连接

#### 检查项管理
- `GET /api/v1/check-items` - 获取检查项列表
- `POST /api/v1/check-items` - 创建检查项
- `PUT /api/v1/check-items/{id}` - 更新检查项
- `DELETE /api/v1/check-items/{id}` - 删除检查项

#### 快照管理
- `GET /api/v1/snapshots` - 获取快照列表
- `POST /api/v1/snapshots` - 创建快照
- `GET /api/v1/snapshots/{id}` - 获取快照详情
- `DELETE /api/v1/snapshots/{id}` - 删除快照

#### 检查执行
- `POST /api/v1/checks` - 启动检查
- `GET /api/v1/checks/{id}` - 获取检查结果
- `GET /api/v1/checks/{id}/progress` - 获取检查进度

## 测试

### 运行测试

```bash
# 运行所有测试
pytest

# 运行单元测试
pytest tests/unit/

# 运行集成测试
pytest tests/integration/

# 生成覆盖率报告
pytest --cov=app --cov-report=html
```

### 测试覆盖率

当前测试覆盖情况:
- ✅ 单元测试: 75 个测试 (100% 通过)
  - 认证服务: 15 个测试
  - 检查执行器: 35 个测试
  - SSH 客户端: 25 个测试
- ✅ 集成测试: 13 个测试 (100% 通过)
  - 用户 API: 13 个测试
- **总计**: 88 个测试 (100% 通过)

详细测试报告见: [docs/最终测试报告.md](docs/最终测试报告.md)

## 开发指南

### 代码规范

- 遵循 PEP 8 Python 代码规范
- 使用 Black 进行代码格式化
- 使用 isort 进行导入排序
- 使用 mypy 进行类型检查

```bash
# 格式化代码
black app/ tests/

# 排序导入
isort app/ tests/

# 类型检查
mypy app/
```

### 提交规范

使用 Conventional Commits 规范:

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建/工具链相关
```

### 分支管理

- `main` - 主分支，稳定版本
- `develop` - 开发分支
- `feature/*` - 功能分支
- `bugfix/*` - 修复分支
- `release/*` - 发布分支

## 配置说明

### 环境变量

在 `.env` 文件中配置以下环境变量:

```bash
# 数据库配置
DATABASE_URL=sqlite:///./ev_check.db
# DATABASE_URL=postgresql://user:password@localhost:5432/ev_check

# Redis 配置
REDIS_URL=redis://localhost:6379/0

# JWT 配置
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# 应用配置
DEBUG=True
LOG_LEVEL=INFO
```

### 数据库迁移

```bash
# 创建迁移
alembic revision --autogenerate -m "描述"

# 执行迁移
alembic upgrade head

# 回滚迁移
alembic downgrade -1
```

## 性能优化

### 数据库优化
- 使用连接池管理数据库连接
- 为常用查询字段添加索引
- 使用异步查询提高并发性能

### 缓存策略
- 使用 Redis 缓存频繁访问的数据
- 设置合理的缓存过期时间
- 实现缓存预热机制

### 异步任务
- 使用 Celery 处理耗时操作
- 合理设置任务优先级
- 实现任务重试机制

## 安全性

### 认证授权
- JWT Token 认证
- 密码使用 SHA256 哈希存储
- 基于角色的访问控制 (RBAC)

### 数据安全
- SSH 密钥加密存储
- 敏感数据传输使用 HTTPS
- 定期备份数据库

### 审计日志
- 记录所有用户操作
- 记录检查任务执行情况
- 记录系统异常

## 监控与日志

### 日志配置

日志文件位置:
- 应用日志: `logs/app.log`
- 错误日志: `logs/error.log`
- 访问日志: `logs/access.log`

### 监控指标

- API 响应时间
- 数据库查询性能
- Celery 任务执行情况
- 系统资源使用率

## 故障排查

### 常见问题

1. **数据库连接失败**
   - 检查数据库服务是否启动
   - 验证连接字符串是否正确
   - 检查防火墙设置

2. **Redis 连接失败**
   - 确认 Redis 服务运行状态
   - 检查 Redis 配置文件
   - 验证连接 URL

3. **SSH 连接超时**
   - 检查通信机网络连通性
   - 验证 SSH 端口是否开放
   - 确认认证信息是否正确

4. **Celery 任务不执行**
   - 检查 Celery Worker 是否运行
   - 查看 Celery 日志
   - 验证 Redis 连接

## 贡献指南

欢迎贡献代码！请遵循以下步骤:

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 版本历史

### v0.1.0 (2026-03-05)
- ✅ 完成基础架构搭建
- ✅ 实现用户认证系统
- ✅ 实现通信机管理功能
- ✅ 实现检查项管理功能
- ✅ 实现快照管理功能
- ✅ 完成前端登录和控制台界面
- ✅ 通过 88 个单元和集成测试

### 待开发功能
- ⏳ 检查规则管理
- ⏳ 环境检查执行
- ⏳ 报表生成和导出
- ⏳ 定时任务调度
- ⏳ 历史数据管理

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 联系方式

- 项目主页: <repository-url>
- 问题反馈: <repository-url>/issues
- 邮箱: your.email@example.com

## 致谢

- [FastAPI](https://fastapi.tiangolo.com/) - 现代化的 Python Web 框架
- [SQLAlchemy](https://www.sqlalchemy.org/) - Python SQL 工具包
- [Celery](https://docs.celeryq.dev/) - 分布式任务队列
- [Paramiko](https://www.paramiko.org/) - Python SSH 实现

---

**注意**: 本系统仅供内部使用，请勿在生产环境中使用默认密码。
