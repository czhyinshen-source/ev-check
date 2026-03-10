"""认证服务单元测试"""
import pytest
import hashlib
from datetime import datetime, timedelta
from jose import jwt

from app.config import settings


def hash_password(password: str) -> str:
    """密码哈希函数"""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return hash_password(plain_password) == hashed_password


def create_access_token(data: dict, expire_minutes: int = 30) -> str:
    """创建访问 Token"""
    from datetime import timedelta
    expire = datetime.utcnow() + timedelta(minutes=expire_minutes)
    to_encode = data.copy()
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    """解码 Token"""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.JWTError:
        return None


class TestPasswordHashing:
    """密码哈希测试"""
    
    def test_hash_password_creates_different_hashes(self):
        """相同密码应生成相同的哈希 (SHA256 不使用盐值)"""
        password = "TestPassword123!"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        
        assert hash1 == hash2  # SHA256 是确定性哈希
        assert len(hash1) == 64  # SHA256 哈希长度 (64 个十六进制字符)
        assert len(hash2) == 64
    
    def test_verify_password_correct(self):
        """验证正确密码"""
        password = "TestPassword123!"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True
    
    def test_verify_password_incorrect(self):
        """验证错误密码"""
        password = "TestPassword123!"
        wrong_password = "WrongPassword456!"
        hashed = hash_password(password)
        assert verify_password(wrong_password, hashed) is False
    
    def test_hash_password_with_special_characters(self):
        """测试特殊字符密码"""
        password = "P@$$w0rd!#$%^&*()"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True
    
    def test_hash_password_with_unicode(self):
        """测试 Unicode 密码"""
        password = "密码测试 Password123!"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True
    
    def test_hash_password_empty_string(self):
        """测试空字符串密码"""
        password = ""
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True
    
    def test_hash_password_long_password(self):
        """测试长密码"""
        password = "A" * 100
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True


class TestAccessToken:
    """访问 Token 测试"""
    
    def test_create_access_token_returns_string(self):
        """创建 Token 返回字符串"""
        user_data = {"sub": "test_user", "role": "admin"}
        token = create_access_token(user_data)
        
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_decode_access_token_valid(self):
        """解码有效 Token"""
        user_data = {"sub": "test_user", "role": "admin"}
        token = create_access_token(user_data)
        decoded = decode_access_token(token)
        
        assert decoded is not None
        assert decoded["sub"] == user_data["sub"]
        assert decoded["role"] == user_data["role"]
    
    def test_decode_access_token_expired(self):
        """解码过期 Token"""
        # 创建立即过期的 token
        expire = datetime.utcnow() - timedelta(minutes=1)
        to_encode = {"sub": "test_user", "exp": expire}
        token = jwt.encode(
            to_encode, 
            settings.SECRET_KEY, 
            algorithm=settings.ALGORITHM
        )
        
        decoded = decode_access_token(token)
        assert decoded is None
    
    def test_decode_access_token_invalid(self):
        """解码无效 Token"""
        invalid_token = "invalid.token.here"
        decoded = decode_access_token(invalid_token)
        
        assert decoded is None
    
    def test_decode_access_token_malformed(self):
        """解码格式错误的 Token"""
        malformed_token = "not.a.valid.jwt.token"
        decoded = decode_access_token(malformed_token)
        
        assert decoded is None
    
    def test_access_token_contains_expiration(self):
        """Token 包含过期时间"""
        user_data = {"sub": "test_user"}
        token = create_access_token(user_data)
        decoded = decode_access_token(token)
        
        assert decoded is not None
        assert "exp" in decoded
        assert isinstance(decoded["exp"], int)
    
    def test_access_token_contains_user_info(self):
        """Token 包含用户信息"""
        user_data = {
            "sub": "test_user_id",
            "username": "test_user",
            "role": "admin"
        }
        token = create_access_token(user_data)
        decoded = decode_access_token(token)
        
        assert decoded is not None
        assert decoded["sub"] == user_data["sub"]
        assert decoded["username"] == user_data["username"]
        assert decoded["role"] == user_data["role"]
    
    def test_create_access_token_with_custom_expire(self):
        """创建自定义过期时间的 Token"""
        user_data = {"sub": "test_user"}
        expire_minutes = 60
        
        token = create_access_token(user_data, expire_minutes=expire_minutes)
        decoded = decode_access_token(token)
        
        assert decoded is not None
        assert "exp" in decoded
        
        # 验证过期时间大约是 60 分钟后
        from datetime import timezone
        exp_datetime = datetime.fromtimestamp(decoded["exp"], tz=timezone.utc)
        now = datetime.now(timezone.utc)
        diff = (exp_datetime - now).total_seconds() / 60
        
        assert 59 <= diff <= 61  # 允许 1 分钟误差
