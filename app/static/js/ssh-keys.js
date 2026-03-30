// SSH 密钥管理模块

// 加载 SSH 密钥列表
async function loadSSHKeys() {
    const { API_BASE, getHeaders } = window.shared;
    try {
        const res = await fetch(`${API_BASE}/api/v1/keys`, { headers: getHeaders() });
        if (!res.ok) throw new Error('加载SSH密钥失败');

        const keys = await res.json();
        const tbody = document.getElementById('sshKeyTable');

        if (keys.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无SSH密钥</td></tr>';
            return;
        }

        tbody.innerHTML = keys.map(k => `
            <tr>
                <td>${k.id}</td>
                <td>${k.name}</td>
                <td><code style="font-size: 12px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block;">${k.public_key.substring(0, 50)}...</code></td>
                <td><span class="status-badge ${k.has_private_key ? 'success' : 'warning'}">${k.has_private_key ? '完整' : '仅公钥'}</span></td>
                <td>${new Date(k.created_at).toLocaleString('zh-CN')}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="viewSSHKey(${k.id})">查看</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSSHKey(${k.id})">删除</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('加载SSH密钥失败:', error);
        const tbody = document.getElementById('sshKeyTable');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">加载失败: ' + error.message + '</td></tr>';
        }
    }
}

// 打开SSH密钥生成模态框
function openSSHKeyModal() {
    document.getElementById('sshKeyName').value = '';
    document.getElementById('sshKeyType').value = 'rsa';
    document.getElementById('sshKeySize').value = '4096';
    document.getElementById('sshKeyPassphrase').value = '';
    document.getElementById('sshKeyDesc').value = '';
    document.getElementById('sshKeyModal').classList.add('active');
}

// 查看 SSH 密钥详情
async function viewSSHKey(id) {
    const { API_BASE, getHeaders } = window.shared;
    try {
        const res = await fetch(`${API_BASE}/api/v1/keys/${id}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('获取SSH密钥失败');

        const key = await res.json();

        let message = `SSH 密钥详情\n\n`;
        message += `名称: ${key.name}\n`;
        message += `类型: ${key.key_type || 'RSA'}\n`;
        message += `创建时间: ${new Date(key.created_at).toLocaleString('zh-CN')}\n\n`;
        message += `公钥:\n${key.public_key}\n\n`;
        message += `私钥: ${key.has_private_key ? '已存储（安全加密）' : '未存储'}`;

        alert(message);
    } catch (error) {
        console.error('获取SSH密钥失败:', error);
        alert('获取SSH密钥失败: ' + error.message);
    }
}

// 删除 SSH 密钥
async function deleteSSHKey(id) {
    const { API_BASE, getHeaders } = window.shared;
    if (!confirm('确定删除此SSH密钥？删除后无法恢复。')) return;

    try {
        const res = await fetch(`${API_BASE}/api/v1/keys/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || '删除失败');
        }

        alert('SSH密钥删除成功');
        loadSSHKeys();
    } catch (error) {
        console.error('删除SSH密钥失败:', error);
        alert('删除SSH密钥失败: ' + error.message);
    }
}

// 导出模块
window.sshKeys = {
    loadSSHKeys,
    openSSHKeyModal,
    viewSSHKey,
    deleteSSHKey
};

// 为 HTML onclick 事件导出到全局 window 对象
window.loadSSHKeys = loadSSHKeys;
window.openSSHKeyModal = openSSHKeyModal;
window.viewSSHKey = viewSSHKey;
window.deleteSSHKey = deleteSSHKey;
