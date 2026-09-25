#!/usr/bin/env python3
"""Build index.html from script.json + timing.json (run tools/voiceover.py first).

Every scene lasts as long as its narration plus a short lead-in and tail, so swapping the voice
(Kokoro placeholder -> Gemini) only needs: voiceover.py, then build.py.
"""
import html
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEAD, GAP, TAIL = 0.55, 0.3, 0.75
W, H = 1920, 1080

# Screenshots come from the app's docs, so the video always shows the current UI.
SHOTS_DIR = ROOT / 'assets' / 'shots'
SHOTS_DIR.mkdir(parents=True, exist_ok=True)
for png in (ROOT.parent.parent / 'docs' / 'screenshots').glob('*.png'):
    shutil.copy2(png, SHOTS_DIR / png.name)

script = json.loads((ROOT / 'script.json').read_text())
timing = {s['id']: s for s in json.loads((ROOT / 'timing.json').read_text())['scenes']}

# ---- timing -------------------------------------------------------------------------------
scenes = []
t = 0.0
for sc in script['scenes']:
    clips = timing[sc['id']]['clips']
    start = t
    cur = start + LEAD
    sentences = []
    for s, c in zip(sc['sentences'], clips):
        sentences.append({**s, 'start': round(cur, 3), 'dur': c['duration'], 'file': c['file']})
        cur += c['duration'] + GAP
    end = cur - GAP + TAIL
    scenes.append({**sc, 'start': round(start, 3), 'end': round(end, 3), 'sentences': sentences})
    t = end
TOTAL = round(t, 3)

# ---- screenshot scenes: which image, where to zoom, what to highlight -----------------------
# Coordinates are CSS px of the 1440-wide screenshot. `at` = (sentence index, seconds after it).
SHOTS = {
    'list': [
        {'img': 'list', 'from': (0, 0), 'zoom': None, 'callouts': [
            {'box': (136, 295, 386, 47), 'label': 'Search by name', 'at': (0, 1.2)},
            {'box': (1126, 295, 176, 45), 'label': 'Cards / Table', 'at': (1, 0.2)},
        ]},
        {'img': 'list-table', 'from': (1, 1.2), 'zoom': None, 'callouts': []},
    ],
    'quickview': [
        {'img': 'list', 'from': (0, 0), 'zoom': (230, 546, 1.35), 'callouts': [
            {'box': (161, 524, 143, 44), 'label': 'View secret', 'at': (0, 0.4)},
        ]},
        {'img': 'quick-view', 'from': (0, 1.7), 'zoom': (720, 420, 1.12), 'callouts': [
            {'box': (344, 296, 368, 30), 'label': 'Recorded in CloudTrail', 'at': (1, 0.6)},
            {'box': (344, 330, 756, 32), 'label': 'Hides in 30s', 'at': (1, 3.2), 'below': True},
        ]},
    ],
    'create': [
        {'img': 'create', 'from': (0, 0), 'zoom': (720, 420, 1.1), 'callouts': [
            {'box': (348, 275, 743, 101), 'label': 'Templates', 'at': (0, 0.8)},
            {'box': (348, 476, 708, 48), 'label': 'Masked', 'at': (1, 1.0)},
        ]},
    ],
    'edit': [
        {'img': 'value-editing', 'from': (0, 0), 'zoom': (700, 600, 1.12), 'callouts': [
            {'box': (160, 603, 1036, 48), 'label': 'Changed', 'at': (0, 1.6)},
            {'box': (160, 800, 1036, 48), 'label': 'New', 'at': (0, 2.4)},
        ]},
        {'img': 'save-confirm', 'from': (1, 0), 'zoom': (720, 450, 1.18), 'callouts': [
            {'box': (552, 339, 335, 207), 'label': 'Key names only', 'at': (1, 0.9)},
        ]},
    ],
    'versions': [
        {'img': 'versions', 'from': (0, 0), 'zoom': (1000, 600, 1.2), 'callouts': [
            {'box': (1120, 552, 160, 90), 'label': 'Make current', 'at': (1, 1.8)},
            {'box': (916, 552, 196, 90), 'label': 'Compare keys', 'at': (1, 0.4)},
        ]},
    ],
    'danger': [
        {'img': 'danger', 'from': (0, 0), 'zoom': (560, 580, 1.2), 'callouts': [
            {'box': (165, 647, 467, 48), 'label': 'Type the name', 'at': (0, 1.8)},
            {'box': (165, 510, 750, 101), 'label': '30-day recovery', 'at': (1, 0.2)},
        ]},
    ],
}


