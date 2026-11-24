#!/usr/bin/env bash
# Importa (ou atualiza) todos os estados americanos na tabela "UsCompany": extrai da Overture,
# carrega e apaga o parquet intermediário. Uso: scripts/us/import-all-states.sh [UF ...]
set -uo pipefail
cd "$(dirname "$0")/../.."
PY=/srv/innexar/tools/us-data/.venv/bin/python
RELEASE="${OVERTURE_RELEASE:-}"
STATES=("$@")
if [ ${#STATES[@]} -eq 0 ]; then
  STATES=(FL TX NY CA GA NC AZ IL PA OH MI NJ VA WA MA TN IN MO MD WI CO MN SC AL LA KY OR OK CT UT IA NV AR MS KS NM NE ID WV HI NH ME MT RI DE SD ND AK VT WY DC)
fi
for s in "${STATES[@]}"; do
  echo "=== $s $(date '+%H:%M')"
  $PY scripts/us/extract-overture.py "$s" $RELEASE && $PY scripts/us/load-us-companies.py "$s" | head -1
  rm -f "/srv/innexar/tools/us-data/$s.parquet"
done
docker exec -i prospector-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT count(*) AS empresas, count(DISTINCT state) AS estados FROM \"UsCompany\";"'
