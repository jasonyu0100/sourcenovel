#!/usr/bin/env python3
"""
Convert staging.md to pages.json and per-page panels.json files.

Usage:
    python staging_to_panels.py <pages_dir>

Arguments:
    pages_dir - Path to the pages directory (e.g., series/ignition/chapters/3/pages)

Reads staging.md from pages_dir and generates:
    pages_dir/pages.json
    pages_dir/{page_num}/panels.json
"""

import os
import re
import sys
import json


def parse_staging(staging_path):
    """Parse staging.md into structured page/panel data."""
    with open(staging_path) as f:
        content = f.read()

    pages = []
    # Split on page headers: ## Page N — Title
    page_blocks = re.split(r'^## Page (\d+)\s*[—–-]\s*(.+)$', content, flags=re.MULTILINE)

    # page_blocks[0] is before first page (chapter title), then groups of 3: (num, title, body)
    for i in range(1, len(page_blocks), 3):
        page_num = int(page_blocks[i])
        page_title = page_blocks[i + 1].strip()
        body = page_blocks[i + 2]

        # Extract layout
        layout_match = re.search(r'\*\*Layout:\*\*\s*(\S+)', body)
        layout = layout_match.group(1) if layout_match else "story4"

        # Split into panels: ### Panel N: slug
        panel_blocks = re.split(r'^### Panel \d+:\s*(.+)$', body, flags=re.MULTILINE)

        panels = []
        for j in range(1, len(panel_blocks), 2):
            name = panel_blocks[j].strip()
            panel_body = panel_blocks[j + 1]

            panel = {"name": name}

            # Extract prompt
            prompt_match = re.search(r'\*\*Prompt:\*\*\s*(.+)', panel_body)
            if prompt_match:
                panel["prompt"] = prompt_match.group(1).strip()

            # Extract ref
            ref_match = re.search(r'\*\*Ref:\*\*\s*(.+)', panel_body)
            if ref_match:
                refs = [r.strip() for r in ref_match.group(1).split(',')]
                panel["ref"] = refs

            # Extract dialogue
            dialogue_match = re.search(r'\*\*Dialogue:\*\*\s*(.+)', panel_body)
            if dialogue_match:
                raw = dialogue_match.group(1).strip()
                # Parse "Speaker: "text"" format
                d_match = re.match(r'(\w+):\s*"(.+)"', raw)
                if d_match:
                    panel["dialogue"] = [{"speaker": d_match.group(1), "text": d_match.group(2)}]

            # Extract bubble
            bubble_match = re.search(r'\*\*Bubble:\*\*\s*(.+)', panel_body)
            if bubble_match:
                panel["bubble"] = bubble_match.group(1).strip()

            panels.append(panel)

        pages.append({
            "page": page_num,
            "layout": layout,
            "panels": panels
        })

    return pages


def write_outputs(pages_dir, pages):
    """Write pages.json and per-page panels.json."""
    # Write pages.json
    pages_manifest = [{"page": p["page"], "layout": p["layout"]} for p in pages]
    pages_json_path = os.path.join(pages_dir, "pages.json")
    with open(pages_json_path, 'w') as f:
        json.dump(pages_manifest, f, indent=2)
    print(f"  pages.json ({len(pages)} pages)")

    # Write per-page panels.json
    total_panels = 0
    total_dialogue = 0
    for page in pages:
        page_dir = os.path.join(pages_dir, str(page["page"]))
        os.makedirs(page_dir, exist_ok=True)

        panels_json_path = os.path.join(page_dir, "panels.json")
        with open(panels_json_path, 'w') as f:
            json.dump(page["panels"], f, indent=2)

        panel_count = len(page["panels"])
        dialogue_count = sum(1 for p in page["panels"] if "dialogue" in p)
        total_panels += panel_count
        total_dialogue += dialogue_count
        print(f"  {page['page']}/panels.json ({panel_count} panels, {dialogue_count} with dialogue)")

    return total_panels, total_dialogue


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    pages_dir = sys.argv[1]
    staging_path = os.path.join(pages_dir, "staging.md")

    if not os.path.exists(staging_path):
        print(f"Error: {staging_path} not found")
        sys.exit(1)

    print(f"Parsing: {staging_path}")
    pages = parse_staging(staging_path)

    print(f"\nWriting outputs to {pages_dir}/")
    total_panels, total_dialogue = write_outputs(pages_dir, pages)

    print(f"\nDone: {len(pages)} pages, {total_panels} panels, {total_dialogue} with dialogue")


if __name__ == "__main__":
    main()
