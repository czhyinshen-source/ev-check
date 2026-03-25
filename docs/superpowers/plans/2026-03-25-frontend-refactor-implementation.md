# 前端代码质量改进实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 dashboard.js (1647行) 拆分为 6 个独立模块，并为每个模块添加单元测试

**Architecture:** 按业务领域拆分：shared.js 提供公共工具函数，各业务模块独立管理自己的状态和渲染逻辑，dashboard.js 作为入口协调各模块

**Tech Stack:** 原生 JavaScript (ES6+), Vitest 测试框架

---

## 文件结构

```
app/static/js/
├── shared.js              # 公共工具函数 (~100行)
├── communications.js      # 通信机管理 (~300行)
├── checkitems.js          # 检查项管理 (~400行)
├── snapshots.js           # 快照管理 (~250行)
├── reports.js             # 报告管理 (~250行)
├── checks.js              # 检查执行 (~250行)
├── dashboard.js           # 入口文件 (~300行)
└── __tests__/             # 测试目录
    ├── shared.test.js
    ├── communications.test.js
    ├── checkitems.test.js
    ├── snapshots.test.js
    ├── reports.test.js
    └── checks.test.js
```

---

## Phase 1: 创建 shared.js 公共模块

### Task 1.1: 创建 shared.js 基础结构

**Files:**
- Create: `app/static/js/shared.js`

- [ ] **Step 1: 创建 shared.js 文件**

```javascript
// 公共工具模块
const API_BASE = '';

function getHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
    };
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/login.html';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function showError(message) {
    alert('❌ ' + message);
}

function showSuccess(message) {
    alert('✅ ' + message);
}

async function fetchJSON(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: { ...getHeaders(), ...options.headers }
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res.json();
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
}

// 导出模块
window.shared = {
    API_BASE,
    getHeaders,
    logout,
    closeModal,
    showError,
    showSuccess,
    fetchJSON,
    formatDate
};
```

- [ ] **Step 2: 验证文件创建**

Run: `ls -la app/static/js/shared.js`
Expected: 文件存在，约 60 行

---

### Task 1.2: 安装 Vitest 测试框架

**Files:**
- Modify: `package.json` (如果存在) 或创建
- Modify: `vitest.config.js`

- [ ] **Step 1: 创建 package.json (如果不存在)**

```bash
# 检查是否存在
cat package.json 2>/dev/null || echo '{"type": "module", "scripts": {}, "devDependencies": {}}' > package.json
```

- [ ] **Step 2: 安装 Vitest**

```bash
npm install --save-dev vitest jsdom
```

