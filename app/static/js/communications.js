// 通信机管理模块

// 模块状态变量
let currentGroupId = '';
// 从localStorage加载通信机连接状态，持久化存储
let communicationStatuses = JSON.parse(localStorage.getItem('communicationStatuses') || '{}');
// 拖拽状态
let draggedGroupId = null;

// 启动定时检查通信机状态的任务（每分钟执行一次）
setInterval(() => checkAllCommunicationStatuses(), 60000);

// 打开通信机模态框
function openCommModal(id = null) {
    document.getElementById('commId').value = id || '';
    document.getElementById('commName').value = '';
    document.getElementById('commIp').value = '';
    document.getElementById('commPort').value = '22';
    document.getElementById('commUsername').value = 'root';
    document.getElementById('commAuthType').value = 'password';
    document.getElementById('commGroup').value = '';
    document.getElementById('commPassword').value = '';
    document.getElementById('commDesc').value = '';
    document.getElementById('commModalTitle').textContent = id ? '编辑通信机' : '添加通信机';
    loadGroupsForModal();
    loadSSHKeysForModal();
    toggleAuthFields();
    document.getElementById('commModal').classList.add('active');
}

// 编辑通信机
async function editComm(id) {
    const { API_BASE, getHeaders } = window.shared;
    try {
        const res = await fetch(`${API_BASE}/api/v1/communications/${id}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('获取通信机信息失败');
        const comm = await res.json();

        document.getElementById('commId').value = comm.id;
        document.getElementById('commName').value = comm.name;
        document.getElementById('commIp').value = comm.ip_address;
        document.getElementById('commPort').value = comm.port;
        document.getElementById('commUsername').value = comm.username;
        document.getElementById('commAuthType').value = comm.auth_method || 'password';
        document.getElementById('commGroup').value = comm.group_id || '';
        document.getElementById('commDesc').value = comm.description || '';

        // 如果使用密钥认证，提取SSH密钥ID
        if (comm.private_key_path && comm.private_key_path.startsWith('key_')) {
            const sshKeyId = comm.private_key_path.replace('key_', '');
            document.getElementById('commPrivateKey').value = sshKeyId;
        }

        document.getElementById('commModalTitle').textContent = '编辑通信机';
        await loadGroupsForModal();
        await loadSSHKeysForModal();
        toggleAuthFields();
        document.getElementById('commModal').classList.add('active');
    } catch (e) {
        console.error('加载通信机信息失败:', e);
        alert('加载通信机信息失败: ' + e.message);
    }
}

// 加载通信机分组到模态框
async function loadGroupsForModal() {
    const { API_BASE, getHeaders } = window.shared;
    try {
        const res = await fetch(`${API_BASE}/api/v1/communications/groups`, { headers: getHeaders() });
        if (!res.ok) throw new Error('API请求失败');
        const groups = await res.json();
        const select = document.getElementById('commGroup');
        select.innerHTML = `<option value="">无</option>` + groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    } catch (e) { console.error(e); }
}

// 加载SSH密钥到模态框
async function loadSSHKeysForModal() {
    const { API_BASE, getHeaders } = window.shared;
    try {
        const res = await fetch(`${API_BASE}/api/v1/keys`, { headers: getHeaders() });
        if (!res.ok) throw new Error('API请求失败');
        const keys = await res.json();
        const select = document.getElementById('commPrivateKey');
        select.innerHTML = keys.map(k => `<option value="${k.id}">${k.name}</option>`).join('');
    } catch (e) { console.error(e); }
}

// 切换认证字段
function toggleAuthFields() {
    const authType = document.getElementById('commAuthType').value;
    document.getElementById('passwordField').style.display = authType === 'password' ? 'block' : 'none';
    document.getElementById('keyField').style.display = authType === 'private_key' ? 'block' : 'none';
    document.getElementById('deployKeyField').style.display = authType === 'private_key' ? 'block' : 'none';
}

// 加载通信机分组（树形结构）
async function loadGroups() {
    const { API_BASE, getHeaders } = window.shared;
    try {
        const [groupsRes, commsRes] = await Promise.all([
            fetch(`${API_BASE}/api/v1/communications/groups?format=tree`, { headers: getHeaders() }),
            fetch(`${API_BASE}/api/v1/communications`, { headers: getHeaders() })
        ]);
        const groups = await groupsRes.json();
        const comms = await commsRes.json();

        const getCountByGroup = (groupId) => {
            if (groupId === '' || groupId === null) return comms.length;
            return comms.filter(c => c.group_id === groupId).length;
        };

        // 递归渲染分组树
        const renderGroupTree = (groupList, level = 0) => {
            if (!groupList || groupList.length === 0) return '';
            const indent = level * 16;
            return groupList.map(g => `
                <li class="group-tree-item" data-group-id="${g.id}" style="padding-left: ${indent}px">
                    <div class="group-item ${currentGroupId == g.id ? 'active' : ''}" data-group-id="${g.id}">
                        ${g.children && g.children.length > 0 ? '<span class="tree-toggle" onclick="toggleGroupChildren(event, ' + g.id + ')">▼</span>' : '<span class="tree-spacer"></span>'}
                        <span class="group-name" onclick="filterByGroup(${g.id})" draggable="true" ondragstart="handleGroupDragStart(event, ${g.id})" ondragover="handleGroupDragOver(event)" ondrop="handleGroupDrop(event, ${g.id})">${g.name}</span>
                        <span class="count">${getCountByGroup(g.id)}</span>
                        <span class="group-actions">
                            <span class="action-btn" onclick="editGroup(${g.id})" title="编辑分组">✏️</span>
                            <span class="action-btn" onclick="deleteGroup(${g.id})" title="删除分组">🗑️</span>
                        </span>
                    </div>
                    <ul class="group-children" id="group-children-${g.id}" style="display: none;">
                        ${renderGroupTree(g.children, level + 1)}
                    </ul>
                </li>
            `).join('');
        };

        const tree = document.getElementById('groupTree');
        tree.innerHTML = `
            <li>
                <div class="group-item ${currentGroupId === '' ? 'active' : ''}" data-group-id="" onclick="filterByGroup('')" ondragover="handleGroupDragOver(event)" ondrop="handleGroupDropToRoot(event)">
                    <span class="icon">📁</span>
                    <span>全部通信机</span>
                    <span class="count">${getCountByGroup('')}</span>
                </div>
            </li>
            ${renderGroupTree(groups)}
        `;
    } catch (e) { console.error(e); }
}

// 展开/折叠子分组
function toggleGroupChildren(event, groupId) {
    event.stopPropagation();
    const children = document.getElementById(`group-children-${groupId}`);
    const toggle = event.target;
    if (children.style.display === 'none') {
        children.style.display = 'block';
        toggle.textContent = '▼';
    } else {
        children.style.display = 'none';
        toggle.textContent = '▶';
    }
}

// 按分组筛选通信机
function filterByGroup(groupId) {
    currentGroupId = groupId;
    document.querySelectorAll('.group-item').forEach(item => {
        item.classList.toggle('active', item.dataset.groupId == groupId);
    });
    loadCommunications();
}

// 加载通信机列表
async function loadCommunications() {
    const { API_BASE, getHeaders } = window.shared;
    try {
        console.log('开始加载通信机列表...');

        // 加载批量操作工具栏的分组下拉框
        try {
            const groupsRes = await fetch(`${API_BASE}/api/v1/communications/groups`, { headers: getHeaders() });
            if (groupsRes.ok) {
                const groups = await groupsRes.json();
                const select = document.getElementById('batchTargetGroup');
                if (select) {
                    select.innerHTML = '<option value="">选择目标分组</option>' + groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
                }
            }
        } catch (e) {
            console.error('加载分组列表失败:', e);
        }

        const res = await fetch(`${API_BASE}/api/v1/communications`, { headers: getHeaders() });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        let comms = await res.json();
        console.log('成功加载通信机列表，数量:', comms.length);

        if (currentGroupId) {
            comms = comms.filter(c => c.group_id == currentGroupId);
        }

        const searchTerm = document.getElementById('commSearch')?.value?.toLowerCase() || '';
        if (searchTerm) {
            comms = comms.filter(c =>
                c.name.toLowerCase().includes(searchTerm) ||
                c.ip_address.toLowerCase().includes(searchTerm)
            );
        }

        const tbody = document.getElementById('commTable');
        if (comms.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无数据</td></tr>';
            return;
        }

        tbody.innerHTML = comms.map(c => {
            // 获取本地存储的连接状态，默认为'unknown'
            const status = communicationStatuses[c.id] || 'unknown';
            return `
                <tr>
                    <td><input type="checkbox" name="communicationIds" value="${c.id}" onchange="updateBatchToolbar()"></td>
                    <td>${c.name}</td>
                    <td>${c.ip_address}</td>
                    <td>${c.port}</td>
                    <td>${c.username}</td>
                    <td>
                        <span class="status-badge ${status === 'online' ? 'success' : status === 'offline' ? 'error' : 'info'}">
                            <span class="status-dot ${status === 'online' ? 'online' : status === 'offline' ? 'offline' : 'unknown'}"></span>
                            ${status === 'online' ? '在线' : status === 'offline' ? '离线' : '未连接'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="testConnection(${c.id})">测试</button>
                        <button class="btn btn-primary btn-sm" onclick="editComm(${c.id})">编辑</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteComm(${c.id})">删除</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('加载通信机列表失败:', error);
        const tbody = document.getElementById('commTable');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">加载失败: ' + error.message + '</td></tr>';
        }
    }
}

// 搜索通信机
function searchCommunications() {
    loadCommunications();
}

// 测试通信机连接
async function testConnection(id) {
    const { API_BASE, getHeaders } = window.shared;
    try {
        // 使用正确的 API 端点 (GET方法)
        const res = await fetch(`${API_BASE}/api/v1/communications/${id}/status`, {
            headers: getHeaders()
        });

        if (!res.ok) {
            throw new Error('测试连接失败');
        }

        const result = await res.json();

        // 更新本地存储的连接状态
        communicationStatuses[id] = result.status === 'online' ? 'online' : 'offline';
        localStorage.setItem('communicationStatuses', JSON.stringify(communicationStatuses));

        // 重新加载通信机列表
        loadCommunications();

        alert(result.status === 'online' ? '✅ 连接成功！' : '❌ 连接失败');
    } catch (e) {
        console.error('测试连接失败:', e);
        alert('❌ 测试连接失败: ' + e.message);
    }
}

// 检查所有通信机状态
async function checkAllCommunicationStatuses() {
    const { API_BASE, getHeaders } = window.shared;
    try {
        // 获取所有通信机
        const commsRes = await fetch(`${API_BASE}/api/v1/communications`, {
            headers: getHeaders()
        });
        const communications = await commsRes.json();

        // 逐个检查通信机状态
        const statusPromises = communications.map(async (comm) => {
            try {
                const res = await fetch(`${API_BASE}/api/v1/communications/${comm.id}/status`, {
                    headers: getHeaders()
                });
                const result = await res.json();
                communicationStatuses[comm.id] = result.status || 'unknown';
            } catch (error) {
                console.error(`检查通信机 ${comm.id} 失败:`, error);
                communicationStatuses[comm.id] = 'error';
            }
        });

        await Promise.all(statusPromises);
        localStorage.setItem('communicationStatuses', JSON.stringify(communicationStatuses));

        // 重新加载通信机列表
        loadCommunications();
    } catch (e) {
        console.error('检查通信机状态失败:', e);
    }
}

// 删除通信机
async function deleteComm(id) {
    const { API_BASE, getHeaders } = window.shared;
    if (!confirm('确定删除此通信机?')) return;
    try {
        await fetch(`${API_BASE}/api/v1/communications/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        loadCommunications();
        loadGroups();
    } catch (e) { console.error(e); }
}

// 打开分组模态框
function openGroupModal(group = null) {
    const modal = document.getElementById('groupModal');
    const title = document.getElementById('groupModalTitle');

    // 加载分组列表到上级分组下拉框
    loadGroupsForSelect();

    if (group) {
        // 编辑模式
        title.textContent = '编辑分组';
        document.getElementById('groupId').value = group.id;
        document.getElementById('groupName').value = group.name;
        document.getElementById('groupParentId').value = group.parent_id || '';
        document.getElementById('groupSortOrder').value = group.sort_order || 0;
        document.getElementById('groupDesc').value = group.description || '';
    } else {
        // 创建模式
        title.textContent = '创建分组';
        document.getElementById('groupId').value = '';
        document.getElementById('groupName').value = '';
        document.getElementById('groupParentId').value = '';
        document.getElementById('groupSortOrder').value = 0;
        document.getElementById('groupDesc').value = '';
    }

    modal.classList.add('active');
}

// 加载分组列表到下拉框（平铺）
async function loadGroupsForSelect() {
    const { API_BASE, getHeaders } = window.shared;
    try {
        const res = await fetch(`${API_BASE}/api/v1/communications/groups`, { headers: getHeaders() });
        if (!res.ok) throw new Error('API请求失败');
        const groups = await res.json();
        const select = document.getElementById('groupParentId');
        const currentGroupId = document.getElementById('groupId').value;

        // 递归生成选项
        const renderOptions = (groupList, level = 0) => {
            if (!groupList || groupList.length === 0) return '';
            const prefix = '　'.repeat(level);
            return groupList.map(g => {
                // 排除当前编辑的分组及其子分组
                if (g.id == currentGroupId) return '';
                return `<option value="${g.id}">${prefix}${g.name}</option>`;
            }).join('');
        };

        select.innerHTML = `<option value="">无（顶级分组）</option>` + renderOptions(groups);
    } catch (e) { console.error(e); }
}

// 编辑分组
async function editGroup(groupId) {
    const { API_BASE, getHeaders } = window.shared;
    try {
        const res = await fetch(`${API_BASE}/api/v1/communications/groups?format=flat`, { headers: getHeaders() });
        if (!res.ok) throw new Error('API请求失败');
        const groups = await res.json();
        const group = groups.find(g => g.id === groupId);

        if (!group) {
            alert('分组不存在');
            return;
        }

        openGroupModal(group);
    } catch (e) {
        console.error('加载分组信息失败:', e);
        alert('加载分组信息失败: ' + e.message);
    }
}

// 删除分组
async function deleteGroup(groupId) {
    const { API_BASE, getHeaders } = window.shared;
    if (!confirm('确定删除此分组？删除前请确保分组下没有通信机和子分组。')) return;

    try {
        const res = await fetch(`${API_BASE}/api/v1/communications/groups/${groupId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || '删除失败');
        }

        alert('分组删除成功');
        loadGroups();
        loadCommunications();
    } catch (e) {
        console.error('删除分组失败:', e);
        alert('删除分组失败: ' + e.message);
    }
}

// 打开Excel导入模态框
function openExcelImportModal() {
    document.getElementById('excelFile').value = '';
    document.getElementById('deployPublicKey').checked = false;
    document.getElementById('sshKeySelectGroup').style.display = 'none';
    document.getElementById('deployPasswordGroup').style.display = 'none';
    loadSSHKeysForExcelImport();
    document.getElementById('excelImportModal').classList.add('active');
}

// 加载SSH密钥到Excel导入模态框
async function loadSSHKeysForExcelImport() {
    const { API_BASE, getHeaders } = window.shared;
    try {
        const res = await fetch(`${API_BASE}/api/v1/keys`, { headers: getHeaders() });
        if (!res.ok) throw new Error('API请求失败');
        const keys = await res.json();
        const select = document.getElementById('excelSshKey');
        select.innerHTML = keys.map(k => `<option value="${k.id}">${k.name}</option>`).join('');
    } catch (e) { console.error(e); }
}

// 切换部署字段
function toggleDeployFields() {
    const deploy = document.getElementById('deployPublicKey').checked;
    document.getElementById('sshKeySelectGroup').style.display = deploy ? 'block' : 'none';
    document.getElementById('deployPasswordGroup').style.display = deploy ? 'block' : 'none';
}

// 下载Excel模板
function downloadExcelTemplate() {
    const { API_BASE } = window.shared;
    window.location.href = `${API_BASE}/api/v1/communications/excel-template`;
}

// 打开批量部署公钥模态框
function openBatchDeployModal() {
    document.getElementById('batchSshKey').value = '';
    document.getElementById('batchDeployPassword').value = '';
    loadSSHKeysForBatchDeploy();
    loadCommunicationCheckboxes();
    document.getElementById('batchDeployModal').classList.add('active');
}

// 加载SSH密钥到批量部署模态框
async function loadSSHKeysForBatchDeploy() {
    const { API_BASE, getHeaders } = window.shared;
    try {
        const res = await fetch(`${API_BASE}/api/v1/keys`, { headers: getHeaders() });
        if (!res.ok) throw new Error('API请求失败');
        const keys = await res.json();
        const select = document.getElementById('batchSshKey');
        select.innerHTML = keys.map(k => `<option value="${k.id}">${k.name}</option>`).join('');
    } catch (e) { console.error(e); }
}

// 加载通信机复选框
async function loadCommunicationCheckboxes() {
    const { API_BASE, getHeaders } = window.shared;
    try {
        const res = await fetch(`${API_BASE}/api/v1/communications`, { headers: getHeaders() });
        const comms = await res.json();
        const container = document.getElementById('commCheckboxList');
        container.innerHTML = comms.map(c => `
            <label style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px;">
                <input type="checkbox" name="communicationIds" value="${c.id}">
                <span>${c.name} (${c.ip_address})</span>
            </label>
        `).join('');
    } catch (e) { console.error(e); }
}

// 获取当前分组ID
function getCurrentGroupId() {
    return currentGroupId;
}

// 设置当前分组ID
function setCurrentGroupId(groupId) {
    currentGroupId = groupId;
}

// ========== 分组拖拽功能 ==========

// 开始拖拽分组
function handleGroupDragStart(event, groupId) {
    draggedGroupId = groupId;
    event.dataTransfer.effectAllowed = 'move';
    event.target.classList.add('dragging');
}

// 拖拽经过分组
function handleGroupDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

// 放置到分组上（成为子分组）
async function handleGroupDrop(event, targetGroupId) {
    event.preventDefault();
    event.stopPropagation();

    if (!draggedGroupId) return;
    if (draggedGroupId === targetGroupId) return;

    const { API_BASE, getHeaders } = window.shared;
    try {
        await fetch(`${API_BASE}/api/v1/communications/groups/${draggedGroupId}`, {
            method: 'PUT',
            headers: { ...getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ parent_id: targetGroupId })
        });

        document.querySelector('.dragging')?.classList.remove('dragging');
        draggedGroupId = null;
        loadGroups();
    } catch (e) {
        console.error('移动分组失败:', e);
        alert('移动分组失败: ' + e.message);
    }
}

