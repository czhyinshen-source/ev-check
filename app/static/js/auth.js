// 认证相关功能
window.token = window.token || localStorage.getItem('token');

// 更新页面头部用户显示
function updateUserDisplay() {
    const username = localStorage.getItem('username');
    const currentUserEl = document.getElementById('currentUser');
    if (currentUserEl) {
        currentUserEl.textContent = '用户: ' + (username || '未知');
    }
}

// 初始化用户显示（供 dashboard.html 调用）
function initUserDisplay() {
    updateUserDisplay();
    // 监听 localStorage 变化
    window.addEventListener('storage', function(e) {
        if (e.key === 'username' || e.key === 'token') {
            updateUserDisplay();
        }
    });
}

// 检查登录状态
function checkLogin() {
    if (!window.token) {
        window.location.href = '/login';
        return false;
    }
    updateUserDisplay();
    return true;
}

// 登出功能（同时更新 window.shared.logout 引用）
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.token = null;
    window.location.href = '/login';
}

// 导出模块
window.auth = {
    checkLogin,
    logout,
    initUserDisplay,
    updateUserDisplay
};
