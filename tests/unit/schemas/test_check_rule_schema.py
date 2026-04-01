import pytest
from app.schemas.check_rule import CheckRuleCreate

def test_check_rule_create_schema():
    payload = {
        "name": "Rule 1", "is_active": True, "allow_manual_execution": True,
        "snapshot_ids": [1], "snapshot_group_ids": [],
        "check_item_ids": [], "check_item_list_ids": [1],
        "communication_ids": [1], "communication_group_ids": []
    }
    obj = CheckRuleCreate(**payload)
    assert obj.snapshot_ids == [1]
