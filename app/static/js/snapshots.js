// 快照管理模块
window.currentSnapshotGroupId = window.currentSnapshotGroupId || '';
window.snapshotPagination = {
    page: 1,
    size: 5,
    q: ''
};

// 打开快照组模态框
function openSnapshotGroupModal(id = null) {
    document.getElementById('snapshotGroupId').value = id || '';
    document.getElementById('snapshotGroupName').value = '';
    document.getElementById('snapshotGroupParent').value = '';
    document.getElementById('snapshotGroupCheckItemList').value = '';
    document.getElementById('snapshotGroupDesc').value = '';
    document.getElementById('snapshotGroupModalTitle').textContent = id ? '编辑快照组' : '添加快照组';
    loadSnapshotGroupParents();
    loadCheckItemListsForSnapshotGroup();
    document.getElementById('snapshotGroupModal').classList.add('active');
}

// 加载快照组父分组
async function loadSnapshotGroupParents() {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/snapshots/groups`, { headers: window.shared.getHeaders() });
        if (!res.ok) throw new Error('API请求失败');
        const groups = await res.json();
        const select = document.getElementById('snapshotGroupParent');
        select.innerHTML = `<option value="">无</option>` + groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    } catch (e) { console.error(e); }
}

// 加载检查项列表到快照组模态框
async function loadCheckItemListsForSnapshotGroup() {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/check-items/lists`, { headers: window.shared.getHeaders() });
        if (!res.ok) throw new Error('API请求失败');
        const lists = await res.json();
        const select = document.getElementById('snapshotGroupCheckItemList');
        select.innerHTML = `<option value="">无</option>` + lists.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    } catch (e) { console.error(e); }
}

// 加载快照组
async function loadSnapshotGroups() {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/snapshots/groups`, { headers: window.shared.getHeaders() });
        if (!res.ok) {
            if (res.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('username');
                window.location.href = '/login.html';
                return;
            }
            throw new Error('API请求失败');
        }

        const groups = await res.json();
        const groupsArray = Array.isArray(groups) ? groups : [];
        console.log(`📦 加载快照组: 收到 ${groupsArray.length} 条数据`, groupsArray);

        const tree = document.getElementById('snapshotGroupTree');
        if (!tree) {
            console.error('❌ 找不到 snapshotGroupTree 元素');
            return;
        }

        tree.innerHTML = `
            <li>
                <div class="group-item ${window.currentSnapshotGroupId === '' ? 'active' : ''}" data-group-id="" onclick="window.snapshots.filterBySnapshotGroup('')">
                    <span class="icon">📁</span>
                    <span>全部快照</span>
                </div>
            </li>
            ${groupsArray.map(g => `
                <li>
                    <div class="group-item ${window.currentSnapshotGroupId == g.id ? 'active' : ''}" data-group-id="${g.id}" onclick="window.snapshots.filterBySnapshotGroup(${g.id})"><span class="icon">📂</span>
                        <span>${g.name}</span>
                        <div class="list-actions">
                            <button class="btn btn-xs" onclick="window.snapshots.editSnapshotGroup(${g.id}); event.stopPropagation();">✏️</button>
                            <button class="btn btn-xs" onclick="window.snapshots.deleteSnapshotGroup(${g.id}); event.stopPropagation();">🗑️</button>
                        </div>
                    </div>
                </li>
            `).join('')}
        `;
        console.log('✅ 快照组树渲染完成');

        // 加载快照组到下拉选择框
        loadSnapshotGroupsForModal();
    } catch (e) {
        console.error(e);
        const tree = document.getElementById('snapshotGroupTree');
        if (tree) {
            tree.innerHTML = `
                <li>
                    <div class="group-item ${window.currentSnapshotGroupId === '' ? 'active' : ''}" data-group-id="" onclick="window.snapshots.filterBySnapshotGroup('')">
                        <span class="icon">📁</span>
                        <span>全部快照</span>
                    </div>
                </li>
            `;
        }
    }
}

// 加载快照组到模态框
async function loadSnapshotGroupsForModal() {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/snapshots/groups`, { headers: window.shared.getHeaders() });
        if (!res.ok) throw new Error('API请求失败');
        const groups = await res.json();
        const select = document.getElementById('snapshotGroup');
        select.innerHTML = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    } catch (e) { console.error(e); }
}

// 按名称搜索
let snapshotSearchTimer = null;
function searchSnapshots() {
    const q = document.getElementById('snapshotSearch').value.trim();
    window.snapshotPagination.q = q;
    window.snapshotPagination.page = 1; // 重置页码
    
    if (snapshotSearchTimer) clearTimeout(snapshotSearchTimer);
    snapshotSearchTimer = setTimeout(() => {
        loadSnapshots();
    }, 500);
}

