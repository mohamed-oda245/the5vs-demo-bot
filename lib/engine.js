// Conversation engine for the the5vs clinic demo bot.
// Shared by the web prototype (api/chat.js) and the WhatsApp adapter (api/whatsapp.js).
// Pure logic, no I/O: handleMessage(session, text) -> { session, replies: string[] }

const { clinic } = require('./clinic');

const AR_RE = /[\u0600-\u06FF]/;

function isArabic(text) {
  return AR_RE.test(text);
}

function norm(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

function hasAny(text, words) {
  const n = norm(text);
  return words.some((w) => n.includes(norm(w)));
}

const INTENTS = {
  greeting: ['اهلا', 'مرحبا', 'هاي', 'ازيك', 'صباح', 'مساء', 'hello', 'hi', 'hey', 'salam', 'السلام'],
  thanks: ['شكرا', 'متشكر', 'thanks', 'thank you', 'thx'],
  hours: ['مواعيد العمل', 'مواعيد', 'ساعات', 'بتفتحوا', 'بتقفلوا', 'شغالين', 'hours', 'open', 'opening', 'working'],
  location: ['فين', 'عنوان', 'مكان', 'فرع', 'فروع', 'location', 'address', 'branch', 'branches', 'where'],
  price: ['سعر', 'اسعار', 'بكام', 'تكلفه', 'تكلفة', 'فلوس', 'price', 'prices', 'cost', 'how much', 'fee', 'fees', 'bekam', 'bkam'],
  booking: ['احجز', 'حجز', 'ميعاد', 'موعد', 'book', 'booking', 'appointment', 'reserve', 'schedule', 'a7gz', 'ahgz', '7agz', '7gz'],
  payment: [
    'دفع', 'ادفع', 'يدفع', 'عربون', 'مقدم', 'تقسيط', 'اقساط', 'قسط', 'كاش', 'نقدي', 'فيزا', 'ماستر', 'كارت', 'كارد', 'بطاقه',
    'انستاباي', 'فوري', 'محفظه', 'تامين', 'pay', 'payment', 'cash', 'card', 'visa', 'mastercard', 'installment', 'deposit',
    'fawry', 'instapay', 'wallet', 'insurance',
  ],
  methodWords: ['طريقه', 'طرق', 'وسيله', 'وسائل', 'ازاي', 'كيف', 'method', 'methods', 'how do', 'how to', 'how can'],
  human: [
    'دكتور', 'انسان', 'بني ادم', 'حد يرد', 'اكلم', 'اتكلم', 'يكلم', 'تكلم', 'اتصل', 'يتصل', 'كلموني', 'موظف', 'ريسبشن', 'استقبال', 'تلفون', 'تليفون', 'رقم',
    'akalem', 'akallim', 'aklm', 'etsele',
    'human', 'agent', 'person', 'someone', 'somebody', 'real', 'call me', 'speak', 'talk', 'doctor', 'staff', 'reception', 'phone',
  ],
  medical: [
    // note: short words like 'الم' (pain) are deliberately avoided - they substring-match innocent words like 'الموضوع'
    'وجع', 'بيوجع', 'بتوجع', 'توجع', 'موجوع', 'متالم', 'الام', 'ورم', 'منتفخ', 'نزيف', 'بيضرب', 'حامل', 'مضاد',
    'pain', 'hurts', 'hurt', 'swelling', 'swollen', 'bleeding', 'pregnant', 'antibiotic', 'infection', 'emergency',
  ],
};

function pick(arr, seed) {
  return arr[Math.abs(seed || 0) % arr.length];
}

function refCode() {
  return clinic.bookingRefPrefix + '-' + Math.floor(1000 + Math.random() * 9000);
}

function newSession() {
  return {
    lang: null, // 'ar' | 'en', sticks after first message
    flow: null, // null | 'service' | 'branch' | 'day' | 'time' | 'name' | 'confirm' | 'cb_name' | 'cb_phone'
    booking: {}, // { serviceId, branchId, day, time, name }
    callback: {}, // { name, phone } for the human callback flow
    flowFails: 0, // consecutive unhandled messages inside a flow; 2 strikes exits the flow
    turns: 0,
    handedOff: false,
  };
}

function L(session, ar, en) {
  return session.lang === 'en' ? en : ar;
}

function servicesListAr() {
  return clinic.services.map((s) => `• ${s.ar}: ${s.priceAr}`).join('\n');
}
function servicesListEn() {
  return clinic.services.map((s) => `• ${cap(s.en)}: ${s.priceEn}`).join('\n');
}
function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function branchListAr() {
  return clinic.branches.map((b, i) => `${i + 1}️⃣ ${b.ar}`).join('\n');
}
function branchListEn() {
  return clinic.branches.map((b, i) => `${i + 1}️⃣ ${b.en}`).join('\n');
}

function matchService(text) {
  const n = norm(text);
  return clinic.services.find((s) => s.keywords.some((k) => n.includes(norm(k))));
}

function matchBranch(text) {
  const n = norm(text);
  const byKeyword = clinic.branches.find((b) => b.keywords.some((k) => n.includes(norm(k))));
  if (byKeyword) return byKeyword;
  // also accept "1" / "2" / "١" / "٢"
  const digits = { '١': 1, '٢': 2, '1': 1, '2': 2 };
  const d = digits[text.trim()];
  return d ? clinic.branches[d - 1] : null;
}

function handoffReply(session) {
  session.handedOff = true;
  return pick(
    [
      L(
        session,
        `ده سؤال يستاهل رأي طبي، ومش هينفع أفتي فيه. حولت رسالتك لفريق ${clinic.nameAr} وهيكلموك في أقرب وقت خلال مواعيد العمل (${clinic.hoursAr}). لو حابب تحجز كشف بدل ما تستنى، قولي "احجز".`,
        `That one deserves a doctor's answer, and I won't guess on medical questions. I've passed your message to the ${clinic.nameEn} team and they'll reach out during working hours (${clinic.hoursEn}). If you'd rather book a consultation now, just say "book".`
      ),
      L(
        session,
        `دي حاجة لازم دكتور يشوفها بنفسه، ومش صح أخمن فيها. وصلت رسالتك للفريق الطبي وهيردوا عليك في أقرب وقت. ولو الوجع محتاج كشف، أقدر أحجزلك ميعاد دلوقتي، قولي "احجز".`,
        `This needs a doctor to look at it properly, and I shouldn't guess. Your message reached our medical team and they'll get back to you shortly. If it needs a visit, I can book you right now, just say "book".`
      ),
    ],
    session.turns
  );
}

// ---- human callback flow ----
// Asking for a person is a buying signal: collect name + number and promise a team call back.

function startCallback(session) {
  session.flow = 'cb_name';
  session.callback = {};
  return pick(
    [
      L(
        session,
        'أكيد! هظبطلك مكالمة من فريق العيادة. الأول، اسمك الكريم؟',
        'Of course! I will arrange a call from the clinic team. First, may I have your name?'
      ),
      L(
        session,
        'تحت أمرك! حد من فريقنا هيكلمك بنفسه. ممكن اسمك الأول؟',
        'Absolutely! Someone from our team will call you personally. May I start with your name?'
      ),
    ],
    session.turns
  );
}

function askCbPhone(session) {
  session.flow = 'cb_phone';
  return pick(
    [
      L(session, 'تمام يا ' + (session.callback.name || '') + '! ورقم موبايلك عشان الفريق يكلمك عليه؟',
        'Thanks ' + (session.callback.name || '') + '! And your mobile number so the team can reach you?'),
      L(session, 'تشرفنا يا ' + (session.callback.name || '') + '. ابعتلي رقم تليفونك والفريق هيتصل بيك.',
        'Nice to meet you, ' + (session.callback.name || '') + '. Send me your phone number and the team will call you.'),
    ],
    session.turns
  );
}

function cbDone(session) {
  const ref = 'CB-' + Math.floor(1000 + Math.random() * 9000);
  const c = session.callback;
  session.flow = null;
  session.handedOff = true;
  const out = pick(
    [
      L(
        session,
        `اتسجل طلبك ✅\nرقم الطلب: ${ref}\nفريق ${clinic.nameAr} هيتصل بيك على ${c.phone} خلال مواعيد العمل (${clinic.hoursAr}). ولو حابب تحجز ميعاد بنفسك دلوقتي، قولي "احجز".`,
        `Your callback request is in ✅\nReference: ${ref}\nThe ${clinic.nameEn} team will call you on ${c.phone} during working hours (${clinic.hoursEn}). If you'd rather book an appointment yourself right now, just say "book".`
      ),
      L(
        session,
        `تمام يا ${c.name} ✅ طلب المكالمة رقم ${ref} اتسجل، وحد من فريقنا هيكلمك على ${c.phone} في أقرب وقت خلال مواعيد العمل. تحب أحجزلك كشف كمان؟`,
        `Done, ${c.name} ✅ Callback request ${ref} is logged, and someone from our team will call you on ${c.phone} as soon as possible during working hours. Want me to book you a consultation too?`
      ),
    ],
    session.turns
  );
  session.callback = {};
  return out;
}

function greetingReply(session) {
  return L(
    session,
    `أهلاً بيك في ${clinic.nameAr} 🦷 أنا المساعد الذكي للعيادة. أقدر أرد على أسئلتك عن الأسعار والفروع والمواعيد، وأحجزلك ميعاد في أقل من دقيقة. اسألني براحتك، بالعربي أو الإنجليزي.`,
    `Welcome to ${clinic.nameEn} 🦷 I'm the clinic's AI assistant. I can answer questions about prices, branches and hours, and book you an appointment in under a minute. Ask me anything, in English or Arabic.`
  );
}

function priceReply(session, service) {
  if (service) {
    return L(
      session,
      `${service.ar}: ${service.priceAr}. لو حابب تحجز، قولي "احجز" وأنا أظبطلك ميعاد.`,
      `${cap(service.en)}: ${service.priceEn}. If you'd like to book, just say "book" and I'll set you up.`
    );
  }
  return L(
    session,
    `دي أسعارنا:\n${servicesListAr()}\n\nولو عايز تحجز كشف أو أي خدمة، قولي "احجز".`,
    `Here are our prices:\n${servicesListEn()}\n\nTo book a consultation or any service, just say "book".`
  );
}

function startBooking(session, service) {
  session.flow = 'branch';
  session.booking = {};
  if (service) session.booking.serviceId = service.id;
  else session.flow = 'service';
  if (session.flow === 'service') {
    return L(
      session,
      `تمام! تحجز إيه؟ اختار من خدماتنا:\n${servicesListAr()}`,
      `Great! What would you like to book?\n${servicesListEn()}`
    );
  }
  return askBranch(session);
}

function askBranch(session) {
  session.flow = 'branch';
  return L(
    session,
    `عندنا فرعين، أنهي واحد أقربلك؟\n${branchListAr()}`,
    `We have two branches, which works for you?\n${branchListEn()}`
  );
}

function askDay(session) {
  session.flow = 'day';
  return pick(
    [
      L(session, `ممتاز. أنهي يوم يناسبك؟ (مثلاً: النهارده، بكره، السبت)`,
        `Which day suits you? (e.g. today, tomorrow, Saturday)`),
      L(session, `تمام. تحب الميعاد يبقى أنهي يوم؟`, `Great. What day works for you?`),
    ],
    session.turns
  );
}

function askTime(session) {
  session.flow = 'time';
  return pick(
    [
      L(session, `وأنهي وقت؟ ${clinic.hoursAr}.`, `And what time? We're open ${clinic.hoursEn}.`),
      L(session, `الساعة كام تريحك؟ ${clinic.hoursAr}.`, `What time works best? We're open ${clinic.hoursEn}.`),
    ],
    session.turns
  );
}

function askName(session) {
  session.flow = 'name';
  return pick(
    [
      L(session, 'تمام، آخر خطوة: اسمك الكريم؟', 'Almost done, may I have your name?'),
      L(session, 'ممكن اسمك عشان نسجل الحجز؟', 'Could I have your name to register the booking?'),
    ],
    session.turns
  );
}

function confirmCard(session) {
  const b = session.booking;
  const svc = clinic.services.find((s) => s.id === b.serviceId);
  const br = clinic.branches.find((x) => x.id === b.branchId);
  session.flow = 'confirm';
  return L(
    session,
    `أكدلي الحجز لو سمحت:\n\n👤 ${b.name}\n🦷 ${svc ? svc.ar : ''}\n📍 ${br ? br.ar : ''}\n📅 ${b.day} - ${b.time}\n\nصح كده؟ (قولي "أيوه" أو "لا")`,
    `Please confirm your booking:\n\n👤 ${b.name}\n🦷 ${svc ? cap(svc.en) : ''}\n📍 ${br ? br.en : ''}\n📅 ${b.day} at ${b.time}\n\nIs that right? (say "yes" or "no")`
  );
}

function doneReply(session) {
  const ref = refCode();
  const b = session.booking;
  const br = clinic.branches.find((x) => x.id === b.branchId);
  session.flow = null;
  const out = L(
    session,
    `اتحجز ✅\nرقم الحجز: ${ref}\nهيتصل بيك فريقنا على رقمك للتأكيد قبل الميعاد. عنوان الفرع: ${br ? br.ar : ''}\nلو محتاج تلغي أو تغير الميعاد في أي وقت، ابعتلي هنا.`,
    `Booked ✅\nReference: ${ref}\nOur team will call you to confirm before the appointment. Branch address: ${br ? br.en : ''}\nIf you need to cancel or reschedule any time, just message me here.`
  );
  session.booking = {};
  return out;
}

function paymentReply(session) {
  return pick(
    [
      L(
        session,
        `الحجز مجاني ومن غير أي دفع مقدم ✅ بتحجز ميعادك من هنا، وبتدفع في العيادة بعد ما تخلص، كاش أو كارت. ولو بتسأل عن التقسيط أو التأمين، فريقنا بيأكدلك التفاصيل على التليفون. تحب أحجزلك ميعاد دلوقتي؟`,
        `Booking is free, no prepayment needed ✅ You book your slot here, and pay at the clinic after your visit, cash or card. For installments or insurance coverage, our team confirms the details by phone. Want me to book you now?`
      ),
      L(
        session,
        `مفيش دفع قبل الميعاد خالص. الحجز بيتم هنا مجاناً، والحساب في العيادة بعد الزيارة، كاش أو فيزا زي ما يريحك. التقسيط والتأمين بيتأكدوا تليفونياً من فريقنا. قولي "احجز" لو حابب تظبط ميعاد.`,
        `No payment before the appointment at all. Booking happens here for free, and you settle at the clinic after the visit, cash or visa, whatever suits you. Installments and insurance get confirmed by phone from our team. Say "book" if you'd like to set a time.`
      ),
    ],
    session.turns
  );
}

// a payment/policy question is never a booking start, even when it mentions booking
function isPaymentQuestion(text) {
  if (hasAny(text, INTENTS.payment)) return true;
  return hasAny(text, INTENTS.booking) && hasAny(text, INTENTS.methodWords);
}

// informational questions that get answered even mid-flow, then the flow resumes
function infoQuestion(text) {
  if (isPaymentQuestion(text)) return 'payment';
  if (hasAny(text, INTENTS.price)) return 'price';
  if (hasAny(text, INTENTS.hours)) return 'hours';
  if (hasAny(text, INTENTS.location)) return 'location';
  return null;
}

function questionish(text) {
  return (
    /[؟?]/.test(text) ||
    hasAny(text, ['بكام', 'ازاي', 'امتى', 'فين', 'ليه', 'عايز اعرف', 'how', 'what', 'where', 'when', 'why', 'can i', 'do you', 'is there', 'could'])
  );
}

function hoursReply(session) {
  return L(session, `مواعيد العمل: ${clinic.hoursAr}. تحب أحجزلك ميعاد؟`,
    `We're open ${clinic.hoursEn}. Want me to book you an appointment?`);
}

function locationReply(session) {
  return L(session, `فروعنا:\n${branchListAr()}\n\nمواعيد العمل: ${clinic.hoursAr}`,
    `Our branches:\n${branchListEn()}\n\nHours: ${clinic.hoursEn}`);
}

function infoReply(session, q, text) {
  if (q === 'payment') return paymentReply(session);
  if (q === 'price') return priceReply(session, matchService(text));
  if (q === 'hours') return hoursReply(session);
  return locationReply(session);
}

// ---- booking flow state machine ----

// re-ask the current flow step after answering an interrupting question
function reAsk(session) {
  switch (session.flow) {
    case 'service':
      return L(session, 'نرجع للحجز: تحجز إيه؟\n' + servicesListAr(),
        'Back to your booking: what would you like to book?\n' + servicesListEn());
    case 'branch':
      return askBranch(session);
    case 'day':
      return askDay(session);
    case 'time':
      return askTime(session);
    case 'name':
      return askName(session);
    case 'confirm':
      return confirmCard(session);
    case 'cb_name':
      return L(session, 'نكمل: اسمك الكريم؟', 'To continue: may I have your name?');
    case 'cb_phone':
      return L(session, 'نكمل: ابعتلي رقم موبايلك بالأرقام.', 'To continue: send me your mobile number in digits.');
    default:
      return null;
  }
}

function handleFlow(session, text) {
  const f = session.flow;
  if (f === 'cb_name') {
    const name = text.trim();
    if (name.length < 2) return startCallback(session);
    session.callback.name = name;
    return askCbPhone(session);
  }
  if (f === 'cb_phone') {
    const digits = (text.match(/[0-9٠-٩]/g) || []).length;
    if (digits < 8) {
      return pick(
        [
          L(session, 'الرقم ده مش واضح، ممكن تكتب رقم الموبايل بالأرقام؟ (مثال: 01001234567)',
            'That number does not look complete, could you type the mobile number in digits? (e.g. 01001234567)'),
          L(session, 'محتاج رقم موبايل صحيح عشان الفريق يقدر يكلمك. ابعته بالأرقام لو سمحت (مثال: 01001234567)',
            'I need a valid mobile number so the team can call you. Please send it in digits (e.g. 01001234567)'),
        ],
        session.turns
      );
    }
    session.callback.phone = text.trim();
    return cbDone(session);
  }
  if (f === 'service') {
    const svc = matchService(text);
    if (!svc) {
      session.flowFails = (session.flowFails || 0) + 1;
      if (session.flowFails >= 2) {
        session.flow = null;
        session.booking = {};
        session.flowFails = 0;
        return L(
          session,
          'واضح إني مش لاقي الخدمة دي في قائمتنا. خلينا نعملها صح: تقدر تسألني عن الأسعار، أو أحجزلك كشف (' + clinic.services[0].priceAr + ') والدكتور يحددلك المطلوب، أو أسجللك مكالمة من الفريق لو قلتلي "أكلم حد".',
          'I cannot find that service in our list. Let me help another way: ask me about prices, or I can book you a consultation (' + clinic.services[0].priceEn + ') and the doctor will work out what you need, or I can arrange a team callback if you say "talk to someone".'
        );
      }
      return pick(
        [
          L(session, 'مش متأكد فهمت الخدمة. اختار من القائمة دي لو سمحت:\n' + servicesListAr(),
            'I did not catch the service. Please pick one from the list:\n' + servicesListEn()),
          L(session, 'دي مش واضحة عندي كخدمة. دي خدماتنا، اختار منها، أو لو محتاج حاجة تانية قولي "أكلم حد":\n' + servicesListAr(),
            'That does not ring a bell as a service. Here is what we offer, pick one, or say "talk to someone" if you need something else:\n' + servicesListEn()),
        ],
        session.turns
      );
    }
    session.flowFails = 0;
    session.booking.serviceId = svc.id;
    return askBranch(session);
  }
  if (f === 'branch') {
    const br = matchBranch(text);
    if (!br) {
      return pick(
        [
          L(session, 'أنهي فرع؟ رد بـ ١ أو ٢:\n' + branchListAr(), 'Which branch? Reply 1 or 2:\n' + branchListEn()),
          L(session, 'معلش، محتاج أعرف الفرع الأول. اختار:\n' + branchListAr(),
            'Sorry, I need the branch first. Pick one:\n' + branchListEn()),
        ],
        session.turns
      );
    }
    session.booking.branchId = br.id;
    return askDay(session);
  }
  if (f === 'day') {
    if (!text.trim()) return askDay(session);
    session.booking.day = text.trim();
    return askTime(session);
  }
  if (f === 'time') {
    if (!text.trim()) return askTime(session);
    session.booking.time = text.trim();
    return askName(session);
  }
  if (f === 'name') {
    const name = text.trim();
    if (name.length < 2) return askName(session);
    session.booking.name = name;
    return confirmCard(session);
  }
  if (f === 'confirm') {
    if (hasAny(text, ['ايوه', 'اه', 'نعم', 'صح', 'تمام', 'yes', 'yeah', 'correct', 'ok', 'okay', 'confirm'])) {
      return doneReply(session);
    }
    if (hasAny(text, ['لا', 'لأ', 'غلط', 'no', 'wrong', 'cancel', 'الغي'])) {
      session.flow = null;
      session.booking = {};
      return L(session, 'مفيش مشكلة، الحجز اتلغى. لو حبيت تبدأ من الأول، قولي "احجز".',
        'No problem, booking cancelled. Say "book" whenever you want to start over.');
    }
    return pick(
      [
        L(session, 'قولي "أيوه" للتأكيد أو "لا" للإلغاء.', 'Please say "yes" to confirm or "no" to cancel.'),
        L(session, 'أكدلي بـ "أيوه" أو الغي بـ "لا".', 'Confirm with "yes" or cancel with "no".'),
      ],
      session.turns
    );
  }
  session.flow = null;
  return null;
}

// ---- main entry ----

async function handleMessage(session, rawText, llm) {
  const text = (rawText || '').trim();
  if (!text) return { session, replies: [] };

  // lock language on first real message; switch if user clearly switches.
  // pure digits/symbols (a phone number, a "1"/"2" menu reply) never flip the language.
  // Franco-Arab (Arabic typed in Latin letters with 2/3/5/7, like "3ayez a7gz") counts as Arabic.
  const hasAr = isArabic(text);
  const hasEn = /[a-zA-Z]/.test(text);
  const francoWords = ['bekam', 'bkam', '3ayez', '3awez', 'momken', '3eyada', 'mo3ad', 'senan', 'asnan', 'akalem', 'akallim', 'etsele', '7aga', 'a7gz'];
  const franco =
    !hasAr &&
    hasEn &&
    ((/([a-zA-Z]+[2357][a-zA-Z]+|[2357][a-zA-Z]{2,})/.test(text) && !/\b\d{1,2}\s?(am|pm)\b/i.test(text)) ||
      hasAny(text, francoWords));
  const wantsAr = hasAr || franco;
  if (!session.lang) session.lang = wantsAr ? 'ar' : 'en';
  else if (wantsAr && session.lang !== 'ar') session.lang = 'ar';
  // inside a flow, short latin tokens ("xyz", "ok") are answers, not a language switch
  else if (hasEn && !wantsAr && session.lang !== 'en' && (!session.flow || text.length >= 15)) session.lang = 'en';

  session.turns += 1;
  const replies = [];
  const push = (r) => r && replies.push(r);

  // in a flow, the state machine owns the message
  if (session.flow) {
    // allow medical emergencies to interrupt the flow
    if (hasAny(text, INTENTS.medical)) {
      session.flow = null;
      session.booking = {};
      session.callback = {};
      session.flowFails = 0;
      push(handoffReply(session));
      return { session, replies };
    }
    // informational questions mid-flow get an answer, then the flow resumes its question
    const q = infoQuestion(text);
    if (q) {
      const isRealAnswerForStep =
        (session.flow === 'branch' && matchBranch(text)) ||
        (session.flow === 'service' && matchService(text) && q !== 'price') ||
        ((session.flow === 'name' || session.flow === 'confirm') && !questionish(text) && q !== 'payment');
      if (!isRealAnswerForStep) {
        if (session.flow === 'service' && matchService(text) && q === 'price') {
          // "how much is whitening?" at the service step: answer, then continue with that service
          push(priceReply(session, matchService(text)));
          session.booking.serviceId = matchService(text).id;
          push(askBranch(session));
          return { session, replies };
        }
        push(infoReply(session, q, text));
        push(reAsk(session));
        return { session, replies };
      }
    }
    // asking for a person mid-flow switches to the callback flow
    if (session.flow !== 'cb_name' && session.flow !== 'cb_phone' && hasAny(text, INTENTS.human)) {
      session.booking = {};
      session.flowFails = 0;
      push(startCallback(session));
      return { session, replies };
    }
    push(handleFlow(session, text));
    return { session, replies };
  }

  const svc = matchService(text);

  if (hasAny(text, INTENTS.medical)) {
    push(handoffReply(session));
  } else if (isPaymentQuestion(text)) {
    push(paymentReply(session));
  } else if (hasAny(text, INTENTS.booking)) {
    push(startBooking(session, svc));
  } else if (hasAny(text, INTENTS.price)) {
    push(priceReply(session, svc));
  } else if (svc && (svc.id !== 'consult' || hasAny(text, INTENTS.price))) {
    // mentions a service without an explicit intent: give its price, offer booking
    push(priceReply(session, svc));
  } else if (hasAny(text, INTENTS.location)) {
    push(locationReply(session));
  } else if (hasAny(text, INTENTS.hours)) {
    push(hoursReply(session));
  } else if (hasAny(text, INTENTS.human)) {
    push(startCallback(session));
  } else if (hasAny(text, INTENTS.greeting) && session.turns <= 1) {
    push(greetingReply(session));
  } else if (hasAny(text, INTENTS.thanks)) {
    push(L(session, 'العفو! أي حاجة تانية تحتاجها أنا هنا 🙏', 'Anytime! Anything else you need, I am here 🙏'));
  } else if (llm) {
    try {
      const out = await llm(session, text);
      push(out);
    } catch (e) {
      push(fallbackReply(session));
    }
  } else {
    push(fallbackReply(session));
  }

  return { session, replies };
}

function fallbackReply(session) {
  return L(
    session,
    'معلش، مش فاهم قصدك بالظبط. أقدر أساعدك في الأسعار، الفروع، المواعيد، أو أحجزلك. جرب تسألني "بكام التبييض؟" مثلاً 😊',
    'Sorry, I did not quite get that. I can help with prices, branches, hours, or bookings. Try asking "how much is whitening?" for example 😊'
  );
}

module.exports = { handleMessage, newSession };
