# 通信机管理 API
from typing import Optional, List
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import openpyxl

from app.database import get_db
from app.models import User, Communication, CommunicationGroup, SSHKey
from app.api.users import get_current_active_user
from app.utils.ssh_client import SSHClientWrapper

router = APIRouter()


class CommunicationGroupCreate:
    """通信机分组创建"""
    name: str
    description: Optional[str] = None


class CommunicationGroupResponse:
    """通信机分组响应"""
    id: int
    name: str
    description: Optional[str]
    created_at: str
    updated_at: str


class CommunicationCreate:
    """通信机创建"""
    group_id: Optional[int] = None
    name: str
    ip_address: str
    port: int = 22
    username: str = "root"
    password: Optional[str] = None
    private_key_path: Optional[str] = None
    description: Optional[str] = None


class CommunicationResponse:
    """通信机响应"""
    id: int
    group_id: Optional[int]
    name: str
    ip_address: str
    port: int
    username: str
    description: Optional[str]
    is_active: bool
    created_at: str
    updated_at: str


@router.get("/groups", response_model=List[dict])
async def list_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取通信机分组列表"""
    result = await db.execute(select(CommunicationGroup))
    groups = result.scalars().all()
    return [
        {
            "id": g.id,
            "name": g.name,
            "description": g.description,
            "created_at": g.created_at.isoformat(),
            "updated_at": g.updated_at.isoformat(),
        }
        for g in groups
    ]


@router.post("/groups", status_code=status.HTTP_201_CREATED)
async def create_group(
    group: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """创建通信机分组"""
    db_group = CommunicationGroup(name=group["name"], description=group.get("description"))
    db.add(db_group)
    await db.commit()
    await db.refresh(db_group)
    return {"id": db_group.id, "name": db_group.name}


@router.get("", response_model=List[dict])
async def list_communications(
    group_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取通信机列表"""
    query = select(Communication)
    if group_id:
        query = query.where(Communication.group_id == group_id)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    communications = result.scalars().all()
    return [
        {
            "id": c.id,
            "group_id": c.group_id,
            "name": c.name,
            "ip_address": c.ip_address,
            "port": c.port,
            "username": c.username,
            "description": c.description,
            "is_active": c.is_active,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
        }
        for c in communications
    ]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_communication(
    comm: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """创建通信机"""
    db_comm = Communication(
        group_id=comm.get("group_id"),
        name=comm["name"],
        ip_address=comm["ip_address"],
        port=comm.get("port", 22),
        username=comm.get("username", "root"),
        password=comm.get("password"),
        private_key_path=comm.get("private_key_path"),
        description=comm.get("description"),
    )
    db.add(db_comm)
    await db.commit()
    await db.refresh(db_comm)
    return {
        "id": db_comm.id, 
        "name": db_comm.name
    }


@router.get("/{comm_id}")
async def get_communication(
    comm_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取通信机详情"""
    result = await db.execute(select(Communication).where(Communication.id == comm_id))
    comm = result.scalar_one_or_none()
    if not comm:
        raise HTTPException(status_code=404, detail="通信机不存在")
    return {
        "id": comm.id,
        "group_id": comm.group_id,
        "name": comm.name,
        "ip_address": comm.ip_address,
        "port": comm.port,
        "username": comm.username,
        "password": comm.password,
        "private_key_path": comm.private_key_path,
        "description": comm.description,
        "is_active": comm.is_active,
    }


@router.put("/{comm_id}")
async def update_communication(
    comm_id: int,
    comm: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """更新通信机"""
    result = await db.execute(select(Communication).where(Communication.id == comm_id))
    db_comm = result.scalar_one_or_none()
    if not db_comm:
        raise HTTPException(status_code=404, detail="通信机不存在")

    for key, value in comm.items():
        if hasattr(db_comm, key):
            setattr(db_comm, key, value)

    await db.commit()
    await db.refresh(db_comm)
    return {"id": db_comm.id, "name": db_comm.name}


@router.delete("/{comm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_communication(
    comm_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """删除通信机"""
    result = await db.execute(select(Communication).where(Communication.id == comm_id))
    comm = result.scalar_one_or_none()
    if not comm:
        raise HTTPException(status_code=404, detail="通信机不存在")

    await db.delete(comm)
    await db.commit()


@router.post("/import-excel")
async def import_communications_from_excel(
    file: UploadFile = File(...),
    deploy_public_key: bool = False,
    ssh_key_id: Optional[int] = None,
    deploy_password: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """从Excel导入通信机"""
    print("收到Excel导入请求")
    print(f"文件名: {file.filename}")
    print(f"部署公钥: {deploy_public_key}")
    print(f"SSH密钥ID: {ssh_key_id}")
    print(f"部署密码: {deploy_password}")
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="仅支持 .xlsx 和 .xls 文件")

    # 读取Excel文件
    content = await file.read()
    workbook = openpyxl.load_workbook(BytesIO(content))
    worksheet = workbook.active

    # 验证Excel格式 - 检查表头
    header_row = list(worksheet.iter_rows(min_row=1, max_row=1, values_only=True))[0]
    expected_headers = ['名称', 'IP地址', '端口', '用户名', '描述', '通信机分组']
    
    # 验证表头是否匹配
    actual_headers = [str(h).strip() if h else '' for h in header_row[:6]]
    if actual_headers != expected_headers:
        raise HTTPException(
            status_code=400, 
            detail=f"Excel格式错误！表头应为：{', '.join(expected_headers)}"
        )

    # 获取所有通信机分组，创建名称到ID的映射
    group_result = await db.execute(select(CommunicationGroup))
    groups = group_result.scalars().all()
    group_name_to_id = {group.name: group.id for group in groups}
    
    # 解析Excel数据
    communications = []
    errors = []
    
    for row_num, row in enumerate(worksheet.iter_rows(min_row=2, values_only=True), start=2):
        # 验证必填字段
        name = row[0]
        ip_address = row[1]
        
        if not name:
            errors.append(f"第{row_num}行：通信机名称不能为空")
            continue
        if not ip_address:
            errors.append(f"第{row_num}行：IP地址不能为空")
            continue
        
        # 验证端口
        port = row[2]
        if port and not isinstance(port, int):
            try:
                port = int(port)
            except:
                errors.append(f"第{row_num}行：端口必须是数字")
                continue
        
        # 处理通信机分组
        group_name = row[5]
        group_id = None
        if group_name:
            group_name = str(group_name).strip()
            if group_name in group_name_to_id:
                group_id = group_name_to_id[group_name]
            else:
                errors.append(f"第{row_num}行：通信机分组 '{group_name}' 不存在")
                continue
        
        # 构建通信机数据
        comm_data = {
            "name": str(name).strip(),
            "ip_address": str(ip_address).strip(),
            "port": int(port) if port else 22,
            "username": str(row[3]).strip() if row[3] else "root",
            "description": str(row[4]).strip() if row[4] else None,
            "group_id": group_id,
        }
        communications.append(comm_data)

    if errors:
        raise HTTPException(status_code=400, detail="\n".join(errors))

    if not communications:
        raise HTTPException(status_code=400, detail="Excel文件中没有有效数据")

    # 批量创建通信机
    created_communications = []
    for comm_data in communications:
        db_comm = Communication(
            group_id=comm_data.get("group_id"),
            name=comm_data["name"],
            ip_address=comm_data["ip_address"],
            port=comm_data.get("port", 22),
            username=comm_data.get("username", "root"),
            description=comm_data.get("description"),
        )
        db.add(db_comm)
        await db.commit()
        await db.refresh(db_comm)
        created_communications.append(db_comm)

    # 如果需要部署公钥
    deployment_results = {"success": [], "failed": []}
    if deploy_public_key and ssh_key_id and deploy_password:
        # 获取SSH密钥
        result = await db.execute(select(SSHKey).where(SSHKey.id == ssh_key_id))
        ssh_key = result.scalar_one_or_none()
        if not ssh_key:
            raise HTTPException(status_code=404, detail="SSH密钥不存在")

        # 批量部署公钥
        for comm in created_communications:
            try:
                ssh_client = SSHClientWrapper(
                    host=comm.ip_address,
                    port=comm.port,
                    username=comm.username,
                    password=deploy_password,
                    private_key_path=None,
                    private_key=None,
                )

                connected = await ssh_client.connect()
                if connected:
                    command = f"mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '{ssh_key.public_key}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
                    exit_code, stdout, stderr = await ssh_client.execute(command)
                    
                    if exit_code == 0:
                        # 更新通信机使用SSH密钥
                        comm.private_key_path = f"key_{ssh_key_id}"
                        await db.commit()
                        deployment_results["success"].append(comm.name)
                    else:
                        deployment_results["failed"].append(f"{comm.name}: {stderr}")
                else:
                    deployment_results["failed"].append(f"{comm.name}: 无法连接")
            except Exception as e:
                deployment_results["failed"].append(f"{comm.name}: {str(e)}")
            finally:
                await ssh_client.close()

    return {
        "imported": len(created_communications),
        "deployment": deployment_results if deploy_public_key else None
    }


@router.post("/batch-deploy-ssh-key")
async def batch_deploy_ssh_key(
    deployment_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """批量部署公钥到通信机"""
    communication_ids = deployment_data.get("communication_ids", [])
    ssh_key_id = deployment_data.get("ssh_key_id")
    password = deployment_data.get("password")

    if not communication_ids or not ssh_key_id or not password:
        raise HTTPException(status_code=400, detail="缺少必要参数")

    # 获取SSH密钥
    result = await db.execute(select(SSHKey).where(SSHKey.id == ssh_key_id))
    ssh_key = result.scalar_one_or_none()
    if not ssh_key:
        raise HTTPException(status_code=404, detail="SSH密钥不存在")

    # 获取通信机
    result = await db.execute(
        select(Communication).where(Communication.id.in_(communication_ids))
    )
    communications = result.scalars().all()

    if not communications:
        raise HTTPException(status_code=404, detail="没有找到指定的通信机")

    # 批量部署公钥
    deployment_results = {"success": [], "failed": []}
    for comm in communications:
        try:
            ssh_client = SSHClientWrapper(
                host=comm.ip_address,
                port=comm.port,
                username=comm.username,
                password=password,
                private_key_path=None,
                private_key=None,
            )

            connected = await ssh_client.connect()
            if connected:
                command = f"mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '{ssh_key.public_key}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
                exit_code, stdout, stderr = await ssh_client.execute(command)
                
                if exit_code == 0:
                    # 更新通信机使用SSH密钥
                    comm.private_key_path = f"key_{ssh_key_id}"
                    await db.commit()
                    deployment_results["success"].append(comm.name)
                else:
                    deployment_results["failed"].append(f"{comm.name}: {stderr}")
            else:
                deployment_results["failed"].append(f"{comm.name}: 无法连接")
        except Exception as e:
            deployment_results["failed"].append(f"{comm.name}: {str(e)}")
        finally:
            await ssh_client.close()

    return deployment_results
