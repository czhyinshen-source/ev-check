// 检查项管理模块

// 解析 type 字段（可能是 JSON 字符串、数组或单个字符串）
function parseItemType(type) {
    if (Array.isArray(type)) {
        return type;
    }
    if (typeof type === 'string') {
        try {
            const parsed = JSON.parse(type);
            if (Array.isArray(parsed)) {
                return parsed;
            }
            return [parsed];
        } catch (e) {
            return [type];
        }
    }
    return [type];
}

// 打开检查项列表模态框
function openCheckItemListModal(id = null) {
    const el = (id) => document.getElementById(id);
    if (el('checkItemListId')) el('checkItemListId').value = id || '';
    if (el('checkItemListName')) el('checkItemListName').value = '';
    if (el('checkItemListDesc')) el('checkItemListDesc').value = '';
    if (el('checkItemListModalTitle')) el('checkItemListModalTitle').textContent = id ? '编辑检查项列表' : '添加检查项列表';
    if (el('checkItemListModal')) el('checkItemListModal').classList.add('active');
}

// 打开检查项模态框
function openCheckItemModal(id = null) {
    const el = (id) => document.getElementById(id);
    if (el('checkItemId')) el('checkItemId').value = id || '';
    if (el('checkItemName')) el('checkItemName').value = '';
    if (el('checkItemTarget')) el('checkItemTarget').value = '';
    if (el('checkItemDesc')) el('checkItemDesc').value = '';
    // 重置检查类型复选框
    document.querySelectorAll('input[name="checkItemType"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    if (typeof toggleCheckItemFields === 'function') toggleCheckItemFields();
    if (el('checkItemModalTitle')) el('checkItemModalTitle').textContent = id ? '编辑检查项' : '添加检查项';

    // 加载检查项列表到选择器
    loadCheckItemListSelect();

    if (el('checkItemModal')) el('checkItemModal').classList.add('active');
}

// 加载检查项列表到选择器
async function loadCheckItemListSelect() {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/check-items/lists`, { headers: window.shared.getHeaders() });
        if (!res.ok) return;
        const lists = await res.json();
        const select = document.getElementById('checkItemListSelect');
        if (select) {
            select.innerHTML = '<option value="">不指定</option>' +
                lists.map(list => `<option value="${list.id}">${list.name}</option>`).join('');
        }
    } catch (e) {
        console.error('加载检查项列表失败:', e);
    }
}


// 加载检查项列表
async function loadCheckItemLists() {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/check-items/lists`, { headers: window.shared.getHeaders() });
        if (!res.ok) {
            const error = await res.json();
            console.error('加载检查项列表失败:', error);
            return;
        }
        const data = await res.json();
        // 确保 lists 是数组
        const lists = Array.isArray(data) ? data : [];
        const tree = document.getElementById('checkItemListTree');

        // 保留默认的"全部检查项"选项
        tree.innerHTML = `
            <li>
                <div class="group-item active" data-list-id="" onclick="selectCheckItemList('')">
                    <span class="icon">📁</span>
                    <span>全部检查项</span>
                </div>
            </li>
        `;

        // 添加检查项列表
        lists.forEach(list => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <div class="group-item" data-list-id="${list.id}" onclick="selectCheckItemList(${list.id})"><span class="icon">📋</span>
                    <span>${list.name}</span>
                    <div class="list-actions">
                        <button class="btn btn-xs" onclick="window.checkitems.editCheckItemList(${list.id}); event.stopPropagation();">✏️</button>
                        <button class="btn btn-xs" onclick="window.checkitems.cloneCheckItemList(${list.id}); event.stopPropagation();">📋</button>
                        <button class="btn btn-xs" onclick="window.checkitems.deleteCheckItemList(${list.id}); event.stopPropagation();">🗑️</button>
                    </div>
                </div>
            `;
            tree.appendChild(listItem);
        });
    } catch (e) {
        console.error('加载检查项列表异常:', e);
        alert('❌ 加载检查项列表失败，请刷新页面重试');
    }
}


// 编辑检查项列表
async function editCheckItemList(id) {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/check-items/lists/${id}`, { headers: window.shared.getHeaders() });
        const list = await res.json();
        const el = (eid) => document.getElementById(eid);
        if (el('checkItemListId')) el('checkItemListId').value = id;
        if (el('checkItemListName')) el('checkItemListName').value = list.name || '';
        if (el('checkItemListDesc')) el('checkItemListDesc').value = list.description || '';
        if (el('checkItemListModalTitle')) el('checkItemListModalTitle').textContent = '编辑检查项列表';
        if (el('checkItemListModal')) el('checkItemListModal').classList.add('active');
    } catch (e) { console.error(e); }
}

