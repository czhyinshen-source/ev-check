// 检查项模块测试
import { describe, it, expect } from 'vitest';

describe('checkitems module', () => {
    it('should have required functions defined', () => {
        // 直接读��并检查文件内容
        const fs = require('fs');
        const path = require('path');
        const checkitemsPath = path.join(__dirname, '..', 'checkitems.js');
        const content = fs.readFileSync(checkitemsPath, 'utf8');

        // 检查所有必需的函数是否存在
        const requiredFunctions = [
            'function openCheckItemListModal',
            'function openCheckItemModal',
            'function toggleCheckItemFields',
            'function toggleCheckItemCategory',
            'function toggleContentCheckFields',
            'function toggleTextCompareFields',
            'function toggleKernelCompareFields',
            'function toggleRouteCheckFields',
            'function loadCheckItemLists',
            'function selectCheckItemList',
            'function editCheckItemList',
            'function cloneCheckItemList',
            'function deleteCheckItemList',
            'function loadCheckItems',
            'function editCheckItem',
            'function cloneCheckItem',
            'function deleteCheckItem',
            'window.checkitems = {'
        ];

        requiredFunctions.forEach(func => {
            expect(content).toContain(func);
        });
    });

    it('should export functions as object', () => {
        const fs = require('fs');
        const path = require('path');
        const checkitemsPath = path.join(__dirname, '..', 'checkitems.js');
        const content = fs.readFileSync(checkitemsPath, 'utf8');

        // 检查导出对象的格式
        expect(content).toContain('window.checkitems = {');
        expect(content).toContain('};');

        // 检查具体函数是否被导出
        expect(content).toContain('openCheckItemListModal,');
        expect(content).toContain('openCheckItemModal,');
        expect(content).toContain('toggleCheckItemFields,');
        expect(content).toContain('toggleCheckItemCategory,');
        expect(content).toContain('toggleContentCheckFields,');
        expect(content).toContain('toggleTextCompareFields,');
        expect(content).toContain('toggleKernelCompareFields,');
        expect(content).toContain('toggleRouteCheckFields,');
        expect(content).toContain('loadCheckItemLists,');
        expect(content).toContain('selectCheckItemList,');
        expect(content).toContain('editCheckItemList,');
        expect(content).toContain('cloneCheckItemList,');
        expect(content).toContain('deleteCheckItemList,');
        expect(content).toContain('loadCheckItems,');
        expect(content).toContain('editCheckItem,');
        expect(content).toContain('cloneCheckItem,');
        expect(content).toContain('deleteCheckItem');
    });
});