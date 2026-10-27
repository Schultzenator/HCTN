#!/usr/bin/env python3
"""Capture real offline commands, render captioned terminal pages, encode a 90s MP4.
Requires Python Pillow, Node/npm and ffmpeg. No network/model calls in demo.
Frames go to /tmp, only logs and the final MP4 stay in the project.
"""
from pathlib import Path
import os, subprocess, textwrap, tempfile
from PIL import Image, ImageDraw, ImageFont

PROJECT = Path(__file__).resolve().parents[1]
OUT = PROJECT / 'submission'
FFMPEG = os.environ.get('FFMPEG', '/home/schultze/Factory/ffmpeg-7.0.2-amd64-static/ffmpeg')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

def capture(command, filename):
    result = subprocess.run(command, cwd=PROJECT, text=True, capture_output=True, check=True)
    (OUT / filename).write_text(result.stdout.rstrip() + '\n')
    return result.stdout

demo = capture(['npm', 'run', 'demo'], 'demo-output.txt')
design = capture(['node', 'dist/cli.js', '--profile', 'design'], 'design-output.txt')
tests = capture(['npm', 'test'], 'test-output.txt')
report = demo[demo.index('# Opportunity Radar'):]
header, rest = report.split('## 1.', 1)
blocks = ['## 1.' + rest.split('## 2.')[0]]
for n in range(2, 6):
    marker = f'## {n}.'
    content = report.split(marker, 1)[1]
    if n < 5:
        content = content.split(f'## {n+1}.', 1)[0]
    blocks.append(marker + content)
design_first = design[design.index('## 1.'):].split('## 2.')[0]
scenes = [
    ('Opportunity Radar', 'Developers compare fragmented calendars, bounty boards and GitHub issues.',
     '$ npm run demo\n\n' + '\n'.join(demo.strip().splitlines()[:12]), 9),
    ('8 records, 6 unique opportunities, 5 recommendations', 'The evidence gate excludes the unlinked rumor before ranking.', header.strip(), 10),
    ('One opportunity, several source attributions', 'Shared canonical evidence merges duplicate records while keeping provenance.', blocks[0], 12),
    ('A connector bounty across two sources', 'Board and GitHub records share one issue URL and retain both source labels.', blocks[1], 10),
    ('The remaining ranked brief', 'Every recommendation includes an explanation and evidence.', blocks[2] + '\n' + blocks[3], 12),
    ('The full report includes five recommendations', 'All listings are synthetic. Source links do not verify rewards or eligibility.', blocks[4], 7),
    ('A different profile changes the ranking', 'The design profile uses the same deterministic mock, with no external LLM.', '$ node dist/cli.js --profile "design"\n\n' + design_first, 9),
    ('20 tests pass', 'Coverage includes deduplication, evidence gating and mocked HTTP contracts.', '$ npm test\n\n' + '\n'.join(tests.strip().splitlines()[-10:]), 9),
    ('Sponsor integration status', 'Piotr Szutt / Agent Foundry. Local kit prepared for manual submission.',
     'Meterless / NVIDIA Nemotron\n  OpenAI-compatible adapter implemented and tested with fake HTTP.\n  No verified sponsor endpoint execution.\n  Remaining: provision URL, API key and model; validate a real run.\n\nZetaris\n  Not implemented. SourceProvider is an extension point only.\n\nCursor\n  Not used.\n\nPre-existing implementation: 21 October 2026, commit 77a0e64.\nNew work in this kit: demo media and submission documentation.', 12),
]
assert sum(s[3] for s in scenes) == 90
fonts = {n: ImageFont.truetype(p, size) for n, p, size in [('title',SANS,42),('caption',SANS,30),('terminal',FONT,25),('small',SANS,23)]}
with tempfile.TemporaryDirectory(prefix='radar-frames-', dir='/tmp') as tmp:
    frame_paths = []
    for index, (title, caption, terminal, duration) in enumerate(scenes):
        im = Image.new('RGB', (1920,1080), '#101c2d')
        d = ImageDraw.Draw(im)
        d.text((72,44), title, font=fonts['title'], fill='#72e8bd')
        d.text((72,110), 'OFFLINE DEMO / SYNTHETIC FIXTURES / DETERMINISTIC MOCK', font=fonts['small'], fill='#a9b9c9')
        d.rectangle((60,166,1860,876), fill='#08111e')
        lines = []
        for line in terminal.strip().splitlines():
            lines.extend(textwrap.wrap(line, width=112, replace_whitespace=False, drop_whitespace=False) or [''])
        if len(lines) > 24:
            raise ValueError(f'Scene {index+1} exceeds terminal: {len(lines)} lines')
        for row, line in enumerate(lines):
            color = '#72e8bd' if line.startswith(('$', 'Pipeline:', '##', '# pass', '# fail')) else '#edf3f8'
            d.text((88,188+row*28), line, font=fonts['terminal'], fill=color)
        for row, line in enumerate(textwrap.wrap(caption, width=101)):
            d.text((72,912+row*40), line, font=fonts['caption'], fill='#edf3f8')
        d.text((72,1024), f'Opportunity Radar   /   {index+1:02d} of {len(scenes):02d}', font=fonts['small'], fill='#a9b9c9')
        path = Path(tmp) / f'{index:02d}.png'
        im.save(path)
        frame_paths.append(path)
    frame_number = 0
    for path, scene in zip(frame_paths, scenes):
        for _ in range(scene[3] * 30):
            (Path(tmp) / f'frame-{frame_number:05d}.png').symlink_to(path)
            frame_number += 1
    subprocess.run([FFMPEG, '-y', '-framerate', '30', '-i', str(Path(tmp) / 'frame-%05d.png'),
        '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
        '-t', '90', '-r', '30', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
        '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart',
        str(PROJECT / 'opportunity-radar-demo.mp4')], check=True)
print('Created 90-second captioned demo (silent audio track).')
