"""Explicit synthetic outputs. Never claim inspected content or verified skills."""

DEMO_LABEL = "Data demo — bukan hasil analisis nyata"
DEMO_MARKER = {"demo": True, "synthetic": True, "reason": "ai_unavailable"}


def demo_job_draft():
    return {
        **DEMO_MARKER,
        "draft": {
            "suggested_title": "[DEMO] Software Developer",
            "job_summary": DEMO_LABEL,
            "job_description": (
                f"{DEMO_LABEL}. Contoh tugas: mengembangkan fitur, menulis test, "
                "dan meninjau dokumentasi. Sesuaikan kebutuhan sebelum menyimpan draft."
            ),
            "requirements": [],
        },
        "limitations": [DEMO_LABEL, "Tidak menyimpulkan kebutuhan skill dari input pengguna."],
    }
