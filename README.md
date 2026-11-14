# Emotion app: test deployment

```
index.html, config.js, robots.txt   the site (upload these)
data/                               content the app reads (feelings.json, works.json)
source/ + build_data.py             spreadsheets you edit, and the script that rebuilds data/
server/                             the API (worker.js, wrangler.toml): AI names, review queue, flags
```

## 1. Put the site online (works on its own)
Upload `index.html`, `config.js`, `robots.txt` and the `data/` folder to any host. Without an API address the app runs fully offline: no AI names, no submissions, simple name suggestions from `blends.csv`.
Local test: `python3 -m http.server 8000` in this folder, then open http://localhost:8000 (double-clicking index.html will not work).

## 2. Turn on AI names, submissions and the review queue (Cloudflare, free plan)
1. `cd server`, then `npx wrangler login` (creates/uses a free Cloudflare account).
2. `npx wrangler kv namespace create DB` and paste the `id` it prints into `wrangler.toml`.
3. In `wrangler.toml`, set `ALLOWED_ORIGIN` to your site's address (for example `https://test.example.com`).
4. Add four secrets, one command each (you will be asked to type the value):
   - `npx wrangler secret put ANTHROPIC_API_KEY` (from console.anthropic.com; usage is billed to you)
   - `npx wrangler secret put INVITE_CODE`  (give this to everyone you invite)
   - `npx wrangler secret put TRUSTED_CODE` (give this only to your trusted tester)
   - `npx wrangler secret put ADMIN_TOKEN`  (keep this for yourself)
5. `npx wrangler deploy`. Copy the address it prints into `config.js` as `apiUrl`, then re-upload `config.js`.

## 3. How testers use it
Everyone taps **Access code** (bottom right) and enters the code you gave them.

| Code | Role | What happens |
|---|---|---|
| none | outsider | wheel and journal work; no AI names, no submissions |
| invite code | visitor | AI names; can flag; suggestions wait for review |
| trusted code | trusted contributor | suggestions go live straight away |
| admin token | reviewer (you) | Review queue button; "Viewing as" menu to test the other roles |

## Invited-only
- `robots.txt` and a noindex tag ask search engines to skip the site.
- The codes protect everything that costs money or changes data. The wheel itself holds no secrets.
- For a hard lock on the whole page, also use your host's password protection (or Cloudflare Access).
- Anyone who gets a code can pass it on, so change a code (`wrangler secret put`) if it leaks.

## Limits and costs
- Each AI name suggestion is one paid API call. Limits: 30 per visitor address per hour, 10 submissions, 60 flags.
- Free-plan Cloudflare storage allows about 1,000 writes a day, which is plenty for a small test.
- What people write when choosing names or suggesting entries goes to your server (and the AI request goes to Anthropic). Tell your testers.
- Flags and the "who" of each flag come from the browser, so they can be faked. Fine for testing, not for the public.

## Editing content
Edit a CSV in `source/`, run `python3 build_data.py`, upload the changed files in `data/`.
