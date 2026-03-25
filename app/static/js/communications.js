// 通信机管理模块

// 模块状态变量
let currentGroupId = '';
// 从localStorage加载通信机连接状态，持久化存储
let communicationStatuses = JSON.parse(localStorage.getItem('communicationStatuses') || '{}');

// 启动定时检查通信机状态的任务（每分钟执行一次）
setInterval(() => checkAllCommunicationStatuses(), 60000);

// 打开通信机模态框
function openCommModal(id = null) {
    document.getElementById('commId').value = id || '';
    document.getElementById('commName').value = '';
    document.getElementById('commIp').value = '';
    document.getElementById('commPort').value = '22';
    document.getElementById('commUsername').value = 'root';
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
function editComm(id, name, ip, port, username, groupId, desc) {
    document.getElementById('commId').value = id;
    document.getElementById('commName').value = name;
    document.getElementById('commIp').value = ip;
    document.getElementById('commPort').value = port;
    document.getElementById('commUsername').value = username;
    document.getElementById('commGroup').value = groupId || '';
    document.getElementById('commDesc').value = desc || '';
    document.getElementById('commModalTitle').textContent = '编辑通信机';
    loadGroupsForModal();
    loadSSHKeysForModal();
    toggleAuthFields();
    document.getElementById('commModal').classList.add('active');
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
    document.getElementById('keyField').style.display = authType === 'key' ? 'block' : 'none';
    document.getElementById('deployKeyField').style.display = authType === 'key' ? 'block' : 'none';
}

// 加载通信机分组
async function loadGroups() {
    const { API_BASE, getHeaders } = window.shared;
    try {
        const [groupsRes, commsRes] = await Promise.all([
            fetch(`${API_BASE}/api/v1/communications/groups`, { headers: getHeaders() }),
            fetch(`${API_BASE}/api/v1/communications`, { headers: getHeaders() })
        ]);
        const groups = await groupsRes.json();
        const comms = await commsRes.json();

        const getCountByGroup = (groupId) => {
            if (groupId === '' || groupId === null) return comms.length;
            return comms.filter(c => c.group_id === groupId).length;
        };

        const tree = document.getElementById('groupTree');
        tree.innerHTML = `
            <li>
                <div class="group-item ${currentGroupId === '' ? 'active' : ''}" data-group-id="" onclick="filterByGroup('')">
                    <span class="icon">📁</span>
                    <span>全部通信机</span>
                    <span class="count">${getCountByGroup('')}</span>
                </div>
            </li>
            ${groups.map(g => `
                <li>
                    <div class="group-item ${currentGroupId == g.id ? 'active' : ''}" data-group-id="${g.id}" onclick="filterByGroup(${g.id})">
                        <span class="icon">📂</span>
                        <span>${g.name}</span>
                        <span class="count">${getCountByGroup(g.id)}</span>
                    </div>
                </li>
            `).join('')}
        `;
    } catch (e) { console.error(e); }
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
        const res = await fetch(`${API_BASE}/api/v1/communications`, { headers: getHeaders() });
        let comms = await res.json();

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
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无数据</td></tr>';
            return;
        }

        tbody.innerHTML = comms.map(c => {
            // 获取本地存储的连接状态，默认为'unknown'
            const status = communicationStatuses[c.id] || 'unknown';
            return `
                <tr>
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
                        <button class="btn btn-primary btn-sm" onclick="editComm(${c.id}, '${c.name}', '${c.ip_address}', ${c.port}, '${c.username}', ${c.group_id}, '${c.description || ''}')">编辑</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteComm(${c.id})">删除</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) { console.error(e); }
}

// 搜索通信机
function searchCommunications() {
    loadCommunications();
}

// 测试通信机连接
async function testConnection(id) {
    const { API_BASE, getHeaders } = window.shared;
    try {
        const res = await fetch(`${API_BASE}/api/v1/communications/${id}/test`, {
            method: 'POST',
            headers: getHeaders()
        });
        const result = await res.json();

        // 更新本地存储的连接状态
        communicationStatuses[id] = result.status === 'success' ? 'online' : 'offline';
        localStorage.setItem('communicationStatuses', JSON.stringify(communicationStatuses));

        // 重新加载通信机列表
        loadCommunications();

        alert(result.message);
    } catch (e) {
        console.error(e);
        alert('测试连接失败');
    }
}

// 检查所有通信机状态
async function checkAllCommunicationStatuses() {
    const { API_BASE, getHeaders } = window.shared;
    try {
        const res = await fetch(`${API_BASE}/api/v1/communications/test-all`, {
            method: 'POST',
            headers: getHeaders()
        });
        const results = await res.json();

        // 更新本地存储的连接状态
        results.forEach(result => {
            communicationStatuses[result.id] = result.status === 'success' ? 'online' : 'offline';
        });
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
function openGroupModal() {
    document.getElementById('groupName').value = '';
    document.getElementById('groupDesc').value = '';
    document.getElementById('groupModal').classList.add('active');
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
    openExcelImportModal,
    openBatchDeployModal,
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
    setCurrentGroupId
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
window.openExcelImportModal = openExcelImportModal;
window.openBatchDeployModal = openBatchDeployModal;
window.toggleAuthFields = toggleAuthFields;
window.toggleDeployFields = toggleDeployFields;
window.downloadExcelTemplate = downloadExcelTemplate;
window.checkAllCommunicationStatuses = checkAllCommunicationStatuses;