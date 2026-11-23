// Evidence capture: runs the full scenario matrix against production and records
// every input + actual bot reply to /tmp/evidence.json for the test report.
// Usage: node test/evidence.js [baseUrl]

const BASE = process.argv[2] || 'https://the5vs-demo-bot.vercel.app';
const URL = BASE + '/api/chat';
const fs = require('fs');
const AR = /[\u0600-\u06FF]/;

let sid = 0;
async function send(sessionId, text) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, text }),
    });
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 6000));
      continue;
    }
    return res.json();
  }
}

const scenarios = [];
function sc(name, steps) { scenarios.push({ name, steps }); }

// same scenario set as matrix.js
sc('booking full AR', [
  { send: 'عايز أحجز ميعاد', match: /تحجز إيه/ }, { send: 'تبييض', match: /فرعين/ },
  { send: 'مدينة نصر', match: /أنهي يوم/ }, { send: 'بكره', match: /أنهي وقت/ },
  { send: '٦ مساء', match: /اسمك/ }, { send: 'محمد عودة', match: /أكدلي الحجز/ },
  { send: 'أيوه', match: /اتحجز ✅/ },
]);
sc('booking full EN', [
  { send: 'book an appointment', match: /book/i }, { send: 'cleaning', match: /branch/i },
  { send: 'new cairo', match: /day/i }, { send: 'tomorrow', match: /time/i },
  { send: '6pm', match: /name/i }, { send: 'Mohamed Ouda', match: /confirm/i },
  { send: 'yes', match: /Booked ✅/ },
]);
sc('callback full AR', [
  { send: 'عايز أكلم حد من العيادة', match: /اسمك/ }, { send: 'محمد عودة', match: /رقم موبايلك/ },
  { send: '01001234567', match: /CB-/ },
]);
sc('callback full EN', [
  { send: 'can I talk to someone at the clinic?', match: /name/i }, { send: 'Mohamed', match: /number/i },
  { send: '01001234567', match: /CB-/ },
]);
const servicesAR = [
  ['بكام الكشف؟', /٣٠٠/], ['بكام التنظيف؟', /٨٠٠/], ['بكام التبييض؟', /٣٥٠٠/],
  ['بكام الفينير؟', /٤٥٠٠/], ['بكام الزراعة؟', /١٨٠٠٠/], ['بكام التقويم؟', /٢٥٠٠٠/],
];
servicesAR.forEach(([q, re]) => sc('price AR: ' + q, [{ send: q, match: re, arabic: true }]));
const servicesEN = [
  ['how much is a consultation?', /300/], ['how much is cleaning?', /800/], ['whitening price', /3,500/],
  ['how much are veneers', /4,500/], ['implants cost', /18,000/], ['braces price', /25,000/],
];
servicesEN.forEach(([q, re]) => sc('price EN: ' + q, [{ send: q, match: re }]));
sc('branches AR', [{ send: 'فين فروعكم؟', match: /مدينة نصر.*التجمع/s, arabic: true }]);
sc('branches EN', [{ send: 'where are your branches?', match: /Nasr City.*New Cairo/is }]);
sc('hours AR', [{ send: 'مواعيد العمل؟', match: /١٠/ }]);
sc('hours EN', [{ send: 'what time do you open?', match: /10 AM/i }]);
sc('greeting AR', [{ send: 'السلام عليكم', match: /أهلاً/, arabic: true }]);
sc('greeting EN', [{ send: 'hello', match: /Welcome/i }]);

