"""Rebuild data/*.json from the spreadsheets in source/. Run: python3 build_data.py"""
import csv, json, os
here = os.path.dirname(os.path.abspath(__file__))
src, out = os.path.join(here, 'source'), os.path.join(here, 'data')
lst = lambda s: [x.strip() for x in s.split(';') if x.strip()]
rows = lambda name: list(csv.DictReader(open(os.path.join(src, name), encoding='utf-8-sig')))

works = []
for r in rows('works.csv'):
    t = r['type'].strip()
    w = {'id': r['id'].strip(), 'type': t}
    if t == 'quote': w.update(text=r['text'], creator=r['creator'], title=r['title'], url=r['url'])
    elif t == 'film': w.update(title=r['title'], year=r['year'], note=r['note'], url=r['url'])
    elif t == 'word': w.update(title=r['title'], language=r['language'], text=r['text'])
    elif t == 'book': w.update(title=r['title'], creator=r['creator'], text=r['text'], url=r['url'])
    else: raise SystemExit('Unknown type "%s" for %s (use quote, film, book or word)' % (t, r['id']))
    w['families'] = lst(r['families']); w['feelings'] = lst(r['feelings'])
    if t != 'word': w['default_for_layered'] = r['default_for_layered'].strip().lower() == 'true'
    works.append(w)

fams = {}
for r in rows('emotions.csv'):
    f = fams.setdefault(r['family'], {'id': r['family'].lower(), 'name': r['family'],
        'hue_start': int(r['hue_start']), 'hue_end': int(r['hue_end']), 'tiers': {'light': [], 'mid': [], 'deep': []}})
    f['tiers'][r['tier']].append({'emotion': r['emotion'], 'finer': lst(r['finer_feelings']), 'affect': lst(r['affect'])})

dyads = [{'a': r['feeling_a'], 'b': r['feeling_b'], 'gentle': r['gentle_name'], 'gentle_gloss': r['gentle_description'],
          'intense': r['intense_name'], 'intense_gloss': r['intense_description']} for r in rows('dyads.csv')]

ovf = os.path.join(src, 'overrides.csv')
overrides = [{'a': r['emotion_a'], 'b': r['emotion_b'], 'name': r['name'], 'description': r['description']} for r in rows('overrides.csv')] if os.path.exists(ovf) else []

# ---- checks (warnings only) ----
warn = []
fam_names = set(fams)
emo_names = {e['emotion'] for f in fams.values() for tier in f['tiers'].values() for e in tier}
cores = {'joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'}
for w in works:
    for x in w['families']:
        if x not in fam_names: warn.append('works.csv: %s uses unknown family "%s"' % (w['id'], x))
ids = [w['id'] for w in works]
warn += ['works.csv: duplicate id "%s"' % i for i in sorted(set(ids)) if ids.count(i) > 1]
for f in fams.values():
    for tier in f['tiers'].values():
        for e in tier:
            if not e['affect'] or [a for a in e['affect'] if a not in cores]:
                warn.append('emotions.csv: "%s" needs core feelings from: %s' % (e['emotion'], ', '.join(sorted(cores))))
for o in overrides:
    for k in ('a', 'b'):
        if o[k] not in emo_names: warn.append('overrides.csv: unknown emotion "%s"' % o[k])
have = {tuple(sorted((d['a'], d['b']))) for d in dyads}
warn += ['dyads.csv: missing pair %s + %s' % p for p in sorted({tuple(sorted((a, b))) for a in cores for b in cores} - have)]
print('Checks:', 'all passed' if not warn else '%d warning(s)' % len(warn))
for m in warn: print('  -', m)

os.makedirs(out, exist_ok=True)
dump = lambda name, obj: open(os.path.join(out, name), 'w', encoding='utf-8').write(json.dumps(obj, indent=2, ensure_ascii=False))
dump('works.json', works)
dump('feelings.json', {'families': list(fams.values()), 'dyads': dyads, 'overrides': overrides})
print('works', len(works), '| emotions', sum(len(t) for f in fams.values() for t in f['tiers'].values()), '| blended-feeling pairs', len(dyads))
