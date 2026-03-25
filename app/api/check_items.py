# 检查项 API
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
    list_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取检查项列表"""
    query = select(CheckItem).offset(skip).limit(limit)
    if list_id:
        query = query.where(CheckItem.list_id == list_id)
    query = query.order_by(CheckItem.list_id, CheckItem.order_index)

    result = await db.execute(query)
    items = result.scalars().all()

    # 获取所有相关的列表名称
    list_ids = [item.list_id for item in items if item.list_id]
    list_names = {}
    if list_ids:
        list_result = await db.execute(
            select(CheckItemList.id, CheckItemList.name).where(CheckItemList.id.in_(list_ids))
        )
        list_names = {row.id: row.name for row in list_result.all()}

    # 构建响应
    responses = []
    for item in items:
        item_dict = {
            "id": item.id,
            "name": item.name,
            "type": item.type,
            "target_path": item.target_path,
            "check_attributes": item.check_attributes,
            "description": item.description,
            "list_id": item.list_id,
            "list_name": list_names.get(item.list_id) if item.list_id else None,
            "order_index": item.order_index,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
        }
        responses.append(CheckItemResponse(**item_dict))

    return responses


@router.post("", status_code=status.HTTP_201_CREATED, response_model=CheckItemResponse)
async def create_check_item(
    item: CheckItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """创建检查项"""
    # 计算order_index
    order_index = 1
    if item.list_id:
        result = await db.execute(
            select(func.max(CheckItem.order_index)).where(CheckItem.list_id == item.list_id)
        )
        max_order = result.scalar()
        if max_order is not None:
            order_index = max_order + 1

    db_item = CheckItem(
        name=item.name,
        type=item.type,
        target_path=item.target_path,
        check_attributes=item.check_attributes,
        description=item.description,
        list_id=item.list_id,
        order_index=order_index,
    )
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)

    # 获取列表名称
    list_name = None
    if db_item.list_id:
        result = await db.execute(select(CheckItemList.name).where(CheckItemList.id == db_item.list_id))
        row = result.scalar_one_or_none()
        if row:
            list_name = row

    return CheckItemResponse(
        id=db_item.id,
        name=db_item.name,
        type=db_item.type,
        target_path=db_item.target_path,
        check_attributes=db_item.check_attributes,
        description=db_item.description,
        list_id=db_item.list_id,
        list_name=list_name,
        order_index=db_item.order_index,
        created_at=db_item.created_at,
        updated_at=db_item.updated_at,
    )


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
    await db.commit()

    # 如果有item_ids，创建新的检查项副本
    if item_list.item_ids:
        for idx, item_id in enumerate(item_list.item_ids, start=1):
            result = await db.execute(select(CheckItem).where(CheckItem.id == item_id))
            original_item = result.scalar_one_or_none()
            if original_item:
                new_item = CheckItem(
                    name=original_item.name,
                    type=original_item.type,
                    target_path=original_item.target_path,
                    check_attributes=original_item.check_attributes,
                    description=original_item.description,
                    list_id=db_list.id,
                    order_index=idx,
                )
                db.add(new_item)
        await db.commit()

    # 重新查询以正确加载关联的items
    result = await db.execute(
        select(CheckItemList)
        .where(CheckItemList.id == db_list.id)
        .options(selectinload(CheckItemList.items))
    )
    db_list = result.scalar_one()
    return db_list


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
        # 检查名称是否已存在
        result = await db.execute(
            select(CheckItemList).where(
                CheckItemList.name == list_update.name,
                CheckItemList.id != list_id
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="检查项列表名称已存在")
        item_list.name = list_update.name

    if list_update.description is not None:
        item_list.description = list_update.description

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
    """复制检查项列表（创建独立的检查项副本）"""
    result = await db.execute(
        select(CheckItemList)
        .where(CheckItemList.id == list_id)
        .options(selectinload(CheckItemList.items))
    )
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

    # 创建新的列表
    new_list = CheckItemList(
        name=check_name,
        description=item_list.description,
    )
    db.add(new_list)
    await db.flush()  # 获取new_list.id

    # 为每个原检查项创建独立的副本
    for idx, original_item in enumerate(item_list.items, start=1):
        new_item = CheckItem(
            name=original_item.name,
            type=original_item.type,
            target_path=original_item.target_path,
            check_attributes=original_item.check_attributes,
            description=original_item.description,
            list_id=new_list.id,
            order_index=idx,
        )
        db.add(new_item)

    await db.commit()

    # 重新查询以正确加载关联的items
    result = await db.execute(
        select(CheckItemList)
        .where(CheckItemList.id == new_list.id)
        .options(selectinload(CheckItemList.items))
    )
    new_list = result.scalar_one()
    return new_list


@router.get("/{item_id}", response_model=CheckItemResponse)
async def get_check_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取检查项详情"""
    result = await db.execute(
        select(CheckItem)
        .where(CheckItem.id == item_id)
        .options(selectinload(CheckItem.check_item_list))
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="检查项不存在")

    return CheckItemResponse(
        id=item.id,
        name=item.name,
        type=item.type,
        target_path=item.target_path,
        check_attributes=item.check_attributes,
        description=item.description,
        list_id=item.list_id,
        list_name=item.check_item_list.name if item.check_item_list else None,
        order_index=item.order_index,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


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

    # 获取列表名称
    list_name = None
    if item.list_id:
        result = await db.execute(select(CheckItemList.name).where(CheckItemList.id == item.list_id))
        row = result.scalar_one_or_none()
        if row:
            list_name = row

    return CheckItemResponse(
        id=item.id,
        name=item.name,
        type=item.type,
        target_path=item.target_path,
        check_attributes=item.check_attributes,
        description=item.description,
        list_id=item.list_id,
        list_name=list_name,
        order_index=item.order_index,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


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
