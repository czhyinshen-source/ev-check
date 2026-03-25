// 检查执行模块

let currentTaskId = null;
let progressPollInterval = null;

// 打开检查执行模态框
function openCheckModal() {
    document.getElementById('checkRule').value = '';
    document.getElementById('checkCommunication').value = '';
    document.getElementById('checkSnapshot').value = '';
    loadCheckRules();
    loadCommunicationsForCheck();
    loadSnapshotsForCheck();
    document.getElementById('checkModal').classList.add('active');
}

// 关闭检查模态框
function closeCheckModal() {
    document.getElementById('checkModal').classList.remove('active');
    if (progressPollInterval) {
        clearInterval(progressPollInterval);
        progressPollInterval = null;
    }
}

// 加载检查规则
async function loadCheckRules() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/check-rules`, { headers: getHeaders() });
        const rules = await res.json();
        const select = document.getElementById('checkRule');
        select.innerHTML = `<option value="">请选择规则</option>` + rules.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    } catch (e) { console.error('加载检查规则失败:', e); }
}

// 加载通信机到检查执行模态框
async function loadCommunicationsForCheck() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/communications`, { headers: getHeaders() });
        const comms = await res.json();
        const select = document.getElementById('checkCommunication');
        select.innerHTML = `<option value="">请选择通信机</option>` + comms.map(c => `<option value="${c.id}">${c.name} (${c.ip_address})</option>`).join('');
    } catch (e) { console.error('加载通信机失败:', e); }
}

// 加载快照到检查执行模态框
async function loadSnapshotsForCheck() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/snapshots`, { headers: getHeaders() });
        const snapshots = await res.json();
        const select = document.getElementById('checkSnapshot');
        select.innerHTML = `<option value="">请选择快照</option>` + snapshots.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    } catch (e) { console.error('加载快照失败:', e); }
}

// 启动检查
async function startCheck() {
    const ruleId = document.getElementById('checkRule').value;
    const commId = document.getElementById('checkCommunication').value;
    const snapshotId = document.getElementById('checkSnapshot').value;

    if (!ruleId) { alert('请选择检查规则'); return; }
    if (!commId) { alert('请选择通信机'); return; }
    if (!snapshotId) { alert('请选择快照'); return; }

    try {
        const res = await fetch(`${API_BASE}/api/v1/checks/start`, {
            method: 'POST',
            headers: { ...getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rule_id: parseInt(ruleId),
                communication_id: parseInt(commId),
                snapshot_id: parseInt(snapshotId)
            })
        });

        if (!res.ok) {
            const err = await res.json();
            alert('启动检查失败: ' + (err.detail || err.message || '未知错误'));
            return;
        }

        const data = await res.json();
        alert('检查任务已创建，任务ID: ' + data.id);
        closeCheckModal();
        loadCheckResults();

        // 开始轮询进度
        if (data.id) {
            currentTaskId = data.id;
            startProgressPolling(data.id);
        }

    } catch (e) {
        console.error('启动检查失败:', e);
        alert('启动检查失败: ' + e.message);
    }
}

// 开始轮询检查进度
function startProgressPolling(resultId) {
    if (progressPollInterval) {
        clearInterval(progressPollInterval);
    }
    progressPollInterval = setInterval(() => pollProgress(resultId), 2000);
}

// 轮询检查进度
async function pollProgress(resultId) {
    try {
        const res = await fetch(`${API_BASE}/api/v1/checks/${resultId}/progress`, { headers: getHeaders() });
        if (!res.ok) {
            clearInterval(progressPollInterval);
            return;
        }

        const data = await res.json();
        updateProgressDisplay(data);

        // 检查是否完成
        if (data.status === 'success' || data.status === 'failed' || data.status === 'cancelled') {
            clearInterval(progressPollInterval);
            progressPollInterval = null;
            loadCheckResults();
        }
    } catch (e) {
        console.error('获取进度失败:', e);
    }
}

// 更新进度显示
function updateProgressDisplay(data) {
    // 更新检查执行标签页的进度显示（如果可见）
    const progressSection = document.getElementById('currentTaskProgress');
    if (progressSection && data.status === 'running') {
        progressSection.style.display = 'block';
        const progressBar = progressSection.querySelector('.progress-bar-fill');
        const progressText = progressSection.querySelector('.progress-text');
        const currentItem = progressSection.querySelector('.current-item');

        if (progressBar) {
            progressBar.style.width = data.progress + '%';
        }
        if (progressText) {
            progressText.textContent = `进度: ${data.progress}% (${data.completed_items || 0}/${data.total_items || 0})`;
        }
        if (currentItem && data.current_item) {
            currentItem.textContent = `当前: ${data.current_item}`;
        }
    }
}

// 加载检查结果
async function loadCheckResults() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/checks`, { headers: getHeaders() });
        const data = await res.json();
        const tbody = document.getElementById('checkTable');
        tbody.innerHTML = data.map(c => `
            <tr>
                <td>${c.id}</td>
                <td>${c.rule_name || c.rule_id || '-'}</td>
                <td>${c.communication_name || c.communication_id || '-'}</td>
                <td>${getStatusBadge(c.status)}</td>
                <td>${c.progress}%</td>
                <td>${new Date(c.start_time).toLocaleString()}</td>
                <td>
                    ${c.status === 'running' ? `<button class="btn btn-danger btn-sm" onclick="cancelCheck(${c.id})">取消</button>` : ''}
                    <button class="btn btn-primary btn-sm" onclick="viewCheckResult(${c.id})">查看</button>
                </td>
            </tr>
        `).join('');

        // 更新最近检查状态
        if (data.length > 0) {
            const lastStatus = data[0].status;
            const el = document.getElementById('lastCheckStatus');
            el.textContent = getStatusText(lastStatus);
            el.className = 'value ' + getStatusClass(lastStatus);
        }
    } catch (e) { console.error('加载检查结果失败:', e); }
}

