// ======================================================
// التحقق من صحة الإيميل - LeadHunter Pro
// بنتحقق من الإيميل بأكتر من طريقة
// ======================================================

const dns = require('dns');
const { promisify } = require('util');

// بنحول الـ callback functions لـ promises
const resolveMx = promisify(dns.resolveMx);

// ========== قائمة دومينات الإيميل المؤقتة (Disposable) ==========
// الدومينات دي بتوفر إيميلات مؤقتة مش حقيقية
const DISPOSABLE_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'temp-mail.org', 'fakeinbox.com', 'sharklasers.com', 'guerrillamailblock.com',
  'grr.la', 'guerrillamail.info', 'guerrillamail.biz', 'guerrillamail.de',
  'guerrillamail.net', 'yopmail.com', 'yopmail.fr', 'cool.fr.nf',
  'jetable.fr.nf', 'nospam.ze.tc', 'nomail.xl.cx', 'mega.zik.dj',
  'speed.1s.fr', 'courriel.fr.nf', 'moncourrier.fr.nf', 'monemail.fr.nf',
  'monmail.fr.nf', 'tempinbox.com', 'dispostable.com', 'trashmail.com',
  'trashmail.me', 'trashmail.net', 'trashmail.org', 'trashymail.com',
  'trashymail.net', 'mailnesia.com', 'maildrop.cc', 'discard.email',
  'discardmail.com', 'discardmail.de', 'emailondeck.com', 'getnada.com',
  'harakirimail.com', 'mailcatch.com', 'mailexpire.com', 'mailmoat.com',
  'mytemp.email', 'spamgourmet.com', 'tempr.email', 'tmail.ws',
  'tmpmail.net', 'tmpmail.org', 'wegwerfemail.de', 'mailhub.pro',
  'email-fake.com', 'fakemail.net', '10minutemail.com', 'minutemail.com',
  'tempail.com', 'tempomail.fr', 'throwam.com', 'crazymailing.com',
  'mailnull.com', 'spambox.us', 'trashbox.net', 'shieldemail.com',
  'mailscrap.com', 'inboxbear.com', 'burnermail.io', 'emkei.cz',
  'mohmal.com', 'emailfake.com', 'temp-mail.io', 'tmail.link'
];

// ========== الدومينات المشهورة اللي أكيد شغالة ==========
const KNOWN_GOOD_DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
  'live.com', 'icloud.com', 'aol.com', 'mail.com',
  'protonmail.com', 'zoho.com', 'yandex.com', 'gmx.com',
  'fastmail.com', 'tutanota.com', 'pm.me', 'msn.com',
  'yahoo.co.uk', 'googlemail.com', 'me.com', 'mac.com'
];

/**
 * بنتحقق من صيغة الإيميل (Syntax Validation)
 * بنشيك على الفورمات والطول والحروف المسموحة
 *
 * @param {string} email - الإيميل
 * @returns {Object} - { valid, reason }
 */
function validateSyntax(email) {
  // بنتحقق إن الإيميل مش فاضي
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'الإيميل فاضي أو مش نص' };
  }

  email = email.trim().toLowerCase();

  // بنتحقق من الطول
  if (email.length < 5) {
    return { valid: false, reason: 'الإيميل قصير أوي' };
  }
  if (email.length > 254) {
    return { valid: false, reason: 'الإيميل طويل أوي (أكتر من 254 حرف)' };
  }

  // regex شامل للتحقق من الصيغة
  const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

  if (!emailRegex.test(email)) {
    return { valid: false, reason: 'صيغة الإيميل مش صحيحة' };
  }

  // بنتحقق من الجزء المحلي (قبل @)
  const [localPart, domain] = email.split('@');

  if (localPart.length > 64) {
    return { valid: false, reason: 'الجزء المحلي طويل أوي (أكتر من 64 حرف)' };
  }

  // بنتحقق إن مفيش نقطتين ورا بعض
  if (localPart.includes('..')) {
    return { valid: false, reason: 'مينفعش يبقى فيه نقطتين ورا بعض' };
  }

  // بنتحقق إن الدومين مش بيبدأ أو بينتهي بـ dash
  const domainParts = domain.split('.');
  for (const part of domainParts) {
    if (part.startsWith('-') || part.endsWith('-')) {
      return { valid: false, reason: 'الدومين فيه مشكلة (بيبدأ أو بينتهي بـ -)' };
    }
  }

  return { valid: true, reason: 'الصيغة صحيحة' };
}

/**
 * بنشيك لو الإيميل ده من دومين مؤقت (Disposable)
 *
 * @param {string} email - الإيميل
 * @returns {Object} - { isDisposable, domain }
 */