// 删除检查项列表
async function deleteCheckItemList(id) {
    if (!confirm('确定删除此检查项列表?')) return;
    try {
        await fetch(`${window.shared.API_BASE}/api/v1/check-items/lists/${id}`, { 
            method: 'DELETE', 
            headers: window.shared.getHeaders() 
        });
        loadCheckItemLists();
        loadCheckItems();
    } catch (e) { console.error(e); }
}

// 加载检查项
async function loadCheckItems(listId = '') {
    try {
        const { API_BASE } = window.shared;
        let url = `${API_BASE}/api/v1/check-items`;
        if (listId) {
            url = `${API_BASE}/api/v1/check-items?list_id=${listId}`;
        }

        const res = await fetch(url, { headers: window.shared.getHeaders() });
        const items = await res.json();
        const tbody = document.getElementById('checkItemTable');

        // 直接使用返回的数组
        const checkItems = items;

        // 格式化检查类型用于显示
        const formatType = (type) => {
            const types = parseItemType(type);
            return types.join(', ');
        };

        tbody.innerHTML = checkItems.map(item => `
            <tr>
                <td>${item.order_index || item.id}</td>
                <td>${item.name}</td>
                <td>${formatType(item.type)}</td>
                <td>${item.target_path || '-'}</td>
                <td>${item.list_name || (listId ? getCurrentCheckItemName() : '-')}</td>
                <td>${item.description || '-'}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="window.checkitems.editCheckItem(${item.id})">编辑</button>
                    <button class="btn btn-primary btn-sm" onclick="window.checkitems.cloneCheckItem(${item.id})">克隆</button>
                    <button class="btn btn-danger btn-sm" onclick="window.checkitems.deleteCheckItem(${item.id})">删除</button>
                </td>
            </tr>
        `).join('');
    } catch (e) { console.error(e); }
}

// 获取当前检查项列表名称
let currentCheckItemListId = '';
let currentCheckItemListName = '';

function getCurrentCheckItemName() {
    return currentCheckItemListName;
}

// 选择检查项列表
function selectCheckItemList(listId) {
    currentCheckItemListId = listId;

    // 更新选中状态
    document.querySelectorAll('#checkItemListTree .group-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeItem = document.querySelector(`#checkItemListTree .group-item[data-list-id="${listId}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
        // 更新当前检查项列表名称
        const listName = activeItem.querySelector('span:not(.icon):not(.list-actions)').textContent;
        currentCheckItemListName = listName === '全部检查项' ? '检查项管理' : listName;
        document.getElementById('currentCheckItemListName').textContent = currentCheckItemListName;
    }

    // 加载对应检查项
    loadCheckItems(listId);
}

