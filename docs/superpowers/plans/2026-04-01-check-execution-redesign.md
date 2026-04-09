# 检查执行功能重新设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重新设计"检查执行"功能，从简单的手动执行转变为完整的检查规则管理与智能调度系统。

**Architecture:** 
后端扩展 SQLAlchemy 数据模型以支持 CheckRule 及多对多关联（快照、检查项、通信机），提供 RESTful CRUD 接口和异步触发 Celery 执行逻辑。前端复用当前系统侧边栏加内容详情区架构进行数据交互及提交。

**Tech Stack:** Python, FastAPI, SQLAlchemy, SQLite, Vanilla JavaScript, CSS, HTML

---

### Task 1: 扩展并升级数据模型

**Files:**
- Modify: `app/models/check_result.py` (假设 CheckRule 定义在此或新建 `app/models/check_rule.py`，此处以独立模型为例，建议重命名或拆分)
- Create: `app/models/check_rule.py` (提取并建立关联表)
- Create: `scripts/migrate_check_rules.py` (手动数据库迁移脚)

- [ ] **Step 1: 创建相关的 SQLAlchemy 关联表及扩展 CheckRule 模型**

```python
# app/models/check_rule.py (假设整合模型于此，如果原有模型在 check_result.py，请在该文件修改。以下提供示例)
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

check_rule_snapshots = Table(
    'check_rule_snapshots',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('rule_id', Integer, ForeignKey('check_rules.id'), nullable=False),
    Column('snapshot_id', Integer, ForeignKey('snapshots.id'), nullable=True),
    Column('snapshot_group_id', Integer, ForeignKey('snapshot_groups.id'), nullable=True)
)

check_rule_check_items = Table(
    'check_rule_check_items',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('rule_id', Integer, ForeignKey('check_rules.id'), nullable=False),
    Column('check_item_id', Integer, ForeignKey('check_items.id'), nullable=True),
    Column('check_item_list_id', Integer, ForeignKey('check_item_lists.id'), nullable=True)
)

check_rule_communications = Table(
    'check_rule_communications',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('rule_id', Integer, ForeignKey('check_rules.id'), nullable=False),
    Column('communication_id', Integer, ForeignKey('communications.id'), nullable=True),
    Column('communication_group_id', Integer, ForeignKey('communication_groups.id'), nullable=True)
)

class CheckRule(Base):
    __tablename__ = "check_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    allow_manual_execution = Column(Boolean, default=True)
    cron_expression = Column(String(100), nullable=True)
    time_window_start = Column(String(5), nullable=True)
    time_window_end = Column(String(5), nullable=True)
    time_window_weekdays = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 需要添加对应的 relationship 如果后续功能需要
```

- [ ] **Step 2: 编写并运行数据库迁移脚本**

```python
# scripts/migrate_check_rules.py
# 包含向 check_rules 表添加新列的逻辑，以及创建关联表的 DDL 执行
```

- [ ] **Step 3: Commit**

```bash
git add app/models/ scripts/migrate_check_rules.py
git commit -m "feat(models): 扩展 CheckRule 模型及关联表"
```

### Task 2: Pydantic Schemas

**Files:**
- Create: `app/schemas/check_rule.py`

- [ ] **Step 1: 定义创建、更新和读取的 Schema**

```python
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class CheckRuleBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True
    allow_manual_execution: bool = True
    cron_expression: Optional[str] = None
    time_window_start: Optional[str] = None
    time_window_end: Optional[str] = None
    time_window_weekdays: Optional[str] = None

class CheckRuleCreate(CheckRuleBase):
    snapshot_ids: List[int] = []
    snapshot_group_ids: List[int] = []
    check_item_ids: List[int] = []
    check_item_list_ids: List[int] = []
    communication_ids: List[int] = []
    communication_group_ids: List[int] = []

class CheckRuleResponse(CheckRuleBase):
    id: int
    snapshot_count: int = 0
    check_item_count: int = 0
    communication_count: int = 0
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True
```

- [ ] **Step 2: Commit**

```bash
git add app/schemas/check_rule.py
git commit -m "feat(schemas): 添加检查规则结构验证和返回体"
```

