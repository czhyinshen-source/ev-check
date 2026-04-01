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

// 初始化 Dashboard（防重复调用）
let dashboardInitialized = false;
function initializeDashboard() {
    if (dashboardInitialized) {
        console.log('⚠️  Dashboard 已初始化，跳过重复调用');
        return;
    }
    dashboardInitialized = true;
    console.log('🚀 初始化 Dashboard...');

    const token = localStorage.getItem('token');
    if (!token) {
        console.warn('⚠️  未找到token，重定向到登录页面');
        window.location.href = '/login';
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

                // 切换到 SSH 密钥标签页时加载密钥列表
                if (targetId === 'ssh-keys' && window.sshKeys?.loadSSHKeys) {
                    window.sshKeys.loadSSHKeys();
                }
                
                // 切换到 检查执行 标签页时加载规则
                if (targetId === 'checks' && window.checks?.initChecksTab) {
                    window.checks.initChecksTab();
                }
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
            const authMethod = safeVal('commAuthType', 'password');
            const password = safeVal('commPassword');
            const groupId = parseInt(safeVal('commGroup')) || null;
            const privateKeyEl = safeGet('commPrivateKey');
            const deployPublicKey = safeGet('deployPublicKey')?.checked || false;
            const deployPassword = safeVal('deployPassword');

            if (!name || !ip) {
                alert('请填写必填字段（名称和IP地址）');
                return;
            }

            const commData = {
                name,
                ip_address: ip,
                port,
                username,
                group_id: groupId,
                auth_method: authMethod
            };

            if (authMethod === 'password') {
                commData.password = password;
            } else {
                // 存储SSH密钥ID到 private_key_path 字段
                commData.private_key_path = privateKeyEl?.value ? `key_${privateKeyEl.value}` : null;
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

    // 分组表单
    const groupForm = safeGet('groupForm');
    if (groupForm) {
        groupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = safeVal('groupId');
            const name = safeVal('groupName');
            const parentId = safeVal('groupParentId');
            const sortOrder = parseInt(safeVal('groupSortOrder', '0')) || 0;
            const description = safeVal('groupDesc');

            if (!name) {
                alert('请填写分组名称');
                return;
            }

            const groupData = {
                name,
                parent_id: parentId ? parseInt(parentId) : null,
                sort_order: sortOrder,
                description: description || null
            };

            try {
                const method = id ? 'PUT' : 'POST';
                const url = id ? `${window.shared.API_BASE}/api/v1/communications/groups/${id}` : `${window.shared.API_BASE}/api/v1/communications/groups`;

                const response = await fetch(url, {
                    method,
                    headers: { ...window.shared.getHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify(groupData)
                });

                if (!response.ok) {
                    const error = await response.json();
                    alert('❌ 操作失败: ' + (error.detail || '未知错误'));
                    return;
                }

                window.shared.closeModal('groupModal');
                if (window.communications?.loadGroups) {
                    window.communications.loadGroups();
                }
                alert(id ? '✅ 分组更新成功' : '✅ 分组创建成功');
            } catch (e) {
                console.error(e);
                alert('❌ 网络错误');
            }
        });
    }

    // 批量部署公钥表单
    const batchDeployForm = safeGet('batchDeployForm');
    if (batchDeployForm) {
        batchDeployForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 调用 communications 模块的批量部署函数
            if (window.communications?.batchDeploySSHKey) {
                await window.communications.batchDeploySSHKey();
            } else {
                alert('批量部署功能未加载');
            }
        });
    }

    // SSH 密钥表单
    const sshKeyForm = safeGet('sshKeyForm');
    if (sshKeyForm) {
        sshKeyForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = safeVal('sshKeyName');
            const keyType = safeVal('sshKeyType');
            const keySize = safeVal('sshKeySize');
            const passphrase = safeVal('sshKeyPassphrase');
            const description = safeVal('sshKeyDesc');

            if (!name) {
                alert('请填写密钥名称');
                return;
            }

            try {
                // 调用 /keys/generate 端点生成密钥对
                const response = await fetch(`${window.shared.API_BASE}/api/v1/keys/generate`, {
                    method: 'POST',
                    headers: { ...window.shared.getHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        key_type: keyType,
                        key_size: parseInt(keySize),
                        passphrase: passphrase || null,
                        description: description || null
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    alert('❌ 生成密钥失败: ' + (error.detail || '未知错误'));
                    return;
                }

                const result = await response.json();
                window.shared.closeModal('sshKeyModal');
                if (window.sshKeys?.loadSSHKeys) {
                    window.sshKeys.loadSSHKeys();
                }
                alert(`✅ SSH 密钥生成成功！\n\n公钥:\n${result.public_key}\n\n请复制公钥并部署到目标服务器的 ~/.ssh/authorized_keys 文件中。`);
            } catch (e) {
                console.error(e);
                alert('❌ 网络错误');
            }
        });
    }

    // 检查项列表表单
    const checkItemListForm = safeGet('checkItemListForm');
    if (checkItemListForm) {
        checkItemListForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = safeVal('checkItemListId');
            const name = safeVal('checkItemListName');
            const description = safeVal('checkItemListDesc');

            if (!name) {
                alert('请填写检查项列表名称');
                return;
            }

            try {
                const method = id ? 'PUT' : 'POST';
                const url = id ? `${window.shared.API_BASE}/api/v1/check-items/lists/${id}` : `${window.shared.API_BASE}/api/v1/check-items/lists`;

                const response = await fetch(url, {
                    method,
                    headers: { ...window.shared.getHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, description: description || null })
                });

                if (!response.ok) {
                    const error = await response.json();
                    alert('❌ 操作失败: ' + (error.detail || '未知错误'));
                    return;
                }

                window.shared.closeModal('checkItemListModal');
                if (window.checkitems?.loadCheckItemLists) {
                    window.checkitems.loadCheckItemLists();
                }
                alert(id ? '✅ 检查项列表更新成功' : '✅ 检查项列表创建成功');
            } catch (e) {
                console.error(e);
                alert('❌ 网络错误');
            }
        });
    }

    // 检查项表单
    const checkItemForm = safeGet('checkItemForm');
    if (checkItemForm) {
        checkItemForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = safeVal('checkItemId');
            const name = safeVal('checkItemName');
            const category = safeVal('checkItemCategory');
            const description = safeVal('checkItemDesc');
            const listId = safeVal('checkItemListSelect') || null;

            if (!name) {
                alert('请填写检查项名称');
                return;
            }

            if (!category) {
                alert('请选择检查项分类');
                return;
            }

            // 根据分类构建检查类型和属性
            let type = '';
            let target_path = '';
            let check_attributes = {};

            if (category === 'file') {
                target_path = safeVal('filePath');
                const types = [];
                if (safeGet('checkFileMtime')?.checked) {
                    types.push('file_mtime');
                    check_attributes.mtime = {
                        compare_mode: safeVal('fileMtimeCompareMode', 'snapshot'),
                        start_time: safeVal('fileMtimeStart') || null,
                        end_time: safeVal('fileMtimeEnd') || null
                    };
                }
                if (safeGet('checkFileSize')?.checked) {
                    types.push('file_size');
                    check_attributes.size = {
                        compare_mode: safeVal('fileSizeCompareMode', 'snapshot'),
                        min_size: safeVal('fileSizeMin') ? parseInt(safeVal('fileSizeMin')) : null,
                        max_size: safeVal('fileSizeMax') ? parseInt(safeVal('fileSizeMax')) : null
                    };
                }
                if (safeGet('checkFileOwner')?.checked) {
                    types.push('file_owner');
                    check_attributes.owner = {
                        compare_mode: safeVal('fileOwnerCompareMode', 'snapshot'),
                        owner: safeVal('fileOwnerValue') || null
                    };
                }
                if (safeGet('checkFileGroup')?.checked) {
                    types.push('file_group');
                    check_attributes.group = {
                        compare_mode: safeVal('fileGroupCompareMode', 'snapshot'),
                        group: safeVal('fileGroupValue') || null
                    };
                }
                if (safeGet('checkFilePermissions')?.checked) {
                    types.push('file_permissions');
                    check_attributes.permissions = {
                        compare_mode: safeVal('filePermissionsCompareMode', 'snapshot'),
                        permissions: safeVal('filePermissionsValue') || null
                    };
                }
                if (safeGet('checkFileMd5')?.checked) {
                    types.push('file_md5');
                    check_attributes.md5 = {
                        compare_mode: safeVal('fileMd5CompareMode', 'snapshot'),
                        md5_value: safeVal('fileMd5Value') || null
                    };
                }
                // 如果没有任何检查类型，至少添加 file_exists
                if (types.length === 0) {
                    types.push('file_exists');
                }
                type = types;
            } else if (category === 'content') {
                target_path = safeVal('contentFilePath');
                const fileType = safeVal('contentFileType', 'text');
                if (fileType === 'text') {
                    type = ['file_content'];
                    check_attributes.content = {
                        compare_mode: safeVal('textCompareMode', 'full'),
                        content: safeVal('textContent') || null
                    };
                } else if (fileType === 'kernel') {
                    type = ['kernel_param'];
                    check_attributes.kernel = {
                        compare_mode: safeVal('kernelCompareMode', 'snapshot'),
                        param_value: safeVal('kernelParamValue') || null
                    };
                }
            } else if (category === 'route') {
                target_path = '/proc/net/route';
                type = ['route_table'];
                check_attributes.route = {
                    mode: safeVal('routeTableMode', 'full'),
                    route_rule: safeVal('routeRule') || null
                };
            }

            // 如果 check_attributes 为空，设为 null
            if (Object.keys(check_attributes).length === 0) {
                check_attributes = null;
            }

            const itemData = {
                name,
                type,
                target_path,
                check_attributes,
                description: description || null,
                list_id: listId ? parseInt(listId) : null
            };

            try {
                const method = id ? 'PUT' : 'POST';
                const url = id ? `${window.shared.API_BASE}/api/v1/check-items/${id}` : `${window.shared.API_BASE}/api/v1/check-items`;

                const response = await fetch(url, {
                    method,
                    headers: { ...window.shared.getHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify(itemData)
                });

                if (!response.ok) {
                    const error = await response.json();
                    alert('❌ 操作失败: ' + (error.detail || '未知错误'));
                    return;
                }

                window.shared.closeModal('checkItemModal');
                if (window.checkitems?.loadCheckItems) {
                    window.checkitems.loadCheckItems(currentCheckItemListId);
                }
                if (window.checkitems?.loadCheckItemLists) {
                    window.checkitems.loadCheckItemLists();
                }
                alert(id ? '✅ 检查项更新成功' : '✅ 检查项创建成功');
            } catch (e) {
                console.error(e);
                alert('❌ 网络错误');
            }
        });
    }

    // 快照分组表单
    const snapshotGroupForm = safeGet('snapshotGroupForm');
    if (snapshotGroupForm) {
        snapshotGroupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = safeVal('snapshotGroupId');
            const name = safeVal('snapshotGroupName');
            const parentId = safeVal('snapshotGroupParent');
            const checkItemListId = safeVal('snapshotGroupCheckItemList');
            const description = safeVal('snapshotGroupDesc');

            if (!name) {
                alert('请填写快照组名称');
                return;
            }

            const groupData = {
                name,
                parent_id: parentId ? parseInt(parentId) : null,
                check_item_list_id: checkItemListId ? parseInt(checkItemListId) : null,
                description: description || null
            };

            try {
                const method = id ? 'PUT' : 'POST';
                const url = id ? `${window.shared.API_BASE}/api/v1/snapshots/groups/${id}` : `${window.shared.API_BASE}/api/v1/snapshots/groups`;

                const response = await fetch(url, {
                    method,
                    headers: { ...window.shared.getHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify(groupData)
                });

                if (!response.ok) {
                    const error = await response.json();
                    alert('❌ 操作失败: ' + (error.detail || '未知错误'));
                    return;
                }

                window.shared.closeModal('snapshotGroupModal');
                if (window.snapshots?.loadSnapshotGroups) {
                    window.snapshots.loadSnapshotGroups();
                }
                alert(id ? '✅ 快照组更新成功' : '✅ 快照组创建成功');
            } catch (e) {
                console.error(e);
                alert('❌ 网络错误');
            }
        });
    }

    // 快照表单
    const snapshotForm = safeGet('snapshotForm');
    if (snapshotForm) {
        snapshotForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = safeVal('snapshotName');
            const groupId = safeVal('snapshotGroup');
            const isDefault = safeGet('snapshotDefault')?.checked || false;
            const description = safeVal('snapshotDesc');

            if (!name || !groupId) {
                alert('请填写必填字段');
                return;
            }

            try {
                const response = await fetch(`${window.shared.API_BASE}/api/v1/snapshots`, {
                    method: 'POST',
                    headers: { ...window.shared.getHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        group_id: parseInt(groupId),
                        is_default: isDefault,
                        description: description || null
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    alert('❌ 操作失败: ' + (error.detail || '未知错误'));
                    return;
                }

                window.shared.closeModal('snapshotModal');
                if (window.snapshots?.loadSnapshots) {
                    window.snapshots.loadSnapshots();
                }
                alert('✅ 快照创建成功');
            } catch (e) {
                console.error(e);
                alert('❌ 网络错误');
            }
        });
    }

    console.log('✅ 表单事件绑定完成');
}

