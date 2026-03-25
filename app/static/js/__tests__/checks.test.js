// checks.test.js
import { vi, beforeEach, afterEach, describe, test, expect } from 'vitest';
import { JSDOM } from 'jsdom';

// Setup test environment
beforeEach(() => {
    // Mock the global fetch function
    global.fetch = vi.fn();

    // Create a DOM environment
    const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
            <head>
                <script>
                    // Mock API_BASE and getHeaders function
                    const API_BASE = 'http://localhost:8000';
                    function getHeaders() {
                        return {
                            'Authorization': 'Bearer test-token',
                            'Content-Type': 'application/json'
                        };
                    }
                </script>
            </head>
            <body>
                <div id="checkModal" class="modal"></div>
                <div id="checkRule" class="select"></div>
                <div id="checkCommunication" class="select"></div>
                <div id="checkSnapshot" class="select"></div>
                <div id="checkTable" class="table-body"></div>
                <div id="lastCheckStatus" class="status"></div>
                <div id="currentTaskProgress" class="progress" style="display: none;">
                    <div class="progress-bar-fill"></div>
                    <div class="progress-text"></div>
                    <div class="current-item"></div>
                </div>
                <div id="reportDetailContent" class="modal-content"></div>
            </body>
        </html>
    `);

    // Mock globals
    global.document = dom.window.document;
    global.window = dom.window;
    global.localStorage = {
        getItem: vi.fn().mockReturnValue('test-token')
    };
});

afterEach(() => {
    // Reset mocks
    vi.clearAllMocks();
});

describe('checks module', () => {
    let checks;

    beforeEach(() => {
        // Load the checks module
        const checksModule = require('../checks.js');

        // Initialize window.checks if it doesn't exist
        if (!window.checks) {
            window.checks = {};
        }

        // Copy functions to window.checks object
        Object.assign(window.checks, checksModule);

        checks = window.checks;
    });

    describe('openCheckModal', () => {
  
        test('should open the check modal', () => {
            document.getElementById = vi.fn().mockReturnValue({
                classList: {
                    add: vi.fn()
                }
            });

            checks.openCheckModal();

            const modal = document.getElementById('checkModal');
            expect(modal.classList.add).toHaveBeenCalledWith('active');
        });

        test('should call load functions when opening modal', () => {
            document.getElementById = vi.fn().mockReturnValue({
                classList: {
                    add: vi.fn()
                }
            });

            // Mock the load functions
            window.checks.loadCheckRules = vi.fn();
            window.checks.loadCommunicationsForCheck = vi.fn();
            window.checks.loadSnapshotsForCheck = vi.fn();

            checks.openCheckModal();

            expect(window.checks.loadCheckRules).toHaveBeenCalled();
            expect(window.checks.loadCommunicationsForCheck).toHaveBeenCalled();
            expect(window.checks.loadSnapshotsForCheck).toHaveBeenCalled();
        });
    });

    // Test loadCheckResults function
    describe('loadCheckResults', () => {
  
        test('should load and render check results', async () => {
            document.getElementById = vi.fn().mockReturnValue({
                innerHTML: ''
            });

            const mockData = [
                {
                    id: 1,
                    rule_name: 'Test Rule',
                    communication_name: 'Test Comm',
                    status: 'success',
                    progress: 100,
                    start_time: '2024-01-01T10:00:00'
                }
            ];

            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockData)
            });

            await checks.loadCheckResults();

            expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/checks', expect.any(Object));
        });
    });

    // Test deleteCheckResult function
    describe('deleteCheckResult', () => {
        beforeEach(() => {
            global.confirm = vi.fn().mockReturnValue(true);
        });

        test('should delete check result', async () => {
            document.getElementById = vi.fn().mockReturnValue({
                innerHTML: ''
            });

            fetch.mockResolvedValue({
                ok: true
            });

            await checks.deleteCheckResult(1);

            expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/checks/1', {
                method: 'DELETE',
                headers: expect.objectContaining({
                    'Authorization': 'Bearer test-token',
                    'Content-Type': 'application/json'
                })
            });
        });
    });

    // Test getStatusText function
    describe('getStatusText', () => {
        test('should return correct status text', () => {
            expect(window.checks.getStatusText('success')).toBe('通过');
            expect(window.checks.getStatusText('failed')).toBe('失败');
            expect(window.checks.getStatusText('running')).toBe('进行中');
            expect(window.checks.getStatusText('pending')).toBe('等待中');
            expect(window.checks.getStatusText('cancelled')).toBe('已取消');
            expect(window.checks.getStatusText('completed_with_errors')).toBe('部分失败');
        });
    });

    // Test getStatusClass function
    describe('getStatusClass', () => {
        test('should return correct status class', () => {
            expect(window.checks.getStatusClass('success')).toBe('success');
            expect(window.checks.getStatusClass('failed')).toBe('error');
            expect(window.checks.getStatusClass('running')).toBe('warning');
            expect(window.checks.getStatusClass('pending')).toBe('info');
            expect(window.checks.getStatusClass('cancelled')).toBe('');
            expect(window.checks.getStatusClass('completed_with_errors')).toBe('warning');
        });
    });

    // Test getStatusBadge function
    describe('getStatusBadge', () => {
        test('should return status badge HTML', () => {
            const badge = window.checks.getStatusBadge('success');
            expect(badge).toContain('status-badge');
            expect(badge).toContain('success');
            expect(badge).toContain('通过');
        });
    });

    // Test getDetailStatusBadge function
    describe('getDetailStatusBadge', () => {
        test('should return detail status badge HTML', () => {
            const badge = window.checks.getDetailStatusBadge('pass');
            expect(badge).toContain('status-badge');
            expect(badge).toContain('success');
            expect(badge).toContain('通过');
        });
    });

    // Test viewCheckResult function
    describe('viewCheckResult', () => {
  
        test('should view check result detail', async () => {
            const mockData = {
                id: 1,
                rule_name: 'Test Rule',
                communication_name: 'Test Comm',
                status: 'success',
                progress: 100,
                start_time: '2024-01-01T10:00:00',
                end_time: '2024-01-01T10:05:00',
                duration_seconds: 300,
                summary: {
                    total: 10,
                    passed: 8,
                    failed: 2,
                    errors: 0
                },
                details: [
                    {
                        check_item_name: 'Item 1',
                        check_item_type: 'file',
                        status: 'pass',
                        expected_value: 'expected',
                        actual_value: 'actual',
                        message: 'Test message'
                    }
                ]
            };

            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockData)
            });

            await checks.viewCheckResult(1);

            expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/checks/1', expect.any(Object));
        });
    });
});