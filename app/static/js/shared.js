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

// 导出模块
window.shared = {
    API_BASE,
    getHeaders,
    logout,
    closeModal,
    showError,
    showSuccess,
    fetchJSON,
    formatDate
};
