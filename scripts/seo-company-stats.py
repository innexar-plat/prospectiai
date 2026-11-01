#!/usr/bin/env python3
"""
Builds frontend/src/data/seo-company-stats.json — aggregate numbers (never contacts) per
segment × city from the Receita base, for the public "Empresas de X em Y" SEO pages.

One read-only pass over RfCompany (single worker, long timeout). Re-run monthly after the RF
import:  python3 scripts/seo-company-stats.py
"""
import json
import subprocess
import sys
import unicodedata
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "src" / "data" / "seo-company-stats.json"
MIN_COMPANIES = 30

# slug, singular/plural display names, CNAE codes (7 digits) or prefixes (4 digits)
SEGMENTS = [
    ("restaurantes", "Restaurantes", ["5611"]),
    ("academias", "Academias", ["9313"]),
    ("clinicas-medicas", "Clínicas médicas", ["8630501", "8630502", "8630503"]),
    ("dentistas", "Clínicas odontológicas", ["8630504"]),
    ("saloes-de-beleza", "Salões de beleza", ["9602501"]),
    ("clinicas-de-estetica", "Clínicas de estética", ["9602502"]),
    ("escritorios-de-contabilidade", "Escritórios de contabilidade", ["6920601"]),
    ("escritorios-de-advocacia", "Escritórios de advocacia", ["6911701"]),
    ("imobiliarias", "Imobiliárias", ["6821", "6822"]),
    ("construtoras", "Construtoras", ["4120"]),
    ("transportadoras", "Transportadoras", ["4930"]),
    ("supermercados", "Supermercados", ["4711"]),
    ("padarias", "Padarias", ["1091102", "4721102"]),
    ("oficinas-mecanicas", "Oficinas mecânicas", ["4520"]),
    ("farmacias", "Farmácias", ["4771"]),
    ("pet-shops", "Pet shops", ["4789004"]),
    ("lojas-de-roupas", "Lojas de roupas", ["4781"]),
    ("lojas-de-materiais-de-construcao", "Lojas de materiais de construção", ["4744"]),
    ("lojas-de-moveis", "Lojas de móveis", ["4754"]),
    ("hoteis", "Hotéis", ["5510"]),
    ("escolas-de-idiomas", "Escolas de idiomas", ["8593700"]),
    ("agencias-de-marketing", "Agências de marketing", ["7311", "7319"]),
    ("empresas-de-tecnologia", "Empresas de tecnologia", ["6201", "6202", "6203", "6204", "6209"]),
    ("distribuidoras-de-alimentos", "Distribuidoras de alimentos", ["4639", "4637"]),
]

# Display name with accents, UF. The Receita stores cities uppercase without accents.
CITIES = [
    ("São Paulo", "SP"), ("Rio de Janeiro", "RJ"), ("Brasília", "DF"), ("Salvador", "BA"), ("Fortaleza", "CE"),
    ("Belo Horizonte", "MG"), ("Manaus", "AM"), ("Curitiba", "PR"), ("Recife", "PE"), ("Goiânia", "GO"),
    ("Belém", "PA"), ("Porto Alegre", "RS"), ("Guarulhos", "SP"), ("Campinas", "SP"), ("São Luís", "MA"),
    ("São Gonçalo", "RJ"), ("Maceió", "AL"), ("Duque de Caxias", "RJ"), ("Campo Grande", "MS"), ("Natal", "RN"),
    ("Teresina", "PI"), ("São Bernardo do Campo", "SP"), ("Nova Iguaçu", "RJ"), ("João Pessoa", "PB"),
    ("Santo André", "SP"), ("São José dos Campos", "SP"), ("Osasco", "SP"), ("Jaboatão dos Guararapes", "PE"),
    ("Ribeirão Preto", "SP"), ("Uberlândia", "MG"), ("Sorocaba", "SP"), ("Contagem", "MG"), ("Aracaju", "SE"),
    ("Feira de Santana", "BA"), ("Cuiabá", "MT"), ("Joinville", "SC"), ("Aparecida de Goiânia", "GO"),
    ("Londrina", "PR"), ("Juiz de Fora", "MG"), ("Niterói", "RJ"), ("Porto Velho", "RO"), ("Florianópolis", "SC"),
    ("Serra", "ES"), ("Caxias do Sul", "RS"), ("Vila Velha", "ES"), ("Macapá", "AP"), ("Mauá", "SP"),
    ("São João de Meriti", "RJ"), ("Santos", "SP"), ("Mogi das Cruzes", "SP"), ("Betim", "MG"), ("Diadema", "SP"),
    ("Campina Grande", "PB"), ("Jundiaí", "SP"), ("Maringá", "PR"), ("Montes Claros", "MG"), ("Piracicaba", "SP"),
    ("Carapicuíba", "SP"), ("Olinda", "PE"), ("Cariacica", "ES"), ("Bauru", "SP"), ("Rio Branco", "AC"),
    ("Vitória", "ES"), ("Praia Grande", "SP"), ("São Vicente", "SP"), ("Guarujá", "SP"), ("Blumenau", "SC"),
    ("Ponta Grossa", "PR"), ("São José do Rio Preto", "SP"), ("Palmas", "TO"), ("Boa Vista", "RR"),
]


