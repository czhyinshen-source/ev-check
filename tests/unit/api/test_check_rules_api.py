import pytest
from app.main import app
from app.api.users import get_current_active_user
from app.database import get_db
from app.models.user import User

async def mock_active_user():
    return User(id=1, username="testadmin", is_active=True)

@pytest.fixture(autouse=True)
def override_dependencies(db_session):
    async def _get_override_db():
        yield db_session
        
    app.dependency_overrides[get_current_active_user] = mock_active_user
    app.dependency_overrides[get_db] = _get_override_db
    yield
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_create_check_rule_api(client):
    payload = {
        "name": "API Rule", "is_active": True, "allow_manual_execution": True,
        "snapshot_ids": [], "snapshot_group_ids": [],
        "check_item_ids": [], "check_item_list_ids": [],
        "communication_ids": [], "communication_group_ids": []
    }
    res = await client.post("/api/v1/check-rules", json=payload)
    assert res.status_code == 200
    assert res.json()["name"] == "API Rule"

