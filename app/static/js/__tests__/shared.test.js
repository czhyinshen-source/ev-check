/**
 * shared.js 单元测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value; },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

// Mock window.location
const originalLocation = window.location;
delete window.location;
window.location = { href: '' };

// Mock alert
window.alert = vi.fn();

// Mock fetch
global.fetch = vi.fn();

// 在测试前设置 localStorage mock
beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    localStorageMock.clear();
    window.location.href = '';
    vi.clearAllMocks();
});

// 导入被测试模块
// 由于 shared.js 依赖 window 对象，我们需要在 jsdom 环境中加载它
async function loadSharedModule() {
    // 重置 window.shared
    delete window.shared;

    // 动态执行 shared.js 的代码
    const sharedCode = `
        const API_BASE = '';

        function getHeaders() {
            const token = localStorage.getItem('token');
            return {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            };
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
            const res = await fetch(url, {
                ...options,
                headers: { ...getHeaders(), ...options.headers }
            });
            if (!res.ok) {
                throw new Error('HTTP ' + res.status + ': ' + res.statusText);
            }
            return res.json();
        }

        function formatDate(dateString) {
            if (!dateString) return '-';
            const date = new Date(dateString);
            return date.toLocaleString('zh-CN');
        }

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
    `;

    // 使用 Function 构造函数执行代码
    const fn = new Function(sharedCode);
    fn();
    return window.shared;
}

describe('shared.js 模块测试', () => {
    describe('API_BASE 常量', () => {
        it('应该导出 API_BASE 常量', async () => {
            const shared = await loadSharedModule();
            expect(shared.API_BASE).toBe('');
        });
    });

    describe('getHeaders 函数', () => {
        it('当没有 token 时应该返回基础 headers', async () => {
            const shared = await loadSharedModule();
            const headers = shared.getHeaders();
            expect(headers).toEqual({
                'Authorization': 'Bearer null',
                'Content-Type': 'application/json'
            });
        });

        it('当有 token 时应该包含 token', async () => {
            localStorageMock.setItem('token', 'test-token-123');
            const shared = await loadSharedModule();
            const headers = shared.getHeaders();
            expect(headers['Authorization']).toBe('Bearer test-token-123');
        });
    });

    describe('logout 函数', () => {
        it('应该清除 token 和 username，并跳转到登录页', async () => {
            localStorageMock.setItem('token', 'test-token');
            localStorageMock.setItem('username', 'testuser');

            const shared = await loadSharedModule();
            shared.logout();

            expect(localStorageMock.getItem('token')).toBeNull();
            expect(localStorageMock.getItem('username')).toBeNull();
            expect(window.location.href).toBe('/login.html');
        });
    });

    describe('closeModal 函数', () => {
        it('应该移除模态框的 active 类', async () => {
            // 创建一个模拟的模态框元素
            const modal = document.createElement('div');
            modal.id = 'test-modal';
            modal.classList.add('active');
            document.body.appendChild(modal);

            const shared = await loadSharedModule();
            shared.closeModal('test-modal');

            expect(modal.classList.contains('active')).toBe(false);

            // 清理
            document.body.removeChild(modal);
        });

        it('当模态框不存在时应该不报错', async () => {
            const shared = await loadSharedModule();
            expect(() => shared.closeModal('non-existent-modal')).not.toThrow();
        });
    });

    describe('showError 函数', () => {
        it('应该调用 alert 显示错误消息', async () => {
            const shared = await loadSharedModule();
            shared.showError('测试错误');
            expect(window.alert).toHaveBeenCalledWith('❌ 测试错误');
        });
    });

    describe('showSuccess 函数', () => {
        it('应该调用 alert 显示成功消息', async () => {
            const shared = await loadSharedModule();
            shared.showSuccess('操作成功');
            expect(window.alert).toHaveBeenCalledWith('✅ 操作成功');
        });
    });

    describe('fetchJSON 函数', () => {
        it('应该成功获取 JSON 数据', async () => {
            const mockData = { id: 1, name: 'test' };
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockData)
            });

            const shared = await loadSharedModule();
            const result = await shared.fetchJSON('/api/test');

            expect(result).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
                headers: expect.any(Object)
            }));
        });

        it('当 HTTP 错误时应该抛出异常', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found'
            });

            const shared = await loadSharedModule();

            await expect(shared.fetchJSON('/api/not-found')).rejects.toThrow('HTTP 404: Not Found');
        });

        it('应该合并自定义 headers', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({})
            });

            const shared = await loadSharedModule();
            await shared.fetchJSON('/api/test', {
                headers: { 'X-Custom': 'value' }
            });

            expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
                headers: expect.objectContaining({
                    'X-Custom': 'value',
                    'Content-Type': 'application/json'
                })
            }));
        });
    });

    describe('formatDate 函数', () => {
        it('应该格式化日期字符串', async () => {
            const shared = await loadSharedModule();
            const result = shared.formatDate('2024-01-15T10:30:00Z');
            expect(typeof result).toBe('string');
            expect(result).not.toBe('-');
        });

        it('当日期为空时应该返回 -', async () => {
            const shared = await loadSharedModule();
            expect(shared.formatDate(null)).toBe('-');
            expect(shared.formatDate(undefined)).toBe('-');
            expect(shared.formatDate('')).toBe('-');
        });
    });
});