async function refreshData() {
    console.log('🔄 加载初始数据...');

    try {
        // 加载通信机数据
        if (window.communications?.loadCommunications) {
            await window.communications.loadCommunications();
            console.log('✅ 通信机数据加载完成');
        }

        // 加载分组数据
        if (window.communications?.loadGroups) {
            await window.communications.loadGroups();
            console.log('✅ 分组数据加载完成');
        }

        // 加载检查项列表
        if (window.checkitems?.loadCheckItemLists) {
            await window.checkitems.loadCheckItemLists();
            console.log('✅ 检查项列表加载完成');
        }

        // 加载检查项
        if (window.checkitems?.loadCheckItems) {
            await window.checkitems.loadCheckItems();
            console.log('✅ 检查项数据加载完成');
        }

        // 加载快照组
        if (window.snapshots?.loadSnapshotGroups) {
            await window.snapshots.loadSnapshotGroups();
            console.log('✅ 快照组数据加载完成');
        }

        // 加载快照
        if (window.snapshots?.loadSnapshots) {
            await window.snapshots.loadSnapshots();
            console.log('✅ 快照数据加载完成');
        }

        // 加载 SSH 密钥
        if (window.sshKeys?.loadSSHKeys) {
            await window.sshKeys.loadSSHKeys();
            console.log('✅ SSH 密钥数据加载完成');
        }

        // 加载统计数据
        await loadStats();
        console.log('✅ 统计数据加载完成');

    } catch (e) {
        console.error('❌ 加载数据失败:', e);
    }
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
    if (window.auth?.initUserDisplay) {
        window.auth.initUserDisplay();
    }
    initializeDashboard();
});

// 备用方案
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initializeDashboard, 100);
}
