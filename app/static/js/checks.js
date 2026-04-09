// 检查执行模块 - 控制台优先重构版本
// 2026-04-07 重塑为 IDE 风格三段式布局

let checkRules = [];
let currentRuleId = null;
let progressPollInterval = null;

// 资产字典
let dicts = {
    communication: { items: {}, groups: {} },
    checkItem: { items: {}, groups: {} },
    snapshot: { items: {}, groups: {} }
};

// 当前选中关联状态
let selectedRelations = {
    communication: { ids: [], group_ids: [] },
    checkItem: { ids: [], group_ids: [] },
    snapshot: { ids: [], group_ids: [] }
};

let currentModalType = null; // 当前抽屉类型

// ---------------------- 基础数据加载 ----------------------

async function loadDictionaries() {
    try {
        const headers = window.shared.getHeaders();
        const base = window.shared.API_BASE + '/api/v1';
        
        const [comms, commGroups, citems, clists, snaps, snapGroups] = await Promise.all([
            fetch(`${base}/communications`, {headers}).then(r => r.json()),
            fetch(`${base}/communications/groups`, {headers}).then(r => r.json()),
            fetch(`${base}/check-items`, {headers}).then(r => r.json()),
            fetch(`${base}/check-items/lists`, {headers}).then(r => r.json()),
            fetch(`${base}/snapshots`, {headers}).then(r => r.json()),
            fetch(`${base}/snapshots/groups`, {headers}).then(r => r.json())
        ]);

        comms.forEach(c => dicts.communication.items[c.id] = c);
        commGroups.forEach(g => dicts.communication.groups[g.id] = g);
        citems.forEach(c => dicts.checkItem.items[c.id] = c);
        clists.forEach(l => dicts.checkItem.groups[l.id] = l);
        snaps.forEach(s => dicts.snapshot.items[s.id] = s);
        snapGroups.forEach(g => dicts.snapshot.groups[g.id] = g);
    } catch (e) { console.error("资产字典加载失败:", e); }
}

// ---------------------- 规则列表导航 (Sidebar) ----------------------