// 编辑检查项
async function editCheckItem(id) {
    try {
        // 先加载列表选择器
        await loadCheckItemListSelect();

        const res = await fetch(`${window.shared.API_BASE}/api/v1/check-items/${id}`, { headers: window.shared.getHeaders() });
        const item = await res.json();
        const el = (eid) => document.getElementById(eid);
        if (el('checkItemId')) el('checkItemId').value = id;
        if (el('checkItemName')) el('checkItemName').value = item.name || '';
        if (el('checkItemTarget')) el('checkItemTarget').value = item.target_path || '';
        if (el('checkItemDesc')) el('checkItemDesc').value = item.description || '';
        // 设置所属列表
        if (el('checkItemListSelect')) {
            el('checkItemListSelect').value = item.list_id || '';
        }
        // 设置检查类型复选框
        if (item.type) {
            console.log('原始 type:', item.type, typeof item.type);
            const typeArray = parseItemType(item.type);
            console.log('解析后 typeArray:', typeArray);
            typeArray.forEach(type => {
                // 对每个 type 单独查找并设置
                const checkboxes = document.querySelectorAll('input[name="checkItemType"]');
                checkboxes.forEach(cb => {
                    if (type.includes(cb.value) || cb.value.includes(type)) {
                        cb.checked = true;
                    }
                });
            });
        }
        if (typeof toggleCheckItemFields === 'function') toggleCheckItemFields();
        if (el('checkItemModalTitle')) el('checkItemModalTitle').textContent = '编辑检查项';
        if (el('checkItemModal')) el('checkItemModal').classList.add('active');
    } catch (e) { console.error(e); }
}

// 删除检查项
async function deleteCheckItem(id) {
    if (!confirm('确定删除此检查项?')) return;
    try {
        await fetch(`${window.shared.API_BASE}/api/v1/check-items/${id}`, { 
            method: 'DELETE', 
            headers: window.shared.getHeaders() 
        });
        loadCheckItems();
    } catch (e) { console.error(e); }
}

// 检查项分类切换
function toggleCheckItemCategory() {
    const category = document.getElementById('checkItemCategory').value;

    // 隐藏所有检查类型字段
    document.getElementById('fileCheckFields').style.display = 'none';
    document.getElementById('contentCheckFields').style.display = 'none';
    document.getElementById('routeCheckFields').style.display = 'none';

    // 显示对应分类的字段
    if (category === 'file') {
        document.getElementById('fileCheckFields').style.display = 'block';
    } else if (category === 'content') {
        document.getElementById('contentCheckFields').style.display = 'block';
    } else if (category === 'route') {
        document.getElementById('routeCheckFields').style.display = 'block';
    }
}

// 文件/目录检查 - 各个属性的显示切换
function toggleCheckItemFields() {
    // 修改时间
    document.getElementById('fileMtimeFields').style.display =
        document.getElementById('checkFileMtime').checked ? 'block' : 'none';
    // 大小
    document.getElementById('fileSizeFields').style.display =
        document.getElementById('checkFileSize').checked ? 'block' : 'none';
    // 属主
    document.getElementById('fileOwnerFields').style.display =
        document.getElementById('checkFileOwner').checked ? 'block' : 'none';
    // 属组
    document.getElementById('fileGroupFields').style.display =
        document.getElementById('checkFileGroup').checked ? 'block' : 'none';
    // 权限
    document.getElementById('filePermissionsFields').style.display =
        document.getElementById('checkFilePermissions').checked ? 'block' : 'none';
    // MD5
    document.getElementById('fileMd5Fields').style.display =
        document.getElementById('checkFileMd5').checked ? 'block' : 'none';

    // 时间比较 - 显示范围设置
    const mtimeCompareMode = document.getElementById('fileMtimeCompareMode').value;
    document.getElementById('fileMtimeRangeFields').style.display =
        mtimeCompareMode === 'specified' ? 'flex' : 'none';

    // 大小比较 - 显示范围设置
    const sizeCompareMode = document.getElementById('fileSizeCompareMode').value;
    document.getElementById('fileSizeRangeFields').style.display =
        sizeCompareMode === 'specified' ? 'flex' : 'none';

    // 属主比较 - 显示指定值
    const ownerCompareMode = document.getElementById('fileOwnerCompareMode').value;
    document.getElementById('fileOwnerSpecifiedField').style.display =
        ownerCompareMode === 'specified' ? 'block' : 'none';

    // 属组比较 - 显示指定值
    const groupCompareMode = document.getElementById('fileGroupCompareMode').value;
    document.getElementById('fileGroupSpecifiedField').style.display =
        groupCompareMode === 'specified' ? 'block' : 'none';

    // 权限比较 - 显示指定值
    const permCompareMode = document.getElementById('filePermissionsCompareMode').value;
    document.getElementById('filePermissionsSpecifiedField').style.display =
        permCompareMode === 'specified' ? 'block' : 'none';

    // MD5比较 - 显示指定值
    const md5CompareMode = document.getElementById('fileMd5CompareMode').value;
    document.getElementById('fileMd5SpecifiedField').style.display =
        md5CompareMode === 'specified' ? 'block' : 'none';
}

