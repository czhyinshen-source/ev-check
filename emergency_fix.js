// 🔧 紧急修复脚本 - 在浏览器控制台运行
console.log('🚨 开始紧急修复...');

// 1. 修复 filterByGroup 未定义的问题
if (window.communications && window.communications.filterByGroup) {
    window.filterByGroup = function(groupId) {
        return window.communications.filterByGroup(groupId);
    };
    console.log('✅ filterByGroup 已修复');
} else {
    console.log('❌ communications 模块未加载');
}

// 2. 修复其他缺失的函数
const functionsToFix = [
    'openGroupModal',
    'searchCommunications',
    'openCommModal',
    'openExcelImportModal',
    'openBatchDeployModal',
    'downloadExcelTemplate',
    'toggleAuthFields',
    'toggleDeployFields'
];

functionsToFix.forEach(funcName => {
    if (window.communications && window.communications[funcName]) {
        window[funcName] = function() {
            return window.communications[funcName].apply(this, arguments);
        };
        console.log(`✅ ${funcName} 已修复`);
    } else {
        console.log(`⚠️  ${funcName} 暂时不可用`);
    }
});

// 3. 重新初始化导航栏
console.log('🔧 重新初始化导航栏...');
const tabs = document.querySelectorAll('.nav-tab');
console.log(`找到 ${tabs.length} 个标签页`);

if (tabs.length > 0) {
    tabs.forEach((tab, index) => {
        const tabId = tab.dataset.tab;
        if (!tabId) {
            console.log(`⚠️  标签 ${index + 1} 缺少 data-tab 属性`);
            return;
        }

        // 移除旧的事件监听器
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);

        // 添加新的事件监听器
        newTab.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.dataset.tab;

            console.log(`🔄 切换到: ${targetId}`);

            // 移除所有 active 类
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // 添加 active 类
            this.classList.add('active');
            const targetContent = document.getElementById(targetId);

            if (targetContent) {
                targetContent.classList.add('active');
                console.log(`✅ 成功切换到: ${targetId}`);

                // 根据标签页加载相应数据
                if (targetId === 'communications' && window.communications) {
                    window.communications.loadCommunications();
                }
            } else {
                console.log(`❌ 未找到内容区域: ${targetId}`);
            }
        });
    });
    console.log('✅ 导航栏已重新初始化');
}

// 4. 测试功能
async function testFunctions() {
    console.log('🔧 测试模块功能...');

    if (window.communications) {
        try {
            await window.communications.loadCommunications();
            console.log('✅ 通信机加载成功');
        } catch (e) {
            console.log('❌ 通信机加载失败:', e.message);
        }
    }

    if (window.communications) {
        try {
            await window.communications.loadGroups();
            console.log('✅ 分组加载成功');
        } catch (e) {
            console.log('❌ 分组加载失败:', e.message);
        }
    }
}

// 5. 自动测试
setTimeout(() => {
    console.log('🔧 运行功能测试...');
    testFunctions();
}, 500);

console.log('🎉 紧急修复完成！');
console.log('');
console.log('📋 修复状态:');
console.log(`  - filterByGroup: ${typeof window.filterByGroup}`);
console.log(`  - communications: ${window.communications ? '✅' : '❌'}`);
console.log(`  - 导航栏: ${tabs.length} 个标签`);
console.log('');
console.log('💡 现在应该可以正常使用系统了');
