#!/usr/bin/env python3
"""
Render a 2x supersampled (2400x1520 -> 1200x760) monochromatic animated social media GIF
for agent-wire in slow, readable "One Tile per Frame" mode (1 focused hero tile at a time,
held for 2.6 seconds per tile) with a clean centered H1 ("agent-wire").
"""

import os
import subprocess
from PIL import Image, ImageDraw, ImageFont

S = 2
W, H = 1200 * S, 760 * S
OUT_W, OUT_H = 1200, 760

FPS = 10
SECONDS_PER_TILE = 2.6
FRAMES_PER_TILE = int(FPS * SECONDS_PER_TILE)  # 26 frames = 2.6s per tile

HN_PATH = "/System/Library/Fonts/HelveticaNeue.ttc"
JB_BOLD = "/System/Library/Fonts/JetBrainsMonoNerdFontMono-Bold.ttf"
JB_REG = "/Users/lika/Library/Fonts/JetBrainsMonoNerdFontMono-Regular.ttf"
MENLO_PATH = "/System/Library/Fonts/Menlo.ttc"


def font_sans_bold(px):
    return ImageFont.truetype(HN_PATH, int(px * S), index=1)


def font_sans_med(px):
    return ImageFont.truetype(HN_PATH, int(px * S), index=10)


def font_mono_bold(px):
    path = JB_BOLD if os.path.exists(JB_BOLD) else MENLO_PATH
    return ImageFont.truetype(path, int(px * S))


def font_mono_reg(px):
    path = JB_REG if os.path.exists(JB_REG) else MENLO_PATH
    return ImageFont.truetype(path, int(px * S))


# Pure Monochromatic Ink-on-Paper Architectural Theme
THEME = {
    "bg": (246, 246, 244),          # Warm architectural paper (#F6F6F4)
    "dot": (218, 218, 214),         # Monochrome dot grid
    "ink": (17, 17, 19),            # Deep carbon ink (#111113)
    "ink_muted": (82, 82, 88),      # Neutral zinc-600
    "ink_soft": (138, 138, 146),    # Neutral zinc-400
    "surface": (255, 255, 255),     # Pure white surface
    "surface_alt": (238, 238, 235), # Subtle stone card tint (#EEEEEB)
    "surface_hi": (228, 228, 224),  # Highlighted monochrome card (#E4E4E0)
    "border": (17, 17, 19),         # Crisp black border (#111113)
    "border_subtle": (196, 196, 192),
}


def draw_shadow_card(draw, box, fill, border_color, shadow_color, radius=18):
    x0, y0, x1, y1 = [int(v * S) for v in box]
    r = int(radius * S)
    so = int(6.0 * S)
    bw = int(2.6 * S)
    draw.rounded_rectangle([x0 + so, y0 + so, x1 + so, y1 + so], radius=r, fill=shadow_color)
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill, outline=border_color, width=bw)


def draw_pill(draw, x, y, text, bg, fg, border_color, font=None, pad_x=12, pad_y=5, radius=8):
    if font is None:
        font = font_mono_bold(11.5)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    px, py = int(pad_x * S), int(pad_y * S)
    rx0, ry0 = int(x * S), int(y * S)
    rx1, ry1 = rx0 + tw + px * 2, ry0 + th + py * 2
    draw.rounded_rectangle(
        [rx0, ry0, rx1, ry1],
        radius=int(radius * S),
        fill=bg,
        outline=border_color,
        width=max(1, int(1.6 * S)),
    )
    draw.text((rx0 + px - bbox[0], ry0 + py - bbox[1]), text, font=font, fill=fg)
    return (rx1 - rx0) / S


def draw_right_pill(draw, right_x, y, text, bg, fg, border_color, font=None, pad_x=12, pad_y=5, radius=8):
    if font is None:
        font = font_mono_bold(11.5)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = (bbox[2] - bbox[0]) / S
    w = tw + pad_x * 2
    draw_pill(draw, right_x - w, y, text, bg, fg, border_color, font=font, pad_x=pad_x, pad_y=pad_y, radius=radius)
    return right_x - w


