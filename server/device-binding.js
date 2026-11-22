import { randomUUID } from 'node:crypto';
import { dataCollection } from './firebase-admin.js';
import { hasAuthorizedDevice, hashRegistrationKey, isGuardedStudent,
  registrationFailure, validDeviceSecret } from './registration-security.js';

const REQUEST_LIFETIME = 24 * 60 * 60 * 1000;
const APPROVAL_LIFETIME = 30 * 60 * 1000;

// Önemli: Eski öğrencilerde (version yok) cihaz kanıtı ASLA zorunlu değil.
export async function verifyDeviceForAction(uid, deviceSecret, collection = dataCollection) {
  const snapshot = await collection('sgmUsers').doc(uid).get();
  if (!snapshot.exists) return false;
  return hasAuthorizedDevice(snapshot.data(), deviceSecret);
}

// Öğrenci GM kodu ve PIN ile doğrulandıktan sonra çağrılır.
// Yeni cihazın bağlanması ancak liderin belirli bir isteği onaylaması ile olur.
export async function authorizeStudentDevice({uid, deviceSecret, collection = dataCollection, now = Date.now}) {
  const users = collection('sgmUsers');
  const userRef = users.doc(uid);
  const snapshot = await userRef.get();
  if (!snapshot.exists) throw registrationFailure('student_not_found','Öğrenci kaydı bulunamadı.',404);
  if (!isGuardedStudent(snapshot.data())) return { authorized:true, legacy:true };
  if (!validDeviceSecret(deviceSecret)) throw registrationFailure('device_key_missing',
    'Bu hesap kayıtlı cihazına bağlı. Tarayıcı verileri silindiyse gençlik liderinden cihaz değişikliği onayı alın.');
  if (hasAuthorizedDevice(snapshot.data(), deviceSecret)) return { authorized:true };

  const newHash = hashRegistrationKey(deviceSecret);
  const requestRef = collection('sgmDeviceChangeRequests').doc(uid);
  const result = await users.firestore.runTransaction(async tx => {
    const [fresh, requestSnap, boundSnap] = await Promise.all([
      tx.get(userRef), tx.get(requestRef), tx.get(collection('sgmDeviceBindings').doc(newHash))
    ]);
    if (!fresh.exists) throw registrationFailure('student_not_found','Öğrenci kaydı bulunamadı.',404);
    const current = fresh.data();
    if (!isGuardedStudent(current) || hasAuthorizedDevice(current, deviceSecret)) return 'authorized';
    if (boundSnap.exists && boundSnap.data()?.userId !== uid) {
      throw registrationFailure('device_already_registered','Bu cihaz başka bir öğrenci hesabına bağlı.',409);
    }
    const prior = requestSnap.data() || {};
    const at = now();
    const isSame = prior.deviceHash === newHash;
    const approvalValid = prior.status === 'approved' &&
      Number(prior.approvedAt || 0) > at - APPROVAL_LIFETIME;
    if (isSame && approvalValid) {
      const oldHash = current.deviceBindingHash;
      const oldBindingRef = oldHash && oldHash !== newHash ? collection('sgmDeviceBindings').doc(oldHash) : null;
      const oldBinding = oldBindingRef ? await tx.get(oldBindingRef) : null;
      if (oldBinding?.exists && oldBinding.data()?.userId !== uid) {
        throw registrationFailure('device_binding_conflict','Cihaz eşleştirmesi tutarsız. Yönetici kontrolü gerekli.',409);
      }
      if (!boundSnap.exists) tx.create(collection('sgmDeviceBindings').doc(newHash), {userId:uid,createdAt:at});
      if (oldBinding?.exists) tx.delete(oldBindingRef);
      tx.update(userRef,{deviceBindingHash:newHash,deviceChangedAt:at,deviceChangedBy:prior.approvedBy});
      tx.update(requestRef,{status:'completed',completedAt:at});
      return 'authorized';
    }
    // Bekleyen başka cihaz isteğini üzerine yazma. Lider eski isteği reddedebilir.
    if (['pending','approved'].includes(prior.status) && Number(prior.requestedAt || 0) > at - REQUEST_LIFETIME) {
      return isSame ? 'pending' : 'another_pending';
    }
    tx.set(requestRef, {userId:uid,requestId:randomUUID(),deviceHash:newHash,
      status:'pending',requestedAt:at,approvedAt:null,approvedBy:null});
    return 'pending';
  });
  if (result === 'authorized') return {authorized:true};
  if (result === 'another_pending') throw registrationFailure('device_request_already_pending',
    'Bu hesap için farklı bir cihaz değişikliği talebi bekliyor. Gençlik liderimize başvurun.',409);
  throw registrationFailure('device_change_pending',
    'Bu cihaz hesabınıza bağlı değil. Gençlik liderinizden cihaz değişikliği onayı isteyin; onaydan sonra aynı cihazdan tekrar giriş yapın.');
}

export async function decideDeviceChange({userId,requestId,approve,leader,
  collection=dataCollection,now=Date.now}) {
  if (typeof userId !== 'string' || !userId || userId.includes('/') || userId.length > 180 ||
      typeof requestId !== 'string' || requestId.length > 120) {
    throw registrationFailure('invalid_device_request','Geçersiz cihaz talebi.',400);
  }
  const requestRef = collection('sgmDeviceChangeRequests').doc(userId);
  const userRef = collection('sgmUsers').doc(userId);
  const auditRef = collection('sgmLeaderAudit').doc(randomUUID());
  return requestRef.firestore.runTransaction(async tx => {
    const [requestSnap,userSnap] = await Promise.all([tx.get(requestRef),tx.get(userRef)]);
    const request = requestSnap.data();
    if (!requestSnap.exists || request?.requestId !== requestId || request?.status !== 'pending' ||
        !userSnap.exists || !isGuardedStudent(userSnap.data()) ||
        Number(request.requestedAt || 0) <= now() - REQUEST_LIFETIME) {
      throw registrationFailure('device_request_unavailable','Bekleyen cihaz talebi bulunamadı; listeyi yenileyin.',409);
    }
    const at=now();
    tx.update(requestRef,{status:approve?'approved':'rejected',approvedAt:approve?at:null,
      rejectedAt:approve?null:at,approvedBy:leader.username});
    tx.create(auditRef,{leaderId:leader.username,leaderName:leader.name,
      userId,studentCode:userSnap.data().specialCode,studentName:userSnap.data().name,
      action:approve?'leader_device_approve':'leader_device_reject',reason:'',at});
    return {userId,approved:approve};
  });
}

export async function pendingDeviceChangeRequests({collection=dataCollection, now=Date.now}) {
  const snapshot = await collection('sgmDeviceChangeRequests').orderBy('requestedAt','desc').limit(150).get();
  return snapshot.docs.map(doc=>({id:doc.id,...doc.data()}))
    .filter(row=>row.status==='pending' && Number(row.requestedAt)>now()-REQUEST_LIFETIME)
    .map(({userId,requestId,requestedAt})=>({userId,requestId,requestedAt}));
}
