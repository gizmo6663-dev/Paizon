# Paizon 🦉

Pedagogiske spill for barn – en enkel nettapp som fungerer på nettbrett, mobil og PC,
og som kan installeres på hjemskjermen og brukes uten nett (PWA).

## Spill

### 🔤 Stave ord
En voksen skriver inn ordene barnet skal stave, velger vanskelighetsgrad og trykker **Start**.
Barnet setter bokstavbrikker i riktig boks – ved å trykke, dra og slippe, eller skrive på tastaturet.

| Vanskelighetsgrad | Hjelpebokstav i boksen | Ekstra «lurebokstaver» | Hint-knapp |
|---|---|---|---|
| 🐣 Lett | Vises svakt fra start | 0 | Ja |
| 🦊 Middels | Dukker opp svakt etter 2 feil forsøk i boksen (kan endres) | 2 | Ja |
| 🦁 Vanskelig | Aldri | 4 | Nei |

Andre funksjoner:
- Flere ord per runde, fremdriftsprikker og resultatskjerm med 1–3 stjerner per ord
- Opplesning av ordet (talesyntese på norsk når enheten har det), og valgfritt av hver bokstav
- Bilde (emoji) for vanlige ord som *katt*, *sol*, *eple* og fargene
- Ferdige ordlister (dyr, mat, farger, familie, Æ/Ø/Å …) og egne lagrede lister
- STORE eller små bokstaver, bland rekkefølgen, antall ekstra bokstaver, barnets navn i rosen
- Lydeffekter og konfetti – lyd kan slås av
- 🏠-knappen i spillet må holdes inne i ett sekund, så barnet ikke avslutter ved et uhell
- Statistikk over stjerner og ord lagres lokalt på enheten

## Kjøre lokalt

Ingen byggesteg – det er ren HTML, CSS og JavaScript.

```bash
npm start      # starter en lokal server på http://localhost:8080
npm test       # kjører enhetstester for spill-logikken
```

`index.html` kan også åpnes direkte i nettleseren, men offline-støtte krever at appen serveres over http(s).

## Publisere

Repoet inneholder en GitHub Actions-arbeidsflyt som publiserer appen til GitHub Pages.
Slå på Pages under *Settings → Pages → Source: GitHub Actions*.

## Struktur

```
index.html          Skjermer: forside, oppsett, spill, resultat
css/style.css       Utseende
js/logic.js         Ren spill-logikk (testes med node --test)
js/media.js         Lyd, opplesning og konfetti
js/app.js           Skjermstyring og «Stave ord»-spillet
sw.js               Service worker for offline-bruk
```

Nye spill legges til som et nytt kort på forsiden og en egen skjerm.
