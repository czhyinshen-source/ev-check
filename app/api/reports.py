import datetime
from app.utils.datetime_util import get_now
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select, desc, func, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import CheckReport, CheckResult, CheckResultDetail

router = APIRouter(tags=["Reports"])

@router.get("")
async def list_reports(
    response: Response,
    q: Optional[str] = None,
    rule_id: Optional[int] = None,
    sort: Optional[str] = 'id',
    order: Optional[str] = 'desc',
    skip: int = 0, 
    limit: int = 10, 
    db: AsyncSession = Depends(get_db)
):
    """获取所有执行报告（批次）列表，带上底层的检查项总梳理维度的统计"""
    from sqlalchemy import asc, desc

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

    # 构造基础查询对象
    query = (
        select(CheckReport, pass_subq.c.pass_count, fail_subq.c.fail_count)
        .outerjoin(pass_subq, CheckReport.id == pass_subq.c.report_id)
        .outerjoin(fail_subq, CheckReport.id == fail_subq.c.report_id)
        .options(selectinload(CheckReport.rule))
    )

    # 筛选条件
    if q:
        query = query.where(CheckReport.name.ilike(f"%{q}%"))
    if rule_id:
        query = query.where(CheckReport.rule_id == rule_id)

    # 排序处理
    sort_map = {
        "id": CheckReport.id,
        "name": CheckReport.name,
        "status": CheckReport.status,
        "start_time": CheckReport.start_time,
        "trigger_type": CheckReport.trigger_type,
        "created_at": CheckReport.created_at
    }
    
    sort_column = sort_map.get(sort, CheckReport.id)
    if order == 'asc':
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))
    
    # 获取总数并设置 Header (计数也需要包含筛选条件)
    count_query = select(func.count(CheckReport.id))
    if q:
        count_query = count_query.where(CheckReport.name.ilike(f"%{q}%"))
    if rule_id:
        count_query = count_query.where(CheckReport.rule_id == rule_id)
        
    total_count = await db.scalar(count_query)
    response.headers["X-Total-Count"] = str(total_count)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count" # 确保前端能读到

    # 执行分页查询
    result = await db.execute(
        query.offset(skip).limit(limit)
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
        task.end_time = get_now()
        await lock_manager.release_lock(task.id)
        
    # 取消报告本身
    report.status = "cancelled"
    report.end_time = get_now()
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


from pydantic import BaseModel

class ReportBatchDeleteRequest(BaseModel):
    ids: List[int]

@router.post("/batch-delete")
async def batch_delete_reports(
    req: ReportBatchDeleteRequest,
    db: AsyncSession = Depends(get_db)
):
    """批量删除指定的执行报告及所有关联记录"""
    if not req.ids:
        return {"message": "没有提供要删除的ID集合"}
        
    result = await db.execute(select(CheckReport).where(CheckReport.id.in_(req.ids)))
    reports = result.scalars().all()
    
    deleted_count = 0
    for report in reports:
        await db.delete(report)
        deleted_count += 1
        
    # Commit all deletions in one transaction
    await db.commit()
    
    return {"message": f"成功批量删除了 {deleted_count} 份报告及关联记录"}



@router.get("/summary/stats")
async def get_report_stats(db: AsyncSession = Depends(get_db)):
    """获取报表中心的统计数据，用于首页仪表盘"""
    import datetime
    from app.models.check_result import CheckRule
    
    now = datetime.datetime.now() # 使用本地时间进行业务展示
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    # 1. 总任务数 (历史所有执行过的报告)
    total_result = await db.execute(select(func.count(CheckReport.id)))
    total_count = total_result.scalar() or 0
    
    # 2. 今日已执行成功
    success_result = await db.execute(
        select(func.count(CheckReport.id))
        .where(CheckReport.status == "success")
        .where(CheckReport.created_at >= today_start)
    )
    today_success = success_result.scalar() or 0
    
    # 3. 今日已执行失败
    failed_result = await db.execute(
        select(func.count(CheckReport.id))
        .where(CheckReport.status == "failed")
        .where(CheckReport.created_at >= today_start)
    )
    today_failed = failed_result.scalar() or 0
    
    # 4. 计算“即将执行”的任务数
    # 定义：(正在运行的任务) + (今天剩余时间计划要跑的任务)
    
    # 4a. 正在运行/排队的
    running_result = await db.execute(
        select(func.count(CheckReport.id))
        .where(CheckReport.status.in_(["pending", "running"]))
        .where(CheckReport.created_at >= today_start)
    )
    currently_active = running_result.scalar() or 0
    
    # 4b. 剩余计划任务 (计算 cron 预测)
    # 获取所有带定时配置的激活规则
    rules_result = await db.execute(
        select(CheckRule.cron_expression)
        .where(CheckRule.is_active == 1)
        .where(CheckRule.cron_expression != None)
    )
    active_crons = rules_result.scalars().all()
    
    future_scheduled_count = 0
    
    # 简单的 Cron 预测逻辑 (支持 * 和 具体数字，以及 / 步进)
    def count_future_runs(cron_str, start_time):
        try:
            parts = cron_str.split()
            if len(parts) != 5: return 0
            
            # 分钟, 小时, 日, 月, 周
            m_expr, h_expr = parts[0], parts[1]
            
            # 扩展小时列表
            def expand(expr, max_val):
                if expr == '*': return list(range(max_val))
                if '/' in expr:
                    base, step = expr.split('/')
                    start = 0 if base == '*' else int(base)
                    return list(range(start, max_val, int(step)))
                if ',' in expr:
                    return [int(x) for x in expr.split(',')]
                if '-' in expr:
                    s, e = expr.split('-')
                    return list(range(int(s), int(e) + 1))
                return [int(expr)]

            target_hours = expand(h_expr, 24)
            target_minutes = expand(m_expr, 60)
            
            count = 0
            curr_h = start_time.hour
            curr_m = start_time.minute
            
            for h in target_hours:
                if h < curr_h: continue
                for m in target_minutes:
                    if h == curr_h and m <= curr_m: continue
                    count += 1
            return count
        except:
            return 0

    for cron in active_crons:
        future_scheduled_count += count_future_runs(cron, now)
    
    return {
        "total_tasks": total_count,
        "today_success": today_success,
        "today_failed": today_failed,
        "today_pending": currently_active + future_scheduled_count
    }
