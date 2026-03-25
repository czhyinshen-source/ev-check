// 报告管理模块
// 全局变量
let currentPage = 1;
let pageSize = 10;
let totalItems = 0;
let currentFilters = {};

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 检查登录状态
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // 显示当前用户
    const username = localStorage.getItem('username') || '未知用户';
    const currentUserEl = document.getElementById('currentUser');
    if (currentUserEl) {
        currentUserEl.textContent = `当前用户: ${username}`;
    }

    // 加载规则列表（用于筛选）
    loadRulesForFilter();

    // 加载报告列表
    loadBatchReports();

    // 绑定筛选事件
    document.getElementById('startTime').addEventListener('change', debounce(loadBatchReports, 300));
    document.getElementById('endTime').addEventListener('change', debounce(loadBatchReports, 300));
    document.getElementById('ruleFilter').addEventListener('change', debounce(loadBatchReports, 300));
    document.getElementById('statusFilter').addEventListener('change', debounce(loadBatchReports, 300));
});

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// 加载规则列表（用于筛选）
async function loadRulesForFilter() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/check-rules`, {
            headers: getHeaders()
        });
        if (!res.ok) return;
        const rules = await res.json();
        const select = document.getElementById('ruleFilter');
        select.innerHTML = `<option value="">全部规则</option>` +
            rules.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    } catch (e) {
        console.error('加载规则列表失败:', e);
    }
}

// 获取筛选条件
function getFilters() {
    return {
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        ruleId: document.getElementById('ruleFilter').value,
        status: document.getElementById('statusFilter').value
    };
}

// 应用筛选
function applyFilters() {
    currentPage = 1;
    loadBatchReports();
}

// 重置筛选
function resetFilters() {
    document.getElementById('startTime').value = '';
    document.getElementById('endTime').value = '';
    document.getElementById('ruleFilter').value = '';
    document.getElementById('statusFilter').value = '';
    currentPage = 1;
    loadBatchReports();
}

// 加载批量报告（聚合视图）
async function loadBatchReports() {
    const container = document.getElementById('reportList');
    const paginationEl = document.getElementById('pagination');

    try {
        // 先获取所有检查结果
        const filters = getFilters();
        let url = `${API_BASE}/api/v1/checks?skip=${(currentPage - 1) * pageSize}&limit=${pageSize}`;

        if (filters.ruleId) {
            url += `&rule_id=${filters.ruleId}`;
        }
        if (filters.status) {
            url += `&status=${filters.status}`;
        }

        const res = await fetch(url, {
            headers: getHeaders()
        });

        if (!res.ok) {
            throw new Error('API请求失败');
        }

        const data = await res.json();
        const results = Array.isArray(data) ? data : [];

        // 按 rule_id + start_time 聚合（前端聚合用于简化展示）
        const aggregated = aggregateResults(results);

        if (aggregated.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📋</div>
                    <p>暂无检查报告</p>
                </div>
            `;
            paginationEl.style.display = 'none';
            return;
        }

        // 渲染报告卡片
        container.innerHTML = aggregated.map(report => renderReportCard(report)).join('');
        paginationEl.style.display = 'flex';

    } catch (e) {
        console.error('加载报告列表失败:', e);
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">❌</div>
                <p>加载失败，请刷新页面重试</p>
            </div>
        `;
        paginationEl.style.display = 'none';
    }
}

// 聚合检查结果
function aggregateResults(results) {
    if (!results || results.length === 0) return [];

    // 按 rule_id + start_time（按分钟聚合）分组
    const groups = {};

    results.forEach(r => {
        const startMinute = r.start_time ? r.start_time.substring(0, 16) : 'unknown';
        const key = `${r.rule_id || 0}_${startMinute}`;

        if (!groups[key]) {
            groups[key] = {
                id: r.id,
                rule_id: r.rule_id,
                rule_name: r.rule_name,
                snapshot_id: r.snapshot_id,
                snapshot_name: r.snapshot_name,
                start_time: r.start_time,
                end_time: r.end_time,
                duration_seconds: r.duration_seconds,
                server_count: 0,
                summary: { total: 0, passed: 0, failed: 0, errors: 0 },
                result_ids: [],
                status: 'success'
            };
        }

        const group = groups[key];
        group.server_count += 1;
        group.result_ids.push(r.id);

        // 聚合摘要
        if (r.summary) {
            group.summary.total += r.summary.total || 0;
            group.summary.passed += r.summary.passed || 0;
            group.summary.failed += r.summary.failed || 0;
            group.summary.errors += r.summary.errors || 0;
        }

        // 确定整体状态
        if (r.status === 'running') {
            group.status = 'running';
        } else if (r.status === 'failed' || r.status === 'error') {
            if (group.status !== 'running') {
                group.status = 'failed';
            }
        }
    });

    return Object.values(groups).sort((a, b) =>
        new Date(b.start_time) - new Date(a.start_time)
    );
}

// 渲染报告卡片
function renderReportCard(report) {
    const statusClass = getStatusClass(report.status);
    const statusText = getStatusText(report.status);
    const duration = formatDuration(report.duration_seconds);

    return `
        <div class="report-card">
            <div class="report-header">
                <div class="report-title">
                    ${report.rule_name || `规则 #${report.rule_id || '-'}`}
                    <span class="report-status ${statusClass}">${statusText}</span>
                </div>
                <div class="report-time">
                    ${report.start_time ? new Date(report.start_time).toLocaleString() : '-'}
                </div>
            </div>

            <div class="report-info">
                <span>📁 关联快照: ${report.snapshot_name || '-'}</span>
                <span>🖥️ 服务器: ${report.server_count} 台</span>
                <span>⏱️ 耗时: ${duration}</span>
            </div>

            <div class="report-summary">
                <div class="summary-item">
                    <span class="summary-label">总检查项:</span>
                    <span class="summary-value total">${report.summary.total}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">✅ 通过:</span>
                    <span class="summary-value pass">${report.summary.passed}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">❌ 失败:</span>
                    <span class="summary-value fail">${report.summary.failed}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">⚠️ 异常:</span>
                    <span class="summary-value error">${report.summary.errors}</span>
                </div>
            </div>

            <div class="report-actions">
                <button class="btn btn-primary" onclick="viewReport(${report.id})">查看报告</button>
                <button class="btn btn-secondary" onclick="exportPDF(${report.id})">导出PDF</button>
            </div>
        </div>
    `;
}

// 获取状态样式类
function getStatusClass(status) {
    const map = {
        'success': 'success',
        'completed': 'success',
        'failed': 'failed',
        'error': 'failed',
        'running': 'running',
        'pending': 'running',
        'completed_with_errors': 'warning',
        'cancelled': 'warning'
    };
    return map[status] || 'warning';
}

// 获取状态文本
function getStatusText(status) {
    const map = {
        'success': '成功',
        'completed': '完成',
        'failed': '失败',
        'error': '异常',
        'running': '进行中',
        'pending': '等待中',
        'completed_with_errors': '部分成功',
        'cancelled': '已取消'
    };
    return map[status] || status;
}

// 格式化时长
function formatDuration(seconds) {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) {
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return `${min}分${sec}秒`;
    }
    const hour = Math.floor(seconds / 3600);
    const min = Math.floor((seconds % 3600) / 60);
    return `${hour}时${min}分`;
}

// 查看报告详情
function viewReport(resultId) {
    window.location.href = `/report-detail.html?result_id=${resultId}`;
}

// 导出PDF
function exportPDF(resultId) {
    const token = localStorage.getItem('token');
    const url = `${API_BASE}/api/v1/checks/${resultId}/export?format=pdf`;
    // 使用 fetch 下载并带上认证头
    fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('导出失败');
        return response.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `check_result_${resultId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    })
    .catch(e => {
        console.error('导出PDF失败:', e);
        alert('导出PDF失败，请重试');
    });
}

// 退出登录
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/login.html';
}

// 获取请求头
function getHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// 导出函数到全局
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.viewReport = viewReport;
window.exportPDF = exportPDF;
window.logout = logout;