// 放置到根级别
async function handleGroupDropToRoot(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!draggedGroupId) return;

    const { API_BASE, getHeaders } = window.shared;
    try {
        await fetch(`${API_BASE}/api/v1/communications/groups/${draggedGroupId}`, {
            method: 'PUT',
            headers: { ...getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ parent_id: null })
        });

        document.querySelector('.dragging')?.classList.remove('dragging');
        draggedGroupId = null;
        loadGroups();
    } catch (e) {
        console.error('移动分组失败:', e);
        alert('移动分组失败: ' + e.message);
    }
}

// ========== 批量操作功能 ==========

// 全选/取消全选
function toggleSelectAll(event) {
    const checked = event.target.checked;
    document.querySelectorAll('input[name="communicationIds"]').forEach(cb => {
        cb.checked = checked;
    });
    updateBatchToolbar();
}

// 更新批量操作工具栏
function updateBatchToolbar() {
    const checkedCount = document.querySelectorAll('input[name="communicationIds"]:checked').length;
    const toolbar = document.getElementById('batchToolbar');

    if (checkedCount > 0) {
        toolbar.style.display = 'flex';
        document.getElementById('selectedCount').textContent = checkedCount;
    } else {
        toolbar.style.display = 'none';
    }
}

// 批量移动到分组
async function batchMoveToGroup() {
    const { API_BASE, getHeaders } = window.shared;
    const targetGroupId = document.getElementById('batchTargetGroup').value;
    const ids = [...document.querySelectorAll('input[name="communicationIds"]:checked')].map(cb => parseInt(cb.value));

    if (ids.length === 0) {
        alert('请选择要移动的通信机');
        return;
    }

    if (!targetGroupId) {
        alert('请选择目标分组');
        return;
    }

    const requestBody = {
        ids: ids,
        group_id: parseInt(targetGroupId)
    };

    console.log('批量移动请求体:', requestBody);

    try {
        const res = await fetch(`${API_BASE}/api/v1/communications/batch`, {
            method: 'PUT',
            headers: { ...getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        console.log('响应状态:', res.status);

        if (!res.ok) {
            const error = await res.json();
            console.error('错误详情:', error);
            console.error('错误详情数组:', JSON.stringify(error.detail, null, 2));
            const errorMsg = Array.isArray(error.detail)
                ? error.detail.map(e => e.msg || JSON.stringify(e)).join('; ')
                : error.detail || '移动失败';
            throw new Error(errorMsg);
        }

        const result = await res.json();
        console.log('成功结果:', result);
        alert(`已移动 ${result.updated} 台通信机`);
        document.getElementById('batchTargetGroup').value = '';
        loadCommunications();
        loadGroups();
        updateBatchToolbar();
    } catch (e) {
        console.error('批量移动失败:', e);
        alert('批量移动失败: ' + e.message);
    }
}

// 批量删除通信机
async function batchDeleteCommunications() {
    const { API_BASE, getHeaders } = window.shared;
    const ids = [...document.querySelectorAll('input[name="communicationIds"]:checked')].map(cb => parseInt(cb.value));

    if (ids.length === 0) {
        alert('请选择要删除的通信机');
        return;
    }

    if (!confirm(`确定删除 ${ids.length} 台通信机？此操作不可撤销。`)) return;

    try {
        const res = await fetch(`${API_BASE}/api/v1/communications/batch`, {
            method: 'DELETE',
            headers: { ...getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: ids })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || '删除失败');
        }

        alert(`已删除 ${ids.length} 台通信机`);
        loadCommunications();
        loadGroups();
        updateBatchToolbar();
    } catch (e) {
        console.error('批量删除失败:', e);
        alert('批量删除失败: ' + e.message);
    }
}

// 批量测试连接
async function batchTestConnections() {
    const { API_BASE, getHeaders } = window.shared;
    const ids = [...document.querySelectorAll('input[name="communicationIds"]:checked')].map(cb => parseInt(cb.value));

    if (ids.length === 0) {
        alert('请选择要测试的通信机');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/v1/communications/batch-test`, {
            method: 'POST',
            headers: { ...getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: ids })
        });

        if (!res.ok) throw new Error('批量测试失败');

        const data = await res.json();
        const summary = data.summary;

        alert(`批量测试完成！\n总计: ${summary.total}\n在线: ${summary.online}\n离线: ${summary.offline}`);

        // 更新本地状态
        data.results.forEach(r => {
            communicationStatuses[r.id] = r.status;
        });
        localStorage.setItem('communicationStatuses', JSON.stringify(communicationStatuses));
        loadCommunications();
        updateBatchToolbar();
    } catch (e) {
        console.error('批量测试失败:', e);
        alert('批量测试失败: ' + e.message);
    }
}

// 批量部署公钥
async function batchDeploySSHKey() {
    const { API_BASE, getHeaders } = window.shared;
    const sshKeyId = document.getElementById('batchSshKey').value;
    const password = document.getElementById('batchDeployPassword').value;
    const communicationIds = [...document.querySelectorAll('input[name="communicationIds"]:checked')].map(cb => parseInt(cb.value));

    if (!sshKeyId) {
        alert('请选择 SSH 密钥');
        return;
    }

    if (!password) {
        alert('请输入部署密码');
        return;
    }

    if (communicationIds.length === 0) {
        alert('请选择要部署的通信��');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/v1/communications/batch-deploy-ssh-key`, {
            method: 'POST',
            headers: { ...getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                communication_ids: communicationIds,
                ssh_key_id: parseInt(sshKeyId),
                password: password
            })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || '部署失败');
        }

        const result = await res.json();

        // 显示部署结果
        let message = '部署完成！\n';
        if (result.success && result.success.length > 0) {
            message += `✅ 成功 (${result.success.length} 台):\n${result.success.join(', ')}\n`;
        }
        if (result.failed && result.failed.length > 0) {
            message += `❌ 失败 (${result.failed.length} 台):\n${result.failed.join('\n')}`;
        }

        alert(message);

        // 关闭模态框并刷新
        window.shared.closeModal('batchDeployModal');
        loadCommunications();
    } catch (e) {
        console.error('批量部署失败:', e);
        alert('批量部署失败: ' + e.message);
    }
}

