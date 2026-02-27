#!/bin/bash
DOMAIN="https://prospectorai.innexar.com.br"
EMAIL="teste@teste.com"
PASSWORD="senha_errada_de_proposito"

echo "1. Getting CSRF token..."
CSRF_RESPONSE=$(curl -s -c cookies.txt "$DOMAIN/api/auth/csrf")
CSRF_TOKEN=$(echo $CSRF_RESPONSE | sed 's/.*"csrfToken":"\([^"]*\)".*/\1/')
echo "CSRF Token: $CSRF_TOKEN"

echo "2. Performing Login..."
curl -v -X POST -b cookies.txt -c cookies.txt "$DOMAIN/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=$EMAIL&password=$PASSWORD&csrfToken=$CSRF_TOKEN&redirect=false"
