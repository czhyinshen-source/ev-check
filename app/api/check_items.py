# 检查项 API
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, CheckItem, CheckItemList
from app.api.users import get_current_active_user
from app.schemas.check_item import (
    CheckItemCreate,
    CheckItemResponse,
    CheckItemUpdate,
    CheckItemListCreate,
    CheckItemListResponse,
    CheckItemListUpdate,
)

router = APIRouter()


@router.get("", response_model=List[CheckItemResponse])
async def list_check_items(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取检查项列表"""
    result = await db.execute(select(CheckItem).offset(skip).limit(limit))
    return result.scalars().all()


@router.post("", status_code=status.HTTP_201_CREATED, response_model=CheckItemResponse)
async def create_check_item(
    item: CheckItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """创建检查项"""
    item_data = item.model_dump()
    # 将列表格式的检查类型转换为字符串格式存储
    if isinstance(item_data.get('type'), list):
        item_data['type'] = str(item_data['type'])
    db_item = CheckItem(**item_data)
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    # 将字符串格式的检查类型转换回列表格式
    if isinstance(db_item.type, str) and db_item.type.startswith('['):
        try:
            db_item.type = eval(db_item.type)
        except:
            db_item.type = [db_item.type]
    return db_item


@router.get("/lists", response_model=List[CheckItemListResponse])
async def list_check_item_lists(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取检查项列表列表"""
    result = await db.execute(
        select(CheckItemList)
        .offset(skip)
        .limit(limit)
        .options(selectinload(CheckItemList.items))
    )
    return result.scalars().all()


@router.post("/lists", status_code=status.HTTP_201_CREATED, response_model=CheckItemListResponse)
async def create_check_item_list(
    item_list: CheckItemListCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """创建检查项列表"""
    # 检查名称是否已存在
    result = await db.execute(select(CheckItemList).where(CheckItemList.name == item_list.name))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="检查项列表名称已存在")
    
    db_list = CheckItemList(
        name=item_list.name,
        description=item_list.description,
    )
    db.add(db_list)
    await db.flush()

    if item_list.item_ids:
        for item_id in item_list.item_ids:
            result = await db.execute(select(CheckItem).where(CheckItem.id == item_id))
            item = result.scalar_one_or_none()
            if item:
                db_list.items.append(item)

    await db.commit()
    # 只刷新基本字段，不加载关联的items
    await db.refresh(db_list)
    return db_list


from sqlalchemy.orm import selectinload


@router.get("/lists/{list_id}", response_model=CheckItemListResponse)
async def get_check_item_list(
    list_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取检查项列表详情"""
    result = await db.execute(
        select(CheckItemList)
        .where(CheckItemList.id == list_id)
        .options(selectinload(CheckItemList.items))
    )
    item_list = result.scalar_one_or_none()
    if not item_list:
        raise HTTPException(status_code=404, detail="检查项列表不存在")
    return item_list


@router.put("/lists/{list_id}", response_model=CheckItemListResponse)
async def update_check_item_list(
    list_id: int,
    list_update: CheckItemListUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """更新检查项列表"""
    result = await db.execute(
        select(CheckItemList)
        .where(CheckItemList.id == list_id)
        .options(selectinload(CheckItemList.items))
    )
    item_list = result.scalar_one_or_none()
    if not item_list:
        raise HTTPException(status_code=404, detail="检查项列表不存在")

    if list_update.name is not None:
        item_list.name = list_update.name
    if list_update.description is not None:
        item_list.description = list_update.description
    if hasattr(list_update, 'item_ids') and list_update.item_ids is not None:
        # 清空现有的检查项
        item_list.items = []
        # 添加新的检查项
        for item_id in list_update.item_ids:
            result = await db.execute(select(CheckItem).where(CheckItem.id == item_id))
            item = result.scalar_one_or_none()
            if item:
                item_list.items.append(item)

    await db.commit()
    # 刷新并重新加载关联的items
    result = await db.execute(
        select(CheckItemList)
        .where(CheckItemList.id == list_id)
        .options(selectinload(CheckItemList.items))
    )
    item_list = result.scalar_one()
    return item_list


@router.delete("/lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_check_item_list(
    list_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """删除检查项列表"""
    result = await db.execute(select(CheckItemList).where(CheckItemList.id == list_id))
    item_list = result.scalar_one_or_none()
    if not item_list:
        raise HTTPException(status_code=404, detail="检查项列表不存在")

    await db.delete(item_list)
    await db.commit()


from pydantic import BaseModel


class CopyCheckItemListRequest(BaseModel):
    """复制检查项列表请求"""
    new_name: Optional[str] = None


@router.post("/lists/{list_id}/copy", response_model=CheckItemListResponse)
async def copy_check_item_list(
    list_id: int,
    request: CopyCheckItemListRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """复制检查项列表"""
    result = await db.execute(select(CheckItemList).where(CheckItemList.id == list_id))
    item_list = result.scalar_one_or_none()
    if not item_list:
        raise HTTPException(status_code=404, detail="检查项列表不存在")

    base_name = request.new_name if request.new_name else item_list.name
    
    # 实现自动递增的副本命名逻辑
    check_name = base_name
    counter = 1
    
    while True:
        result = await db.execute(select(CheckItemList).where(CheckItemList.name == check_name))
        existing = result.scalar_one_or_none()
        if not existing:
            break
        # 如果名称已存在，添加数字后缀
        check_name = f"{base_name} 副本{counter}"
        counter += 1

    new_list = CheckItemList(
        name=check_name,
        description=item_list.description,
    )
    db.add(new_list)
    await db.commit()
    # 只刷新基本字段，不加载关联的items
    await db.refresh(new_list)
    return new_list


@router.get("/{item_id}", response_model=CheckItemResponse)
async def get_check_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取检查项详情"""
    result = await db.execute(select(CheckItem).where(CheckItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="检查项不存在")
    return item


@router.put("/{item_id}", response_model=CheckItemResponse)
async def update_check_item(
    item_id: int,
    item_update: CheckItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """更新检查项"""
    result = await db.execute(select(CheckItem).where(CheckItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="检查项不存在")

    update_data = item_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_check_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """删除检查项"""
    result = await db.execute(select(CheckItem).where(CheckItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="检查项不存在")

    await db.delete(item)
    await db.commit()
