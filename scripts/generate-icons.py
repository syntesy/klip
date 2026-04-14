#!/usr/bin/env python3
"""
Generate Klip app icons for PWA and iOS.
Background: #0B1628, wordmark "klip" — k/i/p in white, l in #4A9EFF
"""

import os
import math
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "../apps/web/public/icons")
os.makedirs(OUTPUT_DIR, exist_ok=True)

SIZES = [120, 152, 167, 180, 192, 512, 1024]

BG_COLOR = (11, 22, 40)       # #0B1628
WHITE    = (255, 255, 255)     # k, i, p
BLUE     = (74, 158, 255)      # #4A9EFF — l

def make_icon(size: int):
    scale = size / 512  # design is in 512px space

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded rect background — border-radius ~22.5% of size (iOS style)
    radius = round(size * 0.225)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BG_COLOR)

    # Font size: ~38% of icon size
    font_size = max(12, round(size * 0.38))

    font = None
    # Try to find a bold/extrabold font on macOS
    font_candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/SFNSDisplay.ttf",
        "/System/Library/Fonts/SFNSText.ttf",
        "/System/Library/Fonts/SFNS.ttf",
    ]
    for path in font_candidates:
        if os.path.exists(path):
            try:
                font = ImageFont.truetype(path, font_size)
                break
            except Exception:
                continue

    if font is None:
        font = ImageFont.load_default()
        print(f"  [warn] Using default font for size {size}")

    word = "klip"
    colors = [WHITE, BLUE, WHITE, WHITE]  # k=white, l=blue, i=white, p=white

    # Measure each character individually
    char_widths = []
    char_heights = []
    for ch in word:
        bb = font.getbbox(ch)
        char_widths.append(bb[2] - bb[0])
        char_heights.append(bb[3] - bb[1])

    # Tighten letter spacing slightly
    spacing = round(size * -0.005)
    total_width = sum(char_widths) + spacing * (len(word) - 1)
    max_height = max(char_heights)

    x = (size - total_width) // 2
    y = (size - max_height) // 2

    for i, (ch, color) in enumerate(zip(word, colors)):
        bb = font.getbbox(ch)
        # Align baselines: offset by top of bounding box
        draw.text((x - bb[0], y - bb[1]), ch, font=font, fill=color)
        x += char_widths[i] + spacing

    img.save(os.path.join(OUTPUT_DIR, f"icon-{size}.png"), "PNG")
    print(f"  ✓ icon-{size}.png")


print(f"Generating icons in: {os.path.abspath(OUTPUT_DIR)}\n")
for size in SIZES:
    make_icon(size)

print("\nDone.")
