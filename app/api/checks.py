# 环境检查 API
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, CheckResult, CheckResultDetail
from app.api.users import get_current_active_user
from app.services.report_exporter import export_check_result

router = APIRouter()


@router.post("", status_code=status.HTTP_201_CREATED)
async def start_check(
    check_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """启动环境检查"""
    db_result = CheckResult(
        rule_id=check_data.get("rule_id"),
        communication_id=check_data.get("communication_id"),
        status="running",
        start_time=datetime.utcnow(),
        progress=0,
    )
    db.add(db_result)
    await db.commit()
    await db.refresh(db_result)
    return {
        "id": db_result.id,
        "rule_id": db_result.rule_id,
        "status": db_result.status,
        "start_time": db_result.start_time.isoformat(),
    }


@router.get("", response_model=List[dict])
async def list_check_results(
    rule_id: Optional[int] = None,
    communication_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取检查结果列表"""
    query = select(CheckResult)
    if rule_id:
        query = query.where(CheckResult.rule_id == rule_id)
    if communication_id:
        query = query.where(CheckResult.communication_id == communication_id)
    query = query.order_by(CheckResult.start_time.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    results = result.scalars().all()
    return [
        {
            "id": r.id,
            "rule_id": r.rule_id,
            "communication_id": r.communication_id,
            "status": r.status,
            "start_time": r.start_time.isoformat(),
            "end_time": r.end_time.isoformat() if r.end_time else None,
            "progress": r.progress,
            "error_message": r.error_message,
        }
        for r in results
    ]


@router.get("/{result_id}")
async def get_check_result(
    result_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取检查结果详情"""
    result = await db.execute(select(CheckResult).where(CheckResult.id == result_id))
    check_result = result.scalar_one_or_none()
    if not check_result:
        raise HTTPException(status_code=404, detail="检查结果不存在")

    details_result = await db.execute(
        select(CheckResultDetail).where(CheckResultDetail.result_id == result_id)
    )
    details = details_result.scalars().all()

    return {
        "id": check_result.id,
        "rule_id": check_result.rule_id,
        "communication_id": check_result.communication_id,
        "status": check_result.status,
        "start_time": check_result.start_time.isoformat(),
        "end_time": check_result.end_time.isoformat() if check_result.end_time else None,
        "progress": check_result.progress,
        "error_message": check_result.error_message,
        "details": [
            {
                "id": d.id,
                "check_item_id": d.check_item_id,
                "status": d.status,
                "expected_value": d.expected_value,
                "actual_value": d.actual_value,
                "message": d.message,
            }
            for d in details
        ],
    }


@router.get("/{result_id}/progress")
async def get_check_progress(
    result_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """获取检查进度"""
    result = await db.execute(select(CheckResult).where(CheckResult.id == result_id))
    check_result = result.scalar_one_or_none()
    if not check_result:
        raise HTTPException(status_code=404, detail="检查结果不存在")

    return {
        "id": check_result.id,
        "status": check_result.status,
        "progress": check_result.progress,
    }


@router.delete("/{result_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_check(
    result_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """取消检查任务"""
    result = await db.execute(select(CheckResult).where(CheckResult.id == result_id))
    check_result = result.scalar_one_or_none()
    if not check_result:
        raise HTTPException(status_code=404, detail="检查结果不存在")

    if check_result.status == "running":
        check_result.status = "cancelled"
        check_result.end_time = datetime.utcnow()
        await db.commit()


@router.get("/{result_id}/export")
async def export_check_result(
    result_id: int,
    format: str = "pdf",
    current_user: User = Depends(get_current_active_user),
):
    """导出检查结果为 PDF 或 Excel"""
    try:
        content = export_check_result(result_id, format)
        media_type = "application/pdf" if format.lower() == "pdf" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"check_result_{result_id}.{format}"
        
        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")