// 导出模块
window.communications = {
    openCommModal,
    editComm,
    loadGroups,
    filterByGroup,
    loadCommunications,
    searchCommunications,
    testConnection,
    deleteComm,
    openGroupModal,
    editGroup,
    deleteGroup,
    openExcelImportModal,
    openBatchDeployModal,
    batchDeploySSHKey,
    toggleAuthFields,
    toggleDeployFields,
    downloadExcelTemplate,
    checkAllCommunicationStatuses,
    loadGroupsForModal,
    loadSSHKeysForModal,
    loadSSHKeysForExcelImport,
    loadSSHKeysForBatchDeploy,
    loadCommunicationCheckboxes,
    getCurrentGroupId,
    setCurrentGroupId,
    handleGroupDragStart,
    handleGroupDragOver,
    handleGroupDrop,
    handleGroupDropToRoot,
    toggleSelectAll,
    updateBatchToolbar,
    batchMoveToGroup,
    batchDeleteCommunications,
    batchTestConnections,
    toggleGroupChildren
};

// 为 HTML onclick 事件导出到全局 window 对象
window.openCommModal = openCommModal;
window.editComm = editComm;
window.loadGroups = loadGroups;
window.filterByGroup = filterByGroup;
window.loadCommunications = loadCommunications;
window.searchCommunications = searchCommunications;
window.testConnection = testConnection;
window.deleteComm = deleteComm;
window.openGroupModal = openGroupModal;
window.editGroup = editGroup;
window.deleteGroup = deleteGroup;
window.openExcelImportModal = openExcelImportModal;
window.openBatchDeployModal = openBatchDeployModal;
window.batchDeploySSHKey = batchDeploySSHKey;
window.toggleAuthFields = toggleAuthFields;
window.toggleDeployFields = toggleDeployFields;
window.downloadExcelTemplate = downloadExcelTemplate;
window.checkAllCommunicationStatuses = checkAllCommunicationStatuses;
window.handleGroupDragStart = handleGroupDragStart;
window.handleGroupDragOver = handleGroupDragOver;
window.handleGroupDrop = handleGroupDrop;
window.handleGroupDropToRoot = handleGroupDropToRoot;
window.toggleSelectAll = toggleSelectAll;
window.updateBatchToolbar = updateBatchToolbar;
window.batchMoveToGroup = batchMoveToGroup;
window.batchDeleteCommunications = batchDeleteCommunications;
window.batchTestConnections = batchTestConnections;
window.toggleGroupChildren = toggleGroupChildren;