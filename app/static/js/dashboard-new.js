// Dashboard 主模块
// 注意: getHeaders 已在 shared.js 中定义，这里通过 window.shared.getHeaders() 使用

// 初始化 Dashboard
function initializeDashboard() {
    console.log('🚀 初始化 Dashboard...');

    const token = localStorage.getItem('token');
    if (!token) {
        console.warn('⚠️  未找到token，重定向到登录页面');
        window.location.href = '/login.html';
        return;
    }

    console.log('✅ Token 验证通过');

    // 初始化标签页切换
    initializeTabs();

    // 加载初始数据
    refreshData();
}

function initializeTabs() {
    console.log('🔧 初始化标签页切换...');
    const tabs = document.querySelectorAll('.nav-tab');
    console.log(`找到 ${tabs.length} 个标签页`);

    tabs.forEach(tab => {
        // 移除旧的事件监听器
        const tabClone = tab.cloneNode(true);
        tab.parentNode.replaceChild(tabClone, tab);

        // 添加新的事件监听器
        tabClone.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = e.currentTarget;
            const targetId = targetTab.dataset.tab;

            console.log(`切换到标签页: ${targetId}`);

            // 移除所有 active 类
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // 添加 active 类到当前标签和内容
            targetTab.classList.add('active');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
                console.log(`✅ 成功切换到: ${targetId}`);
            } else {
                console.error(`❌ 未找到内容区域: ${targetId}`);
            }
        });
    });

    console.log('✅ 标签页切换初始化完成');
}

// 从 shared.js 获取工具函数
const getHeaders = () => window.shared.getHeaders();
const logout = () => window.shared.logout();
const closeModal = (id) => window.shared.closeModal(id);

async function refreshData() {
    await Promise.all([
        window.communications.loadCommunications(),
        loadCheckItemLists(),
        loadCheckItems(),
        window.snapshots.loadSnapshots(),
        window.checks?.loadCheckResults?.() || Promise.resolve(),
        window.reports?.loadReports?.() || Promise.resolve(),
        loadStats(),
        window.communications.loadGroups()
    ]);
}

async function loadStats() {
    try {
        const { API_BASE } = window.shared;
        const [commRes, itemRes, snapRes] = await Promise.all([
            fetch(`${window.shared.API_BASE}/api/v1/communications`, { headers: getHeaders() }),
            fetch(`${window.shared.API_BASE}/api/v1/check-items`, { headers: getHeaders() }),
            fetch(`${window.shared.API_BASE}/api/v1/snapshots`, { headers: getHeaders() })
        ]);
        const comms = await commRes.json();
        const items = await itemRes.json();
        const snaps = await snapRes.json();

        const commCountEl = document.getElementById('commCount');
        const checkItemCountEl = document.getElementById('checkItemCount');
        const snapshotCountEl = document.getElementById('snapshotCount');

        if (commCountEl) commCountEl.textContent = comms.length;
        if (checkItemCountEl) checkItemCountEl.textContent = items.length;
        if (snapshotCountEl) snapshotCountEl.textContent = snaps.length;
    } catch (e) { console.error(e); }
}

// 以下是原dashboard.js的其余功能保持不变
async function loadSSHKeys() {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/keys`, { headers: getHeaders() });
        const data = await res.json();
        const tbody = document.getElementById('sshKeyTable');
        tbody.innerHTML = data.map(k => `
            <tr>
                <td>${k.id}</td>
                <td>${k.name}</td>
                <td><code style="font-size:11px">${k.public_key ? k.public_key.substring(0, 50) + '...' : '-'}</code></td>
                <td><span class="status-badge ${k.is_active ? 'success' : 'error'}">${k.is_active ? '启用' : '禁用'}</span></td>
                <td>${new Date(k.created_at).toLocaleString()}</td>
                <td><button class="btn btn-danger btn-sm" onclick="deleteSSHKey(${k.id})">删除</button></td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

// 处理通信机编辑/新增表单提交
document.getElementById('commForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('commId').value;
    const name = document.getElementById('commName').value;
    const ip = document.getElementById('commIp').value;
    const port = parseInt(document.getElementById('commPort').value);
    const username = document.getElementById('commUsername').value;
    const authMethod = document.getElementById('commAuthMethod').value;
    const password = document.getElementById('commPassword').value;
    const groupId = parseInt(document.getElementById('commGroup').value) || null;
    const privateKeyEl = document.getElementById('commPrivateKey');
    const deployPublicKey = document.getElementById('deployPublicKey').checked;
    const deployPassword = document.getElementById('deployPassword').value;

    const commData = { name, ip, port, username, group_id: groupId };

    if (authMethod === 'password') {
        commData.auth_method = 'password';
        commData.password = password;
    } else {
        commData.auth_method = 'private_key';
        commData.private_key = privateKeyEl.value || null;
    }

    try {
        // 如果勾选了部署公钥，先部署
        if (deployPublicKey) {
            const deployResponse = await fetch(`${window.shared.API_BASE}/api/v1/deploy-ssh-key`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    communication_id: commData.id || id,
                    ssh_key_id: privateKeyEl.value,
                    password: deployPassword
                })
            });

            const deployResult = await deployResponse.json();
            if (deployResult.status === 'error') {
                alert('公钥部署失败: ' + deployResult.message);
                return;
            } else {
                alert('公钥部署成功！');
            }
        }

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${window.shared.API_BASE}/api/v1/communications/${id}` : `${window.shared.API_BASE}/api/v1/communications`;
        const response = await fetch(url, {
            method,
            headers: getHeaders(),
            body: JSON.stringify(commData)
        });

        if (!response.ok) {
            const error = await response.json();
            if (response.status === 422) {
                alert('❌ 输入数据有误，请检查后重试');
            } else {
                alert('❌ 创建失败: ' + (error.detail || '未知错误'));
            }
            return;
        }
        closeModal('commModal');
        window.communications.loadCommunications();
    } catch (e) {
        console.error(e);
        alert('❌ 网络错误');
    }
});

// ... (其余代码保持不变，这里省略以保持简洁)

// 等待所有模块加载完成后再初始化
document.addEventListener('modulesLoaded', function() {
    console.log('🚀 所有模块已加载，开始初始化Dashboard...');
    initializeDashboard();
});

// 备用方案：如果事件已经触发，直接初始化
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('⚠️  页面已加载完成，可能错过了modulesLoaded事件');
    // 延迟初始化，确保其他模块已加载
    setTimeout(initializeDashboard, 100);
}

// ========== 全局函数导出 ==========
// 将所有在HTML中通过内联事件调用的函数挂载到window对象
window.logout = logout;
window.refreshData = refreshData;
window.closeModal = closeModal;
window.openGroupModal = openGroupModal;
window.filterByGroup = filterByGroup;
window.searchCommunications = searchCommunications;
window.openCommModal = openCommModal;
window.openExcelImportModal = openExcelImportModal;
window.openBatchDeployModal = openBatchDeployModal;
window.downloadExcelTemplate = downloadExcelTemplate;
window.openCheckModal = () => window.checks.openCheckModal();
window.openSSHKeyModal = openSSHKeyModal;
window.loadSSHKeys = loadSSHKeys;
window.toggleAuthFields = toggleAuthFields;
window.toggleDeployFields = toggleDeployFields;