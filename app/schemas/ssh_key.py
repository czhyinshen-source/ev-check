# SSH Key Schema
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class SSHKeyBase(BaseModel):
    """SSH 密钥基础"""
    name: str
    description: Optional[str] = None


class SSHKeyCreate(SSHKeyBase):
    """SSH 密钥创建"""
    private_key: str
    public_key: Optional[str] = None
    passphrase: Optional[str] = None


class SSHKeyUpdate(BaseModel):
    """SSH 密钥更新"""
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class SSHKeyResponse(SSHKeyBase):
    """SSH 密钥响应"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    public_key: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SSHKeyPairGenerate(BaseModel):
    """SSH 密钥对生成请求"""
    name: str
    key_type: str = "rsa"
    key_size: int = 4096
    passphrase: Optional[str] = None
    description: Optional[str] = None


class DeploySSHKeyRequest(BaseModel):
    """部署 SSH 公钥请求"""
    communication_id: int
    ssh_key_id: int
    deployment_method: str = "auto"
    password: Optional[str] = None


class TestConnectionRequest(BaseModel):
    """测试连接请求"""
    communication_id: int
