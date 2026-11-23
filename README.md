# the5vs Clinic Demo Bot

A WhatsApp-style AI clinic assistant demo (Egyptian Arabic + English) that the the5vs
outreach pitches lean on. Zero-cost stack: no paid APIs, no paid hosting.

## What it does

- Answers patient questions instantly in Arabic or English (auto-detected, follows switches)
- Prices, services, branches, working hours
- Full booking flow: service -> branch -> day -> time -> name -> confirmation with a reference code
- Clinical questions (pain, bleeding, medication) are never answered medically: the bot
  apologizes, "hands the case to the team", and offers to book a consultation
- Optional free-tier LLM fallback (Groq / Gemini) for anything outside the scripted intents

## Two ways to demo it

### 1. Web prototype (ready now, no keys, no WhatsApp needed)

A page that looks and feels exactly like a WhatsApp chat with the clinic's assistant,
backed by the real conversation engine. Perfect for the 30-second wow: send the link,
the clinic owner taps a suggestion chip or types "بكام الفينير؟" and watches it work.

Deploy (free):
1. Push this folder to a GitHub repo
2. Import it in Vercel (free Hobby plan) - no build step needed, it detects the `api/` functions and `public/` folder automatically
3. Share `https://<your-app>.vercel.app/demo`

Run locally:
```
npx vercel dev        # then open http://localhost:3000/demo
```

Try the engine without any server:
```
node test/simulate.js        # scripted scenarios (booking, handoff, languages)
node test/simulate.js -i     # type at it yourself
```

### 2. Real WhatsApp number (upgrade path, still free)

`api/whatsapp.js` is a ready Meta WhatsApp Cloud API webhook using the same engine.

Needs (all free):
- A spare SIM/number not already on WhatsApp (or migrate an existing one)
- A Meta developer app with WhatsApp product added (developers.facebook.com)
- Set env vars in Vercel: `WHATSAPP_VERIFY_TOKEN` (you invent it),
  `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
- Point the Meta webhook to `https://<your-app>.vercel.app/api/whatsapp`

Note: customer-initiated conversations on the Cloud API are free, which is exactly the
demo flow (clinic owner texts the number first). An unverified business can still run
this; verification raises limits later.

## Optional free LLM fallback

Without a key the bot still handles the whole demo script, and answers off-script
questions with a polite fallback. With a free key it also handles open questions
("do you accept insurance?") in character.

Set ONE of these env vars in Vercel:
- `GROQ_API_KEY` - free at console.groq.com (recommended, fast)
- `GEMINI_API_KEY` - free at aistudio.google.com
- `OPENAI_API_KEY` - paid, only if already available

Default Groq model: `openai/gpt-oss-120b` (called with `reasoning_effort: low` -
the strongest free-tier model, sub-second replies, excellent Egyptian Arabic and
Franco-Arab). Override with `GROQ_MODEL`. `qwen/qwen3.8-27b` is the faster fallback.

## Testing

- `node test/simulate.js` - scripted conversation scenarios against the engine
- `node test/matrix.js` - 82-scenario validation matrix against the LIVE deployment
  (flows end-to-end, flow interrupts at every step, wrong input types, adversarial
  inputs, language switching, session edge cases). Exits non-zero on any failure.

## Make it a specific clinic

Everything clinic-specific lives in `lib/clinic.js` (name, doctor, services, prices,
branches, hours) and can be overridden with env vars. Clone that file per client.

## Known demo limitations (by design, zero-cost)

- Session memory is per-server-instance (resets on cold start / redeploy). For
  persistent sessions add a free Upstash Redis and swap the Map in `api/chat.js`.
- Bookings are confirmed in-chat only; nothing emails the clinic yet. A free webhook
  (e.g. to n8n or a Google Sheet) is a small add.
