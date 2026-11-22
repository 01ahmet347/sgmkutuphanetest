import { verifyFormSignature } from '../server/form-signature.js';
import { acceptFormSubmission } from '../server/form-verification.js';
import { createHash } from 'node:crypto';
import { guardIsEnabled, validateNewRegistrationIdentity, validateNewRegistrationDevice,
  registrationFailure } from '../server/registration-security.js';
import { getAuth } from 'firebase-admin/auth';
import { adminApp, dataCollection } from '../server/firebase-admin.js';
import {
  createStudentRecord,
  createStudentRegistrationHandler,
  generateStudentCredential
} from '../server/student-registration.js';

// Kayıt hatasının ayrıntısını yalnızca sunucu loglarına yazar.
function registrationDiagnostic(stage, action) {
  return async (...args) => {
    try {
      return await action(...args);
    } catch (error) {
      const message = String(error?.message || 'Hata mesajı bulunamadı.')
        .replace(/-----BEGIN[\s\S]*?-----END[^\r\n]*-----/g, '[GİZLİ ANAHTAR]')
        .replace(/Bearer\s+\S+/gi, 'Bearer [GİZLİ]')
        .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[GİZLİ TOKEN]')
        .slice(0, 500);

      console.error('[SGM öğrenci kayıt ayrıntısı]', {
        stage,
        code: error?.code ?? 'kod_yok',
        name: error?.name || 'Error',
        message,
        configured: {
          FIREBASE_ADMIN_PROJECT_ID: Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID),
          FIREBASE_ADMIN_CLIENT_EMAIL: Boolean(process.env.FIREBASE_ADMIN_CLIENT_EMAIL),
          FIREBASE_ADMIN_PRIVATE_KEY: Boolean(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
          FIREBASE_APP_ID: Boolean(process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID)
        }
      });

      throw error;
    }
  };
}

// Kimlik yalnızca doğrulanmış token'dan alınır; istemci userId seçemez.
const anonymousUidKey = Symbol('verifiedRegistrationIdentity');
async function verifyAnonymousUser(req) {
  if (Object.prototype.hasOwnProperty.call(req, anonymousUidKey)) {
    return req[anonymousUidKey]?.uid || null;
  }
  const token = /^Bearer\s+(.+)$/i.exec(req.headers?.authorization || '')?.[1];
  if (!token) return null;
  const decoded = await getAuth(adminApp()).verifyIdToken(token);
  const provider = decoded.firebase?.sign_in_provider;
  const validProvider = provider === 'anonymous' ||
    (provider === 'google.com' && decoded.email_verified === true && typeof decoded.email === 'string');
  const identity = validProvider ? {uid:decoded.uid, provider, email:decoded.email || '',
    emailVerified:decoded.email_verified === true} : null;
  req[anonymousUidKey] = identity;
  return identity?.uid || null;
}

function registrationResult(user, uid) {
  if (user.id != null && String(user.id) !== String(uid)) {
    throw new Error('Kayıt belgesi doğrulanmış oturumla eşleşmiyor.');
  }
  const specialCode = String(user.specialCode || '');
  const pin = String(user.pin || '');
  if (!/^\d{8}$/.test(specialCode) || !/^\d{8}$/.test(pin)) {
    throw new Error('Mevcut hesabın GM Özel Kod veya şifre bilgisi eksik. Sorumlu kontrolü gereklidir.');
  }
  const { pin: _pin, ...profile } = user;
  return { user: { ...profile, id: uid }, credentials: { specialCode, pin } };
}

