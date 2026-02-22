#!/usr/bin/env python3
"""
Generate chapter video from manga panels: TTS dialogue narration over static images with background music.

Usage:
    python generate_video.py tts <series_dir> <chapter_num>
    python generate_video.py sfx <series_dir> <chapter_num>
    python generate_video.py desktop <series_dir> <chapter_num>
    python generate_video.py mobile <series_dir> <chapter_num>
    python generate_video.py mobile-fast <series_dir> <chapter_num>

Commands:
    tts         - Generate TTS audio by reading dialogue from panels.json
    sfx         - Generate sound effects by reading sfx entries from panels.json
    desktop     - Horizontal (1920x1080) video showing individual panels
    mobile      - Vertical (1080x1920) video showing individual panels (shorts format)
    mobile-fast - Vertical (1080x1920) video at 1.5x speed

panels.json dialogue format (with voice_id):
    "dialogue": [{"speaker": "Haruki", "voice_id": "ErXwobaYiN019PkySvjV", "text": "Hello."}]

panels.json timing fields:
    silence     - Custom duration for silent panels (default: 1.0s, use 2-3s for dramatic beats)
    pause_after - Extra pause after dialogue (default: 0.3s, use 1-2s for impactful lines)
    sfx         - Array of sound effects: [{"description": "thunder rumbling", "duration": 2.0}]

Examples:
    python generate_video.py tts series/my-series 1
    python generate_video.py sfx series/my-series 1
    python generate_video.py desktop series/my-series 1
    python generate_video.py mobile series/my-series 1
"""

import json
import os
import subprocess
import sys
import time

import requests

DEFAULT_VOICE_ID = "IKne3meq5aSn9XLyUdCD"  # Charlie
TTS_MODEL = "eleven_multilingual_v2"
PANEL_VIDEO_WIDTH = 1920
PANEL_VIDEO_HEIGHT = 1080
PAGE_VIDEO_WIDTH = 1080
PAGE_VIDEO_HEIGHT = 1920
VIDEO_FPS = 30
MUSIC_VOLUME = 0.25  # Background music volume (present but under dialogue)
SFX_VOLUME = 0.40  # Sound effects volume (subtle, ambient)
SILENT_PANEL_DURATION = 1.0  # default seconds for panels without dialogue
TTS_PADDING = 0.3  # default extra seconds after TTS ends
REQUEST_DELAY = 1
SFX_DURATION_RANGE = (1.0, 3.0)  # min/max seconds for generated SFX


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
    """Find .env file in current directory."""
    if os.path.exists(".env"):
        return ".env"
    raise FileNotFoundError("No .env file found in current directory")


