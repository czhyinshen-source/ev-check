import asyncio
from sqlalchemy import select, func
from app.database import async_session_maker
from app.models import CheckReport, CheckResult, CheckResultDetail

async def main():
    async with async_session_maker() as session:
        pass_subq = (
            select(CheckResult.report_id, func.count(CheckResultDetail.id).label("pass_count"))
            .join(CheckResultDetail, CheckResult.id == CheckResultDetail.result_id)
            .where(CheckResultDetail.status == "pass")
            .group_by(CheckResult.report_id)
            .subquery()
        )
        fail_subq = (
            select(CheckResult.report_id, func.count(CheckResultDetail.id).label("fail_count"))
            .join(CheckResultDetail, CheckResult.id == CheckResultDetail.result_id)
            .where(CheckResultDetail.status != "pass")
            .group_by(CheckResult.report_id)
            .subquery()
        )
        stmt = (
            select(CheckReport, pass_subq.c.pass_count, fail_subq.c.fail_count)
            .outerjoin(pass_subq, CheckReport.id == pass_subq.c.report_id)
            .outerjoin(fail_subq, CheckReport.id == fail_subq.c.report_id)
            .order_by(CheckReport.id.desc())
            .limit(5)
        )
        result = await session.execute(stmt)
        for r, p, f in result:
            print(f"Report: {r.name}, Pass: {p}, Fail: {f}")

asyncio.run(main())
