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

let currentExecutionTargets = [];
let targetEditIndex = -1; // -1 表示没在编辑

// 当前选中关联状态（Drawer 临时状态，用于适配树形选择器）
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
    
    currentExecutionTargets = rule.execution_targets ? JSON.parse(JSON.stringify(rule.execution_targets)) : [];
    renderExecutionTargets();
    renderRuleTree();
    
    // 切换规则时立即获取当前正在运行的任务和历史
    if (progressPollInterval) { clearInterval(progressPollInterval); progressPollInterval = null; }
    loadCurrentMultiTasksProgress();
    loadExecutionHistory();
}

function renderExecutionTargets() {
    const container = document.getElementById('executionTargetsContainer');
    if (!container) return;
    
    if (currentExecutionTargets.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 20px;">点击右上角「+ 添加对比基准行」配置多组差异化执行策略</div>';
        return;
    }

    let html = '';
    currentExecutionTargets.forEach((target, idx) => {
        let snapText = target.snapshot_id ? (dicts.snapshot.items[target.snapshot_id]?.name || '未知快照') : '未指定基准 (实时比较)';
        
        let commsIds = target.communications?.ids || [];
        let commsText = commsIds.length ? `${commsIds.length} 台通信机` : '未配置';
        
        let citemsIds = target.check_items?.ids || [];
        let citemsText = citemsIds.length ? `${citemsIds.length} 个检查项` : '未配置';
        
        html += `
        <div class="target-row" style="display: flex; gap: 15px; background: var(--surface-2); padding: 15px; border-radius: 8px; margin-bottom: 10px; align-items: center; border: 1px solid var(--border);">
            <div style="flex: 1;">
                <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">🎯 基准快照</div>
                <div style="font-weight: 500; cursor: pointer;" onclick="window.checks.openAssetDrawerForCheckRow('snapshot', ${idx})"><span style="margin-right:5px">📸</span>${snapText}</div>
            </div>
            <div style="flex: 1;">
                <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">💻 目标通信机集合</div>
                <div style="font-weight: 500; cursor: pointer;" onclick="window.checks.openAssetDrawerForCheckRow('communication', ${idx})"><span style="margin-right:5px">🖥️</span>${commsText}</div>
            </div>
            <div style="flex: 1;">
                <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">🔍 指定检查项集合</div>
                <div style="font-weight: 500; cursor: pointer;" onclick="window.checks.openAssetDrawerForCheckRow('checkItem', ${idx})"><span style="margin-right:5px">📋</span>${citemsText}</div>
            </div>
            <div class="row-actions" style="display: flex; gap: 8px;">
                <button type="button" class="btn-icon" onclick="window.checks.removeExecutionTarget(${idx})" title="删除此行" style="color: var(--danger); font-size: 16px;">🗑️</button>
            </div>
        </div>
        `;
    });
    
    container.innerHTML = html;
}

function addExecutionTarget() {
    currentExecutionTargets.push({
        snapshot_id: null,
        communications: { ids: [], group_ids: [] },
        check_items: { ids: [], list_ids: [] }
    });
    renderExecutionTargets();
}

function removeExecutionTarget(idx) {
    if (confirm('确认删除该执行策略行吗？')) {
        currentExecutionTargets.splice(idx, 1);
        renderExecutionTargets();
    }
}

// ---------------------- 规则 CRUD ----------------------