def get_duration(filepath):
    """Get audio duration in seconds via ffprobe."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "csv=p=0",
            filepath,
        ],
        capture_output=True, text=True,
    )
    return float(result.stdout.strip())


class SFXGenerator:
    """Generate sound effects using ElevenLabs Sound Generation API."""

    def __init__(self, series_dir, chapter_num, env):
        self.api_key = env.get("ELEVEN_LABS_API_KEY")
        if not self.api_key:
            raise ValueError("ELEVEN_LABS_API_KEY not found in .env")
        self.series_dir = series_dir
        self.chapter_num = chapter_num
        self.output_dir = f"{series_dir}/chapters/{chapter_num}/media"
        os.makedirs(self.output_dir, exist_ok=True)

    def generate_single(self, index, description, duration_seconds=2.0):
        """Generate a sound effect from description and save to media/."""
        output_path = f"{self.output_dir}/sfx-{index}.mp3"

        if os.path.exists(output_path):
            size_kb = os.path.getsize(output_path) / 1024
            print(f"  sfx-{index}.mp3 ({size_kb:.0f} KB) [SKIP existing] [{description[:40]}...]")
            return output_path

        # ElevenLabs Sound Generation API
        response = requests.post(
            "https://api.elevenlabs.io/v1/sound-generation",
            headers={
                "Content-Type": "application/json",
                "xi-api-key": self.api_key,
            },
            json={
                "text": description,
                "duration_seconds": min(max(duration_seconds, SFX_DURATION_RANGE[0]), SFX_DURATION_RANGE[1]),
            },
        )

        if response.status_code == 200:
            with open(output_path, "wb") as f:
                f.write(response.content)
            size_kb = len(response.content) / 1024
            print(f"  sfx-{index}.mp3 ({size_kb:.0f} KB) [{description[:40]}...]")
            return output_path
        else:
            print(f"  Error sfx-{index}: {response.status_code} {response.text[:200]}")
            return None

    def generate_all(self, sfx_entries):
        """Generate all sound effects from entries list."""
        if not sfx_entries:
            return {}

        print(f"\nGenerating {len(sfx_entries)} sound effects...")
        results = {}

        for i, entry in enumerate(sfx_entries):
            idx = entry["index"]
            desc = entry["description"]
            duration = entry.get("duration", 2.0)
            print(f"[{i + 1}/{len(sfx_entries)}] SFX {idx}: {desc[:50]}...")
            path = self.generate_single(idx, desc, duration)
            if path:
                results[idx] = path

            if i < len(sfx_entries) - 1:
                time.sleep(REQUEST_DELAY)

        print(f"\nSFX: {len(results)}/{len(sfx_entries)} generated")
        return results


class TTSGenerator:
    """Generate TTS audio using ElevenLabs API with per-line voice support."""

    def __init__(self, series_dir, chapter_num, env):
        self.api_key = env.get("ELEVEN_LABS_API_KEY")
        if not self.api_key:
            raise ValueError("ELEVEN_LABS_API_KEY not found in .env")
        self.series_dir = series_dir
        self.chapter_num = chapter_num
        self.output_dir = f"{series_dir}/chapters/{chapter_num}/media"
        os.makedirs(self.output_dir, exist_ok=True)

    def generate_single(self, index, speaker, text, voice_id):
        """Generate TTS for a single dialogue line and save to media/."""
        output_path = f"{self.output_dir}/tts-{index}.mp3"

        if os.path.exists(output_path):
            size_kb = os.path.getsize(output_path) / 1024
            print(f"  tts-{index}.mp3 ({size_kb:.0f} KB) [SKIP existing] [{speaker}]")
            return True

        response = requests.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            headers={
                "Content-Type": "application/json",
                "xi-api-key": self.api_key,
            },
            json={
                "text": text,
                "model_id": TTS_MODEL,
            },
        )

        if response.status_code == 200:
            with open(output_path, "wb") as f:
                f.write(response.content)
            size_kb = len(response.content) / 1024
            print(f"  tts-{index}.mp3 ({size_kb:.0f} KB) [{speaker}]")
            return True
        else:
            print(f"  Error tts-{index}: {response.status_code} {response.text[:200]}")
            return False

    def generate_all(self, dialogue_lines):
        """Generate TTS for all dialogue lines with per-line voice IDs."""
        print(f"\nGenerating TTS for {len(dialogue_lines)} dialogue lines...")
        print(f"Model: {TTS_MODEL}\n")

        results = []
        for i, line in enumerate(dialogue_lines):
            idx = line["index"]
            speaker = line.get("speaker", "")
            text = line["text"]
            voice_id = line.get("voice_id", DEFAULT_VOICE_ID)
            print(f"[{i + 1}/{len(dialogue_lines)}] Dialogue {idx}: {speaker} ({len(text)} chars) → {voice_id[:8]}...")
            success = self.generate_single(idx, speaker, text, voice_id)
            results.append(success)

            if i < len(dialogue_lines) - 1:
                time.sleep(REQUEST_DELAY)

        success_count = sum(results)
        print(f"\nTTS: {success_count}/{len(results)} generated")
        print(f"Output: {self.output_dir}")
        return success_count == len(results)


def discover_panels(pages_dir, media_dir):
    """Walk pages in numeric order, read panels.json, build segment list.

    Supports enhanced timing fields in panels.json:
    - silence: custom duration for silent panels (default 1.0s)
    - pause_after: extra pause after dialogue (default 0.3s)
    - sfx: array of sound effect descriptions to generate

    For pages with NO dialogue, shows page.jpg instead of individual panels.
    """
    if not os.path.isdir(pages_dir):
        raise FileNotFoundError(f"Pages directory not found: {pages_dir}")

    page_dirs = sorted(
        [d for d in os.listdir(pages_dir)
         if os.path.isdir(os.path.join(pages_dir, d)) and d.isdigit()],
        key=int,
    )

    if not page_dirs:
        raise FileNotFoundError(f"No page directories in {pages_dir}")

    segments = []
    tts_index = 0
    sfx_index = 0

    for page_num in page_dirs:
        page_path = os.path.join(pages_dir, page_num)
        panels_path = os.path.join(page_path, "panels.json")

        if not os.path.exists(panels_path):
            print(f"  Warning: No panels.json in page {page_num}, skipping")
            continue

        with open(panels_path) as f:
            panels = json.load(f)

        # Check if ANY panel on this page has dialogue
        page_has_dialogue = any(bool(panel.get("dialogue")) for panel in panels)

        if not page_has_dialogue:
            # No dialogue on page - use page.jpg with fixed short duration
            page_img = os.path.join(page_path, "page.jpg")
            if not os.path.exists(page_img):
                print(f"  Warning: Missing page.jpg for page {page_num}, falling back to panels")
                page_has_dialogue = True  # Force panel-by-panel processing
            else:
                # Fixed duration for silent pages (max 3 seconds)
                total_silence = 3.0

                # Collect all SFX from all panels on this page
                page_sfx = []
                for panel in panels:
                    if panel.get("sfx"):
                        for sfx in panel["sfx"]:
                            sfx_index += 1
                            page_sfx.append({
                                "index": sfx_index,
                                "description": sfx.get("description", sfx) if isinstance(sfx, dict) else sfx,
                                "duration": sfx.get("duration", 2.0) if isinstance(sfx, dict) else 2.0,
                                "volume": sfx.get("volume", SFX_VOLUME) if isinstance(sfx, dict) else SFX_VOLUME,
                            })

                segments.append({
                    "page": int(page_num),
                    "panel": 0,  # 0 indicates full page
                    "name": "page",
                    "image": page_img,
                    "tts": None,
                    "has_dialogue": False,
                    "silence_duration": total_silence,
                    "pause_after": 0,
                    "sfx": page_sfx,
                })
                continue  # Skip panel-by-panel processing

        # Page has dialogue - process individual panels
        for i, panel in enumerate(panels):
            name = panel["name"]
            dialogue_lines = panel.get("dialogue", [])
            has_dialogue = bool(dialogue_lines)

            # Choose image: prefer -text.jpg for dialogue panels
            raw_img = os.path.join(page_path, f"{i + 1}-{name}.jpg")
            if has_dialogue:
                text_img = os.path.join(page_path, f"{i + 1}-{name}-text.jpg")
                image_path = text_img if os.path.exists(text_img) else raw_img
            else:
                image_path = raw_img

            if not os.path.exists(image_path):
                print(f"  Warning: Missing {os.path.basename(image_path)}, skipping")
                # Still advance tts_index for skipped dialogue panels
                tts_index += len(dialogue_lines)
                continue

            # Extract sound effects (attach to first segment for this panel)
            sfx_entries = []
            if panel.get("sfx"):
                for sfx in panel["sfx"]:
                    sfx_index += 1
                    sfx_entries.append({
                        "index": sfx_index,
                        "description": sfx.get("description", sfx) if isinstance(sfx, dict) else sfx,
                        "duration": sfx.get("duration", 2.0) if isinstance(sfx, dict) else 2.0,
                        "volume": sfx.get("volume", SFX_VOLUME) if isinstance(sfx, dict) else SFX_VOLUME,
                    })

            if has_dialogue:
                # Create one segment per dialogue line to stay in sync with TTS indices
                for line_idx, dlg in enumerate(dialogue_lines):
                    tts_index += 1
                    tts_path = os.path.join(media_dir, f"tts-{tts_index}.mp3")
                    is_last_line = (line_idx == len(dialogue_lines) - 1)
                    segments.append({
                        "page": int(page_num),
                        "panel": i + 1,
                        "name": name,
                        "image": image_path,
                        "tts": tts_path,
                        "has_dialogue": True,
                        "silence_duration": SILENT_PANEL_DURATION,
                        "pause_after": panel.get("pause_after", TTS_PADDING) if is_last_line else TTS_PADDING,
                        "sfx": sfx_entries if line_idx == 0 else [],
                    })
            else:
                # Silent panel - single segment
                segments.append({
                    "page": int(page_num),
                    "panel": i + 1,
                    "name": name,
                    "image": image_path,
                    "tts": None,
                    "has_dialogue": False,
                    "silence_duration": panel.get("silence", SILENT_PANEL_DURATION),
                    "pause_after": 0,
                    "sfx": sfx_entries,
                })

    return segments


def calculate_durations(segments):
    """Calculate duration for each segment based on TTS or custom silence duration."""
    dialogue_count = 0
    for seg in segments:
        if seg["has_dialogue"] and seg["tts"] and os.path.exists(seg["tts"]):
            # TTS duration + custom pause_after (or default)
            seg["duration"] = get_duration(seg["tts"]) + seg.get("pause_after", TTS_PADDING)
            dialogue_count += 1
        else:
            # Use custom silence duration (or default)
            seg["duration"] = seg.get("silence_duration", SILENT_PANEL_DURATION)
    return dialogue_count


def collect_sfx_entries(segments):
    """Collect all SFX entries from segments that need generation."""
    all_sfx = []
    for seg in segments:
        if seg.get("sfx"):
            all_sfx.extend(seg["sfx"])
    return all_sfx


def extract_dialogue_from_panels(pages_dir):
    """Extract dialogue with voice_id from panels.json files."""
    page_dirs = sorted(
        [d for d in os.listdir(pages_dir)
         if os.path.isdir(os.path.join(pages_dir, d)) and d.isdigit()],
        key=int,
    )

    dialogue_list = []
    tts_index = 0

    for page_num in page_dirs:
        panels_path = os.path.join(pages_dir, page_num, "panels.json")
        if not os.path.exists(panels_path):
            continue

        with open(panels_path) as f:
            panels = json.load(f)

        for panel in panels:
            if panel.get("dialogue"):
                for dlg in panel["dialogue"]:
                    tts_index += 1
                    dialogue_list.append({
                        "index": tts_index,
                        "speaker": dlg.get("speaker", ""),
                        "voice_id": dlg.get("voice_id", DEFAULT_VOICE_ID),
                        "text": dlg.get("text", ""),
                    })

    return dialogue_list


def extract_sfx_from_panels(pages_dir):
    """Extract SFX entries from panels.json files."""
    page_dirs = sorted(
        [d for d in os.listdir(pages_dir)
         if os.path.isdir(os.path.join(pages_dir, d)) and d.isdigit()],
        key=int,
    )

    sfx_list = []
    sfx_index = 0

    for page_num in page_dirs:
        panels_path = os.path.join(pages_dir, page_num, "panels.json")
        if not os.path.exists(panels_path):
            continue

        with open(panels_path) as f:
            panels = json.load(f)

        for panel in panels:
            if panel.get("sfx"):
                for sfx in panel["sfx"]:
                    sfx_index += 1
                    if isinstance(sfx, dict):
                        sfx_list.append({
                            "index": sfx_index,
                            "description": sfx.get("description", ""),
                            "duration": sfx.get("duration", 2.0),
                        })
                    else:
                        sfx_list.append({
                            "index": sfx_index,
                            "description": sfx,
                            "duration": 2.0,
                        })

    return sfx_list


def build_audio_filter(segments, tts_input_indices, sfx_input_indices, music_input_idx, total_duration, speed=1.0):
    """Build the audio portion of the ffmpeg filter chain with SFX support."""
    n = len(segments)
    parts = []

    # Build per-segment audio (TTS or silence)
    for i, seg in enumerate(segments):
        label = f"a{i}"
        if i in tts_input_indices:
            idx = tts_input_indices[i]
            # Apply atempo for speed adjustment (must come before duration trimming)
            tempo_filter = f"atempo={speed}," if speed != 1.0 else ""
            parts.append(
                f"[{idx}:a]{tempo_filter}apad=whole_dur={seg['duration']},"
                f"atrim=0:{seg['duration']},"
                f"asetpts=PTS-STARTPTS,"
                f"aresample=44100,"
                f"aformat=channel_layouts=stereo[{label}]"
            )
        else:
            parts.append(
                f"anullsrc=r=44100:cl=stereo,"
                f"atrim=0:{seg['duration']},"
                f"asetpts=PTS-STARTPTS[{label}]"
            )

    a_concat = "".join(f"[a{i}]" for i in range(n))
    parts.append(f"{a_concat}concat=n={n}:v=0:a=1[narration]")

    # Build SFX layer if any sound effects exist
    if sfx_input_indices:
        # Calculate start times for each segment
        segment_starts = []
        current_time = 0
        for seg in segments:
            segment_starts.append(current_time)
            current_time += seg["duration"]

        # Create delayed SFX streams
        sfx_labels = []
        for seg_idx, seg in enumerate(segments):
            for sfx_entry in seg.get("sfx", []):
                sfx_idx = sfx_entry["index"]
                if sfx_idx in sfx_input_indices:
                    input_idx = sfx_input_indices[sfx_idx]
                    delay_ms = int(segment_starts[seg_idx] * 1000)
                    volume = sfx_entry.get("volume", SFX_VOLUME)
                    label = f"sfx{sfx_idx}"
                    # SFX plays at normal speed - only the timing is adjusted
                    # (unlike TTS which needs atempo to match sped-up video)
                    parts.append(
                        f"[{input_idx}:a]aresample=44100,"
                        f"aformat=channel_layouts=stereo,"
                        f"volume={volume},"
                        f"adelay={delay_ms}|{delay_ms},"
                        f"apad=whole_dur={total_duration},"
                        f"atrim=0:{total_duration}[{label}]"
                    )
                    sfx_labels.append(f"[{label}]")

        # Mix all SFX together
        if sfx_labels:
            sfx_concat = "".join(sfx_labels)
            parts.append(f"{sfx_concat}amix=inputs={len(sfx_labels)}:normalize=0[sfx_mix]")
            # Mix narration with SFX
            parts.append(
                "[narration][sfx_mix]amix=inputs=2:normalize=0[narration_sfx]"
            )
            narration_label = "narration_sfx"
        else:
            narration_label = "narration"
    else:
        narration_label = "narration"

    # Add background music (keep at normal speed regardless of video speed)
    parts.append(
        f"[{music_input_idx}:a]atrim=0:{total_duration},"
        f"asetpts=PTS-STARTPTS,"
        f"volume={MUSIC_VOLUME}[music]"
    )

    # Final mix
    parts.append(
        f"[{narration_label}][music]amix=inputs=2:"
        "duration=first:dropout_transition=2[aout]"
    )

    return parts


def run_ffmpeg(inputs, filter_parts, output_path):
    """Run ffmpeg with the given inputs and filter chain."""
    filter_complex = ";\n".join(filter_parts)

    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[vout]",
        "-map", "[aout]",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        output_path,
    ]

    print("\nRunning ffmpeg...")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"ffmpeg error:\n{result.stderr[-1500:]}")
        return False
    return True


class PanelVideoAssembler:
    """Assemble horizontal (1920x1080) video showing individual panels."""

    def __init__(self, series_dir, chapter_num):
        self.chapter_num = chapter_num
        self.chapter_dir = f"{series_dir}/chapters/{chapter_num}"
        self.pages_dir = f"{self.chapter_dir}/pages"
        self.media_dir = f"{self.chapter_dir}/media"
        self.output_path = f"{self.media_dir}/chapter-video-desktop.mp4"
        self.width = PANEL_VIDEO_WIDTH
        self.height = PANEL_VIDEO_HEIGHT

    def assemble(self):
        """Build horizontal video with static panel display."""
        music_path = os.path.join(self.media_dir, "background-music.mp3")
        if not os.path.exists(music_path):
            raise FileNotFoundError(f"Missing: {music_path}")

        segments = discover_panels(self.pages_dir, self.media_dir)
        if not segments:
            raise ValueError("No panels found")

        print(f"\nAssembling panel video from {len(segments)} panels...")

        dialogue_count = calculate_durations(segments)
        for seg in segments:
            tag = "[dialogue]" if seg["has_dialogue"] else "[silent]"
            print(f"  P{seg['page']}/{seg['panel']} {seg['name']}: "
                  f"{seg['duration']:.1f}s {tag}")

        total_duration = sum(s["duration"] for s in segments)
        page_count = len(set(s["page"] for s in segments))
        print(f"\nTotal: {total_duration:.1f}s | {page_count} pages | "
              f"{len(segments)} panels | {dialogue_count} dialogue clips")

        n = len(segments)
        inputs = []
        filter_parts = []

        for seg in segments:
            inputs.extend(["-i", seg["image"]])

        tts_input_indices = {}
        next_input_idx = n
        for i, seg in enumerate(segments):
            if seg["has_dialogue"] and seg["tts"] and os.path.exists(seg["tts"]):
                tts_input_indices[i] = next_input_idx
                inputs.extend(["-i", seg["tts"]])
                next_input_idx += 1

        # Add SFX inputs
        sfx_input_indices = {}
        for seg in segments:
            for sfx_entry in seg.get("sfx", []):
                sfx_path = os.path.join(self.media_dir, f"sfx-{sfx_entry['index']}.mp3")
                if os.path.exists(sfx_path):
                    sfx_input_indices[sfx_entry["index"]] = next_input_idx
                    inputs.extend(["-i", sfx_path])
                    next_input_idx += 1

        music_input_idx = next_input_idx
        inputs.extend(["-stream_loop", "-1", "-i", music_path])

        # Static display: scale to fit, pad with black bars, loop for duration
        for i, seg in enumerate(segments):
            frames = max(1, int(seg["duration"] * VIDEO_FPS))
            filter_parts.append(
                f"[{i}:v]scale={self.width}:{self.height}:"
                f"force_original_aspect_ratio=decrease,"
                f"pad={self.width}:{self.height}:(ow-iw)/2:(oh-ih)/2:black,"
                f"setsar=1,"
                f"loop={frames - 1}:1:0,"
                f"setpts=N/{VIDEO_FPS}/TB,"
                f"format=yuv420p[v{i}]"
            )

        v_concat = "".join(f"[v{i}]" for i in range(n))
        filter_parts.append(f"{v_concat}concat=n={n}:v=1:a=0[vout]")

        filter_parts.extend(build_audio_filter(
            segments, tts_input_indices, sfx_input_indices, music_input_idx, total_duration))

        if not run_ffmpeg(inputs, filter_parts, self.output_path):
            return False

        size_mb = os.path.getsize(self.output_path) / 1024 / 1024
        print(f"\nPanel video complete for Chapter {self.chapter_num}")
        print(f"Duration: {total_duration:.1f}s | "
              f"Resolution: {self.width}x{self.height}")
        print(f"Pages: {page_count} | Panels: {len(segments)} | "
              f"Dialogue clips: {dialogue_count}")
        print(f"Size: {size_mb:.1f} MB")
        print(f"Output: {self.output_path}")
        return True


class PageVideoAssembler:
    """Assemble vertical (1080x1920) video showing individual panels (mobile/shorts format)."""

    def __init__(self, series_dir, chapter_num, speed=1.0):
        self.chapter_num = chapter_num
        self.chapter_dir = f"{series_dir}/chapters/{chapter_num}"
        self.pages_dir = f"{self.chapter_dir}/pages"
        self.media_dir = f"{self.chapter_dir}/media"
        self.speed = speed
        if speed != 1.0:
            self.output_path = f"{self.media_dir}/chapter-video-mobile-{speed}x.mp4"
        else:
            self.output_path = f"{self.media_dir}/chapter-video-mobile.mp4"
        self.width = PAGE_VIDEO_WIDTH
        self.height = PAGE_VIDEO_HEIGHT

    def assemble(self):
        """Build vertical video with static panel display (same as desktop but vertical)."""
        music_path = os.path.join(self.media_dir, "background-music.mp3")
        if not os.path.exists(music_path):
            raise FileNotFoundError(f"Missing: {music_path}")

        segments = discover_panels(self.pages_dir, self.media_dir)
        if not segments:
            raise ValueError("No panels found")

        speed_label = f" ({self.speed}x speed)" if self.speed != 1.0 else ""
        print(f"\nAssembling mobile video{speed_label} from {len(segments)} panels...")

        dialogue_count = calculate_durations(segments)

        # Apply speed factor to durations
        if self.speed != 1.0:
            for seg in segments:
                seg["duration"] = seg["duration"] / self.speed

        for seg in segments:
            tag = "[dialogue]" if seg["has_dialogue"] else "[silent]"
            print(f"  P{seg['page']}/{seg['panel']} {seg['name']}: "
                  f"{seg['duration']:.1f}s {tag}")

        total_duration = sum(s["duration"] for s in segments)
        page_count = len(set(s["page"] for s in segments))
        print(f"\nTotal: {total_duration:.1f}s | {page_count} pages | "
              f"{len(segments)} panels | {dialogue_count} dialogue clips")

        n = len(segments)
        inputs = []
        filter_parts = []

        for seg in segments:
            inputs.extend(["-i", seg["image"]])

        tts_input_indices = {}
        next_input_idx = n
        for i, seg in enumerate(segments):
            if seg["has_dialogue"] and seg["tts"] and os.path.exists(seg["tts"]):
                tts_input_indices[i] = next_input_idx
                inputs.extend(["-i", seg["tts"]])
                next_input_idx += 1

        # Add SFX inputs
        sfx_input_indices = {}
        for seg in segments:
            for sfx_entry in seg.get("sfx", []):
                sfx_path = os.path.join(self.media_dir, f"sfx-{sfx_entry['index']}.mp3")
                if os.path.exists(sfx_path):
                    sfx_input_indices[sfx_entry["index"]] = next_input_idx
                    inputs.extend(["-i", sfx_path])
                    next_input_idx += 1

        music_input_idx = next_input_idx
        inputs.extend(["-stream_loop", "-1", "-i", music_path])

        # Static display: scale to fit vertical, pad with black bars, loop for duration
        for i, seg in enumerate(segments):
            frames = max(1, int(seg["duration"] * VIDEO_FPS))
            filter_parts.append(
                f"[{i}:v]scale={self.width}:{self.height}:"
                f"force_original_aspect_ratio=decrease,"
                f"pad={self.width}:{self.height}:(ow-iw)/2:(oh-ih)/2:black,"
                f"setsar=1,"
                f"loop={frames - 1}:1:0,"
                f"setpts=N/{VIDEO_FPS}/TB,"
                f"format=yuv420p[v{i}]"
            )

        v_concat = "".join(f"[v{i}]" for i in range(n))
        filter_parts.append(f"{v_concat}concat=n={n}:v=1:a=0[vout]")

        filter_parts.extend(build_audio_filter(
            segments, tts_input_indices, sfx_input_indices, music_input_idx, total_duration, self.speed))

        if not run_ffmpeg(inputs, filter_parts, self.output_path):
            return False

        size_mb = os.path.getsize(self.output_path) / 1024 / 1024
        speed_label = f" ({self.speed}x)" if self.speed != 1.0 else ""
        print(f"\nMobile video{speed_label} complete for Chapter {self.chapter_num}")
        print(f"Duration: {total_duration:.1f}s | "
              f"Resolution: {self.width}x{self.height}")
        print(f"Pages: {page_count} | Panels: {len(segments)} | "
              f"Dialogue clips: {dialogue_count}")
        print(f"Size: {size_mb:.1f} MB")
        print(f"Output: {self.output_path}")
        return True


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    series_dir = sys.argv[2]
    chapter_num = int(sys.argv[3])

    pages_dir = f"{series_dir}/chapters/{chapter_num}/pages"

    if command == "tts":
        # Extract dialogue from panels.json and generate TTS
        env_path = find_env_file()
        env = load_env(env_path)
        print(f"Using .env from: {env_path}")

        dialogue = extract_dialogue_from_panels(pages_dir)
        if not dialogue:
            print("No dialogue found in panels.json files")
            sys.exit(0)

        print(f"Found {len(dialogue)} dialogue entries in panels.json")
        generator = TTSGenerator(series_dir, chapter_num, env)
        success = generator.generate_all(dialogue)
        sys.exit(0 if success else 1)

    elif command == "sfx":
        # Extract SFX from panels.json and generate
        env_path = find_env_file()
        env = load_env(env_path)
        print(f"Using .env from: {env_path}")

        sfx_entries = extract_sfx_from_panels(pages_dir)
        if not sfx_entries:
            print("No SFX found in panels.json files")
            sys.exit(0)

        print(f"Found {len(sfx_entries)} SFX entries in panels.json")
        generator = SFXGenerator(series_dir, chapter_num, env)
        results = generator.generate_all(sfx_entries)
        sys.exit(0 if len(results) == len(sfx_entries) else 1)

    elif command == "desktop":
        assembler = PanelVideoAssembler(series_dir, chapter_num)
        success = assembler.assemble()
        sys.exit(0 if success else 1)

    elif command == "mobile":
        assembler = PageVideoAssembler(series_dir, chapter_num)
        success = assembler.assemble()
        sys.exit(0 if success else 1)

    elif command == "mobile-fast":
        assembler = PageVideoAssembler(series_dir, chapter_num, speed=1.5)
        success = assembler.assemble()
        sys.exit(0 if success else 1)

    else:
        print(f"Unknown command: {command}")
        print("Commands: tts, sfx, desktop, mobile, mobile-fast")
        sys.exit(1)


if __name__ == "__main__":
    main()