// 取消检查
async function cancelCheck(resultId) {
    if (!confirm('确定要取消该检查任务吗？')) return;

    try {
        const res = await fetch(`${API_BASE}/api/v1/checks/${resultId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (res.ok || res.status === 204) {
            alert('检查任务已取消');
            loadCheckResults();
            if (progressPollInterval) {
                clearInterval(progressPollInterval);
                progressPollInterval = null;
            }
        } else {
            alert('取消失败');
        }
    } catch (e) {
        console.error('取消检查失败:', e);
        alert('取消失败: ' + e.message);
    }
}

// 查看检查结果详情
async function viewCheckResult(id) {
    try {
        const res = await fetch(`${API_BASE}/api/v1/checks/${id}`, { headers: getHeaders() });
        const data = await res.json();
        const content = document.getElementById('reportDetailContent');

        // 计算摘要
        const summary = data.summary || { total: 0, passed: 0, failed: 0, errors: 0 };

        // 计算时长
        let duration = '';
        if (data.duration_seconds) {
            const mins = Math.floor(data.duration_seconds / 60);
            const secs = data.duration_seconds % 60;
            duration = mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
        }

        content.innerHTML = `
            <div style="margin-bottom:15px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div><strong>规则:</strong> ${data.rule_name || '-'}</div>
                    <div><strong>通信机:</strong> ${data.communication_name || '-'} (${data.communication_ip || '-'})</div>
                    <div><strong>快照:</strong> ${data.snapshot_name || data.snapshot_id || '-'}</div>
                    <div><strong>状态:</strong> ${getStatusBadge(data.status)}</div>
                    <div><strong>开始时间:</strong> ${new Date(data.start_time).toLocaleString()}</div>
                    <div><strong>结束时间:</strong> ${data.end_time ? new Date(data.end_time).toLocaleString() : '-'}</div>
                    <div><strong>时长:</strong> ${duration || '-'}</div>
                    <div><strong>进度:</strong> ${data.progress}%</div>
                </div>
                ${data.error_message ? `<div style="color:#f5222d;margin-top:10px;padding:10px;background:#fff2f0;border-radius:6px;"><strong>错误信息:</strong> ${data.error_message}</div>` : ''}
            </div>

            <div style="display:flex;gap:15px;margin:15px 0;">
                <div class="stat-card" style="flex:1;text-align:center;">
                    <h3>总计</h3>
                    <div class="value">${summary.total}</div>
                </div>
                <div class="stat-card" style="flex:1;text-align:center;">
                    <h3>通过</h3>
                    <div class="value success">${summary.passed}</div>
                </div>
                <div class="stat-card" style="flex:1;text-align:center;">
                    <h3>失败</h3>
                    <div class="value error">${summary.failed}</div>
                </div>
                <div class="stat-card" style="flex:1;text-align:center;">
                    <h3>错误</h3>
                    <div class="value warning">${summary.errors}</div>
                </div>
            </div>

            <h4 style="margin:15px 0 10px;">检查详情</h4>
            <table>
                <thead>
                    <tr>
                        <th>检查项</th>
                        <th>类型</th>
                        <th>状态</th>
                        <th>期望值</th>
                        <th>实际值</th>
                        <th>消息</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.details && data.details.length > 0 ? data.details.map(d => `
                        <tr>
                            <td>${d.check_item_name || d.check_item_id}</td>
                            <td>${d.check_item_type || '-'}</td>
                            <td>${getDetailStatusBadge(d.status)}</td>
                            <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;" title="${JSON.stringify(d.expected_value) || ''}">${JSON.stringify(d.expected_value) || '-'}</td>
                            <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;" title="${JSON.stringify(d.actual_value) || ''}">${JSON.stringify(d.actual_value) || '-'}</td>
                            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;" title="${d.message || ''}">${d.message || '-'}</td>
                        </tr>
                    `).join('') : '<tr><td colspan="6" style="text-align:center;color:#999;">暂无详情</td></tr>'}
                </tbody>
            </table>
        `;
        document.getElementById('reportDetailModal').classList.add('active');
    } catch (e) { console.error('查看检查结果失败:', e); }
}

// 获取状态显示文本
function getStatusText(status) {
    const map = {
        'success': '通过',
        'failed': '失败',
        'running': '进行中',
        'pending': '等待中',
        'cancelled': '已取消',
        'completed_with_errors': '部分失败'
    };
    return map[status] || status || '-';
}

// 获取状态样式类
function getStatusClass(status) {
    const map = {
        'success': 'success',
        'failed': 'error',
        'running': 'warning',
        'pending': 'info',
        'cancelled': '',
        'completed_with_errors': 'warning'
    };
    return map[status] || '';
}

// 获取状态徽章 HTML
function getStatusBadge(status) {
    const cls = getStatusClass(status);
    return `<span class="status-badge ${cls}">${getStatusText(status)}</span>`;
}

// 获取详情状态徽章
function getDetailStatusBadge(status) {
    const map = {
        'pass': 'success',
        'fail': 'error',
        'error': 'warning'
    };
    const cls = map[status] || '';
    const text = status === 'pass' ? '通过' : status === 'fail' ? '失败' : status === 'error' ? '错误' : status;
    return `<span class="status-badge ${cls}">${text}</span>`;
}

// 加载当前任务状态
async function loadCurrentTask() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/checks/current`, { headers: getHeaders() });
        const data = await res.json();

        const progressSection = document.getElementById('currentTaskProgress');
        if (!progressSection) return;

        if (data.exists && data.status === 'running') {
            progressSection.style.display = 'block';
            const progressBar = progressSection.querySelector('.progress-bar-fill');
            const progressText = progressSection.querySelector('.progress-text');
            const currentItem = progressSection.querySelector('.current-item');

            if (progressBar) {
                progressBar.style.width = data.progress + '%';
            }
            if (progressText) {
                progressText.textContent = `${data.rule_name || ''} / ${data.communication_name || ''} - ${data.progress}%`;
            }
            if (currentItem) {
                currentItem.textContent = data.current_item ? `当前: ${data.current_item}` : '';
            }

            // 开始轮询
            if (!progressPollInterval) {
                startProgressPolling(data.id);
            }
        } else {
            progressSection.style.display = 'none';
        }
    } catch (e) { console.error('加载当前任务失败:', e); }
}

// 从dashboard.js提取的函数：加载规则和通信机到模态框
async function loadRulesAndCommsForModal() {
    try {
        const [rulesRes, commsRes] = await Promise.all([
            fetch(`${API_BASE}/api/v1/check-rules`, { headers: getHeaders() }),
            fetch(`${API_BASE}/api/v1/communications`, { headers: getHeaders() })
        ]);
        const rules = await rulesRes.json();
        const comms = await commsRes.json();

        document.getElementById('checkRule').innerHTML = '<option value="">请选择规则</option>' +
            rules.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
        document.getElementById('checkCommunication').innerHTML = '<option value="">请选择通信机</option>' +
            comms.map(c => `<option value="${c.id}">${c.name} (${c.ip_address})</option>`).join('');
    } catch (e) { console.error(e); }
}

// 导出模块
window.checks = {
    openCheckModal,
    closeCheckModal,
    loadCheckResults,
    viewCheckResult,
    startCheck,
    cancelCheck,
    loadCurrentTask,
    getStatusBadge,
    getDetailStatusBadge,
    // 导出dashboard.js中的特定函数
    loadRulesAndCommsForModal
};
