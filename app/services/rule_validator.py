from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.check_result import CheckRule

async def ensure_not_in_execution_targets(
    db: AsyncSession, 
    asset_type: str, 
    asset_id: int, 
    asset_name: str = "该资源"
):
    """
    检查某个资产（通信机、检查项、快照等）是否被任何活跃或闲置的 CheckRule 所引用。
    如果有，则报错 HTTP 400 阻止删除。
    
    asset_type 可以是: "snapshot_id", "snapshot_group_id", "communication_id", "communication_group_id", "check_item_id", "check_item_list_id"
    """
    result = await db.execute(select(CheckRule))
    rules = result.scalars().all()
    
    for rule in rules:
        if not rule.execution_targets:
            continue
            
        for target in rule.execution_targets:
            # 检查快照或快照组
            if asset_type == "snapshot_id" and target.get("snapshot_id") == asset_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{asset_name} 正被检查规则【{rule.name}】设为目标基准，请先到规则配置中解绑！")
            
            # 检查通信机及组
            comms = target.get("communications", {})
            if asset_type == "communication_id" and asset_id in comms.get("ids", []):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{asset_name} 正被检查规则【{rule.name}】引用，请先到规则配置中解绑！")
            if asset_type == "communication_group_id" and asset_id in comms.get("group_ids", []):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{asset_name} 正被检查规则【{rule.name}】引用，请先到规则配置中解绑！")
                
            # 检查测试项及组
            c_items = target.get("check_items", {})
            if asset_type == "check_item_id" and asset_id in c_items.get("ids", []):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{asset_name} 正被检查规则【{rule.name}】引用，请先到规则配置中解绑！")
            if asset_type == "check_item_list_id" and asset_id in c_items.get("list_ids", []):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{asset_name} 正被检查规则【{rule.name}】引用，请先到规则配置中解绑！")
