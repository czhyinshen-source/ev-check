// 用户管理业务逻辑
window.users = {
    init() {
        console.log('👥 用户管理模块初始化...');
        this.checkAdminPrivilege();
        
        // 如果当前是用户管理页签，则加载数据
        if (document.querySelector('.nav-tab[data-tab="users"].active')) {
            this.loadUsers();
        }

        // 绑定重置密码确认按钮
        const confirmBtn = document.getElementById('confirmResetBtn');
        if (confirmBtn) {
            confirmBtn.onclick = () => this.executeResetPassword();
        }
    },

    // 检查是否有管理员权限，如果没有则隐藏入口
    checkAdminPrivilege() {
        const username = localStorage.getItem('username');
        // 注意：真正的权限校验在后端。此处的 role 是为了优化 UI 体验。
        // 我们通过请求 /api/v1/users/me 获取实时角色
        fetch('/api/v1/users/me', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => res.json())
        .then(user => {
            if (user.role === 'admin') {
                const navUsers = document.getElementById('nav-users');
                if (navUsers) navUsers.style.display = 'block';
            }
        })
        .catch(err => console.error('获取用户信息失败:', err));
    },

    // 加载用户列表
    async loadUsers() {
        try {
            const res = await fetch('/api/v1/users', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!res.ok) throw new Error('无权访问用户列表');
            
            const users = await res.json();
            this.renderUserTable(users);
            
            // 更新统计
            document.getElementById('userTotalCount').textContent = users.length;
            document.getElementById('userPendingCount').textContent = users.filter(u => !u.is_active).length;
        } catch (err) {
            console.error(err);
        }
    },

    // 渲染表格
    renderUserTable(users) {
        const tbody = document.getElementById('userTable');
        tbody.innerHTML = '';

        users.forEach(user => {
            const tr = document.createElement('tr');
            const statusClass = user.is_active ? 'text-success' : 'text-warning';
            const statusText = user.is_active ? '● 已激活' : '● 待审核';
            
            tr.innerHTML = `
                <td style="font-weight: 500;">${user.username}</td>
                <td><span class="badge ${user.role === 'admin' ? 'badge-primary' : 'badge-default'}">${user.role === 'admin' ? '管理员' : '操作员'}</span></td>
                <td><span class="${statusClass}">${statusText}</span></td>
                <td style="color: var(--text-dim); font-size: 13px;">${new Date(user.created_at).toLocaleString()}</td>
                <td>
                    <div class="btn-group">
                        ${!user.is_active 
                            ? `<button class="btn btn-success btn-sm" onclick="window.users.toggleStatus(${user.id}, true)">通过审核</button>`
                            : `<button class="btn btn-warning btn-sm" onclick="window.users.toggleStatus(${user.id}, false)">禁用</button>`
                        }
                        <button class="btn btn-primary btn-sm" onclick="window.users.openResetModal(${user.id}, '${user.username}')">重置密码</button>
                        ${user.username !== localStorage.getItem('username') 
                            ? `<button class="btn btn-danger btn-sm" onclick="window.users.deleteUser(${user.id})">删除</button>` 
                            : ''
                        }
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    // 切换状态 (激活/禁用)
    async toggleStatus(userId, status) {
        try {
            const res = await fetch(`/api/v1/users/${userId}/status?is_active=${status}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                alert(status ? '用户已成功激活' : '用户已禁用');
                this.loadUsers();
            }
        } catch (err) {
            alert('操作失败');
        }
    },

    // 删除用户
    async deleteUser(userId) {
        if (!confirm('确定要删除该用户吗？此操作不可撤销。')) return;
        try {
            const res = await fetch(`/api/v1/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                alert('用户已删除');
                this.loadUsers();
            }
        } catch (err) {
            alert('删除失败');
        }
    },

    // 重置密码弹窗
    openResetModal(userId, username) {
        this.currentResetUserId = userId;
        document.getElementById('resetTargetUser').textContent = username;
        document.getElementById('newAdminPassword').value = '';
        document.getElementById('resetPasswordModal').style.display = 'block';
    },

    async executeResetPassword() {
        const newPassword = document.getElementById('newAdminPassword').value;
        if (newPassword.length < 6) {
            alert('密码长度至少需要 6 位');
            return;
        }

        try {
            const res = await fetch(`/api/v1/users/${this.currentResetUserId}/reset-password?new_password=${encodeURIComponent(newPassword)}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                alert('密码重置成功');
                closeModal('resetPasswordModal');
            }
        } catch (err) {
            alert('重置失败');
        }
    }
};

// 监听模块加载完成事件
document.addEventListener('modulesLoaded', () => {
    window.users.init();
});

// 监听页签切换事件
document.addEventListener('click', (e) => {
    const tab = e.target.closest('.nav-tab');
    if (tab && tab.dataset.tab === 'users') {
        window.users.loadUsers();
    }
});
