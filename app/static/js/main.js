// 主入口模块 - 处理页面初始化和事件绑定

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
    if (window.auth && window.auth.checkLogin) {
        window.auth.checkLogin();
    }
    
    setupTabNavigation();
    setupFormHandlers();
    setupModalHandlers();
    
    if (window.data && window.data.refreshData) {
        window.data.refreshData();
    }
});

// 标签页切换
function setupTabNavigation() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
}

// 表单提交处理
function setupFormHandlers() {
    // 通信机表单
    const commForm = document.getElementById('commForm');
    if (commForm) {
        commForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('commId').value;
            const data = {
                name: document.getElementById('commName').value,
                ip_address: document.getElementById('commIp').value,
                port: parseInt(document.getElementById('commPort').value),
                username: document.getElementById('commUsername').value,
                group_id: document.getElementById('commGroup').value || null,
                description: document.getElementById('commDesc').value,
                auth_type: document.getElementById('commAuthType').value
            };
            
            if (data.auth_type === 'password') {
                data.password = document.getElementById('commPassword').value;
            } else {
                data.private_key_id = document.getElementById('commPrivateKey').value;
                data.deploy_password = document.getElementById('commDeployPassword').value;
            }
            
            try {
                const url = id ? `${API_BASE}/api/v1/communications/${id}` : `${API_BASE}/api/v1/communications`;
                const method = id ? 'PUT' : 'POST';
                const res = await fetch(url, {
                    method,
                    headers: getHeaders(),
                    body: JSON.stringify(data)
                });
                
                if (!res.ok) throw new Error('保存失败');
                
                window.common.closeModal('commForm');
                if (window.communications) {
                    window.communications.loadCommunications();
                    window.communications.loadGroups();
                }
            } catch (e) {
                console.error(e);
                alert('保存失败');
            }
        });
    }
    
    // 分组表单
    const groupForm = document.getElementById('groupForm');
    if (groupForm) {
        groupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                name: document.getElementById('groupName').value,
                description: document.getElementById('groupDesc').value
            };
            
            try {
                const res = await fetch(`${API_BASE}/api/v1/communications/groups`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(data)
                });
                
                if (!res.ok) throw new Error('创建失败');
                
                window.common.closeModal('groupModal');
                if (window.communications) {
                    window.communications.loadGroups();
                }
            } catch (e) {
                console.error(e);
                alert('创建失败');
            }
        });
    }
    
    // 检查项列表表单
    const checkItemListForm = document.getElementById('checkItemListForm');
    if (checkItemListForm) {
        checkItemListForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('checkItemListId').value;
            const data = {
                name: document.getElementById('checkItemListName').value,
                description: document.getElementById('checkItemListDesc').value
            };
            
            try {
                const url = id ? `${API_BASE}/api/v1/check-items/lists/${id}` : `${API_BASE}/api/v1/check-items/lists`;
                const method = id ? 'PUT' : 'POST';
                const res = await fetch(url, {
                    method,
                    headers: getHeaders(),
                    body: JSON.stringify(data)
                });
                
                if (!res.ok) throw new Error('保存失败');
                
                window.common.closeModal('checkItemListModal');
                if (window.checkitems) {
                    window.checkitems.loadCheckItemLists();
                }
            } catch (e) {
                console.error(e);
                alert('保存失败');
            }
        });
    }
    
    // 检查项表单
    const checkItemForm = document.getElementById('checkItemForm');
    if (checkItemForm) {
        checkItemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('checkItemId').value;
            const types = Array.from(document.querySelectorAll('input[name="checkItemType"]:checked')).map(cb => cb.value);
            
            const data = {
                name: document.getElementById('checkItemName').value,
                type: types,
                target: document.getElementById('checkItemTarget').value,
                description: document.getElementById('checkItemDesc').value
            };
            
            if (types.includes('file_content')) {
                data.content_pattern = document.getElementById('fileContentPattern').value;
            }
            
            try {
                const url = id ? `${API_BASE}/api/v1/check-items/${id}` : `${API_BASE}/api/v1/check-items`;
                const method = id ? 'PUT' : 'POST';
                const res = await fetch(url, {
                    method,
                    headers: getHeaders(),
                    body: JSON.stringify(data)
                });
                
                if (!res.ok) throw new Error('保存失败');
                
                window.common.closeModal('checkItemModal');
                if (window.checkitems) {
                    window.checkitems.loadCheckItems();
                }
            } catch (e) {
                console.error(e);
                alert('保存失败');
            }
        });
    }
    
    // 快照表单
    const snapshotForm = document.getElementById('snapshotForm');
    if (snapshotForm) {
        snapshotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const commIds = Array.from(document.querySelectorAll('#communicationCheckboxes input[name="communicationIds"]:checked')).map(cb => parseInt(cb.value));
            
            const data = {
                name: document.getElementById('snapshotName').value,
                group_id: document.getElementById('snapshotGroup').value ? parseInt(document.getElementById('snapshotGroup').value) : null,
                communication_ids: commIds,
                check_item_list_id: document.getElementById('checkItemList').value ? parseInt(document.getElementById('checkItemList').value) : null,
                is_default: document.getElementById('snapshotDefault').checked,
                description: document.getElementById('snapshotDesc').value
            };
            
            try {
                const res = await fetch(`${API_BASE}/api/v1/snapshots`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(data)
                });
                
                if (!res.ok) throw new Error('创建失败');
                
                window.common.closeModal('snapshotModal');
                if (window.snapshots) {
                    window.snapshots.loadSnapshots();
                }
            } catch (e) {
                console.error(e);
                alert('创建失败');
            }
        });
    }
    
    // 快照组表单
    const snapshotGroupForm = document.getElementById('snapshotGroupForm');
    if (snapshotGroupForm) {
        snapshotGroupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('snapshotGroupId').value;
            const data = {
                name: document.getElementById('snapshotGroupName').value,
                parent_id: document.getElementById('snapshotGroupParent').value ? parseInt(document.getElementById('snapshotGroupParent').value) : null,
                check_item_list_id: document.getElementById('snapshotGroupCheckItemList').value ? parseInt(document.getElementById('snapshotGroupCheckItemList').value) : null,
                description: document.getElementById('snapshotGroupDesc').value
            };
            
            try {
                const url = id ? `${API_BASE}/api/v1/snapshots/groups/${id}` : `${API_BASE}/api/v1/snapshots/groups`;
                const method = id ? 'PUT' : 'POST';
                const res = await fetch(url, {
                    method,
                    headers: getHeaders(),
                    body: JSON.stringify(data)
                });
                
                if (!res.ok) throw new Error('保存失败');
                
                window.common.closeModal('snapshotGroupModal');
                if (window.snapshots) {
                    window.snapshots.loadSnapshotGroups();
                }
            } catch (e) {
                console.error(e);
                alert('保存失败');
            }
        });
    }
    
    // SSH密钥表单
    const sshKeyForm = document.getElementById('sshKeyForm');
    if (sshKeyForm) {
        sshKeyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                name: document.getElementById('sshKeyName').value,
                key_type: document.getElementById('sshKeyType').value,
                key_size: parseInt(document.getElementById('sshKeySize').value),
                passphrase: document.getElementById('sshKeyPassphrase').value,
                description: document.getElementById('sshKeyDesc').value
            };
            
            try {
                const res = await fetch(`${API_BASE}/api/v1/keys`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(data)
                });
                
                if (!res.ok) throw new Error('生成失败');
                
                window.common.closeModal('sshKeyModal');
                loadSSHKeys();
            } catch (e) {
                console.error(e);
                alert('生成失败');
            }
        });
    }
    
    // Excel导入表单
    const excelImportForm = document.getElementById('excelImportForm');
    if (excelImportForm) {
        excelImportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('file', document.getElementById('excelFile').files[0]);
            
            const deployPublicKey = document.getElementById('deployPublicKey').checked;
            if (deployPublicKey) {
                formData.append('deploy_public_key', 'true');
                formData.append('ssh_key_id', document.getElementById('excelSshKey').value);
                formData.append('deploy_password', document.getElementById('deployPassword').value);
            }
            
            try {
                const res = await fetch(`${API_BASE}/api/v1/communications/import`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: formData
                });
                
                if (!res.ok) throw new Error('导入失败');
                
                alert('导入成功');
                window.common.closeModal('excelImportModal');
                if (window.communications) {
                    window.communications.loadCommunications();
                    window.communications.loadGroups();
                }
            } catch (e) {
                console.error(e);
                alert('导入失败');
            }
        });
    }
    
    // 批量部署表单
    const batchDeployForm = document.getElementById('batchDeployForm');
    if (batchDeployForm) {
        batchDeployForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const commIds = Array.from(document.querySelectorAll('#commCheckboxList input[name="communicationIds"]:checked')).map(cb => parseInt(cb.value));
            
            if (commIds.length === 0) {
                alert('请选择通信机');
                return;
            }
            
            const data = {
                ssh_key_id: document.getElementById('batchSshKey').value,
                password: document.getElementById('batchDeployPassword').value,
                communication_ids: commIds
            };
            
            try {
                const res = await fetch(`${API_BASE}/api/v1/communications/deploy-keys`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(data)
                });
                
                const result = await res.json();
                alert(result.message || '部署完成');
                window.common.closeModal('batchDeployModal');
            } catch (e) {
                console.error(e);
                alert('部署失败');
            }
        });
    }
    
    // 检查执行表单
    const checkForm = document.getElementById('checkForm');
    if (checkForm) {
        checkForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                rule_id: document.getElementById('checkRule').value ? parseInt(document.getElementById('checkRule').value) : null,
                communication_id: document.getElementById('checkCommunication').value ? parseInt(document.getElementById('checkCommunication').value) : null
            };
            
            try {
                const res = await fetch(`${API_BASE}/api/v1/checks`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(data)
                });
                
                if (!res.ok) throw new Error('启动失败');
                
                window.common.closeModal('checkModal');
                if (window.checks) {
                    window.checks.loadCheckResults();
                }
            } catch (e) {
                console.error(e);
                alert('启动失败');
            }
        });
    }
}

