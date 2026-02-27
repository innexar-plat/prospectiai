#!/usr/bin/env bash
# Add ALL Mailbux DNS records for innexar.com.br (idempotent: delete DKIM RSA then add everything)
# Run: CLOUDFLARE_API_TOKEN=seu_token ./scripts/cloudflare-dns-mailbux-add-all.sh

set -e
ZONE_NAME="innexar.com.br"
API="https://api.cloudflare.com/client/v4"

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "Set CLOUDFLARE_API_TOKEN and run again."
  exit 1
fi

echo "Getting Zone ID for $ZONE_NAME..."
ZONE_ID=$(curl -s -X GET "$API/zones?name=$ZONE_NAME" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" | jq -r '.result[0].id')
if [ -z "$ZONE_ID" ] || [ "$ZONE_ID" = "null" ]; then
  echo "Zone not found."
  exit 1
fi
echo "Zone ID: $ZONE_ID"

delete_record() {
  local id=$1
  curl -s -X DELETE "$API/zones/$ZONE_ID/dns_records/$id" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq -r 'if .success then "Deleted" else "FAIL" end'
}

add_record() {
  local type=$1 name=$2 content=$3 priority=${4:-}
  local body
  if [ "$type" = "MX" ]; then
    body=$(jq -n --arg t "$type" --arg n "$name" --arg c "$content" --argjson p "${priority:-10}" --argjson ttl 3600 '{type:$t, name:$n, content:$c, priority:$p, ttl:$ttl}')
  else
    body=$(jq -n --arg t "$type" --arg n "$name" --arg c "$content" --argjson ttl 3600 '{type:$t, name:$n, content:$c, ttl:$ttl}')
  fi
  local out
  out=$(curl -s -X POST "$API/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body")
  if echo "$out" | jq -e '.success' >/dev/null 2>&1; then
    echo "OK $name $type"
  else
    local code=$(echo "$out" | jq -r '.errors[0].code // ""')
    if [ "$code" = "81057" ]; then echo "OK $name $type (already exists)"; else echo "FAIL $name $type: $(echo "$out" | jq -r '.errors[0].message // .errors')"; fi
  fi
}

add_srv() {
  local name=$1 priority=$2 weight=$3 port=$4 target=$5
  local body=$(jq -n --arg n "$name" --argjson p "$priority" --argjson w "$weight" --argjson port "$port" --arg t "$target" --argjson ttl 3600 \
    '{type:"SRV", name:$n, data:{priority:$p, weight:$w, port:$port, target:$t}, ttl:$ttl}')
  local out
  out=$(curl -s -X POST "$API/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body")
  if echo "$out" | jq -e '.success' >/dev/null 2>&1; then
    echo "OK $name SRV"
  else
    local code=$(echo "$out" | jq -r '.errors[0].code // ""')
    if [ "$code" = "81057" ]; then echo "OK $name SRV (already exists)"; else echo "FAIL $name SRV"; fi
  fi
}

echo ""
echo "Removing existing DKIM RSA (202602r._domainkey) to re-add..."
RECORD_ID=$(curl -s -X GET "$API/zones/$ZONE_ID/dns_records?type=TXT&name=202602r._domainkey.innexar.com.br" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq -r '.result[0].id // empty')
if [ -n "$RECORD_ID" ]; then delete_record "$RECORD_ID"; else echo "(none found)"; fi

echo ""
echo "Adding MX..."
add_record MX "@" "my.mailbux.com" 10

echo "Adding TXT (SPF)..."
add_record TXT "@" "v=spf1 include:mailwish.com -all"

echo "Adding DKIM RSA..."
DKIM_RSA="v=DKIM1; k=rsa; h=sha256; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4AlPC9GmHQYn2drX9BjSdDenUvUp/au36J2zbI4vjlw3QLUI57DRAnXGHnZPZlOW/WYbxYA+nRsX3ZB7FhB/1aRbXH4ikfWdmMxUC5f0g5CYRf+zR17KVkZPILz+wCI6wUT+8DdWc63cCh1gAgTpnfy4F5663qpP4JnDcY678sSukXKEzgh6XHt8YLTdhlO10095v5nztPSO2kQtbLhk5eiIIHo48RZsVcExYq+CJGHRdQvXgql2OLtM8YpwNXpGlQsJ0lPMmKEp1fD7UvpbsyfrybRo7H1p+k3PF4WWG91zyjmmI/0/u+M9MyuhguTksd3tQHd+Cu9GMkWGc3ZCNQIDAQAB"
add_record TXT "202602r._domainkey" "$DKIM_RSA"

echo "Adding DKIM Ed25519..."
add_record TXT "202602e._domainkey" "v=DKIM1; k=ed25519; h=sha256; p=qFiVRN4PdJqoiMO/RRwbFOhGVF3qhM7nhkplhRKkP58="

echo "Adding CNAMEs..."
add_record CNAME "mail" "my.mailbux.com"
add_record CNAME "autoconfig" "my.mailbux.com"
add_record CNAME "autodiscover" "my.mailbux.com"
add_record CNAME "mta-sts" "my.mailbux.com"

echo "Adding SRV records..."
add_srv "_jmap._tcp" 0 1 443 "my.mailbux.com"
add_srv "_caldavs._tcp" 0 1 443 "my.mailbux.com"
add_srv "_carddavs._tcp" 0 1 443 "my.mailbux.com"
add_srv "_imaps._tcp" 0 1 993 "my.mailbux.com"
add_srv "_imap._tcp" 0 1 143 "my.mailbux.com"
add_srv "_pop3s._tcp" 0 1 995 "my.mailbux.com"
add_srv "_pop3._tcp" 0 1 110 "my.mailbux.com"
add_srv "_submissions._tcp" 0 1 465 "my.mailbux.com"
add_srv "_submission._tcp" 0 1 587 "my.mailbux.com"

echo "Adding TXT (MTA-STS, DMARC, TLSRPT)..."
add_record TXT "_mta-sts" "v=STSv1; id=14343658018203870626"
add_record TXT "_dmarc" "v=DMARC1; p=reject; rua=mailto:postmaster@innexar.com.br; ruf=mailto:postmaster@innexar.com.br"
add_record TXT "_smtp._tls" "v=TLSRPTv1; rua=mailto:postmaster@innexar.com.br"

echo ""
echo "Done. All Mailbux records added or already present."
