// 文件信息格式化工具
window.fileFormatter = {
    // 格式化文件权限
    formatPermissions: function(perms) {
        if (!perms) return '-';
        const numPerms = parseInt(perms, 10);
        if (isNaN(numPerms)) return perms;
        const symbols = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
        let result = '';
        result += symbols[Math.floor(numPerms / 100) % 10];
        result += symbols[Math.floor(numPerms / 10) % 10];
        result += symbols[numPerms % 10];
        return `${result} (${perms})`;
    },

    // 格式化文件大小
    formatFileSize: function(bytes) {
        if (bytes === undefined || bytes === null) return '-';
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    // 格式化时间戳
    formatTimestamp: function(timestamp) {
        if (!timestamp) return '-';
        // 如果后端传的是字符串时间戳，先转换
        const date = new Date(timestamp * 1000);
        if (isNaN(date.getTime())) return timestamp;
        return date.toLocaleString('zh-CN');
    },

    // 判断是否为文件检查项相关的分类
    isFileCheckItem: function(checkItemType) {
        if (!checkItemType) return false;
        const typeStr = String(checkItemType).toLowerCase();
        return typeStr.includes('file') || typeStr.includes('filesystem') 
            || typeStr.includes('kernel_param') || typeStr.includes('route_table');
    },

    // 核心格式化：收集所有可用属性 (用于快照全亮详情)
    formatAllFileAttributes: function(data) {
        if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) return [];
        const results = [];
        
        // 路由表特殊处理
        if (data.route_table !== undefined) {
            results.push(`🗺️ [路由表]\n${data.route_table}`);
            return results;
        }
        
        // 存在性
        if (data.exists !== undefined) {
            results.push(`🔹 [文件状态] ${data.exists ? '文件存在 ✓' : '文件不存在 ✗'}`);
        }
        
        // 如果文件确认不存在，提前返回
        if (data.exists === false) return results;

        // 基础元数据
        if (data.path) results.push(`📂 [路径] ${data.path}`);
        if (data.permissions) results.push(`🔒 [权限] ${this.formatPermissions(data.permissions)}`);
        if (data.owner) results.push(`👤 [属主/组] ${data.owner}:${data.group || '-'}`);
        if (data.size !== undefined && data.size !== null) results.push(`📏 [大小] ${this.formatFileSize(data.size)}`);
        if (data.mtime) results.push(`🕐 [修改时间] ${this.formatTimestamp(data.mtime)}`);
        if (data.md5) results.push(`🔐 [MD5校验] ${data.md5}`);
        
        // 文件内容
        if (data.content !== undefined) {
            const preview = String(data.content).length > 500 
                ? String(data.content).substring(0, 500) + '\n... (已截断)' 
                : String(data.content);
            results.push(`📄 [文件内容]\n${preview}`);
        }
        
        // 内核参数
        if (data.sysctl_value) {
            results.push(`⚙️ [内核参数] ${data.sysctl_value}`);
        }
        
        // 磁盘容量
        if (data.disk_usage) {
            const du = data.disk_usage;
            results.push(`💿 [磁盘卷] ${du.mounted_on || '/'} (${du.use_percent || '-'} 已用, 共 ${this.formatFileSize(du.total)})`);
        }

        return results;
    },

    // 获取检查类型标签
    getCheckTypeLabel: function(type) {
        const labels = {
            'file_exists': '📋 文件存在性',
            'file_permissions': '🔒 文件权限',
            'file_owner': '👤 文件属主',
            'file_group': '👥 文件属组',
            'file_size': '📏 文件大小',
            'file_mtime': '🕐 修改时间',
            'file_md5': '🔐 MD5校验',
            'filesystem': '📁 文件系统采集'
        };
        return labels[type] || type;
    },

    // 与老接口兼容 (仅用于原有的结果摘要显示)
    formatFileCheckDataDetailed: function(checkItem, data) {
        const full = this.formatAllFileAttributes(data);
        if (full.length === 0) return ['-'];
        return full;
    }
};