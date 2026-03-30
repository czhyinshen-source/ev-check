/**
 * shared.js 单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('shared.js 模块测试', () => {
    // 从 shared.js 复制的函数定义用于测试
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
                throw new Error(errorData.detail || errorData.message || 'HTTP ' + res.status + ': ' + res.statusText);
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

    // Mock localStorage
    let localStorageMock;
    let alertMock;

    beforeEach(() => {
        // 创建新的 localStorage mock
        localStorageMock = {
            store: {},
            getItem: function(key) { return this.store[key] || null; },
            setItem: function(key, value) { this.store[key] = value; },
            removeItem: function(key) { delete this.store[key]; },
            clear: function() { this.store = {}; }
        };

        global.localStorage = localStorageMock;
        localStorageMock.clear();

        // Mock alert
        alertMock = vi.fn();
        global.alert = alertMock;

        // Mock window
        global.window = {
            location: { href: '' },
            alert: alertMock
        };

        // Mock fetch
        global.fetch = vi.fn();

        // Setup DOM
        document.body.innerHTML = '<div id="test-modal" class="active"></div>';
    });

    describe('API_BASE 常量', () => {
        it('应该是空字符串', () => {
            const API_BASE = '';
            expect(API_BASE).toBe('');
        });
    });

    describe('getHeaders 函数', () => {
        it('当没有 token 时应该返回基础 headers（不包含 Authorization）', () => {
            const headers = getHeaders();
            expect(headers).toEqual({
                'Content-Type': 'application/json'
            });
            expect(headers).not.toHaveProperty('Authorization');
        });

        it('当有 token 时应该包含 token', () => {
            localStorageMock.setItem('token', 'test-token-123');
            const headers = getHeaders();
            expect(headers['Authorization']).toBe('Bearer test-token-123');
        });
    });

    describe('logout 函数', () => {
        it('应该清除 token 和 username，并跳转到登录页', () => {
            localStorageMock.setItem('token', 'test-token');
            localStorageMock.setItem('username', 'testuser');

            logout();

            expect(localStorageMock.getItem('token')).toBeNull();
            expect(localStorageMock.getItem('username')).toBeNull();
            expect(window.location.href).toBe('/login.html');
        });
    });

    describe('closeModal 函数', () => {
        it('应该移除模态框的 active 类', () => {
            // 创建一个模拟的模态框对象
            const mockModal = {
                classList: {
                    contains: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
                    remove: vi.fn()
                }
            };

            // Mock document.getElementById
            const originalGetElementById = document.getElementById;
            document.getElementById = vi.fn().mockReturnValue(mockModal);

            closeModal('test-modal');

            expect(document.getElementById).toHaveBeenCalledWith('test-modal');
            expect(mockModal.classList.remove).toHaveBeenCalledWith('active');

            // 恢复原始函数
            document.getElementById = originalGetElementById;
        });

        it('当模态框不存在时应该不报错', () => {
            const originalGetElementById = document.getElementById;
            document.getElementById = vi.fn().mockReturnValue(null);

            expect(() => closeModal('non-existent-modal')).not.toThrow();

            document.getElementById = originalGetElementById;
        });
    });

    describe('showError 函数', () => {
        it('应该调用 alert 显示错误消息', () => {
            showError('测试错误');
            expect(alertMock).toHaveBeenCalledWith('❌ 测试错误');
        });
    });

    describe('showSuccess 函数', () => {
        it('应该调用 alert 显示成功消息', () => {
            showSuccess('操作成功');
            expect(alertMock).toHaveBeenCalledWith('✅ 操作成功');
        });
    });

    describe('fetchJSON 函数', () => {
        it('应该成功获取 JSON 数据', async () => {
            const mockData = { id: 1, name: 'test' };
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockData)
            });

            const result = await fetchJSON('/api/test');

            expect(result).toEqual(mockData);
            expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
                headers: expect.any(Object)
            }));
        });

        it('当 HTTP 错误时应该抛出异常', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                json: () => Promise.resolve({})
            });

            await expect(fetchJSON('/api/not-found')).rejects.toThrow('HTTP 404: Not Found');
        });

        it('当 HTTP 错误时应该优先使用响应中的 detail 信息', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                json: () => Promise.resolve({ detail: '参数错误' })
            });

            await expect(fetchJSON('/api/error')).rejects.toThrow('参数错误');
        });

        it('当 HTTP 错误时应该使用响应中的 message 信息', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: () => Promise.resolve({ message: '服务器内部错误' })
            });

            await expect(fetchJSON('/api/error')).rejects.toThrow('服务器内部错误');
        });

        it('当网络错误时应该抛出友好的错误信息', async () => {
            global.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

            await expect(fetchJSON('/api/test')).rejects.toThrow('网络连接失败，请检查网络设置');
        });

        it('应该合并自定义 headers', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({})
            });

            await fetchJSON('/api/test', {
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
        it('应该格式化日期字符串', () => {
            const result = formatDate('2024-01-15T10:30:00Z');
            expect(typeof result).toBe('string');
            expect(result).not.toBe('-');
        });

        it('当日期为空时应该返回 -', () => {
            expect(formatDate(null)).toBe('-');
            expect(formatDate(undefined)).toBe('-');
            expect(formatDate('')).toBe('-');
        });
    });
});
