#!/usr/bin/env python3
"""
Enrich panels.json files with voice IDs, timing, and SFX for video generation.

Usage:
    python enrich_panels.py <pages_dir> <voices_md> [enrichment_json]

Arguments:
    pages_dir        - Path to chapter pages directory (e.g., chapters/3/pages)
    voices_md        - Path to voices.md (e.g., ../../voices.md)
    enrichment_json  - Optional path to enrichment.json with timing/sfx overrides

What it does:
    1. Parses voices.md to build speaker → voice_id map
    2. Reads enrichment.json for per-panel timing (silence, pause_after) and sfx
    3. For each panels.json: adds voice_id to dialogue entries, merges enrichment fields

Enrichment JSON format:
    {
        "pages": {
            "1": {
                "panel-name": {
                    "silence": 2.5,
                    "pause_after": 1.0,
                    "sfx": [{"description": "door closing softly", "duration": 2.0}]
                }
            }
        }
    }

Fields applied:
    - voice_id: Added to every dialogue entry (from voices.md speaker mapping)
    - silence: Duration for silent panels (panels without dialogue)
    - pause_after: Extra pause after last dialogue line on a panel
    - sfx: Array of sound effect descriptions to generate
"""

import json
import os
import re
import sys


def parse_voices_md(voices_path):
    """Parse voices.md to extract speaker → voice_id mapping."""
    if not os.path.exists(voices_path):
        print(f"Warning: voices.md not found at {voices_path}")
        return {}, None, None

    with open(voices_path) as f:
        content = f.read()

    voices = {}
    default_female = None
    default_male = None

    for line in content.split("\n"):
        line = line.strip()
        if not line.startswith("- **"):
            continue

        # Parse: - **Name** — voice_id (Label) — description
        match = re.match(r'-\s+\*\*(\w+)\*\*\s+—\s+(\w+)', line)
        if match:
            name = match.group(1)
            voice_id = match.group(2)

            if name == "Female":
                default_female = voice_id
            elif name == "Male":
                default_male = voice_id
            else:
                voices[name] = voice_id

    return voices, default_female, default_male


def load_enrichment(enrichment_path):
    """Load enrichment.json if it exists."""
    if not enrichment_path or not os.path.exists(enrichment_path):
        return {}

    with open(enrichment_path) as f:
        return json.load(f)


def enrich_page(panels, page_num, voice_map, default_female, default_male, enrichment):
    """Apply voice IDs and enrichment to a page's panels."""
    page_enrichment = enrichment.get("pages", {}).get(str(page_num), {})
    modified = False

    for panel in panels:
        name = panel["name"]
        panel_enrichment = page_enrichment.get(name, {})

        # Apply voice_id to dialogue entries
        if panel.get("dialogue"):
            for dlg in panel["dialogue"]:
                speaker = dlg.get("speaker", "")
                voice_id = voice_map.get(speaker)
                if not voice_id:
                    # Fall back to default
                    voice_id = default_female or default_male
                if voice_id and dlg.get("voice_id") != voice_id:
                    dlg["voice_id"] = voice_id
                    modified = True

        # Merge enrichment fields (silence, pause_after, sfx)
        for field in ("silence", "pause_after", "sfx"):
            if field in panel_enrichment:
                if panel.get(field) != panel_enrichment[field]:
                    panel[field] = panel_enrichment[field]
                    modified = True

    return modified


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    pages_dir = sys.argv[1]
    voices_path = sys.argv[2]
    enrichment_path = sys.argv[3] if len(sys.argv) > 3 else None

    # Parse voices
    voice_map, default_female, default_male = parse_voices_md(voices_path)
    print(f"Voices: {len(voice_map)} characters mapped")
    for name, vid in voice_map.items():
        print(f"  {name} → {vid[:12]}...")

    # Load enrichment
    enrichment = load_enrichment(enrichment_path)
    enriched_pages = len(enrichment.get("pages", {}))
    if enriched_pages:
        print(f"Enrichment: {enriched_pages} pages with overrides")

    # Process each page
    page_dirs = sorted(
        [d for d in os.listdir(pages_dir)
         if os.path.isdir(os.path.join(pages_dir, d)) and d.isdigit()],
        key=int,
    )

    total_dialogue = 0
    total_enriched = 0
    total_sfx = 0

    for page_num in page_dirs:
        panels_path = os.path.join(pages_dir, page_num, "panels.json")
        if not os.path.exists(panels_path):
            continue

        with open(panels_path) as f:
            panels = json.load(f)

        modified = enrich_page(
            panels, int(page_num), voice_map,
            default_female, default_male, enrichment,
        )

        # Count stats
        for panel in panels:
            if panel.get("dialogue"):
                total_dialogue += len(panel["dialogue"])
            if panel.get("sfx"):
                total_sfx += len(panel["sfx"])
            if panel.get("silence") or panel.get("pause_after"):
                total_enriched += 1

        if modified:
            with open(panels_path, "w") as f:
                json.dump(panels, f, indent=2, ensure_ascii=False)
            print(f"  Page {page_num}: updated")
        else:
            print(f"  Page {page_num}: no changes")

    print(f"\nDone: {total_dialogue} dialogue entries with voice_id, "
          f"{total_enriched} panels with timing, {total_sfx} SFX entries")


if __name__ == "__main__":
    main()