// 按快照组过滤
function filterBySnapshotGroup(groupId) {
    window.currentSnapshotGroupId = groupId;

    document.querySelectorAll('#snapshotGroupTree .group-item').forEach(item => {
        item.classList.toggle('active', item.dataset.groupId == groupId);
    });

    const activeItem = document.querySelector(`#snapshotGroupTree .group-item[data-group-id="${groupId}"]`);
    if (activeItem) {
        const groupName = activeItem.querySelector('span:not(.icon):not(.list-actions)').textContent;
        document.getElementById('currentSnapshotGroupName').textContent = groupName === '全部快照' ? '快照管理' : groupName;
    }

    loadSnapshots();
}

// 编辑快照组
async function editSnapshotGroup(id) {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/snapshots/groups/${id}`, { headers: window.shared.getHeaders() });
        const group = await res.json();
        document.getElementById('snapshotGroupId').value = id;
        document.getElementById('snapshotGroupName').value = group.name;
        document.getElementById('snapshotGroupDesc').value = group.description || '';
        document.getElementById('snapshotGroupModalTitle').textContent = '编辑快照组';
        // 加载父分组和检查项列表
        await loadSnapshotGroupParents();
        await loadCheckItemListsForSnapshotGroup();
        // 设置当前值
        document.getElementById('snapshotGroupParent').value = group.parent_id || '';
        document.getElementById('snapshotGroupCheckItemList').value = group.check_item_list_id || '';
        document.getElementById('snapshotGroupModal').classList.add('active');
    } catch (e) { console.error(e); }
}

// 删除快照组
async function deleteSnapshotGroup(id) {
    if (!confirm('确定删除?')) return;
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/snapshots/groups/${id}`, {
            method: 'DELETE',
            headers: window.shared.getHeaders()
        });

        if (res.status === 404) {
            const err = await res.json();
            alert('❌ 删除失败: ' + (err.detail || '快照组不存在'));
            return;
        }

        if (res.status === 400) {
            const err = await res.json();
            alert('❌ 删除失败: ' + (err.detail || '操作不允许'));
            return;
        }

        if (!res.ok) {
            alert('❌ 删除失败: 服务器错误');
            return;
        }

        alert('✅ 快照组删除成功');
        loadSnapshotGroups();
        loadSnapshots();
    } catch (e) {
        console.error(e);
        alert('❌ 网络错误');
    }
}

// 打开快照模态框
function openSnapshotModal() {
    document.getElementById('snapshotName').value = '';
    document.getElementById('snapshotGroup').value = '';
    document.getElementById('snapshotDefault').checked = false;
    document.getElementById('snapshotDesc').value = '';
    loadCommunicationCheckboxesForSnapshot();
    loadCommunicationGroupsForSnapshot();
    loadCheckItemListsForSnapshot();
    document.getElementById('snapshotModal').classList.add('active');
}

// 加载通信机复选框到快照模态框
async function loadCommunicationCheckboxesForSnapshot() {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/communications`, { headers: window.shared.getHeaders() });
        const comms = await res.json();
        const container = document.getElementById('communicationCheckboxes');
        container.innerHTML = comms.map(c => `
            <label style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px;">
                <input type="checkbox" name="communicationIds" value="${c.id}">
                <span>${c.name} (${c.ip_address})</span>
            </label>
        `).join('');
    } catch (e) { console.error(e); }
}

// 加载通信机组到快照模态框
async function loadCommunicationGroupsForSnapshot() {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/communications/groups`, { headers: window.shared.getHeaders() });
        const groups = await res.json();
        const select = document.getElementById('communicationGroup');
        select.innerHTML = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    } catch (e) { console.error(e); }
}

