// Exhaustive validation matrix against the LIVE deployment.
// Usage: node test/matrix.js [baseUrl]
// Every scenario: a fresh session, a list of user messages, and per-message checks.
// Global rules on every scenario: no empty replies, no error placeholder, no identical
// consecutive bot paragraphs within a session. Prints a scoreboard.

const BASE = process.argv[2] || 'https://the5vs-demo-bot.vercel.app';
const URL = BASE + '/api/chat';

const ERROR_PLACEHOLDER = 'عذراً، حصل خطأ';

let sid = 0;
async function send(sessionId, text) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, text }),
  });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 6000));
    const res2 = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, text }),
    });
    return res2.json();
  }
  return res.json();
}

// check: { match: /re/, arabic: true, english: true } applied to joined replies of that step
const scenarios = [];
function sc(name, steps) {
  scenarios.push({ name, steps });
}
// steps: [ { send: '...', match?: /re/i, arabic?: bool, english?: bool, emptyOk?: bool } ]

const AR = /[\u0600-\u06FF]/;

// ---------- A. core flows end to end ----------
sc('booking full AR', [
  { send: 'عايز أحجز ميعاد', match: /تحجز إيه/ },
  { send: 'تبييض', match: /فرعين/ },
  { send: 'مدينة نصر', match: /أنهي يوم/ },
  { send: 'بكره', match: /أنهي وقت/ },
  { send: '٦ مساء', match: /اسمك/ },
  { send: 'محمد عودة', match: /أكدلي الحجز/ },
  { send: 'أيوه', match: /اتحجز ✅/ },
]);
sc('booking full EN', [
  { send: 'book an appointment', match: /book/i },
  { send: 'cleaning', match: /branch/i },
  { send: 'new cairo', match: /day/i },
  { send: 'tomorrow', match: /time/i },
  { send: '6pm', match: /name/i },
  { send: 'Mohamed Ouda', match: /confirm/i },
  { send: 'yes', match: /Booked ✅/ },
]);
sc('callback full AR', [
  { send: 'عايز أكلم حد من العيادة', match: /اسمك/ },
  { send: 'محمد عودة', match: /رقم موبايلك/ },
  { send: '01001234567', match: /CB-/ },
]);
sc('callback full EN', [
  { send: 'can I talk to someone at the clinic?', match: /name/i },
  { send: 'Mohamed', match: /number/i },
  { send: '01001234567', match: /CB-/ },
]);
const servicesAR = [
  ['بكام الكشف؟', /٣٠٠/],
  ['بكام التنظيف؟', /٨٠٠/],
  ['بكام التبييض؟', /٣٥٠٠/],
  ['بكام الفينير؟', /٤٥٠٠/],
  ['بكام الزراعة؟', /١٨٠٠٠/],
  ['بكام التقويم؟', /٢٥٠٠٠/],
];
servicesAR.forEach(([q, re], i) => sc('price AR ' + i + ': ' + q, [{ send: q, match: re, arabic: true }]));
const servicesEN = [
  ['how much is a consultation?', /300/],
  ['how much is cleaning?', /800/],
  ['whitening price', /3,500/],
  ['how much are veneers', /4,500/],
  ['implants cost', /18,000/],
  ['braces price', /25,000/],
];
servicesEN.forEach(([q, re], i) => sc('price EN ' + i + ': ' + q, [{ send: q, match: re }]));
sc('branches AR', [{ send: 'فين فروعكم؟', match: /مدينة نصر.*التجمع/s, arabic: true }]);
sc('branches EN', [{ send: 'where are your branches?', match: /Nasr City.*New Cairo/is }]);
sc('hours AR', [{ send: 'مواعيد العمل؟', match: /١٠ صباحاً|١٠/ }]);
sc('hours EN', [{ send: 'what time do you open?', match: /10 AM/i }]);
sc('greeting AR', [{ send: 'السلام عليكم', match: /أهلاً/, arabic: true }]);
sc('greeting EN', [{ send: 'hello', match: /Welcome/i }]);

// ---------- B. booking interrupted at every step with every interrupt type ----------
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
    sc(`interrupt @${step} with ${iname}`, [
      ...prefix.map((m) => ({ send: m })),
      { send: q, match: re },
    ]);
  }
}
sc('interrupt @branch with human request', [
  { send: 'عايز أحجز' },
  { send: 'تبييض' },
  { send: 'عايز أكلم حد الأول', match: /اسمك/ },
  { send: 'محمد', match: /رقم/ },
  { send: '01001234567', match: /CB-/ },
]);
sc('interrupt @day with medical', [
  { send: 'عايز أحجز' },
  { send: 'تبييض' },
  { send: 'مدينة نصر' },
  { send: 'ضرسي بيوجعني جداً', match: /فريق|دكتور|طبي/ },
]);

