
import io

from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image, UnidentifiedImageError

from app.models import CurrencyScanResponse
from app.services.currency_scan import analyze_currency_image

router = APIRouter(prefix="/api/currency", tags=["Counterfeit Currency Agent"])

MAX_UPLOAD_SIZE = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


@router.post("/scan", response_model=CurrencyScanResponse)
async def scan(image: UploadFile = File(...)):
    # Validate uploaded file type
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Only JPEG, PNG, and WebP images are supported.",
        )

    # Read and validate file size
    image_bytes = await image.read(MAX_UPLOAD_SIZE + 1)

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded image is empty.",
        )

    if len(image_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Image size must not exceed 5 MB.",
        )

    # Validate image contents
    try:
        with Image.open(io.BytesIO(image_bytes)) as uploaded_image:
            uploaded_image.verify()

        with Image.open(io.BytesIO(image_bytes)) as uploaded_image:
            if uploaded_image.format not in ALLOWED_FORMATS:
                raise HTTPException(
                    status_code=415,
                    detail="The uploaded file is not a supported image format.",
                )

            if uploaded_image.width * uploaded_image.height > 20_000_000:
                raise HTTPException(
                    status_code=413,
                    detail="Image dimensions are too large.",
                )

    except HTTPException:
        raise
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
    ):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid image.",
        )

    # Analyze the validated image
    result = analyze_currency_image(image_bytes)
    return result