// 加载检查项列表到快照模态框
async function loadCheckItemListsForSnapshot() {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/check-items/lists`, { headers: window.shared.getHeaders() });
        const lists = await res.json();
        const select = document.getElementById('checkItemList');
        select.innerHTML = lists.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    } catch (e) { console.error(e); }
}

// 加载快照列表
async function loadSnapshots(page = null, size = null) {
    if (page !== null) window.snapshotPagination.page = page;
    if (size !== null) window.snapshotPagination.size = size;

    try {
        const queryParams = new URLSearchParams({
            page: window.snapshotPagination.page,
            size: window.snapshotPagination.size
        });
        if (window.currentSnapshotGroupId) {
            queryParams.append('group_id', window.currentSnapshotGroupId);
        }
        if (window.snapshotPagination.q) {
            queryParams.append('q', window.snapshotPagination.q);
        }

        // 同时获取快照列表和快照组列表
        const [snapshotsRes, groupsRes] = await Promise.all([
            fetch(`${window.shared.API_BASE}/api/v1/snapshots?${queryParams.toString()}`, { 
                headers: window.shared.getHeaders() 
            }),
            fetch(`${window.shared.API_BASE}/api/v1/snapshots/groups`, { headers: window.shared.getHeaders() }),
        ]);

        if (!snapshotsRes.ok) {
            if (snapshotsRes.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('username');
                window.location.href = '/login.html';
                return;
            }
            throw new Error('API请求失败');
        }

        const totalCount = parseInt(snapshotsRes.headers.get('X-Total-Count') || '0');
        const groups = groupsRes.ok ? await groupsRes.json() : [];
        const groupMap = {};
        groups.forEach(g => { groupMap[g.id] = g.name; });

        const snapshots = await snapshotsRes.json();

        const tbody = document.getElementById('snapshotTable');
        if (!tbody) return;

        if (snapshots.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无数据</td></tr>';
        } else {
            // 清理不在当前列表中的旧行
            const currentIds = new Set(snapshots.map(s => String(s.id)));
            Array.from(tbody.children).forEach(tr => {
                if (tr.id === 'temp-build-row') return;
                const sid = tr.dataset.snapshotId;
                if (sid && !currentIds.has(String(sid))) {
                    tr.remove();
                }
            });
        }

        // Helper to update only if changed
        const updateIfChanged = (el, newHtml) => {
            if (el && el.innerHTML !== newHtml) {
                el.innerHTML = newHtml;
            }
        };


        snapshots.forEach((s, index) => {
            const buildStatus = s.build_status;
            let statusHtml = '<span class="status-badge info">-</span>';
            if (buildStatus) {
                if (buildStatus.status === 'pending') {
                    statusHtml = '<span class="status-badge warning">⏳ 等待启动</span>';
                } else if (buildStatus.status === 'running') {
                    statusHtml = `<span class="status-badge info"><span class="build-spinner"></span>${buildStatus.progress || 0}% (${buildStatus.completed_communications || 0}/${buildStatus.total_communications || 0})</span>`;
                } else if (buildStatus.status === 'completed') {
                    statusHtml = '<span class="status-badge success">✓ 已完成</span>';
                } else if (buildStatus.status === 'failed') {
                    statusHtml = `<span class="status-badge error" title="${buildStatus.error_message || ''}">✗ 构建异常</span>`;
                } else if (buildStatus.status === 'cancelled') {
                    statusHtml = '<span class="status-badge warning">- 已取消</span>';
                } else {
                    statusHtml = `<span class="status-badge info">${buildStatus.status}</span>`;
                }
            }

            const groupName = groupMap[s.group_id] || `组${s.group_id}`;
            const timeStr = new Date(s.snapshot_time).toLocaleString();
            const defaultHtml = `<span class="status-badge ${s.is_default ? 'success' : 'info'}">${s.is_default ? '是' : '否'}</span>`;
            const actionHtml = `
                <button class="btn btn-primary btn-sm" onclick="snapshots.viewSnapshotDetail(${s.id})">查看</button>
                <button class="btn btn-danger btn-sm" onclick="snapshots.deleteSnapshot(${s.id})">删除</button>
            `;

            let row = tbody.querySelector(`tr[data-snapshot-id="${s.id}"]`);
            if (row) {
                // Update cells
                updateIfChanged(row.cells[1], s.name);
                updateIfChanged(row.cells[2], groupName);
                updateIfChanged(row.cells[3], timeStr);
                updateIfChanged(row.cells[4], defaultHtml);
                updateIfChanged(row.cells[5], statusHtml);
                updateIfChanged(row.cells[6], actionHtml);
                
                // Keep order
                if (tbody.children[index] !== row && tbody.children[index]?.id !== 'temp-build-row') {
                    tbody.insertBefore(row, tbody.children[index]);
                }
            } else {
                const tr = document.createElement('tr');
                tr.dataset.snapshotId = s.id;
                tr.innerHTML = `
                    <td>${s.id}</td>
                    <td>${s.name}</td>
                    <td>${groupName}</td>
                    <td>${timeStr}</td>
                    <td>${defaultHtml}</td>
                    <td class="status-cell">${statusHtml}</td>
                    <td>${actionHtml}</td>
                `;
                // Insert at correct position
                if (tbody.children[index]) {
                    tbody.insertBefore(tr, tbody.children[index]);
                } else {
                    tbody.appendChild(tr);
                }
            }
        });
        // 渲染分页
        window.paginationManager.render(
            'snapshotsPagination', 
            totalCount, 
            window.snapshotPagination.page, 
            window.snapshotPagination.size, 
            (newPage, newSize) => {
                loadSnapshots(newPage, newSize);
            }
        );
    } catch (e) {
        console.error(e);
        const tbody = document.getElementById('snapshotTable');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="empty-state">加载失败，请刷新页面重试</td></tr>';
    }
}

// 删除快照
async function deleteSnapshot(id) {
    if (!confirm('确定删除此快照?')) return;
    try {
        await fetch(`${window.shared.API_BASE}/api/v1/snapshots/${id}`, {
            method: 'DELETE',
            headers: window.shared.getHeaders()
        });
        loadSnapshots();
    } catch (e) { console.error(e); }
}

// ========== 表格内构建进度相关 ==========

// 启动构建轮询
let buildPollingInterval = null;
let pendingBuildSnapshotName = null; // 等待后端创建快照时临时保存名称

function startBuildPolling() {
    if (buildPollingInterval) clearInterval(buildPollingInterval);
    buildPollingInterval = setInterval(pollActiveBuildTasks, 3000);
}

// 停止构建轮询
function stopBuildPolling() {
    if (buildPollingInterval) {
        clearInterval(buildPollingInterval);
        buildPollingInterval = null;
    }
}

// 轮询活跃构建任务，更新表格内状态
async function pollActiveBuildTasks() {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/snapshots/build/tasks/active`, { headers: window.shared.getHeaders() });
        if (!res.ok) return;
        const tasks = await res.json();

        if (tasks.length === 0) {
            removeBuildingRow();
            await loadSnapshots();
            return;
        }

        // 更新每个活跃任务的快照行状态
        for (const task of tasks) {
            updateSnapshotBuildStatus(task);
        }

        // 检查是否有任务结束
        const hasRunning = tasks.some(t => t.status === 'pending' || t.status === 'running');
        if (!hasRunning) {
            removeBuildingRow();
            await loadSnapshots();
        }
    } catch (e) {
        console.error('轮询构建任务失败:', e);
    }
}

