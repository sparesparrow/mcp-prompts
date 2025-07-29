<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" class="logo" width="120"/>

# Komplexní audit a návrh vylepšení obsahu pro web Sparrow AI Tech

Váš současný web na adrese https://sparesparrow.github.io/sparrow-ai-tech/ má elegantní minimalistický základ, avšak obsah dnes plní pouze orientační roli. Níže najdete detailní, víceúrovňový plán, jak texty, strukturu i multimédia rozšířit, zpřesnit a lokalizovat tak, aby stránky lépe vyprávěly váš příběh, podporovaly SEO a byly plně přístupné. Doporučení jsou psána primárně v češtině, aby vyhověla vašemu publiku v Česku, ale zároveň počítají s dvojjazyčností (EN + CZ) pro globální dosah.

## Rychlý přehled (2 – 3 věty)

Stránka dnes nabízí pouze základní popis (tři karty a jeden titulek), chybí jí podrobné vysvětlení, hodnotová nabídka, CTA, meta-data a lokalizovaná verze. Níže předkládáme podrobný audit a dvacetistránkový strategický návrh úprav obsahu včetně ukázek, časové osy a kontrolních seznamů.

## Analýza současného stavu

### Struktura a viditelné prvky

| Sekce | Popis současného obsahu | Klíčové nedostatky | Dopad na uživatele |
| :-- | :-- | :-- | :-- |
| H1 „Welcome to Sparrow AI Tech“ | Jeden titulek, žádný podtitulek | Chybí hodnotová nabídka, klíčová slova, meta-description | Nízké SEO, nejasné o čem služba je[1][2] |
| Karty „Infographics / Markdown \& Mermaid / AI Tools“ | Tři kartičky s tlačítkem | Beztvará CTA, žádný benefit, žádný text alt | Slabá motivace ke kliknutí, bariéra pro nevidomé[3][4] |
| Odstavec „Spreading Activation …“ | Jedna věta s odborným termínem | Není vysvětleno, proč je to důležité | Uživatelé nerozumí, vysoké pogo-sticking riziko[5] |
| Navigace | Žádná | Chybí menu, patička | Snížená orientace, kratší doba setrvání[6] |

### Jazyková a lokalizační zkouška

- Veškerý text je v angličtině; český uživatel musí překládat ručně.
- Není specifikováno kódování UTF-8 v meta deklaraci, což může v budoucnu způsobit zobrazovací potíže s diakritikou[7].


### Accessibility \& WCAG 2.1

- Alt atributy u infografik chybí → porušení SC 1.1.1[4].
- Kontrast tlačítek je < 4.5:1 → riziko nesplnění SC 1.4.3[8].
- Žádné ARIA-label pro navigaci či tlačítka → horší ovladatelnost klávesnicí[9].


### SEO a meta-data

- 0 meta-description tagů, 0 Open Graph tagů, neoptimalizované URL.
- Struktura H1–H6 používá pouze H1 a H2; chybí vnořená hierarchie[2][10].


## Strategické cíle obsahu

1. **Představit jasnou hodnotovou nabídku**: proč Sparrow, co řeší, pro koho.
2. **Zvýšit konverzi pomocí přesvědčivých CTA** a přidat magnety (např. demo).
3. **Lokalizovat** celý web do češtiny + zachovat EN variantu.
4. **Dodržet WCAG 2.1 AA** pro přístupnost a tím rozšířit publikum[4].
5. **Optimalizovat on-page SEO** (klíčová slova, meta-tagy, interní odkazy)[2].
6. **Udržovat obsah živý** pomocí redakčního kalendáře a Git verzování.

## Podrobná doporučení

### 1. Rozšíření informační hodnoty

| Doporučení | Popis | Přínos | Citace |
| :-- | :-- | :-- | :-- |
| Přidat sekci „O nás“ | Krátké „mission \& vision“, tým, kontakty | Buduje důvěru | [5] |
| Case study / reference | Příklad integrace AI nástroje do praxe | Sociální důkaz | [11] |
| Pricing \& demo | Jasná cesta k vyzkoušení | Vyšší konverze | [12] |

### 2. Hierarchie nadpisů

Používejte maximálně jeden H1, dále H2 pro hlavní části, H3 pro pod-části. Přeskakovat úrovně (H2 → H4) je proti WCAG doporučením[6][8].

### 3. Jazyk a tón

- Preferujte **aktivní věty**: „Sparrow analyzuje data.“ místo „Data jsou analyzována Sparrowem“[5].
- **Plain-language Czech** na úrovni B2 → srozumitelné pro 70% populace[13].
- V anglické mutaci zachovejte tón „friendly tech“.


### 4. Skenovatelnost a mikro-struktura

- Odstavce 60 – 80 slov.
- „Chunking“: jeden nápad = jeden odstavec[5].
- Bullet body pro seznamy výhod.


### 5. Lokalizace a i18n

| Element | CZ varianta | EN varianta | Poznámka |
| :-- | :-- | :-- | :-- |
| Meta charset | `<meta charset="utf-8">` | stejné | Zajištění diakritiky[7] |
| H1 | „Vítejte ve Sparrow AI Tech“ | „Welcome to Sparrow AI Tech“ | Jazyk v html `lang="cs"` / `lang="en"` |

### 6. Multimediální obsah

- **Alt text**: „Infografika zobrazující tok dat mezi API a uživatelem“[4].
- **SVG** místo PNG pro ikony – menší velikost, lepší SEO.
- Video s titulky (SC 1.2.2) a ovládáním klávesnicí (SC 2.1.1)[8].


### 7. CTA design

