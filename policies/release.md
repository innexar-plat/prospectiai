# Release Policy

## Pre-Release Checklist

- [ ] Versionamento semântico (SemVer)
- [ ] CHANGELOG.md atualizado
- [ ] Breaking changes documentados
- [ ] Release notes geradas
- [ ] Build passa
- [ ] Tests passam
- [ ] Security review ok
- [ ] Rollback plan documentado

## Auto Release Manager

O AI Release Manager prepara:
- Version bump (major/minor/patch)
- CHANGELOG entry
- Release notes
- Tag + GitHub Release
- Deploy trigger

## Estratégia

- Canary releases para mudanças arriscadas
- Blue-green para infra
- Zero downtime migration para banco
- Rollback testado antes do deploy
