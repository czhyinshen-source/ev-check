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
                        <button class="btn btn-xs" onclick="viewSnapshotDetail(${s.id})">查看</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteSnapshot(${s.id})">删除</button>
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

// 加载通信机组树形结构
async function loadCommunicationGroupsTree() {
    try {
        // 获取通信机组树
        const groupsRes = await fetch(`${window.shared.API_BASE}/api/v1/communications/groups`, { headers: window.shared.getHeaders() });
        const groups = await groupsRes.json();

        // 获取所有通信机
        const commsRes = await fetch(`${window.shared.API_BASE}/api/v1/communications`, { headers: window.shared.getHeaders() });
        const comms = await commsRes.json();

        // 获取检查项列表
        const listsRes = await fetch(`${window.shared.API_BASE}/api/v1/check-items/lists`, { headers: window.shared.getHeaders() });
        const lists = await listsRes.json();

        // 构建树形HTML
        const container = document.getElementById('commGroupTree');
        let html = '';

        for (const group of groups) {
            const groupComms = comms.filter(c => c.group_id === group.id);
            html += `
                <div class="build-group-item" data-group-id="${group.id}">
                    <div class="group-header" onclick="toggleGroupExpand(${group.id})">
                        <input type="checkbox" class="group-select-all" onchange="toggleGroupSelection(${group.id}, this.checked); event.stopPropagation();">
                        <span class="group-toggle" id="toggle-${group.id}">▶</span>
                        <span class="group-name">${group.name}</span>
                        <span style="font-size:12px;color:#999;">(${groupComms.length}台)</span>
                    </div>
                    <div class="group-communications" id="group-comms-${group.id}" style="display:none;">
                        ${groupComms.length === 0 ? '<div style="padding:12px;color:#999;text-align:center;background:#f5f5f5;border-radius:4px;">此组暂无通信机</div>' : groupComms.map(c => `
                            <label class="comm-item">
                                <input type="checkbox" name="buildCommIds" value="${c.id}" data-group-id="${group.id}" onchange="updateBuildSelection()">
                                <span><strong>${c.name}</strong> <span style="color:#999;font-size:12px;">(${c.ip_address}:${c.port || 22})</span></span>
                            </label>
                        `).join('')}
                        ${groupComms.length > 0 ? `
                        <div class="check-list-selector">
                            <label>📋 为此组选择检查项列表:</label>
                            <select name="checkListId" data-group-id="${group.id}">
                                ${lists.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                            </select>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        if (groups.length === 0) {
            html = '<div style="padding:30px;color:#999;text-align:center;font-size:14px;">📭 暂无通信机组<br><span style="font-size:12px;">请先创建通信机组并添加通信机</span></div>';
        }

        container.innerHTML = html;
        updateBuildSelection();
    } catch (e) { console.error(e); }
}

function toggleGroupExpand(groupId) {
    const el = document.getElementById(`group-comms-${groupId}`);
    const toggle = document.getElementById(`toggle-${groupId}`);
    if (el.style.display === 'none' || el.style.display === '') {
        el.style.display = 'block';
        toggle.textContent = '▼';
    } else {
        el.style.display = 'none';
        toggle.textContent = '▶';
    }
}

function toggleGroupSelection(groupId, checked) {
    document.querySelectorAll(`input[name="buildCommIds"][data-group-id="${groupId}"]`).forEach(cb => {
        cb.checked = checked;
    });
    updateBuildSelection();
}

function updateBuildSelection() {
    const checked = document.querySelectorAll('input[name="buildCommIds"]:checked');
    const groups = new Set([...checked].map(cb => cb.dataset.groupId));
    document.getElementById('buildSelectionCount').textContent = `已选: ${checked.length}台, ${groups.size}组`;
}

function getBuildConfig() {
    const groups = {};

    document.querySelectorAll('input[name="buildCommIds"]:checked').forEach(cb => {
        const groupId = cb.dataset.groupId;
        if (!groups[groupId]) {
            groups[groupId] = [];
        }
        groups[groupId].push(parseInt(cb.value));
    });

    return Object.entries(groups).map(([groupId, commIds]) => {
        const select = document.querySelector(`select[name="checkListId"][data-group-id="${groupId}"]`);
        return {
            group_id: parseInt(groupId),
            communication_ids: commIds,
            check_item_list_id: select ? parseInt(select.value) : 1,
        };
    });
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

// 查看快照详情
async function viewSnapshotDetail(snapshotId) {
    try {
        document.getElementById('snapshotDetailModal').classList.add('active');
        document.getElementById('snapshotInstancesList').innerHTML = '<div class="loading">加载中...</div>';

        const [snapshotRes, instancesRes] = await Promise.all([
            fetch(`${window.shared.API_BASE}/api/v1/snapshots/${snapshotId}`, { headers: window.shared.getHeaders() }),
            fetch(`${window.shared.API_BASE}/api/v1/snapshots/instances?snapshot_id=${snapshotId}`, { headers: window.shared.getHeaders() }),
        ]);

        if (!snapshotRes.ok) throw new Error('加载快照失败');
        const snapshot = await snapshotRes.json();

        // 设置基本信息
        document.getElementById('detailSnapshotName').textContent = snapshot.name;
        document.getElementById('detailSnapshotMeta').textContent =
            `创建时间: ${new Date(snapshot.snapshot_time).toLocaleString()} | ` +
            `默认快照: ${snapshot.is_default ? '是' : '否'}` +
            (snapshot.description ? ` | ${snapshot.description}` : '');

        // 加载实例数据
        const instances = instancesRes.ok ? await instancesRes.json() : [];

        if (instances.length === 0) {
            document.getElementById('snapshotInstancesList').innerHTML = '<div class="empty-state">暂无采集数据</div>';
            return;
        }

        // 获取所有通信机信息用于显示名称
        const commsRes = await fetch(`${window.shared.API_BASE}/api/v1/communications`, { headers: window.shared.getHeaders() });
        const comms = commsRes.ok ? await commsRes.json() : [];
        const commMap = {};
        comms.forEach(c => { commMap[c.id] = c; });

        // 获取所有检查项列表
        const listsRes = await fetch(`${window.shared.API_BASE}/api/v1/check-items/lists`, { headers: window.shared.getHeaders() });
        const lists = listsRes.ok ? await listsRes.json() : [];
        const listMap = {};
        lists.forEach(l => { listMap[l.id] = l; });

        // 获取所有检查项
        const itemsRes = await fetch(`${window.shared.API_BASE}/api/v1/check-items`, { headers: window.shared.getHeaders() });
        const items = itemsRes.ok ? await itemsRes.json() : [];
        const itemMap = {};
        items.forEach(i => { itemMap[i.id] = i; });

        // 并行加载所有实例的环境数据
        const instanceDataPromises = instances.map(async (inst) => {
            try {
                const res = await fetch(`${window.shared.API_BASE}/api/v1/snapshots/instances/${inst.id}`, {
                    headers: window.shared.getHeaders(),
                });
                if (!res.ok) return null;
                const data = await res.json();
                return { instanceId: inst.id, data };
            } catch (e) {
                console.error(`加载实例 ${inst.id} 数据失败:`, e);
                return null;
            }
        });

        const instanceDataResults = await Promise.all(instanceDataPromises);
        const instanceDataMap = {};
        instanceDataResults.forEach(result => {
            if (result) {
                instanceDataMap[result.instanceId] = result.data;
            }
        });

        // 渲染实例列表和数据
        let html = '<div class="instances-grid">';
        for (const inst of instances) {
            const comm = commMap[inst.communication_id] || {};
            const list = listMap[inst.check_item_list_id] || {};
            const instanceData = instanceDataMap[inst.id];

            html += `
                <div class="instance-card">
                    <div class="instance-header">
                        <span class="comm-name">${comm.name || '未知通信机'}</span>
                        <span class="comm-ip">${comm.ip_address || '-'}:${comm.port || 22}</span>
                    </div>
                    <div class="instance-meta">
                        检查列表: ${list.name || '默认'}
                    </div>
            `;

            // 如果有数据，直接显示格式化后的数据
            if (instanceData && instanceData.environment_data && instanceData.environment_data.length > 0) {
                const envData = instanceData.environment_data;
                html += '<div class="instance-data-preview">';

                // 只显示前3个检查项，避免内容过长
                const displayData = envData.slice(0, 3);
                for (const ed of displayData) {
                    const item = itemMap[ed.check_item_id] || {};
                    const value = ed.data_value || {};

                    // 检查是否为文件检查项
                    if (window.fileFormatter && window.fileFormatter.isFileCheckItem(item.type)) {
                        const formatted = window.fileFormatter.formatFileCheckData(item, value);
                        html += `
                            <div class="file-check-preview">
                                <div class="file-path-line-preview">
                                    <span class="file-icon">📁</span>
                                    <span class="file-path">${formatted.filePath}</span>
                                </div>
                                <div class="check-type-line-preview">
                                    <span class="check-type-label">${formatted.checkType}</span>
                                </div>
                                <div class="check-results-preview">
                                    ${formatted.results.map(result =>
                                        `<div class="check-result-item">${result}</div>`
                                    ).join('')}
                                </div>
                            </div>
                        `;
                    } else {
                        // 非文件检查项显示基本信息
                        html += `
                            <div class="check-item-preview">
                                <div class="check-item-name">${item.name || `检查项#${ed.check_item_id}`}</div>
                                <div class="check-item-type">${item.type || '-'}</div>
                            </div>
                        `;
                    }
                }

                if (envData.length > 3) {
                    html += '<div class="more-items-hint">还有 ' + (envData.length - 3) + ' 个检查项...</div>';
                }

                html += '</div>';
                html += `
                    <div class="instance-data" id="instance-data-${inst.id}">
                        <button class="btn btn-xs" onclick="loadInstanceData(${inst.id})">查看详细数据</button>
                    </div>
                `;
            } else {
                // 没有数据时显示原来的按钮
                html += `
                    <div class="instance-data" id="instance-data-${inst.id}">
                        <button class="btn btn-xs" onclick="loadInstanceData(${inst.id})">加载采集数据</button>
                    </div>
                `;
            }

            html += '</div>';
        }
        html += '</div>';
        document.getElementById('snapshotInstancesList').innerHTML = html;

    } catch (e) {
        console.error(e);
        document.getElementById('snapshotInstancesList').innerHTML =
            `<div class="error-state">加载失败: ${e.message}</div>`;
    }
}

// 加载实例的采集数据
async function loadInstanceData(instanceId) {
    const container = document.getElementById(`instance-data-${instanceId}`);
    container.innerHTML = '<div class="loading">加载数据...</div>';

    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/snapshots/instances/${instanceId}`, {
            headers: window.shared.getHeaders(),
        });

        if (!res.ok) throw new Error('加载失败');

        const data = await res.json();
        const envData = data.environment_data || [];

        if (envData.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无数据</div>';
            return;
        }

        // 获取检查项信息用于显示名称
        const itemsRes = await fetch(`${window.shared.API_BASE}/api/v1/check-items`, { headers: window.shared.getHeaders() });
        const items = itemsRes.ok ? await itemsRes.json() : [];
        const itemMap = {};
        items.forEach(i => { itemMap[i.id] = i; });

        let html = '<div class="env-data-list">';
        for (const ed of envData) {
            const item = itemMap[ed.check_item_id] || {};
            const value = ed.data_value || {};

            // 检查是否为文件检查项
            if (window.fileFormatter && window.fileFormatter.isFileCheckItem(item.type)) {
                // 检查是否有错误
                const hasError = value._error || value._status === 'error' || value._status === 'connection_failed';

                if (hasError) {
                    // 文件检查项错误处理 - 使用原有错误显示格式
                    const errorMsg = value._error || '未知错误';
                    const errorType = value._error_type || '';
                    const errorHtml = `
                        <div class="env-data-error">
                            <div class="error-icon">⚠️</div>
                            <div class="error-message">
                                <strong>采集失败</strong>
                                ${errorType ? `<span class="error-type">${errorType}</span>` : ''}
                                <div class="error-detail">${errorMsg}</div>
                            </div>
                        </div>
                    `;
                    html += `
                        <div class="env-data-item file-check-item has-error">
                            <div class="file-path-line">
                                <span class="file-icon">📁</span>
                                <span class="file-path">${item.target_path || '-'}</span>
                            </div>
                            <div class="check-type-line">
                                <span class="check-type-label">${window.fileFormatter.getCheckTypeLabel(item.type)}</span>
                            </div>
                            <div class="check-results">
                                ${errorHtml}
                            </div>
                        </div>
                    `;
                } else {
                    // 格式化文件检查项
                    const formatted = window.fileFormatter.formatFileCheckData(item, value);

                    html += `
                        <div class="env-data-item file-check-item">
                            <!-- 第一行：文件路径 -->
                            <div class="file-path-line">
                                <span class="file-icon">📁</span>
                                <span class="file-path">${formatted.filePath}</span>
                            </div>
                            <!-- 第二行：检查项类型 -->
                            <div class="check-type-line">
                                <span class="check-type-label">${formatted.checkType}</span>
                            </div>
                            <!-- 第三行：采集结果 -->
                            <div class="check-results">
                                ${formatted.results.map(result =>
                                    `<div class="check-result-item">${result}</div>`
                                ).join('')}
                            </div>
                        </div>
                    `;
                }
            } else {
                // 原有非文件检查项的逻辑
                // 检查是否有错误
                const hasError = value._error || value._status === 'error' || value._status === 'connection_failed';

                let valueStr;
                let errorHtml = '';

                if (hasError) {
                    const errorMsg = value._error || '未知错误';
                    const errorType = value._error_type || '';
                    valueStr = JSON.stringify(value, null, 2);
                    errorHtml = `
                        <div class="env-data-error">
                            <div class="error-icon">⚠️</div>
                            <div class="error-message">
                                <strong>采集失败</strong>
                                ${errorType ? `<span class="error-type">${errorType}</span>` : ''}
                                <div class="error-detail">${errorMsg}</div>
                            </div>
                        </div>
                    `;
                } else {
                    // 移除内部字段
                    const displayValue = {...value};
                    delete displayValue._error;
                    delete displayValue._status;
                    delete displayValue._error_type;
                    valueStr = Object.keys(displayValue).length > 0 ? JSON.stringify(displayValue, null, 2) : '{}';
                }

                html += `
                    <div class="env-data-item ${hasError ? 'has-error' : ''}">
                        <div class="env-data-title">
                            <strong>${item.name || `检查项#${ed.check_item_id}`}</strong>
                            <span class="env-data-type">${item.type || '-'}</span>
                        </div>
                        ${errorHtml}
                        ${!hasError ? `<pre class="env-data-value">${valueStr}</pre>` : ''}
                    </div>
                `;
            }
        }
        html += '</div>';
        container.innerHTML = html;

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="error-state">加载失败: ${e.message}</div>`;
    }
}

function closeSnapshotDetailModal() {
    document.getElementById('snapshotDetailModal').classList.remove('active');
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
    loadInstanceData,
    closeSnapshotDetailModal,
    startBuildPolling,
    stopBuildPolling,
};