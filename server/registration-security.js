// Sadece yeni ve açıkça version=2 olan hesaplar için.
// Eski hesaplarda bu alan bulunmaz; mevcut kullanıcıları otomatik kilitleme.
import { createHash, timingSafeEqual } from 'node:crypto';

export const NEW_REGISTRATION_SECURITY_VERSION = 2;
const SECRET_PATTERN = /^[a-f0-9]{64}$/;
export const guardIsEnabled = () => process.env.SGM_NEW_REGISTRATION_GUARD_ENABLED === 'true';
export const normalizeRegistrationEmail = email =>
  typeof email === 'string' ? email.trim().toLowerCase() : '';
export const validRegistrationEmail = email =>
  typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const validDeviceSecret = secret => typeof secret === 'string' && SECRET_PATTERN.test(secret);
export const hashRegistrationKey = value => createHash('sha256').update(value).digest('hex');
export const isGuardedStudent = user => user?.registrationSecurityVersion === NEW_REGISTRATION_SECURITY_VERSION;

export function hasAuthorizedDevice(user, secret) {
  if (!isGuardedStudent(user)) return true;
  if (!validDeviceSecret(secret) || !/^[a-f0-9]{64}$/.test(String(user.deviceBindingHash || ''))) return false;
  const expected = Buffer.from(user.deviceBindingHash, 'hex');
  const given = Buffer.from(hashRegistrationKey(secret), 'hex');
  return timingSafeEqual(expected, given);
}
export const registrationFailure = (code, message, status = 403) =>
  Object.assign(new Error(message), { code, publicMessage: message, status });

// Basit cihaz kilidi, Google doğrulaması henüz açılmamış olsa bile yalnızca
// bundan sonra oluşturulan öğrenci hesaplarında uygulanır. Eski hesaplara dokunmaz.
export function validateNewRegistrationDevice(secret) {
  if (!validDeviceSecret(secret)) {
    throw registrationFailure('device_key_required',
      'Kayıt için güvenli cihaz anahtarı gereklidir. Normal tarayıcıda HTTPS üzerinden tekrar deneyin.', 400);
  }
  return { deviceHash: hashRegistrationKey(secret) };
}

export function validateNewRegistrationIdentity(identity, secret) {
  const email = normalizeRegistrationEmail(identity?.email);
  if (identity?.provider !== 'google.com' || identity?.emailVerified !== true || !validRegistrationEmail(email)) {
    throw registrationFailure('verified_google_email_required', 'Yeni kayıt için doğrulanmış Google hesabınızla devam edin.');
  }
  if (!validDeviceSecret(secret)) {
    throw registrationFailure('device_key_required', 'Cihaz anahtarı oluşturulamadı. Gizli mod yerine normal tarayıcıyla tekrar deneyin.');
  }
  return { email, emailHash: hashRegistrationKey(email), deviceHash: hashRegistrationKey(secret) };
}
