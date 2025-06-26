# MCP Prompts Android (AIDL) - TODO

## Úkoly pro migraci a vývoj

### Fáze 1: Inicializace
- [ ] Přesunout veškerý Android kód do android_app/
- [ ] Ověřit integraci s Rust službou
- [ ] Přidat AIDL rozhraní

### Fáze 2: CI/CD
- [ ] Nastavit build a testy v GitHub Actions
- [ ] Přidat Docker image pro testování
- [ ] Publikovat AAR knihovnu do Maven Central

### Fáze 3: Integrace
- [ ] Přidat Tasker profily
- [ ] Otestovat komunikaci přes AIDL
- [ ] Dokumentovat příklady použití 