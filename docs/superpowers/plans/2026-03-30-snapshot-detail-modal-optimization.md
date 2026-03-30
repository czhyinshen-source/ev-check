# 快照详情弹窗优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化快照详情弹窗界面，实现数据可视化展示，提升用户体验

**架构:** 采用组件化设计，新增统计卡片、分类数据展示、渐进式加载等功能，保持与现有API兼容

**Tech Stack:** 原生JavaScript、CSS3、FastAPI后端、现有数据结构

---

## 文件结构规划

### 新增文件
- `app/static/js/components/snapshot-detail.js` - 快照详情弹窗主组件
- `app/static/js/components/data-visualizer.js` - 数据可视化组件
- `app/static/css/snapshot-detail.css` - 快照详情弹窗专用样式

### 修改文件
- `app/static/js/snapshots.js` - 修改viewSnapshotDetail函数
- `app/static/dashboard.html` - 更新弹窗HTML结构
- `app/static/css/style.css` - 添加通用样式类

### 测试文件
- `app/static/js/components/__tests__/snapshot-detail.test.js` - 组件测试
- `app/static/js/components/__tests__/data-visualizer.test.js` - 可视化组件测试

---

### Task 1: 创建数据可视化组件

**Files:**
- Create: `app/static/js/components/data-visualizer.js`
- Test: `app/static/js/components/__tests__/data-visualizer.test.js`

- [ ] **Step 1: 编写数据可视化组件测试**

```javascript
// 测试文件
import { describe, it, expect, beforeEach } from 'vitest';
import { DataVisualizer } from '../data-visualizer.js';

describe('DataVisualizer', () => {
    let visualizer;

    beforeEach(() => {
        visualizer = new DataVisualizer();
    });

    it('should format file size correctly', () => {
        expect(visualizer.formatFileSize(1024)).toBe('1.0 KB');
        expect(visualizer.formatFileSize(1048576)).toBe('1.0 MB');
    });

    it('should render file data with correct structure', () => {
        const data = {
            path: '/etc/hosts',
            exists: true,
            size: 1024,
            mtime: '2024-03-30T10:00:00Z',
            mode: '644'
        };

        const html = visualizer.renderFileData(data);
        expect(html).toContain('/etc/hosts');
        expect(html).toContain('✓ 存在');
        expect(html).toContain('1.0 KB');
    });

    it('should render process data correctly', () => {
        const data = {
            processes: [
                { name: 'nginx', pid: 1234, running: true },
                { name: 'mysql', pid: null, running: false }
            ]
        };

        const html = visualizer.renderProcessData(data);
        expect(html).toContain('nginx');
        expect(html).toContain('🟢 运行中');
        expect(html).toContain('mysql');
        expect(html).toContain('🔴 已停止');
    });
});
```

- [ ] **Step 2: 运行测试确保失败**

```bash
cd /Users/chenzhihui/Documents/trae_projects/ev_check
npm test app/static/js/components/__tests__/data-visualizer.test.js
```

Expected: FAIL with "DataVisualizer is not defined"

- [ ] **Step 3: 实现数据可视化组件**

