// 统一的任务与报表中心模块

let allReports = [];
let reportPollInterval = null;

async function loadReports() {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/reports`, { headers: window.shared.getHeaders() });
        allReports = await res.json();
        renderReports(allReports);
        
        // 如果有正在运行的任务，启动轮询
        const hasRunning = allReports.some(r => r.status === 'running' || r.status === 'pending');
        if (hasRunning) {
            if (!reportPollInterval) reportPollInterval = setInterval(loadReports, 2000);
        } else {
            if (reportPollInterval) { clearInterval(reportPollInterval); reportPollInterval = null; }
        }
    } catch (e) { console.error('加载报表失败', e); }
}

function renderReports(reports) {
    const tbody = document.getElementById('reportTable');
    if (!tbody) return;
    
    // Create a set of current report IDs
    const currentIds = new Set(reports.map(r => r.id));
    
    // Remove obsolete rows
    Array.from(tbody.children).forEach(tr => {
        const id = parseInt(tr.dataset.id);
        if (!currentIds.has(id)) {
            tbody.removeChild(tr);
        }
    });
    
    // Update or insert rows
    reports.forEach(r => {
        let statusHtml = '';
        if (r.status === 'success') statusHtml = '<span class="status-badge success" style="padding: 4px 8px;border-radius:4px;background:rgba(16,185,129,0.2);color:#10b981;font-size:12px;">✅ 成功</span>';
        else if (r.status === 'failed') statusHtml = '<span class="status-badge error" style="padding: 4px 8px;border-radius:4px;background:rgba(239,68,68,0.2);color:#ef4444;font-size:12px;">❌ 失败</span>';
        else statusHtml = '<span class="status-badge warning" style="padding: 4px 8px;border-radius:4px;background:rgba(245,158,11,0.2);color:#f59e0b;font-size:12px;">🔄 运行中</span>';
        
        let triggerHtml = r.trigger_type === 'manual' ? '手动执行' : '定时计划';
        let progressPercent = r.total_nodes > 0 ? Math.floor((r.completed_nodes / r.total_nodes) * 100) : 0;
        
        let durationStr = '-';
        if (r.end_time) {
            const diffMs = new Date(r.end_time) - new Date(r.start_time);
            durationStr = Math.round(diffMs / 1000) + '秒';
        } else {
            const diffMs = new Date() - new Date(r.start_time);
            durationStr = Math.round(diffMs / 1000) + '秒 (进行中)';
        }
        
        let progressHtml = `
            <div style="display:flex;align-items:center;">
                <span style="font-size:12px;color:#d1d5db;margin-right:10px;min-width:40px;">${r.completed_nodes}/${r.total_nodes}</span>
                <div style="flex:1;background:#374151;border-radius:10px;height:6px;overflow:hidden">
                    <div style="background:#10b981;height:100%;width:${progressPercent}%"></div>
                </div>
            </div>
        `;
        
        let actionHtml = `
            <button class="btn btn-primary btn-sm" onclick="window.reports.viewReportDetail(${r.id})">查看报告</button>
            ${ r.status==='running' ? `<button class="btn btn-danger btn-sm" style="margin-left:5px" onclick="window.reports.terminateReport(${r.id})">中止</button>` : '' }
        `;

        let existingRow = document.getElementById(`report-row-${r.id}`);
        if (existingRow) {
            // Update only dynamic parts
            existingRow.querySelector('.cell-progress').innerHTML = progressHtml;
            existingRow.querySelector('.cell-status').innerHTML = statusHtml;
            existingRow.querySelector('.cell-duration').innerHTML = durationStr;
            existingRow.querySelector('.cell-action').innerHTML = actionHtml;
        } else {
            // Create new row
            const tr = document.createElement('tr');
            tr.id = `report-row-${r.id}`;
            tr.dataset.id = r.id;
            tr.className = 'report-row';
            tr.innerHTML = `
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.name}">${r.name}</td>
                <td>${r.rule_name}</td>
                <td><span style="font-size:12px;color:#9ca3af;background:#374151;padding:2px 6px;border-radius:4px;">${triggerHtml}</span></td>
                <td class="cell-progress" style="min-width: 150px;">${progressHtml}</td>
                <td class="cell-status">${statusHtml}</td>
                <td class="cell-duration" style="color:#9ca3af;font-size:13px;">${durationStr}</td>
                <td class="cell-action">${actionHtml}</td>
            `;
            tbody.appendChild(tr);
        }
    });
}

function searchReports() {
    const keyword = document.getElementById('reportSearch').value.toLowerCase();
    if (!keyword) return renderReports(allReports);
    const filtered = allReports.filter(r =>
        String(r.name).toLowerCase().includes(keyword) ||
        String(r.rule_name).toLowerCase().includes(keyword)
    );
    renderReports(filtered);
}

// 导出报表功能 (Stub)
function exportReport() {
    alert('导出全局 CSV 汇总报表功能在此版本已迁移，目前推荐直接进入单份报告进行详细查看与导出。');
}

async function viewReportDetail(id) {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/reports/${id}/details`, { headers: window.shared.getHeaders() });
        if (!res.ok) throw new Error("获取详情失败");
        const data = await res.json();
        
        document.getElementById('reportDrawerTitle').innerText = data.report_info.name;
        document.getElementById('reportDrawerSummary').innerText = `目标: ${data.report_info.total_nodes} 台 | 成功: ${data.report_info.success_nodes} | 失败: ${data.report_info.failed_nodes} | 状态: ${data.report_info.status}`;
        
        const container = document.getElementById('reportLevelsContainer');
        container.innerHTML = data.items.map(item => {
            const hasFail = item.fail_count > 0;
            const itemColor = hasFail ? 'text-danger' : 'text-success';
            const bgSubtle = hasFail ? 'bg-danger-subtle' : 'bg-success-subtle';
            
            return `
                <div class="report-level-1">
                    <div class="report-item-header" onclick="window.reports.toggleLevel2(this)">
                        <div>
                            <strong style="color:#e2e8f0;font-size:14px;">📝 ${item.item_name}</strong>
                            <span style="font-size:12px;color:#9ca3af;margin-left:10px;">[${item.item_path}]</span>
                        </div>
                        <div class="${bgSubtle} ${itemColor}">
                            <span style="margin-right:10px">🟩 正常: ${item.pass_count}</span>
                            <span>🟥 异常: ${item.fail_count}</span>
                            <span style="margin-left: 10px; font-size:14px;">▾</span>
                        </div>
                    </div>
                    <div class="report-level-2">
                        ${item.communications.map(commWrap => {
                            const comm = commWrap.communication;
                            const isCommFail = commWrap.status !== 'pass';
                            const commColor = isCommFail ? 'text-danger' : 'text-success';
                            let diffHtml = '';
                            
                            // Diff Level 3 Layout
                            if (isCommFail) {
                                let ev = typeof commWrap.expected_value === 'object' ? JSON.stringify(commWrap.expected_value, null, 2) : commWrap.expected_value;
                                let av = typeof commWrap.actual_value === 'object' ? JSON.stringify(commWrap.actual_value, null, 2) : commWrap.actual_value;
                                diffHtml = `
                                    <div class="report-level-3" style="display:none;">
                                        <div class="diff-view">
                                            <div class="diff-pane diff-left">
                                                <div class="diff-title text-success">预期基准值 (Expected)</div>
                                                <div class="diff-content">${ev || '-'}</div>
                                            </div>
                                            <div class="diff-pane diff-right">
                                                <div class="diff-title text-danger">实际采集值 (Actual)</div>
                                                <div class="diff-content">${av || '-'}</div>
                                            </div>
                                        </div>
                                        ${commWrap.message ? `<div style="padding:10px;color:#ef4444;font-size:12px;background:#0f172a;border-top:1px dashed #334155;">错误原因: ${commWrap.message}</div>` : ''}
                                    </div>
                                `;
                            } else {
                                diffHtml = `<div class="report-level-3" style="display:none;"><div style="padding:10px;font-size:12px;color:#10b981;background:#0f172a;">一致通过 ✅</div></div>`;
                            }
                            
                            return `
                                <div class="report-comm-item">
                                    <div class="report-comm-header" onclick="window.reports.toggleLevel3(this)">
                                        <div style="font-size:13px;color:#cbd5e1;">🖥️ ${comm.name || comm.ip_address}</div>
                                        <div class="${commColor}" style="font-size:12px;">${isCommFail ? '🔴 异常' : '🟢 正常'}</div>
                                    </div>
                                    ${diffHtml}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');
        
        document.getElementById('reportDrawerOverlay').classList.add('active');
    } catch (e) {
        console.error(e);
        alert('读取详情失败!');
    }
}

function closeReportDrawer() {
    document.getElementById('reportDrawerOverlay').classList.remove('active');
}

function toggleLevel2(el) {
    const level2 = el.nextElementSibling;
    if (level2) {
        level2.style.display = level2.style.display === 'block' ? 'none' : 'block';
    }
}

function toggleLevel3(el) {
    const level3 = el.nextElementSibling;
    if (level3) {
        level3.style.display = level3.style.display === 'block' ? 'none' : 'block';
    }
}

async function terminateReport(reportId) {
    if (!confirm('确定要强制中断当前正在运行的这个任务吗？')) return;
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/reports/${reportId}/cancel`, {
            method: 'POST',
            headers: window.shared.getHeaders()
        });
        if (res.ok) {
            window.shared.showToast('任务已成功终止', 'success');
            loadReports();
        } else {
            const data = await res.json();
            window.shared.showToast('终止失败: ' + (data.detail || '未知错误'), 'error');
        }
    } catch (e) {
        window.shared.showToast('请求异常', 'error');
        console.error(e);
    }
}

// Window attachment
window.reports = {
    loadReports,
    searchReports,
    exportReport,
    viewReportDetail,
    closeReportDrawer,
    toggleLevel2,
    toggleLevel3,
    terminateReport
};
