(function() {
    'use strict';

// 检查项管理模块
window.currentCheckItemListId = '';
window.checkItemPagination = {
    page: 1,
    size: 5,
    q: ''
};

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
    if (el('checkItemDesc')) el('checkItemDesc').value = '';
    
    // 重置分类选择
    if (el('checkItemCategory')) {
        el('checkItemCategory').value = '';
        toggleCheckItemCategory();
    }
    
    // 重置检查类型复选框
    document.querySelectorAll('input[name="checkItemType"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    if (typeof toggleCheckItemFields === 'function') toggleCheckItemFields();
    if (el('checkItemModalTitle')) el('checkItemModalTitle').textContent = id ? '编辑检查项' : '添加检查项';

    // 如果没有 id (即新建)，则尝试预选当前所在的列表
    const initialListId = id ? null : window.currentCheckItemListId;
    loadCheckItemListSelect(initialListId);

    if (el('checkItemModal')) el('checkItemModal').classList.add('active');
}

// 加载检查项列表到选择器
async function loadCheckItemListSelect(selectedId = null) {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/check-items/lists`, { headers: window.shared.getHeaders() });
        if (!res.ok) return;
        const lists = await res.json();
        const select = document.getElementById('checkItemListSelect');
        if (select) {
            select.innerHTML = '<option value="">不指定</option>' +
                lists.map(list => `<option value="${list.id}">${list.name}</option>`).join('');
            
            // 如果指定了 selectedId，则进行选中
            if (selectedId) {
                select.value = selectedId;
            }
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
        const lists = Array.isArray(data) ? data : [];
        const tree = document.getElementById('checkItemListTree');

        // 保留默认的"全部检查项"选项
        tree.innerHTML = `
            <li>
                <div class="group-item active" data-list-id="" onclick="window.checkitems.selectCheckItemList('')">
                    <span class="icon">📁</span>
                    <span>全部检查项</span>
                </div>
            </li>
        `;

        // 添加检查项列表
        lists.forEach(list => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <div class="group-item" data-list-id="${list.id}" onclick="window.checkitems.selectCheckItemList(${list.id})"><span class="icon">📋</span>
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

// 搜索检查项
let checkItemSearchTimer = null;
function searchCheckItems() {
    const q = document.getElementById('checkItemSearch').value.trim();
    window.checkItemPagination.q = q;
    window.checkItemPagination.page = 1; // 重置页码
    
    if (checkItemSearchTimer) clearTimeout(checkItemSearchTimer);
    checkItemSearchTimer = setTimeout(() => {
        loadCheckItems();
    }, 500);
}

// 加载检查项
async function loadCheckItems(page = null, size = null) {
    if (page !== null) window.checkItemPagination.page = page;
    if (size !== null) window.checkItemPagination.size = size;

    try {
        const { API_BASE } = window.shared;
        const queryParams = new URLSearchParams({
            page: window.checkItemPagination.page,
            size: window.checkItemPagination.size
        });
        
        if (window.currentCheckItemListId) {
            queryParams.append('list_id', window.currentCheckItemListId);
        }
        if (window.checkItemPagination.q) {
            queryParams.append('q', window.checkItemPagination.q);
        }

        const res = await fetch(`${API_BASE}/api/v1/check-items?${queryParams.toString()}`, { 
            headers: window.shared.getHeaders() 
        });

        if (!res.ok) throw new Error('API请求失败');

        const totalCount = parseInt(res.headers.get('X-Total-Count') || '0');
        const checkItems = await res.json();
        const tbody = document.getElementById('checkItemTable');
        if (!tbody) return;

        // 格式化检查类型用于显示
        const formatType = (type) => {
            const types = parseItemType(type);
            const typeMap = {
                'file_exists': '文件存在',
                'file_mtime': '修改时间',
                'file_size': '文件大小',
                'file_owner': '属主',
                'file_group': '属组',
                'file_permissions': '权限',
                'file_md5': 'MD5校验',
                'file_content': '内容检查',
                'kernel_param': '内核参数',
                'route_table': '路由表'
            };
            return types.map(t => typeMap[t] || t).join(', ');
        };

        if (checkItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无数据</td></tr>';
        } else {
            tbody.innerHTML = checkItems.map(item => `
                <tr>
                    <td><input type="checkbox" name="checkItemIds" value="${item.id}" onchange="window.checkitems.updateBatchToolbar()"></td>
                    <td>${item.name}</td>
                    <td>${formatType(item.type)}</td>
                    <td class="path-column">
                        <div class="text-truncate-2" title="${item.target_path || ''}">${item.target_path || '-'}</div>
                    </td>
                    <td>${item.list_name || '-'}</td>
                    <td style="max-width: 200px;">
                        <div class="text-truncate-2" title="${item.description || ''}">${item.description || '-'}</div>
                    </td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="window.checkitems.editCheckItem(${item.id})">编辑</button>
                        <button class="btn btn-primary btn-sm" onclick="window.checkitems.cloneCheckItem(${item.id})">克隆</button>
                        <button class="btn btn-danger btn-sm" onclick="window.checkitems.deleteCheckItem(${item.id})">删除</button>
                    </td>
                </tr>
            `).join('');
        }

        // 每次加载重置全选框和批量按钮
        const selectAll = document.getElementById('selectAllCheckItems');
        if (selectAll) selectAll.checked = false;
        updateBatchToolbar();

        // 渲染分页
        window.paginationManager.render(
            'checkItemsPagination',
            totalCount,
            window.checkItemPagination.page,
            window.checkItemPagination.size,
            (newPage, newSize) => {
                loadCheckItems(newPage, newSize);
            }
        );
    } catch (e) { 
        console.error(e);
        const tbody = document.getElementById('checkItemTable');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="empty-state">加载失败，请刷新页面重试</td></tr>';
    }
}

// 选择检查项列表
function selectCheckItemList(listId) {
    window.currentCheckItemListId = listId;
    window.checkItemPagination.page = 1; // 切换列表重置页码

    // 更新选中状态
    document.querySelectorAll('#checkItemListTree .group-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeItem = document.querySelector(`#checkItemListTree .group-item[data-list-id="${listId}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
        // 更新当前检查项列表名称
        const listName = activeItem.querySelector('span:not(.icon):not(.list-actions)').textContent;
        const currentName = listName === '全部检查项' ? '检查项管理' : listName;
        document.getElementById('currentCheckItemListName').textContent = currentName;
    }

    // 加载对应检查项
    loadCheckItems();
}

// 编辑检查项
async function editCheckItem(id) {
    try {
        await loadCheckItemListSelect();

        const res = await fetch(`${window.shared.API_BASE}/api/v1/check-items/${id}`, { headers: window.shared.getHeaders() });
        const item = await res.json();
        const el = (eid) => document.getElementById(eid);
        
        if (el('checkItemId')) el('checkItemId').value = id;
        if (el('checkItemName')) el('checkItemName').value = item.name || '';
        if (el('checkItemDesc')) el('checkItemDesc').value = item.description || '';
        
        if (el('checkItemListSelect')) {
            el('checkItemListSelect').value = item.list_id || '';
        }

        const types = parseItemType(item.type);

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
        
        if (el('checkItemCategory')) {
            el('checkItemCategory').value = category;
            toggleCheckItemCategory();
        }

        if (category === 'file') {
            if (el('filePath')) el('filePath').value = item.target_path || '';
            if (el('checkFileMtime')) el('checkFileMtime').checked = types.includes('file_mtime');
            if (item.check_attributes?.mtime) {
                if (el('fileMtimeCompareMode')) el('fileMtimeCompareMode').value = item.check_attributes.mtime.compare_mode || 'snapshot';
                if (el('fileMtimeStart')) el('fileMtimeStart').value = item.check_attributes.mtime.start_time || '';
                if (el('fileMtimeEnd')) el('fileMtimeEnd').value = item.check_attributes.mtime.end_time || '';
            }
            if (el('checkFileSize')) el('checkFileSize').checked = types.includes('file_size');
            if (item.check_attributes?.size) {
                if (el('fileSizeCompareMode')) el('fileSizeCompareMode').value = item.check_attributes.size.compare_mode || 'snapshot';
                if (el('fileSizeMin')) el('fileSizeMin').value = item.check_attributes.size.min_size || '';
                if (el('fileSizeMax')) el('fileSizeMax').value = item.check_attributes.size.max_size || '';
            }
            if (el('checkFileOwner')) el('checkFileOwner').checked = types.includes('file_owner');
            if (item.check_attributes?.owner) {
                if (el('fileOwnerCompareMode')) el('fileOwnerCompareMode').value = item.check_attributes.owner.compare_mode || 'snapshot';
                if (el('fileOwnerValue')) el('fileOwnerValue').value = item.check_attributes.owner.owner || '';
            }
            if (el('checkFileGroup')) el('checkFileGroup').checked = types.includes('file_group');
            if (item.check_attributes?.group) {
                if (el('fileGroupCompareMode')) el('fileGroupCompareMode').value = item.check_attributes.group.compare_mode || 'snapshot';
                if (el('fileGroupValue')) el('fileGroupValue').value = item.check_attributes.group.group || '';
            }
            if (el('checkFilePermissions')) el('checkFilePermissions').checked = types.includes('file_permissions');
            if (item.check_attributes?.permissions) {
                if (el('filePermissionsCompareMode')) el('filePermissionsCompareMode').value = item.check_attributes.permissions.compare_mode || 'snapshot';
                if (el('filePermissionsValue')) el('filePermissionsValue').value = item.check_attributes.permissions.permissions || '';
            }
            if (el('checkFileMd5')) el('checkFileMd5').checked = types.includes('file_md5');
            if (item.check_attributes?.md5) {
                if (el('fileMd5CompareMode')) el('fileMd5CompareMode').value = item.check_attributes.md5.compare_mode || 'snapshot';
                if (el('fileMd5Value')) el('fileMd5Value').value = item.check_attributes.md5.md5_value || '';
            }

            if (el('isRecursive')) el('isRecursive').checked = !!item.check_attributes?.is_recursive;
            if (el('excludePatterns')) {
                const patterns = item.check_attributes?.exclude_patterns || [];
                el('excludePatterns').value = Array.isArray(patterns) ? patterns.join('\n') : patterns;
            }
        } else if (category === 'content') {
            if (el('contentFilePath')) el('contentFilePath').value = item.target_path || '';
            if (types.includes('file_content')) {
                if (el('contentFileType')) el('contentFileType').value = 'text';
                if (item.check_attributes?.content) {
                    if (el('textCompareMode')) el('textCompareMode').value = item.check_attributes.content.compare_mode || 'full';
                    if (el('textContent')) el('textContent').value = item.check_attributes.content.content || '';
                }
            } else if (types.includes('kernel_param')) {
                if (el('contentFileType')) el('contentFileType').value = 'kernel';
                if (item.check_attributes?.kernel) {
                    if (el('kernelCompareMode')) el('kernelCompareMode').value = item.check_attributes.kernel.compare_mode || 'snapshot';
                    if (el('kernelParamValue')) el('kernelParamValue').value = item.check_attributes.kernel.param_value || '';
                }
            }
        } else if (category === 'route') {
            if (item.check_attributes?.route) {
                if (el('routeTableMode')) el('routeTableMode').value = item.check_attributes.route.mode || 'full';
                if (el('routeRule')) el('routeRule').value = item.check_attributes.route.route_rule || '';
            }
        }

        toggleCheckItemFields();
        toggleContentCheckFields();
        toggleTextCompareFields();
        
        if (el('checkItemModalTitle')) el('checkItemModalTitle').textContent = '编辑检查项';
        if (el('checkItemModal')) el('checkItemModal').classList.add('active');
    } catch (e) {
        console.error('加载检查项信息失败:', e);
        alert('获取详情失败');
    }
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

    document.getElementById('fileCheckFields').style.display = 'none';
    document.getElementById('contentCheckFields').style.display = 'none';
    document.getElementById('routeCheckFields').style.display = 'none';

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
    document.getElementById('fileMtimeFields').style.display =
        document.getElementById('checkFileMtime').checked ? 'block' : 'none';
    document.getElementById('fileSizeFields').style.display =
        document.getElementById('checkFileSize').checked ? 'block' : 'none';
    document.getElementById('fileOwnerFields').style.display =
        document.getElementById('checkFileOwner').checked ? 'block' : 'none';
    document.getElementById('fileGroupFields').style.display =
        document.getElementById('checkFileGroup').checked ? 'block' : 'none';
    document.getElementById('filePermissionsFields').style.display =
        document.getElementById('checkFilePermissions').checked ? 'block' : 'none';
    document.getElementById('fileMd5Fields').style.display =
        document.getElementById('checkFileMd5').checked ? 'block' : 'none';
    
    const isRecursive = document.getElementById('isRecursive').checked;
    document.getElementById('excludePatternsFields').style.display = isRecursive ? 'block' : 'none';

    const mtimeCompareMode = document.getElementById('fileMtimeCompareMode').value;
    document.getElementById('fileMtimeRangeFields').style.display =
        mtimeCompareMode === 'specified' ? 'flex' : 'none';

    const sizeCompareMode = document.getElementById('fileSizeCompareMode').value;
    document.getElementById('fileSizeRangeFields').style.display =
        sizeCompareMode === 'specified' ? 'flex' : 'none';

    const ownerCompareMode = document.getElementById('fileOwnerCompareMode').value;
    document.getElementById('fileOwnerSpecifiedField').style.display =
        ownerCompareMode === 'specified' ? 'block' : 'none';

    const groupCompareMode = document.getElementById('fileGroupCompareMode').value;
    document.getElementById('fileGroupSpecifiedField').style.display =
        groupCompareMode === 'specified' ? 'block' : 'none';

    const permCompareMode = document.getElementById('filePermissionsCompareMode').value;
    document.getElementById('filePermissionsSpecifiedField').style.display =
        permCompareMode === 'specified' ? 'block' : 'none';

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
        await loadCheckItemListSelect();

        const res = await fetch(`${window.shared.API_BASE}/api/v1/check-items/${id}`, { headers: window.shared.getHeaders() });
        const item = await res.json();

        document.getElementById('checkItemId').value = '';
        document.getElementById('checkItemName').value = `${item.name} (复制)`;
        document.getElementById('checkItemDesc').value = item.description || '';
        document.getElementById('checkItemListSelect').value = item.list_id || '';

        const types = parseItemType(item.type);

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

            document.getElementById('isRecursive').checked = !!item.check_attributes?.is_recursive;
            const patterns = item.check_attributes?.exclude_patterns || [];
            document.getElementById('excludePatterns').value = Array.isArray(patterns) ? patterns.join('\n') : patterns;
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

// ========== 批量操作 ==========

function toggleSelectAll(checked) {
    document.querySelectorAll('input[name="checkItemIds"]').forEach(cb => {
        cb.checked = checked;
    });
    updateBatchToolbar();
}

function updateBatchToolbar() {
    const checked = document.querySelectorAll('input[name="checkItemIds"]:checked');
    const btn = document.getElementById('checkItemBatchDelete');
    if (btn) {
        btn.style.display = checked.length > 0 ? 'inline-block' : 'none';
        btn.textContent = `批量删除 (${checked.length})`;
    }
}

async function batchDeleteCheckItems() {
    const checked = document.querySelectorAll('input[name="checkItemIds"]:checked');
    const ids = Array.from(checked).map(cb => parseInt(cb.value));
    
    if (ids.length === 0) return;
    if (!confirm(`确定要删除选中的 ${ids.length} 个检查项吗？`)) return;

    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/check-items`, {
            method: 'DELETE',
            headers: {
                ...window.shared.getHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids })
        });

        if (res.ok) {
            loadCheckItems();
        } else {
            const err = await res.json();
            alert('删除失败: ' + (err.detail || '未知原因'));
        }
    } catch (e) {
        console.error(e);
        alert('删除请求失败');
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
    searchCheckItems,
    loadCheckItemListSelect,
    editCheckItem,
    cloneCheckItem,
    deleteCheckItem,
    toggleSelectAll,
    updateBatchToolbar,
    batchDeleteCheckItems
};

})();