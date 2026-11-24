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
    "AL": (-88.5, -84.9, 30.1, 35.0), "AK": (-180.0, -129.9, 51.2, 71.5), "AZ": (-114.9, -109.0, 31.3, 37.1),
    "AR": (-94.7, -89.6, 33.0, 36.5), "CA": (-124.5, -114.1, 32.5, 42.1), "CO": (-109.1, -102.0, 36.9, 41.1),
    "CT": (-73.8, -71.8, 40.9, 42.1), "DE": (-75.8, -75.0, 38.4, 39.9), "DC": (-77.2, -76.9, 38.8, 39.0),
    "FL": (-87.7, -79.9, 24.4, 31.1), "GA": (-85.7, -80.8, 30.3, 35.0), "HI": (-160.3, -154.7, 18.9, 22.3),
    "ID": (-117.3, -111.0, 41.9, 49.1), "IL": (-91.6, -87.0, 36.9, 42.6), "IN": (-88.1, -84.7, 37.7, 41.8),
    "IA": (-96.7, -90.1, 40.3, 43.6), "KS": (-102.1, -94.5, 36.9, 40.1), "KY": (-89.6, -81.9, 36.4, 39.2),
    "LA": (-94.1, -88.8, 28.9, 33.1), "ME": (-71.1, -66.9, 42.9, 47.5), "MD": (-79.5, -75.0, 37.9, 39.8),
    "MA": (-73.6, -69.9, 41.2, 42.9), "MI": (-90.5, -82.1, 41.6, 48.4), "MN": (-97.3, -89.4, 43.4, 49.4),
    "MS": (-91.7, -88.0, 30.1, 35.0), "MO": (-95.8, -89.1, 35.9, 40.7), "MT": (-116.1, -104.0, 44.3, 49.1),
    "NE": (-104.1, -95.3, 39.9, 43.1), "NV": (-120.1, -114.0, 35.0, 42.1), "NH": (-72.6, -70.6, 42.6, 45.4),
    "NJ": (-75.6, -73.8, 38.9, 41.4), "NM": (-109.1, -103.0, 31.3, 37.1), "NY": (-79.8, -71.8, 40.4, 45.1),
    "NC": (-84.4, -75.4, 33.8, 36.6), "ND": (-104.1, -96.5, 45.9, 49.1), "OH": (-84.9, -80.5, 38.4, 42.0),
    "OK": (-103.1, -94.4, 33.6, 37.1), "OR": (-124.7, -116.4, 41.9, 46.3), "PA": (-80.6, -74.6, 39.7, 42.3),
    "RI": (-71.9, -71.1, 41.1, 42.1), "SC": (-83.4, -78.5, 32.0, 35.3), "SD": (-104.1, -96.4, 42.4, 46.0),
    "TN": (-90.4, -81.6, 34.9, 36.7), "TX": (-106.7, -93.5, 25.8, 36.6), "UT": (-114.1, -109.0, 36.9, 42.1),
    "VT": (-73.5, -71.4, 42.7, 45.1), "VA": (-83.7, -75.2, 36.5, 39.5), "WA": (-124.9, -116.9, 45.5, 49.1),
    "WV": (-82.7, -77.7, 37.2, 40.7), "WI": (-92.9, -86.2, 42.4, 47.4), "WY": (-111.1, -104.0, 40.9, 45.1),
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
