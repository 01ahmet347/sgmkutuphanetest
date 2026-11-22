# Sarıçam GM — Yeni Kayıt Güvenliği (22.11.2026)

**Sonraki güncelleme:** Tek tarayıcıdan birden fazla yeni hesap açılmasını önleyen v1 koruması artık varsayılan olarak aktiftir. Ayrıntılar: `TEK_CIHAZ_TEK_KAYIT_22_11_2026.md`. Aşağıdaki Google/e-posta ile cihaz geçişi açıklamaları isteğe bağlı **v2** güvenlik modu içindir.


## Korumalı kurulum: Önce test, sonra açılış

Bu güncelleme **var olan öğrenci kayıtlarını topluca dönüştürmez**. Eski `sgmUsers` belgelerinde `registrationSecurityVersion` alanı yoktur ve yeni e-posta/cihaz kısıtı **uygulanmaz**. Mevcut GM Özel Kod, sekiz haneli şifre, masa, mola, ihlal, onay, QR ve kapanış verileri değiştirilmez. Mevcut girişte kod ve şifre kullanılmaya devam edilir. Var olan Firebase verisi bu paketin içinde değildir, veri taşınmaz ve toplu silinmez.

**Bu proje tek başına Firebase üzerinde bir değişiklik yapmaz.** Üretimde kullanmadan önce Firebase/Firestore yedeği alın, ayrı test ortamı oluşturun ve aşağıdaki hazırlıkları tamamlayın. Eski `.env.local` güvenlik nedeniyle bu dağıtım ZIP'ine konulmadı; kendi ortam ayarlarınızı daha önceki kurulumunuzdan aktarın (gizli anahtarları ZIP'e koymayın).

### 1. Kurulum önkoşulları

1. Firebase Authentication konsolunda **Google** giriş sağlayıcısını etkinleştirin, üretim ve test alan adlarını **Authorized domains** listesine ekleyin. *Kayıt için Google ile doğrulanmış e-posta* kullanılır (herhangi bir e-posta/OTP yöntemi değil). Google hesabı olmayanlar için ayrı doğrulama yöntemi henüz hazırlanmadı.
2. Ana Google Form'da **doğrulanmış e-posta adreslerini topla** ayarını açın. Google hesabı ile cevap verilmesini sağlayın; mümkünse **1 yanıtla sınırlandır** ayarını açın. Google Form içindeki GM Özel Kod sorusunun ismi mevcut betikle aynı olmalı.
3. `google-apps-script/gm-kod-aktarimi.gs` dosyasının güncel sürümünü bağlı Apps Script projesine yerleştirin; tetikleyici ve Script Properties korunmalı. Eski form yanıtları veya eski hesaplar için e-postasız imza geriye uyumludur. **Yeni kayıt** e-postası ise imzada bulunmalı ve Firebase'de doğrulanan e-postayla aynı olmalı.
4. Güncel `firestore.rules` kurallarını test edin ve devreye alın. `sgmEmailBindings`, `sgmDeviceBindings`, `sgmDeviceChangeRequests` koleksiyonlarına istemciden doğrudan erişim yasaktır; bunları yalnızca Admin SDK kullanır.
5. Vercel test ortamında yeni değişkenleri aşağıdaki gibi **ikisini birlikte** tanımlayın:

```env
VITE_SGM_NEW_REGISTRATION_GUARD_ENABLED=true
SGM_NEW_REGISTRATION_GUARD_ENABLED=true
```

İki değişkenin başlangıç değeri **false**; bu sadece ek Google/e-posta v2 modunu kapalı tutar. Yeni v1 hesaplar için **sunucudaki tek tarayıcı anahtarı / tek yeni kayıt** denetimi `false` iken bile etkindir. `VITE_` ile başlayan değişken istemci derleme zamanında gömülür: değiştirdikten sonra yeniden dağıtım gerekir.

### 2. Yeni öğrenci akışı

- Öğrenci kayıt kurallarını kabul eder; Google hesabını seçer. Firebase anonim oturum, `linkWithPopup` ile doğrulanmış Google girişine dönüştürülür; **UID korunur**. Başka Firebase kullanıcısına bağlı Google hesabı yeni hesap yaratamaz.
- Tarayıcı kriptografik rastgele bir 256 bit `sgm_device_binding_secret_v2` üretir ve yerel depoda saklar. Bu **cihaz donanım kimliği değildir**; tarayıcı kurulumu anahtarıdır. Silinirse lider onayı gerekir.
- Sunucu Firebase ID token'ını doğrular; `email_verified === true`, `google.com` sağlayıcısı ve geçerli e-posta gerektirir.
- Firestore transaction içinde `sgmEmailBindings` (normalize e-postanın SHA-256 özeti), `sgmDeviceBindings` (cihaz gizli anahtarının SHA-256 özeti), `sgmAuthCodes`, `sgmUsers` oluşturulur. Aynı e-posta / aynı cihaz anahtarı / aynı GM kodu ikinci yeni hesap için kullanılamaz.
- Yeni kullanıcı belge alanları `registrationSecurityVersion: 2`, `registrationEmail`, `registrationEmailHash`, `deviceBindingHash` olarak oluşturulur. **Eski kullanıcılarda yoktur ve eklenmez.**
- Ana Form'dan imzalı webhook ile gelen doğrulanmış e-posta kullanıcı hesabıyla eşleştirilir. Yeni kullanıcının ikinci form yanıtı yeni doğrulama kaydı veya Sheet satırı eklemez. Önceki kullanıcıların form işleyişi geriye uyumludur.
- Kullanıcı GM Özel Kod ve şifreyle giriş yapar. `version: 2` hesabı ancak bağlı cihaz anahtarını sunarsa giriş ve masa/öğrenci API'leri kullanılabilir. Aynı anda tek masa denetimi mevcut sistemdeki gibi devam eder.

