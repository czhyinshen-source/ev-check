# 前端代码质量改进设计

**日期**: 2026-03-25
**状态**: 设计中
**范围**: 前端 JS 模块拆分 + 单元测试

---

## 1. 背景与目标

### 1.1 当前问题

- `dashboard.js` 包含 1647 行代码、61 个函数
- 单文件处理通信机、检查项、快照、报告、检查执行等多个业务领域
- 职责混乱，难以维护和测试
- 前端 JS 代码缺乏单元测试

### 1.2 改进目标

1. 将大文件拆分为职责清晰的独立模块
2. 为每个模块添加单元测试
3. 保持现有功能不变
4. 提高代码可维护性和可测试性

---

## 2. 模块拆分设计

### 2.1 目录结构

```
app/static/js/
├── dashboard.js          # 入口文件 (初始化、导航、刷新)
├── communications.js     # 通信机管理 (~300行)
├── checkitems.js         # 检查项管理 (~400行)
├── snapshots.js          # 快照管理 (~250行)
├── reports.js             # 报告管理 (~250行)
├── checks.js             # 检查执行 (~250行)
├── shared.js              # 共享工具函数 (~100行)
└── __tests__/            # 测试目录
    ├── communications.test.js
    ├── checkitems.test.js
    ├── snapshots.test.js
    ├── reports.test.js
    ├── checks.test.js
    └── shared.test.js
```

### 2.2 模块职责

#### shared.js (共享模块)
```javascript
// 导出的函数
window.shared = {
    API_BASE: '',                    // API 基础路径
    getHeaders,                      // 获取请求头
    logout,                          // 登出
    closeModal,                      // 关闭模态框
    showError,                       // 显示错误提示
    showSuccess,                     // 显示成功提示
    fetchJSON,                       // 封装 fetch
    formatDate,                      // 日期格式化
}
```

#### communications.js (通信机管理)
```javascript
// 导出的函数
window.communications = {
    loadCommunications,              // 加载通信机列表
    filterByGroup,                    // 按分组筛选
    searchCommunications,             // 搜索通信机
    editComm,                         // 编辑通信机
    deleteComm,                       // 删除通信机
    testConnection,                    // 测试连接
    checkAllCommunicationStatuses,    // 检查所有连接状态
    openCommModal,                    // 打开通信机模态框
    openExcelImportModal,             // 打开导入模态框
    openBatchDeployModal,             // 打开批量部署模态框
    loadCommunicationsForBatchDeploy,  // 加载通信机列表(批量)
    loadGroupOptions,                 // 加载分组选项
    loadSSHKeysForSelect,             // 加载SSH密钥选项
    toggleAuthFields,                 // 切换认证字段
    toggleDeployFields,               // 切换部署字段
    downloadExcelTemplate,             // 下载Excel模板
}
```

#### checkitems.js (检查项管理)
```javascript
// 导出的函数
window.checkitems = {
    loadCheckItemLists,               // 加载检查项列表
    selectCheckItemList,               // 选择检查项列表
    openCheckItemListModal,           // 打开列表模态框
    editCheckItemList,                // 编辑列表
    deleteCheckItemList,              // 删除列表
    cloneCheckItemList,               // 克隆列表
    loadCheckItems,                   // 加载检查项
    openCheckItemModal,               // 打开检查项模态框
    editCheckItem,                    // 编辑检查项
    cloneCheckItem,                   // 克隆检查项
    deleteCheckItem,                  // 删除检查项
    toggleCheckItemCategory,          // 切换检查项分类
    toggleCheckItemFields,            // 切换检查项字段
    toggleContentCheckFields,         // 切换内容检查字段
    toggleTextCompareFields,          // 切换文本比较字段
    toggleKernelCompareFields,        // 切换内核比较字段
    toggleRouteCheckFields,           // 切换路由检查字段
}
```

#### snapshots.js (快照管理)
```javascript
// 导出的函数
window.snapshots = {
    loadSnapshots,                    // 加载快照
    loadSnapshotGroups,               // 加载快照分组
    openSnapshotModal,                // 打开快照模态框
    loadSnapshotGroupsForModal,       // 加载分组选项
    openSnapshotGroupModal,           // 打开分组模态框
    loadSnapshotGroupForSelect,       // 加载分组选择器
    deleteSnapshot,                  // 删除快照
    deleteSnapshotGroup,             // 删除分组
}
```

