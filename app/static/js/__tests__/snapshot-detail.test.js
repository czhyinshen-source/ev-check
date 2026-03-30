import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SnapshotDetailModal } from '../components/snapshot-detail.js';

describe('SnapshotDetailModal', () => {
    let modal;

    beforeEach(() => {
        document.body.innerHTML = '';
        modal = new SnapshotDetailModal();
    });

    it('should create modal container', () => {
        modal.createContainer();
        const container = document.querySelector('.snapshot-detail-modal');
        expect(container).toBeTruthy();
    });

    it('should render statistics correctly', () => {
        const stats = {
            total: 10,
            success: 8,
            error: 2,
            totalItems: 150
        };

        const html = modal.renderStatistics(stats);
        expect(html).toContain('10'); // 总数
        expect(html).toContain('8');  // 成功
        expect(html).toContain('2');  // 失败
        expect(html).toContain('150'); // 检查项
    });

    it('should filter communications by status', () => {
        const comms = [
            { id: 1, name: 'comm1', status: 'success' },
            { id: 2, name: 'comm2', status: 'error' },
            { id: 3, name: 'comm3', status: 'success' }
        ];

        const filtered = modal.filterCommunications(comms, 'success');
        expect(filtered).toHaveLength(2);
        expect(filtered.every(c => c.status === 'success')).toBe(true);
    });

    it('should infer check item type correctly', () => {
        const fileItem = { check_item: { type: 'file', name: '检查hosts文件' } };
        expect(modal.inferCheckItemType(fileItem)).toBe('file');

        const processItem = { check_item: { type: 'process', name: 'nginx进程' } };
        expect(modal.inferCheckItemType(processItem)).toBe('process');

        const portItem = { check_item: { type: 'port', name: '80端口' } };
        expect(modal.inferCheckItemType(portItem)).toBe('port');

        const otherItem = { check_item: { type: 'custom', name: '其他检查' } };
        expect(modal.inferCheckItemType(otherItem)).toBe('other');
    });

    it('should get check item type title correctly', () => {
        expect(modal.getCheckItemTypeTitle('file')).toBe('文件检查项');
        expect(modal.getCheckItemTypeTitle('process')).toBe('进程检查项');
        expect(modal.getCheckItemTypeTitle('port')).toBe('端口检查项');
        expect(modal.getCheckItemTypeTitle('network')).toBe('网络检查项');
        expect(modal.getCheckItemTypeTitle('other')).toBe('其他检查项');
        expect(modal.getCheckItemTypeTitle('unknown')).toBe('未知类型');
    });

    it('should group environment data by type', () => {
        const envData = [
            { check_item: { type: 'file', name: 'hosts文件' } },
            { check_item: { type: 'process', name: 'nginx' } },
            { check_item: { type: 'file', name: 'resolv.conf' } },
            { check_item: { type: 'port', name: '80端口' } }
        ];

        const grouped = modal.groupByCheckItemType(envData);
        expect(Object.keys(grouped)).toHaveLength(3);
        expect(grouped.file).toHaveLength(2);
        expect(grouped.process).toHaveLength(1);
        expect(grouped.port).toHaveLength(1);
    });

    it('should render raw data correctly', () => {
        const data = { key: 'value', number: 123 };
        const html = modal.renderRawData(data);
        expect(html).toContain('raw-data-card');
        expect(html).toContain('key');
        expect(html).toContain('value');
        expect(html).toContain('number');
        expect(html).toContain('123');
    });

    it('should handle empty environment data', () => {
        const html = modal.renderEnvironmentData([]);
        expect(html).toContain('暂无环境数据');
    });

    it('should render check item with error', () => {
        const item = {
            data_value: {
                _error: 'Connection failed',
                _error_type: 'network_error'
            }
        };

        const html = modal.renderCheckItem(item);
        expect(html).toContain('⚠️');
        expect(html).toContain('数据采集失败');
        expect(html).toContain('Connection failed');
        expect(html).toContain('错误类型：network_error');
    });
});