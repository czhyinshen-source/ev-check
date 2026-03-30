# SSH 密钥和通信机连接 API
import secrets
from typing import List, Optional
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa, ed25519
from cryptography.hazmat.backends import default_backend

from app.database import get_db
from app.models import User, SSHKey, Communication
from app.api.users import get_current_active_user
from app.utils.ssh_client import SSHClientWrapper

router = APIRouter()


@router.get("/keys", response_model=List[dict])
async def list_ssh_keys(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取 SSH 密钥列表"""
    result = await db.execute(select(SSHKey).offset(skip).limit(limit))
    keys = result.scalars().all()
    return [
        {
            "id": k.id,
            "name": k.name,
            "key_type": getattr(k, 'key_type', 'rsa') or 'rsa',
            "public_key": k.public_key,
            "has_private_key": k.private_key is not None and k.private_key != "",
            "is_active": k.is_active,
            "description": k.description,
            "created_at": k.created_at.isoformat(),
            "updated_at": k.updated_at.isoformat(),
        }
        for k in keys
    ]


@router.get("/keys/{key_id}")
async def get_ssh_key(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取单个 SSH 密钥详情"""
    result = await db.execute(select(SSHKey).where(SSHKey.id == key_id))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="SSH 密钥不存在")

    return {
        "id": key.id,
        "name": key.name,
        "key_type": getattr(key, 'key_type', 'rsa') or 'rsa',
        "public_key": key.public_key,
        "has_private_key": key.private_key is not None and key.private_key != "",
        "is_active": key.is_active,
        "description": key.description,
        "created_at": key.created_at.isoformat(),
        "updated_at": key.updated_at.isoformat(),
    }


@router.post("/keys", status_code=status.HTTP_201_CREATED)
async def create_ssh_key(
    key_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """创建 SSH 密钥"""
    db_key = SSHKey(
        name=key_data["name"],
        private_key=key_data["private_key"],
        public_key=key_data.get("public_key"),
        passphrase=key_data.get("passphrase"),
        description=key_data.get("description"),
    )
    db.add(db_key)
    await db.commit()
    await db.refresh(db_key)
    return {"id": db_key.id, "name": db_key.name}


@router.post("/keys/generate", status_code=status.HTTP_201_CREATED)
async def generate_ssh_key_pair(
    key_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """生成 SSH 密钥对"""
    key_type = key_data.get("key_type", "rsa")
    key_size = key_data.get("key_size", 4096)
    passphrase = key_data.get("passphrase")

    if key_type == "rsa":
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=key_size,
            backend=default_backend()
        )
    elif key_type == "ed25519":
        private_key = ed25519.Ed25519PrivateKey.generate()
    else:
        raise HTTPException(status_code=400, detail="不支持的密钥类型")

    encryption = serialization.NoEncryption()
    if passphrase:
        encryption = serialization.BestAvailableEncryption(passphrase.encode())

    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.OpenSSH,
        encryption_algorithm=encryption
    ).decode("utf-8")

    public_key = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.OpenSSH,
        format=serialization.PublicFormat.OpenSSH
    ).decode("utf-8")

    db_key = SSHKey(
        name=key_data["name"],
        private_key=private_key_pem,
        public_key=public_key,
        passphrase=passphrase,
        description=key_data.get("description"),
    )
    db.add(db_key)
    await db.commit()
    await db.refresh(db_key)
    return {
        "id": db_key.id,
        "name": db_key.name,
        "public_key": public_key,
    }


