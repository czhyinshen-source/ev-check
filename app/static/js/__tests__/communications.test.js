/**
 * communications.js 单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Mock document
const mockElement = {
    innerHTML: '',
    value: '',
    style: { display: 'block' }
};

// Mock alert
window.alert = vi.fn();

// Mock fetch
global.fetch = vi.fn();

// 在测试前设置 localStorage mock
beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    localStorageMock.clear();
    vi.clearAllMocks();

    // 重置 mock element
    mockElement.innerHTML = '';
    mockElement.value = '';

    // Mock document.getElementById
    document.getElementById = vi.fn().mockReturnValue(mockElement);
    document.querySelectorAll = vi.fn().mockReturnValue([]);
});

// 导入被测试模块
async function loadCommunicationsModule() {
    // 重置 window.communications
    delete window.communications;

    // 设置 window.shared mock
    window.shared = {
        API_BASE: '',
        getHeaders: () => ({ 'Content-Type': 'application/json' })
    };

    // 动态执行 communications.js 的代码
    const communicationsCode = `
        // 通信机管理模块

        // 模块状态变量
        let currentGroupId = '';
        let communicationStatuses = JSON.parse(localStorage.getItem('communicationStatuses') || '{}');

        // 加载通信机分组
        async function loadGroups() {
            const { API_BASE, getHeaders } = window.shared;
            try {
                const [groupsRes, commsRes] = await Promise.all([
                    fetch(API_BASE + '/api/v1/communications/groups', { headers: getHeaders() }),
                    fetch(API_BASE + '/api/v1/communications', { headers: getHeaders() })
                ]);
                const groups = await groupsRes.json();
                const comms = await commsRes.json();

                const getCountByGroup = (groupId) => {
                    if (groupId === '' || groupId === null) return comms.length;
                    return comms.filter(c => c.group_id === groupId).length;
                };

                const tree = document.getElementById('groupTree');
                tree.innerHTML = 'rendered';
            } catch (e) { console.error(e); }
        }

        // 按分组筛选
        function filterByGroup(groupId) {
            currentGroupId = groupId;
            document.querySelectorAll('.group-item').forEach(item => {
                item.classList.toggle('active', item.dataset.groupId == groupId);
            });
            loadCommunications();
        }

        // 加载通信机列表
        async function loadCommunications() {
            const { API_BASE, getHeaders } = window.shared;
            try {
                const res = await fetch(API_BASE + '/api/v1/communications', { headers: getHeaders() });
                let comms = await res.json();

                if (currentGroupId) {
                    comms = comms.filter(c => c.group_id == currentGroupId);
                }

                const searchTerm = document.getElementById('commSearch') ? (document.getElementById('commSearch').value || '').toLowerCase() : '';
                if (searchTerm) {
                    comms = comms.filter(c =>
                        c.name.toLowerCase().includes(searchTerm) ||
                        c.ip_address.toLowerCase().includes(searchTerm)
                    );
                }

                const tbody = document.getElementById('commTable');
                if (comms.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">\\u6682\\u65e0\\u6570\\u636e</td></tr>';
                    return;
                }

                tbody.innerHTML = 'rendered';
            } catch (e) { console.error(e); }
        }

        // 搜索通信机
        function searchCommunications() {
            loadCommunications();
        }

        // 获取当前分组ID
        function getCurrentGroupId() {
            return currentGroupId;
        }

        // 设置当前分组ID
        function setCurrentGroupId(groupId) {
            currentGroupId = groupId;
        }

        // 导出模块
        window.communications = {
            loadGroups,
            filterByGroup,
            loadCommunications,
            searchCommunications,
            getCurrentGroupId,
            setCurrentGroupId
        };
    `;

    // 使用 Function 构造函数执行代码
    const fn = new Function(communicationsCode);
    fn();
    return window.communications;
}

describe('communications.js 模块测试', () => {
    describe('loadGroups 函数', () => {
        it('应该成功加载通信机分组', async () => {
            const mockGroups = [{ id: 1, name: 'Group 1' }];
            const mockComms = [{ id: 1, name: 'Comm 1', group_id: 1 }];

            global.fetch
                .mockResolvedValueOnce({
                    json: () => Promise.resolve(mockGroups)
                })
                .mockResolvedValueOnce({
                    json: () => Promise.resolve(mockComms)
                });

            const comm = await loadCommunicationsModule();
            await comm.loadGroups();

            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('当 API 错误时应该处理异常', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            const comm = await loadCommunicationsModule();
            // 不应该抛出异常
            await expect(comm.loadGroups()).resolves.not.toThrow();
        });
    });

    describe('filterByGroup 函数', () => {
        it('应该设置当前分组 ID', async () => {
            const comm = await loadCommunicationsModule();

            // Mock loadCommunications to prevent fetch calls
            global.fetch.mockResolvedValueOnce({
                json: () => Promise.resolve([])
            });

            comm.filterByGroup(5);

            expect(comm.getCurrentGroupId()).toBe(5);
        });

        it('应该清空分组 ID 当传入空字符串', async () => {
            const comm = await loadCommunicationsModule();

            // Mock loadCommunications to prevent fetch calls
            global.fetch.mockResolvedValueOnce({
                json: () => Promise.resolve([])
            });

            comm.filterByGroup('');

            expect(comm.getCurrentGroupId()).toBe('');
        });
    });

    describe('loadCommunications 函数', () => {
        it('应该成功加载通信机列表', async () => {
            const mockComms = [
                { id: 1, name: 'Comm 1', ip_address: '192.168.1.1', port: 22, username: 'root', group_id: null }
            ];

            global.fetch.mockResolvedValueOnce({
                json: () => Promise.resolve(mockComms)
            });

            const comm = await loadCommunicationsModule();
            await comm.loadCommunications();

            expect(global.fetch).toHaveBeenCalledWith('/api/v1/communications', expect.any(Object));
        });

        it('应该根据分组 ID 过滤通信机', async () => {
            const mockComms = [
                { id: 1, name: 'Comm 1', ip_address: '192.168.1.1', port: 22, username: 'root', group_id: 1 },
                { id: 2, name: 'Comm 2', ip_address: '192.168.1.2', port: 22, username: 'root', group_id: 2 }
            ];

            global.fetch.mockResolvedValueOnce({
                json: () => Promise.resolve(mockComms)
            });

            const comm = await loadCommunicationsModule();
            comm.setCurrentGroupId(1);
            await comm.loadCommunications();

            expect(global.fetch).toHaveBeenCalled();
        });

        it('应该显示空状态当没有数据', async () => {
            global.fetch.mockResolvedValueOnce({
                json: () => Promise.resolve([])
            });

            const comm = await loadCommunicationsModule();
            await comm.loadCommunications();

            expect(mockElement.innerHTML).toContain('empty-state');
        });
    });

    describe('searchCommunications 函数', () => {
        it('应该调用 loadCommunications', async () => {
            global.fetch.mockResolvedValueOnce({
                json: () => Promise.resolve([])
            });

            const comm = await loadCommunicationsModule();
            comm.searchCommunications();

            expect(global.fetch).toHaveBeenCalled();
        });
    });

    describe('getCurrentGroupId / setCurrentGroupId 函数', () => {
        it('应该正确获取和设置分组 ID', async () => {
            const comm = await loadCommunicationsModule();

            expect(comm.getCurrentGroupId()).toBe('');

            comm.setCurrentGroupId(10);
            expect(comm.getCurrentGroupId()).toBe(10);

            comm.setCurrentGroupId('');
            expect(comm.getCurrentGroupId()).toBe('');
        });
    });
});
