#!/usr/bin/env python3
"""v3: v2 readability + burned-in English subtitles in a bottom band."""
from pathlib import Path
import os, subprocess, json, tempfile
from PIL import Image, ImageDraw, ImageFont

PROJECT = Path(__file__).resolve().parents[1]
OUT = PROJECT / 'submission'
FFMPEG = os.environ.get('FFMPEG', '/home/schultze/Factory/ffmpeg-7.0.2-amd64-static/ffmpeg')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

def sh(cmd):
    r = subprocess.run(cmd, cwd=PROJECT, text=True, capture_output=True, check=True)
    return r.stdout

demo_raw = sh(['npm', 'run', 'demo'])
demo = json.loads(demo_raw[demo_raw.index('{'):])
tests = sh(['npm', 'test'])

plan = demo['plan']
steps_txt = chr(10).join(f"{s['time']}  [{s['owner']}] {s['task']}" + chr(10) + "        why: " + s['why'] for s in plan['steps'])
trace_txt = chr(10).join(f"{t['stage']:14} {t['model']:18} {t['status']:6} {t['note']}" for t in demo['trace'])
tests_tail = chr(10).join(tests.strip().splitlines()[-8:])
REPO = 'github.com/Schultzenator/HCTN/tree/main/meta-ai-hackathon-2026'
NL = chr(10)

subtitles = [
    'Household Ops Agent - demo for the Meta Global AI Developer Hackathon, Indie Developer Track: Build for Your World.',
    'The problem: evenings are a decision problem. Goal: dinner and a quick kitchen reset after work.',
    'npm run demo - Muse Spark 1.3 turns the goal, constraints and inventory into three owned steps with reasons.',
    'Grounded perception with SAM 3.1: with a photo it detects household objects. This run skips it honestly and says so.',
    'Execution trace: every model stage visible. Mock output is always labeled mock - never fakes a live API call.',
    'One API key switches to live mode via OpenAI-compatible Meta Model API endpoints, with a deterministic mock fallback.',
    'Three tests pass on node:test - the photo-assisted path and the no-photo fallback.',
    'Try it: public repository on GitHub - npm install && npm test && npm run demo.',
]

scenes = [
    ('Household Ops Agent', 'Meta Global AI Developer Hackathon - Indie Developer Track, "Build for Your World".',
     'Team: Agent Foundry (Piotr Szutt)' + NL + 'Models: SAM 3.1 + Muse Spark 1.3 + Muse Image 1.0' + NL + 'TypeScript / Node ESM, MIT license', 10),
    ('The problem: evenings are a decision problem', 'Dinner, a kitchen reset and tomorrow - small decisions, expensive when tired.',
     'goal: "dinner and a quick kitchen reset after work"' + NL + 'people: 2' + NL + 'constraints: ["no extra shopping", "90 minutes max"]' + NL + 'inventory: ["pasta", "vegetables", "tomato sauce"]', 12),
    ('npm run demo - a plan you can follow', 'Muse Spark turns goal, constraints and inventory into three owned steps with reasons.',
     plan['title'] + NL + plan['summary'] + NL + NL + steps_txt, 16),
    ('Grounded perception with SAM 3.1', 'With a photo, SAM 3.1 detects household objects and passes them into planning.',
     'stage: perception   model: sam-3.1' + NL + 'input: kitchen photo (input_image)' + NL + 'output: [{ label: "pantry item", confidence: 0.97 }]' + NL + 'this run: "skipped: no photo" (honest trace)', 12),
    ('Execution trace - every model stage visible', 'Each stage reports the model and whether it ran live or in mock mode.',
     trace_txt + NL + NL + 'mock output is labeled mock - never fakes a live API call', 14),
    ('One API key from live mode', 'OpenAI-compatible Meta Model API endpoints with a deterministic mock fallback.',
     'HttpMetaClient:' + NL + '  POST {META_API_BASE}/responses          Bearer META_API_KEY' + NL + '  POST {META_API_BASE}/images/generations (muse-image-1.0)' + NL + '.env.example: META_API_KEY= / META_API_BASE=', 10),
    ('3 tests pass', 'node:test covers the photo-assisted path and the no-photo fallback.',
     '$ npm test' + NL + NL + tests_tail, 8),
    ('Try it', 'Public repository - submission by Piotr Szutt, Agent Foundry.',
     REPO + NL + NL + 'npm install && npm test && npm run demo', 10),
]
assert len(subtitles) == len(scenes)
total = sum(s[3] for s in scenes)
assert total == 92, total

