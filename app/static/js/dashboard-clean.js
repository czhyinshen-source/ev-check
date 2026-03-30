// Dashboard 主模块
// 注意: getHeaders 和 API_BASE 已在 shared.js 中定义

// 安全获取DOM元素
function safeGet(id) {
    return document.getElementById(id);
}

// 安全获取元素值
function safeVal(id, defaultVal = '') {
    const el = safeGet(id);
    return el ? (el.value || defaultVal) : defaultVal;
}

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

    // 绑定表单事件
    bindFormEvents();

    // 加载初始数据
    refreshData();
}

function initializeTabs() {
    console.log('🔧 初始化标签页切换...');
    const tabs = document.querySelectorAll('.nav-tab');
    console.log(`找到 ${tabs.length} 个标签页`);

    tabs.forEach(tab => {
        const tabClone = tab.cloneNode(true);
        tab.parentNode.replaceChild(tabClone, tab);

        tabClone.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = e.currentTarget;
            const targetId = targetTab.dataset.tab;

            console.log(`切换到标签页: ${targetId}`);

            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

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

// 绑定表单事件
function bindFormEvents() {
    console.log('🔧 绑定表单事件...');

    // 通信机表单
    const commForm = safeGet('commForm');
    if (commForm) {
        commForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = safeVal('commId');
            const name = safeVal('commName');
            const ip = safeVal('commIp');
            const port = parseInt(safeVal('commPort', '22')) || 22;
            const username = safeVal('commUsername');
            const authMethod = safeVal('commAuthMethod', 'password');
            const password = safeVal('commPassword');
            const groupId = parseInt(safeVal('commGroup')) || null;
            const privateKeyEl = safeGet('commPrivateKey');
            const deployPublicKey = safeGet('deployPublicKey')?.checked || false;
            const deployPassword = safeVal('deployPassword');

            if (!name || !ip) {
                alert('请填写必填字段（名称和IP地址）');
                return;
            }

            const commData = { name, ip, port, username, group_id: groupId };

            if (authMethod === 'password') {
                commData.auth_method = 'password';
                commData.password = password;
            } else {
                commData.auth_method = 'private_key';
                commData.private_key = privateKeyEl?.value || null;
            }

            try {
                if (deployPublicKey && privateKeyEl?.value) {
                    const deployResponse = await fetch(`${window.shared.API_BASE}/api/v1/deploy-ssh-key`, {
                        method: 'POST',
                        headers: window.shared.getHeaders(),
                        body: JSON.stringify({
                            communication_id: id || undefined,
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
                    headers: window.shared.getHeaders(),
                    body: JSON.stringify(commData)
                });

                if (!response.ok) {
                    const error = await response.json();
                    if (response.status === 422) {
                        alert('❌ 输入数据有误，请检查后重试');
                    } else {
                        alert('❌ 操作失败: ' + (error.detail || '未知错误'));
                    }
                    return;
                }

                window.shared.closeModal('commModal');
                if (window.communications?.loadCommunications) {
                    window.communications.loadCommunications();
                }
                alert(id ? '✅ 通信机更新成功' : '✅ 通信机创建成功');
            } catch (e) {
                console.error(e);
                alert('❌ 网络错误');
            }
        });
    }

    console.log('✅ 表单事件绑定完成');
}

async function refreshData() {
    if (window.communications?.loadCommunications) {
        window.communications.loadCommunications();
    }
    if (window.communications?.loadGroups) {
        window.communications.loadGroups();
    }
    loadStats();
}

async function loadStats() {
    try {
        const { API_BASE } = window.shared;
        const [commRes, itemRes, snapRes] = await Promise.all([
            fetch(`${API_BASE}/api/v1/communications`, { headers: window.shared.getHeaders() }),
            fetch(`${API_BASE}/api/v1/check-items`, { headers: window.shared.getHeaders() }),
            fetch(`${API_BASE}/api/v1/snapshots`, { headers: window.shared.getHeaders() })
        ]);

        const comms = await commRes.json();
        const items = await itemRes.json();
        const snaps = await snapRes.json();

        const commCountEl = safeGet('commCount');
        const checkItemCountEl = safeGet('checkItemCount');
        const snapshotCountEl = safeGet('snapshotCount');

        if (commCountEl) commCountEl.textContent = comms.length;
        if (checkItemCountEl) checkItemCountEl.textContent = items.length;
        if (snapshotCountEl) snapshotCountEl.textContent = snaps.length;
    } catch (e) {
        console.error('加载统计数据失败:', e);
    }
}

// 等待所有模块加载完成后再初始化
document.addEventListener('modulesLoaded', function() {
    console.log('🚀 所有模块已加载，开始初始化Dashboard...');
    initializeDashboard();
});

// 备用方案
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initializeDashboard, 100);
}
