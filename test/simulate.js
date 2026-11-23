// Local simulator: runs the engine against scripted scenarios and prints the conversation.
// Usage: node test/simulate.js            -> runs all scripted scenarios
//        node test/simulate.js -i         -> interactive chat in your terminal

const { handleMessage, newSession } = require('../lib/engine');
const { llmReply } = require('../lib/llm');

const scenarios = {
  'Arabic price question': ['بكام الفينير؟'],
  'English price question': ['how much are implants?'],
  'Full Arabic booking': ['السلام عليكم', 'عايز أحجز ميعاد', 'تبييض', 'مدينة نصر', 'بكره', '٦ مساء', 'محمد عودة', 'أيوه'],
  'Full English booking': ['hi', 'book an appointment', 'cleaning', 'new cairo', 'tomorrow', '6pm', 'Mohamed Ouda', 'yes'],
  'Medical handoff (Arabic)': ['ضرسي بيوجعني جداً ومش قادر أنام'],
  'Medical handoff (English)': ['my gum is bleeding, should I take antibiotics?'],
  'Branches and hours': ['فين فروعكم؟', 'what time do you open?'],
  'Unknown question (LLM or fallback)': ['do you accept insurance?'],
  'Human callback (user input 1)': ['can I talk to someone at the clinic?', 'Mohamed Ouda', '01001234567'],
  'Human callback (user input 2)': ['I want to talk to the doctor', 'Mohamed', '01001234567'],
  'Human callback (Arabic)': ['عايز أكلم حد من العيادة', 'محمد عودة', '٠١٠٠١٢٣٤٥٦٧'],
  'Human callback mid-booking': ['عايز أحجز', 'تبييض', 'عايز أكلم حد الأول', 'محمد', '01001234567'],
  'Bad phone then good': ['I want to speak to a real person', 'Mo', 'call me maybe', '01001234567'],
  'Payment question 1 (user)': ['لازم أدفع قبل الحجز ولا عادي؟'],
  'Payment question 2 (user)': ['payment before booking'],
  'Payment question 3 (user)': ['أنا بسأل عن طرق الحجز'],
  'Installments': ['في تقسيط؟'],
  'Card vs cash': ['بقبلوا فيزا ولا كاش بس؟'],
  'Insurance + payment': ['هل التأمين بيغطي الدفع؟'],
  'Real booking intent still books': ['عايز أحجز ميعاد'],
  'Payment question mid-booking': ['عايز أحجز', 'تبييض', 'أدفع إزاي؟', 'مدينة نصر'],
  'Service-miss escape after two': ['احجز', 'حاجة مش موجودة', 'لسه مش موجودة'],
  'Franco booking': ['3ayez a7gz mo3ad'],
  'Franco price': ['bekam el veneers?'],
  'Franco human': ['momken akalem 7ad men el 3eyada?'],
  'Language switch': ['hello', 'تمام، عايز أعرف أسعار التقويم'],
};

async function run(name, lines) {
  console.log('\n=== ' + name + ' ===');
  const session = newSession();
  for (const line of lines) {
    console.log('USER: ' + line);
    const { replies } = await handleMessage(session, line, llmReply);
    for (const r of replies) console.log('BOT:  ' + r.replace(/\n/g, '\n      '));
  }
}

async function interactive() {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const session = newSession();
  console.log('Interactive demo (type "quit" to exit). You are the patient:');
  const ask = () =>
    rl.question('YOU: ', async (line) => {
      if (line.trim() === 'quit') return rl.close();
      const { replies } = await handleMessage(session, line, llmReply);
      replies.forEach((r) => console.log('BOT: ' + r + '\n'));
      ask();
    });
  ask();
}

(async () => {
  if (process.argv.includes('-i')) return interactive();
  for (const [name, lines] of Object.entries(scenarios)) await run(name, lines);
})();
