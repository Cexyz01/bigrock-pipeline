#!/usr/bin/env bash
# Bulk-create student accounts via Supabase Admin API.
# Each row is "email|Full Name". The handle_new_user trigger sets role=studente
# and role_id to the studente role. We pass full_name through user_metadata.

set -e
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkeHBramd3ZGd4eXN6Y2x4eWtmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTg0MDczNSwiZXhwIjoyMDg3NDE2NzM1fQ.Rs7qtd0UHqd-HqxaAlFDoxdavEhTuPzgg8_6lmvydU4"
API="https://qdxpkjgwdgxyszclxykf.supabase.co/auth/v1/admin/users"

ROSTER=$(cat <<'EOF'
alberto.busato@student.bigrock.it|Alberto Busato
pietropaolo.colombo@student.bigrock.it|Pietro Paolo Colombo
leonardo.curcuruto@student.bigrock.it|Leonardo Curcuruto
manuel.gamba@student.bigrock.it|Manuel Gamba
matteo.ghezzi@student.bigrock.it|Matteo Ghezzi
asia.ghiglione@student.bigrock.it|Asia Ghiglione
marta.lenzi@student.bigrock.it|Marta Lenzi
federico.lonigro@student.bigrock.it|Federico Lonigro
federico.malverdi@student.bigrock.it|Federico Malverdi
alfredo.manzo@student.bigrock.it|Alfredo Manzo
sara.marcante@student.bigrock.it|Sara Marcante
tommaso.marra@student.bigrock.it|Tommaso Marra
auroraassunta.matrone@student.bigrock.it|Aurora Assunta Matrone
nicola.pagliarusco@student.bigrock.it|Nicola Pagliarusco
alessandro.partiti@student.bigrock.it|Alessandro Partiti
maria.reverenna@student.bigrock.it|Maria Reverenna
samueledoardo.scola@student.bigrock.it|Samuel Edoardo Scola
mattia.scomparin@student.bigrock.it|Mattia Scomparin
alberto.simonetti@student.bigrock.it|Alberto Simonetti
lorenzo.stella@student.bigrock.it|Lorenzo Stella
jeanbaptiste.vezzaro@student.bigrock.it|Jean Baptiste Vezzaro
paolo.vianello@student.bigrock.it|Paolo Vianello
finley.wakefield@student.bigrock.it|Finley Wakefield
sebastiano.zuccarello@student.bigrock.it|Sebastiano Zuccarello
mauro.amici@student.bigrock.it|Mauro Amici
katya.cantarutti@student.bigrock.it|Katya Cantarutti
elena.carlotto@student.bigrock.it|Elena Carlotto
giulia.darrigo@student.bigrock.it|Giulia D'Arrigo
ninauma.luongo@student.bigrock.it|Nina Uma Luongo
benedetta.minafra@student.bigrock.it|Benedetta Minafra
stefano.minghelli@student.bigrock.it|Stefano Minghelli
angelica.panunziodipilato@student.bigrock.it|Angelica Panunzio Di Pilato
rebecca.poma@student.bigrock.it|Rebecca Poma
mattia.zanetti@student.bigrock.it|Mattia Zanetti
giulianamay.coppola@student.bigrock.it|Giuliana May Coppola
federico.cugusi@student.bigrock.it|Federico Cugusi
nicolo.dobre@student.bigrock.it|Nicolò Dobre
mirko.pulici@student.bigrock.it|Mirko Pulici
andrea.rainieri@student.bigrock.it|Andrea Rainieri
EOF
)

ok=0; fail=0
while IFS='|' read -r email name; do
  [ -z "$email" ] && continue
  payload=$(printf '{"email":"%s","email_confirm":true,"user_metadata":{"full_name":"%s"}}' "$email" "$name")
  code=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X POST "$API" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload")
  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    echo "✓ $email ($name)"
    ok=$((ok+1))
  else
    msg=$(cat /tmp/resp.json | tr -d '\r\n' | head -c 200)
    echo "✗ $email [HTTP $code] $msg"
    fail=$((fail+1))
  fi
done <<< "$ROSTER"

echo ""
echo "Done — $ok created, $fail failed"
