// 通用功能模块

// 关闭模态框
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// 标签页切换
function setupTabs() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
}

// 初始化页面
function initPage() {
    // 检查登录状态
    if (window.auth && window.auth.checkLogin) {
        window.auth.checkLogin();
    }
    
    // 设置标签页
    setupTabs();
    
    // 加载初始数据
    if (window.data && window.data.refreshData) {
        window.data.refreshData();
    }
}

// 导出模块
window.common = {
    closeModal,
    setupTabs,
    initPage
};