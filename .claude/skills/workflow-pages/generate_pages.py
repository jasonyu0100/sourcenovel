#!/usr/bin/env python3
"""
Generate manga-style panel sequences and composite them into page layouts.

Uses Seedream 4.5 with custom sizing for pixel-perfect panel generation
and sequential image generation for coherent manga pages.

Two-pass pipeline:
    Pass 1 — Generate raw image (no text) with speaking expressions for
             characters who have dialogue. Saved as {N}-{name}.jpg.
             Uses sequential_image_generation=auto for page coherence.
    Pass 2 — For panels with dialogue, run a second Seedream call using
             the raw image as reference to add speech bubbles with text.
             Saved as {N}-{name}-text.jpg.

Usage:
    python generate_panels.py generate <output_dir> <layout> <panels_json>
    python generate_panels.py composite <output_dir> <layout> <panels_json>

Arguments:
    output_dir   - Directory to save panel images and composited page
                   (e.g., "chapters/1/panels/1")
    layout       - Layout template: "2x2", "2x3", "story4", "story5", "cinematic3"
    panels_json  - JSON array of panel configs, OR a path to a .json file

Output structure:
    output_dir/
    ├── page.jpg              # Composited page (uses -text versions when available)
    ├── 1-{name}.jpg          # Raw panel image (no text)
    ├── 1-{name}-text.jpg     # Panel with speech bubbles (if dialogue)
    ├── 2-{name}.jpg
    ├── 2-{name}-text.jpg
    └── ...

Panel config format:
    {
        "name": "panel-name",
        "prompt": "image generation prompt...",
        "ref": ["path/to/reference1.jpg", "path/to/reference2.jpg"],
        "dialogue": [
            {"speaker": "Idris", "text": "Line of dialogue"}
        ]
    }

    Pass 1 uses the prompt as-is (with speaking cues added for dialogue
    characters). Pass 2 uses the raw image as reference with a dedicated
    text-only overlay prompt — no scene description, just bubble placement.

    "ref" is an optional list of 1-14 local image paths used as reference
    images for Seedream's image-to-image generation.

Layouts:
    2x2        - 4 panels in a 2x2 grid (equal size)
    2x3        - 6 panels in a 2-column, 3-row grid (equal size)
    story4     - 1 wide top, 2 middle, 1 wide bottom (4 panels)
    story5     - 1 wide top, 2 middle, 2 bottom (5 panels)
    cinematic3 - 3 ultrawide horizontal panels stacked vertically
    splash     - 1 full-page panel for dramatic reveals
    impact2    - 2 stacked panels for contrast/confrontation
    hero       - 1 large hero panel (60%) + 2 supporting below
    focus4     - 1 dominant panel (55%) + 3 reaction panels
"""

import os
import sys
import json
import time
import base64
import math
import requests
from PIL import Image
from io import BytesIO

# Force unbuffered stdout for real-time output
sys.stdout.reconfigure(line_buffering=True)


# Seedream 4.5 custom size constraints
MIN_DIM = 1024
MAX_DIM = 4096
MIN_PIXELS = 3686400  # Minimum total pixel count required by Seedream 4.5

