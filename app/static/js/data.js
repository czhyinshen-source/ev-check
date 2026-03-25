// 数据管理模块

// 刷新所有数据
async function refreshData() {
    try {
        await Promise.all([
            loadCommunications(),
            loadCheckItemLists(),
            loadCheckItems(),
            loadSnapshots(),
            loadSnapshotGroups(),
            loadCheckResults(),
            loadReports(),
            loadStats(),
            loadGroups()
        ]);
    } catch (error) {
        console.error('刷新数据失败:', error);
    }
}

// 加载统计数据
async function loadStats() {
    try {
        const [commRes, itemRes, snapRes] = await Promise.all([
            fetch(`${API_BASE}/api/v1/communications`, { headers: getHeaders() }),
            fetch(`${API_BASE}/api/v1/check-items`, { headers: getHeaders() }),
            fetch(`${API_BASE}/api/v1/snapshots`, { headers: getHeaders() })
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

// 导出模块
window.data = {
    refreshData,
    loadStats
};