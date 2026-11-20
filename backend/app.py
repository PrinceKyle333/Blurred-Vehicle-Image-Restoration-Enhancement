from __future__ import annotations

import io
import time
from typing import List

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError

from models import MODEL_SPECS, CheckpointRegistry

app = FastAPI(
    title="Vehicle Image Restoration PyTorch Inference API",
    version="1.0.0",
)

registry = CheckpointRegistry()


@app.get("/api/v1/models/status")
def models_status():
    statuses = registry.get_status()
    any_available = any(item["available"] for item in statuses.values())
    return {
        "backendConnected": True,
        "message": (
            "PyTorch inference service online with loaded checkpoints."
            if any_available
            else "PyTorch inference service online, but no trained checkpoints are loaded yet."
        ),
        "models": statuses,
    }


@app.post("/api/v1/restore")
async def restore_image(
    image: UploadFile = File(...),
    model: str = Form(...),
):
    if model not in {"gan", "diffusion", "transformer", "all"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid model selection. Expected gan, diffusion, transformer, or all.",
        )

    raw_bytes = await image.read()
    try:
        pil_image = Image.open(io.BytesIO(raw_bytes))
        pil_image.load()
    except (UnidentifiedImageError, OSError):
        return JSONResponse(
            status_code=400,
            content={
                "code": "INVALID_INPUT",
                "message": "Uploaded file could not be decoded as a valid JPG or PNG image.",
            },
        )

    requested_ids: List[str] = (
        ["gan", "diffusion", "transformer"] if model == "all" else [model]
    )

    missing = [mid for mid in requested_ids if mid not in registry.loaded_models]
    if missing:
        missing_names = [MODEL_SPECS[mid].name for mid in missing]
        return JSONResponse(
            status_code=503,
            content={
                "code": "MODEL_UNAVAILABLE",
                "message": f"Trained checkpoint not connected for: {', '.join(missing_names)}.",
                "details": "Place trained TorchScript/PyTorch checkpoints inside backend/checkpoints/ and restart the service.",
                "unavailableModels": missing,
            },
        )

    total_start = time.perf_counter()
    results = [registry.run_inference(mid, pil_image) for mid in requested_ids]
    total_elapsed_ms = (time.perf_counter() - total_start) * 1000.0

    return {
        "status": "ok",
        "selectedModel": model,
        "totalElapsedMs": round(total_elapsed_ms, 2),
        "results": results,
    }