def at(scene, spec):
    i, off = spec
    return round(scene['sentences'][i]['start'] + off, 3)


def esc(s):
    return html.escape(s, quote=True)


body, js = [], []
track = {'bg': 0, 'scene': 1, 'shot': 2, 'caption': 5, 'audio': 8}


def clip(el_id, start, dur, trk, inner, cls='', style='', extra=''):
    return (
        f'<div id="{el_id}" class="clip {cls}" data-start="{start}" data-duration="{round(dur, 3)}" '
        f'data-track-index="{trk}" style="{style}"{extra}>{inner}</div>'
    )


# ---- scene builders -------------------------------------------------------------------------
KEY_SVG = (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    'stroke-linecap="round" stroke-linejoin="round"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 '
    '1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 '
    '6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5"/></svg>'
)
CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'


def scene_title(sc):
    sid = sc['id']
    accounts = [
        ('Development', ['team/app/db', 'billing/config', 'api/stripe-key', 'ci/deploy-token']),
        ('Staging', ['team/app/db', 'search/api-key', 'mail/smtp', 'cache/redis-auth']),
        ('Production', ['team/app/db', 'payments/hmac', 'oauth/client', 'data/warehouse']),
    ]
    cols = ''.join(
        f'<div class="acct" id="{sid}-acct{i}"><div class="acct-h"><span class="dot"></span>{name}</div>'
        + ''.join(f'<div class="pill" id="{sid}-p{i}{j}">{n}</div>' for j, n in enumerate(names))
        + '</div>'
        for i, (name, names) in enumerate(accounts)
    )
    inner = (
        f'<div class="hook-grid">{cols}</div>'
        f'<h1 class="hook-h" id="{sid}-h" data-layout-allow-overlap>One place for <span class="accent">security</span>.<br/>'
        f'Just enough access for <span class="accent">developers</span>.</h1>'
    )
    s0, s1 = sc['sentences'][0]['start'], sc['sentences'][1]['start']
    js.append(f'tl.from("#{sid}-acct0,#{sid}-acct1,#{sid}-acct2", {{y: 60, opacity: 0, duration: 0.7, stagger: 0.15, ease: "power3.out"}}, {sc["start"] + 0.1})')
    for i in range(3):
        js.append(f'tl.from("#{sid}-acct{i} .pill", {{scale: 0.6, opacity: 0, duration: 0.35, stagger: 0.22, ease: "back.out(2)"}}, {s0 + 0.5 + i * 0.35})')
    js.append(f'tl.to(".hook-grid", {{opacity: 0.18, scale: 0.94, filter: "blur(3px)", duration: 0.6}}, {s1 - 0.2})')
    js.append(f'tl.from("#{sid}-h", {{y: 40, opacity: 0, duration: 0.7, ease: "power3.out"}}, {s1})')
    return inner


SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>'
CODE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg>'


def scene_intro(sc):
    """Two audiences: security teams and developers without AWS console access."""
    sid = sc['id']
    cards = [
        ('sec', SHIELD, 'For security teams', ['Every AWS account in one place', 'Roles per account from Entra groups', 'Every view and change audited']),
        ('dev', CODE, 'For developers', ['No AWS console login needed', 'Only the access your role allows', 'Values hidden until you view them']),
    ]
    cards_html = ''.join(
        f'<div class="aud surface" id="{sid}-{k}"><div class="aud-h"><span class="aud-i">{icon}</span>{title}</div>'
        + ''.join(f'<div class="aud-li" id="{sid}-{k}-{n}"><span class="ckm sm">{CHECK}</span>{t}</div>' for n, t in enumerate(items))
        + '</div>'
        for k, icon, title, items in cards
    )
    inner = (
        f'<div class="intro-wrap"><div class="intro-brand" id="{sid}-brand"><div class="logo sm">{KEY_SVG}</div>'
        f'<h1 class="brand sm">Secrets Console</h1></div><div class="aud-row">{cards_html}</div></div>'
    )
    s0, s1 = sc['sentences'][0]['start'], sc['sentences'][1]['start']
    js.append(f'tl.from("#{sid}-brand", {{y: -20, opacity: 0, duration: 0.6, ease: "power3.out"}}, {sc["start"] + 0.1})')
    js.append(f'tl.from("#{sid}-sec", {{x: -60, opacity: 0, duration: 0.6, ease: "power3.out"}}, {s0 + 0.6})')
    js.append(f'tl.from("#{sid}-sec .aud-li", {{x: -16, opacity: 0, duration: 0.35, stagger: 0.45}}, {s0 + 1.3})')
    js.append(f'tl.from("#{sid}-dev", {{x: 60, opacity: 0, duration: 0.6, ease: "power3.out"}}, {s1 + 0.2})')
    js.append(f'tl.from("#{sid}-dev .aud-li", {{x: -16, opacity: 0, duration: 0.35, stagger: 0.55}}, {s1 + 1.0})')
    return inner


