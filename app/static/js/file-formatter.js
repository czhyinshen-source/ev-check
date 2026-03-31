// 文件信息格式化工具
window.fileFormatter = {
    // 格式化文件权限
    formatPermissions: function(perms) {
        // 将数字权限(如644)转换为符号形式(rw-r--r--)
        if (!perms) return '-';
        const numPerms = parseInt(perms, 10);
        const symbols = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
        let result = '';
        result += symbols[Math.floor(numPerms / 100) % 10];
        result += symbols[Math.floor(numPerms / 10) % 10];
        result += symbols[numPerms % 10];
        return `${result} (${perms})`;
    },

    // 格式化文件大小
    formatFileSize: function(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    // 格式化时间戳
    formatTimestamp: function(timestamp) {
        if (!timestamp) return '-';
        const date = new Date(timestamp * 1000);
        return date.toLocaleString('zh-CN');
    },

    // 判断是否为文件检查项
    isFileCheckItem: function(checkItemType) {
        const fileTypes = [
            'file_exists', 'file_permissions', 'file_owner',
            'file_group', 'file_size', 'file_mtime', 'file_md5'
        ];
        return fileTypes.includes(checkItemType);
    },

    // 格式化文件检查项数据
    formatFileCheckData: function(checkItem, data) {
        const result = {
            filePath: checkItem.target_path || '-',
            checkType: this.getCheckTypeLabel(checkItem.type),
            results: []
        };

        // 根据不同检查类型格式化结果
        switch(checkItem.type) {
            case 'file_exists':
                result.results.push(`状态: ${data.exists ? '文件存在 ✓' : '文件不存在'}`);
                break;
            case 'file_permissions':
                result.results.push(`权限: ${this.formatPermissions(data.permissions)}`);
                break;
            case 'file_owner':
                result.results.push(`所有者: ${data.owner || '-'}`);
                break;
            case 'file_group':
                result.results.push(`属组: ${data.group || '-'}`);
                break;
            case 'file_size':
                result.results.push(`大小: ${this.formatFileSize(data.size)}`);
                break;
            case 'file_mtime':
                result.results.push(`修改时间: ${this.formatTimestamp(data.mtime)}`);
                break;
            case 'file_md5':
                result.results.push(`MD5: ${data.md5 || '-'}`);
                break;
        }

        return result;
    },

    // 获取检查类型标签
    getCheckTypeLabel: function(type) {
        const labels = {
            'file_exists': '📋 文件存在性检查',
            'file_permissions': '🔒 文件权限检查',
            'file_owner': '👤 文件属主检查',
            'file_group': '👥 文件属组检查',
            'file_size': '📏 文件大小检查',
            'file_mtime': '🕐 文件修改时间检查',
            'file_md5': '🔐 文件MD5检查'
        };
        return labels[type] || type;
    },

    // 格式化文件检查项详细数据（仅结果，不显示路径和类型）
    formatFileCheckDataDetailed: function(checkItem, data) {
        const results = [];

        // 根据不同检查类型只返回结果值
        switch(checkItem.type) {
            case 'file_exists':
                results.push(data.exists ? '文件存在 ✓' : '文件不存在');
                break;
            case 'file_permissions':
                results.push(this.formatPermissions(data.permissions));
                break;
            case 'file_owner':
                results.push(data.owner || '-');
                break;
            case 'file_group':
                results.push(data.group || '-');
                break;
            case 'file_size':
                results.push(this.formatFileSize(data.size));
                break;
            case 'file_mtime':
                results.push(this.formatTimestamp(data.mtime));
                break;
            case 'file_md5':
                results.push(data.md5 || '-');
                break;
        }

        return results;
    }
};