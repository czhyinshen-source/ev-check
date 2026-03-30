// DOM 工具函数
// 安全获取DOM元素
function $(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`DOM element #${id} not found`);
    }
    return el;
}

// 安全获取并设置值
function $val(id, value) {
    const el = $(id);
    if (el) {
        el.value = value;
    }
    return el;
}

// 安全获取并获取值
function $get(id) {
    const el = $(id);
    return el ? el.value : null;
}

// 安全设置文本内容
function $text(id, text) {
    const el = $(id);
    if (el) {
        el.textContent = text;
    }
    return el;
}

// 安全添加class
function $addClass(id, className) {
    const el = $(id);
    if (el) {
        el.classList.add(className);
    }
    return el;
}

// 安全显示模态框
function $showModal(id) {
    const el = $(id);
    if (el) {
        el.classList.add('active');
    }
}

// 安全隐藏模态框
function $hideModal(id) {
    const el = $(id);
    if (el) {
        el.classList.remove('active');
    }
}

// 导出到全局
window.$ = $;
window.$val = $val;
window.$get = $get;
window.$text = $text;
window.$addClass = $addClass;
window.$showModal = $showModal;
window.$hideModal = $hideModal;
