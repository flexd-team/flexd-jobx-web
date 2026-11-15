from app.utils.security import create_access_token


async def test_owned_detail_and_scoped_evidence(api):
    skill = (
        await api.post("/api/v1/skills", json={"canonical_name": "Python", "slug": "python"})
    ).json()["data"]["skill"]
    api.headers["Authorization"] = f"Bearer {create_access_token(2)}"
    ids = []
    for title in ["API", "Other"]:
        response = await api.post(
            "/api/v1/my/artifacts",
            json={"title": title, "source_url": "https://github.com/example/api"},
        )
        ids.append(response.json()["data"]["artifact"]["id"])
    path = f"/api/v1/my/artifacts/{ids[0]}"
    await api.post(
        path + "/contribution",
        json={"role_title": "Developer", "contribution_description": "Built API"},
    )
    detail = await api.get(path)
    assert detail.status_code == 200
    assert detail.json()["data"]["artifact"]["title"] == "API"
    assert detail.json()["data"]["artifact_contribution"]["role_title"] == "Developer"
    assert detail.json()["data"]["artifact_analysis"] is None
    api.headers["Authorization"] = f"Bearer {create_access_token(1)}"
    for record_id in ids:
        analysis = await api.post(
            "/api/v1/artifact-analyses",
            json={"artifact_id": record_id, "analysis_status": "completed"},
        )
        assert analysis.status_code == 201, analysis.text
        evidence = await api.post(
            "/api/v1/artifact-skill-evidences",
            json={
                "artifact_id": record_id,
                "analysis_id": analysis.json()["data"]["artifact_analysis"]["id"],
                "skill_id": skill["id"],
                "evidence_kind": "direct",
                "evidence_excerpt": "import python",
                "evidence_location": "main.py:1",
                "confidence_score": "0.9000",
            },
        )
        assert evidence.status_code == 201, evidence.text
    api.headers["Authorization"] = f"Bearer {create_access_token(2)}"
    response = await api.get(path + "/skill-evidences?limit=1")
    assert response.status_code == 200
    assert response.json()["data"]["pagination"]["total"] == 1
    assert response.json()["data"]["artifact_skill_evidences"][0]["artifact_id"] == ids[0]
    assert response.json()["data"]["artifact_skill_evidences"][0]["skill_name"] == "Python"
    assert (await api.get(path + "/skill-evidences?offset=1")).json()["data"][
        "artifact_skill_evidences"
    ] == []
    assert (await api.get("/api/v1/my/artifacts/999")).status_code == 404
    api.headers["Authorization"] = f"Bearer {create_access_token(3)}"
    assert (await api.get(path)).status_code == 403
    assert (await api.get(path + "/skill-evidences")).status_code == 403


async def test_candidate_cannot_read_another_candidates_artifact(api):
    created = await api.post(
        "/api/v1/artifacts",
        json={
            "owner_user_id": "2",
            "title": "Private",
            "artifact_type": "document",
            "source_url": "https://example.com",
        },
    )
    record_id = created.json()["data"]["artifact"]["id"]
    user = await api.post(
        "/api/v1/auth/register",
        json={
            "name": "Other",
            "email": "other@example.com",
            "password": "other-password-123",
            "account_type": "candidate",
        },
    )
    api.headers["Authorization"] = (
        f"Bearer {create_access_token(int(user.json()['data']['user']['id']))}"
    )
    assert (await api.get(f"/api/v1/my/artifacts/{record_id}")).status_code == 404
    assert (await api.get(f"/api/v1/my/artifacts/{record_id}/skill-evidences")).status_code == 404
