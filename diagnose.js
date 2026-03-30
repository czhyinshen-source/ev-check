// 诊断脚本 - 在浏览器控制台运行
(async function diagnose() {
    console.log('🔍 开始诊断...');

    const token = localStorage.getItem('token');
    if (!token) {
        console.error('❌ 未登录');
        return;
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    // 测试各个 API 端点
    const endpoints = [
        '/api/v1/users/me',
        '/api/v1/communications',
        '/api/v1/check-items/lists',
        '/api/v1/check-items',
        '/api/v1/snapshots/groups'
    ];

    for (const endpoint of endpoints) {
        try {
            const res = await fetch(endpoint, { headers });
            console.log(`${endpoint}: ${res.status} ${res.statusText}`);
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                console.log(`  错误: ${JSON.stringify(error)}`);
            }
        } catch (e) {
            console.log(`${endpoint}: ❌ ${e.message}`);
        }
    }

    // 检查 DOM 元素
    console.log('\n检查 DOM 元素:');
    const elements = [
        'checkItemListTree',
        'checkItemTable',
        'commTable',
        'groupTree'
    ];

    elements.forEach(id => {
        const el = document.getElementById(id);
        console.log(`#${id}: ${el ? '✅ 存在' : '❌ 不存在'}`);
    });

    // 检查模块
    console.log('\n检查 JS 模块:');
    const modules = ['shared', 'communications', 'checkitems', 'snapshots'];
    modules.forEach(name => {
        const mod = window[name];
        console.log(`${name}: ${mod ? '✅ 存在' : '❌ 不存在'}`);
        if (mod) {
            const functions = ['loadCommunications', 'loadCheckItemLists', 'loadSnapshots'];
            functions.forEach(fn => {
                console.log(`  ${fn}: ${typeof mod[fn] === 'function' ? '✅' : '❌'}`);
            });
        }
    });

    console.log('\n🔍 诊断完成');
})();
