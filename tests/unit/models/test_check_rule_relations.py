import pytest
from app.models.check_result import CheckRule, CheckRuleSnapshot
from sqlalchemy import select

@pytest.mark.asyncio
async def test_check_rule_snapshot_relation(db_session, test_snapshot):
    rule = CheckRule(name="Test Rule")
    db_session.add(rule)
    await db_session.flush()
    rel = CheckRuleSnapshot(rule_id=rule.id, snapshot_id=test_snapshot.id)
    db_session.add(rel)
    await db_session.commit()
    assert rel.id is not None