# Layout definitions — panel positions are fractional (x, y, w, h) within the
# drawable area. Custom pixel dimensions are computed for each panel slot.
LAYOUTS = {
    "2x2": {
        "canvas": (2400, 3600),
        "gutter": 20,
        "border": 40,
        "panels": [
            {"pos": (0, 0, 0.5, 0.5)},
            {"pos": (0.5, 0, 0.5, 0.5)},
            {"pos": (0, 0.5, 0.5, 0.5)},
            {"pos": (0.5, 0.5, 0.5, 0.5)},
        ]
    },
    "2x3": {
        "canvas": (2400, 3600),
        "gutter": 20,
        "border": 40,
        "panels": [
            {"pos": (0, 0, 0.5, 0.333)},
            {"pos": (0.5, 0, 0.5, 0.333)},
            {"pos": (0, 0.333, 0.5, 0.333)},
            {"pos": (0.5, 0.333, 0.5, 0.333)},
            {"pos": (0, 0.666, 0.5, 0.334)},
            {"pos": (0.5, 0.666, 0.5, 0.334)},
        ]
    },
    "story4": {
        "canvas": (2400, 3600),
        "gutter": 20,
        "border": 40,
        "panels": [
            {"pos": (0, 0, 1.0, 0.3)},
            {"pos": (0, 0.3, 0.5, 0.35)},
            {"pos": (0.5, 0.3, 0.5, 0.35)},
            {"pos": (0, 0.65, 1.0, 0.35)},
        ]
    },
    "story5": {
        "canvas": (2400, 3600),
        "gutter": 20,
        "border": 40,
        "panels": [
            {"pos": (0, 0, 1.0, 0.28)},
            {"pos": (0, 0.28, 0.5, 0.36)},
            {"pos": (0.5, 0.28, 0.5, 0.36)},
            {"pos": (0, 0.64, 0.5, 0.36)},
            {"pos": (0.5, 0.64, 0.5, 0.36)},
        ]
    },
    "cinematic3": {
        "canvas": (2400, 3600),
        "gutter": 20,
        "border": 40,
        "panels": [
            {"pos": (0, 0, 1.0, 0.333)},
            {"pos": (0, 0.333, 1.0, 0.333)},
            {"pos": (0, 0.666, 1.0, 0.334)},
        ]
    },
    # New layouts
    "splash": {
        "canvas": (2400, 3600),
        "gutter": 20,
        "border": 40,
        "panels": [
            {"pos": (0, 0, 1.0, 1.0)},  # Full page single panel
        ]
    },
    "impact2": {
        "canvas": (2400, 3600),
        "gutter": 20,
        "border": 40,
        "panels": [
            {"pos": (0, 0, 1.0, 0.5)},    # Top half
            {"pos": (0, 0.5, 1.0, 0.5)},  # Bottom half
        ]
    },
    "vertical3": {
        "canvas": (2400, 3600),
        "gutter": 20,
        "border": 40,
        "panels": [
            {"pos": (0, 0, 0.333, 1.0)},      # Left vertical strip
            {"pos": (0.333, 0, 0.334, 1.0)},  # Center vertical strip
            {"pos": (0.667, 0, 0.333, 1.0)},  # Right vertical strip
        ]
    },
    "hero": {
        "canvas": (2400, 3600),
        "gutter": 20,
        "border": 40,
        "panels": [
            {"pos": (0, 0, 1.0, 0.6)},     # Large hero panel top (60%)
            {"pos": (0, 0.6, 0.5, 0.4)},   # Supporting left
            {"pos": (0.5, 0.6, 0.5, 0.4)}, # Supporting right
        ]
    },
    "focus4": {
        "canvas": (2400, 3600),
        "gutter": 20,
        "border": 40,
        "panels": [
            {"pos": (0, 0, 0.55, 1.0)},       # Dominant panel left (55%)
            {"pos": (0.55, 0, 0.45, 0.333)},  # Reaction 1
            {"pos": (0.55, 0.333, 0.45, 0.333)},  # Reaction 2
            {"pos": (0.55, 0.666, 0.45, 0.334)},  # Reaction 3
        ]
    },
    "strip4": {
        "canvas": (2400, 3600),
        "gutter": 20,
        "border": 40,
        "panels": [
            {"pos": (0, 0, 1.0, 0.25)},     # Horizontal strip 1
            {"pos": (0, 0.25, 1.0, 0.25)},  # Horizontal strip 2
            {"pos": (0, 0.5, 1.0, 0.25)},   # Horizontal strip 3
            {"pos": (0, 0.75, 1.0, 0.25)},  # Horizontal strip 4
        ]
    },
}


# ---------------------------------------------------------------------------
# Panel dimension helpers
# ---------------------------------------------------------------------------