// ---------- C. wrong input types at collection steps ----------
sc('service step: numbers then valid', [
  { send: 'عايز أحجز' },
  { send: '12345', match: /القائمة|خدماتنا/ },
  { send: 'تبييض', match: /فرعين/ },
]);
sc('service step: emoji then valid', [
  { send: 'عايز أحجز' },
  { send: '😂😂😂', match: /القائمة|خدماتنا|الأسعار|كشف|أكلم حد/ },
  { send: 'تنظيف', match: /فرعين/ },
]);
sc('service step: two misses trigger escape', [
  { send: 'احجز' },
  { send: 'حاجة مش موجودة', match: /القائمة|خدماتنا/ },
  { send: 'برضه مش موجودة', match: /الأسعار|كشف|أكلم حد/ },
]);
sc('branch step: invalid then valid', [
  { send: 'احجز' },
  { send: 'تبييض' },
  { send: 'xyz', match: /فرع/ },
  { send: '5', match: /فرع/ },
  { send: '١', match: /أنهي يوم/ },
]);
sc('branch step: numeric word', [
  { send: 'احجز' },
  { send: 'تبييض' },
  { send: '2', match: /أنهي يوم|Which day/ },
]);
sc('name step: too short then valid', [
  { send: 'احجز' },
  { send: 'تبييض' },
  { send: 'مدينة نصر' },
  { send: 'بكره' },
  { send: '٦ مساء' },
  { send: 'م', match: /اسمك/ },
  { send: 'محمد عودة', match: /أكدلي الحجز/ },
]);
sc('cb phone: letters then emoji then valid', [
  { send: 'عايز أكلم حد' },
  { send: 'محمد' },
  { send: 'call me maybe', match: /بالأرقام|digits/ },
  { send: '😂', match: /بالأرقام|digits/ },
  { send: '01001234567', match: /CB-/ },
]);
sc('confirm step: cancel', [
  { send: 'احجز' },
  { send: 'تبييض' },
  { send: 'مدينة نصر' },
  { send: 'بكره' },
  { send: '٦ مساء' },
  { send: 'محمد عودة' },
  { send: 'لا', match: /اتلغى|cancelled/ },
]);

// ---------- D. adversarial one-offs ----------
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
  { send: 'ما هو أفضل معجون أسنان؟', arabic: true },
  { send: 'ما هو أفضل معجون أسنان؟', arabic: true },
  { send: 'ما هو أفضل معجون أسنان؟', arabic: true },
]);
sc('user payment exact 1', [{ send: 'لازم أدفع قبل الحجز ولا عادي؟', match: /مفيش دفع|مجاناً/ }]);
sc('user payment exact 2', [{ send: 'payment before booking', match: /[Nn]o payment|free/ }]);
sc('user payment exact 3', [{ send: 'أنا بسأل عن طرق الحجز', match: /مفيش دفع|مجاناً/ }]);
sc('user human exact 1', [{ send: 'can I talk to someone at the clinic?', match: /name/i }]);
sc('user human exact 2', [{ send: 'I want to talk to the doctor', match: /name/i }]);
sc('sensitive teeth franco', [{ send: '3andoko 7aga lel senan el hesasa?', arabic: true }]);
sc('english to arabic switch', [
  { send: 'hi', match: /Welcome/i },
  { send: 'بكام التقويم؟', match: /٢٥٠٠٠/, arabic: true },
]);
sc('arabic to english switch', [
  { send: 'اهلا', match: /أهلاً/ },
  { send: 'how much are implants?', match: /18,000/ },
]);

// ---------- E. rapid burst ----------
sc('rapid burst 5 msgs', [
  { send: 'اهلا', match: /أهلاً/ },
  { send: 'بكام التبييض', match: /٣٥٠٠/ },
  { send: 'وفين الفروع', match: /مدينة نصر/ },
  { send: 'تمام عايز أحجز', match: /تحجز إيه/ },
  { send: 'كشف', match: /فرعين/ },
]);

// ---------- F. session edge cases ----------
sc('empty message', [{ send: '', emptyOk: true }]);
sc('whitespace message', [{ send: '   ', emptyOk: true }]);

(async () => {
  let pass = 0;
  const failures = [];
  for (const s of scenarios) {
    const sessionId = `matrix-${Date.now()}-${sid++}`;
    let prevJoined = null;
    let scenarioFails = [];
    for (let i = 0; i < s.steps.length; i++) {
      const step = s.steps[i];
      let json;
      try {
        json = await send(sessionId, step.send);
      } catch (e) {
        scenarioFails.push(`step ${i + 1}: request failed ${e.message}`);
        continue;
      }
      const replies = (json && json.replies) || [];
      const joined = replies.join('\n---\n');
      if (!step.emptyOk) {
        if (!joined.trim()) scenarioFails.push(`step ${i + 1} ("${step.send.slice(0, 30)}"): empty reply`);
        if (joined.includes(ERROR_PLACEHOLDER)) scenarioFails.push(`step ${i + 1}: error placeholder`);
        if (step.match && !step.match.test(joined)) scenarioFails.push(`step ${i + 1} ("${step.send.slice(0, 30)}"): expected ${step.match}, got: ${joined.slice(0, 140)}`);
        if (step.arabic && !AR.test(joined)) scenarioFails.push(`step ${i + 1} ("${step.send.slice(0, 30)}"): expected Arabic, got: ${joined.slice(0, 100)}`);
        if (prevJoined && joined === prevJoined && joined.length > 0) scenarioFails.push(`step ${i + 1} ("${step.send.slice(0, 30)}"): identical reply repeated twice in a row`);
      } else if (joined.trim()) {
        // empty input should produce no reply; tolerate but note
      }
      if (joined.trim()) prevJoined = joined;
      await new Promise((r) => setTimeout(r, 250));
    }
    if (scenarioFails.length) {
      failures.push({ name: s.name, fails: scenarioFails });
      console.log(`FAIL  ${s.name}`);
      scenarioFails.forEach((f) => console.log('      - ' + f));
    } else {
      pass++;
      console.log(`pass  ${s.name}`);
    }
  }
  console.log('\n================ SCOREBOARD ================');
  console.log(`scenarios: ${scenarios.length}  passed: ${pass}  failed: ${failures.length}`);
  if (failures.length) process.exit(1);
})();
