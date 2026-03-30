// 快速修复脚本 - 在浏览器控制台运行
console.log('🔧 开始快速修复...');

// 1. 检查 shared 模块
if (!window.shared) {
    console.error('❌ window.shared 不存在，请确保 shared.js 已加载');
} else {
    console.log('✅ window.shared 已加载');
    console.log('   API_BASE:', window.shared.API_BASE);
}

// 2. 检查其他模块
const modules = ['communications', 'checks', 'checkitems', 'snapshots', 'reports'];
modules.forEach(moduleName => {
    if (window[moduleName]) {
        console.log(`✅ window.${moduleName} 已加载`);
    } else {
        console.log(`❌ window.${moduleName} 未加载`);
    }
});

// 3. 修复标签页切换
console.log('🔧 修复标签页切换...');
const tabs = document.querySelectorAll('.nav-tab');
console.log(`找到 ${tabs.length} 个标签页`);

if (tabs.length === 0) {
    console.error('❌ 没有找到标签页元素');
} else {
    tabs.forEach((tab, index) => {
        console.log(`标签 ${index + 1}: ${tab.dataset.tab || '无data-tab属性'}`);

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
            } else {
                console.error(`❌ 未找到内容区域: ${targetId}`);
            }
        });
    });

    console.log('✅ 标签页切换已修复');
}

// 4. 测试切换功能
console.log('🧪 测试标签页切换...');
if (tabs.length > 0) {
    const firstTab = tabs[0];
    console.log(`点击第一个标签: ${firstTab.dataset.tab}`);
    firstTab.click();
}

console.log('🎉 修复完成！现在应该可以正常切换标签页了');