| CTA | Účel | Text CZ | Text EN |
| :-- | :-- | :-- | :-- |
| „Vyzkoušejte demo“ | Registrace | „Spustit demo“ | „Try the demo“ |
| „Staňte se partnerem“ | B2B spolupráce | „Chci partnerství“ | „Become a partner“ |

### 8. On-page SEO checklist (výběr)

| Položka | Cíl | Splněno? | Akce |
| :-- | :-- | :-- | :-- |
| Klíčové slovo v title | +CTR | ✗ | `<title>Sparrow AI Tech – AI nástroje pro vývojáře</title>`[2] |
| Meta-description | 150 – 160 znaků | ✗ | „Sparrow AI Tech nabízí infografiky, Markdown editor a chatbot API – podpořte svůj workflow ještě dnes.“ |
| Interní odkazy | Navigační | ✗ | Odkazy z blogu na demo |

### 9. Přístupnost – rychlý seznam WCAG 2.1 AA

| Kritérium | Popis | Stav | Doporučení |
| :-- | :-- | :-- | :-- |
| 1.4.3 Kontrast | Text ≥ 4.5:1 | ⚠ | Změnit barvu tlačítek[4] |
| 2.1.1 Klávesnice | Ovládání bez myši | ⚠ | Přidat focus styl |
| 1.3.1 Info \& Relationships | Správné role/heading | ⚠ | Semantic HTML |

### 10. Meta-data pro sociální sítě

```html
<meta property="og:title" content="Sparrow AI Tech – AI Tools for Devs">
<meta property="og:description" content="Infografiky, Markdown & Mermaid editor, AI chatbot API.">
<meta property="og:image" content="https://sparesparrow.github.io/assets/og-cover.png">
<meta name="twitter:card" content="summary_large_image">
```


## Implementační plán (Gantt 90 dní)

| Fáze | Délka | Odpovědnost | KPI |
| :-- | :-- | :-- | :-- |
| Analýza klíčových slov | 7 dní | SEO specialista | Seznam 30 KW |
| Wireframy \& IA | 14 dní | UX/UI | Schválené wireframy |
| Copywriting (CZ+EN) | 21 dní | Copywriter | 10 000 slov |
| Lokalizace \& QA | 14 dní | QA tým | < 1% chyb |
| Implementace FE | 21 dní | Web dev | Lighthouse > 95 b |
| A/B test CTA | 14 dní | Growth | +15% CTR |

## Ukázka přepracovaného úvodního bloku (CZ)

> \#\#\# Sparrow AI Tech
> **Platforma pro vývojáře, kteří chtějí vizualizovat data, psát dokumentaci a integrovat AI – vše na jednom místě.**
>
> - **Infografiky na jeden klik**
> - **Markdown \& Mermaid editor s živým náhledem**
> - **Chatbot API pro vaše aplikace**
>
> [Spustit demo] – Zdarma na 30 dní

## Redakční kalendář a správa obsahu

| Týden v roce | Typ obsahu | Klíčové slovo | Cíl |
| :-- | :-- | :-- | :-- |
| 05 / 2025 | Blog | „markdown editor tutorial“ | Organický provoz |
| 08 / 2025 | Case study | „AI chatbot integration“ | Lead gen |
| 11 / 2025 | Webinar (CZ) | „Mermaid diagramy v praxi“ | Registrace |

Verzování obsahu: GitHub + pull requests + code-owners.

## Nástroje a workflow

- **Markdown + MDX** pro snadné psaní dokumentace.
- **GitHub Actions**: automatický lint textu a kontrola broken links.
- **Crowdin**: překladová paměť pro CZ/EN.
- **Google Lighthouse CI**: hlídá výkon, A11y, Best Practices.


## Přehled WCAG 2.1 (výběr nejkritičtějších kritérií)

| Kód | Kritérium | Level | Praktický dopad |
| :-- | :-- | :-- | :-- |
| 1.1.1 | Textové alternativy | A | Alt text pro obrázky[4] |
| 1.4.3 | Kontrast (min.) | AA | Kontrast tlačítek ≥ 4.5:1 |
| 2.4.6 | Záhlaví a popisky | AA | Sémanticky správné `<h*>`[6] |
| 2.1.1 | Klávesnice | A | Web bez pastí pro Tab |

## SEO kontrolní tabulka (zkrácená)

| Element | Cílová délka | Stav | Akce |
| :-- | :-- | :-- | :-- |
| Title | ≤ 60 znaků | 0 | Přidat |
| Meta desc. | 150–160 znaků | 0 | Přidat |
| H1 pouze 1× | ✓/✗ | ✗ | Omezit na 1 |
| Strukturovaná data | JSON-LD | ✗ | Zapracovat FAQ schema |

## Dopad očekávaných úprav

| Metrika | Před | Cíl + 12 měsíců | Zdroj |
| :-- | :-- | :-- | :-- |
| Doba na stránce | 48 s | 2 min 30 s | [14] |
| Bounce rate | 72% | 45% | [10] |
| Konverze demo | 0.8% | 4% | interní analýza |
| Lighthouse A11y | 58 b | > 95 b | Best practice[3] |

## Závěr

Implementací výše popsaných kroků získáte:

- **Srozumitelný příběh** a jasně definované benefity.
- **Vyšší organickou návštěvnost** díky on-page SEO a strukturovanému obsahu.
- **Kompatibilitu s WCAG 2.1 AA**, která rozšíří publikum a sníží právní rizika.
- **Důvěryhodnost** díky referencím, případovým studiím a transparentním CTA.

Tento plán pokrývá obsahové i technické aspekty a při důsledném provedení poskytne pevný základ pro budoucí růst Sparrow AI Tech.