const handler = createStudentRegistrationHandler({
  verifyAnonymousUser: registrationDiagnostic('oturum_dogrulama', verifyAnonymousUser),

  isRateLimited: registrationDiagnostic('kayit_limiti', async req => {
    // Aynı hesabın bilgilerinin yeniden getirilmesi yeni hesap oluşturma sayılmaz.
    const uid = await verifyAnonymousUser(req);
    if (uid) {
      const existing = await dataCollection('sgmUsers').doc(uid).get();
      if (existing.exists) return false;
    }

    const clientAddress =
      req.headers?.['x-vercel-forwarded-for'] ||
      req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    // Shared Wi-Fi: ten tries are counted per verified anonymous device,
    // with a higher shared-network abuse ceiling retained for protection.
    const ipHash = createHash('sha256').update(String(clientAddress)).digest('hex');
    const key = createHash('sha256').update(`${ipHash}:${uid}`).digest('hex');
    const ref = dataCollection('sgmRegistrationAttempts').doc(key);
    const networkRef = dataCollection('sgmRegistrationAttempts').doc(`network-${ipHash}`);
    const at = Date.now();

    return ref.firestore.runTransaction(async tx => {
      const [snapshot, networkSnapshot] = await Promise.all([tx.get(ref), tx.get(networkRef)]);
      const previous = snapshot.data() || {};
      const network = networkSnapshot.data() || {};
      const windowStart = Number(previous.windowStart || 0);
      const networkStart = Number(network.windowStart || 0);
      const attempts = windowStart > at - 60 * 60 * 1000
        ? Number(previous.attempts || 0) + 1 : 1;
      const networkAttempts = networkStart > at - 60 * 60 * 1000
        ? Number(network.attempts || 0) + 1 : 1;
      tx.set(ref, { attempts, windowStart: attempts === 1 ? at : windowStart, updatedAt: at });
      tx.set(networkRef, { attempts: networkAttempts,
        windowStart: networkAttempts === 1 ? at : networkStart, updatedAt: at });
      return attempts > 10 || networkAttempts > 100;
    });
  }),

  createStudent: registrationDiagnostic('hesap_olusturma', async (uid, req) => {
    const authCodes = dataCollection('sgmAuthCodes');
    const users = dataCollection('sgmUsers');
    const config = await dataCollection('sgmConfig').doc('settings').get();
    const settings = config.data() || {};
    // Guard sadece yeni hesaplara uygulanır; mevcut UID belgesi ilk olarak transaction'da kontrol edilir.
    const guard = guardIsEnabled();
    const existing = await users.doc(uid).get();
    // Her YENİ kayıt benzersiz tarayıcı anahtarı ister. Google/e-posta şartı ise
    // yalnızca iki güvenlik bayrağı etkinse yeni kayda uygulanır.
    // Eski UID için hiçbir yeni güvenlik alanı zorunlu değildir.
    const security = existing.exists ? null : (
      guard ? validateNewRegistrationIdentity(req[anonymousUidKey], req.body?.deviceSecret)
        : validateNewRegistrationDevice(req.body?.deviceSecret)
    );

    for (let attempt = 0; attempt < 12; attempt++) {
      const specialCode = generateStudentCredential();
      const pin = generateStudentCredential();
      const user = createStudentRecord({ uid, specialCode, pin, settings, security });

      const result = await users.firestore.runTransaction(async tx => {
        const userRef = users.doc(uid);
        const userSnap = await tx.get(userRef);

        // Yeniden denemede hesabı, şifreyi, onayı ve kısıtları aynen koru.
        if (userSnap.exists) {
          const existingUser = userSnap.data();
          const existingResult = registrationResult(existingUser, uid);
          const existingCodeRef = authCodes.doc(existingResult.credentials.specialCode);
          const existingCodeSnap = await tx.get(existingCodeRef);
          if (existingCodeSnap.exists && existingCodeSnap.data()?.userId !== uid) {
            throw new Error('Mevcut GM Özel Kod başka hesaba bağlı. Sorumlu kontrolü gereklidir.');
          }
          // Eski kayıtta eksik kod eşleştirmesi varsa aynı hesabı onar.
          if (!existingCodeSnap.exists) {
            tx.create(existingCodeRef, { userId: uid, createdAt: Date.now() });
          }
          return existingResult;
        }

        // İlk okumanın ardından hesap yarışla oluşmuş olabilir: eski kayıt olarak döndür.
        // Yeni kayıt için hem e-posta hem tarayıcı anahtarı transaction içinde benzersizdir.
        if (!security) {
          throw registrationFailure('device_key_required', 'Yeni kayıt için cihaz anahtarı zorunludur.', 400);
        }
        const codeRef = authCodes.doc(specialCode);
        const emailRef = security.emailHash ? dataCollection('sgmEmailBindings').doc(security.emailHash) : null;
        const deviceRef = dataCollection('sgmDeviceBindings').doc(security.deviceHash);
        const [codeSnap, emailSnap, deviceSnap] = await Promise.all([
          tx.get(codeRef),emailRef ? tx.get(emailRef) : null,tx.get(deviceRef)
        ]);
        if (codeSnap.exists) return null;
        if (emailRef && emailSnap.exists) throw registrationFailure('email_already_registered',
          'Bu e-posta ile kayıtlı bir hesap var. Yeni hesap açmak yerine mevcut GM Özel Kodunuzla giriş yapın.',409);
        if (deviceSnap.exists) throw registrationFailure('device_already_registered',
          'Bu tarayıcıda zaten bir GM Özel Kod oluşturuldu. İkinci hesap açamazsınız; mevcut kodunuz ve şifrenizle giriş yapın.',409);
        const newResult = registrationResult(user, uid);
        tx.create(codeRef, { userId: uid, createdAt: Date.now() });
        if (emailRef) tx.create(emailRef, {userId:uid,createdAt:Date.now()});
        tx.create(deviceRef, {userId:uid,createdAt:Date.now()});
        tx.create(userRef, user);
        return newResult;
      });

      if (result) return result;
    }
    throw new Error('Unable to allocate unique student credentials.');
  })
});

export default async function registrationWithFormWebhook(req,res) {
  if(req.method === 'POST' && req.body?.action === 'form_webhook') {
    res.setHeader('Cache-Control','no-store');
    const {specialCode,submissionId,timestamp,email} = req.body || {};
    const signature = req.headers?.['x-sgm-form-signature'];
    const secret = process.env.SGM_FORM_WEBHOOK_SECRET;
    if (!verifyFormSignature({secret,timestamp,code:specialCode,submissionId,email,signature})) {
      return res.status(401).json({ok:false,error:'invalid_form_signature'});
    }
    try {
      const result=await acceptFormSubmission({code:specialCode,submissionId,email});
      return res.status(200).json({ok:true,...result});
    } catch(error) {
      if (!error.status) console.error('Form webhook error:',error.code||error.message);
      return res.status(error.status||503).json({ok:false,error:'form_submission_failed',message:error.status?error.message:'Form doğrulanamadı.'});
    }
  }
  return handler(req,res);
}
