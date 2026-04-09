from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import CheckReport, CheckResult, CheckResultDetail

router = APIRouter(tags=["Reports"])

@router.get("")
async def list_reports(skip: int = 0, limit: int = 50, db: AsyncSession = Depends(get_db)):
    """获取所有执行报告（批次）列表"""
    # Includes rule to let frontend display rule name if it diverged
    result = await db.execute(
        select(CheckReport)
        .options(selectinload(CheckReport.rule))
        .order_by(desc(CheckReport.id))
        .offset(skip)
        .limit(limit)
    )
    reports = result.scalars().all()
    
    return [
        {
            "id": r.id,
            "rule_id": r.rule_id,
            "rule_name": r.rule.name if r.rule else "未知规则",
            "name": r.name,
            "trigger_type": r.trigger_type,
            "status": r.status,
            "total_nodes": r.total_nodes,
            "completed_nodes": r.completed_nodes,
            "success_nodes": r.success_nodes,
            "failed_nodes": r.failed_nodes,
            "start_time": r.start_time,
            "end_time": r.end_time,
            "created_at": r.created_at
        } for r in reports
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
