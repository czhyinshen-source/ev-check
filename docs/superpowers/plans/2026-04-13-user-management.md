# 用户管理与注册审批系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现用户自主注册、管理员审批激活、角色权限控制以及完整的用户管理后台。

**Architecture:** 
1. 模块化后端 API：通过 FastAPI 依赖注入实现角色守卫（Admin Check）。
2. RESTful 管理接口：新增状态切换、密码重置专用接口。
3. 动态前端渲染：根据 Token 角色动态显示/隐藏管理页签。

**Tech Stack:** FastAPI, SQLAlchemy (Async), Vanilla JS/HTML/CSS

---

### Task 1: 后端 - 注册逻辑与安全性加固
**Files:**
- Modify: `app/api/users.py`
- Test: `tests/test_auth.py` (新建)

- [ ] **Step 1: 修改注册逻辑**
在 `register` 函数中，无论前端传什么，强制设置 `db_user.is_active = False` 且 `db_user.role = "operator"`。

```python
# app/api/users.py 约 80 行
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
    # ... 检查重名逻辑保持不变 ...
    db_user = User(
        username=user.username,
        password_hash=get_password_hash(user.password),
        email=user.email,
        is_active=False,  # 强制不激活
        role="operator",  # 强制操作员角色
    )
    # ... 提交逻辑 ...
```

- [ ] **Step 2: 修改登录逻辑增加激活检查**
用户登录时，如果 `is_active` 为 `False`，返回 403 错误。

```python
# app/api/users.py 约 115 行
if not user.is_active:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN, 
        detail="您的账号尚未激活，请联系管理员审核。"
    )
```

- [ ] **Step 3: 提交代码**
`git add app/api/users.py && git commit -m "feat: enforce account activation and default role in registration"`

---

### Task 2: 后端 - 管理员权限守卫与管理接口
**Files:**
- Modify: `app/api/users.py`

- [ ] **Step 1: 实现管理员权限检查依赖**
```python
async def check_admin_privilege(current_user: User = Depends(get_current_active_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="权限不足，仅限管理员操作")
    return current_user
```

- [ ] **Step 2: 实现状态更新、角色切换与密码重置接口**
```python
@router.patch("/{user_id}/status", response_model=UserResponse)
async def update_user_status(user_id: int, is_active: bool, db: AsyncSession = Depends(get_db), _: User = Depends(check_admin_privilege)):
    # 查找并更新 is_active
    ...

@router.post("/{user_id}/reset-password")
async def reset_user_password(user_id: int, new_password: str, db: AsyncSession = Depends(get_db), _: User = Depends(check_admin_privilege)):
    # 查找并更新 password_hash
    ...
```

- [ ] **Step 3: 保护现有用户列表接口**
将 `list_users` 的依赖改为 `Depends(check_admin_privilege)`。

---

### Task 3: 前端 - 登录/注册 UI 改版
**Files:**
- Modify: `app/static/login.html`

- [ ] **Step 1: 增加注册表单 DOM**
在现有的 `login-card` 中增加一个隐藏的 `registerForm`。

- [ ] **Step 2: 实现登录/注册状态切换逻辑**
编写 JS 函数切换两个 Form 的显示，并更新标题。

- [ ] **Step 3: 调整注册 API 调用**
调用 `POST /api/v1/users/register`，成功后提示用户等待审批。

---

### Task 4: 前端 - 仪表盘用户管理页签
**Files:**
- Modify: `app/static/dashboard.html`
- Create: `app/static/js/users.js`

- [ ] **Step 1: 增加“用户管理”菜单项**
仅在 `currentUser.role === 'admin'` 时渲染此 Tab。

- [ ] **Step 2: 实现用户管理逻辑 `users.js`**
    - `loadUsers()`: 获取全部用户并渲染表格。
    - `toggleUserStatus(id, currentStatus)`: 调用 PATCH 接口激活/禁用。
    - `changeUserRole(id, newRole)`: 调用角色切换接口。
    - `showResetPasswordModal(id)`: 弹窗并调用重置接口。

- [ ] **Step 3: 初始化集成**
在 `dashboard.js` 的 Tab 切换逻辑中加入对 `users` 的初始化调用。
