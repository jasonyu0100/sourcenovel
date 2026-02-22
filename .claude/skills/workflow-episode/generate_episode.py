#!/usr/bin/env python3
"""
Generate episode.json for a chapter by scanning panels.json and world data.

Usage:
    python generate_episode.py <series_dir> <chapter_num>

Example:
    python generate_episode.py series/ignition 1
"""

import json
import os
import re
import sys
from collections import Counter


def slug_to_name(slug):
    """Convert a slug like 'rei-ashford' to 'Rei Ashford'."""
    return " ".join(word.capitalize() for word in slug.split("-"))



def main():
    if len(sys.argv) < 3:
        print("Usage: python generate_episode.py <series_dir> <chapter_num>")
        sys.exit(1)

    series_dir = sys.argv[1]
    chapter_num = int(sys.argv[2])
    chapter_dir = os.path.join(series_dir, "chapters", str(chapter_num))

    if not os.path.isdir(chapter_dir):
        print(f"Error: Chapter directory not found: {chapter_dir}")
        sys.exit(1)

    # --- Read metadata ---
    meta_path = os.path.join(chapter_dir, "meta.json")
    arc_num = 1
    if os.path.exists(meta_path):
        with open(meta_path) as f:
            meta = json.load(f)
        arc_num = int(meta.get("arcId", meta.get("arcNum", 1)))

    # --- Scan panels.json files ---
    pages_dir = os.path.join(chapter_dir, "pages")
    if not os.path.isdir(pages_dir):
        print(f"Error: Pages directory not found: {pages_dir}")
        sys.exit(1)

    # Sort page directories numerically
    page_nums = sorted(
        [int(d) for d in os.listdir(pages_dir) if d.isdigit() and os.path.isdir(os.path.join(pages_dir, d))]
    )

    character_refs = set()
    location_refs = set()
    speaker_counts = Counter()
    character_panel_counts = Counter()
    first_location = None

    for page_num in page_nums:
        panels_path = os.path.join(pages_dir, str(page_num), "panels.json")
        if not os.path.exists(panels_path):
            continue
        with open(panels_path) as f:
            panels = json.load(f)

        for panel in panels:
            refs = panel.get("ref", [])
            for ref in refs:
                if ref.startswith("world/characters/"):
                    character_refs.add(ref)
                    slug = ref.replace("world/characters/", "").replace(".jpg", "")
                    character_panel_counts[slug] += 1
                elif ref.startswith("world/locations/"):
                    location_refs.add(ref)
                    if first_location is None:
                        first_location = ref.replace("world/locations/", "").replace(".jpg", "")

            for dlg in panel.get("dialogue", []):
                speaker = dlg.get("speaker", "")
                # Normalize speaker variants like "Senna (text)"
                base_speaker = re.sub(r"\s*\(.*\)", "", speaker)
                speaker_counts[base_speaker] += 1

    # --- Determine default character ---
    # Most dialogue lines wins; tie-break by panel appearances
    if speaker_counts:
        # Map speakers to character slugs
        char_slugs = {ref.replace("world/characters/", "").replace(".jpg", "") for ref in character_refs}
        speaker_to_slug = {}
        for speaker in speaker_counts:
            speaker_lower = speaker.lower()
            for slug in char_slugs:
                if slug.startswith(speaker_lower) or speaker_lower in slug:
                    speaker_to_slug[speaker] = slug
                    break

        # Score: dialogue lines + panel appearances
        scores = {}
        for speaker, count in speaker_counts.items():
            slug = speaker_to_slug.get(speaker)
            if slug:
                scores[speaker] = count + character_panel_counts.get(slug, 0)

        winner = max(scores, key=scores.get) if scores else next(iter(speaker_counts))
        winner_slug = speaker_to_slug.get(winner)
        default_character = slug_to_name(winner_slug) if winner_slug else winner
    else:
        default_character = ""

    # --- Starting location ---
    starting_location = first_location or ""

    # --- Build characters array ---
    characters = []
    for ref in sorted(character_refs):
        slug = ref.replace("world/characters/", "").replace(".jpg", "")
        characters.append({
            "name": slug_to_name(slug),
            "slug": slug,
        })

    # --- Build locations array ---
    locations = []
    for ref in sorted(location_refs):
        slug = ref.replace("world/locations/", "").replace(".jpg", "")
        locations.append({
            "name": slug_to_name(slug),
            "slug": slug,
        })

    # --- Write episode.json ---
    episode = {
        "chapterNum": chapter_num,
        "arcNum": arc_num,
        "defaultCharacter": default_character,
        "startingLocation": starting_location,
        "characters": characters,
        "locations": locations,
    }

    output_path = os.path.join(chapter_dir, "episode.json")
    with open(output_path, "w") as f:
        json.dump(episode, f, indent=2)
        f.write("\n")

    # --- Report ---
    char_names = ", ".join(c["name"] for c in characters)
    loc_names = ", ".join(loc["name"] for loc in locations)
    print(f"EPISODE DATA GENERATED: Chapter {chapter_num}")
    print(f"Characters: {char_names}")
    print(f"Locations: {loc_names}")
    print(f"Default: {default_character} | Start: {starting_location}")
    print(f"File: {output_path}")


if __name__ == "__main__":
    main()
