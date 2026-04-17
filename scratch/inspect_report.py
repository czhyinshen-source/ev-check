import asyncio
from sqlalchemy import select
from app.database import async_session_maker
from app.models import CheckReport, CheckResult, CheckResultDetail

async def main():
    async with async_session_maker() as session:
        # 1. 找到该报告
        res = await session.execute(select(CheckReport).where(CheckReport.name.like('%递归目录测试 - 20260413_063752%')))
        report = res.scalar_one_or_none()
        if not report:
            print("未找到报告")
            return
        
        print(f"Report ID: {report.id}, Status: {report.status}")
        
        # 2. 找到该报告下的 CheckResult
        res = await session.execute(select(CheckResult).where(CheckResult.report_id == report.id))
        results = res.scalars().all()
        print(f"发现 {len(results)} 个检查结果节点")
        
        for r in results:
            print(f"  Result ID: {r.id}, Status: {r.status}, Error: {r.error_message}")
            # 3. 检查详情
            res = await session.execute(select(CheckResultDetail).where(CheckResultDetail.result_id == r.id))
            details = res.scalars().all()
            print(f"    详情条数: {len(details)}")
            for d in details[:5]: # 只看前5个
                print(f"      Item ID: {d.check_item_id}, Status: {d.status}, Msg: {d.message}")

if __name__ == "__main__":
    asyncio.run(main())
