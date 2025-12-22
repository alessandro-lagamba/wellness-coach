# Creazione Bucket "food-images" in Supabase Storage

## Istruzioni per creare il bucket manualmente

Il bucket `food-images` deve essere creato manualmente tramite il dashboard di Supabase perché i bucket di storage non possono essere creati direttamente tramite SQL.

### Passaggi:

1. Vai su [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleziona il progetto: `alessandro.lagamba@labellapartners.com's Project`
3. Vai su **Storage** nel menu laterale
4. Clicca su **"New bucket"** o **"Create bucket"**
5. Configura il bucket:
   - **Name**: `food-images`
   - **Public**: ✅ **true** (importante per permettere accesso pubblico alle immagini)
   - **File size limit**: `10485760` (10MB) o più se necessario
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp`

6. Clicca su **"Create bucket"**

### Note:

- Le policy RLS sono già state create tramite la migration `create_food_images_storage_policies`
- Il bucket deve essere pubblico per permettere l'accesso alle immagini tramite URL pubblico
- Le immagini vengono organizzate per utente: `{user_id}/{timestamp}-{randomId}.{ext}`

### Verifica:

Dopo aver creato il bucket, verifica che funzioni provando a caricare un'immagine tramite l'app.






