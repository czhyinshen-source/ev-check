# 运行环境检查系统 - API 使用指南

**版本**: v0.1.0  
**更新日期**: 2026-03-13

---

## API 概述

- **Base URL**: `http://localhost:8000/api/v1`
- **认证方式**: JWT Bearer Token
- **数据格式**: JSON
- **API 文档**: http://localhost:8000/docs

---

## 认证授权

### 用户登录

```http
POST /api/v1/users/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**响应**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### 使用 Token

在后续请求中添加 Authorization 头:

```http
GET /api/v1/users/me
Authorization: Bearer {token}
```

---

## 主要 API 端点

### 用户管理

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/users/register` | 用户注册 |
| POST | `/users/login` | 用户登录 |
| GET | `/users/me` | 获取当前用户 |
| PUT | `/users/me` | 更新用户信息 |
| GET | `/users` | 获取用户列表 (管理员) |

### 通信机管理

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/communications` | 获取通信机列表 |
| POST | `/communications` | 创建通信机 |
| GET | `/communications/{id}` | 获取通信机详情 |
| PUT | `/communications/{id}` | 更新通信机 |
| DELETE | `/communications/{id}` | 删除通信机 |
| POST | `/communications/{id}/test` | 测试连接 |
| POST | `/communications/import` | 批量导入 |

### 检查项管理

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/check-items` | 获取检查项列表 |
| POST | `/check-items` | 创建检查项 |
| PUT | `/check-items/{id}` | 更新检查项 |
| DELETE | `/check-items/{id}` | 删除检查项 |
| GET | `/check-item-lists` | 获取检查项列表 |
| POST | `/check-item-lists` | 创建检查项列表 |
| POST | `/check-item-lists/{id}/copy` | 复制列表 |

### 快照管理

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/snapshots` | 获取快照列表 |
| POST | `/snapshots` | 创建快照 |
| GET | `/snapshots/{id}` | 获取快照详情 |
| DELETE | `/snapshots/{id}` | 删除快照 |
| POST | `/snapshots/{id}/build` | 构建快照 |
| GET | `/snapshots/{id}/content` | 获取快照内容 |

### 检查执行

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/checks` | 启动检查 |
| GET | `/checks/{id}` | 获取检查结果 |
| GET | `/checks/{id}/progress` | 获取检查进度 |
| GET | `/checks/{id}/details` | 获取检查详情 |

---

## 使用示例

### Python 示例

```python
import requests

BASE_URL = "http://localhost:8000/api/v1"

# 登录
response = requests.post(f"{BASE_URL}/users/login", json={
    "username": "admin",
    "password": "admin123"
})
token = response.json()["access_token"]

# 获取通信机列表
headers = {"Authorization": f"Bearer {token}"}
response = requests.get(f"{BASE_URL}/communications", headers=headers)
communications = response.json()
```

### JavaScript 示例

```javascript
const BASE_URL = 'http://localhost:8000/api/v1';

// 登录
const loginResponse = await fetch(`${BASE_URL}/users/login`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({username: 'admin', password: 'admin123'})
});
const {access_token} = await loginResponse.json();

// 获取通信机列表
const response = await fetch(`${BASE_URL}/communications`, {
  headers: {'Authorization': `Bearer ${access_token}`}
});
const communications = await response.json();
```

---

## 错误处理

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

### 错误响应格式

```json
{
  "detail": "Error message",
  "code": "ERROR_CODE",
  "status_code": 400
}
```

---

## 分页查询

所有列表接口支持分页:

```http
GET /api/v1/communications?page=1&page_size=20
```

**响应格式**:
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "page_size": 20
}
```

---

## 完整 API 文档

访问 Swagger UI 查看完整的 API 文档和交互式测试:

http://localhost:8000/docs

---

**需要帮助?**

- 在线文档: http://localhost:8000/docs
- 问题反馈: <repository-url>/issues
