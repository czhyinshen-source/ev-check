// 报告详情页模块
let resultId = null;
let reportData = null;
let details = [];
let currentStatusFilter = 'all';
let currentTypeFilter = '';

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

    // 获取 result_id 参数
    const urlParams = new URLSearchParams(window.location.search);
    resultId = urlParams.get('result_id');
    if (!resultId) {
        showError('缺少 result_id 参数');
        return;
    }

    // 加载报告详情
    loadReportDetail();
});

// 加载报告详情
async function loadReportDetail() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/checks/${resultId}`, {
            headers: getHeaders()
        });

        if (!res.ok) {
            throw new Error('API请求失败');
        }

        reportData = await res.json();
        details = reportData.details || [];

        // 渲染页面
        renderOverview();
        renderSummary();
        renderCheckGroups();

        // 显示工具栏
        document.getElementById('toolbar').style.display = 'flex';
        document.getElementById('summaryCards').style.display = 'grid';

    } catch (e) {
        console.error('加载报告详情失败:', e);
        showError('加载报告详情失败');
    }
}

// 渲染概览卡片
function renderOverview() {
    const card = document.getElementById('overviewCard');
    const duration = formatDuration(reportData.duration_seconds);
    const statusClass = getStatusClass(reportData.status);
    const statusText = getStatusText(reportData.status);

    card.innerHTML = `
        <div class="overview-header">
            <div class="overview-title">
                ${reportData.rule_name || `检查规则 #${reportData.rule_id || '-'}`}
            </div>
            <span class="overview-status ${statusClass}">${statusText}</span>
        </div>
        <div class="overview-info">
            <div class="info-item">
                <span class="info-label">执行ID</span>
                <span class="info-value">#${reportData.id}</span>
            </div>
            <div class="info-item">
                <span class="info-label">执行时间</span>
                <span class="info-value">${formatDateTime(reportData.start_time)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">服务器</span>
                <span class="info-value">${reportData.communication_name || '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">IP地址</span>
                <span class="info-value">${reportData.communication_ip || '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">关联快照</span>
                <span class="info-value">${reportData.snapshot_name || '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">执行耗时</span>
                <span class="info-value">${duration}</span>
            </div>
        </div>
    `;
}

// 渲染汇总统计
function renderSummary() {
    const summary = reportData.summary || { total: 0, passed: 0, failed: 0, errors: 0 };

    document.getElementById('totalCount').textContent = summary.total;
    document.getElementById('passCount').textContent = summary.passed;
    document.getElementById('failCount').textContent = summary.failed;
    document.getElementById('errorCount').textContent = summary.errors;
}

// 渲染检查项分组
function renderCheckGroups() {
    const container = document.getElementById('checkGroups');

    // 应用筛选
    let filteredDetails = details;
    if (currentStatusFilter !== 'all') {
        filteredDetails = filteredDetails.filter(d => d.status === currentStatusFilter);
    }
    if (currentTypeFilter) {
        filteredDetails = filteredDetails.filter(d => d.check_item_type === currentTypeFilter);
    }

    if (filteredDetails.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📋</div>
                <p>暂无检查项数据</p>
            </div>
        `;
        return;
    }

    // 按 check_item_name 分组
    const groups = {};
    filteredDetails.forEach(detail => {
        const key = detail.check_item_name || `检查项 #${detail.check_item_id}`;
        if (!groups[key]) {
            groups[key] = {
                name: key,
                type: detail.check_item_type || 'unknown',
                details: [],
                passed: 0,
                failed: 0,
                errors: 0
            };
        }
        groups[key].details.push(detail);
        if (detail.status === 'pass') groups[key].passed++;
        else if (detail.status === 'fail') groups[key].failed++;
        else groups[key].errors++;
    });

    // 按失败数排序（失败的排前面）
    const sortedGroups = Object.values(groups).sort((a, b) => {
        if (b.failed !== a.failed) return b.failed - a.failed;
        if (b.errors !== a.errors) return b.errors - a.errors;
        return a.passed - b.passed;
    });

    container.innerHTML = sortedGroups.map((group, index) => renderCheckGroup(group, index)).join('');
}

// 渲染单个检查项分组
function renderCheckGroup(group, index) {
    const hasFail = group.failed > 0;
    const hasError = group.errors > 0;
    const extraClass = hasFail ? 'has-fail' : (hasError ? 'has-error' : '');

    return `
        <div class="check-group ${extraClass}" id="group-${index}">
            <div class="check-group-header" onclick="toggleGroup(${index})">
                <div class="check-group-title">
                    <span class="icon">▶</span>
                    <span>${group.name}</span>
                    <span style="color:#999;font-size:12px;">(${getTypeText(group.type)})</span>
                </div>
                <div class="check-group-summary">
                    <span class="pass">✅ ${group.passed}</span>
                    <span class="fail">❌ ${group.failed}</span>
                    <span class="error">⚠️ ${group.errors}</span>
                </div>
            </div>
            <div class="check-group-details">
                <table class="detail-table">
                    <thead>
                        <tr>
                            <th style="width:30%;">期望值</th>
                            <th style="width:30%;">实际值</th>
                            <th style="width:12%;">状态</th>
                            <th style="width:28%;">详情</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${group.details.map(d => renderDetailRow(d)).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// 渲染详情行
function renderDetailRow(detail) {
    const statusClass = detail.status;
    const statusText = getStatusText(detail.status);
    const expected = formatValue(detail.expected_value, detail.check_item_type);
    const actual = formatValue(detail.actual_value, detail.check_item_type);

    return `
        <tr class="${statusClass}">
            <td class="value-cell" title="${escapeHtml(expected)}">${expected}</td>
            <td class="value-cell" title="${escapeHtml(actual)}">${actual}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>${escapeHtml(detail.message) || '-'}</td>
        </tr>
    `;
}

// 格式化值（根据检查类型）
function formatValue(value, type) {
    if (!value) return '-';

    try {
        // 如果是对象，根据类型提取关键字段
        if (typeof value === 'object') {
            switch (type) {
                case 'file':
                    return value.permission || value.size || value.modification_time || JSON.stringify(value);
                case 'process':
                    return value.pid || value.status || value.name || JSON.stringify(value);
                case 'port':
                    return value.port || value.state || JSON.stringify(value);
                case 'log':
                    return value.matched_lines || value.error_count || JSON.stringify(value);
                default:
                    return JSON.stringify(value);
            }
        }
        return String(value);
    } catch (e) {
        return String(value);
    }
}

// 切换分组展开/折叠
function toggleGroup(index) {
    const group = document.getElementById(`group-${index}`);
    if (group) {
        group.classList.toggle('expanded');
    }
}

// 全部展开
function expandAll() {
    document.querySelectorAll('.check-group').forEach(g => g.classList.add('expanded'));
}

// 全部折叠
function collapseAll() {
    document.querySelectorAll('.check-group').forEach(g => g.classList.remove('expanded'));
}

// 按状态筛选
function filterByStatus(status) {
    currentStatusFilter = status;

    // 更新选中状态
    document.querySelectorAll('.summary-card').forEach(card => {
        card.classList.toggle('active', card.dataset.filter === status);
    });

    // 更新下拉框
    document.getElementById('statusFilter').value = status === 'all' ? '' : status;

    renderCheckGroups();
}

// 应用筛选
function applyFilters() {
    currentTypeFilter = document.getElementById('typeFilter').value;
    const statusValue = document.getElementById('statusFilter').value;
    currentStatusFilter = statusValue || 'all';

    // 更新选中状态
    document.querySelectorAll('.summary-card').forEach(card => {
        card.classList.toggle('active', card.dataset.filter === currentStatusFilter);
    });

    renderCheckGroups();
}

// 导出PDF
function exportPDF() {
    const token = localStorage.getItem('token');
    const url = `${API_BASE}/api/v1/checks/${resultId}/export?format=pdf`;

    fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
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

// 工具函数
function getHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

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

function formatDateTime(dt) {
    if (!dt) return '-';
    return new Date(dt).toLocaleString();
}

function getStatusClass(status) {
    const map = {
        'success': 'success',
        'completed': 'success',
        'pass': 'success',
        'failed': 'failed',
        'error': 'error',
        'running': 'running',
        'pending': 'running',
        'completed_with_errors': 'warning',
        'cancelled': 'warning'
    };
    return map[status] || 'warning';
}

function getStatusText(status) {
    const map = {
        'success': '成功',
        'completed': '完成',
        'pass': '通过',
        'failed': '失败',
        'fail': '失败',
        'error': '异常',
        'running': '进行中',
        'pending': '等待中',
        'completed_with_errors': '部分成功',
        'cancelled': '已取消'
    };
    return map[status] || status;
}

function getTypeText(type) {
    const map = {
        'file': '文件系统',
        'process': '进程检查',
        'port': '端口检查',
        'log': '日志检查',
        'config': '配置检查',
        'kernel': '内核参数',
        'route': '路由表',
        'service': '服务检查'
    };
    return map[type] || type || '未知';
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showError(message) {
    const card = document.getElementById('overviewCard');
    card.innerHTML = `
        <div class="empty-state">
            <div class="icon">❌</div>
            <p>${message}</p>
        </div>
    `;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/login.html';
}

// 导出函数到全局
window.toggleGroup = toggleGroup;
window.expandAll = expandAll;
window.collapseAll = collapseAll;
window.filterByStatus = filterByStatus;
window.applyFilters = applyFilters;
window.exportPDF = exportPDF;
window.logout = logout;
