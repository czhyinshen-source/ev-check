export class DataVisualizer {
    constructor() {
        // 模板方法已移除，直接渲染
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