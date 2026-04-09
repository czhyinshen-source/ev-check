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
        else if (r.status === 'cancelled') statusHtml = '<span class="status-badge error" style="padding: 4px 8px;border-radius:4px;background:rgba(107,114,128,0.2);color:#9ca3af;font-size:12px;">⏹ 已终止</span>';
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
                                let evObj = commWrap.expected_value;
                                let avObj = commWrap.actual_value;
                                
                                let evStr = evObj;
                                if (evObj && typeof evObj === 'object') {
                                    evStr = (typeof evObj.content === 'string') ? evObj.content : JSON.stringify(evObj, null, 2);
                                }
                                let avStr = avObj;
                                if (avObj && typeof avObj === 'object') {
                                    avStr = (typeof avObj.content === 'string') ? avObj.content : JSON.stringify(avObj, null, 2);
                                }

                                const diffHtmlContent = generateUnifiedDiff(evStr, avStr, 5);

                                diffHtml = `
                                    <div class="report-level-3" style="display:none;">
                                        <div class="diff-title" style="margin-bottom:10px;font-size:13px;color:#cbd5e1;">智能差异对比 (上下文模式)</div>
                                        ${diffHtmlContent}
                                        ${commWrap.message ? `<div style="margin-top:10px;padding:10px;color:#ef4444;font-size:12px;background:#0f172a;border-left:3px solid #ef4444;">系统结论: ${commWrap.message}</div>` : ''}
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

// ================= Diff Helper ================= //
function generateUnifiedDiff(oldStr, newStr, context = 5) {
    oldStr = String(oldStr || '');
    newStr = String(newStr || '');
    
    // 如果都是未定义或者空
    if (!oldStr && !newStr) return '<div style="color:#94a3b8;font-size:12px;">无参数值/文本。</div>';

    const oldLines = oldStr.split(/\r?\n/);
    const newLines = newStr.split(/\r?\n/);
    
    if (oldLines.length + newLines.length > 20000) {
        return `<div class="diff-title text-danger" style="margin-bottom:10px;">文本过大，截断展示 (仅截取实际采集内容)：</div>
                <div class="diff-content" style="background:#0f172a;padding:10px;color:#ef4444;word-wrap:break-word;">${escapeHtml(newStr.slice(0, 5000))}...</div>`;
    }
    
    let start = 0;
    while(start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) {
        start++;
    }
    
    let endOld = oldLines.length - 1;
    let endNew = newLines.length - 1;
    while(endOld >= start && endNew >= start && oldLines[endOld] === newLines[endNew]) {
        endOld--;
        endNew--;
    }
    
    if (start > endOld && start > endNew) {
        return `<div style="padding:10px;font-size:13px;color:#cbd5e1;background:#0f172a;">文本完全一致，或差异主要在不可见字符的结构嵌套中。</div>`;
    }
    
    const diffOld = oldLines.slice(start, endOld + 1);
    const diffNew = newLines.slice(start, endNew + 1);
    
    const resultHtml = [];
    const contextStart = Math.max(0, start - context);
    const contextEndOld = Math.min(oldLines.length - 1, endOld + context);
    
    for(let i = contextStart; i < start; i++) {
        resultHtml.push(`<div style="color: #94a3b8; padding-left:14px;">  ${escapeHtml(oldLines[i])}</div>`);
    }
    
    for(let i = 0; i < diffOld.length; i++) {
        resultHtml.push(`<div style="color: #ef4444; background: rgba(239, 68, 68, 0.1); padding-left:14px; border-left: 3px solid #ef4444;">- ${escapeHtml(diffOld[i])}</div>`);
    }
    
    for(let i = 0; i < diffNew.length; i++) {
        resultHtml.push(`<div style="color: #10b981; background: rgba(16, 185, 129, 0.1); padding-left:14px; border-left: 3px solid #10b981;">+ ${escapeHtml(diffNew[i])}</div>`);
    }
    
    for(let i = endOld + 1; i <= contextEndOld; i++) {
        resultHtml.push(`<div style="color: #94a3b8; padding-left:14px;">  ${escapeHtml(oldLines[i])}</div>`);
    }
    
    if (contextStart > 0) {
        resultHtml.unshift(`<div style="color: #64748b; padding-left:14px; font-style: italic;">... (前省略 ${contextStart} 行相同内容) ...</div>`);
    }
    if (contextEndOld < oldLines.length - 1) {
        resultHtml.push(`<div style="color: #64748b; padding-left:14px; font-style: italic;">... (后省略 ${oldLines.length - 1 - contextEndOld} 行相同内容) ...</div>`);
    }
    
    return `<div style="font-family: monospace; font-size: 13px; line-height: 1.5; background: #0f172a; padding: 10px; border-radius: 6px; overflow-x: auto; white-space: pre;">${resultHtml.join('\n')}</div>`;
}

function escapeHtml(unsafe) {
    if (unsafe === undefined || unsafe === null) return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
