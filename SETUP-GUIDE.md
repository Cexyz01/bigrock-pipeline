# BigRock Studios — Production Pipeline
# Guida Setup Completa

---

## Panoramica

L'app è composta da:
- **Frontend**: React + Vite (hostato su Vercel, gratis)
- **Backend + Database**: Supabase (gratis fino a 500MB, auth Google inclusa)
- **Storyboard**: Miro embeddato nell'app
- **Accesso**: Login Google, solo email @bigrock.it

---

## STEP 1 — Crea il progetto Supabase

1. Vai su **https://supabase.com** e registrati (puoi usare il tuo account GitHub o Google)
2. Clicca **"New Project"**
3. Compila:
   - **Name**: `bigrock-pipeline`
   - **Database Password**: scegli una password sicura (salvala!)
   - **Region**: `West EU (Ireland)` — la più vicina all'Italia
4. Aspetta 1-2 minuti che il progetto sia pronto

### Salva le credenziali

Nella dashboard del progetto vai su **Settings → API** e copia:
- **Project URL** → es. `https://abcdefgh.supabase.co`
- **anon/public key** → la chiave lunga che inizia con `eyJ...`

Ti serviranno dopo nel file `.env`.

---

## STEP 2 — Crea il Database

1. Nella dashboard Supabase vai su **SQL Editor** (icona nel menu a sinistra)
2. Clicca **"New Query"**
3. Apri il file `supabase/schema.sql` del progetto
4. **Copia-incolla TUTTO il contenuto** nell'editor SQL
5. Clicca **"Run"** (o Ctrl+Enter)
6. Dovresti vedere "Success. No rows returned" — è tutto ok

### Verifica

Vai su **Table Editor** (icona nel menu). Dovresti vedere le tabelle:
- profiles
- shots
- tasks
- comments
- calendar_events
- notifications

---

## STEP 3 — Configura l'Autenticazione Google

### 3a. Crea credenziali Google OAuth

1. Vai su **https://console.cloud.google.com**
2. Crea un nuovo progetto (o usa uno esistente)
3. Vai su **APIs & Services → Credentials**
4. Clicca **"Create Credentials" → "OAuth client ID"**
5. Se ti chiede di configurare la "consent screen":
   - User type: **External** (poi puoi limitare agli utenti @bigrock.it)
   - App name: `BigRock Pipeline`
   - Support email: la tua
   - Authorized domains: aggiungi `supabase.co`
   - Salva
6. Torna su **Credentials → Create OAuth client ID**:
   - Application type: **Web application**
   - Name: `BigRock Pipeline`
   - Authorized redirect URIs: aggiungi:
     ```
     https://TUOPROGETTO.supabase.co/auth/v1/callback
     ```
     (sostituisci TUOPROGETTO con il tuo project ID di Supabase)
7. Clicca **Create**
8. **Copia Client ID e Client Secret**

### 3b. Configura Google in Supabase

1. Nella dashboard Supabase vai su **Authentication → Providers**
2. Trova **Google** e abilitalo
3. Incolla il **Client ID** e **Client Secret** copiati prima
4. **Authorized Client IDs**: incolla di nuovo il Client ID
5. Salva

### 3c. Limita al dominio @bigrock.it

Nella dashboard Supabase vai su **Authentication → Settings**:
- Scorri fino a **"Restrict email domain"** (o simile)
- Se non c'è una opzione esplicita, il controllo è già fatto nel codice dell'app tramite il parametro `hd: 'bigrock.it'` nella chiamata OAuth

---

## STEP 4 — Crea lo Storage per le immagini

1. Nella dashboard Supabase vai su **Storage**
2. Clicca **"New Bucket"**
3. Nome: `shot-concepts`
4. Spunta **"Public bucket"**
5. Crea
6. Vai nelle **Policies** del bucket e aggiungi:
   - **SELECT**: `true` (tutti possono vedere)
   - **INSERT**: `(auth.role() = 'authenticated')` (solo utenti loggati)

---

## STEP 5 — Abilita il Realtime

1. Nella dashboard Supabase vai su **Database → Replication**
2. Nella sezione "Tables" abilita il realtime per:
   - ✅ `shots`
   - ✅ `tasks`
   - ✅ `comments`
   - ✅ `notifications`

---

## STEP 6 — Configura Miro

1. Vai su **https://miro.com** e apri (o crea) la board del progetto
2. L'URL della board sarà tipo: `https://miro.com/app/board/uXjV...=`
3. Il **Board ID** è la parte dopo `/board/` → es. `uXjVNabc123=`
4. Per abilitare l'embed:
   - Nella board clicca **Share → Link settings**
   - Assicurati che "Anyone with the link can view" sia attivo
5. (Opzionale) Per l'API Miro:
   - Vai su **https://miro.com/app-settings/**
   - Crea una nuova app
   - Copia l'**Access Token**

---

## STEP 7 — Setup Locale del Progetto

### Prerequisiti

Devi avere installato:
- **Node.js** (versione 18 o superiore) → https://nodejs.org
- **Git** → https://git-scm.com

### Comandi

Apri il terminale nella cartella del progetto:

