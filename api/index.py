import os
import json
import base64
import re
from pathlib import Path
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import httpx
from dotenv import load_dotenv

# Load local environment variables if available
load_dotenv()

app = FastAPI(
    title="Whisk AI - Image to Reverse Prompt",
    description="Deconstruct images into structured, ultra-detailed reverse prompts modeled after Google Whisk.",
    version="1.0.0"
)

# Enable CORS for local testing & Vercel deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models to attempt (in order of priority)
CANDIDATE_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-3.8-flash"
]

WHISK_SYSTEM_PROMPT = """You are an elite visual director and prompt reverse-engineer, modeling the exact reverse-prompting architecture of Google Whisk and Google Labs.

Your objective is to inspect the uploaded image and deconstruct every visual, structural, and aesthetic element with surgical precision, translating it into a prompt suitable for state-of-the-art image generators (like Imagen 3, Midjourney v6, and Flux).

Analyze the image systematically across these 6 visual layers:
1. SUBJECT: The exact focal entity/character/object. Detail identity, anatomy, expression, pose, attire, fabric weave, surface textures, material flaws, and gaze direction.
2. SCENE: Environment and spatial staging. Foreground, midground, background elements, depth layering, architecture, nature, props, atmosphere.
3. STYLE: Artistic medium and aesthetic treatment. Exact medium (e.g., 35mm film photograph, oil painting on linen, claymation with visible thumbprints, gouache, digital 3D render), grain/brushstroke texture, artistic movement.
4. LIGHTING: Light sources, direction, warmth/coolness, shadows (hard/soft), rim light, ambient bounce, volumetric dust/mist.
5. COLOR: Palette and tonal grading. Dominant shades, secondary tones, accent pops, saturation, temperature.
6. CAMERA: Shot framing, angle, perspective, lens focal length (e.g. 85mm f/1.4, 24mm wide-angle), depth of field, and bokeh quality.

YOU MUST RESPOND STRICTLY WITH VALID JSON (no markdown fences, no explanatory text outside the JSON object).
Schema:
{
  "master_prompt": "A complete, cohesive, dense natural-language prompt paragraph combining all layers seamlessly into a vivid description ready to paste into Imagen 3 or Midjourney. Never use generic filler like 'photorealistic' or 'masterpiece' — use concrete physical descriptors.",
  "breakdown": {
    "subject": "Detailed description of the subject, micro-features, pose, materials, and expression.",
    "scene": "Detailed spatial staging, background, depth, and environment.",
    "style": "Art medium, rendering style, surface texture, and aesthetic.",
    "lighting": "Light direction, temperature, shadows, and atmospheric glow.",
    "color": "Color palette, dominant hues, accents, and contrast.",
    "camera": "Camera shot type, angle, lens, focal depth, and framing."
  },
  "negative_prompt": "Recommended negative prompt to prevent artifacts, unwanted styles, or distortion.",
  "aspect_ratio": "Detected aspect ratio (e.g. '1:1', '16:9', '9:16', '4:3', '3:2')",
  "palette_colors": ["#HEX1", "#HEX2", "#HEX3", "#HEX4", "#HEX5"]
}
"""

class DescribeRequest(BaseModel):
    image: str  # Base64 string or data:image/...;base64,...
    api_key: Optional[str] = None
    target_engine: Optional[str] = "imagen3"  # imagen3, midjourney, flux, general
    detail_level: Optional[str] = "whisk_deep"  # whisk_deep, balanced

def extract_base64_and_mime(image_str: str):
    """Extracts raw base64 bytes and mime type from data URI or raw base64."""
    mime_type = "image/jpeg"
    if image_str.startswith("data:"):
        match = re.match(r"data:([^;]+);base64,(.+)", image_str)
        if match:
            mime_type = match.group(1)
            b64_data = match.group(2)
        else:
            raise ValueError("Invalid data URL format")
    else:
        b64_data = image_str
    
    # Clean whitespace/newlines
    b64_data = re.sub(r"\s+", "", b64_data)
    return b64_data, mime_type

def parse_model_json(raw_text: str) -> Dict[str, Any]:
    """Cleans up and parses JSON response from Gemini."""
    cleaned = raw_text.strip()
    # Strip markdown code blocks if present
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    
    # Try finding the first '{' and last '}'
    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    if start_idx != -1 and end_idx != -1:
        cleaned = cleaned[start_idx:end_idx + 1]
    
    return json.loads(cleaned)

async def call_gemini_api(api_key: str, b64_data: str, mime_type: str, target_engine: str):
    """Calls Gemini REST API with fallback across model versions."""
    engine_tuning = {
        "imagen3": "Format the master prompt specifically for Google Imagen 3 (rich natural prose with descriptive photographic or artistic terminology).",
        "midjourney": "Format the master prompt optimized for Midjourney v6 (rich cinematic descriptors, camera and stylistic nuance).",
        "flux": "Format the master prompt optimized for Flux / SDXL (precise visual framing, physical materials, and lighting descriptors).",
        "general": "Format the master prompt as a universal, high-fidelity descriptive prompt."
    }.get(target_engine, "Format the master prompt with rich natural language.")

    user_prompt = f"{WHISK_SYSTEM_PROMPT}\n\nTarget Generator Guidance: {engine_tuning}\n\nInspect the image and output the JSON."

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": b64_data
                        }
                    },
                    {
                        "text": user_prompt
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2
        }
    }

    last_error = None
    async with httpx.AsyncClient(timeout=45.0) as client:
        for model in CANDIDATE_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            try:
                response = await client.post(
                    url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            text_response = parts[0].get("text", "")
                            return parse_model_json(text_response)
                else:
                    error_data = response.text
                    last_error = f"{model} returned HTTP {response.status_code}: {error_data}"
            except Exception as e:
                last_error = str(e)
                continue

    raise HTTPException(status_code=500, detail=f"Failed to generate prompt from image: {last_error}")

@app.get("/api/status")
async def get_status():
    """Checks if server-side Gemini API key is configured."""
    has_env_key = bool(os.environ.get("GEMINI_API_KEY"))
    return {
        "status": "ready",
        "has_server_api_key": has_env_key,
        "models": CANDIDATE_MODELS
    }

@app.post("/api/describe")
async def describe_image(request: DescribeRequest):
    """Processes uploaded image and returns Whisk-style reverse prompt."""
    api_key = request.api_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No Gemini API Key provided. Please enter your API key in the UI or set GEMINI_API_KEY in the server environment."
        )

    try:
        b64_data, mime_type = extract_base64_and_mime(request.image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")

    result = await call_gemini_api(
        api_key=api_key,
        b64_data=b64_data,
        mime_type=mime_type,
        target_engine=request.target_engine or "imagen3"
    )

    return result

# Mount static frontend files if directory exists (for local development)
static_path = Path(__file__).resolve().parent.parent / "public"
if static_path.exists():
    app.mount("/", StaticFiles(directory=str(static_path), html=True), name="public")
