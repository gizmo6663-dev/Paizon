/*
 * Skogen – innhold: tider på døgnet, årstider, dyr og planter med fakta, gjemmesteder og oppdrag.
 *
 * Verden måles i skjermhøyder: bakken ligger rundt y = 0,8, og stien går fra x = 0 til
 * WORLD.width. when.times / when.seasons sier når et dyr kan sees (utelatt = alltid).
 * Lastes som <script> (window.PaizonForestData) og med require() i testene.
 */
(function (root) {
  'use strict';

  const WORLD = { width: 26 };

  const TIMES = [
    { key: 'morgen', name: 'Morgen', icon: '🌅' },
    { key: 'dag', name: 'Dag', icon: '☀️' },
    { key: 'kveld', name: 'Kveld', icon: '🌇' },
    { key: 'natt', name: 'Natt', icon: '🌙' },
  ];
  const SEASONS = [
    { key: 'var', name: 'Vår', icon: '🌸' },
    { key: 'sommer', name: 'Sommer', icon: '🌿' },
    { key: 'host', name: 'Høst', icon: '🍂' },
    { key: 'vinter', name: 'Vinter', icon: '❄️' },
  ];

  /** Bakken: slake bakker langs stien (y i skjermhøyder, større = lenger ned). */
  function groundAt(x) {
    return 0.8 + Math.sin(x * 0.45) * 0.035 + Math.sin(x * 1.3 + 1) * 0.015;
  }

  const NIGHTLY = ['kveld', 'natt'];
  const AWAKE = ['var', 'sommer', 'host'];

  /*
   * Dyr og planter. kind: tegning i creatures.js. place:
   *   ground (på bakken), tree (sitter i et tre), trunk (på en trestamme), air (flyr), pond (ved dammen),
   *   hidden (bare i et gjemmested, se HIDEOUTS), thing (står fast: trær, maurtua).
   * x: hvor langs stien. size: lengde i skjermhøyder. sound: lyd fra kit.js. move: går rundt.
   */
  const SPECIES = [
    {
      key: 'elg', name: 'Elg', sci: 'Alces alces', kind: 'elg', place: 'ground', x: [14, 22], size: 0.3, count: 1, move: 0.05,
      when: { times: ['morgen', 'dag', 'kveld'] },
      facts: 'Elgen er det største dyret i den norske skogen – en voksen elgokse kan bli over to meter høy. Den spiser blader, kvister og bark. Hvert år feller oksen geviret sitt og får et nytt og enda større.',
    },
    {
      key: 'raadyr', name: 'Rådyr', sci: 'Capreolus capreolus', kind: 'raadyr', place: 'ground', x: [4, 13], size: 0.22, count: 2, move: 0.06, shy: true,
      when: { times: ['morgen', 'kveld'] },
      facts: 'Rådyret er et lite og forsiktig hjortedyr. Om sommeren er pelsen rødbrun, og om vinteren blir den grå. Når rådyret blir redd, viser det fram den hvite flekken bak og løper av gårde i lange byks.',
    },
    {
      key: 'rev', name: 'Rødrev', sci: 'Vulpes vulpes', kind: 'rev', place: 'ground', x: [8, 24], size: 0.24, count: 1, move: 0.12, shy: true, sound: 'rev',
      when: { times: ['morgen', 'kveld', 'natt'] },
      facts: 'Reven er smart og har veldig god hørsel. Den kan høre en mus som piper under snøen, og så hopper den høyt og stuper ned med snuten først. Halen bruker den som et varmt teppe når den sover.',
    },
    {
      key: 'hare', name: 'Hare', sci: 'Lepus timidus', kind: 'hare', place: 'ground', x: [2, 20], size: 0.14, count: 2, move: 0.09, shy: true,
      when: { times: ['morgen', 'kveld', 'natt'] },
      facts: 'Haren skifter pels: brun om sommeren og helt hvit om vinteren, slik at den gjemmer seg i snøen. De store bakbeina gjør at den kan løpe veldig fort og hoppe i siksak når en rev jager den.',
    },
    {
      key: 'grevling', name: 'Grevling', sci: 'Meles meles', kind: 'grevling', place: 'ground', x: [10, 18], size: 0.2, count: 1, move: 0.05,
      when: { times: NIGHTLY, seasons: AWAKE },
      facts: 'Grevlingen bor i et stort hi under bakken med mange ganger og rom. Den kommer ut om kvelden for å lete etter meitemark, røtter og bær. Om vinteren sover den det meste av tiden i hiet sitt.',
    },
    {
      key: 'ekorn', name: 'Ekorn', sci: 'Sciurus vulgaris', kind: 'ekorn', place: 'trunk', x: [1, 25], size: 0.09, count: 3,
      when: { times: ['morgen', 'dag'] },
      facts: 'Ekornet klatrer lynraskt opp og ned trestammene. Om høsten gjemmer det nøtter og kongler mange steder, men det glemmer hvor noen av dem er – og der kan det vokse opp nye trær.',
    },
    {
      key: 'pinnsvin', name: 'Pinnsvin', sci: 'Erinaceus europaeus', kind: 'pinnsvin', place: 'ground', x: [3, 12], size: 0.09, count: 1, move: 0.03,
      when: { times: NIGHTLY, seasons: AWAKE },
      facts: 'Pinnsvinet har rundt 6000 pigger på ryggen. Blir det redd, ruller det seg sammen til en stikkende ball. Om natta leter det etter snegler og biller, og om vinteren sover det i et bol av løv.',
    },
    {
      key: 'ugle', name: 'Kattugle', sci: 'Strix aluco', kind: 'ugle', place: 'tree', x: [6, 22], size: 0.14, count: 1, sound: 'ugle',
      when: { times: NIGHTLY },
      facts: 'Kattugla jakter om natta. Den har så myke fjær at den flyr helt lydløst, og den hører en mus i mørket. Ugla kan snu hodet nesten helt rundt for å se bak seg.',
    },
    {
      key: 'spett', name: 'Flaggspett', sci: 'Dendrocopos major', kind: 'spett', place: 'trunk', x: [3, 24], size: 0.08, count: 2, sound: 'spett',
      when: { times: ['morgen', 'dag'] },
      facts: 'Flaggspetten hakker hull i trestammer for å finne insekter. Om våren trommer den raskt på en tørr gren for å si «her bor jeg!». Den har en ekstra tykk hodeskalle, så den får ikke vondt i hodet.',
    },
    {
      key: 'kjottmeis', name: 'Kjøttmeis', sci: 'Parus major', kind: 'kjottmeis', place: 'tree', x: [0, 26], size: 0.055, count: 4, sound: 'meis',
      when: { times: ['morgen', 'dag'] },
      facts: 'Kjøttmeisa er en av de vanligste fuglene i Norge. Den har gul mage og en svart stripe ned brystet, som et slips. Sangen høres ut som «ti-ty, ti-ty», og den synger allerede tidlig på våren.',
    },
    {
      key: 'trost', name: 'Svarttrost', sci: 'Turdus merula', kind: 'trost', place: 'tree', x: [0, 26], size: 0.07, count: 2, sound: 'trost',
      when: { times: ['morgen', 'kveld'], seasons: ['var', 'sommer'] },
      facts: 'Svarttrosten er helt svart med gult nebb. Den synger en vakker, fløytende sang fra en høy topp, ofte tidlig om morgenen og sent om kvelden. Den leter etter meitemark i gresset.',
    },
    {
      key: 'gjok', name: 'Gjøk', sci: 'Cuculus canorus', kind: 'gjok', place: 'tree', x: [10, 24], size: 0.09, count: 1, sound: 'gjok',
      when: { times: ['morgen', 'dag'], seasons: ['var', 'sommer'] },
      facts: 'Gjøken sier «ko-ko» og kommer til Norge om våren fra Afrika. Den bygger ikke reir selv, men legger egget sitt i reiret til andre fugler – og så passer de på gjøkungen.',
    },
    {
      key: 'flaggermus', name: 'Flaggermus', sci: 'Chiroptera', kind: 'flaggermus', place: 'air', x: [0, 26], size: 0.07, count: 3,
      when: { times: NIGHTLY, seasons: AWAKE },
      facts: 'Flaggermusa er det eneste pattedyret som kan fly. Den roper med så lyse lyder at vi ikke kan høre dem, og lytter etter ekkoet for å finne insekter i mørket. Om vinteren sover den.',
    },
    {
      key: 'frosk', name: 'Buttsnutefrosk', sci: 'Rana temporaria', kind: 'frosk', place: 'pond', x: [9.6, 10.6], size: 0.06, count: 2, sound: 'frosk',
      when: { seasons: ['var', 'sommer'] },
      facts: 'Frosken legger egg i dammen om våren – det kalles froskeegg. Eggene blir til rumpetroll som svømmer med hale, og etter hvert får de bein og blir små frosker som kan hoppe på land.',
    },
    {
      key: 'sommerfugl', name: 'Sitronsommerfugl', sci: 'Gonepteryx rhamni', kind: 'sommerfugl', place: 'air', x: [0, 26], size: 0.05, count: 4,
      when: { times: ['dag'], seasons: ['var', 'sommer'] },
      facts: 'Sitronsommerfuglen er gul som en sitron. Den suger nektar fra blomster med en lang sugesnabel som den ruller sammen når den ikke bruker den. Den er en av de første sommerfuglene om våren.',
    },
    {
      key: 'kantarell', name: 'Kantarell', sci: 'Cantharellus cibarius', kind: 'kantarell', place: 'ground', x: [2, 24], size: 0.05, count: 5,
      when: { seasons: ['sommer', 'host'] },
      facts: 'Kantarellen er en gul sopp som lukter litt av aprikos. Den er god å spise, men du må alltid spørre en voksen som kan sopp før du plukker noe – noen sopper er giftige.',
    },
    {
      key: 'fluesopp', name: 'Rød fluesopp', sci: 'Amanita muscaria', kind: 'fluesopp', place: 'ground', x: [4, 22], size: 0.08, count: 3,
      when: { seasons: ['host'] },
      facts: 'Den røde fluesoppen med hvite prikker er kjent fra eventyr, men den er giftig! Den skal vi bare se på. Under bakken henger soppen sammen med røttene til trærne, og de hjelper hverandre.',
    },
    {
      key: 'blabaer', name: 'Blåbær', sci: 'Vaccinium myrtillus', kind: 'blabaer', place: 'ground', x: [1, 25], size: 0.08, count: 7,
      when: { seasons: ['sommer'] },
      facts: 'Blåbærlyngen dekker store deler av skogbunnen. Om sommeren er den full av søte blåbær som både vi, fuglene, revene og bjørnene liker å spise. Blåbær gjør tunga blå!',
    },
    {
      key: 'maur', name: 'Rød skogmaur', sci: 'Formica rufa', kind: 'maur', place: 'hidden', size: 0.04,
      facts: 'I en maurtue kan det bo flere hundre tusen maur. De samarbeider om alt: noen henter mat, noen passer på eggene, og noen reparerer tua. En maur kan bære noe som er mange ganger tyngre enn seg selv.',
    },
    {
      key: 'skrukketroll', name: 'Skrukketroll', sci: 'Oniscus asellus', kind: 'skrukketroll', place: 'hidden', size: 0.05,
      facts: 'Skrukketrollet liker det fuktig og mørkt, for eksempel under steiner og gamle stokker. Det er i slekt med krabber og hummer! Det spiser døde blader og hjelper til med å lage ny jord.',
    },
    {
      key: 'meitemark', name: 'Meitemark', sci: 'Lumbricus terrestris', kind: 'meitemark', place: 'hidden', size: 0.08,
      facts: 'Meitemarken graver ganger i jorda og spiser døde planter. Gangene slipper inn luft og vann, så plantene vokser bedre. Den har ingen øyne, men kjenner lys og mørke med huden.',
    },
    {
      key: 'rumpetroll', name: 'Rumpetroll', sci: 'Larve av frosk', kind: 'rumpetroll', place: 'hidden', size: 0.05,
      facts: 'Rumpetroll er froskeunger. De puster med gjeller og svømmer med halen, akkurat som fisk. Etter noen uker vokser det ut bein, halen blir borte, og så hopper de opp på land som små frosker.',
    },
    {
      key: 'gran', name: 'Gran', sci: 'Picea abies', kind: 'gran', place: 'thing', size: 0.9,
      facts: 'Grana er det vanligste treet i den norske skogen. Den er grønn hele året, og nålene sitter på i mange år. Konglene henger ned, og ekornet og fuglene spiser frøene inni dem.',
    },
    {
      key: 'bjork', name: 'Bjørk', sci: 'Betula pubescens', kind: 'bjork', place: 'thing', size: 0.8,
      facts: 'Bjørka har hvit stamme med svarte flekker. Om våren får den små lysegrønne blader, og om høsten blir de gule. Bjørka var et av de første trærne som vokste i Norge etter istiden.',
    },
    {
      key: 'maurtue', name: 'Maurtue', sci: '', kind: 'maurtue', place: 'thing', size: 0.3,
      facts: 'Maurtua er bygget av barnåler, små pinner og jord. Det meste av tua er faktisk under bakken. Maurene åpner og lukker hull i tua for å holde den passe varm, nesten som et hus med vinduer.',
    },
    // Hemmeligheter i Oppdag.
    {
      key: 'gaupe', name: 'Gaupe', sci: 'Lynx lynx', kind: 'gaupe', place: 'ground', x: [19, 25], size: 0.26, count: 1, move: 0.04, secret: true, shy: true,
      when: { times: ['kveld', 'natt', 'morgen'] },
      facts: 'Gaupa er Norges eneste ville kattedyr. Den har dusker på ørene og store poter som fungerer som truger i snøen. Gaupa er så sky at mange som bor i skogen aldri har sett en.',
    },
    {
      key: 'bjorn', name: 'Brunbjørn', sci: 'Ursus arctos', kind: 'bjorn', place: 'ground', x: [22, 25.5], size: 0.32, count: 1, move: 0.03, secret: true,
      when: { times: ['morgen', 'kveld'], seasons: AWAKE },
      facts: 'Brunbjørnen er det største rovdyret i Norge, men den spiser mest bær, gress og maur. Om vinteren sover den i et hi i mange måneder. Bjørnungene blir født mens mora sover!',
    },
  ];

  /**
   * Gjemmesteder man kan kikke i. hides: hvem som er der (første passende vinner).
   * kind: tegning i forest/art.js.
   */
  const HIDEOUTS = [
    { key: 'stein', name: 'Den store steinen', kind: 'stone', x: 3.4, hides: [{ species: 'skrukketroll' }, { species: 'meitemark' }], text: 'Vi løfter forsiktig på steinen …' },
    { key: 'maurtua', name: 'Maurtua', kind: 'anthill', x: 7.2, species: 'maurtue', hides: [{ species: 'maur', seasons: AWAKE }], text: 'Vi kikker på maurtua …' },
    { key: 'dam', name: 'Dammen', kind: 'pond', x: 10.1, hides: [{ species: 'rumpetroll', seasons: ['var', 'sommer'] }, { species: 'frosk', seasons: ['var', 'sommer'] }], text: 'Vi kikker ned i vannet …' },
    { key: 'hultre', name: 'Det hule treet', kind: 'hollow', x: 15.6, hides: [{ species: 'ugle', times: ['morgen', 'dag'] }, { species: 'ekorn' }], text: 'Vi kikker inn i hullet i treet …' },
    { key: 'stubbe', name: 'Den gamle stubben', kind: 'stump', x: 20.3, hides: [{ species: 'meitemark' }, { species: 'skrukketroll' }], text: 'Vi kikker under barken på stubben …' },
  ];

  const MISSIONS = [
    { key: 'klatrer', text: 'Finn et dyr som klatrer på trærne', icon: '🐿️', species: ['ekorn', 'spett'] },
    { key: 'stein', text: 'Løft den store steinen og se hvem som bor under', icon: '🪨', hideouts: ['stein'] },
    { key: 'storst', text: 'Finn skogens største dyr', icon: '🫎', species: ['elg'] },
    { key: 'trommer', text: 'Finn fuglen som trommer på trærne', icon: '🥁', species: ['spett'] },
    { key: 'ugle', text: 'Finn ugla – den er våken om natta', icon: '🦉', species: ['ugle'], hint: 'Trykk på klokka og velg natt.' },
    { key: 'baer', text: 'Finn blåbær', icon: '🫐', species: ['blabaer'], hint: 'Blåbær finnes om sommeren.' },
    { key: 'giftig', text: 'Finn en sopp du ikke skal spise', icon: '🍄', species: ['fluesopp'], hint: 'Prøv høsten.' },
    { key: 'spor', text: 'Følg sporene i snøen og finn haren', icon: '🐾', species: ['hare'], season: 'vinter', hint: 'Velg vinter.' },
  ];

  /** Er arten ute nå? */
  function present(sp, time, season) {
    const w = sp.when || {};
    return (!w.times || w.times.includes(time)) && (!w.seasons || w.seasons.includes(season));
  }

  /** Hvem gjemmer seg i et gjemmested nå? */
  function hiddenIn(h, time, season) {
    for (const o of h.hides) {
      if ((!o.times || o.times.includes(time)) && (!o.seasons || o.seasons.includes(season))) return o.species;
    }
    return null;
  }

  const api = { WORLD, TIMES, SEASONS, groundAt, SPECIES, HIDEOUTS, MISSIONS, present, hiddenIn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PaizonForestData = api;
})(typeof window !== 'undefined' ? window : globalThis);
