import { describe, it, expect, beforeEach } from 'vitest';
import { DataVisualizer } from '../components/data-visualizer.js';

describe('DataVisualizer', () => {
    let visualizer;

    beforeEach(() => {
        visualizer = new DataVisualizer();
    });

    it('should format file size correctly', () => {
        expect(visualizer.formatFileSize(0)).toBe('0 B');
        expect(visualizer.formatFileSize(512)).toBe('512 B');
        expect(visualizer.formatFileSize(1024)).toBe('1 KB');
        expect(visualizer.formatFileSize(1536)).toBe('1.5 KB');
        expect(visualizer.formatFileSize(1048576)).toBe('1 MB');
        expect(visualizer.formatFileSize(1073741824)).toBe('1 GB');
    });

    it('should render file data with correct structure', () => {
        const data = {
            path: '/etc/hosts',
            exists: true,
            size: 1024,
            mtime: '2024-03-30T10:00:00Z',
            mode: '644'
        };

        const html = visualizer.renderFileData(data);
        expect(html).toContain('/etc/hosts');
        expect(html).toContain('✓ 存在');
        expect(html).toContain('1 KB');
        expect(html).toContain('2024/03/30');
        expect(html).toContain('644');
    });

    it('should render missing file correctly', () => {
        const data = {
            path: '/etc/missing',
            exists: false
        };

        const html = visualizer.renderFileData(data);
        expect(html).toContain('/etc/missing');
        expect(html).toContain('✗ 不存在');
        expect(html).not.toContain('file-attributes');
    });

    it('should render process data correctly', () => {
        const data = {
            processes: [
                { name: 'nginx', pid: 1234, running: true },
                { name: 'mysql', pid: null, running: false }
            ]
        };

        const html = visualizer.renderProcessData(data);
        expect(html).toContain('nginx');
        expect(html).toContain('🟢');
        expect(html).toContain('运行中');
        expect(html).toContain('1234');
        expect(html).toContain('mysql');
        expect(html).toContain('🔴');
        expect(html).toContain('已停止');
    });

    it('should render empty process data', () => {
        const data = { processes: [] };
        const html = visualizer.renderProcessData(data);
        expect(html).toContain('暂无进程数据');
    });

    it('should render port data correctly', () => {
        const data = {
            ports: [
                { port: 80, protocol: 'TCP', listening: true },
                { port: 3306, protocol: 'TCP', listening: false }
            ]
        };

        const html = visualizer.renderPortData(data);
        expect(html).toContain('80');
        expect(html).toContain('TCP');
        expect(html).toContain('🟢 监听中');
        expect(html).toContain('3306');
        expect(html).toContain('⚫ 未监听');
    });

    it('should render empty port data', () => {
        const data = { ports: [] };
        const html = visualizer.renderPortData(data);
        expect(html).toContain('暂无端口数据');
    });

    it('should render error data correctly', () => {
        const error = {
            message: 'Connection timeout',
            type: 'network_error'
        };

        const html = visualizer.renderErrorData(error);
        expect(html).toContain('⚠️');
        expect(html).toContain('数据采集失败');
        expect(html).toContain('Connection timeout');
        expect(html).toContain('错误类型：network_error');
    });

    it('should render error data without type', () => {
        const error = {
            message: 'Unknown error'
        };

        const html = visualizer.renderErrorData(error);
        expect(html).toContain('Unknown error');
        expect(html).not.toContain('错误类型');
    });
});