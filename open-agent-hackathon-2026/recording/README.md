# Local recording workspace

Keep raw screen captures, voiceover, and the assembled MP4 here. The final `*.mp4` files are ignored by Git.

Suggested final path:

```text
recording/zetaris-opportunity-radar.mp4
```

Before upload, run from `open-agent-hackathon-2026/`:

```bash
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of json recording/zetaris-opportunity-radar.mp4
```

The Dropbox upload and the final recording are operator actions for PW.
