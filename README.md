# Emotion app: test deployment

```
index.html, config.js, robots.txt   the site (upload these)
data/                               content the app reads (feelings.json, works.json)
source/ + build_data.py             spreadsheets you edit, and the script that rebuilds data/
server/                             the API (worker.js, wrangler.toml): AI names, review queue, flags
```

## 1. Put the site online (works on its own)
Upload `index.html`, `config.js`, `robots.txt` and the `data/` folder to any host. Without an API address the app runs fully offline: no AI names; combined-feeling names come from `blends.csv` (each with a one-line description).
Local test: `python3 -m http.server 8000` in this folder, then open http://localhost:8000 (double-clicking index.html will not work).

### Suggestions and flags without the server
Suggestions and flags are sent straight to your inbox (no email app opens) through a form-to-email service. Each email arrives with labelled fields (kind, type, title, creator, text, url, families, tags, feeling), so it is already sorted, and a Gmail filter or a script can pick out the subject lines starting `[emotion-app suggestion]` or `[emotion-app flag]`.
1. Create a free account with a form-to-email service, for example Web3Forms (it emails you an access key) or Formspree (it gives you a form address). Check their current free limits and spam protection.
2. Put the address in `config.js` as `submitEndpoint` (and the key as `submitKey` if the service gives one). Re-upload `config.js`.
3. The key is visible to anyone who views the site's code. That is normal for these services, but it means the service's own spam filtering matters, and a hidden trap field in the form already catches simple bots.
Until `submitEndpoint` is set, the + and flag icons show a "not switched on yet" message.
Good suggestions: add a row to `source/works.csv` (types: quote, film, book, word), run `python3 build_data.py`, upload `data/works.json`.

## Where the content comes from
Written by me from general knowledge, not checked against the original papers, so treat it as an informed starting point:
- **Core feelings and blends:** Plutchik's wheel (joy, trust, fear, surprise, sadness, disgust, anger, anticipation) and his blended emotions, with gentler and stronger versions of each. See `source/dyads.csv`.
- **Emotion vocabulary:** the 27 categories in Cowen and Keltner's work, and the vocabulary in Brené Brown's *Atlas of the Heart*.
- **Pale, true and deep tones:** the common finding that lighter, softer colours go with gentler feelings and darker, more saturated ones with heavier, more intense feelings (Valdez and Mehrabian's colour work), plus everyday colour associations.
- **Specific pairs** (`source/overrides.csv`): hand-picked names for common combinations such as Sad + Hopeful.

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