// 更新单行快照的构建状态
function updateSnapshotBuildStatus(task) {
    const row = document.querySelector(`tr[data-snapshot-id="${task.snapshot_id}"]`);
    if (!row) return;
    const statusCell = row.cells[5]; // 使用索引定位，对应 loadSnapshots 中的顺序
    if (!statusCell) return;

    let statusHtml = '';
    if (task.status === 'pending') {
        statusHtml = '<span class="status-badge warning">⏳ 等待启动</span>';
    } else if (task.status === 'running') {
        statusHtml = `<span class="status-badge info"><span class="build-spinner"></span>${task.progress || 0}% (${task.completed_communications || 0}/${task.total_communications || 0})</span>`;
    } else if (task.status === 'completed') {
        statusHtml = '<span class="status-badge success">✓ 已完成</span>';
    } else if (task.status === 'failed') {
        statusHtml = `<span class="status-badge error" title="${task.error_message || ''}">✗ 构建异常</span>`;
    } else if (task.status === 'cancelled') {
        statusHtml = '<span class="status-badge warning">- 已取消</span>';
    } else {
        statusHtml = `<span class="status-badge info">${task.status}</span>`;
    }

    if (statusCell.innerHTML !== statusHtml) {
        statusCell.innerHTML = statusHtml;
    }
}

// 移除临时构建行
function removeBuildingRow() {
    const tempRow = document.getElementById('temp-build-row');
    if (tempRow) tempRow.remove();
    stopBuildPolling();
}

// 插入临时构建行（等待后端创建快照期间）
function insertBuildingRow(snapshotName, groupId) {
    pendingBuildSnapshotName = snapshotName;
    const tbody = document.getElementById('snapshotTable');
    // 移除已有的临时行
    removeBuildingRow();
    const tr = document.createElement('tr');
    tr.id = 'temp-build-row';
    tr.innerHTML = `
        <td>-</td>
        <td>${snapshotName}</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td><span class="status-badge warning">⏳ 正在创建...</span></td>
        <td></td>
    `;
    tbody.prepend(tr);
}

// 快照构建相关

// --- 快照构建多选逻辑 (Row Based) ---
let currentBuildRows = [];

// 打开构建对话框
async function openSnapshotBuildModal() {
    document.getElementById('buildSnapshotName').value = '';
    
    // 确保字典已加载（用于渲染检查列表下拉框）
    if (window.checks && window.checks.loadDictionaries) {
        await window.checks.loadDictionaries();
    }
    
    await loadSnapshotGroupsForBuild();
    
    // 初始化两行 (演示多行)
    currentBuildRows = [{
        check_item_list_id: null,
        group_id: null,
        communication_ids: []
    }];
    renderBuildRows();
    
    document.getElementById('snapshotBuildModal').classList.add('active');
}