// 文件内容检查 - 文件类型切换
function toggleContentCheckFields() {
    const fileType = document.getElementById('contentFileType').value;
    document.getElementById('textFileFields').style.display = fileType === 'text' ? 'block' : 'none';
    document.getElementById('kernelFileFields').style.display = fileType === 'kernel' ? 'block' : 'none';
}

// 文件内容检查 - 文本比较模式切换
function toggleTextCompareFields() {
    const mode = document.getElementById('textCompareMode').value;
    const showContent = mode === 'partial' || mode === 'contains' || mode === 'not_contains';
    document.getElementById('textContentField').style.display = showContent ? 'block' : 'none';
}

// 文件内容检查 - 内核参数比较模式切换
function toggleKernelCompareFields() {
    const mode = document.getElementById('kernelCompareMode').value;
    document.getElementById('kernelValueField').style.display = mode === 'specified' ? 'block' : 'none';
}

// 路由表检查 - 模式切换
function toggleRouteCheckFields() {
    const mode = document.getElementById('routeTableMode').value;
    document.getElementById('routeRuleField').style.display = mode === 'check' ? 'block' : 'none';
}

// 克隆检查项列表
async function cloneCheckItemList(id) {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/check-items/lists/${id}`, { headers: window.shared.getHeaders() });
        const list = await res.json();

        const newName = list.name + ' (复制)';

        // 调用后端复制API
        const copyRes = await fetch(`${window.shared.API_BASE}/api/v1/check-items/lists/${id}/copy`, {
            method: 'POST',
            headers: window.shared.getHeaders(),
            body: JSON.stringify({ new_name: newName })
        });

        if (copyRes.ok) {
            alert('✅ 检查项列表克隆成功！');
            loadCheckItemLists();
        } else {
            const error = await copyRes.json();
            alert('❌ 克隆失败: ' + (error.detail || '未知错误'));
        }
    } catch (e) {
        console.error(e);
        alert('❌ 克隆异常');
    }
}

// 克隆检查项
async function cloneCheckItem(id) {
    try {
        // 先加载列表选择器
        await loadCheckItemListSelect();

        const res = await fetch(`${window.shared.API_BASE}/api/v1/check-items/${id}`, { headers: window.shared.getHeaders() });
        const item = await res.json();

        // 打开模态框并预填信息（与编辑相同）
        document.getElementById('checkItemId').value = '';
        document.getElementById('checkItemName').value = `${item.name} (复制)`;
        document.getElementById('checkItemDesc').value = item.description || '';
        // 设置所属列表
        document.getElementById('checkItemListSelect').value = item.list_id || '';

        // 解析 type 字段
        const types = parseItemType(item.type);

        // 判断检查项分类
        let category = '';
        if (types.includes('file_exists') || types.includes('file_mtime') || types.includes('file_size')
            || types.includes('file_owner') || types.includes('file_group') || types.includes('file_permissions')
            || types.includes('file_md5')) {
            category = 'file';
        } else if (types.includes('file_content') || types.includes('kernel_param')) {
            category = 'content';
        } else if (types.includes('route_table')) {
            category = 'route';
        }
        document.getElementById('checkItemCategory').value = category;
        toggleCheckItemCategory();

        // 根据分类填充字段
        if (category === 'file') {
            document.getElementById('filePath').value = item.target_path || '';
            document.getElementById('checkFileMtime').checked = types.includes('file_mtime');
            if (item.check_attributes?.mtime) {
                document.getElementById('fileMtimeCompareMode').value = item.check_attributes.mtime.compare_mode || 'snapshot';
                document.getElementById('fileMtimeStart').value = item.check_attributes.mtime.start_time || '';
                document.getElementById('fileMtimeEnd').value = item.check_attributes.mtime.end_time || '';
            }
            document.getElementById('checkFileSize').checked = types.includes('file_size');
            if (item.check_attributes?.size) {
                document.getElementById('fileSizeCompareMode').value = item.check_attributes.size.compare_mode || 'snapshot';
                document.getElementById('fileSizeMin').value = item.check_attributes.size.min_size || '';
                document.getElementById('fileSizeMax').value = item.check_attributes.size.max_size || '';
            }
            document.getElementById('checkFileOwner').checked = types.includes('file_owner');
            if (item.check_attributes?.owner) {
                document.getElementById('fileOwnerCompareMode').value = item.check_attributes.owner.compare_mode || 'snapshot';
                document.getElementById('fileOwnerValue').value = item.check_attributes.owner.owner || '';
            }
            document.getElementById('checkFileGroup').checked = types.includes('file_group');
            if (item.check_attributes?.group) {
                document.getElementById('fileGroupCompareMode').value = item.check_attributes.group.compare_mode || 'snapshot';
                document.getElementById('fileGroupValue').value = item.check_attributes.group.group || '';
            }
            document.getElementById('checkFilePermissions').checked = types.includes('file_permissions');
            if (item.check_attributes?.permissions) {
                document.getElementById('filePermissionsCompareMode').value = item.check_attributes.permissions.compare_mode || 'snapshot';
                document.getElementById('filePermissionsValue').value = item.check_attributes.permissions.permissions || '';
            }
            document.getElementById('checkFileMd5').checked = types.includes('file_md5');
            if (item.check_attributes?.md5) {
                document.getElementById('fileMd5CompareMode').value = item.check_attributes.md5.compare_mode || 'snapshot';
                document.getElementById('fileMd5Value').value = item.check_attributes.md5.md5_value || '';
            }
        } else if (category === 'content') {
            document.getElementById('contentFilePath').value = item.target_path || '';
            if (types.includes('file_content')) {
                document.getElementById('contentFileType').value = 'text';
                if (item.check_attributes?.content) {
                    document.getElementById('textCompareMode').value = item.check_attributes.content.compare_mode || 'full';
                    document.getElementById('textContent').value = item.check_attributes.content.content || '';
                }
            } else if (types.includes('kernel_param')) {
                document.getElementById('contentFileType').value = 'kernel';
                if (item.check_attributes?.kernel) {
                    document.getElementById('kernelCompareMode').value = item.check_attributes.kernel.compare_mode || 'snapshot';
                    document.getElementById('kernelParamValue').value = item.check_attributes.kernel.param_value || '';
                }
            }
        } else if (category === 'route') {
            if (item.check_attributes?.route) {
                document.getElementById('routeTableMode').value = item.check_attributes.route.mode || 'full';
                document.getElementById('routeRule').value = item.check_attributes.route.route_rule || '';
            }
        }

        toggleCheckItemFields();
        toggleContentCheckFields();
        toggleTextCompareFields();
        toggleKernelCompareFields();
        toggleRouteCheckFields();

        document.getElementById('checkItemModalTitle').textContent = '克隆检查项';
        document.getElementById('checkItemModal').classList.add('active');
    } catch (e) {
        console.error(e);
        alert('❌ 克隆异常');
    }
}

// 导出模块
window.checkitems = {
    parseItemType,
    openCheckItemListModal,
    openCheckItemModal,
    toggleCheckItemFields,
    toggleCheckItemCategory,
    toggleContentCheckFields,
    toggleTextCompareFields,
    toggleKernelCompareFields,
    toggleRouteCheckFields,
    loadCheckItemLists,
    selectCheckItemList,
    editCheckItemList,
    cloneCheckItemList,
    deleteCheckItemList,
    loadCheckItems,
    loadCheckItemListSelect,
    editCheckItem,
    cloneCheckItem,
    deleteCheckItem
};