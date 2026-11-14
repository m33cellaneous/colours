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
    else: raise SystemExit('Unknown type "%s" for %s (use quote, film or word)' % (t, r['id']))
    w['families'] = lst(r['families']); w['feelings'] = lst(r['feelings'])
    if t != 'word': w['default_for_layered'] = r['default_for_layered'].strip().lower() == 'true'
    works.append(w)

fams = {}
for r in rows('emotions.csv'):
    f = fams.setdefault(r['family'], {'id': r['family'].lower(), 'name': r['family'],
        'hue_start': int(r['hue_start']), 'hue_end': int(r['hue_end']), 'tiers': {'light': [], 'mid': [], 'deep': []}})
    f['tiers'][r['tier']].append({'emotion': r['emotion'], 'finer': lst(r['finer_feelings'])})

blends = {}
for r in rows('blends.csv'):
    b = blends.setdefault((r['family_a'], r['family_b']), {'names': [], 'glosses': {}})
    b['names'].append(r['blend_name'])
    if r['gloss'].strip(): b['glosses'][r['blend_name']] = r['gloss'].strip()

os.makedirs(out, exist_ok=True)
dump = lambda name, obj: open(os.path.join(out, name), 'w', encoding='utf-8').write(json.dumps(obj, indent=2, ensure_ascii=False))
dump('works.json', works)
dump('feelings.json', {'families': list(fams.values()), 'blends': [dict(families=list(k), names=v['names'], glosses=v['glosses']) for k, v in blends.items()]})
print('works', len(works), '| emotions', sum(len(t) for f in fams.values() for t in f['tiers'].values()), '| blends', sum(len(v['names']) for v in blends.values()))