def rf_name(display: str) -> str:
    return unicodedata.normalize("NFKD", display).encode("ascii", "ignore").decode().upper()


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return "-".join("".join(c if c.isalnum() else " " for c in text).split())


def title_bairro(name: str) -> str:
    small = {"de", "da", "do", "das", "dos", "e"}
    words = name.strip().lower().split()
    return " ".join(w if i and w in small else w.capitalize() for i, w in enumerate(words))


def segment_case() -> str:
    parts = []
    for slug, _, codes in SEGMENTS:
        conds = []
        for code in codes:
            if len(code) == 7:
                conds.append(f"\"cnaePrincipal\" = '{code}'")
            else:
                upper = code[:-1] + chr(ord(code[-1]) + 1)
                conds.append(f"(\"cnaePrincipal\" >= '{code}' AND \"cnaePrincipal\" < '{upper}')")
        parts.append(f"WHEN {' OR '.join(conds)} THEN '{slug}'")
    return "CASE " + " ".join(parts) + " END"


def build_sql(since: str) -> str:
    seg = segment_case()
    city_list = ", ".join(f"('{rf_name(c)}', '{uf}')" for c, uf in CITIES)
    return f"""
SET statement_timeout = '30min';
SET max_parallel_workers_per_gather = 0;
SET work_mem = '64MB';
COPY (
  SELECT seg, municipio, uf, coalesce(nullif(upper(trim(bairro)), ''), '-') AS bairro,
         count(*) AS total,
         count(*) FILTER (WHERE "dataAbertura" >= '{since}') AS recent,
         count(*) FILTER (WHERE porte = 'ME') AS me,
         count(*) FILTER (WHERE porte = 'EPP') AS epp,
         count(*) FILTER (WHERE telefone IS NOT NULL AND telefone <> '') AS phone,
         count(*) FILTER (WHERE email IS NOT NULL AND email <> '') AS email
  FROM (SELECT {seg} AS seg, municipio, uf, bairro, "dataAbertura", porte, telefone, email
        FROM "RfCompany" WHERE (municipio, uf) IN ({city_list})) t
  WHERE seg IS NOT NULL
  GROUP BY 1, 2, 3, 4
) TO STDOUT WITH (FORMAT csv);
"""


def main() -> None:
    since = (date.today() - timedelta(days=365)).strftime("%Y%m%d")
    proc = subprocess.run(
        ["docker", "exec", "-i", "prospector-db", "sh", "-c", 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1'],
        input=build_sql(since), capture_output=True, text=True, check=False,
    )
    if proc.returncode != 0:
        sys.exit(f"query failed: {proc.stderr.strip()[-500:]}")

    import csv, io
    agg = defaultdict(lambda: {"total": 0, "recent": 0, "me": 0, "epp": 0, "phone": 0, "email": 0, "bairros": defaultdict(int)})
    for row in csv.reader(io.StringIO(proc.stdout)):
        if len(row) != 10:
            continue
        seg, mun, uf, bairro, total, recent, me, epp, phone, email = row
        a = agg[(seg, mun, uf)]
        for k, v in zip(("total", "recent", "me", "epp", "phone", "email"), (total, recent, me, epp, phone, email)):
            a[k] += int(v)
        if bairro != "-":
            a["bairros"][bairro] += int(total)

    seg_names = {s: n for s, n, _ in SEGMENTS}
    pages = {}
    for display_city, uf in CITIES:
        for seg_slug, _, _ in SEGMENTS:
            a = agg.get((seg_slug, rf_name(display_city), uf))
            if not a or a["total"] < MIN_COMPANIES:
                continue
            slug = f"{seg_slug}-em-{slugify(display_city)}-{uf.lower()}"
            pages[slug] = {
                "segment": seg_slug,
                "segmentName": seg_names[seg_slug],
                "city": display_city,
                "uf": uf,
                "total": a["total"],
                "openedLast12m": a["recent"],
                "porte": {"ME": a["me"], "EPP": a["epp"], "DEMAIS": a["total"] - a["me"] - a["epp"]},
                "withPhonePct": round(100 * a["phone"] / a["total"]),
                "withEmailPct": round(100 * a["email"] / a["total"]),
                "topBairros": [
                    {"name": title_bairro(b), "count": n}
                    for b, n in sorted(a["bairros"].items(), key=lambda kv: -kv[1])[:6]
                ],
            }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "generatedAt": date.today().isoformat(),
        "segments": [{"slug": s, "name": n} for s, n, _ in SEGMENTS],
        "cities": [{"slug": f"{slugify(c)}-{uf.lower()}", "name": c, "uf": uf} for c, uf in CITIES],
        "pages": pages,
    }, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(pages)} pages written to {OUT}")


if __name__ == "__main__":
    main()