def panel_pixel_dims(layout_name, panel_index):
    """Compute the actual pixel width and height of a panel slot."""
    layout = LAYOUTS[layout_name]
    canvas_w, canvas_h = layout["canvas"]
    gutter = layout["gutter"]
    border = layout["border"]
    area_w = canvas_w - 2 * border
    area_h = canvas_h - 2 * border

    fx, fy, fw, fh = layout["panels"][panel_index]["pos"]
    pw = int(fw * area_w) - (gutter // 2 if fx > 0 else 0) - (gutter // 2 if fx + fw < 1.0 else 0)
    ph = int(fh * area_h) - (gutter // 2 if fy > 0 else 0) - (gutter // 2 if fy + fh < 1.0 else 0)
    return pw, ph


def generation_dims(slot_w, slot_h):
    """Compute Seedream custom dimensions for a panel slot.

    Scales the slot's aspect ratio so both dimensions are >= 1024,
    <= 4096, and total pixels >= MIN_PIXELS (Seedream 4.5 requirement).
    """
    # Scale up so the smaller dimension is at least MIN_DIM
    scale = max(MIN_DIM / slot_w, MIN_DIM / slot_h, 1.0)
    gen_w = int(math.ceil(slot_w * scale))
    gen_h = int(math.ceil(slot_h * scale))

    # Scale up to meet minimum total pixel count
    pixels = gen_w * gen_h
    if pixels < MIN_PIXELS:
        pixel_scale = math.sqrt(MIN_PIXELS / pixels) + 0.01
        gen_w = int(math.ceil(gen_w * pixel_scale))
        gen_h = int(math.ceil(gen_h * pixel_scale))

    # Clamp to MAX_DIM
    if gen_w > MAX_DIM or gen_h > MAX_DIM:
        downscale = min(MAX_DIM / gen_w, MAX_DIM / gen_h)
        gen_w = int(gen_w * downscale)
        gen_h = int(gen_h * downscale)

    # Ensure still >= MIN_DIM after clamping
    gen_w = max(gen_w, MIN_DIM)
    gen_h = max(gen_h, MIN_DIM)

    return gen_w, gen_h


# ---------------------------------------------------------------------------
# Prompt helpers — speaking cues (pass 1) and text overlay (pass 2)
# ---------------------------------------------------------------------------

def add_speaking_cues(base_prompt, dialogues):
    """Add speaking expression cues to the raw image prompt (pass 1).

    Characters with dialogue should be visually shown speaking — mouth open,
    expressive gesture — so the raw image already looks like a conversation.
    No text or speech bubbles are added at this stage.

    Also adds anti-text guidance to prevent stray text/speech bubbles in raw images.
    """
    # Anti-text guidance for raw images (no speech bubbles, no text)
    anti_text = "no text, no speech bubbles, no dialogue boxes, no captions, no letters, no writing, clean image"

    if not dialogues:
        return f"{base_prompt}, {anti_text}"

    speakers = list(dict.fromkeys(dlg.get("speaker", "") for dlg in dialogues))
    cues = ", ".join(
        f"{s} speaking with mouth open and expressive gesture" for s in speakers if s
    )
    return f"{base_prompt}, {cues}, {anti_text}"


def build_text_overlay_prompt(dialogues):
    """Build the prompt for pass 2 — adding speech bubbles with recomposition.

    The raw image is passed as reference. This prompt allows the model to
    recompose the scene to better accommodate speech bubbles — adjusting
    character positions, zooming, or reframing as needed for optimal
    text placement and readability.

    Dialogue entries can include:
        - "style": bubble style (normal, shout, whisper, thought, effect)
        - "placement": artistic description of where/how the bubble integrates
                       with the visual composition
    """
    bubble_parts = []
    for dlg in dialogues:
        speaker = dlg.get("speaker", "")
        text = dlg["text"]
        style = dlg.get("style", "normal")
        placement = dlg.get("placement", "")

        # Build bubble description based on style
        if style == "shout":
            bubble_desc = (
                f"spiky speech bubble with jagged edges containing large bold text "
                f"\"{text}\""
            )
        elif style == "whisper":
            bubble_desc = (
                f"speech bubble with dotted outline containing small delicate text "
                f"\"{text}\""
            )
        elif style == "thought":
            bubble_desc = (
                f"cloud-shaped thought bubble with small trailing circles "
                f"containing text \"{text}\""
            )
        elif style == "effect":
            bubble_desc = (
                f"stylized manga sound effect text \"{text}\" with dynamic "
                f"lettering and action lines"
            )
        else:  # normal
            bubble_desc = (
                f"clean manga speech bubble with thin black outline "
                f"containing clear legible text \"{text}\""
            )

        # Add artistic placement if provided
        if placement:
            bubble_parts.append(f"{bubble_desc}, {placement}")
        else:
            bubble_parts.append(f"{bubble_desc} near {speaker}")

    bubble_desc = ", ".join(bubble_parts)
    bubble_count = len(bubble_parts)
    bubble_word = "bubble" if bubble_count == 1 else "bubbles"

    return (
        f"Recreate this manga panel with {bubble_count} speech {bubble_word} integrated into the composition. "
        f"Recompose the scene as needed to accommodate the text — adjust framing, character positions, "
        f"or add negative space where bubbles will go. Maintain character likeness and scene essence. "
        f"{bubble_desc}. "
        f"CRITICAL: Only {bubble_count} {bubble_word}, no duplicates. "
        f"Traditional manga style speech bubble: white fill, solid black 2px outline, "
        f"rounded oval shape, small pointed tail toward speaker. "
        f"Manga font lettering: bold sans-serif, slightly condensed, all caps, "
        f"black text centered in bubble. "
        f"Compact bubble that tightly fits the text with minimal padding. "
        f"Horizontal text only, never vertical or rotated. "
        f"Ensure bubbles don't obscure faces or key action. Professional manga layout."
    )


# ---------------------------------------------------------------------------
# Image generation via Replicate (Seedream 4.5)
# ---------------------------------------------------------------------------

def load_api_token():
    """Load Replicate API token from .env file."""
    paths = [".env", "../../.env", "../../../.env"]
    for path in paths:
        if os.path.exists(path):
            with open(path) as f:
                for line in f:
                    if line.startswith("REPLICATE_API_TOKEN="):
                        return line.strip().split("=", 1)[1]
    raise ValueError("REPLICATE_API_TOKEN not found in any .env file")


def encode_image_as_data_uri(path):
    """Encode a local image file as a data URI for the Replicate API."""
    ext = os.path.splitext(path)[1].lower()
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
            ".webp": "image/webp"}.get(ext, "image/jpeg")
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime};base64,{b64}"


