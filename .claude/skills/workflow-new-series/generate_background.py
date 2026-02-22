#!/usr/bin/env python3
"""
Generate series background image using Replicate Seedream-4.5 API.

Usage:
    python generate_background.py <output_path> <prompt>

Arguments:
    output_path  Path to save background image (e.g., "background.jpg")
    prompt       The image generation prompt

Example:
    python generate_background.py background.jpg "Cinematic landscape..."

The script uses 16:9 aspect ratio for widescreen hero background format.
"""

import os
import sys
import time
import requests


def load_api_token(env_path="../../.env"):
    """Load Replicate API token from .env file (root .env when run from series/{id}/)."""
    with open(env_path) as f:
        for line in f:
            if line.startswith("REPLICATE_API_TOKEN="):
                return line.strip().split("=", 1)[1]
    raise ValueError("REPLICATE_API_TOKEN not found in .env")


def generate_background(output_path, prompt):
    """Generate a background image with the given prompt."""
    api_token = load_api_token()
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }

    print(f"Starting background generation...")
    print(f"Prompt: {prompt[:100]}...")

    # Start prediction
    response = requests.post(
        "https://api.replicate.com/v1/models/bytedance/seedream-4.5/predictions",
        headers=headers,
        json={
            "input": {
                "prompt": prompt,
                "aspect_ratio": "16:9",  # Widescreen for hero background
                "size": "2K",
                "enhance_prompt": True,
                "max_images": 1
            }
        }
    )

    data = response.json()
    pred_id = data.get("id")

    if not pred_id:
        print(f"Error: Failed to start prediction - {data}")
        return False

    print(f"Prediction started (id: {pred_id})")
    print("Waiting for completion...")

    # Poll until complete
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

            # Ensure output directory exists
            output_dir = os.path.dirname(output_path)
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)

            with open(output_path, "wb") as f:
                f.write(img_resp.content)

            print(f"Background saved: {output_path}")
            return True

        elif status == "failed":
            print(f"Error: Generation failed - {data.get('error')}")
            return False

        time.sleep(2)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    output_path = sys.argv[1]
    prompt = sys.argv[2]

    success = generate_background(output_path, prompt)
    sys.exit(0 if success else 1)
