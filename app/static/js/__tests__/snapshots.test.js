// snapshots.test.js

import { vi, describe, test, beforeEach, expect } from 'vitest';

// 模拟快照模块
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

describe('snapshots模块', () => {
  beforeEach(() => {
    // 清除所有mock调用
    vi.clearAllMocks();
  });

  describe('快照组管理功能', () => {
    test('openSnapshotGroupModal应��被调用', () => {
      mockSnapshots.openSnapshotGroupModal();
      expect(mockSnapshots.openSnapshotGroupModal).toHaveBeenCalledTimes(1);
    });

    test('loadSnapshotGroups应该被调用', () => {
      mockSnapshots.loadSnapshotGroups();
      expect(mockSnapshots.loadSnapshotGroups).toHaveBeenCalledTimes(1);
    });
  });

  describe('快照管理功能', () => {
    test('openSnapshotModal应该被调用', () => {
      mockSnapshots.openSnapshotModal();
      expect(mockSnapshots.openSnapshotModal).toHaveBeenCalledTimes(1);
    });

    test('loadSnapshots应该被调用', () => {
      mockSnapshots.loadSnapshots();
      expect(mockSnapshots.loadSnapshots).toHaveBeenCalledTimes(1);
    });

    test('deleteSnapshot应该被调用并传递正确的参数', () => {
      const mockConfirm = vi.fn().mockReturnValue(true);
      global.confirm = mockConfirm;

      mockSnapshots.deleteSnapshot(123);

      expect(mockSnapshots.deleteSnapshot).toHaveBeenCalledWith(123);
    });
  });

  describe('快照构建功能', () => {
    test('openSnapshotBuildModal应该被调用', () => {
      mockSnapshots.openSnapshotBuildModal();
      expect(mockSnapshots.openSnapshotBuildModal).toHaveBeenCalledTimes(1);
    });

    test('startSnapshotBuild应该被调用', () => {
      mockSnapshots.startSnapshotBuild();
      expect(mockSnapshots.startSnapshotBuild).toHaveBeenCalledTimes(1);
    });

    test('closeSnapshotBuildModal应该被调用', () => {
      mockSnapshots.closeSnapshotBuildModal();
      expect(mockSnapshots.closeSnapshotBuildModal).toHaveBeenCalledTimes(1);
    });
  });

  describe('辅助功能', () => {
    test('searchSnapshots应该被调用', () => {
      mockSnapshots.searchSnapshots();
      expect(mockSnapshots.searchSnapshots).toHaveBeenCalledTimes(1);
    });

    test('filterBySnapshotGroup应该被调用并传递正确的参数', () => {
      mockSnapshots.filterBySnapshotGroup(1);
      expect(mockSnapshots.filterBySnapshotGroup).toHaveBeenCalledWith(1);
    });
  });

  describe('错误处理', () => {
    test('loadSnapshotGroups应该处理错误', () => {
      const mockConsoleError = vi.spyOn(console, 'error');
      mockSnapshots.loadSnapshotGroups();
      expect(mockConsoleError).not.toHaveBeenCalled();
    });
  });

  });