// 模态框相关处理
function setupModalHandlers() {
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

// 加载SSH密钥
async function loadSSHKeys() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/keys`, { headers: getHeaders() });
        const keys = await res.json();
        const tbody = document.getElementById('sshKeyTable');
        tbody.innerHTML = keys.map(k => `
            <tr>
                <td>${k.id}</td>
                <td>${k.name}</td>
                <td><code style="font-size:11px;">${k.public_key.substring(0, 50)}...</code></td>
                <td><span class="status-badge ${k.status === 'active' ? 'success' : 'info'}">${k.status === 'active' ? '可用' : '未激活'}</span></td>
                <td>${new Date(k.created_at).toLocaleString()}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteSSHKey(${k.id})">删除</button>
                </td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

// 删除SSH密钥
async function deleteSSHKey(id) {
    if (!confirm('确定删除?')) return;
    try {
        await fetch(`${API_BASE}/api/v1/keys/${id}`, { method: 'DELETE', headers: getHeaders() });
        loadSSHKeys();
    } catch (e) { console.error(e); }
}

// 打开SSH密钥模态框
function openSSHKeyModal() {
    document.getElementById('sshKeyName').value = '';
    document.getElementById('sshKeyType').value = 'rsa';
    document.getElementById('sshKeySize').value = '4096';
    document.getElementById('sshKeyPassphrase').value = '';
    document.getElementById('sshKeyDesc').value = '';
    document.getElementById('sshKeyModal').classList.add('active');
}

// 导出报告
function exportReport() {
    alert('报告导出功能开发中...');
}

// 搜索报告
function searchReports() {
    if (window.reports && window.reports.loadReports) {
        window.reports.loadReports();
    }
}

// 导出模块
window.main = {
    loadSSHKeys,
    deleteSSHKey,
    openSSHKeyModal,
    exportReport,
    searchReports
};