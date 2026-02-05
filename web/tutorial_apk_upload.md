# Android APK – Upload & Update via GitHub Releases

Questo documento spiega come caricare e aggiornare l’APK Android dell’app usando **GitHub Releases**, mantenendo **un link di download sempre uguale**.

---

## 📦 Caricamento iniziale dell’APK

1. Apri la repository GitHub del progetto  
2. Vai su **Releases**
3. Clicca **New release**

### Compila la release:
- **Tag version:**  

`android-latest`

- **Target:** `main`
- **Release title:**  

- **Pre-release:** ❌ NON selezionare

4. Carica il file APK con **nome fisso**:

`WellnessCoach.apk`

5. Clicca **Publish release**

---

## 🔗 Link di download diretto

Usa sempre questo link (non cambia mai):

`https://github.com/alessandro-lagamba/wellness-coach-releases/releases/download/android-latest/WellnessCoach.apk`

Può essere usato su:
- sito web
- QR code
- link diretto per installazione

---

## 🔄 Aggiornare l’APK (nuova versione)

1. Vai su **Releases**
2. Apri **Android – Latest build**
3. Clicca **Edit**
4. Elimina il vecchio `WellnessCoach.apk`
5. Carica il nuovo `WellnessCoach.apk`
6. Salva

➡️ Il link resta **identico**, l’APK viene aggiornato.

---

## ✅ Note importanti
- Mantieni **sempre**:
  - stesso tag: `android-latest`
  - stesso nome file: `WellnessCoach.apk`
- Non usare Google Drive o Supabase per file >100MB
- GitHub Releases è gratuito e affidabile

---