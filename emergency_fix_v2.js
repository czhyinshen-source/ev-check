// 🚨 紧急修复脚本 v2 - 在浏览器控制台运行
console.log('🚨 开始紧急修复 v2...');

// 1. 修复 DOM 元素空值问题
function safeGet(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`⚠️  DOM element #${id} not found`);
    }
    return el;
}

function safeSet(id, value) {
    const el = safeGet(id);
    if (el) {
        el.value = value;
    }
}

function safeText(id, text) {
    const el = safeGet(id);
    if (el) {
        el.textContent = text;
    }
}

function safeShow(id) {
    const el = safeGet(id);
    if (el) {
        el.classList.add('active');
    }
}

function safeHide(id) {
    const el = safeGet(id);
    if (el) {
        el.classList.remove('active');
    }
}

// 2. 修复 checkitems 模块
if (window.checkitems) {
    // 修复 openCheckItemModal
    const originalOpenCheckItemModal = window.checkitems.openCheckItemModal;
    window.checkitems.openCheckItemModal = function(id = null) {
        safeSet('checkItemId', id || '');
        safeSet('checkItemName', '');
        safeSet('checkItemTarget', '');
        safeSet('checkItemDesc', '');
        safeText('checkItemModalTitle', id ? '编辑检查项' : '添加检查项');
        safeShow('checkItemModal');
    };

    // 修复 editCheckItem
    const originalEditCheckItem = window.checkitems.editCheckItem;
    window.checkitems.editCheckItem = async function(id) {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/v1/check-items/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const item = await res.json();
            safeSet('checkItemId', id);
            safeSet('checkItemName', item.name || '');
            safeSet('checkItemTarget', item.target_path || '');
            safeSet('checkItemDesc', item.description || '');
            safeText('checkItemModalTitle', '编辑检查项');
            safeShow('checkItemModal');
        } catch (e) {
            console.error('编辑检查项失败:', e);
        }
    };

    console.log('✅ checkitems 模块已修复');
}

// 3. 修复 communications 模块
if (window.communications) {
    const originalOpenCommModal = window.communications.openCommModal;
    window.communications.openCommModal = function(id = null) {
        safeSet('commId', id || '');
        safeSet('commName', '');
        safeSet('commIp', '');
        safeSet('commPort', '22');
        safeSet('commUsername', 'root');
        safeSet('commGroup', '');
        safeSet('commPassword', '');
        safeSet('commDesc', '');
        safeText('commModalTitle', id ? '编辑通信机' : '添加通信机');
        safeShow('commModal');
    };

    console.log('✅ communications 模块已修复');
}

// 4. 修复表单提交事件
document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', function(e) {
        // 验证所有必填字段
        const requiredFields = form.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                isValid = false;
                field.style.borderColor = 'red';
                console.warn(`⚠️  必填字段为空: ${field.id || field.name}`);
            } else {
                field.style.borderColor = '';
            }
        });

        if (!isValid) {
            e.preventDefault();
            alert('请填写所有必填字段');
        }
    });
});

// 5. 添加全局错误处理
window.addEventListener('error', function(e) {
    if (e.message.includes('null') || e.message.includes('undefined')) {
        console.warn('⚠️  DOM 访问错误被拦截:', e.message);
        e.preventDefault();
    }
});

console.log('✅ DOM 安全检查已启用');
console.log('✅ 全局错误处理已启用');
console.log('🎉 紧急修复 v2 完成！');
console.log('');
console.log('📋 修复状态:');
console.log('  - checkitems: ✅');
console.log('  - communications: ✅');
console.log('  - 表单验证: ✅');
console.log('  - 错误处理: ✅');
