from app.utils.security import create_access_token


async def test_owner_job_patch_rejects_ownership_and_internal_fields(api):
    api.headers["Authorization"] = f"Bearer {create_access_token(3)}"
    created = await api.post(
        "/api/v1/my/job-posts",
        json={"title": "API engineer", "business_problem": "Build an API"},
    )
    assert created.status_code == 201, created.text
    record_id = created.json()["data"]["job_post"]["id"]
    path = f"/api/v1/my/job-posts/{record_id}"
    for values in [{"user_id": "2"}, {"id": "999"}, {"published_at": "2026-01-01T00:00:00"}]:
        assert (await api.patch(path, json=values)).status_code == 422
    assert (await api.patch(path, json={"title": "Updated API engineer"})).status_code == 200
    api.headers["Authorization"] = f"Bearer {create_access_token(2)}"
    assert (await api.patch(path, json={"title": "Stolen"})).status_code == 403


async def test_self_service_cannot_publish_without_approval(api):
    api.headers["Authorization"] = f"Bearer {create_access_token(3)}"
    assert (
        await api.post(
            "/api/v1/my/job-posts",
            json={
                "title": "API engineer",
                "business_problem": "Build an API",
                "status": "published",
            },
        )
    ).status_code == 409
    created = await api.post(
        "/api/v1/my/job-posts",
        json={"title": "API engineer", "business_problem": "Build an API"},
    )
    record_id = created.json()["data"]["job_post"]["id"]
    assert (
        await api.patch(f"/api/v1/my/job-posts/{record_id}", json={"status": "published"})
    ).status_code == 409