### Task 3: 检查规则 CRUD API & Route Registration

**Files:**
- Create: `app/api/check_rules.py`
- Modify: `app/main.py`

- [ ] **Step 1: 实现 API 路由 (`app/api/check_rules.py`)**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
# ...
router = APIRouter()

@router.get("/")
def get_check_rules(db: Session = Depends(get_db)):
    pass

@router.post("/")
def create_check_rule(rule: CheckRuleCreate, db: Session = Depends(get_db)):
    pass
# 依此类推完善 GET /{id}, PUT /{id}, DELETE /{id}, PATCH /{id}/toggle
```

- [ ] **Step 2: 在 `app/main.py` 中注册路由**

```python
from app.api import check_rules

app.include_router(check_rules.router, prefix="/api/v1/check-rules", tags=["check_rules"])
```

- [ ] **Step 3: Commit**

```bash
git add app/api/check_rules.py app/main.py
git commit -m "feat(api): 添加 CheckRule CRUD REST API 接口"
```

### Task 4: 服务层执行逻辑与 API 接口调整

**Files:**
- Modify: `app/services/check_service.py`
- Modify: `app/api/check_rules.py`
- Modify: `app/api/checks.py`

- [ ] **Step 1: 在 `app/services/check_service.py` 中增加展开逻辑**

实现针对某个 `rule_id` 对象提取展开所有的通信机列表、检查项列表以及快照列表的功能，创建 `CheckResult` 记录并分发到 Celery 任务池。

- [ ] **Step 2: 在 `app/api/check_rules.py` 中增加 POST `/{id}/execute`**

```python
@router.post("/{id}/execute")
def execute_check_rule(id: int, db: Session = Depends(get_db)):
    # 检查 allow_manual_execution 并调用 service
    pass
```

- [ ] **Step 3: 清理旧 API**
从 `app/api/checks.py` 中移除废弃的 `start_check` 端点。

- [ ] **Step 4: Commit**

```bash
git add app/services/check_service.py app/api/check_rules.py app/api/checks.py
git commit -m "feat(api): 实现检查任务执行接口及分组展开分发"
```

### Task 5: 前端 UI 布局与样式

**Files:**
- Modify: `app/static/dashboard.html`
- Modify: `app/static/css/style.css`

- [ ] **Step 1: 在 `dashboard.html` 插入新的两栏布局**

移除旧表单和弹框，设计 280px 左侧栏（规则列表）及右侧详情区（基础信息、关联三栏、调度区）。增加选择快照/检查项/通信机所需的 Modal 框架（带“个体”和“分组”的 Tag 交互）。

- [ ] **Step 2: 更新 `style.css`**

定义相关 CSS 规则（使用 Control Room 主题的 `var(--bg-*)`, `var(--border-*)` 变量），调整表单及选择器样式，支持 Tag 展示形式。

- [ ] **Step 3: Commit**

```bash
git add app/static/dashboard.html app/static/css/style.css
git commit -m "feat(ui): 检查规则管理及执行的前端页面布局"
```

### Task 6: 前端 JS 逻辑重写

**Files:**
- Rewrite: `app/static/js/checks.js`

- [ ] **Step 1: 编写 CRUD 交互请求和渲染代码**

实现左侧规则列表的加载渲染和右侧详情加载。在点击规则时高亮。增加切换 `is_active` 功能函数。通过 DOM 控制和 Fetch 请求串联 `/api/v1/check-rules` 的前后端流转。

- [ ] **Step 2: 实现弹窗选定与 Tag 渲染交互**

结合 HTML 定义的 Modal，实现选择检查项个体及目录分组、选择通信机的标签渲染。

- [ ] **Step 3: 实现执行流程和进度条集成**

绑定“执行检查”按钮，发送 `/{id}/execute` 请求，弹出确认框展示统计数量；收到响应后利用系统原有的轮询机制，于界面上方显示进度展示及相关回调。

- [ ] **Step 4: Commit**

```bash
git add app/static/js/checks.js
git commit -m "feat(js): 重写 checks.js 完成规则的配置、加载执行交互"
```
