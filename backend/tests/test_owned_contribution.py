from app.utils.security import create_access_token


async def test_contribution_owner_and_claim_status(api):
    api.headers["Authorization"] = f"Bearer {create_access_token(2)}"
    created = await api.post(
        "/api/v1/my/artifacts",
        json={"title": "API", "source_url": "https://github.com/example/api"},
    )
    record_id = created.json()["data"]["artifact"]["id"]
    path = f"/api/v1/my/artifacts/{record_id}/contribution"
    values = {"role_title": "Developer", "contribution_description": "Implemented API validation"}
    saved = await api.post(path, json=values)
    assert saved.status_code == 200, saved.text
    record = saved.json()["data"]["artifact_contribution"]
    assert record["contributor_user_id"] == "2"
    assert record["claim_status"] == "self_declared"
    assert (
        await api.post(path, json={**values, "claim_status": "organization_confirmed"})
    ).status_code == 422
    api.headers["Authorization"] = f"Bearer {create_access_token(3)}"
    assert (await api.post(path, json=values)).status_code == 403


async def test_empty_contribution_rejected(api):
    api.headers["Authorization"] = f"Bearer {create_access_token(2)}"
    created = await api.post(
        "/api/v1/my/artifacts",
        json={"title": "API", "source_url": "https://github.com/example/api"},
    )
    record_id = created.json()["data"]["artifact"]["id"]
    assert (
        await api.post(
            f"/api/v1/my/artifacts/{record_id}/contribution",
            json={"role_title": " ", "contribution_description": " "},
        )
    ).status_code == 422