def submit_prediction(api_token, prompt, width, height, ref_images=None,
                      sequential=False, negative_prompt=None):
    """Submit a prediction to Seedream 4.5 and return the prediction ID.

    Does NOT poll — returns immediately so multiple predictions can run in parallel.
    """
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }

    input_data = {
        "prompt": prompt,
        "size": "custom",
        "width": width,
        "height": height,
        "enhance_prompt": True,
        "max_images": 1,
        "sequential_image_generation": "auto" if sequential else "disabled",
    }

    if negative_prompt:
        input_data["negative_prompt"] = negative_prompt

    # Add reference images if provided (up to 14 for Seedream 4.5)
    if ref_images:
        image_uris = []
        for ref_path in ref_images:
            if os.path.exists(ref_path):
                image_uris.append(encode_image_as_data_uri(ref_path))
                print(f"  Ref: {os.path.basename(ref_path)}")
            else:
                print(f"  Warning: ref image not found: {ref_path}")
        if image_uris:
            input_data["image_input"] = image_uris

    # Retry loop for rate limiting
    for attempt in range(10):
        response = requests.post(
            "https://api.replicate.com/v1/models/bytedance/seedream-4.5/predictions",
            headers=headers,
            json={"input": input_data}
        )

        if response.status_code == 429:
            data = response.json()
            retry_after = data.get("retry_after", 10)
            if isinstance(retry_after, str):
                retry_after = int(''.join(c for c in retry_after if c.isdigit()) or '10')
            retry_after = max(retry_after, 5)
            print(f"  Rate limited, waiting {retry_after}s (attempt {attempt+1})...")
            time.sleep(retry_after)
            continue

        data = response.json()
        pred_id = data.get("id")
        if not pred_id:
            print(f"  Error starting prediction: {data}")
            return None

        return pred_id

    print(f"  Failed after 10 retries")
    return None


def poll_prediction(api_token, pred_id):
    """Poll a single prediction until complete. Returns PIL Image or None."""
    headers = {"Authorization": f"Bearer {api_token}"}

    while True:
        resp = requests.get(
            f"https://api.replicate.com/v1/predictions/{pred_id}",
            headers=headers
        )
        data = resp.json()
        status = data.get("status")

        if status == "succeeded":
            img_url = data["output"][0]
            img_resp = requests.get(img_url)
            return Image.open(BytesIO(img_resp.content))
        elif status in ("failed", "canceled"):
            print(f"  Generation {status}: {data.get('error', 'unknown')}")
            return None

        time.sleep(2)


def poll_all_predictions(api_token, pred_ids):
    """Poll multiple predictions in parallel until all complete.

    Returns list of PIL Images (or None for failures), in same order as pred_ids.
    """
    headers = {"Authorization": f"Bearer {api_token}"}
    results = [None] * len(pred_ids)
    pending = {i: pid for i, pid in enumerate(pred_ids) if pid is not None}

    while pending:
        for i, pid in list(pending.items()):
            resp = requests.get(
                f"https://api.replicate.com/v1/predictions/{pid}",
                headers=headers
            )
            data = resp.json()
            status = data.get("status")

            if status == "succeeded":
                img_url = data["output"][0]
                img_resp = requests.get(img_url)
                results[i] = Image.open(BytesIO(img_resp.content))
                del pending[i]
                print(f"  [{i+1}] Done")
            elif status in ("failed", "canceled"):
                print(f"  [{i+1}] {status}: {data.get('error', 'unknown')}")
                del pending[i]

        if pending:
            time.sleep(3)

    return results


def generate_image(api_token, prompt, width, height, ref_images=None,
                    sequential=False, negative_prompt=None):
    """Generate a single image via Seedream 4.5 and return PIL Image.

    Convenience wrapper that submits and polls a single prediction.
    """
    pred_id = submit_prediction(api_token, prompt, width, height,
                                ref_images=ref_images, sequential=sequential,
                                negative_prompt=negative_prompt)
    if not pred_id:
        return None
    return poll_prediction(api_token, pred_id)


def panel_filename(index, name):
    """Build the individual raw panel image filename."""
    return f"{index + 1}-{name}.jpg"


def panel_text_filename(index, name):
    """Build the text-overlay panel image filename."""
    return f"{index + 1}-{name}-text.jpg"


def load_panels_json(arg):
    """Load panels config from a JSON file path or inline JSON string."""
    if os.path.isfile(arg):
        with open(arg) as f:
            return json.load(f)
    return json.loads(arg)


def load_pages_json(pages_dir):
    """Load page layouts from pages.json.

    pages.json format: [{"page": 1, "layout": "splash"}, ...]
    Returns dict mapping page number -> layout name.
    """
    pages_path = os.path.join(pages_dir, "pages.json")
    if not os.path.exists(pages_path):
        return {}
    with open(pages_path) as f:
        pages = json.load(f)
    return {p["page"]: p["layout"] for p in pages}


def resolve_ref_path(ref_path, series_base=None):
    """Resolve ref path by searching common locations."""
    if os.path.exists(ref_path):
        return ref_path
    if series_base:
        resolved = os.path.join(series_base, ref_path)
        if os.path.exists(resolved):
            return resolved
    if ref_path.startswith("world/"):
        import glob as globmod
        matches = globmod.glob(f"series/*/{ref_path}")
        if matches:
            return matches[0]
    return ref_path


# ---------------------------------------------------------------------------
# Page compositing
# ---------------------------------------------------------------------------