def scene_roles(sc):
    sid = sc['id']
    rows = [
        ('List, search, metadata', 'yyy'),
        ('View a value (audited)', 'yyy'),
        ('Create, edit value, tags', 'nyy'),
        ('Delete, restore, roll back', 'nny'),
        ('Activity page', 'nny'),
    ]
    head = '<tr><th></th><th><span class="role r-reader">READER</span></th><th><span class="role r-writer">WRITER</span></th><th><span class="role r-admin">ADMIN</span></th></tr>'
    body_rows = ''.join(
        f'<tr><td class="act">{a}</td>'
        + ''.join(
            f'<td><span class="mark {"yes" if f == "y" else "no"}" id="{sid}-m{r}{c}">{CHECK if f == "y" else "–"}</span></td>'
            for c, f in enumerate(flags)
        )
        + '</tr>'
        for r, (a, flags) in enumerate(rows)
    )
    inner = (
        f'<div class="roles-wrap"><h2 class="scene-h" id="{sid}-h">Least privilege, per account</h2>'
        f'<table class="matrix surface" id="{sid}-t">{head}{body_rows}</table>'
        f'<div class="flow" id="{sid}-flow"><span class="chip">Entra group</span><span class="arrow">→</span>'
        f'<span class="chip">Role per account</span><span class="arrow">→</span>'
        f'<span class="chip strong">AWS session scoped to that role</span></div></div>'
    )
    s0, s1 = sc['sentences'][0]['start'], sc['sentences'][1]['start']
    js.append(f'tl.from("#{sid}-h", {{y: 24, opacity: 0, duration: 0.5}}, {sc["start"] + 0.1})')
    js.append(f'tl.from("#{sid}-t", {{y: 40, opacity: 0, duration: 0.6, ease: "power3.out"}}, {sc["start"] + 0.35})')
    js.append(f'tl.from("#{sid}-t .mark", {{scale: 0, opacity: 0, duration: 0.3, stagger: 0.09, ease: "back.out(2.5)"}}, {s0 + 0.4})')
    js.append(f'tl.from("#{sid}-flow > *", {{x: -20, opacity: 0, duration: 0.4, stagger: 0.25}}, {s1 + 0.1})')
    return inner


