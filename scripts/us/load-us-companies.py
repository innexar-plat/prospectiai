#!/usr/bin/env python3
"""
Carrega no Postgres do Precision ("UsCompany") os estabelecimentos extraídos por
extract-overture.py. Mantém só empresas abertas, com confiança mínima, com algum contato e de
categorias comerciais. Upsert por id: rodar de novo a cada release mensal da Overture.

Uso: /srv/innexar/tools/us-data/.venv/bin/python scripts/us/load-us-companies.py FL [TX NY ...]
"""
import subprocess
import sys
import time

import duckdb

DATA_DIR = "/srv/innexar/tools/us-data"
MIN_CONFIDENCE = 0.5
# Places that are not businesses anyone sells to (churches stay: they buy services).
EXCLUDE = [
    "%park%", "historic_site", "atm", "%landmark%", "beach", "%lake%", "river", "mountain",
    "monument", "cemetery", "bus_station", "bus_stop", "%train_station%", "playground", "trail%", "bridge",
    "structure_and_geography", "public_%", "post_office", "fire_department", "police_department",
    "%government%", "city_hall", "library", "%memorial%", "natural_feature", "island", "forest",
]

PSQL = ["docker", "exec", "-i", "prospector-db", "sh", "-c",
        'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q']


def psql(sql: str, stdin: bytes | None = None) -> str:
    res = subprocess.run(PSQL, input=(sql.encode() if stdin is None else stdin), capture_output=True, check=False)
    if res.returncode != 0:
        raise SystemExit(res.stderr.decode()[:500])
    return res.stdout.decode()


def load_state(con: duckdb.DuckDBPyConnection, state: str) -> None:
    t = time.time()
    excl = " AND ".join(f"coalesce(category, '') NOT LIKE '{p}'" for p in EXCLUDE)
    csv = con.sql(f"""
SELECT id, trim(name) AS name, category, basic_category, address, city, lower(trim(city)) AS city_norm, state,
       postcode, phone, lower(email) AS email, website, lat, lng, confidence, operating_status, release
FROM read_parquet('{DATA_DIR}/{state}.parquet')
WHERE name IS NOT NULL AND length(trim(name)) > 1
  AND coalesce(operating_status, 'open') = 'open'
  AND coalesce(confidence, 0) >= {MIN_CONFIDENCE}
  AND (phone IS NOT NULL OR email IS NOT NULL OR website IS NOT NULL)
  AND category IS NOT NULL AND {excl}
""").df().to_csv(index=False, header=False).encode()
    rows = csv.count(b"\n")
    script = (
        "BEGIN;\n"
        'CREATE TEMP TABLE us_stage (LIKE "UsCompany" INCLUDING DEFAULTS) ON COMMIT DROP;\n'
        'COPY us_stage (id, name, category, "basicCategory", address, city, "cityNorm", state, postcode, phone, email, '
        'website, lat, lng, confidence, "operatingStatus", release) FROM STDIN WITH (FORMAT csv);\n'
    ).encode() + csv + (
        "\\.\n"
        'INSERT INTO "UsCompany" SELECT * FROM us_stage ON CONFLICT (id) DO UPDATE SET '
        'name = EXCLUDED.name, category = EXCLUDED.category, "basicCategory" = EXCLUDED."basicCategory", '
        'address = EXCLUDED.address, city = EXCLUDED.city, "cityNorm" = EXCLUDED."cityNorm", postcode = EXCLUDED.postcode, '
        'phone = EXCLUDED.phone, email = EXCLUDED.email, website = EXCLUDED.website, lat = EXCLUDED.lat, lng = EXCLUDED.lng, '
        'confidence = EXCLUDED.confidence, "operatingStatus" = EXCLUDED."operatingStatus", release = EXCLUDED.release, '
        '"updatedAt" = now();\n'
        "COMMIT;\n"
    ).encode()
    psql("", stdin=script)
    print(f"{state}: {rows} empresas carregadas ({round(time.time() - t)} s)")


def main() -> None:
    con = duckdb.connect()
    for state in (s.upper() for s in sys.argv[1:]):
        load_state(con, state)
    print(psql('SELECT state, count(*) FROM "UsCompany" GROUP BY 1 ORDER BY 1;'))


if __name__ == "__main__":
    main()
