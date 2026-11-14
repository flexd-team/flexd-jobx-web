import pytest

from app.utils.security import create_access_token


@pytest.mark.asyncio
async def test_domain_candidate_and_employer_workflows(api):
    # Candidate token
    api.headers["Authorization"] = f"Bearer {create_access_token(2)}"

    # 1. Candidate profile
    res = await api.get("/api/v1/candidate-profile/me")
    assert res.status_code == 200

    res = await api.post(
        "/api/v1/candidate-profile/me",
        json={
            "headline": "Fullstack Python Engineer",
            "biography": "Passionate developer building AI web apps.",
            "preferred_employment_type": "full_time",
            "preferred_work_mode": "remote",
            "years_experience": 3,
        },
    )
    assert res.status_code == 200
    assert res.json()["data"]["candidate_profile"]["headline"] == "Fullstack Python Engineer"

    # 2. Candidate creates an artifact
    res = await api.post(
        "/api/v1/my/artifacts",
        json={
            "title": "Hospital Management Microservice",
            "artifact_type": "github_repository",
            "description": "Implemented with FastAPI and MySQL",
            "source_url": "https://github.com/example/hospital-management",
            "visibility": "matching_employers",
        },
    )
    assert res.status_code == 201
    artifact_id = res.json()["data"]["artifact"]["id"]

    # 3. List my artifacts
    res = await api.get("/api/v1/my/artifacts")
    assert res.status_code == 200
    assert len(res.json()["data"]["artifacts"]) >= 1

    # 4. Trigger analysis
    res = await api.post(f"/api/v1/artifacts/{artifact_id}/analyze")
    assert res.status_code == 201
    assert res.json()["data"]["artifact_analysis"]["analysis_status"] == "queued"

    # 5. Check published jobs
    res = await api.get("/api/v1/jobs/published")
    assert res.status_code == 200
    assert "job_posts" in res.json()["data"]

    # 6. Check skill catalog
    res = await api.get("/api/v1/catalog/skills")
    assert res.status_code == 200
    assert "skills" in res.json()["data"]


@pytest.mark.asyncio
async def test_employer_job_creation_and_matching(api):
    # Admin creates a canonical skill first
    api.headers["Authorization"] = f"Bearer {create_access_token(1)}"
    skill_res = await api.post(
        "/api/v1/skills",
        json={
            "canonical_name": "FastAPI",
            "slug": "fastapi",
            "category": "technical",
        },
    )
    assert skill_res.status_code == 201
    skill_id = skill_res.json()["data"]["skill"]["id"]

    # Register an employer
    reg = await api.post(
        "/api/v1/auth/register",
        json={
            "name": "Tech Employer",
            "email": "recruiter.test@example.com",
            "password": "Password123!@#",
            "account_type": "employer",
        },
    )
    assert reg.status_code == 201
    employer_id = reg.json()["data"]["user"]["id"]

    # Employer token
    api.headers["Authorization"] = f"Bearer {create_access_token(int(employer_id))}"

    # 1. Company profile
    cp = await api.post(
        "/api/v1/company-profile/me",
        json={
            "name": "Tech Corp Indonesia",
            "industry": "Software Engineering",
            "description": "Building modern enterprise solutions.",
        },
    )
    assert cp.status_code == 200
    assert cp.json()["data"]["company_profile"]["name"] == "Tech Corp Indonesia"

    # 2. Generate AI Job draft
    draft_res = await api.post(
        "/api/v1/jobs/generate-description",
        json={
            "business_problem": "Membangun sistem microservice inventaris dengan FastAPI.",
        },
    )
    assert draft_res.status_code == 200
    assert "draft" in draft_res.json()["data"]["job_draft"]

    # 3. Create published job post
    job_res = await api.post(
        "/api/v1/my/job-posts",
        json={
            "title": "Backend Engineer - Sistem Inventaris",
            "business_problem": "Membangun sistem inventaris berbasis FastAPI.",
            "job_summary": "Mengembangkan API dan integrasi MySQL.",
            "employment_type": "full_time",
            "work_mode": "remote",
            "status": "published",
            "requirements": [
                {"skill_id": skill_id, "requirement_type": "must_have", "weight": "1.0"}
            ],
        },
    )
    assert job_res.status_code == 201
    job_id = job_res.json()["data"]["job_post"]["id"]

    # 4. Candidate calculates match to this job
    api.headers["Authorization"] = f"Bearer {create_access_token(2)}"
    match_res = await api.post(f"/api/v1/job-posts/{job_id}/match")
    assert match_res.status_code == 200
    match_id = match_res.json()["data"]["job_match"]["id"]
    assert match_res.json()["data"]["job_match"]["match_score"] is not None

    # 5. Candidate accepts match
    cand_dec = await api.post(
        f"/api/v1/job-matches/{match_id}/decision", json={"decision": "accepted"}
    )
    assert cand_dec.status_code == 200
    assert cand_dec.json()["data"]["job_match"]["match_status"] == "one_side_interested"

    # 6. Employer views matches and accepts
    api.headers["Authorization"] = f"Bearer {create_access_token(int(employer_id))}"
    emp_matches = await api.get(f"/api/v1/job-posts/{job_id}/matches")
    assert emp_matches.status_code == 200
    assert len(emp_matches.json()["data"]["matches"]) >= 1

    emp_dec = await api.post(
        f"/api/v1/job-matches/{match_id}/decision", json={"decision": "accepted"}
    )
    assert emp_dec.status_code == 200
    # Both accepted => mutually_accepted!
    assert emp_dec.json()["data"]["job_match"]["match_status"] == "mutually_accepted"
