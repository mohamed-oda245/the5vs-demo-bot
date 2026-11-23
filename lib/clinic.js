// Demo clinic configuration. Everything here is editable per-client:
// clone the file, change the content, and the bot becomes that clinic's assistant.
// Values can be overridden with environment variables where noted.

const clinic = {
  nameAr: process.env.CLINIC_NAME_AR || 'عيادة سمايل لطب الأسنان',
  nameEn: process.env.CLINIC_NAME_EN || 'Smile Dental Clinic',
  doctorAr: process.env.CLINIC_DOCTOR_AR || 'د. كريم',
  doctorEn: process.env.CLINIC_DOCTOR_EN || 'Dr. Karim',

  services: [
    {
      id: 'consult',
      ar: 'كشف',
      en: 'consultation',
      priceAr: '٣٠٠ جنيه',
      priceEn: 'EGP 300',
      keywords: ['كشف', 'consultation', 'checkup', 'check', 'فحص'],
    },
    {
      id: 'cleaning',
      ar: 'تنظيف الأسنان',
      en: 'cleaning',
      priceAr: '٨٠٠ جنيه',
      priceEn: 'EGP 800',
      keywords: ['تنظيف', 'تلميع', 'جير', 'cleaning', 'clean', 'polish'],
    },
    {
      id: 'whitening',
      ar: 'تبييض الأسنان',
      en: 'whitening',
      priceAr: '٣٥٠٠ جنيه',
      priceEn: 'EGP 3,500',
      keywords: ['تبييض', 'بياض', 'whitening', 'whiten', 'bleaching'],
    },
    {
      id: 'veneers',
      ar: 'الفينير',
      en: 'veneers',
      priceAr: 'تبدأ من ٤٥٠٠ جنيه للسنة',
      priceEn: 'from EGP 4,500 per tooth',
      keywords: ['فينير', 'فينيرز', 'veneer', 'veneers', 'ابتسامة', 'هوليوود', 'hollywood'],
    },
    {
      id: 'implant',
      ar: 'زراعة الأسنان',
      en: 'implants',
      priceAr: 'تبدأ من ١٨٠٠٠ جنيه',
      priceEn: 'from EGP 18,000',
      keywords: ['زراعة', 'زرع', 'implant', 'implants', 'غرسة'],
    },
    {
      id: 'braces',
      ar: 'تقويم الأسنان',
      en: 'braces',
      priceAr: 'تبدأ من ٢٥٠٠٠ جنيه',
      priceEn: 'from EGP 25,000',
      keywords: ['تقويم', 'braces', 'orthodont', 'invisalign', 'انفزلاين'],
    },
  ],

  branches: [
    {
      id: 'nasr',
      ar: 'مدينة نصر - ٢٥ شارع عباس العقاد',
      en: 'Nasr City - 25 Abbas El Akkad St.',
      keywords: ['نصر', 'nasr', 'عباس', 'abbas'],
    },
    {
      id: 'tagamo',
      ar: 'التجمع الخامس - شارع التسعين الشمالي',
      en: 'New Cairo - North 90th St.',
      keywords: ['تجمع', 'تجمع الخامس', 'القاهرة الجديدة', 'tagamo', 'new cairo', 'fifth settlement', '90'],
    },
  ],

  hoursAr: 'يومياً من ١٠ صباحاً لـ ١٠ مساءً، ما عدا الجمعة من ٢ الظهر لـ ١٠ مساءً',
  hoursEn: 'Daily 10 AM - 10 PM, Fridays 2 PM - 10 PM',

  bookingRefPrefix: 'DC',
};

module.exports = { clinic };