def draw_centered_text(draw, center_x, y, text, font, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    draw.text((int(center_x * S) - tw // 2, int(y * S)), text, font=font, fill=fill)


TILES = [
    {
        "step_pill": "TILE 1 OF 5  ·  PERSONA & SKILL.MD GUARDRAILS",
        "right_pill": "SHA-256 VERIFIED",
        "title": "1. Attach SKILL.md Rules & Safety Shields",
        "subtitle": "Compile markdown engineering standards, prompt-injection shields, and PII redaction into the system persona.",
        "rows": [
            ("taste-skill + agent-ready-standard", "SHA-256 digest indexed"),
            ("Runtime Prompt-Injection Shield", "Blocks override attempts"),
            ("PII & Secret Key Redaction", "Redacts email · SSN · sk-or-v1"),
        ],
        "cmd_label": "DISCOVERY ENDPOINT",
        "cmd": "GET /.well-known/agent-skills/index.json   ->   4 SKILL.md artifacts (v0.2.0)",
    },
    {
        "step_pill": "TILE 2 OF 5  ·  REMOTE MCP & A2A SUB-AGENTS",
        "right_pill": "JSON-RPC 2.0",
        "title": "2. Wire Remote MCP Tools & A2A Peer Handoffs",
        "subtitle": "Probe external HTTP/SSE Model Context Protocol servers and delegate subtasks to specialist peer agents.",
        "rows": [
            ("Stitch MCP (https://stitch.googleapis.com/mcp)", "3 UI generation tools"),
            ("GitHub Repository MCP (SSE stream)", "issues · diffs · comments"),
            ("Google A2A v1.0 Sub-Agent Delegation", "agt_design_critic -> agt_pr_triage"),
        ],
        "cmd_label": "LIVE MCP & A2A ENDPOINTS",
        "cmd": "POST /mcp (protocolVersion 2025-03-26)   ·   POST /api/a2a (method: tasks/send)",
    },
    {
        "step_pill": "TILE 3 OF 5  ·  OPENROUTER 2026 MODEL FAILOVER",
        "right_pill": "AUTO-FAILOVER",
        "title": "3. Route Across 2026 Frontier & Reasoning Models",
        "subtitle": "Define an ordered fallback chain with configurable reasoning effort and strict JSON output contracts.",
        "rows": [
            ("#1 anthropic/claude-sonnet-4", "Primary · 200k ctx · CoT"),
            ("#2 google/gemini-2.5-pro", "Failover #1 · 2M ctx · CoT"),
            ("#3 openai/o3-mini  &  deepseek/deepseek-r1", "Failover #2 · High Reasoning"),
        ],
        "cmd_label": "REASONING & STRUCTURED OUTPUT CONTRACT",
        "cmd": "{\"reasoningEffort\": \"medium\", \"responseFormat\": \"json_object\", \"maxTokens\": 2048}",
    },
    {
        "step_pill": "TILE 4 OF 5  ·  INSTANT MULTI-PROTOCOL ENDPOINT",
        "right_pill": "4 PROTOCOLS LIVE",
        "title": "4. Call Your Agent via cURL, SSE, MCP, A2A or OpenAI SDK",
        "subtitle": "Every deployed agent exposes a permanent REST/SSE endpoint, MCP tool, A2A card, and OpenAI v1 facade.",
        "rows": [
            ("POST /api/agents/agt_design_critic/run", "JSON + text/event-stream SSE"),
            ("POST /mcp   (tool: agent_design_critic)", "Streamable HTTP MCP Server"),
            ("POST /v1/chat/completions  &  /v1/responses", "model: \"agentwire/design-critic\""),
        ],
        "cmd_label": "DIRECT CURL STREAMING COMMAND",
        "cmd": "$ curl -N -X POST /api/agents/agt_design_critic/run -d '{\"input\":\"Audit UI\",\"stream\":true}'",
    },
    {
        "step_pill": "TILE 5 OF 5  ·  VERIFIED EVALS & LEVEL 5 AGENT-READY",
        "right_pill": "22/22 E2E PASS",
        "title": "5. Built-In Eval Suite, W3C Tracing & Level 5 Discovery",
        "subtitle": "Run deterministic capability & guardrail evals, track token/USD telemetry, and negotiate clean Markdown.",
        "rows": [
            ("Automated Agent Eval Suite (POST /eval)", "3/3 passed (100% pass rate)"),
            ("Playwright E2E Verification Suite", "22/22 tests passing (7.1s)"),
            ("Level 5 Agent-Ready Content Negotiation", "Accept: text/markdown + RFC 9727"),
        ],
        "cmd_label": "RFC 9727 & CONTENT-SIGNAL HEADERS",
        "cmd": "Link: </.well-known/api-catalog>; rel=\"api-catalog\"  ·  content-signal: ai-input=yes",
    },
]


def render():
    frames_dir = "/tmp/agent_wire_single_tile_frames"
    os.makedirs(frames_dir, exist_ok=True)
    for old in os.listdir(frames_dir):
        if old.endswith(".png"):
            os.remove(os.path.join(frames_dir, old))

    out_dir = "/Users/lika/labs/agent-wire/docs"
    os.makedirs(out_dir, exist_ok=True)

    total_tiles = len(TILES)
    total_frames = total_tiles * FRAMES_PER_TILE

    for idx in range(total_frames):
        tile_idx = idx // FRAMES_PER_TILE
        local_frame = idx % FRAMES_PER_TILE
        local_t = local_frame / float(max(1, FRAMES_PER_TILE - 1))
        tile = TILES[tile_idx]

        img = Image.new("RGB", (W, H), THEME["bg"])
        draw = ImageDraw.Draw(img)

        # 1. Monochrome Architectural Dot Grid
        step = int(24 * S)
        r_dot = int(1.2 * S)
        for gx in range(step, W, step):
            for gy in range(step, H, step):
                draw.ellipse([gx - r_dot, gy - r_dot, gx + r_dot, gy + r_dot], fill=THEME["dot"])

        # 2. Centered H1 Header (y = 24..116) — clean centered H1 + subtitle
        draw_centered_text(draw, 600, 22, "agent-wire", font_sans_bold(46), THEME["ink"])
        draw_centered_text(
            draw,
            600,
            80,
            "Turn prompts, remote MCP tools & SKILL.md rules into serverless agent endpoints",
            font_sans_med(17.5),
            THEME["ink_muted"],
        )

        # Step indicator pills centered at y = 116
        dot_gap = 28
        start_x = 600 - ((total_tiles - 1) * dot_gap) // 2
        for ti in range(total_tiles):
            cx = int((start_x + ti * dot_gap) * S)
            cy = int(122 * S)
            if ti == tile_idx:
                draw.rounded_rectangle(
                    [cx - int(10 * S), cy - int(4 * S), cx + int(10 * S), cy + int(4 * S)],
                    radius=int(4 * S),
                    fill=THEME["ink"],
                )
            else:
                r = int(3.5 * S)
                draw.ellipse(
                    [cx - r, cy - r, cx + r, cy + r],
                    fill=THEME["surface"],
                    outline=THEME["border"],
                    width=int(1.4 * S),
                )

        # 3. Single Focused Hero Tile (x = 110..1090, y = 146..706)
        card_box = (110, 146, 1090, 706)
        draw_shadow_card(
            draw,
            card_box,
            fill=THEME["surface"],
            border_color=THEME["border"],
            shadow_color=THEME["ink"],
            radius=18,
        )

        # Top bar inside Hero Tile
        draw_pill(
            draw,
            142,
            174,
            tile["step_pill"],
            THEME["ink"],
            THEME["surface"],
            THEME["border"],
            font_mono_bold(11.0),
            pad_x=12,
            pad_y=5,
        )
        draw_right_pill(
            draw,
            1058,
            174,
            tile["right_pill"],
            THEME["surface_alt"],
            THEME["ink"],
            THEME["border"],
            font_mono_bold(11.0),
            pad_x=12,
            pad_y=5,
        )

        # Hero Tile Title & Subtitle
        draw.text(
            (int(142 * S), int(222 * S)),
            tile["title"],
            font=font_sans_bold(29.0),
            fill=THEME["ink"],
        )
        draw.text(
            (int(142 * S), int(266 * S)),
            tile["subtitle"],
            font=font_sans_med(16.0),
            fill=THEME["ink_muted"],
        )

        # 3 Large Feature Rows (y = 308..518)
        active_row = min(2, int(local_t * 3.0))
        for ri, (rleft, rright) in enumerate(tile["rows"]):
            ry = 310 + ri * 68
            is_row_hi = ri == active_row
            draw.rounded_rectangle(
                [int(142 * S), int(ry * S), int(1058 * S), int((ry + 54) * S)],
                radius=int(11 * S),
                fill=THEME["ink"] if is_row_hi else THEME["surface_alt"],
                outline=THEME["border"],
                width=int((2.2 if is_row_hi else 1.5) * S),
            )
            draw.text(
                (int(164 * S), int((ry + 16) * S)),
                rleft,
                font=font_mono_bold(14.0),
                fill=THEME["surface"] if is_row_hi else THEME["ink"],
            )
            rf = font_mono_bold(13.0) if is_row_hi else font_mono_reg(13.0)
            rb = draw.textbbox((0, 0), rright, font=rf)
            rw = rb[2] - rb[0]
            draw.text(
                (int(1036 * S) - rw, int((ry + 17) * S)),
                rright,
                font=rf,
                fill=THEME["surface_alt"] if is_row_hi else THEME["ink_muted"],
            )

        # Bottom Live Command / Telemetry Box inside Hero Tile (y = 532..676)
        fbox = (142, 532, 1058, 676)
        draw.rounded_rectangle(
            [int(v * S) for v in fbox],
            radius=int(12 * S),
            fill=THEME["surface_alt"],
            outline=THEME["border"],
            width=int(1.8 * S),
        )
        draw.text(
            (int(164 * S), int(548 * S)),
            tile["cmd_label"],
            font=font_mono_bold(10.5),
            fill=THEME["ink_muted"],
        )
        slide_label = f"SLIDE {tile_idx + 1} / {total_tiles}"
        sb = draw.textbbox((0, 0), slide_label, font=font_mono_bold(10.5))
        sw = sb[2] - sb[0]
        draw.text(
            (int(1036 * S) - sw, int(548 * S)),
            slide_label,
            font=font_mono_bold(10.5),
            fill=THEME["ink"],
        )

        draw.text(
            (int(164 * S), int(580 * S)),
            tile["cmd"],
            font=font_mono_bold(13.5),
            fill=THEME["ink"],
        )

        # Smooth Hold Progress Bar at bottom of command box (y = 642..654)
        bar_x0, bar_x1 = 164, 1036
        bar_y = 642
        draw.rounded_rectangle(
            [int(bar_x0 * S), int(bar_y * S), int(bar_x1 * S), int((bar_y + 10) * S)],
            radius=int(5 * S),
            fill=(214, 214, 208),
        )
        pw = max(24, int((bar_x1 - bar_x0) * (0.12 + 0.88 * local_t)))
        draw.rounded_rectangle(
            [int(bar_x0 * S), int(bar_y * S), int((bar_x0 + pw) * S), int((bar_y + 10) * S)],
            radius=int(5 * S),
            fill=THEME["ink"],
        )

        out_frame = img.resize((OUT_W, OUT_H), Image.Resampling.LANCZOS)
        out_frame.save(f"{frames_dir}/frame_{idx:03d}.png")

    # Save static previews of Tile 1 and Tile 4
    preview_1 = os.path.join(out_dir, "agent-wire-social-preview.png")
    preview_4 = os.path.join(out_dir, "agent-wire-social-preview-28.png")
    Image.open(f"{frames_dir}/frame_012.png").save(preview_1)
    Image.open(f"{frames_dir}/frame_{3 * FRAMES_PER_TILE + 12:03d}.png").save(preview_4)

    gif_path = os.path.join(out_dir, "agent-wire-social.gif")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-framerate",
            str(FPS),
            "-i",
            f"{frames_dir}/frame_%03d.png",
            "-vf",
            "split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=full[p];[s1][p]paletteuse=dither=sierra2_4a",
            "-loop",
            "0",
            gif_path,
        ],
        check=True,
    )
    print(f"Saved slow single-tile monochromatic GIF: {gif_path} ({total_frames} frames @ {FPS}fps = {total_frames/FPS:.1f}s)")


if __name__ == "__main__":
    render()