function checkDisposable(email) {
  const domain = email.split('@')[1].toLowerCase();

  const isDisposable = DISPOSABLE_DOMAINS.includes(domain);

  return {
    isDisposable,
    domain,
    reason: isDisposable ? 'الدومين ده بتاع إيميلات مؤقتة' : 'الدومين مش مؤقت'
  };
}

/**
 * بنتحقق من الـ MX Records بتاعت الدومين
 * الـ MX Records بتقول لنا لو الدومين ده بيستقبل إيميلات ولا لا
 *
 * @param {string} email - الإيميل
 * @returns {Object} - { hasMx, mxRecords, reason }
 */
async function checkMxRecords(email) {
  const domain = email.split('@')[1];

  // لو الدومين معروف، مش محتاجين نشيك
  if (KNOWN_GOOD_DOMAINS.includes(domain)) {
    return {
      hasMx: true,
      mxRecords: [{ exchange: domain, priority: 10 }],
      reason: 'دومين معروف ومضمون'
    };
  }

  try {
    const mxRecords = await resolveMx(domain);

    if (mxRecords && mxRecords.length > 0) {
      // بنرتب الـ MX Records حسب الأولوية
      const sortedRecords = mxRecords.sort((a, b) => a.priority - b.priority);

      return {
        hasMx: true,
        mxRecords: sortedRecords.map(r => ({
          exchange: r.exchange,
          priority: r.priority
        })),
        reason: `لقينا ${mxRecords.length} MX Record/s`
      };
    }

    return {
      hasMx: false,
      mxRecords: [],
      reason: 'الدومين مش بيستقبل إيميلات (مفيش MX Records)'
    };
  } catch (error) {
    // بنفرق بين أنواع الأخطاء
    if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
      return {
        hasMx: false,
        mxRecords: [],
        reason: 'الدومين مش موجود أو مفيش MX Records'
      };
    }

    if (error.code === 'ETIMEOUT') {
      return {
        hasMx: null,
        mxRecords: [],
        reason: 'الاستعلام أخد وقت طويل (timeout)'
      };
    }

    return {
      hasMx: null,
      mxRecords: [],
      reason: `خطأ في الاستعلام: ${error.message}`
    };
  }
}

/**
 * الدالة الرئيسية - بنتحقق من صحة الإيميل بشكل شامل
 * بنعمل كل الفحوصات: الصيغة، الدومين المؤقت، MX Records
 *
 * @param {string} email - الإيميل المراد التحقق منه
 * @returns {Object} - {
 *   valid: boolean,
 *   email: string,
 *   checks: { syntax, disposable, mx },
 *   score: number (0-100),
 *   reason: string
 * }
 */
async function verifyEmail(email) {
  if (!email) {
    return {
      valid: false,
      email: '',
      checks: {},
      score: 0,
      reason: 'مفيش إيميل متدخل'
    };
  }

  email = email.trim().toLowerCase();

  const result = {
    valid: false,
    email,
    checks: {},
    score: 0,
    reason: ''
  };

  // ===== الفحص 1: الصيغة =====
  const syntaxCheck = validateSyntax(email);
  result.checks.syntax = syntaxCheck;

  if (!syntaxCheck.valid) {
    result.reason = syntaxCheck.reason;
    return result;
  }

  // 30 نقطة للصيغة الصحيحة
  result.score += 30;

  // ===== الفحص 2: الدومين المؤقت =====
  const disposableCheck = checkDisposable(email);
  result.checks.disposable = disposableCheck;

  if (disposableCheck.isDisposable) {
    result.reason = 'الإيميل ده من دومين مؤقت (disposable)';
    result.score = 10;
    return result;
  }

  // 20 نقطة لو الدومين مش مؤقت
  result.score += 20;

  // ===== الفحص 3: MX Records =====
  const mxCheck = await checkMxRecords(email);
  result.checks.mx = mxCheck;

  if (mxCheck.hasMx === true) {
    // 50 نقطة لو الدومين بيستقبل إيميلات
    result.score += 50;
    result.valid = true;
    result.reason = 'الإيميل صالح ✅';
  } else if (mxCheck.hasMx === false) {
    result.reason = mxCheck.reason;
  } else {
    // مش متأكدين - ممكن يبقى timeout
    result.score += 20;
    result.valid = true; // بنفترض إنه صالح لحد ما نتأكد
    result.reason = 'مش قادرين نتأكد 100% بس غالباً صالح';
  }

  // لو الدومين معروف، بنضيف نقط إضافية
  const domain = email.split('@')[1];
  if (KNOWN_GOOD_DOMAINS.includes(domain)) {
    result.score = Math.min(result.score + 10, 100);
  }

  return result;
}

module.exports = {
  verifyEmail,
  validateSyntax,
  checkDisposable,
  checkMxRecords
};