const interrupts = [
  ['price question', 'بكام الفينير؟', /٤٥٠٠/],
  ['payment question', 'أدفع إزاي؟', /مفيش دفع|دفع مقدم/],
  ['hours question', 'بتقفلوا امتى؟', /١٠|10/],
];
const bookingPrefix = {
  service: ['عايز أحجز'],
  branch: ['عايز أحجز', 'تبييض'],
  day: ['عايز أحجز', 'تبييض', 'مدينة نصر'],
  time: ['عايز أحجز', 'تبييض', 'مدينة نصر', 'بكره'],
  name: ['عايز أحجز', 'تبييض', 'مدينة نصر', 'بكره', '٦ مساء'],
  confirm: ['عايز أحجز', 'تبييض', 'مدينة نصر', 'بكره', '٦ مساء', 'محمد عودة'],
};
for (const [step, prefix] of Object.entries(bookingPrefix)) {
  for (const [iname, q, re] of interrupts) {
    sc(`interrupt @${step} with ${iname}`, [...prefix.map((m) => ({ send: m })), { send: q, match: re }]);
  }
}
sc('interrupt @branch with human request', [
  { send: 'عايز أحجز' }, { send: 'تبييض' }, { send: 'عايز أكلم حد الأول', match: /اسمك/ },
  { send: 'محمد', match: /رقم/ }, { send: '01001234567', match: /CB-/ },
]);
sc('interrupt @day with medical', [
  { send: 'عايز أحجز' }, { send: 'تبييض' }, { send: 'مدينة نصر' },
  { send: 'ضرسي بيوجعني جداً', match: /فريق|دكتور|طبي/ },
]);

sc('service step: numbers then valid', [
  { send: 'عايز أحجز' }, { send: '12345', match: /القائمة|خدماتنا/ }, { send: 'تبييض', match: /فرعين/ },
]);
sc('service step: emoji then valid', [
  { send: 'عايز أحجز' }, { send: '😂😂😂', match: /القائمة|خدماتنا|الأسعار|كشف|أكلم حد/ }, { send: 'تنظيف', match: /فرعين/ },
]);
sc('service step: two misses trigger escape', [
  { send: 'احجز' }, { send: 'حاجة مش موجودة', match: /القائمة|خدماتنا/ },
  { send: 'برضه مش موجودة', match: /الأسعار|كشف|أكلم حد/ },
]);
sc('branch step: invalid then valid', [
  { send: 'احجز' }, { send: 'تبييض' }, { send: 'xyz', match: /فرع/ }, { send: '5', match: /فرع/ },
  { send: '١', match: /أنهي يوم/ },
]);
sc('branch step: numeric word', [{ send: 'احجز' }, { send: 'تبييض' }, { send: '2', match: /أنهي يوم|Which day/ }]);
sc('name step: too short then valid', [
  { send: 'احجز' }, { send: 'تبييض' }, { send: 'مدينة نصر' }, { send: 'بكره' }, { send: '٦ مساء' },
  { send: 'م', match: /اسمك/ }, { send: 'محمد عودة', match: /أكدلي الحجز/ },
]);
sc('cb phone: letters then emoji then valid', [
  { send: 'عايز أكلم حد' }, { send: 'محمد' }, { send: 'call me maybe', match: /بالأرقام|digits/ },
  { send: '😂', match: /بالأرقام|digits/ }, { send: '01001234567', match: /CB-/ },
]);
sc('confirm step: cancel', [
  { send: 'احجز' }, { send: 'تبييض' }, { send: 'مدينة نصر' }, { send: 'بكره' }, { send: '٦ مساء' },
  { send: 'محمد عودة' }, { send: 'لا', match: /اتلغى|cancelled/ },
]);

