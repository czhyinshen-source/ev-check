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
        const res = await fetch(`${API_BASE}/api/v1/snapshots/groups`, { headers: getHeaders() });
        if (!res.ok) throw new Error('API请求失败');
        const groups = await res.json();
        const select = document.getElementById('snapshotGroupParent');
        select.innerHTML = `<option value="">无</option>` + groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    } catch (e) { console.error(e); }
}

// 加载检查项列表到快照组模态框
async function loadCheckItemListsForSnapshotGroup() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/check-items/lists`, { headers: getHeaders() });
        if (!res.ok) throw new Error('API请求失败');
        const lists = await res.json();
        const select = document.getElementById('snapshotGroupCheckItemList');
        select.innerHTML = `<option value="">无</option>` + lists.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    } catch (e) { console.error(e); }
}

// 加载快照组
async function loadSnapshotGroups() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/snapshots/groups`, { headers: getHeaders() });
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
        const res = await fetch(`${API_BASE}/api/v1/snapshots/groups`, { headers: getHeaders() });
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
        const res = await fetch(`${API_BASE}/api/v1/snapshots/groups/${id}`, { headers: getHeaders() });
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
        await fetch(`${API_BASE}/api/v1/snapshots/groups/${id}`, { 
            method: 'DELETE', 
            headers: getHeaders() 
        });
        loadSnapshotGroups();
        loadSnapshots();
    } catch (e) { console.error(e); }
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
        const res = await fetch(`${API_BASE}/api/v1/communications`, { headers: getHeaders() });
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
        const res = await fetch(`${API_BASE}/api/v1/communications/groups`, { headers: getHeaders() });
        const groups = await res.json();
        const select = document.getElementById('communicationGroup');
        select.innerHTML = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    } catch (e) { console.error(e); }
}

// 加载检查项列表到快照模态框
async function loadCheckItemListsForSnapshot() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/check-items/lists`, { headers: getHeaders() });
        const lists = await res.json();
        const select = document.getElementById('checkItemList');
        select.innerHTML = lists.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    } catch (e) { console.error(e); }
}

// 加载快照列表
async function loadSnapshots() {
    try {
        let url = `${API_BASE}/api/v1/snapshots`;
        if (window.currentSnapshotGroupId) {
            url = `${API_BASE}/api/v1/snapshots?group_id=${window.currentSnapshotGroupId}`;
        }
        
        const res = await fetch(url, { headers: getHeaders() });
        if (!res.ok) {
            if (res.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('username');
                window.location.href = '/login.html';
                return;
            }
            throw new Error('API请求失败');
        }
        
        const data = await res.json();
        const snapshots = Array.isArray(data) ? data : [];
        
        const tbody = document.getElementById('snapshotTable');
        if (snapshots.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无数据</td></tr>';
            return;
        }
        
        tbody.innerHTML = snapshots.map(s => `
            <tr>
                <td>${s.id}</td>
                <td>${s.name}</td>
                <td>${s.group_id}</td>
                <td>${new Date(s.snapshot_time).toLocaleString()}</td>
                <td><span class="status-badge ${s.is_default ? 'success' : 'info'}">${s.is_default ? '是' : '否'}</span></td>
                <td><button class="btn btn-danger btn-sm" onclick="deleteSnapshot(${s.id})">删除</button></td>
            </tr>
        `).join('');
    } catch (e) {
        console.error(e);
        const tbody = document.getElementById('snapshotTable');
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">加载失败，请刷新页面重试</td></tr>';
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
        await fetch(`${API_BASE}/api/v1/snapshots/${id}`, { 
            method: 'DELETE', 
            headers: getHeaders() 
        });
        loadSnapshots();
    } catch (e) { console.error(e); }
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
    if (window.buildProgressInterval) {
        clearInterval(window.buildProgressInterval);
        window.buildProgressInterval = null;
    }
}

// 加载快照组到构建对话框
async function loadSnapshotGroupsForBuild() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/snapshots/groups`, { headers: getHeaders() });
        const groups = await res.json();
        const select = document.getElementById('buildSnapshotGroup');
        select.innerHTML = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    } catch (e) { console.error(e); }
}

