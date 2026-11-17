// Small API for the emotion app (Cloudflare Worker). Holds the AI key, the review queue and flags.
// Access is by codes: INVITE_CODE (visitor), TRUSTED_CODE (trusted contributor), ADMIN_TOKEN (reviewer).
const s = (v, n) => String(v == null ? '' : v).slice(0, n);
const arr = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
async function hash(t) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(d)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function limit(env, key, max) {
  const k = 'rl:' + key, n = +(await env.DB.get(k) || 0);
  if (n >= max) return false;
  await env.DB.put(k, String(n + 1), { expirationTtl: 3600 });
  return true;
}
async function all(env, prefix) {
  const out = []; let cursor;
  do {
    const l = await env.DB.list({ prefix, cursor });
    for (const k of l.keys) { const v = await env.DB.get(k.name); if (v) out.push(JSON.parse(v)); }
    cursor = l.list_complete ? null : l.cursor;
  } while (cursor);
  return out;
}
export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*', 'Access-Control-Allow-Headers': 'content-type,x-code', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Vary': 'Origin' };
    const out = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'content-type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const code = req.headers.get('x-code') || '';
    const role = !code ? 'none' : code === env.ADMIN_TOKEN ? 'admin' : code === env.TRUSTED_CODE ? 'trusted' : code === env.INVITE_CODE ? 'visitor' : 'none';
    if (path === '/whoami') return out({ role });
    if (role === 'none') return out({ error: 'code' }, 401);
    const ip = req.headers.get('cf-connecting-ip') || 'local';
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    if (path === '/entries') {
      const entries = (await all(env, 'sub:')).filter(e => e.status === 'approved' || (role === 'admin' && e.status === 'pending'));
      const flags = await all(env, 'flag:');
      return out({ entries, flags });
    }
    if (path === '/submit') {
      if (body.hp) return out({ ok: true }); // honeypot: bots fill hidden fields
      if (role !== 'admin' && !(await limit(env, 'p:' + ip, 10))) return out({ error: 'rate' }, 429);
      const eff = role === 'admin' && ['visitor', 'trusted'].includes(body.as) ? body.as : role; // lets the reviewer test other roles
      const e = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        type: ['book', 'film', 'poem', 'other'].includes(body.type) ? body.type : 'other',
        title: s(body.title, 120), creator: s(body.creator, 80), quote: s(body.quote, 220), why: s(body.why, 220),
        year: s(body.year, 4), src: s(body.src, 80),
        tags: arr(body.tags, 8).map(t => s(t, 30).toLowerCase()), fams: arr(body.fams, 6).map(t => s(t, 20)),
        status: eff === 'visitor' ? 'pending' : 'approved', by: s(body.by, 40), at: Date.now(),
      };
      if (!e.title) return out({ error: 'bad' }, 400);
      await env.DB.put('sub:' + e.id, JSON.stringify(e));
      return out({ ok: true, status: e.status });
    }
    if (path === '/review') {
      if (role !== 'admin') return out({ error: 'admin' }, 403);
      const v = await env.DB.get('sub:' + s(body.id, 40));
      if (!v || !['approved', 'rejected'].includes(body.status)) return out({ error: 'bad' }, 400);
      const e = JSON.parse(v); e.status = body.status;
      await env.DB.put('sub:' + e.id, JSON.stringify(e));
      return out({ ok: true });
    }
    if (path === '/flag' || path === '/unflag') {
      if (role !== 'admin' && !(await limit(env, 'f:' + ip, 60))) return out({ error: 'rate' }, 429);
      const f = { key: s(body.key, 100), feeling: s(body.feeling, 80), by: s(body.by, 40) };
      const k = 'flag:' + await hash(f.key + '|' + f.feeling + '|' + f.by);
      if (path === '/flag') await env.DB.put(k, JSON.stringify({ ...f, at: Date.now() })); else await env.DB.delete(k);
      return out({ ok: true });
    }
    if (path === '/suggest') {
      if (role !== 'admin' && !(await limit(env, 's:' + ip, 30))) return out({ error: 'rate' }, 429);
      const L = arr(body.layers, 6).map(l => ({ emo: s(l.emo, 40), fam: s(l.fam, 20), tone: s(l.tone, 10), words: arr(l.words, 8).map(w => s(w, 30)) }));
      if (!L.length) return out({ error: 'bad' }, 400);
      const tn = { light: 'pale and soft', mid: 'true colour', deep: 'deep and heavy' };
      const d = L.map((l, i) => 'Layer ' + (i + 1) + ': ' + l.emo + ' (' + l.fam + ' family, ' + (tn[l.tone] || 'true colour') + (l.words.length ? '; finer feelings: ' + l.words.join(', ') : '') + ')').join(' | ');
      const prompt = 'Someone has built one layered feeling from these parts: ' + d + '. Suggest 6 names for the single complex feeling these layers add up to, best fit first. Draw on emotion psychology and emotional vocabulary (Plutchik\u2019s blended emotions, Bren\u00e9 Brown\u2019s Atlas of the Heart, Lisa Feldman Barrett, well-known untranslatable words). Prefer precise terms that truly fit the blend over generic labels or simply joining the layer names. Pale tones mean gentler versions of a feeling; deep tones mean heavier, more intense ones. Reply with JSON only, in this shape: {"names":[{"name":"1 to 4 words","gloss":"one plain sentence, at most 18 words, saying why it fits"}]}';
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: env.MODEL || 'claude-sonnet-5-5', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!r.ok) return out({ error: 'upstream' }, 502);
      const j = await r.json(), t = (j.content || []).map(c => c.text || '').join('');
      let names = []; try { names = JSON.parse(t.match(/\{[\s\S]*\}/)[0]).names || []; } catch (e) {}
      return out({ names: arr(names, 6).map(n => ({ name: s(n.name, 60), gloss: s(n.gloss, 160) })) });
    }
    return out({ error: 'not found' }, 404);
  },
};
