const _jsxFileName = "kutuphaneprogramıguncell.jsx"; function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// 2026-10-08: Push anahtarı YP üzerinden kaydedilir; .exists sunucu uyumsuzluğu düzeltme paketiyle giderilir.
// 2026-10-08: Giriş bağlantısı kaldırıldı; YP isimsiz otomatik kayıt; rezervasyon iptali; sabit QR ve QR yedek sekmesi.
// EK DÜZELTME: Firebase ve öğrenci oturumları sekmeye özeldir; yetkisiz yönetici görünümü girişe döner.
// EK DÜZELTME: Ayar kaydı ihbarı kapatmaz; yönetici listesi oturum kapsamında dinlenir.
// Sunucu ayarları tüm açık ekranlara anında uygulanır; mola ihbarı engellenir.
// EK DÜZELTME: Güncel anonim kayıt tokenı, ayrı öğrenci oturumu ve sunucuda atomik yönetici hesabı oluşturma.
// EK DÜZELTME: Yönetici kaydı güncel Firebase tokenıyla doğrulanır; eski oturum sonuçları yok sayılır.
// EK DÜZELTME: Hesap onayı/kısıt değişikliği sunucu transaction'ı tamamlanmadan başarılı sayılmaz.
// Yeni kayıtlar onay beklemeye devam eder; yönetici açıkça onayladığında öğrenci güncellenir.
// EK DÜZELTME: Eski cihaz kayıt engeli kaldırıldı; sunucu kimlik doğrulaması korunur.
// Tekli/toplu kısıt kaldırmada ihbar yetkisi açılır; eski aktif hesaplar YP'de onarılır.
// 2026-10-08 EK SENKRONİZASYON DÜZELTMELERİ:
// - Silinen öğrenci hesabının cihaz oturumu ve ilgili kayıt önbelleği temizlenir.
// - Yönetici listesinde eski yerel kullanıcılar sunucu silmesini geri alamaz.
// - Öğrenci krokisi güncel sunucu masa durumunu kullanır.
// - Masa bırakma güncel masa kimliğiyle yapılır; sunucu sonucu doğrulanır.
// - Kayıt servisi /api/student-register ve sunucu masa işlemleri ayrı dosyalardır.
//   Kayıt kurtarma, güncellenmiş api/student-register.js ile birlikte çalışır.
// EK DÜZELTMELER: giriş/oturum logları, QR mola dönüşü, ihbar hedefi,
// ortak hesap kısıtı + YP ihbar yetkisi görünümü, önceki kapanış kurtarma.
// Bu dosya mevcut React dosyanızın yerine kullanılır; diğer importlar korunmuştur.
// GEREKLİ SUNUCU KONTROLÜ: /api/student-activity audit-event izin listesi
// OGRENCI_, ÖĞRENCİ_, İHBAR/IHBAR olaylarını kabul etmelidir.
// Tüm tarayıcılar kapalıyken 22:00 temizliği için sunucu zamanlayıcısı gerekir.
// Sunucu/API dosyaları ekte olmadığından bu dosyada değiştirilememiştir.
// ============================================================
// 2026-10 KOTA / SENKRONIZASYON TOPARLAMA
// - Firestore parçalı belge yapısı korunur.
// - Öğrenci cihazı log/ihlal/geri bildirim arşivlerini realtime dinlemez.
// - Eski loglar uygulama açılışında yeniden arşivlenmez.
// - Loglar tek kalıcı sgmAudit arşivine yazılır; yalnızca admin arşivi dinler.
// - Öğrenci kişisel mesajı tek sgmMessages belgesinden ve FCM'den alır.
// - Masa seçimi/QR/ihlal ve silme sunucu transaction'larıyla doğrulanır.
// - Gönderilemeyen log/ihlal/geri bildirim ve bildirim istekleri cihazda bekletilir.
// - Eski sabit kroki ve günlük giriş kodu ayar kalıntıları kaldırıldı.
// - Yönetici şifresi frontend paketinden çıkarıldı; /api/admin-login kullanılır.
// Not: guest* alanları mevcut eski Firestore kayıtlarını bozmamak için şema uyumluluğu amacıyla tutulur;
// öğrenci arayüzünde yeni misafir akışı kullanılmamalıdır.
// ============================================================

import React, { useState, useEffect, useMemo, useRef, Component } from 'react';
import { 
  BookOpen, Clock, AlertTriangle, CheckCircle, User, 
  QrCode, LogOut, Info, ShieldAlert, Coffee, MapPin, 
  StopCircle, LogIn, X, Settings, Users, List, 
  Shield, Smartphone, ArrowRight, Eye, RefreshCw, FileText, Camera,
  Move, Plus, Save, PenTool, Trash2, Edit3
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, runTransaction, collection, getDoc, getDocs, getDocsFromServer, getDocFromServer, query, orderBy, limit, startAfter, deleteDoc } from 'firebase/firestore';

import { getMessaging, getToken, onMessage, isSupported as isMessagingSupported } from 'firebase/messaging';
import { mergePendingRows, nonConflictingPatch, atomicFieldPatch, changedFields, mapLimited, sessionCanRestore } from './src/sync-core.js';
import { preventClosedHoursSessionWrites } from './src/session-write-guard.js';
import { withoutSessionWrites, withoutAccountApprovalWrites, isDeskOwnedByUser, safeBreakCountdown } from './src/authoritative-session.js';
import { requestStudentDesk } from './src/desk-request.js';
import { isIstanbulAfterClose } from './src/closing-visibility.js';
import { mergeAccountApproval } from './src/approval-merge.js';
import { violationPolicyPatch, countRecentUnpardonedViolations } from './src/restriction-policy.js';
import { allowedBreakCount, allowedBreakDuration, isHourlyBreakAvailable, istanbulDayKey } from './src/break-policy.js';
import { createCloudActions } from './src/cloud-transactions.js';
import { APP_VERSION, BUILD_COMMIT } from './src/version.js';
import { currentApplePushInstallGuidance, isAppleMobileDevice } from './src/pwa-support.js';
import { expiredBreakDetails } from './src/break-expiry-audit.js';
import { LeaderLogin, LeaderDashboard, AdminLeaderManager } from './src/leader-ui.jsx';

let app, auth, db, appId;
let tabAuthPersistenceReady = Promise.resolve(null);
try {
  const configuredFirebase = typeof __firebase_config !== 'undefined'
    ? __firebase_config
    : import.meta.env.VITE_FIREBASE_CONFIG;

  if (configuredFirebase) {
    const firebaseConfig = typeof configuredFirebase === 'string'
      ? JSON.parse(configuredFirebase)
      : configuredFirebase;
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    // Firebase kimliği sekmeye özeldir. Öğrenci sekmesi yönetici tokenını değiştirmez.
    tabAuthPersistenceReady = setPersistence(auth, browserSessionPersistence).then(
      () => null,
      error => { console.error('Sekme oturumu başlatılamadı:', _optionalChain([error, 'optionalAccess', _2 => _2.code]) || 'unknown'); return error; }
    );
    db = getFirestore(app);
    appId = typeof __app_id !== 'undefined'
      ? __app_id
      : import.meta.env.VITE_FIREBASE_APP_ID || 'default-app-id';
  }
} catch (error) {
  console.error("Firebase init error:", error);
}

const ensureTabAuthPersistence = async () => {
  const error = await tabAuthPersistenceReady;
  if (error) throw new Error('Bu sekmede oturum saklanamadı. Tarayıcı oturum depolamasını kontrol edip yeniden giriş yapın.');
};
const signInTabWithCustomToken = async token => {
  await ensureTabAuthPersistence();
  return signInWithCustomToken(auth, token);
};
const signInTabAnonymously = async () => {
  await ensureTabAuthPersistence();
  return signInAnonymously(auth);
};

const deletedUserIds = new Set((() => {
  try { return JSON.parse(localStorage.getItem('sgm_deleted_user_ids') || '[]'); }
  catch (e2) { return []; }
})());


const formatTime = (ms) => {
  if (ms < 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const formatDateTime = (date) => {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const generateId = () => Math.random().toString(36).substr(2, 9);
// Yeni / eksik masaların QR değeri masa kimliğinden türetilir; yeniden açılışta değişmez.
// Önceden basılmış QR kodları normalizeDeskQrRows tarafından aynen korunur.
const getStaticDeskQrCode = id => {
  let hash = 0;
  for (const char of String(Number(id))) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return 'QR-' + Number(id) + '-SGM' + String(10000000 + hash % 90000000);
};

const validateQrBackup = (value, expectedAppId) => {
  if (!value || value.format !== 'sgm-desk-qr-backup' || value.version !== 1 ||
      !Array.isArray(value.desks) || !value.desks.length || value.desks.length > 400) {
    throw new Error('Geçerli bir SGM QR yedek dosyası seçin (en fazla 400 masa).');
  }
  if (String(value.appId || '') !== String(expectedAppId || 'local')) {
    throw new Error('Bu QR yedeği farklı bir kurulumdan alınmış. Bu sistemin yedeğini seçin.');
  }
  const ids = new Set(), codes = new Set();
  return value.desks.map(row => {
    const id = Number(_optionalChain([row, 'optionalAccess', _3 => _3.id]));
    const qrCode = _optionalChain([row, 'optionalAccess', _4 => _4.qrCode]);
    if (!Number.isSafeInteger(id) || id < 1 || ids.has(id) || typeof qrCode !== 'string' ||
        qrCode.length > 256 || !new RegExp('^QR-' + id + '-[A-Za-z0-9_-]+$').test(qrCode) || codes.has(qrCode)) {
      throw new Error('Yedekte geçersiz / tekrarlanan masa veya QR kodu var. Hiçbir değişiklik yapılmadı.');
    }
    ids.add(id); codes.add(qrCode);
    return { id, qrCode };
  });
};

const getLocalDayKey = (date = new Date()) => istanbulDayKey(date.getTime());




// Mevcut saat ayarlarıyla aynı cihaz saatini kullanır (kurum: Türkiye).
const updatedBreakAllowance = (user, before, after) => {
  const next = {...(user.breaks || {})};
  for (const type of ['short', 'long', 'hourly']) {
    const key = type === 'short' ? 'shortBreakCount' : type === 'long' ? 'longBreakCount' : 'hourlyBreakCount';
    const oldLimit = allowedBreakCount(before, type);
    const newLimit = allowedBreakCount(after, type);
    const remaining = Number.isFinite(Number(_optionalChain([user, 'access', _5 => _5.breaks, 'optionalAccess', _6 => _6[type]]))) ? Number(user.breaks[type]) : oldLimit;
    next[type] = Math.max(0, Math.min(newLimit, remaining + newLimit - oldLimit));
  }
  return next;
};

const getLastClosingAt = (closeTime, at = Date.now()) => {
  const match = /^(\d{2}):(\d{2})$/.exec(String(closeTime || ''));
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return 0;
  const closing = new Date(at);
  closing.setHours(Number(match[1]), Number(match[2]), 0, 0);
  if (closing.getTime() > at) closing.setDate(closing.getDate() - 1);
  return closing.getTime();
};
const hasSessionBeforeClosing = (desk, cutoff) => {
  if (!desk || !cutoff) return false;
  const timestamps = [];
  if (desk.occupant) timestamps.push(Number(desk.sessionStartTime || 0));
  if (desk.guestOccupant) timestamps.push(Number(desk.guestSessionStartTime || 0));
  if (desk.pendingOccupant) timestamps.push(Number(desk.pendingDeskDeadline || 0) - 5 * 60 * 1000);
  // Tarihi eksik eski kayıtlar açılışta temizlenir; yeni geçerli oturum varsa korunur.
  return timestamps.length > 0 && timestamps.every(t => !Number.isFinite(t) || t <= 0 || t <= cutoff);
};
const clearClosedDesk = desk => ({
  ...desk, status: desk.status === 'disabled' ? 'disabled' : 'available',
  occupant: null, ownerDeviceId: null, guestOccupant: null, guestSessionStartTime: null,
  guestBreakEndTime: null, guestReported: false, guestReportEndTime: null,
  guestReportIssuedAt: null, guestReportVerifiedAt: null,
  pendingOccupant: null, pendingDeskRole: null, pendingDeskDeadline: null,
  breakEndTime: null, reportEndTime: null, reportIssuedAt: null,
  reportVerifiedAt: null, sessionStartTime: null
});

const getMonthKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const getDaysInMonth = (date = new Date()) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();




const escapeHtml = (value) => String(_nullishCoalesce(value, () => ( '')))
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const getDeviceId = () => {
  let did = localStorage.getItem('sgm_device_id');
  if (!did) {
    did = 'DEV-' + generateId();
    localStorage.setItem('sgm_device_id', did);
  }
  return did;
};

// Global Sanitization Functions for Consistency
const cleanIdentityFormat = (str) => String(str || '').replace(/\D/g, '');

const cleanPinFormat = (str) => {
  if (!str) return "";
  return String(str)
      .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
      .replace(/İ/g, 'i')
      .replace(/I/g, 'ı')
      .toLowerCase();
};

// Ad-soyad karşılaştırmalarında boşluk ve büyük/küçük harf farklarını yok sayar.
// Böylece aynı öğrenci adı farklı yazım biçimleriyle tekrar kaydedilemez.
const cleanNameFormat = (str) => {
  if (!str) return "";
  return String(str)
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('tr-TR');
};

// VAPID, Firebase Web Push sertifikasının herkese açık anahtarıdır.
// Gizli anahtar / servis hesabı bilgileri bu alana kaydedilmez.
const normalizeFirebaseVapidKey = value => String(value || '').trim().replace(/\s+/g, '');
const isValidFirebaseVapidKey = value => {
  const key = normalizeFirebaseVapidKey(value);
  if (!/^[A-Za-z0-9_-]{87}=?$/.test(key)) return false;
  try {
    const bytes = atob(key.replace(/-/g, '+').replace(/_/g, '/') + (key.endsWith('=') ? '' : '='));
    return bytes.length === 65 && bytes.charCodeAt(0) === 4;
  } catch (e3) { return false; }
};

const DEFAULT_SETTINGS = {
  openTime: '07:00',
  closeTime: '22:00',
  longBreakCount: 2,
  longBreakDuration: 30,
  hourlyBreakEnabled: true,
  hourlyBreakCount: 1,
  hourlyBreakDuration: 60,
  shortBreakCount: 5,
  shortBreakDuration: 15,
  breakCooldown: 30,
  reportWaitTime: 5,
  strikeLimit: 2,
  reportsEnabled: true,
  useCustomLayout: true,
  layoutSchemaVersion: 3,
  // Kroki alanlarının tüm cihazlarda anlık görünürlüğünü yönetir.
  showMainLibraryKroki: true,
  showBlueRoomKroki: false,
  institutionName: 'Sarıçam Gençlik Merkezi',
  institutionShortName: 'Sarıçam GM',
  managerName: '',
  registrationFormUrl: '',
  registrationFormHistory: [],
  registrationFormUpdatedAt: 0,
  firebaseWebPushVapidKey: '',
  firebaseWebPushVapidUpdatedAt: 0,
};

const INITIAL_DESKS = Array.from({ length: 35 }, (_, i) => ({
  id: i + 1,
  status: 'available',
  occupant: null,
  // Masayı alan ana kullanıcının cihazı.
  ownerDeviceId: null,
  // LEGACY: Eski verilerle uyumluluk için misafir alanları okunur; yeni öğrenci akışında kullanılmaz.
  guestOccupant: null,
  guestSessionStartTime: null,
  guestBreakEndTime: null,
  guestReported: false,
  guestReportEndTime: null,
  guestReportIssuedAt: null,
  guestReportVerifiedAt: null,
  // QR doğrulaması tamamlanana kadar masa/konuk kontenjanını 5 dakika rezerve eder.
  pendingOccupant: null,
  pendingDeskRole: null,
  pendingDeskDeadline: null,
  breakEndTime: null,
  reportEndTime: null,
  reportIssuedAt: null,
  reportVerifiedAt: null,
  sessionStartTime: null,
  qrCode: getStaticDeskQrCode(i + 1),
}));

const legacyIdentity = (id) => { let h=0; for(const c of String(id)) h=(h*31+c.charCodeAt(0))>>>0; return String(10000000+h%90000000); };

// QR görselleri internet / üçüncü taraf görsel servisi olmadan bu dosyada üretilir.
// qrcode-generator 2.0.4, Copyright (c) 2009 Kazuhiko Arase, MIT License.
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
const SGM_QR_FACTORY=(()=>{const v=function(w,x){let s=w;const l=j[x];let e=null,t=0,u=null;const p=[],y={},h=function(r,c){t=s*4+17,e=(function(n){const f=new Array(n);for(let i=0;i<n;i+=1){f[i]=new Array(n);for(let g=0;g<n;g+=1)f[i][g]=null}return f})(t),a(0,0),a(t-7,0),a(0,t-7),D(),P(),m(r,c),s>=7&&E(r),u==null&&(u=nt(s,l,p)),R(u,c)},a=function(r,c){for(let n=-1;n<=7;n+=1)if(!(r+n<=-1||t<=r+n))for(let f=-1;f<=7;f+=1)c+f<=-1||t<=c+f||(0<=n&&n<=6&&(f==0||f==6)||0<=f&&f<=6&&(n==0||n==6)||2<=n&&n<=4&&2<=f&&f<=4?e[r+n][c+f]=!0:e[r+n][c+f]=!1)},_=function(){let r=0,c=0;for(let n=0;n<8;n+=1){h(!0,n);const f=O.getLostPoint(y);(n==0||r>f)&&(r=f,c=n)}return c},P=function(){for(let r=8;r<t-8;r+=1)e[r][6]==null&&(e[r][6]=r%2==0);for(let r=8;r<t-8;r+=1)e[6][r]==null&&(e[6][r]=r%2==0)},D=function(){const r=O.getPatternPosition(s);for(let c=0;c<r.length;c+=1)for(let n=0;n<r.length;n+=1){const f=r[c],i=r[n];if(e[f][i]==null)for(let g=-2;g<=2;g+=1)for(let A=-2;A<=2;A+=1)g==-2||g==2||A==-2||A==2||g==0&&A==0?e[f+g][i+A]=!0:e[f+g][i+A]=!1}},E=function(r){const c=O.getBCHTypeNumber(s);for(let n=0;n<18;n+=1){const f=!r&&(c>>n&1)==1;e[Math.floor(n/3)][n%3+t-8-3]=f}for(let n=0;n<18;n+=1){const f=!r&&(c>>n&1)==1;e[n%3+t-8-3][Math.floor(n/3)]=f}},m=function(r,c){const n=l<<3|c,f=O.getBCHTypeInfo(n);for(let i=0;i<15;i+=1){const g=!r&&(f>>i&1)==1;i<6?e[i][8]=g:i<8?e[i+1][8]=g:e[t-15+i][8]=g}for(let i=0;i<15;i+=1){const g=!r&&(f>>i&1)==1;i<8?e[8][t-i-1]=g:i<9?e[8][15-i-1+1]=g:e[8][15-i-1]=g}e[t-8][8]=!r},R=function(r,c){let n=-1,f=t-1,i=7,g=0;const A=O.getMaskFunction(c);for(let B=t-1;B>0;B-=2)for(B==6&&(B-=1);;){for(let M=0;M<2;M+=1)if(e[f][B-M]==null){let T=!1;g<r.length&&(T=(r[g]>>>i&1)==1),A(f,B-M)&&(T=!T),e[f][B-M]=T,i-=1,i==-1&&(g+=1,i=7)}if(f+=n,f<0||t<=f){f-=n,n=-n;break}}},et=function(r,c){let n=0,f=0,i=0;const g=new Array(c.length),A=new Array(c.length);for(let b=0;b<c.length;b+=1){const C=c[b].dataCount,L=c[b].totalCount-C;f=Math.max(f,C),i=Math.max(i,L),g[b]=new Array(C);for(let I=0;I<g[b].length;I+=1)g[b][I]=255&r.getBuffer()[I+n];n+=C;const Q=O.getErrorCorrectPolynomial(L),G=K(g[b],Q.getLength()-1).mod(Q);A[b]=new Array(Q.getLength()-1);for(let I=0;I<A[b].length;I+=1){const J=I+G.getLength()-A[b].length;A[b][I]=J>=0?G.getAt(J):0}}let B=0;for(let b=0;b<c.length;b+=1)B+=c[b].totalCount;const M=new Array(B);let T=0;for(let b=0;b<f;b+=1)for(let C=0;C<c.length;C+=1)b<g[C].length&&(M[T]=g[C][b],T+=1);for(let b=0;b<i;b+=1)for(let C=0;C<c.length;C+=1)b<A[C].length&&(M[T]=A[C][b],T+=1);return M},nt=function(r,c,n){const f=F.getRSBlocks(r,c),i=S();for(let A=0;A<n.length;A+=1){const B=n[A];i.put(B.getMode(),4),i.put(B.getLength(),O.getLengthInBits(B.getMode(),r)),B.write(i)}let g=0;for(let A=0;A<f.length;A+=1)g+=f[A].dataCount;if(i.getLengthInBits()>g*8)throw"code length overflow. ("+i.getLengthInBits()+">"+g*8+")";for(i.getLengthInBits()+4<=g*8&&i.put(0,4);i.getLengthInBits()%8!=0;)i.putBit(!1);for(;!(i.getLengthInBits()>=g*8||(i.put(236,8),i.getLengthInBits()>=g*8));)i.put(17,8);return et(i,f)};y.addData=function(r,c){c=c||"Byte";let n=null;switch(c){case"Numeric":n=X(r);break;case"Alphanumeric":n=Z(r);break;case"Byte":n=$(r);break;case"Kanji":n=W(r);break;default:throw"mode:"+c}p.push(n),u=null},y.isDark=function(r,c){if(r<0||t<=r||c<0||t<=c)throw r+","+c;return e[r][c]},y.getModuleCount=function(){return t},y.make=function(){if(s<1){let r=1;for(;r<40;r++){const c=F.getRSBlocks(r,l),n=S();for(let i=0;i<p.length;i++){const g=p[i];n.put(g.getMode(),4),n.put(g.getLength(),O.getLengthInBits(g.getMode(),r)),g.write(n)}let f=0;for(let i=0;i<c.length;i++)f+=c[i].dataCount;if(n.getLengthInBits()<=f*8)break}s=r}h(!1,_())},y.createTableTag=function(r,c){r=r||2,c=typeof c>"u"?r*4:c;let n="";n+='<table style="',n+=" border-width: 0px; border-style: none;",n+=" border-collapse: collapse;",n+=" padding: 0px; margin: "+c+"px;",n+='">',n+="<tbody>";for(let f=0;f<y.getModuleCount();f+=1){n+="<tr>";for(let i=0;i<y.getModuleCount();i+=1)n+='<td style="',n+=" border-width: 0px; border-style: none;",n+=" border-collapse: collapse;",n+=" padding: 0px; margin: 0px;",n+=" width: "+r+"px;",n+=" height: "+r+"px;",n+=" background-color: ",n+=y.isDark(f,i)?"#000000":"#ffffff",n+=";",n+='"/>';n+="</tr>"}return n+="</tbody>",n+="</table>",n},y.createSvgTag=function(r,c,n,f){let i={};typeof arguments[0]=="object"&&(i=arguments[0],r=i.cellSize,c=i.margin,n=i.alt,f=i.title),r=r||2,c=typeof c>"u"?r*4:c,n=typeof n=="string"?{text:n}:n||{},n.text=n.text||null,n.id=n.text?n.id||"qrcode-description":null,f=typeof f=="string"?{text:f}:f||{},f.text=f.text||null,f.id=f.text?f.id||"qrcode-title":null;const g=y.getModuleCount()*r+c*2;let A,B,M,T,b="",C;for(C="l"+r+",0 0,"+r+" -"+r+",0 0,-"+r+"z ",b+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',b+=i.scalable?"":' width="'+g+'px" height="'+g+'px"',b+=' viewBox="0 0 '+g+" "+g+'" ',b+=' preserveAspectRatio="xMinYMin meet"',b+=f.text||n.text?' role="img" aria-labelledby="'+U([f.id,n.id].join(" ").trim())+'"':"",b+=">",b+=f.text?'<title id="'+U(f.id)+'">'+U(f.text)+"</title>":"",b+=n.text?'<description id="'+U(n.id)+'">'+U(n.text)+"</description>":"",b+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',b+='<path d="',M=0;M<y.getModuleCount();M+=1)for(T=M*r+c,A=0;A<y.getModuleCount();A+=1)y.isDark(M,A)&&(B=A*r+c,b+="M"+B+","+T+C);return b+='" stroke="transparent" fill="black"/>',b+="</svg>",b},y.createDataURL=function(r,c){r=r||2,c=typeof c>"u"?r*4:c;const n=y.getModuleCount()*r+c*2,f=c,i=n-c;return tt(n,n,function(g,A){if(f<=g&&g<i&&f<=A&&A<i){const B=Math.floor((g-f)/r),M=Math.floor((A-f)/r);return y.isDark(M,B)?0:1}else return 1})},y.createImgTag=function(r,c,n){r=r||2,c=typeof c>"u"?r*4:c;const f=y.getModuleCount()*r+c*2;let i="";return i+="<img",i+=' src="',i+=y.createDataURL(r,c),i+='"',i+=' width="',i+=f,i+='"',i+=' height="',i+=f,i+='"',n&&(i+=' alt="',i+=U(n),i+='"'),i+="/>",i};const U=function(r){let c="";for(let n=0;n<r.length;n+=1){const f=r.charAt(n);switch(f){case"<":c+="&lt;";break;case">":c+="&gt;";break;case"&":c+="&amp;";break;case'"':c+="&quot;";break;default:c+=f;break}}return c},rt=function(r){r=typeof r>"u"?2:r;const n=y.getModuleCount()*1+r*2,f=r,i=n-r;let g,A,B,M,T;const b={"\u2588\u2588":"\u2588","\u2588 ":"\u2580"," \u2588":"\u2584","  ":" "},C={"\u2588\u2588":"\u2580","\u2588 ":"\u2580"," \u2588":" ","  ":" "};let L="";for(g=0;g<n;g+=2){for(B=Math.floor((g-f)/1),M=Math.floor((g+1-f)/1),A=0;A<n;A+=1)T="\u2588",f<=A&&A<i&&f<=g&&g<i&&y.isDark(B,Math.floor((A-f)/1))&&(T=" "),f<=A&&A<i&&f<=g+1&&g+1<i&&y.isDark(M,Math.floor((A-f)/1))?T+=" ":T+="\u2588",L+=r<1&&g+1>=i?C[T]:b[T];L+=`
`}return n%2&&r>0?L.substring(0,L.length-n-1)+Array(n+1).join("\u2580"):L.substring(0,L.length-1)};return y.createASCII=function(r,c){if(r=r||1,r<2)return rt(c);r-=1,c=typeof c>"u"?r*2:c;const n=y.getModuleCount()*r+c*2,f=c,i=n-c;let g,A,B,M;const T=Array(r+1).join("\u2588\u2588"),b=Array(r+1).join("  ");let C="",L="";for(g=0;g<n;g+=1){for(B=Math.floor((g-f)/r),L="",A=0;A<n;A+=1)M=1,f<=A&&A<i&&f<=g&&g<i&&y.isDark(B,Math.floor((A-f)/r))&&(M=0),L+=M?T:b;for(B=0;B<r;B+=1)C+=L+`
`}return C.substring(0,C.length-1)},y.renderTo2dContext=function(r,c){c=c||2;const n=y.getModuleCount();for(let f=0;f<n;f++)for(let i=0;i<n;i++)r.fillStyle=y.isDark(f,i)?"black":"white",r.fillRect(i*c,f*c,c,c)},y};v.stringToBytes=function(w){const x=[];for(let d=0;d<w.length;d+=1){const o=w.charCodeAt(d);x.push(o&255)}return x},v.createStringToBytes=function(w,x){const d=(function(){const s=q(w),l=function(){const u=s.read();if(u==-1)throw"eof";return u};let e=0;const t={};for(;;){const u=s.read();if(u==-1)break;const p=l(),y=l(),h=l(),a=String.fromCharCode(u<<8|p),_=y<<8|h;t[a]=_,e+=1}if(e!=x)throw e+" != "+x;return t})(),o=63;return function(s){const l=[];for(let e=0;e<s.length;e+=1){const t=s.charCodeAt(e);if(t<128)l.push(t);else{const u=d[s.charAt(e)];typeof u=="number"?(u&255)==u?l.push(u):(l.push(u>>>8),l.push(u&255)):l.push(o)}}return l}};const k={MODE_NUMBER:1,MODE_ALPHA_NUM:2,MODE_8BIT_BYTE:4,MODE_KANJI:8},j={L:1,M:0,Q:3,H:2},N={PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7},O=(function(){const w=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],x=1335,d=7973,o=21522,s={},l=function(e){let t=0;for(;e!=0;)t+=1,e>>>=1;return t};return s.getBCHTypeInfo=function(e){let t=e<<10;for(;l(t)-l(x)>=0;)t^=x<<l(t)-l(x);return(e<<10|t)^o},s.getBCHTypeNumber=function(e){let t=e<<12;for(;l(t)-l(d)>=0;)t^=d<<l(t)-l(d);return e<<12|t},s.getPatternPosition=function(e){return w[e-1]},s.getMaskFunction=function(e){switch(e){case N.PATTERN000:return function(t,u){return(t+u)%2==0};case N.PATTERN001:return function(t,u){return t%2==0};case N.PATTERN010:return function(t,u){return u%3==0};case N.PATTERN011:return function(t,u){return(t+u)%3==0};case N.PATTERN100:return function(t,u){return(Math.floor(t/2)+Math.floor(u/3))%2==0};case N.PATTERN101:return function(t,u){return t*u%2+t*u%3==0};case N.PATTERN110:return function(t,u){return(t*u%2+t*u%3)%2==0};case N.PATTERN111:return function(t,u){return(t*u%3+(t+u)%2)%2==0};default:throw"bad maskPattern:"+e}},s.getErrorCorrectPolynomial=function(e){let t=K([1],0);for(let u=0;u<e;u+=1)t=t.multiply(K([1,H.gexp(u)],0));return t},s.getLengthInBits=function(e,t){if(1<=t&&t<10)switch(e){case k.MODE_NUMBER:return 10;case k.MODE_ALPHA_NUM:return 9;case k.MODE_8BIT_BYTE:return 8;case k.MODE_KANJI:return 8;default:throw"mode:"+e}else if(t<27)switch(e){case k.MODE_NUMBER:return 12;case k.MODE_ALPHA_NUM:return 11;case k.MODE_8BIT_BYTE:return 16;case k.MODE_KANJI:return 10;default:throw"mode:"+e}else if(t<41)switch(e){case k.MODE_NUMBER:return 14;case k.MODE_ALPHA_NUM:return 13;case k.MODE_8BIT_BYTE:return 16;case k.MODE_KANJI:return 12;default:throw"mode:"+e}else throw"type:"+t},s.getLostPoint=function(e){const t=e.getModuleCount();let u=0;for(let h=0;h<t;h+=1)for(let a=0;a<t;a+=1){let _=0;const P=e.isDark(h,a);for(let D=-1;D<=1;D+=1)if(!(h+D<0||t<=h+D))for(let E=-1;E<=1;E+=1)a+E<0||t<=a+E||D==0&&E==0||P==e.isDark(h+D,a+E)&&(_+=1);_>5&&(u+=3+_-5)}for(let h=0;h<t-1;h+=1)for(let a=0;a<t-1;a+=1){let _=0;e.isDark(h,a)&&(_+=1),e.isDark(h+1,a)&&(_+=1),e.isDark(h,a+1)&&(_+=1),e.isDark(h+1,a+1)&&(_+=1),(_==0||_==4)&&(u+=3)}for(let h=0;h<t;h+=1)for(let a=0;a<t-6;a+=1)e.isDark(h,a)&&!e.isDark(h,a+1)&&e.isDark(h,a+2)&&e.isDark(h,a+3)&&e.isDark(h,a+4)&&!e.isDark(h,a+5)&&e.isDark(h,a+6)&&(u+=40);for(let h=0;h<t;h+=1)for(let a=0;a<t-6;a+=1)e.isDark(a,h)&&!e.isDark(a+1,h)&&e.isDark(a+2,h)&&e.isDark(a+3,h)&&e.isDark(a+4,h)&&!e.isDark(a+5,h)&&e.isDark(a+6,h)&&(u+=40);let p=0;for(let h=0;h<t;h+=1)for(let a=0;a<t;a+=1)e.isDark(a,h)&&(p+=1);const y=Math.abs(100*p/t/t-50)/5;return u+=y*10,u},s})(),H=(function(){const w=new Array(256),x=new Array(256);for(let o=0;o<8;o+=1)w[o]=1<<o;for(let o=8;o<256;o+=1)w[o]=w[o-4]^w[o-5]^w[o-6]^w[o-8];for(let o=0;o<255;o+=1)x[w[o]]=o;const d={};return d.glog=function(o){if(o<1)throw"glog("+o+")";return x[o]},d.gexp=function(o){for(;o<0;)o+=255;for(;o>=256;)o-=255;return w[o]},d})(),K=function(w,x){if(typeof w.length>"u")throw w.length+"/"+x;const d=(function(){let s=0;for(;s<w.length&&w[s]==0;)s+=1;const l=new Array(w.length-s+x);for(let e=0;e<w.length-s;e+=1)l[e]=w[e+s];return l})(),o={};return o.getAt=function(s){return d[s]},o.getLength=function(){return d.length},o.multiply=function(s){const l=new Array(o.getLength()+s.getLength()-1);for(let e=0;e<o.getLength();e+=1)for(let t=0;t<s.getLength();t+=1)l[e+t]^=H.gexp(H.glog(o.getAt(e))+H.glog(s.getAt(t)));return K(l,0)},o.mod=function(s){if(o.getLength()-s.getLength()<0)return o;const l=H.glog(o.getAt(0))-H.glog(s.getAt(0)),e=new Array(o.getLength());for(let t=0;t<o.getLength();t+=1)e[t]=o.getAt(t);for(let t=0;t<s.getLength();t+=1)e[t]^=H.gexp(H.glog(s.getAt(t))+l);return K(e,0).mod(s)},o},F=(function(){const w=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],x=function(s,l){const e={};return e.totalCount=s,e.dataCount=l,e},d={},o=function(s,l){switch(l){case j.L:return w[(s-1)*4+0];case j.M:return w[(s-1)*4+1];case j.Q:return w[(s-1)*4+2];case j.H:return w[(s-1)*4+3];default:return}};return d.getRSBlocks=function(s,l){const e=o(s,l);if(typeof e>"u")throw"bad rs block @ typeNumber:"+s+"/errorCorrectionLevel:"+l;const t=e.length/3,u=[];for(let p=0;p<t;p+=1){const y=e[p*3+0],h=e[p*3+1],a=e[p*3+2];for(let _=0;_<y;_+=1)u.push(x(h,a))}return u},d})(),S=function(){const w=[];let x=0;const d={};return d.getBuffer=function(){return w},d.getAt=function(o){const s=Math.floor(o/8);return(w[s]>>>7-o%8&1)==1},d.put=function(o,s){for(let l=0;l<s;l+=1)d.putBit((o>>>s-l-1&1)==1)},d.getLengthInBits=function(){return x},d.putBit=function(o){const s=Math.floor(x/8);w.length<=s&&w.push(0),o&&(w[s]|=128>>>x%8),x+=1},d},X=function(w){const x=k.MODE_NUMBER,d=w,o={};o.getMode=function(){return x},o.getLength=function(e){return d.length},o.write=function(e){const t=d;let u=0;for(;u+2<t.length;)e.put(s(t.substring(u,u+3)),10),u+=3;u<t.length&&(t.length-u==1?e.put(s(t.substring(u,u+1)),4):t.length-u==2&&e.put(s(t.substring(u,u+2)),7))};const s=function(e){let t=0;for(let u=0;u<e.length;u+=1)t=t*10+l(e.charAt(u));return t},l=function(e){if("0"<=e&&e<="9")return e.charCodeAt(0)-48;throw"illegal char :"+e};return o},Z=function(w){const x=k.MODE_ALPHA_NUM,d=w,o={};o.getMode=function(){return x},o.getLength=function(l){return d.length},o.write=function(l){const e=d;let t=0;for(;t+1<e.length;)l.put(s(e.charAt(t))*45+s(e.charAt(t+1)),11),t+=2;t<e.length&&l.put(s(e.charAt(t)),6)};const s=function(l){if("0"<=l&&l<="9")return l.charCodeAt(0)-48;if("A"<=l&&l<="Z")return l.charCodeAt(0)-65+10;switch(l){case" ":return 36;case"$":return 37;case"%":return 38;case"*":return 39;case"+":return 40;case"-":return 41;case".":return 42;case"/":return 43;case":":return 44;default:throw"illegal char :"+l}};return o},$=function(w){const x=k.MODE_8BIT_BYTE,d=w,o=v.stringToBytes(w),s={};return s.getMode=function(){return x},s.getLength=function(l){return o.length},s.write=function(l){for(let e=0;e<o.length;e+=1)l.put(o[e],8)},s},W=function(w){const x=k.MODE_KANJI,d=w,o=v.stringToBytes;(function(e,t){const u=o(e);if(u.length!=2||(u[0]<<8|u[1])!=t)throw"sjis not supported."})("\u53CB",38726);const s=o(w),l={};return l.getMode=function(){return x},l.getLength=function(e){return~~(s.length/2)},l.write=function(e){const t=s;let u=0;for(;u+1<t.length;){let p=(255&t[u])<<8|255&t[u+1];if(33088<=p&&p<=40956)p-=33088;else if(57408<=p&&p<=60351)p-=49472;else throw"illegal char at "+(u+1)+"/"+p;p=(p>>>8&255)*192+(p&255),e.put(p,13),u+=2}if(u<t.length)throw"illegal char at "+(u+1)},l},Y=function(){const w=[],x={};return x.writeByte=function(d){w.push(d&255)},x.writeShort=function(d){x.writeByte(d),x.writeByte(d>>>8)},x.writeBytes=function(d,o,s){o=o||0,s=s||d.length;for(let l=0;l<s;l+=1)x.writeByte(d[l+o])},x.writeString=function(d){for(let o=0;o<d.length;o+=1)x.writeByte(d.charCodeAt(o))},x.toByteArray=function(){return w},x.toString=function(){let d="";d+="[";for(let o=0;o<w.length;o+=1)o>0&&(d+=","),d+=w[o];return d+="]",d},x},V=function(){let w=0,x=0,d=0,o="";const s={},l=function(t){o+=String.fromCharCode(e(t&63))},e=function(t){if(t<0)throw"n:"+t;if(t<26)return 65+t;if(t<52)return 97+(t-26);if(t<62)return 48+(t-52);if(t==62)return 43;if(t==63)return 47;throw"n:"+t};return s.writeByte=function(t){for(w=w<<8|t&255,x+=8,d+=1;x>=6;)l(w>>>x-6),x-=6},s.flush=function(){if(x>0&&(l(w<<6-x),w=0,x=0),d%3!=0){const t=3-d%3;for(let u=0;u<t;u+=1)o+="="}},s.toString=function(){return o},s},q=function(w){const x=w;let d=0,o=0,s=0;const l={};l.read=function(){for(;s<8;){if(d>=x.length){if(s==0)return-1;throw"unexpected end of file./"+s}const u=x.charAt(d);if(d+=1,u=="=")return s=0,-1;if(u.match(/^\s$/))continue;o=o<<6|e(u.charCodeAt(0)),s+=6}const t=o>>>s-8&255;return s-=8,t};const e=function(t){if(65<=t&&t<=90)return t-65;if(97<=t&&t<=122)return t-97+26;if(48<=t&&t<=57)return t-48+52;if(t==43)return 62;if(t==47)return 63;throw"c:"+t};return l},z=function(w,x){const d=w,o=x,s=new Array(w*x),l={};l.setPixel=function(p,y,h){s[y*d+p]=h},l.write=function(p){p.writeString("GIF87a"),p.writeShort(d),p.writeShort(o),p.writeByte(128),p.writeByte(0),p.writeByte(0),p.writeByte(0),p.writeByte(0),p.writeByte(0),p.writeByte(255),p.writeByte(255),p.writeByte(255),p.writeString(","),p.writeShort(0),p.writeShort(0),p.writeShort(d),p.writeShort(o),p.writeByte(0);const y=2,h=t(y);p.writeByte(y);let a=0;for(;h.length-a>255;)p.writeByte(255),p.writeBytes(h,a,255),a+=255;p.writeByte(h.length-a),p.writeBytes(h,a,h.length-a),p.writeByte(0),p.writeString(";")};const e=function(p){const y=p;let h=0,a=0;const _={};return _.write=function(P,D){if(P>>>D)throw"length over";for(;h+D>=8;)y.writeByte(255&(P<<h|a)),D-=8-h,P>>>=8-h,a=0,h=0;a=P<<h|a,h=h+D},_.flush=function(){h>0&&y.writeByte(a)},_},t=function(p){const y=1<<p,h=(1<<p)+1;let a=p+1;const _=u();for(let R=0;R<y;R+=1)_.add(String.fromCharCode(R));_.add(String.fromCharCode(y)),_.add(String.fromCharCode(h));const P=Y(),D=e(P);D.write(y,a);let E=0,m=String.fromCharCode(s[E]);for(E+=1;E<s.length;){const R=String.fromCharCode(s[E]);E+=1,_.contains(m+R)?m=m+R:(D.write(_.indexOf(m),a),_.size()<4095&&(_.size()==1<<a&&(a+=1),_.add(m+R)),m=R)}return D.write(_.indexOf(m),a),D.write(h,a),D.flush(),P.toByteArray()},u=function(){const p={};let y=0;const h={};return h.add=function(a){if(h.contains(a))throw"dup key:"+a;p[a]=y,y+=1},h.size=function(){return y},h.indexOf=function(a){return p[a]},h.contains=function(a){return typeof p[a]<"u"},h};return l},tt=function(w,x,d){const o=z(w,x);for(let t=0;t<x;t+=1)for(let u=0;u<w;u+=1)o.setPixel(u,t,d(u,t));const s=Y();o.write(s);const l=V(),e=s.toByteArray();for(let t=0;t<e.length;t+=1)l.writeByte(e[t]);return l.flush(),"data:image/gif;base64,"+l};return v})();

SGM_QR_FACTORY.stringToBytes = value => Array.from(new TextEncoder().encode(value));
const sgmQrSvgCache = new Map();
const getDeskQrSvg = (desk) => {
  const value = String(_optionalChain([desk, 'optionalAccess', _7 => _7.qrCode]) || '');
  if (!value) throw new Error('Bu masanın QR kodu yok.');
  if (sgmQrSvgCache.has(value)) return sgmQrSvgCache.get(value);
  const qr = SGM_QR_FACTORY(0, 'M');
  qr.addData(value, 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  const dimension = count + 8; // Okunabilirlik için dört modüllük beyaz kenar.
  let path = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) path += 'M' + (col + 4) + ',' + (row + 4) + 'h1v1h-1z';
    }
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + dimension + '" height="' + dimension + '" viewBox="0 0 ' + dimension + ' ' + dimension + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d="' + path + '" fill="black"/></svg>';
  if (sgmQrSvgCache.size >= 500) sgmQrSvgCache.clear();
  sgmQrSvgCache.set(value, svg);
  return svg;
};
const getDeskQrImageUrl = (desk, size = 600) => {
  const svg = getDeskQrSvg(desk).replace(/width="\d+" height="\d+"/, 'width="' + size + '" height="' + size + '"');
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
};
const normalizeDeskQrRows = rows => (Array.isArray(rows) ? rows : [])
  .filter(desk => desk && Number.isInteger(Number(desk.id)) && Number(desk.id) > 0)
  .map(desk => ({ ...desk, id: Number(desk.id),
    // Mevcut QR aynen korunur. Eksik kod tüm cihazlarda aynı sonuçla tamamlanır.
    qrCode: desk.qrCode || getStaticDeskQrCode(desk.id)
  }));

// Ana Salonun 35 masasını tamamlar; mevcut oturumlar ve QR kodları korunur.
const completeMainLibraryDesks = (rows, qrFallbackRows = []) => {
  const byId = new Map((Array.isArray(rows) ? rows : [])
    .filter(d => d && Number.isInteger(Number(d.id)) && Number(d.id) >= 1 && Number(d.id) <= 35)
    .map(d => [Number(d.id), d]));
  const qrById = new Map((Array.isArray(qrFallbackRows) ? qrFallbackRows : [])
    .filter(d => d && d.qrCode).map(d => [Number(d.id), d.qrCode]));
  return normalizeDeskQrRows(INITIAL_DESKS.map(defaultDesk => {
    const current = byId.get(defaultDesk.id);
    // Eski kayıtlardan yalnızca QR kurtarılır; eski dolu oturumlar yeniden açılmaz.
    return { ...(current || defaultDesk), id: defaultDesk.id,
      qrCode: _optionalChain([current, 'optionalAccess', _8 => _8.qrCode]) || qrById.get(defaultDesk.id) || '' };
  }));
};

const normalizeIdentityUsers = (rows) => {
  const assigned=new Map();const used=new Set();
  for(const u of [...rows].sort((a,b)=>String(a.id).localeCompare(String(b.id)))) {
    let identity=/^\d{8}$/.test(u.identityNo || '')?u.identityNo:legacyIdentity(u.id);
    while(used.has(identity))identity=String(10000000+(Number(identity)-10000000+1)%90000000);
    used.add(identity);assigned.set(u.id,identity);
  }
  // Mevcut GM kodlarını koru; kodu olmayan eski hesaba kalıcı ve benzersiz kod ata.
  const codes = new Map(); const usedCodes = new Set();
  const ordered = [...rows].sort((a,b) => String(a.id).localeCompare(String(b.id)));
  for (const u of ordered.filter(u => /^\d{8}$/.test(String(u.specialCode || '')))) {
    const code = String(u.specialCode);
    if (!usedCodes.has(code)) { codes.set(u.id, code); usedCodes.add(code); }
  }
  for (const u of ordered.filter(u => !codes.has(u.id))) {
    let code = assigned.get(u.id);
    while (usedCodes.has(code)) code = String(10000000 + (Number(code) - 10000000 + 1) % 90000000);
    codes.set(u.id, code); usedCodes.add(code);
  }
  return rows.map(({phone:oldPhone,...u})=>({...u,identityNo:assigned.get(u.id),specialCode:codes.get(u.id),
    ...(Number(u.activeDeskId)>35?{activeDeskId:null,activeDeskRole:null}:{}),
    ...(Number(u.pendingDeskId)>35?{pendingDeskId:null,pendingDeskDeadline:null}:{})}));
};
const INITIAL_USERS = [];
const DESK_RECLAIM_WAIT_MS = 30 * 60 * 1000;
const deskWaitRemaining = (user, at = Date.now()) => Math.max(0, Number(_optionalChain([user, 'optionalAccess', _9 => _9.deskReclaimAllowedAt]) || 0) - at);
const mergeDeskAccessPolicy = (local, remote) => {
  const newer = Number(_optionalChain([local, 'optionalAccess', _10 => _10.gmDeskAccessAt]) || 0) >= Number(_optionalChain([remote, 'optionalAccess', _11 => _11.gmDeskAccessAt]) || 0) ? local : remote;
  return newer ? {
    gmDeskAccessAt: Number(newer.gmDeskAccessAt || 0),
    deskReleasedAt: Number(newer.deskReleasedAt || 0),
    deskReclaimAllowedAt: Number(newer.deskReclaimAllowedAt || 0)
  } : {};
};
const normalizeRegistrationUrl = value => String(value || '').trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
const mergeRegistrationSettings = (base = {}, incoming = {}) => {
  const baseUrl = normalizeRegistrationUrl(base.registrationFormUrl);
  const incomingUrl = normalizeRegistrationUrl(incoming.registrationFormUrl);
  // Kaydedilmiş bağlantı eski/boş bir snapshot veya açık başka bir cihaz tarafından silinmesin.
  const preserveBase = Number(base.registrationFormUpdatedAt || 0) > Number(incoming.registrationFormUpdatedAt || 0) ||
    (!!baseUrl && !incomingUrl && !Number(incoming.registrationFormUpdatedAt || 0));
  const chosen = preserveBase ? base : incoming;
  // Eski açık cihazın ayarları yeni kaydedilmiş VAPID anahtarını ezmesin.
  const pushChosen = Number(base.firebaseWebPushVapidUpdatedAt || 0) > Number(incoming.firebaseWebPushVapidUpdatedAt || 0)
    ? base : incoming;
  return { ...base, ...incoming,
    registrationFormUrl: normalizeRegistrationUrl(chosen.registrationFormUrl),
    registrationFormHistory: Array.isArray(chosen.registrationFormHistory) ? chosen.registrationFormHistory : [],
    registrationFormUpdatedAt: Number(chosen.registrationFormUpdatedAt || 0),
    firebaseWebPushVapidKey: normalizeFirebaseVapidKey(pushChosen.firebaseWebPushVapidKey),
    firebaseWebPushVapidUpdatedAt: Number(pushChosen.firebaseWebPushVapidUpdatedAt || 0)
  };
};
const validRegistrationUrl = value => {
  try {
    const url = new URL(normalizeRegistrationUrl(value));
    return url.protocol === 'https:' && !url.username && !url.password &&
      ((url.hostname === 'docs.google.com' && url.pathname.startsWith('/forms/')) ||
       url.hostname === 'forms.gle');
  } catch (e4) { return false; }
};
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const isRestricted = (user, at = Date.now()) => _optionalChain([user, 'optionalAccess', _12 => _12.formInfoRestricted]) === true || _optionalChain([user, 'optionalAccess', _13 => _13.blocked]) === true || _optionalChain([user, 'optionalAccess', _14 => _14.pendingApproval]) === true || Number(_optionalChain([user, 'optionalAccess', _15 => _15.restrictedUntil]) || 0) > at;
const shouldRestoreReportPermission = (user, at = Date.now()) => Boolean(user) && !isRestricted(user, at) && user.canReport === false;
const lostDeskToday = (user, deskId) => _optionalChain([user, 'optionalAccess', _16 => _16.lostDeskDate]) === getLocalDayKey() && (_optionalChain([user, 'optionalAccess', _17 => _17.lostDeskIds]) || []).includes(Number(deskId));
const applyViolationPolicy = (user, deskId, at = Date.now()) => violationPolicyPatch(user, deskId, at, getLocalDayKey);

const generateDefaultLayout = () => {
 const e=[]; let n=0;
 const shape=(text,x,y,w,h,bg='#e2e8f0')=>e.push({id:'main-'+n++,type:'shape',area:'main',text,x,y,w,h,bg});
 const desk=(id,x,y,w,h,chair)=>e.push({id:'desk-'+id,type:'desk',area:'main',deskId:id,x,y,w,h,chair});
 e.push({id:'room-main',type:'room',area:'main',text:'Ana Salon'});
 shape('Kolon',30,90,65,65); shape('Pencere',5,175,15,375,'#cffafe'); shape('Pencere',5,595,15,185,'#cffafe');
 shape('Kitaplık',475,825,65,125,'#fed7aa'); shape('GİRİŞ',675,895,140,55,'#dcfce7');
 [13,12,11,10,9].forEach((id,i)=>desk(id,100+i*140,20,140,65,'bottom'));
 [8,7,6,5,4,3,2,1].forEach((id,i)=>desk(id,800,115+i*88,75,88,'left'));
 [14,15,16,17].forEach((id,i)=>desk(id,30,175+i*100,75,100,'right'));
 [18,19,20].forEach((id,i)=>desk(id,30,600+i*65,115,65,'right'));
 [21,22,23].forEach((id,i)=>desk(id,30+i*145,875,145,75,'top'));
 [[34,35,32,33],[30,31,28,29],[26,27,24,25]].forEach((ids,k)=>ids.forEach((id,i)=>desk(id,350+(i%2)*100,195+k*225+Math.floor(i/2)*75,100,75,i%2?'right':'left')));
 return e;
};

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Error Boundary Caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        React.createElement('div', { className: "min-h-screen bg-slate-900 flex items-center justify-center p-4"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 491}}
          , React.createElement('div', { className: "bg-white p-8 rounded-2xl max-w-lg w-full shadow-2xl space-y-4 border-l-8 border-red-500"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 492}}
            , React.createElement('h2', { className: "text-2xl font-black text-red-600 flex items-center gap-2"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 493}}
              , React.createElement(AlertTriangle, { className: "w-8 h-8" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 494}} ), " Kritik Bir Hata Oluştu"
            )
            , React.createElement('p', { className: "text-slate-600", __self: this, __source: {fileName: _jsxFileName, lineNumber: 496}}, "Sistem çalışırken beklenmeyen bir durumla karşılaştı. Uygulamanın çökmesini engelledik ancak sayfayı yenilemeniz gerekebilir."            )
            , React.createElement('div', { className: "bg-slate-100 p-4 rounded-xl text-xs font-mono text-slate-700 overflow-x-auto"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 497}}
              , React.createElement('strong', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 498}}, "Hata Detayı:" ), React.createElement('br', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 498}})
              , this.state.error && this.state.error.toString()
            )
            , React.createElement('button', { onClick: () => window.location.reload(), className: "w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 501}}, "Sistemi Yeniden Yükle"

            )
          )
        )
      );
    }
    return this.props.children;
  }
}

const Modal = ({ isOpen, onClose, title, children, type = 'info' }) => {
  if (!isOpen) return null;
  const colors = {
    info: 'text-blue-600 bg-blue-50',
    warning: 'text-yellow-600 bg-yellow-50',
    danger: 'text-red-600 bg-red-50',
    success: 'text-green-600 bg-green-50'
  };
  const Icon = type === 'danger' || type === 'warning' ? AlertTriangle : type === 'success' ? CheckCircle : Info;

  return (
    React.createElement('div', { className: "fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[120]"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 523}}
      , React.createElement('div', { className: "bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 524}}
        , React.createElement('div', { className: "p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 525}}
          , React.createElement('div', { className: "flex items-center gap-3"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 526}}
            , React.createElement('div', { className: `p-2 rounded-xl ${colors[type]}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 527}}
              , React.createElement(Icon, { className: "w-6 h-6" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 528}} )
            )
            , React.createElement('h3', { className: "font-bold text-slate-800 text-lg"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 530}}, title)
          )
          , onClose && (
            React.createElement('button', { onClick: onClose, className: "text-slate-400 hover:text-slate-600 p-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 533}}
              , React.createElement(X, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 534}} )
            )
          )
        )
        , React.createElement('div', { className: "p-6 overflow-y-auto" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 538}}
          , children
        )
      )
    )
  );
};

const ScannerModal = ({ isOpen, onClose, title, onScan, autoSubmit = false }) => {
  const [scannedData, setScannedData] = useState(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!document.getElementById('html5-qrcode-script')) {
      const script = document.createElement('script');
      script.id = 'html5-qrcode-script';
      script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      script.async = true;
      script.onload = () => setScriptLoaded(true);
      document.body.appendChild(script);
    } else {
      setScriptLoaded(true);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (isOpen && scriptLoaded && !scannedData) {
      const timer = setTimeout(() => {
        if (!isMounted || !document.getElementById('reader')) return;
        
        try {
          // Eğer önceden kalma bir scanner varsa temizle
          if (scannerRef.current && scannerRef.current.isScanning) {
             scannerRef.current.stop().catch(e => console.warn(e));
          }

          const html5QrCode = new window.Html5Qrcode("reader");
          scannerRef.current = html5QrCode;

          html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 220, height: 220 },
              aspectRatio: 1.0,
            },
            (decodedText) => {
              if (!isMounted) return;

              // İhbar sonrası "Masadayım" doğrulamasında QR algılanır algılanmaz işlemi tamamla.
              // Böylece kullanıcı ikinci kez "Evet, Doğru" butonuna basmak zorunda kalmaz ve
              // 1 saniyelik süre kontrolü ile doğrulama arasında yarış oluşmaz.
              if (autoSubmit) {
                isMounted = false;
                if (scannerRef.current) {
                  scannerRef.current.stop().catch(e => console.warn(e));
                }
                onScan(decodedText);
                return;
              }

              setScannedData(decodedText);
              if (scannerRef.current) {
                scannerRef.current.stop().catch(e => console.warn(e));
              }
            },
            (errorMessage) => {
              // Ignore scan iteration errors silently
            }
          ).catch((err) => {
            console.warn("Kamera başlatılamadı:", err);
          });
        } catch (error) {
          console.error("QR Motoru Hatası:", error);
        }
      }, 500); // Mobilde çökmeyi önlemek için timer süresi 500ms yapıldı.

      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }

    return () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().then(() => {
              if (scannerRef.current) scannerRef.current.clear();
            }).catch(e => console.warn(e));
          }
        } catch (e) {}
        scannerRef.current = null;
      }
    };
  }, [isOpen, scriptLoaded, scannedData, autoSubmit]);

  useEffect(() => {
    if (!isOpen) {
      setScannedData(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parsedDeskId = scannedData ? scannedData.split('-')[1] : null;

  return (
    React.createElement('div', { className: "fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[110]"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 648}}
      , React.createElement('div', { className: "bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 649}}
        , React.createElement('div', { className: "p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 650}}
          , React.createElement('div', { className: "flex items-center gap-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 651}}
            , React.createElement(QrCode, { className: "w-6 h-6 text-blue-600"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 652}} )
            , React.createElement('h3', { className: "font-bold text-slate-800 text-lg"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 653}}, title || "QR Kod Okut")
          )
          , React.createElement('button', { onClick: onClose, className: "text-slate-400 hover:text-slate-600 p-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 655}}
            , React.createElement(X, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 656}} )
          )
        )

        , React.createElement('div', { className: "p-6 space-y-6" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 660}}
          , React.createElement('div', { className: "relative w-full h-80 bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center shadow-inner"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 661}}
            , scannedData ? (
              React.createElement('div', { className: "absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-6 text-center z-20"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 663}}
                , React.createElement('div', { className: "w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-blue-500/50"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 664}}
                  , React.createElement(CheckCircle, { className: "text-white w-10 h-10"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 665}} )
                )
                , React.createElement('p', { className: "text-slate-300 mb-2 text-sm"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 667}}, "QR Kod Algılandı"  )
                , React.createElement('p', { className: "text-white mb-6 text-lg"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 668}}, "Masa "
                   , React.createElement('span', { className: "font-black text-blue-400 text-3xl px-2"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 669}}, parsedDeskId || "?"), " doğru mu?"
                )
                , React.createElement('div', { className: "flex gap-3 w-full"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 671}}
                  , React.createElement('button', { onClick: () => setScannedData(null), className: "flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-colors"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 672}}, "Tekrar Okut" )
                  , React.createElement('button', { onClick: () => onScan(scannedData), className: "flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors shadow-md"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 673}}, "Evet, Doğru" )
                )
              )
            ) : (
              React.createElement(React.Fragment, null
                , !scriptLoaded && (
                  React.createElement('div', { className: "absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 679}}
                    , React.createElement(Camera, { className: "w-12 h-12 text-slate-500 mb-2 animate-pulse"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 680}} )
                    , React.createElement('p', { className: "text-sm text-slate-300" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 681}}, "Motor yükleniyor..." )
                  )
                )
                , React.createElement('div', { id: "reader", className: "w-full h-full object-cover"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 684}})
              )
            )
          )
        )
      )
    )
  );
};

// Eski sabit KrokiMap kaldırıldı; tek aktif kroki DynamicKrokiMap üzerinden çalışır.

const DynamicKrokiMap = ({ desks, layoutElements, onDeskClick, myDeskId, isPublic = false, isAdmin = false, area = 'all' }) => {
  const getDesk = (id) => desks.find((d) => Number(d.id) === Number(id));

  // Editörde kaydedilen tek kroki içinde Ana Salon (1-44) ve Ana Salon (45-56)
  // ayrı ayrı gösterilebilsin. Eski kayıtlarla uyumluluk için area alanı olmayan şekillerde
  // koordinata göre mevcut varsayılan ayrım korunur.
  const isElementVisibleForArea = (el) => {
      if (_optionalChain([el, 'optionalAccess', _18 => _18.type]) === 'room') return false;
      if (area === 'all') return true;

      if (_optionalChain([el, 'optionalAccess', _19 => _19.area])) {
          return el.area === area;
      }

      if (_optionalChain([el, 'optionalAccess', _20 => _20.type]) === 'desk') {
          const deskId = Number(el.deskId);
          if (area === 'main') return deskId >= 1 && deskId <= 44;
          if (area === 'blue') return deskId >= 45 && deskId <= 56;
      }

      // Önceden oluşturulmuş şekillerde area bilgisi yoksa mevcut varsayılan
      // kroki koordinatına göre Ana Salon solda, Ana Salon sağda kabul edilir.
      const x = Number(_optionalChain([el, 'optionalAccess', _21 => _21.x]) || 0);
      return area === 'blue' ? x < 450 : x >= 450;
  };

  const visibleLayoutElements = (Array.isArray(layoutElements) ? layoutElements : [])
      .filter(isElementVisibleForArea);

  return (
    React.createElement('div', { className: "relative w-full h-[600px] sm:h-[800px] bg-slate-50 overflow-auto border-2 border-slate-300 rounded-2xl custom-scrollbar shadow-inner"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 726}}
       , React.createElement('div', { className: "relative w-[900px] h-[1000px] bg-white bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 727}}
          , visibleLayoutElements.map(el => {
              if (el.type === 'desk') {
                  const desk = getDesk(el.deskId);

                  let statusClasses = 'bg-slate-200 text-slate-400 border-slate-300 opacity-60';
                  if (desk) {
                      const isMyDesk = desk.id === myDeskId;
                      const isReserved = !!(desk.pendingOccupant && Number(desk.pendingDeskDeadline || 0) > Date.now());
                      if (isMyDesk) statusClasses = 'bg-blue-600 text-white border-blue-700 shadow-lg ring-2 ring-blue-300 z-10 scale-110';
                      else if (isReserved) statusClasses = 'bg-purple-500 text-white border-purple-700 shadow-md';
                      else if (desk.status === 'available') statusClasses = 'bg-white text-slate-700 hover:bg-slate-50 border-slate-400';
                      else if (desk.status === 'occupied') statusClasses = 'bg-red-500 text-white border-red-700 hover:bg-red-600';
                      else if (desk.status === 'on_break') statusClasses = 'bg-yellow-400 text-yellow-900 border-yellow-600';
                      else if (desk.status === 'reported') statusClasses = 'bg-orange-500 text-white border-orange-700 animate-pulse';
                  }
                  
                  return (
                      React.createElement('button', {
                        key: el.id,
                        onClick: () => desk && onDeskClick && onDeskClick(desk),
                        disabled: isPublic || (desk && !isAdmin && desk.status === 'disabled'),
                        style: { left: el.x, top: el.y, width: el.w, height: el.h },
                        className: `absolute flex flex-col items-center justify-center font-bold border transition-all ${statusClasses} ${!isPublic && desk && 'cursor-pointer'} ${isPublic && 'cursor-default'}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 745}}

                        , el.chair && React.createElement('span', { 'aria-hidden': "true", style: {position:'absolute',background:'#334155',borderRadius:8,width:['left','right'].includes(el.chair)?20:42,height:['left','right'].includes(el.chair)?42:20,...(el.chair==='left'?{left:-22,top:'22%'}:el.chair==='right'?{right:-22,top:'22%'}:el.chair==='top'?{top:-22,left:'32%'}:{bottom:-22,left:'32%'})}, __self: this, __source: {fileName: _jsxFileName, lineNumber: 752}})
                        , React.createElement('span', { className: "text-base sm:text-lg leading-none"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 753}}, el.deskId)
                        , desk && (isPublic || (desk.pendingOccupant && Number(desk.pendingDeskDeadline || 0) > Date.now())) && (
                            React.createElement('span', { className: "text-[9px] uppercase opacity-90 mt-0.5 leading-none tracking-tighter"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 755}}
                                , (desk.pendingOccupant && Number(desk.pendingDeskDeadline || 0) > Date.now()) ? 'REZERVE' : desk.status === 'available' ? 'BOŞ' : desk.status === 'occupied' ? 'DOLU' : desk.status === 'on_break' ? 'MOLA' : desk.status === 'reported' ? 'KONTROL' : 'KAPALI'
                            )
                        )
                      )
                  );
              } else {
                  return (
                      React.createElement('div', { key: el.id, style: { left: el.x, top: el.y, width: el.w, height: el.h, backgroundColor: el.bg || '#fef3c7' }, className: "absolute flex items-center justify-center text-sm font-bold text-slate-800 border-2 border-slate-800 shadow-md pointer-events-none text-center px-1 overflow-hidden"             , __self: this, __source: {fileName: _jsxFileName, lineNumber: 763}}
                          , el.text
                      )
                  );
              }
          })
       )
    )
  );
};

const LayoutEditor = ({ initialElements, onSave }) => {
  const normalize = (items) => {
    const arr = Array.isArray(items) ? items.map(el => ({ ...el })) : [];
    const hasRooms = arr.some(el => el.type === 'room');
    if (hasRooms) return arr;
    return generateDefaultLayout();
  };
  const [elements, setElements] = useState(() => normalize(initialElements));
  const [selectedId, setSelectedId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [activeArea, setActiveArea] = useState('main');
  const canvasRef = useRef(null);

  useEffect(() => {
    const next = normalize(initialElements);
    setElements(next);
    setSelectedId(null);
    const rooms = next.filter(el => el.type === 'room');
    if (!rooms.some(r => r.area === activeArea)) setActiveArea(_optionalChain([rooms, 'access', _22 => _22[0], 'optionalAccess', _23 => _23.area]) || 'main');
  }, [initialElements]);

  const rooms = elements.filter(el => el.type === 'room');
  const selectedElement = elements.find(el => el.id === selectedId);
  const visibleElements = elements.filter(el => el.type !== 'room' && (el.area || 'main') === activeArea);
  const activeRoom = rooms.find(r => r.area === activeArea);

  const addRoom = () => {
    const name = window.prompt('Yeni oda adı nedir?');
    if (!name || !name.trim()) return;
    const area = 'room-' + generateId();
    setElements(prev => [...prev, { id: generateId(), type: 'room', area, text: name.trim() }]);
    setActiveArea(area);
    setSelectedId(null);
  };

  const handleAddDesk = () => {
    const maxId = elements.reduce((max, el) => el.type === 'desk' ? Math.max(max, Number(el.deskId) || 0) : max, 0);
    setElements(prev => [...prev, { id: generateId(), type: 'desk', area: activeArea, deskId: maxId + 1, x: 100, y: 100, w: 72, h: 58 }]);
  };
  const handleAddShape = () => setElements(prev => [...prev, { id: generateId(), type: 'shape', area: activeArea, text: 'Kitaplık', bg: '#fef3c7', x: 220, y: 120, w: 140, h: 45 }]);
  const resetOfficial = () => {
    if (!window.confirm('Eski kroki editörü tamamen sıfırlanacak ve verdiğiniz Ana Salon + Ana Salon krokileri yüklenecek. Devam edilsin mi?')) return;
    const next = generateDefaultLayout();
    setElements(next); setActiveArea('main'); setSelectedId(null);
  };
  const deleteRoom = () => {
    if (activeArea === 'main' || activeArea === 'blue') return;
    if (!window.confirm(`${_optionalChain([activeRoom, 'optionalAccess', _24 => _24.text]) || 'Bu oda'} ve içindeki tüm kroki öğeleri silinsin mi?`)) return;
    setElements(prev => prev.filter(el => el.area !== activeArea));
    setActiveArea('main'); setSelectedId(null);
  };
  const updateSelected = (key, value) => setElements(prev => prev.map(el => el.id === selectedId ? { ...el, [key]: value } : el));
  const handleDeleteSelected = () => { setElements(prev => prev.filter(el => el.id !== selectedId)); setSelectedId(null); };
  const handleMouseDown = (e,id) => {
    if (e.button !== 0 || !canvasRef.current) return;
    e.stopPropagation(); const rect=canvasRef.current.getBoundingClientRect(); const el=elements.find(x=>x.id===id); if(!el)return;
    setDragStart({x:e.clientX-rect.left-el.x,y:e.clientY-rect.top-el.y}); setDraggingId(id); setSelectedId(id);
  };
  const handleMouseMove = (e) => {
    if (!draggingId || !canvasRef.current) return;
    const rect=canvasRef.current.getBoundingClientRect();
    const x=Math.max(0,Math.round((e.clientX-rect.left-dragStart.x)/10)*10); const y=Math.max(0,Math.round((e.clientY-rect.top-dragStart.y)/10)*10);
    setElements(prev=>prev.map(el=>el.id===draggingId?{...el,x,y}:el));
  };

  return (
    React.createElement('div', { className: "bg-slate-50", __self: this, __source: {fileName: _jsxFileName, lineNumber: 841}}
      , React.createElement('div', { className: "p-4 bg-white border-b border-slate-200 flex flex-wrap items-center gap-2"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 842}}
        , rooms.map(room => React.createElement('button', { key: room.id, onClick: ()=>{setActiveArea(room.area);setSelectedId(null)}, className: `px-4 py-2 rounded-xl font-bold text-sm ${activeArea===room.area?'bg-blue-600 text-white':'bg-slate-100 text-slate-700 hover:bg-slate-200'}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 843}}, room.text))
        , React.createElement('button', { onClick: addRoom, className: "px-4 py-2 rounded-xl font-bold text-sm bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex items-center gap-1"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 844}}, React.createElement(Plus, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 844}}), " Yeni Oda"  )
        , activeArea!=='main' && activeArea!=='blue' && React.createElement('button', { onClick: deleteRoom, className: "px-4 py-2 rounded-xl font-bold text-sm bg-red-100 text-red-700 hover:bg-red-200"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 845}}, React.createElement(Trash2, { className: "w-4 h-4 inline mr-1"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 845}}), " Odayı Sil"  )
      )
      , React.createElement('div', { className: "flex flex-col md:flex-row h-[720px] select-none"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 847}}
        , React.createElement('div', { className: "w-full md:w-80 bg-white border-r border-slate-200 flex flex-col shrink-0"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 848}}
          , React.createElement('div', { className: "p-4 border-b border-slate-200 space-y-3"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 849}}
            , React.createElement('h3', { className: "font-black text-slate-800" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 850}}, _optionalChain([activeRoom, 'optionalAccess', _25 => _25.text]) || 'Kroki', " Araçları" )
            , React.createElement('div', { className: "grid grid-cols-2 gap-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 851}}
              , React.createElement('button', { onClick: handleAddDesk, className: "py-2 bg-blue-100 text-blue-700 rounded-lg font-bold text-sm"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 852}}, React.createElement(Plus, { className: "w-4 h-4 inline"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 852}}), " Masa" )
              , React.createElement('button', { onClick: handleAddShape, className: "py-2 bg-amber-100 text-amber-700 rounded-lg font-bold text-sm"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 853}}, React.createElement(Plus, { className: "w-4 h-4 inline"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 853}}), " Şekil" )
            )
            , React.createElement('button', { onClick: resetOfficial, className: "w-full py-2 bg-slate-200 text-slate-700 rounded-lg font-bold text-sm flex items-center justify-center gap-2"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 855}}, React.createElement(RefreshCw, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 855}}), " Verdiğim Krokilere Sıfırla"   )
            , React.createElement('button', { onClick: ()=>onSave(elements), className: "w-full py-3 bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 856}}, React.createElement(Save, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 856}}), " Tüm Odaları Kaydet"   )
          )
          , React.createElement('div', { className: "p-4 flex-1 overflow-y-auto"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 858}}
            , React.createElement('h4', { className: "font-bold text-slate-700 mb-4 text-sm border-b pb-2"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 859}}, "Öğe Özellikleri" )
            , selectedElement ? React.createElement('div', { className: "space-y-4", __self: this, __source: {fileName: _jsxFileName, lineNumber: 860}}
              , selectedElement.type==='desk' ? React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 861}}, React.createElement('label', { className: "block text-xs font-bold text-slate-500 mb-1"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 861}}, "Masa Numarası" ), React.createElement('input', { type: "number", value: selectedElement.deskId, onChange: e=>updateSelected('deskId',parseInt(e.target.value)||1), className: "w-full p-2 border rounded-lg"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 861}})) : React.createElement(React.Fragment, null
                , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 862}}, React.createElement('label', { className: "block text-xs font-bold text-slate-500 mb-1"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 862}}, "Metin"), React.createElement('input', { value: selectedElement.text||'', onChange: e=>updateSelected('text',e.target.value), className: "w-full p-2 border rounded-lg"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 862}}))
                , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 863}}, React.createElement('label', { className: "block text-xs font-bold text-slate-500 mb-1"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 863}}, "Renk"), React.createElement('input', { type: "color", value: selectedElement.bg||'#fef3c7', onChange: e=>updateSelected('bg',e.target.value), className: "w-full h-10" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 863}}))
              )
              , React.createElement('div', { className: "grid grid-cols-2 gap-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 865}}, React.createElement('input', { type: "number", value: selectedElement.w, onChange: e=>updateSelected('w',parseInt(e.target.value)||20), className: "p-2 border rounded-lg"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 865}}), React.createElement('input', { type: "number", value: selectedElement.h, onChange: e=>updateSelected('h',parseInt(e.target.value)||20), className: "p-2 border rounded-lg"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 865}}))
              , React.createElement('button', { onClick: handleDeleteSelected, className: "w-full py-2 bg-red-100 text-red-700 rounded-lg font-bold"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 866}}, React.createElement(Trash2, { className: "w-4 h-4 inline mr-1"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 866}}), " Öğeyi Sil"  )
            ) : React.createElement('p', { className: "text-sm text-slate-400" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 867}}, "Düzenlemek için krokiden bir öğe seçin."     )
          )
        )
        , React.createElement('div', { className: "flex-1 overflow-auto bg-slate-200"  , onMouseUp: ()=>setDraggingId(null), onMouseLeave: ()=>setDraggingId(null), __self: this, __source: {fileName: _jsxFileName, lineNumber: 870}}
          , React.createElement('div', { ref: canvasRef, onMouseMove: handleMouseMove, onClick: ()=>setSelectedId(null), className: "relative w-[900px] h-[1000px] bg-white bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] shadow-sm m-8 rounded-xl overflow-hidden cursor-crosshair"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 871}}
            , visibleElements.map(el=>React.createElement('div', { key: el.id, onMouseDown: e=>handleMouseDown(e,el.id), onClick: e=>{e.stopPropagation();setSelectedId(el.id)}, style: {left:el.x,top:el.y,width:el.w,height:el.h,backgroundColor:el.type==='shape'?(el.bg||'#fef3c7'):undefined}, className: `absolute flex items-center justify-center border-2 border-slate-800 cursor-grab ${selectedId===el.id?'ring-4 ring-blue-400 z-20':'shadow-sm z-10'} ${el.type==='desk'?'bg-slate-100 font-bold':'font-bold text-sm'}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 872}}, el.type==='desk'?el.deskId:el.text))
          )
        )
      )
    )
  );
};

const ReportForm = ({ deskId, onSubmit, onCancel, reporter }) => {
  const reporterName = _optionalChain([reporter, 'optionalAccess', _26 => _26.name]) || '';
  const reporterIdentityNo = _optionalChain([reporter, 'optionalAccess', _27 => _27.specialCode]) || '';

  return (
    React.createElement('form', { onSubmit: (e) => {
      e.preventDefault();
      if (!reporterName || !reporterIdentityNo) return;
      onSubmit(deskId, reporterName, reporterIdentityNo);
    }, className: "space-y-4", __self: this, __source: {fileName: _jsxFileName, lineNumber: 885}}
      , React.createElement('p', { className: "text-sm text-slate-600" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 890}}, "Masa " , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 890}}, deskId), " numarasında kimsenin bulunmadığını onaylıyor musunuz?"     )

      , React.createElement('div', { className: "bg-red-50 p-3 rounded-lg text-xs text-red-700 border border-red-200"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 892}}
        , React.createElement('strong', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 893}}, "Dikkat:"), " Asılsız ihbar yapmak kural ihlalidir. Güvenlik ve log kayıtları için bilgileriniz tutulmaktadır."
      )

      , React.createElement('div', { className: "bg-blue-50 p-3 rounded-lg text-xs text-blue-700 border border-blue-200"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 896}}, "İhbar, "
         , React.createElement('strong', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 897}}, "sisteme giriş yapan kullanıcı"   ), " adına gönderilecektir. Ad-soyad ve GM Özel Kodunuzu tekrar girmeniz gerekmez."
      )

      , React.createElement('div', { className: "bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-sm"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 900}}
        , React.createElement('div', { className: "flex items-center justify-between gap-3"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 901}}
          , React.createElement('span', { className: "text-slate-500 font-bold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 902}}, "İhbar Eden" )
          , React.createElement('span', { className: "text-slate-800 font-black text-right"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 903}}, reporterName || 'Kullanıcı bilgisi bulunamadı')
        )
        , React.createElement('div', { className: "flex items-center justify-between gap-3"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 905}}
          , React.createElement('span', { className: "text-slate-500 font-bold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 906}}, "GM Özel Kod"  )
          , React.createElement('span', { className: "font-mono font-black tracking-widest text-slate-800"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 907}}, reporterIdentityNo || '-')
        )
      )

      , React.createElement('div', { className: "flex gap-3 pt-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 911}}
        , React.createElement('button', { type: "button", onClick: onCancel, className: "flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold transition-colors"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 912}}, "İptal")
        , React.createElement('button', { type: "submit", disabled: !reporterName || !reporterIdentityNo, className: "flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-md transition-colors"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 913}}, "Onaylıyorum, Bildir"

        )
      )
    )
  );
};

function MainApp() {
  const pendingUserCreatesRef = useRef(new Set());
  const serverDeletedUserIdsRef = useRef(new Set());
  const pendingUserDeletesRef = useRef((() => { try { return new Set(JSON.parse(localStorage.getItem('sgm_pending_user_deletes') || '[]')); } catch (e5) { return new Set(); } })());
  const appendOutboxRef = useRef(null);
  const appendChainRef = useRef(Promise.resolve());
  const expiredDeskJobsRef = useRef(new Set());
  const deskActionInFlightRef = useRef(false);
  const [syncRetryEpoch, setSyncRetryEpoch] = useState(0);
  const [adminAuthorized, setAdminAuthorized] = useState(false);
  const verifiedAdminUidRef = useRef(null);
  const [studentMessages, setStudentMessages] = useState([]);
  const [feedbackSending, setFeedbackSending] = useState(false);
  const feedbackInFlightRef = useRef(false);


  const [view, setView] = useState('permission_gate');
  const [leaderProfile, setLeaderProfile] = useState(null);
  const [registrationVerified, setRegistrationVerified] = useState(false);
  const [registrationPending, setRegistrationPending] = useState(() => sessionStorage.getItem('sgm_registration_token') || '');
  const [registrationResult, setRegistrationResult] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('sgm_registration_credentials') || 'null'); } catch (e6) { return null; }
  });
  const [registrationFormUrl, setRegistrationFormUrl] = useState(() => sessionStorage.getItem('sgm_registration_form_url') || '');
  const [registrationFormOpened, setRegistrationFormOpened] = useState(() => sessionStorage.getItem('sgm_registration_form_opened') === '1');
  const [registrationError, setRegistrationError] = useState('');
  const [registrationBusy, setRegistrationBusy] = useState(false);
  const [registrationAccepted, setRegistrationAccepted] = useState(false);
  const [registrationRulesOpen, setRegistrationRulesOpen] = useState(false);
  const [permissionsState, setPermissionsState] = useState('idle');
  const [batteryGuidanceOpen, setBatteryGuidanceOpen] = useState(false);
  const [wakeLockStatus, setWakeLockStatus] = useState('idle');
  const wakeLockRef = useRef(null);
  const wakeLockWantedRef = useRef(false);
  const registrationInFlightRef = useRef(false);
  const adminCreateRequestRef = useRef(null);
  const [adminCreatingUser, setAdminCreatingUser] = useState(false);
  const [manualUserOpen, setManualUserOpen] = useState(false);
  const [userImportBusy, setUserImportBusy] = useState(false);
  
  const [loginIdentity, setLoginIdentity] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [rememberLoginPrompt, setRememberLoginPrompt] = useState(null);
  const [rememberedLoginCode, setRememberedLoginCode] = useState(() => { try { return localStorage.getItem('sgm_remembered_login_code_v1') || ''; } catch (e7) { return ''; } });
  
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('sgm_settings');
    return saved ? {...DEFAULT_SETTINGS,...JSON.parse(saved),showBlueRoomKroki:false} : DEFAULT_SETTINGS;
  });
  
  const settingsRef = useRef(settings);
  const [registrationLinkSaving, setRegistrationLinkSaving] = useState(false);
  const [systemSettingsSaving, setSystemSettingsSaving] = useState(false);
  const [closureHistory, setClosureHistory] = useState([]);
  const [closureHistoryStatus, setClosureHistoryStatus] = useState('');
  const systemSettingsSavingRef = useRef(false);
  const [registrationRedirectBusy, setRegistrationRedirectBusy] = useState(false);
  const registrationRedirectInFlightRef = useRef(false);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const [desks, setDesks] = useState(() => {
    const saved = localStorage.getItem('sgm_desks');
    try {
      const rows = saved ? JSON.parse(saved) : INITIAL_DESKS;
      const normalized = normalizeDeskQrRows(rows).filter(d => Number(d.id) <= 35);
      return normalized.length ? normalized : INITIAL_DESKS;
    } catch (e8) {
      return INITIAL_DESKS;
    }
  });
  
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('sgm_users');
    return saved ? normalizeIdentityUsers(JSON.parse(saved)) : INITIAL_USERS;
  });
  
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('sgm_logs');
    return saved ? JSON.parse(saved) : [];
  });

  // Günlük ihlal sayacından bağımsız, kalıcı ihlal geçmişi.
  const [violationRecords, setViolationRecords] = useState(() => {
    const saved = localStorage.getItem('sgm_violation_records');
    return saved ? JSON.parse(saved) : [];
  });

  // Uygulama hakkında kullanıcıların ilettiği öneri ve şikayet kayıtları.
  const [feedbackRecords, setFeedbackRecords] = useState(() => {
    const saved = localStorage.getItem('sgm_feedback_records');
    return saved ? JSON.parse(saved) : [];
  });

  const [feedbackForm, setFeedbackForm] = useState({ name: '', identityNo: '', type: '', message: '' });
  const [feedbackStep, setFeedbackStep] = useState(1);

  const [layoutElements, setLayoutElements] = useState(() => {
    const saved = localStorage.getItem('sgm_layout');
    const version = Number(localStorage.getItem('sgm_layout_schema_version') || 0);
    if (version < 3) {
      const fresh = generateDefaultLayout();
      localStorage.setItem('sgm_layout', JSON.stringify(fresh));
      localStorage.setItem('sgm_layout_schema_version', '3');
      return fresh;
    }
    try {
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length ? parsed : generateDefaultLayout();
    } catch (e) {
      return generateDefaultLayout();
    }
  });

  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [fbUser, setFbUser] = useState(null);
  const remoteDataRef = useRef(null);
  const isInitializingRef = useRef(true);

  // FIRESTORE ECHO / PING-PONG KORUMASI:
  // onSnapshot ile uzaktan gelen state ekrana uygulandıktan sonra aynı state'in
  // bu cihaz tarafından tekrar Firestore'a yazılmasını engeller.
  // Böylece telefon ve yönetici paneli eski BOŞ/DOLU durumlarını birbirine geri basmaz.
  const lastRemoteAppliedLocalStrRef = useRef(null);

  // Masa alma, bırakma ve rezervasyon gibi kritik yerel işlemler snapshot ile aynı anda
  // gerçekleşirse bile Firestore'a en az bir kez yazılmasını garanti eder.
  const criticalDeskMutationRef = useRef(false);

  // KRİTİK DÜZELTME: Render döngülerinde referans sorunları yaşamamak için Ref'ler kullanılıyor.
  const desksRef = useRef(desks);
  const usersRef = useRef(users);
  // Yedek geri yüklenirken eski sunucu snapshotları listeyi küçültmesin.
  const userBackupRestoreInFlightRef = useRef(false);
  // Kayıtların Firestore'dan gelen eski snapshot tarafından ezilmesini önlemek için güncel log referansı.
  const logsRef = useRef(logs);
  
  const violationRecordsRef = useRef(violationRecords);
  const feedbackRecordsRef = useRef(feedbackRecords);
  const layoutElementsRef = useRef(layoutElements);

  // SİLİNEN KAYIT SENKRON KORUMASI:
  // Firestore'dan gecikmiş/eski snapshot geldiğinde yönetici tarafından silinen kayıtların
  // yeniden listeye eklenmesini engeller. Kimlikler localStorage'da da tutulduğu için
  // sekme değiştirme / sayfa yenileme sonrasında eski snapshot kaydı geri getiremez.
  const deletedRecordIdsRef = useRef({
    users: new Set(JSON.parse(localStorage.getItem('sgm_deleted_user_ids') || '[]')),
    logs: new Set(JSON.parse(localStorage.getItem('sgm_deleted_log_ids') || '[]')),
    violations: new Set(JSON.parse(localStorage.getItem('sgm_deleted_violation_ids') || '[]')),
    feedback: new Set(JSON.parse(localStorage.getItem('sgm_deleted_feedback_ids') || '[]'))
  });

  const rememberDeletedRecordId = (bucket, id) => {
    if (!id || !_optionalChain([deletedRecordIdsRef, 'access', _28 => _28.current, 'optionalAccess', _29 => _29[bucket]])) return;
    const bucketSet = deletedRecordIdsRef.current[bucket];
    bucketSet.add(String(id));

    // Çok büyümemesi için en son 5000 silinen kimliği sakla.
    const trimmed = Array.from(bucketSet).slice(-5000);
    deletedRecordIdsRef.current[bucket] = new Set(trimmed);

    const storageKeys = {
      users: 'sgm_deleted_user_ids',
      logs: 'sgm_deleted_log_ids',
      violations: 'sgm_deleted_violation_ids',
      feedback: 'sgm_deleted_feedback_ids'
    };

    try {
      localStorage.setItem(storageKeys[bucket], JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Silinen kayıt koruması localStorage yazılamadı:', e);
    }
  };

  const isRecordDeleted = (bucket, id) => {
    if (!id) return false;
    return _optionalChain([deletedRecordIdsRef, 'access', _30 => _30.current, 'optionalAccess', _31 => _31[bucket], 'optionalAccess', _32 => _32.has, 'call', _33 => _33(String(id))]) === true;
  };

  const restoreDeletedRecordProtectionFromSnapshot = (snapshot) => {
    const groups = {
      users: Array.isArray(_optionalChain([snapshot, 'optionalAccess', _34 => _34.users])) ? snapshot.users : [],
      logs: [...(_optionalChain([snapshot, 'optionalAccess', _35 => _35.logs]) || []), ...(_optionalChain([snapshot, 'optionalAccess', _36 => _36.archivedLogs]) || [])],
      violations: Array.isArray(_optionalChain([snapshot, 'optionalAccess', _37 => _37.violationRecords])) ? snapshot.violationRecords : [],
      feedback: Array.isArray(_optionalChain([snapshot, 'optionalAccess', _38 => _38.feedbackRecords])) ? snapshot.feedbackRecords : []
    };
    const storageKeys = {
      users: 'sgm_deleted_user_ids',
      logs: 'sgm_deleted_log_ids',
      violations: 'sgm_deleted_violation_ids',
      feedback: 'sgm_deleted_feedback_ids'
    };
    Object.entries(groups).forEach(([bucket, records]) => {
      const set = _optionalChain([deletedRecordIdsRef, 'access', _39 => _39.current, 'optionalAccess', _40 => _40[bucket]]);
      if (!set) return;
      records.forEach(record => { if (_optionalChain([record, 'optionalAccess', _41 => _41.id])) set.delete(String(record.id)); });
      try { localStorage.setItem(storageKeys[bucket], JSON.stringify(Array.from(set))); } catch (e) {}
    });
  };

  // QR ile başarıyla başlayan masa oturumunun eski/gecikmiş Firestore snapshot'ı tarafından
  // birkaç saniye içinde geri alınmasını engelleyen kısa süreli senkronizasyon koruması.
  const confirmedDeskGuardRef = useRef(null);

  // MASA BIRAKMA SENKRON KORUMASI:
  // Öğrenci masayı bıraktıktan hemen sonra Firestore'dan birkaç saniye gecikmiş
  // "masa hâlâ dolu" snapshot'ı gelirse masanın yeniden dolu görünmesini engeller.
  // Özellikle yönetici panelindeki BOŞ / ÖĞRENCİ MASADA yanıp sönmesini keser.
  const releasedDeskGuardRef = useRef(null);

  // Geçerli 5 dakikalık masa rezervasyonunu gecikmiş Firestore snapshot'ından korur.
  const pendingReservationGuardRef = useRef(null);

  // GÜN SONU / MANUEL SIFIRLAMA SENKRON KORUMASI:
  // 22:00 veya yönetici tarafından yapılan tam temizlikten hemen sonra gecikmiş
  // Firestore snapshot'ının masaları tekrar DOLU/REZERVE göstermesini engeller.
  const dayEndCleanupGuardRef = useRef(null);

  // KROKİ EDİTÖRÜ SENKRON KORUMASI:
  // Yönetici yeni krokiyi kaydettikten hemen sonra gecikmiş eski Firestore snapshot'ı
  // gelirse yeni düzenin eski düzenle geri ezilmesini engeller.
  const layoutSaveGuardRef = useRef(null);

  useEffect(() => {
    desksRef.current = desks;
    usersRef.current = users;
    logsRef.current = logs;
    violationRecordsRef.current = violationRecords;
    feedbackRecordsRef.current = feedbackRecords;
    layoutElementsRef.current = layoutElements;
  }, [desks, users, logs, violationRecords, feedbackRecords, layoutElements]);

  const [currentUser, setCurrentUser] = useState({"id":"test","name":"Deneme Öğrenci","identityNo":"12345678","pin":"87654321","specialCode":"23456789","activeDeskId":null,"strikes":0,"breaks":{"short":2,"long":1},"violationHistory":[],"lostDeskIds":[]});
  const [now, setNow] = useState(Date.now());
  const [serverTimeOffsetMs, setServerTimeOffsetMs] = useState(0);
  const [serverClockVerified, setServerClockVerified] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const syncServerTime = async () => {
      try {
        const sent = Date.now();
        const response = await fetch('/api/server-time', { cache: 'no-store' });
        const data = await response.json();
        const received = Date.now();
        if (!response.ok || !Number.isFinite(Number(_optionalChain([data, 'optionalAccess', _42 => _42.at])))) throw new Error('Saat doğrulanamadı');
        if (!cancelled) {
          setServerTimeOffsetMs(Number(data.at) - (sent + received) / 2);
          setServerClockVerified(true);
        }
      } catch (e9) { if (!cancelled) setServerClockVerified(false); }
    };
    syncServerTime();
    const timer = setInterval(syncServerTime, 5 * 60 * 1000);
    window.addEventListener('focus', syncServerTime);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('focus', syncServerTime); };
  }, []);

  const sessionRestoredRef = useRef(false);
  const missingSessionUserSinceRef = useRef(0);
  useEffect(() => {
    if (!isDataLoaded || sessionRestoredRef.current) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem('sgm_student_session') || 'null');
      if (_optionalChain([saved, 'optionalAccess', _43 => _43.userId]) && db && !users.some(u => u.id === saved.userId) &&
          !serverDeletedUserIdsRef.current.has(String(saved.userId))) return;
      sessionRestoredRef.current = true;
      const user = (Array.isArray(users) ? users : []).find(u => u.id === _optionalChain([saved, 'optionalAccess', _44 => _44.userId]));
      if (sessionCanRestore(saved, user)) {
        setCurrentUser(user);
        const pending = Number(user.pendingDeskDeadline || 0) > Date.now();
        setSelectedDeskId(pending ? user.pendingDeskId : null);
        setDeskSelectionDeadline(pending ? user.pendingDeskDeadline : null);
        setView('student_dash');
      } else sessionStorage.removeItem('sgm_student_session');
    } catch (e10) { sessionStorage.removeItem('sgm_student_session'); }
  }, [isDataLoaded, users]);
  useEffect(() => {
    if (!sessionRestoredRef.current) return;
    if (currentUser) sessionStorage.setItem('sgm_student_session', JSON.stringify({userId: currentUser.id, day: getLocalDayKey()}));
    // null ilk renderda da oluşur; kayıt yalnızca açık çıkış / hesap silinmesinde temizlenir.
  }, [currentUser, isDataLoaded]);
  useEffect(() => {
    if (!currentUser || !isDataLoaded) return;
    const user = (Array.isArray(users) ? users : []).find(u => u.id === currentUser.id);
    if (!user) {
      // Gecikmiş / geçici boş snapshot aktif oturumu hemen kapatmasın.
      if (!missingSessionUserSinceRef.current) missingSessionUserSinceRef.current = Date.now();
      // A failed/cache-only snapshot is not evidence of deletion.
      if (!isRecordDeleted('users', currentUser.id) && !serverDeletedUserIdsRef.current.has(String(currentUser.id))) return;
      sessionStorage.removeItem('sgm_student_session');
      setCurrentUser(null); setView('student_login');
      setSelectedDeskId(null); setDeskSelectionDeadline(null);
      return;
    }

    missingSessionUserSinceRef.current = 0;
    // YP'den onay/kısıt değiştiğinde açık öğrenci oturumundaki eski kullanıcı
    // nesnesini de güncelle. Böylece pendingApproval=false anında QR işlemine yansır.
    setCurrentUser(prev => {
      if (!prev || prev.id !== user.id) return prev;
      const sameApproval = prev.pendingApproval === user.pendingApproval;
      const sameRestriction = Number(prev.restrictedUntil || 0) === Number(user.restrictedUntil || 0);
      const sameBlocked = prev.blocked === user.blocked;
      const sameReason = (prev.restrictionReason || '') === (user.restrictionReason || '');
      if (sameApproval && sameRestriction && sameBlocked && sameReason && JSON.stringify(prev) === JSON.stringify(user)) return prev;
      return { ...prev, ...user };
    });
  }, [now, users, isDataLoaded, _optionalChain([currentUser, 'optionalAccess', _45 => _45.id])]);
  // ÖĞRENCİ MASA SEÇİMİ: Öğrenci önce masasını seçer, ardından 5 dakika içinde aynı masanın QR kodunu okutmalıdır.
  const [selectedDeskId, setSelectedDeskId] = useState(null);
  const [deskSelectionDeadline, setDeskSelectionDeadline] = useState(null);
  const [deskCancellationBusy, setDeskCancellationBusy] = useState(false);
  const deskCancellationRef = useRef(false);
  const deviceId = useMemo(() => getDeviceId(), []);
  const [userLocation, setUserLocation] = useState(() => localStorage.getItem('sgm_last_location') || "Konum Aranıyor...");

  const [modal, setModal] = useState({ isOpen: false, type: '', title: '', content: null, onClose: null });
  const [scannerConfig, setScannerConfig] = useState({ isOpen: false, mode: null, title: '' }); 
  const [adminTab, setAdminTab] = useState('desks');
  // Yönetici toplu işlemleri, dağıtım kodu ve geri alma geçmişi.
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  // Toplu QR ekranında hangi masaların alınacağını/yazdırılacağını seçer.
  const [selectedQrDeskIds, setSelectedQrDeskIds] = useState([]);
  const [qrBackupPreview, setQrBackupPreview] = useState(null);
  const [qrBackupBusy, setQrBackupBusy] = useState(false);
  const qrBackupOperationRef = useRef(false);
  const qrBackupInputRef = useRef(null);
  const [userSearch, setUserSearch] = useState('');
  const [manualAssignSearch, setManualAssignSearch] = useState('');
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archivedLogs, setArchivedLogs] = useState([]);
  const archiveCursorRef = useRef({ sgmAudit: null, sgmLogs: null });
  const [bulkRestrictionDays, setBulkRestrictionDays] = useState(5);
  const [selectedLogIds, setSelectedLogIds] = useState([]);
  const [selectedViolationIds, setSelectedViolationIds] = useState([]);
  const [selectedFeedbackIds, setSelectedFeedbackIds] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  // Halka açık ekran, öğrenci ekranı ve yönetici krokisinde hangi alanın açık olduğunu tutar.
  const [publicKrokiArea, setPublicKrokiArea] = useState('main');
  const [studentKrokiArea, setStudentKrokiArea] = useState('main');
  const [adminKrokiArea, setAdminKrokiArea] = useState('main');
  // Yönetici menüsü varsayılan olarak SGM Admin başlığının içinde gizlidir.
  // SGM Admin alanına tıklanınca sekmeler soldan aşağı doğru açılır/kapanır.
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  // Kullanıcılar ekranından açılan öğrenci düzenleme penceresinde seçili kullanıcıyı tutar.
  const [adminUserEditId, setAdminUserEditId] = useState(null);
  const [reportFormContext, setReportFormContext] = useState(null);
  const [liveDeskId, setLiveDeskId] = useState(null); 
  const prevDeskStatus = useRef(null);
  const lastReportNotifiedRef = useRef(null);
  const adminMessageSeenRef = useRef(new Set());
  const adminGuestReportNotifiedRef = useRef(new Set());
  const closingNotificationSeenRef = useRef(new Set());
  // FCM telefon push kaydının aynı kullanıcı/cihaz için tekrar tekrar oluşturulmasını engeller.
  const pushRegistrationRef = useRef({ userId: null, token: null, working: false });
  const [showRules, setShowRules] = useState(false);

  // Push bildirim sistemini yönetici panelinden kontrol etmek için tanılama durumu.
  const [pushDiagnostics, setPushDiagnostics] = useState({
    loading: false,
    checked: false,
    notificationSupported: false,
    notificationPermission: 'unknown',
    serviceWorkerSupported: false,
    serviceWorkerActive: false,
    messagingSupported: false,
    vapidConfigured: false,
    apiReachable: false,
    apiStatus: null,
    apiMessage: '',
    lastCheckedAt: null,
    manualWorkerResult: '',
    manualWorkerError: ''
  });
  const [pushTestSendingUserId, setPushTestSendingUserId] = useState(null);
  const [manualWorkerBusy, setManualWorkerBusy] = useState(false);
  const [pushVapidDraft, setPushVapidDraft] = useState('');
  const [pushVapidSaving, setPushVapidSaving] = useState(false);
  const pushVapidSaveInFlightRef = useRef(false);
  const pushVapidDraftDirtyRef = useRef(false);
  useEffect(() => {
    if (!pushVapidDraftDirtyRef.current) setPushVapidDraft(normalizeFirebaseVapidKey(settings.firebaseWebPushVapidKey));
  }, [settings.firebaseWebPushVapidKey]);
  const resolveFirebaseVapidKey = () => normalizeFirebaseVapidKey(
    settingsRef.current.firebaseWebPushVapidKey || import.meta.env.VITE_FIREBASE_VAPID_KEY || ''
  );
  const saveFirebaseVapidKey = async () => {
    if (pushVapidSaveInFlightRef.current) return;
    const key = normalizeFirebaseVapidKey(pushVapidDraft);
    if (!isValidFirebaseVapidKey(key)) return showMessage('VAPID Anahtarını Kontrol Edin',
      'Firebase projenizin Cloud Messaging → Web Push certificates bölümündeki Public key değerini eksiksiz yapıştırın.', 'warning');
    pushVapidSaveInFlightRef.current = true; setPushVapidSaving(true);
    try {
      if (db && (!adminAuthorized || !fbUser || !navigator.onLine)) throw new Error('VAPID anahtarını kaydetmek için yönetici bağlantısı gerekli.');
      let next;
      if (db) {
        next = await runTransaction(db, async tx => {
          const ref = getLiveSettingsDoc(); const snap = await tx.get(ref);
          const base = mergeRegistrationSettings(settingsRef.current, snap.exists() ? snap.data() : settingsRef.current);
          const patch = { firebaseWebPushVapidKey: key,
            firebaseWebPushVapidUpdatedAt: Math.max(Date.now(), Number(base.firebaseWebPushVapidUpdatedAt || 0) + 1) };
          tx.set(ref, patch, { merge: true });
          return { ...base, ...patch };
        });
        granularBaselineRef.current.settings = next;
      } else next = { ...settingsRef.current, firebaseWebPushVapidKey: key, firebaseWebPushVapidUpdatedAt: Date.now() };
      settingsRef.current = next; setSettings(next);
      pushVapidDraftDirtyRef.current = false; setPushVapidDraft(key);
      try { localStorage.setItem('sgm_settings', JSON.stringify(next)); } catch (error) { console.warn('Push ayar önbelleği yazılamadı:', error); }
      setPushDiagnostics(prev => ({ ...prev, vapidConfigured: true }));
      addLog('ADMIN_PUSH_AYAR', 'Firebase Web Push herkese açık VAPID anahtarı kaydedildi.');
      showMessage('Push Anahtarı Kaydedildi', 'Öğrenci telefonunda Bildirimleri Aç / Push Kaydı düğmesine yeniden basın.', 'success');
    } catch (error) { handleFirestoreQuotaError(error); showMessage('Push Ayarı Kaydedilemedi', error.message, 'warning'); }
    finally { pushVapidSaveInFlightRef.current = false; setPushVapidSaving(false); }
  };

  const refreshPushDiagnostics = async () => {
    setPushDiagnostics(prev => ({ ...prev, loading: true }));

    const notificationSupported = typeof window !== 'undefined' && 'Notification' in window;
    const notificationPermission = notificationSupported ? Notification.permission : 'unsupported';
    const serviceWorkerSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    const vapidConfigured = isValidFirebaseVapidKey(resolveFirebaseVapidKey());

    let serviceWorkerActive = false;
    let messagingSupported = false;
    let apiReachable = false;
    let apiStatus = null;
    let apiMessage = '';

    try {
      messagingSupported = await isMessagingSupported().catch(() => false);
    } catch (e) {
      messagingSupported = false;
    }

    if (serviceWorkerSupported) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        serviceWorkerActive = registrations.some(reg => {
          const url =
            _optionalChain([reg, 'access', _46 => _46.active, 'optionalAccess', _47 => _47.scriptURL]) ||
            _optionalChain([reg, 'access', _48 => _48.waiting, 'optionalAccess', _49 => _49.scriptURL]) ||
            _optionalChain([reg, 'access', _50 => _50.installing, 'optionalAccess', _51 => _51.scriptURL]) ||
            '';
          return url.includes('firebase-messaging-sw.js');
        });
      } catch (e) {
        serviceWorkerActive = false;
      }
    }

    try {
      const response=await fetch('/api/send-push', {
        method: 'GET',
        cache: 'no-store'
      });

      apiStatus = response.status;
      let payload = null;
      try {
        payload = await response.json();
      } catch (e) {}

      // Endpoint GET için 405 döndürüyorsa bu API'nin düzgün ayağa kalktığı anlamına gelir.
      apiReachable = response.status === 405 || response.ok;
      apiMessage = _optionalChain([payload, 'optionalAccess', _52 => _52.message]) || (apiReachable ? 'API erişilebilir.' : `HTTP ${response.status}`);
    } catch (error) {
      apiReachable = false;
      apiMessage = _optionalChain([error, 'optionalAccess', _53 => _53.message]) || 'API bağlantısı kurulamadı.';
    }

    setPushDiagnostics({
      loading: false,
      checked: true,
      notificationSupported,
      notificationPermission,
      serviceWorkerSupported,
      serviceWorkerActive,
      messagingSupported,
      vapidConfigured,
      apiReachable,
      apiStatus,
      apiMessage,
      lastCheckedAt: Date.now()
    });
  };

  const sendAdminTestPush = async (user) => {
    if (!_optionalChain([user, 'optionalAccess', _54 => _54.id])) return;

    const tokenCount = Array.isArray(user.pushTokens)
      ? user.pushTokens.filter(Boolean).length
      : 0;

    if (tokenCount === 0) {
      showMessage(
        'FCM Token Bulunamadı',
        `${user.name || 'Bu kullanıcı'} için kayıtlı telefon push tokenı bulunmuyor. Kullanıcının telefondan Vercel adresini açıp bildirim izni vermesi ve öğrenci hesabına giriş yapması gerekir.`,
        'warning'
      );
      return;
    }

    setPushTestSendingUserId(user.id);

    try {
      const result = await sendServerPush({
        userId: user.id,
        title: '🔔 SGM Push Testi',
        body: 'Bu bildirimi görüyorsanız telefon push bildirim sistemi başarıyla çalışıyor.',
        type: 'ADMIN_PUSH_TEST',
        deskId: user.activeDeskId || null,
        logId: `test-${Date.now()}-${user.id}`
      });

      if (_optionalChain([result, 'optionalAccess', _55 => _55.success]) && !_optionalChain([result, 'optionalAccess', _56 => _56.skipped])) {
        showMessage(
          'Test Bildirimi Gönderildi',
          `${user.name || 'Kullanıcı'} için push isteği Vercel API üzerinden gönderildi. Telefon bildirimlerini kontrol edin.`,
          'success'
        );
      } else if (_optionalChain([result, 'optionalAccess', _57 => _57.reason]) === 'localhost') {
        showMessage(
          'Vercel Üzerinden Test Edin',
          'Gerçek telefon push testi localhost yerine Vercel adresinde yapılmalıdır.',
          'warning'
        );
      } else {
        showMessage(
          'Push Gönderilemedi',
          _optionalChain([result, 'optionalAccess', _58 => _58.reason]) === 'no-token'
            ? 'Kullanıcının kayıtlı FCM tokenı bulunamadı.'
            : `Push gönderimi tamamlanamadı.${_optionalChain([result, 'optionalAccess', _59 => _59.error]) ? ` Hata: ${result.error}` : ''}`,
          'danger'
        );
      }
    } catch (error) {
      showMessage(
        'Push Test Hatası',
        _optionalChain([error, 'optionalAccess', _60 => _60.message]) || 'Test bildirimi gönderilemedi.',
        'danger'
      );
    } finally {
      setPushTestSendingUserId(null);
    }
  };

  const forceRegisterMessagingWorker = async () => {
    setManualWorkerBusy(true);

    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Bu tarayıcı Service Worker desteklemiyor.');
      }

      if (!app) {
        throw new Error('Firebase uygulaması başlatılmamış.');
      }

      const cfg = app.options || {};
      const swParams = new URLSearchParams({
        apiKey: cfg.apiKey || '',
        authDomain: cfg.authDomain || '',
        projectId: cfg.projectId || '',
        storageBucket: cfg.storageBucket || '',
        messagingSenderId: cfg.messagingSenderId || '',
        appId: cfg.appId || ''
      });

      // Önceden bozuk/yanlış FCM worker kaydı varsa temizle.
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        const scriptUrl =
          _optionalChain([reg, 'access', _61 => _61.active, 'optionalAccess', _62 => _62.scriptURL]) ||
          _optionalChain([reg, 'access', _63 => _63.waiting, 'optionalAccess', _64 => _64.scriptURL]) ||
          _optionalChain([reg, 'access', _65 => _65.installing, 'optionalAccess', _66 => _66.scriptURL]) ||
          '';

        if (scriptUrl.includes('firebase-messaging-sw.js')) {
          try {
            await reg.unregister();
          } catch (e) {}
        }
      }

      const swUrl = `/firebase-messaging-sw.js?${swParams.toString()}&force=${Date.now()}`;

      const registration = await navigator.serviceWorker.register(swUrl, {
        scope: '/',
        updateViaCache: 'none'
      });

      try {
        await registration.update();
      } catch (e) {}

      const readyRegistration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Service Worker aktif hale gelmedi (15 sn zaman aşımı).')),
            15000
          )
        )
      ]);

      const finalReg = readyRegistration || registration;
      const finalUrl =
        _optionalChain([finalReg, 'access', _67 => _67.active, 'optionalAccess', _68 => _68.scriptURL]) ||
        _optionalChain([finalReg, 'access', _69 => _69.waiting, 'optionalAccess', _70 => _70.scriptURL]) ||
        _optionalChain([finalReg, 'access', _71 => _71.installing, 'optionalAccess', _72 => _72.scriptURL]) ||
        '';

      setPushDiagnostics(prev => ({
        ...prev,
        checked: true,
        serviceWorkerSupported: true,
        serviceWorkerActive: true,
        manualWorkerResult: `Service Worker aktif. Scope: ${finalReg.scope || '/'} | URL: ${finalUrl || 'bulunamadı'}`,
        manualWorkerError: ''
      }));

      if (_optionalChain([currentUser, 'optionalAccess', _73 => _73.id])) {
        updateUserPushDebug(currentUser.id, {
          pushLastStage: 'manuel_worker_aktif',
          pushLastError: '',
          pushLastErrorCode: '',
          pushLastAttemptAt: Date.now(),
          pushServiceWorkerScope: finalReg.scope || '',
          pushServiceWorkerUrl: finalUrl
        });
      }

      showMessage(
        'Service Worker Aktif',
        'Firebase Messaging Service Worker başarıyla kaydedildi. Şimdi telefon bildirim kaydını yeniden deneyebilirsiniz.',
        'success'
      );

      return finalReg;

    } catch (error) {
      setPushDiagnostics(prev => ({
        ...prev,
        checked: true,
        serviceWorkerActive: false,
        manualWorkerResult: '',
        manualWorkerError: _optionalChain([error, 'optionalAccess', _74 => _74.message]) || String(error)
      }));

      if (_optionalChain([currentUser, 'optionalAccess', _75 => _75.id])) {
        updateUserPushDebug(currentUser.id, {
          pushLastStage: 'manuel_worker_hatasi',
          pushLastError: _optionalChain([error, 'optionalAccess', _76 => _76.message]) || String(error),
          pushLastErrorCode: _optionalChain([error, 'optionalAccess', _77 => _77.name]) || '',
          pushLastAttemptAt: Date.now()
        });
      }

      showMessage(
        'Service Worker Hatası',
        _optionalChain([error, 'optionalAccess', _78 => _78.message]) || 'Service Worker kaydedilemedi.',
        'danger'
      );

      return null;
    } finally {
      setManualWorkerBusy(false);
    }
  };

  const checkLibraryOpen = () => {
      if (!settings.openTime || !settings.closeTime) return true;
      const d = new Date();
      const currentTimeMin = d.getHours() * 60 + d.getMinutes();
      const [openH, openM] = settings.openTime.split(':').map(Number);
      const openTimeMin = openH * 60 + openM;
      const [closeH, closeM] = settings.closeTime.split(':').map(Number);
      const closeTimeMin = closeH * 60 + closeM;

      if (openTimeMin < closeTimeMin) {
          return currentTimeMin >= openTimeMin && currentTimeMin < closeTimeMin;
      } else {
          return currentTimeMin >= openTimeMin || currentTimeMin < closeTimeMin;
      }
  };

  useEffect(() => {
    if (!currentUser) return;
    const safeUsers = Array.isArray(users) ? users : [];
    const myUser = safeUsers.find(u => u.id === currentUser.id);
    const safeDesks = Array.isArray(desks) ? desks : [];
    const currentMyDesk = myUser && myUser.activeDeskId ? safeDesks.find(d => d.id === myUser.activeDeskId) : null;

    if (currentMyDesk) {
      // reportEndTime her ihbar için yeni olduğundan aynı ihbarı sadece bir kez bildirir.
      const currentUserRecord = safeUsers.find(u => u.id === currentUser.id);
      const isGuestSession = _optionalChain([currentUserRecord, 'optionalAccess', _79 => _79.activeDeskRole]) === 'guest' || currentMyDesk.guestOccupant === currentUser.id;
      const isReportedForMe = isGuestSession ? currentMyDesk.guestReported === true : currentMyDesk.status === 'reported';
      const reportEndForMe = isGuestSession ? currentMyDesk.guestReportEndTime : currentMyDesk.reportEndTime;
      const reportKey = isReportedForMe ? `${currentMyDesk.id}-${currentUser.id}-${reportEndForMe || 0}` : null;

      if (isReportedForMe && reportKey && lastReportNotifiedRef.current !== reportKey) {
        lastReportNotifiedRef.current = reportKey;

        const safeReportWaitMinutes = Number.isFinite(Number(settings.reportWaitTime)) && Number(settings.reportWaitTime) > 0
          ? Number(settings.reportWaitTime)
          : 5;
        const notificationText = `Masa ${currentMyDesk.id} numaralı ${isGuestSession ? 'misafir' : 'ana'} oturumunuz masada bulunmadığınız gerekçesiyle bildirildi. ${safeReportWaitMinutes} dakika içinde masaya dönüp QR kod ile doğrulama yapın.`;

        // Tarayıcı / işletim sistemi bildirimi
        sendNotification("Dikkat: Masanız İhbar Edildi!", notificationText);

        // Bildirim izni kapalı olsa bile kullanıcının uygulama ekranında uyarı görünür.
        showMessage(
          "Masanız İhbar Edildi!",
          React.createElement('div', { className: "space-y-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 1638}}
            , React.createElement('p', { className: "text-sm text-slate-700" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 1639}}, notificationText)
            , React.createElement('p', { className: "text-xs font-bold text-red-600"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 1640}}, "Süre dolmadan “Masadayım, Doğrula!” butonundan QR kodunuzu okutun."       )
          ),
          "danger"
        );
      } else if (prevDeskStatus.current === 'on_break' && currentMyDesk.status === 'occupied') {
        sendNotification("Mola Süreniz Doldu!", "Mola süreniz bittiği için masa tekrar aktif duruma geçti. Kurallara uymak için lütfen masanıza dönün.");
      }

      prevDeskStatus.current = currentMyDesk.status;
    } else {
      prevDeskStatus.current = null;
      lastReportNotifiedRef.current = null;
    }
  }, [desks, users, currentUser, settings.reportWaitTime]);

  // Sunucunun masa boşaltma nedeni kullanıcı belgesinde saklanır.
  // Telefon/internet kapalıyken gerçekleşen olay, yeniden girişte de görünür.
  useEffect(() => {
    if (!_optionalChain([currentUser, 'optionalAccess', _80 => _80.id]) || adminAuthorized || !isDataLoaded) return;
    const myself = (Array.isArray(users) ? users : []).find(user => user.id === currentUser.id);
    const release = _optionalChain([myself, 'optionalAccess', _81 => _81.lastAutoBreakRelease]);
    if (!_optionalChain([release, 'optionalAccess', _82 => _82.eventId]) || !Number.isFinite(Number(release.releasedAt))) return;
    const key = `sgm_seen_auto_release_${currentUser.id}_${release.eventId}`;
    try { if (localStorage.getItem(key) === 'seen') return; } catch (_) {}
    try { localStorage.setItem(key, 'seen'); } catch (_) {}
    const label = release.breakType === 'short' ? 'Kısa mola' : release.breakType === 'long' ? 'Uzun mola' : 'Mola';
    const text = release.reason || `${label} süreniz dolduğu için Masa ${release.deskId} otomatik boşaltıldı.`;
    const available = Number(release.reclaimAllowedAt) > Date.now()
      ? `Aynı masayı ${formatDateTime(release.reclaimAllowedAt)} itibarıyla tekrar alabilirsiniz.`
      : 'Aynı masa için 30 dakikalık bekleme süreniz sona erdi.';
    showMessage('Masanız Otomatik Boşaltıldı',
      React.createElement('div', { className: "space-y-2 text-sm" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 1671}}
        , React.createElement('p', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 1672}}, text)
        , React.createElement('p', { className: "font-semibold text-amber-700" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 1673}}, available)
        , React.createElement('p', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 1674}}, "Başka uygun masaları alabilirsiniz. Bu işlem ihlal sayılmadı."       )
      ), 'warning');
  }, [users, _optionalChain([currentUser, 'optionalAccess', _83 => _83.id]), adminAuthorized, isDataLoaded]);

  useEffect(() => {
    if (!db || !fbUser || !_optionalChain([currentUser, 'optionalAccess', _84 => _84.id])) { setStudentMessages([]); return; }
    let retryTimer;
    const unsubscribe = onSnapshot(getLiveDoc('sgmMessages', currentUser.id), snap => {
      if (snap.exists()) setStudentMessages([snap.data()]);
    }, error => {
      handleFirestoreQuotaError(error);
      retryTimer = setTimeout(() => setSyncRetryEpoch(value => value + 1), Math.max(3000, quotaBackoffUntilRef.current - Date.now()));
    });
    return () => { unsubscribe(); clearTimeout(retryTimer); };
  }, [fbUser, _optionalChain([currentUser, 'optionalAccess', _85 => _85.id]), syncRetryEpoch]);

  useEffect(() => {
    const message=studentMessages.find(item=>_optionalChain([item, 'optionalAccess', _86 => _86.type])==='LEADER_FORM_RESTRICTION' && _optionalChain([item, 'optionalAccess', _87 => _87.userId])===_optionalChain([currentUser, 'optionalAccess', _88 => _88.id]));
    if (!_optionalChain([message, 'optionalAccess', _89 => _89.id])) return;
    const key=`sgm_form_restriction_seen_${currentUser.id}`;
    try {if (localStorage.getItem(key)===message.id) return;localStorage.setItem(key,message.id);} catch (e11) {}
    showMessage('Form Bilgisi Hatası',message.message||'Kayıt formunuzda hata tespit edildi. Lütfen bilgilerinizi düzeltip gençlik liderine başvurun.','warning');
  }, [studentMessages,_optionalChain([currentUser, 'optionalAccess', _90 => _90.id])]);

  useEffect(() => {
    if (!app || !_optionalChain([currentUser, 'optionalAccess', _91 => _91.id])) return;
    let unsubscribe, cancelled = false;
    isMessagingSupported().then(supported => {
      if (!supported || cancelled) return;
      unsubscribe = onMessage(getMessaging(app), payload => {
        const data = payload.data || {};
        if (data.userId && data.userId !== currentUser.id) return;
        const title = _optionalChain([payload, 'access', _92 => _92.notification, 'optionalAccess', _93 => _93.title]) || data.title || 'Sarıçam GM';
        const body = _optionalChain([payload, 'access', _94 => _94.notification, 'optionalAccess', _95 => _95.body]) || data.body || 'Yeni bildiriminiz var.';
        if (data.type === 'ADMIN_MASA_MESAJI') {
          setStudentMessages([{ id: data.logId, type: data.type, userId: currentUser.id,
            deskId: Number(data.deskId), time: Date.now(), message: body, notificationTitle: title, notificationBody: body }]);
        } else if (String(data.type || '').includes('İHBAR')) {
          sendNotification(title, body);
          // The live desk listener owns the countdown/modal; receiving a push never logs a new event.
        }
      });
    }).catch(() => {});
    return () => { cancelled = true; _optionalChain([unsubscribe, 'optionalCall', _96 => _96()]); };
  }, [_optionalChain([currentUser, 'optionalAccess', _97 => _97.id])]);

  // Yönetici tarafından masa sahibine gönderilen kısa mesajları bu kullanıcının cihazında gösterir.
  // Mesajlar Firestore/log senkronizasyonu üzerinden gelir; aynı mesaj aynı cihazda ikinci kez gösterilmez.
  useEffect(() => {
    if (!currentUser || !Array.isArray(logs)) return;

    const storageKey = `sgm_seen_admin_messages_${currentUser.id}`;
    let seenIds = new Set();
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(stored)) seenIds = new Set(stored);
    } catch (e) {}

    // Ref ile localStorage listesini birleştir.
    adminMessageSeenRef.current.forEach(id => seenIds.add(id));

    const pendingMessages = [...new Map([...logs, ...studentMessages].map(log => [log.id, log])).values()]
      .filter(log =>
        log &&
        log.type === 'ADMIN_MASA_MESAJI' &&
        log.userId === currentUser.id &&
        Number(log.deskId) === Number(currentUser.activeDeskId) &&
        !seenIds.has(log.id)
      )
      .sort((a, b) => Number(a.time || 0) - Number(b.time || 0));

    if (pendingMessages.length === 0) return;

    // Birden fazla bekleyen mesaj varsa en yenisini ekranda göster; tümünü görüldü olarak işaretle.
    pendingMessages.forEach(log => {
      seenIds.add(log.id);
      adminMessageSeenRef.current.add(log.id);
    });

    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(seenIds).slice(-100)));
    } catch (e) {}

    const latest = pendingMessages[pendingMessages.length - 1];
    const title = latest.notificationTitle || 'Yönetici Masa Kontrol Mesajı';
    const body = latest.notificationBody || latest.message || 'Yönetici masanızla ilgili bir bilgilendirme gönderdi.';

    sendNotification(title, body);
    showMessage(
      title,
      React.createElement('div', { className: "space-y-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 1764}}
        , React.createElement('div', { className: "p-3 bg-blue-50 border border-blue-200 rounded-xl"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 1765}}
          , React.createElement('p', { className: "text-sm text-slate-700" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 1766}}, body)
        )
        , latest.deskId && React.createElement('p', { className: "text-xs text-slate-500" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 1768}}, "Masa: " , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 1768}}, latest.deskId))
        , React.createElement('p', { className: "text-xs font-semibold text-blue-700"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 1769}}, "Bu mesaj yönetici tarafından masa kontrolü sırasında gönderildi."       )
      ),
      latest.notificationLevel === 'danger' ? 'danger' : latest.notificationLevel === 'warning' ? 'warning' : 'info'
    );
  }, [logs, studentMessages, currentUser]);

  // Yönetici paneli açıkken yeni misafir ihbarı geldiğinde anlık uyarı göster.
  useEffect(() => {
    if (view !== 'admin_dash') return;
    const safeDesks = Array.isArray(desks) ? desks : [];
    const safeUsers = Array.isArray(users) ? users : [];

    safeDesks.forEach(desk => {
      if (!desk.guestOccupant || !desk.guestReported || !desk.guestReportEndTime) return;
      const key = `${desk.id}-${desk.guestOccupant}-${desk.guestReportEndTime}`;
      if (adminGuestReportNotifiedRef.current.has(key)) return;
      adminGuestReportNotifiedRef.current.add(key);

      const guest = safeUsers.find(u => u.id === desk.guestOccupant);
      const guestName = _optionalChain([guest, 'optionalAccess', _98 => _98.name]) || 'Misafir kullanıcı';
      sendNotification('Misafir Kullanıcı İhbar Edildi', `Masa ${desk.id} - ${guestName} masada bulunmadığı gerekçesiyle ihbar edildi.`);
      showMessage(
        'Misafir Kullanıcı İhbar Edildi',
        React.createElement('div', { className: "space-y-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 1792}}
          , React.createElement('p', { className: "text-sm text-slate-700" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 1793}}, React.createElement('strong', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 1793}}, "Masa " , desk.id), " üzerindeki "  , React.createElement('strong', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 1793}}, guestName), " adlı misafir kullanıcı masada bulunmadığı gerekçesiyle ihbar edildi."        )
          , React.createElement('p', { className: "text-xs text-slate-500" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 1794}}, "Masa Kontrolü bölümünden ana kullanıcı ve misafir kaydını birlikte kontrol edebilirsiniz."          )
          , React.createElement('button', { onClick: () => { closeMessage(); setLiveDeskId(desk.id); setAdminTab('desks'); setTimeout(() => setModal({ isOpen: true, type: 'info', title: `Masa ${desk.id} Yönetimi`, content: null }), 100); }, className: "w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 1795}}, "Masa Kontrolünü Aç"  )
        ),
        'warning'
      );
    });
  }, [desks, users, view]);

  useEffect(() => {
    if (!db && settings.reportsEnabled === false) {
       const next = {...settingsRef.current, reportsEnabled: true};
       settingsRef.current = next; setSettings(next);
    }
  }, [settings.reportsEnabled]);

  // Aylık günlük kod takvimi:
  // - İçinde bulunulan ayın tüm günleri için 6 haneli kodlar hazırlanır.
  // - Gün geldiğinde aylık listedeki kod otomatik olarak aktif günlük koda dönüşür.
  // - Yarının kodu da aynı aylık listeden alınır; eski daily/next alanları geriye dönük uyumluluk için korunur.
  // - Yönetici bugünün veya yarının kodunu değiştirirse aylık listedeki karşılığı da aynı anda güncellenir.
















  const loadScriptOnce = (src, id) => new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing) {
      if (window.html2pdf) return resolve();
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = id; script.src = src; script.async = true;
    script.onload = resolve; script.onerror = reject;
    document.body.appendChild(script);
  });



  const requestScreenWakeLock = async () => {
    wakeLockWantedRef.current = true;
    if (!navigator.wakeLock || document.visibilityState !== 'visible') { setWakeLockStatus('unsupported'); return; }
    if (wakeLockRef.current && !wakeLockRef.current.released) return;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      wakeLockRef.current = sentinel; setWakeLockStatus('active');
      sentinel.addEventListener('release', () => { wakeLockRef.current = null; setWakeLockStatus('released'); });
      addLog('EKRAN_ACIK_TUTMA', 'Ekranı açık tutma isteği kabul edildi.');
    } catch (e12) { setWakeLockStatus('denied'); addLog('EKRAN_ACIK_TUTMA_RED', 'Ekranı açık tutma isteği cihaz tarafından kabul edilmedi.'); }
  };
  useEffect(() => {
    const resume = () => { if (document.visibilityState === 'visible' && wakeLockWantedRef.current) requestScreenWakeLock(); };
    document.addEventListener('visibilitychange', resume);
    return () => { document.removeEventListener('visibilitychange', resume); _optionalChain([wakeLockRef, 'access', _99 => _99.current, 'optionalAccess', _100 => _100.release, 'call', _101 => _101(), 'access', _102 => _102.catch, 'call', _103 => _103(() => {})]); };
  }, []);

  const requestAllPermissions = async () => {
    setPermissionsState('requesting');
    let locStr = "Konum Alınamadı";
    const withTimeout = (promise, timeoutMs) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('İstek zaman aşımına uğradı')), timeoutMs))
    ]);

    try {
      if (navigator.geolocation) {
        const pos = await withTimeout(new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 6000,
            maximumAge: 0
          });
        }), 7000);

        locStr = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
      }
    } catch (err) {
      try {
        const res = await withTimeout(fetch('https://get.geojs.io/v1/ip/geo.json'), 4000);
        const data = await res.json();
        if (data && data.city) {
          locStr = `${data.city}, ${data.region} (IP)`;
        }
      } catch (ipErr) {
        try {
          const res2 = await withTimeout(fetch('https://ipwho.is/'), 4000);
          const data2 = await res2.json();
          if (data2 && data2.city) {
            locStr = `${data2.city}, ${data2.region} (IP)`;
          }
        } catch (e) {}
      }
    }

    try {
      setUserLocation(locStr);
      localStorage.setItem('sgm_last_location', locStr);
    } catch (e) {}

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await withTimeout(navigator.mediaDevices.getUserMedia({ video: true }), 7000);
        stream.getTracks().forEach(t => t.stop());
      }
    } catch (e) {}

    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {}
    }

    addLog('SISTEM_GIRIS', 'Uygulamaya cihaz üzerinden giriş yapıldı.', null, null, false, locStr);
    setPermissionsState('granted');
    setBatteryGuidanceOpen(true);
    addLog('PIL_AYARI_BILGILENDIRME', 'Pil optimizasyonu / Kısıtlanmamış ayarı için kullanıcıya yönlendirme gösterildi.');
  };

  useEffect(() => {
    if (!auth) {
      setIsDataLoaded(true);
      return;
    }
    let disposed = false, retryTimer = null, retryAttempt = 0, signingIn = false, authStateEpoch = 0;
    const initAuth = async () => {
      if (disposed || signingIn) return;
      signingIn = true;
      try {
        await ensureTabAuthPersistence(); await auth.authStateReady();
        if (auth.currentUser || disposed) return;
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInTabWithCustomToken(__initial_auth_token);
        } else {
          await signInTabAnonymously();
        }
        retryAttempt = 0;
      } catch (error) {
        if (!disposed) {
          setIsDataLoaded(true);
          retryTimer = setTimeout(initAuth, Math.min(60000, 3000 * 2 ** retryAttempt++));
        }
      } finally { signingIn = false; }
    };
    const resumeAuth = () => { clearTimeout(retryTimer); initAuth(); };
    window.addEventListener('online', resumeAuth);
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, user => {
      const epoch = ++authStateEpoch;
      setFbUser(user);
      if (!user) {
        verifiedAdminUidRef.current = null;
        setAdminAuthorized(false);
        usersRef.current = [];
        setUsers([]);
        localStorage.removeItem('sgm_users');
      } else user.getIdTokenResult().then(result => {
        // Önceki anonim/öğrenci oturumunun gecikmiş sonucu yeni yönetici oturumunu ezmesin.
        if (disposed || epoch !== authStateEpoch || _optionalChain([auth, 'access', _104 => _104.currentUser, 'optionalAccess', _105 => _105.uid]) !== user.uid) return;
        const isAdmin = result.claims.admin === true;
        verifiedAdminUidRef.current = isAdmin ? user.uid : null;
        setAdminAuthorized(isAdmin);
        if (!isAdmin) {
          // Eski yönetici görünümü öğrenci/anonim oturumla açık tutulmaz.
          setView(previous => previous === 'admin_dash' ? 'admin_login' : previous);
          const ownUser = usersRef.current.find(row => String(row.id) === user.uid);
          usersRef.current = ownUser ? [ownUser] : [];
          setUsers(usersRef.current);
          localStorage.setItem('sgm_users', JSON.stringify(usersRef.current));
        }
      }).catch(() => {
        if (disposed || epoch !== authStateEpoch || _optionalChain([auth, 'access', _106 => _106.currentUser, 'optionalAccess', _107 => _107.uid]) !== user.uid) return;
        verifiedAdminUidRef.current = null;
        setAdminAuthorized(false);
        usersRef.current = [];
        setUsers([]);
        localStorage.removeItem('sgm_users');
      });
    });
    return () => { disposed = true; clearTimeout(retryTimer); window.removeEventListener('online', resumeAuth); unsubscribe(); };
  }, []);

  // ============================================================
  // FIRESTORE KOTA DOSTU PARÇALI SENKRONİZASYON
  // ============================================================
  // Eski sürüm bütün uygulama state'ini tek bir `allData` belgesine yazıyordu.
  // Bu yapı küçük bir masa/log değişikliğinde bile kullanıcılar + masalar + loglar +
  // ihlaller + geri bildirimler + krokiyi tekrar yazdığı için Firestore kotasını hızla
  // tüketebiliyordu. Yeni yapıda yalnızca değişen kayıt kendi belgesine yazılır.
  // `allData` sadece eski kurulumdan ilk geçişte bir kez okunur.
  const getLiveCollection = (name) => collection(db, 'artifacts', appId, 'public', 'data', name);
  const getLiveDoc = (name, id) => doc(db, 'artifacts', appId, 'public', 'data', name, String(id));
  const getLiveSettingsDoc = () => getLiveDoc('sgmConfig', 'settings');
  const getLiveLayoutDoc = () => getLiveDoc('sgmConfig', 'layout');
  const getLiveMetaDoc = () => getLiveDoc('sgmConfig', 'meta');
  const cloudActions = createCloudActions({ db, runTransaction, ref: getLiveDoc,
    settings: () => settingsRef.current, dayKey: getLocalDayKey, isRestricted, lostDeskToday, applyViolationPolicy });
  const runStudentDeskAction = async (action, input = {}) => {
    if (!fbUser) throw new Error('Öğrenci oturumu bulunamadı. Tekrar giriş yapın.');
    return requestStudentDesk({
      action, input, getToken: forceRefresh => fbUser.getIdToken(forceRefresh)
    });
  };
  const runAdminMaintenance = async (action, input = {}) => {
    if (!adminAuthorized || !_optionalChain([auth, 'optionalAccess', _108 => _108.currentUser])) throw new Error('Yönetici yetkisi gerekli.');
    // Onay işleminde ikinci bir zorunlu token yenileme turunu bekleme;
    // gerçek yetki ve aktif yönetici oturumu yine API'de kontrol edilir.
    if (!['approve_users', 'approve_user', 'update_user', 'update_settings', 'close_history'].includes(action)) await requireAdminForUserWrite();
    const token = await auth.currentUser.getIdToken();
    const response = await fetch('/api/admin-maintenance', {
      signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(30000) : undefined,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...input })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || _optionalChain([payload, 'optionalAccess', _109 => _109.ok]) !== true) throw new Error(_optionalChain([payload, 'optionalAccess', _110 => _110.message]) || 'Yönetici işlemi sunucuda tamamlanamadı.');
    return payload.result;
  };
  useEffect(() => {
    if (adminTab !== 'settings' || !adminAuthorized || !fbUser) return;
    let cancelled = false;
    setClosureHistoryStatus('Yükleniyor...');
    runAdminMaintenance('close_history').then(result => {
      if (!cancelled) { setClosureHistory(result.history || []); setClosureHistoryStatus(''); }
    }).catch(() => { if (!cancelled) setClosureHistoryStatus('Kapanış geçmişi şu an getirilemedi.'); });
    return () => { cancelled = true; };
  }, [adminTab, adminAuthorized, _optionalChain([fbUser, 'optionalAccess', _111 => _111.uid])]);
  const runStudentActivity = async (action, input = {}) => {
    if (!fbUser) throw new Error('Öğrenci oturumu bulunamadı.');
    const idToken = await fbUser.getIdToken();
    const response = await fetch('/api/student-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ action, ...input })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || _optionalChain([payload, 'optionalAccess', _112 => _112.ok]) !== true) {
      throw new Error(_optionalChain([payload, 'optionalAccess', _113 => _113.message]) || `Öğrenci servisi HTTP ${response.status} döndürdü.`);
    }
    return payload.result;
  };
  const applyCloudRows = ({ desk, user, desks: updatedDesks }) => {
    if (desk) updatedDesks = [desk];
    if (_optionalChain([updatedDesks, 'optionalAccess', _114 => _114.length])) {
      const updates = rowsToMap(updatedDesks);
      const next = desksRef.current.map(row => updates.get(String(row.id)) || row);
      updatedDesks.forEach(row => granularBaselineRef.current.desks.set(String(row.id), row));
      desksRef.current = next; setDesks(next);
    }
    if (user) {
      const normalized = normalizeRemoteUsers([user])[0];
      const previousRow = usersRef.current.find(row => String(row.id) === String(user.id)) || {};
      const merged = { ...previousRow, ...normalized };
      granularBaselineRef.current.users.set(String(user.id), merged);
      usersRef.current = usersRef.current.map(row => String(row.id) === String(user.id) ? merged : row);
      setUsers(usersRef.current);
      setCurrentUser(previous => _optionalChain([previous, 'optionalAccess', _115 => _115.id]) === user.id ? { ...previous, ...merged } : previous);
    }
  };


  const granularSyncReadyRef = useRef(false);
  const granularLoadedRef = useRef({
    settings: false, layout: false, desks: false, users: false,
    logs: false, violations: false, feedback: false
  });
  const granularBaselineRef = useRef({
    settings: null,
    layout: null,
    desks: new Map(),
    users: new Map(),
    logs: new Map(),
    violations: new Map(),
    feedback: new Map()
  });
  const granularSeenRemoteRef = useRef({
    settings: false, layout: false, desks: false, users: false,
    logs: false, violations: false, feedback: false
  });
  const granularWriteTimerRef = useRef(null);
  const adminUserSaveInFlightRef = useRef(false);
  const adminUserSaveQueueRef = useRef(Promise.resolve());
  const [adminUserSavingId, setAdminUserSavingId] = useState(null);
  const [repairDeskLinksBusy, setRepairDeskLinksBusy] = useState(false);
  const granularWriteChainRef = useRef(Promise.resolve());
  const quotaBackoffUntilRef = useRef(0);
  const deskQrRepairInFlightRef = useRef(false);
  const deskQrAutoRecoveryAttemptedRef = useRef(false);
  const [deskQrRepairBusy, setDeskQrRepairBusy] = useState(false);
  const [usersSyncError, setUsersSyncError] = useState('');
  const [adminUsersServerReady, setAdminUsersServerReady] = useState(false);
  const [cachedUsersDifference, setCachedUsersDifference] = useState(0);

  // Yönetici oturumunu sadece sunucunun kesin kararına göre kapat.
  // Firestore'un önbellekteki eski aktif oturum bilgisi veya izin/ağ hatası
  // özellikle PC tarayıcılarında birkaç saniye sonra yanlış çıkışa yol açıyordu.
  useEffect(() => {
    if (!db || !adminAuthorized || _optionalChain([fbUser, 'optionalAccess', _116 => _116.uid]) !== 'sgm-admin') return;
    let stopped = false;
    let unsubscribe = () => {};
    let checking = false;
    let sessionId = null;

    const replaced = () => {
      if (stopped || _optionalChain([auth, 'optionalAccess', _117 => _117.currentUser, 'optionalAccess', _118 => _118.uid]) !== 'sgm-admin') return;
      stopped = true;
      setAdminAuthorized(false);
      setView(previous => previous === 'admin_dash' ? 'admin_login' : previous);
      showMessage('Yönetici Oturumu Sona Erdi', 'Başka bir yönetici giriş yaptığı için bu yönetici oturumu kapatıldı.', 'warning');
      signOut(auth).catch(() => {});
    };

    const verifyWithServer = async () => {
      if (stopped || checking || !sessionId || !navigator.onLine) return;
      checking = true;
      try {
        const liveUser = _optionalChain([auth, 'optionalAccess', _119 => _119.currentUser]);
        if (_optionalChain([liveUser, 'optionalAccess', _120 => _120.uid]) !== 'sgm-admin') return;
        const token = await liveUser.getIdToken();
        const response = await fetch('/api/admin-session', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        });
        if (response.status !== 403) return; // 401/503/ağ hatası: oturumu yanlışlıkla kapatma.
        const result = await response.json().catch(() => null);
        if (_optionalChain([result, 'optionalAccess', _121 => _121.error]) !== 'admin_session_replaced') return;
        // Eşzamanlı yeni bir yönetici girişi aynı Firebase UID'yi kullanır.
        // Eski dinleyicinin cevabı yeni oturumu kapatmamalı.
        const current = _optionalChain([auth, 'optionalAccess', _122 => _122.currentUser]);
        const currentClaims = await _optionalChain([current, 'optionalAccess', _123 => _123.getIdTokenResult, 'call', _124 => _124()]);
        if (!stopped && _optionalChain([current, 'optionalAccess', _125 => _125.uid]) === 'sgm-admin' && _optionalChain([currentClaims, 'optionalAccess', _126 => _126.claims, 'optionalAccess', _127 => _127.adminSessionId]) === sessionId) replaced();
      } catch (error) {
        // Bağlantı ve Firestore okuma sorunları başka yönetici girişi değildir.
        console.warn('Yönetici oturumu geçici olarak doğrulanamadı:', _optionalChain([error, 'optionalAccess', _128 => _128.code]) || _optionalChain([error, 'optionalAccess', _129 => _129.message]));
      } finally {
        checking = false;
      }
    };

    const onVisible = () => { if (document.visibilityState === 'visible') void verifyWithServer(); };
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void verifyWithServer(); }, 60000);
    window.addEventListener('focus', verifyWithServer);
    window.addEventListener('online', verifyWithServer);
    document.addEventListener('visibilitychange', onVisible);

    fbUser.getIdTokenResult().then(token => {
      if (stopped) return;
      sessionId = token.claims.adminSessionId;
      if (!sessionId) {
        // Eksik/eskimiş token için görünümü düşürmeden yeni giriş gerektiğini bildir.
        console.warn('Yönetici oturum kimliği token içinde bulunamadı.');
        return;
      }
      // Aktif oturum belgesi gerçek sunucudan geldiğinde hızlı tepki verir.
      // Önbellekteki eski belge ve dinleyici hataları tek başına çıkış sebebi değildir.
      unsubscribe = onSnapshot(getLiveDoc('sgmAdminSessions', 'active'),
        { includeMetadataChanges: true },
        snap => {
          if (stopped || snap.metadata.fromCache) return;
          if (!snap.exists() || _optionalChain([snap, 'access', _130 => _130.data, 'call', _131 => _131(), 'optionalAccess', _132 => _132.sessionId]) !== sessionId) void verifyWithServer();
        },
        error => {
          if (stopped) return;
          console.warn('Yönetici oturum dinleyicisi kullanılamadı, sunucudan kontrol edilecek:', _optionalChain([error, 'optionalAccess', _133 => _133.code]) || 'unknown');
          void verifyWithServer();
        });
      void verifyWithServer();
    }).catch(error => {
      // Anlık token yenileme hatasında PC ekranını kapatma.
      if (!stopped) console.warn('Yönetici tokenı geçici olarak okunamadı:', _optionalChain([error, 'optionalAccess', _134 => _134.code]) || 'unknown');
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener('focus', verifyWithServer);
      window.removeEventListener('online', verifyWithServer);
      document.removeEventListener('visibilitychange', onVisible);
      unsubscribe();
    };
  }, [adminAuthorized, fbUser]);

  const stableJson = value => {
    try { return JSON.stringify(value); } catch (e13) { return ''; }
  };

  const rowsToMap = rows => new Map(
    (Array.isArray(rows) ? rows : [])
      .filter(row => row && row.id !== undefined && row.id !== null)
      .map(row => [String(row.id), row])
  );

  const normalizeRemoteDesks = rows => (Array.isArray(rows) ? rows : INITIAL_DESKS)
    .filter(d => d && Number.isInteger(Number(d.id)) && Number(d.id) > 0 && Number(d.id) <= 35)
    .map(d => ({
      ...d,
      id: Number(d.id),
      guestOccupant: d.guestOccupant || null,
      guestSessionStartTime: d.guestSessionStartTime || null,
      guestBreakEndTime: d.guestBreakEndTime || null,
      guestReported: d.guestReported === true,
      guestReportEndTime: d.guestReportEndTime || null,
      guestReportIssuedAt: d.guestReportIssuedAt || null,
      guestReportVerifiedAt: d.guestReportVerifiedAt || null,
      pendingOccupant: d.pendingOccupant || null,
      pendingDeskRole: d.pendingDeskRole || null,
      pendingDeskDeadline: d.pendingDeskDeadline || null,
      reportIssuedAt: d.reportIssuedAt || null,
      reportVerifiedAt: d.reportVerifiedAt || null
    }));

  const normalizeRemoteUsers = (rows, sourceSettings = settingsRef.current) =>
    normalizeIdentityUsers(Array.isArray(rows) ? rows : []).map(u => ({
      ...u,
      identityNo: /^\d{8}$/.test(u.identityNo || '') ? u.identityNo : legacyIdentity(u.id),
      strikes: Number.isFinite(Number(u.strikes)) ? Number(u.strikes) : 0,
      breaks: {
        ...u.breaks,
        short: _optionalChain([u, 'access', _135 => _135.breaks, 'optionalAccess', _136 => _136.short]) != null && Number.isFinite(Number(u.breaks.short)) ? Number(u.breaks.short) : (_nullishCoalesce(_optionalChain([sourceSettings, 'optionalAccess', _137 => _137.shortBreakCount]), () => ( DEFAULT_SETTINGS.shortBreakCount))),
        long: _optionalChain([u, 'access', _138 => _138.breaks, 'optionalAccess', _139 => _139.long]) != null && Number.isFinite(Number(u.breaks.long)) ? Number(u.breaks.long) : (_nullishCoalesce(_optionalChain([sourceSettings, 'optionalAccess', _140 => _140.longBreakCount]), () => ( DEFAULT_SETTINGS.longBreakCount))),
        hourly: _optionalChain([u, 'access', _141 => _141.breaks, 'optionalAccess', _142 => _142.hourly]) != null && Number.isFinite(Number(u.breaks.hourly))
          ? Number(u.breaks.hourly) : allowedBreakCount(sourceSettings, 'hourly')
      },
      breaksResetDate: u.breaksResetDate || getLocalDayKey(),
      violationsResetDate: u.violationsResetDate || getLocalDayKey(),
      dailyAccessVerifiedDate: u.dailyAccessVerifiedDate || '',
      canReport: u.canReport !== false,
      blocked: u.blocked === true,
      activeDeskRole: u.activeDeskId ? (u.activeDeskRole || 'owner') : null
    }));

  const mergeRemoteWithPendingLocal = (bucket, remoteRows, localRows) => {
    const raw = Array.isArray(remoteRows) ? remoteRows : [];
    const previous = granularBaselineRef.current[bucket] || new Map();
    if (bucket === 'users') {
      // Tam yönetici snapshot'ında bulunmayan eski yerel kullanıcıyı geri ekleme.
      const knownIds = new Set([...previous.keys(), ...(localRows || []).map(u => String(u.id))]);
      for (const id of knownIds) {
        if (!raw.some(row => String(row.id) === id) && !pendingUserCreatesRef.current.has(id)) {
          serverDeletedUserIdsRef.current.add(id);
        }
      }
      raw.forEach(row => serverDeletedUserIdsRef.current.delete(String(row.id)));
    }
    const merged = granularSeenRemoteRef.current[bucket]
      ? mergePendingRows(raw, localRows, previous, {
          deleted: id => isRecordDeleted(bucket, id) || bucket === 'users' && serverDeletedUserIdsRef.current.has(String(id)),
          creates: bucket === 'users' ? pendingUserCreatesRef.current : new Set()
        })
      : raw.filter(row => !isRecordDeleted(bucket, row.id));
    granularBaselineRef.current[bucket] = rowsToMap(raw);
    granularSeenRemoteRef.current[bucket] = true;
    return merged;
  };

  const markGranularLoaded = key => {
    granularLoadedRef.current[key] = true;
    if (Object.values(granularLoadedRef.current).every(Boolean)) {
      granularSyncReadyRef.current = true;
      setIsDataLoaded(true);
      setTimeout(() => { isInitializingRef.current = false; }, 250);
    }
  };

  const handleFirestoreQuotaError = error => {
    const code = String(_optionalChain([error, 'optionalAccess', _143 => _143.code]) || '');
    const message = String(_optionalChain([error, 'optionalAccess', _144 => _144.message]) || '');
    if (code.includes('resource-exhausted') || /quota|resource.?exhausted/i.test(message)) {
      // Kota doluyken her state değişiminde tekrar tekrar istek atıp durumu daha da
      // ağırlaştırmamak için 5 dakikalık yerel geri çekilme uygulanır.
      quotaBackoffUntilRef.current = Date.now() + (5 * 60 * 1000);
      console.warn('Firestore kotası dolu. Senkronizasyon 5 dakika bekletildi; yerel kayıt çalışmaya devam ediyor.', error);
    } else {
      console.error('Firestore senkronizasyon hatası:', error);
    }
  };

  const persistRowsNow = async (bucketName, rows, baselineKey) => {
    const nextMap = rowsToMap(rows);
    const previousMap = granularBaselineRef.current[baselineKey] || new Map();
    const work = Array.from(nextMap.entries()).filter(([id, row]) =>
      !isRecordDeleted(baselineKey, id) && (!previousMap.has(id) || stableJson(previousMap.get(id)) !== stableJson(row))
    );
    const results = await mapLimited(work, async ([id, row]) => {
      const previous = previousMap.get(id) || {};
      const result = await runTransaction(db, async tx => {
        const target = getLiveDoc(bucketName, id);
        const reads = [tx.get(target)];
        if (baselineKey === 'users') reads.push(tx.get(getLiveDoc('sgmDeletedUsers', id)));
        const [snap, tombstone] = await Promise.all(reads);
        if (_optionalChain([tombstone, 'optionalAccess', _145 => _145.exists, 'call', _146 => _146()])) return null;
        if (!snap.exists()) {
          if (baselineKey === 'users' && !pendingUserCreatesRef.current.has(id)) return null;
          // Existing desks/config must never be recreated from an old snapshot.
          if (baselineKey === 'desks' && Object.keys(previous).length) return null;
          tx.set(target, row);
          return row;
        }
        const remote = baselineKey === 'users' ? normalizeRemoteUsers([snap.data()])[0] : normalizeRemoteDesks([snap.data()])[0] || snap.data();
        const fields = baselineKey === 'desks' ? ['status','occupant','ownerDeviceId','pendingOccupant','pendingDeskDeadline','pendingDeskRole','breakEndTime','reportEndTime','reportIssuedAt','reportVerifiedAt','sessionStartTime'] : ['activeDeskId','activeDeskRole','pendingDeskId','pendingDeskDeadline'];
        const patch = withoutSessionWrites(withoutAccountApprovalWrites(preventClosedHoursSessionWrites(
          atomicFieldPatch(remote, previous, row, fields), baselineKey, Date.now(), settingsRef.current.openTime, settingsRef.current.closeTime
        )), baselineKey);
        if (Object.keys(patch).length) tx.set(target, patch, { merge: true });
        return { ...remote, ...patch };
      });
      if (result) {
        granularBaselineRef.current[baselineKey].set(id, result);
        pendingUserCreatesRef.current.delete(id);
      } else if (baselineKey === 'users') {
        // Eski tombstone bir hesabın mevcut belgesiyle çakışabilir.
        // Null transaction sonucu tek başına hesabın silindiğini kanıtlamaz;
        // yetkili canlı koleksiyon dinleyicisi gerçek sunucu listesini belirler.
        // Böylece geri yüklemeden sonra kullanıcılar birer birer düşmez.
        console.warn('Kullanıcı senkronizasyonu atlandı; kayıt listeden silinmedi:', id);
      }
    });
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
    // Deletion is an explicit operation, never inferred from a partial query/window.
  };

  const persistGranularStateNow = async snapshot => {
    if (!db || deskQrRepairInFlightRef.current) return;
    if (!fbUser || Date.now() < Number(quotaBackoffUntilRef.current || 0)) throw new Error('Sunucu bağlantısı veya kota bekleniyor. İşlem henüz sunucuya kaydedilmedi.');
    if (!adminAuthorized) return;

    const jobs = [];
    if (snapshot.settings && adminAuthorized) {
      const settingsJson = stableJson(snapshot.settings);
      if (granularBaselineRef.current.settings !== settingsJson) {
        const previous = JSON.parse(granularBaselineRef.current.settings || '{}');
        jobs.push(runTransaction(db, async tx => {
          const ref = getLiveSettingsDoc(), snap = await tx.get(ref);
          if (!snap.exists()) { tx.set(ref, snapshot.settings); return snapshot.settings; }
          const remote = { ...DEFAULT_SETTINGS, ...snap.data() }, patch = nonConflictingPatch(remote, previous, snapshot.settings);
          if (Object.keys(patch).length) tx.set(ref, patch, { merge: true });
          return { ...remote, ...patch };
        }).then(result => { granularBaselineRef.current.settings = stableJson(result); }));
      }
    }
    if (snapshot.layoutElements && adminAuthorized) {
      const layoutJson = stableJson(snapshot.layoutElements);
      if (granularBaselineRef.current.layout !== layoutJson) {
        jobs.push(setDoc(getLiveLayoutDoc(), { elements: snapshot.layoutElements }).then(() => {
          granularBaselineRef.current.layout = layoutJson;
        }));
      }
    }

    if (snapshot.desks) jobs.push(persistRowsNow('sgmDesks', snapshot.desks, 'desks'));
    if (snapshot.users) jobs.push(persistRowsNow('sgmUsers', snapshot.users, 'users'));

    try {
      await Promise.all(jobs);
    } catch (error) {
      handleFirestoreQuotaError(error);
      throw error;
    }
  };

  const repairDeskQrData = async (notify = true) => {
    if (deskQrRepairInFlightRef.current || qrBackupOperationRef.current) return;
    if (db && (!fbUser || !adminAuthorized)) {
      if (notify) showMessage('Bağlantı Bekleniyor', 'Masa onarımı için yönetici bağlantısını bekleyin.', 'warning');
      return;
    }
    deskQrRepairInFlightRef.current = true;
    setDeskQrRepairBusy(true);
    try {
      let rows = Array.isArray(desksRef.current) ? desksRef.current : [];
      let qrFallbackRows = [...rows];
      if (db && fbUser) {
        if (Date.now() < Number(quotaBackoffUntilRef.current || 0)) throw new Error('Senkronizasyon kotası dolu. Birkaç dakika sonra tekrar deneyin.');
        const live = await getDocs(getLiveCollection('sgmDesks'));
        const remote = live.docs.map(snap => ({ ...snap.data(), id: _nullishCoalesce(_optionalChain([snap, 'access', _147 => _147.data, 'call', _148 => _148(), 'optionalAccess', _149 => _149.id]), () => ( snap.id)) }));
        rows = remote;
        const valid = remote.filter(d => Number.isInteger(Number(d.id)) && Number(d.id) >= 1 && Number(d.id) <= 35);
        if (new Set(valid.map(d => Number(d.id))).size < 35 || valid.some(d => !d.qrCode)) {
          const legacy = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sgmData', 'allData'));
          const legacyRows = legacy.exists() ? _optionalChain([legacy, 'access', _150 => _150.data, 'call', _151 => _151(), 'optionalAccess', _152 => _152.desks]) : null;
          if (Array.isArray(legacyRows)) qrFallbackRows.push(...legacyRows);
        }
      }
      const repaired = completeMainLibraryDesks(rows, qrFallbackRows);
      if (!repaired.length) throw new Error('Ana Salon için geçerli masa kaydı bulunamadı.');
      let finalRows = repaired;
      if (db && fbUser) {
        finalRows = await Promise.all(repaired.map(desk => runTransaction(db, async tx => {
          const ref = getLiveDoc('sgmDesks', desk.id);
          const snap = await tx.get(ref);
          if (snap.exists()) {
            const current = { ...snap.data(), id: Number(desk.id) };
            const completed = normalizeDeskQrRows([{ ...current, qrCode: current.qrCode || desk.qrCode }])[0];
            if (!current.qrCode) tx.set(ref, { qrCode: completed.qrCode }, { merge: true });
            return completed;
          }
          tx.set(ref, desk);
          return desk;
        })));
      }
      finalRows.sort((a, b) => Number(a.id) - Number(b.id));
      if (db && fbUser) granularBaselineRef.current.desks = rowsToMap(finalRows);
      desksRef.current = finalRows;
      setDesks(finalRows);
      localStorage.setItem('sgm_desks', JSON.stringify(finalRows));
      if (notify) showMessage('QR Kodları Hazır', `${finalRows.length} masanın QR kodu kontrol edildi. Mevcut QR kodları korundu, eksik kayıtlar tamamlandı.`, 'success');
    } catch (error) {
      handleFirestoreQuotaError(error);
      if (notify) showMessage('QR Onarımı Tamamlanamadı', error.message || 'Sistem bağlantısını kontrol edip tekrar deneyin.', 'warning');
    } finally {
      deskQrRepairInFlightRef.current = false;
      setDeskQrRepairBusy(false);
    }
  };

  const buildLegacyNormalizedData = data => {
    const incomingSettings = mergeRegistrationSettings(settingsRef.current, { ...DEFAULT_SETTINGS, ...(_optionalChain([data, 'optionalAccess', _153 => _153.settings]) || {}) });
    const normalizedSettings = { ...incomingSettings, showBlueRoomKroki: false, layoutSchemaVersion: 3 };
    const remoteLayoutIsOld = Number(_optionalChain([data, 'optionalAccess', _154 => _154.settings, 'optionalAccess', _155 => _155.layoutSchemaVersion]) || 0) < 3;
    const oldLogs = Array.isArray(_optionalChain([data, 'optionalAccess', _156 => _156.logs])) ? data.logs : [];
    return {
      settings: normalizedSettings,
      desks: normalizeRemoteDesks(Array.isArray(_optionalChain([data, 'optionalAccess', _157 => _157.desks])) ? data.desks : INITIAL_DESKS),
      users: normalizeRemoteUsers(Array.isArray(_optionalChain([data, 'optionalAccess', _158 => _158.users])) ? data.users : [], normalizedSettings)
        .filter(u => _optionalChain([u, 'optionalAccess', _159 => _159.id]) && !isRecordDeleted('users', u.id)),
      logs: oldLogs.filter(x => _optionalChain([x, 'optionalAccess', _160 => _160.id]) && !isRecordDeleted('logs', x.id)).slice(0, 500),
      violationRecords: (Array.isArray(_optionalChain([data, 'optionalAccess', _161 => _161.violationRecords]))
        ? data.violationRecords
        : oldLogs.filter(log => log && String(log.type || '').startsWith('IHLAL')).map(log => ({
            id: `VIOL-${log.id}`, sourceLogId: log.id, time: log.time, type: log.type,
            message: log.message, deskId: log.deskId || null, userId: log.userId || null,
            userInfo: log.userInfo || 'Sistem / Anonim', deviceInfo: log.deviceInfo || '-', locationInfo: log.locationInfo || '-'
          })))
        .filter(x => _optionalChain([x, 'optionalAccess', _162 => _162.id]) && !isRecordDeleted('violations', x.id)),
      feedbackRecords: (Array.isArray(_optionalChain([data, 'optionalAccess', _163 => _163.feedbackRecords])) ? data.feedbackRecords : [])
        .filter(x => _optionalChain([x, 'optionalAccess', _164 => _164.id]) && !isRecordDeleted('feedback', x.id)),
      layoutElements: remoteLayoutIsOld
        ? generateDefaultLayout()
        : (Array.isArray(_optionalChain([data, 'optionalAccess', _165 => _165.layoutElements])) && data.layoutElements.length ? data.layoutElements : generateDefaultLayout())
    };
  };

  const applyGranularInitialData = data => {
    settingsRef.current = data.settings;
    setSettings(data.settings);
    desksRef.current = data.desks;
    usersRef.current = data.users;
    logsRef.current = data.logs;
    violationRecordsRef.current = data.violationRecords;
    feedbackRecordsRef.current = data.feedbackRecords;
    layoutElementsRef.current = data.layoutElements;
    setDesks(data.desks);
    setUsers(data.users);
    setLogs(data.logs);
    setViolationRecords(data.violationRecords);
    setFeedbackRecords(data.feedbackRecords);
    setLayoutElements(data.layoutElements);
  };

  // Hesap düzenleme başarılı mesajı yalnızca sunucu işlemi tamamlanınca gösterilir.
  const saveAdminUserChanges = (original, desired) => {
    // Consecutive or bulk saves wait in a queue instead of failing spuriously.
    const performSave = async () => {
    adminUserSaveInFlightRef.current = true;
    setAdminUserSavingId(original.id);
    clearTimeout(granularWriteTimerRef.current);
    try {
      if (db) {
        if (!auth) throw new Error('Firebase oturumu bulunamadı. Yönetici paneline yeniden giriş yapın.');
        await ensureTabAuthPersistence();
        const liveUser = auth.currentUser;
        if (!liveUser) throw new Error('Yönetici oturumu sona ermiş. Yönetici paneline yeniden giriş yapın.');
        // Sunucu requireActiveAdmin ile yetkiyi doğrular. İkinci zorunlu token yenileme
        // ve ilgisiz senkronizasyon kuyruğu kısıt kaydını bloke etmez.
      }
      const patch = Object.fromEntries(Object.entries(desired).filter(([key, value]) => key !== 'id' && stableJson(value) !== stableJson(original[key])));
      // Yalnızca yönetici tarafından gerçekten değiştirilen alanları gönder.
      // Ad/şifre düzenlemesi eski kısıt bilgisini istemeden geri yazamaz.
      if (!Object.keys(patch).length) return original;
      const result = db
        ? (await runAdminMaintenance('update_user', {
            userId: original.id,
            patch,
            expectedPermission: Object.fromEntries(
              ['blocked', 'pendingApproval', 'restrictedUntil', 'restrictionReason',
               'canReport', 'reportPermissionPolicyVersion', 'reportPermissionRestrictionUntil']
                .map(key => [key, original[key]])
            )
          })).user
        : desired;
      if (!result) throw new Error('Hesap sunucuda güncellenemedi.');
      applyCloudRows({user: result});
      localStorage.setItem('sgm_users', JSON.stringify(usersRef.current));
      return result;
    } finally {
      adminUserSaveInFlightRef.current = false;
      setAdminUserSavingId(null);
    }
    };
    const job = adminUserSaveQueueRef.current.then(performSave);
    adminUserSaveQueueRef.current = job.catch(() => {});
    return job;
  };

  // Anlık hesap onayı: tek güvenli sunucu transaction'ı, topluda tek ağ isteği.
  // Eski yönetici önbelleği onay durumunu geriye çeviremez.
  const approveUsersNow = async ids => {
    if (!ids.length) return [];
    const result = await runAdminMaintenance('approve_users', { userIds: ids.map(String) });
    if (!Array.isArray(_optionalChain([result, 'optionalAccess', _166 => _166.users])) || result.users.length !== ids.length) {
      throw new Error('Hesap onayı sunucudan doğrulanamadı.');
    }
    // Yalnızca bu alanları birleştir; kısmi API yanıtını normalizeRemoteUsers
    // üzerinden geçirmek GM kodunu, şifreyi ve ihlal sayacını değiştirebilir.
    usersRef.current = mergeAccountApproval(usersRef.current, result.users);
    for (const patch of result.users) {
      const previous = granularBaselineRef.current.users.get(String(patch.id)) || {};
      granularBaselineRef.current.users.set(String(patch.id), { ...previous, ...patch });
    }
    setUsers(usersRef.current);
    try { localStorage.setItem('sgm_users', JSON.stringify(usersRef.current)); } catch (e14) {}
    return result.users;
  };

  const refreshStudentProfile = async () => {
    const id = _optionalChain([currentUser, 'optionalAccess', _167 => _167.id]);
    if (!db || !id || _optionalChain([auth, 'optionalAccess', _168 => _168.currentUser, 'optionalAccess', _169 => _169.uid]) !== id) return;
    try {
      const snapshot = await getDocFromServer(getLiveDoc('sgmUsers', id));
      if (_optionalChain([auth, 'optionalAccess', _170 => _170.currentUser, 'optionalAccess', _171 => _171.uid]) !== id) return;
      if (!snapshot.exists()) {
        serverDeletedUserIdsRef.current.add(String(id));
        usersRef.current = []; setUsers([]);
        return;
      }
      const user = {...snapshot.data(), id};
      applyCloudRows({user});
      setUsersSyncError('');
      localStorage.setItem('sgm_users', JSON.stringify(usersRef.current));
    } catch (error) {
      setUsersSyncError('Hesap durumu sunucudan yenilenemedi. Bağlantı ve hesap erişimini kontrol edin.');
      handleFirestoreQuotaError(error);
    }
  };
  useEffect(() => {
    if (!_optionalChain([currentUser, 'optionalAccess', _172 => _172.id]) || !fbUser || fbUser.uid !== currentUser.id) return;
    const refresh = () => { if (!document.hidden) refreshStudentProfile(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [_optionalChain([currentUser, 'optionalAccess', _173 => _173.id]), fbUser]);

  // 22:00'de açık öğrenci telefonunda eski masa bağlantısı kalmasın.
  // Sunucuda da cezasız kapanış yapılır; bu kontrol yalnızca kendi oturumunu
  // güvenli şekilde tamamlar ve Firestore'un onayladığı sonucu gösterir.
  // Uyuyan sekme tekrar açıldığında veya bağlantı geldiğinde yeniden çalışır.
  const studentCloseSyncRef = useRef({ busy: false, lastAttempt: 0, key: '' });
  useEffect(() => {
    if (!db || !fbUser || !_optionalChain([currentUser, 'optionalAccess', _174 => _174.id]) || fbUser.uid !== currentUser.id ||
        !serverClockVerified || !navigator.onLine ||
        !isIstanbulAfterClose(now + serverTimeOffsetMs, settings.closeTime)) return;
    const deskId = Number(currentUser.activeDeskId || currentUser.pendingDeskId);
    if (!Number.isInteger(deskId) || deskId < 1 || deskId > 35) return;
    const action = currentUser.activeDeskId ? 'leave' : 'cancel';
    const key = `${currentUser.id}:${deskId}:${action}`;
    const guard = studentCloseSyncRef.current;
    if (guard.busy || (guard.key === key && Date.now() - guard.lastAttempt < 20000)) return;
    guard.busy = true; guard.key = key; guard.lastAttempt = Date.now();
    (async () => {
      try {
        const result = await runStudentDeskAction(action, { deskId });
        if (result) {
          applyCloudRows(result);
          if (!_optionalChain([result, 'access', _175 => _175.user, 'optionalAccess', _176 => _176.activeDeskId]) && !_optionalChain([result, 'access', _177 => _177.user, 'optionalAccess', _178 => _178.pendingDeskId])) {
            setSelectedDeskId(null); setDeskSelectionDeadline(null);
            setScannerConfig({ isOpen: false, mode: null, title: '' });
          }
        }
      } catch (error) {
        // Cron ve onSnapshot diğer güvenli yollar; hata durumunda yerel kayıt
        // sunucu onayı olmadan boşmuş gibi gösterilmez. Sonraki turda denenir.
        console.warn('22:00 telefon masa eşitlemesi bekliyor:', _optionalChain([error, 'optionalAccess', _179 => _179.message]));
        await refreshStudentProfile();
      } finally { guard.busy = false; }
    })();
  }, [_optionalChain([currentUser, 'optionalAccess', _180 => _180.id]), _optionalChain([currentUser, 'optionalAccess', _181 => _181.activeDeskId]), _optionalChain([currentUser, 'optionalAccess', _182 => _182.pendingDeskId]),
      _optionalChain([fbUser, 'optionalAccess', _183 => _183.uid]), serverClockVerified, serverTimeOffsetMs, Math.floor(now / 5000)]);

  // Veri kapsamı sayfaya değil doğrulanmış yönetici oturumuna bağlıdır.
  const adminDataMode = adminAuthorized;

  useEffect(() => {
    if (!fbUser || !db || fbUser.uid.startsWith('sgm-leader-')) return;
    let cancelled = false;
    let unsubs = [];
    let retryTimer = null;
    const retry = error => {
      handleFirestoreQuotaError(error);
      const delay = /permission-denied|unauthenticated/.test(String(_optionalChain([error, 'optionalAccess', _184 => _184.code]))) ? 60000 : Math.max(3000, quotaBackoffUntilRef.current - Date.now());
      if (!retryTimer && !cancelled) retryTimer = setTimeout(() => setSyncRetryEpoch(value => value + 1), delay);
    };

    // Yeni öğrenci kayıtları, eski veri aktarımının sonucunu beklemeden dinlenir.
    setUsersSyncError('');
    const userSource = adminDataMode ? getLiveCollection('sgmUsers') : getLiveDoc('sgmUsers', fbUser.uid);
    unsubs.push(onSnapshot(userSource, { includeMetadataChanges: true }, snapshot => {
      if (cancelled || snapshot.metadata.fromCache || _optionalChain([auth, 'optionalAccess', _185 => _185.currentUser, 'optionalAccess', _186 => _186.uid]) !== fbUser.uid) return;
      // Eski tek hesap dinleyicisi, yeni yönetici listesini tek kullanıcıya düşüremez.
      if (!adminDataMode && verifiedAdminUidRef.current === fbUser.uid) return;
      setUsersSyncError('');
      if (adminDataMode) {
        if (userBackupRestoreInFlightRef.current) return;
        const remoteRows = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
        const normalized = normalizeRemoteUsers(remoteRows, settingsRef.current);
        const merged = mergeRemoteWithPendingLocal('users', normalized, usersRef.current).map(row => {
          const remote = normalized.find(r => String(r.id) === String(row.id));
          return remote ? { ...remote, ...withoutAccountApprovalWrites(withoutSessionWrites(row, 'users')) } : row;
        });
        // Tarayıcı önbelleği ile sunucu arasındaki farkı yalnızca bilgilendirme için tut.
        // Eksik hesapları kendiliğinden geri oluşturma: daha önce silinmiş olabilirler.
        if (!adminUsersServerReady) {
          const remoteIds = new Set(normalized.map(u => String(u.id)));
          setCachedUsersDifference(usersRef.current.filter(u => !remoteIds.has(String(u.id))).length);
        }
        usersRef.current = merged;
        setUsers(merged);
        setAdminUsersServerReady(true);
      } else {
        const rows = snapshot.exists()
          ? normalizeRemoteUsers([{ ...snapshot.data(), id: snapshot.id }], settingsRef.current) : [];
        usersRef.current = rows;
        setUsers(rows);
        if (rows[0]) {
          const id = String(rows[0].id);
          serverDeletedUserIdsRef.current.delete(id);
          granularBaselineRef.current.users.set(id, rows[0]);
        } else {
          // Yalnızca önceden bilinen, doğrulanmış hesabın sunucu snapshot'ı
          // silme kanıtıdır. Anonim oturumdaki boş belge yeni kaydı engellemez.
          const id = String(fbUser.uid);
          const savedSession = (() => { try { return JSON.parse(sessionStorage.getItem('sgm_student_session') || 'null'); } catch (e15) { return null; } })();
          if (granularBaselineRef.current.users.has(id) || _optionalChain([savedSession, 'optionalAccess', _187 => _187.userId]) === id) {
            serverDeletedUserIdsRef.current.add(id);
            granularBaselineRef.current.users.delete(id);
            sessionStorage.removeItem('sgm_student_session');
            localStorage.removeItem('sgm_users');
            setCurrentUser(previous => _optionalChain([previous, 'optionalAccess', _188 => _188.id]) === id ? null : previous);
            setSelectedDeskId(null); setDeskSelectionDeadline(null);
            setScannerConfig({isOpen: false, mode: null, title: ''});
            setView(previous => previous === 'student_dash' || previous === 'student_feedback' ? 'student_login' : previous);
            const savedRegistration = (() => { try { return JSON.parse(localStorage.getItem('sgm_registration_account') || 'null'); } catch (e16) { return null; } })();
            if (_optionalChain([savedRegistration, 'optionalAccess', _189 => _189.userId]) === id) {
              localStorage.removeItem('sgm_registration_account');
              ['sgm_registration_token', 'sgm_registration_credentials', 'sgm_registration_form_url', 'sgm_registration_form_opened'].forEach(key => sessionStorage.removeItem(key));
              setRegistrationPending(''); setRegistrationResult(null); setRegistrationFormUrl(''); setRegistrationFormOpened(false);
            }
          }
        }
        localStorage.setItem('sgm_users', JSON.stringify(rows));
      }
      markGranularLoaded('users');
    }, error => {
      if (cancelled) return;
      setUsersSyncError(/permission-denied/.test(String(_optionalChain([error, 'optionalAccess', _190 => _190.code])))
        ? 'Kullanıcı listesine erişim reddedildi. Yönetici oturumunu ve Firestore kurallarını kontrol edin.'
        : 'Kullanıcı listesi sunucudan alınamadı. Bağlantı kurulduğunda yeniden denenecek.');
      retry(error);
      setIsDataLoaded(true);
    }));

    const setupGranularSync = async () => {
      try {
        try {
        // Yeni parçalı yapının var olup olmadığını sadece settings belgesiyle kontrol ediyoruz.
        // Yoksa eski allData bir kez okunup yeni koleksiyonlara taşınıyor.
        const liveSettingsSnap = await getDoc(getLiveSettingsDoc());
        if (!liveSettingsSnap.exists() && adminDataMode) {
          const legacyRef = doc(db, 'artifacts', appId, 'public', 'data', 'sgmData', 'allData');
          const legacySnap = await getDoc(legacyRef);
          const legacyData = legacySnap.exists()
            ? buildLegacyNormalizedData(legacySnap.data())
            : {
                settings: { ...settingsRef.current, showBlueRoomKroki: false, useCustomLayout: true, layoutSchemaVersion: 3 },
                desks: normalizeRemoteDesks(desksRef.current),
                users: [],
                logs: logsRef.current || [],
                violationRecords: violationRecordsRef.current || [],
                feedbackRecords: feedbackRecordsRef.current || [],
                layoutElements: layoutElementsRef.current || generateDefaultLayout()
              };

          legacyData.users.forEach(user => pendingUserCreatesRef.current.add(String(user.id)));
          applyGranularInitialData(legacyData);
          await persistGranularStateNow(legacyData);
          await setDoc(getLiveMetaDoc(), { schemaVersion: 2, migratedAt: Date.now() }, { merge: true });
        }

        if (adminDataMode) {
          const meta = await getDoc(getLiveMetaDoc());
          if (_optionalChain([meta, 'access', _191 => _191.data, 'call', _192 => _192(), 'optionalAccess', _193 => _193.historyMigrationVersion]) !== 1) {
            const legacySnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sgmData', 'allData'));
            const legacy = legacySnap.data() || {};
            const oldLogs = Array.isArray(legacy.logs) ? legacy.logs : [];
            const historyItems = [
              ...oldLogs.map(record => ['sgmAudit',record]),
              ...(legacy.violationRecords || []).map(record => ['sgmViolations',record]),
              ...(legacy.feedbackRecords || []).map(record => ['sgmFeedback',record])
            ].filter(([, record]) => _optionalChain([record, 'optionalAccess', _194 => _194.id]));
            historyItems.forEach(([bucket,record]) => queueAppend(bucket, record));
            await appendChainRef.current;
            if (!historyItems.some(([bucket,record]) => readAppendOutbox()[`${bucket}/${record.id}`])) {
              await setDoc(getLiveMetaDoc(), { historyMigrationVersion: 1 }, { merge: true });
            }
          }
        }
        if (cancelled) return;

        } catch (migrationError) {
          // Eski arşiv/meta izin hatası canlı masa ve kullanıcı dinlemesini durdurmasın.
          retry(migrationError);
        }
        if (cancelled) return;

        // CONFIG: SETTINGS
        unsubs.push(onSnapshot(getLiveSettingsDoc(), snap => {
          if (snap.exists()) {
            const remote = mergeRegistrationSettings(settingsRef.current, { ...DEFAULT_SETTINGS, ...snap.data(), showBlueRoomKroki: false, layoutSchemaVersion: 3 });
            const remoteJson = stableJson(remote);
            granularBaselineRef.current.settings = remoteJson;
            granularSeenRemoteRef.current.settings = true;
            // Tüm cihazlar ve yönetici ekranı sunucunun son ayarını hemen uygular.
            settingsRef.current = remote;
            setSettings(remote);
          }
          markGranularLoaded('settings');
        }, error => { retry(error); setIsDataLoaded(true); }));

        // CONFIG: LAYOUT
        unsubs.push(onSnapshot(getLiveLayoutDoc(), snap => {
          if (snap.exists()) {
            const remoteLayout = Array.isArray(_optionalChain([snap, 'access', _195 => _195.data, 'call', _196 => _196(), 'optionalAccess', _197 => _197.elements])) && snap.data().elements.length
              ? snap.data().elements
              : generateDefaultLayout();
            const remoteJson = stableJson(remoteLayout);
            const localChanged = granularSeenRemoteRef.current.layout &&
              granularBaselineRef.current.layout !== stableJson(layoutElementsRef.current);
            granularBaselineRef.current.layout = remoteJson;
            granularSeenRemoteRef.current.layout = true;
            if (!localChanged) {
              layoutElementsRef.current = remoteLayout;
              setLayoutElements(remoteLayout);
            }
          }
          markGranularLoaded('layout');
        }, error => { retry(error); setIsDataLoaded(true); }));

        const subscribeRows = (firestoreName, key, getLocalRows, applyRows, normalizeRows = rows => rows) => {
          const source = firestoreName === 'sgmAudit' || firestoreName === 'sgmLogs'
            ? query(getLiveCollection(firestoreName), orderBy('time', 'desc'), limit(500))
            : getLiveCollection(firestoreName);
          const unsub = onSnapshot(source, { includeMetadataChanges: true }, snapshot => {
            if (cancelled || snapshot.metadata.fromCache) return;
            let remoteRows = snapshot.docs.map(d => ({ ...d.data(), id: _nullishCoalesce(_optionalChain([d, 'access', _198 => _198.data, 'call', _199 => _199(), 'optionalAccess', _200 => _200.id]), () => ( d.id)) }));
            remoteRows = normalizeRows(remoteRows);
            // Kısmen oluşmuş koleksiyonda da eksik 35 masa ve QR kayıtları tamamlanır.
            if (key === 'desks') {
              const needsRepair = new Set(remoteRows.map(d => Number(d.id))).size < 35 || remoteRows.some(d => !d.qrCode);
              if (needsRepair && adminDataMode && !deskQrAutoRecoveryAttemptedRef.current) {
                deskQrAutoRecoveryAttemptedRef.current = true;
                repairDeskQrData(false);
              }
              if (remoteRows.length === 0) {
                markGranularLoaded(key);
                return;
              }
            }
            if (key === 'users') remoteRows = normalizeRemoteUsers(remoteRows, settingsRef.current);
            // Öğrenci masa işlemleri API tarafından yazılır. Öğrenci cihazındaki
            // eski doluluk bilgisi sunucunun boş masa kaydını ezmemelidir.
            const mergedRows = ['desks', 'users'].includes(key) && adminDataMode
              ? mergeRemoteWithPendingLocal(key, remoteRows, getLocalRows()).map(row => {
                  const serverRow = remoteRows.find(remote => String(remote.id) === String(row.id));
                  if (!serverRow) return row;
                  const allowedLocal = key === 'users'
                    ? withoutAccountApprovalWrites(withoutSessionWrites(row, key))
                    : withoutSessionWrites(row, key);
                  // Kritik alanların kaynağı yalnızca Firestore'dur.
                  return { ...serverRow, ...allowedLocal };
                })
              : remoteRows;
            if (key === 'desks' && !adminDataMode) {
              granularBaselineRef.current.desks = rowsToMap(remoteRows);
              granularSeenRemoteRef.current.desks = true;
            }
            // Baseline eksik QR'ı taşıdığı için mevcut senkronizasyon yalnızca onarılan
            // masa belgelerini bir kez kaydeder; eski QR'lar değiştirilmez.
            applyRows(key === 'desks' ? normalizeDeskQrRows(mergedRows) : mergedRows);
            markGranularLoaded(key);
          }, error => { retry(error); setIsDataLoaded(true); });
          unsubs.push(unsub);
        };

        subscribeRows('sgmDesks', 'desks', () => desksRef.current, rows => {
          desksRef.current = rows;
          setDesks(rows);
        }, normalizeRemoteDesks);

        // Kota optimizasyonu: öğrenci cihazları yönetim arşivlerini gerçek zamanlı dinlemez.
        // Log / ihlal / geri bildirim koleksiyonları yalnızca yönetici paneli açıkken dinlenir.
        if (adminDataMode) {
          const logWindows = { audit: [], legacy: [] };
          const applyLogWindow = (bucket, rows) => {
            logWindows[bucket] = rows;
            const all = [...logWindows.audit, ...logWindows.legacy];
            const pending = Object.values(readAppendOutbox()).filter(item => item.bucket === 'sgmAudit').map(item => item.record);
            const filtered = [...new Map([...all, ...pending].map(row => [row.id, row])).values()]
              .filter(row => _optionalChain([row, 'optionalAccess', _201 => _201.id]) && !isRecordDeleted('logs', row.id))
              .sort((a,b) => Number(b.time) - Number(a.time)).slice(0,500);
            logsRef.current = filtered; setLogs(filtered);
          };
          subscribeRows('sgmAudit', 'logs', () => [], rows => applyLogWindow('audit', rows));
          subscribeRows('sgmLogs', 'logs', () => [], rows => {
            applyLogWindow('legacy', rows);
            return;
          });

          subscribeRows('sgmViolations', 'violations', () => violationRecordsRef.current, rows => {
            const filtered = rows
              .filter(x => _optionalChain([x, 'optionalAccess', _202 => _202.id]) && !isRecordDeleted('violations', x.id))
              .sort((a,b) => Number(_optionalChain([b, 'optionalAccess', _203 => _203.time]) || 0) - Number(_optionalChain([a, 'optionalAccess', _204 => _204.time]) || 0));
            violationRecordsRef.current = filtered;
            setViolationRecords(filtered);
          });

          subscribeRows('sgmFeedback', 'feedback', () => feedbackRecordsRef.current, rows => {
            const filtered = rows
              .filter(x => _optionalChain([x, 'optionalAccess', _205 => _205.id]) && !isRecordDeleted('feedback', x.id))
              .sort((a,b) => Number(_optionalChain([b, 'optionalAccess', _206 => _206.time]) || 0) - Number(_optionalChain([a, 'optionalAccess', _207 => _207.time]) || 0));
            feedbackRecordsRef.current = filtered;
            setFeedbackRecords(filtered);
          });
        } else {
          markGranularLoaded('logs');
          markGranularLoaded('violations');
          markGranularLoaded('feedback');
        }
      } catch (error) {
        retry(error);
        // Firebase o an kota/bağlantı hatası verirse uygulama localStorage ile çalışmaya devam etsin.
        granularSyncReadyRef.current = false;
        setIsDataLoaded(true);
        setTimeout(() => { isInitializingRef.current = false; }, 250);
      }
    };

    setupGranularSync();
    const reconnect = () => { if (Date.now() >= quotaBackoffUntilRef.current) setSyncRetryEpoch(value => value + 1); };
    window.addEventListener('online', reconnect);
    return () => {
      window.removeEventListener('online', reconnect);
      if (retryTimer) clearTimeout(retryTimer);
      cancelled = true;
      unsubs.forEach(unsub => { try { unsub(); } catch (e17) {} });
    };
  }, [fbUser, adminDataMode, syncRetryEpoch]);

  useEffect(() => {
    try {
      localStorage.setItem('sgm_settings', JSON.stringify(settings));
      localStorage.setItem('sgm_desks', JSON.stringify(desks));
      localStorage.setItem('sgm_users', JSON.stringify(users));
      localStorage.setItem('sgm_logs', JSON.stringify(logs));
      localStorage.setItem('sgm_violation_records', JSON.stringify(violationRecords));
      localStorage.setItem('sgm_feedback_records', JSON.stringify(feedbackRecords));
      localStorage.setItem('sgm_layout', JSON.stringify(layoutElements));
    } catch(e) {}

    if (!isDataLoaded || !fbUser || !db || !granularSyncReadyRef.current || adminUserSaveInFlightRef.current || userBackupRestoreInFlightRef.current) return;
    if (Date.now() < Number(quotaBackoffUntilRef.current || 0)) return;

    // Hızlı art arda gelen state değişikliklerini normalde 900ms içinde tek turda birleştir.
    // QR ile masa alma/bırakma gibi kritik işlemler mevcut criticalDeskMutationRef üzerinden
    // gecikmeden (50ms) senkronize edilir. Her turda yalnızca değişmiş belge yazılır.
    if (granularWriteTimerRef.current) clearTimeout(granularWriteTimerRef.current);
    const snapshot = adminDataMode
      ? { settings, desks, users, logs, violationRecords, feedbackRecords, layoutElements }
      : { settings, desks, users, layoutElements };
    const isCritical = criticalDeskMutationRef.current === true;
    criticalDeskMutationRef.current = false;
    granularWriteTimerRef.current = setTimeout(() => {
      granularWriteChainRef.current = granularWriteChainRef.current
        .then(() => persistGranularStateNow(snapshot))
        .catch(() => {});
    }, isCritical ? 50 : 900);

    return () => {
      if (granularWriteTimerRef.current) clearTimeout(granularWriteTimerRef.current);
    };
  }, [settings, desks, users, logs, violationRecords, feedbackRecords, layoutElements, isDataLoaded, fbUser, adminDataMode]);

  // ============================================================
  // GERÇEK TELEFON PUSH BİLDİRİMİ - FIREBASE CLOUD MESSAGING (FCM)
  // ============================================================
  // Gerçek Firebase Web Push Public key YP → Push Durumu ekranından kaydedilebilir.
  // Mevcut VITE_FIREBASE_VAPID_KEY ortam değişkeni desteği de korunmuştur.
  // public/firebase-messaging-sw.js dosyasının da projede bulunması gerekir.
  //
  // Bu fonksiyon mevcut bildirim sistemini kaldırmaz.
  // Öğrencinin telefonunu FCM'e kaydeder ve token'ı o öğrencinin kullanıcı kaydına ekler.
  // Cloud Function daha sonra ihbar / yönetici mesajı oluştuğunda bu token'a gerçek push gönderir.
  const updateUserPushDebug = (userId, patch = {}) => {
    if (!userId) return;

    setUsers(prev => Array.isArray(prev)
      ? prev.map(u => u.id === userId ? { ...u, ...patch } : u)
      : prev
    );

    setCurrentUser(prev => {
      if (!prev || prev.id !== userId) return prev;
      return { ...prev, ...patch };
    });
  };

  const registerPhonePush = async (userId, force = false) => {
    if (!userId) return null;
    // iOS Safari sekmelerinde Web Push desteklenmez: mevcut push kaydını/sunucu
    // kullanıcı durumunu değiştirmeden yalnız Ana Ekran kurulumunu göster.
    if (currentApplePushInstallGuidance()) return null;

    const markStage = (stage, extra = {}) => {
      updateUserPushDebug(userId, {
        pushLastStage: stage,
        pushLastAttemptAt: Date.now(),
        ...extra
      });
      console.log('[FCM]', stage, extra);
    };

    const fail = (stage, message, error = null) => {
      const errorCode = _optionalChain([error, 'optionalAccess', _208 => _208.code]) || _optionalChain([error, 'optionalAccess', _209 => _209.name]) || '';
      const errorMessage = _optionalChain([error, 'optionalAccess', _210 => _210.message]) || message || 'Bilinmeyen push kayıt hatası';

      console.warn('[FCM ERROR]', stage, error);

      updateUserPushDebug(userId, {
        pushEnabled: false,
        pushLastStage: stage,
        pushLastError: errorMessage,
        pushLastErrorCode: String(errorCode || ''),
        pushLastAttemptAt: Date.now()
      });

      pushRegistrationRef.current.working = false;
      return null;
    };

    try {
      markStage('1_baslatiliyor');

      if (!app) {
        return fail('1_firebase_app_yok', 'Firebase uygulaması başlatılamadı.');
      }

      if (!('serviceWorker' in navigator)) {
        return fail('2_service_worker_destegi_yok', 'Bu tarayıcı Service Worker desteklemiyor.');
      }

      if (pushRegistrationRef.current.working && !force) {
        markStage('2_onceki_kayit_devam_ediyor');
        return pushRegistrationRef.current.token || null;
      }

      // iOS yalnızca Ana Ekran uygulamasında ve doğrudan kullanıcı dokunuşunda
      // izin penceresini açar. Firebase async destek testinden ÖNCE iste.
      // Android/masaüstü eski izin sırası korunur.
      const iosHomeApp = isAppleMobileDevice({
        userAgent: navigator.userAgent || '',
        platform: navigator.platform || '',
        maxTouchPoints: navigator.maxTouchPoints || 0
      });
      if (iosHomeApp && force && 'Notification' in window && Notification.permission === 'default') {
        markStage('4_ios_bildirim_izni_isteniyor');
        try {
          await Notification.requestPermission();
        } catch (error) {
          return fail('4_ios_bildirim_izni_hatasi', 'iPhone bildirim izni alınamadı.', error);
        }
      }

      markStage('2_fcm_destegi_kontrol_ediliyor');
      const supported = await Promise.race([
        isMessagingSupported().catch(() => false),
        new Promise(resolve => setTimeout(() => resolve(false), 8000))
      ]);

      if (!supported) {
        return fail(
          '2_fcm_destegi_yok',
          'Firebase Cloud Messaging desteği alınamadı veya destek kontrolü zaman aşımına uğradı.'
        );
      }

      markStage('3_fcm_destegi_var');

      if (!('Notification' in window)) {
        return fail('4_bildirim_api_yok', 'Bu tarayıcı Bildirim API desteği sunmuyor.');
      }

      if (Notification.permission === 'default' && force) {
        markStage('4_bildirim_izni_isteniyor');
        try {
          await Notification.requestPermission();
        } catch (error) {
          return fail('4_bildirim_izni_hatasi', 'Bildirim izni istenirken hata oluştu.', error);
        }
      }

      markStage('5_bildirim_izni_kontrol', {
        pushNotificationPermission: Notification.permission
      });

      if (Notification.permission !== 'granted') {
        return fail(
          '5_bildirim_izni_yok',
          Notification.permission === 'denied'
            ? 'Bildirim izni tarayıcı tarafından engellenmiş.'
            : 'Bildirim izni henüz verilmemiş.'
        );
      }

      const vapidKey = resolveFirebaseVapidKey();

      if (!vapidKey) {
        return fail('6_vapid_eksik', 'Push bildirim anahtarı henüz ayarlanmamış. Kütüphane sorumlusu YP → Push Durumu bölümünden Firebase Web Push Public key değerini kaydetmelidir.');
      }

      if (!isValidFirebaseVapidKey(vapidKey)) {
        return fail('6_vapid_gecersiz', 'Push anahtarı geçersiz. YP → Push Durumu bölümündeki Firebase Web Push Public key değerini kontrol edin.');
      }
      markStage('6_vapid_bulundu', {
        pushVapidLength: vapidKey.length
      });

      pushRegistrationRef.current.working = true;

      const cfg = app.options || {};
      const swParams = new URLSearchParams({
        apiKey: cfg.apiKey || '',
        authDomain: cfg.authDomain || '',
        projectId: cfg.projectId || '',
        storageBucket: cfg.storageBucket || '',
        messagingSenderId: cfg.messagingSenderId || '',
        appId: cfg.appId || ''
      });

      const swUrl = `/firebase-messaging-sw.js?${swParams.toString()}`;
      markStage('7_service_worker_kaydi_basliyor', {
        pushServiceWorkerRequestedUrl: swUrl
      });

      let registration;
      try {
        registration = await Promise.race([
          navigator.serviceWorker.register(swUrl, {
            scope: '/',
            updateViaCache: 'none'
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Service Worker kaydı 12 saniye içinde tamamlanmadı.')),
              12000
            )
          )
        ]);
      } catch (error) {
        return fail(
          '7_service_worker_kayit_hatasi',
          'Firebase Messaging Service Worker kaydedilemedi.',
          error
        );
      }

      markStage('8_service_worker_kayit_oldu', {
        pushServiceWorkerScope: registration.scope || '',
        pushServiceWorkerUrl:
          _optionalChain([registration, 'access', _211 => _211.active, 'optionalAccess', _212 => _212.scriptURL]) ||
          _optionalChain([registration, 'access', _213 => _213.waiting, 'optionalAccess', _214 => _214.scriptURL]) ||
          _optionalChain([registration, 'access', _215 => _215.installing, 'optionalAccess', _216 => _216.scriptURL]) ||
          ''
      });

      try {
        await registration.update();
      } catch (e) {}

      markStage('9_service_worker_hazir_bekleniyor');

      let readyRegistration;
      try {
        readyRegistration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Service Worker ready durumu 12 saniye içinde oluşmadı.')),
              12000
            )
          )
        ]);
      } catch (error) {
        return fail(
          '9_service_worker_ready_hatasi',
          'Service Worker kayıt oldu fakat aktif hale gelemedi.',
          error
        );
      }

      registration = readyRegistration || registration;

      markStage('10_service_worker_aktif', {
        pushServiceWorkerScope: registration.scope || '',
        pushServiceWorkerUrl:
          _optionalChain([registration, 'access', _217 => _217.active, 'optionalAccess', _218 => _218.scriptURL]) ||
          _optionalChain([registration, 'access', _219 => _219.waiting, 'optionalAccess', _220 => _220.scriptURL]) ||
          _optionalChain([registration, 'access', _221 => _221.installing, 'optionalAccess', _222 => _222.scriptURL]) ||
          ''
      });

      const messaging = getMessaging(app);

      markStage('11_fcm_token_aliniyor');

      let token;
      try {
        token = await Promise.race([
          getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: registration
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('FCM token isteği 15 saniye içinde tamamlanmadı.')),
              15000
            )
          )
        ]);
      } catch (error) {
        return fail(
          '11_fcm_token_hatasi',
          'Firebase FCM token alınamadı.',
          error
        );
      }

      if (!token) {
        return fail('11_fcm_token_bos', 'Firebase FCM token üretmedi.');
      }

      await runStudentActivity('register-push-token', { token });

      pushRegistrationRef.current = {
        userId,
        token,
        working: false
      };

      markStage('12_token_kaydediliyor', {
        pushTokenPreview: `${token.slice(0, 12)}...${token.slice(-8)}`
      });

      setUsers(prev => Array.isArray(prev) ? prev.map(u => {
        if (u.id !== userId) return u;

        const previousTokens = Array.isArray(u.pushTokens)
          ? u.pushTokens.filter(Boolean)
          : [];

        const nextTokens = [
          token,
          ...previousTokens.filter(t => t !== token)
        ].slice(0, 5);

        return {
          ...u,
          pushTokens: nextTokens,
          pushEnabled: true,
          pushUpdatedAt: Date.now(),
          pushLastStage: '13_hazir',
          pushLastError: '',
          pushLastErrorCode: '',
          pushLastAttemptAt: Date.now(),
          pushServiceWorkerScope: registration.scope || '',
          pushServiceWorkerUrl:
            _optionalChain([registration, 'access', _223 => _223.active, 'optionalAccess', _224 => _224.scriptURL]) ||
            _optionalChain([registration, 'access', _225 => _225.waiting, 'optionalAccess', _226 => _226.scriptURL]) ||
            _optionalChain([registration, 'access', _227 => _227.installing, 'optionalAccess', _228 => _228.scriptURL]) ||
            '',
          pushTokenPreview: `${token.slice(0, 12)}...${token.slice(-8)}`
        };
      }) : prev);

      setCurrentUser(prev => {
        if (!prev || prev.id !== userId) return prev;

        const previousTokens = Array.isArray(prev.pushTokens)
          ? prev.pushTokens.filter(Boolean)
          : [];

        const nextTokens = [
          token,
          ...previousTokens.filter(t => t !== token)
        ].slice(0, 5);

        return {
          ...prev,
          pushTokens: nextTokens,
          pushEnabled: true,
          pushUpdatedAt: Date.now(),
          pushLastStage: '13_hazir',
          pushLastError: '',
          pushLastErrorCode: '',
          pushLastAttemptAt: Date.now(),
          pushServiceWorkerScope: registration.scope || '',
          pushServiceWorkerUrl:
            _optionalChain([registration, 'access', _229 => _229.active, 'optionalAccess', _230 => _230.scriptURL]) ||
            _optionalChain([registration, 'access', _231 => _231.waiting, 'optionalAccess', _232 => _232.scriptURL]) ||
            _optionalChain([registration, 'access', _233 => _233.installing, 'optionalAccess', _234 => _234.scriptURL]) ||
            '',
          pushTokenPreview: `${token.slice(0, 12)}...${token.slice(-8)}`
        };
      });

      console.log('Telefon push bildirimi aktif edildi. FCM token kullanıcıya kaydedildi.');
      return token;

    } catch (error) {
      return fail(
        '99_beklenmeyen_hata',
        _optionalChain([error, 'optionalAccess', _235 => _235.message]) || 'Telefon push kaydı sırasında beklenmeyen hata oluştu.',
        error
      );
    }
  };

  // Öğrenci sisteme giriş yaptığında daha önce bildirim izni verilmişse
  // telefonu otomatik olarak FCM'e kaydet.
  useEffect(() => {
    if (!_optionalChain([currentUser, 'optionalAccess', _236 => _236.id]) || !isDataLoaded) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    if (
      pushRegistrationRef.current.userId === currentUser.id &&
      pushRegistrationRef.current.token
    ) {
      return;
    }

    registerPhonePush(currentUser.id);
  }, [_optionalChain([currentUser, 'optionalAccess', _237 => _237.id]), isDataLoaded]);

  // ============================================================
  // VERCEL SERVERLESS API ÜZERİNDEN GERÇEK TELEFON PUSH BİLDİRİMİ
  // ============================================================
  // api/send-push.js Vercel'de çalışır ve Firebase Admin SDK ile FCM push gönderir.
  // Mevcut tarayıcı / ekran içi bildirim sistemi aynen korunur.
  const pushOutboxKey = 'sgm_push_outbox';
  const readPushOutbox = () => { try { return JSON.parse(localStorage.getItem(pushOutboxKey) || '{}'); } catch (e18) { return {}; } };
  const performPushRequest = async request => {
    const currentAuth = _optionalChain([auth, 'optionalAccess', _238 => _238.currentUser]);
    if (!currentAuth || !navigator.onLine) return { success: false, pending: true };
    const token = await currentAuth.getIdToken();
    const response = await fetch('/api/send-push', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(request) });
    const payload = await response.json().catch(() => null);
    if (response.ok && _optionalChain([payload, 'optionalAccess', _239 => _239.success]) || _optionalChain([payload, 'optionalAccess', _240 => _240.skipped]) && _optionalChain([payload, 'optionalAccess', _241 => _241.reason]) === 'no-token' || response.status === 410) {
      const outbox = readPushOutbox(); delete outbox[request.logId]; localStorage.setItem(pushOutboxKey, JSON.stringify(outbox));
      return payload || { success: false, skipped: true, reason: 'deleted-user' };
    }
    return { success: false, pending: true, error: _optionalChain([payload, 'optionalAccess', _242 => _242.message]) || `Push HTTP ${response.status}` };
  };
  const flushPushOutbox = async () => {
    if (!db || !fbUser || !navigator.onLine || Date.now() < quotaBackoffUntilRef.current) return;
    for (const request of Object.values(readPushOutbox())) {
      if (readAppendOutbox()[`sgmAudit/${request.logId}`]) continue;
      try { await performPushRequest(request); } catch (error) { console.warn('Push bekliyor:', error.message); }
    }
  };
  const sendServerPush = async ({ userId, title, body, type = 'GENEL', deskId = null, logId = null }) => {
    if (!userId) return { success: false, skipped: true, reason: 'no-user' };
    if (['localhost','127.0.0.1'].includes(window.location.hostname)) return { success: true, skipped: true, reason: 'localhost' };
    const request = { userId, type, deskId, logId: logId || `test-${Date.now()}` };
    const outbox = readPushOutbox(); outbox[request.logId] = request;
    localStorage.setItem(pushOutboxKey, JSON.stringify(outbox));
    try {
      await appendChainRef.current;
      if (readAppendOutbox()[`sgmAudit/${request.logId}`]) return { success: false, pending: true, error: 'Olay kaydı sunucuya gönderilmeyi bekliyor.' };
      return await performPushRequest(request);
    } catch (error) { return { success: false, pending: true, error: error.message }; }
  };

  const retryMyPhonePushRegistration = async () => {
    const appleInstallMessage = currentApplePushInstallGuidance();
    if (appleInstallMessage) {
      showMessage('iPhone Bildirim Kurulumu', appleInstallMessage, 'warning');
      return;
    }
    if (!_optionalChain([currentUser, 'optionalAccess', _243 => _243.id])) {
      showMessage(
        'Öğrenci Girişi Gerekli',
        'Telefon push kaydını yenilemek için önce öğrenci hesabıyla giriş yapın.',
        'warning'
      );
      return;
    }

    pushRegistrationRef.current = {
      userId: null,
      token: null,
      working: false
    };

    updateUserPushDebug(currentUser.id, {
      pushLastStage: 'manuel_yeniden_kayit',
      pushLastError: '',
      pushLastErrorCode: '',
      pushLastAttemptAt: Date.now()
    });

    const token = await registerPhonePush(currentUser.id, true);

    if (token) {
      showMessage(
        'Telefon Bildirimi Aktif',
        'FCM token başarıyla oluşturuldu ve hesabınıza kaydedildi.',
        'success'
      );
    } else {
      // React state güncellemesi asenkron olabileceği için kısa bir gecikmeden sonra
      // en güncel kullanıcı kaydındaki hata bilgisini göster.
      setTimeout(() => {
        const latestUser = (usersRef.current || []).find(
          u => u.id === currentUser.id
        );

        showMessage(
          'Push Kaydı Başarısız',
          _optionalChain([latestUser, 'optionalAccess', _244 => _244.pushLastError]) ||
            'FCM token oluşturulamadı. Yönetici panelindeki Push Durumu ekranından aşama ve hata bilgisini kontrol edin.',
          'danger'
        );
      }, 300);
    }
  };

  const sendNotification = async (title, body) => {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Mobil cihazlarda bildirim izni yoksa ya da desteklenmiyorsa sessizce çık.
    if (isMobile && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(title, {
          body,
          icon: '/favicon.ico'
        });
        return;
      }
    }

    // Masaüstü tarayıcılar için normal bildirim
    if (!isMobile) {
      new Notification(title, {
        body,
        icon: '/favicon.ico'
      });
    }
  } catch (error) {
    console.warn('Bildirim gönderilemedi:', error);
  }
};


  // Kapanışa TAM 1 saat / 30 dk / 15 dk kala aktif masa kullanıcılarına bildirim gönderir.
  // Her uyarı kapanıştan önceki ilgili 1 dakikalık pencere içinde yalnızca bir kez gösterilir.
  // Örn. kapanış 22:00 ise uyarılar 21:00, 21:30 ve 21:45'te tetiklenir.
  useEffect(() => {
    if (!currentUser || !currentUser.activeDeskId || !settings.closeTime) return;

    const d = new Date(now);
    const [closeH, closeM] = String(settings.closeTime || '22:00').split(':').map(Number);
    const closeAt = new Date(d);
    closeAt.setHours(closeH, closeM, 0, 0);
    const remainingMs = closeAt.getTime() - d.getTime();
    if (remainingMs <= 0) return;

    const remainingSeconds = Math.floor(remainingMs / 1000);
    const thresholds = [
      { key: '60', seconds: 60 * 60, label: '1 saat' },
      { key: '30', seconds: 30 * 60, label: '30 dakika' },
      { key: '15', seconds: 15 * 60, label: '15 dakika' }
    ];

    // Sadece ilgili dakikanın içinde çalışır. Böylece örneğin 21:10'da "1 saat kaldı" uyarısı verilmez.
    const threshold = thresholds.find(t => remainingSeconds <= t.seconds && remainingSeconds > t.seconds - 60);
    if (!threshold) return;

    const dayKey = getLocalDayKey(d);
    // Kapanış saati aynı gün değiştirilirse yeni saate ait uyarılar eski bildirim kayıtlarına takılmasın.
    // Örn. 22:00 için 1 saat uyarısı verilmiş olsa bile kapanış 23:00 yapılırsa 22:00'de yeni 1 saat uyarısı gönderilebilir.
    const closeTimeKey = String(settings.closeTime || '22:00').replace(':', '');
    const noticeKey = `${currentUser.id}-${dayKey}-${closeTimeKey}-${threshold.key}`;
    const storageKey = `sgm_closing_notice_${noticeKey}`;
    if (closingNotificationSeenRef.current.has(noticeKey) || localStorage.getItem(storageKey) === '1') return;

    closingNotificationSeenRef.current.add(noticeKey);
    try { localStorage.setItem(storageKey, '1'); } catch (e) {}

    const body = threshold.key === '60'
      ? `Kütüphane 1 saat sonra kapanacaktır, bilginize. Kapanış saati: ${settings.closeTime}. Kapanışta tüm masalar otomatik olarak boşaltılacaktır.`
      : threshold.key === '30'
        ? `Kütüphanenin kapanmasına 30 dakika kaldı, bilginize. Kapanış saati: ${settings.closeTime}. Kapanışta tüm masalar otomatik olarak boşaltılacaktır.`
        : `Kütüphanenin kapanmasına 15 dakika kaldı, bilginize. Kapanış saati: ${settings.closeTime}. Kapanışta tüm masalar otomatik olarak boşaltılacaktır.`;
    sendNotification('Kütüphane Kapanış Uyarısı', body);
    showMessage(
      'Kütüphane Kapanış Uyarısı',
      React.createElement('div', { className: "space-y-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 3441}}
        , React.createElement('div', { className: "p-4 bg-amber-50 border border-amber-200 rounded-xl"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 3442}}
          , React.createElement('p', { className: "font-black text-amber-800" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 3443}}, "Kütüphane " , threshold.label, " sonra kapanacaktır."  )
          , React.createElement('p', { className: "text-sm text-amber-700 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 3444}}, "Kapanış saati: "  , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 3444}}, settings.closeTime))
        )
        , React.createElement('p', { className: "text-sm text-slate-600" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 3446}}, "Saat " , settings.closeTime, " olduğunda tüm aktif kullanıcı ve bekleyen masa rezervasyonları otomatik sonlandırılacaktır."          )
      ),
      'warning'
    );
    addLog('KAPANIS_BILDIRIMI', body, currentUser.activeDeskId, currentUser.id);
  }, [now, _optionalChain([currentUser, 'optionalAccess', _245 => _245.id]), _optionalChain([currentUser, 'optionalAccess', _246 => _246.activeDeskId]), settings.closeTime]);

  const getAuditCollection = () => collection(db, 'artifacts', appId, 'public', 'data', 'sgmAudit');
  const readAppendOutbox = () => {
    if (!appendOutboxRef.current) {
      try { appendOutboxRef.current = JSON.parse(localStorage.getItem('sgm_append_outbox') || '{}'); } catch (e19) { appendOutboxRef.current = {}; }
      // Preserve pending events created by the previous release, without replaying its whole log history.
      try {
        const legacy = JSON.parse(localStorage.getItem('sgm_audit_outbox') || '{}');
        Object.values(legacy).forEach(record => {
          const key = `sgmAudit/${record.id}`;
          if (!appendOutboxRef.current[key]) appendOutboxRef.current[key] = { bucket: 'sgmAudit', documentId: record.id, record };
        });
        localStorage.setItem('sgm_append_outbox', JSON.stringify(appendOutboxRef.current));
        localStorage.removeItem('sgm_audit_outbox');
      } catch (e20) {}
    }
    return appendOutboxRef.current;
  };
  const saveAppendOutbox = () => {
    try { localStorage.setItem('sgm_append_outbox', JSON.stringify(readAppendOutbox())); } catch (error) { console.warn('Bekleyen kayıtlar saklanamadı:', error); }
  };
  const isStudentAuditType = type => [
    'SISTEM_GIRIS', 'PIL_AYARI_BILGILENDIRME', 'OGRENCI_', 'ÖĞRENCİ_', 'İHBAR', 'IHBAR', 'GERIBILDIRIM_ACILDI',
    'MASA_', 'MOLA_', 'BILDIRIM_IPTAL', 'KISITLI_ISLEM_ENGELLENDI',
    'MASA_BEKLEME_ENGELLENDI', 'AYNI_', 'UYGULAMA_'
  ].some(prefix => String(type || '').startsWith(prefix)) && !String(type || '').includes('ADMIN');
  const bucketDeletionKey = bucket => ({ sgmAudit: 'logs', sgmLogs: 'logs', sgmViolations: 'violations', sgmFeedback: 'feedback' })[bucket];
  const persistAppendItem = async item => {
    if (!db || !fbUser || !navigator.onLine || Date.now() < quotaBackoffUntilRef.current) throw new Error('Kayıt cihazda bekliyor; bağlantı/kota düzeldiğinde gönderilecek.');
    if (!adminAuthorized) {
      if (item.delete) throw new Error('Öğrenci oturumu geçmiş kayıtları silemez.');
      if (item.bucket === 'sgmFeedback') {
        await runStudentActivity('feedback', { id: item.record.id, type: item.record.type, message: item.record.message });
      } else if (item.bucket === 'sgmAudit') {
        await runStudentActivity('audit-event', { record: item.record });
      } else {
        throw new Error('Bu kayıt türü yalnızca yönetici tarafından yazılabilir.');
      }
      const key = `${item.bucket}/${item.documentId}`;
      if (stableJson(readAppendOutbox()[key]) === stableJson(item)) delete readAppendOutbox()[key];
      saveAppendOutbox();
      return;
    }
    const deletionBucket = bucketDeletionKey(item.bucket);
    await runTransaction(db, async tx => {
      const target = getLiveDoc(item.bucket, item.documentId);
      const reads = [tx.get(target)];
      if (deletionBucket) reads.push(tx.get(getLiveDoc('sgmDeletedRecords', `${deletionBucket}-${item.record.id}`)));
      const [snap, marker] = await Promise.all(reads);
      if (item.delete) {
        if (deletionBucket && !_optionalChain([marker, 'optionalAccess', _247 => _247.exists, 'call', _248 => _248()])) tx.set(getLiveDoc('sgmDeletedRecords', `${deletionBucket}-${item.record.id}`), { id: item.record.id, deletedAt: Date.now() });
        if (snap.exists()) tx.delete(target);
        return;
      }
      if (_optionalChain([marker, 'optionalAccess', _249 => _249.exists, 'call', _250 => _250()]) || deletionBucket && isRecordDeleted(deletionBucket, item.record.id)) return;
      if (!snap.exists() || item.replace && Number(snap.data().time || 0) < Number(item.record.time || 0)) tx.set(target, item.record);
    });
    // A newer message may have replaced this pending item during the request.
    const key = `${item.bucket}/${item.documentId}`;
    if (stableJson(readAppendOutbox()[key]) === stableJson(item)) delete readAppendOutbox()[key];
    saveAppendOutbox();
  };
  const flushAuditOutbox = async () => {
    if (!db || !fbUser || !navigator.onLine || Date.now() < quotaBackoffUntilRef.current) return;
    for (const item of Object.values(readAppendOutbox())) {
      const bucket = bucketDeletionKey(item.bucket);
      if (!adminAuthorized && (item.bucket === 'sgmFeedback'
        ? !['complaint', 'suggestion'].includes(_optionalChain([item, 'access', _251 => _251.record, 'optionalAccess', _252 => _252.type]))
        : item.bucket !== 'sgmAudit' || !isStudentAuditType(_optionalChain([item, 'access', _253 => _253.record, 'optionalAccess', _254 => _254.type])))) {
        console.warn('Yönetici yetkisi gerektiren bekleyen kayıt öğrenci oturumundan gönderilmedi:', item.bucket, _optionalChain([item, 'access', _255 => _255.record, 'optionalAccess', _256 => _256.id]));
        delete readAppendOutbox()[`${item.bucket}/${item.documentId}`];
        saveAppendOutbox();
        continue;
      }
      if (!item.delete && bucket && isRecordDeleted(bucket, item.record.id)) {
        delete readAppendOutbox()[`${item.bucket}/${item.documentId}`]; saveAppendOutbox(); continue;
      }
      try { await persistAppendItem(item); } catch (error) { handleFirestoreQuotaError(error); break; }
    }
    if (pendingUserDeletesRef.current.size && adminAuthorized) {
      for (const id of Array.from(pendingUserDeletesRef.current)) {
        try {
          const result = await runAdminMaintenance('delete_user', { userId: id });
          applyCloudRows(result);
          granularBaselineRef.current.users.delete(id);
          pendingUserDeletesRef.current.delete(id);
          localStorage.setItem('sgm_pending_user_deletes', JSON.stringify(Array.from(pendingUserDeletesRef.current)));
        } catch (error) { handleFirestoreQuotaError(error); break; }
      }
    }
  };
  const queueAppend = (bucket, record, options = {}) => {
    const documentId = options.documentId || record.id;
    const item = { bucket, documentId, record, replace: options.replace === true, delete: options.delete === true };
    readAppendOutbox()[`${bucket}/${documentId}`] = item;
    saveAppendOutbox();
    appendChainRef.current = appendChainRef.current.catch(() => {}).then(async () => {
      try { await persistAppendItem(item); } catch (error) { handleFirestoreQuotaError(error); }
    });
    return appendChainRef.current;
  };
  const archiveLog = record => queueAppend('sgmAudit', record);

  const deleteArchivedLogIds = ids => {
    ids.forEach(id => {
      queueAppend('sgmAudit', { id }, { delete: true });
      queueAppend('sgmLogs', { id }, { delete: true });
    });
  };
  const deleteHistoryRecords = (bucket, ids) => {
    const collection = { violations: 'sgmViolations', feedback: 'sgmFeedback' }[bucket];
    if (collection) ids.forEach(id => queueAppend(collection, { id }, { delete: true }));
  };

  const loadArchivedLogs = async () => {
    if (archiveLoading) return;
    setArchiveLoading(true);
    try {
      if (db && fbUser) {
        const pages = await Promise.all(['sgmAudit','sgmLogs'].map(async bucket => {
          const constraints = [orderBy('time', 'desc'), limit(500)];
          if (archiveCursorRef.current[bucket]) constraints.push(startAfter(archiveCursorRef.current[bucket]));
          const result = await getDocs(query(getLiveCollection(bucket), ...constraints));
          if (result.docs.length) archiveCursorRef.current[bucket] = result.docs[result.docs.length - 1];
          return result.docs.map(doc => doc.data());
        }));
        const records = [...new Map(pages.flat().filter(log => !isRecordDeleted('logs', log.id)).map(log => [log.id,log])).values()];
        setArchivedLogs(prev => [...new Map([...prev, ...records].map(l => [l.id, l])).values()]);
        addLog('LOG_ARSIV_GORUNTULE', `${records.length} arşiv kaydı getirildi.`);
      } else {
        setArchivedLogs(Object.values(readAppendOutbox()).filter(item => item.bucket === 'sgmAudit' && !item.delete && !isRecordDeleted('logs', item.record.id)).map(item => item.record));
        addLog('LOG_ARSIV_GORUNTULE', 'Yerel işlem arşivi görüntülendi.');
      }
    } catch (error) { showMessage('Arşiv Alınamadı', 'Kayıt arşivine erişilemedi. Bağlantınızı ve Firestore erişim izinlerini kontrol edin.', 'warning'); }
    finally { setArchiveLoading(false); }
  };
  useEffect(() => {
    if (!isDataLoaded) return;
    const flush = () => { appendChainRef.current = appendChainRef.current.catch(() => {}).then(flushAuditOutbox).then(flushPushOutbox).catch(() => {}); };
    // Yalnızca kuyrukta bekleyen YENİ kayıtları gönder. Eski logları her cihaz açılışında tekrar arşivleme.
    flush(); window.addEventListener('online', flush);
    const timer = setInterval(flush, 15000);
    return () => { clearInterval(timer); window.removeEventListener('online', flush); };
  }, [isDataLoaded, fbUser, adminAuthorized, syncRetryEpoch]);

  // Sadece gerçek işlemler kaydedilir; gezinme, oturum yenileme ve arayüz olayları arşivi doldurmaz.
  const quietAuditEvents = new Set([
    'SISTEM_GIRIS', 'OGRENCI_OTURUM_ACILDI', 'PIL_AYARI_BILGILENDIRME',
    'EKRAN_ACIK_TUTMA', 'EKRAN_ACIK_TUTMA_RED', 'LOG_ARSIV_GORUNTULE',
    'GERIBILDIRIM_ACILDI', 'KAYIT_BILGILERI_GOSTERILDI', 'KAYIT_BILGI_KOPYALA',
    'KAYIT_GIRIS_HAZIRLANDI', 'KAYIT_FORM_YONLENDIRME', 'KAYIT_FORM_YONLENDIRME_HATA',
    'KAYIT_DISA_AKTARILDI', 'SİSTEM_YEDEK'
  ]);
  const addLog = (type, message, deskId = null, userId = null, _legacyFlag = false, forcedLocation = null, extraData = null) => {
    if (quietAuditEvents.has(type)) return;

    const safeUsers = Array.isArray(usersRef.current) ? usersRef.current : [];
    const u = safeUsers.find(x => x.id === userId);
    const userInfo = u ? `${u.name} (GM: ${u.specialCode})` : (currentUser ? `${currentUser.name} (GM: ${currentUser.specialCode})` : view === 'admin_dash' ? 'Yönetici' : 'Sistem / Anonim');
    const devInfo = (u && u.deviceId) ? u.deviceId : deviceId;

    const newLog = {
      id: _optionalChain([extraData, 'optionalAccess', _257 => _257.eventId]) || (['SİSTEM_OTOMATİK','GUNLUK_MOLA_HAKLARI_YENILENDI','GUNLUK_IHLALLER_SIFIRLANDI','IHLAL_DINAMIK_GUVENLIK_KONTROL_LOGU'].includes(type) ? `${type}-${getLocalDayKey()}-${settings.closeTime || ''}` : generateId()),
      time: Date.now(),
      type,
      message,
      deskId,
      userId,
      userInfo,
      actorFirebaseUid: _optionalChain([auth, 'optionalAccess', _258 => _258.currentUser, 'optionalAccess', _259 => _259.uid]) || null,
      actorId: view === 'admin_dash' ? 'ADMIN' : _optionalChain([currentUser, 'optionalAccess', _260 => _260.id]) || 'SYSTEM',
      actorInfo: view === 'admin_dash' ? 'Yönetici' : _optionalChain([currentUser, 'optionalAccess', _261 => _261.specialCode]) || 'Sistem / Anonim',
      deviceInfo: devInfo,
      locationInfo: forcedLocation || userLocation,
      ...(extraData && typeof extraData === 'object' ? Object.fromEntries(Object.entries(extraData).filter(([,value]) => value !== undefined)) : {})
    };

    // Ref'i anında güncelle: mesaj Firestore snapshot'ı tarafından ezilmesin.
    const currentLogs = Array.isArray(logsRef.current) ? logsRef.current : [];
    const nextLogs = [newLog, ...currentLogs.filter(log => _optionalChain([log, 'optionalAccess', _262 => _262.id]) !== newLog.id)]
      .sort((a, b) => Number(_optionalChain([b, 'optionalAccess', _263 => _263.time]) || 0) - Number(_optionalChain([a, 'optionalAccess', _264 => _264.time]) || 0))
      .slice(0, 500);

    logsRef.current = nextLogs;
    setLogs(nextLogs);
    try { localStorage.setItem('sgm_logs', JSON.stringify(nextLogs)); } catch (e21) {}
    const studentEvent = isStudentAuditType(type);
    if (adminAuthorized || studentEvent) archiveLog(newLog);
    if (type === 'ADMIN_MASA_MESAJI' && userId) queueAppend('sgmMessages', newLog, { documentId: userId, replace: true });
    // One canonical event document. Students never listen to the global archive.

    if (adminAuthorized && String(type || '').startsWith('IHLAL')) {
      const violationRecord = {
        id: `VIOL-${newLog.id}`,
        sourceLogId: newLog.id,
        time: newLog.time,
        type: newLog.type,
        message: newLog.message,
        deskId: newLog.deskId || null,
        userId: newLog.userId || null,
        userInfo: newLog.userInfo,
        deviceInfo: newLog.deviceInfo,
        locationInfo: newLog.locationInfo
      };
      const currentViolations = Array.isArray(violationRecordsRef.current) ? violationRecordsRef.current : [];
      const nextViolations = [violationRecord, ...currentViolations.filter(r => _optionalChain([r, 'optionalAccess', _265 => _265.id]) !== violationRecord.id)]
        .sort((a, b) => Number(_optionalChain([b, 'optionalAccess', _266 => _266.time]) || 0) - Number(_optionalChain([a, 'optionalAccess', _267 => _267.time]) || 0))
        .slice(0, 5000);
      violationRecordsRef.current = nextViolations;
      setViolationRecords(nextViolations);
      queueAppend('sgmViolations', violationRecord);
    }

    return newLog;
  };

  const appOpenLoggedRef = useRef(false);
  const restoredLoginLoggedRef = useRef(false);
  useEffect(() => {
    if (!isDataLoaded || !granularLoadedRef.current.settings && db) return;
    if (!appOpenLoggedRef.current) {
      appOpenLoggedRef.current = true;
      addLog('SISTEM_GIRIS', 'Uygulama açıldı; sistem verileri yüklendi.', null, _optionalChain([currentUser, 'optionalAccess', _268 => _268.id]) || null);
    }
    if (currentUser && !restoredLoginLoggedRef.current) {
      restoredLoginLoggedRef.current = true;
      const desk = desksRef.current.find(d => d.occupant === currentUser.id || d.guestOccupant === currentUser.id);
      addLog('OGRENCI_OTURUM_ACILDI', 'Öğrenci oturumu açıldı / yeniden yüklendi.', _optionalChain([desk, 'optionalAccess', _269 => _269.id]) || null, currentUser.id, false, null, {
        deskStatus: _optionalChain([desk, 'optionalAccess', _270 => _270.status]) || 'masasiz',
        onBreak: _optionalChain([desk, 'optionalAccess', _271 => _271.occupant]) === currentUser.id ? desk.status === 'on_break' : Number(_optionalChain([desk, 'optionalAccess', _272 => _272.guestBreakEndTime]) || 0) > Date.now()
      });
    }
    if (!currentUser) restoredLoginLoggedRef.current = false;
  }, [isDataLoaded, _optionalChain([currentUser, 'optionalAccess', _273 => _273.id]), fbUser, settings, desks]);

  // Son kapanıştan önce başlamış oturumları açılışta yakala. İşlem sunucudaki
  // güncel masa ve kullanıcıları tekrar okuyarak yeni günün masalarını korur.
  // Sunucu cron'u yerine geçmez: çevrimiçi temizlik için yönetici oturumu gerekir.
  const closingRecoveryBusyRef = useRef(false);
  const recoverPreviousClosing = async () => {
    if (!isDataLoaded || (db && (!adminAuthorized || !fbUser || !navigator.onLine)) || closingRecoveryBusyRef.current) return;
    if (db && (!granularLoadedRef.current.desks || !granularLoadedRef.current.users || !granularLoadedRef.current.settings)) return;
    const cutoff = getLastClosingAt(settingsRef.current.closeTime);
    if (!cutoff) return;
    const candidates = desksRef.current.filter(d => hasSessionBeforeClosing(d, cutoff));
    if (!candidates.length) return;
    closingRecoveryBusyRef.current = true;
    try {
      for (const candidate of candidates) {
        const clean = async (tx) => {
          const deskRef = db ? getLiveDoc('sgmDesks', candidate.id) : null;
          const snap = tx ? await tx.get(deskRef) : null;
          const desk = tx ? (snap.exists() ? { ...snap.data(), id: candidate.id } : null) : desksRef.current.find(d => d.id === candidate.id);
          if (!desk || !hasSessionBeforeClosing(desk, cutoff)) return null;
          const ids = [...new Set([desk.occupant, desk.guestOccupant, desk.pendingOccupant].filter(Boolean))];
          const related = [];
          for (const id of ids) {
            const userRef = db ? getLiveDoc('sgmUsers', id) : null;
            const userSnap = tx ? await tx.get(userRef) : null;
            const user = tx ? (userSnap.exists() ? { ...userSnap.data(), id } : null) : usersRef.current.find(u => u.id === id);
            if (user) related.push({ userRef, user });
          }
          const clearedDesk = clearClosedDesk(desk);
          const clearedUsers = related.map(({user}) => ({ ...user,
            ...(Number(user.activeDeskId) === Number(desk.id) ? {activeDeskId: null, activeDeskRole: null} : {}),
            ...(Number(user.pendingDeskId) === Number(desk.id) ? {pendingDeskId: null, pendingDeskDeadline: null} : {})
          }));
          const event = {
            id: `close-recovery-${cutoff}-${desk.id}`, time: Date.now(), type: 'KAPANIS_MASA_OTOMATIK_BOSALTILDI',
            message: `Önceki kapanıştan kalan Masa ${desk.id} oturumu boşaltıldı.`, deskId: desk.id,
            userId: desk.occupant || desk.pendingOccupant || desk.guestOccupant || null,
            actorId: 'ADMIN', actorFirebaseUid: _optionalChain([auth, 'optionalAccess', _274 => _274.currentUser, 'optionalAccess', _275 => _275.uid]) || null, actorInfo: 'Yönetici',
            previousStatus: desk.status, closingAt: cutoff, previousSessionStartTime: desk.sessionStartTime || null
          };
          if (tx) {
            tx.set(deskRef, clearedDesk);
            related.forEach(({userRef}, i) => tx.set(userRef, clearedUsers[i], { merge: true }));
            tx.set(getLiveDoc('sgmAudit', event.id), event);
          }
          return {desk: clearedDesk, users: clearedUsers, event};
        };
        const result = db ? await runTransaction(db, clean) : await clean(null);
        if (!result) continue;
        applyCloudRows({desk: result.desk});
        result.users.forEach(user => applyCloudRows({user}));
        // Sunucu işlemi logu da atomik yazdı; arşive ikinci kez gönderme.
        const nextLogs = [result.event, ...logsRef.current.filter(l => l.id !== result.event.id)].slice(0, 500);
        logsRef.current = nextLogs; setLogs(nextLogs);
        localStorage.setItem('sgm_desks', JSON.stringify(desksRef.current));
        localStorage.setItem('sgm_users', JSON.stringify(usersRef.current));
        localStorage.setItem('sgm_logs', JSON.stringify(nextLogs));
        if (!db) archiveLog(result.event);
      }
    } catch (error) { handleFirestoreQuotaError(error); }
    finally { closingRecoveryBusyRef.current = false; }
  };
  useEffect(() => {
    const recover = () => { recoverPreviousClosing(); };
    recover();
    const timer = setInterval(recover, 15000);
    const resume = () => { if (!document.hidden) recover(); };
    window.addEventListener('online', recover);
    document.addEventListener('visibilitychange', resume);
    return () => { clearInterval(timer); window.removeEventListener('online', recover); document.removeEventListener('visibilitychange', resume); };
  }, [isDataLoaded, adminAuthorized, fbUser, settings.closeTime, desks]);

  const runFullDayCleanup = ({ source = 'manual', cleanupTime = Date.now(), dayKey = getLocalDayKey(), dayLabel = new Date().toDateString(), writeAutoCloseMarker = false } = {}) => {
    const beforeDesks = Array.isArray(desksRef.current) ? desksRef.current : [];
    const beforeUsers = Array.isArray(usersRef.current) ? usersRef.current : [];

    const activeDesks = beforeDesks.filter(desk =>
      _optionalChain([desk, 'optionalAccess', _276 => _276.occupant]) ||
      _optionalChain([desk, 'optionalAccess', _277 => _277.guestOccupant]) ||
      _optionalChain([desk, 'optionalAccess', _278 => _278.pendingOccupant]) ||
      ['occupied', 'on_break', 'reported'].includes(_optionalChain([desk, 'optionalAccess', _279 => _279.status]))
    );

    const usersWithDailyViolations = beforeUsers.filter(
      u => Number.isFinite(Number(_optionalChain([u, 'optionalAccess', _280 => _280.strikes]))) && Number(u.strikes) > 0
    );

    // Temizlikten ÖNCE gerekli gün sonu yedeğini localStorage'a al.
    // Son 30 yedek tutulur; kalıcı violationRecords geçmişine dokunulmaz.
    try {
      const oldBackups = JSON.parse(localStorage.getItem('sgm_day_end_backups') || '[]');
      const backup = {
        id: `BACKUP-${cleanupTime}-${generateId()}`,
        createdAt: cleanupTime,
        dayKey,
        source,
        desks: beforeDesks,
        users: beforeUsers,
        logs: Array.isArray(logsRef.current) ? logsRef.current : [],
        violationRecords: Array.isArray(violationRecordsRef.current) ? violationRecordsRef.current : [],
        feedbackRecords: Array.isArray(feedbackRecordsRef.current) ? feedbackRecordsRef.current : []
      };
      const nextBackups = [backup, ...(Array.isArray(oldBackups) ? oldBackups : [])].slice(0, 30);
      localStorage.setItem('sgm_day_end_backups', JSON.stringify(nextBackups));
      localStorage.setItem('sgm_last_day_end_backup_at', String(cleanupTime));
    } catch (e) {
      console.warn('Gün sonu yedeği localStorage yazılamadı:', e);
    }

    // Günlük ihlaller sıfırlanmadan önce kalıcı ihlal arşivine özet kaydı düş.
    usersWithDailyViolations.forEach(u => {
      const strikeCount = Number(u.strikes) || 0;
      addLog(
        String(source).startsWith('auto_') ? 'IHLAL_GUN_SONU_ARSIV' : 'IHLAL_MANUEL_GUN_SONU_ARSIV',
        `${_optionalChain([u, 'optionalAccess', _281 => _281.name]) || 'Öğrenci'} için ${String(source).startsWith('auto_') ? '22:00 kapanışında' : 'manuel gün sonu temizliğinde'} ${strikeCount} günlük ihlal arşivlendi; sayaç sıfırlanmadan önce kalıcı kayda işlendi.`,
        _optionalChain([u, 'optionalAccess', _282 => _282.activeDeskId]) || null,
        _optionalChain([u, 'optionalAccess', _283 => _283.id]) || null,
        false,
        null,
        {
          dailyStrikeCount: strikeCount,
          archiveReason: String(source).startsWith('auto_') ? '22:00_kapanis' : 'manuel_gun_sonu',
          archivedAt: cleanupTime,
          eventId: String(source).startsWith('auto_') ? `close-violations-${dayKey}-${settings.closeTime}-${u.id}` : undefined
        }
      );
    });

    // Boşaltılacak masaları tek tek logla.
    activeDesks.forEach(desk => {
      addLog(
        String(source).startsWith('auto_') ? 'KAPANIS_MASA_OTOMATIK_BOSALTILDI' : 'MANUEL_GUN_SONU_MASA_BOSALTILDI',
        `${String(source).startsWith('auto_') ? `Saat ${settings.closeTime || '22:00'} kapanışında` : 'Yönetici manuel gün sonu temizliğinde'} Masa ${desk.id} boşaltıldı.`,
        desk.id,
        desk.occupant || desk.guestOccupant || desk.pendingOccupant || null,
        false,
        null,
        {
          previousStatus: desk.status || null,
          hadOwner: !!desk.occupant,
          hadGuest: !!desk.guestOccupant,
          hadPendingReservation: !!desk.pendingOccupant,
          cleanedAt: cleanupTime,
          eventId: String(source).startsWith('auto_') ? `close-desk-${dayKey}-${settings.closeTime}-${desk.id}` : undefined
        }
      );
    });

    const resetDesks = beforeDesks.map(d => ({
      ...d,
      status: d.status === 'disabled' ? 'disabled' : 'available',
      occupant: null,
      ownerDeviceId: null,
      guestOccupant: null,
      guestSessionStartTime: null,
      guestBreakEndTime: null,
      guestReported: false,
      guestReportEndTime: null,
      guestReportIssuedAt: null,
      guestReportVerifiedAt: null,
      pendingOccupant: null,
      pendingDeskRole: null,
      pendingDeskDeadline: null,
      breakEndTime: null,
      reportEndTime: null,
      reportIssuedAt: null,
      reportVerifiedAt: null,
      sessionStartTime: null
    }));

    const resetUsers = beforeUsers.map(u => ({
      ...u,
      activeDeskId: null,
      activeDeskRole: null,
      pendingDeskId: null,
      pendingDeskDeadline: null,
      strikes: 0,
      violationsResetDate: dayKey,
      lastActiveTime: cleanupTime
    }));

    // KRİTİK: Ref + state + localStorage aynı turda güncellenir.
    // Önceki sürümde sadece setState yapıldığı için gecikmiş Firestore snapshot'ı
    // 22:00 temizliğini geri alabiliyordu; bu da masaların daha geç boş görünmesine yol açıyordu.
    dayEndCleanupGuardRef.current = {
      cleanedAt: cleanupTime,
      dayKey,
      source,
      expiresAt: cleanupTime + 120000
    };
    confirmedDeskGuardRef.current = null;
    releasedDeskGuardRef.current = null;
    pendingReservationGuardRef.current = null;

    desksRef.current = resetDesks;
    usersRef.current = resetUsers;
    criticalDeskMutationRef.current = true;

    setDesks(resetDesks);
    setUsers(resetUsers);

    try {
      localStorage.setItem('sgm_desks', JSON.stringify(resetDesks));
      localStorage.setItem('sgm_users', JSON.stringify(resetUsers));
      if (writeAutoCloseMarker) localStorage.setItem('sgm_last_close', dayLabel);
    } catch (e) {
      console.warn('Gün sonu temizliği localStorage yazma uyarısı:', e);
    }

    // Closing clears desks and reservations, not the student's account session.
    setSelectedDeskId(null); setDeskSelectionDeadline(null);
    setScannerConfig({ isOpen: false, mode: null, title: '' });

    addLog(
      String(source).startsWith('auto_') ? 'SISTEM_2200_KAPANIS_OZETI' : 'SISTEM_MANUEL_GUN_SONU_OZETI',
      String(source).startsWith('auto_')
        ? `22:00 kapanış kontrolü tamamlandı. ${activeDesks.length} aktif/rezerve masa ANINDA boşaltıldı, ${usersWithDailyViolations.length} kullanıcının günlük ihlali arşivlenip sıfırlandı ve gün sonu yedeği alındı.`
        : `Manuel gün sonu temizliği tamamlandı. ${activeDesks.length} aktif/rezerve masa boşaltıldı, ${usersWithDailyViolations.length} kullanıcının günlük ihlali arşivlenip sıfırlandı ve gün sonu yedeği alındı.`,
      null,
      null,
      false,
      null,
      {
        activeDeskCount: activeDesks.length,
        violationUserCount: usersWithDailyViolations.length,
        checkedAt: cleanupTime,
        backupTaken: true,
        cleanupSource: source,
        eventId: String(source).startsWith('auto_') ? `close-summary-${dayKey}-${settings.closeTime}` : undefined
      }
    );

    // Firestore'a useEffect'i beklemeden yalnızca değişen masa ve kullanıcı belgelerini gönder.
    // Böylece 22:00 temizliği anında yayınlanır ama dev allData belgesi tekrar yazılmaz.
    if (isDataLoaded && fbUser && db) {
      granularWriteChainRef.current = granularWriteChainRef.current
        .then(() => persistGranularStateNow({ desks: resetDesks, users: resetUsers }))
        .catch(error => handleFirestoreQuotaError(error));
    }

    return {
      activeDeskCount: activeDesks.length,
      violationUserCount: usersWithDailyViolations.length
    };
  };

  const showMessage = (title, content, type = 'info', onClose = null) => {
    setModal({
      isOpen: true, title, content, type,
      onClose: () => { setModal(prev => ({ ...prev, isOpen: false })); if (onClose) onClose(); }
    });
  };
  const closeMessage = () => setModal(prev => ({ ...prev, isOpen: false }));

  const settleCloudExpiry = async deskId => {
    if (expiredDeskJobsRef.current.has(deskId) || !fbUser || !navigator.onLine || Date.now() < quotaBackoffUntilRef.current || !checkLibraryOpen()) return;
    expiredDeskJobsRef.current.add(deskId);
    try {
      const result = adminAuthorized
        ? await runAdminMaintenance('expire', { deskId })
        : await runStudentDeskAction('expire', { deskId });
      if (!result) return;
      applyCloudRows(result);
      if (result.verified || result.mode === 'closing_grace') return;
      const userId = _optionalChain([result, 'access', _284 => _284.user, 'optionalAccess', _285 => _285.id]);
      if (result.mode === 'reservation') {
        addLog('MASA_REZERVASYON_SURE_DOLDU', `Masa ${deskId} için 5 dakikalık QR rezervasyonu sona erdi.`, deskId, userId, false, null, { eventId: result.eventId });
        if (_optionalChain([currentUser, 'optionalAccess', _286 => _286.id]) === userId && Number(selectedDeskId) === Number(deskId)) { setSelectedDeskId(null); setDeskSelectionDeadline(null); }
      } else {
        addLog('IHLAL', `Masa ${deskId} ${result.mode === 'break_timeout' ? 'mola süresi aşıldığı' : 'ihbar QR ile doğrulanmadığı'} için boşaltıldı. Toplam ihlal: ${_optionalChain([result, 'access', _287 => _287.user, 'optionalAccess', _288 => _288.strikes]) || 0}`, deskId, userId, false, null, { eventId: result.eventId });
        if (_optionalChain([currentUser, 'optionalAccess', _289 => _289.id]) === userId) {
          sendNotification('İhlal: Masanız Boşaltıldı', `Masa ${deskId} otomatik boşaltıldı.`);
          showMessage('Masanız Otomatik Boşaltıldı', 'İhlal nedeniyle masanız boşaltıldı. Bu masayı bugün tekrar alamazsınız. Son 7 günde ikinci ihlalde 7 günlük kısıtlama uygulanır.', 'danger');
        }
      }
    } catch (error) { handleFirestoreQuotaError(error); }
    finally { expiredDeskJobsRef.current.delete(deskId); }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (auth && !isDataLoaded) return; // EKLENDİ: Veritabanı bağlıysa veri yüklenene kadar boş lokal verinin sistemi ezmesini engelle
      
      const currentTime = Date.now();
      setNow(currentTime);

      const d = new Date();
      const currentHourMin = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const currentTimeMin = d.getHours() * 60 + d.getMinutes();
      const todayStr = d.toLocaleDateString('tr-TR');
      const todayKey = getLocalDayKey(d);
      const [closeH, closeM] = (settings.closeTime || '22:00').split(':').map(Number);
      const closeTimeMin = closeH * 60 + closeM;
      
      let needUserReset = false;
      let needDeskReset = false;
      // Kapanıştan 1 saat sonraki ikinci güvenlik kontrolü için ayrı bayrak.
      // Örn. 22:00 kapanış -> 23:00 kontrol, 23:00 kapanış -> 00:00 kontrol.
      let needSafetyReset2300 = false;

      // Gün değiştiği anda mola hakları yenilenir. Sistem gece kapalı kaldıysa ilk açılışta da yakalanır.
      const usersForDailyBreakCheck = Array.isArray(usersRef.current) ? usersRef.current : [];
      const hasUserWithOldBreakDay = usersForDailyBreakCheck.some(u => u.breaksResetDate !== todayKey);
      const hasUserWithOldViolationDay = usersForDailyBreakCheck.some(u => u.violationsResetDate !== todayKey);
      if (!db && (hasUserWithOldBreakDay || hasUserWithOldViolationDay)) {
         needUserReset = true;
         if (hasUserWithOldBreakDay) {
           addLog('GUNLUK_MOLA_HAKLARI_YENILENDI', `Yeni gün (${todayKey}) başladı. Tüm öğrencilerin kısa ve uzun mola hakları yeniden tanımlandı.`);
         }
         if (hasUserWithOldViolationDay) {
           addLog('GUNLUK_IHLALLER_SIFIRLANDI', `Yeni gün (${todayKey}) başladı. Günlük ihlal sayaçları sıfırlandı; geçmiş ihlal kayıtları korundu.`);
         }
      }

      if (!db && settings.openTime && currentHourMin === settings.openTime && localStorage.getItem('sgm_last_reset') !== todayStr) {
         needUserReset = true;
         try { localStorage.setItem('sgm_last_reset', todayStr); } catch(e){}
         addLog('SİSTEM_OTOMATİK', 'Yeni gün başlangıcı: Tüm mola ve ihlal hakları sıfırlandı.');
      }

      if (!db && settings.closeTime && !checkLibraryOpen() && currentTimeMin >= closeTimeMin && localStorage.getItem('sgm_last_close') !== todayStr) {
         // 22:00 kapanışında sadece bildirim/log değil, masa + kullanıcı + localStorage + Firestore
         // aynı işlem içinde temizlenir. İşaret, temizlik başlatıldıktan sonra yazılır.
         runFullDayCleanup({
           source: 'auto_close_time',
           cleanupTime: currentTime,
           dayKey: todayKey,
           dayLabel: todayStr,
           writeAutoCloseMarker: true
         });

         // Temizlik runFullDayCleanup içinde tamamlandığı için aşağıdaki ortak reset bloğunun
         // aynı turda ikinci kez çalışmasına gerek yok.
         needDeskReset = false;
      }

      // KAPANIŞTAN 1 SAAT SONRA İKİNCİ GÜVENLİK KONTROLÜ
      // Örn:
      // Kapanış 22:00 -> güvenlik kontrolü 23:00
      // Kapanış 23:00 -> güvenlik kontrolü 00:00
      // Kapanış 23:30 -> güvenlik kontrolü 00:30
      //
      // Gece yarısını aşan güvenlik kontrolü yalnızca yeni günün açılış saatine kadar çalışır.
      // Böylece örneğin 23:00 kapanış / 00:00 güvenlik kontrolünde uygulama sabah 10:00'da
      // açılırsa yeni günün aktif masaları yanlışlıkla temizlenmez.
      const safetyRawMin = closeTimeMin + 60;
      const safetyCheckMin = safetyRawMin % (24 * 60);
      const safetyWrapsToNextDay = safetyRawMin >= (24 * 60);
      const [openHForSafety, openMForSafety] = (settings.openTime || '07:00').split(':').map(Number);
      const openTimeMinForSafety = openHForSafety * 60 + openMForSafety;

      const safetyHour = Math.floor(safetyCheckMin / 60);
      const safetyMinute = safetyCheckMin % 60;
      const safetyTimeLabel = `${String(safetyHour).padStart(2, '0')}:${String(safetyMinute).padStart(2, '0')}`;
      const safetyTimeKey = safetyTimeLabel.replace(':', '');

      // Gece yarısı aşılmıyorsa güvenlik saatinden gün sonuna kadar;
      // aşılıyorsa güvenlik saatinden bir sonraki açılış saatine kadar güvenli pencere.
      const safetyWindowReached = safetyWrapsToNextDay
        ? (currentTimeMin >= safetyCheckMin && currentTimeMin < openTimeMinForSafety)
        : currentTimeMin >= safetyCheckMin;

      const safetyMarkerKey = `sgm_last_dynamic_safety_check_v3_${safetyTimeKey}`;

      if (
        !db && safetyWindowReached &&
        localStorage.getItem(safetyMarkerKey) !== todayStr
      ) {
         const desksAtSafety = Array.isArray(desksRef.current) ? desksRef.current : [];
         const usersAtSafety = Array.isArray(usersRef.current) ? usersRef.current : [];

         const activeDesksAtSafety = desksAtSafety.filter(desk =>
           _optionalChain([desk, 'optionalAccess', _290 => _290.occupant]) ||
           _optionalChain([desk, 'optionalAccess', _291 => _291.guestOccupant]) ||
           _optionalChain([desk, 'optionalAccess', _292 => _292.pendingOccupant]) ||
           ['occupied', 'on_break', 'reported'].includes(_optionalChain([desk, 'optionalAccess', _293 => _293.status]))
         );

         const usersWithViolationsAtSafety = usersAtSafety.filter(
           u => Number.isFinite(Number(_optionalChain([u, 'optionalAccess', _294 => _294.strikes]))) && Number(u.strikes) > 0
         );

         // Önce mevcut günlük ihlalleri kalıcı İhlal Kayıtları arşivine yaz.
         usersWithViolationsAtSafety.forEach(u => {
           const strikeCount = Number(u.strikes) || 0;
           addLog(
             'IHLAL_DINAMIK_GUVENLIK_ARSIV',
             `${_optionalChain([u, 'optionalAccess', _295 => _295.name]) || 'Öğrenci'} için ${safetyTimeLabel} ikinci güvenlik kontrolünde ${strikeCount} günlük ihlal bulundu. Günlük sayaç sıfırlanmadan önce kalıcı İhlal Kayıtları arşivine işlendi.`,
             _optionalChain([u, 'optionalAccess', _296 => _296.activeDeskId]) || null,
             _optionalChain([u, 'optionalAccess', _297 => _297.id]) || null,
             false,
             null,
             {
               dailyStrikeCount: strikeCount,
               archiveReason: 'dinamik_guvenlik_kontrolu',
               closeTime: settings.closeTime,
               safetyTime: safetyTimeLabel,
               archivedAt: currentTime
             }
           );
         });

         // Temizlenecek her aktif/rezerve masayı Sistem Kayıtları'na ayrı ayrı yaz.
         activeDesksAtSafety.forEach(desk => {
           addLog(
             'DINAMIK_GUVENLIK_MASA_OTOMATIK_BOSALTILDI',
             `${safetyTimeLabel} ikinci güvenlik kontrolünde Masa ${desk.id} hâlâ aktif/rezerve göründüğü için otomatik boşaltıldı.`,
             desk.id,
             desk.occupant || desk.guestOccupant || desk.pendingOccupant || null,
             false,
             null,
             {
               previousStatus: desk.status || null,
               hadOwner: !!desk.occupant,
               hadGuest: !!desk.guestOccupant,
               hadPendingReservation: !!desk.pendingOccupant,
               closeTime: settings.closeTime,
               safetyTime: safetyTimeLabel,
               checkedAt: currentTime
             }
           );
         });

         // Ref + state + localStorage aynı anda temizlenir.
         const resetDesksSafety = desksAtSafety.map(desk => ({
           ...desk,
           status: desk.status === 'disabled' ? 'disabled' : 'available',
           occupant: null,
           guestOccupant: null,
           guestSessionStartTime: null,
           guestBreakEndTime: null,
           guestReported: false,
           guestReportEndTime: null,
           guestReportIssuedAt: null,
           guestReportVerifiedAt: null,
           pendingOccupant: null,
           pendingDeskRole: null,
           pendingDeskDeadline: null,
           breakEndTime: null,
           reportEndTime: null,
           reportIssuedAt: null,
           reportVerifiedAt: null,
           sessionStartTime: null
         }));

         const resetUsersSafety = usersAtSafety.map(u => ({
           ...u,
           activeDeskId: null,
           activeDeskRole: null,
           pendingDeskId: null,
           pendingDeskDeadline: null,
           strikes: 0,
           violationsResetDate: todayKey,
           lastActiveTime: currentTime
         }));

         desksRef.current = resetDesksSafety;
         usersRef.current = resetUsersSafety;
         setDesks(resetDesksSafety);
         setUsers(resetUsersSafety);

         try {
           localStorage.setItem('sgm_desks', JSON.stringify(resetDesksSafety));
           localStorage.setItem('sgm_users', JSON.stringify(resetUsersSafety));
         } catch (e) {
           console.warn(`${safetyTimeLabel} güvenlik temizliği localStorage yazma uyarısı:`, e);
         }

         setSelectedDeskId(null); setDeskSelectionDeadline(null);
         setScannerConfig({ isOpen: false, mode: null, title: '' });

         addLog(
           'IHLAL_DINAMIK_GUVENLIK_KONTROL_LOGU',
           activeDesksAtSafety.length > 0 || usersWithViolationsAtSafety.length > 0
             ? `${safetyTimeLabel} ikinci güvenlik kontrolü tamamlandı. ${activeDesksAtSafety.length} aktif/rezerve masa temizlendi; ${usersWithViolationsAtSafety.length} kullanıcının günlük ihlali arşivlenip sıfırlandı.`
             : `${safetyTimeLabel} ikinci güvenlik kontrolü tamamlandı. Sistemde açık masa, bekleyen rezervasyon veya sıfırlanmamış günlük ihlal bulunmadı.`,
           null,
           null,
           false,
           null,
           {
             activeDeskCount: activeDesksAtSafety.length,
             violationUserCount: usersWithViolationsAtSafety.length,
             closeTime: settings.closeTime,
             safetyTime: safetyTimeLabel,
             checkedAt: currentTime
           }
         );

         // Aşağıdaki ortak sıfırlama bloğu aynı turda güvenli şekilde çalışabilir.
         needSafetyReset2300 = true;

         // İşaret en son yazılır.
         try {
           localStorage.setItem(safetyMarkerKey, todayStr);
         } catch (e) {
           console.warn(`${safetyTimeLabel} güvenlik kontrol işareti yazılamadı:`, e);
         }
      }


      // Döngü içi state çakışmasını engellemek için mevcut değerleri Ref'ten okuyoruz
      const restrictedIds = new Set((usersRef.current || []).filter(u => (u.blocked || isRestricted(u, currentTime)) &&
        !(u.activeDeskId && Number(u.adminDeskOverrideDeskId) === Number(u.activeDeskId) &&
          (desksRef.current || []).some(d => Number(d.id) === Number(u.activeDeskId) &&
            Number(d.sessionStartTime) === Number(u.adminDeskOverrideSessionStart) && d.occupant === u.id))).map(u => u.id));
      const restrictedDeskIds = new Set((desksRef.current || []).filter(d => restrictedIds.has(d.occupant) || restrictedIds.has(d.pendingOccupant)).map(d => d.id));
      if (!db && restrictedDeskIds.size) {
        // Canlı Firestore masa oturumlarını tarayıcıdaki geçici/eski kısıt verisiyle boşaltma.
        // Sunucu işlemleri ve doğrulanmış masa zaman aşımı mevcut oturumu yönetir.
        (desksRef.current || []).filter(desk => restrictedDeskIds.has(desk.id)).forEach(desk => {
          const userId = desk.occupant || desk.pendingOccupant;
          addLog('HESAP_KISITI_MASA_BOSALTILDI', `Masa ${desk.id}, kullanıcı hesabının kısıtlanması nedeniyle boşaltıldı.`, desk.id, userId, false, null,
            { eventId: `restricted-${desk.id}-${userId}-${desk.sessionStartTime || desk.pendingDeskDeadline || getLocalDayKey()}` });
        });
        const released = (desksRef.current || []).map(d => restrictedDeskIds.has(d.id) ? {...d, status: d.status === 'disabled' ? 'disabled' : 'available', occupant: null, ownerDeviceId: null, guestOccupant: null, pendingOccupant: null, pendingDeskRole: null, pendingDeskDeadline: null, breakEndTime: null, reportEndTime: null, sessionStartTime: null} : d);
        desksRef.current = released; setDesks(released);
        const releasedUsers = (usersRef.current || []).map(u => restrictedIds.has(u.id) ? {...u, activeDeskId: null, activeDeskRole: null, pendingDeskId: null, pendingDeskDeadline: null} : u);
        usersRef.current = releasedUsers; setUsers(releasedUsers);
      }
      const currentDesks = Array.isArray(desksRef.current) ? desksRef.current : [];
      let desksChanged = false;
      let usersToUpdate = []; // Ihlal alacak kullanici ID'leri
      const expiredDeskReservations = [];

      const newDesks = currentDesks.map(desk => {
        if (db && fbUser && (
          desk.pendingOccupant && Number(desk.pendingDeskDeadline) > 0 && currentTime >= Number(desk.pendingDeskDeadline) ||
          desk.status === 'reported' && Number(desk.reportEndTime) > 0 && currentTime >= Number(desk.reportEndTime)
        )) {
          settleCloudExpiry(desk.id);
          return desk;
        }

        // 5 dakikalık QR rezervasyonu dolduysa masa/konuk kontenjanını yeniden seçilebilir yap.
        if (desk.pendingOccupant && desk.pendingDeskDeadline && currentTime >= Number(desk.pendingDeskDeadline)) {
          desksChanged = true;
          expiredDeskReservations.push({ deskId: desk.id, userId: desk.pendingOccupant, role: desk.pendingDeskRole || 'owner' });
          return { ...desk, pendingOccupant: null, pendingDeskRole: null, pendingDeskDeadline: null };
        }

        // Mola süresinin dolması ihlal değildir; geçerli ihbar beklenir.
        if (desk.status === 'reported' && desk.reportEndTime && currentTime >= desk.reportEndTime) {
          desksChanged = true;

          // QR ile doğrulanan aynı ihbar, gecikmiş bir state/Firestore snapshot'ı yüzünden
          // tekrar "reported" görünse bile ihlal üretmesin.
          const reportWasAlreadyVerified = !!(
            desk.reportIssuedAt &&
            desk.reportVerifiedAt &&
            Number(desk.reportVerifiedAt) >= Number(desk.reportIssuedAt)
          );

          if (reportWasAlreadyVerified) {
            return { ...desk, status: 'occupied', reportEndTime: null, reportIssuedAt: null };
          }

          const deskUser = (Array.isArray(usersRef.current) ? usersRef.current : []).find(u => u.id === desk.occupant);
          if (Number(_optionalChain([deskUser, 'optionalAccess', _298 => _298.restrictionClearedAt]) || 0) > 0 &&
              Number(desk.reportIssuedAt || Number(desk.reportEndTime) - 300000) <= Number(deskUser.restrictionClearedAt)) {
            return { ...desk, status: 'occupied', reportEndTime: null, reportIssuedAt: null, reportVerifiedAt: null };
          }
          const currentStrikes = Number.isFinite(Number(_optionalChain([deskUser, 'optionalAccess', _299 => _299.strikes]))) ? Number(deskUser.strikes) : 0;
          const strikeLimit = 1; // İlk ihlalde masa otomatik boşaltılır
          const newStrikes = currentStrikes + 1;
          const shouldReleaseDesk = true; // İlk ihlalde masa boşaltılır.

          usersToUpdate.push({ id: desk.occupant, type: 'report_timeout', deskId: desk.id, newStrikes, shouldReleaseDesk });

          return shouldReleaseDesk
            ? { ...desk, status: 'available', occupant: null, ownerDeviceId: null, guestOccupant: null, pendingOccupant: null, pendingDeskDeadline: null, breakEndTime: null, reportEndTime: null, reportIssuedAt: null, sessionStartTime: null }
            : { ...desk, status: 'occupied', reportEndTime: null, reportIssuedAt: null };
        }

        // Misafir molasında da sırf süre dolduğu için ihlal oluşturulmaz.

        // Misafir ihbar doğrulama süresi dolduysa ihlal yalnızca misafire uygulanır.
        if (desk.guestOccupant && desk.guestReported && desk.guestReportEndTime && currentTime >= desk.guestReportEndTime) {
          desksChanged = true;

          const guestReportWasAlreadyVerified = !!(
            desk.guestReportIssuedAt &&
            desk.guestReportVerifiedAt &&
            Number(desk.guestReportVerifiedAt) >= Number(desk.guestReportIssuedAt)
          );

          if (guestReportWasAlreadyVerified) {
            return { ...desk, guestReported: false, guestReportEndTime: null, guestReportIssuedAt: null };
          }

          const guestUser = (Array.isArray(usersRef.current) ? usersRef.current : []).find(u => u.id === desk.guestOccupant);
          const currentStrikes = Number.isFinite(Number(_optionalChain([guestUser, 'optionalAccess', _300 => _300.strikes]))) ? Number(guestUser.strikes) : 0;
          const newStrikes = currentStrikes + 1;
          const shouldReleaseDesk = newStrikes >= 2;
          usersToUpdate.push({ id: desk.guestOccupant, type: 'guest_report_timeout', deskId: desk.id, newStrikes, shouldReleaseDesk, isGuest: true });
          return { ...desk, guestReported: false, guestReportEndTime: null, guestReportIssuedAt: null, ...(shouldReleaseDesk ? { guestOccupant: null, guestSessionStartTime: null, guestBreakEndTime: null } : {}) };
        }

        return desk;
      });

      // EĞER SÜRESİ DOLAN VARSA YA DA SIFIRLAMA GELDİYSE UPDATE ET (State nesting YOK!)
      if (needDeskReset || needSafetyReset2300) {
         // Kapanışta bütün masa durumlarını temizle; disabled masalar kapalı kalmaya devam eder.
         // Aynı temizleme 23:00 güvenlik kontrolünde de yedek olarak tekrar uygulanabilir.
         setDesks(currentDesks.map(d => ({ ...d, status: d.status === 'disabled' ? 'disabled' : 'available', occupant: null, guestOccupant: null, guestSessionStartTime: null, guestBreakEndTime: null, guestReported: false, guestReportEndTime: null, guestReportIssuedAt: null, guestReportVerifiedAt: null, pendingOccupant: null, pendingDeskRole: null, pendingDeskDeadline: null, breakEndTime: null, reportEndTime: null, sessionStartTime: null })));

         // Günlük ihlal sayaçlarını 22:00'de sıfırla.
         // 23:00 güvenlik kontrolü devreye girdiyse sıfırlama ikinci kez güvenli şekilde uygulanır.
         // Kalıcı violationRecords listesine dokunulmaz; gün içinde addLog ile eklenen ihlal geçmişi korunur.
         // Ayrıca kapanış/güvenlik kontrolünden hemen önce kalan günlük ihlaller IHLAL_* arşiv logları ile kalıcı kayda alınır.
         setUsers(prev => Array.isArray(prev) ? prev.map(u => ({
           ...u,
           activeDeskId: null,
           activeDeskRole: null,
           pendingDeskId: null,
           pendingDeskDeadline: null,
           strikes: 0,
           violationsResetDate: todayKey,
           lastActiveTime: currentTime
         })) : []);

         setSelectedDeskId(null); setDeskSelectionDeadline(null);
         setScannerConfig({ isOpen: false, mode: null, title: '' });
      } else {
         if (desksChanged) {
            setDesks(newDesks);
         }

         // Öğrenci ekranı kapalı olsa bile yönetici paneli açıkken süresi dolan 5 dk rezervasyonları kayıtlara geçir.
         if (view === 'admin_dash' && expiredDeskReservations.length > 0) {
            expiredDeskReservations.forEach(item => {
              addLog(
                'MASA_REZERVASYON_SURE_DOLDU',
                `Masa ${item.deskId} için 5 dakikalık rezervasyon süresi doldu; QR doğrulaması yapılmadığı için rezervasyon otomatik iptal edildi.`,
                item.deskId,
                item.userId,
                false,
                null,
                { reservationRole: item.role, reservationExpiredAt: currentTime }
              );
            });
         }
         
         if (usersToUpdate.length > 0 || needUserReset) {
            setUsers(prevUsers => {
               if(!Array.isArray(prevUsers)) return [];
               return prevUsers.map(u => {
                  if (needUserReset) {
                     return {
                       ...u,
                       breaks: { short: settings.shortBreakCount, long: settings.longBreakCount, hourly: allowedBreakCount(settings, 'hourly') },
                       breaksResetDate: todayKey,
                       violationsResetDate: todayKey,
                       strikes: 0,
                       // Günlük giriş kodu doğrulaması yalnızca doğrulandığı gün geçerlidir.
                       // Yeni güne ait olmayan eski doğrulama kaydını temizle; öğrenci ertesi gün kodu yeniden girsin.
                       dailyAccessVerifiedDate: u.dailyAccessVerifiedDate === todayKey ? u.dailyAccessVerifiedDate : ''
                     };
                  }
                  
                  const updateInfo = usersToUpdate.find(update => update.id === u.id);
                  if (updateInfo) {
                     const safeCurrentStrikes = Number.isFinite(Number(u.strikes)) ? Number(u.strikes) : 0;
                     const newStrikes = Number.isFinite(Number(updateInfo.newStrikes)) ? Number(updateInfo.newStrikes) : safeCurrentStrikes + 1;

                     // Log ve bildirim tetiklemeleri (state dışı yan etkiler)
                     if (updateInfo.type === 'guest_break_timeout') {
                         addLog('IHLAL_MISAFIR', `Masa ${updateInfo.deskId} misafir kullanıcısı mola süresini aştığı için ihlal aldı. Toplam ihlal: ${newStrikes}`, updateInfo.deskId, u.id);
                         if (true) ;
                     } else if (updateInfo.type === 'guest_report_timeout') {
                         addLog('IHLAL_MISAFIR', `Masa ${updateInfo.deskId} misafir kullanıcısı ihbar sonrası QR doğrulaması yapmadığı için ihlal aldı. Toplam ihlal: ${newStrikes}`, updateInfo.deskId, u.id);
                         if (true) ;
                     } else if (updateInfo.type === 'break_timeout') {
                         addLog('IHLAL', `Masa ${updateInfo.deskId} mola süresi aşıldığı için ihlal aldı. Toplam ihlal: ${newStrikes}`, updateInfo.deskId, u.id);
                         if (true) {
                           ;
                         }
                     } else {
                         addLog('IHLAL', `Masa ${updateInfo.deskId} boş bırakıldığı için ihlal aldı. Toplam ihlal: ${newStrikes}`, updateInfo.deskId, u.id);
                         if (true) {
                           ;
                         }
                     }

                     return {
                       ...u,
                       activeDeskId: updateInfo.shouldReleaseDesk ? null : u.activeDeskId,
                       activeDeskRole: updateInfo.shouldReleaseDesk ? null : u.activeDeskRole,
                       strikes: newStrikes,
                       ...applyViolationPolicy(u, updateInfo.deskId, currentTime),
                       // Mola süresi aşılmış olsa bile masa korunuyorsa yeni mola için 30 dk çalışma yeniden başlar.
                       lastActiveTime: (!updateInfo.shouldReleaseDesk && (updateInfo.type === 'break_timeout' || updateInfo.type === 'guest_break_timeout'))
                         ? currentTime
                         : u.lastActiveTime
                     };
                  }
                  return u;
               });
            });

            // Sadece bu cihazda geçerli kullanıcı düşürüldüyse bildirim at
            const myUpdate = usersToUpdate.find(u => currentUser && u.id === currentUser.id);
            if (myUpdate) {
                if (myUpdate.shouldReleaseDesk) {
                    sendNotification("İhlal: Masanız Boşaltıldı", `İhlal sayınız ${myUpdate.newStrikes} oldu. Masa ${myUpdate.deskId} sistem tarafından otomatik boşaltıldı.`);
                    showMessage("Masanız Otomatik Boşaltıldı", `İhlal nedeniyle Masa ${myUpdate.deskId} boşaltıldı. Bu masayı bugün tekrar alamazsınız. Son 7 günde ikinci ihlalde 7 günlük kısıtlama uygulanır.`, "danger");
                } else {
                    sendNotification("1. İhlal Kaydedildi", `İhlal sayınız ${myUpdate.newStrikes} oldu. İhlal oluştuğu anda masa otomatik boşaltılır.`);
                    showMessage("İhlal Kaydedildi", `İhlal sayınız ${myUpdate.newStrikes}/2 oldu. İhlal nedeniyle masa otomatik boşaltılır.`, "warning");
                }
            }
         }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [settings.strikeLimit, settings.openTime, settings.closeTime, settings.shortBreakCount, settings.longBreakCount, currentUser, isDataLoaded, adminAuthorized]);

  // AYNI CİHAZ = TEK MASA KURALI
  // Aynı tarayıcı/cihaz kimliği üzerinden başka bir kullanıcı adına aktif masa
  // veya süresi devam eden 5 dakikalık masa rezervasyonu varsa yeni masa seçilemez.
  const getDeviceDeskLock = (excludeUserId = null) => {
    const safeUsers = Array.isArray(usersRef.current) ? usersRef.current : [];
    const currentTime = Date.now();

    const ownedDesk = (desksRef.current || []).find(d => d.ownerDeviceId === deviceId && d.occupant && d.occupant !== excludeUserId);
    if (ownedDesk) return { id: ownedDesk.occupant, activeDeskId: ownedDesk.id, name: _optionalChain([safeUsers, 'access', _301 => _301.find, 'call', _302 => _302(u => u.id === ownedDesk.occupant), 'optionalAccess', _303 => _303.name]) };
    return safeUsers.find(u => {
      if (!u || u.id === excludeUserId) return false;
      if (!u.deviceId || u.deviceId !== deviceId) return false;

      const hasActiveDesk = !!u.activeDeskId;
      const hasActivePendingDesk = !!(
        u.pendingDeskId &&
        u.pendingDeskDeadline &&
        Number(u.pendingDeskDeadline) > currentTime
      );

      return hasActiveDesk || hasActivePendingDesk;
    }) || null;
  };

  // AYNI KULLANICI = TEK BEKLEYEN REZERVASYON KURALI
  // Kullanıcı kendi hesabıyla bir masa için 5 dakikalık QR rezervasyonu oluşturduysa
  // o rezervasyon bitmeden / iptal edilmeden farklı bir masa seçemez.
  // Bu kontrol, aynı cihaz kontrolünden bağımsızdır ve currentUser hariç tutulduğu için
  // oluşabilecek ikinci rezervasyon açığını kapatır.
  const getOwnPendingDeskLock = (userId, attemptedDeskId = null) => {
    const safeUsers = Array.isArray(usersRef.current) ? usersRef.current : [];
    const currentTime = Date.now();
    const user = safeUsers.find(u => u && u.id === userId);
    if (!user) return null;

    const pendingDeskId = Number(user.pendingDeskId || 0);
    const pendingDeadline = Number(user.pendingDeskDeadline || 0);
    const hasValidPending = !!(pendingDeskId && pendingDeadline > currentTime);

    if (!hasValidPending) return null;
    if (attemptedDeskId != null && Number(attemptedDeskId) === pendingDeskId) return null;

    return { ...user, pendingDeskId, pendingDeskDeadline: pendingDeadline };
  };

  const requireStudentAction = (action, { deskClaim = false, deskId = null } = {}) => {
    const user = (usersRef.current || []).find(u => u.id === _optionalChain([currentUser, 'optionalAccess', _304 => _304.id]));
    if (!user || user.blocked || isRestricted(user)) {
      setScannerConfig({ isOpen: false, mode: null, title: '' });
      addLog('KISITLI_ISLEM_ENGELLENDI', `${action} işlemi hesap kısıtı nedeniyle engellendi.`, null, _optionalChain([user, 'optionalAccess', _305 => _305.id]) || _optionalChain([currentUser, 'optionalAccess', _306 => _306.id]) || null);
      showMessage('Hesabınız Kısıtlı', 'Kısıtlı hesaplar masa seçemez, boş masa ihbarı ve dilek / şikayet gönderemez. Gerekli kontroller için kütüphane sorumlusu ile iletişime geçin.', 'warning');
      return null;
    }
    if (deskClaim && Number(user.deskReclaimDeskId || 0) === Number(deskId) && deskWaitRemaining(user) > 0) {
      setScannerConfig({ isOpen: false, mode: null, title: '' });
      addLog('MASA_BEKLEME_ENGELLENDI', `${action} işlemi 30 dakikalık bekleme süresi nedeniyle engellendi.`, null, user.id);
      showMessage('Masa Alma Bekleme Süresi', `Bıraktığınız masayı 30 dakika beklemelisiniz. Başka uygun masayı seçebilirsiniz. Kalan süre: ${formatTime(deskWaitRemaining(user))}. Sistem hatası yaşadıysanız yönetici masa atayabilir.`, 'warning');
      return null;
    }
    return user;
  };
  const openStudentFeedback = () => {
    const user = requireStudentAction('Dilek / Şikayet');
    if (!user) return;
    setFeedbackForm({ name: user.name, identityNo: user.specialCode, type: '', message: '' });
    setFeedbackStep(2); setView('feedback');
    addLog('GERIBILDIRIM_ACILDI', 'Dilek / Şikayet ekranı açıldı.', null, user.id);
  };

  // Öğrenci masasını QR doğrulamasından önce seçer. Seçim 5 dakika geçerlidir.
  const selectDeskForClaim = async (deskIdValue) => {
    if (!requireStudentAction('Masa seçimi', { deskClaim: true, deskId: Number(deskIdValue) })) return;
    if (!checkLibraryOpen()) {
      return showMessage("Kütüphane Kapalı", `Mesai saatleri (${settings.openTime} - ${settings.closeTime}) dışında masa seçilemez.`, "warning");
    }

    const deskId = Number(deskIdValue);
    const safeDesks = Array.isArray(desksRef.current) ? desksRef.current : [];
    const desk = safeDesks.find(d => d.id === deskId);
    if (!desk) return showMessage("Hata", "Seçilen masa bulunamadı.", "danger");
    if (desk.status === 'disabled') return showMessage("Uyarı", "Bu masa kullanıma kapatılmıştır.", "warning");

    const safeUsers = Array.isArray(usersRef.current) ? usersRef.current : [];
    const reservationOwner = desk.pendingOccupant ? safeUsers.find(u => u.id === desk.pendingOccupant) : null;
    const reservationDeadline = Number(desk.pendingDeskDeadline || 0);
    const reservationActive = !!(desk.pendingOccupant && reservationDeadline > Date.now() && reservationOwner &&
      Number(reservationOwner.pendingDeskId) === deskId &&
      Number(reservationOwner.pendingDeskDeadline || 0) === reservationDeadline);

    if (reservationActive && desk.pendingOccupant !== currentUser.id) {
      return showMessage("Masa Rezerve", `Masa ${deskId} başka bir öğrenci tarafından seçildi ve QR doğrulaması bekleniyor. Lütfen başka bir masa seçin.`, "warning");
    }

    const freshUser = safeUsers.find(u => u.id === currentUser.id);
    if (!freshUser || isRestricted(freshUser) || freshUser.blocked) return showMessage('Erişim Kısıtlı', 'Aktif ve onaylanmış hesap gereklidir.', 'danger');
    if (lostDeskToday(freshUser, deskId)) {
      ;
      return showMessage('Masa Kısıtı', 'İhlal nedeniyle kaybettiğiniz masayı bugün tekrar alamazsınız.', 'warning');
    }
    if (desk.status !== 'available') return showMessage('Masa Dolu', 'Her masa tek kişiliktir. Lütfen boş bir masa seçin.', 'warning');

    if (_optionalChain([freshUser, 'optionalAccess', _307 => _307.activeDeskId])) {
      return showMessage("İşlem Reddedildi", "Zaten aktif bir masanız bulunuyor. Önce mevcut masanızı bırakmalısınız.", "danger");
    }

    // SERT KURAL: Aynı kullanıcı aynı anda yalnızca 1 adet bekleyen masa rezervasyonuna sahip olabilir.
    // İlk rezervasyonun 5 dakikalık süresi devam ederken farklı masa seçmeye kesinlikle izin verilmez.
    const ownPendingDeskLock = getOwnPendingDeskLock(currentUser.id, deskId);
    if (ownPendingDeskLock) {
      const lockedDeskId = Number(ownPendingDeskLock.pendingDeskId);
      addLog(
        'AYNI_KULLANICI_IKINCI_REZERVASYON_ENGELLENDI',
        `Aynı kullanıcı için ikinci masa rezervasyonu engellendi. Kullanıcının Masa ${lockedDeskId} için aktif QR rezervasyonu bulunurken Masa ${deskId} seçilmeye çalışıldı.`,
        lockedDeskId || null,
        currentUser.id,
        false,
        null,
        { deviceId, lockedDeskId, attemptedDeskId: deskId, pendingDeadline: ownPendingDeskLock.pendingDeskDeadline, strictRule: true }
      );
      return showMessage(
        "Aktif Rezervasyonunuz Var",
        `Masa ${lockedDeskId} için devam eden bir rezervasyonunuz bulunuyor. Aynı anda ikinci masa seçemezsiniz. Önce mevcut rezervasyonu tamamlayın, iptal edin veya süresinin dolmasını bekleyin.`,
        "danger"
      );
    }

    // Aynı cihazdan farklı hesaplarla ikinci masa alınmasını engelle.
    const deviceDeskLock = getDeviceDeskLock(currentUser.id);
    if (deviceDeskLock) {
      const lockedDeskId = deviceDeskLock.activeDeskId || deviceDeskLock.pendingDeskId;
      const lockType = deviceDeskLock.activeDeskId ? 'aktif olarak kullanılıyor' : 'QR doğrulaması için rezerve edilmiş durumda';
      addLog('AYNI_CIHAZ_IKINCI_MASA_ENGELLENDI', `Aynı cihaz üzerinden ikinci masa seçimi engellendi. Bu cihaz Masa ${lockedDeskId} için ${deviceDeskLock.name || 'başka bir kullanıcı'} adına ${lockType}.`, lockedDeskId || null, currentUser.id, false, null, { deviceId, lockedUserId: deviceDeskLock.id, attemptedDeskId: deskId, strictRule: true, rule: 'ONE_DEVICE_ONE_DESK' });
      return showMessage("Bu Cihazda Zaten Masa Var", `Aynı cihaz üzerinden yalnızca 1 masa alınabilir. Bu cihazda Masa ${lockedDeskId} ${lockType}. Yeni masa almak için önce mevcut masa veya rezervasyon sonlandırılmalıdır.`, "danger");
    }
    if (freshUser && freshUser.strikes >= settings.strikeLimit) {
      return showMessage("Erişim Engellendi", "Günlük ihlal limitini doldurduğunuz için bugün masa seçemezsiniz.", "danger");
    }

    // Her masa tek kişiliktir; misafir oturumu kaldırılmıştır.
    if (desk.status !== 'available') {
      return showMessage("Masa Uygun Değil", "Bu masa dolu. Misafir seçeneği kaldırıldığı için yalnızca boş masalar seçilebilir.", "warning");
    }

    let reserved = null;
    if (db) {
      if (!fbUser || !granularSyncReadyRef.current || !navigator.onLine || Date.now() < quotaBackoffUntilRef.current) return showMessage('Bağlantı Bekleniyor', 'Masa seçimi için sunucu bağlantısı gerekli. Lütfen bağlantı/kota düzeldikten sonra tekrar deneyin.', 'warning');
      if (deskActionInFlightRef.current) return;
      deskActionInFlightRef.current = true;
      try {
        reserved = await runStudentDeskAction('reserve', { deskId, deviceId });
        applyCloudRows(reserved);
      }
      catch (error) { handleFirestoreQuotaError(error); return showMessage('Masa Seçilemedi', error.message, 'warning'); }
      finally { deskActionInFlightRef.current = false; }
    }
    const deadline = _optionalChain([reserved, 'optionalAccess', _308 => _308.deadline]) || Date.now() + (5 * 60 * 1000);
    const pendingRole = 'owner';
    setSelectedDeskId(deskId);
    setDeskSelectionDeadline(deadline);
    const nextDesksAfterReservation = (Array.isArray(desksRef.current) ? desksRef.current : []).map(d => d.id === deskId ? {
      ...d, pendingOccupant: currentUser.id, pendingDeskRole: pendingRole, pendingDeskDeadline: deadline
    } : d);
    const nextUsersAfterReservation = (Array.isArray(usersRef.current) ? usersRef.current : []).map(u =>
      u.id === currentUser.id ? { ...u, pendingDeskId: deskId, pendingDeskDeadline: deadline } : u
    );
    desksRef.current = nextDesksAfterReservation;
    usersRef.current = nextUsersAfterReservation;
    criticalDeskMutationRef.current = true;
    pendingReservationGuardRef.current = { userId: currentUser.id, deskId, role: pendingRole, deadline, deviceId, createdAt: Date.now() };
    setDesks(nextDesksAfterReservation);
    setUsers(nextUsersAfterReservation);
    setCurrentUser(prev => prev ? { ...prev, pendingDeskId: deskId, pendingDeskDeadline: deadline } : prev);
    addLog(
      'MASA_REZERVE_EDILDI',
      `Masa ${deskId} rezerve edildi. Öğrencinin masaya geçip QR kodunu doğrulaması için 5 dakikalık süre başlatıldı.`,
      deskId,
      currentUser.id,
      false,
      null,
      { reservationRole: pendingRole, reservationDeadline: deadline }
    );
    addLog('MASA_SECILDI', `Masa ${deskId} seçildi. QR doğrulaması için 5 dakikalık süre başlatıldı.`, deskId, currentUser.id);
    showMessage("Masa Seçildi", `Masa ${deskId} seçildi. Bu masanın QR kodunu 5 dakika içinde okutmalısınız.`, "success");
  };

  const cancelDeskSelection = async (reason = 'Öğrenci masa seçimini iptal etti.') => {
    if (!currentUser || deskCancellationRef.current || deskActionInFlightRef.current) return;
    const userId = currentUser.id;
    const freshUser = (usersRef.current || []).find(u => u.id === userId);
    const guard = pendingReservationGuardRef.current;
    const reservedDesk = (desksRef.current || []).find(d => d.pendingOccupant === userId);
    const oldDeskId = Number(selectedDeskId || _optionalChain([freshUser, 'optionalAccess', _309 => _309.pendingDeskId]) || currentUser.pendingDeskId ||
      (_optionalChain([guard, 'optionalAccess', _310 => _310.userId]) === userId ? guard.deskId : 0) || _optionalChain([reservedDesk, 'optionalAccess', _311 => _311.id]) || 0);
    deskCancellationRef.current = true;
    deskActionInFlightRef.current = true;
    setDeskCancellationBusy(true);
    try {
      if (oldDeskId && db) {
        if (!fbUser || !navigator.onLine) throw new Error('İptal için sunucu bağlantısı gerekli. Bağlantı kurulunca tekrar deneyin.');
        const result = await runStudentDeskAction('cancel', { deskId: oldDeskId });
        // Başarı cevabı olmadan yerel rezervasyon kaldırılmaz.
        if (result) applyCloudRows(result);
      }
      if (_optionalChain([pendingReservationGuardRef, 'access', _312 => _312.current, 'optionalAccess', _313 => _313.userId]) === userId) pendingReservationGuardRef.current = null;
      criticalDeskMutationRef.current = true;
      const nextDesks = (desksRef.current || []).map(d => Number(d.id) === oldDeskId && d.pendingOccupant === userId
        ? { ...d, pendingOccupant: null, pendingDeskRole: null, pendingDeskDeadline: null } : d);
      const nextUsers = (usersRef.current || []).map(u => u.id === userId
        ? { ...u, pendingDeskId: null, pendingDeskDeadline: null } : u);
      // Ref'ler aynı anda güncellenir; yeniden masa seçimi eski kilide takılmaz.
      desksRef.current = nextDesks; usersRef.current = nextUsers;
      setDesks(nextDesks); setUsers(nextUsers);
      setSelectedDeskId(null); setDeskSelectionDeadline(null);
      setCurrentUser(prev => _optionalChain([prev, 'optionalAccess', _314 => _314.id]) === userId ? { ...prev, pendingDeskId: null, pendingDeskDeadline: null } : prev);
      setScannerConfig({ isOpen: false, mode: null, title: '' });
      if (oldDeskId) addLog('MASA_SECIM_IPTAL', reason, oldDeskId, userId);
    } catch (error) {
      handleFirestoreQuotaError(error);
      showMessage('Rezervasyon İptal Edilemedi', /\b\w+\.exists is not a function\b/.test(error.message || '')
        ? 'Masa servisinde belge kontrolü hatası var. Sunucu dosyalarındaki düzeltme uygulanmalıdır. Rezervasyonunuz henüz iptal edilmedi.'
        : error.message, 'warning');
    } finally {
      deskCancellationRef.current = false;
      deskActionInFlightRef.current = false;
      setDeskCancellationBusy(false);
    }
  };

  useEffect(() => {
    if (!currentUser || !selectedDeskId || !deskSelectionDeadline || deskCancellationRef.current) return;
    if (now < deskSelectionDeadline) return;

    const expiredDeskId = selectedDeskId;
    if (_optionalChain([pendingReservationGuardRef, 'access', _315 => _315.current, 'optionalAccess', _316 => _316.userId]) === currentUser.id) pendingReservationGuardRef.current = null;
    criticalDeskMutationRef.current = true;
    setSelectedDeskId(null);
    setDeskSelectionDeadline(null);
    setDesks(prev => Array.isArray(prev) ? prev.map(d => d.id === expiredDeskId && d.pendingOccupant === currentUser.id ? {
      ...d, pendingOccupant: null, pendingDeskRole: null, pendingDeskDeadline: null
    } : d) : []);
    setUsers(prev => Array.isArray(prev) ? prev.map(u => u.id === currentUser.id ? { ...u, pendingDeskId: null, pendingDeskDeadline: null } : u) : []);
    setCurrentUser(prev => prev ? { ...prev, pendingDeskId: null, pendingDeskDeadline: null } : prev);
    addLog('MASA_SECIM_SURE_DOLDU', `Masa ${expiredDeskId} seçimi QR kod 5 dakika içinde okutulmadığı için iptal edildi.`, expiredDeskId, currentUser.id);
    addLog('MASA_REZERVASYON_IPTAL', `Masa ${expiredDeskId} rezervasyonu 5 dakikalık süre dolduğu için otomatik iptal edildi; öğrenci QR doğrulaması yapmadı.`, expiredDeskId, currentUser.id);
    setScannerConfig({ isOpen: false, mode: null, title: '' });
    showMessage("Süre Doldu", `Masa ${expiredDeskId} için 5 dakikalık QR okutma süreniz doldu. Lütfen yeniden masa seçin.`, "warning");
  }, [now, _optionalChain([currentUser, 'optionalAccess', _317 => _317.id]), selectedDeskId, deskSelectionDeadline]);

  const prepareNewStudentRegistration = () => {
    if (registrationInFlightRef.current) return;
    // Yalnızca bu cihazın kayıt ekranı temizlenir; önceki hesap sunucuda korunur.
    localStorage.removeItem('sgm_registration_account');
    ['sgm_registration_token', 'sgm_registration_credentials', 'sgm_registration_form_url', 'sgm_registration_form_opened'].forEach(key => sessionStorage.removeItem(key));
    sessionStorage.setItem('sgm_registration_new_person', '1');
    setRegistrationPending(''); setRegistrationResult(null); setRegistrationFormUrl('');
    setRegistrationFormOpened(false); setRegistrationError('');
    setRegistrationAccepted(false); setRegistrationRulesOpen(true); setShowRules(true);
  };

  const startRegistration = async () => {
    if (!registrationAccepted || registrationInFlightRef.current) return;
    registrationInFlightRef.current = true;
    setRegistrationBusy(true); setRegistrationError('');
    try {
      if (!isDataLoaded) throw new Error('Sistem verileri yüklenene kadar bekleyin.');
      if (db && auth) {
        await ensureTabAuthPersistence();
        await auth.authStateReady();
      }
      const newPerson = sessionStorage.getItem('sgm_registration_new_person') === '1';
      // Hesap oluşturma Google Form bağlantısından bağımsızdır. Link yalnızca Devam Et adımında kontrol edilir.
      // Aynı cihazda kayıt bilgileri duruyorsa yeni hesap yerine mevcut kısıtlı hesabı göster.
      const saved = (() => { try { return JSON.parse(localStorage.getItem('sgm_registration_account') || 'null'); } catch (e22) { return null; } })();
      let registrationAuthUser = _optionalChain([auth, 'optionalAccess', _318 => _318.currentUser]) || fbUser;
      let user = newPerson ? null : (usersRef.current || []).find(u => u.id === _optionalChain([saved, 'optionalAccess', _319 => _319.userId]));
      if (db && user && String(user.id) !== String(_optionalChain([registrationAuthUser, 'optionalAccess', _320 => _320.uid]))) user = null;
      if (user && (isRecordDeleted('users', user.id) || serverDeletedUserIdsRef.current.has(String(user.id)))) user = null;
      if (!user && _optionalChain([saved, 'optionalAccess', _321 => _321.userId])) {
        // Silinen hesabın veya önceki oturumun cihazda kalan kaydı yeni kaydı engellemez.
        localStorage.removeItem('sgm_registration_account');
        ['sgm_registration_token', 'sgm_registration_credentials', 'sgm_registration_form_url', 'sgm_registration_form_opened'].forEach(key => sessionStorage.removeItem(key));
        setRegistrationPending(''); setRegistrationResult(null);
        setRegistrationFormUrl(''); setRegistrationFormOpened(false);
        const oldSession = (() => { try { return JSON.parse(sessionStorage.getItem('sgm_student_session') || 'null'); } catch (e23) { return null; } })();
        if (_optionalChain([oldSession, 'optionalAccess', _322 => _322.userId]) === saved.userId) sessionStorage.removeItem('sgm_student_session');
      }
      if (db && !user) {
        if (!auth) throw new Error('Firebase oturumu başlatılamadı.');
        // Silinmiş öğrenci tokenı kayıt API'sine gönderilmez. Doğrulanmış anonim
        // oturum oluşturulur; istemci yeni hesabın kimliğini kendisi seçmez.
        if (registrationAuthUser && (newPerson || !registrationAuthUser.isAnonymous ||
            serverDeletedUserIdsRef.current.has(String(registrationAuthUser.uid)) ||
            isRecordDeleted('users', registrationAuthUser.uid))) {
          await signOut(auth);
          registrationAuthUser = null;
          setCurrentUser(null); setSelectedDeskId(null); setDeskSelectionDeadline(null);
        }
        if (!registrationAuthUser) registrationAuthUser = (await signInTabAnonymously()).user;
        // İstek kaybolursa tekrar aynı yeni oturum kullanılır; ikinci hesap açılmaz.
        sessionStorage.removeItem('sgm_registration_new_person');
        verifiedAdminUidRef.current = null;
        setFbUser(registrationAuthUser);
      }
      // Aynı doğrulanmış anonim oturumda eksik yerel hesap, kayıt API'sinden
      // yeniden getirilir. API mevcut hesabı döndürür; kod/şifre değiştirilmez.
      if (!user) {
        const token = crypto.randomUUID ? crypto.randomUUID() : 'REG-' + Date.now() + '-' + generateId();
        const createUser = rows => ({
          id: 'REG-' + token,
          name: 'Yeni Kayıt',
          identityNo: createEightDigitCode(new Set(rows.map(u => u.identityNo))),
          specialCode: createEightDigitCode(new Set(rows.map(u => u.specialCode))),
          pin: createEightDigitCode(new Set(rows.map(u => u.pin))),
          registrationSession: token, registrationFormStatus: 'manual_review',
          pendingApproval: true, restrictedUntil: 0,
          restrictionReason: 'Google Form kontrolü ve kütüphane sorumlusu onayı bekleniyor',
          activeDeskId: null, activeDeskRole: null, pendingDeskId: null, pendingDeskDeadline: null,
          breaks: { short: settings.shortBreakCount, long: settings.longBreakCount, hourly: allowedBreakCount(settings, 'hourly') },
          strikes: 0, blocked: false, canReport: true, createdAt: Date.now()
        });
        if (db) {
          let response, payload;
          for (let attempt = 0; attempt < 2; attempt++) {
            // Aynı doğrulanmış anonim UID kullanılır; 401'de yetki atlanmaz.
            const tokenResult = await registrationAuthUser.getIdTokenResult(true);
            if (_optionalChain([auth, 'access', _323 => _323.currentUser, 'optionalAccess', _324 => _324.uid]) !== registrationAuthUser.uid) throw new Error('Kayıt sırasında oturum değişti. Kayıt ekranından tekrar deneyin.');
            if (_optionalChain([tokenResult, 'access', _325 => _325.claims, 'access', _326 => _326.firebase, 'optionalAccess', _327 => _327.sign_in_provider]) !== 'anonymous') throw new Error('Anonim kayıt oturumu doğrulanamadı. Kayıt ekranını yeniden açıp tekrar deneyin.');
            response = await fetch('/api/student-register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenResult.token}` },
              body: JSON.stringify({})
            });
            payload = await response.json().catch(() => null);
            if (response.status !== 401) break;
          }
          if (!response.ok || _optionalChain([payload, 'optionalAccess', _328 => _328.ok]) !== true || !_optionalChain([payload, 'optionalAccess', _329 => _329.user, 'optionalAccess', _330 => _330.id]) || !_optionalChain([payload, 'optionalAccess', _331 => _331.credentials, 'optionalAccess', _332 => _332.specialCode]) || !_optionalChain([payload, 'optionalAccess', _333 => _333.credentials, 'optionalAccess', _334 => _334.pin])) {
            throw new Error(_optionalChain([payload, 'optionalAccess', _335 => _335.message]) || `Kayıt servisi HTTP ${response.status} döndürdü.`);
          }
          if (String(payload.user.id) !== String(registrationAuthUser.uid)) {
            throw new Error('Kayıt sonucu doğrulanmış cihaz oturumuyla eşleşmiyor.');
          }
          user = { ...payload.user, ...payload.credentials };
          granularBaselineRef.current.users.set(String(user.id), user);
        } else {
          user = createUser(usersRef.current || []); user.name = `Yeni Kayıt • ${user.specialCode}`;
        }
        const next = [...(usersRef.current || []).filter(u => u.id !== user.id), user];
        usersRef.current = next; setUsers(next);
        localStorage.setItem('sgm_users', JSON.stringify(next));
        localStorage.setItem('sgm_registration_account', JSON.stringify({ userId: user.id }));
        addLog('KULLANICI_KAYIT', 'Kurallar onaylandı. GM Özel Kod ve şifre üretildi; hesap sorumlu onayına kadar kısıtlı.', null, user.id);
      } else {
        addLog('KAYIT_BILGILERI_GOSTERILDI', 'Mevcut kayıt bilgileri yeniden gösterildi; yeni hesap oluşturulmadı.', null, user.id);
      }
      const credentials = { specialCode: user.specialCode, pin: user.pin };
      sessionStorage.setItem('sgm_registration_token', user.registrationSession || user.id);
      sessionStorage.setItem('sgm_registration_credentials', JSON.stringify(credentials));
      sessionStorage.setItem('sgm_registration_form_url', normalizeRegistrationUrl(settingsRef.current.registrationFormUrl));
      setRegistrationPending(user.registrationSession || user.id);
      setRegistrationVerified(false); setRegistrationResult(credentials); setRegistrationFormUrl(normalizeRegistrationUrl(settingsRef.current.registrationFormUrl));
      sessionStorage.removeItem('sgm_registration_form_opened');
      setRegistrationFormOpened(false); setRegistrationRulesOpen(false); setShowRules(false);
    } catch (error) {
      setRegistrationError(error.message);
      addLog('KAYIT_HATA', 'Kullanıcı kaydı başlatılamadı: ' + error.message);
    } finally {
      registrationInFlightRef.current = false; setRegistrationBusy(false);
    }
  };

  const copyRegistrationValue = async (label, value) => {
    try {
      addLog('KAYIT_BILGI_KOPYALA', `${label} kopyalama istendi.`);
      await navigator.clipboard.writeText(String(value || ''));
      showMessage('Kopyalandı', `${label} panoya kopyalandı.`, 'success');
    } catch (e24) {
      showMessage('Kopyalanamadı', `${label}: ${value}`, 'warning');
    }
  };

  const refreshRegistrationFormUrl = async () => {
    let latest = settingsRef.current;
    if (db && fbUser) {
      try {
        // Açık sekmenin eski state'i yerine parçalı config belgesindeki güncel bağlantıyı oku.
        const snapshot = await getDoc(getLiveSettingsDoc());
        if (snapshot.exists()) latest = mergeRegistrationSettings(latest, snapshot.data() || {});
      } catch (error) {
        console.warn('Kayıt bağlantısı yenilenemedi; mevcut kayıt kullanılacak:', error);
      }
    }
    // Aynı cihazdaki YP kaydını, başka sekme ve sayfa yenilemesinden sonra da kullan.
    let cached = {};
    try { cached = JSON.parse(localStorage.getItem('sgm_settings') || '{}'); } catch (e25) {}
    latest = mergeRegistrationSettings(cached, latest);
    const url = normalizeRegistrationUrl(latest.registrationFormUrl);
    if (validRegistrationUrl(url)) {
      settingsRef.current = latest;
      setSettings(prev => mergeRegistrationSettings(prev, latest));
      setRegistrationFormUrl(url);
      try {
        sessionStorage.setItem('sgm_registration_form_url', url);
        localStorage.setItem('sgm_settings', JSON.stringify(latest));
      } catch (e26) {}
      return url;
    }
    // Eski kayıt ekranında tutulan geçerli bağlantı, tek kullanımlık yedek olabilir.
    const fallback = normalizeRegistrationUrl(registrationFormUrl || sessionStorage.getItem('sgm_registration_form_url'));
    return validRegistrationUrl(fallback) ? fallback : '';
  };
  const openRegistrationGoogleForm = async () => {
    if (registrationRedirectInFlightRef.current) return;
    registrationRedirectInFlightRef.current = true;
    setRegistrationRedirectBusy(true);
    try {
      const url = await refreshRegistrationFormUrl();
      if (!url) {
        return showMessage('Hesabınız Oluşturuldu', 'GM Özel Kod ve şifreniz hazır; hesabınız kısıtlı olarak korunuyor. Google Form bağlantısı bulunamadı. Kütüphane sorumlusundan YP → Kayıt / Google Form bölümündeki bağlantıyı kontrol etmesini isteyin.', 'warning');
      }
      // Aynı sekmede yönlendirme: açılır pencere engeli akışı durduramaz.
      // Google Form'a gitmeden önce kayıt bilgilerini ve yönlendirme durumunu koru.
      if (registrationResult) sessionStorage.setItem('sgm_registration_credentials', JSON.stringify(registrationResult));
      sessionStorage.setItem('sgm_registration_form_opened', '1');
      setRegistrationFormOpened(true);
      addLog('KAYIT_FORM_YONLENDIRME', 'Google Form bağlantısına yönlendirildi. Formun tamamlanması yönetici tarafından kontrol edilecek.', null, _optionalChain([currentUser, 'optionalAccess', _336 => _336.id]) || null);
      window.location.assign(url);
    } catch (error) {
      showMessage('Form Açılamadı', 'Hesabınız korunuyor. Google Form bağlantısı açılamadı; tekrar deneyin.', 'warning');
      addLog('KAYIT_FORM_YONLENDIRME_HATA', 'Google Form yönlendirmesi başarısız oldu.');
    } finally {
      registrationRedirectInFlightRef.current = false;
      setRegistrationRedirectBusy(false);
    }
  };
  const checkRegistrationFormStatus = async (silent = false) => {
    if (!_optionalChain([registrationResult, 'optionalAccess', _337 => _337.specialCode]) || !_optionalChain([registrationResult, 'optionalAccess', _338 => _338.pin])) return;
    try {
      const response = await fetch('/api/student-login', {method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'form_status',specialCode:registrationResult.specialCode,pin:registrationResult.pin})});
      const payload = await response.json().catch(()=>null);
      if (!response.ok || _optionalChain([payload, 'optionalAccess', _339 => _339.ok]) !== true) {
        if (!silent) showMessage('Form Kontrolü',_optionalChain([payload, 'optionalAccess', _340 => _340.message])||'Form doğrulanamadı. Biraz sonra yeniden deneyin.','warning');
        return;
      }
      setRegistrationVerified(payload.verified === true);
      if (!silent) showMessage('Form Kontrolü',payload.verified ? 'Form gönderiminiz doğrulandı. Sisteme giriş yapabilirsiniz.' : 'Form henüz doğrulanmadı. Google Formu gönderdiyseniz biraz sonra tekrar kontrol edin.',payload.verified?'success':'warning');
    } catch(error) { if (!silent) showMessage('Bağlantı Hatası','Form kontrol servisine ulaşılamadı.','warning'); }
  };
  useEffect(() => {
    if (!_optionalChain([registrationResult, 'optionalAccess', _341 => _341.specialCode]) || registrationVerified || !registrationFormOpened) return;
    checkRegistrationFormStatus(true);
    const id = setInterval(()=>checkRegistrationFormStatus(true),30000);
    return ()=>clearInterval(id);
  }, [_optionalChain([registrationResult, 'optionalAccess', _342 => _342.specialCode]),registrationFormOpened,registrationVerified]);

  const fillRegistrationLogin = () => {
    if (!registrationResult) return;
    setLoginIdentity(String(registrationResult.specialCode || ''));
    setLoginPin(String(registrationResult.pin || '')); setView('student_login');
    handleStudentLogin({ preventDefault() {}, target: {} }, registrationResult);
    addLog('KAYIT_GIRIS_HAZIRLANDI', 'GM Özel Kod ve şifre giriş alanlarına aktarıldı.');
  };

  const handleStudentLogin = async (e, credentials = null) => {
    e.preventDefault();
    
    if (!isDataLoaded) {
        return showMessage("Lütfen Bekleyin", "Sistem verileri senkronize ediliyor. İnternet bağlantınızı kontrol edip birkaç saniye sonra tekrar deneyin.", "warning");
    }

    if (!checkLibraryOpen()) {
        return showMessage("Kütüphane Kapalı", `Kütüphanemiz şu an kapalıdır. Çalışma saatleri: ${settings.openTime} - ${settings.closeTime} arasındadır.`, "warning");
    }

    const rawPhone = String(_optionalChain([credentials, 'optionalAccess', _343 => _343.specialCode]) || loginIdentity || _optionalChain([e, 'access', _344 => _344.target, 'access', _345 => _345.identityNo, 'optionalAccess', _346 => _346.value]) || '');
    if(!/^\d{8}$/.test(rawPhone) || !/^\d{8}$/.test(String(_optionalChain([credentials, 'optionalAccess', _347 => _347.pin]) || loginPin || _optionalChain([e, 'access', _348 => _348.target, 'access', _349 => _349.pin, 'optionalAccess', _350 => _350.value]) || ''))) return showMessage("Bilgileri Kontrol Edin","GM Özel Kod ve şifre 8 rakamdan oluşmalıdır.","warning");
    const rawPin = String(_optionalChain([credentials, 'optionalAccess', _351 => _351.pin]) || loginPin || _optionalChain([e, 'access', _352 => _352.target, 'access', _353 => _353.pin, 'optionalAccess', _354 => _354.value]) || '');
    
    try {
      const response = await fetch('/api/student-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialCode: rawPhone, pin: rawPin })
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 403 && _optionalChain([payload, 'optionalAccess', _355 => _355.error]) === 'form_not_verified') {
        return showMessage('Form Doğrulanmadı',payload.message,'warning');
      }
      if (response.status === 401 || response.status === 400) {
        addLog('OGRENCI_GIRIS_HATA', 'Başarısız öğrenci giriş denemesi.');
        return showMessage('Giriş Başarısız', 'GM Özel Kod veya şifre hatalı. Her ikisi de 8 rakam olmalıdır.', 'danger');
      }
      if (!response.ok || _optionalChain([payload, 'optionalAccess', _356 => _356.ok]) !== true || !_optionalChain([payload, 'optionalAccess', _357 => _357.token]) || !_optionalChain([payload, 'optionalAccess', _358 => _358.user, 'optionalAccess', _359 => _359.id])) {
        return showMessage('Giriş Hatası', _optionalChain([payload, 'optionalAccess', _360 => _360.message]) || `Öğrenci giriş servisi HTTP ${response.status} döndürdü. Bağlantıyı kontrol edip tekrar deneyin.`, 'danger');
      }
      if (!auth) throw new Error('Firebase ayarları bulunamadı.');
      const credential = await signInTabWithCustomToken(payload.token);
      const tokenResult = await credential.user.getIdTokenResult(true);
      if (tokenResult.claims.role !== 'student' || credential.user.uid !== payload.user.id) {
        await signOut(auth);
        await signInTabAnonymously();
        throw new Error('Öğrenci oturumu doğrulanamadı.');
      }
      const user = normalizeRemoteUsers([payload.user], settingsRef.current)[0];
      const safeUsers = [user];
      usersRef.current = safeUsers;
      setUsers(safeUsers);
      localStorage.setItem('sgm_users', JSON.stringify(safeUsers));
      granularBaselineRef.current.users.set(String(user.id), user);

    setFbUser(credential.user);
    // Kısıtlı kullanıcı da giriş yapar; işlem yetkileri güncel hesap kaydıyla kontrol edilir.
    const pendingIsValid = user.pendingDeskId && user.pendingDeskDeadline && Number(user.pendingDeskDeadline) > Date.now();
    const updatedUser = {
      ...user,
      deviceId: deviceId,
      pendingDeskId: pendingIsValid ? user.pendingDeskId : null,
      pendingDeskDeadline: pendingIsValid ? user.pendingDeskDeadline : null
    };
    usersRef.current = [updatedUser];
    setUsers([updatedUser]);
    sessionStorage.setItem('sgm_student_session', JSON.stringify({ userId: updatedUser.id }));
    setCurrentUser(updatedUser);
    setSelectedDeskId(pendingIsValid ? Number(user.pendingDeskId) : null);
    setDeskSelectionDeadline(pendingIsValid ? Number(user.pendingDeskDeadline) : null);

    setView('student_dash');
    if (!credentials && localStorage.getItem('sgm_login_remember_choice_v1') == null) {
      setRememberLoginPrompt({ specialCode: updatedUser.specialCode });
    }
    addLog('ÖĞRENCİ_GİRİŞİ', `${updatedUser.name} sisteme giriş yaptı.`, updatedUser.activeDeskId || null, updatedUser.id);

    if (updatedUser.blocked || isRestricted(updatedUser)) {
      setTimeout(() => {
        showMessage(
          'Hesabınız Şu An Kısıtlı',
          `${(updatedUser.formInfoRestrictionReason || updatedUser.restrictionReason) ? `Neden: ${updatedUser.formInfoRestrictionReason || updatedUser.restrictionReason}\n` : ''}Kısıtınızı kaldırabilmeniz için kütüphane sorumlumuz ile iletişime geçebilirsiniz. Gerekli kontroller yapıldıktan sonra sorumlu tarafından hesabınız aktif edilecektir.`,
          'warning'
        );
      }, 150);
    }

    setLoginIdentity('');
    setLoginPin('');
    } catch (error) {
      console.error('Öğrenci giriş hatası:', error);
      showMessage('Bağlantı Hatası', error.message || 'Öğrenci giriş servisine ulaşılamadı.', 'danger');
    }
  };

  const logoutStudent = async () => {
    addLog('OGRENCI_CIKIS', 'Kullanıcı kendi isteğiyle çıkış yaptı.', null, _optionalChain([currentUser, 'optionalAccess', _361 => _361.id]));
    sessionStorage.removeItem('sgm_student_session');
    setCurrentUser(null);
    setView('role_select');
    setUsers([]);
    usersRef.current = [];
    localStorage.removeItem('sgm_users');
    // Çıkış kaydı mevcut öğrenci tokenı geçerliyken gönderilsin.
    await appendChainRef.current.catch(() => {});
    if (auth) {
      await signOut(auth);
      await signInTabAnonymously();
    }
  };



  const claimDesk = async (qrData) => {
    if (!requireStudentAction('QR ile masa alma', { deskClaim: true })) return;
    // Yönetici panelinden kısıt/onay kaldırılmışsa currentUser eski kalmış olabilir.
    // QR işleminde daima Firestore/users state'inden gelen EN GÜNCEL kullanıcıyı esas al.
    const latestClaimUser = (Array.isArray(usersRef.current) ? usersRef.current : [])
      .find(u => u.id === _optionalChain([currentUser, 'optionalAccess', _362 => _362.id])) || currentUser;

    if (_optionalChain([latestClaimUser, 'optionalAccess', _363 => _363.pendingApproval])) {
      setScannerConfig({isOpen: false, mode: null});
      return showMessage(
        "Hesabınız Kısıtlı",
        "Masa kullanabilmek için önce kütüphane sorumlumuz ile iletişime geçin. Gerekli kontroller yapılıp hesabınız onaylandıktan sonra kısıtınız kaldırılacaktır.",
        "warning"
      );
    }

    if (!checkLibraryOpen()) {
        setScannerConfig({isOpen: false, mode: null});
        return showMessage("Kütüphane Kapalı", `Mesai saatleri (${settings.openTime} - ${settings.closeTime}) dışında masa alınamaz.`, "warning");
    }

    const parts = qrData.split('-');
    if (parts.length < 2) {
        setScannerConfig({isOpen: false, mode: null});
        return showMessage("Hata", "Geçersiz QR Kod.", "danger");
    }
    const deskId = parseInt(parts[1]);

    const safeDesks = Array.isArray(desksRef.current) ? desksRef.current : [];
    const desk = safeDesks.find(d => d.id === deskId);
    if (!desk) {
        setScannerConfig({isOpen: false, mode: null});
        return showMessage("Hata", "Masa bulunamadı.", "danger");
    }

    // Rezervasyonu çoklu kaynaktan doğrula. Firestore snapshot'ı kısa süreli geride kalsa bile
    // gerçek 5 dakikalık rezervasyon kaybolmaz.
    const reservationUsers = Array.isArray(usersRef.current) ? usersRef.current : [];
    const reservationUser = reservationUsers.find(u => u.id === currentUser.id);
    const reservationGuard = pendingReservationGuardRef.current;
    const reservationNow = Date.now();

    const deskReservationValid = !!(
      desk.pendingOccupant === currentUser.id &&
      Number(desk.pendingDeskDeadline || 0) > reservationNow
    );
    const userReservationValid = !!(
      Number(_optionalChain([reservationUser, 'optionalAccess', _364 => _364.pendingDeskId]) || _optionalChain([currentUser, 'optionalAccess', _365 => _365.pendingDeskId]) || 0) === deskId &&
      Number(_optionalChain([reservationUser, 'optionalAccess', _366 => _366.pendingDeskDeadline]) || _optionalChain([currentUser, 'optionalAccess', _367 => _367.pendingDeskDeadline]) || 0) > reservationNow
    );
    const localReservationValid = !!(
      Number(selectedDeskId || 0) === deskId &&
      Number(deskSelectionDeadline || 0) > reservationNow
    );
    const guardReservationValid = !!(
      reservationGuard &&
      reservationGuard.userId === currentUser.id &&
      Number(reservationGuard.deskId) === deskId &&
      Number(reservationGuard.deadline || 0) > reservationNow
    );

    if (!(deskReservationValid || userReservationValid || localReservationValid || guardReservationValid)) {
      setScannerConfig({isOpen:false, mode:null});
      return showMessage("Rezervasyon Bulunamadı", `Masa ${deskId} için aktif rezervasyonunuz bulunmuyor. Lütfen masayı yeniden seçip kendi QR kodunu okutun.`, "warning");
    }

    const effectiveSelectedDeskId = Number(
      selectedDeskId || _optionalChain([reservationUser, 'optionalAccess', _368 => _368.pendingDeskId]) || _optionalChain([currentUser, 'optionalAccess', _369 => _369.pendingDeskId]) || _optionalChain([reservationGuard, 'optionalAccess', _370 => _370.deskId]) || 0
    );
    const effectiveDeskSelectionDeadline = Number(
      deskSelectionDeadline || _optionalChain([reservationUser, 'optionalAccess', _371 => _371.pendingDeskDeadline]) || _optionalChain([currentUser, 'optionalAccess', _372 => _372.pendingDeskDeadline]) || _optionalChain([reservationGuard, 'optionalAccess', _373 => _373.deadline]) || 0
    );

    if (!effectiveSelectedDeskId || !effectiveDeskSelectionDeadline) {
      setScannerConfig({isOpen: false, mode: null});
      return showMessage("Önce Masa Seçin", "QR kod okutmadan önce öğrenci panelinden kullanacağınız masayı seçmelisiniz.", "warning");
    }
    if (Date.now() > effectiveDeskSelectionDeadline) {
      setScannerConfig({isOpen: false, mode: null});
      cancelDeskSelection(`Masa ${effectiveSelectedDeskId} seçiminin 5 dakikalık QR süresi doldu.`);
      return showMessage("Süre Doldu", "5 dakikalık QR okutma süreniz doldu. Lütfen yeniden masa seçin.", "warning");
    }
    if (deskId !== effectiveSelectedDeskId) {
      setScannerConfig({isOpen: false, mode: null});
      return showMessage("Yanlış Masa QR Kodu", `Masa ${effectiveSelectedDeskId} seçtiniz. Lütfen yalnızca Masa ${effectiveSelectedDeskId} üzerindeki QR kodu okutun.`, "danger");
    }
    if (qrData !== desk.qrCode) {
        setScannerConfig({isOpen: false, mode: null});
        return showMessage("Geçersiz QR Kod", `Okutulan QR kod Masa ${deskId} için güncel sistem QR koduyla eşleşmiyor.`, "danger");
    }
    
    if (desk.status === 'disabled') {
        setScannerConfig({isOpen: false, mode: null});
        return showMessage("Uyarı", "Bu masa kullanıma kapatılmıştır.", "warning");
    }
    
    const safeUsers = Array.isArray(usersRef.current) ? usersRef.current : [];
    const freshUser = safeUsers.find(u => u.id === currentUser.id);
    if (!freshUser || isRestricted(freshUser) || freshUser.blocked) return showMessage('Erişim Kısıtlı', 'Aktif ve onaylanmış hesap gereklidir.', 'danger');
    if (lostDeskToday(freshUser, deskId)) {
      ;
      return showMessage('Masa Kısıtı', 'İhlal nedeniyle kaybettiğiniz masayı bugün tekrar alamazsınız.', 'warning');
    }
    if (desk.status !== 'available') return showMessage('Masa Dolu', 'Her masa tek kişiliktir. Lütfen boş bir masa seçin.', 'warning');

    
    if (freshUser && freshUser.activeDeskId) {
        setScannerConfig({isOpen: false, mode: null});
        return showMessage("İşlem Reddedildi", "Zaten aktif bir masanız bulunuyor. Masa değiştirmek için önce masanızı bırakmalısınız.", "danger");
    }

    // SERT KURAL: QR onayında kullanıcının başka bir masa için geçerli bekleyen rezervasyonu varsa
    // mevcut QR işlemi de reddedilir. Böylece arayüz/state yarışlarıyla ikinci masa açılamaz.
    const ownPendingDeskLockAtQr = getOwnPendingDeskLock(currentUser.id, deskId);
    if (ownPendingDeskLockAtQr) {
        const lockedDeskId = Number(ownPendingDeskLockAtQr.pendingDeskId);
        setScannerConfig({isOpen: false, mode: null});
        addLog(
          'AYNI_KULLANICI_IKINCI_REZERVASYON_ENGELLENDI',
          `QR doğrulama sırasında ikinci rezervasyon girişimi engellendi. Kullanıcının Masa ${lockedDeskId} rezervasyonu varken Masa ${deskId} QR kodu doğrulanmaya çalışıldı.`,
          deskId,
          currentUser.id,
          false,
          null,
          { deviceId, lockedDeskId, attemptedDeskId: deskId, pendingDeadline: ownPendingDeskLockAtQr.pendingDeskDeadline, strictRule: true, phase: 'qr' }
        );
        return showMessage(
          "İkinci Masa Kesinlikle Yasak",
          `Masa ${lockedDeskId} için aktif rezervasyonunuz bulunuyor. Aynı kullanıcı veya aynı cihaz üzerinden ikinci masa açılamaz.`,
          "danger"
        );
    }
    
    // QR doğrulama anında da aynı cihaz = tek masa kuralını tekrar kontrol et.
    const deviceDeskLock = getDeviceDeskLock(currentUser.id);
    if (deviceDeskLock) {
        const lockedDeskId = deviceDeskLock.activeDeskId || deviceDeskLock.pendingDeskId;
        const lockType = deviceDeskLock.activeDeskId ? 'aktif olarak kullanılıyor' : 'QR doğrulaması bekliyor';
        setScannerConfig({isOpen: false, mode: null});
        setDesks(prev => Array.isArray(prev) ? prev.map(d => d.pendingOccupant === currentUser.id ? { ...d, pendingOccupant: null, pendingDeskRole: null, pendingDeskDeadline: null } : d) : []);
        setUsers(prev => Array.isArray(prev) ? prev.map(u => u.id === currentUser.id ? { ...u, pendingDeskId: null, pendingDeskDeadline: null } : u) : []);
        setCurrentUser(prev => prev ? { ...prev, pendingDeskId: null, pendingDeskDeadline: null } : prev);
        setSelectedDeskId(null);
        setDeskSelectionDeadline(null);
        addLog('AYNI_CIHAZ_IKINCI_MASA_ENGELLENDI', `QR doğrulama sırasında aynı cihazdan ikinci masa alma girişimi engellendi. Masa ${lockedDeskId} bu cihazda ${deviceDeskLock.name || 'başka bir kullanıcı'} adına ${lockType}.`, deskId, currentUser.id, false, null, { deviceId, lockedUserId: deviceDeskLock.id, lockedDeskId, attemptedDeskId: deskId, strictRule: true, rule: 'ONE_DEVICE_ONE_DESK', phase: 'qr' });
        return showMessage("Bu Cihazda Zaten Masa Var", `Aynı cihaz üzerinden yalnızca 1 masa kullanılabilir. Bu cihazda Masa ${lockedDeskId} başka bir kullanıcı adına ${lockType}.`, "danger");
    }
    
    if (freshUser && freshUser.strikes >= settings.strikeLimit) {
        setScannerConfig({isOpen: false, mode: null});
        return showMessage("Erişim Engellendi", "Günlük ihlal limitini doldurduğunuz için bugün masa alamazsınız.", "danger");
    }

    const nowTime = Date.now();

    // Masa boşsa ilk kişi ana kullanıcı olur. Masa doluysa ve misafir yeri boşsa ikinci kişi misafir olur.
    if (desk.status === 'available') {
      let claimed = null;
      if (db) {
        if (!fbUser || !navigator.onLine || Date.now() < quotaBackoffUntilRef.current) return showMessage('Bağlantı Bekleniyor', 'QR doğrulaması için sunucu bağlantısı gerekli.', 'warning');
        if (deskActionInFlightRef.current) return;
        deskActionInFlightRef.current = true;
        try {
          claimed = await runStudentDeskAction('claim', { deskId, deviceId, qrCode: qrData });
          applyCloudRows(claimed);
        } catch (error) { handleFirestoreQuotaError(error); return showMessage('Masa Alınamadı', error.message, 'warning'); }
        finally { deskActionInFlightRef.current = false; }
        if (claimed.alreadyApplied) { setScannerConfig({ isOpen: false, mode: null }); return; }
      }
      const nextDesks = claimed ? desksRef.current : safeDesks.map(d => d.id === deskId ? {
        ...d, status: 'occupied', occupant: currentUser.id, ownerDeviceId: deviceId, sessionStartTime: nowTime,
        pendingOccupant: null, pendingDeskRole: null, pendingDeskDeadline: null
      } : d);
      const nextUsers = claimed ? usersRef.current : safeUsers.map(u => u.id === currentUser.id ? {
        ...u, activeDeskId: deskId, activeDeskRole: 'owner', deviceId: deviceId, lastActiveTime: nowTime,
        pendingDeskId: null, pendingDeskDeadline: null
      } : u);
      criticalDeskMutationRef.current = true;
      desksRef.current = nextDesks;
      usersRef.current = nextUsers;
      confirmedDeskGuardRef.current = { userId: currentUser.id, deskId, role: 'owner', deviceId, confirmedAt: nowTime, expiresAt: nowTime + 30000 };
      pendingReservationGuardRef.current = null;
      setDesks(nextDesks);
      setUsers(nextUsers);
      setCurrentUser(prev => ({...prev, ...(_optionalChain([claimed, 'optionalAccess', _374 => _374.user]) || {}), activeDeskId: deskId, activeDeskRole: 'owner', pendingDeskId: null, pendingDeskDeadline: null}));
      setSelectedDeskId(null);
      setDeskSelectionDeadline(null);
      addLog('MASA_ALINDI', `Masa ${deskId} başarıyla alındı.`, deskId, currentUser.id);
      addLog('MASAYA_GECTI', `Masa ${deskId} için 5 dakikalık rezervasyon QR doğrulamasıyla tamamlandı. Öğrenci masaya geçti ve ana kullanıcı oturumu başlatıldı.`, deskId, currentUser.id, false, null, { deskRole: 'owner', confirmedAt: nowTime });
      setScannerConfig({isOpen:false, mode:null});
      return showMessage("Başarılı", `Masa ${deskId} kullanımınıza açıldı.`, "success");
    }

    if (false) { // Misafir oturumu artık kullanıma kapalı.
      // QR doğrulama aşamasında ikinci güvenlik kontrolü:
      // Ana kullanıcının masayı aldığı cihaz ile misafir kullanıcının cihazı aynıysa işlem kesinlikle tamamlanmaz.
      const ownerUserAtQr = safeUsers.find(u => u.id === desk.occupant);
      const ownerDeviceIdAtQr = desk.ownerDeviceId || _optionalChain([ownerUserAtQr, 'optionalAccess', _375 => _375.deviceId]) || null;

      if (ownerDeviceIdAtQr && ownerDeviceIdAtQr === deviceId) {
        setScannerConfig({isOpen:false, mode:null});
        setDesks(prev => Array.isArray(prev) ? prev.map(d =>
          d.id === deskId && d.pendingOccupant === currentUser.id
            ? { ...d, pendingOccupant: null, pendingDeskRole: null, pendingDeskDeadline: null }
            : d
        ) : []);
        setUsers(prev => Array.isArray(prev) ? prev.map(u =>
          u.id === currentUser.id ? { ...u, pendingDeskId: null, pendingDeskDeadline: null } : u
        ) : []);
        setCurrentUser(prev => prev ? { ...prev, pendingDeskId: null, pendingDeskDeadline: null } : prev);
        setSelectedDeskId(null);
        setDeskSelectionDeadline(null);
        addLog(
          'AYNI_CIHAZDAN_MISAFIR_GIRISI_ENGELLENDI',
          `QR doğrulama sırasında Masa ${deskId} ana kullanıcısının kullandığı aynı cihazdan misafir kullanıcı girişi engellendi.`,
          deskId,
          currentUser.id,
          false,
          null,
          {
            deviceId,
            ownerUserId: desk.occupant,
            ownerDeviceId: ownerDeviceIdAtQr,
            attemptedGuestUserId: currentUser.id,
            strictRule: true,
            rule: 'OWNER_DEVICE_CANNOT_JOIN_AS_GUEST',
            phase: 'qr'
          }
        );
        return showMessage(
          "Aynı Cihazdan Misafir Girişi Yasak",
          `Masa ${deskId} ana kullanıcısı bu cihazdan giriş yaptı. Misafir kullanıcı olarak aynı masaya katılmak için farklı bir cihaz kullanmalısınız.`,
          "danger"
        );
      }

      const nextDesks = safeDesks.map(d => d.id === deskId ? {
        ...d, guestOccupant: currentUser.id, guestSessionStartTime: nowTime, guestBreakEndTime: null, guestReported: false, guestReportEndTime: null,
        pendingOccupant: null, pendingDeskRole: null, pendingDeskDeadline: null
      } : d);
      const nextUsers = safeUsers.map(u => u.id === currentUser.id ? {
        ...u, activeDeskId: deskId, activeDeskRole: 'guest', deviceId: deviceId, lastActiveTime: nowTime,
        pendingDeskId: null, pendingDeskDeadline: null
      } : u);
      criticalDeskMutationRef.current = true;
      desksRef.current = nextDesks;
      usersRef.current = nextUsers;
      confirmedDeskGuardRef.current = { userId: currentUser.id, deskId, role: 'guest', deviceId, confirmedAt: nowTime, expiresAt: nowTime + 30000 };
      pendingReservationGuardRef.current = null;
      setDesks(nextDesks);
      setUsers(nextUsers);
      setCurrentUser(prev => ({...prev, activeDeskId: deskId, activeDeskRole: 'guest', pendingDeskId: null, pendingDeskDeadline: null}));
      setSelectedDeskId(null);
      setDeskSelectionDeadline(null);
      addLog('MISAFIR_KATILDI', `Masa ${deskId} için ikinci kullanıcı misafir olarak QR kod ile katıldı.`, deskId, currentUser.id);
      addLog('MASAYA_GECTI', `Masa ${deskId} için 5 dakikalık rezervasyon QR doğrulamasıyla tamamlandı. Öğrenci masaya geçti ve misafir oturumu başlatıldı.`, deskId, currentUser.id, false, null, { deskRole: 'guest', confirmedAt: nowTime });
      setScannerConfig({isOpen:false, mode:null});
      return showMessage("Misafir Olarak Katıldınız", `Masa ${deskId} dolu olduğu için ikinci kullanıcı olarak MİSAFİR kaydınız açıldı.`, "success");
    }

    setScannerConfig({isOpen: false, mode: null});
    return showMessage("İşlem Başarısız", "Bu masa şu anda kullanıma uygun değil. Her masa yalnızca bir öğrenci tarafından kullanılabilir.", "danger");
  };

  const releaseDeskBusyRef = useRef(false);
  const releaseDesk = () => {
    if (!currentUser) return;
    const latestUser = usersRef.current.find(u => u.id === currentUser.id);
    const activeId = _optionalChain([latestUser, 'optionalAccess', _376 => _376.activeDeskId]) || currentUser.activeDeskId;
    const ownedDesk = desksRef.current.find(d => Number(d.id) === Number(activeId) &&
      (d.occupant === currentUser.id || d.guestOccupant === currentUser.id)) ||
      desksRef.current.find(d => d.occupant === currentUser.id || d.guestOccupant === currentUser.id);
    const releaseDeskId = _optionalChain([ownedDesk, 'optionalAccess', _377 => _377.id]) || activeId;
    if (!releaseDeskId) return showMessage('Masa Bilgisi', 'Aktif masa kaydı bulunamadı. Güncel masa bilgilerini kontrol edin.', 'warning');

    setModal({
        isOpen: true,
        title: "Masayı Bırak",
        type: 'warning',
        content: (
            React.createElement('div', { className: "space-y-4", __self: this, __source: {fileName: _jsxFileName, lineNumber: 5252}}
                , React.createElement('p', { className: "text-slate-600 font-medium" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 5253}}, "Masa kullanımınızı tamamen sonlandırmak istediğinize emin misiniz? (Bu işlem masayı diğer kullanıcılara açar. 30 dakika boyunca yeniden masa alamazsınız; sistem hatasında yönetici masa atayabilir.)"                       )
                , React.createElement('div', { className: "flex gap-3" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 5254}}
                    , React.createElement('button', { onClick: closeMessage, className: "flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 5255}}, "İptal")
                    , React.createElement('button', { onClick: async () => {
                        const leavingUserId = currentUser.id;
                        const deskId = releaseDeskId;
                        const nowTime = Date.now();

                        if (db) {
                          if (releaseDeskBusyRef.current) return;
                          releaseDeskBusyRef.current = true;
                          setModal({ isOpen: true, type: 'info', title: 'Masa Bırakılıyor',
                            content: 'İşlem sunucuda doğrulanıyor. Lütfen bekleyin; bağlantı kesilirse güvenli şekilde tekrar denenecek.' });
                          try {
                            const result = await runStudentDeskAction('leave', { deskId });
                            const leaveMode = _optionalChain([result, 'optionalAccess', _378 => _378.leaveMode]) || _optionalChain([result, 'optionalAccess', _379 => _379.mode]);
                            const staleSession = leaveMode === 'stale_session_cleared';
                            const alreadyGone = leaveMode === 'already_not_here';
                            const penaltyFree = _optionalChain([result, 'optionalAccess', _380 => _380.penaltyFree]) === true;
                            const returnedDesk = _optionalChain([result, 'optionalAccess', _381 => _381.desk]) || _optionalChain([result, 'optionalAccess', _382 => _382.desks, 'optionalAccess', _383 => _383.find, 'call', _384 => _384(d => Number(d.id) === Number(deskId))]);
                            if (!staleSession && !alreadyGone && !returnedDesk) {
                              throw new Error('Sunucu masa bırakma işleminin güncel masa kaydını döndürmedi. İşlem doğrulanamadı.');
                            }
                            if (_optionalChain([returnedDesk, 'optionalAccess', _385 => _385.occupant]) === leavingUserId || _optionalChain([returnedDesk, 'optionalAccess', _386 => _386.guestOccupant]) === leavingUserId) {
                              throw new Error('Sunucu kaydında masa hâlâ hesabınıza bağlı. Masa bırakma işlemi tamamlanmadı.');
                            }
                            if ((staleSession || alreadyGone) && _optionalChain([result, 'optionalAccess', _387 => _387.user, 'optionalAccess', _388 => _388.id]) !== leavingUserId) {
                              throw new Error('Eski masa kaydı sunucuda doğrulanamadı. Tekrar deneyin.');
                            }
                            applyCloudRows(result);
                            confirmedDeskGuardRef.current = null;
                            pendingReservationGuardRef.current = null;
                            setSelectedDeskId(null);
                            setDeskSelectionDeadline(null);
                            setScannerConfig({ isOpen: false, mode: null, title: '' });
                            // Sadece GERÇEKTEN bırakılan masalar için 45 sn'lik
                            // görünüm koruması ve 30 dk bekleme kaydı uygulanır.
                            releasedDeskGuardRef.current = staleSession || alreadyGone ? null : {
                              userId: leavingUserId,
                              deskId: Number(deskId),
                              mode: leaveMode || 'desk_empty',
                              releasedAt: result.at || nowTime,
                              expiresAt: (result.at || nowTime) + 45000
                            };
                            if (!staleSession && !alreadyGone && !penaltyFree) {
                              addLog('MASA_BIRAKILDI', `Masa ${deskId} isteyerek bırakıldı. Masa ve bekleyen rezervasyon kayıtları temizlendi.`, deskId, leavingUserId);
                              addLog('MASA_BEKLEME_BASLADI', 'Masa bırakıldı; 30 dakikalık yeniden masa alma bekleme süresi başladı.', deskId, leavingUserId);
                            }
                            closeMessage();
                            setView('student_dash');
                            setTimeout(() => showMessage(
                              'Başarılı',
                              penaltyFree
                                ? 'Kapanış saatinde masanız cezasız boşaltıldı. Hesabınız açık kalır.'
                                : staleSession
                                  ? 'Önceki günden kalan eski masa bağlantınız temizlendi. Yeni masa seçebilirsiniz; hesabınız açık kalır.'
                                : alreadyGone
                                  ? 'Bu masa artık hesabınıza bağlı değil. Mevcut masa bilgileriniz güncellendi.'
                                  : leaveMode === 'desk_empty'
                                    ? 'Masanızı bıraktınız. 30 dakika sonra aynı masayı yeniden alabilirsiniz; farklı uygun bir masa seçebilirsiniz.'
                                    : 'Masa oturumunuz sonlandırıldı. Sistem durumu senkronize edildi.',
                              'success'
                            ), 300);
                          } catch (error) {
                            handleFirestoreQuotaError(error);
                            showMessage('Masa Bırakılamadı', error.message, 'warning');
                          } finally {
                            releaseDeskBusyRef.current = false;
                          }
                          return;
                        }

                        const liveDesks = Array.isArray(desksRef.current) ? desksRef.current : [];
                        const liveUsers = Array.isArray(usersRef.current) ? usersRef.current : [];
                        const currentDesk = liveDesks.find(d => Number(d.id) === Number(deskId));
                        const currentRole = currentUser.activeDeskRole || (_optionalChain([currentDesk, 'optionalAccess', _389 => _389.guestOccupant]) === leavingUserId ? 'guest' : 'owner');

                        /*
                         * MASA BIRAKMA KRİTİK TEMİZLİĞİ
                         * 1) Masa alınırken kullanılan 30 sn "dolu tut" koruması anında iptal edilir.
                         * 2) Masa / kullanıcı bilgileri önce Ref üzerinde senkron olarak temizlenir.
                         * 3) Ardından 45 sn "bırakıldı" koruması açılır.
                         * Böylece gecikmiş Firestore snapshot'ı yönetici panelinde
                         * BOŞ / ÖĞRENCİ MASADA şeklinde yanıp sönme oluşturamaz.
                         */
                        confirmedDeskGuardRef.current = null;
                        pendingReservationGuardRef.current = null;

                        setSelectedDeskId(null);
                        setDeskSelectionDeadline(null);
                        setScannerConfig({ isOpen: false, mode: null, title: '' });

                        let releaseMode = 'desk_empty';
                        let promotedId = null;
                        let promotedSessionStartTime = null;

                        let nextDesks = liveDesks.map(d => {
                          const clearOwnPending = d.pendingOccupant === leavingUserId;

                          if (Number(d.id) !== Number(deskId)) {
                            return clearOwnPending
                              ? { ...d, pendingOccupant: null, pendingDeskRole: null, pendingDeskDeadline: null }
                              : d;
                          }

                          if (currentRole === 'guest') {
                            // Misafir ayrılır; ana kullanıcı masada kalır.
                            releaseMode = 'guest_left';
                            return {
                              ...d,
                              guestOccupant: null,
                              guestSessionStartTime: null,
                              guestBreakEndTime: null,
                              guestReported: false,
                              guestReportEndTime: null,
                              guestReportIssuedAt: null,
                              guestReportVerifiedAt: null,
                              ...(clearOwnPending ? {
                                pendingOccupant: null,
                                pendingDeskRole: null,
                                pendingDeskDeadline: null
                              } : {})
                            };
                          }

                          if (_optionalChain([currentDesk, 'optionalAccess', _390 => _390.guestOccupant])) {
                            // Ana kullanıcı ayrılır; misafir ana kullanıcıya terfi eder.
                            releaseMode = 'owner_promoted_guest';
                            promotedId = currentDesk.guestOccupant;
                            promotedSessionStartTime = currentDesk.guestSessionStartTime || nowTime;

                            return {
                              ...d,
                              occupant: promotedId,
                              ownerDeviceId: _optionalChain([liveUsers, 'access', _391 => _391.find, 'call', _392 => _392(u => u.id === promotedId), 'optionalAccess', _393 => _393.deviceId]) || null,
                              sessionStartTime: promotedSessionStartTime,
                              status: 'occupied',
                              breakEndTime: null,
                              reportEndTime: null,
                              reportIssuedAt: null,
                              reportVerifiedAt: null,
                              guestOccupant: null,
                              guestSessionStartTime: null,
                              guestBreakEndTime: null,
                              guestReported: false,
                              guestReportEndTime: null,
                              guestReportIssuedAt: null,
                              guestReportVerifiedAt: null,
                              pendingOccupant: null,
                              pendingDeskRole: null,
                              pendingDeskDeadline: null
                            };
                          }

                          // Masada başka kullanıcı yoksa masa tamamen boşaltılır.
                          releaseMode = 'desk_empty';
                          return {
                            ...d,
                            status: d.status === 'disabled' ? 'disabled' : 'available',
                            occupant: null,
                            ownerDeviceId: null,
                            sessionStartTime: null,
                            breakEndTime: null,
                            reportEndTime: null,
                            reportIssuedAt: null,
                            reportVerifiedAt: null,
                            guestOccupant: null,
                            guestSessionStartTime: null,
                            guestBreakEndTime: null,
                            guestReported: false,
                            guestReportEndTime: null,
                            guestReportIssuedAt: null,
                            guestReportVerifiedAt: null,
                            pendingOccupant: null,
                            pendingDeskRole: null,
                            pendingDeskDeadline: null
                          };
                        });

                        let nextUsers = liveUsers.map(u => {
                          if (u.id === leavingUserId) {
                            return {
                              ...u,
                              activeDeskId: null,
                              activeDeskRole: null,
                              pendingDeskId: null,
                              pendingDeskDeadline: null,
                              lastActiveTime: nowTime,
                              deskReleasedAt: nowTime, deskReclaimAllowedAt: nowTime + DESK_RECLAIM_WAIT_MS, gmDeskAccessAt: nowTime
                            };
                          }

                          if (promotedId && u.id === promotedId) {
                            return {
                              ...u,
                              activeDeskId: deskId,
                              activeDeskRole: 'owner',
                              lastActiveTime: nowTime
                            };
                          }

                          return u;
                        });

                        // KRİTİK: Bu gerçek bir yerel masa bırakma işlemidir.
                        // Snapshot aynı anda gelse bile Firestore'a mutlaka yazılmalıdır.
                        criticalDeskMutationRef.current = true;

                        // KRİTİK: React state kuyruğunu beklemeden canlı Ref'leri anında güncelle.
                        // onSnapshot aynı milisaniyede çalışsa bile eski dolu durumu göremez.
                        desksRef.current = nextDesks;
                        usersRef.current = nextUsers;

                        releasedDeskGuardRef.current = {
                          userId: leavingUserId,
                          deskId: Number(deskId),
                          mode: releaseMode,
                          promotedUserId: promotedId,
                          promotedSessionStartTime,
                          releasedAt: nowTime,
                          expiresAt: nowTime + 45000
                        };

                        setDesks(nextDesks);
                        setUsers(nextUsers);

                        setCurrentUser(prev => prev ? ({
                          ...prev,
                          activeDeskId: null,
                          activeDeskRole: null,
                          pendingDeskId: null,
                          pendingDeskDeadline: null,
                          lastActiveTime: nowTime,
                          deskReleasedAt: nowTime, deskReclaimAllowedAt: nowTime + DESK_RECLAIM_WAIT_MS, gmDeskAccessAt: nowTime
                        }) : prev);

                        if (releaseMode === 'guest_left') {
                          addLog('MISAFIR_AYRILDI', `Masa ${deskId} misafiri oturumunu sonlandırdı.`, deskId, leavingUserId);
                        } else if (releaseMode === 'owner_promoted_guest') {
                          addLog('MISAFIR_ANA_KULLANICI', `Masa ${deskId} ana kullanıcısı ayrıldığı için misafir ana kullanıcı olarak devam etti.`, deskId, promotedId);
                        } else {
                          addLog('MASA_BIRAKILDI', `Masa ${deskId} isteyerek bırakıldı. Masa ve bekleyen rezervasyon kayıtları tamamen temizlendi.`, deskId, leavingUserId);
                        }

                        addLog(
                          'MASA_BIRAKMA_TEMIZLIK',
                          `Kullanıcının Masa ${deskId} oturumu sonlandırıldı; aktif masa ve bekleyen masa rezervasyonu temizlendi. Firestore eski snapshot koruması devreye alındı.`,
                          deskId,
                          leavingUserId,
                          false,
                          null,
                          { releaseMode, releasedAt: nowTime }
                        );

                        closeMessage();
                        setView('student_dash');
                        addLog('MASA_BEKLEME_BASLADI', 'Masa bırakıldı; 30 dakikalık yeniden masa alma bekleme süresi başladı.', deskId, leavingUserId);
                        setTimeout(() => showMessage(
                          "Başarılı",
                          releaseMode === 'desk_empty'
                            ? "Masanızı bıraktınız. Yalnızca bu masayı 30 dakika sonra alabilirsiniz; başka boş masaları hemen seçebilirsiniz."
                            : "Masa oturumunuz sonlandırıldı. Sistem durumu senkronize edildi.",
                          "success"
                        ), 300);
                    }, className: "flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md transition-colors"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 5256}}, "Eminim, Bırak" )
                )
            )
        )
    });
  };

  const startBreak = async (type, confirmed = false) => {
    if (!confirmed) {
      setModal({ isOpen: true, type: 'info', title: 'Mola Onayı', content: (
        React.createElement('div', { className: "space-y-4", __self: this, __source: {fileName: _jsxFileName, lineNumber: 5527}}
          , React.createElement('p', { className: "text-center font-semibold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 5528}}, "Molaya çıkmak istiyor musunuz?"   )
          , React.createElement('div', { className: "grid grid-cols-2 gap-3"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 5529}}
            , React.createElement('button', { type: "button", className: "p-3 bg-slate-200 rounded-xl font-bold"   , onClick: closeMessage, __self: this, __source: {fileName: _jsxFileName, lineNumber: 5530}}, "Hayır")
            , React.createElement('button', { type: "button", className: "p-3 bg-amber-500 rounded-xl font-bold"   , onClick: () => { closeMessage(); startBreak(type, true); }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 5531}}, "Evet")
          )
        )
      ) });
      return;
    }
    if (!currentUser || !currentUser.activeDeskId) return;
    const safeUsers = Array.isArray(users) ? users : [];
    const myUser = safeUsers.find(u => u.id === currentUser.id);
    if (!myUser) return;
    
    if (type === 'hourly' && !isHourlyBreakAvailable(settings, now + serverTimeOffsetMs)) return showMessage('Mola Kullanılamıyor', '1 Saatlik Mola yalnızca cuma günleri aktiftir.', 'warning');
    if (Number(_optionalChain([myUser, 'access', _394 => _394.breaks, 'optionalAccess', _395 => _395[type]]) || 0) <= 0) return showMessage("Uyarı", "Bu mola hakkınız tükenmiş.", "warning");

    const lastActive = Number(myUser.lastActiveTime || 0);
    // Peş peşe mola kullanımını engelle: her mola arasında en az 30 dk aktif çalışma zorunlu.
    // Yönetici daha yüksek bir değer belirlerse o değer uygulanır; 30 dakikanın altına düşmez.
    const configuredCooldown = Number.isFinite(Number(settings.breakCooldown)) ? Number(settings.breakCooldown) : 30;
    const requiredWorkMinutes = Math.max(30, configuredCooldown);
    const cooldownMs = requiredWorkMinutes * 60 * 1000;
    if (now - lastActive < cooldownMs) {
        const remainingMs = cooldownMs - (now - lastActive);
        const remainingMin = Math.ceil(remainingMs / 60000);
        const breakLabel = type === 'short' ? 'Kısa mola' : type === 'hourly' ? '1 Saatlik Mola' : 'Uzun mola';
        return showMessage(
          `${breakLabel} İçin Çalışma Süresi`,
          `${breakLabel} kullanabilmek için toplam ${requiredWorkMinutes} dakika aktif ders çalışmanız gerekiyor. Şu anda ${remainingMin} dakika daha çalışmalısınız.`,
          "warning"
        );
    }

    const durationStr = allowedBreakDuration(settings, type);
    if (durationStr === null) return showMessage('Mola Ayarı Hatası', 'YP panelinde mola süresini kontrol edin.', 'warning');
    const durationMs = durationStr * 60 * 1000;

    const myRole = myUser.activeDeskRole || 'owner';
    if (db) {
      try {
        const result = await runStudentDeskAction('break-start', { deskId: currentUser.activeDeskId, type, requestId: (crypto.randomUUID ? crypto.randomUUID() : `MOLA-${Date.now()}-${generateId()}`) });
        if (Number.isFinite(Number(result.at))) { setServerTimeOffsetMs(Number(result.at) - Date.now()); setServerClockVerified(true); }
        applyCloudRows(result);
      } catch (error) {
        handleFirestoreQuotaError(error);
        return showMessage('Mola Başlatılamadı', error.message, 'warning');
      }
    } else {
      setDesks(prev => Array.isArray(prev) ? prev.map(d => d.id === currentUser.activeDeskId
        ? (myRole === 'guest'
            ? { ...d, guestBreakEndTime: Date.now() + durationMs }
            : { ...d, status: 'on_break', breakEndTime: Date.now() + durationMs })
        : d) : []);
      setUsers(prev => Array.isArray(prev) ? prev.map(u => u.id === currentUser.id ? { ...u, breaks: { ...u.breaks, [type]: u.breaks[type] - 1 } } : u) : []);
    }
    
    addLog('MOLA_BAŞLADI', `${myRole === 'guest' ? 'Misafir - ' : ''}${type === 'short' ? 'Kısa' : type === 'hourly' ? '1 Saatlik' : 'Uzun'} mola başlatıldı.`, currentUser.activeDeskId, currentUser.id);
  };

  const returnFromBreak = async (qrData) => {
    if (!currentUser || !currentUser.activeDeskId) {
      setScannerConfig({ isOpen: false, mode: null });
      return showMessage("Hata", "Aktif masa bilginiz bulunamadı.", "danger");
    }

    const parts = String(qrData || '').split('-');
    if (parts.length < 3) {
      setScannerConfig({ isOpen: false, mode: null });
      return showMessage("Hata", "Geçersiz QR Kod.", "danger");
    }

    const deskId = parseInt(parts[1]);
    const safeDesks = Array.isArray(desksRef.current) ? desksRef.current : [];
    const myDesk = safeDesks.find(d => d.id === currentUser.activeDeskId);
    const myFreshUser = (Array.isArray(usersRef.current) ? usersRef.current : []).find(u => u.id === currentUser.id);
    const myRole = _optionalChain([myFreshUser, 'optionalAccess', _396 => _396.activeDeskRole]) || currentUser.activeDeskRole || 'owner';

    if (myRole === 'guest') {
      if (!myDesk || !myDesk.guestBreakEndTime) {
        setScannerConfig({ isOpen: false, mode: null });
        return showMessage("Uyarı", "Misafir oturumunuz şu anda mola durumunda değil.", "warning");
      }
      if (deskId !== currentUser.activeDeskId || qrData !== myDesk.qrCode) {
        setScannerConfig({ isOpen: false, mode: null });
        return showMessage("Hata", "Moladan dönmek için bulunduğunuz masanın güncel karekodunu okutmalısınız.", "danger");
      }
      if (db) {
        try {
          const result = await runStudentDeskAction('break-end', { deskId: currentUser.activeDeskId, qrCode: qrData });
          applyCloudRows(result);
        } catch (error) {
          handleFirestoreQuotaError(error);
          return showMessage('Moladan Dönülemedi', error.message, 'warning');
        }
      } else {
        setDesks(prev => Array.isArray(prev) ? prev.map(d => d.id === currentUser.activeDeskId ? { ...d, guestBreakEndTime: null } : d) : []);
        setUsers(prev => Array.isArray(prev) ? prev.map(u => u.id === currentUser.id ? { ...u, lastActiveTime: Date.now() } : u) : []);
      }
      addLog('MOLA_BİTTİ', `Misafir kullanıcı masa QR kodunu okutarak moladan erken döndü.`, currentUser.activeDeskId, currentUser.id);
      setScannerConfig({ isOpen: false, mode: null });
      return showMessage("Hoş Geldiniz", "QR doğrulandı. Misafir molanız sonlandırıldı.", "success");
    }

    if (!myDesk || myDesk.status !== 'on_break') {
      setScannerConfig({ isOpen: false, mode: null });
      return showMessage("Uyarı", "Masanız şu anda mola durumunda değil.", "warning");
    }

    if (deskId !== currentUser.activeDeskId || qrData !== myDesk.qrCode) {
      setScannerConfig({ isOpen: false, mode: null });
      return showMessage("Hata", "Moladan dönmek için kendi masanızdaki güncel karekodu okutmalısınız.", "danger");
    }

    if (db) {
      try {
        const result = await runStudentDeskAction('break-end', { deskId: currentUser.activeDeskId, qrCode: qrData });
        applyCloudRows(result);
      } catch (error) {
        handleFirestoreQuotaError(error);
        return showMessage('Moladan Dönülemedi', error.message, 'warning');
      }
    } else {
      setDesks(prev => Array.isArray(prev) ? prev.map(d =>
        d.id === currentUser.activeDeskId
          ? { ...d, status: 'occupied', breakEndTime: null }
          : d
      ) : []);

      setUsers(prev => Array.isArray(prev) ? prev.map(u =>
        u.id === currentUser.id
          ? { ...u, lastActiveTime: Date.now() }
          : u
      ) : []);
    }

    addLog('MOLA_BİTTİ', `Öğrenci kendi masasının QR kodunu okutarak moladan erken döndü.`, currentUser.activeDeskId, currentUser.id);
    setScannerConfig({ isOpen: false, mode: null });
    showMessage("Hoş Geldiniz", "QR doğrulandı. Molanız sonlandırıldı ve masanız tekrar aktif edildi.", "success");
  };

  const promptReportDesk = (deskId) => {
    const myUser = requireStudentAction('Boş masa ihbarı');
    if (!myUser) return;
    if (settings.reportsEnabled === false) return showMessage('İhbar Kapalı', 'Boş masa ihbarları sistem genelinde kapalıdır.', 'warning');
    if (myUser.canReport === false) return showMessage('İhbar Yetkisi Kapalı', 'Hesabınızın ihbar yetkisi kapalıdır. Kütüphane sorumlusu kullanıcı düzenleme ekranından bu yetkiyi açabilir.', 'warning');
    const safeUsers = Array.isArray(usersRef.current) ? usersRef.current : [];

    const safeDesks = Array.isArray(desks) ? desks : [];
    const desk = safeDesks.find(d => Number(d.id) === Number(deskId));
    if(!desk) return showMessage("Uyarı", "Masa bulunamadı.", "warning");
    if (desk.status === 'on_break' && Number(desk.breakEndTime || 0) > Date.now()) return showMessage('Masa Molada', 'Resmî mola süresi bitmeden masa ihbar edilemez.', 'info');
    if(desk.status === 'disabled' || !desk.occupant) return showMessage("Uyarı", "Bu masada ihbar edilebilecek aktif kullanıcı bulunmuyor.", "warning");
    if(deskId === currentUser.activeDeskId) return showMessage("Uyarı", "Kendi bulunduğunuz masadaki kişileri ihbar edemezsiniz.", "warning");

    // Öğrenci yalnızca kendi hesap belgesini okur. Hedef kimliği masa kaydından gelir;
    // diğer öğrencilerin özel hesap bilgilerini indirmek gerekmez.
    const owner = safeUsers.find(u => u.id === desk.occupant) || { id: desk.occupant, name: 'Masa kullanıcısı' };
    const guest = desk.guestOccupant ? (safeUsers.find(u => u.id === desk.guestOccupant) || { id: desk.guestOccupant, name: 'Misafir kullanıcı' }) : null;

    const openFormFor = (targetRole) => {
      const target = targetRole === 'guest' ? guest : owner;
      if (!target) return;
      if (targetRole === 'owner' && desk.status === 'on_break' && Number(desk.breakEndTime || 0) > Date.now()) return showMessage("Bilgi", "Ana kullanıcı resmi molada; mola bitmeden ihbar edilemez.", 'info');
      if (targetRole === 'guest' && desk.guestBreakEndTime && desk.guestBreakEndTime > Date.now()) return showMessage("Bilgi", "Misafir kullanıcı şu anda resmi mola durumunda; mola bitmeden ihbar edilemez.", "info");
      setReportFormContext({ deskId, targetRole, targetUserId: target.id });
      setModal({
        isOpen: true,
        title: `Masa ${deskId} - ${targetRole === 'guest' ? 'Misafir' : 'Ana Kullanıcı'} Boş Mu?`,
        content: React.createElement(ReportForm, { deskId: deskId, reporter: currentUser, onSubmit: (id, name, identityNo) => handleReportSubmit(id, name, identityNo, targetRole, target.id), onCancel: closeMessage, __self: this, __source: {fileName: _jsxFileName, lineNumber: 5697}} )
      });
    };

    if (guest) {
      setModal({
        isOpen: true,
        title: `Masa ${deskId} - Kimi İhbar Edeceksiniz?`,
        type: 'warning',
        content: (
          React.createElement('div', { className: "space-y-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 5707}}
            , React.createElement('p', { className: "text-sm text-slate-600" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 5708}}, "Bu masada iki kullanıcı kayıtlı. Masada bulunmayan kişiyi seçin."        )
            , React.createElement('button', { onClick: () => openFormFor('owner'), className: "w-full p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-xl font-bold text-left"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 5709}}, "Ana Kullanıcı: "  , _optionalChain([owner, 'optionalAccess', _397 => _397.name]) || 'Bilinmiyor')
            , React.createElement('button', { onClick: () => openFormFor('guest'), className: "w-full p-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 rounded-xl font-bold text-left"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 5710}}, "Misafir: " , guest.name)
            , React.createElement('button', { onClick: closeMessage, className: "w-full p-3 bg-slate-100 text-slate-700 rounded-xl font-bold"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 5711}}, "İptal")
          )
        )
      });
    } else {
      openFormFor('owner');
    }
  };

  const handleReportSubmit = async (deskId, name, identityNo, targetRole = 'owner', targetUserId = null) => {
    const freshReporter = requireStudentAction('Boş masa ihbarı gönderme');
    if (!freshReporter) return;
    if (freshReporter.canReport === false || settings.reportsEnabled === false) return showMessage('İhbar Kapalı', 'İhbar etme yetkisi kapalıdır.', 'warning');
    // İHBAR EDEN KİŞİ KAYIT KONTROLÜ:
    // İhbar gönderebilmek için girilen ad-soyad ve kimlik numarası AYNI kayıtlı kullanıcıyla eşleşmelidir.
    // Böylece rastgele / uydurma bilgilerle ihbar oluşturulamaz.
    const registeredUsers = Array.isArray(usersRef.current) ? usersRef.current : [];
    const registeredReporter = freshReporter;
    name = registeredReporter.name;
    identityNo = registeredReporter.specialCode;
    const reportedDesk = (desksRef.current || []).find(d => Number(d.id) === Number(deskId));
    const occupantId = targetRole === 'guest' ? _optionalChain([reportedDesk, 'optionalAccess', _398 => _398.guestOccupant]) : _optionalChain([reportedDesk, 'optionalAccess', _399 => _399.occupant]);
    if (!reportedDesk || !occupantId || occupantId !== targetUserId || occupantId === freshReporter.id ||
        reportedDesk.status === 'disabled' || (targetRole === 'owner' && (reportedDesk.status === 'reported' ||
          (reportedDesk.status === 'on_break' && Number(reportedDesk.breakEndTime || 0) > Date.now()))) ||
        (targetRole === 'guest' && (reportedDesk.guestReported || Number(reportedDesk.guestBreakEndTime || 0) > Date.now()))) {
      return showMessage('İhbar Gönderilemedi', 'Masa durumu değişti veya bu kullanıcı için ihbar uygun değil.', 'warning');
    }

    let reportWaitMinutes = 5;
    const waitTimeMs = reportWaitMinutes * 60 * 1000;
    const notificationTargetUserId = targetUserId || currentUser.id;
    const reportIssuedAt = Date.now();

    let reportLog = null;

    if (targetRole === 'guest') {
      if (db) return showMessage('İhbar Gönderilemedi', 'Misafir oturumları için ihbar işlemi artık desteklenmiyor.', 'warning');
      setDesks(prev => Array.isArray(prev) ? prev.map(d => d.id === deskId ? { ...d, guestReported: true, guestReportIssuedAt: reportIssuedAt, guestReportVerifiedAt: null, guestReportEndTime: reportIssuedAt + waitTimeMs } : d) : []);
      reportLog = addLog('İHBAR_MISAFIR', `Masa ${deskId} misafir kullanıcısı masada bulunmadığı gerekçesiyle ihbar edildi. Bildiren: ${name} (${identityNo})`, deskId, notificationTargetUserId);

      // Mevcut ihbar akışını değiştirmeden hedef misafir kullanıcının telefonuna gerçek push gönder.
      sendServerPush({
        userId: notificationTargetUserId,
        title: '🚨 Masa İhbarı!',
        body: `Masa ${deskId} üzerindeki misafir oturumunuz masada bulunmadığınız gerekçesiyle ihbar edildi. ${reportWaitMinutes} dakika içinde masanıza dönüp QR kod ile doğrulama yapın.`,
        type: 'İHBAR_MISAFIR',
        deskId,
        logId: _optionalChain([reportLog, 'optionalAccess', _400 => _400.id]) || null
      });
    } else {
      let reportEventId;
      if (db) {
        try {
          const result = await runStudentDeskAction('report', { deskId, targetUserId: notificationTargetUserId });
          reportWaitMinutes = result.waitMinutes || reportWaitMinutes;
          reportEventId = result.eventId;
          applyCloudRows(result);
        } catch (error) {
          handleFirestoreQuotaError(error);
          return showMessage('İhbar Gönderilemedi', error.message, 'warning');
        }
      } else {
        setDesks(prev => Array.isArray(prev) ? prev.map(d => d.id === deskId ? { ...d, status: 'reported', reportIssuedAt, reportVerifiedAt: null, reportEndTime: reportIssuedAt + waitTimeMs } : d) : []);
      }
      reportLog = addLog('İHBAR', `Masa ${deskId} ana kullanıcısı masada bulunmadığı gerekçesiyle ihbar edildi. Bildiren: ${name} (${identityNo})`, deskId, notificationTargetUserId, false, null, reportEventId ? { eventId: reportEventId } : null);

      // Mevcut ihbar akışını değiştirmeden masa sahibinin telefonuna gerçek push gönder.
      sendServerPush({
        userId: notificationTargetUserId,
        title: '🚨 Masanız İhbar Edildi!',
        body: `Masa ${deskId} boş olduğu gerekçesiyle ihbar edildi. ${reportWaitMinutes} dakika içinde masanıza dönüp QR kod ile “Masadayım” doğrulaması yapın.`,
        type: 'İHBAR',
        deskId,
        logId: _optionalChain([reportLog, 'optionalAccess', _401 => _401.id]) || null
      });
    }

    closeMessage();
    showMessage("İhbar Alındı", `Masa ${deskId} için ${targetRole === 'guest' ? 'misafir' : 'ana kullanıcı'} adına ${reportWaitMinutes} dakikalık doğrulama süreci başlatıldı.`, "success");
  };

  const handleVerifyImHere = async (qrData) => {
    const parts = qrData.split('-');
    if (parts.length < 2) {
        setScannerConfig({isOpen: false, mode: null});
        return showMessage("Hata", "Geçersiz QR Kod.", "danger");
    }
    const deskId = parseInt(parts[1]);

    if(deskId !== currentUser.activeDeskId) {
       setScannerConfig({isOpen: false, mode: null});
       return showMessage("Hata", "Lütfen size ait olan masanın karekodunu okutunuz.", "danger");
    }

    const nowTime = Date.now();
    const liveUsers = Array.isArray(usersRef.current) ? usersRef.current : [];
    const liveDesks = Array.isArray(desksRef.current) ? desksRef.current : [];
    const verifyUser = liveUsers.find(u => u.id === currentUser.id);
    const verifyRole = _optionalChain([verifyUser, 'optionalAccess', _402 => _402.activeDeskRole]) || currentUser.activeDeskRole || 'owner';

    if (db) {
      try {
        const result = await runStudentDeskAction('verify', { deskId, qrCode: qrData });
        applyCloudRows(result);
      } catch (error) {
        handleFirestoreQuotaError(error);
        setScannerConfig({ isOpen: false, mode: null, title: '' });
        return showMessage('Doğrulama Başarısız', error.message, 'warning');
      }
    } else {
    // QR doğrulaması state kuyruğuna bırakılmadan önce Ref üzerinde de anında uygulanır.
    // 1 saniyelik ihlal zamanlayıcısı aynı anda çalışsa bile artık eski "reported" durumunu göremez.
    const verifiedDesks = liveDesks.map(d => d.id === deskId
      ? (verifyRole === 'guest'
          ? {
              ...d,
              guestReported: false,
              guestReportEndTime: null,
              guestReportVerifiedAt: nowTime
            }
          : {
              ...d,
              status: 'occupied',
              reportEndTime: null,
              reportVerifiedAt: nowTime
            })
      : d);

    desksRef.current = verifiedDesks;
    setDesks(verifiedDesks);

    const verifiedUsers = liveUsers.map(u => u.id === currentUser.id
      ? { ...u, lastActiveTime: nowTime }
      : u);
    usersRef.current = verifiedUsers;
    setUsers(verifiedUsers);
    setCurrentUser(prev => prev ? { ...prev, lastActiveTime: nowTime } : prev);
    }

    // Aynı ihbar için bildirim anahtarını da çözüldü olarak kabul et.
    lastReportNotifiedRef.current = null;

    addLog('BILDIRIM_IPTAL', `${verifyRole === 'guest' ? 'Misafir' : 'Masa sahibi'} QR kod okutarak masada olduğunu doğruladı. İhbar süresi anında iptal edildi.`, deskId, currentUser.id);
    setScannerConfig({isOpen: false, mode: null, title: ''});
    showMessage("Başarılı", "QR doğrulandı. Öğrenci masada olarak işaretlendi ve ihbar anında iptal edildi.", "success");
  };

  const handleReportScan = (qrData) => {
    if (!requireStudentAction('Boş masa ihbarı QR doğrulama')) return;
    const parts = qrData.split('-');
    if (parts.length < 2) return showMessage("Hata", "Geçersiz QR Kod.", "danger");
    const deskId = parseInt(parts[1]);
    setScannerConfig({isOpen: false, mode: null});
    promptReportDesk(deskId);
  };

  const handleAdminQueryScan = (qrData) => {
    const parts = qrData.split('-');
    if (parts.length < 2) return showMessage("Hata", "Geçersiz QR Kod.", "danger");
    const deskId = parseInt(parts[1]);
    setScannerConfig({isOpen: false, mode: null});
    setLiveDeskId(deskId);
    setModal({ isOpen: true, type: 'info', title: `Masa ${deskId} Yönetimi`, content: null });
  };

  // --- TUTANAK YÖNETİMİ VE PDF ---
  const loadExternalScript = (src, id) => new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve();
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });

  const ensurePdfMake = async () => {
    if (window.pdfMake && window.pdfMake.vfs) return window.pdfMake;

    await loadExternalScript(
      'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js',
      'pdfmake-script'
    );
    await loadExternalScript(
      'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.js',
      'pdfmake-fonts-script'
    );

    if (!window.pdfMake) throw new Error('PDF motoru yüklenemedi.');
    return window.pdfMake;
  };


  

  

  

  

  

  // İhlal Kayıtları ve Dilek / Şikayet arşivleri için PDF / Word dışa aktarma ve kayıt silme araçları.
  const escapeWordHtml = value => escapeHtml(_nullishCoalesce(value, () => ( '-')));
  const downloadHtmlAsWord = (html, filename) => {
    const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadViolationRecordsWord = () => {
    try {
      const records = Array.isArray(violationRecordsRef.current) ? violationRecordsRef.current : [];
      if (records.length === 0) return showMessage('Kayıt Bulunamadı', 'Word olarak indirilecek ihlal kaydı bulunmuyor.', 'warning');

      const rows = records.map((record, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeWordHtml(new Date(record.time).toLocaleString('tr-TR'))}</td>
          <td>${escapeWordHtml(record.userInfo || '-')}</td>
          <td>${escapeWordHtml(record.deskId || '-')}</td>
          <td>${escapeWordHtml(String(record.type || 'IHLAL').replace(/_/g, ' '))}</td>
          <td>${escapeWordHtml(record.message || '-')}</td>
          <td>${escapeWordHtml(record.deviceInfo || '-')}</td>
          <td>${escapeWordHtml(record.locationInfo || '-')}</td>
        </tr>`).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>İhlal Kayıtları</title>
      <style>body{font-family:Arial,sans-serif;margin:30px;color:#111}h1,h2{text-align:center}table{width:100%;border-collapse:collapse;font-size:9pt}th,td{border:1px solid #999;padding:6px;vertical-align:top}th{background:#f2f2f2}.footer{text-align:center;margin-top:25px;font-size:8pt;color:#666}</style>
      </head><body><h2>SARIÇAM GENÇLİK MERKEZİ</h2><h1>İHLAL KAYITLARI RAPORU</h1>
      <p>Oluşturulma: ${escapeWordHtml(new Date().toLocaleString('tr-TR'))} &nbsp; | &nbsp; Toplam Kayıt: ${records.length}</p>
      <table><thead><tr><th>#</th><th>Tarih / Saat</th><th>Öğrenci</th><th>Masa</th><th>İhlal Türü</th><th>Açıklama</th><th>Cihaz</th><th>Konum</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Bu rapor Sarıçam Gençlik Merkezi Kütüphane Masa Takip Sistemi üzerinden oluşturulmuştur.</div></body></html>`;

      downloadHtmlAsWord(html, `Ihlal_Kayitlari_${getLocalDayKey()}.doc`);
      addLog('ARSIV_IHLAL_WORD', `İhlal Kayıtları arşivi Word olarak indirildi. Toplam ${records.length} kayıt.`);
    } catch (error) {
      console.error('İhlal Word hatası:', error);
      showMessage('Word Hatası', 'İhlal kayıtları Word dosyası oluşturulamadı.', 'danger');
    }
  };

  const downloadViolationRecordsPdf = async () => {
    try {
      const records = Array.isArray(violationRecordsRef.current) ? violationRecordsRef.current : [];
      if (records.length === 0) return showMessage('Kayıt Bulunamadı', 'PDF olarak indirilecek ihlal kaydı bulunmuyor.', 'warning');
      const pdfMake = await ensurePdfMake();
      const body = [[
        { text: '#', bold: true }, { text: 'Tarih / Saat', bold: true }, { text: 'Öğrenci', bold: true },
        { text: 'Masa', bold: true }, { text: 'Tür', bold: true }, { text: 'Açıklama', bold: true }
      ], ...records.map((r, i) => [
        String(i + 1), new Date(r.time).toLocaleString('tr-TR'), r.userInfo || '-', r.deskId ? String(r.deskId) : '-',
        String(r.type || 'IHLAL').replace(/_/g, ' '), r.message || '-'
      ])];
      pdfMake.createPdf({
        pageOrientation: 'landscape', pageSize: 'A4', pageMargins: [24, 30, 24, 30],
        content: [
          { text: 'SARIÇAM GENÇLİK MERKEZİ', bold: true, alignment: 'center', fontSize: 13 },
          { text: 'İHLAL KAYITLARI RAPORU', bold: true, alignment: 'center', fontSize: 16, margin: [0, 4, 0, 12] },
          { text: `Oluşturulma: ${new Date().toLocaleString('tr-TR')}   |   Toplam Kayıt: ${records.length}`, fontSize: 9, margin: [0, 0, 0, 10] },
          { table: { headerRows: 1, widths: [22, 82, 115, 35, 90, '*'], body }, layout: 'lightHorizontalLines', fontSize: 8 }
        ]
      }).download(`Ihlal_Kayitlari_${getLocalDayKey()}.pdf`);
      addLog('ARSIV_IHLAL_PDF', `İhlal Kayıtları arşivi PDF olarak indirildi. Toplam ${records.length} kayıt.`);
    } catch (error) {
      console.error('İhlal PDF hatası:', error);
      showMessage('PDF Hatası', 'İhlal kayıtları PDF dosyası oluşturulamadı.', 'danger');
    }
  };

  const downloadFeedbackRecordsWord = () => {
    try {
      const records = Array.isArray(feedbackRecordsRef.current) ? feedbackRecordsRef.current : [];
      if (records.length === 0) return showMessage('Kayıt Bulunamadı', 'Word olarak indirilecek dilek / şikayet kaydı bulunmuyor.', 'warning');
      const rows = records.map((r, i) => `<tr><td>${i + 1}</td><td>${escapeWordHtml(new Date(r.time).toLocaleString('tr-TR'))}</td><td>${escapeWordHtml(r.name || '-')}</td><td>${escapeWordHtml(r.identityNo || '-')}</td><td>${escapeWordHtml(r.type === 'complaint' ? 'Şikayet' : 'Öneri')}</td><td>${escapeWordHtml(r.message || '-')}</td></tr>`).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Dilek ve Şikayet Kayıtları</title><style>body{font-family:Arial,sans-serif;margin:30px;color:#111}h1,h2{text-align:center}table{width:100%;border-collapse:collapse;font-size:10pt}th,td{border:1px solid #999;padding:7px;vertical-align:top}th{background:#f2f2f2}.footer{text-align:center;margin-top:25px;font-size:8pt;color:#666}</style></head><body><h2>SARIÇAM GENÇLİK MERKEZİ</h2><h1>DİLEK / ŞİKAYET KAYITLARI RAPORU</h1><p>Oluşturulma: ${escapeWordHtml(new Date().toLocaleString('tr-TR'))} &nbsp; | &nbsp; Toplam Kayıt: ${records.length}</p><table><thead><tr><th>#</th><th>Tarih / Saat</th><th>Ad Soyad</th><th>Kimlik No</th><th>Tür</th><th>Mesaj</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">Bu rapor Sarıçam Gençlik Merkezi Kütüphane Masa Takip Sistemi üzerinden oluşturulmuştur.</div></body></html>`;
      downloadHtmlAsWord(html, `Dilek_Sikayet_Kayitlari_${getLocalDayKey()}.doc`);
      addLog('GERIBILDIRIM_ARSIV_WORD', `Dilek / Şikayet arşivi Word olarak indirildi. Toplam ${records.length} kayıt.`);
    } catch (error) {
      console.error('Dilek / Şikayet Word hatası:', error);
      showMessage('Word Hatası', 'Dilek / şikayet Word dosyası oluşturulamadı.', 'danger');
    }
  };

  const downloadFeedbackRecordsPdf = async () => {
    try {
      const records = Array.isArray(feedbackRecordsRef.current) ? feedbackRecordsRef.current : [];
      if (records.length === 0) return showMessage('Kayıt Bulunamadı', 'PDF olarak indirilecek dilek / şikayet kaydı bulunmuyor.', 'warning');
      const pdfMake = await ensurePdfMake();
      const body = [[
        { text: '#', bold: true }, { text: 'Tarih / Saat', bold: true }, { text: 'Ad Soyad', bold: true },
        { text: 'Kimlik No', bold: true }, { text: 'Tür', bold: true }, { text: 'Mesaj', bold: true }
      ], ...records.map((r, i) => [String(i + 1), new Date(r.time).toLocaleString('tr-TR'), r.name || '-', r.identityNo || '-', r.type === 'complaint' ? 'Şikayet' : 'Öneri', r.message || '-'])];
      pdfMake.createPdf({
        pageOrientation: 'landscape', pageSize: 'A4', pageMargins: [24, 30, 24, 30],
        content: [
          { text: 'SARIÇAM GENÇLİK MERKEZİ', bold: true, alignment: 'center', fontSize: 13 },
          { text: 'DİLEK / ŞİKAYET KAYITLARI RAPORU', bold: true, alignment: 'center', fontSize: 16, margin: [0, 4, 0, 12] },
          { text: `Oluşturulma: ${new Date().toLocaleString('tr-TR')}   |   Toplam Kayıt: ${records.length}`, fontSize: 9, margin: [0, 0, 0, 10] },
          { table: { headerRows: 1, widths: [22, 82, 100, 72, 55, '*'], body }, layout: 'lightHorizontalLines', fontSize: 8 }
        ]
      }).download(`Dilek_Sikayet_Kayitlari_${getLocalDayKey()}.pdf`);
      addLog('GERIBILDIRIM_ARSIV_PDF', `Dilek / Şikayet arşivi PDF olarak indirildi. Toplam ${records.length} kayıt.`);
    } catch (error) {
      console.error('Dilek / Şikayet PDF hatası:', error);
      showMessage('PDF Hatası', 'Dilek / şikayet PDF dosyası oluşturulamadı.', 'danger');
    }
  };

  const deleteViolationRecord = (record) => {
    if (!record) return;
    if (!window.confirm('Bu ihlal kaydını silmek istediğinize emin misiniz?')) return;
    pushUndoSnapshot('İhlal kaydı silme');

    // Önce silinen kimliği korumaya al; gecikmiş Firestore snapshot'ı kaydı geri getiremesin.
    rememberDeletedRecordId('violations', record.id);
    deleteHistoryRecords('violations', [record.id]);

    const next = (Array.isArray(violationRecordsRef.current) ? violationRecordsRef.current : [])
      .filter(r => r.id !== record.id && !isRecordDeleted('violations', r.id));
    violationRecordsRef.current = next;
    setViolationRecords(next);
    addLog('ARSIV_IHLAL_KAYDI_SILINDI', `${record.userInfo || 'Bir öğrenci'} için ${new Date(record.time).toLocaleString('tr-TR')} tarihli ihlal kaydı yönetici tarafından silindi.`, record.deskId || null, record.userId || null);
  };

  const deleteFeedbackRecord = (record) => {
    if (!record) return;
    if (!window.confirm('Bu dilek / şikayet kaydını silmek istediğinize emin misiniz?')) return;
    pushUndoSnapshot('Dilek / şikayet kaydı silme');

    // Önce silinen kimliği korumaya al; gecikmiş Firestore snapshot'ı kaydı geri getiremesin.
    rememberDeletedRecordId('feedback', record.id);
    deleteHistoryRecords('feedback', [record.id]);

    const next = (Array.isArray(feedbackRecordsRef.current) ? feedbackRecordsRef.current : [])
      .filter(r => r.id !== record.id && !isRecordDeleted('feedback', r.id));
    feedbackRecordsRef.current = next;
    setFeedbackRecords(next);
    addLog('GERIBILDIRIM_KAYDI_SILINDI', `${record.name || 'Bir kullanıcı'} tarafından gönderilen ${record.type === 'complaint' ? 'şikayet' : 'öneri'} kaydı yönetici tarafından silindi.`);
  };

  

  const sendAdminDeskMessage = (deskId, userId, message, title = 'Yönetici Masa Kontrolü', level = 'warning') => {
    if (!userId || !message || !String(message).trim()) {
      return showMessage('Mesaj Gönderilemedi', 'Masa sahibine gönderilecek mesaj boş olamaz.', 'warning');
    }

    const numericDeskId = Number(deskId);
    const deskForMessage = (Array.isArray(desksRef.current) ? desksRef.current : [])
      .find(d => Number(d.id) === numericDeskId);

    if (!deskForMessage) {
      return showMessage('Mesaj Gönderilemedi', 'Seçilen masa sistemde bulunamadı.', 'warning');
    }

    // SERT HEDEF KONTROLÜ:
    // Yönetici mesajı yalnızca bu masanın GERÇEK ana kullanıcısına veya misafirine gönderilebilir.
    // Eski/stale bir userId başka kullanıcıya bildirim göndermesin.
    const validRecipientIds = [deskForMessage.occupant, deskForMessage.guestOccupant].filter(Boolean);
    if (!validRecipientIds.includes(userId)) {
      return showMessage(
        'Mesaj Gönderilemedi',
        `Masa ${numericDeskId} ile seçilen kullanıcı eşleşmiyor. Mesaj başka kullanıcıya gönderilmedi.`,
        'danger'
      );
    }

    const targetUser = Array.isArray(usersRef.current) ? usersRef.current.find(u => u.id === userId) : null;
    if (!targetUser) {
      return showMessage('Mesaj Gönderilemedi', 'Bu masaya bağlı kullanıcı bulunamadı.', 'warning');
    }

    const cleanMessage = String(message).trim().slice(0, 300);
    const recipientRole = deskForMessage.guestOccupant === userId ? 'guest' : 'owner';

    const adminMessageLog = addLog(
      'ADMIN_MASA_MESAJI',
      cleanMessage,
      numericDeskId,
      userId,
      false,
      null,
      {
        notificationTitle: title,
        notificationBody: cleanMessage,
        notificationLevel: level,
        sentByAdmin: true,
        recipientRole,
        recipientName: targetUser.name || '',
        deliveredAt: Date.now(),
        source: 'admin_desk_control'
      }
    );

    // Yönetici masa kontrol mesajını aynı zamanda ilgili öğrencinin telefonuna gönder.
    sendServerPush({
      userId,
      title: title || '📢 Yönetici Masa Kontrol Mesajı',
      body: cleanMessage,
      type: 'ADMIN_MASA_MESAJI',
      deskId: numericDeskId,
      logId: _optionalChain([adminMessageLog, 'optionalAccess', _403 => _403.id]) || null
    });

    showMessage(
      'Mesaj Gönderildi',
      React.createElement('div', { className: "space-y-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 6137}}
        , React.createElement('p', { className: "text-sm text-slate-700" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6138}}, React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6138}}, targetUser.name), " adlı kullanıcıya masa kontrol mesajı gönderildi."      )
        , React.createElement('p', { className: "text-xs text-slate-500" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6139}}, cleanMessage)
      ),
      'success'
    );
  };

  const openAdminDeskMessage = (deskId, userId) => {
    const targetUser = Array.isArray(usersRef.current) ? usersRef.current.find(u => u.id === userId) : null;
    if (!targetUser) {
      return showMessage('Kullanıcı Bulunamadı', 'Bu masaya bağlı kullanıcı bulunamadı.', 'warning');
    }

    const deskForMessage = (Array.isArray(desksRef.current) ? desksRef.current : []).find(d => d.id === deskId);
    const isGuestRecipient = _optionalChain([deskForMessage, 'optionalAccess', _404 => _404.guestOccupant]) === userId;
    const recipientLabel = isGuestRecipient ? 'Misafir' : 'Ana Kullanıcı';
    const messageInputId = `admin_desk_message_${deskId}_${userId}`;

    const presets = [
      { text: 'Masanız dolu görünüyor ancak masa başında değilsiniz. Lütfen masanıza dönünüz.', level: 'warning' },
      { text: 'Masa kontrolü yapılıyor. Lütfen masanızda olduğunuzu kontrol ediniz.', level: 'info' },
      { text: 'Masanız uzun süredir boş görünüyor. Lütfen masanıza dönün veya masayı sistemden bırakın.', level: 'warning' },
      { text: 'Lütfen masa kullanım kurallarına dikkat ediniz.', level: 'info' }
    ];

    showMessage(
      isGuestRecipient ? 'Misafire Mesaj Gönder' : 'Masa Sahibine Mesaj Gönder',
      React.createElement('div', { className: "space-y-4", __self: this, __source: {fileName: _jsxFileName, lineNumber: 6165}}
        , React.createElement('div', { className: "p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm space-y-1"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6166}}
          , React.createElement('p', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6167}}, React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6167}}, "Masa:"), " " , deskId)
          , React.createElement('p', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6168}}, React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6168}}, "Kullanıcı Türü:" ), " " , recipientLabel)
          , React.createElement('p', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6169}}, React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6169}}, "Öğrenci:"), " " , targetUser.name)
          , React.createElement('p', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6170}}, React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6170}}, "Kimlik No:" ), " " , targetUser.identityNo || '-')
        )

        , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6173}}
          , React.createElement('p', { className: "text-xs font-bold text-slate-600 mb-2"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6174}}, "Hazır kısa mesajlar"  )
          , React.createElement('div', { className: "space-y-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 6175}}
            , presets.map((preset, index) => (
              React.createElement('button', {
                key: index,
                type: "button",
                onClick: () => sendAdminDeskMessage(deskId, userId, preset.text, 'Yönetici Masa Kontrolü', preset.level),
                className: "w-full text-left p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-sm text-blue-900 transition-colors"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6177}}

                , preset.text
              )
            ))
          )
        )

        , React.createElement('div', { className: "border-t border-slate-200 pt-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6189}}
          , React.createElement('label', { className: "block text-xs font-bold text-slate-600 mb-2"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6190}}, "Özel mesaj (en fazla 300 karakter)"     )
          , React.createElement('textarea', {
            id: messageInputId,
            maxLength: 300,
            rows: 3,
            placeholder: "Örn: Masa dolu görünüyor ancak sizi masada göremedik. Lütfen masanıza dönünüz."          ,
            className: "w-full p-3 border border-slate-300 rounded-xl text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6191}}
          )
          , React.createElement('button', {
            type: "button",
            onClick: () => {
              const el = document.getElementById(messageInputId);
              const value = el ? el.value : '';
              sendAdminDeskMessage(deskId, userId, value, 'Yönetici Mesajı', 'warning');
            },
            className: "w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6198}}
, "Mesajı Gönder"

          )
        )
      ),
      'info'
    );
  };

  // KULLANICI KALICI SİLME:
  // Seçilen kullanıcıları hem yerel state'ten hem Firestore sgmUsers koleksiyonundan siler.
  // Kullanıcı aktif masadaysa, QR bekleyen rezervasyonu varsa veya legacy misafir alanında
  // görünüyorsa ilgili masa da aynı işlemde temizlenir. Tombstone kaydı gecikmiş snapshot'ın
  // silinen kullanıcıyı tekrar ekrana getirmesini engeller.
  const permanentlyDeleteUsers = async (userIds) => {
    const ids = new Set((Array.isArray(userIds) ? userIds : []).filter(Boolean).map(String));
    if (!ids.size) return { deletedCount: 0, failedIds: [] };

    const currentUsers = Array.isArray(usersRef.current) ? usersRef.current : [];
    const existingIds = new Set(currentUsers.filter(u => ids.has(String(u.id))).map(u => String(u.id)));
    if (!existingIds.size) return { deletedCount: 0, failedIds: [] };

    // Snapshot daha geç gelse bile kullanıcı geri görünmesin.
    existingIds.forEach(id => {
      deletedUserIds.add(id);
      rememberDeletedRecordId('users', id);
      pendingUserDeletesRef.current.add(id);
    });
    localStorage.setItem('sgm_pending_user_deletes', JSON.stringify(Array.from(pendingUserDeletesRef.current)));

    // Kullanıcının aktif / bekleyen / legacy misafir masa ilişkilerini tamamen temizle.
    const currentDesks = Array.isArray(desksRef.current) ? desksRef.current : [];
    const nextDesks = currentDesks.map(d => {
      const ownsDesk = existingIds.has(String(d.occupant || ''));
      const hasPending = existingIds.has(String(d.pendingOccupant || ''));
      const isLegacyGuest = existingIds.has(String(d.guestOccupant || ''));
      if (!ownsDesk && !hasPending && !isLegacyGuest) return d;

      const next = { ...d };
      if (ownsDesk) {
        next.status = d.status === 'disabled' ? 'disabled' : 'available';
        next.occupant = null;
        next.ownerDeviceId = null;
        next.sessionStartTime = null;
        next.breakEndTime = null;
        next.reportEndTime = null;
        next.reportIssuedAt = null;
        next.reportVerifiedAt = null;
      }
      if (hasPending) {
        next.pendingOccupant = null;
        next.pendingDeskRole = null;
        next.pendingDeskDeadline = null;
      }
      if (isLegacyGuest) {
        next.guestOccupant = null;
        next.guestSessionStartTime = null;
        next.guestBreakEndTime = null;
        next.guestReported = false;
        next.guestReportEndTime = null;
        next.guestReportIssuedAt = null;
        next.guestReportVerifiedAt = null;
      }
      return next;
    });

    const nextUsers = currentUsers.filter(u => !existingIds.has(String(u.id)));
    usersRef.current = nextUsers;
    desksRef.current = nextDesks;
    setUsers(nextUsers);
    setDesks(nextDesks);
    setSelectedUserIds(prev => prev.filter(id => !existingIds.has(String(id))));

    // Aynı cihazda silinen kullanıcı açıksa oturumunu da kapat.
    if (_optionalChain([currentUser, 'optionalAccess', _405 => _405.id]) && existingIds.has(String(currentUser.id))) {
      sessionStorage.removeItem('sgm_student_session');
      setCurrentUser(null);
      setSelectedDeskId(null);
      setDeskSelectionDeadline(null);
    }

    // Firestore kullanıcı belgelerini doğrudan sil. Başarılı silmeler baseline'dan da çıkarılır.
    const results = await mapLimited(Array.from(existingIds), async id => {
      if (!db) { pendingUserDeletesRef.current.delete(id); return id; }
      if (!fbUser || !adminAuthorized) throw new Error('Yönetici oturumu veya bağlantı bekleniyor.');
      const result = await runAdminMaintenance('delete_user', { userId: id });
      applyCloudRows(result);
      granularBaselineRef.current.users.delete(String(id));
      pendingUserDeletesRef.current.delete(id);
      localStorage.setItem('sgm_pending_user_deletes', JSON.stringify(Array.from(pendingUserDeletesRef.current)));
      return id;
    });

    const failedIds = [];
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const id = Array.from(existingIds)[index];
        failedIds.push(id);
        handleFirestoreQuotaError(result.reason);
      }
    });

    // Masa boşaltmalarını beklemeden Firestore'a gönder. Kullanıcı silme başarısız olsa bile
    // tombstone korunur; sonraki senkron turu kalan silme işlemini tekrar deneyebilir.
    criticalDeskMutationRef.current = true;
    if (db && fbUser && isDataLoaded) {
      persistGranularStateNow({ desks: nextDesks, users: nextUsers }).catch(handleFirestoreQuotaError);
    }

    return { deletedCount: existingIds.size - failedIds.length, failedIds };
  };

  const repairDanglingDeskLinks = async () => {
    if (repairDeskLinksBusy || !db) return;
    if (!window.confirm('Boş masalara veya geçersiz rezervasyonlara bağlı öğrenci kayıtları sunucuda kontrol edilip düzeltilecek. Gerçek aktif oturumlar korunur. Devam edilsin mi?')) return;
    setRepairDeskLinksBusy(true);
    try {
      await requireAdminForUserWrite();
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin-desk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'repair' })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || _optionalChain([result, 'optionalAccess', _406 => _406.ok]) !== true) throw new Error(_optionalChain([result, 'optionalAccess', _407 => _407.message]) || 'Sunucu onarımı tamamlanamadı.');
      if (_optionalChain([result, 'access', _408 => _408.users, 'optionalAccess', _409 => _409.length])) {
        const patches = new Map(result.users.map(user => [String(user.id), user]));
        usersRef.current = usersRef.current.map(row => {
          const patch = patches.get(String(row.id));
          if (!patch) return row;
          const merged = { ...row, ...patch };
          granularBaselineRef.current.users.set(String(merged.id), merged);
          return merged;
        });
        setUsers(usersRef.current);
        setCurrentUser(previous => previous && patches.has(String(previous.id))
          ? { ...previous, ...patches.get(String(previous.id)) } : previous);
      }
      showMessage('Masa-Hesap Kontrolü Tamamlandı', `${result.repairedCount} öğrencinin geçersiz masa veya rezervasyon bağlantısı düzeltildi. Gerçek aktif masalar, GM kodları, şifreler, ihlal ve geçmiş kayıtları korunmuştur.`, 'success');
    } catch (error) {
      handleFirestoreQuotaError(error);
      showMessage('Onarım Yapılamadı', error.message || 'Sunucuya bağlanılamadı.', 'warning');
    } finally {
      setRepairDeskLinksBusy(false);
    }
  };

  const handleAdminAction = async (action, deskId, userId = null) => {
    const nowTime = Date.now();
    const undoableAdminActions = new Set(['release', 'disable', 'enable', 'cancel_report', 'clear_strike', 'toggle_report_auth', 'toggle_block', 'assign_user', 'regenerate_qr']);
    // Sunucuda onaylanan masa oturumu geri alınamaz; yönetici yeni güvenli atama yapar.
    // Diğer YP işlemlerinin Geri Al özelliği korunur.
    if (undoableAdminActions.has(action) && !(db && ['release', 'disable', 'enable', 'cancel_report', 'assign_user'].includes(action))) {
      const actionLabels = {
        release: 'Masa boşaltma', disable: 'Masayı kullanıma kapatma', enable: 'Masayı kullanıma açma',
        cancel_report: 'Boş bildirimi iptal etme', clear_strike: 'İhlal silme', toggle_report_auth: 'İhbar yetkisi değiştirme',
        toggle_block: 'Kullanıcı engel durumu değiştirme', assign_user: 'Masaya kullanıcı atama', regenerate_qr: 'QR kod yenileme'
      };
      pushUndoSnapshot(actionLabels[action] || 'Yönetici işlemi');
    }
    // Masa sahipliği ve ihbar durumları her zaman sunucu transaction'ıyla değişir.
    if (db && ['disable', 'enable', 'cancel_report'].includes(action)) {
      try {
        await requireAdminForUserWrite();
        const token = await auth.currentUser.getIdToken();
        const currentDesk = (desksRef.current || []).find(d => Number(d.id) === Number(deskId));
        const response = await fetch('/api/admin-desk', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action, deskId: Number(deskId),
            expectedOccupant: _optionalChain([currentDesk, 'optionalAccess', _410 => _410.occupant]) || null,
            expectedSessionStartTime: _optionalChain([currentDesk, 'optionalAccess', _411 => _411.sessionStartTime]) || null })
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || _optionalChain([result, 'optionalAccess', _412 => _412.ok]) !== true) throw new Error(_optionalChain([result, 'optionalAccess', _413 => _413.message]) || 'Masa güncellenemedi.');
        applyCloudRows({ desks: result.desks });
        if (_optionalChain([result, 'access', _414 => _414.users, 'optionalAccess', _415 => _415.length])) {
          const map = new Map(result.users.map(u => [String(u.id), u]));
          usersRef.current = (usersRef.current || []).map(u => map.has(String(u.id)) ? { ...u, ...map.get(String(u.id)) } : u);
          setUsers(usersRef.current);
        }
        showMessage('Masa Güncellendi', `Masa ${deskId} sunucuda güncellendi.`, 'success');
      } catch (error) { handleFirestoreQuotaError(error); showMessage('Masa İşlemi Reddedildi', error.message, 'warning'); }
      return;
    }
    switch (action) {
      case 'release':
        if (!window.confirm(`Masa ${deskId} yönetici tarafından boşaltılsın mı? Bu işlem kayıt altına alınacak ve ihlal yazılmayacak.`)) return;
        if (db) {
          try {
            await requireAdminForUserWrite();
            const token = await auth.currentUser.getIdToken();
            const response = await fetch('/api/admin-desk', { method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ action: 'release', deskId: Number(deskId),
                expectedOccupant: _optionalChain([(desksRef.current || []), 'access', _416 => _416.find, 'call', _417 => _417(d => Number(d.id) === Number(deskId)), 'optionalAccess', _418 => _418.occupant]) || null,
                expectedSessionStartTime: _optionalChain([(desksRef.current || []), 'access', _419 => _419.find, 'call', _420 => _420(d => Number(d.id) === Number(deskId)), 'optionalAccess', _421 => _421.sessionStartTime]) || null }) });
            const result = await response.json().catch(() => null);
            if (!response.ok || _optionalChain([result, 'optionalAccess', _422 => _422.ok]) !== true) throw new Error(_optionalChain([result, 'optionalAccess', _423 => _423.message]) || 'Masa boşaltılamadı.');
            applyCloudRows({ desks: result.desks, user: result.user });
            if (_optionalChain([result, 'access', _424 => _424.users, 'optionalAccess', _425 => _425.length])) {
              const map = new Map(result.users.map(u => [u.id, u]));
              usersRef.current = (usersRef.current || []).map(u => map.has(u.id) ? { ...u, ...map.get(u.id) } : u);
              setUsers(usersRef.current);
            }
            // Sunucu işlemi idempotent bir audit kaydı üretir; ikinci log yazmayız.
            showMessage('Masa Boşaltıldı', `Masa ${deskId} sunucuda boşaltıldı.`, 'success');
          } catch (error) { handleFirestoreQuotaError(error); showMessage('Masa Boşaltılamadı', error.message, 'warning'); }
          break;
        }
        const releaseDeskData = (Array.isArray(desks) ? desks : []).find(d => d.id === deskId);
        setDesks(prev => Array.isArray(prev) ? prev.map(d => d.id === deskId ? { ...d, status: 'available', occupant: null, guestOccupant: null, guestSessionStartTime: null, guestBreakEndTime: null, guestReported: false, guestReportEndTime: null, breakEndTime: null, reportEndTime: null, sessionStartTime: null } : d) : []);
        setUsers(prev => Array.isArray(prev) ? prev.map(u => (u.id === userId || u.id === _optionalChain([releaseDeskData, 'optionalAccess', _426 => _426.guestOccupant])) ? { ...u, activeDeskId: null, activeDeskRole: null } : u) : []);
        addLog('ADMIN_MÜDAHALE', `Masa ${deskId} yönetici tarafından boşaltıldı.`, deskId, userId);
        break;
      case 'disable':
        const disabledDeskData = (Array.isArray(desks) ? desks : []).find(d => d.id === deskId);
        setDesks(prev => Array.isArray(prev) ? prev.map(d => d.id === deskId ? { ...d, status: 'disabled', occupant: null, guestOccupant: null, guestSessionStartTime: null, guestBreakEndTime: null, guestReported: false, guestReportEndTime: null } : d) : []);
        setUsers(prev => Array.isArray(prev) ? prev.map(u => (u.id === userId || u.id === _optionalChain([disabledDeskData, 'optionalAccess', _427 => _427.guestOccupant])) ? { ...u, activeDeskId: null, activeDeskRole: null } : u) : []);
        addLog('ADMIN_MÜDAHALE', `Masa ${deskId} kullanıma kapatıldı.`, deskId);
        break;
      case 'enable':
        setDesks(prev => Array.isArray(prev) ? prev.map(d => d.id === deskId ? { ...d, status: 'available' } : d) : []);
        addLog('ADMIN_MÜDAHALE', `Masa ${deskId} tekrar kullanıma açıldı.`, deskId);
        break;
      case 'cancel_report':
        setDesks(prev => Array.isArray(prev) ? prev.map(d => d.id === deskId ? { ...d, status: 'occupied', reportEndTime: null } : d) : []);
        addLog('ADMIN_MÜDAHALE', `Masa ${deskId} boş bildirimi iptal edildi.`, deskId, userId);
        break;
      case 'clear_strike':
        if (userId) {
          setUsers(prev => Array.isArray(prev) ? prev.map(u => u.id === userId ? { ...u, strikes: Math.max(0, (Number.isFinite(Number(u.strikes)) ? Number(u.strikes) : 0) - 1) } : u) : []);
          addLog('ADMIN_MÜDAHALE', `Kullanıcının 1 ihlali silindi.`, deskId, userId);
        }
        break;
      case 'toggle_report_auth':
        if (userId) {
          const target = usersRef.current.find(u => u.id === userId);
          if (target && !isRestricted(target)) return showMessage('İhbar Yetkisi Açık', 'Kısıtsız hesaplarda boş masa ihbarı açıktır. Moladaki masa ihbar edilemez.', 'info');
          const desired = { ...target, canReport: target.canReport === false,
            reportPermissionPolicyVersion: 1, reportPermissionRestrictionUntil: Number(target.restrictedUntil || 0) };
          try { await saveAdminUserChanges(target, desired); }
          catch (error) { return showMessage('Yetki Güncellenemedi', error.message, 'warning'); }
          addLog('ADMIN_YETKI', `Kullanıcının ihbar yetkisi değiştirildi.`, null, userId);
        }
        break;
      
      case 'message_user':
        openAdminDeskMessage(deskId, userId);
        break;
      case 'approve_account': {
        const user = usersRef.current.find(u => u.id === userId);
        if (!user) return showMessage('Hesap Bulunamadı', 'Kullanıcı artık listede bulunmuyor.', 'warning');
        pushUndoSnapshot('Hesap onayı ve kısıt kaldırma');
        try {
          await approveUsersNow([userId]);
          addLog('ADMIN_HESAP_ONAYLANDI', 'Hesap sorumlu tarafından onaylandı; hesap kısıtı kaldırıldı ve ihbar yetkisi açıldı.', null, userId);
          showMessage('Hesap Onaylandı', 'Onay sunucuya kaydedildi. Öğrenci ekranı güncel hesap durumunu alabilir.', 'success');
        } catch (error) {
          handleFirestoreQuotaError(error);
          showMessage('Onay Kaydedilemedi', error.message, 'warning');
        }
        break;
      }
      case 'toggle_block':
        if (userId) openAdminUserEditor(userId);
        break;
      case 'delete_user':
        if (userId) {
          const userToDelete = (usersRef.current || []).find(u => u.id === userId) || null;
          if (!userToDelete) return showMessage('Kullanıcı Bulunamadı', 'Silinecek kullanıcı artık listede bulunmuyor.', 'warning');

          pushUndoSnapshot('Kullanıcı silme');
          const result = await permanentlyDeleteUsers([userId]);
          if (result.deletedCount > 0) {
            addLog('ADMIN_KULLANICI_SİL', `Öğrenci kaydı Firestore dahil kalıcı olarak silindi.`, null, userId);
            showMessage('Başarılı', 'Kullanıcı kalıcı olarak silindi. Aktif veya bekleyen masası da boşaltıldı.', 'success');
          } else {
            showMessage('Silme Başarısız', 'Kullanıcı Firestore’dan silinemedi. İnternet bağlantısını ve Firebase yetkilerini kontrol edin.', 'danger');
          }
        }
        break;
      case 'assign_user': {
        const rows = usersRef.current || []; const deskRows = desksRef.current || [];
        const target = rows.find(u => u.id === userId); const targetDesk = deskRows.find(d => Number(d.id) === Number(deskId));
        if (!checkLibraryOpen()) return showMessage('Atama Engellendi', 'Kütüphane kapalıyken masa ataması yapılamaz.', 'warning');
        if (!target || target.pendingApproval) return showMessage('Atama Engellendi', 'Yeni kullanıcıyı önce onaylayın.', 'warning');
        if (!targetDesk || targetDesk.status !== 'available' || targetDesk.occupant ||
            (targetDesk.pendingOccupant && Number(targetDesk.pendingDeskDeadline) > nowTime && targetDesk.pendingOccupant !== userId)) {
          return showMessage('Atama Engellendi', 'Masa boş ve kullanıma açık olmalıdır.', 'warning');
        }
        if (target.activeDeskId || rows.some(u => u.id !== userId && target.deviceId && u.deviceId === target.deviceId &&
            (u.activeDeskId || Number(u.pendingDeskDeadline || 0) > nowTime))) {
          return showMessage('Atama Engellendi', 'Kullanıcının veya cihazının başka bir aktif masası / rezervasyonu bulunuyor.', 'warning');
        }
        const waited = deskWaitRemaining(target, nowTime);
        if (db) {
          try {
            if (!adminAuthorized) throw new Error('Yönetici yetkisi gerekli.');
            await requireAdminForUserWrite();
            const token = await auth.currentUser.getIdToken();
            const response = await fetch('/api/admin-desk', {
              method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ action: 'assign', userId, deskId: Number(deskId) })
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || _optionalChain([result, 'optionalAccess', _428 => _428.ok]) !== true) throw new Error(_optionalChain([result, 'optionalAccess', _429 => _429.message]) || 'Masa ataması sunucuda tamamlanamadı.');
            applyCloudRows(result);
            addLog('ADMIN_MASA_ATAMA', `Masa ${deskId} yönetici tarafından atandı.${waited ? ' 30 dakikalık bekleme için yönetici istisnası uygulandı.' : ''}`, deskId, userId, false, null, { cooldownOverride: waited > 0 });
            break;
          } catch (error) { handleFirestoreQuotaError(error); return showMessage('Atama Engellendi', error.message, 'warning'); }
        }
        const nextDesks = deskRows.map(d => Number(d.id) === Number(deskId)
          ? { ...d, status: 'occupied', occupant: userId, ownerDeviceId: target.deviceId || null, sessionStartTime: nowTime,
              pendingOccupant: null, pendingDeskRole: null, pendingDeskDeadline: null, pendingDeviceId: null, breakEndTime: null, reportEndTime: null, reportIssuedAt: null, reportVerifiedAt: null }
          : d.pendingOccupant === userId ? { ...d, pendingOccupant: null, pendingDeskRole: null, pendingDeskDeadline: null } : d);
        const nextUsers = rows.map(u => u.id === userId ? { ...u, activeDeskId: deskId, activeDeskRole: 'owner',
          pendingDeskId: null, pendingDeskDeadline: null, lastActiveTime: nowTime,
          adminDeskOverrideDeskId: Number(deskId), adminDeskOverrideSessionStart: nowTime,
          gmDeskAccessAt: Math.max(nowTime, Number(u.gmDeskAccessAt || 0) + 1) } : u);
        criticalDeskMutationRef.current = true; desksRef.current = nextDesks; usersRef.current = nextUsers;
        setDesks(nextDesks); setUsers(nextUsers);
        if (_optionalChain([currentUser, 'optionalAccess', _430 => _430.id]) === userId) { setCurrentUser(nextUsers.find(u => u.id === userId)); setSelectedDeskId(null); setDeskSelectionDeadline(null); }
        addLog('ADMIN_MASA_ATAMA', `Masa ${deskId} yönetici tarafından atandı.${waited ? ' Sistem hatası için 30 dakikalık bekleme kuralına yönetici istisnası uygulandı.' : ''}`, deskId, userId, false, null, { cooldownOverride: waited > 0 });
        break;
      }
      case 'regenerate_qr':
        const existingQR = _optionalChain([(desksRef.current || []), 'access', _431 => _431.find, 'call', _432 => _432(d => Number(d.id) === Number(deskId)), 'optionalAccess', _433 => _433.qrCode]);
        const newQR = existingQR || getStaticDeskQrCode(deskId);
        const updatedQrDesks = (desksRef.current || []).map(d => Number(d.id) === Number(deskId) ? { ...d, qrCode: newQR } : d);
        desksRef.current = updatedQrDesks;
        criticalDeskMutationRef.current = true;
        setDesks(updatedQrDesks);
        addLog('ADMIN_MÜDAHALE', `Masa ${deskId} sabit QR kodu kontrol edildi; mevcut kod korundu.`, deskId);
        showMessage("Başarılı", "Masanın sabit QR kodu hazır. Mevcut kod değiştirilmedi.", "success");
        break;
    }
  };

  const openAdminUserEditor = (userId) => {
    const user = (Array.isArray(users) ? users : []).find(u => u.id === userId);
    if (!user) return showMessage("Kullanıcı Bulunamadı", "Seçilen öğrenci kaydı bulunamadı.", "warning");

    setLiveDeskId(null);
    setAdminUserEditId(userId);
    setModal({
      isOpen: true,
      type: 'info',
      title: `${user.name || 'Öğrenci'} • Kullanıcı Bilgileri`,
      content: null,
      onClose: () => {
        setAdminUserEditId(null);
        setModal({ isOpen: false, type: '', title: '', content: null, onClose: null });
      }
    });
  };

  const renderAdminUserEditorContent = (userId) => {
    const safeUsers = Array.isArray(users) ? users : [];
    const user = safeUsers.find(u => u.id === userId);

    if (!user) {
      return (
        React.createElement('div', { className: "space-y-4", __self: this, __source: {fileName: _jsxFileName, lineNumber: 6569}}
          , React.createElement('p', { className: "text-sm text-red-600 font-semibold"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6570}}, "Bu öğrenci kaydı artık sistemde bulunmuyor."     )
          , React.createElement('button', { onClick: () => { setAdminUserEditId(null); closeMessage(); }, className: "w-full py-3 bg-slate-800 text-white rounded-xl font-bold"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6571}}, "Kapat"

          )
        )
      );
    }

    const currentStrikeCount = Number.isFinite(Number(user.strikes)) ? Math.max(0, Number(user.strikes)) : 0;

    return (
      React.createElement('div', { className: "space-y-5", __self: this, __source: {fileName: _jsxFileName, lineNumber: 6581}}
        , React.createElement('div', { className: "p-4 bg-blue-50 border border-blue-200 rounded-xl"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6582}}
          , React.createElement('div', { className: "flex items-start gap-3"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6583}}
            , React.createElement(User, { className: "w-5 h-5 text-blue-600 mt-0.5 shrink-0"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6584}} )
            , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6585}}
              , React.createElement('p', { className: "font-bold text-blue-900" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6586}}, user.name || 'Öğrenci')
              , React.createElement('p', { className: "text-xs text-blue-700 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6587}}, "Öğrencinin giriş bilgilerini ve günlük ihlal cezasını buradan görüntüleyip değiştirebilirsiniz."

              )
            )
          )
        )

        , React.createElement('p', { className: "text-xs font-semibold text-slate-600"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6594}}, "Son 7 gündeki ihlal: "    , countRecentUnpardonedViolations(user))
        , React.createElement('form', {
          key: `admin-user-edit-${user.id}`,
          onSubmit: async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);

            const newName = String(formData.get('editName') || '').trim();
            const newPhone = cleanIdentityFormat(formData.get('editSpecialCode'));
            const newPin = cleanPinFormat(formData.get('editPin'));
            const parsedStrikes = parseInt(formData.get('editStrikes'), 10);
            const newStrikes = Number.isFinite(parsedStrikes) ? Math.max(0, parsedStrikes) : 0;
            const restrictionDays = Math.max(0, Number(formData.get('restrictionDays') || 0));
            const restrictionText = String(formData.get('restrictionReason') || '').trim().slice(0, 300);
            const newBlocked = false;
            const newCanReport = formData.get('editCanReport') === 'on';

            if (!newName) return showMessage("Bilgi Eksik", "Ad soyad boş bırakılamaz.", "warning");
            if (newPhone.length !== 8) return showMessage("GM Özel Kod Hatalı", "GM Özel Kod 8 rakamdan oluşmalıdır.", "warning");
            if (newPin.length !== 8 || !/^\d{8}$/.test(newPin)) return showMessage("Şifre Hatalı", "Öğrenci giriş şifresi 8 rakamdan oluşmalıdır.", "warning");

            const duplicatePhone = safeUsers.some(
              u => u.id !== user.id && cleanIdentityFormat(u.specialCode) === newPhone
            );
            if (duplicatePhone) return showMessage("Kod Kullanılıyor", "Bu GM Özel Kod başka bir öğrenciye kayıtlı.", "warning");
            if (safeUsers.some(u => u.id !== user.id && String(u.pin || '') === newPin)) return showMessage("Şifre Kullanılıyor", "Bu şifre başka bir kullanıcıda mevcut.", "warning");

            if (isRestricted(user) && (newPhone !== user.specialCode || newPin !== user.pin)) return showMessage('İşlem Engellendi', 'Kısıtlı kişinin GM Özel Kod ve şifresi değiştirilemez; önce mevcut hesabın kısıtını kaldırın.', 'warning');
            const updatedUser = {
              ...user,
              name: newName,
              specialCode: newPhone,
              pin: newPin,
              strikes: newStrikes,
              blocked: newBlocked,
              pendingApproval: formData.get("approveAccount") === "on" ? false : user.pendingApproval === true,
              restrictedUntil: restrictionDays > 0 ? Date.now() + restrictionDays * 86400000 : 0,
              restrictionReason: restrictionDays > 0 ? (restrictionText || 'Yönetici tarafından süreli kısıtlama') : '',
              canReport: newCanReport
            };
            // Onay/engel/süreli kısıt kalktığı anda ihbar yetkisini de aç.
            if (!isRestricted(updatedUser)) updatedUser.canReport = true;
            if (!isRestricted(updatedUser)) {
              updatedUser.reportPermissionPolicyVersion = 1;
              updatedUser.reportPermissionRestrictionUntil = Number(updatedUser.restrictedUntil || 0);
            }

            pushUndoSnapshot('Kullanıcı bilgilerini düzenleme');
            try {
              await saveAdminUserChanges(user, updatedUser);
            } catch (error) {
              handleFirestoreQuotaError(error);
              return showMessage('Hesap Kaydedilemedi', error.message, 'warning');
            }

            addLog(
              'ADMIN_KULLANICI_GUNCELLE',
              `${newName} adlı öğrencinin kullanıcı bilgileri yönetici tarafından güncellendi. Günlük ihlal: ${currentStrikeCount} → ${newStrikes}.`,
              user.activeDeskId || null,
              user.id
            );

            setAdminUserEditId(null);
            closeMessage();
            setTimeout(() => showMessage("Kaydedildi", "Öğrenci bilgileri ve ihlal cezası başarıyla güncellendi.", "success"), 100);
          },
          className: "space-y-4", __self: this, __source: {fileName: _jsxFileName, lineNumber: 6595}}

          , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6662}}
            , React.createElement('label', { className: "block text-xs font-bold text-slate-600 mb-1"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6663}}, "Ad Soyad" )
            , React.createElement('input', { type: "text", name: "editName", defaultValue: user.name || '', required: true, className: "w-full p-3 border border-slate-300 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6664}} )
          )

          , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6667}}
            , React.createElement('label', { className: "block text-xs font-bold text-slate-600 mb-1"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6668}}, "GM Özel Kodunuz"  )
            , React.createElement('input', { type: "text", inputMode: "numeric", minLength: 8, maxLength: 8, name: "editSpecialCode", defaultValue: user.specialCode || '', required: true, className: "w-full p-3 border border-slate-300 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6669}} )
          )

          , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6672}}
            , React.createElement('label', { className: "block text-xs font-bold text-slate-600 mb-1"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6673}}, "Sisteme Giriş Şifresi"  )
            , React.createElement('div', { className: "relative", __self: this, __source: {fileName: _jsxFileName, lineNumber: 6674}}
              , React.createElement('input', { type: "text", name: "editPin", defaultValue: user.pin || '', required: true, minLength: 8, maxLength: 8, className: "w-full p-3 pr-12 border border-indigo-300 rounded-xl bg-indigo-50 font-mono font-black tracking-[0.25em] text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"             , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6675}} )
              , React.createElement(Eye, { className: "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500 pointer-events-none"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6676}} )
            )
            , React.createElement('p', { className: "text-[11px] text-slate-500 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6678}}, "GM Özel Kod ile birlikte sisteme girerken kullanılan 8 haneli şifredir."          )
          )

          , React.createElement('div', { className: "p-4 bg-red-50 border border-red-200 rounded-xl space-y-3"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6681}}
            , React.createElement('div', { className: "flex items-center justify-between gap-3"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6682}}
              , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6683}}
                , React.createElement('label', { className: "block text-sm font-black text-red-800"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6684}}, "Günlük İhlal Cezası"  )
                , React.createElement('p', { className: "text-[11px] text-red-600 mt-0.5"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6685}}, "Mevcut ihlal sayısını değiştirebilir veya hızlı işlemleri kullanabilirsiniz."       )
              )
              , React.createElement('span', { className: "px-3 py-1 bg-white border border-red-200 rounded-lg text-red-700 font-black"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6687}}, currentStrikeCount)
            )

            , React.createElement('input', { type: "number", min: "0", step: "1", name: "editStrikes", defaultValue: currentStrikeCount, className: "w-full p-3 border border-red-300 rounded-xl bg-white font-bold text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6690}} )

            , React.createElement('div', { className: "grid grid-cols-1 sm:grid-cols-2 gap-2"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6692}}
              , React.createElement('button', {
                type: "button",
                disabled: currentStrikeCount <= 0,
                onClick: () => {
                  if (currentStrikeCount <= 0) return;
                  setUsers(prev => Array.isArray(prev)
                    ? prev.map(u => u.id === user.id ? { ...u, strikes: Math.max(0, (Number(u.strikes) || 0) - 1) } : u)
                    : []
                  );
                  setCurrentUser(prev => prev && prev.id === user.id ? { ...prev, strikes: Math.max(0, (Number(prev.strikes) || 0) - 1) } : prev);
                  addLog('ADMIN_MÜDAHALE', `${user.name} adlı kullanıcının 1 günlük ihlali silindi.`, user.activeDeskId || null, user.id);
                },
                className: "py-2.5 bg-yellow-100 hover:bg-yellow-200 disabled:opacity-40 disabled:cursor-not-allowed text-yellow-800 rounded-xl font-bold text-sm"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6693}}
, "1 İhlal Sil"

              )

              , React.createElement('button', {
                type: "button",
                disabled: currentStrikeCount <= 0,
                onClick: () => {
                  if (currentStrikeCount <= 0) return;
                  setUsers(prev => Array.isArray(prev) ? prev.map(u => u.id === user.id ? { ...u, strikes: 0 } : u) : []);
                  setCurrentUser(prev => prev && prev.id === user.id ? { ...prev, strikes: 0 } : prev);
                  addLog('ADMIN_MÜDAHALE', `${user.name} adlı kullanıcının günlük ihlalleri sıfırlandı.`, user.activeDeskId || null, user.id);
                },
                className: "py-2.5 bg-red-100 hover:bg-red-200 disabled:opacity-40 disabled:cursor-not-allowed text-red-700 rounded-xl font-bold text-sm"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6710}}
, "Tümünü Sıfırla"

              )
            )

            , React.createElement('p', { className: "text-[11px] text-slate-500" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6725}}, "Bu alan günlük ihlal sayacını değiştirir. Geçmiş olay kayıtları “İhlal Kayıtları” bölümünde kayıt olarak kalır."

            )
          )

          , user.pendingApproval && React.createElement('label', { className: "block p-3 bg-amber-50 border rounded-xl"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6730}}, React.createElement('input', { type: "checkbox", name: "approveAccount", __self: this, __source: {fileName: _jsxFileName, lineNumber: 6730}} ), " Gerekli kontrolleri yaptım, hesabı onayla"     )
          , React.createElement('div', { className: "grid grid-cols-1 sm:grid-cols-2 gap-3"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6731}}
            , React.createElement('label', { className: "block p-3 bg-slate-50 border rounded-xl"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6732}}
              , React.createElement('span', { className: "font-bold", __self: this, __source: {fileName: _jsxFileName, lineNumber: 6733}}, "Süreli kısıtlama (gün)"  )
              , React.createElement('input', { name: "restrictionDays", type: "number", min: "0", step: "1", defaultValue: Number(user.restrictedUntil || 0) > Date.now() ? Math.ceil((user.restrictedUntil-Date.now())/86400000) : 0, className: "w-full p-2 border rounded-lg mt-2"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6734}} )
              , React.createElement('span', { className: "text-xs", __self: this, __source: {fileName: _jsxFileName, lineNumber: 6735}}, "0: Kısıtlamayı kaldır. Bitiş: "    , user.pendingApproval ? 'Sorumlu onayı bekleniyor' : Number(user.restrictedUntil || 0) > Date.now() ? new Date(user.restrictedUntil).toLocaleString('tr-TR') : 'Aktif')
              , React.createElement('label', { className: "block text-xs font-bold mt-3"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6736}}, "Kısıtlama nedeni / öğrenciye mesaj"
                , React.createElement('textarea', { name: "restrictionReason", maxLength: 300, rows: 3, defaultValue: user.restrictionReason || '',
                  placeholder: "Örn. Kütüphane kurallarına aykırı davranış nedeniyle..."     ,
                  className: "w-full mt-1 p-2 border border-red-200 rounded-lg bg-white font-normal"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6737}} )
              )
              , React.createElement('p', { className: "text-xs text-red-700" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6741}}, "Kısıt uygulandığında öğrenci bu mesajı hesabında görür. Eski kısıt geçmişi silinmez."          )
            )

            , React.createElement('label', { className: "flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6744}}
              , React.createElement('span', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6745}}
                , React.createElement('span', { className: "block text-sm font-bold text-slate-700"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6746}}, "İhbar Yetkisi" )
                , React.createElement('span', { className: "block text-[11px] text-slate-500"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6747}}, user.canReport !== false ? 'Şu an açık' : 'Şu an kapalı')
              )
              , React.createElement('input', { type: "checkbox", name: "editCanReport", defaultChecked: user.canReport !== false, className: "w-5 h-5 accent-green-600"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6749}} )
            )
          )

          , React.createElement('div', { className: "p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6753}}
            , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6754}}, React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6754}}, "Aktif Masa:" ), " " , user.activeDeskId ? `Masa ${user.activeDeskId}` : 'Yok')
            , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6755}}, React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6755}}, "GM Özel Kod:"  ), " " , user.specialCode || "-")
            , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6756}}, React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6756}}, "Kullanıcı ID:" ), " " , React.createElement('span', { className: "font-mono", __self: this, __source: {fileName: _jsxFileName, lineNumber: 6756}}, user.id))
          )

          , React.createElement('div', { className: "flex flex-col sm:flex-row gap-3 pt-1"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6759}}
            , React.createElement('button', { type: "button", onClick: () => { setAdminUserEditId(null); closeMessage(); }, className: "flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6760}}, "Vazgeç"

            )
            , React.createElement('button', { type: "submit", disabled: adminUserSavingId === user.id, className: "flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md flex items-center justify-center gap-2"            , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6763}}
              , React.createElement(Save, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6764}} ), " Değişiklikleri Kaydet"
            )
          )
        )
      )
    );
  };

  const renderAdminDeskContent = (deskId) => {
    const safeDesks = Array.isArray(desks) ? desks : [];
    const liveDesk = safeDesks.find(d => Number(d.id) === Number(deskId));
    if (!liveDesk) return null;
    const safeUsers = Array.isArray(users) ? users : [];
    const occupant = liveDesk.occupant ? safeUsers.find(u => u.id === liveDesk.occupant) : null;
    const guestOccupant = liveDesk.guestOccupant ? safeUsers.find(u => u.id === liveDesk.guestOccupant) : null;
    
    const getStatusDisplay = () => {
       switch(liveDesk.status) {
            case 'available': return React.createElement('span', { className: "px-3 py-1 bg-green-100 text-green-700 rounded-lg font-black text-sm uppercase tracking-wide"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6782}}, "Boşta");
            case 'occupied': return React.createElement('span', { className: "px-3 py-1 bg-blue-100 text-blue-700 rounded-lg font-black text-sm uppercase tracking-wide"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6783}}, "Öğrenci Masada" );
            case 'on_break': return React.createElement('span', { className: "px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg font-black text-sm uppercase tracking-wide"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6784}}, "Molada / Dışarıda"  );
            case 'reported': return React.createElement('span', { className: "px-3 py-1 bg-orange-100 text-orange-700 rounded-lg font-black text-sm uppercase tracking-wide animate-pulse"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6785}}, "İhbar Edildi (Kontrol)"  );
            case 'disabled': return React.createElement('span', { className: "px-3 py-1 bg-slate-200 text-slate-700 rounded-lg font-black text-sm uppercase tracking-wide"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6786}}, "Kullanıma Kapalı" );
            default: return 'Bilinmiyor';
       }
    };

    return (
        React.createElement('div', { className: "space-y-4", __self: this, __source: {fileName: _jsxFileName, lineNumber: 6792}}
          , React.createElement('div', { className: "bg-slate-50 p-4 rounded-xl border border-slate-200"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6793}}
            , React.createElement('div', { className: "mb-3 flex items-center gap-2"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6794}}, React.createElement('strong', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6794}}, "Durum:"), " " , getStatusDisplay())
            , occupant && (
              React.createElement(React.Fragment, null
                , React.createElement('p', { className: "mt-2 text-blue-700" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6797}}, React.createElement('strong', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6797}}, "Kullanıcı:"), " " , occupant.name, " (GM: "  , occupant.specialCode, ")")
                , React.createElement('p', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6798}}, React.createElement('strong', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6798}}, "Başlangıç:"), " " , formatDateTime(liveDesk.sessionStartTime))
                , React.createElement('p', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6799}}, React.createElement('strong', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6799}}, "Kalan Molalar:" ), " " , _optionalChain([occupant, 'access', _434 => _434.breaks, 'optionalAccess', _435 => _435.short]), " Kısa, "  , _optionalChain([occupant, 'access', _436 => _436.breaks, 'optionalAccess', _437 => _437.long]), " Uzun" )
                , React.createElement('p', { className: "text-red-600", __self: this, __source: {fileName: _jsxFileName, lineNumber: 6800}}, React.createElement('strong', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6800}}, "İhlal Sayısı:" ), " " , Number.isFinite(Number(occupant.strikes)) ? Number(occupant.strikes) : 0, " / 2"  )
              )
            )
          )

          , React.createElement('div', { className: "flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-xl shadow-sm relative"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6805}}
             , React.createElement('button', { onClick: () => { closeMessage(); setTimeout(() => handleAdminAction('regenerate_qr', liveDesk.id), 200); }, className: "absolute top-2 right-2 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors shadow-sm"           , title: "Sabit QR Kodunu Kontrol Et"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6806}}, React.createElement(RefreshCw, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6806}}))
             , React.createElement('p', { className: "text-sm font-bold text-slate-600 mb-1"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6807}}, "Masa " , liveDesk.id, " QR Kodu"  )
             , React.createElement('p', { className: "text-xs text-slate-400 mb-3"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6808}}, "Bu QR kod öğrencinin seçtiği masayı doğrulamak için kullanılır."        )
             , liveDesk.qrCode ? (
               React.createElement(React.Fragment, null
                 , React.createElement('img', {
                   src: getDeskQrImageUrl(liveDesk, 300),
                   alt: `Masa ${liveDesk.id} QR`,
                   className: "w-44 h-44 rounded-lg shadow-sm mb-3 border border-slate-200 bg-white p-2"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6811}}
                 )
                 , React.createElement('p', { className: "text-[10px] text-slate-500 font-mono break-all bg-slate-50 px-2 py-1 rounded w-full text-center border border-slate-200"           , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6816}}, liveDesk.qrCode)
                 , React.createElement('button', {
                   type: "button",
                   onClick: () => handleDownloadDeskQR(liveDesk),
                   className: "mt-3 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2"            , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6817}}

                   , React.createElement(QrCode, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6822}}), " Bu Masanın QR'ını İndir"
                 )
               )
             ) : (
               React.createElement('div', { className: "w-full p-4 bg-amber-50 border border-amber-200 rounded-xl text-center"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6826}}
                 , React.createElement('p', { className: "text-sm font-bold text-amber-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6827}}, "Bu masaya ait QR kod bulunamadı."     )
                 , React.createElement('button', {
                   type: "button",
                   onClick: () => { closeMessage(); setTimeout(() => handleAdminAction('regenerate_qr', liveDesk.id), 200); },
                   className: "mt-3 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-sm"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6828}}
, "QR Kod Oluştur"

                 )
               )
             )
          )

          , React.createElement('div', { className: "grid grid-cols-2 gap-2 mt-4"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6839}}
            , liveDesk.status === 'available' && (
               React.createElement('div', { className: "col-span-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-2"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6841}}
                 , React.createElement('p', { className: "text-xs font-bold text-blue-800 mb-2"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6842}}, "Öğrenci Ata (Manuel Düzenleme)"   )
                 , React.createElement('input', { type: "search", value: manualAssignSearch, onChange: e => setManualAssignSearch(e.target.value),
                   placeholder: "Ad, soyad veya GM özel koduyla ara"      , 'aria-label': "Manuel masa atamada öğrenci ara"    ,
                   className: "w-full p-2 rounded-lg border border-blue-300 bg-white text-sm mb-2"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6843}} )
                 , React.createElement('div', { className: "flex gap-2" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6846}}
                   , React.createElement('select', { id: `assign_user_${liveDesk.id}`, className: "flex-1 p-2 rounded border border-blue-300 text-sm bg-white"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6847}}
                      , React.createElement('option', { value: "", __self: this, __source: {fileName: _jsxFileName, lineNumber: 6848}}, "Öğrenci Seçin..." )
                      , safeUsers.filter(u => !u.activeDeskId && !u.pendingApproval && [u.name, u.specialCode].some(value => String(value || '').toLocaleLowerCase('tr-TR').includes(manualAssignSearch.trim().toLocaleLowerCase('tr-TR')))).map(u => (
                         React.createElement('option', { key: u.id, value: u.id, __self: this, __source: {fileName: _jsxFileName, lineNumber: 6850}}, u.name, " • GM Özel Kod: "     , u.specialCode, deskWaitRemaining(u) > 0 ? " • 30 dk bekleme: yönetici atayabilir" : "")
                      ))
                   )
                   , React.createElement('button', { onClick: () => {
                      const uid = document.getElementById(`assign_user_${liveDesk.id}`).value;
                      if(uid) { handleAdminAction('assign_user', liveDesk.id, uid); closeMessage(); setLiveDeskId(null); setManualAssignSearch(''); }
                   }, className: "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-sm shadow"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6853}}, "Ata")
                 )
               )
            )
            , liveDesk.status !== 'available' && liveDesk.status !== 'disabled' && (
               React.createElement('button', { onClick: () => handleAdminAction('release', liveDesk.id, liveDesk.occupant), className: "p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-semibold"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6861}}, "Masayı Boşalt" )
            )
            , liveDesk.status === 'reported' && (
               React.createElement('button', { onClick: () => handleAdminAction('cancel_report', liveDesk.id, liveDesk.occupant), className: "p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-sm font-semibold"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6864}}, "İhbarı İptal Et"  )
            )
            , liveDesk.status === 'disabled' ? (
               React.createElement('button', { onClick: () => handleAdminAction('enable', liveDesk.id), className: "p-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-bold shadow-md"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6867}}, "Kullanıma Aç" )
            ) : (
               React.createElement('button', { onClick: () => handleAdminAction('disable', liveDesk.id, liveDesk.occupant), className: "p-2 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg text-sm font-semibold"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6869}}, "Kullanıma Kapat" )
            )
            , occupant && occupant.strikes > 0 && (
               React.createElement('button', { onClick: () => handleAdminAction('clear_strike', liveDesk.id, occupant.id), className: "p-2 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded-lg text-sm font-semibold"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6872}}, "1 İhlal Sil"  )
            )

             , occupant && (
               React.createElement('button', { onClick: () => handleAdminAction('message_user', liveDesk.id, occupant.id), className: "p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm font-semibold border border-blue-300 flex items-center justify-center gap-1"            , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6876}}
                 , React.createElement(Smartphone, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6877}}), " Mesaj Gönder"
               )
             )

          )

          , React.createElement('button', { onClick: () => { closeMessage(); setLiveDeskId(null); }, className: "w-full mt-2 p-3 bg-slate-800 text-white hover:bg-slate-900 rounded-xl font-bold shadow-md transition-colors"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 6883}}, "Vazgeç / Geri Dön"   )
        )
    );
  };

  const safeUsersList = Array.isArray(users) ? users : [];
  const myUserObj = currentUser ? safeUsersList.find(u => u.id === currentUser.id) : null;
  const safeDesksList = Array.isArray(desks) ? desks : [];
  
  const possibleMyDesk = myUserObj && myUserObj.activeDeskId ? safeDesksList.find(d => Number(d.id) === Number(myUserObj.activeDeskId)) : null;
  const myDesk = isDeskOwnedByUser(possibleMyDesk, myUserObj) ? possibleMyDesk : null;
  const studentRestricted = !myUserObj || ((myUserObj.blocked || isRestricted(myUserObj, now)) &&
    !(myUserObj.activeDeskId && Number(myUserObj.adminDeskOverrideDeskId) === Number(myUserObj.activeDeskId) &&
      Number(_optionalChain([myDesk, 'optionalAccess', _438 => _438.sessionStartTime])) === Number(myUserObj.adminDeskOverrideSessionStart))); 
  const studentDeskWait = deskWaitRemaining(myUserObj, now);
  const filteredUsers = safeUsersList.filter(u => !userSearch.trim() || [u.name, u.specialCode, u.pin].some(value => String(value || '').toLocaleLowerCase('tr-TR').includes(userSearch.trim().toLocaleLowerCase('tr-TR'))));
  const linkedDeskIsReal = u => !u.activeDeskId || (Array.isArray(desks) && desks.some(d =>
    Number(d.id) === Number(u.activeDeskId) && (String(d.occupant || '') === String(u.id) || String(d.guestOccupant || '') === String(u.id))));
  const invalidDeskAccountCount = adminUsersServerReady && granularLoadedRef.current.desks
    ? safeUsersList.filter(u => !linkedDeskIsReal(u)).length : 0;
  const visibleLogs = [...new Map([...archivedLogs, ...(Array.isArray(logs) ? logs : [])].filter(l => !isRecordDeleted('logs', l.id) && !quietAuditEvents.has(l.type)).map(l => [l.id, l])).values()].sort((a,b) => b.time - a.time);
  const myDeskRole = _optionalChain([myUserObj, 'optionalAccess', _439 => _439.activeDeskRole]) || (_optionalChain([myDesk, 'optionalAccess', _440 => _440.guestOccupant]) === _optionalChain([currentUser, 'optionalAccess', _441 => _441.id]) ? 'guest' : 'owner');
  const myIsGuest = myDeskRole === 'guest';
  const myIsReported = myIsGuest ? _optionalChain([myDesk, 'optionalAccess', _442 => _442.guestReported]) === true : _optionalChain([myDesk, 'optionalAccess', _443 => _443.status]) === 'reported';
  const myReportEndTime = myIsGuest ? _optionalChain([myDesk, 'optionalAccess', _444 => _444.guestReportEndTime]) : _optionalChain([myDesk, 'optionalAccess', _445 => _445.reportEndTime]);
  const myBreakEndTime = myIsGuest ? _optionalChain([myDesk, 'optionalAccess', _446 => _446.guestBreakEndTime]) : _optionalChain([myDesk, 'optionalAccess', _447 => _447.breakEndTime]);
  const myIsOnBreak = myIsGuest ? !!_optionalChain([myDesk, 'optionalAccess', _448 => _448.guestBreakEndTime]) : _optionalChain([myDesk, 'optionalAccess', _449 => _449.status]) === 'on_break';
  const breakCountdown = myIsGuest
    ? safeBreakCountdown({breakEndTime: myBreakEndTime}, now + serverTimeOffsetMs)
    : safeBreakCountdown(myDesk, now + serverTimeOffsetMs);
  // Süre 00:00 olduğunda sunucu masanın HALA molada olduğunu yeniden doğrular.
  // Sistem kaydı tekrar girildiğinde çoğalmaz; QR dönüşü/aktif oturum değişmez.
  // Uygulama kapalıyken zamanlayıcı aynı kontrolü sunucuda yürütür.
  const expiredBreak = expiredBreakDetails({
    desk: myDesk, userId: _optionalChain([currentUser, 'optionalAccess', _450 => _450.id]), activeDeskId: _optionalChain([myUserObj, 'optionalAccess', _451 => _451.activeDeskId]),
    isGuest: myIsGuest, at: now + serverTimeOffsetMs, clockVerified: serverClockVerified
  });
  const breakExpiryAttemptsRef = useRef(new Map());
  useEffect(() => {
    if (view !== 'student_dash' || !isDataLoaded || !fbUser || adminAuthorized || !expiredBreak) return;
    const key = `${expiredBreak.userId}:${expiredBreak.deskId}:${expiredBreak.isGuest}:${expiredBreak.endAt}`;
    const previous = breakExpiryAttemptsRef.current.get(key);
    if (previous === 'done' || typeof previous === 'number' && Date.now() - previous < 15000) return;
    breakExpiryAttemptsRef.current.set(key, Date.now());
    runStudentActivity('break-expired', { deskId: expiredBreak.deskId })
      .then(result => {
        if (_optionalChain([result, 'optionalAccess', _452 => _452.saved]) || _optionalChain([result, 'optionalAccess', _453 => _453.reason]) === 'not_expired_or_returned') {
          breakExpiryAttemptsRef.current.set(key, 'done');
        }
      })
      .catch(() => { /* Ağ kesilirse sonraki kontrolde yeniden denenir. */ });
  }, [view, isDataLoaded, _optionalChain([fbUser, 'optionalAccess', _454 => _454.uid]), adminAuthorized, _optionalChain([expiredBreak, 'optionalAccess', _455 => _455.endAt]), _optionalChain([expiredBreak, 'optionalAccess', _456 => _456.deskId]), Math.floor(now / 15000)]);

  const breakRepairAttemptRef = useRef(new Set());
  useEffect(() => {
    const last = _optionalChain([myUserObj, 'optionalAccess', _457 => _457.lastBreakSession]);
    if (!db || !serverClockVerified || !myDesk || myIsGuest || !last ||
        last.status !== 'active' || Number(last.deskId) !== Number(myDesk.id) ||
        Number(last.endAt) <= Date.now() + serverTimeOffsetMs ||
        !((myDesk.status === 'on_break' && breakCountdown.kind === 'invalid') ||
          myDesk.status === 'occupied')) return;
    const key = String(last.id);
    if (breakRepairAttemptRef.current.has(key)) return;
    breakRepairAttemptRef.current.add(key);
    runStudentDeskAction('break-repair', { deskId: myDesk.id })
      .then(result => { if (_optionalChain([result, 'optionalAccess', _458 => _458.refunded])) applyCloudRows(result); })
      .catch(error => console.warn('Mola durumu onarılamadı:', error.message));
  }, [_optionalChain([myUserObj, 'optionalAccess', _459 => _459.lastBreakSession, 'optionalAccess', _460 => _460.id]), _optionalChain([myUserObj, 'optionalAccess', _461 => _461.lastBreakSession, 'optionalAccess', _462 => _462.status]),
      _optionalChain([myDesk, 'optionalAccess', _463 => _463.id]), _optionalChain([myDesk, 'optionalAccess', _464 => _464.status]), _optionalChain([myDesk, 'optionalAccess', _465 => _465.breakEndTime]), serverClockVerified]);

  const validateUniqueCredentials = (candidate, existing, exceptId = null) => {
    const code = String(candidate.specialCode || '');
    const pin = String(candidate.pin || '');
    if (!/^\d{8}$/.test(code) || !/^\d{8}$/.test(pin)) throw new Error('GM Özel Kod ve şifre tam 8 rakam olmalıdır.');
    if (code === pin) throw new Error('GM Özel Kod ile şifre birbirinden farklı olmalıdır.');
    for (const u of existing) {
      if (exceptId != null && String(u.id) === String(exceptId)) continue;
      if (String(u.specialCode || '') === code) throw new Error('Bu GM Özel Kod daha önce kullanılmış.');
      if (String(u.pin || '') === pin) throw new Error('Bu şifre daha önce kullanılmış.');
    }
  };
  const requireAdminForUserWrite = async () => {
    if (!db) return;
    if (!auth) throw new Error('Yönetici oturumu bulunamadı.');
    await ensureTabAuthPersistence(); await auth.authStateReady();
    const token = await _optionalChain([auth, 'access', _466 => _466.currentUser, 'optionalAccess', _467 => _467.getIdTokenResult, 'call', _468 => _468(true)]);
    if (!token || token.claims.admin !== true) throw new Error('Sunucuda doğrulanmış yönetici yetkisi gerekli.');
  };
  const createEightDigitCode = (used = new Set()) => {
    if(used.size>=90000000) throw new Error('Kimlik alanı doldu.');
    while(true) {
      const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);
      if(bytes[0]>=4230000000) continue;
      const code=String(10000000+bytes[0]%90000000);
      if(!used.has(code))return code;
    }
  };

  const pushUndoSnapshot = (label) => {
    // Canlı hak değişikliği geriye dönük yeniden hesaplama gerektirir; eski ayarı snapshot'tan geri yazma.
    if (db && label === 'Sistem ayarlarını kaydetme') return;
    const snapshot = {
      id: `UNDO-${Date.now()}-${generateId()}`,
      label,
      tab: adminTab,
      time: Date.now(),
      settings: JSON.parse(JSON.stringify(settings || {})),
      layoutElements: JSON.parse(JSON.stringify(Array.isArray(layoutElements) ? layoutElements : [])),
      users: JSON.parse(JSON.stringify(Array.isArray(usersRef.current) ? usersRef.current : [])),
      logs: JSON.parse(JSON.stringify(Array.isArray(logsRef.current) ? logsRef.current : [])),
      archivedLogs: JSON.parse(JSON.stringify(archivedLogs)),
      violationRecords: JSON.parse(JSON.stringify(Array.isArray(violationRecordsRef.current) ? violationRecordsRef.current : [])),
      feedbackRecords: JSON.parse(JSON.stringify(Array.isArray(feedbackRecordsRef.current) ? feedbackRecordsRef.current : [])),
      desks: JSON.parse(JSON.stringify(Array.isArray(desksRef.current) ? desksRef.current : []))
    };
    setUndoStack(prev => [snapshot, ...prev].slice(0, 20));
  };

  const getCurrentTabUndoSnapshot = () => undoStack.find(item => _optionalChain([item, 'optionalAccess', _469 => _469.tab]) === adminTab) || null;

  const undoLastAdminOperation = async () => {
    const snapshot = getCurrentTabUndoSnapshot();
    if (!snapshot) return showMessage('Geri Alınacak İşlem Yok', 'Bu sekmede henüz geri alınabilecek bir yönetici işlemi bulunmuyor.', 'warning');
    if (db && (!fbUser || !adminAuthorized || !navigator.onLine)) return showMessage('Geri Alınamadı', 'Yönetici bağlantısı kurulunca yeniden deneyin.', 'warning');
    if (db && fbUser) {
      try {
        await appendChainRef.current;
        const historyToRestore = [
          ...[...snapshot.logs, ...(snapshot.archivedLogs || [])].filter(row => isRecordDeleted('logs', row.id)).map(row => ['sgmAudit', 'logs', row]),
          ...snapshot.violationRecords.filter(row => isRecordDeleted('violations', row.id)).map(row => ['sgmViolations', 'violations', row]),
          ...snapshot.feedbackRecords.filter(row => isRecordDeleted('feedback', row.id)).map(row => ['sgmFeedback', 'feedback', row])
        ];
        const historyResults = await mapLimited(historyToRestore, ([bucket, kind, row]) => runTransaction(db, async tx => {
          const marker = getLiveDoc('sgmDeletedRecords', `${kind}-${row.id}`);
          await tx.get(marker); tx.delete(marker); tx.set(getLiveDoc(bucket, row.id), row);
        }));
        if (historyResults.some(result => result.status === 'rejected')) throw new Error('Kayıtların geri alınması sunucuya kaydedilemedi.');
        for (const [bucket, kind, row] of historyToRestore) {
          delete readAppendOutbox()[`${bucket}/${row.id}`];
          if (kind === 'logs') delete readAppendOutbox()[`sgmLogs/${row.id}`];
        }
        saveAppendOutbox();
        const restored = snapshot.users.filter(user => isRecordDeleted('users', user.id) || serverDeletedUserIdsRef.current.has(String(user.id)));
        const results = await mapLimited(restored, user => runTransaction(db, async tx => {
          const target = getLiveDoc('sgmUsers', user.id), marker = getLiveDoc('sgmDeletedUsers', user.id);
          const [ignored, existing] = await Promise.all([tx.get(marker), tx.get(target)]);
          tx.delete(marker);
          // Geri yüklenen hesap eski masayı geri alamaz; canlı oturum sahibi korunur.
          if (!existing.exists()) tx.set(target, { ...withoutSessionWrites(user, 'users'),
            activeDeskId: null, activeDeskRole: null, pendingDeskId: null, pendingDeskDeadline: null,
            adminDeskOverrideDeskId: null, adminDeskOverrideSessionStart: null });
        }));
        if (results.some(result => result.status === 'rejected')) throw new Error('Geri alma sunucuya kaydedilemedi.');
        restored.forEach(user => { pendingUserDeletesRef.current.delete(String(user.id)); serverDeletedUserIdsRef.current.delete(String(user.id)); });
        localStorage.setItem('sgm_pending_user_deletes', JSON.stringify(Array.from(pendingUserDeletesRef.current)));
      } catch (error) { handleFirestoreQuotaError(error); return showMessage('Geri Alınamadı', error.message, 'warning'); }
    }
    // Geri alma sırasında eski masa/aktif kullanıcı snapshot'ı asla canlının üzerine dönmez.
    let restoredUsers = snapshot.users;
    let restoredDesks = snapshot.desks;
    if (db) {
      try {
        const [latestUsers, latestDesks] = await Promise.all([
          getDocsFromServer(getLiveCollection('sgmUsers')),
          getDocsFromServer(getLiveCollection('sgmDesks'))
        ]);
        const oldUsers = new Map(snapshot.users.map(row => [String(row.id), row]));
        const oldDesks = new Map(snapshot.desks.map(row => [String(row.id), row]));
        restoredUsers = latestUsers.docs.map(d => {
          const current = { ...d.data(), id: d.id };
          return { ...current, ...withoutSessionWrites(oldUsers.get(String(d.id)) || current, 'users') };
        });
        restoredDesks = latestDesks.docs.map(d => {
          const current = { ...d.data(), id: Number(d.id) };
          return { ...current, ...withoutSessionWrites(oldDesks.get(String(d.id)) || current, 'desks') };
        });
      } catch (error) {
        return showMessage('Geri Alınamadı', 'Canlı masa ve kullanıcı kayıtları doğrulanamadı. Lütfen tekrar deneyin.', 'warning');
      }
    }
    restoreDeletedRecordProtectionFromSnapshot(snapshot);
    if (snapshot.settings) setSettings(snapshot.settings);
    if (Array.isArray(snapshot.layoutElements)) setLayoutElements(snapshot.layoutElements);
    snapshot.users.forEach(u=>deletedUserIds.delete(u.id));
    setUsers(restoredUsers); usersRef.current = restoredUsers;
    setLogs(snapshot.logs); logsRef.current = snapshot.logs;
    setArchivedLogs(snapshot.archivedLogs || []);
    setViolationRecords(snapshot.violationRecords); violationRecordsRef.current = snapshot.violationRecords;
    setFeedbackRecords(snapshot.feedbackRecords); feedbackRecordsRef.current = snapshot.feedbackRecords;
    setDesks(restoredDesks); desksRef.current = restoredDesks;
    setUndoStack(prev => prev.filter(item => item.id !== snapshot.id));
    setSelectedUserIds([]); setSelectedLogIds([]); setSelectedViolationIds([]); setSelectedFeedbackIds([]);
    addLog('ADMIN_GERI_AL', `${snapshot.label} işlemi geri alındı.`);
    showMessage('İşlem Geri Alındı', `${snapshot.label} işlemi öncesindeki durum geri yüklendi.`, 'success');
  };

  const createAutomaticUser = async () => {
    if (adminCreatingUser) return;
    // Aynı başarısız isteği tekrar denemek ikinci bir hesap oluşturmaz.
    if (!adminCreateRequestRef.current) {
      const requestId = crypto.randomUUID ? crypto.randomUUID() : 'ADMIN-' + Date.now() + '-' + generateId();
      adminCreateRequestRef.current = { name: 'Yeni Kayıt • ' + requestId, requestId };
    }
    const name = adminCreateRequestRef.current.name;
    setAdminCreatingUser(true);
    try {
      pushUndoSnapshot('Yeni kullanıcı oluşturma');
      let newUser;
      if (db) {
        if (!auth) throw new Error('Firebase yönetici oturumu bulunamadı.');
        await ensureTabAuthPersistence(); await auth.authStateReady();
        const adminUser = auth.currentUser;
        if (!adminUser) throw new Error('Yönetici paneline yeniden giriş yapın.');
        const tokenResult = await adminUser.getIdTokenResult(true);
        if (tokenResult.claims.admin !== true) throw new Error('Yönetici yetkisi gerekli.');
        if (!adminCreateRequestRef.current || adminCreateRequestRef.current.name !== name.trim()) {
          adminCreateRequestRef.current = {name: name.trim(), requestId: crypto.randomUUID ? crypto.randomUUID() : 'ADMIN-' + Date.now() + '-' + generateId()};
        }
        const response = await fetch('/api/admin-student-create', {
          method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${tokenResult.token}`},
          body: JSON.stringify(adminCreateRequestRef.current)
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || _optionalChain([payload, 'optionalAccess', _470 => _470.ok]) !== true || !_optionalChain([payload, 'access', _471 => _471.user, 'optionalAccess', _472 => _472.id])) throw new Error(_optionalChain([payload, 'optionalAccess', _473 => _473.message]) || `Hesap servisi HTTP ${response.status} döndürdü.`);
        if (_optionalChain([auth, 'access', _474 => _474.currentUser, 'optionalAccess', _475 => _475.uid]) !== adminUser.uid) throw new Error('Hesap kaydedildi ancak yönetici oturumu değişti. Yönetici panelinden listeyi kontrol edin.');
        newUser = payload.user;
        granularBaselineRef.current.users.set(String(newUser.id), newUser);
      } else {
        const localRows = usersRef.current || [];
        const identityNo = createEightDigitCode(new Set(localRows.map(u => u.identityNo)));
        const usedSecrets = new Set(localRows.flatMap(u => [u.pin, u.specialCode]).map(String));
        const pin = createEightDigitCode(usedSecrets); usedSecrets.add(pin);
        const specialCode = createEightDigitCode(usedSecrets);
        newUser = {id: 'U' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + generateId()), name: name.trim(), identityNo, pin, specialCode,
          pendingApproval: true, restrictionReason: 'Sorumlu onayı bekleniyor', restrictedUntil: 0,
          activeDeskId: null, breaks: {short: settings.shortBreakCount, long: settings.longBreakCount, hourly: allowedBreakCount(settings, 'hourly')}, strikes: 0, blocked: false, canReport: true};
        pendingUserCreatesRef.current.add(String(newUser.id));
      }
      // Yeni hesap ayrı kimlikle eklenir; mevcut hesapların üstüne yazılmaz.
      const latest = usersRef.current || [];
      usersRef.current = [...latest.filter(u => u.id !== newUser.id), newUser]; setUsers(usersRef.current);
      localStorage.setItem('sgm_users', JSON.stringify(usersRef.current));
      adminCreateRequestRef.current = null;
      addLog('ADMIN_KULLANICI_OLUSTUR', 'Yeni kullanıcı ayrı kimlikle oluşturuldu; hesap onay bekliyor.', null, newUser.id);
      showMessage('Bilgilerinizi Kaydedin', `GM Özel Kod: ${newUser.specialCode}\nŞifre: ${newUser.pin}\nKütüphane sorumlumuz ile iletişime geçin.`, 'success');
    } catch (error) {
      handleFirestoreQuotaError(error);
      showMessage('Hesap Oluşturulamadı', error.message, 'warning');
    } finally { setAdminCreatingUser(false); }
  };

  const createManualUser = async event => {
    event.preventDefault();
    if (adminCreatingUser) return;
    const fields = new FormData(event.currentTarget);
    const name = String(fields.get('name') || '').trim();
    const specialCode = cleanIdentityFormat(fields.get('specialCode'));
    const pin = cleanIdentityFormat(fields.get('pin'));
    if (!name) return showMessage('Bilgi Eksik', 'Ad soyad gerekli.', 'warning');
    setAdminCreatingUser(true);
    try {
      await requireAdminForUserWrite();
      const remoteRows = db ? (await getDocsFromServer(getLiveCollection('sgmUsers'))).docs.map(d => ({...d.data(), id:d.id})) : [];
      const existing = [...remoteRows, ...(usersRef.current || [])];
      validateUniqueCredentials({specialCode, pin}, existing);
      const id = 'U' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + generateId());
      const identityNo = createEightDigitCode(new Set(existing.map(u => String(u.identityNo || ''))));
      const newUser = {id, name, identityNo, specialCode, pin,
        pendingApproval: true, restrictionReason: 'Sorumlu onayı bekleniyor', restrictedUntil: 0,
        activeDeskId: null, pendingDeskId: null, breaks: {short: settings.shortBreakCount, long: settings.longBreakCount, hourly: allowedBreakCount(settings, 'hourly')},
        strikes: 0, blocked: false, canReport: true};
      if (db) {
        await runTransaction(db, async tx => {
          const ref = getLiveDoc('sgmUsers', id);
          const snapshot = await tx.get(ref);
          if (snapshot.exists()) throw new Error('Kullanıcı kimliği çakıştı; yeniden deneyin.');
          tx.set(ref, newUser);
        });
        granularBaselineRef.current.users.set(String(id), newUser);
      } else pendingUserCreatesRef.current.add(String(id));
      const next = [...(usersRef.current || []), newUser];
      usersRef.current = next; setUsers(next);
      localStorage.setItem('sgm_users', JSON.stringify(next));
      setManualUserOpen(false);
      addLog('ADMIN_KULLANICI_MANUEL_EKLE', 'Yönetici tarafından manuel kullanıcı oluşturuldu.', null, id);
      showMessage('Kullanıcı Eklendi', `GM Özel Kod: ${specialCode}\nŞifre: ${pin}\nHesap yönetici onayı bekliyor.`, 'success');
    } catch (error) { handleFirestoreQuotaError(error); showMessage('Kullanıcı Eklenemedi', error.message, 'warning'); }
    finally { setAdminCreatingUser(false); }
  };

  const bulkUserAction = async (action) => {
    if (!selectedUserIds.length) return showMessage('Seçim Yok', 'Önce en az bir kullanıcı seçin.', 'warning');

    const ids = new Set(selectedUserIds.map(String));
    const current = Array.isArray(usersRef.current) ? usersRef.current : [];

    if (action === 'delete') {
      const selectedExisting = current.filter(u => ids.has(String(u.id)));
      if (!selectedExisting.length) return showMessage('Seçim Yok', 'Seçilen kullanıcılar artık listede bulunmuyor.', 'warning');

      pushUndoSnapshot('Toplu kullanıcı silme');
      const result = await permanentlyDeleteUsers(selectedExisting.map(u => u.id));
      setSelectedUserIds([]);

      if (result.failedIds.length) {
        addLog('ADMIN_TOPLU_KULLANICI', `${result.deletedCount} kullanıcı silindi; ${result.failedIds.length} kullanıcı Firestore silme hatası nedeniyle beklemede.`);
        return showMessage('Kısmen Tamamlandı', `${result.deletedCount} kullanıcı kalıcı olarak silindi. ${result.failedIds.length} kayıt Firestore'dan silinemedi; bağlantı/kota düzeldikten sonra tekrar deneyin.`, 'warning');
      }

      addLog('ADMIN_TOPLU_KULLANICI', `${result.deletedCount} kullanıcı Firestore dahil kalıcı olarak silindi.`);
      return showMessage('Başarılı', `${result.deletedCount} kullanıcı kalıcı olarak silindi. Aktif ve bekleyen masa bağlantıları temizlendi.`, 'success');
    }

    pushUndoSnapshot('Toplu kullanıcı işlemi');
    let next = current;
    if (action === 'block') next = current.map(u => ids.has(String(u.id)) ? { ...u, blocked: false, restrictedUntil: Date.now() + Math.max(1, Number(bulkRestrictionDays) || 5) * 86400000, restrictionReason: 'Yönetici tarafından toplu süreli kısıtlama' } : u);
    else if (action === 'unblock') next = current.map(u => ids.has(String(u.id)) ? { ...u, blocked: false, pendingApproval: false, restrictedUntil: 0, restrictionReason: '', canReport: true, reportPermissionPolicyVersion: 1, reportPermissionRestrictionUntil: 0 } : u);

    if (db) {
      try {
        if (action === 'unblock') {
          await approveUsersNow([...ids]);
        } else {
          for (const desired of next.filter(u => ids.has(String(u.id)))) {
            const original = current.find(u => u.id === desired.id);
            await saveAdminUserChanges(original, desired);
          }
        }
      } catch (error) {
        handleFirestoreQuotaError(error);
        return showMessage('Toplu İşlem Tamamlanamadı', 'Tamamlanan hesaplar kaydedildi; kalanlar için tekrar deneyin. ' + error.message, 'warning');
      }
    } else {
      usersRef.current = next;
      setUsers(next);
    }
    setSelectedUserIds([]);
    addLog('ADMIN_TOPLU_KULLANICI', `${ids.size} kullanıcı için ${action} toplu işlemi uygulandı.`);
  };

  const reportSettingsRepairBusyRef = useRef(false);
  useEffect(() => {
    if (!db || !adminDataMode || !fbUser || !isDataLoaded || settings.reportsEnabled !== false || reportSettingsRepairBusyRef.current) return;
    reportSettingsRepairBusyRef.current = true;
    const enable = async () => {
      try {
        const next = await runTransaction(db, async tx => {
          const ref = getLiveSettingsDoc(), snapshot = await tx.get(ref);
          const remote = {...DEFAULT_SETTINGS, ...(snapshot.data() || {})};
          if (remote.reportsEnabled === false) tx.set(ref, {reportsEnabled: true}, {merge: true});
          return {...remote, reportsEnabled: true};
        });
        granularBaselineRef.current.settings = stableJson(next);
        settingsRef.current = next; setSettings(next);
        addLog('ADMIN_IHBAR_SISTEM_ACILDI', 'Boş masa ihbarı sistem genelinde açıldı. Moladaki masalar ihbar edilemez.');
      } catch (error) { handleFirestoreQuotaError(error); }
      finally { reportSettingsRepairBusyRef.current = false; }
    };
    enable();
  }, [adminDataMode, fbUser, isDataLoaded, settings.reportsEnabled, Math.floor(now / 15000)]);

  const reportPermissionRepairBusyRef = useRef(false);
  useEffect(() => {
    if (!isDataLoaded || (db && (!adminDataMode || !fbUser || !navigator.onLine || !granularLoadedRef.current.users)) || reportPermissionRepairBusyRef.current) return;
    const candidates = (usersRef.current || []).filter(user => shouldRestoreReportPermission(user));
    if (!candidates.length) return;
    reportPermissionRepairBusyRef.current = true;
    const restore = async () => {
      try {
        for (const candidate of candidates) {
          const result = db
            ? (await runAdminMaintenance('restore_report_permission', { userId: candidate.id })).user
            : (() => {
                const user = usersRef.current.find(u => u.id === candidate.id);
                return user && shouldRestoreReportPermission(user)
                  ? { ...user, canReport: true, reportPermissionPolicyVersion: 1,
                      reportPermissionRestrictionUntil: Number(user.restrictedUntil || 0),
                      reportPermissionRestoredAt: Date.now() }
                  : null;
              })();
          if (!result) continue;
          applyCloudRows({ user: result });
          addLog('ADMIN_IHBAR_YETKISI_ACILDI', 'Hesap kısıtı bulunmayan öğrencinin ihbar yetkisi açıldı.', null, result.id);
        }
      } catch (error) { handleFirestoreQuotaError(error); }
      finally { reportPermissionRepairBusyRef.current = false; }
    };
    restore();
  }, [isDataLoaded, adminDataMode, fbUser, users, Math.floor(now / 15000)]);

  const bulkDeleteRecords = (kind) => {
    const config = {
      logs: [selectedLogIds, logsRef, setLogs, setSelectedLogIds],
      violations: [selectedViolationIds, violationRecordsRef, setViolationRecords, setSelectedViolationIds],
      feedback: [selectedFeedbackIds, feedbackRecordsRef, setFeedbackRecords, setSelectedFeedbackIds]
    }[kind];
    if (!config || !config[0].length) return showMessage('Seçim Yok', 'Önce silmek istediğiniz kayıtları seçin.', 'warning');
    pushUndoSnapshot('Toplu kayıt silme');
    const [selected, ref, setter, clear] = config; const ids = new Set(selected);
    const bucket = kind === 'violations' ? 'violations' : kind === 'feedback' ? 'feedback' : 'logs';
    selected.forEach(id => rememberDeletedRecordId(bucket, id));
    if (kind !== 'logs') deleteHistoryRecords(bucket, selected);
    const next = (Array.isArray(ref.current) ? ref.current : []).filter(x => !ids.has(x.id));
    if (kind === 'logs') { setArchivedLogs(prev => prev.filter(x => !ids.has(x.id))); deleteArchivedLogIds(selected); }
    ref.current = next; setter(next); clear([]);
    addLog('ADMIN_TOPLU_SILME', `${ids.size} adet ${kind} kaydı toplu olarak silindi.`);
  };

  const handleExportUsers = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(users, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `sgm_ogrenciler_${new Date().toLocaleDateString('tr-TR')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    addLog('SİSTEM_YEDEK', 'Kullanıcı listesi JSON formatında yedek olarak indirildi.');
  };

  const deleteSystemLog = (log) => {
    if (!_optionalChain([log, 'optionalAccess', _476 => _476.id])) return;

    showMessage(
      'Kaydı Sil',
      React.createElement('div', { className: "space-y-4", __self: this, __source: {fileName: _jsxFileName, lineNumber: 7307}}
        , React.createElement('p', { className: "text-sm text-slate-700" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7308}}, "Bu sistem kaydını silmek istediğinize emin misiniz?"      )
        , React.createElement('div', { className: "p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7309}}
          , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 7310}}, React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 7310}}, "İşlem:"), " " , String(log.type || 'KAYIT').replace(/_/g, ' '))
          , React.createElement('div', { className: "mt-1", __self: this, __source: {fileName: _jsxFileName, lineNumber: 7311}}, React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 7311}}, "Tarih:"), " " , new Date(log.time || Date.now()).toLocaleString('tr-TR'))
          , React.createElement('div', { className: "mt-1", __self: this, __source: {fileName: _jsxFileName, lineNumber: 7312}}, React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 7312}}, "Açıklama:"), " " , log.message || '-')
        )
        , React.createElement('p', { className: "text-xs text-red-600 font-semibold"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7314}}, "Silinen kayıt, Kayıtlar listesinden ve senkronize veriden kaldırılır."       )
        , React.createElement('div', { className: "flex gap-3" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7315}}
          , React.createElement('button', { onClick: closeMessage, className: "flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7316}}, "İptal")
          , React.createElement('button', { onClick: () => {
            pushUndoSnapshot('Sistem kaydı silme');
            rememberDeletedRecordId('logs', log.id);
            setArchivedLogs(prev => prev.filter(item => item.id !== log.id));
            deleteArchivedLogIds([log.id]);
            const nextLogs = (Array.isArray(logsRef.current) ? logsRef.current : [])
              .filter(item => _optionalChain([item, 'optionalAccess', _477 => _477.id]) !== log.id && !isRecordDeleted('logs', _optionalChain([item, 'optionalAccess', _478 => _478.id])));
            logsRef.current = nextLogs;
            setLogs(nextLogs);
            setSelectedLogIds(prev => prev.filter(id => id !== log.id));
            addLog('ADMIN_KAYIT_SIL', 'Bir sistem kaydı silindi.', null, null, false, null, { deletedLogId: log.id });
            closeMessage();
            setTimeout(() => showMessage('Kayıt Silindi', 'Seçilen sistem kaydı başarıyla silindi.', 'success'), 100);
          }, className: "flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md flex items-center justify-center gap-2"           , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7317}}
            , React.createElement(Trash2, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7331}}), " Sil"
          )
        )
      ),
      'danger'
    );
  };

  const downloadLogsCsv = (period = 'week') => {
    const safeLogs = visibleLogs;
    const nowDate = new Date();
    const startDate = new Date(nowDate);

    if (period === 'month') {
      startDate.setDate(nowDate.getDate() - 30);
    } else {
      startDate.setDate(nowDate.getDate() - 7);
    }
    startDate.setHours(0, 0, 0, 0);

    const filteredLogs = safeLogs
      .filter(log => Number(_optionalChain([log, 'optionalAccess', _479 => _479.time]) || 0) >= startDate.getTime() && Number(_optionalChain([log, 'optionalAccess', _480 => _480.time]) || 0) <= nowDate.getTime())
      .sort((a, b) => Number(_optionalChain([b, 'optionalAccess', _481 => _481.time]) || 0) - Number(_optionalChain([a, 'optionalAccess', _482 => _482.time]) || 0));

    if (filteredLogs.length === 0) {
      return showMessage(
        'İndirilecek Kayıt Yok',
        period === 'month' ? 'Son 30 güne ait kayıt bulunamadı.' : 'Son 7 güne ait kayıt bulunamadı.',
        'warning'
      );
    }

    const escapeCsv = (value) => {
      const str = String(_nullishCoalesce(value, () => ( '')));
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = [
      ['Tarih', 'Saat', 'İşlem Tipi', 'Masa', 'Açıklama', 'Kullanıcı', 'Cihaz', 'Konum'],
      ...filteredLogs.map(log => {
        const d = new Date(log.time || Date.now());
        return [
          d.toLocaleDateString('tr-TR'),
          d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          String(log.type || 'KAYIT').replace(/_/g, ' '),
          log.deskId || '',
          log.message || '',
          log.userInfo || '',
          log.deviceInfo || '',
          log.locationInfo || ''
        ];
      })
    ];

    // UTF-8 BOM Excel'de Türkçe karakterlerin düzgün görünmesini sağlar.
    const csvContent = '\uFEFF' + rows.map(row => row.map(escapeCsv).join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateKey = getLocalDayKey(nowDate);
    a.href = url;
    a.download = period === 'month'
      ? `sgm_kayitlar_aylik_${dateKey}.csv`
      : `sgm_kayitlar_haftalik_${dateKey}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    addLog(
      'KAYIT_DISA_AKTARILDI',
      `${period === 'month' ? 'Aylık (son 30 gün)' : 'Haftalık (son 7 gün)'} sistem kayıtları CSV/Excel uyumlu formatta indirildi.`
    );
  };

  const handleImportUsers = async e => {
    const file = _optionalChain([e, 'access', _483 => _483.target, 'access', _484 => _484.files, 'optionalAccess', _485 => _485[0]]);
    e.target.value = '';
    if (!file || userImportBusy || userBackupRestoreInFlightRef.current) return;
    setUserImportBusy(true);
    userBackupRestoreInFlightRef.current = true;
    let restoreCompleted = false;
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = Array.isArray(parsed) ? parsed : _optionalChain([parsed, 'optionalAccess', _486 => _486.users]);
      if (!Array.isArray(incoming) || !incoming.length) throw new Error('Yedek, boş olmayan bir kullanıcı dizisi içermelidir.');
      if (incoming.length > 20000) throw new Error('Yedek en fazla 20.000 kullanıcı içerebilir.');
      await requireAdminForUserWrite();
      // Daha önce planlanmış otomatik yazma, geri yükleme sonucunu geri almasın.
      if (granularWriteTimerRef.current) {
        clearTimeout(granularWriteTimerRef.current);
        granularWriteTimerRef.current = null;
      }
      await granularWriteChainRef.current.catch(() => {});
      const remote = db ? (await getDocsFromServer(getLiveCollection('sgmUsers'))).docs.map(d => ({ ...d.data(), id: d.id })) : [];
      const current = db ? remote : (usersRef.current || []);
      const byId = new Map(current.map(u => [String(u.id), u]));
      const ids = new Set();
      const imported = incoming.map((u, i) => {
        if (!u || typeof u !== 'object' || Array.isArray(u) || !u.id || !String(u.name || '').trim())
          throw new Error(`Yedekte ${i + 1}. kullanıcı kaydı geçersiz.`);
        const id = String(u.id);
        if (ids.has(id)) throw new Error('Yedekte aynı kullanıcı kimliği birden fazla kez var.');
        ids.add(id);
        return { ...u, id };
      });
      // Sunucudaki hesapların güncel ayarlarını koru; yalnızca eksikleri tamamla.
      const missing = imported.filter(u => !byId.has(u.id));
      const usedCodes = new Set(current.map(u => String(u.specialCode || '')));
      const usedPins = new Set(current.map(u => String(u.pin || '')));
      for (const u of missing) {
        validateUniqueCredentials(u, [...current, ...missing.filter(x => x.id !== u.id)]);
        if (usedCodes.has(String(u.specialCode)) || usedPins.has(String(u.pin)))
          throw new Error('Yedek mevcut hesaplarla kod/şifre çakışması içeriyor.');
        usedCodes.add(String(u.specialCode)); usedPins.add(String(u.pin));
      }
      if (db) {
        // Gecikmiş snapshotları bastırırken kayıtları kalıcı olarak Firebase'e yaz.
        // Silinme işareti olan hesaplar da açık yedek geri yükleme işlemiyle kurtarılır.
        // Hesapları tek tek beklemek yerine 75'lik atomik gruplar halinde yükle.
        // Her grupta önce BÜTÜN okumaları tamamla, sonra yazmaları uygula.
        // Böylece 75 kullanıcı tek commit ile gelir; mevcut hesaplar asla ezilmez.
        const IMPORT_CHUNK_SIZE = 75;
        for (let offset = 0; offset < missing.length; offset += IMPORT_CHUNK_SIZE) {
          const chunk = missing.slice(offset, offset + IMPORT_CHUNK_SIZE);
          await runTransaction(db, async tx => {
            const records = await Promise.all(chunk.map(async u => {
              const ref = getLiveDoc('sgmUsers', u.id);
              const tombstoneRef = getLiveDoc('sgmDeletedUsers', u.id);
              const [snap, tombstone] = await Promise.all([
                tx.get(ref), tx.get(tombstoneRef)
              ]);
              return { u, ref, tombstoneRef, snap, tombstone };
            }));
            for (const { u, ref, tombstoneRef, snap, tombstone } of records) {
              if (!snap.exists()) tx.set(ref, u);
              if (tombstone.exists()) tx.delete(tombstoneRef);
            }
          });
        }
        // Yalnızca yeni eklenenler değil, yedekte olup Firebase'de zaten
        // bulunan hesaplar da eski tombstone taşıyor olabilir. Bunları da
        // sunucuda temizle; aksi halde sonraki otomatik yazma hesabı gizler.
        for (let offset = 0; offset < imported.length; offset += IMPORT_CHUNK_SIZE) {
          const chunk = imported.slice(offset, offset + IMPORT_CHUNK_SIZE);
          await runTransaction(db, async tx => {
            const markers = await Promise.all(chunk.map(async u => {
              const ref = getLiveDoc('sgmDeletedUsers', u.id);
              return { ref, snap: await tx.get(ref) };
            }));
            markers.forEach(({ ref, snap }) => { if (snap.exists()) tx.delete(ref); });
          });
        }
        // İçe aktarılanların tamamının gerçekten sunucuda bulunduğunu doğrula.
        const verifiedDocs = (await getDocsFromServer(getLiveCollection('sgmUsers'))).docs;
        const verifiedIds = new Set(verifiedDocs.map(d => String(d.id)));
        const notSaved = imported.filter(u => !verifiedIds.has(u.id));
        if (notSaved.length) throw new Error(`${notSaved.length} hesap Firebase'de doğrulanamadı. Yedeği tekrar yükleyin.`);
        // KRİTİK: Yalnızca eksik yazılanları değil, yedekte yer alan ve
        // Firebase'de doğrulanan BÜTÜN hesapları eski silme işaretlerinden çıkar.
        // Aksi halde sunucuda 75 hesap varken yönetici ekranı eski 46 hesaba düşer.
        for (const u of imported) {
          const id = String(u.id);
          serverDeletedUserIdsRef.current.delete(id);
          pendingUserDeletesRef.current.delete(id);
          pendingUserCreatesRef.current.delete(id);
          deletedRecordIdsRef.current.users.delete(id);
          deletedUserIds.delete(id);
        }
        // Bekleyen eski silme kuyruğu sonradan geri yüklenen hesabı tekrar silmesin.
        localStorage.setItem('sgm_pending_user_deletes', JSON.stringify([...pendingUserDeletesRef.current]));
        localStorage.setItem('sgm_deleted_user_ids', JSON.stringify([...deletedRecordIdsRef.current.users]));
        const confirmed = normalizeRemoteUsers(verifiedDocs.map(d => ({ ...d.data(), id: d.id })), settingsRef.current);
        granularBaselineRef.current.users = rowsToMap(confirmed);
        granularSeenRemoteRef.current.users = true;
        usersRef.current = confirmed;
        setUsers(confirmed);
        setCachedUsersDifference(0);
        setAdminUsersServerReady(true);
        localStorage.setItem('sgm_users', JSON.stringify(confirmed));
        restoreCompleted = true;
        addLog('ADMIN_KULLANICI_YEDEK_YUKLE', `${missing.length} eksik kullanıcı yedekten Firebase'e geri yüklendi.`);
        showMessage('Yedek Yüklendi', `${missing.length} eksik hesap Firebase'de doğrulandı. Toplam ${confirmed.length} kayıt sunucuda mevcut.`, 'success');
      } else {
        const next = [...current, ...missing];
        missing.forEach(u => pendingUserCreatesRef.current.add(String(u.id)));
        usersRef.current = next; setUsers(next);
        localStorage.setItem('sgm_users', JSON.stringify(next));
        showMessage('Yerel Yedek Yüklendi', `${missing.length} hesap yerel listeye eklendi. Firebase bağlantısı olmadığı için sunucuya kaydedilemedi.`, 'warning');
      }
    } catch (error) {
      handleFirestoreQuotaError(error);
      showMessage('Yedek Yüklenemedi', error instanceof SyntaxError ? 'Geçerli bir JSON dosyası seçin.' : error.message, 'warning');
    } finally {
      // Başarılı aktarımda doğrulanmış listeyi ikinci kez filtreleme:
      // eski silinme işaretleri / gecikmiş sorgular sayıyı geri düşürebilir.
      // Başarısız veya kısmi aktarmada gerçek sunucu durumunu yeniden oku.
      if (db && !restoreCompleted) {
        try {
          const docs = (await getDocsFromServer(getLiveCollection('sgmUsers'))).docs;
          const rows = normalizeRemoteUsers(docs.map(d => ({ ...d.data(), id: d.id })), settingsRef.current)
            .filter(u => !isRecordDeleted('users', u.id));
          granularBaselineRef.current.users = rowsToMap(rows);
          usersRef.current = rows;
          setUsers(rows);
          localStorage.setItem('sgm_users', JSON.stringify(rows));
        } catch (error) { handleFirestoreQuotaError(error); }
      }
      userBackupRestoreInFlightRef.current = false;
      setUserImportBusy(false);
    }
  };

  const downloadQrFile = (content, filename, type) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const exportQrBackup = async (asHtml = false) => {
    if (qrBackupOperationRef.current || deskQrRepairInFlightRef.current) return;
    qrBackupOperationRef.current = true; setQrBackupBusy(true);
    try {
      if (db && (!adminAuthorized || !fbUser || !navigator.onLine)) throw new Error('QR yedeği için yönetici bağlantısı gerekli.');
      // Yedek sunucunun güncel kodlarından alınır, eski cihaz önbelleğinden değil.
      const rows = db ? (await getDocsFromServer(getLiveCollection('sgmDesks'))).docs.map(s => ({ ...s.data(), id: Number(s.id) })) : desksRef.current;
      const backup = { format: 'sgm-desk-qr-backup', version: 1, appId: appId || 'local',
        createdAt: new Date().toISOString(), desks: (rows || []).map(d => ({ id: Number(d.id), qrCode: d.qrCode })).sort((a,b) => a.id-b.id) };
      validateQrBackup(backup, appId);
      if (asHtml) {
        const cards = backup.desks.map(d => '<article><h2>Masa ' + d.id + '</h2>' + getDeskQrSvg(d) + '<p>' + escapeHtml(d.qrCode) + '</p></article>').join('');
        const html = '<!doctype html><html lang="tr"><head><meta charset="UTF-8"><title>SGM Sabit Masa QR Kodları</title><style>body{font-family:Arial;background:white;color:#111;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}article{text-align:center;border:1px solid #bbb;padding:20px;break-inside:avoid}svg{width:180px;height:180px}p{font-size:11px;overflow-wrap:anywhere}@media print{main{grid-template-columns:repeat(3,1fr)}} </style></head><body><h1>SGM Sabit Masa QR Kodları</h1><p>Bu dosyayı çevrimdışı açıp tarayıcınızdan yazdırabilirsiniz. Geri yükleme için JSON yedeğini kullanın.</p><main>' + cards + '</main></body></html>';
        downloadQrFile(html, 'SGM-Tum-QR-' + getLocalDayKey() + '.html', 'text/html;charset=utf-8');
      } else downloadQrFile(JSON.stringify(backup, null, 2), 'SGM-QR-Yedek-' + getLocalDayKey() + '.json', 'application/json;charset=utf-8');
    } catch (error) { handleFirestoreQuotaError(error); showMessage('QR İndirilemedi', error.message, 'warning'); }
    finally { qrBackupOperationRef.current = false; setQrBackupBusy(false); }
  };

  const importQrBackup = async event => {
    const file = _optionalChain([event, 'access', _487 => _487.target, 'access', _488 => _488.files, 'optionalAccess', _489 => _489[0]]); event.target.value = '';
    if (!file || qrBackupOperationRef.current) return;
    qrBackupOperationRef.current = true; setQrBackupBusy(true); setQrBackupPreview(null);
    try {
      if (file.size > 1024 * 1024) throw new Error('QR yedeği en fazla 1 MB olabilir.');
      const value = JSON.parse(await file.text());
      const rows = validateQrBackup(value, appId);
      const knownIds = new Set((desksRef.current || []).map(d => Number(d.id)));
      if (rows.some(d => !knownIds.has(d.id))) throw new Error('Yedekte bu sistemde bulunmayan masalar var. Önce masa listesini kontrol edin.');
      setQrBackupPreview({ filename: file.name, rows });
    } catch (error) { showMessage('Yedek Açılamadı', error instanceof SyntaxError ? 'Dosya geçerli bir JSON yedeği değil.' : error.message, 'warning'); }
    finally { qrBackupOperationRef.current = false; setQrBackupBusy(false); }
  };

  const restoreQrBackup = async () => {
    if (!qrBackupPreview || qrBackupOperationRef.current || deskQrRepairInFlightRef.current) return;
    qrBackupOperationRef.current = true; setQrBackupBusy(true);
    try {
      const rows = qrBackupPreview.rows;
      const qrById = new Map(rows.map(d => [Number(d.id), d.qrCode]));
      let restored;
      if (db) {
        if (!fbUser || !adminAuthorized || !navigator.onLine) throw new Error('Yedeği yüklemek için yönetici bağlantısı gerekli.');
        // Bütün okuma ve yazmalar tek transaction içinde; hata olursa kısmi geri yükleme olmaz.
        restored = await runTransaction(db, async tx => {
          const live = [];
          for (const row of rows) {
            const ref = getLiveDoc('sgmDesks', row.id);
            const snap = await tx.get(ref);
            if (!snap.exists()) throw new Error('Masa ' + row.id + ' artık bulunmuyor. Hiçbir kod yüklenmedi.');
            live.push({ ref, row, current: { ...snap.data(), id: row.id } });
          }
          for (const item of live) if (item.current.qrCode !== item.row.qrCode) tx.update(item.ref, { qrCode: item.row.qrCode });
          return live.map(item => ({ ...item.current, qrCode: item.row.qrCode }));
        });
        applyCloudRows({ desks: restored });
      } else {
        const knownIds = new Set((desksRef.current || []).map(d => Number(d.id)));
        if (rows.some(d => !knownIds.has(d.id))) throw new Error('Yedekte artık bulunmayan masalar var.');
        restored = (desksRef.current || []).map(d => qrById.has(Number(d.id)) ? { ...d, qrCode: qrById.get(Number(d.id)) } : d);
        desksRef.current = restored; setDesks(restored);
      }
      try { localStorage.setItem('sgm_desks', JSON.stringify(desksRef.current)); } catch (error) { console.warn('QR önbelleği kaydedilemedi:', error); }
      sgmQrSvgCache.clear(); setQrBackupPreview(null);
      addLog('ADMIN_QR_YEDEK_YUKLE', rows.length + ' masanın sabit QR yedeği geri yüklendi.');
      showMessage('QR Yedeği Yüklendi', rows.length + ' masanın QR kodu geri yüklendi.', 'success');
    } catch (error) { handleFirestoreQuotaError(error); showMessage('QR Yedeği Yüklenemedi', error.message, 'warning'); }
    finally { qrBackupOperationRef.current = false; setQrBackupBusy(false); }
  };

  const handleDownloadDeskQR = async (desk) => {
    if (!_optionalChain([desk, 'optionalAccess', _490 => _490.qrCode])) return showMessage("QR Bulunamadı", `Masa ${_optionalChain([desk, 'optionalAccess', _491 => _491.id]) || ''} için QR kod bulunamadı.`, "warning");
    try {
      const image = new Image();
      const loaded = new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('QR görseli oluşturulamadı.'));
      });
      image.src = getDeskQrImageUrl(desk, 1000);
      await loaded;
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1000;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Tarayıcı PNG oluşturmayı desteklemiyor.');
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, 1000, 1000);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(
        result => result ? resolve(result) : reject(new Error('PNG dosyası oluşturulamadı.')), 'image/png'
      ));
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `SGM-Masa-${desk.id}-QR.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (error) {
      console.error('QR indirme hatası:', error);
      showMessage('QR İndirilemedi', error.message || 'QR dosyası oluşturulamadı. Tekrar deneyin.', 'warning');
    }
  };

  const handlePrintQRs = () => {
    const safeDesks = Array.isArray(desksRef.current) ? desksRef.current : [];
    const selectedSet = new Set(selectedQrDeskIds.map(Number));
    const desksToPrint = (selectedSet.size
      ? safeDesks.filter(desk => selectedSet.has(Number(desk.id)))
      : safeDesks).filter(desk => desk.qrCode).sort((a, b) => Number(a.id) - Number(b.id));
    if (!desksToPrint.length) {
      return showMessage("Masa Seçilmedi", "Yazdırmak için QR kodu olan en az bir masa seçin.", "warning");
    }
    const cards = desksToPrint.map(desk => `
      <article class="qr-card">
        <header>Sarıçam Gençlik Merkezi</header>
        <h2>Masa ${escapeHtml(desk.id)}</h2>
        <img src="${getDeskQrImageUrl(desk, 300)}" alt="Masa ${escapeHtml(desk.id)} QR" />
        <p>${escapeHtml(desk.qrCode)}</p>
      </article>
    `).join('');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showMessage("Açılır Pencere Engellendi", "Tarayıcıda açılır pencerelere izin verip tekrar deneyin.", "warning");
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/>
        <title>SGM Toplu QR Çıktısı</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 12mm; background: white; font-family: Arial, sans-serif; }
          .qr-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5mm; }
          .qr-card { border: 1px solid #64748b; border-radius: 8px; text-align: center; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
          header { padding: 8px 4px; background: #f1f5f9; font-size: 10px; font-weight: bold; }
          h2 { margin: 10px 0 6px; font-size: 22px; }
          img { display: block; width: 100%; max-width: 35mm; height: auto; margin: 0 auto; }
          p { margin: 6px; font: 9px monospace; overflow-wrap: anywhere; }
          @page { size: A4; margin: 10mm; }
          @media print { body { padding: 0; } }
        </style>
      </head><body><div class="qr-grid">${cards}</div></body></html>
    `);
    printWindow.document.close();
    // Görseller gerçekten yüklenmeden yazdırma penceresi açılmaz.
    Promise.all(Array.from(printWindow.document.images).map(img =>
      img.complete && img.naturalWidth ? Promise.resolve() : new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      })
    )).then(() => {
      if (printWindow.closed) return;
      printWindow.focus();
      printWindow.print();
    }).catch(() => {
      showMessage('QR Yazdırılamadı', 'QR görselleri yüklenemedi. Tekrar deneyin.', 'warning');
    });
  };

  const saveRegistrationFormUrl = async e => {
    e.preventDefault();
    if (registrationLinkSaving) return;
    const url = normalizeRegistrationUrl(new FormData(e.currentTarget).get('formUrl'));
    if (!validRegistrationUrl(url)) return showMessage('Bağlantı Hatalı', 'https://forms.gle/... veya https://docs.google.com/forms/... bağlantısı girin.', 'warning');
    const previous = settingsRef.current;
    if (db && !fbUser) return showMessage('Lütfen Bekleyin', 'Bağlantının tüm cihazlara kaydedilmesi için sistem bağlantısını bekleyin.', 'warning');
    pushUndoSnapshot('Kayıt formu bağlantısını değiştirme');
    setRegistrationLinkSaving(true);
    const makeNext = base => ({ ...base, registrationFormUrl: url,
      registrationFormUpdatedAt: Math.max(Date.now(), Number(base.registrationFormUpdatedAt || 0) + 1),
      registrationFormHistory: base.registrationFormUrl && normalizeRegistrationUrl(base.registrationFormUrl) !== url
        ? [{ url: base.registrationFormUrl, changedAt: Date.now() }, ...(base.registrationFormHistory || [])]
        : (base.registrationFormHistory || []) });
    try {
      let next;
      if (db && fbUser) {
        const ref = getLiveSettingsDoc();
        // Sadece settings belgesini transaction ile güncelle; allData artık kullanılmıyor.
        next = await runTransaction(db, async tx => {
          const snap = await tx.get(ref);
          const base = mergeRegistrationSettings(previous, snap.exists() ? snap.data() : {});
          const updated = makeNext(base);
          tx.set(ref, updated, { merge: true });
          return updated;
        });
        granularBaselineRef.current.settings = stableJson(next);
      } else next = makeNext(previous);
      settingsRef.current = next;
      setSettings(prev => mergeRegistrationSettings(prev, next));
      setRegistrationFormUrl(url);
      try {
        localStorage.setItem('sgm_settings', JSON.stringify(next));
        sessionStorage.setItem('sgm_registration_form_url', url);
      } catch (e27) {}
      addLog('ADMIN_KAYIT_FORM_LINK', 'Kayıt formu bağlantısı kaydedildi; önceki bağlantı geçmişte korundu.', null, null, false, null, { previousUrl: previous.registrationFormUrl || '', newUrl: url });
      showMessage('Kaydedildi', db && fbUser ? 'Google Form bağlantısı kaydedildi ve diğer cihazlarda kullanılabilir.' : 'Google Form bağlantısı bu cihazda kaydedildi.', 'success');
    } catch (error) {
      showMessage('Bağlantı Kaydedilemedi', 'Google Form bağlantısı sunucuya kaydedilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.', 'warning');
      addLog('ADMIN_KAYIT_FORM_LINK_HATA', 'Kayıt formu bağlantısı kaydedilemedi.');
    } finally { setRegistrationLinkSaving(false); }
  };

  const resetFeedbackForm = () => {
    setFeedbackForm({ name: '', identityNo: '', type: '', message: '' });
    setFeedbackStep(1);
  };

  const handleFeedbackIdentitySubmit = (e) => {
    e.preventDefault();
    const cleanName = String(feedbackForm.name || '').trim();
    const cleanPhone = cleanIdentityFormat(feedbackForm.identityNo);

    if (!cleanName || cleanPhone.length !== 8) {
      return showMessage('Bilgileri Kontrol Edin', 'Lütfen ad soyad ve geçerli bir GM Özel Kod girin.', 'warning');
    }

    setFeedbackForm(prev => ({ ...prev, name: cleanName, identityNo: cleanPhone }));
    setFeedbackStep(2);
  };

  const selectFeedbackType = (type) => {
    setFeedbackForm(prev => ({ ...prev, type, message: '' }));
    setFeedbackStep(3);
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (feedbackInFlightRef.current) return;
    const feedbackUser = requireStudentAction('Dilek / Şikayet gönderme');
    if (!feedbackUser) return;
    if (!checkLibraryOpen()) return showMessage('Kütüphane Kapalı', 'Mesai saatleri dışında geri bildirim gönderilemez.', 'warning');
    const message = String(feedbackForm.message || '').trim();
    if (!feedbackForm.type || message.length < 3) {
      return showMessage('Mesajınızı Yazın', 'Lütfen öneri veya şikayetinizi yazın.', 'warning');
    }

    const newRecord = {
      id: `FDB-${Date.now()}-${generateId()}`,
      time: Date.now(),
      userId: feedbackUser.id,
      name: feedbackUser.name,
      identityNo: feedbackUser.identityNo,
      specialCode: feedbackUser.specialCode,
      type: feedbackForm.type,
      message,
      deviceInfo: navigator.userAgent || '-',
      locationInfo: userLocation || '-'
    };

    feedbackInFlightRef.current = true; setFeedbackSending(true);
    feedbackRecordsRef.current = [newRecord, ...(Array.isArray(feedbackRecordsRef.current) ? feedbackRecordsRef.current : [])];
    setFeedbackRecords(feedbackRecordsRef.current);
    await queueAppend('sgmFeedback', newRecord);
    const confirmed = !readAppendOutbox()[`sgmFeedback/${newRecord.id}`];
    feedbackInFlightRef.current = false; setFeedbackSending(false);
    addLog(
      feedbackForm.type === 'complaint' ? 'UYGULAMA_SIKAYETI' : 'UYGULAMA_ONERISI',
      `${feedbackUser.name} uygulama hakkında ${feedbackForm.type === 'complaint' ? 'şikayet' : 'öneri'} gönderdi.`, null, feedbackUser.id
    );

    resetFeedbackForm();
    showMessage(confirmed ? 'Kaydınız Alındı' : 'Gönderim Bekliyor', confirmed ? 'Geri bildiriminiz başarıyla yöneticiye iletildi. Teşekkür ederiz.' : 'Mesajınız bu cihazda saklandı. Bağlantı veya kota düzeldiğinde otomatik gönderilecek; yöneticiye henüz ulaşmadı.', confirmed ? 'success' : 'warning');
    setView('student_dash');
  };

  const saveCustomLayoutImmediately = async (newLayout) => {
    pushUndoSnapshot('Kroki düzenleme');
    const safeLayout = Array.isArray(newLayout)
      ? newLayout.map(el => ({ ...el }))
      : [];

    const nextSettings = {
      ...settings,
      useCustomLayout: true
    };

    // Önce aynı cihazda anında aktif et.
    layoutSaveGuardRef.current = {
      layout: safeLayout,
      until: Date.now() + 15000
    };

    const deskIdsInLayout = [...new Set(safeLayout.filter(el => el.type === 'desk').map(el => Number(el.deskId)).filter(Number.isFinite))];
    const currentDesks = Array.isArray(desks) ? desks : [];
    const existingIds = new Set(currentDesks.map(d => Number(d.id)));
    const extraDesks = deskIdsInLayout.filter(id => !existingIds.has(id)).map(id => ({
      id, status: 'available', occupant: null, guestOccupant: null, guestSessionStartTime: null,
      guestBreakEndTime: null, guestReported: false, guestReportEndTime: null, guestReportIssuedAt: null,
      guestReportVerifiedAt: null, pendingOccupant: null, pendingDeskRole: null, pendingDeskDeadline: null,
      breakEndTime: null, reportEndTime: null, reportIssuedAt: null, reportVerifiedAt: null,
      sessionStartTime: null, qrCode: getStaticDeskQrCode(id)
    }));
    const nextDesks = extraDesks.length ? [...currentDesks, ...extraDesks].sort((a,b)=>a.id-b.id) : currentDesks;

    setLayoutElements(safeLayout);
    if (extraDesks.length) setDesks(nextDesks);
    setSettings(nextSettings);

    try {
      localStorage.setItem('sgm_layout', JSON.stringify(safeLayout));
      localStorage.setItem('sgm_layout_schema_version', '3');
      localStorage.setItem('sgm_settings', JSON.stringify(nextSettings));
    } catch (e) {
      console.warn('Kroki localStorage kaydı yapılamadı:', e);
    }

    // Firebase aktifse beklemeden yalnızca settings + kroki + değişen masa belgelerini gönder.
    if (isDataLoaded && fbUser && db) {
      try {
        await persistGranularStateNow({
          settings: nextSettings,
          desks: nextDesks,
          layoutElements: safeLayout
        });
        layoutSaveGuardRef.current = null;
      } catch (error) {
        // Genel parçalı senkronizasyon tekrar deneyeceği için korumayı hemen kaldırmıyoruz.
        handleFirestoreQuotaError(error);
      }
    }

    addLog('ADMIN_KROKI_KAYDET', 'Kroki düzeni kaydedildi ve yayınlandı.');
    showMessage(
      "Başarılı",
      "Yeni kroki kaydedildi ve aktif kroki olarak kullanılmaya başlandı.",
      "success"
    );
  };

  const renderLiveKroki = ({
    area = 'all',
    isPublic = false,
    isAdmin = false,
    myDeskId = null,
    onDeskClick = null,
    showBlueRoom = true,
    showMainLibrary = true
  } = {}) => {
    const hasCustomLayout =
      settings.useCustomLayout === true &&
      Array.isArray(layoutElements) &&
      layoutElements.length > 0;

    if (hasCustomLayout) {
      return (
        React.createElement(DynamicKrokiMap, {
          desks: Array.isArray(desks) ? desks : [],
          layoutElements: layoutElements,
          myDeskId: myDeskId,
          isPublic: isPublic,
          isAdmin: isAdmin,
          area: "main",
          onDeskClick: onDeskClick, __self: this, __source: {fileName: _jsxFileName, lineNumber: 7897}}
        )
      );
    }

    return React.createElement(DynamicKrokiMap, { desks: Array.isArray(desks)?desks:[], layoutElements: generateDefaultLayout(), myDeskId: myDeskId, isPublic: isPublic, isAdmin: isAdmin, area: "main", onDeskClick: onDeskClick, __self: this, __source: {fileName: _jsxFileName, lineNumber: 7909}});
  };

  const renderView = () => {
    switch (view) {
      
      case 'permission_gate':
        return (
          React.createElement('div', { className: "min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7917}}
            , React.createElement('div', { className: "max-w-md w-full bg-slate-800 rounded-3xl p-8 text-center shadow-2xl border border-slate-700 space-y-6"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7918}}
              , React.createElement('div', { className: "w-20 h-20 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7919}}
                , React.createElement(Shield, { className: "w-10 h-10" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7920}} )
              )
              , React.createElement('div', { className: "space-y-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 7922}}
                , React.createElement('h1', { className: "text-2xl font-black text-white"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7923}}, "Sarıçam GM Kütüphane"  )
                , React.createElement('p', { className: "text-slate-400 text-sm" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7924}}, "Sistemi güvenli kullanabilmeniz için izinlerin onaylanması gerekmektedir."      )
              )
              , batteryGuidanceOpen && React.createElement('div', { className: "text-left p-4 bg-slate-900 rounded-xl text-sm text-slate-300 space-y-3"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7926}}, React.createElement('p', { className: "font-bold text-white" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7926}}, "Pil optimizasyonu: Kısıtlanmamış"  ), React.createElement('p', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 7926}}, "Android: Ayarlar → Uygulamalar → kullandığınız tarayıcı / uygulama → Pil → Kısıtlanmamış. Telefonunuzda seçenek adı değişebilir. Bu ayarı telefonunuzdan seçmeniz gerekir."                     ), React.createElement('button', { onClick: () => { addLog('PIL_AYARI_KULLANICI_BEYANI', 'Kullanıcı pil ayarını kontrol ettiğini belirtti; cihaz ayarı tarayıcıdan doğrulanamaz.'); setBatteryGuidanceOpen(false); }, className: "px-3 py-2 bg-blue-600 text-white rounded-lg"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7926}}, "Pil ayarını kontrol ettim"   ))
              , React.createElement('button', { onClick: requestScreenWakeLock, className: "w-full p-3 border border-slate-600 text-white rounded-xl"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7927}}, wakeLockStatus === 'active' ? 'Ekranı açık tutma etkin' : 'Ekranı Açık Tut')
              , ['unsupported', 'denied'].includes(wakeLockStatus) && React.createElement('p', { className: "text-xs text-slate-400" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7928}}, "Bu cihaz ekranı açık tutma isteğini desteklemiyor veya kabul etmedi."         )
              , React.createElement('button', { 
                onClick: permissionsState === 'granted' ? () => setView('role_select') : requestAllPermissions, 
                className: `w-full text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${permissionsState === 'granted' ? 'bg-green-600 hover:bg-green-500' : 'bg-blue-600 hover:bg-blue-500'}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 7929}}

                , permissionsState === 'idle' && React.createElement(React.Fragment, null, React.createElement(CheckCircle, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7933}}), " İzinleri Ver ve Başla"    )
                , permissionsState === 'requesting' && React.createElement(React.Fragment, null, React.createElement(RefreshCw, { className: "w-5 h-5 animate-spin"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7934}}), " İzinler İsteniyor..."  )
                , permissionsState === 'granted' && React.createElement(React.Fragment, null, React.createElement(LogIn, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7935}}), " Sisteme Giriş Yap"   )
              )
            )
          )
        );

      case 'role_select':
        return (
          React.createElement('div', { className: "min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7943}}
            , React.createElement('div', { className: "max-w-md w-full space-y-6"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7944}}
              , React.createElement('div', { className: "text-center space-y-2 mb-8"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7945}}
                , React.createElement('div', { 
                   className: "w-20 h-20 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-200 mb-4 cursor-pointer"            ,
                   onClick: () => setView('admin_login'),
                   title: "Geliştirici", __self: this, __source: {fileName: _jsxFileName, lineNumber: 7946}}

                  , React.createElement(BookOpen, { className: "w-10 h-10" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7951}} )
                )
                , React.createElement('h1', { className: "text-3xl font-black text-slate-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7953}}, "Sarıçam GM" )
                , React.createElement('p', { className: "text-slate-500 font-medium" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7954}}, "Kütüphane Yönetim Sistemi"  )
              )

              , React.createElement('div', { className: "space-y-4", __self: this, __source: {fileName: _jsxFileName, lineNumber: 7957}}
                , !checkLibraryOpen() && (
                  React.createElement('div', { className: "bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7959}}
                    , React.createElement('div', { className: "w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shrink-0"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7960}}
                      , React.createElement(Clock, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7961}} )
                    )
                    , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 7963}}
                      , React.createElement('h3', { className: "font-black text-red-700" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7964}}, "Kütüphane Kapalı" )
                      , React.createElement('p', { className: "text-sm text-red-600 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7965}}, "Öğrenci sistemi "
                          , settings.openTime || '07:00', "'de açılacaktır. Çalışma saatleri: "    , settings.openTime || '07:00', " - "  , settings.closeTime || '22:00', "."
                      )
                    )
                  )
                )

                , React.createElement('button', {
                  onClick: () => {
                    if (!checkLibraryOpen()) {
                      return showMessage(
                        "Kütüphane Kapalı",
                        `Öğrenci sistemi ${settings.openTime || '07:00'}'de açılacaktır. Çalışma saatleri: ${settings.openTime || '07:00'} - ${settings.closeTime || '22:00'}.`,
                        "warning"
                      );
                    }
                    setView('student_login');
                  },
                  className: `w-full p-6 rounded-2xl shadow-sm border flex items-center justify-between group transition-all ${
                    checkLibraryOpen()
                      ? 'bg-white hover:shadow-md border-slate-100'
                      : 'bg-slate-100 border-slate-200 cursor-not-allowed opacity-75'
                  }`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 7972}}
                  , React.createElement('div', { className: "flex items-center gap-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7988}}
                    , React.createElement('div', { className: "w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7989}}, React.createElement(Smartphone, { className: "w-6 h-6" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7989}}))
                    , React.createElement('div', { className: "text-left", __self: this, __source: {fileName: _jsxFileName, lineNumber: 7990}}
                      , React.createElement('h3', { className: "font-bold text-slate-800 text-lg"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7991}}, "Öğrenci Girişi" )
                      , React.createElement('p', { className: "text-slate-500 text-sm" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7992}}, "Masa almak ve mola için"    )
                    )
                  )
                  , React.createElement(ArrowRight, { className: "text-slate-300 group-hover:text-blue-500 transition-colors"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7995}} )
                )

                , React.createElement('button', { onClick: () => setView('leader_login'), className: "w-full bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md flex items-center justify-between"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7998}}
                  , React.createElement('span', { className: "flex items-center gap-3 text-slate-800 font-bold"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7999}}, React.createElement(Shield, { className: "text-indigo-600", __self: this, __source: {fileName: _jsxFileName, lineNumber: 7999}}), " Gençlik Lideri Girişi"   ), React.createElement(ArrowRight, { className: "text-slate-400", __self: this, __source: {fileName: _jsxFileName, lineNumber: 7999}})
                )

                , React.createElement('button', { onClick: () => setView('public'), className: "w-full bg-white p-6 rounded-2xl shadow-sm hover:shadow-md border border-slate-100 flex items-center justify-between group transition-all"            , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8002}}
                  , React.createElement('div', { className: "flex items-center gap-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8003}}
                    , React.createElement('div', { className: "w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8004}}, React.createElement(Eye, { className: "w-6 h-6" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8004}}))
                    , React.createElement('div', { className: "text-left", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8005}}
                      , React.createElement('h3', { className: "font-bold text-slate-800 text-lg"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8006}}, "Herkese Açık Ekran"  )
                      , React.createElement('p', { className: "text-slate-500 text-sm" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8007}}, "Anlık masa doluluk durumu"   )
                    )
                  )
                  , React.createElement(ArrowRight, { className: "text-slate-300 group-hover:text-green-500 transition-colors"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8010}} )
                )


              )
            )
          )
        );

      case 'feedback':
        if (!myUserObj || isRestricted(myUserObj) || myUserObj.blocked) return React.createElement('div', { className: "p-8 text-center" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8020}}, React.createElement('p', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8020}}, "Kısıtlı hesaplar dilek / şikayet gönderemez."     ), React.createElement('button', { onClick: () => setView('student_dash'), className: "mt-4 p-3 bg-blue-600 text-white rounded-xl"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8020}}, "Masa ekranına dön"  ));
        return (
          React.createElement('div', { className: "min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8022}}
            , React.createElement('div', { className: "max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8023}}
              , React.createElement('div', { className: "bg-purple-600 p-8 text-center relative overflow-hidden"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8024}}
                , React.createElement('button', { onClick: () => { resetFeedbackForm(); setView('student_dash'); }, className: "absolute top-4 left-4 text-white/80 hover:text-white"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8025}}, React.createElement(ArrowRight, { className: "w-6 h-6 rotate-180"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8025}} ))
                , React.createElement('div', { className: "w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8026}}
                  , React.createElement(FileText, { className: "w-10 h-10 text-white"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8027}} )
                )
                , React.createElement('h2', { className: "text-2xl font-bold text-white"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8029}}, "Dilek / Şikayet"  )
                , React.createElement('p', { className: "text-purple-100 text-sm mt-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8030}}, "Uygulama hakkındaki görüşlerinizi bize iletebilirsiniz."    )
              )

              , feedbackStep === 1 && (
                React.createElement('form', { onSubmit: handleFeedbackIdentitySubmit, className: "p-8 space-y-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8034}}
                  , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8035}}
                    , React.createElement('label', { className: "block text-sm font-semibold text-slate-700 mb-2"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8036}}, "Ad Soyad" )
                    , React.createElement('input', { type: "text", value: feedbackForm.name, onChange: e => setFeedbackForm(prev => ({ ...prev, name: e.target.value })), required: true, placeholder: "Adınız Soyadınız" , className: "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8037}} )
                  )
                  , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8039}}
                    , React.createElement('label', { className: "block text-sm font-semibold text-slate-700 mb-2"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8040}}, "GM Özel Kodunuz"  )
                    , React.createElement('input', { type: "text", inputMode: "numeric", minLength: 8, maxLength: 8, value: feedbackForm.identityNo, onChange: e => setFeedbackForm(prev => ({ ...prev, identityNo: e.target.value })), required: true, placeholder: "12345678", className: "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8041}} )
                  )
                  , React.createElement('button', { type: "submit", className: "w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center justify-center gap-2"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8043}}, "Devam Et "  , React.createElement(ArrowRight, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8043}}))
                )
              )

              , feedbackStep === 2 && (
                React.createElement('div', { className: "p-8 space-y-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8048}}
                  , React.createElement('div', { className: "text-center", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8049}}
                    , React.createElement('h3', { className: "text-xl font-black text-slate-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8050}}, "Ne bildirmek istiyorsunuz?"  )
                    , React.createElement('p', { className: "text-sm text-slate-500 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8051}}, "Şikayet veya öneri türünü seçin."    )
                  )
                  , React.createElement('button', { onClick: () => selectFeedbackType('complaint'), className: "w-full p-5 border-2 border-red-100 hover:border-red-400 bg-red-50 hover:bg-red-100 rounded-2xl text-left transition-all"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8053}}
                    , React.createElement('div', { className: "font-black text-red-700 text-lg flex items-center gap-2"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8054}}, React.createElement(AlertTriangle, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8054}}), " Şikayet" )
                    , React.createElement('p', { className: "text-sm text-red-600 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8055}}, "Uygulamada yaşadığınız bir sorun veya memnuniyetsizliği bildirin."      )
                  )
                  , React.createElement('button', { onClick: () => selectFeedbackType('suggestion'), className: "w-full p-5 border-2 border-green-100 hover:border-green-400 bg-green-50 hover:bg-green-100 rounded-2xl text-left transition-all"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8057}}
                    , React.createElement('div', { className: "font-black text-green-700 text-lg flex items-center gap-2"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8058}}, React.createElement(CheckCircle, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8058}}), " Öneri" )
                    , React.createElement('p', { className: "text-sm text-green-600 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8059}}, "Uygulamayı geliştirmek için fikrinizi veya önerinizi paylaşın."      )
                  )
                  , React.createElement('button', { onClick: () => setFeedbackStep(1), className: "w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8061}}, "Geri")
                )
              )

              , feedbackStep === 3 && (
                React.createElement('form', { onSubmit: handleFeedbackSubmit, className: "p-8 space-y-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8066}}
                  , React.createElement('div', { className: `p-4 rounded-xl border ${feedbackForm.type === 'complaint' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8067}}
                    , React.createElement('div', { className: "font-black", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8068}}, feedbackForm.type === 'complaint' ? 'Şikayet Bildirimi' : 'Öneri Bildirimi')
                    , React.createElement('div', { className: "text-xs mt-1" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8069}}, feedbackForm.name, " • "  , feedbackForm.identityNo)
                  )
                  , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8071}}
                    , React.createElement('label', { className: "block text-sm font-semibold text-slate-700 mb-2"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8072}}, feedbackForm.type === 'complaint' ? 'Şikayetiniz' : 'Öneriniz')
                    , React.createElement('textarea', { value: feedbackForm.message, onChange: e => setFeedbackForm(prev => ({ ...prev, message: e.target.value })), required: true, rows: 6, placeholder: feedbackForm.type === 'complaint' ? 'Yaşadığınız sorunu detaylı şekilde yazabilirsiniz...' : 'Önerinizi detaylı şekilde yazabilirsiniz...', className: "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8073}} )
                  )
                  , React.createElement('div', { className: "flex gap-3" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8075}}
                    , React.createElement('button', { type: "button", onClick: () => setFeedbackStep(2), className: "flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8076}}, "Geri")
                    , React.createElement('button', { type: "submit", disabled: feedbackSending, className: "flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8077}}, feedbackSending ? 'Gönderiliyor…' : 'Gönder')
                  )
                )
              )
            )
          )
        );

      case 'student_login':
        if (!checkLibraryOpen()) {
          return (
            React.createElement('div', { className: "min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8088}}
              , React.createElement('div', { className: "max-w-md w-full bg-white rounded-3xl shadow-xl border border-red-100 p-8 text-center"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8089}}
                , React.createElement('div', { className: "w-20 h-20 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-5"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8090}}
                  , React.createElement(Clock, { className: "w-10 h-10" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8091}} )
                )
                , React.createElement('h2', { className: "text-2xl font-black text-slate-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8093}}, "Kütüphane Kapalı" )
                , React.createElement('p', { className: "text-slate-600 mt-3" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8094}}, "Öğrenci sistemi "
                    , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8095}}, settings.openTime || '07:00'), "'de yeniden açılacaktır."
                )
                , React.createElement('p', { className: "text-sm text-slate-500 mt-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8097}}, "Çalışma saatleri: "
                    , settings.openTime || '07:00', " - "  , settings.closeTime || '22:00'
                )
                , React.createElement('button', {
                  onClick: () => setView('role_select'),
                  className: "w-full mt-6 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-colors"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8100}}
, "Geri Dön"

                )
              )
            )
          );
        }

        return (
          React.createElement('div', { className: "min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8112}}
            , React.createElement('div', { className: "max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8113}}
              , React.createElement('div', { className: "bg-blue-600 p-8 text-center relative overflow-hidden"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8114}}
                , React.createElement('button', { onClick: () => setView('role_select'), className: "absolute top-4 left-4 text-white/80 hover:text-white"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8115}}, React.createElement(ArrowRight, { className: "w-6 h-6 rotate-180"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8115}} ))
                , React.createElement('div', { className: "w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8116}}
                  , React.createElement(User, { className: "w-10 h-10 text-white"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8117}} )
                )
                , React.createElement('h2', { className: "text-2xl font-bold text-white"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8119}}, "Öğrenci Girişi" )
              )
              , React.createElement('form', { onSubmit: handleStudentLogin, className: "p-8 space-y-6" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8121}}
                , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8122}}
                  , React.createElement('label', { className: "block text-sm font-semibold text-slate-700 mb-2"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8123}}, "GM Özel Kodunuz"  )
                  , React.createElement('input', { 
                      type: "text", inputMode: "numeric", minLength: 8, maxLength: 8,
                      name: "identityNo",
                      value: loginIdentity,
                      onChange: e => setLoginIdentity(e.target.value.replace(/\D/g,'').slice(0,8)),
                      onFocus: () => { if (!loginIdentity && rememberedLoginCode) setLoginIdentity(rememberedLoginCode); },
                      required: true, 
                      placeholder: "12345678",
                      autoComplete: "username",
                      className: "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"           , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8124}} 
                  )
                )
                , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8136}}
                  , React.createElement('label', { className: "block text-sm font-semibold text-slate-700 mb-2"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8137}}, "Şifreniz")
                  , React.createElement('input', { 
                      type: "password",
                      name: "pin",
                      value: loginPin,
                      onChange: e => setLoginPin(e.target.value.replace(/\D/g,'').slice(0,8)),
                      required: true,
                      minLength: 8,
                      maxLength: 8,
                      inputMode: "numeric",
                      pattern: "[0-9]*",
                      placeholder: "********",
                      autoCapitalize: "none",
                      autoCorrect: "off",
                      autoComplete: "current-password",
                      spellCheck: false,
                      style: { WebkitTextSecurity: 'disc' },
                      className: "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium tracking-widest"            , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8138}}
                  )
                )
                , rememberedLoginCode && React.createElement('button', { type: "button", onClick: () => {
                  try { localStorage.removeItem('sgm_remembered_login_code_v1'); localStorage.removeItem('sgm_login_remember_choice_v1'); } catch (e28) {}
                  setRememberedLoginCode(''); setLoginIdentity('');
                }, className: "text-xs text-slate-500 underline"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8157}}, "Bu cihazda hatırlanan GM kodunu kaldır"     )
                , React.createElement('button', { type: "submit", className: "w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-200"            , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8161}}, "Giriş Yap "  , React.createElement(LogIn, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8161}} ))
                , React.createElement('button', { type: "button", onClick: ()=>{setRegistrationAccepted(false);setRegistrationRulesOpen(true);setShowRules(true);}, className: "w-full py-3 border border-blue-300 text-blue-700 rounded-xl font-bold"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8162}}, "Kayıt Ol" )
                , registrationPending && registrationFormOpened && React.createElement('p', { className: "text-sm text-blue-700" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8163}}, "Kayıt formuna "  , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8163}}, "GM Özel Kodunuzu"  ), " yazmayı unutmayın. Form gönderimi doğrulanınca giriş açılacaktır."       )
                , registrationError && React.createElement('p', { role: "alert", className: "text-sm text-red-700" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8164}}, registrationError)
                , registrationResult && React.createElement('div', { className: "p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8165}}
                  , React.createElement('div', { className: "font-black text-amber-900 text-lg"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8166}}, "Önemli: Bu bilgileri unutmayın ve kaybetmeyin!"     )
                  , React.createElement('p', { className: "text-sm text-amber-800" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8167}}, "Hesabınız oluşturuldu. GM Özel Kodunuz ve şifrenizi saklayın. "        , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8167}}, "Ana Google Form'u gönderdiğiniz doğrulanınca"    ), " giriş açılacaktır. Liderler bilgilerinizi sonradan kontrol edecektir."       )
                  , React.createElement('div', { className: "space-y-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8168}}
                    , React.createElement('div', { className: "flex items-center justify-between gap-3 bg-white p-3 rounded-xl border"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8169}}, React.createElement('span', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8169}}, React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8169}}, "GM Özel Kod:"  ), " " , React.createElement('span', { className: "font-mono font-black text-indigo-700 tracking-widest"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8169}}, registrationResult.specialCode)), React.createElement('button', { type: "button", onClick: ()=>copyRegistrationValue('GM Özel Kod',registrationResult.specialCode), className: "px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-bold"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8169}}, "Kopyala"))
                    , React.createElement('div', { className: "flex items-center justify-between gap-3 bg-white p-3 rounded-xl border"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8170}}, React.createElement('span', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8170}}, React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8170}}, "Şifre:"), " " , React.createElement('span', { className: "font-mono tracking-widest" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8170}}, registrationResult.pin)), React.createElement('button', { type: "button", onClick: ()=>copyRegistrationValue('Şifre',registrationResult.pin), className: "px-3 py-1 bg-blue-50 text-blue-700 rounded-lg font-bold"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8170}}, "Kopyala"))
                  )
                  , React.createElement('p', { className: "text-sm font-bold text-amber-900"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8172}}, "Kayıt formuna GM özel kodunu yazmayı unutmayın."      )
                  , React.createElement('button', { type: "button", disabled: !registrationVerified, onClick: fillRegistrationLogin, className: "w-full py-3 bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8173}}, registrationVerified?'Sisteme Giriş Yap':'Form Doğrulanması Bekleniyor')
                  , React.createElement('button', { type: "button", onClick: ()=>checkRegistrationFormStatus(false), className: "w-full py-3 border border-blue-300 text-blue-700 rounded-xl font-bold"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8174}}, "GM Özel Kodumu Kontrol Et"    )
                  , React.createElement('button', { type: "button", disabled: registrationRedirectBusy, onClick: openRegistrationGoogleForm, className: "w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8175}}, registrationRedirectBusy ? 'Google Form Açılıyor…' : 'Google Form’a Devam Et')
                  , registrationFormOpened && React.createElement('div', { className: "p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8176}}, React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8176}}, "Son adım:" ), " Google Formu tamamlayıp gönderin. Formdaki “GM Özel Kod” alanına "          , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8176}}, registrationResult.specialCode), " kodunu girin. Formu gönderdikten sonra GM Özel Kodumu Kontrol Et butonuna basın. Doğrulanınca giriş açılır; lider ön onayı beklenmez."                   )
                  , React.createElement('button', { type: "button", onClick: ()=>{sessionStorage.removeItem('sgm_registration_form_opened');sessionStorage.removeItem('sgm_registration_token');sessionStorage.removeItem('sgm_registration_credentials');sessionStorage.removeItem('sgm_registration_form_url');setRegistrationPending('');setRegistrationResult(null);setRegistrationFormUrl('');setRegistrationFormOpened(false);}, className: "block font-bold text-slate-600"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8177}}, "Bilgilerimi kaydettim, kapat"  )
                )

              )
            )
          )
        );

      case 'student_dash':
        return (
          React.createElement('div', { className: "min-h-screen bg-slate-100 flex flex-col"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8187}}
            , React.createElement('nav', { className: "bg-white border-b border-slate-200 sticky top-0 z-20 px-4 py-3 flex justify-between items-center shadow-sm"           , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8188}}
              , React.createElement('div', { className: "flex items-center gap-3"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8189}}
                , React.createElement('div', { className: "bg-blue-600 p-2 rounded-lg text-white"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8190}}, React.createElement(BookOpen, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8190}} ))
                , React.createElement('div', { className: "hidden sm:block" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8191}}
                  , React.createElement('h1', { className: "font-bold text-slate-800 leading-tight"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8192}}, "SGM Kütüphane" )
                  , React.createElement('p', { className: "text-xs text-slate-500" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8193}}, "Hoş geldin, "  , _optionalChain([myUserObj, 'optionalAccess', _492 => _492.name]) || 'Öğrenci')
                )
              )
              , React.createElement('div', { className: "flex items-center gap-2 sm:gap-4"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8196}}
                , React.createElement('button', {
                  type: "button",
                  onClick: retryMyPhonePushRegistration,
                  title: "Telefon bildirimini yeniden etkinleştir"   ,
                  'aria-label': "Telefon bildirimini yeniden etkinleştir"   ,
                  className: `p-2.5 rounded-xl border transition-colors flex items-center justify-center ${
                    Array.isArray(_optionalChain([myUserObj, 'optionalAccess', _493 => _493.pushTokens])) && myUserObj.pushTokens.some(Boolean)
                      ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                      : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                  }`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8197}}

                  , React.createElement(Smartphone, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8208}} )
                )

                , usersSyncError && React.createElement('p', { role: "alert", className: "text-sm text-amber-800" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8211}}, usersSyncError)
                , _optionalChain([myUserObj, 'optionalAccess', _494 => _494.strikes]) > 0 && (
                   React.createElement('div', { className: "flex items-center gap-1 text-red-600 text-xs font-bold bg-red-50 border border-red-100 px-3 py-1.5 rounded-full animate-pulse"            , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8213}}
                      , React.createElement(AlertTriangle, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8214}} ), " " , Number.isFinite(Number(myUserObj.strikes)) ? Number(myUserObj.strikes) : 0, "/", Number.isFinite(Number(settings.strikeLimit)) && Number(settings.strikeLimit) > 0 ? Number(settings.strikeLimit) : DEFAULT_SETTINGS.strikeLimit, " İhlal"
                   )
                )
                , React.createElement('button', { disabled: studentRestricted, onClick: openStudentFeedback, className: "text-purple-700 bg-purple-50 px-3 py-2 rounded-xl font-bold text-sm"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8217}}, "Dilek / Şikayet"  )
                , React.createElement('button', { onClick: () => setShowRules(true), className: "text-blue-600 hover:text-blue-800 bg-blue-50 p-2 rounded-full flex items-center gap-1 text-sm font-bold px-3"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8218}}, React.createElement(Info, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8218}} ), " " , React.createElement('span', { className: "hidden sm:inline" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8218}}, "Kurallar"))
                , React.createElement('button', { onClick: logoutStudent, className: "text-slate-500 hover:text-slate-800 bg-slate-100 p-2 rounded-full"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8219}}, React.createElement(LogOut, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8219}} ))
              )
            )

            , React.createElement('main', { className: "flex-1 max-w-5xl mx-auto w-full p-4 lg:p-6 space-y-6"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8223}}
              , currentApplePushInstallGuidance() && (
                React.createElement('div', { role: "note", className: "p-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl text-sm"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8225}}
                  , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8226}}, "iPhone bildirimlerini açmak için:"   ), " " , currentApplePushInstallGuidance()
                )
              )
              , studentRestricted && React.createElement('div', { className: "p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8229}}, React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8229}}, "Hesabınız kısıtlı." ), " Masa seçimi, boş masa ihbarı ve dilek / şikayet kapalıdır. "           , _optionalChain([myUserObj, 'optionalAccess', _495 => _495.formInfoRestrictionReason]) || _optionalChain([myUserObj, 'optionalAccess', _496 => _496.restrictionReason]), " Kütüphane sorumlusu gerekli kontrollerden sonra kısıtı kaldırabilir."       , React.createElement('button', { onClick: refreshStudentProfile, className: "block mt-2 px-3 py-2 bg-white border border-amber-300 rounded-lg font-bold"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8229}}, "Hesap Durumunu Yenile"  ))
              , !studentRestricted && studentDeskWait > 0 && React.createElement('div', { className: "p-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8230}}, React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8230}}, "Yalnızca Masa "  , _optionalChain([myUserObj, 'optionalAccess', _497 => _497.deskReclaimDeskId]), " için kalan bekleme: "    , formatTime(studentDeskWait)), React.createElement('p', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8230}}, "Diğer uygun masaları hemen seçebilirsiniz. Yönetici istisna uygulayabilir."       ))
              , registrationResult && _optionalChain([myUserObj, 'optionalAccess', _498 => _498.pendingApproval]) && React.createElement('div', { className: "p-4 bg-white border rounded-2xl space-y-2"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8231}}, React.createElement('p', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8231}}, React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8231}}, "GM özel kodunu yazmayı unutmayın:"    ), " " , myUserObj.specialCode), React.createElement('button', { disabled: registrationRedirectBusy, onClick: openRegistrationGoogleForm, className: "p-3 bg-green-600 text-white rounded-xl"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8231}}, "Kayıt formunu aç"  ))
              , React.createElement('div', { className: "bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8232}}
                , React.createElement('div', { className: `h-2 w-full ${!myDesk ? 'bg-slate-300' : myIsOnBreak ? 'bg-yellow-400' : myIsReported ? 'bg-red-500' : 'bg-green-500'}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8233}} )

                , React.createElement('div', { className: "p-6 md:p-8" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8235}}
                  , !myDesk ? (
                    React.createElement('div', { className: "text-center py-10" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8237}}
                      , React.createElement('div', { className: "w-24 h-24 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8238}}, React.createElement(MapPin, { className: "w-12 h-12" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8238}} ))
                      , React.createElement('h2', { className: "text-2xl font-bold text-slate-800 mb-2"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8239}}, "Masasızsınız")
                      , React.createElement('p', { className: "text-slate-500 mb-6 max-w-lg mx-auto"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8240}}, "Önce kullanmak istediğiniz masayı seçin. Seçimden sonra o masanın QR kodunu okutmak için "             , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8240}}, "5 dakikanız" ), " olacak." )

                      , !selectedDeskId ? (
                        React.createElement('div', { className: "max-w-xl mx-auto space-y-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8243}}
                          , React.createElement('div', { className: "text-left", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8244}}
                            , React.createElement('label', { className: "block text-sm font-bold text-slate-700 mb-2"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8245}}, "Masanızı Seçin" )
                            , React.createElement('select', {
                              id: "student_desk_select",
                              disabled: studentRestricted,
                              defaultValue: "",
                              onChange: (e) => {
                                if (!e.target.value) return;
                                selectDeskForClaim(e.target.value);
                              },
                              className: "w-full p-4 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8246}}

                              , React.createElement('option', { value: "", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8256}}, "Masa seçiniz..." )
                              , safeDesksList
                                .filter(d => !(d.pendingOccupant && Number(d.pendingDeskDeadline || 0) > now))
                                .filter(d => d.status === 'available' && !lostDeskToday(myUserObj, d.id) &&
                                  !(studentDeskWait > 0 && Number(_optionalChain([myUserObj, 'optionalAccess', _499 => _499.deskReclaimDeskId])) === Number(d.id)))
                                .sort((a,b) => a.id - b.id)
                                .map(d => (
                                  React.createElement('option', { key: d.id, value: d.id, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8263}}, "Masa "
                                     , d.id, " • Boş"
                                  )
                                ))
                            )
                          )
                          , React.createElement('div', { className: "w-full bg-blue-50 border border-blue-200 text-blue-800 px-5 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"             , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8269}}
                            , React.createElement(Clock, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8270}}), " Masa seçildiği anda 5 dakikalık QR süresi otomatik başlar."
                          )
                        )
                      ) : (
                        React.createElement('div', { className: "max-w-xl mx-auto bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 space-y-4"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8274}}
                          , React.createElement('div', { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8275}}
                            , React.createElement('div', { className: "text-left", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8276}}
                              , React.createElement('p', { className: "text-xs font-bold text-blue-600 uppercase tracking-wide"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8277}}, "Seçilen Masa" )
                              , React.createElement('p', { className: "text-3xl font-black text-slate-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8278}}, "Masa " , selectedDeskId)
                            )
                            , React.createElement('div', { className: "bg-white border border-blue-200 rounded-xl px-4 py-3"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8280}}
                              , React.createElement('p', { className: "text-xs font-bold text-slate-500"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8281}}, "QR İçin Kalan Süre"   )
                              , React.createElement('p', { className: "font-mono text-2xl font-black text-blue-700"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8282}}, formatTime(Math.max(0, deskSelectionDeadline - now)))
                            )
                          )
                          , React.createElement('p', { className: "text-sm text-slate-600 text-left"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8285}}, "Yalnızca " , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8285}}, "Masa " , selectedDeskId), " üzerindeki QR kod kabul edilir. Farklı masa QR kodu okutulursa işlem yapılmaz."            )
                          , React.createElement('div', { className: "flex flex-col sm:flex-row gap-3"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8286}}
                            , React.createElement('button', { disabled: studentRestricted || (studentDeskWait > 0 && Number(selectedDeskId) === Number(_optionalChain([myUserObj, 'optionalAccess', _500 => _500.deskReclaimDeskId]))), onClick: () => setScannerConfig({ isOpen: true, mode: 'claim', title: `Masa ${selectedDeskId} QR Doğrulaması` }), className: "flex-1 bg-blue-600 text-white px-5 py-4 rounded-xl hover:bg-blue-700 shadow-md flex items-center justify-center gap-2 font-bold"            , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8287}}
                              , React.createElement(QrCode, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8288}}), " Seçilen Masanın QR'ını Okut"
                            )
                            , React.createElement('button', { type: "button", disabled: deskCancellationBusy, onClick: () => cancelDeskSelection(), className: "px-5 py-4 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 rounded-xl font-bold"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8290}}, deskCancellationBusy ? 'İptal Ediliyor…' : 'Seçimi İptal Et')
                          )
                        )
                      )

                      , React.createElement('div', { className: "mt-5 max-w-xl mx-auto"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8295}}
                        , React.createElement('button', { disabled: studentRestricted, onClick: () => { if (requireStudentAction('Boş masa ihbarı')) setScannerConfig({ isOpen: true, mode: 'report', title: 'İhbar İçin QR Okut' }); }, className: "w-full bg-orange-500 text-white px-6 py-4 rounded-xl hover:bg-orange-600 shadow-md flex items-center justify-center gap-2 font-bold text-lg"             , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8296}}
                            , React.createElement(ShieldAlert, { className: "w-6 h-6" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8297}}), " Boş Masayı İhbar Et"
                        )
                      )
                    )
                  ) : (
                    React.createElement('div', { className: "flex flex-col md:flex-row gap-8 items-center md:items-stretch"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8302}}
                      , React.createElement('div', { className: "flex-1 text-center md:text-left flex flex-col justify-center w-full"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8303}}
                        , React.createElement('div', { className: "inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold mb-4 bg-slate-100 text-slate-600 w-fit md:mx-0 mx-auto"             , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8304}}
                            , React.createElement('span', { className: "w-2 h-2 rounded-full bg-green-500 animate-pulse"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8305}}), " Aktif Oturum"
                        )
                        , React.createElement('h2', { className: "text-5xl font-black text-slate-800 tracking-tighter mb-2"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8307}}, "Masa " , myDesk.id)

                        , myIsReported && (
                          React.createElement('div', { className: "mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-left animate-pulse"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8310}}
                            , React.createElement('div', { className: "flex gap-3 text-red-700 mb-3"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8311}}, React.createElement(ShieldAlert, { className: "w-6 h-6 shrink-0"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8311}} ), React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8311}}, React.createElement('p', { className: "font-bold", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8311}}, "Masanız boş olarak bildirildi!"   ), React.createElement('p', { className: "text-sm mt-1" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8311}}, "İhbar Kalan Süre: "   , formatTime(myReportEndTime - now))))
                            , React.createElement('button', { onClick: () => setScannerConfig({ isOpen: true, mode: 'verify', title: 'Masadayım Doğrulaması' }), className: "w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md flex justify-center items-center gap-2"           , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8312}}, React.createElement(QrCode, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8312}}), " Masadayım, Doğrula!"  )
                          )
                        )

                        , myIsOnBreak && (
                          React.createElement('div', { className: "mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-5 flex flex-col items-center"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8317}}
                            , React.createElement(Coffee, { className: "w-10 h-10 text-yellow-600 mb-2"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8318}} )
                            , React.createElement('p', { className: "text-yellow-800 font-bold mb-1 text-center"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8319}}, breakCountdown.kind === 'running' ? 'Mola Devam Ediyor' : breakCountdown.kind === 'expired' ? 'Mola Süresi Doldu' : 'Mola Süresi Doğrulanıyor')
                            , React.createElement('div', { className: "text-4xl font-mono font-black text-yellow-700 my-3 tracking-widest"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8320}}, breakCountdown.kind === 'invalid' || !serverClockVerified ? '—:—' : formatTime(breakCountdown.remaining))
                            , breakCountdown.kind === 'expired' && serverClockVerified && (
                              React.createElement('div', { role: "alert", className: "w-full bg-amber-100 border-2 border-amber-400 rounded-xl p-3 mb-3 text-center"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8322}}
                                , React.createElement('p', { className: "font-black text-amber-900" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8323}}, "Mola süreniz doldu, lütfen masanıza dönünüz!"     )
                                , React.createElement('p', { className: "text-sm text-amber-800 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8324}}, "Masanızın QR kodunu okutarak dönüşünüzü doğrulayınız."     )
                              )
                            )
                            , (breakCountdown.kind === 'invalid' || !serverClockVerified) && React.createElement('p', { className: "text-xs text-amber-800 mb-3 text-center"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8327}}, "Masa sahipliği ve mola süresi sunucuyla eşitleniyor. Masanıza dönmek için QR okutabilirsiniz."           )
                            , React.createElement('button', { onClick: () => setScannerConfig({ isOpen: true, mode: 'return_break', title: 'Moladan Dönüş - Masa QR Doğrulaması' }), className: "px-6 py-2 bg-yellow-200 hover:bg-yellow-300 text-yellow-800 font-bold rounded-full transition-colors flex items-center gap-2"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8328}}, React.createElement(QrCode, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8328}} ), " QR Okut ve Masaya Dön"     )
                          )
                        )
                      )

                      , !myIsReported && !myIsOnBreak && (
                        React.createElement('div', { className: "w-full md:w-80 flex-shrink-0 space-y-3 flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8"             , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8334}}
                          , React.createElement('button', { onClick: () => startBreak('short'), disabled: _optionalChain([myUserObj, 'optionalAccess', _501 => _501.breaks, 'optionalAccess', _502 => _502.short]) <= 0, className: "w-full flex items-center justify-between p-4 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed border border-amber-200 rounded-2xl group transition-all"             , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8335}}
                            , React.createElement('div', { className: "flex items-center gap-3 text-amber-800"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8336}}
                              , React.createElement('div', { className: "bg-amber-200 p-2 rounded-lg"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8337}}, React.createElement(Coffee, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8337}} ))
                              , React.createElement('div', { className: "text-left", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8338}}, React.createElement('p', { className: "font-bold", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8338}}, "Kısa Mola" ), React.createElement('p', { className: "text-xs opacity-80" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8338}}, settings.shortBreakDuration, " Dk" ))
                            )
                            , React.createElement('span', { className: "font-black text-amber-700 bg-amber-200/50 px-3 py-1 rounded-lg"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8340}}, _optionalChain([myUserObj, 'optionalAccess', _503 => _503.breaks, 'optionalAccess', _504 => _504.short]) || 0, " Kaldı" )
                          )

                          , React.createElement('button', { onClick: () => startBreak('long'), disabled: _optionalChain([myUserObj, 'optionalAccess', _505 => _505.breaks, 'optionalAccess', _506 => _506.long]) <= 0, className: "w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed border border-blue-200 rounded-2xl group transition-all"             , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8343}}
                            , React.createElement('div', { className: "flex items-center gap-3 text-blue-800"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8344}}
                              , React.createElement('div', { className: "bg-blue-200 p-2 rounded-lg"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8345}}, React.createElement(Clock, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8345}} ))
                              , React.createElement('div', { className: "text-left", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8346}}, React.createElement('p', { className: "font-bold", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8346}}, "Uzun Mola" ), React.createElement('p', { className: "text-xs opacity-80" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8346}}, settings.longBreakDuration, " Dk" ))
                            )
                            , React.createElement('span', { className: "font-black text-blue-700 bg-blue-200/50 px-3 py-1 rounded-lg"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8348}}, _optionalChain([myUserObj, 'optionalAccess', _507 => _507.breaks, 'optionalAccess', _508 => _508.long]) || 0, " Kaldı" )
                          )

                          , React.createElement('button', { onClick: () => startBreak('hourly'), disabled: !isHourlyBreakAvailable(settings, now + serverTimeOffsetMs) || Number(_optionalChain([myUserObj, 'optionalAccess', _509 => _509.breaks, 'optionalAccess', _510 => _510.hourly]) || 0) <= 0, className: "w-full flex items-center justify-between p-4 bg-violet-50 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed border border-violet-200 rounded-2xl"           , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8351}}
                            , React.createElement('div', { className: "flex items-center gap-3 text-violet-800"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8352}}
                              , React.createElement('div', { className: "bg-violet-200 p-2 rounded-lg"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8353}}, React.createElement(Clock, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8353}} ))
                              , React.createElement('div', { className: "text-left", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8354}}, React.createElement('p', { className: "font-bold", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8354}}, "1 Saatlik Mola"  ), React.createElement('p', { className: "text-xs opacity-80" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8354}}, _nullishCoalesce(settings.hourlyBreakDuration, () => ( 60)), " Dk · "   , isHourlyBreakAvailable(settings, now + serverTimeOffsetMs) ? 'Aktif' : 'Yalnızca cuma günü'))
                            )
                            , React.createElement('span', { className: "font-black text-violet-700 bg-violet-200/50 px-3 py-1 rounded-lg"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8356}}, _optionalChain([myUserObj, 'optionalAccess', _511 => _511.breaks, 'optionalAccess', _512 => _512.hourly]) || 0, " Kaldı" )
                          )
                          , React.createElement('div', { className: "h-4", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8358}})
                          , React.createElement('button', { onClick: releaseDesk, className: "w-full flex items-center justify-center gap-2 p-4 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-2xl shadow-lg transition-all"            , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8359}}, React.createElement(StopCircle, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8359}} ), " Masayı Bırak / Çıkış Yap"     )
                        )
                      )
                    )
                  )
                )
              )

              , React.createElement('div', { className: "bg-white rounded-3xl shadow-sm border border-slate-200 p-3 sm:p-6 overflow-hidden"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8367}}
                  , React.createElement('div', { className: "flex flex-col lg:flex-row justify-between items-start lg:items-center mb-5 gap-4"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8368}}
                    , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8369}}
                      , React.createElement('h3', { className: "font-bold text-slate-800 text-lg"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8370}}, "Masa Durumları (Kroki)"  )
                      , React.createElement('p', { className: "text-sm text-slate-500 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8371}}, "Şikayet / ihbar için önce alanı seçin, ardından krokide dolu olan masaya dokunun."

                      )
                    )

                    , React.createElement('div', { className: "w-full lg:w-auto grid grid-cols-1 sm:grid-cols-2 gap-2"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8376}}
                      , settings.showMainLibraryKroki !== false && (
                        React.createElement('button', {
                          type: "button",
                          onClick: () => setStudentKrokiArea('main'),
                          className: `w-full lg:min-w-[170px] px-4 py-3 rounded-xl font-black flex items-center justify-center gap-2 transition-all ${
                            studentKrokiArea === 'main'
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                          }`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8378}}

                          , React.createElement(BookOpen, { className: "w-5 h-5 shrink-0"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8387}} )
                          , React.createElement('span', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8388}}, "Ana Salon" )
                        )
                      )


                    )
                  )

                  , settings.showMainLibraryKroki === false && settings.showBlueRoomKroki === false ? (
                    React.createElement('div', { className: "w-full py-12 px-4 text-center bg-slate-50 border border-slate-200 rounded-2xl"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8397}}
                      , React.createElement(MapPin, { className: "w-10 h-10 mx-auto text-slate-300 mb-3"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8398}} )
                      , React.createElement('p', { className: "font-bold text-slate-700" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8399}}, "Şu anda görüntülenebilir kroki bulunmuyor."    )
                      , React.createElement('p', { className: "text-sm text-slate-500 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8400}}, "Kroki yönetici tarafından tekrar yayına açıldığında burada otomatik görünecektir."        )
                    )
                  ) : (
                    React.createElement('div', { className: "w-full overflow-hidden" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8403}}
                      , renderLiveKroki({
                        myDeskId: _optionalChain([myDesk, 'optionalAccess', _513 => _513.id]),
                        area:
                          studentKrokiArea === 'main' && settings.showMainLibraryKroki !== false
                            ? 'main'
                            : studentKrokiArea === 'blue' && settings.showBlueRoomKroki !== false
                              ? 'blue'
                              : settings.showMainLibraryKroki !== false
                                ? 'main'
                                : 'blue',
                        showBlueRoom: settings.showBlueRoomKroki !== false,
                        showMainLibrary: settings.showMainLibraryKroki !== false,
                        onDeskClick: (desk) => {
                          if (desk.status === 'occupied') {
                            promptReportDesk(desk.id);
                          }
                        }
                      })
                    )
                  )
              )
            )
          )
        );

      case 'public':
        return (
          React.createElement('div', { className: "min-h-screen bg-slate-50 p-4 md:p-8 flex flex-col items-center"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8431}}
            , React.createElement('div', { className: "w-full max-w-5xl flex flex-col sm:flex-row justify-between items-center mb-6 border-b border-slate-300 pb-4 gap-4 text-center sm:text-left"             , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8432}}
              , React.createElement('div', { className: "flex items-center gap-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8433}}
                , React.createElement('button', { onClick: () => setView('role_select'), className: "text-slate-500 hover:text-slate-800 bg-white p-2 rounded-lg shadow-sm"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8434}}, React.createElement(ArrowRight, { className: "w-6 h-6 rotate-180"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8434}} ))
                , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8435}}
                  , React.createElement('h1', { className: "text-2xl font-black text-slate-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8436}}, "SGM Kütüphanesi" )
                  , React.createElement('p', { className: "text-slate-500 text-sm" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8437}}, "Canlı Masa Durumu Ekranı"   )
                )
              )
            )

            , React.createElement('div', { className: "w-full max-w-5xl mb-6"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8442}}
              , React.createElement('div', { className: "grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-200"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8443}}
                , settings.showMainLibraryKroki !== false && (
                  React.createElement('button', {
                    type: "button",
                    onClick: () => setPublicKrokiArea('main'),
                    className: `px-5 py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all ${
                      publicKrokiArea === 'main'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8445}}

                    , React.createElement(BookOpen, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8454}} ), " Ana Salon"
                  )
                )

              )
            )

            , React.createElement('div', { className: "w-full max-w-5xl bg-white rounded-3xl shadow-sm border border-slate-200 p-3 sm:p-6 overflow-hidden"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8461}}
              , settings.showMainLibraryKroki === false && settings.showBlueRoomKroki === false ? (
                React.createElement('div', { className: "py-16 text-center" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8463}}
                  , React.createElement(Eye, { className: "w-12 h-12 mx-auto mb-3 text-slate-300"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8464}} )
                  , React.createElement('h2', { className: "text-xl font-black text-slate-700"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8465}}, "Kroki şu anda yayında değil"    )
                  , React.createElement('p', { className: "text-sm text-slate-500 mt-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8466}}, "Yönetici panelinden bir alan yeniden açıldığında bu ekran anlık olarak güncellenir."          )
                )
              ) : publicKrokiArea === 'blue' && settings.showBlueRoomKroki !== false ? (
                renderLiveKroki({
                  isPublic: true,
                  area: 'blue',
                  showBlueRoom: settings.showBlueRoomKroki !== false,
                  showMainLibrary: settings.showMainLibraryKroki !== false
                })
              ) : settings.showMainLibraryKroki !== false ? (
                renderLiveKroki({
                  isPublic: true,
                  area: 'main',
                  showBlueRoom: settings.showBlueRoomKroki !== false,
                  showMainLibrary: settings.showMainLibraryKroki !== false
                })
              ) : (
                renderLiveKroki({
                  isPublic: true,
                  area: 'blue',
                  showBlueRoom: settings.showBlueRoomKroki !== false,
                  showMainLibrary: settings.showMainLibraryKroki !== false
                })
              )
            )
          )
        );

      case 'leader_login':
        return React.createElement(LeaderLogin, { onBack: ()=>setView('role_select'),
          onLogin: async payload=>{
            if(!auth) throw new Error('Firebase bağlantısı yok.');
            const credential=await signInTabWithCustomToken(payload.token);
            const claims=await credential.user.getIdTokenResult(true);
            if(claims.claims.role!=='leader' || claims.claims.leaderId!==payload.leader.username) throw new Error('Lider rolü doğrulanamadı.');
            setFbUser(credential.user);setLeaderProfile(payload.leader);setView('leader_dash');
          }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8495}})
      case 'leader_dash':
        return React.createElement(LeaderDashboard, { auth: auth, leader: leaderProfile, onExit: async()=>{
          setLeaderProfile(null);setView('role_select');
          if(auth){await signOut(auth);await signInTabAnonymously();}
        }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8504}})

      case 'admin_login':
        return (
          React.createElement('div', { className: "min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8511}}
            , React.createElement('div', { className: "max-w-md w-full bg-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-700"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8512}}
              , React.createElement('div', { className: "p-8 text-center relative border-b border-slate-700"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8513}}
                , React.createElement('button', { onClick: () => setView('role_select'), className: "absolute top-4 left-4 text-slate-400 hover:text-white"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8514}}, React.createElement(ArrowRight, { className: "w-6 h-6 rotate-180"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8514}} ))
                , React.createElement('div', { className: "w-16 h-16 bg-slate-700 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8515}}, React.createElement(Shield, { className: "w-8 h-8" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8515}} ))
                , React.createElement('h2', { className: "text-2xl font-bold text-white"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8516}}, "Yönetici Paneli" )
              )
              , React.createElement('form', { onSubmit: async (e) => {
                e.preventDefault();
                const user = e.target.username.value;
                const pass = e.target.password.value;
                try {
                  const response = await fetch('/api/admin-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: user, password: pass })
                  });
                  const payload = await response.json().catch(() => null);
                  if (!response.ok || _optionalChain([payload, 'optionalAccess', _514 => _514.ok]) !== true || !_optionalChain([payload, 'optionalAccess', _515 => _515.token])) {
                    const title = response.status === 401 ? 'Hatalı Giriş' : 'Yönetici Servisi Hatası';
                    showMessage(title, _optionalChain([payload, 'optionalAccess', _516 => _516.message]) || `Yönetici servisi HTTP ${response.status} döndürdü. Vercel dağıtımını ve ortam değişkenlerini kontrol edin.`, 'danger');
                    return;
                  }
                  if (!auth) throw new Error('Firebase ayarları bulunamadı.');
                  const credential = await signInTabWithCustomToken(payload.token);
                  const claims = await credential.user.getIdTokenResult(true);
                  if (_optionalChain([auth, 'access', _517 => _517.currentUser, 'optionalAccess', _518 => _518.uid]) !== credential.user.uid || claims.claims.admin !== true) throw new Error('Yönetici yetkisi doğrulanamadı.');
                  verifiedAdminUidRef.current = credential.user.uid;
                  setFbUser(credential.user);
                  setAdminAuthorized(true);
                  addLog('ADMIN_GIRIS', 'Yönetici paneline giriş yapıldı.');
                  setView('admin_dash');
                } catch (error) {
                  console.error('Yönetici doğrulama hatası:', error);
                  showMessage('Bağlantı Hatası', error.message || 'Yönetici doğrulama servisine ulaşılamadı.', 'danger');
                }
              }, className: "p-8 space-y-6" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8518}}
                , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8548}}
                  , React.createElement('label', { className: "block text-sm font-semibold text-slate-300 mb-2"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8549}}, "Kullanıcı Adı" )
                  , React.createElement('input', { type: "text", name: "username", required: true, className: "w-full px-4 py-3 bg-slate-900 border border-slate-700 text-white rounded-xl focus:border-blue-500 outline-none"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8550}} )
                )
                , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8552}}
                  , React.createElement('label', { className: "block text-sm font-semibold text-slate-300 mb-2"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8553}}, "Şifre")
                  , React.createElement('input', { type: "password", name: "password", required: true, className: "w-full px-4 py-3 bg-slate-900 border border-slate-700 text-white rounded-xl focus:border-blue-500 outline-none"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8554}} )
                )
                , React.createElement('button', { type: "submit", className: "w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"           , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8556}}, "Giriş Yap" )
              )
            )
          )
        );

      case 'admin_dash':
        return (
          React.createElement('div', { className: "min-h-screen bg-slate-100 flex flex-col lg:flex-row"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8564}}
            , React.createElement('aside', { className: `bg-slate-900 text-white sticky top-0 z-40 shrink-0 border-r border-slate-800 transition-all duration-300 w-full h-auto lg:h-screen ${adminMenuOpen ? 'lg:w-72' : 'lg:w-48'}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8565}}
              , React.createElement('button', {
                type: "button",
                onClick: () => setAdminMenuOpen(prev => !prev),
                className: "w-full px-4 sm:px-5 py-4 lg:py-5 flex items-center gap-3 hover:bg-slate-800 transition-colors border-b border-slate-800 text-left"            ,
                title: adminMenuOpen ? 'Yönetici menüsünü kapat' : 'Yönetici menüsünü aç', __self: this, __source: {fileName: _jsxFileName, lineNumber: 8566}}

                , React.createElement(Shield, { className: "w-7 h-7 text-blue-400 shrink-0"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8572}} )
                , React.createElement('div', { className: "flex min-w-0 flex-1 items-center justify-between gap-2"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8573}}
                  , React.createElement('span', { className: "font-black text-xl leading-tight"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8574}}, "SGM", React.createElement('span', { className: "lg:hidden", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8574}}, " " ), React.createElement('br', { className: "hidden lg:block" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8574}}), "Admin")
                  , React.createElement(ArrowRight, { className: `w-5 h-5 text-slate-400 transition-transform duration-300 ${adminMenuOpen ? 'rotate-90' : ''}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8575}} )
                )
              )

              , adminMenuOpen && (
                React.createElement('div', { className: "max-h-[72vh] lg:h-[calc(100vh-89px)] lg:max-h-none flex flex-col overflow-hidden shadow-2xl lg:shadow-none"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8580}}
                  , React.createElement('div', { className: "flex-1 overflow-y-auto custom-scrollbar px-3 py-3 lg:py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2 lg:gap-1 content-start"            , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8581}}
                    , [
                      { id: 'desks', icon: React.createElement(MapPin, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8583}}), label: 'Kroki' },
                      { id: 'layout_editor', icon: React.createElement(Edit3, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8584}}), label: 'Kroki Editörü' },
                      { id: 'users', icon: React.createElement(Users, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8585}}), label: 'Kullanıcılar' },
                      { id: 'settings', icon: React.createElement(Settings, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8586}}), label: 'Ayarlar' },
                      { id: 'registration', icon: React.createElement(Users, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8587}}), label: 'Kayıt / Google Form' },
                      { id: 'leaders', icon: React.createElement(Shield, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8588}}), label: 'Lider Yönetimi' },
                      { id: 'logs', icon: React.createElement(List, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8589}}), label: 'Kayıtlar' },
                      { id: 'violations', icon: React.createElement(ShieldAlert, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8590}}), label: 'İhlal Kayıtları' },
                      { id: 'feedback', icon: React.createElement(FileText, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8591}}), label: 'Dilek / Şikayet' },
                      { id: 'qr_print', icon: React.createElement(QrCode, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8592}}), label: 'Toplu QR' },
                      { id: 'qr_backup', icon: React.createElement(Save, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8593}}), label: 'QR Yedekleri' },
                      { id: 'push_status', icon: React.createElement(Smartphone, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8594}}), label: 'Push Durumu' },
                    ].map(tab => (
                      React.createElement('button', {
                        key: tab.id,
                        type: "button",
                        onClick: () => setAdminTab(tab.id),
                        className: `w-full min-h-12 px-3 sm:px-4 py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 sm:gap-3 transition-colors ${adminTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8596}}

                        , React.createElement('span', { className: "shrink-0", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8602}}, tab.icon)
                        , React.createElement('span', { className: "truncate text-left" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8603}}, tab.label)
                      )
                    ))
                  )

                  , React.createElement('div', { className: "p-3 border-t border-slate-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8608}}
                    , React.createElement('button', {
                      type: "button",
                      onClick: async () => { addLog('ADMIN_CIKIS', 'Yönetici panelinden çıkış yapıldı.'); await appendChainRef.current; setAdminAuthorized(false); setView('role_select'); if (auth) { await signOut(auth); await signInTabAnonymously(); } },
                      className: "w-full px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 text-slate-300 hover:bg-red-500/10 hover:text-red-300 transition-colors"            , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8609}}

                      , React.createElement(LogOut, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8614}} )
                      , React.createElement('span', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8615}}, "Çıkış Yap" )
                    )
                  )
                )
              )
            )

            , React.createElement('div', { className: "flex-1 min-w-0 w-full flex flex-col"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8622}}
            , React.createElement('main', { className: "flex-1 max-w-7xl mx-auto w-full p-3 sm:p-4 lg:p-6"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8623}}
              , React.createElement('div', { className: "mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm"             , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8624}}
                , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8625}}
                  , React.createElement('p', { className: "text-xs font-bold uppercase tracking-wide text-slate-400"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8626}}, "Her Sekme İçin Geri Al"    )
                  , React.createElement('p', { className: "text-sm font-semibold text-slate-700 mt-0.5"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8627}}
                    , getCurrentTabUndoSnapshot() ? `Geri alınabilir son işlem: ${getCurrentTabUndoSnapshot().label}` : 'Bu sekmede geri alınabilir işlem bulunmuyor.'
                  )
                )
                , React.createElement('button', {
                  type: "button",
                  onClick: undoLastAdminOperation,
                  disabled: !getCurrentTabUndoSnapshot(),
                  className: "px-5 py-3 bg-amber-100 hover:bg-amber-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-amber-800 rounded-xl font-bold flex items-center justify-center gap-2 shrink-0"              ,
                  title: getCurrentTabUndoSnapshot() ? `${getCurrentTabUndoSnapshot().label} işlemini geri al` : 'Bu sekmede geri alınacak işlem yok', __self: this, __source: {fileName: _jsxFileName, lineNumber: 8631}}

                  , React.createElement(RefreshCw, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8638}}), " Geri Al"
                )
              )

              , adminTab === 'desks' && (
                React.createElement('div', { className: "bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8643}}
                  , (!app && !db) && (
                      React.createElement('div', { className: "mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl flex items-start gap-3 shadow-sm"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8645}}
                          , React.createElement(AlertTriangle, { className: "w-6 h-6 shrink-0 text-yellow-600"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8646}} )
                          , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8647}}
                              , React.createElement('h4', { className: "font-bold", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8648}}, "Yerel (Çevrimdışı) Mod Aktif"   )
                              , React.createElement('p', { className: "text-sm mt-1" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8649}}, "Sistem şu anda bir veritabanına bağlı değil. Yaptığınız kayıtlar sadece bu cihazın (PC/Telefon) hafızasında saklanır. "               , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8649}}, "PC'de kaydettiğiniz bir öğrenciyi telefonda görememenizin sebebi budur."       ), " Tüm cihazların aynı veriyi görmesi için Firebase ayarlarının aktif olması gerekir."           )
                          )
                      )
                  )
                  , React.createElement('div', { className: "flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8653}}
                    , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8654}}
                      , React.createElement('h2', { className: "text-xl font-bold text-slate-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8655}}, "Masa Yönetimi" )
                      , React.createElement('p', { className: "text-sm text-slate-500" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8656}}, "Müdahale için kroki üzerinden bir masaya tıklayın."      )
                    )
                    , React.createElement('div', { className: "flex gap-2 w-full sm:w-auto"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8658}}
                        , React.createElement('button', { onClick: () => {
                            const safeDesks = Array.isArray(desks) ? desks : [];
                            const maxId = safeDesks.reduce((max, d) => Math.max(max, d.id), 0);
                            const newId = maxId + 1;
                            const newDesk = {
                                id: newId,
                                status: 'available',
                                occupant: null,
                                breakEndTime: null,
                                reportEndTime: null,
                                sessionStartTime: null,
                                qrCode: getStaticDeskQrCode(newId),
                            };
                            setDesks(prev => [...(Array.isArray(prev) ? prev : []), newDesk]);
                            addLog('SİSTEM_AYAR', `Sisteme yeni masa (Masa ${newId}) eklendi.`);
                            showMessage("Masa Eklendi", `Masa ${newId} başarıyla eklendi.`, "success");
                        }, className: "flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md font-bold flex items-center justify-center gap-2 transition-colors"              , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8659}}
                            , React.createElement(Plus, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8676}}), " Masa Ekle"
                        )
                        , React.createElement('button', { onClick: () => setScannerConfig({ isOpen: true, mode: 'admin_query', title: 'Masa QR Sorgula' }), className: "flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl shadow-md font-bold flex items-center justify-center gap-2 transition-colors"              , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8678}}
                          , React.createElement(QrCode, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8679}}), " QR Okut"
                        )
                        , React.createElement('button', {
                          type: "button",
                          onClick: async () => {
                            const ok = window.confirm(
                              'GÜN SONU TEMİZLİĞİ yapılsın mı?\n\n' +
                              '• Tüm aktif/rezerve masalar boşaltılır.\n' +
                              '• Tüm kullanıcıların aktif masa ve bekleyen rezervasyonları kapatılır.\n' +
                              '• Günlük ihlal sayaçları sıfırlanır.\n' +
                              '• Kalıcı İhlal Kayıtları SİLİNMEZ.\n' +
                              '• Temizlikten önce gün sonu yedeği alınır.\n\n' +
                              'Bu işlem gün içinde yalnızca gerektiğinde kullanılmalıdır.'
                            );
                            if (!ok) return;

                            if (db) {
                              try {
                                await requireAdminForUserWrite();
                                const token = await auth.currentUser.getIdToken();
                                const response = await fetch('/api/admin-desk', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({ action: 'close_day' })
                                });
                                const payload = await response.json().catch(() => null);
                                if (!response.ok || _optionalChain([payload, 'optionalAccess', _519 => _519.ok]) !== true) throw new Error(_optionalChain([payload, 'optionalAccess', _520 => _520.message]) || 'Sunucuda gün sonu temizliği yapılamadı.');
                              } catch (error) {
                                handleFirestoreQuotaError(error);
                                showMessage('Gün Sonu Temizliği Yapılamadı', `Sunucudaki masa ve öğrenci kayıtları güvenle temizlenemedi: ${error.message}`, 'warning');
                                return;
                              }
                            }

                            const result = runFullDayCleanup({
                              source: 'manual',
                              cleanupTime: Date.now(),
                              dayKey: getLocalDayKey(),
                              dayLabel: new Date().toDateString(),
                              writeAutoCloseMarker: false
                            });

                            showMessage(
                              'Gün Sonu Temizliği Tamamlandı',
                              `${result.activeDeskCount} aktif/rezerve masa boşaltıldı. ${result.violationUserCount} kullanıcının günlük ihlali arşivlenip sıfırlandı. Temizlik öncesi yedek alındı; kalıcı İhlal Kayıtları korunuyor.`,
                              'success'
                            );
                          },
                          className: "flex-1 sm:flex-none px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md font-bold flex items-center justify-center gap-2 transition-colors"              ,
                          title: "Otomatik kapanışta sorun olursa tüm gün sonu temizliğini elle uygular"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8681}}

                          , React.createElement(StopCircle, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8730}}), " Günü Kapat / Sıfırla"
                        )
                    )
                  )
                  , React.createElement('div', { className: "mb-5 grid grid-cols-1 lg:grid-cols-2 gap-4"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8734}}
                    , React.createElement('div', { className: "bg-slate-50 border border-slate-200 rounded-2xl p-3"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8735}}
                      , React.createElement('p', { className: "text-xs font-black uppercase tracking-wider text-slate-500 mb-2"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8736}}, "Gösterilecek Kroki" )
                      , React.createElement('div', { className: "grid grid-cols-2 gap-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8737}}
                        , React.createElement('button', {
                          type: "button",
                          onClick: () => setAdminKrokiArea('main'),
                          className: `px-4 py-3 rounded-xl font-black transition-all ${adminKrokiArea === 'main' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8738}}
, "Ana Salon"

                        )

                      )
                    )

                    , React.createElement('div', { className: "bg-slate-50 border border-slate-200 rounded-2xl p-3"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8749}}
                      , React.createElement('p', { className: "text-xs font-black uppercase tracking-wider text-slate-500 mb-2"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8750}}, "Halka Açık Ekranda Yayın"   )
                      , React.createElement('div', { className: "grid grid-cols-1 sm:grid-cols-2 gap-2"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8751}}
                        , React.createElement('button', {
                          type: "button",
                          onClick: () => {
                            pushUndoSnapshot('Ana Salon kroki yayın durumu');
                            const nextValue = settings.showMainLibraryKroki === false;
                            setSettings(prev => ({ ...prev, showMainLibraryKroki: nextValue }));
                            addLog('SİSTEM_AYAR', `Ana Salon krokisi ${nextValue ? 'yayına açıldı' : 'yayından kaldırıldı'}.`);
                            showMessage('Kroki Güncellendi', `Ana Salon krokisi ${nextValue ? 'yayına açıldı' : 'halka açık ekrandan kaldırıldı'}.`, 'success');
                          },
                          className: `px-4 py-3 rounded-xl font-bold border transition-all ${
                            settings.showMainLibraryKroki !== false
                              ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                              : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                          }`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8752}}
, "Ana Salon: "
                            , settings.showMainLibraryKroki !== false ? 'Yayında' : 'Kapalı'
                        )

                      )
                      , React.createElement('p', { className: "mt-2 text-[11px] text-slate-500"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8771}}, "Buradaki değişiklik Firebase üzerinden açık olan diğer cihazlara anlık yansır."         )
                    )
                  )

                  , React.createElement('div', { className: "w-full overflow-hidden" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8775}}
                    , renderLiveKroki({
                      isAdmin: true,
                      area: adminKrokiArea,
                      showBlueRoom: true,
                      showMainLibrary: true,
                      onDeskClick: (desk) => {
                        setLiveDeskId(desk.id);
                        setModal({ isOpen: true, type: 'info', title: `Masa ${desk.id} Yönetimi`, content: null });
                      }
                    })
                  )
                )
              )

              , adminTab === 'layout_editor' && (
                React.createElement('div', { className: "bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8791}}
                    , React.createElement('div', { className: "p-6 border-b border-slate-200"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8792}}
                        , React.createElement('h2', { className: "text-xl font-bold text-slate-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8793}}, "Sürükle-Bırak Kroki Editörü"  )
                    )
                    , React.createElement(LayoutEditor, { 
                        initialElements: layoutElements, 
                        onSave: (newLayout) => {
                            saveCustomLayoutImmediately(newLayout);
                        }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8795}} 
                    )
                )
              )

              , adminTab === 'users' && (
                React.createElement('div', { className: "space-y-6", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8805}}
                  , usersSyncError && React.createElement('div', { role: "alert", className: "bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8806}}, usersSyncError)
                  , (!app && !db) && React.createElement('div', { className: "bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8807}}, React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8807}}, "Veritabanı Bağlantısı Yok:"  ), " Sistem şu an yerel modda çalışıyor."      )
                  , React.createElement('div', { className: "bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8808}}
                    , React.createElement('div', { className: "flex flex-col lg:flex-row lg:items-center justify-between gap-4"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8809}}
                      , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8810}}, React.createElement('h2', { className: "text-xl font-black text-slate-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8810}}, "Otomatik Kullanıcı Üretimi"  ), React.createElement('p', { className: "text-sm text-slate-500 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8810}}, "GM Özel Kod ve 8 haneli şifre sistem tarafından otomatik ve benzersiz üretilir."            ))
                      , React.createElement('div', { className: "flex flex-wrap gap-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8811}}
                        , React.createElement('button', { disabled: adminCreatingUser, onClick: createAutomaticUser, className: "px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-2"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8812}}, React.createElement(Plus, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8812}}), " Yeni Kişi Oluştur"   )
                        , React.createElement('button', { type: "button", onClick: () => setManualUserOpen(v => !v), className: "px-5 py-3 bg-indigo-100 text-indigo-800 rounded-xl font-bold"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8813}}, "Manuel Kullanıcı Ekle"  )
                        , React.createElement('button', { onClick: undoLastAdminOperation, disabled: !getCurrentTabUndoSnapshot(), className: "px-5 py-3 bg-amber-100 hover:bg-amber-200 disabled:bg-slate-100 disabled:text-slate-400 text-amber-800 rounded-xl font-bold flex items-center gap-2"           , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8814}}, React.createElement(RefreshCw, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8814}}), " Geri Al"  )
                      )
                    )
                  )

                  , manualUserOpen && React.createElement('form', { onSubmit: createManualUser, className: "bg-white p-6 rounded-2xl shadow-sm border border-indigo-200 space-y-3"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8819}}
                    , React.createElement('h3', { className: "font-bold text-lg" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8820}}, "Manuel Kullanıcı Ekle"  )
                    , React.createElement('p', { className: "text-sm text-slate-600" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8821}}, "GM Özel Kod ve şifre 8 rakamlı, önceden kullanılmamış ve birbirinden farklı olmalıdır."            )
                    , React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-3 gap-3"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8822}}
                      , React.createElement('label', { className: "text-sm font-bold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8823}}, "Ad Soyad" , React.createElement('input', { name: "name", required: true, maxLength: 120, className: "block w-full border rounded-lg p-3 mt-1"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8823}} ))
                      , React.createElement('label', { className: "text-sm font-bold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8824}}, "GM Özel Kod"  , React.createElement('input', { name: "specialCode", required: true, pattern: "[0-9]{8}", inputMode: "numeric", maxLength: 8, className: "block w-full border rounded-lg p-3 mt-1"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8824}} ))
                      , React.createElement('label', { className: "text-sm font-bold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8825}}, "8 Haneli Şifre"  , React.createElement('input', { name: "pin", required: true, pattern: "[0-9]{8}", inputMode: "numeric", maxLength: 8, className: "block w-full border rounded-lg p-3 mt-1"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8825}} ))
                    )
                    , React.createElement('button', { type: "submit", disabled: adminCreatingUser, className: "bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold disabled:opacity-50"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8827}}, "Kullanıcıyı Kaydet" )
                  )
                  , React.createElement('div', { className: "bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8829}}
                    , React.createElement('div', { className: "flex flex-col xl:flex-row justify-between xl:items-center mb-5 gap-4"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8830}}
                      , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8831}}, React.createElement('h2', { className: "text-xl font-bold text-slate-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8831}}, "Kayıtlı Kullanıcılar" ), React.createElement('p', { className: "text-xs text-slate-500 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8831}}, "Toplam: " , adminUsersServerReady ? (Array.isArray(users) ? users.length : 0) : 'Sunucudan yükleniyor…', " · Seçili: "   , selectedUserIds.length))
                      , adminUsersServerReady && cachedUsersDifference > 0 && React.createElement('p', { className: "text-xs text-amber-700 mt-2"  , role: "status", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8832}}, "Tarayıcı hafızasında sunucudaki listede bulunmayan "     , cachedUsersDifference, " kullanıcı kaydı tespit edildi. Kayıtlar otomatik geri yüklenmedi; eski yedek ve Firestore kayıtlarını kontrol edin."               )
                      , React.createElement('div', { className: "flex flex-wrap gap-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8833}}


                        , React.createElement('button', { type: "button", disabled: !db || !adminAuthorized || !adminUsersServerReady || repairDeskLinksBusy, onClick: repairDanglingDeskLinks,
                          className: "px-3 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-lg text-sm font-bold disabled:opacity-50"        ,
                          title: "Canlı sunucudaki tüm öğrenci ve masa kayıtlarını karşılaştırır; yalnızca eski masa bağlantılarını temizler"            , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8836}}
                          , repairDeskLinksBusy ? 'Kontrol ediliyor…' : `Masa-Hesap Uyuşmazlığını Onar${invalidDeskAccountCount ? ` (${invalidDeskAccountCount} görünen)` : ''}`
                        )
                        , React.createElement('label', { className: "text-sm", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8841}}, "Kısıt günü "  , React.createElement('input', { type: "number", min: "1", step: "1", value: bulkRestrictionDays, onChange: e=>setBulkRestrictionDays(e.target.value), className: "w-16 border rounded p-2"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8841}} )), React.createElement('button', { onClick: ()=>bulkUserAction('block'), className: "px-3 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-bold"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8841}}, "Kısıt Ver" )
                        , React.createElement('button', { onClick: ()=>bulkUserAction('unblock'), className: "px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8842}}, "Kısıtı Kaldır" )
                        , React.createElement('button', { disabled: !selectedUserIds.length, onClick: ()=>bulkUserAction('delete'), className: "px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-bold inline-flex items-center gap-2"           , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8843}}, React.createElement(Trash2, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8843}}), " Seçilenleri Sil ("   , selectedUserIds.length, ")")
                        , React.createElement('input', { type: "file", id: "import-users-input", accept: ".json", style: {display:'none'}, onChange: handleImportUsers, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8844}}), React.createElement('button', { disabled: userImportBusy, onClick: ()=>document.getElementById('import-users-input').click(), className: "px-3 py-2 bg-slate-100 rounded-lg text-sm font-bold disabled:opacity-50"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8844}}, userImportBusy ? 'Yedek Yükleniyor…' : 'Yedek Yükle'), React.createElement('button', { onClick: handleExportUsers, className: "px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-bold"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8844}}, "Yedek İndir" )
                      )
                    )
                    , React.createElement('div', { className: "mb-4 space-y-2" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8847}}, React.createElement('label', { htmlFor: "user-search", className: "block font-bold text-slate-700"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8847}}, "Kullanıcı Ara" ), React.createElement('input', { id: "user-search", type: "search", value: userSearch, onChange: e => setUserSearch(e.target.value), placeholder: "GM Özel Kod, şifre veya ad soyad yazın"       , className: "w-full p-3 border rounded-xl"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8847}}), React.createElement('p', { className: "text-xs text-slate-500" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8847}}, "Bulunan: " , filteredUsers.length, " " , userSearch && React.createElement('button', { onClick: () => setUserSearch(''), className: "ml-3 text-blue-700 font-bold"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8847}}, "Aramayı temizle" )))
                    , React.createElement('table', { className: "w-full text-left border-collapse text-sm min-w-[1100px]"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8848}}
                      , React.createElement('thead', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8849}}, React.createElement('tr', { className: "bg-slate-50 text-slate-500 border-b"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8849}}, React.createElement('th', { className: "p-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8849}}, React.createElement('input', { type: "checkbox", checked: filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.includes(u.id)), onChange: e=>setSelectedUserIds(prev=>e.target.checked ? [...new Set([...prev, ...filteredUsers.map(u=>u.id)])] : prev.filter(id=>!filteredUsers.some(u=>u.id===id))), __self: this, __source: {fileName: _jsxFileName, lineNumber: 8849}})), React.createElement('th', { className: "p-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8849}}, "8 Haneli Şifre"  ), React.createElement('th', { className: "p-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8849}}, "GM Özel Kod"  ), React.createElement('th', { className: "p-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8849}}, "Hesap Durumu" ), React.createElement('th', { className: "p-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8849}}, "Aktif Masa" ), React.createElement('th', { className: "p-3 text-center" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8849}}, "İhlal"), React.createElement('th', { className: "p-3 text-center" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8849}}, "İşlemler")))
                      , React.createElement('tbody', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8850}}, filteredUsers.map(u=>React.createElement('tr', { key: u.id, className: "border-b border-slate-100 hover:bg-slate-50"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8850}}, React.createElement('td', { className: "p-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8850}}, React.createElement('input', { type: "checkbox", checked: selectedUserIds.includes(u.id), onChange: e=>setSelectedUserIds(prev=>e.target.checked?[...new Set([...prev,u.id])]:prev.filter(id=>id!==u.id)), __self: this, __source: {fileName: _jsxFileName, lineNumber: 8850}})), React.createElement('td', { className: "p-3 font-mono font-bold tracking-widest"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8850}}, u.pin), React.createElement('td', { className: "p-3 font-mono font-black text-indigo-700 tracking-widest"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8850}}, React.createElement('button', { onClick: () => openAdminUserEditor(u.id), className: "hover:underline", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8850}}, u.specialCode || '-')), React.createElement('td', { className: "p-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8850}}, u.blocked ? "Kısıtlı (Engelli)" : u.pendingApproval ? "Onay Bekliyor" : isRestricted(u, now) ? "Kısıtlı" : "Aktif", React.createElement('div', { className: "text-xs text-slate-500 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8850}}, "İhbar: " , isRestricted(u, now) ? "Hesap kısıtlı" : settings.reportsEnabled === false ? "Sistem genelinde kapalı" : u.canReport === false ? "Yetki kapalı" : "Açık")), React.createElement('td', { className: "p-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8850}}, u.activeDeskId ? React.createElement(React.Fragment, null, `Masa ${u.activeDeskId}`, !linkedDeskIsReal(u) && React.createElement('span', { className: "ml-2 text-xs font-semibold text-amber-700"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8850}}, "(Kayıt uyuşmuyor)" )) : 'Yok'), React.createElement('td', { className: "p-3 text-center text-red-600 font-bold"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8850}}, u.strikes), React.createElement('td', { className: "p-3 text-center" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8850}}, React.createElement('div', { className: "flex flex-wrap justify-center gap-2"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8850}}, React.createElement('button', { onClick: ()=>openAdminUserEditor(u.id), className: "px-3 py-1 bg-blue-50 text-blue-700 rounded font-bold"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8850}}, "Düzenle"), isRestricted(u, now) && React.createElement('button', { disabled: adminUserSavingId !== null, onClick: ()=>handleAdminAction('approve_account',null,u.id), className: "px-3 py-1 bg-green-50 text-green-700 rounded font-bold disabled:opacity-50"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8850}}, "Hesabı Onayla / Kısıtı Kaldır"    ), React.createElement('button', { onClick: ()=>handleAdminAction('toggle_block',null,u.id), className: "px-3 py-1 bg-slate-100 rounded font-bold"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8850}}, isRestricted(u)?'Kısıtlı':'Kısıt Ver'), React.createElement('button', { onClick: ()=>handleAdminAction('delete_user',null,u.id), className: "px-3 py-1 bg-red-50 text-red-600 rounded font-bold"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8850}}, "Sil"))))))
                    )
                  )
                )
              )

              , adminTab === 'leaders' && React.createElement(AdminLeaderManager, { call: runAdminMaintenance, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8856}}) 

              , adminTab === 'registration' && React.createElement('div', { className: "max-w-3xl mx-auto bg-white p-6 rounded-2xl space-y-4"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8858}}
                , React.createElement('h2', { className: "text-xl font-bold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8859}}, "Kayıt / Google Form Bağlantısı"    )
                , React.createElement('p', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8860}}, "Kayıt için yönlendirilecek Google Form bağlantısını kaydedin. Formu kontrol edip kullanıcıyı GM Özel Koduyla bulun ve kısıtını kaldırın."                 )
                , React.createElement('form', { key: settings.registrationFormUrl, className: "space-y-3", onSubmit: saveRegistrationFormUrl, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8861}}
                  , React.createElement('label', { className: "block", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8862}}, "Google Form bağlantısı"  , React.createElement('input', { name: "formUrl", type: "url", required: true, defaultValue: settings.registrationFormUrl || '', placeholder: "https://forms.gle/...", className: "w-full p-3 border rounded-xl"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8862}}))
                  , React.createElement('button', { disabled: registrationLinkSaving, className: "px-5 py-3 bg-blue-600 disabled:opacity-50 text-white rounded-xl"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8863}}, registrationLinkSaving ? 'Kaydediliyor…' : 'Bağlantıyı Kaydet')
                )
                , settings.registrationFormUrl && React.createElement('a', { href: settings.registrationFormUrl, target: "_blank", rel: "noopener noreferrer" , className: "block text-blue-700 break-all"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8865}}, settings.registrationFormUrl)
                , React.createElement('p', { className: "text-sm font-bold text-amber-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8866}}, "Kayıt formuna GM özel kodunu yazmayı unutmayın."      )
                , React.createElement('div', { className: "border-t pt-4 space-y-3"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8867}}, React.createElement('h3', { className: "font-bold", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8867}}, "Eski Bağlantılar" )
                  , !(settings.registrationFormHistory || []).length && React.createElement('p', { className: "text-sm text-slate-500" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8868}}, "Henüz değiştirilmiş bağlantı yok."   )
                  , (settings.registrationFormHistory || []).map((item, index) => React.createElement('div', { key: `${item.changedAt}-${index}`, className: "p-3 bg-slate-50 border rounded-xl"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8869}}, React.createElement('a', { href: item.url, target: "_blank", rel: "noopener noreferrer" , className: "text-blue-700 break-all" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8869}}, item.url), React.createElement('p', { className: "text-xs text-slate-500 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8869}}, "Değiştirildi: " , new Date(item.changedAt).toLocaleString('tr-TR'))))
                )
              )

              , adminTab === 'settings' && (
                React.createElement('div', { className: "max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8874}}
                  , React.createElement('h2', { className: "text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8875}}, React.createElement(Settings, { className: "text-blue-600", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8875}}), " Sistem Ayarları"  )
                  , React.createElement('form', { key: stableJson(settings), onSubmit: async (e) => {
                     e.preventDefault();
                     if (systemSettingsSavingRef.current) return;
                     const formData = new FormData(e.currentTarget);
                     if (db) {
                       try {
                         await ensureTabAuthPersistence(); await auth.authStateReady();
                         const liveUser = auth.currentUser;
                         if (!liveUser) throw new Error('Yönetici oturumu bulunamadı.');
                         const token = await liveUser.getIdTokenResult(true);
                         if (_optionalChain([auth, 'access', _521 => _521.currentUser, 'optionalAccess', _522 => _522.uid]) !== liveUser.uid || token.claims.admin !== true) throw new Error('Yönetici yetkisi doğrulanamadı.');
                         verifiedAdminUidRef.current = liveUser.uid;
                         setFbUser(liveUser); setAdminAuthorized(true);
                       } catch (error) {
                         return showMessage('Ayarlar Kaydedilemedi', error.message, 'warning');
                       }
                     }
                     pushUndoSnapshot('Sistem ayarlarını kaydetme');
                     const previousOpenTime = String(settings.openTime || DEFAULT_SETTINGS.openTime);
                     const previousCloseTime = String(settings.closeTime || DEFAULT_SETTINGS.closeTime);
                     const nextOpenTime = String(formData.get('openTime') || DEFAULT_SETTINGS.openTime);
                     const nextCloseTime = String(formData.get('closeTime') || DEFAULT_SETTINGS.closeTime);

                     const settingsPatch = {
                        openTime: nextOpenTime,
                        closeTime: nextCloseTime,
                        shortBreakCount: parseInt(formData.get('shortBreakCount')),
                        longBreakCount: parseInt(formData.get('longBreakCount')),
                        shortBreakDuration: parseInt(formData.get('shortBreakDuration')),
                        longBreakDuration: parseInt(formData.get('longBreakDuration')),
                        hourlyBreakEnabled: formData.get('hourlyBreakEnabled') === 'on',
                        hourlyBreakCount: Number(formData.get('hourlyBreakCount')),
                        hourlyBreakDuration: Number(formData.get('hourlyBreakDuration')),
                        breakCooldown: Math.max(30, Number.isFinite(parseInt(formData.get('breakCooldown'))) ? parseInt(formData.get('breakCooldown')) : 30),
                        reportWaitTime: Number.isFinite(parseInt(formData.get('reportWaitTime'))) && parseInt(formData.get('reportWaitTime')) > 0 ? parseInt(formData.get('reportWaitTime')) : 5,
                        strikeLimit: Number.isFinite(parseInt(formData.get('strikeLimit'))) && parseInt(formData.get('strikeLimit')) > 0 ? parseInt(formData.get('strikeLimit')) : DEFAULT_SETTINGS.strikeLimit,
                        reportsEnabled: true,
                        useCustomLayout: formData.get('useCustomLayout') === 'on'
                     };

                     // Bozuk süre/limit kaydı molalarda sürekli sunucu uyarısı oluşturur.
                     const countFields = ['shortBreakCount', 'longBreakCount', 'hourlyBreakCount'];
                     const durationFields = ['shortBreakDuration', 'longBreakDuration', 'hourlyBreakDuration'];
                     if (countFields.some(key => !Number.isSafeInteger(settingsPatch[key]) || settingsPatch[key] < 0 || settingsPatch[key] > 50) ||
                         durationFields.some(key => !Number.isSafeInteger(settingsPatch[key]) || settingsPatch[key] < 1 || settingsPatch[key] > 240)) {
                       return showMessage('Geçersiz Mola Ayarı', 'Mola hakları 0–50, süreler 1–240 dakika arasında tam sayı olmalıdır.', 'warning');
                     }
                     systemSettingsSavingRef.current = true;
                     setSystemSettingsSaving(true);
                     try {
                       // Ayarlar sunucuda atomik kaydedilir; masalara, QR'lara ve push verilerine dokunulmaz.
                       const previous = settingsRef.current;
                       const result = db
                         ? await runAdminMaintenance('update_settings', { patch: settingsPatch })
                         : { settings: { ...previous, ...settingsPatch }, updatedBalances: [] };
                       const next = result.settings;
                       settingsRef.current = next;
                       granularBaselineRef.current.settings = stableJson(next);
                       setSettings(next);
                       if (Array.isArray(result.updatedBalances) && result.updatedBalances.length) {
                         const balances = new Map(result.updatedBalances.map(item => [String(item.id), item.breaks]));
                         usersRef.current = usersRef.current.map(u => balances.has(String(u.id)) ? { ...u, breaks: balances.get(String(u.id)) } : u);
                         setUsers(usersRef.current);
                       }
                       if (!db && ['shortBreakCount','longBreakCount','hourlyBreakCount','hourlyBreakEnabled'].some(k => previous[k] !== next[k])) {
                         usersRef.current = usersRef.current.map(u => ({ ...u, breaks: updatedBreakAllowance(u, previous, next) }));
                         setUsers(usersRef.current);
                       }

                     // Çalışma saatlerindeki değişiklikleri sistem kayıtlarına ayrıca yaz.
                     if (previousCloseTime !== nextCloseTime) {
                       addLog(
                         'KAPANIS_SAATI_GUNCELLENDI',
                         `Kütüphane kapanış saati ${previousCloseTime} → ${nextCloseTime} olarak güncellendi. 1 saat, 30 dakika ve 15 dakika kapanış bildirimleri yeni saate göre otomatik hesaplanacaktır.`,
                         null,
                         null,
                         false,
                         null,
                         { oldCloseTime: previousCloseTime, newCloseTime: nextCloseTime }
                       );
                     }

                     if (previousOpenTime !== nextOpenTime) {
                       addLog(
                         'ACILIS_SAATI_GUNCELLENDI',
                         `Kütüphane açılış saati ${previousOpenTime} → ${nextOpenTime} olarak güncellendi.`,
                         null,
                         null,
                         false,
                         null,
                         { oldOpenTime: previousOpenTime, newOpenTime: nextOpenTime }
                       );
                     }

                     showMessage("Başarılı", "Sistem ayarları sunucuya kaydedildi. Öğrenci ekranları güncel saatleri anlık alacaktır.", "success");
                     } catch (error) {
                       handleFirestoreQuotaError(error);
                       showMessage('Ayarlar Kaydedilemedi', 'Ayarlar sunucuya kaydedilemedi. İnternet bağlantısını ve sunucu izinlerini kontrol edip tekrar deneyin.', 'warning');
                     } finally {
                       systemSettingsSavingRef.current = false;
                       setSystemSettingsSaving(false);
                     }
                  }, className: "space-y-6", __self: this, __source: {fileName: _jsxFileName, lineNumber: 8876}}
                    , React.createElement('div', { className: "grid grid-cols-1 sm:grid-cols-2 gap-4"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8979}}
                      , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8980}}
                        , React.createElement('label', { className: "block text-sm font-semibold text-slate-600 mb-1"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8981}}, "Açılış Saati" )
                        , React.createElement('input', { type: "time", name: "openTime", defaultValue: settings.openTime, className: "w-full p-3 border border-slate-300 rounded-xl bg-slate-50"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8982}} )
                      )
                      , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8984}}
                        , React.createElement('label', { className: "block text-sm font-semibold text-slate-600 mb-1"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8985}}, "Kapanış Saati" )
                        , React.createElement('input', { type: "time", name: "closeTime", defaultValue: settings.closeTime, className: "w-full p-3 border border-slate-300 rounded-xl bg-slate-50"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8986}} )
                      )
                    )

                    , React.createElement('div', { className: "p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-4"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8990}}
                      , React.createElement('h3', { className: "font-bold text-blue-800 mb-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8991}}, "Mola Ayarları" )
                      , React.createElement('div', { className: "grid grid-cols-2 sm:grid-cols-4 gap-4"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8992}}
                        , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8993}}
                          , React.createElement('label', { className: "block text-xs font-semibold text-slate-600 mb-1"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8994}}, "Kısa Mola Sayısı"  )
                          , React.createElement('input', { type: "number", name: "shortBreakCount", defaultValue: settings.shortBreakCount, className: "w-full p-2 border border-slate-300 rounded-lg"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8995}} )
                        )
                        , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8997}}
                          , React.createElement('label', { className: "block text-xs font-semibold text-slate-600 mb-1"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8998}}, "Kısa Süre (Dk)"  )
                          , React.createElement('input', { type: "number", name: "shortBreakDuration", defaultValue: settings.shortBreakDuration, className: "w-full p-2 border border-slate-300 rounded-lg"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 8999}} )
                        )
                        , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9001}}
                          , React.createElement('label', { className: "block text-xs font-semibold text-slate-600 mb-1"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9002}}, "Uzun Mola Sayısı"  )
                          , React.createElement('input', { type: "number", name: "longBreakCount", defaultValue: settings.longBreakCount, className: "w-full p-2 border border-slate-300 rounded-lg"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9003}} )
                        )
                        , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9005}}
                          , React.createElement('label', { className: "block text-xs font-semibold text-slate-600 mb-1"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9006}}, "Uzun Süre (Dk)"  )
                          , React.createElement('input', { type: "number", name: "longBreakDuration", defaultValue: settings.longBreakDuration, className: "w-full p-2 border border-slate-300 rounded-lg"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9007}} )
                        )
                      )
                      , React.createElement('div', { className: "p-3 mt-3 border border-violet-200 rounded-xl bg-violet-50 space-y-2"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9010}}
                        , React.createElement('label', { className: "flex items-center gap-2 text-sm font-bold"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9011}}, React.createElement('input', { type: "checkbox", name: "hourlyBreakEnabled", defaultChecked: settings.hourlyBreakEnabled !== false, __self: this, __source: {fileName: _jsxFileName, lineNumber: 9011}} ), " 1 Saatlik Mola (yalnızca cuma günü aktif)"       )
                        , React.createElement('div', { className: "grid grid-cols-2 gap-3"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9012}}
                          , React.createElement('label', { className: "text-xs", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9013}}, "Hak sayısı "  , React.createElement('input', { className: "w-full p-2 border rounded-lg"   , type: "number", min: "0", max: "50", name: "hourlyBreakCount", defaultValue: _nullishCoalesce(settings.hourlyBreakCount, () => ( 1)), __self: this, __source: {fileName: _jsxFileName, lineNumber: 9013}} ))
                          , React.createElement('label', { className: "text-xs", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9014}}, "Süre (dakika) "  , React.createElement('input', { className: "w-full p-2 border rounded-lg"   , type: "number", min: "1", max: "240", name: "hourlyBreakDuration", defaultValue: _nullishCoalesce(settings.hourlyBreakDuration, () => ( 60)), __self: this, __source: {fileName: _jsxFileName, lineNumber: 9014}} ))
                        )
                      )
                      , React.createElement('div', { className: "pt-3 border-t border-blue-200"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9017}}
                        , React.createElement('label', { className: "block text-xs font-semibold text-slate-600 mb-1"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9018}}, "Molalar Arası Zorunlu Çalışma (Dk)"    )
                        , React.createElement('input', { type: "number", min: "30", name: "breakCooldown", defaultValue: Math.max(30, Number(settings.breakCooldown) || 30), className: "w-full p-2 border border-blue-300 rounded-lg bg-white"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9019}} )
                        , React.createElement('p', { className: "text-xs text-blue-700 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9020}}, "Peş peşe mola kullanılamaz. Minimum değer 30 dakikadır ve süre masa başlangıcında veya mola dönüşünde yeniden başlar."                )
                      )
                    )



                    , React.createElement('div', { className: "p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9026}}
                        , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9027}}
                            , React.createElement('h3', { className: "font-bold text-slate-800" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9028}}, "Özel Kroki Görünümü"  )
                            , React.createElement('p', { className: "text-xs text-slate-500" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9029}}, "Editörden çizdiğiniz dinamik düzeni etkinleştirir."    )
                        )
                        , React.createElement('label', { className: "relative inline-flex items-center cursor-pointer"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9031}}
                          , React.createElement('input', { type: "checkbox", name: "useCustomLayout", defaultChecked: settings.useCustomLayout, className: "sr-only peer" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9032}} )
                          , React.createElement('div', { className: "w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"                   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9033}})
                        )
                    )

                    , React.createElement('div', { className: "p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-3"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9037}}
                      , React.createElement('h3', { className: "font-bold text-orange-800" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9038}}, "Boş Masa İhbarı"  )
                      , React.createElement('p', { className: "text-sm text-orange-800" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9039}}, "Sistem genelinde açık. Hesabı onaylı ve kısıtsız öğrenciler, mola dışında masada bulunmayan kullanıcıyı ihbar edebilir. Tamamen boş masalar ve moladaki kullanıcılar ihbar edilemez."                      )
                      , React.createElement('label', { className: "block text-xs font-semibold text-slate-600"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9040}}, "İhbar doğrulama süresi (dakika)"
                        , React.createElement('input', { type: "number", name: "reportWaitTime", min: "1", defaultValue: settings.reportWaitTime, className: "w-full p-2 border rounded-lg mt-1"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9041}} )
                      )
                      , React.createElement('label', { className: "block text-xs font-semibold text-slate-600"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9043}}, "İhlal sınırı"
                        , React.createElement('input', { type: "number", name: "strikeLimit", min: "1", defaultValue: settings.strikeLimit, className: "w-full p-2 border rounded-lg mt-1"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9044}} )
                      )
                    )
                    , React.createElement('button', { type: "submit", disabled: systemSettingsSaving, className: "w-full bg-slate-800 text-white font-bold py-4 rounded-xl shadow-md hover:bg-slate-900 transition-colors disabled:opacity-50"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9047}}, systemSettingsSaving ? 'Kaydediliyor…' : 'Ayarları Kaydet')
                  )
                  , React.createElement('div', { className: "mt-6 p-4 rounded-xl border border-slate-200 bg-slate-50"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9049}}
                    , React.createElement('h3', { className: "font-black text-slate-800" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9050}}, "Otomatik Kapanış Geçmişi"  )
                    , React.createElement('p', { className: "text-xs text-slate-600 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9051}}, "Yalnızca sunucu tarafından tamamlanan kapanışlar listelenir. Geçmiş kayıtlar silinmez."        )
                    , closureHistoryStatus && React.createElement('p', { className: "text-sm text-amber-700 mt-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9052}}, closureHistoryStatus)
                    , closureHistory.length === 0 && !closureHistoryStatus && React.createElement('p', { className: "text-sm text-slate-600 mt-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9053}}, "Henüz sunucu kapanış kaydı yok."    )
                    , React.createElement('div', { className: "space-y-2 mt-3" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9054}}
                      , closureHistory.map(item => React.createElement('div', { key: item.day, className: "bg-white border rounded-lg p-3 text-sm flex flex-wrap justify-between gap-2"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9055}}
                        , React.createElement('span', { className: "font-semibold", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9056}}, item.day, " · "  , Number(item.closedAt) ? new Date(item.closedAt).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}) : '-', " " )
                        , React.createElement('span', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9057}}, item.deskCount || 0, " masa · "   , item.breakUsersCount || 0, " mola hakkı yenilendi"   )
                        , React.createElement('span', { className: "text-emerald-700", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9058}}, item.status === 'completed' ? 'Tamamlandı' : 'Kaydedildi')
                      ))
                    )
                  )
                )
              )



              , adminTab === 'violations' && (
                React.createElement('div', { className: "bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9068}}
                  , React.createElement('div', { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9069}}
                    , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9070}}
                      , React.createElement('h2', { className: "text-xl font-bold text-slate-800 flex items-center gap-2"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9071}}, React.createElement(ShieldAlert, { className: "w-5 h-5 text-red-600"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9071}}), " İhlal Kayıtları"  )
                      , React.createElement('p', { className: "text-sm text-slate-500 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9072}}, "Günlük ihlal sayacı yeni günde sıfırlanır; bu arşiv geçmiş ihlalleri tarih-saat bilgisiyle saklamaya devam eder."              )
                    )
                    , React.createElement('div', { className: "flex flex-wrap items-center gap-2"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9074}}
                      , React.createElement('button', { type: "button", onClick: () => setSelectedViolationIds((Array.isArray(violationRecords) ? violationRecords : []).map(r => r.id)), disabled: !Array.isArray(violationRecords) || violationRecords.length === 0, className: "px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-sm font-bold"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9075}}, "Tümünü Seç" )
                      , React.createElement('button', { type: "button", onClick: () => setSelectedViolationIds([]), disabled: selectedViolationIds.length === 0, className: "px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-sm font-bold"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9076}}, "Seçimi Kaldır" )
                      , React.createElement('button', { type: "button", onClick: () => bulkDeleteRecords('violations'), disabled: selectedViolationIds.length === 0, className: "px-3 py-2 bg-red-700 hover:bg-red-800 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2"           , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9077}}, React.createElement(Trash2, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9077}}), " Seçilenleri Sil ("   , selectedViolationIds.length, ")")
                      , React.createElement('button', { onClick: downloadViolationRecordsPdf, disabled: !Array.isArray(violationRecords) || violationRecords.length === 0, className: "px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2"           , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9078}}, React.createElement(FileText, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9078}}), " PDF İndir"  )
                      , React.createElement('button', { onClick: downloadViolationRecordsWord, disabled: !Array.isArray(violationRecords) || violationRecords.length === 0, className: "px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2"           , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9079}}, React.createElement(FileText, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9079}}), " Word İndir"  )
                      , React.createElement('div', { className: "px-3 py-2 bg-red-50 text-red-700 rounded-xl text-sm font-bold border border-red-200"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9080}}, "Toplam: " , Array.isArray(violationRecords) ? violationRecords.length : 0)
                    )
                  )

                  , !Array.isArray(violationRecords) || violationRecords.length === 0 ? (
                    React.createElement('div', { className: "text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9085}}
                      , React.createElement(ShieldAlert, { className: "w-10 h-10 text-slate-300 mx-auto mb-3"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9086}})
                      , React.createElement('p', { className: "font-bold text-slate-500" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9087}}, "Henüz kayıtlı ihlal bulunmuyor."   )
                      , React.createElement('p', { className: "text-xs text-slate-400 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9088}}, "Bir öğrenci ihlal aldığında burada otomatik kaydedilecektir."      )
                    )
                  ) : (
                    React.createElement('table', { className: "w-full text-left border-collapse text-sm min-w-[1100px]"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9091}}
                      , React.createElement('thead', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9092}}
                        , React.createElement('tr', { className: "bg-slate-50 text-slate-500 border-b border-slate-200"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9093}}
                          , React.createElement('th', { className: "p-3 font-semibold text-center"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9094}}, "Seç")
                          , React.createElement('th', { className: "p-3 font-semibold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9095}}, "Tarih / Saat"  )
                          , React.createElement('th', { className: "p-3 font-semibold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9096}}, "Öğrenci")
                          , React.createElement('th', { className: "p-3 font-semibold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9097}}, "Masa")
                          , React.createElement('th', { className: "p-3 font-semibold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9098}}, "İhlal Türü" )
                          , React.createElement('th', { className: "p-3 font-semibold w-1/3"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9099}}, "Açıklama")
                          , React.createElement('th', { className: "p-3 font-semibold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9100}}, "Cihaz / Konum"  )
                          , React.createElement('th', { className: "p-3 font-semibold text-center"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9101}}, "İşlem")
                        )
                      )
                      , React.createElement('tbody', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9104}}
                        , violationRecords.map(record => (
                          React.createElement('tr', { key: record.id, className: "border-b border-slate-100 hover:bg-red-50/30 align-top"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9106}}
                            , React.createElement('td', { className: "p-3 text-center" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9107}}, React.createElement('input', { type: "checkbox", checked: selectedViolationIds.includes(record.id), onChange: e => setSelectedViolationIds(prev => e.target.checked ? [...new Set([...prev, record.id])] : prev.filter(id => id !== record.id)), __self: this, __source: {fileName: _jsxFileName, lineNumber: 9107}} ))
                            , React.createElement('td', { className: "p-3 whitespace-nowrap text-slate-500"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9108}}
                              , React.createElement('div', { className: "font-semibold text-slate-700" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9109}}, new Date(record.time).toLocaleDateString('tr-TR'))
                              , React.createElement('div', { className: "text-xs", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9110}}, formatDateTime(record.time))
                            )
                            , React.createElement('td', { className: "p-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9112}}
                              , React.createElement('div', { className: "font-bold text-slate-700" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9113}}, record.userId ? React.createElement('button', { type: "button", onClick: () => openAdminUserEditor(record.userId), className: "text-blue-700 hover:underline text-left"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9113}}, record.userInfo || '-') : (record.userInfo || '-'))
                              , record.userId && React.createElement('div', { className: "text-[11px] text-slate-400 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9114}}, "ID: " , record.userId)
                            )
                            , React.createElement('td', { className: "p-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9116}}, record.deskId ? React.createElement('span', { className: "px-2 py-1 bg-slate-200 rounded-lg text-xs font-bold"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9116}}, record.deskId) : '-')
                            , React.createElement('td', { className: "p-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9117}}, React.createElement('span', { className: "px-2 py-1 bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-black"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9117}}, String(record.type || 'IHLAL').replace(/_/g, ' ')))
                            , React.createElement('td', { className: "p-3 text-slate-600" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9118}}, record.message || '-')
                            , React.createElement('td', { className: "p-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9119}}
                              , React.createElement('div', { className: "text-xs space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9120}}
                                , React.createElement('div', { className: "text-slate-500 font-medium flex items-center gap-1.5"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9121}}, React.createElement(Smartphone, { className: "w-3.5 h-3.5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9121}}), " " , record.deviceInfo || '-')
                                , record.locationInfo && React.createElement('div', { className: "text-slate-500 font-medium flex items-center gap-1.5"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9122}}, React.createElement(MapPin, { className: "w-3.5 h-3.5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9122}}), " " , record.locationInfo)
                              )
                            )
                            , React.createElement('td', { className: "p-3 text-center" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9125}}
                              , React.createElement('button', { onClick: () => deleteViolationRecord(record), className: "px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 border border-red-200 rounded-lg font-bold inline-flex items-center gap-1.5 whitespace-nowrap"            , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9126}}, React.createElement(Trash2, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9126}}), " Sil" )
                            )
                          )
                        ))
                      )
                    )
                  )
                )
              )

              , adminTab === 'feedback' && (
                React.createElement('div', { className: "bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9137}}
                  , React.createElement('div', { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9138}}
                    , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9139}}
                      , React.createElement('h2', { className: "text-xl font-bold text-slate-800 flex items-center gap-2"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9140}}, React.createElement(FileText, { className: "w-5 h-5 text-purple-600"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9140}}), " Dilek / Şikayet Kayıtları"    )
                      , React.createElement('p', { className: "text-sm text-slate-500 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9141}}, "Onaylanmış ve kısıtsız hesaplardan gönderilen tüm öneri ve şikayetler burada listelenir."          )
                    )
                    , React.createElement('div', { className: "flex flex-wrap items-center gap-2"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9143}}
                      , React.createElement('button', { type: "button", onClick: () => setSelectedFeedbackIds((Array.isArray(feedbackRecords) ? feedbackRecords : []).map(r => r.id)), disabled: !Array.isArray(feedbackRecords) || feedbackRecords.length === 0, className: "px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-sm font-bold"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9144}}, "Tümünü Seç" )
                      , React.createElement('button', { type: "button", onClick: () => setSelectedFeedbackIds([]), disabled: selectedFeedbackIds.length === 0, className: "px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-sm font-bold"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9145}}, "Seçimi Kaldır" )
                      , React.createElement('button', { type: "button", onClick: () => bulkDeleteRecords('feedback'), disabled: selectedFeedbackIds.length === 0, className: "px-3 py-2 bg-red-700 hover:bg-red-800 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2"           , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9146}}, React.createElement(Trash2, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9146}}), " Seçilenleri Sil ("   , selectedFeedbackIds.length, ")")
                      , React.createElement('button', { onClick: downloadFeedbackRecordsPdf, disabled: !Array.isArray(feedbackRecords) || feedbackRecords.length === 0, className: "px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2"           , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9147}}, React.createElement(FileText, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9147}}), " PDF İndir"  )
                      , React.createElement('button', { onClick: downloadFeedbackRecordsWord, disabled: !Array.isArray(feedbackRecords) || feedbackRecords.length === 0, className: "px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2"           , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9148}}, React.createElement(FileText, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9148}}), " Word İndir"  )
                      , React.createElement('div', { className: "px-3 py-2 bg-purple-50 text-purple-700 rounded-xl text-sm font-bold border border-purple-200"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9149}}, "Toplam: " , Array.isArray(feedbackRecords) ? feedbackRecords.length : 0)
                    )
                  )

                  , !Array.isArray(feedbackRecords) || feedbackRecords.length === 0 ? (
                    React.createElement('div', { className: "text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9154}}
                      , React.createElement(FileText, { className: "w-10 h-10 text-slate-300 mx-auto mb-3"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9155}})
                      , React.createElement('p', { className: "font-bold text-slate-500" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9156}}, "Henüz dilek, öneri veya şikayet kaydı bulunmuyor."      )
                    )
                  ) : (
                    React.createElement('table', { className: "w-full text-left border-collapse text-sm min-w-[950px]"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9159}}
                      , React.createElement('thead', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9160}}
                        , React.createElement('tr', { className: "bg-slate-50 text-slate-500 border-b border-slate-200"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9161}}
                          , React.createElement('th', { className: "p-3 font-semibold text-center"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9162}}, "Seç")
                          , React.createElement('th', { className: "p-3 font-semibold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9163}}, "Tarih / Saat"  )
                          , React.createElement('th', { className: "p-3 font-semibold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9164}}, "Ad Soyad" )
                          , React.createElement('th', { className: "p-3 font-semibold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9165}}, "GM Özel Kod"  )
                          , React.createElement('th', { className: "p-3 font-semibold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9166}}, "Tür")
                          , React.createElement('th', { className: "p-3 font-semibold w-2/5"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9167}}, "Mesaj")
                          , React.createElement('th', { className: "p-3 font-semibold text-center"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9168}}, "İşlem")
                        )
                      )
                      , React.createElement('tbody', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9171}}
                        , feedbackRecords.map(record => (
                          React.createElement('tr', { key: record.id, className: "border-b border-slate-100 hover:bg-purple-50/30 align-top"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9173}}
                            , React.createElement('td', { className: "p-3 text-center" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9174}}, React.createElement('input', { type: "checkbox", checked: selectedFeedbackIds.includes(record.id), onChange: e => setSelectedFeedbackIds(prev => e.target.checked ? [...new Set([...prev, record.id])] : prev.filter(id => id !== record.id)), __self: this, __source: {fileName: _jsxFileName, lineNumber: 9174}} ))
                            , React.createElement('td', { className: "p-3 whitespace-nowrap text-slate-500"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9175}}
                              , React.createElement('div', { className: "font-semibold text-slate-700" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9176}}, new Date(record.time).toLocaleDateString('tr-TR'))
                              , React.createElement('div', { className: "text-xs", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9177}}, formatDateTime(record.time))
                            )
                            , React.createElement('td', { className: "p-3 font-bold text-slate-700"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9179}}, record.name || '-')
                            , React.createElement('td', { className: "p-3 text-slate-600" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9180}}, record.specialCode || _optionalChain([safeUsersList, 'access', _523 => _523.find, 'call', _524 => _524(u => u.id === record.userId), 'optionalAccess', _525 => _525.specialCode]) || '-')
                            , React.createElement('td', { className: "p-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9181}}
                              , React.createElement('span', { className: `px-3 py-1 rounded-full text-xs font-black ${record.type === 'complaint' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 9182}}
                                , record.type === 'complaint' ? 'ŞİKAYET' : 'ÖNERİ'
                              )
                            )
                            , React.createElement('td', { className: "p-3 text-slate-600 whitespace-pre-wrap"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9186}}, record.message || '-')
                            , React.createElement('td', { className: "p-3 text-center" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9187}}
                              , React.createElement('button', { onClick: () => deleteFeedbackRecord(record), className: "px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 border border-red-200 rounded-lg font-bold inline-flex items-center gap-1.5 whitespace-nowrap"            , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9188}}, React.createElement(Trash2, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9188}}), " Sil" )
                            )
                          )
                        ))
                      )
                    )
                  )
                )
              )

              , adminTab === 'logs' && (
                React.createElement('div', { className: "bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9199}}
                   , React.createElement('div', { className: "flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9200}}
                     , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9201}}
                       , React.createElement('h2', { className: "text-xl font-bold text-slate-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9202}}, "Sistem Kayıtları" )
                       , React.createElement('p', { className: "text-sm text-slate-500 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9203}}, "Kayıtları tek tek silebilir, son 7 gün veya son 30 gün kayıtlarını Excel uyumlu CSV olarak indirebilirsiniz."                )
                       , React.createElement('p', { className: "text-xs text-blue-600 mt-1 font-semibold"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9204}}, "22:00 otomatik kapanış, 23:00 ikinci güvenlik kontrolü, otomatik masa boşaltma ve günlük ihlal arşiv/sıfırlama işlemleri de burada loglanır."                 )
                     )
                     , React.createElement('div', { className: "flex flex-col sm:flex-row gap-2 shrink-0"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9206}}
                       , React.createElement('button', { onClick: () => downloadLogsCsv('week'), className: "px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border border-green-200"             , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9207}}
                         , React.createElement(Save, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9208}}), " Haftalık Kayıtları İndir"
                       )
                       , React.createElement('button', { onClick: () => downloadLogsCsv('month'), className: "px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border border-blue-200"             , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9210}}
                         , React.createElement(Save, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9211}}), " Aylık Kayıtları İndir"
                       )
                     )
                   )
                   , React.createElement('div', { className: "flex flex-wrap gap-2 mb-4"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9215}}
                     , React.createElement('button', { onClick: () => setSelectedLogIds(visibleLogs.map(l => l.id)), className: "px-3 py-2 bg-slate-100 rounded-xl font-bold"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9216}}, "Tümünü Seç" )
                     , React.createElement('button', { onClick: () => setSelectedLogIds([]), className: "px-3 py-2 bg-slate-100 rounded-xl font-bold"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9217}}, "Seçimi Kaldır" )
                     , React.createElement('button', { disabled: !selectedLogIds.length, onClick: () => bulkDeleteRecords('logs'), className: "px-3 py-2 bg-red-700 disabled:bg-slate-300 text-white rounded-xl font-bold"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9218}}, "Seçilenleri Sil ("  , selectedLogIds.length, ")")
                     , React.createElement('button', { disabled: archiveLoading, onClick: loadArchivedLogs, className: "px-3 py-2 bg-blue-50 text-blue-700 rounded-xl font-bold"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9219}}, archiveLoading ? 'Yükleniyor...' : 'Eski Kayıtları Yükle')
                   )
                   , visibleLogs.length === 0 ? (
                      React.createElement('p', { className: "text-slate-400 text-center py-8"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9222}}, "Henüz kayıt bulunmuyor."  )
                   ) : (
                      React.createElement('table', { className: "w-full text-left border-collapse text-sm min-w-[1050px]"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9224}}
                        , React.createElement('thead', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9225}}
                           , React.createElement('tr', { className: "bg-slate-50 text-slate-500 border-b border-slate-200"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9226}}
                             , React.createElement('th', { className: "p-3 font-semibold text-center"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9227}}, "Seç"), React.createElement('th', { className: "p-3 font-semibold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9227}}, "Zaman")
                             , React.createElement('th', { className: "p-3 font-semibold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9228}}, "İşlem Tipi" )
                             , React.createElement('th', { className: "p-3 font-semibold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9229}}, "Masa")
                             , React.createElement('th', { className: "p-3 font-semibold w-1/4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9230}}, "Açıklama")
                             , React.createElement('th', { className: "p-3 font-semibold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9231}}, "Kullanıcı & Cihaz"  )
                             , React.createElement('th', { className: "p-3 font-semibold text-center"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9232}}, "İşlem")
                           )
                        )
                        , React.createElement('tbody', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9235}}
                           , visibleLogs.map(log => (
                              React.createElement('tr', { key: log.id, className: "border-b border-slate-100 hover:bg-slate-50"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9237}}
                                 , React.createElement('td', { className: "p-3 text-center" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9238}}, React.createElement('input', { type: "checkbox", 'aria-label': "Kaydı seç" , checked: selectedLogIds.includes(log.id), onChange: e => setSelectedLogIds(prev => e.target.checked ? [...new Set([...prev, log.id])] : prev.filter(id => id !== log.id)), __self: this, __source: {fileName: _jsxFileName, lineNumber: 9238}})), React.createElement('td', { className: "p-3 whitespace-nowrap text-slate-500"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9238}}
                                   , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9239}}, new Date(log.time).toLocaleDateString('tr-TR'))
                                   , React.createElement('div', { className: "text-xs", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9240}}, formatDateTime(log.time))
                                 )
                                 , React.createElement('td', { className: "p-3 font-bold text-slate-700"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9242}}, String(log.type || 'KAYIT').replace(/_/g, ' '))
                                 , React.createElement('td', { className: "p-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9243}}, log.deskId ? React.createElement('span', { className: "px-2 py-0.5 bg-slate-200 rounded text-xs font-bold"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9243}}, log.deskId) : '-')
                                 , React.createElement('td', { className: "p-3 text-slate-600 pr-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9244}}, log.message || '-')
                                 , React.createElement('td', { className: "p-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9245}}
                                    , React.createElement('div', { className: "text-xs space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9246}}
                                        , React.createElement('div', { className: "text-blue-700 font-bold flex items-center gap-1.5"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9247}}, React.createElement(User, { className: "w-3.5 h-3.5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9247}}), " " , log.userInfo)
                                        , React.createElement('div', { className: "text-slate-500 font-medium flex items-center gap-1.5"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9248}}, React.createElement(Smartphone, { className: "w-3.5 h-3.5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9248}}), " " , log.deviceInfo)
                                        , log.locationInfo && React.createElement('div', { className: "text-slate-500 font-medium flex items-center gap-1.5"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9249}}, React.createElement(MapPin, { className: "w-3.5 h-3.5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9249}}), " " , log.locationInfo)
                                    )
                                 )
                                 , React.createElement('td', { className: "p-3 text-center" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9252}}
                                   , React.createElement('button', { onClick: () => deleteSystemLog(log), className: "px-3 py-2 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 inline-flex items-center gap-1.5"            , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9253}}
                                     , React.createElement(Trash2, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9254}}), " Sil"
                                   )
                                 )
                              )
                           ))
                        )
                      )
                   )
                )
              )

              , adminTab === 'push_status' && (
                React.createElement('div', { className: "space-y-6", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9266}}
                  , React.createElement('div', { className: "bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-3"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9267}}
                    , React.createElement('h3', { className: "text-lg font-bold text-slate-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9268}}, "Firebase Web Push Anahtarı"   )
                    , React.createElement('p', { className: "text-sm text-slate-600" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9269}}, "Bu uygulamanın Firebase projesinde Proje ayarları → Cloud Messaging → Web Push certificates bölümündeki "              , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9269}}, "Public key" ), " değerini buraya yapıştırın. Henüz oluşturulmadıysa aynı bölümde Generate key pair seçeneğini kullanın."            )
                    , React.createElement('label', { htmlFor: "firebase-vapid-key", className: "block text-sm font-bold text-slate-700"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9270}}, "Herkese açık VAPID anahtarı"   )
                    , React.createElement('textarea', { id: "firebase-vapid-key", rows: 3, value: pushVapidDraft, onChange: e => { pushVapidDraftDirtyRef.current = true; setPushVapidDraft(e.target.value); }, placeholder: "Firebase Web Push Public key"    , className: "w-full border border-slate-300 p-3 rounded-xl font-mono text-sm break-all"       , spellCheck: false, __self: this, __source: {fileName: _jsxFileName, lineNumber: 9271}})
                    , React.createElement('button', { type: "button", disabled: pushVapidSaving, onClick: saveFirebaseVapidKey, className: "px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9272}}, pushVapidSaving ? 'Kaydediliyor…' : 'Push Anahtarını Kaydet')
                    , React.createElement('p', { className: "text-xs text-slate-500" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9273}}, "Kaydedilen anahtar diğer cihazlara otomatik aktarılır. Mevcut VITE_FIREBASE_VAPID_KEY ayarı da desteklenir. Bu alana Private key veya servis hesabı JSON bilgisi girilmez."                    )
                  )
                  , React.createElement('div', { className: "bg-white p-6 rounded-2xl shadow-sm border border-slate-200"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9275}}
                    , React.createElement('div', { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9276}}
                      , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9277}}
                        , React.createElement('h2', { className: "text-xl font-bold text-slate-800 flex items-center gap-2"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9278}}
                          , React.createElement(Smartphone, { className: "w-6 h-6 text-blue-600"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9279}} ), "Telefon Push Bildirim Durumu"

                        )
                        , React.createElement('p', { className: "text-sm text-slate-500 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9282}}, "Bu ekran FCM, Service Worker, VAPID ve Vercel Push API bağlantısını kontrol eder."

                        )
                      )

                      , React.createElement('div', { className: "flex flex-col sm:flex-row gap-2"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9287}}
                        , React.createElement('button', {
                          type: "button",
                          onClick: forceRegisterMessagingWorker,
                          disabled: manualWorkerBusy,
                          className: "px-5 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md"            , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9288}}

                          , React.createElement(Smartphone, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9294}} )
                          , manualWorkerBusy ? 'Worker Kaydediliyor...' : 'Service Worker’ı Zorla Kaydet'
                        )

                      , React.createElement('button', {
                        type: "button",
                        onClick: refreshPushDiagnostics,
                        disabled: pushDiagnostics.loading,
                        className: "px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md"            , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9298}}

                        , React.createElement(RefreshCw, { className: `w-5 h-5 ${pushDiagnostics.loading ? 'animate-spin' : ''}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 9304}} )
                        , pushDiagnostics.loading ? 'Kontrol Ediliyor...' : 'Sistemi Kontrol Et'
                      )
                      )
                    )

                    , !pushDiagnostics.checked ? (
                      React.createElement('div', { className: "p-5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9311}}
                        , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9312}}, "Sistemi Kontrol Et"  ), " butonuna basarak bu cihazın push bildirim durumunu kontrol edin."
                      )
                    ) : (
                      React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9315}}
                        , [
                          {
                            label: 'Bildirim Desteği',
                            ok: pushDiagnostics.notificationSupported,
                            value: pushDiagnostics.notificationSupported ? 'Destekleniyor' : 'Desteklenmiyor'
                          },
                          {
                            label: 'Bildirim İzni',
                            ok: pushDiagnostics.notificationPermission === 'granted',
                            value:
                              pushDiagnostics.notificationPermission === 'granted'
                                ? 'Açık'
                                : pushDiagnostics.notificationPermission === 'denied'
                                  ? 'Engellendi'
                                  : pushDiagnostics.notificationPermission === 'default'
                                    ? 'Henüz Verilmedi'
                                    : pushDiagnostics.notificationPermission
                          },
                          {
                            label: 'FCM Messaging',
                            ok: pushDiagnostics.messagingSupported,
                            value: pushDiagnostics.messagingSupported ? 'Destekleniyor' : 'Desteklenmiyor'
                          },
                          {
                            label: 'Service Worker',
                            ok: pushDiagnostics.serviceWorkerSupported && pushDiagnostics.serviceWorkerActive,
                            value: !pushDiagnostics.serviceWorkerSupported
                              ? 'Desteklenmiyor'
                              : pushDiagnostics.serviceWorkerActive
                                ? 'Aktif'
                                : 'FCM Worker Bulunamadı'
                          },
                          {
                            label: 'VAPID Anahtarı',
                            ok: pushDiagnostics.vapidConfigured,
                            value: pushDiagnostics.vapidConfigured ? 'Tanımlı' : 'Eksik'
                          },
                          {
                            label: 'Vercel Push API',
                            ok: pushDiagnostics.apiReachable,
                            value: pushDiagnostics.apiReachable
                              ? `Aktif${pushDiagnostics.apiStatus ? ` (HTTP ${pushDiagnostics.apiStatus})` : ''}`
                              : `Hata${pushDiagnostics.apiStatus ? ` (HTTP ${pushDiagnostics.apiStatus})` : ''}`
                          }
                        ].map(item => (
                          React.createElement('div', {
                            key: item.label,
                            className: `p-4 rounded-xl border ${item.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 9361}}

                            , React.createElement('div', { className: "flex items-start gap-3"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9365}}
                              , item.ok
                                ? React.createElement(CheckCircle, { className: "w-6 h-6 text-green-600 shrink-0"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9367}} )
                                : React.createElement(AlertTriangle, { className: "w-6 h-6 text-red-600 shrink-0"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9368}} )
                              
                              , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9370}}
                                , React.createElement('p', { className: "font-bold text-slate-800" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9371}}, item.label)
                                , React.createElement('p', { className: `text-sm mt-1 ${item.ok ? 'text-green-700' : 'text-red-700'}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 9372}}
                                  , item.value
                                )
                              )
                            )
                          )
                        ))
                      )
                    )

                    , pushDiagnostics.checked && pushDiagnostics.apiMessage && (
                      React.createElement('div', { className: "mt-4 text-xs text-slate-500"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9383}}, "API cevabı: "
                          , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9384}}, pushDiagnostics.apiMessage)
                        , pushDiagnostics.lastCheckedAt && (
                          React.createElement(React.Fragment, null, " · Son kontrol: "    , new Date(pushDiagnostics.lastCheckedAt).toLocaleTimeString('tr-TR'))
                        )
                      )
                    )

                    , pushDiagnostics.manualWorkerResult && (
                      React.createElement('div', { className: "mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 break-all"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9392}}
                        , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9393}}, "Manuel Worker Sonucu:"  ), " " , pushDiagnostics.manualWorkerResult
                      )
                    )

                    , pushDiagnostics.manualWorkerError && (
                      React.createElement('div', { className: "mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 break-all"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9398}}
                        , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9399}}, "Manuel Worker Hatası:"  ), " " , pushDiagnostics.manualWorkerError
                      )
                    )
                  )

                  , React.createElement('div', { className: "bg-white p-6 rounded-2xl shadow-sm border border-slate-200"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9404}}
                    , React.createElement('div', { className: "flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9405}}
                      , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9406}}
                        , React.createElement('h3', { className: "text-lg font-bold text-slate-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9407}}, "Kullanıcı FCM Tokenları"  )
                        , React.createElement('p', { className: "text-sm text-slate-500 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9408}}, "Telefonda bildirim izni verip giriş yapan kullanıcıların kayıtlı tokenlarını burada görebilirsiniz."

                        )
                      )

                      , React.createElement('div', { className: "px-3 py-2 bg-slate-100 rounded-xl text-sm font-bold text-slate-700"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9413}}, "Tokenı olan kullanıcı:"

                        , ' '
                        , Array.isArray(users)
                          ? users.filter(u => Array.isArray(u.pushTokens) && u.pushTokens.some(Boolean)).length
                          : 0
                      )
                    )

                    , !Array.isArray(users) || users.length === 0 ? (
                      React.createElement('p', { className: "text-slate-400 text-center py-8"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9423}}, "Henüz kullanıcı bulunmuyor."  )
                    ) : (
                      React.createElement('div', { className: "space-y-3", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9425}}
                        , users.map(user => {
                          const tokenCount = Array.isArray(user.pushTokens)
                            ? user.pushTokens.filter(Boolean).length
                            : 0;
                          const hasToken = tokenCount > 0;

                          return (
                            React.createElement('div', {
                              key: user.id,
                              className: "border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9433}}

                              , React.createElement('div', { className: "min-w-0", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9437}}
                                , React.createElement('div', { className: "flex flex-wrap items-center gap-2"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9438}}
                                  , React.createElement('p', { className: "font-bold text-slate-800" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9439}}, user.name || 'İsimsiz Kullanıcı')
                                  , React.createElement('span', { className: `px-2 py-1 rounded-full text-[11px] font-bold ${hasToken ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 9440}}
                                    , hasToken ? `FCM Aktif · ${tokenCount} token` : 'FCM Token Yok'
                                  )
                                )

                                , React.createElement('p', { className: "text-xs text-slate-500 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9445}}, "GM Özel Kod: "
                                     , user.specialCode || '-'
                                  , user.activeDeskId ? ` · Masa ${user.activeDeskId}` : ''
                                )

                                , user.pushUpdatedAt && (
                                  React.createElement('p', { className: "text-xs text-slate-400 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9451}}, "Son push kaydı: "
                                       , new Date(user.pushUpdatedAt).toLocaleString('tr-TR')
                                  )
                                )
                              )

                              , React.createElement('button', {
                                type: "button",
                                disabled: !hasToken || pushTestSendingUserId === user.id,
                                onClick: () => sendAdminTestPush(user),
                                className: "px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shrink-0"              , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9457}}

                                , pushTestSendingUserId === user.id
                                  ? React.createElement(RefreshCw, { className: "w-4 h-4 animate-spin"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9464}} )
                                  : React.createElement(Smartphone, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9465}} )
                                
                                , pushTestSendingUserId === user.id ? 'Gönderiliyor...' : 'Test Bildirimi Gönder'
                              )
                            )
                          );
                        })
                      )
                    )
                  )
                )
              )

              , adminTab === 'qr_backup' && (
                React.createElement('div', { className: "bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9479}}
                  , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9480}}, React.createElement('h2', { className: "text-xl font-bold text-slate-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9480}}, "Sabit QR Kodları ve Yedekleri"    )
                    , React.createElement('p', { className: "text-sm text-slate-600 mt-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9481}}, "Mevcut masa QR kodları açılışta, masa bırakıldığında ve onarım sırasında korunur. Yeni masaların kodları sabittir."              ))
                  , React.createElement('div', { className: "flex flex-wrap gap-3"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9482}}
                    , React.createElement('button', { type: "button", disabled: qrBackupBusy || deskQrRepairBusy, onClick: () => exportQrBackup(false), className: "px-4 py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9483}}, "QR Yedeğini İndir (JSON)"   )
                    , React.createElement('button', { type: "button", disabled: qrBackupBusy || deskQrRepairBusy, onClick: () => exportQrBackup(true), className: "px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold disabled:opacity-50"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9484}}, "Tüm QR Kodlarını İndir"   )
                    , React.createElement('input', { ref: qrBackupInputRef, type: "file", accept: ".json,application/json", hidden: true, onChange: importQrBackup, __self: this, __source: {fileName: _jsxFileName, lineNumber: 9485}})
                    , React.createElement('button', { type: "button", disabled: qrBackupBusy || deskQrRepairBusy, onClick: () => _optionalChain([qrBackupInputRef, 'access', _526 => _526.current, 'optionalAccess', _527 => _527.click, 'call', _528 => _528()]), className: "px-4 py-3 bg-slate-100 text-slate-800 rounded-xl font-bold disabled:opacity-50"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9486}}, "QR Yedeği Seç / Yükle"    )
                  )
                  , React.createElement('p', { className: "text-sm text-slate-500" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9488}}, "JSON dosyası kodları geri yüklemek içindir. Tüm QR kodları çevrimdışı açılabilen, yazdırılabilen bir HTML dosyası olarak indirilir. Tek masanın PNG görselini Toplu QR sekmesinden indirebilirsiniz."                        )
                  , qrBackupBusy && React.createElement('p', { role: "status", className: "text-blue-700 font-bold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9489}}, "İşlem yapılıyor…" )
                  , qrBackupPreview && React.createElement('div', { className: "border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9490}}
                    , React.createElement('p', { className: "font-bold text-slate-800" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9491}}, qrBackupPreview.filename, " · "  , qrBackupPreview.rows.length, " masa" )
                    , React.createElement('p', { className: "text-sm text-amber-800" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9492}}, "Geri yükleme seçili yedekteki QR kodlarını uygular. Kod farklıysa basılı kartı da yedekteki kodla eşleştirin."              )
                    , React.createElement('div', { className: "overflow-auto max-h-64" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9493}}, React.createElement('table', { className: "w-full text-left text-sm"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9493}}, React.createElement('thead', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9493}}, React.createElement('tr', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9493}}, React.createElement('th', { className: "p-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9493}}, "Masa"), React.createElement('th', { className: "p-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9493}}, "Yedekteki QR kodu"  ), React.createElement('th', { className: "p-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9493}}, "Durum"))), React.createElement('tbody', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9493}}, qrBackupPreview.rows.map(row => React.createElement('tr', { key: row.id, __self: this, __source: {fileName: _jsxFileName, lineNumber: 9493}}, React.createElement('td', { className: "p-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9493}}, row.id), React.createElement('td', { className: "p-2 font-mono break-all"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9493}}, row.qrCode), React.createElement('td', { className: "p-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9493}}, _optionalChain([(desks || []), 'access', _529 => _529.find, 'call', _530 => _530(d => Number(d.id) === row.id), 'optionalAccess', _531 => _531.qrCode]) === row.qrCode ? 'Aynı' : 'Geri yüklenecek'))))))
                    , React.createElement('div', { className: "flex gap-3" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9494}}, React.createElement('button', { type: "button", disabled: qrBackupBusy || deskQrRepairBusy, onClick: restoreQrBackup, className: "px-4 py-3 bg-amber-600 text-white rounded-xl font-bold disabled:opacity-50"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9494}}, "Yedeği Geri Yükle"  ), React.createElement('button', { type: "button", disabled: qrBackupBusy, onClick: () => setQrBackupPreview(null), className: "px-4 py-3 bg-white rounded-xl font-bold"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9494}}, "Vazgeç"))
                  )
                )
              )

              , adminTab === 'qr_print' && (
                React.createElement('div', { className: "bg-white p-6 rounded-2xl shadow-sm border border-slate-200"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9500}}
                  , React.createElement('div', { className: "flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 gap-4 print:hidden"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9501}}
                    , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9502}}
                      , React.createElement('h2', { className: "text-xl font-bold text-slate-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9503}}, "Toplu QR Kodları"  )
                      , React.createElement('p', { className: "text-sm text-slate-500 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9504}}, "İstediğiniz masaları seçip yalnızca seçilen QR kodlarını yazdırabilir veya her masanın QR kodunu PNG olarak alabilirsiniz."

                      )
                    )
                    , React.createElement('div', { className: "flex flex-wrap gap-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9508}}
                      , React.createElement('button', { type: "button", disabled: deskQrRepairBusy, onClick: () => repairDeskQrData(true), className: "px-4 py-2 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 text-amber-800 rounded-xl font-bold"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9509}}
                        , deskQrRepairBusy ? 'Kontrol Ediliyor…' : 'Eksik Masaları / QR Kodlarını Onar'
                      )
                      , React.createElement('button', {
                        type: "button",
                        onClick: () => {
                          const allIds = (Array.isArray(desks) ? desks : []).map(d => Number(d.id));
                          const allSelected = allIds.length > 0 && allIds.every(id => selectedQrDeskIds.includes(id));
                          setSelectedQrDeskIds(allSelected ? [] : allIds);
                        },
                        className: "px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9512}}

                        , (Array.isArray(desks) && desks.length > 0 && desks.every(d => selectedQrDeskIds.includes(Number(d.id))))
                          ? 'Seçimi Kaldır'
                          : 'Tüm Masaları Seç'
                      )
                      , React.createElement('button', {
                        type: "button",
                        onClick: handlePrintQRs,
                        className: "px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md font-bold flex items-center gap-2"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9525}}

                        , React.createElement(QrCode, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9530}})
                        , selectedQrDeskIds.length ? `Seçilenleri Yazdır (${selectedQrDeskIds.length})` : 'Tümünü Yazdır'
                      )
                    )
                  )

                  , React.createElement('div', { className: "mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl print:hidden"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9536}}
                    , React.createElement('p', { className: "text-sm font-bold text-blue-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9537}}, "Masa seçimi: "
                        , selectedQrDeskIds.length, " masa seçili."
                    )
                    , React.createElement('p', { className: "text-xs text-blue-700 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9540}}, "Kartın sol üstündeki kutudan masa seçebilirsiniz. “QR İndir” ile tek masanın QR görselini bilgisayarınıza alabilirsiniz."

                    )
                  )

                  , (!Array.isArray(desks) || desks.length === 0) && (
                    React.createElement('div', { className: "mb-5 p-6 bg-amber-50 border border-amber-200 rounded-xl text-center"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9546}}
                      , React.createElement(QrCode, { className: "w-10 h-10 text-amber-500 mx-auto mb-2"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9547}})
                      , React.createElement('p', { className: "font-bold text-amber-800" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9548}}, "QR oluşturulacak masa bulunamadı."   )
                      , React.createElement('p', { className: "text-sm text-amber-700 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9549}}, "Önce Kroki bölümünde masaların yüklendiğini kontrol edin."      )
                    )
                  )

                  , React.createElement('div', { id: "qr-print-area", className: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9553}}
                     , Array.isArray(desks) && desks.map(desk => {
                       const selected = selectedQrDeskIds.includes(Number(desk.id));
                       return (
                        React.createElement('div', { key: desk.id, className: `relative flex flex-col items-center justify-center p-0 border-2 rounded-xl bg-white overflow-hidden shadow-sm ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-300'}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 9557}}
                           , React.createElement('label', { className: "absolute top-2 left-2 z-10 print:hidden bg-white/95 rounded-lg px-2 py-1 shadow border border-slate-200 flex items-center gap-1.5 cursor-pointer"               , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9558}}
                             , React.createElement('input', {
                               type: "checkbox",
                               checked: selected,
                               onChange: () => setSelectedQrDeskIds(prev =>
                                 prev.includes(Number(desk.id))
                                   ? prev.filter(id => id !== Number(desk.id))
                                   : [...prev, Number(desk.id)]
                               ),
                               className: "w-4 h-4 accent-blue-600"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9559}}
                             )
                             , React.createElement('span', { className: "text-[10px] font-black text-slate-700"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9569}}, "SEÇ")
                           )
                           , React.createElement('div', { className: "bg-slate-800 w-full text-center py-2 border-b-2 border-slate-300"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9571}}
                               , React.createElement('p', { className: "text-[11px] font-bold text-white uppercase tracking-wide"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9572}}, "Sarıçam Gençlik Merkezi"  )
                           )
                           , React.createElement('div', { className: "p-4 flex flex-col items-center w-full bg-slate-50"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9574}}
                               , React.createElement('p', { className: "text-2xl font-black text-slate-800 mb-3"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9575}}, "Masa " , desk.id)
                               , desk.qrCode ? (
                                 React.createElement(React.Fragment, null
                                   , React.createElement('div', { className: "bg-white p-2 rounded-xl shadow-sm border border-slate-200 mb-3"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9578}}
                                       , React.createElement('img', { src: getDeskQrImageUrl(desk, 300), alt: `Masa ${desk.id} QR`, className: "w-28 h-28" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9579}} )
                                   )
                                   , React.createElement('p', { className: "text-[10px] text-slate-500 font-mono break-all text-center leading-tight bg-white px-2 py-1 rounded w-full border border-slate-200"            , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9581}}, desk.qrCode)
                                   , React.createElement('button', {
                                     type: "button",
                                     onClick: () => handleDownloadDeskQR(desk),
                                     className: "mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 print:hidden"             , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9582}}

                                     , React.createElement(QrCode, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9587}}), " QR İndir"
                                   )
                                 )
                               ) : (
                                 React.createElement('div', { className: "w-full p-3 bg-amber-50 border border-amber-200 rounded-lg text-center"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9591}}
                                   , React.createElement('p', { className: "text-xs font-bold text-amber-800"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9592}}, "QR kod yok"  )
                                   , React.createElement('p', { className: "text-[10px] text-amber-700 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9593}}, "Kroki → Masa "   , desk.id, " → Sabit QR Kodunu Kontrol Et"      )
                                 )
                               )
                           )
                        )
                       );
                     })
                  )
                )
              )

            )
            )
          )
        );
      
      default:
        return null;
    }
  };

  return (
    React.createElement(React.Fragment, null
      , React.createElement('style', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9616}}, `
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `)

      , renderView()
      , rememberLoginPrompt && (
        React.createElement('div', { className: "fixed inset-0 z-[100] bg-slate-950/60 flex items-center justify-center p-4"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9624}}
          , React.createElement('div', { role: "dialog", 'aria-modal': "true", 'aria-label': "Giriş bilgilerimi hatırla"  , className: "max-w-md w-full bg-white rounded-2xl p-6 shadow-xl space-y-4"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9625}}
            , React.createElement('h2', { className: "text-xl font-black text-slate-900"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9626}}, "Bu cihazda GM özel kodunuzu hatırlayalım mı?"      )
            , React.createElement('p', { className: "text-sm text-slate-600" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9627}}, "Yalnızca GM özel kodunuz bu tarayıcıda kaydedilir. 8 haneli şifreniz uygulamaya kaydedilmez; şifrenizi hatırlamak isterseniz tarayıcınızın güvenli şifre yöneticisini kullanın. Ortak cihazlarda kaydetmeyin."                      )
            , React.createElement('div', { className: "flex flex-wrap gap-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9628}}
              , React.createElement('button', { type: "button", onClick: () => {
                try { localStorage.setItem('sgm_login_remember_choice_v1', 'yes'); localStorage.setItem('sgm_remembered_login_code_v1', rememberLoginPrompt.specialCode); } catch (e29) {}
                setRememberedLoginCode(rememberLoginPrompt.specialCode); setRememberLoginPrompt(null);
              }, className: "flex-1 rounded-xl bg-blue-600 text-white font-bold px-4 py-3"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9629}}, "GM Kodumu Hatırla"  )
              , React.createElement('button', { type: "button", onClick: () => { try { localStorage.setItem('sgm_login_remember_choice_v1', 'no'); } catch (e30) {} setRememberLoginPrompt(null); }, className: "flex-1 rounded-xl bg-slate-100 text-slate-700 font-bold px-4 py-3"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9633}}, "Şimdi Değil" )
            )
          )
        )
      )
      , React.createElement('div', { title: `Derleme: ${BUILD_COMMIT}`, className: "fixed bottom-1 right-2 z-10 text-[10px] text-slate-400 pointer-events-none"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9638}}, "Son Güncelleme: 18.11.2026 · Sürüm "     , APP_VERSION)

      , React.createElement(ScannerModal, { 
        isOpen: scannerConfig.isOpen, 
        title: scannerConfig.title,
        onClose: () => setScannerConfig({ isOpen: false, mode: null }),
        autoSubmit: scannerConfig.mode === 'verify',
        onScan: (qrData) => {
          if (scannerConfig.mode === 'claim') claimDesk(qrData);
          else if (scannerConfig.mode === 'verify') handleVerifyImHere(qrData);
          else if (scannerConfig.mode === 'return_break') returnFromBreak(qrData);
          else if (scannerConfig.mode === 'report') handleReportScan(qrData);
          else if (scannerConfig.mode === 'admin_query') handleAdminQueryScan(qrData);
        }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 9640}} 
      )

      , React.createElement(Modal, { isOpen: modal.isOpen, onClose: modal.onClose, title: modal.title, type: modal.type, __self: this, __source: {fileName: _jsxFileName, lineNumber: 9654}}
        /* Masa kontrol içeriği yalnızca gerçek masa-kontrol modali açıkken gösterilir.
            Mesaj gibi alt modaller modal.content taşıdığı için artık masa kontrol ekranı
            bu formların üstünü ezmez. Böylece PC ve telefonda aynı akış çalışır. */
        , adminUserEditId && modal.content == null ? (
           renderAdminUserEditorContent(adminUserEditId)
        ) : liveDeskId && adminTab === 'desks' && modal.content == null ? (
           renderAdminDeskContent(liveDeskId)
        ) : (
           typeof modal.content === 'string' ? (
             React.createElement('div', { className: "space-y-6", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9664}}
               , React.createElement('p', { className: "text-slate-600 text-[15px] whitespace-pre-wrap"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9665}}, modal.content)
               , React.createElement('button', { onClick: closeMessage, className: "w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-900 transition-colors"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9666}}, "Tamam")
             )
           ) : modal.content
        )
      )

      , React.createElement(Modal, { isOpen: showRules, onClose: () => setShowRules(false), title: "Kütüphane Kullanım Kuralları"  , type: "info", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9672}}
        , React.createElement('div', { className: "space-y-4 text-sm text-slate-700 pb-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9673}}
          , React.createElement('div', { className: "text-center", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9674}}
            , React.createElement('h2', { className: "font-black text-xl text-slate-900"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9675}}, "SARIÇAM GENÇLİK MERKEZİ"  )
            , React.createElement('p', { className: "text-slate-500 mt-1 font-medium"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9676}}, "Kütüphane Kullanım Kuralları"  )
          )
          , React.createElement('div', { className: "space-y-3 pt-3" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9678}}
            , [
              React.createElement(React.Fragment, null, "Kütüphane kullanım saatleri "   , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9680}}, "07.00 - 22.00"  ), " arasındadır." ),
              React.createElement(React.Fragment, null, "Kütüphaneyi kullanacak öğrencilerin sisteme kayıtlı olması gerekmektedir."      ),
              React.createElement(React.Fragment, null, "Her öğrenci aynı anda yalnızca "     , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9682}}, "bir masa" ), " kullanabilir." ),
              React.createElement(React.Fragment, null, "Masa kullanımını başlatmak için masada bulunan "      , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9683}}, "QR kodun okutulması"  ), " zorunludur." ),
              React.createElement(React.Fragment, null, "Mola süresince masa kullanıcı adına ayrılmış olarak kalır."       ),
              React.createElement(React.Fragment, null, "Moladan erken dönmek isteyen kullanıcı, kendi masasındaki "       , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9685}}, "QR kodu yeniden okutmalıdır."   )),
              React.createElement(React.Fragment, null, "Mola süresi dolduğu halde masaya dönmeyen kullanıcıların masa oturumu sistem tarafından sonlandırılabilir ve kural ihlali uygulanabilir."               ),
              React.createElement(React.Fragment, null, "Boş bırakıldığı düşünülen masalar sistem üzerinden ihbar edilebilir."       ),
              React.createElement(React.Fragment, null, "Masa sahibi ihbar aldıktan sonra belirtilen süre içerisinde kendi masasındaki QR kodu okutarak masada olduğunu doğrulamalıdır."               ),
              React.createElement(React.Fragment, null, "Asılsız ihbar, başka öğrencilerin kullanımını engelleme ve sistemin kötüye kullanılması yasaktır."          ),
              React.createElement(React.Fragment, null, "Kurallara uymayan kullanıcıların erişimi yönetici tarafından geçici veya sürekli olarak kısıtlanabilir. Kısıtlı hesaplar "             , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9690}}, "masa seçemez, boş masa ihbarı ve dilek / şikayet gönderemez."         )),
              React.createElement(React.Fragment, null, "Kütüphaneden ayrılırken kullanılan masanın sistem üzerinden bırakılması gerekmektedir. Masayı bıraktıktan sonra "           , React.createElement('b', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9691}}, "30 dakika" ), " boyunca yeniden masa alınamaz. Sistem hatasında yönetici masa atayabilir."         )
            ].map((rule, index) => {
              const danger = index === 9 || index === 10;
              return (
                React.createElement('div', { key: index, className: `flex gap-3 p-3 border rounded-xl ${danger ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 9695}}
                  , React.createElement('span', { className: `font-black ${danger ? 'text-red-600' : 'text-blue-600'}`, __self: this, __source: {fileName: _jsxFileName, lineNumber: 9696}}, index + 1, ".")
                  , React.createElement('p', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9697}}, rule)
                )
              );
            })
          )
          , React.createElement('div', { className: "mt-5 border-t border-slate-200 pt-4"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9702}}
            , React.createElement('p', { className: "font-bold text-center italic text-slate-700"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9703}}, "Kütüphaneyi kullanan herkes bu kurallara uymayı kabul etmiş sayılır."

            )
          )
        )
        , React.createElement('button', { onClick: () => {setShowRules(false);setRegistrationRulesOpen(false);}, className: "w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-colors"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9708}}
          , registrationRulesOpen ? 'Kapat' : 'Okudum, Anladım'
        )
        , registrationRulesOpen && React.createElement('div', { className: "mt-3 space-y-3" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9711}}, React.createElement('label', { className: "flex gap-2" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9711}}, React.createElement('input', { type: "checkbox", checked: registrationAccepted, onChange: e=>setRegistrationAccepted(e.target.checked), __self: this, __source: {fileName: _jsxFileName, lineNumber: 9711}}), " Kütüphane kurallarını okudum ve kabul ediyorum."      ), React.createElement('button', { disabled: !registrationAccepted || registrationBusy, onClick: startRegistration, className: "w-full py-3 bg-green-600 disabled:opacity-40 text-white rounded-xl font-bold"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9711}}, registrationBusy?'Hesap Oluşturuluyor…':'Kuralları Onayla ve Hesabımı Oluştur'), registrationError && React.createElement('p', { className: "text-red-700", __self: this, __source: {fileName: _jsxFileName, lineNumber: 9711}}, registrationError))

      )
    )
  );
}

export default function App() {
  return (
    React.createElement(ErrorBoundary, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9720}}
      , React.createElement(MainApp, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 9721}} )
    )
  );
}