function createNewRule() {
    currentRuleId = null;
    const form = document.getElementById('ruleForm');
    if (form) form.reset();
    currentExecutionTargets = [];
    renderExecutionTargets();
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
        execution_targets: currentExecutionTargets
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

// --- 通用资产选择器核心逻辑 ---
let assetSelectorCallback = null;

function openAssetDrawer(type, initialSelection, onConfirm, titlePrefix = "") {
    currentModalType = type;
    assetSelectorCallback = onConfirm;
    
    // 初始化选中状态
    selectedRelations = JSON.parse(JSON.stringify(initialSelection || {
        communication: { ids: [], group_ids: [] },
        checkItem: { ids: [], group_ids: [] },
        snapshot: { ids: [], group_ids: [] }
    }));
    
    const drawer = document.getElementById('assetDrawer');
    const titleMap = { communication: '选择通信机', checkItem: '选择检查项', snapshot: '选择基准快照' };
    document.getElementById('drawerTitle').innerText = (titlePrefix ? `${titlePrefix} - ` : "") + titleMap[type];
    document.getElementById('assetSearchInput').value = '';
    document.getElementById('drawerSelectedCount').innerText = `已选 ${selectedRelations[type].ids.length} 项`;
    drawer.classList.add('active');
    renderAssetTree();
}

function closeAssetDrawer() {
    if (assetSelectorCallback) {
        assetSelectorCallback(selectedRelations);
    }
    document.getElementById('assetDrawer').classList.remove('active');
    assetSelectorCallback = null;
}

// --- 适配检查规则行的特化逻辑 ---
function openAssetDrawerForCheckRow(type, index) {
    const target = currentExecutionTargets[index] || {};
    const initial = {
        communication: { ids: [...(target.communications?.ids || [])], group_ids: [...(target.communications?.group_ids || [])] },
        checkItem: { ids: [...(target.check_items?.ids || [])], group_ids: [...(target.check_items?.list_ids || [])] },
        snapshot: { ids: target.snapshot_id ? [target.snapshot_id] : [], group_ids: [] }
    };
    
    openAssetDrawer(type, initial, (selected) => {
        let t = currentExecutionTargets[index];
        if (!t) return;
        t.communications = { ids: [...selected.communication.ids], group_ids: [...selected.communication.group_ids] };
        t.check_items = { ids: [...selected.checkItem.ids], list_ids: [...selected.checkItem.group_ids] };
        t.snapshot_id = selected.snapshot.ids.length > 0 ? selected.snapshot.ids[0] : null;
        renderExecutionTargets();
    }, `行 ${index + 1}`);
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

function hasMatch(node, kw) {
    if (!kw) return true;
    const name = (node.name || node.ip_address || node.id || "").toString().toLowerCase();
    if (name.includes(kw)) return true;
    if (node.isGroup) {
        return (node.children && node.children.some(c => hasMatch(c, kw))) || 
               (node.items && node.items.some(i => hasMatch(i, kw)));
    }
    return false;
}

function renderNodeList(nodes, level, kw) {
    let html = '';
    nodes.forEach(node => {
        const type = currentModalType;
        const isSelected = node.isGroup ? selectedRelations[type].group_ids.includes(node.id) : selectedRelations[type].ids.includes(node.id);
        const displayName = node.name || node.ip_address || `ID:${node.id}`;
        
        // 搜索逻辑改进：如果自己匹配，或者任何子孙节点匹配，则渲染
        if (kw && !hasMatch(node, kw)) return;

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

async function handleTreeCheck(event, isGroup, id) {
    const checked = event.target.checked;
    const type = currentModalType;
    
    if (isGroup) {
        cascadeSelect(type, id, checked);
        if (checked && type === 'snapshot') {
            const group = dicts.snapshot.groups[id];
            if (group && group.check_item_list_id) {
                cascadeSelect('checkItem', group.check_item_list_id, true);
            }
        }
    } else {
        const arr = selectedRelations[type].ids;
        if (checked && !arr.includes(id)) {
            arr.push(id);
            if (type === 'snapshot') {
                await autoFillFromSnapshot(id);
            }
        }
        else if (!checked) {
            const i = arr.indexOf(id);
            if (i > -1) arr.splice(i, 1);
        }
    }
    
    document.getElementById('drawerSelectedCount').innerText = `已选 ${selectedRelations[type].ids.length} 项`;
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
            if (inst.check_item_list_id) {
                cascadeSelect('checkItem', inst.check_item_list_id, true);
                updated = true;
            }
        });
        
        const snap = dicts.snapshot.items[snapshotId];
        if (snap && snap.group_id) {
            const group = dicts.snapshot.groups[snap.group_id];
            if (group && group.check_item_list_id) {
                cascadeSelect('checkItem', group.check_item_list_id, true);
                updated = true;
            }
        }

        if (updated) {
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

// ---------------------- 任务监控与控制台 ----------------------
function switchConsoleTab(btn) {
    const parent = btn.parentElement;
    parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const viewId = btn.dataset.view;
    const content = parent.nextElementSibling.parentElement;
    content.querySelectorAll('.tab-view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(viewId).classList.add('active');
}

async function loadCurrentMultiTasksProgress() {
    if (!currentRuleId) return;
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/reports?rule_id=${currentRuleId}&limit=50`, { headers: window.shared.getHeaders() });
        const reports = await res.json();
        
        // 过滤出当前规则且正在运行的任务
        const runningReports = reports.filter(r => r.status === 'running' || r.status === 'pending');
        
        const container = document.getElementById('currentTasksList');
        if (!container) return;

        if (runningReports.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding:40px 10px; opacity:0.5;">📡 等待任务下发...</div>';
            if (progressPollInterval) { clearInterval(progressPollInterval); progressPollInterval = null; }
            return;
        }

        // 渲染进度列表
        container.innerHTML = runningReports.map(r => {
            const progress = r.total_nodes > 0 ? Math.floor((r.completed_nodes / r.total_nodes) * 100) : 0;
            return `
                <div class="execution-progress" style="margin-bottom:15px; border-color:var(--accent);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:12px;">
                        <span style="color:var(--accent); font-weight:bold;">🚀 #${r.id} 正在执行</span>
                        <span>${r.completed_nodes} / ${r.total_nodes} 节点</span>
                    </div>
                    <div class="progress-bar" style="height:8px; background:rgba(255,255,255,0.05);">
                        <div class="progress-bar-fill" style="width:${progress}%; background:linear-gradient(90deg, var(--accent), #00d2ff);"></div>
                    </div>
                    <div style="display:flex; gap:10px; margin-top:10px;">
                        <button class="btn btn-outline btn-sm" style="flex:1; font-size:11px; padding:4px;" onclick="window.reports.viewReportDetail(${r.id})">实时详情</button>
                        <button class="btn btn-danger btn-sm" style="flex:1; font-size:11px; padding:4px;" onclick="window.reports.terminateReport(${r.id})">中止</button>
                    </div>
                </div>
            `;
        }).join('');

        // 启动轮询
        if (!progressPollInterval) {
            progressPollInterval = setInterval(loadCurrentMultiTasksProgress, 3000);
        }
    } catch (e) { console.error('加载任务进度失败:', e); }
}

async function loadExecutionHistory() {
    if (!currentRuleId) return;
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/reports?rule_id=${currentRuleId}&limit=50`, { headers: window.shared.getHeaders() });
        const reports = await res.json();
        
        // 过滤出当前规则的历史任务（排除正在运行的）
        const history = reports.filter(r => r.status !== 'running' && r.status !== 'pending').slice(0, 50);
        
        const container = document.getElementById('taskHistoryList');
        if (!container) return;

        if (history.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无历史记录</div>';
            return;
        }

        container.innerHTML = history.map(r => {
            const statusIcon = r.status === 'success' ? '✅' : (r.status === 'failed' ? '❌' : '⏹');
            const timeStr = r.start_time ? new Date(r.start_time).toLocaleString('zh-CN', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'}) : '-';
            return `
                <div class="history-item" onclick="window.reports.viewReportDetail(${r.id})" title="点击查看详情">
                    <span class="item-status">${statusIcon}</span>
                    <span class="item-id">#${r.id}</span>
                    <span class="item-msg">成功 ${r.success_checks} / 失败 ${r.failed_checks}</span>
                    <span class="item-time">${timeStr}</span>
                </div>
            `;
        }).join('');
    } catch (e) { console.error('加载执行历史失败:', e); }
}

// ---------------------- 初始化 ----------------------

function initChecksTab() { 
    loadCheckRules(); 
}

window.checks = {
    initChecksTab, loadCheckRules, createNewRule, selectRule, saveCurrentRule, toggleCurrentRule, deleteCurrentRule, executeCurrentRule, 
    filterRules, openAssetDrawer, openAssetDrawerForCheckRow, closeAssetDrawer, filterAssetTree, renderAssetTree, handleTreeCheck, 
    cancelCreateRule, handleCronTemplateChange, autoFillFromSnapshot, addExecutionTarget, removeExecutionTarget,
    loadCurrentMultiTasksProgress, loadExecutionHistory, switchConsoleTab,
    dicts, loadDictionaries
};



// Legacy Stubs
function openCheckModal() { alert('该功能已迁移至规则列表'); }
function startCheck() { alert('请选中规则后执行'); }
function closeCheckModal() {}
function loadCheckResults() {}