```bash
# Installa le dipendenze
npm install

# Crea il file .env
cp .env.example .env
```

### Modifica il file `.env`

Apri `.env` con un editor di testo e inserisci i valori:

```
VITE_SUPABASE_URL=https://TUOPROGETTO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
VITE_MIRO_BOARD_ID=uXjVNabc123=
VITE_MIRO_ACCESS_TOKEN=il-tuo-token-miro
```

### Testa in locale

```bash
npm run dev
```

Apri **http://localhost:5173** nel browser. Dovresti vedere la pagina di login.

---

## STEP 8 — Deploy su Vercel (Produzione)

### 8a. Carica su GitHub

```bash
# Inizializza git
git init
git add .
git commit -m "Initial commit"

# Crea un repo su GitHub (bigrock-pipeline) e poi:
git remote add origin https://github.com/TUO-USERNAME/bigrock-pipeline.git
git push -u origin main
```

### 8b. Connetti Vercel

1. Vai su **https://vercel.com** e registrati con GitHub
2. Clicca **"Add New Project"**
3. Importa il repo `bigrock-pipeline`
4. Nella sezione **Environment Variables** aggiungi:
   - `VITE_SUPABASE_URL` → il tuo URL Supabase
   - `VITE_SUPABASE_ANON_KEY` → la tua anon key
   - `VITE_MIRO_BOARD_ID` → il board ID di Miro
   - `VITE_MIRO_ACCESS_TOKEN` → il token Miro
5. Clicca **Deploy**
6. Dopo 1-2 minuti avrai l'URL tipo: `https://bigrock-pipeline.vercel.app`

### 8c. Aggiorna il Redirect URL di Google

Torna su **Google Cloud Console → Credentials → Il tuo OAuth client** e aggiungi come Authorized JavaScript Origins:
```
https://bigrock-pipeline.vercel.app
```
(o il dominio che Vercel ti ha dato)

### 8d. Aggiorna Supabase

Nella dashboard Supabase vai su **Authentication → URL Configuration**:
- **Site URL**: `https://bigrock-pipeline.vercel.app`
- **Redirect URLs**: aggiungi `https://bigrock-pipeline.vercel.app`

---

## STEP 9 — Primo Accesso e Setup Admin

1. Vai sull'URL dell'app
2. Fai login con la tua email @bigrock.it
3. Il sistema ti crea automaticamente un profilo con ruolo "studente"
4. **Per renderti Admin**, vai su Supabase → **Table Editor → profiles**
5. Trova la tua riga e cambia il campo `role` da `studente` a `admin`
6. Ricarica l'app — ora sei admin

### Assegnare i ruoli

Da admin, nella sezione **Crew** dell'app puoi:
- Cliccare "Edit" su qualsiasi membro
- Cambiare il ruolo (admin, docente, coordinatore, studente)
- Assegnare il dipartimento agli studenti

---

## STEP 10 — Uso Quotidiano

### Per i docenti:
- **Shot Tracker**: clicca le celle per aggiornare lo stato per dipartimento
- **Tasks**: crea task, assegnali agli studenti, approva o rimanda indietro
- **Calendar**: aggiungi eventi e milestone
- **Storyboard**: la board Miro è embeddata, modificala direttamente

### Per gli studenti:
- **Tasks**: vedono solo i propri task, possono premere "Start Working" e poi "Submit for Review"
- **Comments**: possono commentare sotto i propri task
- **Storyboard**: vedono la board Miro, possono postare WIP direttamente lì
- **Shot Tracker / Calendar**: visione in sola lettura

---

## Struttura del Progetto

```
bigrock-pipeline/
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
├── .env.example
├── .gitignore
├── supabase/
│   └── schema.sql          ← SQL per creare tutte le tabelle
└── src/
    ├── main.jsx             ← Entry point
    ├── index.css            ← Stili globali
    ├── App.jsx              ← Tutta l'app (pagine + componenti)
    └── lib/
        └── supabase.js      ← Client Supabase + tutte le query
```

---

## Troubleshooting

**"Login non funziona"**
→ Controlla che il redirect URL in Google Cloud Console e in Supabase corrisponda esattamente all'URL dell'app

**"Tabelle vuote dopo il login"**
→ Verifica che lo schema SQL sia stato eseguito senza errori. Controlla nella SQL Editor

**"Miro non si vede"**
→ Controlla che il VITE_MIRO_BOARD_ID sia corretto e che la board sia condivisa con "Anyone with the link"

**"Non riesco a modificare nulla"**
→ Il tuo ruolo è probabilmente "studente". Cambialo da Supabase Table Editor come descritto nello Step 9

**"Le notifiche non arrivano in tempo reale"**
→ Verifica che il Realtime sia abilitato per le tabelle giuste (Step 5)

---

## Costi

Tutto gratis per il tuo utilizzo:

| Servizio | Piano | Limiti |
|----------|-------|--------|
| Vercel | Free | 100GB bandwidth/mese |
| Supabase | Free | 500MB DB, 1GB storage, 50k auth users |
| Miro | Free (Education) | Board illimitate per education |
| Google OAuth | Free | Illimitato |

Per 35 studenti + qualche prof sei abbondantemente nei limiti free.
