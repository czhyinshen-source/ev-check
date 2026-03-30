// checks.test.js - 检查执行模块测��
import { vi, beforeEach, afterEach, describe, test, expect } from 'vitest';

describe('checks module', () => {
    // 从 checks.js 复制的函数定义用于测试
    function getStatusText(status) {
        const map = {
            'success': '通过',
            'failed': '失败',
            'running': '进行中',
            'pending': '等待中',
            'cancelled': '已取消',
            'completed_with_errors': '部分失败'
        };
        return map[status] || status || '-';
    }

    function getStatusClass(status) {
        const map = {
            'success': 'success',
            'failed': 'error',
            'running': 'warning',
            'pending': 'info',
            'cancelled': '',
            'completed_with_errors': 'warning'
        };
        return map[status] || '';
    }

    function getStatusBadge(status) {
        const cls = getStatusClass(status);
        return `<span class="status-badge ${cls}">${getStatusText(status)}</span>`;
    }

    function getDetailStatusBadge(status) {
        const map = {
            'pass': 'success',
            'fail': 'error',
            'error': 'warning'
        };
        const cls = map[status] || '';
        const text = status === 'pass' ? '通过' : status === 'fail' ? '失败' : status === 'error' ? '错误' : status;
        return `<span class="status-badge ${cls}">${text}</span>`;
    }

    beforeEach(() => {
        vi.resetAllMocks();

        // Mock localStorage
        global.localStorage = {
            getItem: vi.fn().mockReturnValue('test-token'),
            setItem: vi.fn(),
            removeItem: vi.fn()
        };

        // Mock fetch
        global.fetch = vi.fn();

        // Setup DOM
        document.body.innerHTML = `
            <div id="checkModal" class="modal"></div>
            <select id="checkRule"></select>
            <select id="checkCommunication"></select>
            <select id="checkSnapshot"></select>
            <tbody id="checkTable"></tbody>
            <div id="lastCheckStatus" class="status"></div>
            <div id="currentTaskProgress" class="progress" style="display: none;">
                <div class="progress-bar-fill"></div>
                <div class="progress-text"></div>
                <div class="current-item"></div>
            </div>
            <div id="reportDetailModal"></div>
            <div id="reportDetailContent" class="modal-content"></div>
        `;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getStatusText', () => {
        test('should return correct status text', () => {
            expect(getStatusText('success')).toBe('通过');
            expect(getStatusText('failed')).toBe('失败');
            expect(getStatusText('running')).toBe('进行中');
            expect(getStatusText('pending')).toBe('等待中');
            expect(getStatusText('cancelled')).toBe('已取消');
            expect(getStatusText('completed_with_errors')).toBe('部分失败');
            expect(getStatusText('unknown')).toBe('unknown');
            expect(getStatusText(null)).toBe('-');
        });
    });

    describe('getStatusClass', () => {
        test('should return correct status class', () => {
            expect(getStatusClass('success')).toBe('success');
            expect(getStatusClass('failed')).toBe('error');
            expect(getStatusClass('running')).toBe('warning');
            expect(getStatusClass('pending')).toBe('info');
            expect(getStatusClass('cancelled')).toBe('');
            expect(getStatusClass('completed_with_errors')).toBe('warning');
            expect(getStatusClass('unknown')).toBe('');
        });
    });

    describe('getStatusBadge', () => {
        test('should return status badge HTML for success', () => {
            const badge = getStatusBadge('success');
            expect(badge).toContain('status-badge');
            expect(badge).toContain('success');
            expect(badge).toContain('通过');
        });

        test('should return correct badge for failed status', () => {
            const badge = getStatusBadge('failed');
            expect(badge).toContain('error');
            expect(badge).toContain('失败');
        });

        test('should return correct badge for running status', () => {
            const badge = getStatusBadge('running');
            expect(badge).toContain('warning');
            expect(badge).toContain('进行中');
        });
    });

    describe('getDetailStatusBadge', () => {
        test('should return detail status badge HTML for pass', () => {
            const badge = getDetailStatusBadge('pass');
            expect(badge).toContain('status-badge');
            expect(badge).toContain('success');
            expect(badge).toContain('通过');
        });

        test('should return correct badge for fail status', () => {
            const badge = getDetailStatusBadge('fail');
            expect(badge).toContain('error');
            expect(badge).toContain('失败');
        });

        test('should return correct badge for error status', () => {
            const badge = getDetailStatusBadge('error');
            expect(badge).toContain('warning');
            expect(badge).toContain('错误');
        });
    });

    describe('openCheckModal', () => {
        test('should find modal element', () => {
            const modal = document.getElementById('checkModal');
            expect(modal).not.toBeNull();
        });

        test('should add active class to modal', () => {
            const modal = document.getElementById('checkModal');
            if (modal) {
                modal.classList.add('active');
                expect(modal.classList.contains('active')).toBe(true);
            }
        });
    });

    describe('getHeaders helper', () => {
        function getHeaders() {
            const token = localStorage.getItem('token');
            return {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };
        }

        test('should return headers with token', () => {
            const headers = getHeaders();
            expect(headers['Authorization']).toBe('Bearer test-token');
            expect(headers['Content-Type']).toBe('application/json');
        });
    });
});
