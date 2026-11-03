#!/usr/bin/env python3
"""Render captioned terminal pages from real CLI output and encode a ~92s MP4."""
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
(OUT / 'demo-output.json').write_text(json.dumps(demo, indent=2))
(OUT / 'test-output.txt').write_text(tests)

plan = demo['plan']
steps_txt = chr(10).join(f"{s['time']}  [{s['owner']}] {s['task']}" + chr(10) + "        why: " + s['why'] for s in plan['steps'])
trace_txt = chr(10).join(f"{t['stage']:14} {t['model']:18} {t['status']:6} {t['note']}" for t in demo['trace'])
tests_tail = chr(10).join(tests.strip().splitlines()[-8:])
REPO = 'github.com/Schultzenator/HCTN/tree/main/meta-ai-hackathon-2026'
NL = chr(10)
scenes = [
    ('Household Ops Agent', 'Meta Global AI Developer Hackathon - Indie Developer Track, "Build for Your World".',
     'Team: Agent Foundry (Piotr Szutt)' + NL + 'Models: SAM 3.1 + Muse Spark 1.3 + Muse Image 1.0' + NL + 'TypeScript / Node ESM, MIT license', 10),
    ('The problem: evenings are a decision problem', 'Dinner, a kitchen reset and tomorrow - small decisions, expensive when tired.',
     'goal: "dinner and a quick kitchen reset after work"' + NL + 'people: 2' + NL + 'constraints: ["no extra shopping", "90 minutes max"]' + NL + 'inventory: ["pasta", "vegetables", "tomato sauce"]', 12),
    ('npm run demo - a plan you can follow', 'Muse Spark turns goal, constraints and inventory into three owned steps with reasons.',
     plan['title'] + NL + plan['summary'] + NL + NL + steps_txt, 16),
    ('Grounded perception with SAM 3.1', 'With a photo, SAM 3.1 detects household objects and passes them into planning.',
     'stage: perception   model: sam-3.1' + NL + 'input: kitchen photo (input_image)' + NL + 'output: [{ label: "pantry item", confidence: 0.97, box: [...] }]' + NL + 'this run: "skipped: no photo" (honest trace, no fake detections)', 12),
    ('Execution trace - every model stage visible', 'Each stage reports the model and whether it ran live or in mock mode.',
     trace_txt + NL + NL + 'mock output is labeled mock - never fakes a live API call', 14),
    ('One API key from live mode', 'OpenAI-compatible Meta Model API endpoints with a deterministic mock fallback.',
     'HttpMetaClient:' + NL + '  POST {META_API_BASE}/responses         Bearer META_API_KEY' + NL + '  POST {META_API_BASE}/images/generations (muse-image-1.0)' + NL + NL + '.env.example: META_API_KEY= / META_API_BASE=' + NL + 'same interface in mock and live mode', 10),
    ('3 tests pass', 'node:test covers the photo-assisted path and the no-photo fallback.',
     '$ npm test' + NL + NL + tests_tail, 8),
    ('Try it', 'Public repository - submission by Piotr Szutt, Agent Foundry.',
     REPO + NL + NL + 'npm install && npm test && npm run demo', 10),
]
total = sum(s[3] for s in scenes)
assert total == 92, total
fonts = {n: ImageFont.truetype(p, size) for n, p, size in [('title', SANS, 42), ('caption', SANS, 30), ('terminal', FONT, 25), ('small', SANS, 23)]}
with tempfile.TemporaryDirectory(prefix='meta-frames-', dir='/tmp') as tmp:
    frame_paths = []
    for index, (title, caption, terminal, duration) in enumerate(scenes):
        im = Image.new('RGB', (1920, 1080), '#101c2d')
        d = ImageDraw.Draw(im)
        d.text((72, 44), title, font=fonts['title'], fill='#72e8bd')
        d.text((72, 110), caption, font=fonts['caption'], fill='#c9d7e2')
        y = 210
        for line in terminal.splitlines():
            d.text((72, y), line, font=fonts['terminal'], fill='#e8eef2')
            y += 44
        d.text((72, 1010), 'Household Ops Agent - offline demo, mock mode clearly labeled', font=fonts['small'], fill='#5d7285')
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
        str(OUT / 'household-ops-agent-demo.mp4')], check=True)
print('Created', total, 'second captioned demo.')
