# Sarıçam GM | Tek Tarayıcı – Tek Yeni Kayıt Düzeltmesi (22.11.2026)

## Ne düzeltildi?

Önceki sürümde `VITE_SGM_NEW_REGISTRATION_GUARD_ENABLED` ve `SGM_NEW_REGISTRATION_GUARD_ENABLED` varsayılan olarak `false` olduğu için, öğrenci **Kayıt Ol** ekranını tekrar açabiliyor, önceki kayıt işareti de belirli bir akışta silinebiliyordu. İkinci bir anonim Firebase kimliği alınırsa sistem tekrar 8 haneli kod oluşturabiliyordu.

Bu sürümde:

1. **Her yeni öğrenci kaydı için**, Google doğrulama modu açık olmasa da tarayıcıda rastgele oluşturulan `sgm_device_binding_secret_v2` zorunludur. Sunucu sadece bunun SHA-256 özetini `sgmDeviceBindings` koleksiyonuna yazar. Aynı tarayıcı anahtarıyla **ikinci bir hesap ve yeni GM Özel Kod** oluşturma isteği Firestore transaction içinde reddedilir.
2. **Kayıt Ol** düğmesi aynı tarayıcıda kayıt işareti varsa kayıt kurallarını tekrar açmaz; mevcut GM Özel Kod/şifreyle giriş mesajı gösterir. Kayıt tamamlanınca `sgm_registration_device_lock_v1` işareti oluşturulur. Eski `sgm_registration_account` işareti bulunan cihazlar da tanınır. Yeni bir kayıt başlatmak için eski kayıt işareti artık silinmez.
3. Yeni kayıtlar `registrationDeviceGuardVersion: 1` ile işaretlenir. **Eski öğrencilerin belgelerine hiçbir alan yazılmaz.** Yalnızca isteğe bağlı Google doğrulaması açılırsa yeni hesaplarda önceden eklenmiş `registrationSecurityVersion: 2` akışı çalışır.
4. Form daha önce **doğrulandıysa** uygulamanın `Google Form’a Devam Et` butonu formu tekrar açmaz. Sunucudaki durum her yönlendirmede kontrol edilir. Form **henüz gönderilmediyse** erişimi kaybetmemek için aynı öğrencinin **aynı formu yeniden açması** mümkündür; bu işlem yeni hesap veya kod üretmez.
5. Yeni sürümde oluşturulmuş v1 ve v2 hesapların ikinci Google Form yanıtı yeni doğrulama / kod takip Sheet satırı oluşturmaz. Eski öğrencilerin mevcut doğrulama işleyişi değiştirilmez.

## Mutlaka yapmanız gereken Google Form ayarları

**Google Formları → Ayarlar → Yanıtlar** bölümünde **E-posta adreslerini topla: Doğrulanmış** ve **1 yanıtla sınırlandır** ayarlarını açın. Kullanıcı Google hesabıyla oturum açmalıdır. Bu ayar aynı **Google hesabının** ikinci form yanıtı vermesini engeller, **aynı fiziksel cihazın farklı Google hesaplarıyla formu açmasını** engellemez.

**Önemli:** Genel bir `forms.gle` veya Google Forms adresini herkes doğrudan açabilir. Yalnızca React veya Apps Script koduyla bu herkese açık formun *görüntülenmesini* cihaz bazında yasaklayamazsınız. Bu pakette ikinci hesap ve tekrar formun sisteme işlenmesi engellenir. Linki açmanın da kimlik temelinde zorunlu kontrolü için herkese açık Google Form yerine giriş gerektiren **kendi uygulamanızdaki kayıt formu** gerekir.

## Yayına alma (önce test ortamında)