@router.delete("/keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ssh_key(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """删除 SSH 密钥"""
    result = await db.execute(select(SSHKey).where(SSHKey.id == key_id))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="SSH 密钥不存在")
    await db.delete(key)
    await db.commit()


@router.post("/test-connection")
async def test_connection(
    test_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """测试通信机连接"""
    comm_id = test_data.get("communication_id")
    if not comm_id:
        raise HTTPException(status_code=400, detail="缺少通信机 ID")

    result = await db.execute(select(Communication).where(Communication.id == comm_id))
    comm = result.scalar_one_or_none()
    if not comm:
        raise HTTPException(status_code=404, detail="通信机不存在")

    private_key = None
    private_key_path = comm.private_key_path
    
    if private_key_path and private_key_path.startswith("key_"):
        try:
            key_id = int(private_key_path.replace("key_", ""))
            result = await db.execute(select(SSHKey).where(SSHKey.id == key_id))
            ssh_key = result.scalar_one_or_none()
            if ssh_key:
                private_key = ssh_key.private_key
        except ValueError:
            pass

    ssh_client = SSHClientWrapper(
        host=comm.ip_address,
        port=comm.port,
        username=comm.username,
        password=comm.password,
        private_key_path=None,
        private_key=private_key,
    )

    try:
        connected = await ssh_client.connect()
        # 检查connection_status属性是否存在
        if hasattr(comm, 'connection_status'):
            if connected:
                # 更新通信机连接状态为在线
                comm.connection_status = 'online'
                await db.commit()
                return {"status": "success", "message": "连接成功"}
            else:
                # 更新通信机连接状态为离线
                comm.connection_status = 'offline'
                await db.commit()
                return {"status": "error", "message": "连接失败 - 请检查服务器日志获取详细错误"}
        else:
            # 如果connection_status字段不存在，只返回结果，不更新状态
            if connected:
                return {"status": "success", "message": "连接成功"}
            else:
                return {"status": "error", "message": "连接失败 - 请检查服务器日志获取详细错误"}
    except Exception as e:
        import traceback
        error_detail = str(e)
        stack_trace = traceback.format_exc()
        print(f"测试连接异常: {error_detail}")
        print(stack_trace)
        # 检查connection_status属性是否存在
        if hasattr(comm, 'connection_status'):
            # 更新通信机连接状态为离线
            comm.connection_status = 'offline'
            await db.commit()
        return {"status": "error", "message": f"连接异常: {error_detail}"}
    finally:
        await ssh_client.close()


@router.post("/deploy-ssh-key")
async def deploy_ssh_key(
    deploy_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """部署 SSH 公钥到通信机"""
    comm_id = deploy_data.get("communication_id")
    key_id = deploy_data.get("ssh_key_id")
    password = deploy_data.get("password")

    if not comm_id or not key_id:
        raise HTTPException(status_code=400, detail="缺少必要参数")

    result = await db.execute(select(Communication).where(Communication.id == comm_id))
    comm = result.scalar_one_or_none()
    if not comm:
        raise HTTPException(status_code=404, detail="通信机不存在")

    result = await db.execute(select(SSHKey).where(SSHKey.id == key_id))
    ssh_key = result.scalar_one_or_none()
    if not ssh_key:
        raise HTTPException(status_code=404, detail="SSH 密钥不存在")

    if not password and not comm.private_key_path:
        raise HTTPException(status_code=400, detail="需要密码或私钥进行部署")

    # 部署公钥时，应该使用密码连接，因为私钥还没有部署到目标机器上
    ssh_client = SSHClientWrapper(
        host=comm.ip_address,
        port=comm.port,
        username=comm.username,
        password=password,
        private_key_path=None,
        private_key=None,
        passphrase=None,
    )

    try:
        connected = await ssh_client.connect()
        if not connected:
            return {"status": "error", "message": "无法连接到通信机"}

        authorized_keys_path = Path.home() / ".ssh" / "authorized_keys"
        command = f"mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '{ssh_key.public_key}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
        
        exit_code, stdout, stderr = await ssh_client.execute(command)
        
        if exit_code == 0:
            return {"status": "success", "message": "公钥部署成功"}
        else:
            return {"status": "error", "message": f"部署失败: {stderr}"}
    except Exception as e:
        return {"status": "error", "message": f"部署异常: {str(e)}"}
    finally:
        await ssh_client.close()


@router.get("/communications/{comm_id}/status")
async def get_communication_status(
    comm_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取通信机连接状态"""
    result = await db.execute(select(Communication).where(Communication.id == comm_id))
    comm = result.scalar_one_or_none()
    if not comm:
        raise HTTPException(status_code=404, detail="通信机不存在")

    ssh_client = SSHClientWrapper(
        host=comm.ip_address,
        port=comm.port,
        username=comm.username,
        password=comm.password,
        private_key_path=comm.private_key_path,
    )

    try:
        connected = await ssh_client.connect()
        return {
            "communication_id": comm_id,
            "status": "online" if connected else "offline",
            "ip_address": comm.ip_address,
        }
    except Exception:
        return {
            "communication_id": comm_id,
            "status": "offline",
            "ip_address": comm.ip_address,
        }
    finally:
        await ssh_client.close()
