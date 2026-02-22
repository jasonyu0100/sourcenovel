#!/usr/bin/env python3
"""
Generate chapter media or world references: images and/or background music.

Usage:
    python generate_media.py images <series_dir> <chapter_num> <config_json>
    python generate_media.py music <series_dir> <chapter_num> "<prompt>" [duration_ms]
    python generate_media.py all <series_dir> <chapter_num> <config_json> "<music_prompt>" [duration_ms]
    python generate_media.py world <series_dir> <config_json>

Arguments:
    series_dir  - Path to the series directory (e.g., series/my-series)
    chapter_num - Chapter number (for images/music/all commands)
    config_json - JSON array of image configs
    prompt      - Music prompt string (for music/all commands)
    duration_ms - Music duration in milliseconds (optional, default: 180000)

Image config format:
    [{"name": "characters/haruki", "prompt": "...", "aspect_ratio": "3:4"}, ...]

Aspect ratios by category:
    characters/ -> 3:4 (portrait)
    locations/  -> 16:9 (cinematic)
    elements/   -> 1:1 (detail)

Examples:
    python generate_media.py images series/my-series 1 '[{"name": "1-marsh", "prompt": "...", "aspect_ratio": "21:9"}]'
    python generate_media.py music series/my-series 1 "Contemplative Eastern instrumental..." 180000
    python generate_media.py world series/my-series '[{"name": "characters/haruki", "prompt": "...", "aspect_ratio": "3:4"}]'
"""

import os
import sys
import json
import time
import requests

# Delay between image requests (seconds)
REQUEST_DELAY = 2


def load_env(env_path=".env"):
    """Load environment variables from .env file."""
    env = {}
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    env[key] = value
    return env


def find_env_file():
    """Find .env file in current dir or project root."""
    paths = [".env"]
    for path in paths:
        if os.path.exists(path):
            return path
    raise FileNotFoundError("No .env file found in current directory")


class ImageGenerator:
    """Generate images using Replicate Seedream-4.5 API."""

    def __init__(self, series_dir, chapter_num, env):
        self.api_token = env.get("REPLICATE_API_TOKEN")
        if not self.api_token:
            raise ValueError("REPLICATE_API_TOKEN not found in .env")
        self.chapter_num = chapter_num
        self.output_dir = f"{series_dir}/chapters/{chapter_num}/media"
        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        os.makedirs(self.output_dir, exist_ok=True)

    def start_prediction(self, image):
        """Start a prediction and return prediction info."""
        response = requests.post(
            "https://api.replicate.com/v1/models/bytedance/seedream-4.5/predictions",
            headers=self.headers,
            json={
                "input": {
                    "prompt": image["prompt"],
                    "aspect_ratio": image["aspect_ratio"],
                    "size": "2K",
                    "enhance_prompt": True,
                    "max_images": 1
                }
            }
        )
        data = response.json()
        pred_id = data.get("id")

        if not pred_id:
            print(f"  Error starting {image['name']}: {data}")
            return None

        print(f"  Started: {image['name']} (id: {pred_id})")
        return {
            "name": image["name"],
            "id": pred_id,
            "status": data.get("status")
        }

    def poll_and_download(self, pred):
        """Poll prediction until complete, then download."""
        if pred is None:
            return False

        pred_id = pred["id"]
        name = pred["name"]

        while True:
            resp = requests.get(
                f"https://api.replicate.com/v1/predictions/{pred_id}",
                headers=self.headers
            )
            data = resp.json()
            status = data.get("status")

            if status == "succeeded":
                output = data.get("output")
                if output and len(output) > 0:
                    img_url = output[0]
                    img_resp = requests.get(img_url)
                    output_path = f"{self.output_dir}/{name}.jpg"
                    with open(output_path, "wb") as f:
                        f.write(img_resp.content)
                    print(f"  Downloaded: {name}.jpg")
                    return True
                else:
                    print(f"  Failed: {name} - No output URL")
                    return False
            elif status == "failed":
                print(f"  Failed: {name} - {data.get('error')}")
                return False
            elif status == "canceled":
                print(f"  Canceled: {name}")
                return False

            time.sleep(2)

    def generate_single(self, image):
        """Generate a single image: start, poll, download."""
        pred = self.start_prediction(image)
        if pred:
            return self.poll_and_download(pred)
        return False

    def generate_all(self, images):
        """Generate all images sequentially."""
        print(f"\nGenerating {len(images)} images...")

        results = []
        for i, image in enumerate(images):
            print(f"\n[{i+1}/{len(images)}] {image['name']}")
            success = self.generate_single(image)
            results.append(success)

            if i < len(images) - 1:
                time.sleep(REQUEST_DELAY)

        success_count = sum(results)
        print(f"\nImages: {success_count}/{len(results)} downloaded")
        print(f"Output: {self.output_dir}")

        return success_count == len(results)


