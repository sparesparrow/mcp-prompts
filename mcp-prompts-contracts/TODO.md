# MCP Prompts Contracts - TODO

## Úkoly pro migraci a vývoj

### Fáze 1: Základní nastavení
- [ ] Vytvořit package.json s potřebnými závislostmi
- [ ] Nastavit TypeScript konfiguraci
- [ ] Přidat Zod jako závislost pro schémata
- [ ] Vytvořit build skripty

### Fáze 2: API Definice
- [ ] Převést všechny typy na Zod schémata
- [ ] Vytvořit OpenAPI specifikaci z Zod schémat
- [ ] Přidat validaci pro všechny API endpointy
- [ ] Vytvořit TypeScript typy z Zod schémat

### Fáze 3: CI/CD Pipeline
- [ ] Nastavit GitHub Actions pro lint, test a build
- [ ] Přidat automatickou validaci schémat proti příkladům
- [ ] Konfigurovat automatické publikování NPM balíčku
- [ ] Přidat repository_dispatch event na meta-repo při release

### Fáze 4: Dokumentace
- [ ] Vytvořit API dokumentaci
- [ ] Přidat příklady použití
- [ ] Vytvořit migrační průvodce pro existující implementace

### Fáze 5: Testování
- [ ] Vytvořit unit testy pro schémata
- [ ] Přidat integrační testy s ostatními repozitáři
- [ ] Otestovat kompatibilitu s existujícími implementacemi 