```javascript
// app/static/js/components/data-visualizer.js

export class DataVisualizer {
    constructor() {
        this.templates = {
            file: this.createFileTemplate(),
            process: this.createProcessTemplate(),
            port: this.createPortTemplate()
        };
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    formatDateTime(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    renderFileData(data) {
        const { path, exists, size, mtime, mode, owner } = data;

        return `
            <div class="file-info-card">
                <div class="file-header">
                    <span class="file-path" title="${path}">${path}</span>
                    <span class="file-status ${exists ? 'exists' : 'missing'}">
                        ${exists ? '✓ 存在' : '✗ 不存在'}
                    </span>
                </div>
                ${exists ? `
                    <div class="file-attributes">
                        <div class="attr-row">
                            <div class="attr-item">
                                <span class="attr-label">大小：</span>
                                <span class="attr-value">${this.formatFileSize(size)}</span>
                            </div>
                            <div class="attr-item">
                                <span class="attr-label">修改时间：</span>
                                <span class="attr-value">${this.formatDateTime(mtime)}</span>
                            </div>
                        </div>
                        <div class="attr-row">
                            <div class="attr-item">
                                <span class="attr-label">权限：</span>
                                <span class="attr-value">${mode || '-'}</span>
                            </div>
                            ${owner ? `
                                <div class="attr-item">
                                    <span class="attr-label">所有者：</span>
                                    <span class="attr-value">${owner}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderProcessData(data) {
        const { processes = [] } = data;

        if (processes.length === 0) {
            return '<div class="empty-processes">暂无进程数据</div>';
        }

        return `
            <div class="process-grid">
                ${processes.map(proc => `
                    <div class="process-card ${proc.running ? 'running' : 'stopped'}">
                        <div class="process-header">
                            <span class="process-name">${proc.name}</span>
                            <span class="process-status-badge ${proc.running ? 'success' : 'error'}">
                                ${proc.running ? '🟢' : '🔴'}
                            </span>
                        </div>
                        <div class="process-info">
                            <div class="info-item">
                                <span class="info-label">状态：</span>
                                <span class="info-value">${proc.running ? '运行中' : '已停止'}</span>
                            </div>
                            ${proc.pid ? `
                                <div class="info-item">
                                    <span class="info-label">PID：</span>
                                    <span class="info-value">${proc.pid}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderPortData(data) {
        const { ports = [] } = data;

        if (ports.length === 0) {
            return '<div class="empty-ports">暂无端口数据</div>';
        }

        return `
            <div class="port-grid">
                ${ports.map(port => `
                    <div class="port-card ${port.listening ? 'listening' : 'closed'}">
                        <div class="port-number">${port.port}</div>
                        <div class="port-protocol">${port.protocol || 'TCP'}</div>
                        <div class="port-status">
                            ${port.listening ? '🟢 监听中' : '⚫ 未监听'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderErrorData(error) {
        return `
            <div class="error-data-card">
                <div class="error-header">
                    <span class="error-icon">⚠️</span>
                    <span class="error-title">数据采集失败</span>
                </div>
                <div class="error-message">${error.message || '未知错误'}</div>
                ${error.type ? `
                    <div class="error-type">错误类型：${error.type}</div>
                ` : ''}
            </div>
        `;
    }
}
```

- [ ] **Step 4: 运行测试确保通过**

```bash
npm test app/static/js/components/__tests__/data-visualizer.test.js
```

Expected: PASS

- [ ] **Step 5: 提交代码**

```bash
git add app/static/js/components/data-visualizer.js
app/static/js/components/__tests__/data-visualizer.test.js
git commit -m "feat: add data visualizer component for snapshot detail modal

- Implement DataVisualizer class with methods for different data types
- Add file size formatting and date formatting utilities
- Create templates for file, process, and port data visualization
- Add comprehensive test coverage"
```

---

### Task 2: 创建快照详情弹窗主组件

**Files:**
- Create: `app/static/js/components/snapshot-detail.js`
- Modify: `app/static/js/snapshots.js` (viewSnapshotDetail function)
- Test: `app/static/js/components/__tests__/snapshot-detail.test.js`

- [ ] **Step 1: 编写快照详情组件测试**

```javascript
// app/static/js/components/__tests__/snapshot-detail.test.js

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SnapshotDetailModal } from '../snapshot-detail.js';

describe('SnapshotDetailModal', () => {
    let modal;

    beforeEach(() => {
        document.body.innerHTML = '';
        modal = new SnapshotDetailModal();
    });

    it('should create modal container', () => {
        modal.createContainer();
        const container = document.querySelector('.snapshot-detail-modal');
        expect(container).toBeTruthy();
    });

    it('should render statistics correctly', () => {
        const stats = {
            total: 10,
            success: 8,
            error: 2,
            totalItems: 150
        };

        const html = modal.renderStatistics(stats);
        expect(html).toContain('10'); // 总数
        expect(html).toContain('8');  // 成功
        expect(html).toContain('2');  // 失败
        expect(html).toContain('150'); // 检查项
    });

    it('should filter communications by status', () => {
        const comms = [
            { id: 1, name: 'comm1', status: 'success' },
            { id: 2, name: 'comm2', status: 'error' },
            { id: 3, name: 'comm3', status: 'success' }
        ];

        const filtered = modal.filterCommunications(comms, 'success');
        expect(filtered).toHaveLength(2);
        expect(filtered.every(c => c.status === 'success')).toBe(true);
    });
});
```

- [ ] **Step 2: 运行测试确保失败**

```bash
npm test app/static/js/components/__tests__/snapshot-detail.test.js
```

Expected: FAIL with "SnapshotDetailModal is not defined"

- [ ] **Step 3: 实现快照详情弹窗主组件**

```javascript
// app/static/js/components/snapshot-detail.js

import { DataVisualizer } from './data-visualizer.js';

export class SnapshotDetailModal {
    constructor() {
        this.snapshotId = null;
        this.snapshotData = null;
        this.communications = [];
        this.instances = {};
        this.filter = 'all'; // all, success, error
        this.searchTerm = '';
        this.selectedCommId = null;
        this.visualizer = new DataVisualizer();
        this.isLoading = false;
    }

    async show(snapshotId) {
        this.snapshotId = snapshotId;
        this.createContainer();
        this.showLoadingState();

        try {
            // 加载快照基础数据
            await this.loadSnapshotData();

            // 渲染基础界面
            this.renderBasicInfo();
            this.renderCommList();

            // 异步加载详细数据
            this.loadDetailedData();
        } catch (error) {
            this.showError(error.message);
        }
    }

    createContainer() {
        // 创建弹窗容器
        const modalHTML = `
            <div class="modal snapshot-detail-modal" id="snapshotDetailModalV2">
                <div class="modal-content" style="max-width: 1200px; max-height: 85vh;">
                    <div class="modal-header">
                        <h3>快照详情</h3>
                        <button class="modal-close" onclick="window.snapshotDetailModal.hide()">&times;</button>
                    </div>
                    <div class="modal-body" id="snapshotDetailContentV2">
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <p>正在加载快照数据...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 添加到body
        const div = document.createElement('div');
        div.innerHTML = modalHTML;
        document.body.appendChild(div.firstElementChild);

        // 显示弹窗
        document.getElementById('snapshotDetailModalV2').classList.add('active');
    }

    showLoadingState() {
        const content = document.getElementById('snapshotDetailContentV2');
        content.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>正在加载快照数据...</p>
            </div>
        `;
    }

    async loadSnapshotData() {
        const [snapshotRes, instancesRes] = await Promise.all([
            fetch(`${API_BASE}/api/v1/snapshots/${this.snapshotId}`, {
                headers: window.shared.getHeaders()
            }),
            fetch(`${API_BASE}/api/v1/snapshots/instances?snapshot_id=${this.snapshotId}`, {
                headers: window.shared.getHeaders()
            })
        ]);

        if (!snapshotRes.ok) throw new Error('加载快照失败');

        this.snapshotData = await snapshotRes.json();
        this.instances = await instancesRes.json();

        // 获取通信机信息
        const commsRes = await fetch(`${API_BASE}/api/v1/communications`, {
            headers: window.shared.getHeaders()
        });
        const communications = await commsRes.json();

        // 构建通信机映射
        this.communicationMap = {};
        communications.forEach(comm => {
            this.communicationMap[comm.id] = comm;
        });

        // 统计信息
        this.calculateStatistics();
    }

    calculateStatistics() {
        const stats = {
            total: this.instances.length,
            success: 0,
            error: 0,
            totalItems: 0
        };

        this.instances.forEach(instance => {
            const hasError = instance.environment_data?.some(item =>
                item.data_value?._error || item.data_value?._status === 'error'
            );

            if (hasError) {
                stats.error++;
                instance.status = 'error';
            } else {
                stats.success++;
                instance.status = 'success';
            }

            stats.totalItems += instance.environment_data?.length || 0;
        });

        this.statistics = stats;
    }

    renderBasicInfo() {
        const content = document.getElementById('snapshotDetailContentV2');
        const snapshot = this.snapshotData;

        content.innerHTML = `
            <div class="snapshot-detail-header">
                <h4>${snapshot.name}</h4>
                <p class="snapshot-meta">
                    创建时间: ${new Date(snapshot.snapshot_time).toLocaleString()} |
                    默认快照: ${snapshot.is_default ? '是' : '否'}
                    ${snapshot.description ? ` | ${snapshot.description}` : ''}
                </p>
            </div>

            ${this.renderStatistics(this.statistics)}

            <div class="filter-toolbar">
                <div class="filter-group">
                    <span class="filter-label">状态筛选：</span>
                    <button class="filter-btn ${this.filter === 'all' ? 'active' : ''}"
                            onclick="window.snapshotDetailModal.setFilter('all')">全部</button>
                    <button class="filter-btn ${this.filter === 'success' ? 'active' : ''}"
                            onclick="window.snapshotDetailModal.setFilter('success')">成功</button>
                    <button class="filter-btn ${this.filter === 'error' ? 'active' : ''}"
                            onclick="window.snapshotDetailModal.setFilter('error')">失败</button>
                </div>
                <div class="search-box">
                    <input type="text" class="search-input" placeholder="搜索通信机..."
                           value="${this.searchTerm}"
                           oninput="window.snapshotDetailModal.onSearch(this.value)">
                </div>
            </div>

            <div class="detail-content-layout">
                <div class="comm-list-panel">
                    <div class="panel-header">
                        <h5>通信机列表</h5>
                        <span class="count-badge">${this.statistics.total}</span>
                    </div>
                    <div class="comm-list" id="commList">
                        <!-- 通信机列表将在这里动态生成 -->
                    </div>
                </div>
                <div class="detail-panel" id="detailPanel">
                    <div class="empty-state">
                        <p>请选择左侧的通信机查看详细数据</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderStatistics(stats) {
        return `
            <div class="statistics-cards">
                <div class="stat-card">
                    <div class="stat-value">${stats.total}</div>
                    <div class="stat-label">通信机总数</div>
                </div>
                <div class="stat-card success">
                    <div class="stat-value">${stats.success}</div>
                    <div class="stat-label">采集成功</div>
                </div>
                <div class="stat-card error">
                    <div class="stat-value">${stats.error}</div>
                    <div class="stat-label">采集失败</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.totalItems}</div>
                    <div class="stat-label">检查项总数</div>
                </div>
            </div>
        `;
    }

    renderCommList() {
        const commList = document.getElementById('commList');
        const filteredInstances = this.filterCommunications(this.instances, this.filter);

        commList.innerHTML = filteredInstances.map(instance => {
            const comm = this.communicationMap[instance.communication_id];
            if (!comm) return '';

            return `
                <div class="comm-item ${instance.status === 'error' ? 'has-error' : ''}"
                     onclick="window.snapshotDetailModal.selectComm(${instance.id})"
                     data-comm-id="${instance.id}">
                    <div class="comm-info">
                        <div class="comm-name">${comm.name}</div>
                        <div class="comm-ip">${comm.ip_address}:${comm.port || 22}</div>
                    </div>
                    <div class="comm-status">
                        <span class="status-badge ${instance.status}">
                            ${instance.status === 'success' ? '✓' : '✗'}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }

    filterCommunications(instances, filter) {
        if (filter === 'all') return instances;

        return instances.filter(instance => {
            const hasError = instance.environment_data?.some(item =>
                item.data_value?._error || item.data_value?._status === 'error'
            );

            if (filter === 'success') return !hasError;
            if (filter === 'error') return hasError;
            return true;
        });
    }

    onSearch(searchTerm) {
        this.searchTerm = searchTerm.toLowerCase();
        this.renderCommList();
    }

    setFilter(filter) {
        this.filter = filter;
        this.renderCommList();
        this.updateFilterButtons();
    }

    updateFilterButtons() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.filter-btn[onclick*="${this.filter}"]`).classList.add('active');
    }

    async selectComm(instanceId) {
        // 更新选中状态
        document.querySelectorAll('.comm-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-comm-id="${instanceId}"]`).classList.add('selected');

        // 显示加载状态
        const detailPanel = document.getElementById('detailPanel');
        detailPanel.innerHTML = `
            <div class="loading-detail">
                <div class="loading-spinner-small"></div>
                <p>正在加载详细数据...</p>
            </div>
        `;

        try {
            // 加载实例详细数据
            const response = await fetch(`${API_BASE}/api/v1/snapshots/instances/${instanceId}`, {
                headers: window.shared.getHeaders()
            });

            if (!response.ok) throw new Error('加载详细数据失败');

            const instanceData = await response.json();
            this.renderInstanceDetail(instanceData);

        } catch (error) {
            detailPanel.innerHTML = `
                <div class="error-state">
                    <p>加载失败：${error.message}</p>
                </div>
            `;
        }
    }

    renderInstanceDetail(instanceData) {
        const detailPanel = document.getElementById('detailPanel');
        const comm = this.communicationMap[instanceData.communication_id];

        detailPanel.innerHTML = `
            <div class="instance-detail-header">
                <h5>${comm.name} - 详细数据</h5>
                <p class="instance-meta">${comm.ip_address}:${comm.port || 22}</p>
            </div>
            <div class="instance-data-container">
                ${this.renderEnvironmentData(instanceData.environment_data || [])}
            </div>
        `;
    }

    renderEnvironmentData(envData) {
        if (!envData || envData.length === 0) {
            return '<div class="empty-state">暂无环境数据</div>';
        }

        // 按检查项类型分组
        const groupedData = this.groupByCheckItemType(envData);

        return Object.entries(groupedData).map(([type, items]) => {
            const typeTitle = this.getCheckItemTypeTitle(type);
            return `
                <div class="check-item-group">
                    <h6 class="group-title">${typeTitle}</h6>
                    <div class="group-content">
                        ${items.map(item => this.renderCheckItem(item)).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    groupByCheckItemType(envData) {
        const groups = {};

        envData.forEach(item => {
            const type = this.inferCheckItemType(item);
            if (!groups[type]) groups[type] = [];
            groups[type].push(item);
        });

        return groups;
    }

    inferCheckItemType(item) {
        const name = item.check_item?.name || '';
        const checkType = item.check_item?.type || '';

        if (checkType.includes('file') || name.includes('文件')) return 'file';
        if (checkType.includes('process') || name.includes('进程')) return 'process';
        if (checkType.includes('port') || name.includes('端口')) return 'port';
        if (checkType.includes('network') || name.includes('网络')) return 'network';

        return 'other';
    }

    getCheckItemTypeTitle(type) {
        const titles = {
            file: '文件检查项',
            process: '进程检查项',
            port: '端口检查项',
            network: '网络检查项',
            other: '其他检查项'
        };
        return titles[type] || '未知类型';
    }

    renderCheckItem(item) {
        const dataValue = item.data_value || {};

        // 检查是否有错误
        if (dataValue._error || dataValue._status === 'error') {
            return this.visualizer.renderErrorData({
                message: dataValue._error || '采集失败',
                type: dataValue._error_type
            });
        }

        // 根据数据类型选择渲染方式
        const type = this.inferCheckItemType(item);

        switch (type) {
            case 'file':
                return this.visualizer.renderFileData(dataValue);
            case 'process':
                return this.visualizer.renderProcessData(dataValue);
            case 'port':
                return this.visualizer.renderPortData(dataValue);
            default:
                return this.renderRawData(dataValue);
        }
    }

    renderRawData(data) {
        return `
            <div class="raw-data-card">
                <pre class="raw-data-content">${JSON.stringify(data, null, 2)}</pre>
            </div>
        `;
    }

    hide() {
        const modal = document.getElementById('snapshotDetailModalV2');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    }

    // 供全局调用的方法
    async loadDetailedData() {
        // 分批加载详细数据
        const batchSize = 3;

        for (let i = 0; i < this.instances.length; i += batchSize) {
            const batch = this.instances.slice(i, i + batchSize);
            await Promise.all(batch.map(instance =>
                this.preloadInstanceData(instance.id)
            ));
        }
    }

    async preloadInstanceData(instanceId) {
        // 预加载数据到缓存
        try {
            const response = await fetch(`${API_BASE}/api/v1/snapshots/instances/${instanceId}`, {
                headers: window.shared.getHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.instanceCache = this.instanceCache || {};
                this.instanceCache[instanceId] = data;
            }
        } catch (error) {
            console.error(`预加载实例 ${instanceId} 失败:`, error);
        }
    }
}

// 创建全局实例
window.snapshotDetailModal = new SnapshotDetailModal();
```

- [ ] **Step 5: 运行测试确保通过**

```bash
npm test app/static/js/components/__tests__/snapshot-detail.test.js
```

Expected: PASS

- [ ] **Step 6: 修改原有的viewSnapshotDetail函数**

```javascript
// 在 app/static/js/snapshots.js 中修改 viewSnapshotDetail 函数
async function viewSnapshotDetail(snapshotId) {
    // 使用新的弹窗组件
    window.snapshotDetailModal.show(snapshotId);
}
```

- [ ] **Step 7: 提交代码**

```bash
git add app/static/js/components/snapshot-detail.js
app/static/js/components/__tests__/snapshot-detail.test.js
app/static/js/snapshots.js
git commit -m "feat: add snapshot detail modal main component

- Implement SnapshotDetailModal class with full functionality
- Add statistics cards, filter toolbar, and communication list
- Implement progressive data loading and caching
- Replace original viewSnapshotDetail function with new implementation"
```

---

### Task 3: 创建专用样式文件

**Files:**
- Create: `app/static/css/snapshot-detail.css`

- [ ] **Step 1: 编写快照详情弹窗样式**

```css
/* 快照详情弹窗专用样式 */

.snapshot-detail-modal .modal-content {
    display: flex;
    flex-direction: column;
}

.snapshot-detail-header {
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid #e8e8e8;
}

.snapshot-detail-header h4 {
    margin: 0 0 8px 0;
    font-size: 20px;
    color: #333;
}

.snapshot-meta {
    margin: 0;
    color: #666;
    font-size: 14px;
}

/* 统计卡片 */
.statistics-cards {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;
}

.stat-card {
    flex: 1;
    background: #f5f5f5;
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    transition: all 0.3s ease;
    cursor: pointer;
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-card.success {
    background: #f6ffed;
    border: 1px solid #b7eb8f;
}

.stat-card.error {
    background: #fff2f0;
    border: 1px solid #ffccc7;
}

.stat-value {
    font-size: 32px;
    font-weight: bold;
    color: #333;
    line-height: 1;
}

.stat-card.success .stat-value {
    color: #52c41a;
}

.stat-card.error .stat-value {
    color: #f5222d;
}

.stat-label {
    font-size: 14px;
    color: #666;
    margin-top: 8px;
}

/* 筛选工具栏 */
.filter-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding: 12px;
    background: #fafafa;
    border-radius: 6px;
}

.filter-group {
    display: flex;
    align-items: center;
    gap: 12px;
}

.filter-label {
    font-size: 14px;
    color: #666;
}

.filter-btn {
    padding: 6px 16px;
    border: 1px solid #d9d9d9;
    background: white;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.filter-btn:hover {
    border-color: #1890ff;
    color: #1890ff;
}

.filter-btn.active {
    background: #1890ff;
    border-color: #1890ff;
    color: white;
}

.search-box {
    position: relative;
    width: 250px;
}

.search-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    font-size: 14px;
    transition: border-color 0.3s;
}

.search-input:focus {
    outline: none;
    border-color: #1890ff;
}

/* 布局 */
.detail-content-layout {
    display: flex;
    gap: 16px;
    height: calc(100% - 200px);
}

.comm-list-panel {
    width: 280px;
    background: #fafafa;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
}

.panel-header {
    padding: 16px;
    border-bottom: 1px solid #e8e8e8;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.panel-header h5 {
    margin: 0;
    font-size: 16px;
    color: #333;
}

.count-badge {
    background: #1890ff;
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
}

.comm-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
}

.comm-item {
    padding: 12px;
    margin-bottom: 8px;
    background: white;
    border: 1px solid #e8e8e8;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.comm-item:hover {
    border-color: #1890ff;
    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.1);
}

.comm-item.selected {
    border-color: #1890ff;
    background: #f0f9ff;
}

.comm-item.has-error {
    border-left: 3px solid #f5222d;
}

.comm-info {
    flex: 1;
}

.comm-name {
    font-weight: 500;
    color: #333;
    margin-bottom: 4px;
}

.comm-ip {
    font-size: 12px;
    color: #666;
}

.comm-status {
    display: flex;
    align-items: center;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-size: 14px;
}

.status-badge.success {
    background: #f6ffed;
    color: #52c41a;
}

.status-badge.error {
    background: #fff2f0;
    color: #f5222d;
}

.detail-panel {
    flex: 1;
    background: white;
    border-radius: 8px;
    padding: 16px;
    overflow-y: auto;
}

/* 加载状态 */
.loading-state, .loading-detail {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: #666;
}

.loading-spinner, .loading-spinner-small {
    width: 40px;
    height: 40px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #1890ff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
}

.loading-spinner-small {
    width: 24px;
    height: 24px;
    border-width: 2px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* 空状态 */
.empty-state {
    text-align: center;
    padding: 40px;
    color: #999;
}

.error-state {
    text-align: center;
    padding: 40px;
    color: #f5222d;
}

/* 实例详情 */
.instance-detail-header {
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e8e8e8;
}

.instance-detail-header h5 {
    margin: 0 0 4px 0;
    font-size: 18px;
    color: #333;
}

.instance-meta {
    margin: 0;
    color: #666;
    font-size: 14px;
}

/* 检查项分组 */
.check-item-group {
    margin-bottom: 24px;
}

.group-title {
    margin: 0 0 12px 0;
    font-size: 16px;
    color: #333;
    padding-bottom: 8px;
    border-bottom: 1px solid #e8e8e8;
}

.group-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

/* 文件信息卡片 */
.file-info-card {
    background: #f8f9fa;
    border: 1px solid #e8e8e8;
    border-radius: 6px;
    padding: 16px;
    transition: all 0.3s ease;
}

.file-info-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.file-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.file-path {
    font-family: monospace;
    font-size: 14px;
    color: #1890ff;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.file-status {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
}

.file-status.exists {
    background: #f6ffed;
    color: #52c41a;
}

.file-status.missing {
    background: #fff2f0;
    color: #f5222d;
}

.file-attributes {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.attr-row {
    display: flex;
    gap: 24px;
}

.attr-item {
    display: flex;
    align-items: center;
    gap: 8px;
}

.attr-label {
    font-size: 13px;
    color: #666;
    min-width: 60px;
}

.attr-value {
    font-size: 13px;
    color: #333;
    font-weight: 500;
}

/* 进程网格 */
.process-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
}

.process-card {
    background: #f8f9fa;
    border: 1px solid #e8e8e8;
    border-radius: 6px;
    padding: 12px;
    transition: all 0.3s ease;
}

.process-card.running {
    border-left: 3px solid #52c41a;
}

.process-card.stopped {
    border-left: 3px solid #f5222d;
}

.process-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.process-name {
    font-weight: 500;
    color: #333;
}

.process-status-badge {
    font-size: 16px;
}

.process-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.info-item {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
}

.info-label {
    color: #666;
}

.info-value {
    color: #333;
    font-weight: 500;
}

/* 端口网格 */
.port-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
}

.port-card {
    background: #f8f9fa;
    border: 1px solid #e8e8e8;
    border-radius: 6px;
    padding: 12px;
    text-align: center;
    transition: all 0.3s ease;
}

.port-card.listening {
    border-left: 3px solid #52c41a;
}

.port-card.closed {
    border-left: 3px solid #d9d9d9;
}

.port-number {
    font-size: 20px;
    font-weight: bold;
    color: #333;
    margin-bottom: 4px;
}

.port-protocol {
    font-size: 12px;
    color: #666;
    margin-bottom: 4px;
}

.port-status {
    font-size: 12px;
    color: #666;
}

/* 错误数据卡片 */
.error-data-card {
    background: #fff2f0;
    border: 1px solid #ffccc7;
    border-radius: 6px;
    padding: 16px;
}

.error-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}

.error-icon {
    font-size: 18px;
}

.error-title {
    font-weight: 500;
    color: #f5222d;
    margin: 0;
}

.error-message {
    color: #666;
    font-size: 14px;
    margin-bottom: 4px;
}

.error-type {
    font-size: 12px;
    color: #999;
}

/* 原始数据卡片 */
.raw-data-card {
    background: #f8f9fa;
    border: 1px solid #e8e8e8;
    border-radius: 6px;
    padding: 12px;
}

.raw-data-content {
    font-family: monospace;
    font-size: 12px;
    line-height: 1.5;
    margin: 0;
    max-height: 300px;
    overflow-y: auto;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .snapshot-detail-modal .modal-content {
        width: 95vw;
        height: 90vh;
    }

    .statistics-cards {
        flex-wrap: wrap;
    }

    .stat-card {
        flex: 1 1 calc(50% - 8px);
        min-width: 120px;
    }

    .detail-content-layout {
        flex-direction: column;
        height: auto;
    }

    .comm-list-panel {
        width: 100%;
        height: 200px;
    }

    .detail-panel {
        min-height: 300px;
    }

    .filter-toolbar {
        flex-direction: column;
        gap: 12px;
        align-items: stretch;
    }

    .search-box {
        width: 100%;
    }
}
```

- [ ] **Step 2: 在dashboard.html中添加样式引用**

```html
<!-- 在 app/static/dashboard.html 的head标签中添加 -->
<link rel="stylesheet" href="/static/css/snapshot-detail.css?v=1">
```

- [ ] **Step 3: 提交代码**

```bash
git add app/static/css/snapshot-detail.css
app/static/dashboard.html
git commit -m "feat: add snapshot detail modal styles

- Create comprehensive CSS for new snapshot detail modal
- Add responsive design for mobile devices
- Style statistics cards, filter toolbar, and data visualization
- Add loading animations and empty states"
```

---

### Task 4: 集成测试和最终优化

**Files:**
- Modify: `app/static/js/snapshots.js` (update exports)
- Modify: `app/static/dashboard.html` (add module loading)
- Test: 手动测试整个功能流程

- [ ] **Step 1: 更新快照模块导出**

```javascript
// 在 app/static/js/snapshots.js 文件末尾添加
// 导出模块供其他模块使用
window.snapshots = {
    // ... 保持原有导出 ...
    viewSnapshotDetail,
    // 添加新的详情弹窗
    openDetailModal: () => window.snapshotDetailModal?.show(),
    closeDetailModal: () => window.snapshotDetailModal?.hide()
};
```

- [ ] **Step 2: 更新dashboard.html的模块加载**

```html
<!-- 在 app/static/dashboard.html 的脚本加载部分添加 -->
<script>
    // 确保shared模块加载完成后再加载其他模块
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🔧 开始加载模块...');

        // 动态加载其他模块（添加版本号防止缓存）
        const modules = [
            '/static/js/communications.js?v=14',
            '/static/js/checkitems.js?v=14',
            '/static/js/snapshots.js?v=19', // 更新版本号
            '/static/js/reports.js',
            '/static/js/checks.js',
            '/static/js/ssh-keys.js?v=1',
            '/static/js/components/data-visualizer.js?v=1', // 新增
            '/static/js/components/snapshot-detail.js?v=1', // 新增
            '/static/js/dashboard.js?v=15'
        ];

        // ... 其余代码保持不变 ...
    });
</script>
```

- [ ] **Step 3: 手动测试功能**

1. 启动应用：
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

2. 在浏览器中访问 http://localhost:8000
3. 登录系统
4. 进入快照管理页面
5. 点击"查看"按钮测试新的弹窗
6. 验证以下功能：
   - 统计卡片显示正确
   - 通信机列表加载正常
   - 筛选功能工作正常
   - 点击通信机加载详细数据
   - 不同类型数据的可视化展示
   - 错误状态正确显示

- [ ] **Step 4: 修复发现的问题**

根据测试结果修复可能存在的问题，如：
- API调用错误
- 样式显示问题
- 数据加载失败
- 交互逻辑错误

- [ ] **Step 5: 提交最终代码**

```bash
git add -A
git commit -m "feat: complete snapshot detail modal optimization

- Integrate new snapshot detail modal with data visualization
- Add progressive loading and interactive filtering
- Implement responsive design for mobile devices
- Update module loading and exports
- Manual testing completed"
```

---

## 实现总结

本实现计划完成了快照详情弹窗的全面优化：

1. **数据可视化组件**：创建了DataVisualizer类，支持文件、进程、端口等不同类型数据的可视化展示
2. **快照详情弹窗主组件**：实现了新的SnapshotDetailModal类，包含统计卡片、筛选功能、渐进式加载等
3. **专用样式文件**：创建了完整的CSS样式，支持响应式设计
4. **性能优化**：实现了数据缓存和分批加载机制
5. **用户体验提升**：添加了加载动画、错误处理、空状态提示等

新弹窗界面更加直观易用，用户可以快速了解快照数据的整体情况，并通过分类展示深入查看详细信息。