// WhatsApp Cloud API (Meta) adapter. Same engine, real number.
// This is the upgrade path once a spare number + Meta developer app exist.
//
// Env vars:
//   WHATSAPP_VERIFY_TOKEN      - any string you choose, pasted into Meta's webhook settings
//   WHATSAPP_ACCESS_TOKEN      - from the Meta app (WhatsApp > API setup)
//   WHATSAPP_PHONE_NUMBER_ID   - from the Meta app (WhatsApp > API setup)
//
// Meta webhook URL: https://<your-domain>/api/whatsapp

const { handleMessage, newSession } = require('../lib/engine');
const { llmReply } = require('../lib/llm');

const sessions = global.__waSessions || (global.__waSessions = new Map());
const TTL_MS = 6 * 60 * 60 * 1000;

function getSession(waId) {
  const hit = sessions.get(waId);
  if (hit && Date.now() - hit.touched < TTL_MS) {
    hit.touched = Date.now();
    return hit.session;
  }
  const session = newSession();
  sessions.set(waId, { session, touched: Date.now() });
  return session;
}

async function sendText(to, body) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('WhatsApp send failed', res.status, err);
  }
}

module.exports = async function handler(req, res) {
  // Webhook verification (one-time, in Meta dashboard)
  if (req.method === 'GET') {
    const q = req.query || {};
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === process.env.WHATSAPP_VERIFY_TOKEN) {
      res.status(200).send(q['hub.challenge']);
    } else {
      res.status(403).send('Forbidden');
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const entries = (body && body.entry) || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const msg of value.messages || []) {
          if (msg.type !== 'text') continue;
          const from = msg.from;
          const text = msg.text && msg.text.body;
          const session = getSession(from);
          const { replies } = await handleMessage(session, text, llmReply);
          for (const r of replies) {
            await sendText(from, r);
          }
        }
      }
    }
  } catch (e) {
    console.error('webhook error', e);
  }
  // always ack fast so Meta does not retry
  res.status(200).send('OK');
};
