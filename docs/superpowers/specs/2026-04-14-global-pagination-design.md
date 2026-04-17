# 全局分页系统设计规格说明书 (Global Pagination System Spec)

## 1. 背景与目标
目前系统内的主要列表（执行报告、快照、用户管理等）均为全量加载，随着数据增长，页面响应速度变慢且视觉体验欠佳。
本设计旨在建立一套通用的前后端分页机制，实现高性能的数据流转与标准化的 UI 交互。

## 2. 总体架构
本系统采用 **后端 Header 注入 + 前端 URL 参数驱动** 的设计模式。

### 2.1 数据流向
1. 前端加载时从 URL 获取 `page` 和 `size`。
2. 前端发起 API 请求，带上 `skip=(page-1)*size` 和 `limit=size` 过滤。
3. 后端执行分页查询，并将数据总数通过 HTTP Header (`X-Total-Count`) 返回。
4. 前端接收响应，更新列表内容，并根据 Header 渲染分页组件。
5. 用户点击翻页，URL 更新，流程循环。

## 3. 详细设计

### 3.1 后端改造 (Python/FastAPI)
- **通用工具函数**：在 `app/utils/pagination.py` 中封装 `get_paginated_data`。
    - 入参：`Session`, `Query`, `skip`, `limit`, `Response`。
    - 功能：计算 `totalCount`，执行分页 Fetch，设置 `response.headers["X-Total-Count"] = total`。
- **涉及接口**：
    - `GET /api/reports`
    - `GET /api/snapshots`
    - `GET /api/users`
    - `GET /api/check_items`
    - `GET /api/check_rules`

### 3.2 前端公共组件 (JavaScript)
- **文件位置**：`app/static/js/components/pagination.js`
- **核心逻辑 (`class PaginationManager`)**：
    - `render(containerId, total, currentPage, pageSize, onPageChange)`：渲染 UI。
    - UI 包含：上一页、数字页码、省略号、下一页、每页条数选择器。
- **样式指南**：
    - 采用深色模式，磨砂玻璃效果（Glassmorphism）。
    - 激活页标使用青色 (Cyan) 高亮。

### 3.3 页面集成
- **URL 解析**：分页组件初始化时解析 `?page=X&size=Y`。
- **降级处理**：若 URL 无参数，默认 `page=1`, `size=50`。

## 4. 成功准则
- [ ] 页面刷新后，保持当前所在的页码和每页条数。
- [ ] 分页列表下方的总数显示与数据库实际记录数一致。
- [ ] 翻页响应时间显著低于全量加载（针对 1000 条以上数据测试）。
- [ ] UI 展示美观，符合 Enterprise Dashboard 设计风格。

## 5. 错误处理
- 若页码超出总范围（如 `page=999`），则重置为末页或第一页。
- 若 `size` 包含非数字或异常值，默认使用 20 条。