async function loadCheckRules() {
    await loadDictionaries();
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/check-rules`, { headers: window.shared.getHeaders() });
        checkRules = await res.json();
        checkRules.sort((a, b) => a.name.localeCompare(b.name));
        renderRuleTree();
        if (currentRuleId) selectRule(currentRuleId);
    } catch (e) { console.error('加载检查规则失败:', e); }
}

function renderRuleTree() {
    const tree = document.getElementById('ruleTree');
    const kw = document.getElementById('ruleSearchInput')?.value.toLowerCase() || '';
    const filtered = checkRules.filter(r => !kw || r.name.toLowerCase().includes(kw));
    
    if (!filtered.length) {
        tree.innerHTML = '<li class="empty-text">未找到符合要求的规则</li>';
        return;
    }
    
    tree.innerHTML = filtered.map(rule => {
        const dotColor = rule.is_active ? 'var(--success)' : 'var(--text-muted)';
        return `
            <li class="rule-item">
                <div class="group-item ${currentRuleId === rule.id ? 'active' : ''}" onclick="window.checks.selectRule(${rule.id})">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="status-dot" style="width:8px; height:8px; border-radius:50%; background:${dotColor}; box-shadow: 0 0 5px ${dotColor};"></span>
                        <span class="rule-name">${rule.name}</span>
                    </div>
                </div>
            </li>
        `;
    }).join('');
}

function filterRules() { renderRuleTree(); }

// ---------------------- 规则详情与 Workbench ----------------------

function selectRule(id) {
    currentRuleId = id;
    const rule = checkRules.find(r => r.id === id);
    if (!rule) return;
    
    document.getElementById('ruleDetailSection').style.display = 'block';
    document.getElementById('ruleEmptyState').style.display = 'none';
    document.getElementById('ruleDetailTitle').innerText = rule.name;
    document.getElementById('executeRuleBtn').style.display = rule.allow_manual_execution ? 'inline-block' : 'none';
    
    const toggleBtn = document.getElementById('toggleRuleBtn');
    if (toggleBtn) {
        toggleBtn.style.display = 'inline-block';
        toggleBtn.innerText = rule.is_active ? '暂停规则' : '启用规则';
        toggleBtn.className = rule.is_active ? 'btn btn-outline' : 'btn btn-success';
    }
    
    const deleteBtn = document.getElementById('deleteRuleBtn');
    if (deleteBtn) {
        deleteBtn.style.display = 'inline-block';
    }

    document.getElementById('ruleName').value = rule.name || '';
    
    const cronVal = rule.cron_expression || '';
    const templateSelect = document.getElementById('ruleCronTemplate');
    const cronInput = document.getElementById('ruleCron');
    if (templateSelect && cronInput) {
        let isPreset = false;
        for(let i = 0; i < templateSelect.options.length; i++) {
            if (templateSelect.options[i].value === cronVal && cronVal !== 'custom') {
                isPreset = true;
                break;
            }
        }
        if (!cronVal) {
            templateSelect.value = '';
            cronInput.style.display = 'none';
            cronInput.value = '';
        } else if (isPreset) {
            templateSelect.value = cronVal;
            cronInput.style.display = 'none';
            cronInput.value = cronVal;
        } else {
            templateSelect.value = 'custom';
            cronInput.style.display = 'block';
            cronInput.value = cronVal;
        }
    }

    document.getElementById('ruleDescription').value = rule.description || '';
    
    const cancelBtn = document.getElementById('cancelRuleBtn');
    if(cancelBtn) cancelBtn.style.display = 'none';
    const saveBtn = document.getElementById('saveRuleBtn');
    if(saveBtn) saveBtn.innerText = '保存规则配置';
    
    selectedRelations = {
        communication: { ids: [...(rule.communication_ids || [])], group_ids: [...(rule.communication_group_ids || [])] },
        checkItem: { ids: [...(rule.check_item_ids || [])], group_ids: [...(rule.check_item_list_ids || [])] },
        snapshot: { ids: [...(rule.snapshot_ids || [])], group_ids: [...(rule.snapshot_group_ids || [])] }
    };
    
    updateSummaryDisplays();
    renderRuleTree();
    
    // 切换规则时立即获取当前正在运行的任务和历史
    if (progressPollInterval) { clearInterval(progressPollInterval); progressPollInterval = null; }
    loadCurrentMultiTasksProgress();
    loadExecutionHistory();
}

function updateSummaryDisplays() {
    const summarize = (type) => {
        const rels = selectedRelations[type];
        if (!rels.ids.length && !rels.group_ids.length) {
            return type === 'snapshot' ? '自动对齐最新' : '未配置资产';
        }
        let parts = [];
        if (rels.group_ids.length) parts.push(`📁 ${rels.group_ids.length} 个组/列表`);
        if (rels.ids.length) parts.push(`📄 ${rels.ids.length} 个项`);
        return parts.join(' | ');
    };
    const commS = document.getElementById('commSummary');
    const itemS = document.getElementById('itemSummary');
    const snapS = document.getElementById('snapshotSummary');
    if (commS) commS.innerText = summarize('communication');
    if (itemS) itemS.innerText = summarize('checkItem');
    if (snapS) snapS.innerText = summarize('snapshot');
}

// ---------------------- 规则 CRUD ----------------------

function createNewRule() {
    currentRuleId = null;
    const form = document.getElementById('ruleForm');
    if (form) form.reset();
    selectedRelations = { communication: { ids: [], group_ids: [] }, checkItem: { ids: [], group_ids: [] }, snapshot: { ids: [], group_ids: [] } };
    updateSummaryDisplays();
    const detail = document.getElementById('ruleDetailSection');
    const empty = document.getElementById('ruleEmptyState');
    if (detail) detail.style.display = 'block';
    if (empty) empty.style.display = 'none';
    document.getElementById('ruleDetailTitle').innerText = '新增检查规则';
    document.getElementById('executeRuleBtn').style.display = 'none';
    document.getElementById('toggleRuleBtn').style.display = 'none';
    const delBtn = document.getElementById('deleteRuleBtn');
    if (delBtn) delBtn.style.display = 'none';
    
    const cancelBtn = document.getElementById('cancelRuleBtn');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
    const saveBtn = document.getElementById('saveRuleBtn');
    if (saveBtn) saveBtn.innerText = '确认创建';
    
    handleCronTemplateChange();
    renderRuleTree();
}

function cancelCreateRule() {
    currentRuleId = null;
    const form = document.getElementById('ruleForm');
    if (form) form.reset();
    const detail = document.getElementById('ruleDetailSection');
    const empty = document.getElementById('ruleEmptyState');
    if (detail) detail.style.display = 'none';
    if (empty) empty.style.display = 'block';
    document.querySelectorAll('.rule-item .group-item.active').forEach(el => el.classList.remove('active'));
}

function handleCronTemplateChange() {
    const template = document.getElementById('ruleCronTemplate');
    const cronInput = document.getElementById('ruleCron');
    if (!template || !cronInput) return;
    if (template.value === 'custom') {
        cronInput.style.display = 'block';
    } else {
        cronInput.style.display = 'none';
        cronInput.value = template.value;
    }

}

async function saveCurrentRule() {
    const existingRule = currentRuleId ? checkRules.find(r => r.id === currentRuleId) : null;
    
    const templateSelect = document.getElementById('ruleCronTemplate');
    const cronInput = document.getElementById('ruleCron');
    let finalCron = null;
    if (templateSelect && cronInput) {
        if (templateSelect.value === 'custom') {
            finalCron = cronInput.value || null;
        } else if (templateSelect.value !== '') {
            finalCron = templateSelect.value;
        }
    } else {
        finalCron = cronInput ? (cronInput.value || null) : null;
    }

    const payload = {
        name: document.getElementById('ruleName').value,
        description: document.getElementById('ruleDescription').value,
        cron_expression: finalCron,
        is_active: existingRule ? existingRule.is_active : true,
        allow_manual_execution: existingRule ? existingRule.allow_manual_execution : true,
        communication_ids: selectedRelations.communication.ids,
        communication_group_ids: selectedRelations.communication.group_ids,
        check_item_ids: selectedRelations.checkItem.ids,
        check_item_list_ids: selectedRelations.checkItem.group_ids,
        snapshot_ids: selectedRelations.snapshot.ids,
        snapshot_group_ids: selectedRelations.snapshot.group_ids
    };

    if (!payload.name) return alert('请输入规则名称');
    try {
        let url = `${window.shared.API_BASE}/api/v1/check-rules`;
        let method = currentRuleId ? 'PUT' : 'POST';
        if (currentRuleId) url += `/${currentRuleId}`;

        const res = await fetch(url, {
            method,
            headers: { ...window.shared.getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        let data;
        try {
            data = await res.json();
        } catch (e) {
            throw new Error("系统返回数据异常");
        }
        
        if (!res.ok) throw new Error(data.detail || "保存失败");
        
        alert(currentRuleId ? '修改成功!' : '新增成功!');
        currentRuleId = data.id;
        await loadCheckRules();
    } catch (e) { alert('保存失败: ' + e.message); }
}

async function toggleCurrentRule() {
    if (!currentRuleId) return;
    try {
        await fetch(`${window.shared.API_BASE}/api/v1/check-rules/${currentRuleId}/toggle`, { method: 'PATCH', headers: window.shared.getHeaders() });
        loadCheckRules();
    } catch (e) { alert('状态切换失败: ' + e.message); }
}

async function deleteCurrentRule() {
    if (!currentRuleId || !confirm("确认删除此规则？")) return;
    try {
        await fetch(`${window.shared.API_BASE}/api/v1/check-rules/${currentRuleId}`, { method: 'DELETE', headers: window.shared.getHeaders() });
        currentRuleId = null;
        document.getElementById('ruleDetailSection').style.display = 'none';
        document.getElementById('ruleEmptyState').style.display = 'block';
        loadCheckRules();
    } catch (e) { alert('删除失败: ' + e.message); }
}

// ---------------------- 资产抽屉 (Tree Selector) ----------------------

function openAssetDrawer(type) {
    currentModalType = type;
    const drawer = document.getElementById('assetDrawer');
    const titleMap = { communication: '选择通信机', checkItem: '选择检查项', snapshot: '选择基准快照' };
    document.getElementById('drawerTitle').innerText = titleMap[type];
    document.getElementById('assetSearchInput').value = '';
    document.getElementById('selectedCount').innerText = `已选 ${selectedRelations[type].ids.length} 项 / ${selectedRelations[type].group_ids.length} 组`;
    drawer.classList.add('active');
    renderAssetTree();
}

function closeAssetDrawer() {
    document.getElementById('assetDrawer').classList.remove('active');
    updateSummaryDisplays();
}

function filterAssetTree() { renderAssetTree(); }

function renderAssetTree() {
    const container = document.getElementById('assetTreeContainer');
    const kw = document.getElementById('assetSearchInput').value.toLowerCase();
    const d = dicts[currentModalType];
    const tree = buildHierarchy(Object.values(d.groups), Object.values(d.items));
    container.innerHTML = renderNodeList(tree, 0, kw);
}

function buildHierarchy(groups, items) {
    const groupMap = {};
    groups.forEach(g => groupMap[g.id] = { ...g, children: [], items: [], isGroup: true });
    const root = [];
    groups.forEach(g => {
        if (g.parent_id && groupMap[g.parent_id]) groupMap[g.parent_id].children.push(groupMap[g.id]);
        else root.push(groupMap[g.id]);
    });
    items.forEach(item => {
        const gid = item.group_id || item.list_id;
        if (gid && groupMap[gid]) groupMap[gid].items.push({ ...item, isGroup: false });
        else root.push({ ...item, isGroup: false });
    });
    return root;
}

function renderNodeList(nodes, level, kw) {
    let html = '';
    nodes.forEach(node => {
        const type = currentModalType;
        const isSelected = node.isGroup ? selectedRelations[type].group_ids.includes(node.id) : selectedRelations[type].ids.includes(node.id);
        const displayName = node.name || node.ip_address || `ID:${node.id}`;
        if (kw && !displayName.toLowerCase().includes(kw)) return;

        html += `
            <div class="tree-node" style="padding-left: ${level * 20}px">
                <label class="tree-item">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onclick="window.checks.handleTreeCheck(event, ${node.isGroup}, ${node.id})">
                    <span class="icon">${node.isGroup ? '📁' : '📄'}</span>
                    <span class="name">${displayName}</span>
                </label>
            </div>
        `;
        if (node.isGroup) {
            html += renderNodeList(node.children, level + 1, kw);
            html += renderNodeList(node.items, level + 1, kw);
        }
    });
    return html || (level === 0 ? '<p class="empty-text">无匹配项</p>' : '');
}

function handleTreeCheck(event, isGroup, id) {
    const checked = event.target.checked;
    const type = currentModalType;
    
    if (isGroup) {
        cascadeSelect(type, id, checked);
        if (checked && type === 'snapshot') {
            const group = dicts.snapshot.groups[id];
            if (group && group.check_item_list_id && !selectedRelations.checkItem.group_ids.includes(group.check_item_list_id)) {
                selectedRelations.checkItem.group_ids.push(group.check_item_list_id);
                updateSummaryDisplays();
            }
        }
    } else {
        const arr = selectedRelations[type].ids;
        if (checked && !arr.includes(id)) {
            arr.push(id);
            if (type === 'snapshot') {
                autoFillFromSnapshot(id);
            }
        }
        else if (!checked) {
            const i = arr.indexOf(id);
            if (i > -1) arr.splice(i, 1);
        }
    }
    
    document.getElementById('selectedCount').innerText = `已选 ${selectedRelations[type].ids.length} 项 / ${selectedRelations[type].group_ids.length} 组`;
    renderAssetTree(); 
}

async function autoFillFromSnapshot(snapshotId) {
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/snapshots/instances?snapshot_id=${snapshotId}`, { headers: window.shared.getHeaders() });
        const instances = await res.json();
        let updated = false;
        
        instances.forEach(inst => {
            if (inst.communication_id && !selectedRelations.communication.ids.includes(inst.communication_id)) {
                selectedRelations.communication.ids.push(inst.communication_id);
                updated = true;
            }
            if (inst.check_item_list_id && !selectedRelations.checkItem.group_ids.includes(inst.check_item_list_id)) {
                selectedRelations.checkItem.group_ids.push(inst.check_item_list_id);
                updated = true;
            }
        });
        
        const snap = dicts.snapshot.items[snapshotId];
        if (snap && snap.group_id) {
            const group = dicts.snapshot.groups[snap.group_id];
            if (group && group.check_item_list_id && !selectedRelations.checkItem.group_ids.includes(group.check_item_list_id)) {
                selectedRelations.checkItem.group_ids.push(group.check_item_list_id);
                updated = true;
            }
        }

        if (updated) {
            updateSummaryDisplays();
            console.log("已自动通过快照填充关联的通信机和检查项列表");
        }
    } catch (e) { console.error("自动填充资产失败:", e); }
}

