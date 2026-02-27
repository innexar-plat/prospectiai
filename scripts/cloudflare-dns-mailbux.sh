#!/usr/bin/env bash
# DNS records for innexar.com.br (Mailbux / email)
# Run: CLOUDFLARE_API_TOKEN=seu_token ./scripts/cloudflare-dns-mailbux.sh
# Never commit the token. Revoke any token exposed in chat.

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
  echo "Zone not found. Check token and domain."
  exit 1
fi
echo "Zone ID: $ZONE_ID"

add_record() {
  local type=$1 name=$2 content=$3 priority=${4:-}
  local body
  if [ "$type" = "MX" ]; then
    body=$(jq -n --arg t "$type" --arg n "$name" --arg c "$content" --argjson p "${priority:-10}" --argjson ttl 3600 \
      '{type:$t, name:$n, content:$c, priority:$p, ttl:$ttl}')
  else
    body=$(jq -n --arg t "$type" --arg n "$name" --arg c "$content" --argjson ttl 3600 \
      '{type:$t, name:$n, content:$c, ttl:$ttl}')
  fi
  curl -s -X POST "$API/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body" | jq -r 'if .success then "OK " + .result.name + " " + .result.type else "FAIL " + .errors[0].message end'
}

add_srv() {
  local name=$1 priority=$2 weight=$3 port=$4 target=$5
  local body=$(jq -n \
    --arg n "$name" \
    --argjson p "$priority" \
    --argjson w "$weight" \
    --argjson port "$port" \
    --arg t "$target" \
    --argjson ttl 3600 \
    '{type:"SRV", name:$n, data:{priority:$p, weight:$w, port:$port, target:$t}, ttl:$ttl}')
  curl -s -X POST "$API/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body" | jq -r 'if .success then "OK " + .result.name + " SRV" else "FAIL " + .errors[0].message end'
}

echo ""
echo "Adding MX..."
add_record MX "@" "my.mailbux.com" 10

echo "Adding TXT (SPF)..."
add_record TXT "@" "v=spf1 include:mailwish.com -all"

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
echo "Done. Check Cloudflare DNS for innexar.com.br."
echo "Remove the old MX (incorrect hostname) and old SPF (v=spf1 -all) in the dashboard if they still exist."
