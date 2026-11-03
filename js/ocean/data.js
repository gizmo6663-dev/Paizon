/*
 * Havet – innhold: soner, dybdeskala, havbunn, dyr med fakta, og oppdrag.
 *
 * Verden måles i «skjermhøyder» (vh): 1 vh = høyden på spillflaten. Overflaten er y = 0,
 * og y øker nedover. Dybden i meter regnes ut fra y med en stykkevis lineær skala, slik
 * at de grunne sonene (der det skjer mest) får mer plass enn det store, mørke dypet.
 *
 * Lastes som <script> (window.PaizonOceanData) og med require() i testene.
 */
(function (root) {
  'use strict';

  // [y i vh, dybde i meter]
  const DEPTH_SCALE = [
    [0, 0],
    [0.15, 5],
    [1.6, 40],
    [3.2, 200],
    [6, 1000],
    [8.6, 3000],
  ];

  const WORLD = { width: 8, height: 8.6, sky: 0.55 };

  function depthAt(y) {
    if (y <= 0) return 0;
    for (let i = 1; i < DEPTH_SCALE.length; i++) {
      const [y0, d0] = DEPTH_SCALE[i - 1];
      const [y1, d1] = DEPTH_SCALE[i];
      if (y <= y1) return d0 + ((y - y0) / (y1 - y0)) * (d1 - d0);
    }
    return DEPTH_SCALE[DEPTH_SCALE.length - 1][1];
  }

  function yAtDepth(d) {
    if (d <= 0) return 0;
    for (let i = 1; i < DEPTH_SCALE.length; i++) {
      const [y0, d0] = DEPTH_SCALE[i - 1];
      const [y1, d1] = DEPTH_SCALE[i];
      if (d <= d1) return y0 + ((d - d0) / (d1 - d0)) * (y1 - y0);
    }
    return DEPTH_SCALE[DEPTH_SCALE.length - 1][0];
  }

  // Havbunnen: fra fjæra til venstre, over kontinentalsokkelen, ned skråningen og ut i dyphavet.
  // [x i vh, havbunnens y i vh]
  const SEABED = [
    [0, 0.02],
    [0.35, 0.12],
    [0.9, 0.9],
    [1.4, 1.55],
    [2.2, 2.2],
    [3.2, 2.85],
    [3.9, 3.15],
    [4.4, 3.6],
    [4.9, 4.7],
    [5.5, 5.9],
    [6.2, 7.4],
    [7, 8.2],
    [8, 8.45],
  ];

  function seabedAt(x) {
    if (x <= SEABED[0][0]) return SEABED[0][1];
    for (let i = 1; i < SEABED.length; i++) {
      const [x0, y0] = SEABED[i - 1];
      const [x1, y1] = SEABED[i];
      if (x <= x1) {
        // Myk overgang (smoothstep) så bunnen ikke får knekker.
        const t = (x - x0) / (x1 - x0);
        const s = t * t * (3 - 2 * t);
        return y0 + s * (y1 - y0);
      }
    }
    return SEABED[SEABED.length - 1][1];
  }

  // Sonene etter dybde. light: hvor mye sollys som når ned (0–1).
  const ZONES = [
    { key: 'overflaten', name: 'Overflaten', from: 0, to: 10, intro: 'Vi er ved overflaten. Her er det lyst og varmt av sola.' },
    { key: 'tareskogen', name: 'Tareskogen', from: 10, to: 40, intro: 'Nå er vi i tareskogen. Tare er lange planter som vokser på bunnen, akkurat som en skog.' },
    { key: 'apenthav', name: 'Det åpne havet', from: 40, to: 200, intro: 'Nå er vi i det åpne havet. Her svømmer store stimer med fisk – og kanskje en hval!' },
    { key: 'skumring', name: 'Skumringssonen', from: 200, to: 1000, intro: 'Nå blir det mørkt. Vi er i skumringssonen. Her nede lager mange dyr sitt eget lys.' },
    { key: 'dypet', name: 'Dyphavet', from: 1000, to: 4000, intro: 'Nå er vi i dyphavet. Her er det helt mørkt og iskaldt hele året.' },
  ];

  function zoneAt(depth) {
    for (const z of ZONES) if (depth < z.to) return z;
    return ZONES[ZONES.length - 1];
  }

  /** Hvor mye dagslys som er igjen på en dybde (0–1). Lyset avtar raskt nedover. */
  function lightAt(depth) {
    return Math.max(0, Math.exp(-depth / 70));
  }

  /*
   * Dyr og ting. Felles felt:
   *  name, sci (vitenskapelig navn), zone, facts (lest opp i Lær), size (lengde i vh),
   *  kind: tegnemal i art.js, place: hvor de bor:
   *    { type: 'water', x: [fra, til], depth: [fra, til] }  – svømmer fritt
   *    { type: 'bottom', x: [fra, til] }                   – på havbunnen
   *    { type: 'sky', x: [fra, til] }                      – over overflaten
   *  count: hvor mange, school: antall i stimen (fisk som svømmer sammen),
   *  sound: lydfil i sounds/ocean/ (ekte opptak), glow: lyser i mørket,
   *  secret: dukker bare opp i Oppdag (sjelden).
   */
  const SPECIES = [
    {
      key: 'make', name: 'Måke', sci: 'Larus', zone: 'overflaten', kind: 'gull', size: 0.07,
      place: { type: 'sky', x: [0.3, 3.5] }, count: 3,
      facts: 'Måka svever over havet og ser etter mat. Den kan stupe ned i vannet for å fange småfisk. Måker kan faktisk drikke saltvann – de har en egen kjertel som fjerner saltet.',
    },
    {
      key: 'steinkobbe', name: 'Steinkobbe', sci: 'Phoca vitulina', zone: 'overflaten', kind: 'seal', size: 0.14,
      place: { type: 'water', x: [0.6, 2.4], depth: [1, 12] }, count: 2,
      facts: 'Steinkobben er en sel som bor langs kysten vår. Den er flink til å dykke og kan holde pusten lenge mens den jakter fisk. Når den er mett, ligger den og slapper av på en stein.',
    },
    {
      key: 'brennmanet', name: 'Brennmanet', sci: 'Cyanea capillata', zone: 'overflaten', kind: 'lionsmane', size: 0.07,
      place: { type: 'water', x: [0.8, 4], depth: [2, 25] }, count: 3,
      facts: 'Brennmaneten er rød og har masse lange tråder. Trådene brenner, så den skal vi se på – ikke ta på! Den største som er funnet, hadde tråder som var lengre enn en blåhval.',
    },
    {
      key: 'glassmanet', name: 'Glassmanet', sci: 'Aurelia aurita', zone: 'overflaten', kind: 'moonjelly', size: 0.06,
      place: { type: 'water', x: [0.5, 4.5], depth: [1, 30] }, count: 5,
      facts: 'Glassmaneten er nesten helt gjennomsiktig. Inni den kan du se fire ringer – det er der eggene lages. Den brenner nesten ikke, og den har verken hjerne eller hjerte.',
    },
    {
      key: 'makrell', name: 'Makrell', sci: 'Scomber scombrus', zone: 'overflaten', kind: 'mackerel', size: 0.04,
      place: { type: 'water', x: [1.5, 4.5], depth: [3, 30] }, count: 1, school: 14,
      facts: 'Makrellen har blågrønne, bølgete striper på ryggen. Den svømmer fort i store stimer. Makrellen må svømme hele tiden – det er slik den får nok vann over gjellene til å puste.',
    },
    {
      key: 'torsk', name: 'Torsk', sci: 'Gadus morhua', zone: 'tareskogen', kind: 'cod', size: 0.09,
      place: { type: 'water', x: [1, 3.6], depth: [15, 150] }, count: 4,
      facts: 'Torsken har en liten skjeggtråd under haken som den kjenner etter mat med. Hver vinter svømmer mange torsk til Lofoten for å legge egg. Torsken kan lage brummelyder med svømmeblæra si!',
    },
    {
      key: 'berggylt', name: 'Berggylt', sci: 'Labrus bergylta', zone: 'tareskogen', kind: 'wrasse', size: 0.05,
      place: { type: 'water', x: [0.6, 1.5], depth: [6, 30] }, count: 3,
      facts: 'Berggylta er en fargerik fisk som bor i tareskogen. Den har tykke lepper og plukker små dyr fra steinene. Alle berggylter starter livet som hunner, og noen blir hanner når de blir eldre.',
    },
    {
      key: 'taskekrabbe', name: 'Taskekrabbe', sci: 'Cancer pagurus', zone: 'tareskogen', kind: 'crab', size: 0.05,
      place: { type: 'bottom', x: [0.5, 2.4] }, count: 3,
      facts: 'Krabben går sidelengs på bunnen. Den har to store klør som den knuser skjell med. Skallet sitter på utsiden, og når krabben vokser, kryper den ut av det gamle skallet og lager et nytt.',
    },
    {
      key: 'hummer', name: 'Hummer', sci: 'Homarus gammarus', zone: 'tareskogen', kind: 'lobster', size: 0.07,
      place: { type: 'bottom', x: [0.7, 2] }, count: 2,
      facts: 'Hummeren er blå og svart når den lever i havet – den blir rød først når den kokes. Om dagen gjemmer den seg i hull mellom steinene. Om natta går den ut og leter etter mat.',
    },
    {
      key: 'sjostjerne', name: 'Sjøstjerne', sci: 'Asterias rubens', zone: 'tareskogen', kind: 'starfish', size: 0.045,
      place: { type: 'bottom', x: [0.4, 2.6] }, count: 4,
      facts: 'Sjøstjerna har fem armer. Hvis den mister en arm, kan den vokse ut en ny! Under armene har den hundrevis av bittesmå føtter som den går med.',
    },
    {
      key: 'krakebolle', name: 'Kråkebolle', sci: 'Strongylocentrotus droebachiensis', zone: 'tareskogen', kind: 'urchin', size: 0.035,
      place: { type: 'bottom', x: [0.45, 2.2] }, count: 4,
      facts: 'Kråkebollen er rund og full av pigger. Den spiser tare og alger. Munnen sitter på undersiden, og der har den fem små tenner.',
    },
    {
      key: 'sild', name: 'Sild', sci: 'Clupea harengus', zone: 'apenthav', kind: 'herring', size: 0.03,
      place: { type: 'water', x: [2, 5], depth: [40, 180] }, count: 2, school: 22,
      facts: 'Silda svømmer i enorme stimer med millioner av fisk. Når de holder seg tett sammen, er det vanskelig for rovdyr å fange én av dem. Silda prater med hverandre ved å slippe ut små luftbobler bak – det høres nesten ut som en prompelyd!',
    },
    {
      key: 'nise', name: 'Nise', sci: 'Phocoena phocoena', zone: 'apenthav', kind: 'porpoise', size: 0.13,
      place: { type: 'water', x: [1.2, 3.5], depth: [5, 80] }, count: 2,
      facts: 'Nisa er den minste hvalen i Norge. Den sender ut klikkelyder som er så lyse at ørene våre ikke kan høre dem. Ekkoet fra klikkene hjelper den å finne fisk, selv når det er mørkt.',
    },
    {
      key: 'spekkhogger', name: 'Spekkhogger', sci: 'Orcinus orca', zone: 'apenthav', kind: 'orca', size: 0.45,
      place: { type: 'water', x: [2.2, 5], depth: [10, 150] }, count: 2, sound: 'spekkhogger.mp3',
      facts: 'Spekkhoggeren er svart og hvit og er egentlig en stor delfin. Den lever i familier som holder sammen hele livet. Hver familie har sitt eget «språk» med plystring og rop – hør selv!',
    },
    {
      key: 'knolhval', name: 'Knølhval', sci: 'Megaptera novaeangliae', zone: 'apenthav', kind: 'humpback', size: 0.85,
      place: { type: 'water', x: [2.5, 5.5], depth: [20, 180] }, count: 1, sound: 'knolhval.mp3',
      facts: 'Knølhvalen er like lang som en buss og har veldig lange luffer. Hannene synger lange sanger som kan høres langt av sted i havet – hør her! Om vinteren kommer knølhvalene til fjordene i Nord-Norge for å spise sild.',
    },
    {
      key: 'lysprikkfisk', name: 'Lysprikkfisk', sci: 'Myctophidae', zone: 'skumring', kind: 'lanternfish', size: 0.03, glow: true,
      place: { type: 'water', x: [4, 7.5], depth: [250, 900] }, count: 3, school: 10,
      facts: 'Lysprikkfisken har små lys langs magen. Om dagen gjemmer den seg i det mørke dypet, og om natta svømmer den opp for å spise. Det finnes flere lysprikkfisk i havet enn nesten noen annen fisk.',
    },
    {
      key: 'kammanet', name: 'Kammanet', sci: 'Ctenophora', zone: 'skumring', kind: 'combjelly', size: 0.045, glow: true,
      place: { type: 'water', x: [3.5, 7.5], depth: [150, 900] }, count: 5,
      facts: 'Kammaneten har rader med bittesmå hår som glitrer i alle regnbuens farger når den svømmer. Den er ikke en ekte manet og brenner ikke. Noen kammaneter kan også lyse i mørket.',
    },
    {
      key: 'korallrev', name: 'Korallrev', sci: 'Desmophyllum pertusum', zone: 'skumring', kind: 'coral', size: 0.26,
      place: { type: 'bottom', x: [3.75, 3.95] }, count: 2,
      facts: 'Langs norskekysten finnes store korallrev dypt nede i det kalde, mørke havet. Korallene er bittesmå dyr som bygger hus av kalk sammen. Mange fisker bor og gjemmer seg i revet.',
    },
    {
      key: 'havmus', name: 'Havmus', sci: 'Chimaera monstrosa', zone: 'skumring', kind: 'chimaera', size: 0.11,
      place: { type: 'water', x: [4.2, 5.4], depth: [250, 700] }, count: 2,
      facts: 'Havmusa har store, grønne øyne og en lang, tynn hale – nesten som en mus. Den bor dypt nede og spiser krabber og skjell. Pass deg for piggen på ryggen, den er giftig!',
    },
    {
      key: 'hakjerring', name: 'Håkjerring', sci: 'Somniosus microcephalus', zone: 'dypet', kind: 'shark', size: 0.5,
      place: { type: 'water', x: [5, 7.6], depth: [600, 2200] }, count: 1,
      facts: 'Håkjerringa er en hai som bor i det kalde, dype havet. Den svømmer veldig, veldig sakte. Håkjerringa kan bli flere hundre år gammel – eldre enn noe annet dyr med ryggrad!',
    },
    {
      key: 'marulk', name: 'Dyphavsmarulk', sci: 'Ceratioidei', zone: 'dypet', kind: 'angler', size: 0.07, glow: true,
      place: { type: 'water', x: [5.6, 7.8], depth: [1000, 2800] }, count: 2,
      facts: 'Dyphavsmarulken har sin egen lykt på hodet. Lyset lokker små fisk helt inn til den store munnen. Her nede er det helt mørkt, så en lykt er lurt!',
    },
    {
      key: 'kjempeblekksprut', name: 'Kjempeblekksprut', sci: 'Architeuthis dux', zone: 'dypet', kind: 'giantsquid', size: 0.8, secret: true,
      place: { type: 'water', x: [5.8, 7.6], depth: [700, 1500] }, count: 1,
      facts: 'Du fant kjempeblekkspruten! Den er et av de største dyrene i havet og har øyne like store som en fotball. Den bor så dypt at nesten ingen har sett den levende – men noen har drevet i land i Norge.',
    },
    {
      key: 'skipsvrak', name: 'Skipsvrak', sci: '', zone: 'apenthav', kind: 'wreck', size: 0.9, thing: true,
      place: { type: 'bottom', x: [3, 3.05] }, count: 1,
      facts: 'Dette er et gammelt skip som sank for lenge siden. Nå er det blitt et hjem for fisker, krabber og koraller. Langs norskekysten ligger det tusenvis av skipsvrak på havbunnen.',
    },
    {
      key: 'flaskepost', name: 'Flaskepost', sci: '', zone: 'tareskogen', kind: 'bottle', size: 0.045, thing: true, secret: true,
      place: { type: 'bottom', x: [0.9, 1.3] }, count: 1,
      facts: 'Du fant en flaskepost! Flasker kan drive med havstrømmene i mange år og havne langt, langt borte. Men husk: søppel hører ikke hjemme i havet – denne tar vi med oss.',
    },
  ];

  // Oppdrag i Lær-modus. done(state) gir true når oppdraget er klart.
  const MISSIONS = [
    { key: 'krabbe', text: 'Finn en krabbe', icon: '🦀', species: ['taskekrabbe'] },
    { key: 'pigger', text: 'Finn et dyr med pigger', icon: '🟣', species: ['krakebolle'] },
    { key: 'hval', text: 'Finn den største hvalen', icon: '🐋', species: ['knolhval'] },
    { key: 'dybde100', text: 'Dykk ned til 100 meter', icon: '⬇️', depth: 100 },
    { key: 'vrak', text: 'Finn skipsvraket', icon: '⚓', species: ['skipsvrak'] },
    { key: 'lys', text: 'Finn et dyr som lyser', icon: '✨', species: ['lysprikkfisk', 'kammanet', 'marulk'] },
    { key: 'gammel', text: 'Finn haien som kan bli flere hundre år', icon: '🦈', species: ['hakjerring'] },
    { key: 'dybde2000', text: 'Dykk helt ned til 2000 meter', icon: '🌑', depth: 2000 },
  ];

  const api = { WORLD, DEPTH_SCALE, depthAt, yAtDepth, SEABED, seabedAt, ZONES, zoneAt, lightAt, SPECIES, MISSIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PaizonOceanData = api;
})(typeof window !== 'undefined' ? window : globalThis);
