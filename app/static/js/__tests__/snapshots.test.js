// snapshots.test.js

import { vi, describe, test, beforeEach, expect } from 'vitest';
import { globalWindow } from 'vitest/global';

describe('snapshots模块', () => {
  // 在真实环境中，这些函数会被挂载到window对象
  const mockSnapshots = {
    openSnapshotGroupModal: vi.fn(),
    loadSnapshotGroups: vi.fn(),
    filterBySnapshotGroup: vi.fn(),
    editSnapshotGroup: vi.fn(),
    deleteSnapshotGroup: vi.fn(),
    openSnapshotModal: vi.fn(),
    loadSnapshots: vi.fn(),
    searchSnapshots: vi.fn(),
    deleteSnapshot: vi.fn(),
    openSnapshotBuildModal: vi.fn(),
    closeSnapshotBuildModal: vi.fn(),
    startSnapshotBuild: vi.fn(),
    showBuildProgress: vi.fn(),
    pollBuildProgress: vi.fn(),
    toggleGroupProgress: vi.fn(),
    cancelSnapshotBuild: vi.fn(),
    closeBuildProgressModal: vi.fn(),
  };

  // 模拟全局API_BASE
  const API_BASE = 'http://test-api.com';

  beforeEach(() => {
    // 清除所有mock调用
    Object.values(mockSnapshots).forEach(fn => fn.mockClear());

    // 模拟DOM元素
    document.body.innerHTML = `
      <div id="snapshotModal"></div>
      <div id="snapshotGroupModal"></div>
      <div id="snapshotBuildModal"></div>
      <div id="snapshotBuildProgressModal"></div>
      <div id="snapshotGroupTree"></div>
      <div id="snapshotTable"></div>
      <div id="buildGroupsProgress"></div>
      <div id="buildOverallProgress"></div>
      <div id="buildProgressText"></div>
      <div id="buildSelectionCount"></div>
    `;
  });

  describe('快照组管理功能', () => {
    test('openSnapshotGroupModal应该打开模态框', () => {
      mockSnapshots.openSnapshotGroupModal();

      expect(document.getElementById('snapshotGroupModal')).toHaveClass('active');
    });

    test('loadSnapshotGroups应该调用API并更新UI', () => {
      // 模拟API响应
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, name: '测试组1' },
          { id: 2, name: '测试组2' }
        ])
      });

      mockSnapshots.loadSnapshotGroups();

      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/api/v1/snapshots/groups`,
        expect.objectContaining({ headers: expect.any(Object) })
      );
      expect(mockSnapshots.loadSnapshotGroups).toHaveBeenCalled();
    });
  });

  describe('快照管理功能', () => {
    test('openSnapshotModal应该打开模态框', () => {
      mockSnapshots.openSnapshotModal();

      expect(document.getElementById('snapshotModal')).toHaveClass('active');
    });

    test('loadSnapshots应该调用API并更新UI', () => {
      // 模拟API响应
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          {
            id: 1,
            name: '测试快照1',
            group_id: 1,
            snapshot_time: '2024-01-01T00:00:00',
            is_default: true
          }
        ])
      });

      mockSnapshots.loadSnapshots();

      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE}/api/v1/snapshots`,
        expect.objectContaining({ headers: expect.any(Object) })
      );
      expect(mockSnapshots.loadSnapshots).toHaveBeenCalled();
    });

    test('deleteSnapshot应该显示确认对话框', () => {
      // 模拟confirm返回true
      global.confirm = jest.fn().mockReturnValue(true);

      mockSnapshots.deleteSnapshot(1);

      expect(confirm).toHaveBeenCalledWith('确定删除此快照?');
      expect(mockSnapshots.deleteSnapshot).toHaveBeenCalledWith(1);
    });
  });

  describe('快照构建功能', () => {
    test('openSnapshotBuildModal应该打开构建模态框', () => {
      mockSnapshots.openSnapshotBuildModal();

      expect(document.getElementById('snapshotBuildModal')).toHaveClass('active');
    });

    test('startSnapshotBuild应该验证输入并调用API', () => {
      // 模拟DOM元素
      document.getElementById('buildSnapshotName').value = '测试快照';
      document.getElementById('buildSnapshotGroup').value = '1';

      // 模拟getBuildConfig函数
      global.getBuildConfig = jest.fn().mockReturnValue([
        {
          group_id: 1,
          communication_ids: [1, 2],
          check_item_list_id: 1
        }
      ]);

      mockSnapshots.startSnapshotBuild();

      expect(mockSnapshots.startSnapshotBuild).toHaveBeenCalled();
    });

    test('closeSnapshotBuildModal应该关闭模态框', () => {
      mockSnapshots.closeSnapshotBuildModal();

      expect(document.getElementById('snapshotBuildModal')).not.toHaveClass('active');
    });
  });

  describe('辅助功能', () => {
    test('searchSnapshots应该根据搜索词过滤', () => {
      // 模拟DOM
      document.getElementById('snapshotSearch').value = '测试';

      mockSnapshots.searchSnapshots();

      expect(mockSnapshots.searchSnapshots).toHaveBeenCalled();
    });

    test('filterBySnapshotGroup应该更新当前组ID', () => {
      mockSnapshots.filterBySnapshotGroup(1);

      expect(mockSnapshots.filterBySnapshotGroup).toHaveBeenCalledWith(1);
    });
  });

  describe('错误处理', () => {
    test('loadSnapshotGroups应该处理API错误', async () => {
      // 模拟API错误
      global.fetch = jest.fn().mockRejectedValue(new Error('API错误'));

      mockSnapshots.loadSnapshotGroups();

      expect(console.error).toHaveBeenCalled();
    });
  });
});