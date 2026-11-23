// Web prototype backend: POST /api/chat { sessionId, text } -> { replies: string[] }
// Powers the WhatsApp-style simulation page in /public.
// Session state is in-memory (fine for a demo); see README for the Redis upgrade.

const { handleMessage, newSession } = require('../lib/engine');
const { llmReply } = require('../lib/llm');

const sessions = global.__demoSessions || (global.__demoSessions = new Map());
const TTL_MS = 60 * 60 * 1000;

function getSession(id) {
  const hit = sessions.get(id);
  if (hit && Date.now() - hit.touched < TTL_MS) {
    hit.touched = Date.now();
    return hit.session;
  }
  const session = newSession();
  sessions.set(id, { session, touched: Date.now() });
  if (sessions.size > 500) {
    for (const [k, v] of sessions) {
      if (Date.now() - v.touched > TTL_MS) sessions.delete(k);
    }
  }
  return session;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const sessionId = String(body.sessionId || 'anon').slice(0, 80);
    const text = String(body.text || '').slice(0, 1000);
    const session = getSession(sessionId);
    const { replies } = await handleMessage(session, text, llmReply);
    res.status(200).json({ replies });
  } catch (e) {
    res.status(200).json({ replies: ['عذراً، حصل خطأ. جرب تاني من فضلك. / Sorry, something went wrong, please try again.'] });
  }
};
