from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import CheckReport, CheckResult, CheckResultDetail

router = APIRouter(tags=["Reports"])

@router.get("")
async def list_reports(skip: int = 0, limit: int = 50, db: AsyncSession = Depends(get_db)):
    """获取所有执行报告（批次）列表，带上底层的检查项总梳理维度的统计"""
    # 子查询：统计每个报告的成功检查项总数
    pass_subq = (
        select(CheckResult.report_id, func.count(CheckResultDetail.id).label("pass_count"))
        .join(CheckResultDetail, CheckResult.id == CheckResultDetail.result_id)
        .where(CheckResultDetail.status == "pass")
        .group_by(CheckResult.report_id)
        .subquery()
    )

    # 子查询：统计每个报告的失败（非成功）检查项总数
    fail_subq = (
        select(CheckResult.report_id, func.count(CheckResultDetail.id).label("fail_count"))
        .join(CheckResultDetail, CheckResult.id == CheckResultDetail.result_id)
        .where(CheckResultDetail.status != "pass")
        .group_by(CheckResult.report_id)
        .subquery()
    )

    result = await db.execute(
        select(CheckReport, pass_subq.c.pass_count, fail_subq.c.fail_count)
        .outerjoin(pass_subq, CheckReport.id == pass_subq.c.report_id)
        .outerjoin(fail_subq, CheckReport.id == fail_subq.c.report_id)
        .options(selectinload(CheckReport.rule))
        .order_by(desc(CheckReport.id))
        .offset(skip)
        .limit(limit)
    )
    
    rows = result.all()
    
    return [
        {
            "id": r.CheckReport.id,
            "rule_id": r.CheckReport.rule_id,
            "rule_name": r.CheckReport.rule.name if r.CheckReport.rule else "未知规则",
            "name": r.CheckReport.name,
            "trigger_type": r.CheckReport.trigger_type,
            "status": r.CheckReport.status,
            "total_nodes": r.CheckReport.total_nodes,
            "completed_nodes": r.CheckReport.completed_nodes,
            "success_nodes": r.CheckReport.success_nodes,
            "failed_nodes": r.CheckReport.failed_nodes,
            "success_checks": r.pass_count or 0,
            "failed_checks": r.fail_count or 0,
            "start_time": r.CheckReport.start_time,
            "end_time": r.CheckReport.end_time,
            "created_at": r.CheckReport.created_at
        } for r in rows
    ]

@router.get("/{report_id}/details")
async def get_report_details(report_id: int, db: AsyncSession = Depends(get_db)):
    """
    获取报告的具体执行细节，按 `检查项 -> 通信机 -> Diff` 格式组织
    这样前端可以直接做4级下钻展示。
    """
    result = await db.execute(select(CheckReport).where(CheckReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
        
    # 获取所有的 CheckResult 及其下的 CheckResultDetail
    result = await db.execute(
        select(CheckResult)
        .options(
            selectinload(CheckResult.communication),
            selectinload(CheckResult.details).selectinload(CheckResultDetail.check_item)
        )
        .where(CheckResult.report_id == report_id)
    )
    results = result.scalars().all()
    
    # 结构化重组：按检查项(CheckItem)归类
    items_map = {}
    
    for check_result in results:
        comm = check_result.communication
        comm_info = {
            "id": comm.id if comm else None,
            "name": comm.name if comm else "已删除节点",
            "ip_address": comm.ip_address if comm else "未知IP",
            "result_id": check_result.id,
            "overall_status": check_result.status,
            "error_message": check_result.error_message
        }
        
        for detail in check_result.details:
            item = detail.check_item
            if not item:
                continue
                
            item_key = item.id
            if item_key not in items_map:
                items_map[item_key] = {
                    "item_id": item.id,
                    "item_name": item.name,
                    "item_type": getattr(item, "type", "未知"), 
                    "item_path": item.target_path,
                    "total_checks": 0,
                    "pass_count": 0,
                    "fail_count": 0,
                    "communications": []
                }
                
            stats = items_map[item_key]
            stats["total_checks"] += 1
            if detail.status == "pass":
                stats["pass_count"] += 1
            else:
                stats["fail_count"] += 1
                
            stats["communications"].append({
                "communication": comm_info,
                "status": detail.status,
                "expected_value": detail.expected_value,
                "actual_value": detail.actual_value,
                "message": detail.message
            })
            
    # 转换为列表
    items_list = list(items_map.values())
    
    return {
        "report_info": {
            "name": report.name,
            "status": report.status,
            "total_nodes": report.total_nodes,
            "completed_nodes": report.completed_nodes,
            "success_nodes": report.success_nodes,
            "failed_nodes": report.failed_nodes,
            "start_time": report.start_time,
            "end_time": report.end_time
        },
        "items": items_list
    }

@router.post("/{report_id}/cancel")
async def cancel_report(
    report_id: int, 
    db: AsyncSession = Depends(get_db)
):
    """强制终止指定的执行报告及下属任务"""
    import datetime
    from app.services.check_lock import get_check_lock_manager
    
    result = await db.execute(select(CheckReport).where(CheckReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
        
    if report.status not in ["running", "pending"]:
        return {"message": "该报表已经处于完成或终止状态，无需取消。"}

    # 查找挂起的子任务
    result = await db.execute(
        select(CheckResult)
        .where(CheckResult.report_id == report_id)
        .where(CheckResult.status.in_(["pending", "running"]))
    )
    stuck_tasks = result.scalars().all()
    
    lock_manager = get_check_lock_manager()
    
    # 取消所有子任务
    for task in stuck_tasks:
        task.status = "failed"
        task.error_message = "用户手动强制中断执行"
        task.end_time = datetime.datetime.utcnow()
        await lock_manager.release_lock(task.id)
        
    # 取消报告本身
    report.status = "cancelled"
    report.end_time = datetime.datetime.utcnow()
    report.failed_nodes += len(stuck_tasks)
    
    # 尝试释放全局大锁
    if await lock_manager.is_locked():
        await lock_manager.force_release_lock()
        
    await db.commit()
    
    return {"message": f"已成功强制取消，清理了 {len(stuck_tasks)} 个后台任务"}


@router.delete("/{report_id}")
async def delete_report(
    report_id: int,
    db: AsyncSession = Depends(get_db)
):
    """永久删除指定的执行报告及所有关联记录"""
    result = await db.execute(select(CheckReport).where(CheckReport.id == report_id))
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
        
    await db.delete(report)
    await db.commit()
    
    return {"message": "报告及关联记录已成功删除"}


