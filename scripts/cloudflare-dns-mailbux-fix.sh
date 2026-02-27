#!/usr/bin/env bash
# Fix only incorrect Mailbux-related DNS records (remove wrong SPF, duplicate _dmarc; optionally recreate if needed).
# Run after audit. Use: CLOUDFLARE_API_TOKEN=token ./scripts/cloudflare-dns-mailbux-fix.sh

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

delete_record() {
  local id=$1
  curl -s -X DELETE "$API/zones/$ZONE_ID/dns_records/$id" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq -r 'if .success then "Deleted \(.result.id)" else "FAIL" end'
}

echo ""
echo "=== Checking root TXT for wrong SPF (v=spf1 -all) to remove ==="
TXT_JSON=$(curl -s -X GET "$API/zones/$ZONE_ID/dns_records?type=TXT&name=innexar.com.br" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
for id in $(echo "$TXT_JSON" | jq -r '.result[] | select(.content == "v=spf1 -all" or .content == "\"v=spf1 -all\"") | .id'); do
  [ -z "$id" ] || [ "$id" = "null" ] && continue
  echo "Removing incorrect SPF record: $id"
  delete_record "$id"
done
echo ""

echo "=== Checking _dmarc: remove duplicate short policy if two exist ==="
DMARC_JSON=$(curl -s -X GET "$API/zones/$ZONE_ID/dns_records?type=TXT&name=_dmarc.innexar.com.br" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
DMARC_COUNT=$(echo "$DMARC_JSON" | jq '.result | length')
FULL_DMARC="v=DMARC1; p=reject; rua=mailto:postmaster@innexar.com.br; ruf=mailto:postmaster@innexar.com.br"
if [ "$DMARC_COUNT" -gt 1 ]; then
  echo "Found $DMARC_COUNT _dmarc records; removing non-full ones."
  for id in $(echo "$DMARC_JSON" | jq -r --arg full "$FULL_DMARC" '.result[] | select(.content != $full) | .id'); do
    echo "Removing duplicate _dmarc: $id"
    delete_record "$id"
  done
else
  echo "_dmarc count: $DMARC_COUNT (no duplicate removal needed)"
fi
echo ""

echo "Done. Run scripts/cloudflare-dns-audit.sh again to confirm state."