function renderBuildRows() {
    const container = document.getElementById('buildRowsContainer');
    if (!container) return;
    
    if (currentBuildRows.length === 0) {
        container.innerHTML = '<div class="empty-text" style="padding: 20px;">请添加至少一条配置行</div>';
        return;
    }

    const dicts = window.checks.dicts;
    const lists = Object.values(dicts.checkItem.groups);
    const groups = Object.values(dicts.communication.groups);
    
    let html = '';
    currentBuildRows.forEach((row, idx) => {
        let listOptions = lists.map(l => `<option value="${l.id}" ${row.check_item_list_id == l.id ? 'selected' : ''}>${l.name}</option>`).join('');
        let groupOptions = groups.map(g => `<option value="${g.id}" ${row.group_id == g.id ? 'selected' : ''}>${g.name}</option>`).join('');

        // 找到该组下的所有通信机
        const commsInGroup = row.group_id ? Object.values(dicts.communication.items).filter(c => c.group_id == row.group_id) : [];
        const selectedCount = row.communication_ids.length;
        
        html += `
        <div class="build-config-row" style="background: var(--bg-surface); padding: 15px; border-radius: var(--radius-md); margin-bottom: 12px; border: 1px solid var(--border-default); box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
            <div style="display: flex; gap: 15px; align-items: flex-end; margin-bottom: 10px;">
                <div style="flex: 1.2;">
                    <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">📋 选择检查项列表 (Tier 1)</div>
                    <select class="form-control" onchange="window.snapshots.updateBuildRowList(${idx}, this.value)">
                        <option value="">-- 请选择列表 --</option>
                        ${listOptions}
                    </select>
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">📁 选择资产分组 (Tier 2)</div>
                    <select class="form-control" onchange="window.snapshots.updateBuildRowGroup(${idx}, this.value)">
                        <option value="">-- 全部分组 --</option>
                        <option value="null" ${row.group_id === 'null' ? 'selected' : ''}>未分组资产</option>
                        ${groupOptions}
                    </select>
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">💻 资产范围 (Tier 3)</div>
                    <div style="display: flex; gap: 8px; align-items: center; background: var(--bg-deepest); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                        <span style="font-weight: 600; font-size: 13px; color: var(--accent);">已选 ${selectedCount} 项</span>
                        <button type="button" class="btn-xs btn-outline-primary" style="padding: 2px 6px;" onclick="window.snapshots.toggleSelectAllInRow(${idx})">全选/清空</button>
                    </div>
                </div>
                <div class="row-actions">
                    <button type="button" class="btn-icon" onclick="window.snapshots.removeBuildRow(${idx})" title="删除此行" style="color: var(--danger); font-size: 18px; padding: 4px;">🗑️</button>
                </div>
            </div>
            
            ${row.group_id !== null ? `
            <div class="comms-mini-tree" style="margin-top: 10px; padding: 10px; background: var(--bg-deepest); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); max-height: 150px; overflow-y: auto;">
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                    ${commsInGroup.length > 0 ? commsInGroup.map(c => `
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${c.name} (${c.ip_address})">
                            <input type="checkbox" value="${c.id}" ${row.communication_ids.includes(c.id) ? 'checked' : ''} 
                                   onchange="window.snapshots.updateBuildRowComm(${idx}, ${c.id}, this.checked)" style="width: 14px; height: 14px; flex-shrink: 0;">
                            <span>${c.name} <span style="font-size: 10px; color: var(--text-muted);">${c.ip_address}</span></span>
                        </label>
                    `).join('') : '<div style="color: var(--text-muted); font-size: 12px; grid-column: 1/-1;">该组下无通信机数据</div>'}
                </div>
            </div>
            ` : ''}
        </div>
        `;
    });
    
    container.innerHTML = html;
    updateBuildSelectionCount();
}

function addBuildRow() {
    currentBuildRows.push({
        check_item_list_id: null,
        group_id: null,
        communication_ids: []
    });
    renderBuildRows();
}

function removeBuildRow(idx) {
    currentBuildRows.splice(idx, 1);
    renderBuildRows();
}

function updateBuildRowList(idx, val) {
    if (currentBuildRows[idx]) {
        currentBuildRows[idx].check_item_list_id = val ? parseInt(val) : null;
    }
}

function updateBuildRowGroup(idx, val) {
    if (currentBuildRows[idx]) {
        const row = currentBuildRows[idx];
        row.group_id = val === "" ? null : (val === "null" ? "null" : parseInt(val));
        
        // 自动选择该组下的所有通信机 (提升效率)
        const dicts = window.checks.dicts;
        const commsInGroup = row.group_id ? Object.values(dicts.communication.items).filter(c => {
            if (row.group_id === "null") return !c.group_id;
            return c.group_id == row.group_id;
        }) : [];
        
        row.communication_ids = commsInGroup.map(c => c.id);
        renderBuildRows();
    }
}