def scene_activity(sc):
    sid = sc['id']
    rows = [
        ('17:59', 'View', 'blue', 'team/app/db', 'ann@example.com', 'Secrets Console', False),
        ('17:42', 'Update value', 'amber', 'billing/config', 'bob@example.com', 'Secrets Console', False),
        ('16:38', 'Create', 'green', 'payments/hmac', 'ci-deployer', 'Outside app', True),
        ('15:10', 'Delete', 'red', 'legacy/old-key', 'ann@example.com', 'Secrets Console', False),
        ('14:02', 'Rollback', 'violet', 'team/app/db', 'carol@example.com', 'Secrets Console', False),
    ]
    tiles = [('Changes &amp; views', '8', True), ('Views', '3', False), ('Changes', '5', False), ('Failed', '0', False), ('All events', '85', False)]
    tiles_html = ''.join(
        f'<div class="tile{" on" if on else ""}"><span>{n}</span><b>{v}</b></div>' for n, v, on in tiles
    )
    rows_html = ''.join(
        f'<div class="arow{" del" if lab == "Delete" else ""}" id="{sid}-r{i}"><span class="time">{tm}</span>'
        f'<span class="apill a-{col}">{lab}</span><span class="aname">{name}</span>'
        f'<span class="who"><i>{who[0].upper()}</i>{who}</span>'
        f'<span class="src{" out" if out else ""}" id="{sid}-src{i}">{src}</span><span class="ok">Success</span></div>'
        for i, (tm, lab, col, name, who, src, out) in enumerate(rows)
    )
    inner = (
        f'<div class="act-wrap"><div class="act-top"><h2 class="scene-h" id="{sid}-h">Activity <span class="role r-admin">ADMIN</span></h2>'
        f'<p class="sub" id="{sid}-sub">One audit view from AWS CloudTrail, including changes made outside this app</p></div>'
        f'<div class="tiles" id="{sid}-tiles">{tiles_html}</div>'
        f'<div class="atable surface" id="{sid}-table"><div class="aday">Thursday, Sep 24, 2026 · 5 events</div>{rows_html}</div></div>'
    )
    s0, s1 = sc['sentences'][0]['start'], sc['sentences'][1]['start']
    js.append(f'tl.from("#{sid}-h, #{sid}-sub", {{y: 20, opacity: 0, duration: 0.5, stagger: 0.15}}, {sc["start"] + 0.1})')
    js.append(f'tl.from("#{sid}-tiles .tile", {{y: 30, opacity: 0, duration: 0.4, stagger: 0.1}}, {s0 + 0.2})')
    js.append(f'tl.from("#{sid}-table .arow", {{x: 40, opacity: 0, duration: 0.4, stagger: 0.18, ease: "power2.out"}}, {s0 + 1.2})')
    js.append(f'tl.fromTo("#{sid}-src2", {{boxShadow: "0 0 0 0 rgba(245,158,11,0)"}}, {{boxShadow: "0 0 0 8px rgba(245,158,11,.35)", duration: 0.5, yoyo: true, repeat: 3}}, {s1 + 1.6})')
    return inner


def scene_outro(sc):
    sid = sc['id']
    items = ['One place for every AWS account', 'Least privilege, no AWS console needed', 'Every view audited · values never in logs']
    checks = ''.join(f'<div class="ck" id="{sid}-c{i}"><span class="ckm">{CHECK}</span>{t}</div>' for i, t in enumerate(items))
    inner = (
        f'<div class="center"><div class="checks" id="{sid}-checks">{checks}</div>'
        f'<div class="final" id="{sid}-final"><div class="logo">{KEY_SVG}</div>'
        f'<h1 class="brand">Secrets Console</h1><p class="tag">Every account. Only the access you need.</p></div></div>'
    )
    s0, s1 = sc['sentences'][0]['start'], sc['sentences'][1]['start']
    js.append(f'tl.from("#{sid}-checks .ck", {{y: 26, opacity: 0, duration: 0.45, stagger: 0.55, ease: "power2.out"}}, {s0 + 0.2})')
    js.append(f'tl.to("#{sid}-checks", {{opacity: 0, y: -30, duration: 0.5}}, {s1 - 0.25})')
    js.append(f'tl.from("#{sid}-final", {{scale: 0.85, opacity: 0, duration: 0.8, ease: "back.out(1.6)"}}, {s1})')
    return inner


def scene_shots(sc):
    sid = sc['id']
    shots = SHOTS[sc['visual']]
    parts = []
    for k, sh in enumerate(shots):
        sh_start = sc['start'] if k == 0 and sh['from'] == (0, 0) else at(sc, sh['from'])
        nxt = shots[k + 1] if k + 1 < len(shots) else None
        sh_end = at(sc, nxt['from']) + 0.4 if nxt else sc['end']
        fid = f'{sid}-s{k}'
        callouts = ''.join(
            f'<div class="co{" below" if c.get("below") else ""}" id="{fid}-c{j}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">'
            f'<span class="co-l">{esc(c["label"])}</span></div>'
            for j, c in enumerate(sh['callouts'])
            for (x, y, w, h) in [c['box']]
        )
        inner = (
            f'<div class="frame"><div class="bar"><i></i><i></i><i></i><span>secrets-console.internal</span></div>'
            f'<div class="view"><div class="shot" id="{fid}-z">'
            f'<img src="assets/shots/{sh["img"]}.png" alt="" width="1440"/>{callouts}</div></div></div>'
        )
        parts.append(clip(fid, round(sh_start, 3), sh_end - sh_start, track['shot'] + k, inner, 'shotclip',
                          extra=' data-layout-allow-overlap'))
        if k == 0:
            js.append(f'tl.fromTo("#{fid} .frame", {{y: 50, opacity: 0, scale: 0.97}}, {{y: 0, opacity: 1, scale: 1, duration: 0.6, ease: "power3.out"}}, {sh_start})')
        else:  # a later shot in the same scene cross-fades in place
            js.append(f'tl.fromTo("#{fid} .frame", {{opacity: 0}}, {{opacity: 1, duration: 0.5, ease: "power1.inOut"}}, {sh_start})')
        if sh['zoom']:
            zx, zy, zs = sh['zoom']
            js.append(f'gsap.set("#{fid}-z", {{transformOrigin: "{zx}px {zy}px"}})')
            js.append(f'tl.to("#{fid}-z", {{scale: {zs}, duration: {round(sh_end - sh_start - 0.6, 2)}, ease: "sine.inOut"}}, {sh_start + 0.5})')
        else:
            js.append(f'tl.to("#{fid}-z", {{y: -60, duration: {round(sh_end - sh_start, 2)}, ease: "none"}}, {sh_start})')
        for j, c in enumerate(sh['callouts']):
            ct = at(sc, c['at'])
            js.append(f'tl.fromTo("#{fid}-c{j}", {{opacity: 0, scale: 1.25}}, {{opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2)"}}, {ct})')
    return ''.join(parts)


