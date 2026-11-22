import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStudentRecord} from '../server/student-registration.js';
import {validateNewRegistrationDevice, hashRegistrationKey} from '../server/registration-security.js';
import {acceptFormSubmission} from '../server/form-verification.js';

const SECRET='f'.repeat(64);
function fakeCollection(initial={}) {
  const rows=new Map(Object.entries(initial));
  const snapshot = ref => ({exists:rows.has(ref.path), data:()=>rows.get(ref.path)});
  const db={runTransaction:async callback=>{
    const queue=[];
    const tx={get:async ref=>snapshot(ref),create:(ref,data)=>queue.push(['create',ref,data]),
      update:(ref,data)=>queue.push(['update',ref,data])};
    const result=await callback(tx);
    for(const [mode,ref,data] of queue){
      if(mode==='create') {
        assert.equal(rows.has(ref.path),false,'duplicate Firestore create');
        rows.set(ref.path,data);
      }else rows.set(ref.path,{...rows.get(ref.path),...data});
    }
    return result;
  }};
  return {rows,collection:bucket=>({doc:id=>({path:`${bucket}/${id}`,firestore:db})})};
}

test('new anonymous registrations have a browser binding even without Google opt-in',()=>{
  assert.throws(()=>validateNewRegistrationDevice(''),/cihaz anahtar/i);
  const device=validateNewRegistrationDevice(SECRET);
  const user=createStudentRecord({uid:'new-1',specialCode:'12345678',pin:'87654321',settings:{},security:device});
  assert.equal(user.registrationDeviceGuardVersion,1);
  assert.equal(user.deviceBindingHash,hashRegistrationKey(SECRET));
  assert.equal(user.registrationSecurityVersion,undefined);
  assert.equal(user.registrationEmail,undefined);
});

test('previously registered students remain exactly legacy without retroactive device fields',()=>{
  const existing=createStudentRecord({uid:'old-1',specialCode:'12345678',pin:'87654321',settings:{}});
  assert.equal(existing.registrationDeviceGuardVersion,undefined);
  assert.equal(existing.registrationSecurityVersion,undefined);
  assert.equal(existing.deviceBindingHash,undefined);
});

test('second Google Form submission for a new v1 student is ignored after first verification',async()=>{
  const user=createStudentRecord({uid:'new-1',specialCode:'12345678',pin:'87654321',settings:{},security:validateNewRegistrationDevice(SECRET)});
  const fake=fakeCollection({'sgmAuthCodes/12345678':{userId:'new-1'},'sgmUsers/new-1':user});
  const first=await acceptFormSubmission({code:'12345678',submissionId:'responseONE',collection:fake.collection});
  assert.deepEqual(first,{accepted:true,duplicate:false});
  const second=await acceptFormSubmission({code:'12345678',submissionId:'responseTWO',collection:fake.collection});
  assert.deepEqual(second,{accepted:true,duplicate:true});
  assert.equal(fake.rows.has('sgmFormSubmissions/responseTWO'),false);
  assert.equal(fake.rows.get('sgmUsers/new-1').registrationFormStatus,'verified');
});

test('app no longer erases a prior registration when Kayıt Ol is pressed',()=>{
  const app=readFileSync(new URL('../kutuphaneprogramıguncell.jsx',import.meta.url),'utf8');
  const begin=app.indexOf('const prepareNewStudentRegistration = () =>');
  const end=app.indexOf('const startRegistration = async () =>',begin);
  assert.ok(begin>=0&&end>begin);
  const prepare=app.slice(begin,end);
  assert.match(prepare,/getRegistrationBrowserLock\(\)/);
  assert.doesNotMatch(prepare,/removeItem\('sgm_registration_account'\)/);
  assert.match(app,/onClick=\{prepareNewStudentRegistration\}[^\n]*>Kayıt Ol/);
  assert.match(app,/body: JSON\.stringify\(\{deviceSecret:getDeviceBindingSecret\(true\)\}\)/);
});
