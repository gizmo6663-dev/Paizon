# Paizon 🦉

Pedagogiske spill for barn – en enkel nettapp som fungerer på nettbrett, mobil og PC,
og som kan installeres på hjemskjermen og brukes uten nett (PWA).

## Spill

Ingen poeng, stjerner eller tidtaking – bare ros og konfetti når noe er riktig.

### 🔤 Stave ord
En voksen skriver inn ordene barnet skal stave, velger vanskelighetsgrad og trykker **Start**.
Barnet **drar** bokstavbrikkene til riktig boks. Når en brikke plukkes opp, sies **bokstavlyden**
(«t», ikke «te»). Når ordet er ferdig, staves det høyt med bokstavlyder – «k–a–t–t» – boks for boks,
før hele ordet leses opp.

| Vanskelighetsgrad | Hjelpebokstav i boksen | Ekstra «lurebokstaver» | Hint-knapp |
|---|---|---|---|
| 🐣 Lett | Vises svakt fra start | 0 | Ja |
| 🦊 Middels | Dukker opp svakt etter 2 feil forsøk i boksen (kan endres) | 2 | Ja |
| 🦁 Vanskelig | Aldri | 4 | Nei |

Andre funksjoner: bilde (emoji) for vanlige ord, ferdige og egne ordlister, STORE/små bokstaver,
bland rekkefølgen, barnets navn i rosen. Under **🔈 Bokstavlyder** kan man lytte til alle lydene og
holde inne 🎙️ for å spille inn sin egen stemme for en bokstav.

### 🔢 Telle
Barnet trykker på tingene for å telle dem høyt (hver ting får et tall), og velger så riktig tall
blant tre. 💡 teller sammen med barnet. Velg tall opp til 5, 10 eller 20.

### 🧩 Memory
Snu to kort om gangen og finn like par (3–10 par). Temaer: dyr, mat, ting, natur eller blandet.
Ordet kan vises under bildet og leses opp når kortet snus – en fin kobling til lesing.

### 🎨 Farger og former
Appen sier for eksempel «Finn den røde sirkelen» eller «Finn det gule hjertet». Øv på farger,
former eller begge. Trykker barnet feil, forteller appen hva det trykket på («Det er en blå trekant»).

