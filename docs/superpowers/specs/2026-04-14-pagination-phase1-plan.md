# 分期实施计划：任务监控与报表中心分页功能

本计划旨在分步实现全局分页系统的第一阶段。

## 用户审核请求
> [!IMPORTANT]
> **确认范围**：本阶段仅处理“任务监控”（Dashboard 概览页表格）与“报表中心”（Reports 列表）。
> 请确认“任务监控”是指 Dashboard 首页的“今日执行规则”表格。

## 方案设计

### 1. 后端改造 (Python/FastAPI)
我们将为相关接口增加总数统计逻辑，并通过 Header 返回。

#### [MODIFY] [reports.py](file:///Users/chenzhihui/Documents/trae_projects/ev_check/app/api/reports.py)
- 修改 `list_reports` 接口。
- 增加 `total_count = await db.scalar(select(func.count(CheckReport.id)))`。
- 设置 `response.headers["X-Total-Count"] = str(total_count)`。

#### [MODIFY] [check_rules.py](file:///Users/chenzhihui/Documents/trae_projects/ev_check/app/api/check_rules.py)
- 修改 `list_check_rules` 接口。
- 增加总数统计并注入 Header。

### 2. 前端组件开发 (JavaScript)

#### [NEW] [pagination.js](file:///Users/chenzhihui/Documents/trae_projects/ev_check/app/static/js/components/pagination.js)
- 实现 `PaginationManager` 类。
- 提供 `init(containerId, total, currentPage, pageSize, onPageChange)` 方法。
- 自动处理 URL 参数 `page` 和 `size` 的同步。

### 3. 页面集成

#### [MODIFY] [reports.js](file:///Users/chenzhihui/Documents/trae_projects/ev_check/app/static/js/reports.js)
- 更新 `loadReports` 函数。
- 发起 fetch 时携带 URL 中的 `page/size` 参数。
- 解析 Response Headers 中的 `X-Total-Count`。
- 渲染分页条。

#### [MODIFY] [dashboard.js](file:///Users/chenzhihui/Documents/trae_projects/ev_check/app/static/js/dashboard.js)
- 更新 `loadRules`（今日规则加载）函数。
- 同步应用分页逻辑。

#### [MODIFY] [dashboard.html](file:///Users/chenzhihui/Documents/trae_projects/ev_check/app/static/dashboard.html)
- 在 `todayRulesTable` 和 `reportListBody` 所在的卡片底部增加分页容器：
  `<div id="reportsPagination" class="pagination-container"></div>`
  `<div id="dashboardPagination" class="pagination-container"></div>`

## 验证计划
1. **后端验证**：使用 `curl` 或浏览器开发者工具检查响应头是否包含 `X-Total-Count`。
2. **前端验证**：
   - 检查表格下方是否出现分页条。
   - 点击“下一页”或“页码”，确认 URL 变为 `?page=2` 且内容实时刷新。
   - 手动在 URL 输入 `?size=10`，确认每页显示条数发生变化。