sc('typo price', [{ send: 'بكم التبيض؟', match: /٣٥٠٠|تبييض/ }]);
sc('half-typed Arabic', [{ send: 'عايز اح', arabic: true }]);
sc('franco booking', [{ send: '3ayez a7gz mo3ad', match: /تحجز إيه/, arabic: true }]);
sc('franco price', [{ send: 'bekam el veneers', match: /٤٥٠٠|4,500/ }]);
sc('franco human', [{ send: 'momken akalem 7ad men el 3eyada', match: /اسمك|name/i }]);
sc('voice-note run-on', [
  { send: 'اه والله انا كنت عايز اسأل يعني لو سمحت الاسنان بتاعتي محتاجة تنظيف بس مش عارف بكام وامتى ممكن ايجي ولا ايه الموضوع', match: /٨٠٠|800/ },
]);
sc('rude', [{ send: 'انت غبي ومش فاهم حاجة' }]);
sc('joking', [{ send: 'ههههههه انت بتحب السندوتشات؟' }]);
sc('mixed AR-EN booking', [{ send: 'mumkin booking بكرة؟', match: /تحجز إيه|book/i }]);
sc('emoji only', [{ send: '😂😂😂' }]);
sc('spam-like', [{ send: 'FREE MONEY click here now http://spam.example win big!!!' }]);
sc('one-worder ok', [{ send: 'ok' }]);
sc('one-worder tamaam', [{ send: 'تمام' }]);
sc('one-worder question mark', [{ send: '؟' }]);
sc('one-wonder price', [{ send: 'بكام', match: /أسعارنا|٣٠٠/ }]);
sc('insurance', [{ send: 'do you accept insurance?', match: /phone|تليفون|callback|confirm/i }]);
sc('installments AR', [{ send: 'في تقسيط؟', match: /مفيش دفع|دفع مقدم/ }]);
sc('card vs cash', [{ send: 'بقبلوا فيزا ولا كاش بس؟', match: /كاش|فيزا/ }]);
sc('injection-ish', [{ send: "'; DROP TABLE bookings; --" }]);
sc('very long message', [{ send: 'عايز أعرف الأسعار '.repeat(40), match: /أسعار|٣٠٠|جنيه/ }]);
sc('repeated question 3x (LLM varies)', [
  { send: 'ما هو أفضل معجون أسنان؟', arabic: true }, { send: 'ما هو أفضل معجون أسنان؟', arabic: true },
  { send: 'ما هو أفضل معجون أسنان؟', arabic: true },
]);
sc('user payment exact 1', [{ send: 'لازم أدفع قبل الحجز ولا عادي؟', match: /مفيش دفع|مجاناً/ }]);
sc('user payment exact 2', [{ send: 'payment before booking', match: /[Nn]o payment|free/ }]);
sc('user payment exact 3', [{ send: 'أنا بسأل عن طرق الحجز', match: /مفيش دفع|مجاناً/ }]);
sc('user human exact 1', [{ send: 'can I talk to someone at the clinic?', match: /name/i }]);
sc('user human exact 2', [{ send: 'I want to talk to the doctor', match: /name/i }]);
sc('sensitive teeth franco', [{ send: '3andoko 7aga lel senan el hesasa?', arabic: true }]);
sc('english to arabic switch', [
  { send: 'hi', match: /Welcome/i }, { send: 'بكام التقويم؟', match: /٢٥٠٠٠/, arabic: true },
]);
sc('arabic to english switch', [
  { send: 'اهلا', match: /أهلاً/ }, { send: 'how much are implants?', match: /18,000/ },
]);
sc('rapid burst 5 msgs', [
  { send: 'اهلا', match: /أهلاً/ }, { send: 'بكام التبييض', match: /٣٥٠٠/ },
  { send: 'وفين الفروع', match: /مدينة نصر/ }, { send: 'تمام عايز أحجز', match: /تحجز إيه/ },
  { send: 'كشف', match: /فرعين/ },
]);
sc('empty message', [{ send: '', emptyOk: true }]);
sc('whitespace message', [{ send: '   ', emptyOk: true }]);

(async () => {
  const out = [];
  let pass = 0;
  for (const s of scenarios) {
    const sessionId = `evidence-${Date.now()}-${sid++}`;
    const record = { name: s.name, steps: [], pass: true };
    for (const step of s.steps) {
      let replies = [];
      try {
        const json = await send(sessionId, step.send);
        replies = (json && json.replies) || [];
      } catch (e) {
        replies = ['<request failed: ' + e.message + '>'];
      }
      const joined = replies.join('\n');
      let ok = true;
      if (!step.emptyOk) {
        if (!joined.trim()) ok = false;
        if (joined.includes('عذراً، حصل خطأ')) ok = false;
        if (step.match && !step.match.test(joined)) ok = false;
        if (step.arabic && !AR.test(joined)) ok = false;
      }
      record.steps.push({ send: step.send, reply: joined, ok });
      if (!ok) record.pass = false;
      await new Promise((r) => setTimeout(r, 250));
    }
    if (record.pass) pass++;
    out.push(record);
    console.log((record.pass ? 'pass  ' : 'FAIL  ') + s.name);
  }
  fs.writeFileSync('/tmp/evidence.json', JSON.stringify({ base: BASE, at: new Date().toISOString(), total: out.length, passed: pass, scenarios: out }, null, 1));
  console.log(`\n${pass}/${out.length} passed, evidence at /tmp/evidence.json`);
})();
