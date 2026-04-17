import asyncio
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
from app.database import async_session_maker
from app.models.check_result import CheckRule
from app.models.snapshot import Snapshot, SnapshotGroup
from app.models.communication import Communication, CommunicationGroup
from app.models.check_item import CheckItem, CheckItemList

async def main():
    async with async_session_maker() as session:
        # 1. 预加载所有合法的资产ID列表
        valid_snapshots = set((await session.execute(select(Snapshot.id))).scalars().all())
        # 以防万一，同样加载组和其他资产
        valid_snap_groups = set((await session.execute(select(SnapshotGroup.id))).scalars().all())
        valid_comms = set((await session.execute(select(Communication.id))).scalars().all())
        valid_comm_groups = set((await session.execute(select(CommunicationGroup.id))).scalars().all())
        valid_c_items = set((await session.execute(select(CheckItem.id))).scalars().all())
        valid_c_lists = set((await session.execute(select(CheckItemList.id))).scalars().all())

        # 2. 查询所有的检查规则
        rules = (await session.execute(select(CheckRule))).scalars().all()
        updated_count = 0

        for rule in rules:
            if not rule.execution_targets:
                continue
            
            needs_update = False
            new_targets = []
            
            for index, target in enumerate(rule.execution_targets):
                if not isinstance(target, dict):
                    new_targets.append(target)
                    continue
                
                # A: 检测悬空快照 ID
                sid = target.get("snapshot_id")
                if sid is not None and sid not in valid_snapshots:
                    print(f"❗️ 清理规则【{rule.name}】: 第 {index + 1} 行存在未知的快照 (ID: {sid})，已重置为 None。")
                    target["snapshot_id"] = None
                    needs_update = True
                
                # B: 检测悬空通信机 ID
                comms = target.get("communications", {})
                if comms:
                    old_c_ids = comms.get("ids", [])
                    new_c_ids = [c for c in old_c_ids if c in valid_comms]
                    if len(new_c_ids) != len(old_c_ids):
                        print(f"❗️ 清理规则【{rule.name}】: 移除已删除的通信机节点。")
                        comms["ids"] = new_c_ids
                        needs_update = True
                    
                    old_g_ids = comms.get("group_ids", [])
                    new_g_ids = [g for g in old_g_ids if g in valid_comm_groups]
                    if len(new_g_ids) != len(old_g_ids):
                        print(f"❗️ 清理规则【{rule.name}】: 移除已删除的节点分组。")
                        comms["group_ids"] = new_g_ids
                        needs_update = True
                
                # C: 检测悬空检查项 ID
                citems = target.get("check_items", {})
                if citems:
                    old_ci_ids = citems.get("ids", [])
                    new_ci_ids = [c for c in old_ci_ids if c in valid_c_items]
                    if len(new_ci_ids) != len(old_ci_ids):
                        print(f"❗️ 清理规则【{rule.name}】: 移除已删除的检查项。")
                        citems["ids"] = new_ci_ids
                        needs_update = True
                    
                    old_l_ids = citems.get("list_ids", [])
                    new_l_ids = [l for l in old_l_ids if l in valid_c_lists]
                    if len(new_l_ids) != len(old_l_ids):
                        print(f"❗️ 清理规则【{rule.name}】: 移除已删除的检查项集合。")
                        citems["list_ids"] = new_l_ids
                        needs_update = True
                
                new_targets.append(target)
                
            if needs_update:
                rule.execution_targets = new_targets
                # 显式标记 JSON 列发生变化，以便 SQLAlchemy 正确生成 UPDATE 语句
                flag_modified(rule, "execution_targets")
                updated_count += 1
                
        if updated_count > 0:
            await session.commit()
            print(f"✅ 清理完成，共修复了 {updated_count} 个存在脏数据的检查规则！")
        else:
            print("✅ 从头到尾检查了一遍，未发现任何脏数据！")

if __name__ == '__main__':
    asyncio.run(main())
