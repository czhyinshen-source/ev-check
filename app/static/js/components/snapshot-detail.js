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
        const container = document.createElement('div');
        container.innerHTML = modalHTML.trim();
        const modalElement = container.firstElementChild;
        if (modalElement) {
            document.body.appendChild(modalElement);
            // 显示弹窗
            modalElement.classList.add('active');
        }
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
            fetch(`${window.shared.API_BASE}/api/v1/snapshots/${this.snapshotId}`, {
                headers: window.shared.getHeaders()
            }),
            fetch(`${window.shared.API_BASE}/api/v1/snapshots/instances?snapshot_id=${this.snapshotId}`, {
                headers: window.shared.getHeaders()
            })
        ]);

        if (!snapshotRes.ok) throw new Error('加载快照失败');

        this.snapshotData = await snapshotRes.json();
        this.instances = await instancesRes.json();

        // 获取通信机信息
        const commsRes = await fetch(`${window.shared.API_BASE}/api/v1/communications`, {
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
            // 使用缓存的状态或重新计算
            const status = instance.status || this.calculateInstanceStatus(instance);
            return status === filter;
        });
    }

    calculateInstanceStatus(instance) {
        const hasError = instance.environment_data?.some(item =>
            item.data_value?._error || item.data_value?._status === 'error'
        );
        return hasError ? 'error' : 'success';
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
            const response = await fetch(`${window.shared.API_BASE}/api/v1/snapshots/instances/${instanceId}`, {
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

    showError(message) {
        const content = document.getElementById('snapshotDetailContentV2');
        content.innerHTML = `
            <div class="error-state">
                <p>加载失败：${message}</p>
                <button class="btn btn-primary" onclick="window.snapshotDetailModal.hide()">关闭</button>
            </div>
        `;
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
            const response = await fetch(`${window.shared.API_BASE}/api/v1/snapshots/instances/${instanceId}`, {
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