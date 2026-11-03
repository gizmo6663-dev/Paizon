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
    [0.3, 5],
    [3.2, 40],
    [6.4, 200],
    [12, 1000],
    [17.2, 3000],
  ];

  // Kameraet viser VIEW vh i høyden (se ocean.js), så verden er mange skjermer bred og dyp.
  const WORLD = { width: 24, height: 17.2, sky: 0.9 };

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
    [0, 0.04],
    [0.7, 0.22],
    [1.6, 1.0],
    [2.4, 1.7],
    [3.2, 2.05], // Tareskoggrotta
    [4.2, 2.45],
    [5.2, 2.9], // fiskebåten
    [6.2, 3.1],
    [7.4, 3.9],
    [8.6, 4.7],
    [9.8, 5.0], // skipsvraket
    [10.6, 4.85],
    [11.6, 5.4],
    [13, 6.3],
    [14.6, 6.9],
    [16.2, 7.05], // korallrevet
    [17.4, 7.3],
    [18.6, 8.8],
    [19.8, 9.9], // Dyphavsgrotta
    [21, 12.5],
    [22.2, 15.4],
    [23.2, 16.7],
    [24, 17],
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
        // Litt ujevnheter, men ikke helt inne ved stranda.
        const bumps = (Math.sin(x * 2.3) * 0.035 + Math.sin(x * 5.7 + 1) * 0.018) * Math.min(1, x / 2);
        return y0 + s * (y1 - y0) + bumps;
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
   *    { type: 'inside', in: sted }                        – bare inne i en grotte eller et vrak
   *  count: hvor mange, school: antall i stimen (fisk som svømmer sammen),
   *  sound: lydfil i sounds/ocean/ (ekte opptak), glow: lyser i mørket,
   *  secret: dukker bare opp i Oppdag (sjelden).
   */
  const SPECIES = [
    {
      key: 'make', name: 'Måke', sci: 'Larus', zone: 'overflaten', kind: 'gull', size: 0.06,
      place: { type: 'sky', x: [0.5, 9] }, count: 5,
      facts: 'Måka svever over havet og ser etter mat. Den kan stupe ned i vannet for å fange småfisk. Måker kan faktisk drikke saltvann – de har en egen kjertel som fjerner saltet.',
    },
    {
      key: 'steinkobbe', name: 'Steinkobbe', sci: 'Phoca vitulina', zone: 'overflaten', kind: 'seal', size: 0.11,
      place: { type: 'water', x: [0.8, 6], depth: [1, 12] }, count: 3,
      facts: 'Steinkobben er en sel som bor langs kysten vår. Den er flink til å dykke og kan holde pusten lenge mens den jakter fisk. Når den er mett, ligger den og slapper av på en stein.',
    },
    {
      key: 'brennmanet', name: 'Brennmanet', sci: 'Cyanea capillata', zone: 'overflaten', kind: 'lionsmane', size: 0.06,
      place: { type: 'water', x: [1.5, 12], depth: [2, 25] }, count: 6,
      facts: 'Brennmaneten er rød og har masse lange tråder. Trådene brenner, så den skal vi se på – ikke ta på! Den største som er funnet, hadde tråder som var lengre enn en blåhval.',
    },
    {
      key: 'glassmanet', name: 'Glassmanet', sci: 'Aurelia aurita', zone: 'overflaten', kind: 'moonjelly', size: 0.055,
      place: { type: 'water', x: [1, 13], depth: [1, 30] }, count: 10,
      facts: 'Glassmaneten er nesten helt gjennomsiktig. Inni den kan du se fire ringer – det er der eggene lages. Den brenner nesten ikke, og den har verken hjerne eller hjerte.',
    },
    {
      key: 'makrell', name: 'Makrell', sci: 'Scomber scombrus', zone: 'overflaten', kind: 'mackerel', size: 0.04,
      place: { type: 'water', x: [3, 12], depth: [3, 30] }, count: 3, school: 14,
      facts: 'Makrellen har blågrønne, bølgete striper på ryggen. Den svømmer fort i store stimer. Makrellen må svømme hele tiden – det er slik den får nok vann over gjellene til å puste.',
    },
    {
      key: 'torsk', name: 'Torsk', sci: 'Gadus morhua', zone: 'tareskogen', kind: 'cod', size: 0.07,
      place: { type: 'water', x: [2, 11], depth: [15, 150] }, count: 8,
      facts: 'Torsken har en liten skjeggtråd under haken som den kjenner etter mat med. Hver vinter svømmer mange torsk til Lofoten for å legge egg. Torsken kan lage brummelyder med svømmeblæra si!',
    },
    {
      key: 'berggylt', name: 'Berggylt', sci: 'Labrus bergylta', zone: 'tareskogen', kind: 'wrasse', size: 0.045,
      place: { type: 'water', x: [0.8, 5], depth: [6, 30] }, count: 6,
      facts: 'Berggylta er en fargerik fisk som bor i tareskogen. Den har tykke lepper og plukker små dyr fra steinene. Alle berggylter starter livet som hunner, og noen blir hanner når de blir eldre.',
    },
    {
      key: 'taskekrabbe', name: 'Taskekrabbe', sci: 'Cancer pagurus', zone: 'tareskogen', kind: 'crab', size: 0.05,
      place: { type: 'bottom', x: [0.8, 6] }, count: 6,
      facts: 'Krabben går sidelengs på bunnen. Den har to store klør som den knuser skjell med. Skallet sitter på utsiden, og når krabben vokser, kryper den ut av det gamle skallet og lager et nytt.',
    },
    {
      key: 'hummer', name: 'Hummer', sci: 'Homarus gammarus', zone: 'tareskogen', kind: 'lobster', size: 0.06,
      place: { type: 'bottom', x: [1.5, 5.5] }, count: 3,
      facts: 'Hummeren er blå og svart når den lever i havet – den blir rød først når den kokes. Om dagen gjemmer den seg i hull mellom steinene. Om natta går den ut og leter etter mat.',
    },
    {
      key: 'sjostjerne', name: 'Sjøstjerne', sci: 'Asterias rubens', zone: 'tareskogen', kind: 'starfish', size: 0.045,
      place: { type: 'bottom', x: [0.8, 7] }, count: 8,
      facts: 'Sjøstjerna har fem armer. Hvis den mister en arm, kan den vokse ut en ny! Under armene har den hundrevis av bittesmå føtter som den går med.',
    },
    {
      key: 'krakebolle', name: 'Kråkebolle', sci: 'Strongylocentrotus droebachiensis', zone: 'tareskogen', kind: 'urchin', size: 0.038,
      place: { type: 'bottom', x: [0.9, 5.5] }, count: 8,
      facts: 'Kråkebollen er rund og full av pigger. Den spiser tare og alger. Munnen sitter på undersiden, og der har den fem små tenner.',
    },
    {
      key: 'sild', name: 'Sild', sci: 'Clupea harengus', zone: 'apenthav', kind: 'herring', size: 0.03,
      place: { type: 'water', x: [6, 15], depth: [40, 180] }, count: 4, school: 22,
      facts: 'Silda svømmer i enorme stimer med millioner av fisk. Når de holder seg tett sammen, er det vanskelig for rovdyr å fange én av dem. Silda prater med hverandre ved å slippe ut små luftbobler bak – det høres nesten ut som en prompelyd!',
    },
    {
      key: 'nise', name: 'Nise', sci: 'Phocoena phocoena', zone: 'apenthav', kind: 'porpoise', size: 0.1,
      place: { type: 'water', x: [3, 10], depth: [5, 80] }, count: 3,
      facts: 'Nisa er den minste hvalen i Norge. Den sender ut klikkelyder som er så lyse at ørene våre ikke kan høre dem. Ekkoet fra klikkene hjelper den å finne fisk, selv når det er mørkt.',
    },
    {
      key: 'spekkhogger', name: 'Spekkhogger', sci: 'Orcinus orca', zone: 'apenthav', kind: 'orca', size: 0.24,
      place: { type: 'water', x: [12.5, 17], depth: [10, 150] }, count: 3, sound: 'spekkhogger.mp3',
      facts: 'Spekkhoggeren er svart og hvit og er egentlig en stor delfin. Den lever i familier som holder sammen hele livet. Hver familie har sitt eget «språk» med plystring og rop – hør selv!',
    },
    {
      key: 'knolhval', name: 'Knølhval', sci: 'Megaptera novaeangliae', zone: 'apenthav', kind: 'humpback', size: 0.42,
      place: { type: 'water', x: [7, 11], depth: [20, 120] }, count: 1, sound: 'knolhval.mp3',
      facts: 'Knølhvalen er like lang som en buss og har veldig lange luffer. Hannene synger lange sanger som kan høres langt av sted i havet – hør her! Om vinteren kommer knølhvalene til fjordene i Nord-Norge for å spise sild.',
    },
    {
      key: 'lysprikkfisk', name: 'Lysprikkfisk', sci: 'Myctophidae', zone: 'skumring', kind: 'lanternfish', size: 0.03, glow: true,
      place: { type: 'water', x: [15, 22], depth: [250, 900] }, count: 5, school: 10,
      facts: 'Lysprikkfisken har små lys langs magen. Om dagen gjemmer den seg i det mørke dypet, og om natta svømmer den opp for å spise. Det finnes flere lysprikkfisk i havet enn nesten noen annen fisk.',
    },
    {
      key: 'kammanet', name: 'Kammanet', sci: 'Ctenophora', zone: 'skumring', kind: 'combjelly', size: 0.045, glow: true,
      place: { type: 'water', x: [13, 23], depth: [150, 900] }, count: 10,
      facts: 'Kammaneten har rader med bittesmå hår som glitrer i alle regnbuens farger når den svømmer. Den er ikke en ekte manet og brenner ikke. Noen kammaneter kan også lyse i mørket.',
    },
    {
      key: 'korallrev', name: 'Korallrev', sci: 'Desmophyllum pertusum', zone: 'skumring', kind: 'coral', size: 0.26,
      place: { type: 'bottom', x: [15.9, 17] }, count: 3,
      facts: 'Langs norskekysten finnes store korallrev dypt nede i det kalde, mørke havet. Korallene er bittesmå dyr som bygger hus av kalk sammen. Mange fisker bor og gjemmer seg i revet.',
    },
    {
      key: 'havmus', name: 'Havmus', sci: 'Chimaera monstrosa', zone: 'skumring', kind: 'chimaera', size: 0.09,
      place: { type: 'water', x: [16, 20], depth: [250, 700] }, count: 3,
      facts: 'Havmusa har store, grønne øyne og en lang, tynn hale – nesten som en mus. Den bor dypt nede og spiser krabber og skjell. Pass deg for piggen på ryggen, den er giftig!',
    },
    {
      key: 'hakjerring', name: 'Håkjerring', sci: 'Somniosus microcephalus', zone: 'dypet', kind: 'shark', size: 0.3,
      place: { type: 'water', x: [18.5, 23], depth: [600, 2200] }, count: 2,
      facts: 'Håkjerringa er en hai som bor i det kalde, dype havet. Den svømmer veldig, veldig sakte. Håkjerringa kan bli flere hundre år gammel – eldre enn noe annet dyr med ryggrad!',
    },
    {
      key: 'marulk', name: 'Dyphavsmarulk', sci: 'Ceratioidei', zone: 'dypet', kind: 'angler', size: 0.07, glow: true,
      place: { type: 'water', x: [20.5, 23.6], depth: [1000, 2800] }, count: 3,
      facts: 'Dyphavsmarulken har sin egen lykt på hodet. Lyset lokker små fisk helt inn til den store munnen. Her nede er det helt mørkt, så en lykt er lurt!',
    },
    {
      key: 'kjempeblekksprut', name: 'Kjempeblekksprut', sci: 'Architeuthis dux', zone: 'dypet', kind: 'giantsquid', size: 0.5, secret: true,
      place: { type: 'water', x: [19.5, 23], depth: [700, 1500] }, count: 1,
      facts: 'Du fant kjempeblekkspruten! Den er et av de største dyrene i havet og har øyne like store som en fotball. Den bor så dypt at nesten ingen har sett den levende – men noen har drevet i land i Norge.',
    },
    {
      key: 'skipsvrak', name: 'Skipsvrak', sci: '', zone: 'apenthav', kind: 'wreck', size: 0.8, thing: true,
      place: { type: 'bottom', x: [9.8, 9.82] }, count: 1, enter: 'skipsvraket',
      facts: 'Dette er et gammelt skip som sank for lenge siden. Nå er det blitt et hjem for fisker, krabber og koraller. Langs norskekysten ligger det tusenvis av skipsvrak på havbunnen.',
    },
    {
      key: 'flaskepost', name: 'Flaskepost', sci: '', zone: 'tareskogen', kind: 'bottle', size: 0.04, thing: true, secret: true,
      place: { type: 'bottom', x: [2, 3] }, count: 1,
      facts: 'Du fant en flaskepost! Flasker kan drive med havstrømmene i mange år og havne langt, langt borte. Men husk: søppel hører ikke hjemme i havet – denne tar vi med oss.',
    },

    // Dyr som bare bor inne i grotter og vrak (place.type 'inside', se PLACES).
    {
      key: 'steinbit', name: 'Grå steinbit', sci: 'Anarhichas lupus', zone: 'tareskogen', kind: 'wolffish', size: 0.12,
      place: { type: 'inside', in: 'tareskoggrotta' },
      facts: 'Steinbiten gjemmer seg i sprekker og huler i fjellet. Den har store, sterke tenner som kan knuse skjell, krabber og kråkeboller. Den ser litt skummel ut, men er egentlig rolig og sky.',
    },
    {
      key: 'sjonellik', name: 'Sjønellik', sci: 'Metridium senile', zone: 'tareskogen', kind: 'anemone', size: 0.08,
      place: { type: 'inside', in: 'tareskoggrotta' },
      facts: 'Sjønelliken ser ut som en blomst, men den er et dyr! De fjærlette trådene på toppen fanger bitte små dyr som driver forbi i vannet. Blir den skremt, trekker den seg sammen til en liten klump.',
    },
    {
      key: 'havaal', name: 'Havål', sci: 'Conger conger', zone: 'apenthav', kind: 'conger', size: 0.2,
      place: { type: 'inside', in: 'skipsvraket' },
      facts: 'Havålen liker å bo i rør og hull i gamle skipsvrak. Den er lang som en slange, men er faktisk en fisk. Om dagen ligger den i skjul, og om natta svømmer den ut for å jakte.',
    },
    {
      key: 'reke', name: 'Dypvannsreke', sci: 'Pandalus borealis', zone: 'apenthav', kind: 'prawn', size: 0.05,
      place: { type: 'inside', in: 'skipsvraket' },
      facts: 'Dypvannsreka lever på mudderbunn langt nede i havet. Det er den samme reka som vi spiser! Alle rekene er født som hanner, og når de blir eldre, blir de til hunner.',
    },
    {
      key: 'glassvamp', name: 'Glassvamp', sci: 'Hexactinellida', zone: 'skumring', kind: 'sponge', size: 0.12,
      place: { type: 'inside', in: 'dyphavsgrotta' },
      facts: 'Glassvampen er et dyr som er bygget av bitte små nåler av glass. Den står helt stille og siler mat ut av vannet. Noen glassvamper kan bli flere tusen år gamle – de er blant de eldste dyrene på jorda.',
    },
    {
      key: 'slangestjerne', name: 'Slangestjerne', sci: 'Ophiuroidea', zone: 'skumring', kind: 'brittlestar', size: 0.07,
      place: { type: 'inside', in: 'dyphavsgrotta' },
      facts: 'Slangestjerna er i slekt med sjøstjerna, men den har tynne, smidige armer som kryper som slanger. Mister den en arm, vokser det bare ut en ny. Noen slangestjerner kan til og med lyse!',
    },
  ];

  /*
   * Steder man kan gå inn i og se seg rundt i (førstepersonsvisning, se inside.js).
   * x: hvor på havbunnen inngangen er. light: hvor lyst det er inne (0 = bekmørkt).
   * items: ting å trykke på. x/y er plassering i panoramaet (0–1), layer: 0 = bakerst,
   * 1 = midten, 2 = forrest. species: kobles til et dyr i fotoboka. dark: synes bare i lykta.
   */
  const PLACES = [
    {
      key: 'tareskoggrotta', name: 'Tareskoggrotta', kind: 'cave', x: 3.2, size: 0.42, zone: 'tareskogen', light: 0.6,
      palette: { rock: '#4d5a52', deep: '#1c2a26', water: '#2c7f80', moss: '#7a8a3a' },
      intro: 'Vi svømmer inn i en grotte i fjellet. Det er lunt og stille her inne, og mange dyr bruker grotta som et trygt gjemmested.',
      items: [
        { key: 'steinbit', species: 'steinbit', art: 'wolffish', x: 0.2, y: 0.72, size: 0.32, layer: 1 },
        { key: 'sjonellik', species: 'sjonellik', art: 'anemone', x: 0.47, y: 0.55, size: 0.2, layer: 1 },
        { key: 'krabbe', species: 'taskekrabbe', art: 'crab', x: 0.66, y: 0.84, size: 0.13, layer: 2 },
        { key: 'berggylt', species: 'berggylt', art: 'wrasse', x: 0.82, y: 0.38, size: 0.16, layer: 0 },
        {
          key: 'kalkalger', name: 'Kalkalger', art: 'coralline', x: 0.36, y: 0.86, size: 0.22, layer: 2,
          text: 'Det rosa belegget på steinene er kalkalger. Det er planter som lager et hardt skall av kalk, nesten som stein. De vokser veldig sakte – bare noen få millimeter i året.',
        },
      ],
    },
    {
      key: 'fiskebaten', name: 'Den gamle fiskebåten', kind: 'boat', x: 5.2, size: 0.5, zone: 'tareskogen', light: 0.5,
      palette: { wood: '#6b5233', deep: '#1f2a26', water: '#2a7478', moss: '#6f7f3c' },
      intro: 'Dette var en gang en fiskebåt av tre. Den sank for lenge siden, og nå har havet tatt den tilbake. Planter og dyr har flyttet inn.',
      items: [
        {
          key: 'ratt', name: 'Rattet', art: 'wheel', x: 0.22, y: 0.42, size: 0.3, layer: 1,
          text: 'Med rattet styrte fiskerne båten. Nå har det ligget på havbunnen så lenge at alger og små dyr har flyttet inn på det.',
        },
        { key: 'hummer', species: 'hummer', art: 'lobster', x: 0.5, y: 0.84, size: 0.2, layer: 2 },
        {
          key: 'garn', name: 'Gammelt fiskegarn', art: 'net', x: 0.75, y: 0.5, size: 0.4, layer: 0,
          text: 'Gamle fiskegarn som blir liggende i havet, kan være farlige fordi dyr kan sette seg fast i dem. Dykkere hjelper til med å rydde garn opp fra havbunnen.',
        },
        {
          key: 'lykt', name: 'Parafinlykt', art: 'lantern', x: 0.4, y: 0.3, size: 0.15, layer: 1,
          text: 'En gammel parafinlykt. Før det fantes lyspærer på båtene, hang fiskerne opp slike lykter for å se i mørket.',
        },
        { key: 'torsk', species: 'torsk', art: 'cod', x: 0.88, y: 0.7, size: 0.2, layer: 1 },
      ],
    },
    {
      key: 'skipsvraket', name: 'Skipsvraket', kind: 'ship', x: 9.8, size: 0.8, zone: 'apenthav', light: 0.12,
      palette: { steel: '#5d4a3c', deep: '#0d1418', water: '#123c4e', moss: '#8a5a3a' },
      intro: 'Vi er inne i skipsvraket. Her er det mørkt, så vi bruker lykta. Dra med fingeren for å lyse rundt deg.',
      items: [
        {
          key: 'klokke', name: 'Skipsklokka', art: 'bell', x: 0.14, y: 0.33, size: 0.18, layer: 1,
          text: 'Skipsklokka ringte for å vise hva klokka var om bord, og for å varsle andre båter i tåke. Ofte står skipets navn på klokka – slik kan man finne ut hvilket skip vraket var.',
        },
        { key: 'havaal', species: 'havaal', art: 'conger', x: 0.36, y: 0.62, size: 0.34, layer: 1, dark: true },
        {
          key: 'kiste', name: 'Den gamle kista', art: 'chest', x: 0.56, y: 0.82, size: 0.24, layer: 2, dark: true,
          text: 'En gammel kiste! Det er ingen gullskatt her – bare rust og sand. Men for arkeologer er alt i et vrak en skatt, fordi det forteller hvordan folk levde før.',
        },
        {
          key: 'koye', name: 'Koøyet', art: 'porthole', x: 0.76, y: 0.34, size: 0.2, layer: 0,
          text: 'Et koøye er et rundt vindu i skipssiden. Da skipet seilte, kom dagslyset inn her. Nå er det mørkt utenfor, for vi er over hundre meter under havflaten.',
        },
        { key: 'reke', species: 'reke', art: 'prawn', x: 0.9, y: 0.8, size: 0.1, layer: 2, dark: true },
      ],
    },
    {
      key: 'dyphavsgrotta', name: 'Dyphavsgrotta', kind: 'cave', x: 19.8, size: 0.5, zone: 'skumring', light: 0.02,
      palette: { rock: '#2e3440', deep: '#05070b', water: '#071826', moss: '#3a4a5a' },
      intro: 'Dette er en grotte langt nede i dypet, der sollyset aldri kommer. Uten lykta ser vi ingenting – bare dyrene som lager sitt eget lys.',
      items: [
        { key: 'glassvamp', species: 'glassvamp', art: 'sponge', x: 0.2, y: 0.68, size: 0.3, layer: 1, dark: true },
        { key: 'slangestjerne', species: 'slangestjerne', art: 'brittlestar', x: 0.5, y: 0.86, size: 0.18, layer: 2, dark: true },
        { key: 'lys', species: 'lysprikkfisk', art: 'lanternfish', x: 0.7, y: 0.36, size: 0.1, layer: 0 },
        { key: 'kammanet', species: 'kammanet', art: 'combjelly', x: 0.86, y: 0.5, size: 0.12, layer: 1 },
      ],
    },
  ];

  // Oppdrag i Lær-modus. done(state) gir true når oppdraget er klart.
  const MISSIONS = [
    { key: 'krabbe', text: 'Finn en krabbe', icon: '🦀', species: ['taskekrabbe'] },
    { key: 'pigger', text: 'Finn et dyr med pigger', icon: '🟣', species: ['krakebolle'] },
    { key: 'grotte', text: 'Utforsk en grotte', icon: '🔦', places: ['tareskoggrotta', 'dyphavsgrotta'] },
    { key: 'hval', text: 'Finn den største hvalen', icon: '🐋', species: ['knolhval'] },
    { key: 'dybde100', text: 'Dykk ned til 100 meter', icon: '⬇️', depth: 100 },
    { key: 'vrak', text: 'Svøm inn i skipsvraket', icon: '⚓', places: ['skipsvraket'] },
    { key: 'lys', text: 'Finn et dyr som lyser', icon: '✨', species: ['lysprikkfisk', 'kammanet', 'marulk'] },
    { key: 'gammel', text: 'Finn haien som kan bli flere hundre år', icon: '🦈', species: ['hakjerring'] },
    { key: 'dybde2000', text: 'Dykk helt ned til 2000 meter', icon: '🌑', depth: 2000 },
  ];

  const api = { WORLD, DEPTH_SCALE, depthAt, yAtDepth, SEABED, seabedAt, ZONES, zoneAt, lightAt, SPECIES, PLACES, MISSIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PaizonOceanData = api;
})(typeof window !== 'undefined' ? window : globalThis);