function updateBuildRowComm(idx, commId, checked) {
    const row = currentBuildRows[idx];
    if (!row) return;
    
    if (checked) {
        if (!row.communication_ids.includes(commId)) row.communication_ids.push(commId);
    } else {
        const i = row.communication_ids.indexOf(commId);
        if (i > -1) row.communication_ids.splice(i, 1);
    }
    updateBuildSelectionCount();
}

function toggleSelectAllInRow(idx) {
    const row = currentBuildRows[idx];
    if (!row || !row.group_id) return;
    
    const dicts = window.checks.dicts;
    const allIds = Object.values(dicts.communication.items).filter(c => {
        if (row.group_id === "null") return !c.group_id;
        return c.group_id == row.group_id;
    }).map(c => c.id);
    
    if (row.communication_ids.length === allIds.length) {
        row.communication_ids = [];
    } else {
        row.communication_ids = allIds;
    }
    renderBuildRows();
}

function updateBuildSelectionCount() {
    let total = 0;
    currentBuildRows.forEach(row => {
        total += row.communication_ids.length;
    });
    const el = document.getElementById('buildSelectionCount');
    if (el) el.textContent = `总计选择: ${total} 次采集任务`;
}

// 加载快照组到构建对话框
async function loadSnapshotGroupsForBuild() {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/snapshots/groups`, { headers: window.shared.getHeaders() });
        const groups = await res.json();
        const select = document.getElementById('buildSnapshotGroup');
        select.innerHTML = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    } catch (e) { console.error(e); }
}

function closeSnapshotBuildModal() {
    document.getElementById('snapshotBuildModal').classList.remove('active');
}

function getBuildConfig() {
    const config = [];
    
    currentBuildRows.forEach(row => {
        if (!row.check_item_list_id || row.communication_ids.length === 0) return;
        
        config.push({
            check_item_list_id: row.check_item_list_id,
            group_id: (row.group_id === "null" ? null : row.group_id),
            communication_ids: row.communication_ids
        });
    });
    
    return config;
}

// 开始构建
async function startSnapshotBuild() {
    const name = document.getElementById('buildSnapshotName').value.trim();
    const groupId = document.getElementById('buildSnapshotGroup').value;

    if (!name) { alert('请输入快照名称'); return; }
    if (!groupId) { alert('请选择快照组'); return; }

    const config = getBuildConfig();
    if (config.length === 0) { alert('请选择至少一台通信机'); return; }

    // 先关闭构建对话框
    closeSnapshotBuildModal();

    // 在快照表格中插入一行临时"启动中"状态
    insertBuildingRow(name, groupId);

    // 启动轮询活跃构建任务
    startBuildPolling();

    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/snapshots/build/start`, {
            method: 'POST',
            headers: { ...window.shared.getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                snapshot_name: name,
                snapshot_group_id: parseInt(groupId),
                build_config: config,
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('构建失败响应:', errText);
            let errMsg = errText;
            try {
                const err = JSON.parse(errText);
                errMsg = err.detail || err.message || errText;
            } catch { /* use raw text */ }
            alert('启动失败: ' + errMsg);
            // 移除临时行
            removeBuildingRow();
            return;
        }

        const data = await res.json();
        // 快照已由后端创建，刷新快照列表即可看到最新状态
        await loadSnapshots();

    } catch (e) {
        console.error(e);
        alert('启动失败: ' + e.message);
        removeBuildingRow();
    }
}

// 取消构建
async function cancelSnapshotBuild(taskId) {
    if (!confirm('确定取消构建？')) return;
    try {
        await fetch(`${window.shared.API_BASE}/api/v1/snapshots/build/${taskId}`, {
            method: 'DELETE',
            headers: window.shared.getHeaders()
        });
        stopBuildPolling();
        await loadSnapshots();
        alert('构建已取消');
    } catch (e) { console.error(e); }
}

