// 统一的任务与报表中心模块

let allReports = [];
let reportPollInterval = null;
let reportSortKey = 'id';
let reportSortOrder = 'desc'; // 'asc' or 'desc'


async function loadReports() {
    // 初始化分页管理器（如果尚未初始化）
    if (!window.paginationManager) {
        console.warn('PaginationManager not found, pagination might not work');
    }

    try {
        const params = window.paginationManager ? window.paginationManager.getParamsFromUrl() : { page: 1, size: 5 };
        const skip = (params.page - 1) * params.size;
        const limit = params.size;
        const searchInput = document.getElementById('reportSearch');
        const query = searchInput ? searchInput.value : '';

        const apiPath = `${window.shared.API_BASE}/api/v1/reports`;
        const url = new URL(apiPath, window.location.origin);
        url.searchParams.append('skip', skip);
        url.searchParams.append('limit', limit);
        url.searchParams.append('sort', reportSortKey);
        url.searchParams.append('order', reportSortOrder);
        if (query) url.searchParams.append('q', query);

        const res = await fetch(url, { headers: window.shared.getHeaders() });
        allReports = await res.json();
        
        // 获取总记录数
        const totalCount = parseInt(res.headers.get('X-Total-Count') || 0);
        
        // 分页排序现已由后端处理，移除前端 sortAllReports() 调用
        renderReports(allReports);

        // 渲染分页器
        if (window.paginationManager) {
            window.paginationManager.render('reportsPagination', totalCount, params.page, params.size, (newPage, newSize) => {
                window.paginationManager.updateUrlParams(newPage, newSize);
                loadReports();
            });
        }
        
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
    
    // Helper to only update DOM if changed
    const updateIfChanged = (el, newHtml) => {
        if (el.innerHTML !== newHtml) {
            el.innerHTML = newHtml;
        }
    };

    const currentIdsStr = new Set(reports.map(r => String(r.id)));
    
    // Remove obsolete rows
    Array.from(tbody.children).forEach(tr => {
        const rowId = tr.dataset.id ? String(tr.dataset.id) : null;
        if (rowId && !currentIdsStr.has(rowId)) {
            tbody.removeChild(tr);
        }
    });

    // 为空的特殊处理
    if (reports.length === 0) {
        if (tbody.innerHTML !== '<tr><td colspan="9" style="text-align:center;padding:30px;color:#9ca3af;">暂无检查任务记录</td></tr>') {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:#9ca3af;">暂无检查任务记录</td></tr>';
        }
        return;
    }
    
    // 如果之前是“暂无数据”行，清除它
    if (tbody.rows.length === 1 && tbody.rows[0].cells.length === 1) {
        tbody.innerHTML = '';
    }
    
    // Update or insert rows
    reports.forEach((r, index) => {
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

        let summaryHtml = `
            <div style="font-size:12px; display:flex; gap:6px; align-items:center;">
                <span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; padding:2px 6px; border-radius:4px; border:1px solid rgba(16,185,129,0.3);">
                    成功 ${r.success_checks || 0}
                </span>
                <span style="color:#64748b; font-weight:bold;">/</span>
                <span class="badge" style="background:rgba(239,68,68,0.15); color:#ef4444; padding:2px 6px; border-radius:4px; border:1px solid rgba(239,68,68,0.3);">
                    失败 ${r.failed_checks || 0}
                </span>
            </div>
        `;
        
        let actionHtml = `
            <button class="btn btn-primary btn-sm" onclick="window.reports.viewReportDetail(${r.id})">查看报告</button>
            ${ r.status==='running' ? `<button class="btn btn-danger btn-sm" style="margin-left:5px" onclick="window.reports.terminateReport(${r.id})">中止</button>` : '' }
            <button class="btn btn-danger btn-sm" style="margin-left:5px; background:#4b5563;" onclick="window.reports.deleteReport(${r.id})">删除</button>
        `;

        let existingRow = document.getElementById(`report-row-${r.id}`);
        if (existingRow) {
            // Update only dynamic parts if they changed
            updateIfChanged(existingRow.querySelector('.cell-name'), `${r.name}`);
            updateIfChanged(existingRow.querySelector('.cell-progress'), progressHtml);
            updateIfChanged(existingRow.querySelector('.cell-summary'), summaryHtml);
            updateIfChanged(existingRow.querySelector('.cell-status'), statusHtml);
            updateIfChanged(existingRow.querySelector('.cell-duration'), durationStr);
            updateIfChanged(existingRow.querySelector('.cell-action'), actionHtml);
            
            // Stable Sort: Check if position has changed before moving
            if (tbody.children[index] !== existingRow) {
                tbody.insertBefore(existingRow, tbody.children[index]);
            }
        } else {
            // Create new row
            const tr = document.createElement('tr');
            tr.id = `report-row-${r.id}`;
            tr.dataset.id = r.id;
            tr.className = 'report-row';
            tr.innerHTML = `
                <td><input type="checkbox" class="report-checkbox" value="${r.id}" onchange="window.reports.updateBatchDeleteReportsBtn()"></td>
                <td class="cell-name" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.name}">${r.name}</td>
                <td>${r.rule_name}</td>
                <td><span style="font-size:12px;color:#9ca3af;background:#374151;padding:2px 6px;border-radius:4px;">${triggerHtml}</span></td>
                <td class="cell-progress" style="min-width: 150px;">${progressHtml}</td>
                <td class="cell-summary">${summaryHtml}</td>
                <td class="cell-status">${statusHtml}</td>
                <td class="cell-duration" style="color:#9ca3af;font-size:13px;">${durationStr}</td>
                <td class="cell-action">${actionHtml}</td>
            `;
            if (tbody.children[index]) {
                tbody.insertBefore(tr, tbody.children[index]);
            } else {
                tbody.appendChild(tr);
            }
        }
    });
}

async function searchReports() {
    // 搜索时重置到第一页
    if (window.paginationManager) {
        window.paginationManager.updateUrlParams(1);
    }
    await loadReports();
}

function sortAllReports() {
    allReports.sort((a, b) => {
        const valA = String(a.name || "");
        const valB = String(b.name || "");
        return reportSortOrder === 'asc' 
            ? valA.localeCompare(valB, 'zh') 
            : valB.localeCompare(valA, 'zh');
    });
}

function toggleSort(key = 'id') {
    if (reportSortKey === key) {
        reportSortOrder = reportSortOrder === 'desc' ? 'asc' : 'desc';
    } else {
        reportSortKey = key;
        reportSortOrder = 'desc';
    }
    
    // 更新图标
    const icon = document.getElementById('sortIcon');
    if (icon) {
        icon.innerText = reportSortOrder === 'asc' ? '▲' : '▼';
    }
    
    // 排序变更时，通常建议回到第一页
    if (window.paginationManager) {
        window.paginationManager.updateUrlParams(1);
    }
    
    loadReports();
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

                            // Diff Level 3 Layout
                            if (isCommFail) {
                                let diffHtmlContent = "";
                                if (avObj && avObj._diff_details) {
                                    // 优先使用后端提供的精细差异明细进行渲染
                                    diffHtmlContent = renderDiffDetails(avObj._diff_details);
                                } else if (avObj && avObj._is_large_file && avObj.diff_record) {
                                    diffHtmlContent = `<div style="font-family: monospace; font-size: 13px; line-height: 1.5; background: #0f172a; padding: 10px; border-radius: 6px; overflow-x: auto; white-space: pre; color: #cbd5e1;">${escapeHtml(avObj.diff_record)}</div>`;
                                } else {
                                    diffHtmlContent = generateUnifiedDiff(evStr, avStr, 5);
                                }

                                diffHtml = `
                                    <div class="report-level-3" style="display:none;">
                                        <div class="diff-title" style="margin-bottom:10px;font-size:13px;color:#cbd5e1;">变更明细详情 (对比基准/快照)</div>
                                        ${diffHtmlContent}
                                        ${commWrap.message ? `<div style="margin-top:10px;padding:12px;color:#fff;font-size:13px;background:rgba(239, 68, 68, 0.15);border-left:4px solid #ef4444;border-radius:4px;"><strong>系统结论:</strong> ${commWrap.message}</div>` : ''}
                                    </div>
                                `;
                            } else {
                                let contentStr = String(avStr || evStr || '');
                                let lines = contentStr.split(/\r?\n/);
                                let isTruncated = lines.length > 100;
                                let displayStr = lines.slice(0, 100).join('\n');
                                
                                diffHtml = `
                                    <div class="report-level-3" style="display:none;">
                                        <div style="padding:10px;font-size:13px;color: #10b981; font-weight:bold; margin-bottom:10px;">一致通过 ✅</div>
                                        <div class="diff-title" style="margin-bottom:10px;font-size:13px;color:#cbd5e1;">目标采集内容（与基准一致）：</div>
                                        <div style="font-family: monospace; font-size: 13px; line-height: 1.5; background: #0f172a; padding: 10px; border-radius: 6px; overflow-x: auto; white-space: pre; color: #94a3b8;">${escapeHtml(displayStr)}${isTruncated ? '\n... (内容已按最大上限 100 行截断) ...' : ''}</div>
                                        ${commWrap.message ? `<div style="margin-top:10px;padding:10px;color:#10b981;font-size:12px;background:#0f172a;border-left:3px solid #10b981;">系统结论: ${commWrap.message}</div>` : ''}
                                    </div>
                                `;
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

async function deleteReport(id) {
    if (!confirm('确定要删除这份执行报告吗？相关的详细检查记录也将被永久移除。')) return;
    
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/reports/${id}`, {
            method: 'DELETE',
            headers: window.shared.getHeaders()
        });
        
        if (res.ok) {
            window.shared.showToast('报表已删除', 'success');
            
            // 1. 同步内存数据，防止轮询带回旧数据
            allReports = allReports.filter(r => r.id !== id);
            
            // 2. 物理移除 DOM (最直接的反馈)
            const row = document.getElementById(`report-row-${id}`);
            if (row) {
                row.remove();
            }

            // 3. 重新渲染 (处理排序和分页后的逻辑，如空状态)
            if (allReports.length === 0) {
                renderReports([]);
            } else {
                // 如果当前有搜索词，也要重新过滤渲染
                const keyword = document.getElementById('reportSearch') ? document.getElementById('reportSearch').value : '';
                if (keyword) {
                    searchReports();
                } else {
                    renderReports(allReports);
                }
            }
            
            // 4. 从服务器再次确认最新状态 (异步)
            loadReports();
        } else {
            const data = await res.json();
            window.shared.showToast('删除失败: ' + (data.detail || '未知错误'), 'error');
        }
    } catch (e) {
        window.shared.showToast('请求失败', 'error');
        console.error(e);
    }
}

async function batchDeleteReports() {
    const checkboxes = document.querySelectorAll('.report-checkbox:checked');
    const ids = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (ids.length === 0) return;
    if (!confirm(`确定要批量删除这 ${ids.length} 份执行报告吗？相关的详细检查记录也将被永久移除。`)) return;

    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/reports/batch-delete`, {
            method: 'POST',
            headers: window.shared.getHeaders(),
            body: JSON.stringify({ ids: ids })
        });

        if (res.ok) {
            window.shared.showToast(`成功批量删除 ${ids.length} 份报表`, 'success');
            
            // Remove from memory
            allReports = allReports.filter(r => !ids.includes(r.id));
            
            // Physical DOM removal
            ids.forEach(id => {
                const row = document.getElementById(`report-row-${id}`);
                if (row) row.remove();
            });

            document.getElementById('selectAllReports').checked = false;
            updateBatchDeleteReportsBtn();
            
            if (allReports.length === 0) renderReports([]);
            else searchReports(); // reload with filter
            
            loadReports();
        } else {
            const data = await res.json();
            window.shared.showToast('批量删除失败: ' + (data.detail || data.message || '未知错误'), 'error');
        }
    } catch (e) {
        window.shared.showToast('请求失败', 'error');
        console.error(e);
    }
}

function toggleSelectAllReports(event) {
    const checked = event.target.checked;
    const checkboxes = document.querySelectorAll('.report-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);
    updateBatchDeleteReportsBtn();
}

function updateBatchDeleteReportsBtn() {
    const checkedCount = document.querySelectorAll('.report-checkbox:checked').length;
    const btn = document.getElementById('batchDeleteReportsBtn');
    if (btn) {
        btn.style.display = checkedCount > 0 ? 'inline-block' : 'none';
        btn.innerText = `批量删除 (${checkedCount})`;
    }
}

// Window attachment
window.reports = {
    loadReports,
    searchReports,
    toggleSort,
    exportReport,
    deleteReport,
    batchDeleteReports,
    toggleSelectAllReports,
    updateBatchDeleteReportsBtn,
    viewReportDetail,

    closeReportDrawer,
    toggleLevel2,
    toggleLevel3,
    terminateReport
};

// 页面加载时自动初始化数据
document.addEventListener('DOMContentLoaded', () => {
    // 延迟一秒加载，确保 dashboard.js 的标签切换逻辑已就绪
    // 或者直接在此处判断当前激活的标签
    setTimeout(() => {
        const activeTab = document.querySelector('.nav-tab.active');
        if (activeTab && activeTab.dataset.tab === 'reports') {
            loadReports();
        }
    }, 500);
});

// ================= Diff Helper ================= //
function generateUnifiedDiff(oldStr, newStr, context = 5) {
    oldStr = String(oldStr || '');
    newStr = String(newStr || '');
    
    // 如果都是未定义或者空
    if (!oldStr && !newStr) return '<div style="color:#94a3b8;font-size:12px;">无参数值/文本。</div>';

    const oldLines = oldStr.split(/\r?\n/);
    const newLines = newStr.split(/\r?\n/);
    
    const MAX_DIFF_LINES = 100;

    if (oldLines.length + newLines.length > 20000) {
        return `<div class="diff-title text-warning" style="margin-bottom:10px;">文件体积过大，仅展示部分内容前 ${MAX_DIFF_LINES} 行对比（忽略精细差异）：</div>
                <div class="diff-content" style="background:#0f172a;padding:10px;color:#cbd5e1;word-wrap:break-word;white-space:pre-wrap;font-family:monospace;">${escapeHtml(newLines.slice(0, MAX_DIFF_LINES).join('\n'))}\n...\n[已截断显示最多 ${MAX_DIFF_LINES} 行]</div>`;
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
    
    let diffOld = oldLines.slice(start, endOld + 1);
    let diffNew = newLines.slice(start, endNew + 1);
    
    let isTruncatedObj = false;
    // 严格限制界面最大只显示 100 行差异块，防止视图冗长
    if (diffOld.length > MAX_DIFF_LINES) { diffOld = diffOld.slice(0, MAX_DIFF_LINES); isTruncatedObj = true; }
    if (diffNew.length > MAX_DIFF_LINES) { diffNew = diffNew.slice(0, MAX_DIFF_LINES); isTruncatedObj = true; }
    
    const resultHtml = [];
    const contextStart = Math.max(0, start - context);
    const contextEndOld = Math.min(oldLines.length - 1, endOld + context);
    
    for(let i = contextStart; i < start; i++) {
        resultHtml.push(`<div style="color: #94a3b8; padding-left:14px;">  ${escapeHtml(oldLines[i])}</div>`);
    }
    
    for(let i = 0; i < diffOld.length; i++) {
        resultHtml.push(`<div style="color: #ef4444; background: rgba(239, 68, 68, 0.1); padding-left:14px; border-left: 3px solid #ef4444;">- ${escapeHtml(diffOld[i])}</div>`);
    }
    if (isTruncatedObj && diffOld.length === MAX_DIFF_LINES) resultHtml.push(`<div style="color: #ef4444; padding-left:14px; font-style: italic;">... (旧内容已按最大上限 ${MAX_DIFF_LINES} 行截断) ...</div>`);
    
    for(let i = 0; i < diffNew.length; i++) {
        resultHtml.push(`<div style="color: #10b981; background: rgba(16, 185, 129, 0.1); padding-left:14px; border-left: 3px solid #10b981;">+ ${escapeHtml(diffNew[i])}</div>`);
    }
    if (isTruncatedObj && diffNew.length === MAX_DIFF_LINES) resultHtml.push(`<div style="color: #10b981; padding-left:14px; font-style: italic;">... (新内容已按最大上限 ${MAX_DIFF_LINES} 行截断) ...</div>`);
    
    if (!isTruncatedObj) {
        for(let i = endOld + 1; i <= contextEndOld; i++) {
            resultHtml.push(`<div style="color: #94a3b8; padding-left:14px;">  ${escapeHtml(oldLines[i])}</div>`);
        }
    }
    
    if (contextStart > 0) {
        resultHtml.unshift(`<div style="color: #64748b; padding-left:14px; font-style: italic;">... (前省略 ${contextStart} 行相同内容) ...</div>`);
    }
    if (contextEndOld < oldLines.length - 1 && !isTruncatedObj) {
        resultHtml.push(`<div style="color: #64748b; padding-left:14px; font-style: italic;">... (后省略 ${oldLines.length - 1 - contextEndOld} 行相同内容) ...</div>`);
    }
    
    return `<div style="font-family: monospace; font-size: 13px; line-height: 1.5; background: #0f172a; padding: 10px; border-radius: 6px; overflow-x: auto; white-space: pre;">${resultHtml.join('\n')}</div>`;
}

function renderDiffDetails(details, type) {
    if (!details) return '<div class="text-muted">无明细数据</div>';
    
    let html = '<div class="structured-diff" style="font-size: 13px; line-height: 1.6; color: #cbd5e1;">';
    const label = type === 'route_table' ? '路由规则' : '项目';
    
    // 1. 新增
    if (details.added && details.added.length > 0) {
        html += `
            <div style="margin-bottom: 12px;">
                <div style="color: #10b981; font-weight: 600; margin-bottom: 4px;">新增${label} (+ ${details.added.length}):</div>
                <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.1); padding: 8px; border-radius: 4px;">
                    ${details.added.map(p => `<div style="color: #34d399;">+ ${typeof p === 'string' ? escapeHtml(p) : escapeHtml(p.path || JSON.stringify(p))}</div>`).join('')}
                </div>
            </div>`;
    }
    
    // 2. 减少
    if (details.removed && details.removed.length > 0) {
        html += `
            <div style="margin-bottom: 12px;">
                <div style="color: #ef4444; font-weight: 600; margin-bottom: 4px;">减少${label} (- ${details.removed.length}):</div>
                <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.1); padding: 8px; border-radius: 4px;">
                    ${details.removed.map(p => `<div style="color: #f87171; text-decoration: line-through;">- ${typeof p === 'string' ? escapeHtml(p) : escapeHtml(p.path || JSON.stringify(p))}</div>`).join('')}
                </div>
            </div>`;
    }
    
    // 3. 修改项 (通常路由表没有这个)
    if (details.modified && details.modified.length > 0) {
        html += `
            <div style="margin-bottom: 12px;">
                <div style="color: #f59e0b; font-weight: 600; margin-bottom: 4px;">属性变更${label} (* ${details.modified.length}):</div>
                <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.1); padding: 8px; border-radius: 4px;">
                    ${details.modified.map(m => `
                        <div style="margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom:4px;">
                            <div style="color: #fbbf24;">* ${escapeHtml(m.path || m)}</div>
                            <div style="margin-left: 14px; font-size: 12px; color: #94a3b8;">
                                ${m.changes ? m.changes.map(c => `
                                    <div>[${c.field}] <span style="color:#f87171;">${escapeHtml(c.expected)}</span> &rarr; <span style="color:#34d399;">${escapeHtml(c.actual)}</span></div>
                                `).join('') : (m.diff ? Object.entries(m.diff).map(([field, d]) => `
                                    <div>[${field}] <span style="color:#f87171;">${escapeHtml(d.old)}</span> &rarr; <span style="color:#34d399;">${escapeHtml(d.new)}</span></div>
                                `).join('') : '')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
    }
    
    if (html === '<div class="structured-diff" style="font-size: 13px; line-height: 1.6; color: #cbd5e1;">') {
        html += '<div style="color: #94a3b8; font-style: italic;">(比对规则计算后无实际差异)</div>';
    }
    
    html += '</div>';
    return html;
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
