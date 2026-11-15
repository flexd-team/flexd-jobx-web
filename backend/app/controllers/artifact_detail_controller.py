from app.services.artifact_detail_service import get_artifact_detail, list_artifact_evidence


async def get_owned_artifact_detail(db, artifact_id, actor):
    return {
        "message": {"success": "Artifact detail retrieved"},
        "error": {},
        "data": await get_artifact_detail(db, artifact_id, actor),
    }


async def get_owned_artifact_evidence(db, artifact_id, actor, limit, offset):
    items, total = await list_artifact_evidence(db, artifact_id, actor, limit, offset)
    return {
        "message": {"success": "Artifact evidence retrieved"},
        "error": {},
        "data": {
            "artifact_skill_evidences": items,
            "pagination": {"total": total, "limit": limit, "offset": offset},
        },
    }
