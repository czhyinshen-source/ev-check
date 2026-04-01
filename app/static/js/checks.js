// 检查执行模块

let checkRules = [];
let currentRuleId = null;
let currentTaskIds = []; // 批量执行任务IDs
let progressPollInterval = null;

// 字典用于显示名称
let dicts = {
    communication: { items: {}, groups: {} },
    checkItem: { items: {}, groups: {} },
    snapshot: { items: {}, groups: {} }
};

// 当前编辑窗体选中的关联状体
let selectedRelations = {
    communication: { ids: [], group_ids: [] },
    checkItem: { ids: [], group_ids: [] },
    snapshot: { ids: [], group_ids: [] }
};

let currentModalType = null; // 'communication', 'checkItem', 'snapshot'
let currentModalTab = 'individual'; // 'individual' or 'group'

// 聚合数据加载
async function loadDictionaries() {
    try {
        const headers = window.shared.getHeaders();
        const base = window.shared.API_BASE + '/api/v1';
        
        const [
            comms, commGroups, 
            citems, clists, 
            snaps, snapGroups
        ] = await Promise.all([
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
    } catch (e) {
        console.error("Failed to load dictionaries", e);
    }
}

// ---------------------- 规则列表管理 ----------------------

async function loadCheckRules() {
    await loadDictionaries(); // 确保字典加载
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/check-rules`, { headers: window.shared.getHeaders() });
        checkRules = await res.json();
        renderRuleTree();
        
        if (currentRuleId) {
            selectRule(currentRuleId);
        }
    } catch (e) { console.error('加载检查规则失败:', e); }
}

function renderRuleTree() {
    const tree = document.getElementById('ruleTree');
    if (!checkRules.length) {
        tree.innerHTML = '<li style="padding:15px;color:#999;text-align:center;">暂无规则</li>';
        return;
    }
    
    tree.innerHTML = checkRules.map(rule => `
        <li>
            <div class="group-item ${currentRuleId === rule.id ? 'active' : ''}" onclick="selectRule(${rule.id})">
                <span class="icon">${rule.is_active ? '🟢' : '⚪'}</span>
                <span>${rule.name}</span>
            </div>
        </li>
    `).join('');
}

function createNewRule() {
    currentRuleId = null;
    document.getElementById('ruleForm').reset();
    document.getElementById('ruleIsActive').checked = true;
    document.getElementById('ruleAllowManual').checked = true;
    
    selectedRelations = {
        communication: { ids: [], group_ids: [] },
        checkItem: { ids: [], group_ids: [] },
        snapshot: { ids: [], group_ids: [] }
    };
    
    renderRelationsPills();
    
    document.getElementById('ruleDetailSection').style.display = 'block';
    document.getElementById('ruleEmptyState').style.display = 'none';
    document.getElementById('ruleDetailTitle').innerText = '新建规则';
    document.getElementById('executeRuleBtn').style.display = 'none';
    document.getElementById('toggleRuleBtn').style.display = 'none';
    
    renderRuleTree(); // 取消高亮
}

function selectRule(id) {
    currentRuleId = id;
    const rule = checkRules.find(r => r.id === id);
    if (!rule) return;
    
    document.getElementById('ruleDetailSection').style.display = 'block';
    document.getElementById('ruleEmptyState').style.display = 'none';
    document.getElementById('ruleDetailTitle').innerText = `规则: ${rule.name}`;
    document.getElementById('executeRuleBtn').style.display = rule.allow_manual_execution ? 'inline-block' : 'none';
    
    const toggleBtn = document.getElementById('toggleRuleBtn');
    toggleBtn.style.display = 'inline-block';
    toggleBtn.innerText = rule.is_active ? '暂停规则' : '启用规则';
    toggleBtn.className = rule.is_active ? 'btn btn-warning' : 'btn btn-success';

    // 填充表单
    document.getElementById('ruleName').value = rule.name || '';
    document.getElementById('ruleCron').value = rule.cron_expression || '';
    document.getElementById('ruleDescription').value = rule.description || '';
    document.getElementById('ruleIsActive').checked = rule.is_active;
    document.getElementById('ruleAllowManual').checked = rule.allow_manual_execution;
    
    // 初始化选区状态
    selectedRelations = {
        communication: { ids: [...(rule.communication_ids||[])], group_ids: [...(rule.communication_group_ids||[])] },
        checkItem: { ids: [...(rule.check_item_ids||[])], group_ids: [...(rule.check_item_list_ids||[])] },
        snapshot: { ids: [...(rule.snapshot_ids||[])], group_ids: [...(rule.snapshot_group_ids||[])] }
    };
    
    renderRelationsPills();
    renderRuleTree();
}

function renderRelationsPills() {
    const renderPill = (type, isGroup, id) => {
        let dict = isGroup ? dicts[type].groups : dicts[type].items;
        let item = dict[id];
        let name = item ? (item.name || item.ip_address) : `ID:${id}`;
        let prefix = isGroup ? '📁 ' : '📄 ';
        return `<div class="pill">${prefix}${name} <span style="cursor:pointer;margin-left:5px" onclick="removeRelationPill('${type}', ${isGroup}, ${id})">×</span></div>`;
    };

    const containerMap = {
        communication: 'ruleCommPills',
        checkItem: 'ruleCheckItemPills',
        snapshot: 'ruleSnapshotPills'
    };

    Object.keys(selectedRelations).forEach(type => {
        let html = '';
        selectedRelations[type].ids.forEach(id => html += renderPill(type, false, id));
        selectedRelations[type].group_ids.forEach(id => html += renderPill(type, true, id));
        
        let container = document.getElementById(containerMap[type]);
        if (!html) {
            container.innerHTML = '<p class="text-muted">未选择</p>';
        } else {
            container.innerHTML = html;
        }
    });
}

function removeRelationPill(type, isGroup, id) {
    let arr = isGroup ? selectedRelations[type].group_ids : selectedRelations[type].ids;
    let idx = arr.indexOf(id);
    if (idx > -1) {
        arr.splice(idx, 1);
        renderRelationsPills();
    }
}

async function saveCurrentRule() {
    const payload = {
        name: document.getElementById('ruleName').value,
        description: document.getElementById('ruleDescription').value,
        cron_expression: document.getElementById('ruleCron').value || null,
        is_active: document.getElementById('ruleIsActive').checked,
        allow_manual_execution: document.getElementById('ruleAllowManual').checked,
        
        communication_ids: selectedRelations.communication.ids,
        communication_group_ids: selectedRelations.communication.group_ids,
        check_item_ids: selectedRelations.checkItem.ids,
        check_item_list_ids: selectedRelations.checkItem.group_ids,
        snapshot_ids: selectedRelations.snapshot.ids,
        snapshot_group_ids: selectedRelations.snapshot.group_ids,
        time_window_start: null,
        time_window_end: null,
        time_window_weekdays: null
    };

    if (!payload.name) return alert('请输入规则名称');

    try {
        let url = `${window.shared.API_BASE}/api/v1/check-rules`;
        let method = 'POST';
        if (currentRuleId) {
            url += `/${currentRuleId}`;
            method = 'PUT';
        }

        const res = await fetch(url, {
            method,
            headers: { ...window.shared.getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error((await res.json()).detail || 'Failed');
        alert(currentRuleId ? '规则已更新!' : '规则已创建!');
        
        const created = await res.json();
        currentRuleId = created.id;
        loadCheckRules();
    } catch (e) {
        alert('保存失败: ' + e.message);
    }
}

async function toggleCurrentRule() {
    if (!currentRuleId) return;
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/check-rules/${currentRuleId}/toggle`, {
            method: 'PATCH',
            headers: window.shared.getHeaders()
        });
        if (!res.ok) throw new Error((await res.json()).detail);
        loadCheckRules();
    } catch (e) {
        alert('状态切换失败: ' + e.message);
    }
}

