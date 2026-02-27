#!/usr/bin/env bash
# 1) Remove bad MX (priority 0, hostname ".") and old SPF (v=spf1 -all)
# 2) Add DKIM TXT records for innexar.com.br
# Run: CLOUDFLARE_API_TOKEN=seu_token ./scripts/cloudflare-dns-mailbux-cleanup-dkim.sh

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

# Delete a record by ID
delete_record() {
  local id=$1
  curl -s -X DELETE "$API/zones/$ZONE_ID/dns_records/$id" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq -r 'if .success then "Deleted " + .result.id else "FAIL " + (.errors[0].message // "unknown") end'
}

echo ""
echo "Listing MX records..."
MX_JSON=$(curl -s -X GET "$API/zones/$ZONE_ID/dns_records?type=MX" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json")
# Remove bad MX: priority 0 and content "."
for id in $(echo "$MX_JSON" | jq -r '.result[] | select(.priority == 0 and (.content == "." or .content == "")) | .id'); do
  [ -z "$id" ] || [ "$id" = "null" ] && continue
  echo "Removing bad MX record (0 .): $id"
  delete_record "$id"
done

echo "Listing TXT records (root)..."
TXT_JSON=$(curl -s -X GET "$API/zones/$ZONE_ID/dns_records?type=TXT" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json")
# Remove old SPF v=spf1 -all (exact match)
for id in $(echo "$TXT_JSON" | jq -r '.result[] | select((.name == "innexar.com.br" or .name == "@") and (.content == "v=spf1 -all")) | .id'); do
  [ -z "$id" ] || [ "$id" = "null" ] && continue
  echo "Removing old SPF (v=spf1 -all): $id"
  delete_record "$id"
done

echo ""
echo "Adding DKIM TXT records..."

# DKIM RSA (name without zone: 202602r._domainkey)
add_record() {
  local type=$1 name=$2 content=$3
  local body
  body=$(jq -n --arg t "$type" --arg n "$name" --arg c "$content" --argjson ttl 3600 \
    '{type:$t, name:$n, content:$c, ttl:$ttl}')
  curl -s -X POST "$API/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body" | jq -r 'if .success then "OK " + .result.name + " " + .result.type else "FAIL " + (.errors[0].message // "unknown") end'
}

DKIM_RSA="v=DKIM1; k=rsa; h=sha256; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4AlPC9GmHQYn2drX9BjSdDenUvUp/au36J2zbI4vjlw3QLUI57DRAnXGHnZPZlOW/WYbxYA+nRsX3ZB7FhB/1aRbXH4ikfWdmMxUC5f0g5CYRf+zR17KVkZPILz+wCI6wUT+8DdWc63cCh1gAgTpnfy4F5663qpP4JnDcY678sSukXKEzgh6XHt8YLTdhlO10095v5nztPSO2kQtbLhk5eiIIHo48RZsVcExYq+CJGHRdQvXgql2OLtM8YpwNXpGlQsJ0lPMmKEp1fD7UvpbsyfrybRo7H1p+k3PF4WWG91zyjmmI/0/u+M9MyuhguTksd3tQHd+Cu9GMkWGc3ZCNQIDAQAB"
DKIM_ED25519="v=DKIM1; k=ed25519; h=sha256; p=qFiVRN4PdJqoiMO/RRwbFOhGVF3qhM7nhkplhRKkP58="

add_record TXT "202602r._domainkey" "$DKIM_RSA"
add_record TXT "202602e._domainkey" "$DKIM_ED25519"

echo ""
echo "Done. Removed bad MX/SPF (if present) and added DKIM records."