fonts = {n: ImageFont.truetype(p, size) for n, p, size in [('title', SANS, 58), ('caption', SANS, 38), ('terminal', FONT, 36), ('small', SANS, 28)]}

def wrap(d, text, font, max_w):
    lines = []
    for para in text.split(NL):
        if not para:
            lines.append('')
            continue
        cur = ''
        for word in para.split(' '):
            cand = (cur + ' ' + word).strip()
            if d.textlength(cand, font=font) <= max_w or not cur:
                cur = cand
            else:
                lines.append(cur)
                cur = '    ' + word
        lines.append(cur)
    return lines

def sub_wrap(d, text, size, max_w, max_lines):
    f = None
    lines = []
    for sz in (size, size - 4, size - 8):
        f = ImageFont.truetype(SANS, sz)
        lines = []
        cur = ''
        for word in text.split(' '):
            cand = (cur + ' ' + word).strip()
            if d.textlength(cand, font=f) <= max_w or not cur:
                cur = cand
            else:
                lines.append(cur)
                cur = word
        lines.append(cur)
        if len(lines) <= max_lines:
            return f, lines
    return f, lines

BG = (16, 30, 48)
BAND = (11, 21, 36)
BAND_TOP = 970
with tempfile.TemporaryDirectory(prefix='meta-frames3-', dir='/tmp') as tmp:
    frame_paths = []
    for index, (title, caption, terminal, duration) in enumerate(scenes):
        im = Image.new('RGB', (1920, 1080), BG)
        d = ImageDraw.Draw(im)
        ts = fonts['title']
        while d.textlength(title, font=ts) > 1760:
            ts = ts.font_variant(size=ts.size - 4)
        d.text((80, 52), title, font=ts, fill='#8effd2')
        d.text((80, 142), caption, font=fonts['caption'], fill='#dce8f2')
        y = 260
        for line in wrap(d, terminal, fonts['terminal'], 1790):
            if y > 920:
                break
            d.text((80, y), line, font=fonts['terminal'], fill='#ffffff')
            y += 52
        d.rectangle([0, BAND_TOP, 1920, 1080], fill=BAND)
        d.rectangle([0, BAND_TOP, 1920, BAND_TOP + 3], fill=(48, 74, 104))
        sf, slines = sub_wrap(d, subtitles[index], 42, 1700, 2)
        if len(slines) == 1:
            w = d.textlength(slines[0], font=sf)
            d.text(((1920 - w) // 2, 1000), slines[0], font=sf, fill='#ffffff', stroke_width=5, stroke_fill=(0, 0, 0))
        else:
            for i, ln in enumerate(slines[:2]):
                w = d.textlength(ln, font=sf)
                d.text(((1920 - w) // 2, 976 + i * 50), ln, font=sf, fill='#ffffff', stroke_width=5, stroke_fill=(0, 0, 0))
        path = Path(tmp) / ('scene-' + str(index) + '.png')
        im.save(path)
        frame_paths.append(path)
    n = 0
    for path, scene in zip(frame_paths, scenes):
        for _ in range(scene[3] * 30):
            (Path(tmp) / ('frame-' + format(n, '05d') + '.png')).symlink_to(path)
            n += 1
    subprocess.run([FFMPEG, '-y', '-framerate', '30', '-i', str(Path(tmp) / 'frame-%05d.png'),
        '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
        '-t', str(total), '-r', '30', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
        '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart',
        str(OUT / 'household-ops-agent-demo-v3.mp4')], check=True)
print('Created v3 with burned-in subtitles, ' + str(total) + 's.')
