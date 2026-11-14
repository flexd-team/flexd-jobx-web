from typing import Any

from pydantic import BaseModel


def item_response(message: str, key: str, item: Any) -> dict:
    val = None
    if isinstance(item, BaseModel):
        val = item.model_dump(mode="json")
    elif isinstance(item, dict):
        val = item
    elif item is not None:
        val = item

    return {
        "message": {"success": message},
        "error": {},
        "data": {key: val},
    }


def list_response(
    message: str, key: str, items: list[BaseModel], total: int, limit: int, offset: int
) -> dict:
    return {
        "message": {"success": message},
        "error": {},
        "data": {
            key: [item.model_dump(mode="json") for item in items],
            "pagination": {"total": total, "limit": limit, "offset": offset},
        },
    }


def empty_response(message: str) -> dict:
    return {"message": {"success": message}, "error": {}, "data": {}}
