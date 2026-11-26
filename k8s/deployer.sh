#!/usr/bin/env bash
set -euo pipefail

REGISTRE="${REGISTRE:?définir REGISTRE, par exemple ghcr.io/organisation/depot}"
IMAGE_TAG="${IMAGE_TAG:?définir IMAGE_TAG}"
export REGISTRE IMAGE_TAG
export MODE_DEMO="${MODE_DEMO:-0}"
export BASE_SCORE="${BASE_SCORE:-entrepot_demo}"
DELAI="${DELAI:-240s}"
DOSSIER="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(dirname "$DOSSIER")"
K="kubectl --namespace comex"

kubectl apply -f "$DOSSIER/00-namespace.yaml"

if ! $K get secret comex-base >/dev/null 2>&1; then
  if [ "${GENERER_SECRETS:-0}" != "1" ]; then
    echo "Le secret comex-base est absent. Le créer, ou lancer avec GENERER_SECRETS=1 pour un cluster de test." >&2
    exit 1
  fi
  $K create secret generic comex-base \
    --from-literal=PG_UTILISATEUR=entrepot \
    --from-literal=PG_MOT_DE_PASSE="$(openssl rand -hex 16)" \
    --from-literal=API_CLE="$(openssl rand -hex 16)" \
    --from-literal=DASHBOARD_UTILISATEUR=comex \
    --from-literal=DASHBOARD_MOT_DE_PASSE="$(openssl rand -hex 16)"
fi

$K create configmap postgres-initialisation \
  --from-file="$RACINE/db/00_bases.sql" --from-file="$RACINE/db/01_schema.sql" \
  --dry-run=client -o yaml | $K apply -f -

kubectl apply -f "$DOSSIER/registre.yaml" -f "$DOSSIER/postgres.yaml"
for f in score web; do
  envsubst '${REGISTRE} ${IMAGE_TAG} ${MODE_DEMO} ${BASE_SCORE}' < "$DOSSIER/$f.yaml" | kubectl apply -f -
done
kubectl apply -f "$DOSSIER/modele-cronjobs.yaml"

$K rollout status statefulset/postgres --timeout="$DELAI"
$K rollout status deployment/score --timeout="$DELAI"
$K rollout status deployment/web --timeout="$DELAI"

if [ "${CONTROLES:-1}" = "1" ]; then
  code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
  attendre() { for _ in $(seq 1 30); do [ "$(code "$1")" != "000" ] && return 0; sleep 1; done; return 1; }
  $K port-forward svc/score 18120:8120 >/dev/null 2>&1 &
  P1=$!
  $K port-forward svc/web 13100:3100 >/dev/null 2>&1 &
  P2=$!
  trap 'kill $P1 $P2 2>/dev/null || true' EXIT
  attendre http://127.0.0.1:18120/sante
  attendre http://127.0.0.1:13100/api/sante
  echec=0
  verifier() { if [ "$2" = "$3" ]; then echo "ok   $1 ($3)"; else echo "ECHEC $1 : attendu $2, obtenu $3"; echec=1; fi; }
  verifier "API de score : sonde de santé" 200 "$(code http://127.0.0.1:18120/sante)"
  verifier "API de score : refus sans clé" 401 "$(code http://127.0.0.1:18120/scores)"
  verifier "Tableau de bord : sonde de santé" 200 "$(code http://127.0.0.1:13100/api/sante)"
  if [ "$MODE_DEMO" = "0" ]; then
    verifier "Tableau de bord : refus sans identifiants" 401 "$(code http://127.0.0.1:13100/)"
  fi
  exit $echec
fi