1. Mevcut **Firestore verilerinin yedeğini** alın. Bu ZIP eski öğrenci, GM Özel Kod, PIN, masa, mola, ceza, lider veya QR belgelerini silmez, taşımaz ve güncellemez.
2. Yeni ZIP'deki proje dosyalarını kurun, mevcut Firebase/Vercel gizli ortam değişkenlerinizi güvenli şekilde koruyun. Eski ZIP yerine **bu yeni sürümü Vercel'e dağıtın**; yalnızca Google Form'da ayar değiştirmeniz, uygulamadaki ikinci hesap açma hatasını tek başına düzeltmez.
3. ZIP'deki `firestore.rules` kurallarını test ederek yayınlayın. `sgmDeviceBindings` istemciden kapalıdır; yalnızca sunucudaki Admin SDK erişir.
4. Google doğrulama + cihaz değişikliği için daha güçlü v2 modu **ayrıca isterseniz**, Firebase Authentication'da Google sağlayıcısını etkinleştirin; Google Form doğrulanmış e-posta toplasın ve Vercel'in **hem sunucu hem istemci** ortam değişkenlerini birlikte `true` yapın:

   ```env
   VITE_SGM_NEW_REGISTRATION_GUARD_ENABLED=true
   SGM_NEW_REGISTRATION_GUARD_ENABLED=true
   ```

   **v1 cihazda ikinci yeni kayıt engeli bu ayarlar `false` iken de çalışır.** v2 aktif edilirse daha önce oluşturulan v1 hesaplar otomatik yükseltilmez.
5. İlk defa kayıt yapan öğrenciyle iki kere **Kayıt Ol** deneyin. İlkinde tek kod oluşmalı, ikincisinde uyarı görünmeli. Aynı tarayıcıda farklı Firebase UID ile yeni kayıt API isteği de `409 device_already_registered` dönmeli. Ardından eski iki öğrencinin girişini, masa QR ve mola işlemlerini test edin.
6. Google Apps Script'teki `onMainFormSubmit` tetikleyicisi ve webhook bağlantısı güncel olmalı; form yanıtından alınan GM Özel Kod sunucuda kontrol edilmeli.

## Gerçek güvenlik sınırı

Tarayıcı tabanlı uygulamada **fiziksel telefonun değiştirilemez bir kimliği yoktur**. Tarayıcı verilerini silmek, farklı tarayıcı veya gizli mod kullanmak yeni bir tarayıcı anahtarı oluşturabilir. Bu yüzden **%100 fiziksel cihaz engeli garanti edilemez**. Aynı gerçek kişinin farklı e-posta ve cihazlarla tekrar kayıt olmaması için lider doğrulaması / güvenli tekil kimlik eşleştirmesi ayrıca gerekir. Var olan öğrencilerin cihazlarını topluca kilitlemediğimiz için eski kullanıcılar üzerinden tam mükerrer kayıt denetimi otomatik olarak kurulmuş değildir.

## Test ve dürüst durum

- Yeni tek-cihaz/tek-kayıt testleri, v2 güvenlik testleri, form tekrarı ve kayıt testleri: **21/21 geçti**.
- Bütün proje testleri, JSX yükleyiciyle: **167/170 geçti**; başarısız olan 3 `tests/morning-safety.test.js` testi eski sürümden beri var ve bu değişiklikle ilgili değil.
- Vite üretim derlemesi bu çalışma ortamındaki node_modules içinde gerekli **Linux Rollup native modülü bulunmadığı** için tamamlanamadı. Ortamda yalnızca Windows derleme modülleri var. Bu bir kod derleme onayı değildir; gerçek Linux ortamında `npm ci` + `npm run build` ile kontrol edin.
- Canlı Firebase / Google Form / Vercel testi burada yapılmadı. Yayından önce test projesinde kontrol edin.

## Değişen temel dosyalar

- `api/student-register.js` — yeni kayıtta her zaman benzersiz cihaz eşleştirmesi
- `server/registration-security.js` — yalnızca yeni kayıtlar için anahtar doğrulaması
- `server/student-registration.js` — v1 cihaz kilidi alanı; eski hesaplar değişmiyor
- `server/form-verification.js` — yeni v1/v2 öğrenciler için ikinci form işlemini yok sayma
- `kutuphaneprogramıguncell.jsx` — kayıt düğmesi/işaretinin silinmemesi ve form durumu kontrolü
- `tests/single-device-registration.test.js` — koruma testleri