// 按检查项聚合展示数据
async function renderAggregatedCheckItems(instances, instanceDataMap, itemMap, commMap) {
    // 收集所有检查项并按ID分组
    const checkItemGroups = {};

    for (const inst of instances) {
        const instanceData = instanceDataMap[inst.id];
        if (!instanceData || !instanceData.environment_data) continue;

        for (const ed of instanceData.environment_data) {
            const item = itemMap[ed.check_item_id];
            if (!item) continue;

            if (!checkItemGroups[ed.check_item_id]) {
                checkItemGroups[ed.check_item_id] = {
                    item: item,
                    results: []
                };
            }

            checkItemGroups[ed.check_item_id].results.push({
                instanceId: inst.id,
                communicationId: inst.communication_id,
                communicationName: commMap[inst.communication_id]?.name || `通信机${inst.communication_id}`,
                data: ed.data_value || {},
                hasError: !!(ed.data_value?._error || ed.data_value?._status === 'error' || ed.data_value?._status === 'connection_failed')
            });
        }
    }

    // 按通信机数量排序，优先显示所有通信机都有的检查项
    const sortedGroups = Object.values(checkItemGroups).sort((a, b) => {
        return b.results.length - a.results.length;
    });

    let html = '<div class="aggregated-check-items">';
    html += '<table class="check-items-table">';
    html += '<thead><tr>';
    html += '<th class="check-item-name-header">检查项</th>';

    // 收集所有通信机并排序
    const allComms = new Map();
    instances.forEach(inst => {
        const comm = commMap[inst.communication_id];
        allComms.set(inst.communication_id, {
            id: inst.communication_id,
            name: comm?.name || `通信机${inst.communication_id}`,
            ip: comm?.ip_address || '-'
        });
    });

    const sortedComms = Array.from(allComms.values()).sort((a, b) => a.name.localeCompare(b.name));

    // 为每个通信机添加列
    sortedComms.forEach(comm => {
        html += `<th class="communication-header" title="${comm.ip}">${comm.name}</th>`;
    });

    html += '</tr></thead>';
    html += '<tbody>';

    // 为每个检查项添加一行
    for (const group of sortedGroups) {
        const item = group.item;
        html += '<tr class="check-item-row">';

        // 检查项名称列
        html += '<td class="check-item-name-cell">';
        if (window.fileFormatter && window.fileFormatter.isFileCheckItem(item.type)) {
            // 文件检查项显示图标和类型
            html += `<span class="check-type-icon">${window.fileFormatter.getCheckTypeLabel(item.type)}</span>`;
        } else {
            html += `<span class="check-item-name">${item.name || `检查项#${item.id}`}</span>`;
        }
        html += '</td>';

        // 为每个通信机添加结果列
        sortedComms.forEach(comm => {
            const result = group.results.find(r => r.communicationId === comm.id);

            html += '<td class="result-cell">';
            if (result) {
                if (result.hasError) {
                    const errorMsg = result.data._error || '采集失败';
                    html += `<span class="result-error" title="${errorMsg}">❌</span>`;
                } else if (window.fileFormatter && window.fileFormatter.isFileCheckItem(item.type)) {
                    // 文件检查项显示格式化结果
                    const detailedResults = window.fileFormatter.formatFileCheckDataDetailed(item, result.data);
                    html += '<div class="file-results-inline">';
                    detailedResults.forEach((resultText, index) => {
                        if (index === 0) {
                            html += `<span class="file-result-text">${resultText}</span>`;
                        }
                    });
                    html += '</div>';
                } else {
                    // 非文件检查项显示状态指示
                    html += '<span class="result-indicator">📊</span>';
                }
            } else {
                // 该通信机没有此项检查
                html += '<span class="no-result">-</span>';
            }
            html += '</td>';
        });

        html += '</tr>';
    }

    html += '</tbody></table>';
    html += '</div>';

    return html;
}

// 查看快照详情 (新版：科技控制台风格)
async function viewSnapshotDetail(snapshotId) {
    const overlay = document.getElementById('snapshotDetailOverlay');
    const treeContainer = document.getElementById('snapshotDetailTree');
    const placeholder = document.getElementById('snapshotDetailPlaceholder');

    // 1. 初始化界面状态 (进入指令系统)
    overlay.classList.add('active');
    treeContainer.innerHTML = '';
    placeholder.style.display = 'flex';
    treeContainer.style.display = 'none';

    try {
        // 2. 获取数据
        const res = await fetch(`${window.shared.API_BASE}/api/v1/snapshots/${snapshotId}/full_details`, {
            headers: window.shared.getHeaders()
        });

        if (!res.ok) throw new Error('FETCH_ERROR_01: UNAUTHORIZED_OR_MISSING');
        const data = await res.json();

        // 3. 填充控制台汇总数据
        document.getElementById('summSnapshotName').textContent = data.summary.snapshot_name;
        document.getElementById('summSnapshotTime').textContent = new Date(data.summary.snapshot_time).toLocaleString();
        document.getElementById('summHostCount').textContent = data.summary.total_instances;
        document.getElementById('summItemCount').textContent = data.summary.total_check_items;

        // 4. 渲染层级树
        renderSnapshotTree(data.items);

        placeholder.style.display = 'none';
        treeContainer.style.display = 'block';

    } catch (e) {
        console.error('加载详情失败:', e);
        placeholder.innerHTML = `<div style="color:var(--danger); padding:20px;">❌ 加载失败: ${e.message}</div>`;
    }
}

