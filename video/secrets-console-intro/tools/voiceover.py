#!/usr/bin/env python3
from __future__ import annotations
"""Generate one voice-over clip per sentence of script.json and write timing.json.

Provider:
  - gemini (Gemini Flash TTS) when GEMINI_API_KEY is set, or the key is stored in
    ~/.config/gemini/tts.key (one line). The key is sent in a request header only; it is
    never printed, logged, or written to the project.
  - kokoro (local, `hyperframes tts`) otherwise, so timing can be built without a key.

Force one with --provider gemini|kokoro. Clips are cached by provider+voice+text, so re-running
only generates changed sentences.
"""
import argparse
import base64
import hashlib
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLIPS = ROOT / 'assets' / 'vo'
GEMINI_MODEL = os.environ.get('GEMINI_TTS_MODEL', 'gemini-2.5-flash-preview-tts')
GEMINI_VOICE = os.environ.get('GEMINI_TTS_VOICE', 'Charon')
KOKORO_VOICE = os.environ.get('KOKORO_VOICE', 'am_michael')
# Style direction for Gemini; the model reads it as an instruction, not as speech.
STYLE = (
    'Read this as a calm, confident product-launch narrator for an internal developer tool. '
    'Warm, clear, medium pace, no hype:'
)


def gemini_key() -> str | None:
    key = os.environ.get('GEMINI_API_KEY')
    if key:
        return key.strip()
    f = Path.home() / '.config' / 'gemini' / 'tts.key'
    return f.read_text().strip() if f.exists() else None


def gemini_tts(text: str, out: Path, key: str) -> None:
    body = {
        'contents': [{'parts': [{'text': f'{STYLE} {text}'}]}],
        'generationConfig': {
            'responseModalities': ['AUDIO'],
            'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': GEMINI_VOICE}}},
        },
    }
    req = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent',
        data=json.dumps(body).encode(),
        headers={'Content-Type': 'application/json', 'x-goog-api-key': key},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        # The error body never contains the key; show status and message only.
        detail = e.read().decode(errors='replace')[:400]
        sys.exit(f'Gemini TTS failed: HTTP {e.code}: {detail}')
    part = data['candidates'][0]['content']['parts'][0]['inlineData']
    pcm = base64.b64decode(part['data'])  # 24 kHz, 16-bit, mono PCM
    with wave.open(str(out), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(pcm)


def kokoro_tts(text: str, out: Path) -> None:
    subprocess.run(
        ['npx', '-y', 'hyperframes@0.7.99', 'tts', text, '--voice', KOKORO_VOICE, '--output', str(out)],
        check=True,
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
    )


def duration(path: Path) -> float:
    out = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return round(float(out.stdout.strip()), 3)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--provider', choices=['gemini', 'kokoro'])
    args = ap.parse_args()
    key = gemini_key()
    provider = args.provider or ('gemini' if key else 'kokoro')
    if provider == 'gemini' and not key:
        sys.exit('No Gemini key: set GEMINI_API_KEY or create ~/.config/gemini/tts.key')
    voice = GEMINI_VOICE if provider == 'gemini' else KOKORO_VOICE

    CLIPS.mkdir(parents=True, exist_ok=True)
    script = json.loads((ROOT / 'script.json').read_text())
    timing = {'provider': provider, 'voice': voice, 'scenes': []}
    for scene in script['scenes']:
        clips = []
        for s in scene['sentences']:
            h = hashlib.sha1(f'{provider}|{voice}|{GEMINI_MODEL}|{s["en"]}'.encode()).hexdigest()[:12]
            out = CLIPS / f'{provider}-{h}.wav'
            if not out.exists():
                print(f'[{provider}] {scene["id"]}: {s["en"][:60]}')
                if provider == 'gemini':
                    gemini_tts(s['en'], out, key)
                else:
                    kokoro_tts(s['en'], out)
            clips.append({'file': f'assets/vo/{out.name}', 'duration': duration(out)})
        timing['scenes'].append({'id': scene['id'], 'clips': clips})
    (ROOT / 'timing.json').write_text(json.dumps(timing, indent=2))
    total = sum(c['duration'] for sc in timing['scenes'] for c in sc['clips'])
    print(f'provider={provider} voice={voice} speech={total:.1f}s -> timing.json')


if __name__ == '__main__':
    main()
