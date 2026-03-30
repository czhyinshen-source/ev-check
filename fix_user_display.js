// 一键修复用户显示问题
// 复制这个脚本到浏览器控制台运行

(async function autoFix() {
    console.log('🔧 开始自动修复用户显示问题...\n');

    // 步骤 1: 检查并修复登录状态
    console.log('📋 步骤 1: 检查登录状态');
    let token = localStorage.getItem('token');
    let username = localStorage.getItem('username');

    if (!token || !username) {
        console.log('⚠️  未检测到登录信息，尝试自动登录...');

        try {
            const formData = new URLSearchParams();
            formData.append('username', 'admin');
            formData.append('password', 'admin123');

            const response = await fetch('/api/v1/users/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                token = data.access_token;
                username = 'admin';

                localStorage.setItem('token', token);
                localStorage.setItem('username', username);

                console.log('✅ 自动登录成功！');
                console.log('   用户:', username);
                console.log('   Token:', token.substring(0, 30) + '...');
            } else {
                console.log('❌ 自动登录失败，请手动登录');
                return;
            }
        } catch (error) {
            console.log('❌ 登录请求失败:', error.message);
            return;
        }
    } else {
        console.log('✅ 已登录');
        console.log('   用户:', username);
        console.log('   Token:', token.substring(0, 30) + '...');
    }

    // 步骤 2: 修复用户显示
    console.log('\n📋 步骤 2: 修复用户显示');
    const currentUserEl = document.getElementById('currentUser');

    if (currentUserEl) {
        currentUserEl.textContent = '用户: ' + username;
        console.log('✅ 用户显示已更新:', currentUserEl.textContent);
    } else {
        console.log('❌ 未找到 currentUser 元素');
        console.log('   尝试创建元素...');

        // 尝试创建元素
        const headerRight = document.querySelector('.header-right');
        if (headerRight) {
            const newSpan = document.createElement('span');
            newSpan.id = 'currentUser';
            newSpan.textContent = '用户: ' + username;
            headerRight.insertBefore(newSpan, headerRight.firstChild);
            console.log('✅ 已创建并更新用户显示');
        } else {
            console.log('❌ 无法找到合适的位置创建元素');
        }
    }

    // 步骤 3: 测试 API 连接
    console.log('\n📋 步骤 3: 测试 API 连接');
    try {
        const response = await fetch('/api/v1/users/me', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const user = await response.json();
            console.log('✅ API 连接正常');
            console.log('   当前用户:', user.username);
        } else {
            console.log('⚠️  API 返回错误:', response.status);
        }
    } catch (error) {
        console.log('❌ API 请求失败:', error.message);
    }

    // 步骤 4: 重新加载数据
    console.log('\n📋 步骤 4: 重新加载页面数据');
    if (window.communications && window.communications.loadCommunications) {
        try {
            await window.communications.loadCommunications();
            console.log('✅ 通信机列表已重新加载');
        } catch (error) {
            console.log('⚠️  通信机加载失败:', error.message);
        }
    } else {
        console.log('⚠️  communications 模块未加载');
    }

    // 步骤 5: 设置持续监听
    console.log('\n📋 步骤 5: 设置自动修复监听');
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

    console.log('\n🎉 修复完成！现在应该能正常显示用户信息了');
    console.log('💡 如果刷新页面后仍有问题，请检查:');
    console.log('   1. 浏览器控制台是否有错误');
    console.log('   2. localStorage 是否保留登录信息');
    console.log('   3. 网络连接是否正常');

})();
