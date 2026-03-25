        const API_BASE = '';
        let token = localStorage.getItem('token');
        let currentSnapshotGroupId = '';

        if (!token) window.location.href = '/login.html';
        document.getElementById('currentUser').textContent = '用户: ' + (localStorage.getItem('username') || '未知');

        // logout 和 getHeaders 在 shared.js 中定义
        const { getHeaders, logout, closeModal } = window.shared;
        
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.tab).classList.add('active');
            });
        });
        
        async function refreshData() {
            await Promise.all([
                window.communications.loadCommunications(),
                loadCheckItemLists(),
                loadCheckItems(),
                window.snapshots.loadSnapshots(),
                window.checks?.loadCheckResults?.() || Promise.resolve(),
                window.reports?.loadReports?.() || Promise.resolve(),
                loadStats(),
                window.communications.loadGroups()
            ]);
        }
        
        async function loadStats() {
            try {
                const [commRes, itemRes, snapRes] = await Promise.all([
                    fetch(`${API_BASE}/api/v1/communications`, { headers: getHeaders() }),
                    fetch(`${API_BASE}/api/v1/check-items`, { headers: getHeaders() }),
                    fetch(`${API_BASE}/api/v1/snapshots`, { headers: getHeaders() })
                ]);
                const comms = await commRes.json();
                const items = await itemRes.json();
                const snaps = await snapRes.json();
                
                const commCountEl = document.getElementById('commCount');
                const checkItemCountEl = document.getElementById('checkItemCount');
                const snapshotCountEl = document.getElementById('snapshotCount');
                
                if (commCountEl) commCountEl.textContent = comms.length;
                if (checkItemCountEl) checkItemCountEl.textContent = items.length;
                if (snapshotCountEl) snapshotCountEl.textContent = snaps.length;
            } catch (e) { console.error(e); }
        }

        // loadGroups, filterByGroup, loadCommunications, searchCommunications 在 communications.js 中定义

          // loadCheckResults 和 loadCurrentTask 在 checks.js 中定义

        async function loadSSHKeys() {
            try {
                const res = await fetch(`${API_BASE}/api/v1/keys`, { headers: getHeaders() });
                const data = await res.json();
                const tbody = document.getElementById('sshKeyTable');
                tbody.innerHTML = data.map(k => `
                    <tr>
                        <td>${k.id}</td>
                        <td>${k.name}</td>
                        <td><code style="font-size:11px">${k.public_key ? k.public_key.substring(0, 50) + '...' : '-'}</code></td>
                        <td><span class="status-badge ${k.is_active ? 'success' : 'error'}">${k.is_active ? '启用' : '禁用'}</span></td>
                        <td>${new Date(k.created_at).toLocaleString()}</td>
                        <td><button class="btn btn-danger btn-sm" onclick="deleteSSHKey(${k.id})">删除</button></td>
                    </tr>
                `).join('');
            } catch (e) { console.error(e); }
        }
        
  // loadGroupOptions, loadSSHKeysForSelect, toggleAuthFields 在 communications.js 中定义

                }

                const deployResponse = await fetch(`${API_BASE}/api/v1/deploy-ssh-key`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        communication_id: commData.id || id,
                        ssh_key_id: privateKeyEl.value,
                        password: deployPassword
                    })
                });

                const deployResult = await deployResponse.json();
                if (deployResult.status === 'error') {
                    alert('公钥部署失败: ' + deployResult.message);
                    return;
                } else {
                    alert('公钥部署成功！');
                }
            }

            closeModal('commModal');
            window.communications.loadCommunications();
        });

        // openExcelImportModal, toggleDeployFields, openBatchDeployModal 在 communications.js 中定义

        // 处理 Excel 导入表单提交
        document.getElementById('excelImportForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Excel导入表单提交开始');
            
            const fileInput = document.getElementById('excelFile');
            const deployPublicKey = document.getElementById('deployPublicKey').checked;
            const sshKeyId = document.getElementById('excelSshKey').value;
            const deployPassword = document.getElementById('deployPassword').value;

            console.log('文件选择:', fileInput.files.length > 0 ? '已选择' : '未选择');
            console.log('部署公钥:', deployPublicKey);
            console.log('SSH密钥ID:', sshKeyId);
            console.log('部署密码:', deployPassword ? '已输入' : '未输入');

            if (!fileInput.files.length) {
                alert('请选择 Excel 文件');
                return;
            }

            if (deployPublicKey && (!sshKeyId || !deployPassword)) {
                alert('请选择 SSH 密钥并输入部署密码');
                return;
            }

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('deploy_public_key', deployPublicKey);
            if (deployPublicKey) {
                formData.append('ssh_key_id', sshKeyId);
                formData.append('deploy_password', deployPassword);
            }

            console.log('FormData准备完成，开始发送请求');

            try {
                console.log('API地址:', `${API_BASE}/api/v1/communications/import-excel`);
                console.log('Token:', localStorage.getItem('token') ? '已存在' : '不存在');
                
                const response = await fetch(`${API_BASE}/api/v1/communications/import-excel`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: formData
                });
                
                console.log('响应状态:', response.status);
                
                const result = await response.json();
                console.log('响应数据:', result);
                
                if (response.ok) {
                    alert(`✅ 导入成功！导入 ${result.imported} 台通信机`);
                    if (deployPublicKey && result.deployment) {
                        alert(`✅ 公钥部署结果：成功 ${result.deployment.success.length} 台，失败 ${result.deployment.failed.length} 台`);
                    }
                    closeModal('excelImportModal');
                    window.communications.loadCommunications();
                } else {
                    alert(`❌ 导入失败：${result.detail || '未知错误'}`);
                }
            } catch (e) {
                console.error('导入失败:', e);
                alert('❌ 导入失败，请重试');
            }
        });

        // 处理批量部署公钥表单提交
        document.getElementById('batchDeployForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const sshKeyId = document.getElementById('batchSshKey').value;
            const deployPassword = document.getElementById('batchDeployPassword').value;
            const checkboxes = document.querySelectorAll('input[name="commId"]:checked');
            const commIds = Array.from(checkboxes).map(cb => cb.value);

            if (!sshKeyId) {
                alert('请选择 SSH 密钥');
                return;
            }

            if (!deployPassword) {
                alert('请输入部署密码');
                return;
            }

            if (commIds.length === 0) {
                alert('请选择至少一台通信机');
                return;
            }

            try {
                const response = await fetch(`${API_BASE}/api/v1/communications/batch-deploy-ssh-key`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({
                        communication_ids: commIds,
                        ssh_key_id: sshKeyId,
                        password: deployPassword
                    })
                });
                
                const result = await response.json();
                if (response.ok) {
                    alert(`✅ 批量部署完成！成功 ${result.success.length} 台，失败 ${result.failed.length} 台`);
                    closeModal('batchDeployModal');
                } else {
                    alert(`❌ 部署失败：${result.detail || '未知错误'}`);
                }
            } catch (e) {
                console.error('部署失败:', e);
                alert('❌ 部署失败，请重试');
            }
        });

        // downloadExcelTemplate, testConnection, checkAllCommunicationStatuses 在 communications.js 中定义

        function openSSHKeyModal() {
            document.getElementById('sshKeyModal').classList.add('active');
        }
        
        document.getElementById('sshKeyForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                name: document.getElementById('sshKeyName').value,
                key_type: document.getElementById('sshKeyType').value,
                key_size: parseInt(document.getElementById('sshKeySize').value),
                passphrase: document.getElementById('sshKeyPassphrase').value || null,
                description: document.getElementById('sshKeyDesc').value || null
            };
            const res = await fetch(`${API_BASE}/api/v1/keys/generate`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (res.ok) {
                alert('✅ 密钥生成成功！\n公钥: ' + result.public_key);
                closeModal('sshKeyModal');
                loadSSHKeys();
            } else {
                alert('❌ 生成失败: ' + result.detail);
            }
        });
        
        async function deleteSSHKey(id) {
            if (!confirm('确定删除?')) return;
            await fetch(`${API_BASE}/api/v1/keys/${id}`, { method: 'DELETE', headers: getHeaders() });
            loadSSHKeys();
        }
        
        function openGroupModal() {
            document.getElementById('groupModal').classList.add('active');
        }
        
        document.getElementById('groupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                name: document.getElementById('groupName').value,
                description: document.getElementById('groupDesc').value || null
            };
            await fetch(`${API_BASE}/api/v1/communications/groups`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });
            closeModal('groupModal');
            loadGroups();
            loadGroupOptions();
        });
        
        document.getElementById('checkItemForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('checkItemId').value;

            // 获取检查项分类
            const category = document.getElementById('checkItemCategory').value;
            if (!category) {
                alert('请选择检查项分类');
                return;
            }

            let checkType = [];
            let targetPath = '';
            let checkAttributes = {};

            // 根据分类构建检查项数据
            if (category === 'file') {
                // 文件/目录检查
                targetPath = document.getElementById('filePath').value;
                if (!targetPath) {
                    alert('请输入文件/目录路径');
                    return;
                }

                checkType = ['file_exists']; // 基础：存在性检查

                // 修改时间检查
                if (document.getElementById('checkFileMtime').checked) {
                    checkType.push('file_mtime');
                    const compareMode = document.getElementById('fileMtimeCompareMode').value;
                    checkAttributes.mtime = {
                        compare_mode: compareMode,
                        start_time: compareMode === 'specified' ? document.getElementById('fileMtimeStart').value : null,
                        end_time: compareMode === 'specified' ? document.getElementById('fileMtimeEnd').value : null
                    };
                }

                // 大小检查
                if (document.getElementById('checkFileSize').checked) {
                    checkType.push('file_size');
                    const compareMode = document.getElementById('fileSizeCompareMode').value;
                    checkAttributes.size = {
                        compare_mode: compareMode,
                        min_size: compareMode === 'specified' ? parseInt(document.getElementById('fileSizeMin').value) || 0 : null,
                        max_size: compareMode === 'specified' ? parseInt(document.getElementById('fileSizeMax').value) || 0 : null
                    };
                }

                // 属主检查
                if (document.getElementById('checkFileOwner').checked) {
                    checkType.push('file_owner');
                    const compareMode = document.getElementById('fileOwnerCompareMode').value;
                    checkAttributes.owner = {
                        compare_mode: compareMode,
                        owner: compareMode === 'specified' ? document.getElementById('fileOwnerValue').value : null
                    };
                }

                // 属组检查
                if (document.getElementById('checkFileGroup').checked) {
                    checkType.push('file_group');
                    const compareMode = document.getElementById('fileGroupCompareMode').value;
                    checkAttributes.group = {
                        compare_mode: compareMode,
                        group: compareMode === 'specified' ? document.getElementById('fileGroupValue').value : null
                    };
                }

                // 权限检查
                if (document.getElementById('checkFilePermissions').checked) {
                    checkType.push('file_permissions');
                    const compareMode = document.getElementById('filePermissionsCompareMode').value;
                    checkAttributes.permissions = {
                        compare_mode: compareMode,
                        permissions: compareMode === 'specified' ? document.getElementById('filePermissionsValue').value : null
                    };
                }

                // MD5检查
                if (document.getElementById('checkFileMd5').checked) {
                    checkType.push('file_md5');
                    const compareMode = document.getElementById('fileMd5CompareMode').value;
                    checkAttributes.md5 = {
                        compare_mode: compareMode,
                        md5_value: compareMode === 'specified' ? document.getElementById('fileMd5Value').value : null
                    };
                }

            } else if (category === 'content') {
                // 文件内容检查
                targetPath = document.getElementById('contentFilePath').value;
                if (!targetPath) {
                    alert('请输入文件路径');
                    return;
                }

                const fileType = document.getElementById('contentFileType').value;

                if (fileType === 'text') {
                    // 普通文本文件
                    checkType = ['file_content'];
                    const compareMode = document.getElementById('textCompareMode').value;
                    checkAttributes.content = {
                        file_type: 'text',
                        compare_mode: compareMode,
                        content: (compareMode === 'partial' || compareMode === 'contains' || compareMode === 'not_contains')
                            ? document.getElementById('textContent').value : null
                    };
                } else {
                    // 内核参数文件
                    checkType = ['kernel_param'];
                    const compareMode = document.getElementById('kernelCompareMode').value;
                    checkAttributes.kernel = {
                        compare_mode: compareMode,
                        param_value: compareMode === 'specified' ? document.getElementById('kernelParamValue').value : null
                    };
                }

            } else if (category === 'route') {
                // 路由表检查
                checkType = ['route_table'];
                targetPath = ''; // 路由表不需要路径

                const mode = document.getElementById('routeTableMode').value;
                checkAttributes.route = {
                    mode: mode,
                    route_rule: mode === 'check' ? document.getElementById('routeRule').value : null
                };
            }

            const data = {
                name: document.getElementById('checkItemName').value,
                type: checkType,
                target_path: targetPath,
                check_attributes: checkAttributes,
                description: document.getElementById('checkItemDesc').value || null,
                // 如果当前选中了检查项列表，则关联到该列表
                list_id: currentCheckItemListId ? parseInt(currentCheckItemListId) : null
            };
            const url = id ? `${API_BASE}/api/v1/check-items/${id}` : `${API_BASE}/api/v1/check-items`;
            const method = id ? 'PUT' : 'POST';

            try {
                const response = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(data) });
                if (!response.ok) {
                    throw new Error('创建检查项失败');
                }

                closeModal('checkItemModal');
                loadCheckItems();
            } catch (e) {
                console.error(e);
                alert('❌ 保存检查项失败，请重试');
            }
        });
        
        document.getElementById('checkItemListForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('checkItemListId').value;
            
            const data = {
                name: document.getElementById('checkItemListName').value,
                description: document.getElementById('checkItemListDesc').value || null
            };
            
            const url = id ? `${API_BASE}/api/v1/check-items/lists/${id}` : `${API_BASE}/api/v1/check-items/lists`;
            const method = id ? 'PUT' : 'POST';
            
            try {
                const response = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(data) });
                if (!response.ok) {
                    const error = await response.json();
                    if (response.status === 400 && error.detail && error.detail.includes('名称已存在')) {
                        alert('❌ 检查项列表名称已存在，请使用其他名称');
                    } else if (response.status === 422) {
                        alert('❌ 输入数据有误，请检查后重试');
                    } else {
                        alert('❌ 创建失败: ' + (error.detail || '未知错误'));
                    }
                    return;
                }
                closeModal('checkItemListModal');
                loadCheckItemLists();
            } catch (e) {
                console.error(e);
                alert('❌ 网络错误，请稍后重试');
            }
        });
        
        document.getElementById('snapshotForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                name: document.getElementById('snapshotName').value,
                group_id: parseInt(document.getElementById('snapshotGroup').value),
                is_default: document.getElementById('snapshotDefault').checked,
                description: document.getElementById('snapshotDesc').value || null
            };
            await fetch(`${API_BASE}/api/v1/snapshots`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });
            closeModal('snapshotModal');
            window.snapshots.loadSnapshots();
        });
        
        document.getElementById('checkForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await startCheck();
        });
        
            document.getElementById('checkItemId').value = '';
            document.getElementById('checkItemCategory').value = '';
            document.getElementById('checkItemName').value = '';
            document.getElementById('checkItemDesc').value = '';

            // 重置文件/目录检查字段
            document.getElementById('filePath').value = '';
            document.getElementById('checkFileMtime').checked = false;
            document.getElementById('checkFileSize').checked = false;
            document.getElementById('checkFileOwner').checked = false;
            document.getElementById('checkFileGroup').checked = false;
            document.getElementById('checkFilePermissions').checked = false;
            document.getElementById('checkFileMd5').checked = false;

            // 重置文件内容检查字段
            document.getElementById('contentFilePath').value = '';
            document.getElementById('contentFileType').value = 'text';
            document.getElementById('textCompareMode').value = 'full';
            document.getElementById('textContent').value = '';
            document.getElementById('kernelCompareMode').value = 'snapshot';
            document.getElementById('kernelParamValue').value = '';

            // 重置路由表检查字段
            document.getElementById('routeTableMode').value = 'full';
            document.getElementById('routeRule').value = '';

            // 显示对应的字段
            toggleCheckItemCategory();
            toggleCheckItemFields();
            toggleContentCheckFields();
            toggleTextCompareFields();
            toggleKernelCompareFields();
            toggleRouteCheckFields();

            document.getElementById('checkItemModalTitle').textContent = '添加检查项';
            document.getElementById('checkItemModal').classList.add('active');
        }
        
                const res = await fetch(`${API_BASE}/api/v1/check-items/${id}`, { headers: getHeaders() });
                const item = await res.json();

                // 打开模态框并预填信息
                document.getElementById('checkItemId').value = id;
                document.getElementById('checkItemName').value = item.name;
                document.getElementById('checkItemDesc').value = item.description || '';

                const types = Array.isArray(item.type) ? item.type : [item.type];

                // 判断检查项分类
                let category = '';
                if (types.includes('file_exists') || types.includes('file_mtime') || types.includes('file_size')
                    || types.includes('file_owner') || types.includes('file_group') || types.includes('file_permissions')
                    || types.includes('file_md5')) {
                    category = 'file';
                } else if (types.includes('file_content') || types.includes('kernel_param')) {
                    category = 'content';
                } else if (types.includes('route_table')) {
                    category = 'route';
                }
                document.getElementById('checkItemCategory').value = category;
                toggleCheckItemCategory();

                // 根据分类填充字段
                if (category === 'file') {
                    // 文件/目录检查
                    document.getElementById('filePath').value = item.target_path || '';

                    // 修改时间
                    document.getElementById('checkFileMtime').checked = types.includes('file_mtime');
                    if (item.check_attributes?.mtime) {
                        document.getElementById('fileMtimeCompareMode').value = item.check_attributes.mtime.compare_mode || 'snapshot';
                        document.getElementById('fileMtimeStart').value = item.check_attributes.mtime.start_time || '';
                        document.getElementById('fileMtimeEnd').value = item.check_attributes.mtime.end_time || '';
                    }

                    // 大小
                    document.getElementById('checkFileSize').checked = types.includes('file_size');
                    if (item.check_attributes?.size) {
                        document.getElementById('fileSizeCompareMode').value = item.check_attributes.size.compare_mode || 'snapshot';
                        document.getElementById('fileSizeMin').value = item.check_attributes.size.min_size || '';
                        document.getElementById('fileSizeMax').value = item.check_attributes.size.max_size || '';
                    }

                    // 属主
                    document.getElementById('checkFileOwner').checked = types.includes('file_owner');
                    if (item.check_attributes?.owner) {
                        document.getElementById('fileOwnerCompareMode').value = item.check_attributes.owner.compare_mode || 'snapshot';
                        document.getElementById('fileOwnerValue').value = item.check_attributes.owner.owner || '';
                    }

                    // 属组
                    document.getElementById('checkFileGroup').checked = types.includes('file_group');
                    if (item.check_attributes?.group) {
                        document.getElementById('fileGroupCompareMode').value = item.check_attributes.group.compare_mode || 'snapshot';
                        document.getElementById('fileGroupValue').value = item.check_attributes.group.group || '';
                    }

                    // 权限
                    document.getElementById('checkFilePermissions').checked = types.includes('file_permissions');
                    if (item.check_attributes?.permissions) {
                        document.getElementById('filePermissionsCompareMode').value = item.check_attributes.permissions.compare_mode || 'snapshot';
                        document.getElementById('filePermissionsValue').value = item.check_attributes.permissions.permissions || '';
                    }

                    // MD5
                    document.getElementById('checkFileMd5').checked = types.includes('file_md5');
                    if (item.check_attributes?.md5) {
                        document.getElementById('fileMd5CompareMode').value = item.check_attributes.md5.compare_mode || 'snapshot';
                        document.getElementById('fileMd5Value').value = item.check_attributes.md5.md5_value || '';
                    }

                } else if (category === 'content') {
                    // 文件内容检查
                    document.getElementById('contentFilePath').value = item.target_path || '';

                    if (types.includes('file_content')) {
                        // 普通文本文件
                        document.getElementById('contentFileType').value = 'text';
                        if (item.check_attributes?.content) {
                            document.getElementById('textCompareMode').value = item.check_attributes.content.compare_mode || 'full';
                            document.getElementById('textContent').value = item.check_attributes.content.content || '';
                        }
                    } else if (types.includes('kernel_param')) {
                        // 内核参数文件
                        document.getElementById('contentFileType').value = 'kernel';
                        if (item.check_attributes?.kernel) {
                            document.getElementById('kernelCompareMode').value = item.check_attributes.kernel.compare_mode || 'snapshot';
                            document.getElementById('kernelParamValue').value = item.check_attributes.kernel.param_value || '';
                        }
                    }

                } else if (category === 'route') {
                    // 路由表检查
                    if (item.check_attributes?.route) {
                        document.getElementById('routeTableMode').value = item.check_attributes.route.mode || 'full';
                        document.getElementById('routeRule').value = item.check_attributes.route.route_rule || '';
                    }
                }

                toggleCheckItemFields();
                toggleContentCheckFields();
                toggleTextCompareFields();
                toggleKernelCompareFields();
                toggleRouteCheckFields();

                document.getElementById('checkItemModalTitle').textContent = '编辑检查项';
                document.getElementById('checkItemModal').classList.add('active');
            } catch (e) {
                console.error(e);
                alert('❌ 编辑异常');
            }
        }
        
                const res = await fetch(`${API_BASE}/api/v1/check-items/${id}`, { headers: getHeaders() });
                const item = await res.json();

                // 打开模态框并预填信息（与编辑相同）
                document.getElementById('checkItemId').value = '';
                document.getElementById('checkItemName').value = `${item.name} (复制)`;
                document.getElementById('checkItemDesc').value = item.description || '';

                const types = Array.isArray(item.type) ? item.type : [item.type];

                // 判断检查项分类
                let category = '';
                if (types.includes('file_exists') || types.includes('file_mtime') || types.includes('file_size')
                    || types.includes('file_owner') || types.includes('file_group') || types.includes('file_permissions')
                    || types.includes('file_md5')) {
                    category = 'file';
                } else if (types.includes('file_content') || types.includes('kernel_param')) {
                    category = 'content';
                } else if (types.includes('route_table')) {
                    category = 'route';
                }
                document.getElementById('checkItemCategory').value = category;
                toggleCheckItemCategory();

                // 根据分类填充字段
                if (category === 'file') {
                    document.getElementById('filePath').value = item.target_path || '';
                    document.getElementById('checkFileMtime').checked = types.includes('file_mtime');
                    if (item.check_attributes?.mtime) {
                        document.getElementById('fileMtimeCompareMode').value = item.check_attributes.mtime.compare_mode || 'snapshot';
                        document.getElementById('fileMtimeStart').value = item.check_attributes.mtime.start_time || '';
                        document.getElementById('fileMtimeEnd').value = item.check_attributes.mtime.end_time || '';
                    }
                    document.getElementById('checkFileSize').checked = types.includes('file_size');
                    if (item.check_attributes?.size) {
                        document.getElementById('fileSizeCompareMode').value = item.check_attributes.size.compare_mode || 'snapshot';
                        document.getElementById('fileSizeMin').value = item.check_attributes.size.min_size || '';
                        document.getElementById('fileSizeMax').value = item.check_attributes.size.max_size || '';
                    }
                    document.getElementById('checkFileOwner').checked = types.includes('file_owner');
                    if (item.check_attributes?.owner) {
                        document.getElementById('fileOwnerCompareMode').value = item.check_attributes.owner.compare_mode || 'snapshot';
                        document.getElementById('fileOwnerValue').value = item.check_attributes.owner.owner || '';
                    }
                    document.getElementById('checkFileGroup').checked = types.includes('file_group');
                    if (item.check_attributes?.group) {
                        document.getElementById('fileGroupCompareMode').value = item.check_attributes.group.compare_mode || 'snapshot';
                        document.getElementById('fileGroupValue').value = item.check_attributes.group.group || '';
                    }
                    document.getElementById('checkFilePermissions').checked = types.includes('file_permissions');
                    if (item.check_attributes?.permissions) {
                        document.getElementById('filePermissionsCompareMode').value = item.check_attributes.permissions.compare_mode || 'snapshot';
                        document.getElementById('filePermissionsValue').value = item.check_attributes.permissions.permissions || '';
                    }
                    document.getElementById('checkFileMd5').checked = types.includes('file_md5');
                    if (item.check_attributes?.md5) {
                        document.getElementById('fileMd5CompareMode').value = item.check_attributes.md5.compare_mode || 'snapshot';
                        document.getElementById('fileMd5Value').value = item.check_attributes.md5.md5_value || '';
                    }
                } else if (category === 'content') {
                    document.getElementById('contentFilePath').value = item.target_path || '';
                    if (types.includes('file_content')) {
                        document.getElementById('contentFileType').value = 'text';
                        if (item.check_attributes?.content) {
                            document.getElementById('textCompareMode').value = item.check_attributes.content.compare_mode || 'full';
                            document.getElementById('textContent').value = item.check_attributes.content.content || '';
                        }
                    } else if (types.includes('kernel_param')) {
                        document.getElementById('contentFileType').value = 'kernel';
                        if (item.check_attributes?.kernel) {
                            document.getElementById('kernelCompareMode').value = item.check_attributes.kernel.compare_mode || 'snapshot';
                            document.getElementById('kernelParamValue').value = item.check_attributes.kernel.param_value || '';
                        }
                    }
                } else if (category === 'route') {
                    if (item.check_attributes?.route) {
                        document.getElementById('routeTableMode').value = item.check_attributes.route.mode || 'full';
                        document.getElementById('routeRule').value = item.check_attributes.route.route_rule || '';
                    }
                }

                toggleCheckItemFields();
                toggleContentCheckFields();
                toggleTextCompareFields();
                toggleKernelCompareFields();
                toggleRouteCheckFields();

                document.getElementById('checkItemModalTitle').textContent = '克隆检查项';
                document.getElementById('checkItemModal').classList.add('active');
            } catch (e) {
                console.error(e);
                alert('❌ 克隆异常');
            }
        }
        
            await fetch(`${API_BASE}/api/v1/check-items/${id}`, { method: 'DELETE', headers: getHeaders() });
            loadCheckItems();
        }
        
          
                
        function closeModal(id) {
            document.getElementById(id).classList.remove('active');
        }

        // ========== 缺失的函数 ==========

    
        // ========== 全局函数导出 ==========
        // 将所有在HTML中通过内联事件调用的函数挂载到window对象
        window.logout = logout;
        window.refreshData = refreshData;
        window.openGroupModal = openGroupModal;
        window.closeModal = closeModal;
        window.filterByGroup = filterByGroup;
        window.searchCommunications = searchCommunications;
        window.openCommModal = openCommModal;
        window.openExcelImportModal = openExcelImportModal;
        window.openBatchDeployModal = openBatchDeployModal;
        window.downloadExcelTemplate = downloadExcelTemplate;
          window.openCheckModal = () => window.checks.openCheckModal();
        window.openSSHKeyModal = openSSHKeyModal;
        window.loadSSHKeys = loadSSHKeys;
                window.toggleAuthFields = toggleAuthFields;
        window.toggleDeployFields = toggleDeployFields;

        refreshData();
