/*
 * Himmelen – innhold: høydeskala, landskapet under (hav, by, skog og fjell), fugler, vær og
 * ting i lufta, og oppdrag.
 *
 * Verden måles i skjermhøyder (u) over bakken. ALT_SCALE gjør om mellom u og meter, slik at
 * de lave høydene (der de fleste fuglene er) får mest plass.
 * Lastes som <script> (window.PaizonSkyData) og med require() i testene.
 */
(function (root) {
  'use strict';

  const WORLD = { width: 40, top: 12 };

  // [u, meter]
  const ALT_SCALE = [[0, 0], [0.5, 30], [1.5, 150], [3, 600], [4.6, 1500], [6.4, 3000], [8.4, 6000], [10.6, 11000], [12, 15000]];

  function altAt(u) {
    if (u <= 0) return 0;
    for (let i = 1; i < ALT_SCALE.length; i++) {
      const [u0, m0] = ALT_SCALE[i - 1];
      const [u1, m1] = ALT_SCALE[i];
      if (u <= u1) return m0 + ((u - u0) / (u1 - u0)) * (m1 - m0);
    }
    return ALT_SCALE[ALT_SCALE.length - 1][1];
  }
  function uAt(m) {
    if (m <= 0) return 0;
    for (let i = 1; i < ALT_SCALE.length; i++) {
      const [u0, m0] = ALT_SCALE[i - 1];
      const [u1, m1] = ALT_SCALE[i];
      if (m <= m1) return u0 + ((m - m0) / (m1 - m0)) * (u1 - u0);
    }
    return ALT_SCALE[ALT_SCALE.length - 1][0];
  }

  /** Landskapet under: hav (0–6), by med hager (6–14), skog (14–24) og fjell (24–40). */
  const LAND = [
    { key: 'hav', name: 'Havet', from: 0, to: 6 },
    { key: 'by', name: 'Byen', from: 6, to: 14 },
    { key: 'skog', name: 'Skogen', from: 14, to: 24 },
    { key: 'fjell', name: 'Fjellet', from: 24, to: 40 },
  ];
  /** Hvor høyt bakken er (meter) ved x. */
  function groundAt(x) {
    if (x < 6) return 0;
    if (x < 14) return 4;
    if (x < 24) {
      const t = (x - 14) / 10;
      return 10 + 90 * t + Math.sin(x * 1.7) * 15 * t;
    }
    // Fjell: to topper med et skar imellom.
    const p1 = 1850 * Math.exp(-Math.pow((x - 29) / 2.6, 2));
    const p2 = 1600 * Math.exp(-Math.pow((x - 35.5) / 2.4, 2));
    const base = 120 + (x - 24) * 25;
    return Math.max(base, p1, p2) + Math.sin(x * 3.1) * 25;
  }
  function landAt(x) {
    return LAND.find((l) => x >= l.from && x < l.to) || LAND[LAND.length - 1];
  }

  const ZONES = [
    { key: 'hagen', name: 'Hagen og hustakene', from: 0, to: 30, intro: 'Her nede flyr småfuglene mellom trærne, takene og hagene.' },
    { key: 'skogtopp', name: 'Over tretoppene', from: 30, to: 150, intro: 'Nå er vi over tretoppene. Her jakter svalene på insekter.' },
    { key: 'fjell', name: 'Fjellhøyde', from: 150, to: 1500, intro: 'Nå er vi like høyt som fjellene. Her svever ørnene på varm luft.' },
    { key: 'skyer', name: 'Blant skyene', from: 1500, to: 5000, intro: 'Nå er vi oppe blant skyene. Skyer er laget av bitte små vanndråper.' },
    { key: 'hoyt', name: 'Høyt der flyene flyr', from: 5000, to: 13000, intro: 'Her oppe er lufta tynn og iskald. Det er her flyene flyr.' },
    { key: 'rommet', name: 'Kanten av verdensrommet', from: 13000, to: 99999, intro: 'Himmelen blir mørk, og vi ser stjernene. Lenger opp begynner verdensrommet!' },
  ];
  function zoneAt(m) {
    for (const z of ZONES) if (m < z.to) return z;
    return ZONES[ZONES.length - 1];
  }

  /*
   * Fugler og ting. alt: høyde i meter (fra–til). x: hvor. kind: tegning (creatures.js eller
   * sky/art.js). pose: fly | glide | perch. flock: antall i flokken. vee: flyr i V.
   * weather: når de finnes ('dag' = sol og skyer, 'natt', eller en liste).
   */
  const SPECIES = [
    {
      key: 'spurv', name: 'Gråspurv', sci: 'Passer domesticus', kind: 'spurv', x: [6.5, 13.5], alt: [2, 25], pose: 'fly', flock: 4, count: 2, sound: 'spurv', weather: 'dag',
      facts: 'Gråspurven bor der folk bor – i byer, hager og på gårder. Den lever i flokk og kvitrer mye. Spurven bader gjerne i støv for å bli kvitt småkryp i fjærene.',
    },
    {
      key: 'kjottmeis', name: 'Kjøttmeis', sci: 'Parus major', kind: 'kjottmeis', x: [7, 14], alt: [3, 20], pose: 'fly', count: 3, sound: 'meis', weather: 'dag',
      facts: 'Kjøttmeisa er en vanlig gjest på fuglebrettet om vinteren. Den har gul mage og et svart «slips» på brystet. Den er nysgjerrig og lærer fort nye triks for å finne mat.',
    },
    {
      key: 'skjaere', name: 'Skjære', sci: 'Pica pica', kind: 'skjaere', x: [6, 15], alt: [3, 40], pose: 'fly', count: 2, sound: 'skjaere', weather: 'dag',
      facts: 'Skjæra er svart og hvit med en lang hale som skinner blågrønt i sola. Den er en av de smarteste fuglene som finnes – den kan kjenne seg selv igjen i et speil.',
    },
    {
      key: 'kraake', name: 'Kråke', sci: 'Corvus cornix', kind: 'kraake', x: [5, 24], alt: [5, 120], pose: 'fly', count: 3, sound: 'kraake', weather: 'dag',
      facts: 'Kråka er grå og svart og veldig lur. Den kan slippe muslinger ned på steiner for å knuse skallet, og den husker ansiktene til folk den har møtt.',
    },
    {
      key: 'svale', name: 'Låvesvale', sci: 'Hirundo rustica', kind: 'svale', x: [6, 18], alt: [5, 100], pose: 'fly', flock: 3, count: 2, sound: 'svale', weather: ['dag'],
      facts: 'Låvesvala har lang, kløftet hale og flyr lavt og raskt for å fange insekter i lufta. Hver høst flyr den helt til Afrika, og om våren kommer den tilbake til det samme reiret.',
    },
    {
      key: 'taarnseiler', name: 'Tårnseiler', sci: 'Apus apus', kind: 'taarnseiler', x: [6, 20], alt: [40, 600], pose: 'fly', flock: 5, count: 1, sound: 'svale', weather: 'dag',
      facts: 'Tårnseileren tilbringer nesten hele livet i lufta. Den spiser, drikker og sover mens den flyr – og kan være i lufta i ti måneder uten å lande en eneste gang!',
    },
    {
      key: 'make', name: 'Gråmåke', sci: 'Larus argentatus', kind: 'make', x: [0, 9], alt: [5, 300], pose: 'glide', count: 4, sound: 'make', weather: ['dag', 'natt'],
      facts: 'Måken er en dyktig seiler som nesten ikke trenger å flakse. Den glir på vinden langs kysten og ser etter fisk og mat. Måker kan drikke saltvann, for de har en egen kjertel som fjerner saltet.',
    },
    {
      key: 'havorn', name: 'Havørn', sci: 'Haliaeetus albicilla', kind: 'havorn', x: [0, 8], alt: [80, 900], pose: 'glide', count: 1, sound: 'orn', weather: 'dag',
      facts: 'Havørna er Norges største rovfugl. Vingene er over to meter fra spiss til spiss – som en dør! Den har hvit hale og stort gult nebb, og fanger fisk i havet.',
    },
    {
      key: 'kongeorn', name: 'Kongeørn', sci: 'Aquila chrysaetos', kind: 'kongeorn', x: [24, 39], alt: [300, 2600], pose: 'glide', count: 2, sound: 'orn', weather: 'dag',
      facts: 'Kongeørna bor i fjellet. Den svever i sirkler på varm luft som stiger, og kan se en hare på flere kilometers avstand. Den bygger store reir på bratte fjellhyller.',
    },
    {
      key: 'fjellvaak', name: 'Fjellvåk', sci: 'Buteo lagopus', kind: 'fjellvaak', x: [20, 34], alt: [100, 1200], pose: 'glide', count: 1, sound: 'orn', weather: 'dag',
      facts: 'Fjellvåken kan stå helt stille i lufta ved å flakse mot vinden, mens den speider etter lemen og mus. Når det er mange lemen i fjellet, får fjellvåken mange unger.',
    },
    {
      key: 'ravn', name: 'Ravn', sci: 'Corvus corax', kind: 'ravn', x: [14, 38], alt: [50, 1800], pose: 'fly', count: 2, sound: 'ravn', weather: 'dag',
      facts: 'Ravnen er den største kråkefuglen. Den er helt svart, sier «krokk» med dyp stemme, og liker å leke i lufta: den kan fly opp ned og slippe pinner som den fanger igjen.',
    },
    {
      key: 'lerke', name: 'Sanglerke', sci: 'Alauda arvensis', kind: 'lerke', x: [10, 20], alt: [40, 150], pose: 'fly', count: 1, sound: 'lerke', weather: 'dag',
      facts: 'Sanglerka stiger rett opp mot himmelen mens den synger uten stopp, i flere minutter. Høyt oppe ser den ut som en liten prikk, men sangen hører vi godt helt nede på bakken.',
    },
    {
      key: 'gaas', name: 'Grågås', sci: 'Anser anser', kind: 'gaas', x: [2, 38], alt: [600, 3500], pose: 'fly', flock: 9, vee: true, count: 1, sound: 'gaas', weather: 'dag',
      facts: 'Gjess flyr i V når de trekker sørover om høsten. Den som flyr først, gjør det litt lettere for de andre å fly, og så bytter de på å være først. De roper til hverandre hele veien.',
    },
    {
      key: 'trane', name: 'Trane', sci: 'Grus grus', kind: 'trane', x: [10, 36], alt: [1200, 4000], pose: 'fly', flock: 6, vee: true, count: 1, sound: 'trane', weather: 'dag', secret: true,
      facts: 'Trana er en stor fugl med lange bein og en rød flekk på hodet. Om våren danser tranene: de hopper, bukker og flakser med vingene. Når de trekker, kan de fly svært høyt.',
    },
    {
      key: 'ugle', name: 'Kattugle', sci: 'Strix aluco', kind: 'ugle', x: [14, 24], alt: [5, 60], pose: 'perch', count: 1, sound: 'ugle', weather: 'natt',
      facts: 'Kattugla jakter om natta. Fjærene er så myke at den flyr helt lydløst, og ørene er så gode at den finner musene i mørket bare ved å lytte.',
    },
    {
      key: 'flaggermus', name: 'Flaggermus', sci: 'Chiroptera', kind: 'flaggermus', x: [6, 22], alt: [3, 50], pose: 'fly', count: 3, weather: 'natt',
      facts: 'Flaggermus flyr om natta og fanger insekter. De sender ut lyder som er for lyse for oss å høre, og lytter etter ekkoet – slik «ser» de med ørene.',
    },
    // Ting og vær.
    {
      key: 'bomullssky', name: 'Bomullssky', sci: 'Cumulus', kind: 'cumulus', thing: true, weather: 'dag',
      facts: 'Bomullsskyene er laget av millioner av bitte små vanndråper. De dannes når varm luft stiger opp og blir avkjølt. En helt vanlig sky kan veie like mye som hundre elefanter!',
    },
    {
      key: 'tordensky', name: 'Tordensky', sci: 'Cumulonimbus', kind: 'storm', thing: true, weather: ['skyer'],
      facts: 'Tordenskyen er den største skyen av alle – den kan bli over ti kilometer høy. Inne i den gnis is og vanndråper mot hverandre, og da blir det lyn. Tordenet er lyden av lynet.',
    },
    {
      key: 'fjaersky', name: 'Fjærsky', sci: 'Cirrus', kind: 'cirrus', thing: true, weather: 'dag',
      facts: 'Fjærskyene ligger svært høyt oppe, der det er så kaldt at skyene er laget av iskrystaller. De ser ut som tynne hårstrå eller fjær på himmelen.',
    },
    {
      key: 'regnbue', name: 'Regnbue', sci: '', kind: 'rainbow', thing: true, weather: ['skyer'],
      facts: 'En regnbue kommer når sola skinner på regndråper. Hver dråpe deler sollyset i alle fargene: rødt, oransje, gult, grønt, blått og fiolett. Du ser alltid regnbuen med sola i ryggen.',
    },
    {
      key: 'luftballong', name: 'Luftballong', sci: '', kind: 'balloon', thing: true, weather: 'dag',
      facts: 'En luftballong flyr fordi lufta inni ballongen blir varmet opp av en brenner. Varm luft er lettere enn kald luft, så ballongen stiger. Den kan ikke styres – den følger vinden.',
    },
    {
      key: 'drage', name: 'Drage', sci: '', kind: 'kite', thing: true, weather: 'dag',
      facts: 'En drage holdes oppe av vinden som blåser mot den. Snora gjør at den står på skrå mot vinden – akkurat som vingene på en fugl eller et fly.',
    },
    {
      key: 'fly', name: 'Passasjerfly', sci: '', kind: 'plane', thing: true, weather: ['dag', 'skyer', 'natt'],
      facts: 'Store fly flyr omtrent ti kilometer over bakken, høyere enn de fleste skyer. Den hvite stripa bak flyet kalles kondensstripe. Den er laget av vanndamp fra motorene som fryser til is.',
    },
    {
      key: 'nordlys', name: 'Nordlys', sci: 'Aurora borealis', kind: 'aurora', thing: true, weather: ['natt'],
      facts: 'Nordlyset blir til når partikler fra sola treffer lufta høyt over jorda – mye høyere enn flyene. Da lyser lufta grønt og noen ganger rosa. I Nord-Norge kan man se det mange netter om vinteren.',
    },
    {
      key: 'stjerneskudd', name: 'Stjerneskudd', sci: 'Meteor', kind: 'meteor', thing: true, weather: ['natt'], secret: true,
      facts: 'Et stjerneskudd er ikke en stjerne, men et lite stykke stein fra verdensrommet som brenner opp når det suser inn i lufta vår. De fleste er ikke større enn et sandkorn!',
    },
  ];

  const MISSIONS = [
    { key: 'svale', text: 'Finn fuglen med kløftet hale som fanger insekter i lufta', icon: '🐦', species: ['svale', 'taarnseiler'] },
    { key: 'h150', text: 'Fly opp over tretoppene', icon: '🌲', alt: 150 },
    { key: 'orn', text: 'Finn en ørn', icon: '🦅', species: ['havorn', 'kongeorn'] },
    { key: 'sky', text: 'Fly gjennom en sky', icon: '☁️', cloud: true },
    { key: 'v', text: 'Finn fuglene som flyr i V', icon: '🪿', species: ['gaas', 'trane'] },
    { key: 'regnbue', text: 'Finn regnbuen', icon: '🌈', species: ['regnbue'], hint: 'Trykk på værknappen og velg skyer og regn.' },
    { key: 'fly', text: 'Fly helt opp dit flyene flyr', icon: '✈️', alt: 9000 },
    { key: 'nordlys', text: 'Finn nordlyset', icon: '🌌', species: ['nordlys'], hint: 'Trykk på værknappen og velg natt.' },
  ];

  /** Finnes arten i dette været? */
  function present(sp, weather) {
    const w = sp.weather;
    if (!w) return true;
    const list = Array.isArray(w) ? w : w === 'dag' ? ['sol', 'skyer'] : [w];
    return list.includes(weather) || (list.includes('dag') && weather !== 'natt');
  }

  const api = { WORLD, ALT_SCALE, altAt, uAt, LAND, groundAt, landAt, ZONES, zoneAt, SPECIES, MISSIONS, present };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PaizonSkyData = api;
})(typeof window !== 'undefined' ? window : globalThis);
