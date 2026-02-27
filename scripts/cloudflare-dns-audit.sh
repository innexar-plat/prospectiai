#!/usr/bin/env bash
# Read-only DNS audit for innexar.com.br (Mailbux). Lists MX and TXT as stored in Cloudflare.
# Run: CLOUDFLARE_API_TOKEN=seu_token ./scripts/cloudflare-dns-audit.sh

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
echo ""

echo "=== MX (innexar.com.br) ==="
curl -s -X GET "$API/zones/$ZONE_ID/dns_records?type=MX" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | \
  jq -r '.result[] | "  \(.priority) \(.content)  (name: \(.name), id: \(.id))"'
echo ""

echo "=== TXT at root (innexar.com.br / @) ==="
curl -s -X GET "$API/zones/$ZONE_ID/dns_records?type=TXT" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | \
  jq -r '.result[] | select(.name == "innexar.com.br" or .name == "@") | "  name: \(.name)\n  content: \(.content)\n  id: \(.id)\n  content_starts_with_quote: \(.content | startswith("\""))\n"'
echo ""

echo "=== TXT 202602r._domainkey (DKIM RSA) ==="
R_JSON=$(curl -s -X GET "$API/zones/$ZONE_ID/dns_records?type=TXT&name=202602r._domainkey.innexar.com.br" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
R_COUNT=$(echo "$R_JSON" | jq '.result | length')
echo "  records_count: $R_COUNT"
echo "$R_JSON" | jq -r '.result[] | "  content_length: \(.content | length)\n  content: \(.content)\n  id: \(.id)\n"'
echo ""

echo "=== TXT 202602e._domainkey (DKIM Ed25519) ==="
E_JSON=$(curl -s -X GET "$API/zones/$ZONE_ID/dns_records?type=TXT&name=202602e._domainkey.innexar.com.br" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
E_COUNT=$(echo "$E_JSON" | jq '.result | length')
echo "  records_count: $E_COUNT"
echo "$E_JSON" | jq -r '.result[] | "  content: \(.content)\n  id: \(.id)\n"'
echo ""

echo "=== ADDITIONAL RECORDS (Mailbux) ==="
echo ""
echo "--- CNAME (must point to my.mailbux.com) ---"
curl -s -X GET "$API/zones/$ZONE_ID/dns_records?type=CNAME" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | \
  jq -r '.result[] | select(.content == "my.mailbux.com" or .content == "my.mailbux.com.") | "  \(.name) -> \(.content)  (id: \(.id))"'
echo ""
echo "--- SRV (Mailbux) ---"
curl -s -X GET "$API/zones/$ZONE_ID/dns_records?type=SRV" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | \
  jq -r '.result[] | select(.data.target == "my.mailbux.com" or .data.target == "my.mailbux.com.") | "  \(.name) \(.data.priority) \(.data.weight) \(.data.port) \(.data.target)"'
echo ""
echo "--- TXT _mta-sts, _dmarc, _smtp._tls ---"
curl -s -X GET "$API/zones/$ZONE_ID/dns_records?type=TXT" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | \
  jq -r '.result[] | select(.name | test("_mta-sts|_dmarc|_smtp._tls")) | "  \(.name): \(.content[0:60])..."'
echo ""
echo "=== Mailbux expected (for comparison) ==="
echo "  MX:  10 my.mailbux.com"
echo "  SPF: v=spf1 include:mailwish.com -all  (no surrounding quotes)"
echo "  DKIM RSA:     v=DKIM1; k=rsa; h=sha256; p=MIIBIjAN..."
echo "  DKIM Ed25519: v=DKIM1; k=ed25519; h=sha256; p=qFiVRN4..."
echo "  CNAME: mail, autoconfig, autodiscover, mta-sts -> my.mailbux.com"
echo "  SRV: 10 records (jmap, caldavs, carddavs, imaps, imap, pop3s, pop3, submissions, submission)"
echo "  TXT: _mta-sts (STSv1), _dmarc (DMARC1), _smtp._tls (TLSRPTv1)"
