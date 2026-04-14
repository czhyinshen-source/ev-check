// 快照管理模块
window.currentSnapshotGroupId = window.currentSnapshotGroupId || '';

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

        const tree = document.getElementById('snapshotGroupTree');
        tree.innerHTML = `
            <li>
                <div class="group-item ${window.currentSnapshotGroupId === '' ? 'active' : ''}" data-group-id="" onclick="filterBySnapshotGroup('')">
                    <span class="icon">📁</span>
                    <span>全部快照</span>
                </div>
            </li>
            ${groupsArray.map(g => `
                <li>
                    <div class="group-item ${window.currentSnapshotGroupId == g.id ? 'active' : ''}" data-group-id="${g.id}" onclick="filterBySnapshotGroup(${g.id})"><span class="icon">📂</span>
                        <span>${g.name}</span>
                        <div class="list-actions">
                            <button class="btn btn-xs" onclick="editSnapshotGroup(${g.id}); event.stopPropagation();">✏️</button>
                            <button class="btn btn-xs" onclick="deleteSnapshotGroup(${g.id}); event.stopPropagation();">🗑️</button>
                        </div>
                    </div>
                </li>
            `).join('')}
        `;

        // 加载快照组到下拉选择框
        loadSnapshotGroupsForModal();
    } catch (e) {
        console.error(e);
        const tree = document.getElementById('snapshotGroupTree');
        tree.innerHTML = `
            <li>
                <div class="group-item ${window.currentSnapshotGroupId === '' ? 'active' : ''}" data-group-id="" onclick="filterBySnapshotGroup('')">
                    <span class="icon">📁</span>
                    <span>全部快照</span>
                </div>
            </li>
        `;
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

// 按快照组筛选快照
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
async function loadSnapshots() {
    try {
        // 同时获取快照列表和快照组列表
        const [snapshotsRes, groupsRes] = await Promise.all([
            fetch(`${window.shared.API_BASE}/api/v1/snapshots`, { headers: window.shared.getHeaders() }),
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

        // 构建 group_id -> name 映射
        const groups = groupsRes.ok ? await groupsRes.json() : [];
        const groupMap = {};
        groups.forEach(g => { groupMap[g.id] = g.name; });

        const data = await snapshotsRes.json();
        // 如果有筛选条件，只显示该组的快照
        let snapshots = Array.isArray(data) ? data : [];
        if (window.currentSnapshotGroupId) {
            snapshots = snapshots.filter(s => s.group_id == window.currentSnapshotGroupId);
        }

        const tbody = document.getElementById('snapshotTable');
        if (snapshots.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无数据</td></tr>';
            return;
        }

        tbody.innerHTML = snapshots.map(s => {
            const buildStatus = s.build_status;
            let statusHtml = '<span class="status-badge info">-</span>';
            if (buildStatus) {
                if (buildStatus.status === 'pending') {
                    statusHtml = '<span class="status-badge warning">⏳ 等待启动</span>';
                } else if (buildStatus.status === 'running') {
                    statusHtml = `<span class="status-badge info">
                        <span class="build-spinner"></span>
                        ${buildStatus.progress || 0}% (${buildStatus.completed_communications || 0}/${buildStatus.total_communications || 0})
                    </span>`;
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
            return `
                <tr data-snapshot-id="${s.id}">
                    <td>${s.id}</td>
                    <td>${s.name}</td>
                    <td>${groupMap[s.group_id] || `组${s.group_id}`}</td>
                    <td>${new Date(s.snapshot_time).toLocaleString()}</td>
                    <td><span class="status-badge ${s.is_default ? 'success' : 'info'}">${s.is_default ? '是' : '否'}</span></td>
                    <td>${statusHtml}</td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="snapshots.viewSnapshotDetail(${s.id})">查看</button>
                        <button class="btn btn-danger btn-sm" onclick="snapshots.deleteSnapshot(${s.id})">删除</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error(e);
        const tbody = document.getElementById('snapshotTable');
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">加载失败，请刷新页面重试</td></tr>';
    }
}

// 搜索快照
function searchSnapshots() {
    const searchTerm = document.getElementById('snapshotSearch').value.toLowerCase();
    // 这里可以实现更复杂的搜索逻辑
    loadSnapshots();
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
            stopBuildPolling();
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
            stopBuildPolling();
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
    const statusCell = row.querySelector('td:nth-child(6)');

    if (task.status === 'pending') {
        statusCell.innerHTML = '<span class="status-badge warning">⏳ 等待启动</span>';
    } else if (task.status === 'running') {
        statusCell.innerHTML = `<span class="status-badge info">
            <span class="build-spinner"></span>
            ${task.progress || 0}% (${task.completed_communications || 0}/${task.total_communications || 0})
        </span>`;
    } else if (task.status === 'completed') {
        statusCell.innerHTML = '<span class="status-badge success">✓ 已完成</span>';
    } else if (task.status === 'failed') {
        statusCell.innerHTML = `<span class="status-badge error" title="${task.error_message || ''}">✗ 构建异常</span>`;
    } else if (task.status === 'cancelled') {
        statusCell.innerHTML = '<span class="status-badge warning">- 已取消</span>';
    } else {
        statusCell.innerHTML = `<span class="status-badge info">${task.status}</span>`;
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

// 打开构建对话框
function openSnapshotBuildModal() {
    document.getElementById('buildSnapshotName').value = '';
    loadSnapshotGroupsForBuild();
    loadCommunicationGroupsTree();
    document.getElementById('snapshotBuildModal').classList.add('active');
}

function closeSnapshotBuildModal() {
    document.getElementById('snapshotBuildModal').classList.remove('active');
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

// 加载构建快照的 M:M 配置树 (检查项列表 -> 通信机组)
async function loadCommunicationGroupsTree() {
    try {
        const [listsRes, groupsRes, commsRes] = await Promise.all([
            fetch(`${window.shared.API_BASE}/api/v1/check-items/lists`, { headers: window.shared.getHeaders() }),
            fetch(`${window.shared.API_BASE}/api/v1/communications/groups`, { headers: window.shared.getHeaders() }),
            fetch(`${window.shared.API_BASE}/api/v1/communications`, { headers: window.shared.getHeaders() })
        ]);

        const lists = await listsRes.json();
        const groups = await groupsRes.json();
        const comms = await commsRes.json();

        const container = document.getElementById('commGroupTree');
        let html = '';

        if (lists.length === 0) {
            container.innerHTML = '<div class="empty-state">请先在"检查项工作空间"创建检查项列表</div>';
            return;
        }

        // 递归渲染组树 (纯 CSS class 驱动展开/收起)
        function renderGroupTree(listId, parentId = null) {
            const currentGroups = groups.filter(g => g.parent_id == parentId);
            const ungroupedComms = parentId === null ? comms.filter(c => !c.group_id) : [];
            
            if (currentGroups.length === 0 && ungroupedComms.length === 0 && parentId !== null) return '';

            let groupHtml = '';
            
            // 渲染当前层级的组
            currentGroups.forEach(group => {
                const groupComms = comms.filter(c => c.group_id == group.id);
                const childrenHtml = renderGroupTree(listId, group.id);
                const hasChildren = groupComms.length > 0 || childrenHtml.length > 0;
                
                groupHtml += `
                    <div class="build-group-item" id="group-container-${listId}-${group.id}">
                        <div class="group-header" onclick="snapshots.toggleGroupExpand(this.parentElement, event)">
                            <input type="checkbox" class="group-checkbox" 
                                   data-list-id="${listId}"
                                   data-group-id="${group.id}"
                                   onclick="event.stopPropagation()"
                                   onchange="snapshots.toggleGroupSelection(${listId}, ${group.id}, this.checked)">
                            <span class="group-chevron">▶</span>
                            <span class="view-toggle">📁</span>
                            <span class="group-name">${group.name}</span>
                            <span class="group-count">${groupComms.length} 台</span>
                        </div>
                        <div class="group-content">
                            ${groupComms.map(c => `
                                <label class="comm-item">
                                    <input type="checkbox" name="comm-node" 
                                           data-list-id="${listId}" 
                                           data-group-id="${group.id}" 
                                           value="${c.id}" 
                                           onchange="snapshots.updateBuildSelection()">
                                    <span>${c.name} <small>(${c.ip_address})</small></span>
                                </label>
                            `).join('')}
                            ${childrenHtml}
                        </div>
                    </div>
                `;
            });

            // 如果是顶级，也渲染那些没有分组的通信机
            if (parentId === null && ungroupedComms.length > 0) {
                groupHtml += `
                    <div class="build-group-item">
                        <div class="group-header" onclick="snapshots.toggleGroupExpand(this.parentElement, event)">
                            <span class="group-chevron">▶</span>
                            <span class="view-toggle">🌐</span>
                            <span class="group-name">未分组资产</span>
                            <span class="group-count">${ungroupedComms.length} 台</span>
                        </div>
                        <div class="group-content">
                            ${ungroupedComms.map(c => `
                                <label class="comm-item">
                                    <input type="checkbox" name="comm-node" 
                                           data-list-id="${listId}" 
                                           data-group-id="null" 
                                           value="${c.id}" 
                                           onchange="snapshots.updateBuildSelection()">
                                    <span>${c.name} <small>(${c.ip_address})</small></span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            return groupHtml;
        }

        lists.forEach(list => {
            html += `
                <div class="build-task-card" data-list-id="${list.id}">
                    <div class="task-header" onclick="snapshots.toggleListExpand(${list.id})">
                        <span class="task-chevron" id="list-chevron-${list.id}">▶</span>
                        <span class="icon">📋</span>
                        <span class="task-title">${list.name}</span>
                        <span class="task-count" id="list-count-${list.id}">已选 0 台</span>
                    </div>
                    <div class="task-body" id="list-body-${list.id}" style="display:none; padding:10px 15px;">
                        <p class="build-hint">在下方资产架构中勾选此列表拟进行采集的目标：</p>
                        ${renderGroupTree(list.id)}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        updateBuildSelection();
    } catch (e) { console.error('加载构建配置失败:', e); }
}

function toggleListExpand(listId) {
    const body = document.getElementById(`list-body-${listId}`);
    const chevron = document.getElementById(`list-chevron-${listId}`);
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'block' : 'none';
    chevron.textContent = isHidden ? '▼' : '▶';
}

// CSS class 驱动的展开/收起 — 每个 group-item 独立控制自身 .expanded
function toggleGroupExpand(groupElement, event) {
    if (event) event.stopPropagation();
    if (!groupElement) return;
    groupElement.classList.toggle('expanded');
}

function toggleGroupSelection(listId, groupId, checked) {
    // 递归选择当前组及其子组下的所有通信机
    const container = document.getElementById(`group-container-${listId}-${groupId}`);
    if (!container) return;

    // 1. 选中下属所有的通信机节点
    const comms = container.querySelectorAll('input[name="comm-node"]');
    comms.forEach(c => c.checked = checked);

    // 2. 选中下属所有的子组选择框 (视觉同步)
    const childGroupChecks = container.querySelectorAll('.group-checkbox');
    childGroupChecks.forEach(c => c.checked = checked);

    updateBuildSelection();
}

function updateBuildSelection() {
    let totalComms = 0;
    const taskCards = document.querySelectorAll('.build-task-card');
    
    taskCards.forEach(card => {
        const lid = card.dataset.listId;
        const checkedNodes = card.querySelectorAll('input[name="comm-node"]:checked');
        const countEl = document.getElementById(`list-count-${lid}`);
        if (countEl) countEl.textContent = `已选 ${checkedNodes.length} 台`;
        totalComms += checkedNodes.length;
    });
    
    const totalEl = document.getElementById('buildSelectionCount');
    if (totalEl) totalEl.textContent = `总计选择: ${totalComms} 次采集任务`;
}

function getBuildConfig() {
    const config = [];
    const taskCards = document.querySelectorAll('.build-task-card');
    
    taskCards.forEach(card => {
        const listId = parseInt(card.dataset.listId);
        const checkedNodes = Array.from(card.querySelectorAll('input[name="comm-node"]:checked')).map(cb => parseInt(cb.value));
        
        if (checkedNodes.length > 0) {
            // 找到涉及的所有 group_ids
            const groupIds = new Set(Array.from(card.querySelectorAll('input[name="comm-node"]:checked')).map(cb => parseInt(cb.dataset.groupId)));
            
            groupIds.forEach(gid => {
                const groupComms = Array.from(card.querySelectorAll(`input[name="comm-node"][data-group-id="${gid}"]:checked`)).map(cb => parseInt(cb.value));
                if (groupComms.length > 0) {
                    config.push({
                        check_item_list_id: listId,
                        group_id: gid,
                        communication_ids: groupComms
                    });
                }
            });
        }
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

// 导出模块
window.snapshots = {
    openSnapshotGroupModal,
    loadSnapshotGroups,
    filterBySnapshotGroup,
    editSnapshotGroup,
    deleteSnapshotGroup,
    openSnapshotModal,
    loadSnapshots,
    searchSnapshots,
    deleteSnapshot,
    openSnapshotBuildModal,
    closeSnapshotBuildModal,
    startSnapshotBuild,
    cancelSnapshotBuild,
    viewSnapshotDetail,
    closeSnapshotDetail,
    toggleTreeNode,
    filterSnapshotTree,
    startBuildPolling,
    stopBuildPolling,
    toggleListExpand,
    toggleGroupExpand,
    toggleGroupSelection,
    updateBuildSelection,
};