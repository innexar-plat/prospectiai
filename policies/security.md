# Security Policy

## Auto-Checklist

- [ ] OWASP Top 10 (XSS, CSRF, Injection, etc.)
- [ ] Hardcoded secrets? (Redis password, API keys)
- [ ] Dependency audit (npm audit)
- [ ] Permission review (RBAC, middleware)
- [ ] Rate limiting configurado?
- [ ] Security headers (CSP, HSTS, X-Frame-Options)?
- [ ] Encryption em dados sensíveis?
- [ ] resetToken em plaintext? (deve ser hash)

## Known Hotspots

1. Redis password hardcoded em docker-compose.yml:223
2. resetToken armazenado plaintext no DB
3. JWT 30-day sem revogação
4. Static salt em email-config-encrypt.ts
5. Redis protected-mode no em docker/redis.conf
