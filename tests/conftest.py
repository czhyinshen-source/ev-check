"""pytest 配置文件"""
import pytest
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import User, CommunicationGroup, Communication, SSHKey, CheckItem, CheckItemList, SnapshotGroup, Snapshot, CheckRule


def hash_password(password: str) -> str:
    """密码哈希函数"""
    import hashlib
    return hashlib.sha256(password.encode()).hexdigest()


# 测试数据库配置
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    """创建事件循环"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    """创建测试数据库引擎"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=True,
        poolclass=StaticPool,
    )
    
    # 创建所有表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # 清理
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(test_engine) -> AsyncSession:
    """创建测试数据库会话"""
    async_session = async_sessionmaker(
        test_engine,
        expire_on_commit=False,
        class_=AsyncSession
    )
    
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def test_user(db_session):
    """创建测试用户"""
    import uuid
    unique_id = str(uuid.uuid4())[:8]
    user = User(
        username=f"test_user_{unique_id}",
        password_hash=hash_password("Test@123"),
        email=f"test_{unique_id}@example.com",
        role="admin",
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_operator(db_session):
    """创建操作员用户"""
    import uuid
    unique_id = str(uuid.uuid4())[:8]
    user = User(
        username=f"operator_{unique_id}",
        password_hash=hash_password("Operator@123"),
        email=f"operator_{unique_id}@example.com",
        role="operator",
        is_active=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_group(db_session):
    """创建通信机分组"""
    group = CommunicationGroup(
        name="测试分组",
        description="测试用途"
    )
    db_session.add(group)
    await db_session.commit()
    await db_session.refresh(group)
    return group


@pytest.fixture
async def test_communication(db_session, test_group):
    """创建测试通信机"""
    comm = Communication(
        name="测试通信机 01",
        ip_address="192.168.1.100",
        port=22,
        username="admin",
        auth_type="password",
        group_id=test_group.id,
        description="测试用途",
        is_active=True
    )
    db_session.add(comm)
    await db_session.commit()
    await db_session.refresh(comm)
    return comm


@pytest.fixture
async def test_communications(db_session, test_group):
    """创建多个测试通信机"""
    comms = [
        Communication(
            name=f"测试通信机 0{i}",
            ip_address=f"192.168.1.10{i}",
            port=22,
            username="admin",
            auth_type="password",
            group_id=test_group.id,
            description="测试用途",
            is_active=True
        )
        for i in range(3)
    ]
    for comm in comms:
        db_session.add(comm)
    
    await db_session.commit()
    
    for comm in comms:
        await db_session.refresh(comm)
    
    return comms


@pytest.fixture
async def test_ssh_key(db_session):
    """创建测试 SSH 密钥"""
    ssh_key = SSHKey(
        name="测试密钥",
        public_key="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC7test... test@example.com",
        private_key="-----BEGIN OPENSSH PRIVATE KEY-----\ntest...",
        key_type="rsa",
        key_bits=4096,
        fingerprint="00:11:22:33:44:55:66:77:88:99:aa:bb:cc:dd:ee:ff",
        is_active=True
    )
    db_session.add(ssh_key)
    await db_session.commit()
    await db_session.refresh(ssh_key)
    return ssh_key


@pytest.fixture
async def test_check_item(db_session):
    """创建测试检查项"""
    item = CheckItem(
        name="测试文件检查",
        type="file",
        target_path="/etc/nginx/nginx.conf",
        check_attributes={
            "file_time": {"enabled": True, "range": {"min": 0, "max": 86400}},
            "file_size": {"enabled": True, "range": {"min": 0, "max": 1048576}},
            "permission": {"enabled": True, "octal": "644"}
        },
        description="测试检查项"
    )
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


@pytest.fixture
async def test_check_items(db_session):
    """创建多个测试检查项"""
    items = [
        CheckItem(
            name=f"测试检查项{i}",
            type="file",
            target_path=f"/etc/test{i}.conf",
            check_attributes={
                "file_time": {"enabled": True, "range": {"min": 0, "max": 86400}}
            },
            description=f"测试检查项{i}"
        )
        for i in range(3)
    ]
    
    for item in items:
        db_session.add(item)
    
    await db_session.commit()
    
    for item in items:
        await db_session.refresh(item)
    
    return items


@pytest.fixture
async def test_check_item_list(db_session, test_check_items):
    """创建测试检查项列表"""
    item_list = CheckItemList(
        name="测试检查项列表",
        description="测试用途"
    )
    db_session.add(item_list)
    await db_session.flush()
    
    # 关联检查项
    for item in test_check_items:
        item_list.items.append(item)
    
    await db_session.commit()
    await db_session.refresh(item_list)
    return item_list


@pytest.fixture
async def test_snapshot_group(db_session):
    """创建测试快照组"""
    group = SnapshotGroup(
        name="测试快照组",
        description="测试用途",
        is_system=False
    )
    db_session.add(group)
    await db_session.commit()
    await db_session.refresh(group)
    return group


@pytest.fixture
async def test_snapshot(db_session, test_snapshot_group):
    """创建测试快照"""
    snapshot = Snapshot(
        group_id=test_snapshot_group.id,
        name="测试快照",
        snapshot_time="2026-03-05 10:00:00",
        is_default=False,
        description="测试用途",
        created_by="test_user"
    )
    db_session.add(snapshot)
    await db_session.commit()
    await db_session.refresh(snapshot)
    return snapshot


@pytest.fixture
async def test_check_rule(db_session):
    """创建测试检查规则"""
    rule = CheckRule(
        name="测试检查规则",
        description="测试用途",
        time_range_start=0,
        time_range_end=235959,
        allow_all_day=True
    )
    db_session.add(rule)
    await db_session.commit()
    await db_session.refresh(rule)
    return rule


@pytest.fixture
async def auth_headers(test_user):
    """生成认证请求头"""
    from jose import jwt
    from app.config import settings
    from datetime import datetime, timedelta
    
    # 创建 token - 使用 username 作为 sub
    expire = datetime.utcnow() + timedelta(minutes=30)
    to_encode = {
        "sub": test_user.username,
        "username": test_user.username,
        "role": test_user.role,
        "exp": expire
    }
    token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def operator_headers(test_operator):
    """生成操作员认证请求头"""
    from jose import jwt
    from app.config import settings
    from datetime import datetime, timedelta
    
    expire = datetime.utcnow() + timedelta(minutes=30)
    to_encode = {
        "sub": test_operator.username,
        "username": test_operator.username,
        "role": test_operator.role,
        "exp": expire
    }
    token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def client():
    """创建测试 HTTP 客户端"""
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac
