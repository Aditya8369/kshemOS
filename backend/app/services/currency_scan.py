
"""
Counterfeit Currency Agent.

Uses lightweight image heuristics to assess image quality.
These heuristics do NOT establish whether a banknote is genuine or counterfeit.
A validated model can be integrated later.
"""
from __future__ import annotations

import io

import numpy as np
from PIL import Image, ImageFilter


MODEL_VERSION = "not-configured"


def _edge_density(gray: np.ndarray) -> float:
    # Simple Sobel-like gradient magnitude via numpy diff (no OpenCV needed).
    gx = np.diff(gray.astype(np.float32), axis=1)
    gy = np.diff(gray.astype(np.float32), axis=0)
    gx = gx[:-1, :]
    gy = gy[:, :-1]
    magnitude = np.sqrt(gx**2 + gy**2)

    if magnitude.size == 0:
        return 0.0

    threshold = magnitude.mean() + magnitude.std()
    edge_pixels = (magnitude > threshold).sum()
    return float(edge_pixels / magnitude.size)


def _texture_uniformity(gray: np.ndarray) -> float:
    # Basic image texture indicator.
    std = gray.astype(np.float32).std()
    return float(std)


def _sharpness(image: Image.Image) -> float:
    edges = image.convert("L").filter(ImageFilter.FIND_EDGES)
    arr = np.asarray(edges, dtype=np.float32)
    return float(arr.var())


def analyze_currency_image(image_bytes: bytes) -> dict:
    """
    Analyze image quality using lightweight heuristics.

    Authenticity prediction is unavailable until a validated
    currency authentication model is integrated.
    """
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image_format = image.format
        image = image.convert("RGB")
    except Exception:
        return {
            "verdict": "inconclusive",
            "confidence": 0.0,
            "reasons": [
                "Could not read image data. Please upload a valid JPEG or PNG image."
            ],
            "signals": {},
            "quality_status": "invalid",
            "quality_checks": {"image_readable": False},
            "model_version": MODEL_VERSION,
            "analysis_status": "quality_only_model_unavailable",
        }

    width, height = image.size
    gray = np.asarray(image.convert("L"))

    edge_density = _edge_density(gray)
    texture = _texture_uniformity(gray)
    sharpness = _sharpness(image)
    resolution_score = min(1.0, (width * height) / (1200 * 600))

    reasons = []

    # Image resolution check
    resolution_ok = resolution_score >= 0.5
    if not resolution_ok:
        reasons.append(
            "Image resolution is low. Retake the photo closer to the note."
        )

    # Edge detail check
    edge_detail_ok = edge_density >= 0.08
    if not edge_detail_ok:
        reasons.append(
            "Limited fine-detail information detected in the image."
        )

    # Texture check
    texture_ok = texture >= 30
    if not texture_ok:
        reasons.append(
            "Image texture detail is limited."
        )

    # Sharpness check
    sharpness_ok = sharpness >= 800
    if not sharpness_ok:
        reasons.append(
            "Image may be blurry. Fine details cannot be assessed reliably."
        )

    quality_checks = {
        "image_readable": True,
        "supported_format": image_format in ("JPEG", "PNG", "WEBP"),
        "sufficient_resolution": resolution_ok,
        "edge_detail_available": edge_detail_ok,
        "texture_detail_available": texture_ok,
        "sharpness_acceptable": sharpness_ok,
    }

    quality_ok = (
        resolution_ok
        and edge_detail_ok
        and texture_ok
        and sharpness_ok
    )

    if not reasons:
        reasons.append(
            "Basic image-quality checks passed. Banknote authenticity has not been verified."
        )

    signals = {
        "width": width,
        "height": height,
        "format": image_format,
        "edge_density": round(edge_density, 4),
        "texture_std": round(texture, 2),
        "sharpness_variance": round(sharpness, 2),
        "resolution_score": round(resolution_score, 2),
    }

    return {
        # Heuristic image checks cannot determine authenticity.
        "verdict": "inconclusive",
        "confidence": 0.0,
        "reasons": reasons,
        "signals": signals,
        "quality_status": "acceptable" if quality_ok else "needs_retake",
        "quality_checks": quality_checks,
        "model_version": MODEL_VERSION,
        "analysis_status": "quality_only_model_unavailable",
    }