class WorldReferenceGenerator:
    """Generate world reference images, saved to world/ directory."""

    def __init__(self, series_dir, env):
        self.api_token = env.get("REPLICATE_API_TOKEN")
        if not self.api_token:
            raise ValueError("REPLICATE_API_TOKEN not found in .env")
        self.series_dir = series_dir
        self.output_dir = f"{series_dir}/world"
        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }

    def start_prediction(self, image):
        """Start a prediction and return prediction info."""
        response = requests.post(
            "https://api.replicate.com/v1/models/bytedance/seedream-4.5/predictions",
            headers=self.headers,
            json={
                "input": {
                    "prompt": image["prompt"],
                    "aspect_ratio": image["aspect_ratio"],
                    "size": "2K",
                    "enhance_prompt": True,
                    "max_images": 1
                }
            }
        )
        data = response.json()
        pred_id = data.get("id")

        if not pred_id:
            print(f"  Error starting {image['name']}: {data}")
            return None

        print(f"  Started: {image['name']} (id: {pred_id})")
        return {
            "name": image["name"],
            "id": pred_id,
            "status": data.get("status")
        }

    def poll_and_download(self, pred):
        """Poll prediction until complete, then download to world/ directory."""
        if pred is None:
            return False

        pred_id = pred["id"]
        name = pred["name"]

        while True:
            resp = requests.get(
                f"https://api.replicate.com/v1/predictions/{pred_id}",
                headers=self.headers
            )
            data = resp.json()
            status = data.get("status")

            if status == "succeeded":
                output = data.get("output")
                if output and len(output) > 0:
                    img_url = output[0]
                    img_resp = requests.get(img_url)
                    output_path = f"{self.output_dir}/{name}.jpg"
                    # Ensure subdirectory exists
                    os.makedirs(os.path.dirname(output_path), exist_ok=True)
                    with open(output_path, "wb") as f:
                        f.write(img_resp.content)
                    print(f"  Downloaded: world/{name}.jpg")
                    return True
                else:
                    print(f"  Failed: {name} - No output URL")
                    return False
            elif status == "failed":
                print(f"  Failed: {name} - {data.get('error')}")
                return False
            elif status == "canceled":
                print(f"  Canceled: {name}")
                return False

            time.sleep(2)

    def generate_single(self, image):
        """Generate a single image: start, poll, download."""
        pred = self.start_prediction(image)
        if pred:
            return self.poll_and_download(pred)
        return False

    def generate_all(self, images):
        """Generate all world reference images sequentially."""
        print(f"\nGenerating {len(images)} world references...")

        results = []
        for i, image in enumerate(images):
            print(f"\n[{i+1}/{len(images)}] {image['name']}")
            success = self.generate_single(image)
            results.append(success)

            if i < len(images) - 1:
                time.sleep(REQUEST_DELAY)

        success_count = sum(results)
        print(f"\nWorld references: {success_count}/{len(results)} downloaded")
        print(f"Output: {self.output_dir}")

        return success_count == len(results)


class MusicGenerator:
    """Generate music using ElevenLabs Music API."""

    def __init__(self, series_dir, chapter_num, env):
        self.api_key = env.get("ELEVEN_LABS_API_KEY")
        if not self.api_key:
            raise ValueError("ELEVEN_LABS_API_KEY not found in .env")
        self.chapter_num = chapter_num
        self.output_dir = f"{series_dir}/chapters/{chapter_num}/media"
        os.makedirs(self.output_dir, exist_ok=True)

    def generate(self, prompt, duration_ms=180000):
        """Generate music and save to chapter media directory."""
        print(f"\nGenerating music for chapter {self.chapter_num}...")
        print(f"Duration: {duration_ms / 1000:.0f} seconds")
        print(f"Prompt: {prompt[:80]}...")

        response = requests.post(
            "https://api.elevenlabs.io/v1/music",
            headers={
                "Content-Type": "application/json",
                "xi-api-key": self.api_key
            },
            json={
                "prompt": prompt,
                "model_id": "music_v1",
                "music_length_ms": duration_ms
            }
        )

        output_path = f"{self.output_dir}/background-music.mp3"

        if response.status_code == 200:
            with open(output_path, "wb") as f:
                f.write(response.content)
            size_mb = len(response.content) / 1024 / 1024
            print(f"\nMusic saved: {output_path}")
            print(f"Size: {size_mb:.2f} MB")
            return True
        else:
            print(f"Error: {response.status_code}")
            print(response.text)
            return False


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    series_dir = sys.argv[2]

    env_path = find_env_file()
    env = load_env(env_path)
    print(f"Using .env from: {env_path}")
    print(f"Series dir: {series_dir}")

    # Handle world command separately (no chapter_num)
    if command == "world":
        if len(sys.argv) < 4:
            print("Error: world command requires config_json")
            sys.exit(1)
        images = json.loads(sys.argv[3])
        generator = WorldReferenceGenerator(series_dir, env)
        success = generator.generate_all(images)
        sys.exit(0 if success else 1)

    # All other commands require chapter_num
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)

    chapter_num = int(sys.argv[3])
    print(f"Series dir: {series_dir}")

    if command == "images":
        if len(sys.argv) < 5:
            print("Error: images command requires config_json")
            sys.exit(1)
        print(f"Chapter: {chapter_num}")
        images = json.loads(sys.argv[4])
        generator = ImageGenerator(series_dir, chapter_num, env)
        success = generator.generate_all(images)
        sys.exit(0 if success else 1)

    elif command == "music":
        if len(sys.argv) < 5:
            print("Error: music command requires prompt")
            sys.exit(1)
        prompt = sys.argv[4]
        duration_ms = int(sys.argv[5]) if len(sys.argv) > 5 else 180000
        generator = MusicGenerator(series_dir, chapter_num, env)
        success = generator.generate(prompt, duration_ms)
        sys.exit(0 if success else 1)

    elif command == "all":
        if len(sys.argv) < 6:
            print("Error: all command requires config_json and music_prompt")
            sys.exit(1)
        images = json.loads(sys.argv[4])
        music_prompt = sys.argv[5]
        duration_ms = int(sys.argv[6]) if len(sys.argv) > 6 else 180000

        # Generate images first
        img_gen = ImageGenerator(series_dir, chapter_num, env)
        img_success = img_gen.generate_all(images)

        # Then generate music
        music_gen = MusicGenerator(series_dir, chapter_num, env)
        music_success = music_gen.generate(music_prompt, duration_ms)

        sys.exit(0 if (img_success and music_success) else 1)

    else:
        print(f"Unknown command: {command}")
        print("Commands: images, music, all, world")
        sys.exit(1)


if __name__ == "__main__":
    main()