def composite_panels(images, layout_name, output_path):
    """Arrange generated images into a manga page layout."""
    layout = LAYOUTS[layout_name]
    canvas_w, canvas_h = layout["canvas"]
    gutter = layout["gutter"]
    border = layout["border"]

    # Create black canvas
    canvas = Image.new("RGB", (canvas_w, canvas_h), (0, 0, 0))

    # Available area after border
    area_w = canvas_w - 2 * border
    area_h = canvas_h - 2 * border

    for i, (img, panel_spec) in enumerate(zip(images, layout["panels"])):
        fx, fy, fw, fh = panel_spec["pos"]

        # Calculate pixel positions with gutters
        px = border + int(fx * area_w) + (gutter // 2 if fx > 0 else 0)
        py = border + int(fy * area_h) + (gutter // 2 if fy > 0 else 0)
        pw = int(fw * area_w) - (gutter // 2 if fx > 0 else 0) - (gutter // 2 if fx + fw < 1.0 else 0)
        ph = int(fh * area_h) - (gutter // 2 if fy > 0 else 0) - (gutter // 2 if fy + fh < 1.0 else 0)

        if img is None:
            continue

        # Resize image to fill panel (crop to fit)
        img_ratio = img.width / img.height
        panel_ratio = pw / ph

        if img_ratio > panel_ratio:
            new_h = ph
            new_w = int(ph * img_ratio)
        else:
            new_w = pw
            new_h = int(pw / img_ratio)

        img_resized = img.resize((new_w, new_h), Image.LANCZOS)

        # Center crop
        left = (new_w - pw) // 2
        top = (new_h - ph) // 2
        img_cropped = img_resized.crop((left, top, left + pw, top + ph))

        canvas.paste(img_cropped, (px, py))

    # Save
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    canvas.save(output_path, "JPEG", quality=95)
    print(f"\nPage saved: {output_path}")
    print(f"Size: {canvas_w}x{canvas_h}")


def batch_generate(pages_dir):
    """Generate all pages in a chapter with progressive saving.

    Reads pages.json for layouts, submits predictions in a sliding window,
    and saves images as they complete rather than waiting for all.

    Usage: generate_pages.py batch chapters/1/pages
    """
    api_token = load_api_token()

    # Load page layouts from pages.json
    layouts = load_pages_json(pages_dir)
    if not layouts:
        print(f"Error: pages.json not found or empty in {pages_dir}")
        sys.exit(1)

    # Series base for resolving ref paths
    series_base = None
    if "/chapters/" in pages_dir:
        series_base = pages_dir.split("/chapters/")[0]
    elif "\\chapters\\" in pages_dir:
        series_base = pages_dir.split("\\chapters\\")[0]

    # Collect pages that need work
    page_configs = []
    for page_num in sorted(layouts.keys()):
        page_dir = os.path.join(pages_dir, str(page_num))
        panels_path = os.path.join(page_dir, "panels.json")

        if not os.path.exists(panels_path):
            continue

        layout_name = layouts[page_num]
        if layout_name not in LAYOUTS:
            print(f"  Page {page_num}: unknown layout '{layout_name}', skipping")
            continue

        panels = load_panels_json(panels_path)
        expected = len(LAYOUTS[layout_name]["panels"])

        if len(panels) != expected:
            print(f"  Page {page_num}: panel count mismatch ({len(panels)} vs {expected}), skipping")
            continue

        # Check if fully complete (all raw + all text + page.jpg)
        page_jpg = os.path.join(page_dir, "page.jpg")
        all_raw = all(
            os.path.exists(os.path.join(page_dir, panel_filename(i, p.get("name", f"panel-{i+1}"))))
            for i, p in enumerate(panels)
        )
        all_text = all(
            not p.get("dialogue") or
            os.path.exists(os.path.join(page_dir, panel_text_filename(i, p.get("name", f"panel-{i+1}"))))
            for i, p in enumerate(panels)
        )

        if all_raw and all_text and os.path.exists(page_jpg):
            print(f"  Page {page_num}: complete")
            continue

        page_configs.append({
            "page_num": page_num,
            "layout": layout_name,
            "panels": panels,
            "dir": page_dir,
        })

    if not page_configs:
        print("\nAll pages complete!")
        return

    total_panels = sum(len(pc["panels"]) for pc in page_configs)
    print(f"\n{'='*60}")
    print(f"  BATCH: {len(page_configs)} pages, {total_panels} panels")
    print(f"{'='*60}\n")

    headers = {"Authorization": f"Bearer {api_token}"}

    # ── Pass 1: Raw images with progressive saving ──────────────────

    print("── Pass 1: Raw images (progressive) ──\n")

    # key = (config_idx, panel_idx)
    raw_images = {}  # key -> PIL Image
    pending_raw = {}  # key -> (pred_id, name, img_path, page_num)

    MAX_CONCURRENT = 8  # Max concurrent predictions

    def poll_and_save_raw():
        """Poll pending predictions and save completed ones."""
        saved = 0
        for k, (pid, name, img_path, pn) in list(pending_raw.items()):
            resp = requests.get(f"https://api.replicate.com/v1/predictions/{pid}", headers=headers)
            data = resp.json()
            status = data.get("status")

            if status == "succeeded":
                img_url = data["output"][0]
                img = Image.open(BytesIO(requests.get(img_url).content))
                img.save(img_path, "JPEG", quality=95)
                raw_images[k] = img
                print(f"  ✓ P{pn}:{name} saved ({img.width}x{img.height})")
                del pending_raw[k]
                saved += 1
            elif status in ("failed", "canceled"):
                print(f"  ✗ P{pn}:{name} {status}: {data.get('error', '')[:60]}")
                del pending_raw[k]
        return saved

    for ci, pc in enumerate(page_configs):
        pn = pc["page_num"]
        os.makedirs(pc["dir"], exist_ok=True)

        for pi, panel in enumerate(pc["panels"]):
            key = (ci, pi)
            name = panel.get("name", f"panel-{pi+1}")
            pw, ph = panel_pixel_dims(pc["layout"], pi)
            gen_w, gen_h = generation_dims(pw, ph)
            img_path = os.path.join(pc["dir"], panel_filename(pi, name))

            # Skip if already exists
            if os.path.exists(img_path):
                raw_images[key] = Image.open(img_path)
                continue

            # Wait if too many concurrent
            while len(pending_raw) >= MAX_CONCURRENT:
                poll_and_save_raw()
                if len(pending_raw) >= MAX_CONCURRENT:
                    time.sleep(2)

            prompt = add_speaking_cues(panel["prompt"], panel.get("dialogue", []))
            ref_imgs = [resolve_ref_path(r, series_base) for r in panel.get("ref", [])]
            neg = "text, speech bubble, dialogue box, caption, subtitle, letters, words, writing, typography, font"

            print(f"  → P{pn}:{name} submitting ({gen_w}x{gen_h})")

            pred_id = submit_prediction(api_token, prompt, gen_w, gen_h,
                                        ref_images=ref_imgs or None,
                                        sequential=True, negative_prompt=neg)
            if pred_id:
                pending_raw[key] = (pred_id, name, img_path, pn)
            else:
                print(f"    FAILED")

            # Quick poll check after each submission
            poll_and_save_raw()
            time.sleep(0.5)

    # Drain remaining raw predictions
    print(f"\n  Waiting for {len(pending_raw)} remaining raw images...\n")
    while pending_raw:
        poll_and_save_raw()
        if pending_raw:
            time.sleep(2)

    raw_done = len(raw_images)
    raw_total = sum(len(pc["panels"]) for pc in page_configs)
    print(f"\n  Raw complete: {raw_done}/{raw_total}\n")

    # ── Pass 2: Text overlays with progressive saving ────────────────

    print("── Pass 2: Text overlays (progressive) ──\n")

    text_images = {}  # key -> PIL Image
    pending_text = {}  # key -> (pred_id, name, text_path, page_num)

    def poll_and_save_text():
        """Poll pending text predictions and save completed ones."""
        saved = 0
        for k, (pid, name, text_path, pn) in list(pending_text.items()):
            resp = requests.get(f"https://api.replicate.com/v1/predictions/{pid}", headers=headers)
            data = resp.json()
            status = data.get("status")

            if status == "succeeded":
                img_url = data["output"][0]
                img = Image.open(BytesIO(requests.get(img_url).content))
                img.save(text_path, "JPEG", quality=95)
                text_images[k] = img
                print(f"  ✓ P{pn}:{name} saved ({img.width}x{img.height})")
                del pending_text[k]
                saved += 1
            elif status in ("failed", "canceled"):
                print(f"  ✗ P{pn}:{name} {status}: {data.get('error', '')[:60]}")
                del pending_text[k]
        return saved

    text_needed = 0
    for ci, pc in enumerate(page_configs):
        pn = pc["page_num"]
        for pi, panel in enumerate(pc["panels"]):
            key = (ci, pi)
            name = panel.get("name", f"panel-{pi+1}")
            dialogues = panel.get("dialogue", [])

            if not dialogues:
                continue

            text_needed += 1
            pw, ph = panel_pixel_dims(pc["layout"], pi)
            gen_w, gen_h = generation_dims(pw, ph)
            raw_path = os.path.join(pc["dir"], panel_filename(pi, name))
            text_path = os.path.join(pc["dir"], panel_text_filename(pi, name))

            # Skip if already exists
            if os.path.exists(text_path):
                text_images[key] = Image.open(text_path)
                continue

            # Skip if no raw image
            if key not in raw_images:
                print(f"  - P{pn}:{name} skipped (no raw)")
                continue

            # Wait if too many concurrent
            while len(pending_text) >= MAX_CONCURRENT:
                poll_and_save_text()
                if len(pending_text) >= MAX_CONCURRENT:
                    time.sleep(2)

            text_prompt = build_text_overlay_prompt(dialogues)
            speaker_preview = "; ".join(f'{d.get("speaker","")}: "{d["text"][:20]}..."' for d in dialogues[:2])
            print(f"  → P{pn}:{name} submitting ({speaker_preview})")

            pred_id = submit_prediction(api_token, text_prompt, gen_w, gen_h,
                                        ref_images=[raw_path])
            if pred_id:
                pending_text[key] = (pred_id, name, text_path, pn)
            else:
                print(f"    FAILED")

            # Quick poll check after each submission
            poll_and_save_text()
            time.sleep(0.5)

    # Drain remaining text predictions
    if pending_text:
        print(f"\n  Waiting for {len(pending_text)} remaining text overlays...\n")
        while pending_text:
            poll_and_save_text()
            if pending_text:
                time.sleep(2)

    if text_needed > 0:
        text_done = len(text_images)
        print(f"\n  Text complete: {text_done}/{text_needed}\n")
    else:
        print("  No dialogue panels\n")

    # ── Composite all pages ──────────────────────────────────────────

    print(f"{'='*60}")
    print(f"  COMPOSITING")
    print(f"{'='*60}\n")

    for ci, pc in enumerate(page_configs):
        pn = pc["page_num"]
        page_path = os.path.join(pc["dir"], "page.jpg")

        images = []
        for pi, panel in enumerate(pc["panels"]):
            key = (ci, pi)
            name = panel.get("name", f"panel-{pi+1}")

            # Prefer text version, fall back to raw, fall back to disk
            if key in text_images:
                images.append(text_images[key])
            elif key in raw_images:
                images.append(raw_images[key])
            else:
                text_p = os.path.join(pc["dir"], panel_text_filename(pi, name))
                raw_p = os.path.join(pc["dir"], panel_filename(pi, name))
                if os.path.exists(text_p):
                    images.append(Image.open(text_p))
                elif os.path.exists(raw_p):
                    images.append(Image.open(raw_p))
                else:
                    images.append(None)

        loaded = sum(1 for img in images if img)
        print(f"  Page {pn}: {loaded}/{len(pc['panels'])} panels")
        composite_panels(images, pc["layout"], page_path)

    print(f"\n{'='*60}")
    print(f"  BATCH COMPLETE: {len(page_configs)} pages")
    print(f"{'='*60}")


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        print("\nAvailable layouts:")
        for name, layout in LAYOUTS.items():
            n = len(layout["panels"])
            w, h = layout["canvas"]
            print(f"  {name:12s} - {n} panels, {w}x{h} canvas")
        sys.exit(1)

    command = sys.argv[1]

    # --- batch command: generate all pages at once ---
    if command == "batch":
        if len(sys.argv) < 3:
            print("Usage: generate_pages.py batch <pages_dir>")
            print("  e.g.: generate_pages.py batch chapters/1/pages")
            sys.exit(1)
        batch_generate(sys.argv[2])
        sys.exit(0)

    if command not in ("generate", "composite"):
        print(f"Unknown command: {command}")
        print("Available: batch, generate, composite")
        sys.exit(1)

    if len(sys.argv) < 5:
        print(f"Usage: generate_panels.py {command} <output_dir> <layout> <panels_json|panels.json>")
        sys.exit(1)

    output_dir = sys.argv[2]
    layout_name = sys.argv[3]
    panels_arg = sys.argv[4]

    # Extract series base directory from output_dir for resolving refs
    series_base = None
    if "/chapters/" in output_dir:
        series_base = output_dir.split("/chapters/")[0]
    elif "\\chapters\\" in output_dir:
        series_base = output_dir.split("\\chapters\\")[0]

    if layout_name not in LAYOUTS:
        print(f"Unknown layout: {layout_name}")
        print(f"Available: {', '.join(LAYOUTS.keys())}")
        sys.exit(1)

    panels = load_panels_json(panels_arg)
    layout = LAYOUTS[layout_name]
    expected = len(layout["panels"])

    if len(panels) != expected:
        print(f"Layout '{layout_name}' expects {expected} panels, got {len(panels)}")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)
    page_path = os.path.join(output_dir, "page.jpg")

    if command == "generate":
        api_token = load_api_token()
        print(f"Layout: {layout_name} ({expected} panels)")
        print(f"Output: {output_dir}/\n")

        # --- Pass 1: Generate raw images (parallel submissions) ---
        print("=== Pass 1: Raw images (parallel, custom sizing) ===\n")
        raw_images = [None] * expected
        raw_pred_ids = {}  # index -> prediction_id
        raw_meta = {}      # index -> (name, img_path, gen_w, gen_h)

        # Submit all raw predictions with staggered starts
        for i, panel in enumerate(panels):
            pw, ph = panel_pixel_dims(layout_name, i)
            gen_w, gen_h = generation_dims(pw, ph)

            name = panel.get("name", f"panel-{i+1}")
            base_prompt = panel["prompt"]
            dialogues = panel.get("dialogue", [])
            ref_imgs = [resolve_ref_path(r, series_base) for r in panel.get("ref", [])]
            img_path = os.path.join(output_dir, panel_filename(i, name))

            raw_meta[i] = (name, img_path, gen_w, gen_h)

            if os.path.exists(img_path):
                print(f"[{i+1}/{expected}] Exists: {panel_filename(i, name)}")
                raw_images[i] = Image.open(img_path)
                continue

            prompt = add_speaking_cues(base_prompt, dialogues)
            raw_negative = "text, speech bubble, dialogue box, caption, subtitle, letters, words, writing, typography, font"

            print(f"[{i+1}/{expected}] Submitting: {name} (slot {pw}x{ph}, gen {gen_w}x{gen_h})")
            print(f"  Prompt: {prompt[:100]}...")

            pred_id = submit_prediction(api_token, prompt, gen_w, gen_h,
                                        ref_images=ref_imgs or None,
                                        sequential=True,
                                        negative_prompt=raw_negative)
            if pred_id:
                raw_pred_ids[i] = pred_id
            else:
                print(f"  FAILED to submit")

            # Stagger submissions to avoid rate limiting
            if i < expected - 1:
                time.sleep(1)

        # Poll all pending raw predictions
        if raw_pred_ids:
            print(f"\nPolling {len(raw_pred_ids)} raw predictions...")
            pred_list = [raw_pred_ids.get(i) for i in range(expected)]
            results = poll_all_predictions(api_token, pred_list)
            for i in range(expected):
                if results[i] and raw_images[i] is None:
                    name, img_path, gen_w, gen_h = raw_meta[i]
                    results[i].save(img_path, "JPEG", quality=95)
                    print(f"  Saved: {panel_filename(i, name)} ({results[i].width}x{results[i].height})")
                    raw_images[i] = results[i]

        # --- Pass 2: Text overlay (parallel submissions) ---
        print("\n=== Pass 2: Text overlay (parallel) ===\n")
        text_images = [None] * expected
        text_pred_ids = {}  # index -> prediction_id
        text_meta = {}      # index -> (name, text_path)

        # Submit all text overlay predictions
        for i, panel in enumerate(panels):
            pw, ph = panel_pixel_dims(layout_name, i)
            gen_w, gen_h = generation_dims(pw, ph)

            name = panel.get("name", f"panel-{i+1}")
            dialogues = panel.get("dialogue", [])
            raw_path = os.path.join(output_dir, panel_filename(i, name))
            text_path = os.path.join(output_dir, panel_text_filename(i, name))

            text_meta[i] = (name, text_path)

            if not dialogues:
                print(f"[{i+1}/{expected}] No dialogue: {name}")
                continue

            if os.path.exists(text_path):
                print(f"[{i+1}/{expected}] Exists: {panel_text_filename(i, name)}")
                text_images[i] = Image.open(text_path)
                continue

            if raw_images[i] is None:
                print(f"[{i+1}/{expected}] Skipped (no raw image): {name}")
                continue

            text_prompt = build_text_overlay_prompt(dialogues)
            ref_for_text = [raw_path]

            print(f"[{i+1}/{expected}] Submitting text: {name} ({len(dialogues)} bubble(s))")
            for dlg in dialogues:
                print(f"    {dlg.get('speaker', '')}: \"{dlg['text']}\"")

            pred_id = submit_prediction(api_token, text_prompt, gen_w, gen_h,
                                        ref_images=ref_for_text)
            if pred_id:
                text_pred_ids[i] = pred_id
            else:
                print(f"  FAILED to submit")

            # Stagger submissions
            if i < expected - 1:
                time.sleep(1)

        # Poll all pending text predictions
        if text_pred_ids:
            print(f"\nPolling {len(text_pred_ids)} text predictions...")
            pred_list = [text_pred_ids.get(i) for i in range(expected)]
            results = poll_all_predictions(api_token, pred_list)
            for i in range(expected):
                if results[i]:
                    name, text_path = text_meta[i]
                    results[i].save(text_path, "JPEG", quality=95)
                    print(f"  Saved: {panel_text_filename(i, name)} ({results[i].width}x{results[i].height})")
                    text_images[i] = results[i]

        # Build final image list: prefer -text version, fall back to raw
        images = []
        for i in range(expected):
            images.append(text_images[i] if text_images[i] else raw_images[i])

    elif command == "composite":
        print(f"Recompositing from: {output_dir}/")

        # Load existing panel images — prefer -text versions
        images = []
        for i, panel in enumerate(panels):
            name = panel.get("name", f"panel-{i+1}")
            text_path = os.path.join(output_dir, panel_text_filename(i, name))
            raw_path = os.path.join(output_dir, panel_filename(i, name))

            if os.path.exists(text_path):
                img = Image.open(text_path)
                print(f"  Loaded: {panel_text_filename(i, name)} ({img.width}x{img.height})")
                images.append(img)
            elif os.path.exists(raw_path):
                img = Image.open(raw_path)
                print(f"  Loaded: {panel_filename(i, name)} ({img.width}x{img.height})")
                images.append(img)
            else:
                print(f"  Missing: {panel_filename(i, name)}")
                images.append(None)

    # Composite page
    loaded = sum(1 for i in images if i)
    print(f"\nCompositing {loaded}/{expected} panels...")
    composite_panels(images, layout_name, page_path)


if __name__ == "__main__":
    main()