#### reports.js (报告管理)
```javascript
// 导出的函数
window.reports = {
    loadReports,                      // 加载报告列表
    searchReports,                    // 搜索报告
    exportReport,                     // 导出报告
    viewReportDetail,                 // 查看报告详情
}
```

#### checks.js (检查执行)
```javascript
// 导出的函数
window.checks = {
    loadCheckResults,                 // 加载检查结果
    deleteCheckResult,                // 删除检查结果
    openCheckModal,                   // 打开检查模态框
    toggleCheckTypeFields,            // 切换检查类型字段
}
```

#### dashboard.js (入口文件)
```javascript
// 保留的函数
- 初始化逻辑 (DOMContentLoaded)
- 标签页切换 (setupTabNavigation)
- 数据刷新 (refreshData)
- 统计加载 (loadStats)
- SSH密钥管理 (loadSSHKeys, openSSHKeyModal, deleteSSHKey)
- 分组管理 (openGroupModal)
- 表单提交处理 (setupFormHandlers)
- 模态框处理 (setupModalHandlers)
```

---

## 3. 模块依赖关系

```
dashboard.js
    ├── shared.js (必需)
    ├── communications.js
    ├── checkitems.js
    ├── snapshots.js
    ├── reports.js
    └── checks.js
```

**依赖规则**:
- 模块之间不直接依赖
- 所有模块依赖 shared.js
- dashboard.js 协调各模块

---

## 4. HTML 引用调整

### 4.1 当前 (dashboard.html)
```html
<script src="js/dashboard.js"></script>
```

### 4.2 改进后
```html
<script src="js/shared.js"></script>
<script src="js/communications.js"></script>
<script src="js/checkitems.js"></script>
<script src="js/snapshots.js"></script>
<script src="js/reports.js"></script>
<script src="js/checks.js"></script>
<script src="js/dashboard.js"></script>
```

---

## 5. 测试框架

### 5.1 选型: Vitest

| 特性 | Vitest |
|------|--------|
| 速度 | 快 (Go 编写测试运行器) |
| ESM | 原生支持 |
| 配置 | 简洁 |
| Mock | 内置 |

### 5.2 测试文件结构

```javascript
// __tests__/shared.test.js
import { describe, it, expect, vi } from 'vitest';

describe('shared module', () => {
    describe('getHeaders', () => {
        it('should return headers with token', () => {
            localStorage.setItem('token', 'test-token');
            const headers = window.shared.getHeaders();
            expect(headers['Authorization']).toBe('Bearer test-token');
            expect(headers['Content-Type']).toBe('application/json');
        });
    });
});
```

### 5.3 测试覆盖率目标

| 模块 | 目标覆盖率 |
|------|-----------|
| shared.js | 100% |
| communications.js | 80% |
| checkitems.js | 80% |
| snapshots.js | 80% |
| reports.js | 70% |
| checks.js | 70% |

---

## 6. 重构步骤

### Phase 1: 创建 shared.js (1天)
1. 提取共享函数
2. 添加单元测试

### Phase 2: 拆分模块 (2-3天)
1. 提取 communications.js
2. 提取 checkitems.js
3. 提取 snapshots.js
4. 提取 reports.js
5. 提取 checks.js
6. 精简 dashboard.js

### Phase 3: 添加测试 (2天)
1. 安装配置 Vitest
2. 为每个模块编写测试
3. 达到覆盖率目标

### Phase 4: 集成验证 (1天)
1. 更新 HTML 引用
2. 功能测试
3. 修复问题

---

## 7. 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 拆分过程破坏功能 | 每次拆分完成后进行功能验证 |
| 函数依赖遗漏 | 使用 IDE 搜索确保引用完整 |
| 测试覆盖不足 | 设置覆盖率门槛，CI 检查 |

---

## 8. 验收标准

1. `dashboard.js` 减少到 300 行以内
2. 每个模块可独立导入使用
3. 单元测试覆盖率 > 70%
4. 所有原有功能正常工作
5. 无 console.error 或警告