// 加载通信机组树形结构
async function loadCommunicationGroupsTree() {
    try {
        // 获取通信机组树
        const groupsRes = await fetch(`${API_BASE}/api/v1/communications/groups`, { headers: getHeaders() });
        const groups = await groupsRes.json();

        // 获取所有通信机
        const commsRes = await fetch(`${API_BASE}/api/v1/communications`, { headers: getHeaders() });
        const comms = await commsRes.json();

        // 获取检查项列表
        const listsRes = await fetch(`${API_BASE}/api/v1/check-items/lists`, { headers: getHeaders() });
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
                    </div>
                    <div class="group-communications" id="group-comms-${group.id}" style="display:none;">
                        ${groupComms.length === 0 ? '<div style="padding:8px;color:#999;">此组暂无通信机</div>' : groupComms.map(c => `
                            <label class="comm-item">
                                <input type="checkbox" name="buildCommIds" value="${c.id}" data-group-id="${group.id}" onchange="updateBuildSelection()">
                                <span>${c.name} (${c.ip_address})</span>
                            </label>
                        `).join('')}
                        ${groupComms.length > 0 ? `
                        <div class="check-list-selector">
                            <label>关联检查项列表:</label>
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
            html = '<div style="padding:20px;color:#999;text-align:center;">暂无通信机组</div>';
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

    try {
        const res = await fetch(`${API_BASE}/api/v1/snapshots/build/start`, {
            method: 'POST',
            headers: { ...getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                snapshot_name: name,
                snapshot_group_id: parseInt(groupId),
                build_config: config,
            })
        });

        if (!res.ok) {
            const err = await res.json();
            alert('启动失败: ' + (err.detail || err.message));
            return;
        }

        const data = await res.json();
        closeSnapshotBuildModal();
        showBuildProgress(data.task_id, data.snapshot_name);

    } catch (e) {
        console.error(e);
        alert('启动失败: ' + e.message);
    }
}

// 显示构建进度
let currentBuildTaskId = null;

function showBuildProgress(taskId, snapshotName) {
    currentBuildTaskId = taskId;
    document.getElementById('buildProgressName').textContent = snapshotName;
    document.getElementById('snapshotBuildProgressModal').classList.add('active');
    document.getElementById('cancelBuildBtn').onclick = () => cancelSnapshotBuild(taskId);
    pollBuildProgress(taskId);
    if (window.buildProgressInterval) clearInterval(window.buildProgressInterval);
    window.buildProgressInterval = setInterval(() => pollBuildProgress(taskId), 2000);
}

async function pollBuildProgress(taskId) {
    try {
        const res = await fetch(`${API_BASE}/api/v1/snapshots/build/${taskId}/progress`, { headers: getHeaders() });
        const data = await res.json();

        // 更新总体进度
        document.getElementById('buildOverallProgress').style.width = data.progress + '%';
        document.getElementById('buildProgressText').textContent =
            `${data.progress}% (${data.completed_communications}/${data.total_communications} 台)`;

        // 更新分组进度
        const container = document.getElementById('buildGroupsProgress');
        let html = '';
        for (const group of data.groups_progress || []) {
            const completedComm = group.communications.filter(c => c.status === 'success').length;
            const totalComm = group.communications.length;
            html += `
                <div class="build-group-progress">
                    <div class="group-title" onclick="toggleGroupProgress(this)">
                        <span class="group-toggle">▶</span>
                        <span>${group.group_name} (${completedComm}/${totalComm})</span>
                        <span class="status-${group.status}">${group.status === 'completed' ? '✓ 完成' : group.status === 'running' ? '进行中' : group.status === 'failed' ? '✗ 失败' : group.status}</span>
                    </div>
                    <div class="group-comm-progress" style="display:none;">
                        ${group.communications.map(c => `
                            <div class="comm-progress-item">
                                <span class="comm-status-${c.status}">${c.status === 'success' ? '✓' : c.status === 'running' ? '▸' : c.status === 'failed' ? '✗' : '○'}</span>
                                <span>${c.name}</span>
                                <span class="comm-status-text">${c.status === 'success' ? '完成' : c.status === 'running' ? '采集中' : c.status === 'failed' ? '失败' : '等待'}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;

        // 检查是否完成
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
            clearInterval(window.buildProgressInterval);
            window.buildProgressInterval = null;
            if (data.status === 'completed') {
                alert('快照构建完成！');
            }
        }
    } catch (e) { console.error(e); }
}

function toggleGroupProgress(el) {
    const progress = el.parentElement.querySelector('.group-comm-progress');
    if (!progress) return;
    if (progress.style.display === 'none' || progress.style.display === '') {
        progress.style.display = 'block';
        el.querySelector('.group-toggle').textContent = '▼';
    } else {
        progress.style.display = 'none';
        el.querySelector('.group-toggle').textContent = '▶';
    }
}

// 取消构建
async function cancelSnapshotBuild(taskId) {
    if (!confirm('确定取消构建？')) return;
    try {
        await fetch(`${API_BASE}/api/v1/snapshots/build/${taskId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        clearInterval(window.buildProgressInterval);
        window.buildProgressInterval = null;
        closeBuildProgressModal();
        alert('构建已取消');
    } catch (e) { console.error(e); }
}

function closeBuildProgressModal() {
    document.getElementById('snapshotBuildProgressModal').classList.remove('active');
    if (window.buildProgressInterval) {
        clearInterval(window.buildProgressInterval);
        window.buildProgressInterval = null;
    }
    currentBuildTaskId = null;
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
    showBuildProgress,
    pollBuildProgress,
    toggleGroupProgress,
    cancelSnapshotBuild,
    closeBuildProgressModal,
};