- [ ] **Step 3: 创建 vitest.config.js**

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['app/static/js/__tests__/**/*.test.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['app/static/js/*.js'],
            exclude: ['app/static/js/__tests__/**']
        }
    }
});
```

- [ ] **Step 4: 添加测试脚本到 package.json**

```json
{
    "scripts": {
        "test": "vitest run",
        "test:watch": "vitest",
        "test:coverage": "vitest run --coverage"
    }
}
```

- [ ] **Step 5: 验证安装**

Run: `npm test`
Expected: "No test files found" (正常，测试文件尚未创建)

---

### Task 1.3: 创建 shared.js 单元测试

**Files:**
- Create: `app/static/js/__tests__/shared.test.js`

- [ ] **Step 1: 创建测试目录**

```bash
mkdir -p app/static/js/__tests__
```

- [ ] **Step 2: 创建 shared.test.js**

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

// 模拟 localStorage
const localStorageMock = {
    store: {},
    getItem(key) {
        return this.store[key] || null;
    },
    setItem(key, value) {
        this.store[key] = value;
    },
    removeItem(key) {
        delete this.store[key];
    },
    clear() {
        this.store = {};
    }
};

// 模拟 window.location
const locationMock = {
    href: ''
};

describe('shared module', () => {
    beforeEach(() => {
        global.localStorage = localStorageMock;
        global.window = { location: locationMock };
        localStorageMock.clear();
        locationMock.href = '';

        // 加载 shared.js
        vi.resetModules();
    });

    describe('getHeaders', () => {
        it('should return headers with token when token exists', async () => {
            localStorageMock.setItem('token', 'test-token-123');

            // 导入模块
            await import('../shared.js');

            const headers = window.shared.getHeaders();
            expect(headers['Authorization']).toBe('Bearer test-token-123');
            expect(headers['Content-Type']).toBe('application/json');
        });

        it('should return Bearer null when token does not exist', async () => {
            await import('../shared.js');

            const headers = window.shared.getHeaders();
            expect(headers['Authorization']).toBe('Bearer null');
        });
    });

    describe('logout', () => {
        it('should clear token and redirect to login', async () => {
            localStorageMock.setItem('token', 'test-token');
            localStorageMock.setItem('username', 'testuser');

            await import('../shared.js');

            window.shared.logout();

            expect(localStorageMock.getItem('token')).toBeNull();
            expect(localStorageMock.getItem('username')).toBeNull();
            expect(window.location.href).toBe('/login.html');
        });
    });

    describe('formatDate', () => {
        it('should return formatted date string', async () => {
            await import('../shared.js');

            const result = window.shared.formatDate('2026-03-25T10:30:00');
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
        });

        it('should return dash for null input', async () => {
            await import('../shared.js');

            const result = window.shared.formatDate(null);
            expect(result).toBe('-');
        });
    });

    describe('closeModal', () => {
        it('should remove active class from modal', async () => {
            document.body.innerHTML = '<div id="testModal" class="active"></div>';

            await import('../shared.js');

            window.shared.closeModal('testModal');

            const modal = document.getElementById('testModal');
            expect(modal.classList.contains('active')).toBe(false);
        });
    });
});
```

- [ ] **Step 3: 运行测试验证**

Run: `npm test`
Expected: shared.test.js 测试通过

- [ ] **Step 4: 提交 Phase 1**

```bash
git add app/static/js/shared.js app/static/js/__tests__/ package.json vitest.config.js
git commit -m "feat(frontend): add shared.js module with unit tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 2: 拆分 communications.js

### Task 2.1: 提取通信机管理函数

**Files:**
- Create: `app/static/js/communications.js`
- Read: `app/static/js/dashboard.js` (提取相关函数)

- [ ] **Step 1: 创建 communications.js**

从 dashboard.js 提取以下函数:
- `loadGroups`
- `filterByGroup`
- `loadCommunications`
- `searchCommunications`
- `editComm`
- `deleteComm`
- `testConnection`
- `checkAllCommunicationStatuses`
- `openCommModal`
- `openExcelImportModal`
- `openBatchDeployModal`
- `loadCommunicationsForBatchDeploy`
- `loadGroupOptions`
- `loadSSHKeysForSelect`
- `toggleAuthFields`
- `toggleDeployFields`
- `downloadExcelTemplate`

文件结构:
```javascript
// 通信机管理模块
// 依赖: shared.js

let currentGroupId = '';
let communicationStatuses = JSON.parse(localStorage.getItem('communicationStatuses') || '{}');

// ... 函数定义 ...

// 导出模块
window.communications = {
    loadGroups,
    filterByGroup,
    loadCommunications,
    searchCommunications,
    editComm,
    deleteComm,
    testConnection,
    checkAllCommunicationStatuses,
    openCommModal,
    openExcelImportModal,
    openBatchDeployModal,
    loadCommunicationsForBatchDeploy,
    loadGroupOptions,
    loadSSHKeysForSelect,
    toggleAuthFields,
    toggleDeployFields,
    downloadExcelTemplate,
    // 暴露状态供外部访问
    getCurrentGroupId: () => currentGroupId,
    getCommunicationStatuses: () => communicationStatuses
};
```

- [ ] **Step 2: 从 dashboard.js 删除已提取的函数**

在 dashboard.js 中删除 communications.js 中已定义的所有函数

- [ ] **Step 3: 更新 dashboard.js 对 communications 的引用**

将直接函数调用改为 `window.communications.xxx()`

---

### Task 2.2: 创建 communications.test.js

**Files:**
- Create: `app/static/js/__tests__/communications.test.js`

- [ ] **Step 1: 创建测试文件**

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('communications module', () => {
    beforeEach(() => {
        global.localStorage = { store: {}, getItem: (k) => localStorage.store[k], setItem: (k, v) => localStorage.store[k] = v };
        global.fetch = vi.fn();
        document.body.innerHTML = '<div id="groupTree"></div><div id="commTable"></div>';
    });

    describe('filterByGroup', () => {
        it('should update currentGroupId and reload communications', async () => {
            // 测试分组筛选逻辑
        });
    });

    describe('loadGroups', () => {
        it('should fetch groups and render tree', async () => {
            // 测试加载分组
        });
    });

    // ... 更多测试
});
```

- [ ] **Step 2: 运行测试**

Run: `npm test`
Expected: communications.test.js 测试通过

- [ ] **Step 3: 提交**

```bash
git add app/static/js/communications.js app/static/js/__tests__/communications.test.js app/static/js/dashboard.js
git commit -m "feat(frontend): extract communications module from dashboard.js

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 3: 拆分 checkitems.js

### Task 3.1: 提取检查项管理函数

**Files:**
- Create: `app/static/js/checkitems.js` (更新现有文件)
- Modify: `app/static/js/dashboard.js`

- [ ] **Step 1: 更新 checkitems.js**

合并 dashboard.js 中的检查项相关函数到现有的 checkitems.js:
- `loadCheckItemLists`
- `selectCheckItemList`
- `loadCheckItems`
- `openCheckItemListModal`
- `editCheckItemList`
- `deleteCheckItemList`
- `cloneCheckItemList`
- `openCheckItemModal`
- `editCheckItem`
- `cloneCheckItem`
- `deleteCheckItem`
- `toggleCheckItemCategory`
- `toggleCheckItemFields`
- `toggleContentCheckFields`
- `toggleTextCompareFields`
- `toggleKernelCompareFields`
- `toggleRouteCheckFields`

- [ ] **Step 2: 从 dashboard.js 删除已提取函数**

- [ ] **Step 3: 创建 checkitems.test.js**

- [ ] **Step 4: 运行测试并提交**

---

## Phase 4: 拆分 snapshots.js

### Task 4.1: 提取快照管理函数

**Files:**
- Create: `app/static/js/snapshots.js` (更新现有文件)
- Modify: `app/static/js/dashboard.js`

- [ ] **Step 1: 更新 snapshots.js**

从 dashboard.js 提取:
- `loadSnapshots`
- `loadSnapshotGroups`
- `openSnapshotModal`
- `loadSnapshotGroupsForModal`
- `openSnapshotGroupModal`
- `deleteSnapshot`
- `deleteSnapshotGroup`

- [ ] **Step 2: 从 dashboard.js 删除已提取函数**

- [ ] **Step 3: 创建 snapshots.test.js**

- [ ] **Step 4: 运行测试并提交**

---

## Phase 5: 拆分 reports.js

### Task 5.1: 提取报告管理函数

**Files:**
- Create: `app/static/js/reports.js` (更新现有文件)
- Modify: `app/static/js/dashboard.js`

- [ ] **Step 1: 更新 reports.js**

从 dashboard.js 提取:
- `loadReports`
- `renderReports`
- `searchReports`
- `viewReportDetail`
- `exportReport`

- [ ] **Step 2: 从 dashboard.js 删除已提取函数**

- [ ] **Step 3: 创建 reports.test.js**

- [ ] **Step 4: 运行测试并提交**

---

## Phase 6: 拆分 checks.js

### Task 6.1: 提取检查执行函数

**Files:**
- Create: `app/static/js/checks.js` (更新现有文件)
- Modify: `app/static/js/dashboard.js`

- [ ] **Step 1: 更新 checks.js**

从 dashboard.js 提取:
- `loadCheckResults`
- `deleteCheckResult`
- `openCheckModal`

- [ ] **Step 2: 从 dashboard.js 删除已提取函数**

- [ ] **Step 3: 创建 checks.test.js**

- [ ] **Step 4: 运行测试并提交**

---

## Phase 7: 更新 HTML 引用

### Task 7.1: 更新 dashboard.html

**Files:**
- Modify: `app/static/dashboard.html`

- [ ] **Step 1: 在 </body> 前添加脚本引用**

```html
<!-- JS 模块 (按依赖顺序) -->
<script src="js/shared.js"></script>
<script src="js/communications.js"></script>
<script src="js/checkitems.js"></script>
<script src="js/snapshots.js"></script>
<script src="js/reports.js"></script>
<script src="js/checks.js"></script>
<script src="js/dashboard.js"></script>
```

- [ ] **Step 2: 删除原有的内联脚本引用**

- [ ] **Step 3: 提交**

```bash
git add app/static/dashboard.html
git commit -m "feat(frontend): update script references for modular structure

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Phase 8: 最终验证

### Task 8.1: 运行完整测试

- [ ] **Step 1: 运行所有测试**

```bash
npm test
```

Expected: 所有测试通过

- [ ] **Step 2: 检查测试覆盖率**

```bash
npm run test:coverage
```

Expected: 覆盖率 > 70%

- [ ] **Step 3: 手动功能测试**

启动服务并在浏览器中测试:
1. 登录功能
2. 通信机管理 (增删改查、连接测试)
3. 检查项管理 (列表和检查项 CRUD)
4. 快照管理
5. 报告查看
6. 检查执行

- [ ] **Step 4: 最终提交**

```bash
git add .
git commit -m "feat(frontend): complete frontend refactor with tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 验收检查清单

- [ ] `dashboard.js` 行数 < 400
- [ ] 所有模块文件存在且可独立加载
- [ ] 单元测试覆盖率 > 70%
- [ ] 所有原有功能正常工作
- [ ] 无 console.error 或警告
