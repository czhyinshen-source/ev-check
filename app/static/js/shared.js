// 公共工具模块
const API_BASE = '';

function getHeaders() {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    return headers;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/login.html';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function showError(message) {
    alert('❌ ' + message);
}

function showSuccess(message) {
    alert('✅ ' + message);
}

async function fetchJSON(url, options = {}) {
    try {
        const res = await fetch(url, {
            ...options,
            headers: { ...getHeaders(), ...options.headers }
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.message || `HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error('网络连接失败，请检查网络设置');
        }
        throw error;
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
}

function showToast(message, type = 'success') {
    // 简单的 Toast 实现，如果没有 UI 容器则回退到 alert
    const icon = type === 'success' ? '✅' : '❌';
    console.log(`${icon} ${message}`);
    
    // 创建或者获取 toast 容器
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed; top:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:10px;';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? '#10b981' : '#ef4444';
    toast.style.cssText = `background:${bgColor}; color:white; padding:12px 24px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.3); font-size:14px; animation: slideIn 0.3s ease-out;`;
    toast.innerHTML = `${icon} ${message}`;
    
    // 添加动画样式
    if (!document.getElementById('toast-style')) {
        const style = document.createElement('style');
        style.id = 'toast-style';
        style.innerHTML = `
            @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        `;
        document.head.appendChild(style);
    }
    
    container.appendChild(toast);
    
    // 3秒后移除
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease-in forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// 导出模块
window.shared = {
    API_BASE,
    getHeaders,
    logout,
    closeModal,
    showError,
    showSuccess,
    showToast,
    fetchJSON,
    formatDate
};