function cascadeSelect(type, groupId, checked) {
    const d = dicts[type];
    const rels = selectedRelations[type];
    
    // 1. 处理本组
    if (checked && !rels.group_ids.includes(groupId)) rels.group_ids.push(groupId);
    else if (!checked) {
        const i = rels.group_ids.indexOf(groupId);
        if (i > -1) rels.group_ids.splice(i, 1);
    }
    
    // 2. 找到所有直接属于该组的项
    Object.values(d.items).forEach(item => {
        const gid = item.group_id || item.list_id;
        if (gid === groupId) {
            if (checked && !rels.ids.includes(item.id)) rels.ids.push(item.id);
            else if (!checked) {
                const i = rels.ids.indexOf(item.id);
                if (i > -1) rels.ids.splice(i, 1);
            }
        }
    });
    
    // 3. 找到所有下属子组并递归
    Object.values(d.groups).forEach(g => {
        if (g.parent_id === groupId) {
            cascadeSelect(type, g.id, checked);
        }
    });
}

async function executeCurrentRule() {
    if (!currentRuleId) return;
    try {
        const response = await fetch(`${window.shared.API_BASE}/api/v1/check-rules/${currentRuleId}/execute`, { method: 'POST', headers: window.shared.getHeaders() });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || '执行请求被拒绝');
        }
        alert('任务已派发！即将在报表中心查看');
        
        // 跳转到 reports tab
        const reportTab = document.querySelector('.nav-tab[data-tab="reports"]');
        if (reportTab) {
            reportTab.click();
        }
        if (window.reports && window.reports.loadReports) {
            window.reports.loadReports();
        }
    } catch (e) { alert('启动失败: ' + e.message); }
}

// ---------------------- 初始化 ----------------------

function initChecksTab() { 
    loadCheckRules(); 
}

window.checks = {
    initChecksTab, loadCheckRules, createNewRule, selectRule, saveCurrentRule, toggleCurrentRule, deleteCurrentRule, executeCurrentRule, 
    filterRules, openAssetDrawer, closeAssetDrawer, filterAssetTree, renderAssetTree, handleTreeCheck, 
    cancelCreateRule, handleCronTemplateChange, autoFillFromSnapshot
};



// Legacy Stubs
function openCheckModal() { alert('该功能已迁移至规则列表'); }
function startCheck() { alert('请选中规则后执行'); }
function closeCheckModal() {}
function loadCheckResults() {}
