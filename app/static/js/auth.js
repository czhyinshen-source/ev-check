// 认证相关功能
window.token = window.token || localStorage.getItem('token');

// 检查登录状态
function checkLogin() {
    if (!window.token) {
        window.location.href = '/login.html';
        return false;
    }
    document.getElementById('currentUser').textContent = '用户: ' + (localStorage.getItem('username') || '未知');
    return true;
}

// 登出功能
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.token = null;
    window.location.href = '/login.html';
}

// 获取请求头
function getHeaders() {
    return { 'Authorization': 'Bearer ' + window.token, 'Content-Type': 'application/json' };
}

// 导出模块
window.auth = {
    checkLogin,
    logout,
    getHeaders
};