async function deleteCurrentRule() {
    if (!currentRuleId) return;
    if (!confirm("确认删除此规则吗？将同时取消相关的后台调度！")) return;
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/check-rules/${currentRuleId}`, {
            method: 'DELETE',
            headers: window.shared.getHeaders()
        });
        if (!res.ok) throw new Error((await res.json()).detail);
        
        currentRuleId = null;
        document.getElementById('ruleDetailSection').style.display = 'none';
        document.getElementById('ruleEmptyState').style.display = 'block';
        loadCheckRules();
    } catch (e) {
        alert('删除失败: ' + e.message);
    }
}

// ---------------------- 选取关系 Multi-Select Modal ----------------------

function openMultiSelectModal(type) {
    currentModalType = type;
    const titleMap = {
        communication: '选择目标通信机',
        checkItem: '选择检查项',
        snapshot: '选择基准快照'
    };
    document.getElementById('multiSelectTitle').innerText = titleMap[type] || '选择目标';
    document.getElementById('multiSelectSearch').value = '';
    switchMultiSelectTab('individual'); // 默认显示独立列表
    
    // 打开
    document.getElementById('multiSelectModal').classList.add('active');
}

function closeMultiSelectModal() {
    document.getElementById('multiSelectModal').classList.remove('active');
}

function switchMultiSelectTab(tab) {
    currentModalTab = tab;
    // 切换按钮高亮
    document.getElementById('tabIndividualBtn').className = tab === 'individual' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
    document.getElementById('tabGroupBtn').className = tab === 'group' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
    
    // 切换列表可见性
    document.getElementById('multiSelectIndividualList').style.display = tab === 'individual' ? 'flex' : 'none';
    document.getElementById('multiSelectGroupList').style.display = tab === 'group' ? 'flex' : 'none';
    
    renderMultiSelectItems();
}

function filterMultiSelect() {
    renderMultiSelectItems();
}

function renderMultiSelectItems() {
    const listId = currentModalTab === 'individual' ? 'multiSelectIndividualList' : 'multiSelectGroupList';
    const container = document.getElementById(listId);
    const kw = document.getElementById('multiSelectSearch').value.toLowerCase();
    
    let dictObj = currentModalTab === 'individual' ? dicts[currentModalType].items : dicts[currentModalType].groups;
    let selectedArr = currentModalTab === 'individual' ? selectedRelations[currentModalType].ids : selectedRelations[currentModalType].group_ids;
    
    let html = '';
    let count = 0;
    
    const items = Object.values(dictObj);
    items.forEach(item => {
        let txt = item.name || item.ip_address || ('ID ' + item.id);
        if (kw && txt.toLowerCase().indexOf(kw) === -1) return;
        
        let checked = selectedArr.includes(item.id) ? 'checked' : '';
        html += `
            <label class="select-item" style="display:flex; align-items:center; gap:10px; padding: 10px; background: #fff; border: 1px solid #eee; border-radius: 4px; cursor: pointer;">
                <input type="checkbox" value="${item.id}" class="ms-checkbox" ${checked}>
                <span>${txt}</span>
            </label>
        `;
        count++;
    });
    
    if (count === 0) {
        html = '<p class="text-muted" style="text-align:center; padding: 20px;">没有找到相符的数据</p>';
    }
    
    container.innerHTML = html;
    updateMultiSelectCount();
    
    // 监听打钩实时的数字变化（不写死事件绑定，而是在点击时更新状态）
    const checkboxes = container.querySelectorAll('.ms-checkbox');
    checkboxes.forEach(cb => cb.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (e.target.checked) {
            if (!selectedArr.includes(val)) selectedArr.push(val);
        } else {
            selectedArr = selectedArr.filter(i => i !== val);
        }
        
        // 存回引用
        if (currentModalTab === 'individual') {
            selectedRelations[currentModalType].ids = selectedArr;
        } else {
            selectedRelations[currentModalType].group_ids = selectedArr;
        }
        
        updateMultiSelectCount();
    }));
}

function updateMultiSelectCount() {
    let idsCount = selectedRelations[currentModalType].ids.length;
    let grpsCount = selectedRelations[currentModalType].group_ids.length;
    document.getElementById('multiSelectCount').innerText = `已选择: ${idsCount} 项, ${grpsCount} 组`;
}

function confirmMultiSelect() {
    renderRelationsPills();
    closeMultiSelectModal();
}

// ---------------------- 规则执行及进度监听 ----------------------

async function executeCurrentRule() {
    if (!currentRuleId) return;
    if (!confirm("确认马上在后台执行该规则？")) return;
    
    try {
        const res = await fetch(`${window.shared.API_BASE}/api/v1/check-rules/${currentRuleId}/execute`, {
            method: 'POST',
            headers: window.shared.getHeaders()
        });
        
        if (!res.ok) throw new Error((await res.json()).detail || 'Execution Failed');
        
        const data = await res.json();
        alert('规则任务已投入后台执行，Celery Task ID: ' + data.task_id);
        
        // 我们尝试拉取最新的CheckResult从而跟踪进度
        setTimeout(loadCurrentMultiTasksProgress, 1000); // 1s 后探测
    } catch (e) {
        alert('执行启动失败: ' + e.message);
    }
}

// 修改自原有的进度轮询机制，支持展示规则页最新的批量执行概况
async function loadCurrentMultiTasksProgress() {
    try {
        // 由于 execute 的任务可能产生多条 records，界面可以调用 /api/v1/checks 并取最新记录展示
        const res = await fetch(`${window.shared.API_BASE}/api/v1/checks?limit=10`, { headers: window.shared.getHeaders() });
        const list = await res.json();
        
        // 筛选出属于 currentRuleId 的进行任务
        const activeTasks = list.filter(t => t.rule_id === currentRuleId && t.status === 'running');
        
        const progDiv = document.getElementById('ruleExecuteProgress');
        
        if (activeTasks.length > 0) {
            progDiv.style.display = 'block';
            
            // 取一个综合进度？或者取第一条展示
            const topTask = activeTasks[0];
            document.getElementById('ruleProgressText').innerText = `${topTask.progress}%`;
            document.getElementById('ruleProgressBarFill').style.width = `${topTask.progress}%`;
            document.getElementById('ruleProgressMessage').innerText = `正在检查通信机: ${topTask.communication_id || ''}...`;
            
            if (!progressPollInterval) {
                progressPollInterval = setInterval(loadCurrentMultiTasksProgress, 2000);
            }
        } else {
            // 已没有运行中任务了，如果面板原来是block说明刚跑完
            if (progDiv.style.display === 'block') {
                clearInterval(progressPollInterval);
                progressPollInterval = null;
                document.getElementById('ruleProgressText').innerText = `100%`;
                document.getElementById('ruleProgressBarFill').style.width = `100%`;
                document.getElementById('ruleProgressBarFill').style.background = `#52c41a`;
                document.getElementById('ruleProgressMessage').innerText = `执行完成`;
                setTimeout(() => progDiv.style.display = 'none', 3000);
            }
        }
    } catch (e) {
        console.error("加载执行进度失败", e);
    }
}

// 在页面加载/切换到检查Tab时被外部调用
function initChecksTab() {
    loadCheckRules();
}

// ---------------------- 保留原方法以便兼容 ----------------------
// 原 Dashboard html 还有对 `#checks` tabular 的一些遗留代码依赖，由于已彻底替换布局，原有的 `openCheckModal`, `startCheck` 均已被重构覆盖。不过如果是从别处触发可做兜底
function openCheckModal() { alert('该功能已迁移至左侧规则列表管理'); }
function startCheck() { alert('请通过选中规则后点击执行'); }
function closeCheckModal() { /**/ }
function loadCheckResults() { /**/ }


// 导出接口
window.checks = {
    initChecksTab,
    loadCheckRules,
    createNewRule,
    selectRule,
    saveCurrentRule,
    toggleCurrentRule,
    deleteCurrentRule,
    executeCurrentRule,
    openMultiSelectModal,
    closeMultiSelectModal,
    switchMultiSelectTab,
    filterMultiSelect,
    confirmMultiSelect,
    // 其他不破坏原有报错的空防守方法
    openCheckModal,
    startCheck,
    closeCheckModal,
    loadCheckResults
};
