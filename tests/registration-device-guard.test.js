import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createStudentRecord } from '../server/student-registration.js';
import { createStudentLoginHandler } from '../server/student-auth.js';
import { verifyFormSignature } from '../server/form-signature.js';
import { acceptFormSubmission } from '../server/form-verification.js';
import { authorizeStudentDevice, decideDeviceChange, pendingDeviceChangeRequests,
  verifyDeviceForAction } from '../server/device-binding.js';
import { hashRegistrationKey, hasAuthorizedDevice, isGuardedStudent,
  validateNewRegistrationIdentity } from '../server/registration-security.js';

const oldSecret = 'a'.repeat(64);
const newSecret = 'b'.repeat(64);
const code = '12345678', pin = '87654321';
const at = 15_000_000;
function fakeFirestore(initial = {}) {
  const records = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const writes = [];
  const snapshot = (ref) => ({id:ref.path.split('/').at(-1),ref,exists:records.has(ref.path),
    data:()=>structuredClone(records.get(ref.path))});
  const firestore = {runTransaction:async callback=>{
    const changes=[];
    const tx={get:async ref=>snapshot(ref),
      create:(ref,val)=>changes.push(['create',ref.path,val]),
      update:(ref,val)=>changes.push(['update',ref.path,val]),
      set:(ref,val)=>changes.push(['set',ref.path,val]),
      delete:ref=>changes.push(['delete',ref.path,null])};
    const result=await callback(tx);
    for(const [mode,path,val] of changes){
      if(mode==='create' && records.has(path)) throw new Error('already-exists');
      if(mode==='delete') records.delete(path);
      else if(mode==='update') records.set(path,{...records.get(path),...val});
      else records.set(path,structuredClone(val));
      writes.push({mode,path});
    }
    return result;
  }};
  const collection = bucket => ({
    firestore,
    doc(id) {return {path:`${bucket}/${id}`,id,firestore,get(){return Promise.resolve(snapshot(this));}};},
    orderBy(field,direction) {return {limit(count){return {get:async()=>({docs:[...records]
      .filter(([path])=>path.startsWith(`${bucket}/`))
      .sort((a,b)=>direction==='desc'?b[1][field]-a[1][field]:a[1][field]-b[1][field])
      .slice(0,count).map(([path,data])=>({id:path.split('/')[1],data:()=>structuredClone(data)}))})};}};}
  });
  return {records,writes,collection};
}
function response() {return {setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};}
const record = security => ({...createStudentRecord({uid:'secure',specialCode:code,pin,settings:{},security}),
  registrationFormStatus:'verified',pendingApproval:false});
