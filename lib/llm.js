// Optional free-tier LLM fallback for questions outside the scripted intents.
// Supports any OpenAI-compatible endpoint. Free tiers that work out of the box:
//   Groq    (console.groq.com)  - free tier, fast, set GROQ_API_KEY
//   Gemini  (aistudio.google.com) via OpenAI-compatible endpoint, set GEMINI_API_KEY
//   OpenAI  (platform.openai.com) - paid, set OPENAI_API_KEY
// If no key is set, the engine's scripted fallback reply is used instead. Zero cost either way.

const { clinic } = require('./clinic');

function provider() {
  if (process.env.GROQ_API_KEY) {
    return {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    };
  }
  if (process.env.GEMINI_API_KEY) {
    return {
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      key: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }
  return null;
}

function systemPrompt(lang) {
  return `You are the WhatsApp receptionist of ${clinic.nameEn} (${clinic.nameAr}), a dental clinic in Cairo.
Reply in ${lang === 'en' ? 'English' : 'Egyptian Arabic'} unless the user clearly uses the other language.
If the user writes Franco-Arab (Arabic in Latin letters/numbers, like "3ayez a7gz"), reply in Egyptian Arabic.
Keep replies under 40 words, warm and practical.
Facts you know:
- Services & prices: ${clinic.services.map((s) => `${s.en}/${s.ar}: ${s.priceEn}`).join('; ')}
- Branches: ${clinic.branches.map((b) => b.en).join(' | ')}
- Hours: ${clinic.hoursEn}
Rules:
- NEVER give medical advice, diagnoses, or medication suggestions. For anything clinical, say the clinic team will call them back and offer to book a consultation.
- NEVER invent policies, prices, payment methods, insurance tie-ins, offers, phone numbers, links, or contact details. The only contact routes are booking here in the chat or the user leaving their number for a team callback.
- If the user jokes, flirts, trolls, or is rude, stay light and professional, never scold, and steer back to how you can help.
- If a message is garbled, half-typed, or just emoji, make your best guess, answer briefly and warmly, and offer the most likely next step (prices, booking, or a callback).
- ALWAYS give a genuinely helpful answer first: answer general questions (about dentistry, visits, kids, nerves, location, anything) in general terms before steering. NEVER reply with only an apology, "I don't know", or "I can't help with that".
- After answering, steer naturally toward booking an appointment or leaving a number for a team callback.
- If asked for a human, say the team will call them during working hours and offer to take their number.`;
}

async function llmReply(session, userText) {
  const p = provider();
  if (!p) throw new Error('no LLM provider configured');
  const history = (session.history || []).slice(-6);
  const body = {
    model: p.model,
    messages: [
      { role: 'system', content: systemPrompt(session.lang) },
      ...history,
      { role: 'user', content: userText },
    ],
    max_tokens: 900,
    temperature: 0.4,
  };
  // gpt-oss is a reasoning model: low effort keeps answers fast and within budget
  if (p.model.includes('gpt-oss')) body.reasoning_effort = 'low';
  const res = await fetch(p.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('LLM HTTP ' + res.status);
  const data = await res.json();
  const out = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!out) throw new Error('empty LLM response');
  session.history = [...history, { role: 'user', content: userText }, { role: 'assistant', content: out }];
  return out.trim();
}

module.exports = { llmReply, provider };