BUILDERS = {'title': scene_title, 'intro': scene_intro, 'roles': scene_roles, 'activity': scene_activity, 'outro': scene_outro}

for sc in scenes:
    dur = sc['end'] - sc['start']
    if sc['visual'] in BUILDERS:
        inner = BUILDERS[sc['visual']](sc)
        body.append(clip(f'scene-{sc["id"]}', sc['start'], dur, track['scene'], inner, 'scene'))
        js.append(f'tl.from("#scene-{sc["id"]}", {{opacity: 0, duration: 0.35}}, {sc["start"]})')
    else:
        body.append(scene_shots(sc))
    # Feature label, top-left, for screenshot scenes.
    labels = {'list': 'Browse', 'quickview': 'View', 'create': 'Create', 'edit': 'Edit & save',
              'versions': 'Versions', 'danger': 'Delete safely'}
    if sc['visual'] in labels:
        lid = f'label-{sc["id"]}'
        num = list(labels).index(sc['visual']) + 1
        body.append(clip(lid, sc['start'], dur, track['caption'] + 1,
                         f'<span class="ln">{num:02d}</span>{labels[sc["visual"]]}', 'flabel'))
        js.append(f'tl.from("#{lid}", {{x: -30, opacity: 0, duration: 0.5, ease: "power3.out"}}, {sc["start"] + 0.2})')
    # Captions + narration.
    for k, s in enumerate(sc['sentences']):
        cid = f'cap-{sc["id"]}-{k}'
        cap_end = sc['sentences'][k + 1]['start'] if k + 1 < len(sc['sentences']) else sc['end'] - 0.15
        body.append(clip(cid, s['start'], cap_end - s['start'], track['caption'],
                         f'<p class="en">{esc(s["en"])}</p><p class="vi">{esc(s["vi"])}</p>', 'caption'))
        js.append(f'tl.from("#{cid}", {{y: 16, opacity: 0, duration: 0.3, ease: "power2.out"}}, {s["start"]})')
        body.append(
            f'<audio id="vo-{sc["id"]}-{k}" class="clip" src="{s["file"]}" data-start="{s["start"]}" '
            f'data-duration="{s["dur"]}" data-track-index="{track["audio"]}" data-volume="1"></audio>'
        )

progress = f'<div id="progress" class="clip" data-start="0" data-duration="{TOTAL}" data-track-index="9"></div>'
js.append(f'tl.fromTo("#progress", {{scaleX: 0}}, {{scaleX: 1, duration: {TOTAL}, ease: "none"}}, 0)')

# Fonts are bundled (Inter + JetBrains Mono, incl. the Vietnamese subset for the captions).
css = (ROOT / 'tools' / 'fonts.css').read_text() + (ROOT / 'tools' / 'style.css').read_text()
page = f'''<!doctype html>
<html lang="en" data-resolution="landscape">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>{css}</style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="{W}" data-height="{H}">
      <div class="bg"></div>
      {''.join(body)}
      {progress}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
      {chr(10).join('      ' + j + ';' for j in js).lstrip()}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
'''
(ROOT / 'index.html').write_text(page)
print(f'index.html: {len(scenes)} scenes, {TOTAL:.1f}s')
