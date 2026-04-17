/**
 * 全局通用分页组件
 * 支持 URL 驱动和回调驱动两种模式
 */
class PaginationManager {
    constructor() {
        this.stylesId = 'pagination-component-styles';
        this._injectStyles();
    }

    /**
     * 注入分页组件样式
     */
    _injectStyles() {
        if (document.getElementById(this.stylesId)) return;

        const style = document.createElement('style');
        style.id = this.stylesId;
        style.textContent = `
            .pagination-wrapper {
                position: sticky;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 20px;
                background: rgba(15, 23, 42, 0.9);
                backdrop-filter: blur(10px);
                border-top: 1px solid rgba(255, 255, 255, 0.08);
                box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.4);
                margin: 0 -20px -20px -20px;
                z-index: 100;
            }
            .pagination-info {
                font-size: 13px;
                color: #94a3b8;
            }
            .pagination-controls {
                display: flex;
                gap: 6px;
                align-items: center;
            }
            .pagination-btn {
                min-width: 32px;
                height: 32px;
                padding: 0 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                color: #cbd5e1;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s ease;
                user-select: none;
                text-decoration: none;
            }
            .pagination-btn:hover:not(.disabled) {
                background: rgba(99, 102, 241, 0.1);
                border-color: rgba(99, 102, 241, 0.4);
                color: #818cf8;
            }
            .pagination-btn.active {
                background: #6366f1;
                border-color: #6366f1;
                color: white;
                box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
            }
            .pagination-btn.disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            .pagination-ellipsis {
                color: #475569;
                padding: 0 4px;
            }
            .pagination-size-select {
                background: rgba(15, 23, 42, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 6px;
                color: #e2e8f0;
                padding: 4px 10px;
                font-size: 12px;
                outline: none;
                margin-left: 8px;
                cursor: pointer;
                transition: all 0.2s;
                appearance: none;
                -webkit-appearance: none;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2394a3b8' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E");
                background-repeat: no-repeat;
                background-position: calc(100% - 8px) center;
                padding-right: 28px;
            }
            .pagination-size-select:hover {
                border-color: #6366f1;
                background-color: rgba(30, 41, 59, 1);
                box-shadow: 0 0 10px rgba(99, 102, 241, 0.2);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 初始化分页器
     * @param {string} containerId 容器ID
     * @param {number} total 总记录数
     * @param {number} currentPage 当前页 (从1开始)
     * @param {number} pageSize 每页大小
     * @param {function} onPageChange 切换回调 (page, size)
     */
    render(containerId, total, currentPage, pageSize, onPageChange) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const totalPages = Math.ceil(total / pageSize);
        if (total === 0) {
            container.innerHTML = ''; 
            return;
        }

        const startIdx = (currentPage - 1) * pageSize + 1;
        const endIdx = Math.min(currentPage * pageSize, total);

        let html = `
            <div class="pagination-wrapper">
                <div class="pagination-info">
                    显示 ${startIdx}-${endIdx} 条，共 ${total} 条
                    <span style="margin-left: 15px; color: #64748b;">每页显示:</span>
                    <select class="pagination-size-select" onchange="window.paginationManager._handleSizeChange('${containerId}', this.value)">
                        ${[5, 10, 20, 50, 100].map(s => `<option value="${s}" ${s === pageSize ? 'selected' : ''}>${s} 条/页</option>`).join('')}
                    </select>
                </div>
                <div class="pagination-controls">
        `;

        // 上一页
        html += `<a href="javascript:void(0)" class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" onclick="window.paginationManager._handlePageClick('${containerId}', ${currentPage - 1})">&lt;</a>`;

        // 页码逻辑
        const pages = this._getVisiblePages(currentPage, totalPages);
        pages.forEach(p => {
            if (p === '...') {
                html += `<span class="pagination-ellipsis">...</span>`;
            } else {
                html += `<a href="javascript:void(0)" class="pagination-btn ${p === currentPage ? 'active' : ''}" onclick="window.paginationManager._handlePageClick('${containerId}', ${p})">${p}</a>`;
            }
        });

        // 下一页
        html += `<a href="javascript:void(0)" class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" onclick="window.paginationManager._handlePageClick('${containerId}', ${currentPage + 1})">&gt;</a>`;

        html += `</div></div>`;
        container.innerHTML = html;

        // 保存状态
        this._instances = this._instances || {};
        this._instances[containerId] = { total, currentPage, pageSize, onPageChange };
    }

    _getVisiblePages(current, total) {
        if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

        const pages = [1];
        if (current > 3) pages.push('...');

        const start = Math.max(2, current - 1);
        const end = Math.min(total - 1, current + 1);

        for (let i = start; i <= end; i++) {
            if (pages.indexOf(i) === -1) pages.push(i);
        }

        if (current < total - 2) pages.push('...');
        if (pages.indexOf(total) === -1) pages.push(total);

        return pages;
    }

    _handlePageClick(containerId, page) {
        const instance = this._instances[containerId];
        if (!instance || page < 1 || page > Math.ceil(instance.total / instance.pageSize) || page === instance.currentPage) return;
        
        instance.onPageChange(page, instance.pageSize);
    }

    _handleSizeChange(containerId, size) {
        const instance = this._instances[containerId];
        if (!instance) return;
        
        const newSize = parseInt(size);
        instance.onPageChange(1, newSize); // 切换每页大小通常回到第一页
    }
    
    /**
     * 从 URL 解析当前分页状态
     */
    getParamsFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return {
            page: parseInt(params.get('page')) || 1,
            size: parseInt(params.get('size')) || 5
        };
    }

    /**
     * 更新 URL 中的分页参数
     */
    updateUrlParams(page, size) {
        const url = new URL(window.location);
        url.searchParams.set('page', page);
        url.searchParams.set('size', size);
        window.history.pushState({}, '', url);
    }
}

// 单例挂载
window.paginationManager = new PaginationManager();
