import { dataCollection } from './firebase-admin.js';
import { isFormGatePending } from './form-status.js';
import { validGMCode } from './form-signature.js';
import { isGuardedStudent, normalizeRegistrationEmail } from './registration-security.js';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export async function acceptFormSubmission({code,submissionId,email,collection=dataCollection,now=Date.now}) {
  if (!validGMCode(code) || !/^[\w-]{8,160}$/.test(String(submissionId||''))) throw fail('Geçersiz form yanıtı.');
  const codeRef=collection('sgmAuthCodes').doc(code);
  const submissionRef=collection('sgmFormSubmissions').doc(submissionId);
  return codeRef.firestore.runTransaction(async tx=>{
    const [codeSnap, prior] = await Promise.all([tx.get(codeRef),tx.get(submissionRef)]);
    if (prior.exists) {
      if(prior.data()?.code!==code) throw fail('Form yanıt kimliği başka bir GM Özel Koda ait.',409);
      return {accepted:true,duplicate:true};
    }
    const uid=codeSnap.data()?.userId;
    if (!codeSnap.exists || !uid) throw fail('GM Özel Kod bulunamadı.',404);
    const userRef=collection('sgmUsers').doc(uid);
    const tombstoneRef=collection('sgmDeletedUsers').doc(uid);
    const [userSnap,tombstone]=await Promise.all([tx.get(userRef),tx.get(tombstoneRef)]);
    const user=userSnap.data();
    if (!userSnap.exists || tombstone.exists || user.specialCode!==code) throw fail('Kullanıcı veya kod uyuşmuyor.',409);
    if (isGuardedStudent(user) && (!email || normalizeRegistrationEmail(email) !== user.registrationEmail)) {
      throw fail('Google Form e-posta adresi, kayıt sırasında doğruladığınız Google hesabıyla eşleşmelidir.',409);
    }
    // Bu sürümde oluşturulan v1/v2 öğrencinin ikinci form yanıtı sistemde
    // doğrulama/Sheets kaydı üretmez. Daha eski öğrencilerin akışı değişmez.
    if ((isGuardedStudent(user) || user.registrationDeviceGuardVersion === 1) &&
        user.registrationFormStatus === 'verified') {
      return {accepted:true,duplicate:true};
    }
    const at=now();
    // Önceki hesaplar ile yöneticinin elle uyguladığı cezalar asla otomatik açılmaz.
    if (user.formGateEnabled === true && user.registrationFormStatus !== 'verified') {
      tx.update(userRef,{registrationFormStatus:'verified',formVerifiedAt:at,
        pendingApproval:false,restrictionReason:user.pendingApproval ? '' : user.restrictionReason || '',
        leaderReviewStatus:'pending'});
    }
    tx.create(submissionRef,{code,userId:uid,receivedAt:at});
    return {accepted:true,duplicate:false};
  });
}
