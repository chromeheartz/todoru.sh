#!/usr/bin/env python3
"""Build the todoru.sh macOS app icon.

ASCII "todoru" (figlet 'small') over a dark terminal squircle, with traffic
lights and a `❯ todoru.sh` prompt. Only depends on Pillow — the ASCII art is
baked in as a constant so pyfiglet isn't needed at build time.
"""
import os
from PIL import Image, ImageDraw, ImageFont

S = 1024
OUT = "build/icon_1024.png"
GREEN = (39, 201, 63, 255)
FG = (230, 230, 235, 255)
BG_TOP = (32, 34, 42)
BG_BOT = (18, 19, 24)
MENLO = "/System/Library/Fonts/Menlo.ttc"  # 0=Regular, 1=Bold

# figlet_format("todoru", font="small")
TODORU_ASCII = [
    " _           _              ",
    "| |_ ___  __| |___ _ _ _  _ ",
    "|  _/ _ \\/ _` / _ \\ '_| || |",
    " \\__\\___/\\__,_\\___/_|  \\_,_|",
]


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def vgradient(size, top, bottom):
    g = Image.new("RGB", (1, size))
    for y in range(size):
        t = y / (size - 1)
        g.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return g.resize((size, size))


def main():
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    box = int(S * 0.84)
    off = (S - box) // 2
    radius = int(box * 0.225)

    bg = vgradient(box, BG_TOP, BG_BOT).convert("RGBA")
    canvas.paste(bg, (off, off), rounded_mask(box, radius))
    d = ImageDraw.Draw(canvas)

    # subtle inner border
    d.rounded_rectangle([off, off, off + box - 1, off + box - 1],
                        radius=radius, outline=(255, 255, 255, 28), width=3)

    # traffic-light dots
    dy = off + int(box * 0.11)
    dx = off + int(box * 0.12)
    dr = int(box * 0.028)
    gap = int(dr * 3.1)
    for i, col in enumerate([(255, 95, 87), (254, 188, 46), (39, 201, 63)]):
        cx = dx + i * gap
        d.ellipse([cx - dr, dy - dr, cx + dr, dy + dr], fill=col + (255,))

    # ASCII "todoru"
    maxlen = max(len(l) for l in TODORU_ASCII)
    target_w = box * 0.7
    size = 10
    f = ImageFont.truetype(MENLO, size, index=1)
    size = int(size * target_w / d.textlength("x" * maxlen, font=f))
    f = ImageFont.truetype(MENLO, size, index=1)
    line_h = int(size * 1.05)
    total_h = line_h * len(TODORU_ASCII)
    x0 = off + (box - d.textlength("x" * maxlen, font=f)) / 2
    y0 = off + int(box * 0.30)
    for i, ln in enumerate(TODORU_ASCII):
        d.text((x0, y0 + i * line_h), ln, font=f, fill=GREEN)

    # ❯ todoru.sh prompt
    py = y0 + total_h + int(box * 0.13)
    ch = int(box * 0.045)
    lw = max(5, int(box * 0.016))
    px0 = off + int(box * 0.20)
    d.line([(px0, py - ch), (px0 + ch, py), (px0, py + ch)], fill=GREEN, width=lw, joint="curve")
    pf = ImageFont.truetype(MENLO, int(box * 0.075), index=1)
    d.text((px0 + ch + int(box * 0.05), py), "todoru.sh", font=pf, fill=FG, anchor="lm")

    os.makedirs("build", exist_ok=True)
    canvas.save(OUT)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