### 🧱 Byggeklosser
Fysikk med [Matter.js](https://brm.io/matter-js/): dra store klosser, planker, søyler, trekanter og baller inn fra
kassen nederst, flytt dem med fingeren og vri dem med ⟲ ⟳. Dra en kloss til 🗑️ for å fjerne den.
- **Fri bygging** – bygg hva du vil, og test byggverket med 🌋 jordskjelv.
- **Høyt tårn** – bygg opp til streken og få tårnet til å stå stødig i to sekunder (3 nivåer).
- **Bygg en bro** – bygg over kløften og trykk ▶; kula triller av seg selv og må komme over til flagget.
  Nivå 3 krever en søyle i kløften.

### 💧 Væskelek
En ren væskesimulator (partikkelbasert, egen kode i `js/fluid.js`). Rør med fingeren, hell inn væske og
tørk opp med svampen.
- **Vann og olje** kan være i karet samtidig. De blander seg ikke, og olje flyter opp.
- **Fargene på vann** blandes som maling – blå og gul blir grønn.
- **Kraner** sitter på veggene eller i taket og dras dit man vil. Trykk på en kran for å skru den av og
  på, og juster strålen med glidebryteren. Strålen er tynn, og renner med valgt væske og farge.
- **Skål, halvmåne, planke og kloss** leder væsken. De flyttes fritt og vris med ↻-håndtaket.
- **Sluket** er den svarte streken i bunnen. Trykk på den for å sette i (eller ta ut) proppen.
- Tyngdekraften kan peke ned, være av (vektløst) eller styres ved å **vippe telefonen**.

### 🁢 Domino
Trykk eller dra med fingeren for å sette opp brikker på bakken eller på planker – dra gir en rad med
jevn avstand. Trykk 👉 (eller på en brikke) for å dytte, og ↺ for å sette alt opp igjen der det sto.
Legg ut planker og baller, flytt ting med ✋ og fjern med 🧽.
- **Fri lek** – så mange brikker du vil.
- **Ring bjella** (3 nivåer) – flat bakke, ned en trapp, og over et hull som må dekkes med en planke.

### 🎱 Kulebane
Legg ut planker, korte planker, buer, trakter og trampoliner. Dra for å flytte, vri med ↻, og trykk ▶
for å slippe kuler fra røret.
- **Fri bane** – bygg og slipp så mange kuler du vil.
- **Treff koppen** (4 nivåer) – led kula ned i koppen, også rundt hyller og over en mur.

### Felles
- Lyd kan slås av, og alt leses opp med norsk talesyntese når enheten har det
- 🏠-knappen i spillene må holdes inne i ett sekund, så barnet ikke avslutter ved et uhell
- Innstillingene huskes på enheten

## Bokstavlydene

Lydfilene i `sounds/letters/` er laget med [espeak-ng](https://github.com/espeak-ng/espeak-ng) sin
norske stemme (myk kvinnevariant, `nb+Annie`) ut fra fonemer, slik at de blir lyder og ikke bokstavnavn. De lages på nytt med:

```bash
scripts/generate-letter-sounds.sh   # krever espeak-ng og ffmpeg
```

Talesyntese gir en litt robotaktig stemme. Den beste kvaliteten får man ved å spille inn egne lyder i appen.

## Kjøre lokalt

Ingen byggesteg – det er ren HTML, CSS og JavaScript.

```bash
npm start      # starter en lokal server på http://localhost:8080
npm test       # kjører enhetstester for spill-logikken
```

`index.html` kan også åpnes direkte i nettleseren, men offline-støtte krever at appen serveres over http(s).

## Android-app (APK)

Appen pakkes som Android-app med [Capacitor](https://capacitorjs.com/). Nettappen kopieres til `www/`
og legges inn i det native prosjektet i `android/`.

**Enklest – last ned fra GitHub:** Arbeidsflyten *Bygg Android-APK* bygger en APK ved hver push og
pull request. Åpne kjøringen under *Actions* og last ned artefakten `paizon-apk`.
Lager du en tag som `v1.0.0`, legges APK-en også ved en GitHub-release.
Installer filen på telefonen/nettbrettet (tillat «installer ukjente apper» for nettleseren eller filbehandleren).

**Bygge selv** (krever Node 22, JDK 21 og Android SDK, f.eks. via Android Studio):

```bash
npm install
npm run android:apk    # → android/app/build/outputs/apk/debug/app-debug.apk
npm run android:open   # åpner prosjektet i Android Studio
```

I appen brukes enhetens innebygde talemotor til opplesning, og tilbake-knappen går tilbake til
forrige skjerm (i spillet må 🏠 fortsatt holdes inne). Velg gjerne norsk stemme under
*Innstillinger → Tekst til tale* på enheten.

APK-en er signert med en debug-nøkkel og egner seg for egen bruk. For Google Play trengs en egen
opplastingsnøkkel og `assembleRelease`/`bundleRelease`.

## Publisere på nett

Repoet inneholder en GitHub Actions-arbeidsflyt som publiserer appen til GitHub Pages.
Slå på Pages under *Settings → Pages → Source: GitHub Actions*.

## Struktur

```
index.html          Skjermer: forside, oppsett, spill, resultat
css/style.css       Utseende
js/logic.js         Ren spill-logikk (testes med node --test)
js/media.js         Lydeffekter, bokstavlyder, opptak, opplesning og konfetti
js/core.js          Felles skall: skjermer, lagring, innstillinger, ferdigskjerm
js/games/*.js       Ett skript per spill (spell, count, memory, shapes, build, liquid, domino, marble)
js/physics-kit.js   Felles hjelpere for domino og kulebane (Matter.js-scene, tegning, nivå klart)
js/fluid.js         Væskesimulatoren (testes med node --test)
js/vendor/          Matter.js 0.20.0 (MIT) for byggeklosser, domino og kulebane
sounds/letters/     Bokstavlyder (mp3)
sw.js               Service worker for offline-bruk
scripts/build-web.mjs  Kopierer nettappen til www/ (brukes av Capacitor og Pages)
capacitor.config.json  Oppsett for Android-appen
android/            Native Android-prosjekt (Capacitor)
assets/             Kildebilder for app-ikon og oppstartsbilde
```

Nye spill legges til som et kort på forsiden, skjermer i `index.html` og et skript i `js/games/`
som registrerer seg med `Paizon.registerGame`.
