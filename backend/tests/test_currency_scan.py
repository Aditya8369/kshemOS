
from __future__ import annotations

import asyncio
import io

import pytest
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers
from PIL import Image

from app.routers import currency as router
from app.services import currency_scan as service


def create_test_image() -> bytes:
    """Create a small valid PNG image for testing."""
    image = Image.new("RGB", (400, 300), color="white")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def create_upload(
    image_bytes: bytes,
    content_type: str = "image/png",
) -> UploadFile:
    return UploadFile(
        filename="test_note.png",
        file=io.BytesIO(image_bytes),
        headers=Headers({"content-type": content_type}),
    )


def test_currency_analysis_returns_inconclusive():
    result = service.analyze_currency_image(create_test_image())

    assert result["verdict"] == "inconclusive"
    assert result["confidence"] == 0.0
    assert "reasons" in result
    assert "signals" in result
    assert result["quality_status"] in ("acceptable", "needs_retake")
    assert "quality_checks" in result
    assert result["model_version"] == service.MODEL_VERSION
    assert result["analysis_status"] == "quality_only_model_unavailable"


def test_currency_analysis_handles_invalid_image():
    result = service.analyze_currency_image(b"invalid image data")

    assert result["verdict"] == "inconclusive"
    assert result["confidence"] == 0.0
    assert result["quality_status"] == "invalid"
    assert result["quality_checks"]["image_readable"] is False


def test_currency_upload_accepts_valid_png():
    upload = create_upload(create_test_image())

    result = asyncio.run(router.scan(upload))

    assert result["verdict"] == "inconclusive"
    assert result["quality_status"] in ("acceptable", "needs_retake")


def test_currency_upload_rejects_unsupported_file_type():
    upload = create_upload(
        create_test_image(),
        content_type="application/pdf",
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(router.scan(upload))

    assert exc.value.status_code == 415


def test_currency_upload_rejects_empty_file():
    upload = create_upload(b"")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(router.scan(upload))

    assert exc.value.status_code == 400


def test_currency_upload_rejects_oversized_file():
    upload = create_upload(b"x" * (router.MAX_UPLOAD_SIZE + 1))

    with pytest.raises(HTTPException) as exc:
        asyncio.run(router.scan(upload))

    assert exc.value.status_code == 413


def test_currency_upload_rejects_malformed_image():
    upload = create_upload(b"not a real PNG image")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(router.scan(upload))

    assert exc.value.status_code == 400
