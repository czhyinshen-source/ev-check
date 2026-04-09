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
    
    tbody.innerHTML = reports.map(r => {
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
        
        return `
            <tr class="report-row">
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.name}">${r.name}</td>
                <td>${r.rule_name}</td>
                <td><span style="font-size:12px;color:#9ca3af;background:#374151;padding:2px 6px;border-radius:4px;">${triggerHtml}</span></td>
                <td style="min-width: 150px;">
                    <div style="display:flex;align-items:center;">
                        <span style="font-size:12px;color:#d1d5db;margin-right:10px;min-width:40px;">${r.completed_nodes}/${r.total_nodes}</span>
                        <div style="flex:1;background:#374151;border-radius:10px;height:6px;overflow:hidden">
                            <div style="background:#10b981;height:100%;width:${progressPercent}%"></div>
                        </div>
                    </div>
                </td>
                <td>${statusHtml}</td>
                <td style="color:#9ca3af;font-size:13px;">${durationStr}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="window.reports.viewReportDetail(${r.id})">查看报告</button>
                    ${ r.status==='running' ? `<button class="btn btn-danger btn-sm" style="margin-left:5px" onclick="window.reports.terminateReport(${r.id})">中止</button>` : '' }
                </td>
            </tr>
        `;
    }).join('');
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

// Window attachment
window.reports = {
    loadReports,
    searchReports,
    exportReport,
    viewReportDetail: (id) => alert('Level 4 Drill Down Viewer Not Yet Implemented (Task 6)'),
    terminateReport: (id) => alert('Terminate API not yet configured.')
};
