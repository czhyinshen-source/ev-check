// 报告模块测试
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import '../reports.js';

describe('Reports Module', () => {
    // Mock global variables
    const mockAPI_BASE = 'http://test.com';
    const mockToken = 'test-token';

    beforeEach(() => {
        // Setup mock data
        window.allReports = [
            {
                id: 1,
                rule_id: 1001,
                communication_id: 2001,
                status: 'success',
                progress: 100,
                start_time: '2024-01-01T10:00:00',
                end_time: '2024-01-01T10:05:00'
            },
            {
                id: 2,
                rule_id: 1002,
                communication_id: 2002,
                status: 'running',
                progress: 50,
                start_time: '2024-01-01T11:00:00',
                end_time: null
            }
        ];

        // Mock localStorage
        const localStorageMock = {
            getItem: vi.fn().mockImplementation((key) => {
                if (key === 'token') return mockToken;
                return null;
            }),
            setItem: vi.fn(),
            removeItem: vi.fn()
        };
        global.localStorage = localStorageMock;

        // Mock fetch
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('loadReports', () => {
        it('should fetch reports and update allReports', async () => {
            const mockData = [
                { id: 1, rule_id: 1001, communication_id: 2001 },
                { id: 2, rule_id: 1002, communication_id: 2002 }
            ];

            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockData)
            });

            // 设置 DOM 元素
            document.body.innerHTML = '<table id="reportTable"></table>';

            await window.reports.loadReports();

            expect(fetch).toHaveBeenCalledWith(
                'http://test.com/api/v1/checks',
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${mockToken}`
                    }
                }
            );
            expect(window.allReports).toEqual(mockData);
        });

        it('should handle fetch error', async () => {
            fetch.mockRejectedValue(new Error('Network error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await window.reports.loadReports();

            expect(consoleSpy).toHaveBeenCalledWith('加载报告列表失败:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('renderReports', () => {
        it('should render reports table correctly', () => {
            const reports = [
                {
                    id: 1,
                    rule_id: 1001,
                    communication_id: 2001,
                    status: 'success',
                    progress: 100,
                    start_time: '2024-01-01T10:00:00',
                    end_time: '2024-01-01T10:05:00'
                },
                {
                    id: 2,
                    rule_id: 1002,
                    communication_id: 2002,
                    status: 'running',
                    progress: 50,
                    start_time: '2024-01-01T11:00:00',
                    end_time: null
                }
            ];

            document.body.innerHTML = '<table id="reportTable"><tbody></tbody></table>';

            window.reports.renderReports(reports);

            const tbody = document.querySelector('#reportTable tbody');
            const rows = tbody.querySelectorAll('tr');

            expect(rows).toHaveLength(2);
            expect(rows[0].cells[0].textContent).toBe('1');
            expect(rows[0].cells[1].textContent).toBe('1001');
            expect(rows[0].cells[2].textContent).toBe('2001');
            expect(rows[0].cells[3].querySelector('.status-badge').classList.contains('success')).toBe(true);
        });
    });

    describe('searchReports', () => {
        it('should filter reports by keyword', () => {
            document.body.innerHTML = '<input id="reportSearch"><table id="reportTable"><tbody></tbody></table>';

            window.reports.searchReports();

            // Test search by id
            document.getElementById('reportSearch').value = '1';
            window.reports.searchReports();

            const tbody = document.querySelector('#reportTable tbody');
            const rows = tbody.querySelectorAll('tr');

            expect(rows).toHaveLength(1);
            expect(rows[0].cells[0].textContent).toBe('1');
        });
    });

    describe('exportReport', () => {
        it('should export reports as CSV', () => {
            const createObjectURL = vi.fn().mockReturnValue('blob:test');
            const revokeObjectURL = vi.fn();
            const createElement = vi.fn().mockReturnValue({ click: vi.fn() });

            global.URL = {
                createObjectURL,
                revokeObjectURL
            };
            global.document = {
                createElement,
                body: {
                    appendChild: vi.fn(),
                    removeChild: vi.fn()
                }
            };

            window.reports.exportReport();

            expect(createObjectURL).toHaveBeenCalled();
            expect(createElement).toHaveBeenCalledWith('a');
            expect(createElement().download).toContain('检查报表_');
        });

        it('should show alert when no reports to export', () => {
            window.allReports = [];
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

            window.reports.exportReport();

            expect(alertSpy).toHaveBeenCalledWith('没有可导出的数据');
            alertSpy.mockRestore();
        });
    });

    describe('viewReportDetail', () => {
        it('should show report details in modal', async () => {
            const mockData = {
                id: 1,
                rule_id: 1001,
                communication_id: 2001,
                status: 'success',
                progress: 100,
                start_time: '2024-01-01T10:00:00',
                end_time: '2024-01-01T10:05:00',
                details: [
                    {
                        check_item_id: 1,
                        status: 'success',
                        expected_value: 'expected',
                        actual_value: 'actual',
                        message: 'OK'
                    }
                ]
            };

            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockData)
            });

            document.body.innerHTML = `
                <div id="reportDetailModal"></div>
                <div id="reportDetailContent"></div>
            `;

            await window.reports.viewReportDetail(1);

            expect(fetch).toHaveBeenCalledWith(
                'http://test.com/api/v1/checks/1',
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${mockToken}`
                    }
                }
            );

            const modal = document.getElementById('reportDetailModal');
            expect(modal.classList.contains('active')).toBe(true);
        });
    });

    describe('getStatusClass', () => {
        it('should return correct status class', () => {
            expect(window.reports.getStatusClass('success')).toBe('success');
            expect(window.reports.getStatusClass('failed')).toBe('failed');
            expect(window.reports.getStatusClass('running')).toBe('running');
            expect(window.reports.getStatusClass('unknown')).toBe('warning');
        });
    });

    describe('getStatusText', () => {
        it('should return correct status text', () => {
            expect(window.reports.getStatusText('success')).toBe('成功');
            expect(window.reports.getStatusText('failed')).toBe('失败');
            expect(window.reports.getStatusText('running')).toBe('进行中');
            expect(window.reports.getStatusText('unknown')).toBe('unknown');
        });
    });

    describe('formatDuration', () => {
        it('should format duration correctly', () => {
            expect(window.reports.formatDuration(30)).toBe('30秒');
            expect(window.reports.formatDuration(90)).toBe('1分30秒');
            expect(window.reports.formatDuration(3660)).toBe('1时1分');
            expect(window.reports.formatDuration(null)).toBe('-');
        });
    });
});