// 渲染层级树：检查项 > 主机 > 采集内容
function renderSnapshotTree(items) {
    const container = document.getElementById('snapshotDetailTree');

    if (!items || items.length === 0) {
        container.innerHTML = '<li style="text-align:center; padding:40px; color:var(--sd-text-dim);">NO_DATA_RECORDS_FOUND</li>';
        return;
    }

    const html = items.map((item, index) => {
        const itemIcon = getItemIcon(item.type);
        return `
            <li class="tree-node-item" id="item-node-${item.id}">
                <div class="node-main-header" onclick="snapshots.toggleTreeNode(this.parentElement)">
                    <span class="node-chevron">▶</span>
                    <span class="node-icon-box">${itemIcon}</span>
                    <div class="node-info">
                        <span class="node-title">${item.name}</span>
                        <small style="color:var(--text-muted); margin-left:10px; font-family:'JetBrains Mono';">(${item.target_path || item.type})</small>
                    </div>
                </div>
                <div class="node-content-area">
                    ${item.hosts_data.map(host => {
                        const isFile = window.fileFormatter && window.fileFormatter.isFileCheckItem(item.type);
                        const formattedValue = isFile 
                            ? (window.fileFormatter.formatAllFileAttributes(host.value).join('\n') || '< 采集数据解析失败 >')
                            : formatRawValue(host.value);
                        
                        return `
                        <div class="host-section">
                            <div class="host-header" onclick="snapshots.toggleTreeNode(this.parentElement)">
                                <span class="node-chevron">▶</span>
                                <span class="host-label">🖥️ ${host.hostname} <small style="color:var(--text-muted);">[${host.ip}]</small></span>
                                <span class="host-time">${new Date(host.collected_at).toLocaleTimeString()}</span>
                            </div>
                            <div class="data-display-box">
                                <pre class="data-pre">${formattedValue}</pre>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </li>
        `;
    }).join('');

    container.innerHTML = html;
}

// 根据类型返回图标
function getItemIcon(type) {
    if (typeof type !== 'string') return '📋';
    const lowerType = type.toLowerCase();
    if (lowerType.includes('file')) return '📄';
    if (lowerType.includes('process')) return '⚙️';
    if (lowerType.includes('port')) return '🔌';
    if (lowerType.includes('route')) return '🗺️';
    if (lowerType.includes('content')) return '🔡';
    return '📋';
}

// 格式化采集值，确保易读
function formatRawValue(val) {
    if (val === null || val === undefined || val === '') return '< 此项无采集内容 >';
    if (typeof val === 'string') return val;

    // 特殊处理错误对象 (后端注入的 _error)
    if (typeof val === 'object' && val._error) {
        return `<span style="color:#ef4444; font-weight:bold;">[采集异常]</span> ${val._error}`;
    }

    if (typeof val === 'object' && Object.keys(val).length === 0) return '< 采集结果为空对象 >';
    return JSON.stringify(val, null, 2);
}

// 切换树节点展开/收起
function toggleTreeNode(element) {
    element.classList.toggle('expanded');
}

// 关闭详情
function closeSnapshotDetail() {
    document.getElementById('snapshotDetailOverlay').classList.remove('active');
}

// 过滤快照树
// 搜索过滤检查项 (支持名称与路径)
function filterSnapshotTree() {
    const keyword = document.getElementById('snapshotTreeSearch').value.toLowerCase();
    const items = document.querySelectorAll('#snapshotDetailTree .tree-node-item');

    items.forEach(node => {
        const text = node.textContent.toLowerCase(); // 包含名称和路径
        if (text.includes(keyword)) {
            node.style.display = 'block';
        } else {
            node.style.display = 'none';
        }
    });
}

// 刷新快照页面（重置分页和搜索）
async function refreshSnapshots() {
    console.log('🔄 正在刷新快照数据...');
    window.snapshotPagination.page = 1;
    window.snapshotPagination.q = '';
    const searchInput = document.getElementById('snapshotSearch');
    if (searchInput) searchInput.value = '';
    
    try {
        // 加载分组和列表
        await loadSnapshotGroups();
        await loadSnapshots();
        console.log('✅ 快照数据刷新完成');
    } catch (e) {
        console.error('❌ 刷新快照失败:', e);
    }
}

// 导出模块
window.snapshots = {
    openSnapshotGroupModal, loadSnapshotGroups, filterBySnapshotGroup, editSnapshotGroup, deleteSnapshotGroup, 
    openSnapshotModal, loadSnapshots, searchSnapshots, deleteSnapshot, refreshSnapshots,
    openSnapshotBuildModal, closeSnapshotBuildModal, startSnapshotBuild, cancelSnapshotBuild,
    viewSnapshotDetail, closeSnapshotDetail, toggleTreeNode, filterSnapshotTree,
    startBuildPolling, stopBuildPolling,
    addBuildRow, removeBuildRow, updateBuildRowList, updateBuildRowGroup, updateBuildRowComm, toggleSelectAllInRow
};