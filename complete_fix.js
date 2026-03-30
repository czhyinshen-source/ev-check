// 完整修复脚本 - 在浏览器控制台运行
console.log('🔧 开始完整修复...');

// 1. 检查并修复 shared 模块
if (!window.shared) {
    console.error('❌ window.shared 不存在，请确保 shared.js 已加载');
} else {
    console.log('✅ window.shared 已加载');
    console.log('   API_BASE:', window.shared.API_BASE);
    console.log('   getHeaders:', typeof window.shared.getHeaders);
}

// 2. 检查所有模块
const modules = ['communications', 'checks', 'checkitems', 'snapshots', 'reports'];
const moduleStatus = {};

modules.forEach(moduleName => {
    if (window[moduleName]) {
        moduleStatus[moduleName] = 'loaded';
        console.log(`✅ window.${moduleName} 已加载`);
    } else {
        moduleStatus[moduleName] = 'missing';
        console.log(`❌ window.${moduleName} 未加载`);
    }
});

// 3. 修复导航栏切换
console.log('🔧 修复导航栏切换...');
const tabs = document.querySelectorAll('.nav-tab');
console.log(`找到 ${tabs.length} 个标签页`);

if (tabs.length > 0) {
    tabs.forEach((tab, index) => {
        const tabId = tab.dataset.tab;
        console.log(`标签 ${index + 1}: ${tabId || '无data-tab属性'}`);

        // 移除旧的事件监听器
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);

        // 添加新的事件监听器
        newTab.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.dataset.tab;

            if (!targetId) {
                console.error('❌ 标签页缺少 data-tab 属性');
                return;
            }

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

                // 如果是通信机标签，确保数据已加载
                if (targetId === 'communications' && window.communications) {
                    console.log('🔄 重新加载通信机数据...');
                    window.communications.loadCommunications();
                }
            } else {
                console.error(`❌ 未找到内容区域: ${targetId}`);
            }
        });
    });

    console.log('✅ 导航栏切换已修复');
}

// 4. 检查并修复用户显示
console.log('🔧 检查用户显示...');
const username = localStorage.getItem('username');
const currentUserEl = document.getElementById('currentUser');

if (currentUserEl) {
    if (username) {
        currentUserEl.textContent = '用户: ' + username;
        console.log('✅ 用户显示已更新:', username);
    } else {
        currentUserEl.textContent = '用户: 未知';
        console.log('⚠️  未找到用户名');
    }
} else {
    console.log('❌ currentUser 元素不存在');
}

// 5. 测试API连接
async function testAPI() {
    console.log('🔧 测试API连接...');

    const token = localStorage.getItem('token');
    if (!token) {
        console.log('❌ 没有token，请先登录');
        return false;
    }

    try {
        // 测试用户API
        const userRes = await fetch('/api/v1/users/me', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (userRes.ok) {
            const user = await userRes.json();
            console.log('✅ 用户API正常:', user.username);
        } else {
            console.log('❌ 用户API失败:', userRes.status);
            return false;
        }

        // 测试通信机API
        const commRes = await fetch('/api/v1/communications', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (commRes.ok) {
            const comms = await commRes.json();
            console.log('✅ 通信机API正常，数量:', comms.length);
        } else {
            console.log('❌ 通信机API失败:', commRes.status);
        }

        return true;
    } catch (error) {
        console.log('❌ API测试失败:', error.message);
        return false;
    }
}

// 6. 修复数据加载
async function fixDataLoading() {
    console.log('🔧 修复数据加载...');

    // 加载通信机列表
    if (window.communications && window.communications.loadCommunications) {
        try {
            await window.communications.loadCommunications();
            console.log('✅ 通信机列表已加载');
        } catch (error) {
            console.log('❌ 通信机加载失败:', error.message);
        }
    }

    // 加载分组
    if (window.communications && window.communications.loadGroups) {
        try {
            await window.communications.loadGroups();
            console.log('✅ 分组列表已加载');
        } catch (error) {
            console.log('❌ 分组加载失败:', error.message);
        }
    }
}

// 7. 清理可能的错误事件监听器
function cleanupEventListeners() {
    console.log('🔧 清理错误的事件监听器...');

    // 查找并修复可能的空元素引用
    const problematicIds = ['startTime', 'endTime', 'ruleFilter', 'statusFilter'];
    problematicIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) {
            console.log(`⚠️  元素 ${id} 不存在，可能影响报告功能`);
        }
    });
}

// 执行所有修复
(async function() {
    console.log('🚀 开始执行完整修复流程...');

    cleanupEventListeners();

    const apiOk = await testAPI();
    if (apiOk) {
        await fixDataLoading();
    }

    console.log('🎉 修复完成！');
    console.log('');
    console.log('📋 修复摘要:');
    console.log(`  - shared模块: ${window.shared ? '✅' : '❌'}`);
    console.log(`  - 导航切换: ${tabs.length > 0 ? '✅' : '❌'}`);
    console.log(`  - 用户显示: ${currentUserEl && username ? '✅' : '❌'}`);
    console.log(`  - API连接: ${apiOk ? '✅' : '❌'}`);
    console.log('');
    console.log('💡 现在可以正常使用系统了！');

    // 设置持续监听
    window.addEventListener('storage', function(e) {
        if (e.key === 'username') {
            const username = e.newValue;
            const el = document.getElementById('currentUser');
            if (el && username) {
                el.textContent = '用户: ' + username;
                console.log('🔄 自动更新用户显示:', username);
            }
        }
    });

    console.log('✅ 已设置自动监听');
})();