function login(fake,userId='secure') {
  return createStudentLoginHandler({
    findBySpecialCode:async()=>[{id:userId,user:fake.records.get(`sgmUsers/${userId}`),deleted:false}],
    createCustomToken:async()=>'token',isRateLimited:async()=>false,
    authorizeDevice:(uid,secret)=>authorizeStudentDevice({uid,deviceSecret:secret,
      collection:fake.collection,now:()=>at})
  });
}
test('new secure student records are opt-in; legacy records stay unchanged',()=>{
  const legacy=createStudentRecord({uid:'old',specialCode:code,pin,settings:{}});
  assert.equal(isGuardedStudent(legacy),false);
  assert.equal(hasAuthorizedDevice(legacy,null),true);
  const security=validateNewRegistrationIdentity({provider:'google.com',email:' User@GMail.com ',emailVerified:true},oldSecret);
  const next=record(security);
  assert.equal(next.registrationEmail,'user@gmail.com');
  assert.equal(next.registrationSecurityVersion,2);
  assert.equal(next.deviceBindingHash,hashRegistrationKey(oldSecret));
  assert.equal(hasAuthorizedDevice(next,oldSecret),true);
  assert.equal(hasAuthorizedDevice(next,newSecret),false);
  assert.throws(()=>validateNewRegistrationIdentity({provider:'anonymous'},oldSecret), /Google/);
  assert.throws(()=>validateNewRegistrationIdentity({provider:'google.com',email:'bad',emailVerified:true},oldSecret), /Google/);
});
test('legacy login accepts missing device secret without updating stored data',async()=>{
  const legacy={id:'old',specialCode:code,pin,name:'Kayıtlı öğrenci'};
  const fake=fakeFirestore({'sgmUsers/old':legacy});
  const handler=login(fake,'old');const res=response();
  await handler({method:'POST',body:{specialCode:code,pin}},res);
  assert.equal(res.code,200);
  assert.equal(res.body.token,'token');
  assert.deepEqual(fake.records.get('sgmUsers/old'),legacy);
  assert.equal(fake.writes.length,0);
});
test('new account login requires matching device, leader approves only the requested new device',async()=>{
  const security=validateNewRegistrationIdentity({provider:'google.com',email:'secure@example.com',emailVerified:true},oldSecret);
  const user=record(security);
  const fake=fakeFirestore({'sgmUsers/secure':user,
    [`sgmDeviceBindings/${hashRegistrationKey(oldSecret)}`]:{userId:'secure'}});
  const handler=login(fake);
  const ok=response();await handler({method:'POST',body:{specialCode:code,pin,deviceSecret:oldSecret}},ok);
  assert.equal(ok.code,200);
  const invalid=response();await handler({method:'POST',body:{specialCode:code,pin,deviceSecret:newSecret}},invalid);
  assert.equal(invalid.code,403);
  assert.equal(invalid.body.error,'device_change_pending');
  const pending=fake.records.get('sgmDeviceChangeRequests/secure');
  assert.equal(pending.status,'pending');
  assert.equal(fake.records.get('sgmUsers/secure').deviceBindingHash,hashRegistrationKey(oldSecret));
  assert.equal((await pendingDeviceChangeRequests({collection:fake.collection,now:()=>at})).length,1);
  await decideDeviceChange({userId:'secure',requestId:pending.requestId,approve:true,
    leader:{username:'leader-1',name:'Lider'},collection:fake.collection,now:()=>at});
  assert.equal(fake.records.get('sgmDeviceChangeRequests/secure').status,'approved');
  const after=response();await handler({method:'POST',body:{specialCode:code,pin,deviceSecret:newSecret}},after);
  assert.equal(after.code,200);
  assert.equal(fake.records.get('sgmUsers/secure').deviceBindingHash,hashRegistrationKey(newSecret));
  assert.equal(fake.records.has(`sgmDeviceBindings/${hashRegistrationKey(oldSecret)}`),false);
  assert.equal(await verifyDeviceForAction('secure',oldSecret,fake.collection),false);
  assert.equal(await verifyDeviceForAction('secure',newSecret,fake.collection),true);
  assert.equal(fake.records.get('sgmUsers/secure').pin,pin);
  assert.equal(fake.records.get('sgmUsers/secure').specialCode,code);
  assert.equal(fake.records.get('sgmUsers/secure').activeDeskId,null);
  assert.equal(fake.records.get('sgmDeviceChangeRequests/secure').status,'completed');
});
test('a request for a device already bound to another student is rejected',async()=>{
  const sec=validateNewRegistrationIdentity({provider:'google.com',email:'secure@example.com',emailVerified:true},oldSecret);
  const fake=fakeFirestore({'sgmUsers/secure':record(sec),
    [`sgmDeviceBindings/${hashRegistrationKey(newSecret)}`]:{userId:'other'}});
  await assert.rejects(authorizeStudentDevice({uid:'secure',deviceSecret:newSecret,
    collection:fake.collection,now:()=>at}),error=>error.status===409 && error.code==='device_already_registered');
  assert.equal(fake.writes.length,0);
});
test('new form verifies matching signed email only, then rejects duplicate response by account',async()=>{
  const sec=validateNewRegistrationIdentity({provider:'google.com',email:'student@example.com',emailVerified:true},oldSecret);
  const user={...record(sec),registrationFormStatus:'awaiting_submission'};
  const fake=fakeFirestore({'sgmAuthCodes/12345678':{userId:'secure'},'sgmUsers/secure':user});
  await assert.rejects(acceptFormSubmission({code,submissionId:'submissionONE',email:'wrong@example.com',
    collection:fake.collection,now:()=>at}),error=>error.status===409);
  assert.equal(fake.writes.length,0);
  const one=await acceptFormSubmission({code,submissionId:'submissionONE',email:'student@example.com',
    collection:fake.collection,now:()=>at});
  assert.deepEqual(one,{accepted:true,duplicate:false});
  assert.equal(fake.records.get('sgmUsers/secure').registrationFormStatus,'verified');
  const another=await acceptFormSubmission({code,submissionId:'submissionTWO',email:'student@example.com',
    collection:fake.collection,now:()=>at});
  assert.deepEqual(another,{accepted:true,duplicate:true});
  assert.equal(fake.records.has('sgmFormSubmissions/submissionTWO'),false);
});
test('form HMAC signs e-mail for v2 and retains old format for pre-existing forms',()=>{
  const secret='this-is-a-much-longer-than-32-character-secret',timestamp=at,submissionId='response-123';
  const modern=createHmac('sha256',secret).update(`${timestamp}:${code}:${submissionId}:student@example.com`).digest('hex');
  const old=createHmac('sha256',secret).update(`${timestamp}:${code}:${submissionId}`).digest('hex');
  assert.equal(verifyFormSignature({secret,timestamp,code,submissionId,email:'student@example.com',signature:modern,now:at}),true);
  assert.equal(verifyFormSignature({secret,timestamp,code,submissionId,email:'wrong@example.com',signature:modern,now:at}),false);
  assert.equal(verifyFormSignature({secret,timestamp,code,submissionId,signature:old,now:at}),true);
});
