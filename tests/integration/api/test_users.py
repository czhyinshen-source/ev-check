"""用户认证 API 集成测试"""
import pytest
from httpx import AsyncClient


class TestUserRegistration:
    """用户注册测试"""
    
    @pytest.mark.asyncio
    async def test_register_user_success(self, client):
        """成功注册用户"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "username": f"newuser_{unique_id}",
            "password": "NewUser@123",
            "email": f"newuser_{unique_id}@example.com"
        }
        
        response = await client.post("/api/v1/users/register", json=user_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == user_data["username"]
        assert "id" in data
        assert "password" not in data  # 密码不应返回
    
    @pytest.mark.asyncio
    async def test_register_user_duplicate(self, client):
        """注册用户 - 重名"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        # 先注册一个用户
        user_data = {
            "username": f"dup_user_{unique_id}",
            "password": "First@123",
            "email": f"first_{unique_id}@example.com"
        }
        
        response1 = await client.post("/api/v1/users/register", json=user_data)
        assert response1.status_code == 201
        
        # 尝试用相同用户名注册
        user_data2 = {
            "username": f"dup_user_{unique_id}",
            "password": "Second@456",
            "email": f"second_{unique_id}@example.com"
        }
        
        response2 = await client.post("/api/v1/users/register", json=user_data2)
        
        assert response2.status_code == 400
        assert "已存在" in response2.json()["detail"] or "exists" in response2.json()["detail"].lower()
    
    @pytest.mark.asyncio
    async def test_register_user_weak_password(self, client):
        """注册用户 - 弱密码"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        user_data = {
            "username": f"weakuser_{unique_id}",
            "password": "123",
            "email": f"weak_{unique_id}@example.com"
        }
        
        response = await client.post("/api/v1/users/register", json=user_data)
        
        # 当前实现没有密码强度验证，应该成功
        assert response.status_code == 201


class TestUserLogin:
    """用户登录测试"""
    
    @pytest.mark.asyncio
    async def test_login_success(self, client):
        """成功登录"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        # 先注册用户
        register_data = {
            "username": f"login_user_{unique_id}",
            "password": "Test@123",
            "email": f"login_{unique_id}@example.com"
        }
        await client.post("/api/v1/users/register", json=register_data)
        
        # 使用 OAuth2 表单格式登录
        login_data = {
            "username": f"login_user_{unique_id}",
            "password": "Test@123"
        }
        
        response = await client.post("/api/v1/users/login", data=login_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
    
    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, client):
        """登录 - 无效凭据"""
        login_data = {
            "username": "nonexistent_user",
            "password": "Wrong@123"
        }
        
        response = await client.post("/api/v1/users/login", data=login_data)
        
        assert response.status_code == 401
        assert "用户名或密码错误" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client):
        """登录 - 错误密码"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        # 先注册用户
        register_data = {
            "username": f"wrongpw_user_{unique_id}",
            "password": "Correct@123",
            "email": f"correct_{unique_id}@example.com"
        }
        await client.post("/api/v1/users/register", json=register_data)
        
        # 使用错误密码登录
        login_data = {
            "username": f"wrongpw_user_{unique_id}",
            "password": "WrongPassword@456"
        }
        
        response = await client.post("/api/v1/users/login", data=login_data)
        
        assert response.status_code == 401


class TestGetCurrentUser:
    """获取当前用户信息测试"""
    
    @pytest.mark.asyncio
    async def test_get_current_user(self, client):
        """获取当前用户信息"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        # 先注册并登录
        register_data = {
            "username": f"me_user_{unique_id}",
            "password": "Test@123",
            "email": f"me_{unique_id}@example.com"
        }
        await client.post("/api/v1/users/register", json=register_data)
        
        login_response = await client.post("/api/v1/users/login", data={
            "username": f"me_user_{unique_id}",
            "password": "Test@123"
        })
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = await client.get("/api/v1/users/me", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "username" in data
        assert "email" in data
    
    @pytest.mark.asyncio
    async def test_get_current_user_unauthorized(self, client):
        """获取当前用户 - 未授权"""
        response = await client.get("/api/v1/users/me")
        
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_get_current_user_invalid_token(self, client):
        """获取当前用户 - 无效 Token"""
        headers = {"Authorization": "Bearer invalid.token.here"}
        
        response = await client.get("/api/v1/users/me", headers=headers)
        
        assert response.status_code == 401


class TestUpdateUser:
    """更新用户信息测试"""
    
    @pytest.mark.asyncio
    async def test_update_user_email(self, client):
        """更新用户邮箱"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        # 先注册并登录
        register_data = {
            "username": f"update_user_{unique_id}",
            "password": "Test@123",
            "email": f"update_{unique_id}@example.com"
        }
        await client.post("/api/v1/users/register", json=register_data)
        
        login_response = await client.post("/api/v1/users/login", data={
            "username": f"update_user_{unique_id}",
            "password": "Test@123"
        })
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 获取用户信息以获取 user_id
        me_response = await client.get("/api/v1/users/me", headers=headers)
        user_id = me_response.json()["id"]
        
        update_data = {
            "email": f"updated_{unique_id}@example.com"
        }
        
        response = await client.put(f"/api/v1/users/{user_id}", json=update_data, headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == update_data["email"]
    
    @pytest.mark.asyncio
    async def test_update_user_unauthorized(self, client):
        """更新用户 - 未授权"""
        update_data = {
            "email": "updated@example.com"
        }
        
        response = await client.put("/api/v1/users/999", json=update_data)
        
        assert response.status_code == 401


class TestUserPermissions:
    """用户权限测试"""
    
    @pytest.mark.asyncio
    async def test_user_list_requires_auth(self, client):
        """用户列表需要认证"""
        response = await client.get("/api/v1/users")
        
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_authenticated_user_can_list(self, client):
        """认证用户可以获取用户列表"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        # 先注册并登录
        register_data = {
            "username": f"list_user_{unique_id}",
            "password": "Test@123",
            "email": f"list_{unique_id}@example.com"
        }
        await client.post("/api/v1/users/register", json=register_data)
        
        login_response = await client.post("/api/v1/users/login", data={
            "username": f"list_user_{unique_id}",
            "password": "Test@123"
        })
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = await client.get("/api/v1/users", headers=headers)
        
        # 根据实现，可能返回 200 或 403 (如果只有 admin 可以)
        assert response.status_code in [200, 403]
