#!/usr/bin/env python3
"""
Extrai estabelecimentos de um estado americano da base aberta Overture Maps (tema places,
licença CDLA-Permissive-2.0 — exige atribuição) para um parquet local.

Uso (venv com duckdb em /srv/innexar/tools/us-data/.venv):
  /srv/innexar/tools/us-data/.venv/bin/python scripts/us/extract-overture.py FL [release]
Saída: /srv/innexar/tools/us-data/<UF>.parquet
"""
import json
import sys
import time
import urllib.request

import duckdb

OUT_DIR = "/srv/innexar/tools/us-data"
# Bounding boxes (xmin, xmax, ymin, ymax) used only to prune parquet row groups; the state
# filter itself is the address region.
BBOX = {
    "FL": (-87.7, -79.9, 24.4, 31.1),
    "TX": (-106.7, -93.5, 25.8, 36.6),
    "NY": (-79.8, -71.8, 40.4, 45.1),
    "CA": (-124.5, -114.1, 32.5, 42.1),
    "GA": (-85.7, -80.8, 30.3, 35.0),
    "NC": (-84.4, -75.4, 33.8, 36.6),
    "AZ": (-114.9, -109.0, 31.3, 37.1),
    "IL": (-91.6, -87.0, 36.9, 42.6),
}


def latest_release() -> str:
    cat = json.load(urllib.request.urlopen("https://stac.overturemaps.org/catalog.json", timeout=30))
    children = [l["href"] for l in cat.get("links", []) if l.get("rel") == "child"]
    return children[-1].rstrip("/").split("/")[-2]


def main() -> None:
    state = sys.argv[1].upper()
    release = sys.argv[2] if len(sys.argv) > 2 else latest_release()
    xmin, xmax, ymin, ymax = BBOX[state]
    t = time.time()
    con = duckdb.connect()
    con.sql("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2'; SET threads=4;")
    src = f"s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*"
    out = f"{OUT_DIR}/{state}.parquet"
    con.sql(f"""
COPY (
  SELECT id, names.primary AS name, taxonomy.primary AS category, basic_category,
         addresses[1].freeform AS address, addresses[1].locality AS city, addresses[1].postcode AS postcode,
         '{state}' AS state, phones[1] AS phone, emails[1] AS email, websites[1] AS website,
         confidence, operating_status, (bbox.xmin + bbox.xmax) / 2 AS lng, (bbox.ymin + bbox.ymax) / 2 AS lat,
         '{release}' AS release
  FROM read_parquet('{src}', hive_partitioning = 1)
  WHERE bbox.xmin BETWEEN {xmin} AND {xmax} AND bbox.ymin BETWEEN {ymin} AND {ymax}
    AND addresses[1].country = 'US' AND addresses[1].region IN ('{state}', 'US-{state}')
) TO '{out}' (FORMAT parquet)""")
    n = con.sql(f"SELECT count(*) FROM read_parquet('{out}')").fetchone()[0]
    print(f"{state}: {n} lugares → {out} ({release}, {round(time.time() - t)} s)")


if __name__ == "__main__":
    main()