### 3. Cihaz değişikliği

1. Yeni `version: 2` öğrenci farklı bir tarayıcı/telefon üzerinden GM Özel Kod ve şifre girer.
2. Giriş engellenir ve o **belirli yeni cihaz anahtarı** için lider paneline `pending` talebi oluşur. Kod ve şifre doğru değilse talep oluşturulmaz.
3. Lider öğrencinin kimliğini **yüz yüze** kontrol eder. `Cihaz Değişikliği Talepleri` içinden talebi onaylar veya reddeder. İşlem `sgmLeaderAudit` kaydına girer.
4. Onaydan itibaren 30 dakika içinde öğrenci **aynı yeni cihazdan** tekrar giriş yapar. Eski cihaz bağlantısı transaction içinde kaldırılır; yeni cihaz bağlanır. GM Özel Kod, şifre, cezalar ve masa kaydı **değiştirilmez**.
5. Eski cihazın yeni masa/öğrenci işlemleri sunucuda reddedilir. Eski cihazın açık oturumundaki bazı sadece-okunur Firebase verilerini hemen yok etmek için ayrıca Firebase oturum iptali/kurallar değerlendirmesi gereklidir. Cihaz değişikliğinin aktif masası olan öğrencilerde denenmesi ayrıca test edilmelidir.

**Ayrı tutulan akış:** Yönetici panelinden elle oluşturulan öğrencilerde Google doğrulaması olmadığı için `api/admin-student-create.js` akışı ve eski hesap şeması değiştirilmedi. Bu elle eklenen yeni hesaplar v2 cihaz/e-posta kilidine tabi değildir; tüm yeni hesapların kapsanması istenirse yönetici kayıt prosedürü ayrıca tasarlanmalıdır.

**Sınırlar:** Normal web uygulaması fiziksel telefonu değiştirilemez kimlikle tanıyamaz. Aynı cihazda tarayıcı verilerini silmek veya farklı tarayıcı profili kullanmak yeni bir cihaz anahtarı oluşturur. Güçlü cihaz eşleştirmesi, fiziksel cihazı her koşulda benzersiz tanıma garantisi değildir. E-posta benzersizliği, farklı doğrulanmış Google e-postalarıyla aynı gerçek kişinin hesap açmasını tek başına engellemez. Liderin kimlik doğrulaması gerekir. Eski hesapları otomatik olarak eşleştirmediğimiz için daha önce kayıtlı bir öğrenci yeni bir Google e-postasıyla tekrar kayıt başlatabilir; eski öğrencilere dokunmamanın doğal sınırıdır.

### 4. Önerilen test listesi (ayrı Firebase projesinde)

- Önceden kayıtlı iki öğrenci, mevcut 8 haneli GM kod ve şifreleriyle eski telefonlarından giriş yapar; masa/mola/QR işlemleri değişmeden çalışır.
- Yeni Google hesabı ile kayıt, 8 haneli kod/şifre, lider sırası ve ana Form doğrulaması çalışır; yanlış e-posta Form doğrulaması reddedilir.
- Aynı Google e-posta veya aynı tarayıcı anahtarıyla yeni hesap reddedilir; yanlış GM kod/şifreyle cihaz değişim talebi açılamaz.
- Yanlış cihazla giriş bloklanır; lider onayından önce erişim yoktur; sadece onaylanan cihaz giriş yapar; eski cihaz masa API'sine erişemez.
- Form ikinci kez gönderildiğinde yeni Sheets satırı açılmaz. Eski hesapların formu varsa kontrolü de sürer.
- Mobil Chrome, iPhone Safari ve PWA'da açılır pencere izni ve yerel depolama test edilir. Google giriş popup'ı tarayıcı tarafından engellenebilir; yeni akışta redirect tabanlı mobil yedek giriş **henüz uygulanmadı**.
- Firebase kota, masa 22:00 kapanışı, izinler ve lider audit test edilir.

### 5. Geri dönüş ve dağıtım

- Öncelikle **test ortamı**. Üretime geçiş için mevcut yedeği alın, kontrol listesini tamamlayın, ardından aynı iki ortam değişkenini true yapıp dağıtın.
- Önlem olarak false'a dönüş **yeni kayıt** güvenlik kapısını kapatır. Daha önce oluşturulmuş `registrationSecurityVersion:2` öğrenciler **güvenlik nedeniyle hâlâ bağlı cihazlarından giriş yapmalıdır**; var olan cihaz eşleştirmelerini otomatik düşürmeyin.
- Firestore verilerini sıfırlamayın veya eski hesapları toplu güncellemeyin.

### 6. Otomatik testler

```bash
npm ci
node --experimental-loader ./tests/jsx-loader.mjs --test tests/registration-device-guard.test.js tests/student-registration.test.js tests/student-login.test.js tests/new-form-gate.test.js tests/ui.test.js
```

ZIP'in orijinalinde **testten önce de hatalı olan** üç `tests/morning-safety.test.js` testi var. Bunların yeni cihaz güvenliğinden kaynaklanmadığı, orijinal `server/student-desk.js` ile yeniden denenerek doğrulandı. Bu sorunları hesap güvenliği değişikliklerine karıştırıp mevcut kodu riske atmadık.

**Çevrimiçi/üretim Firebase testleri burada yapılmadı**; sunucu API'leri gerçek Firestore bağlantısı olmadan unit-test stublarıyla sınandı. Başarıyla dağıtıldı şeklinde değerlendirmeyin.
