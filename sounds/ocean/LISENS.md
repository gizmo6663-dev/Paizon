# Dyrelyder i Havet

Begge opptakene er undervannsopptak (hydrofon) fra det merkede datasettet
**DCLDE 2027 Killer Whales**, arkivert av NOAA National Centers for Environmental
Information i `gs://noaa-passive-bioacoustic/dclde/2027/dclde_2027_killer_whales/`.

Datasettet er lisensiert under **Creative Commons Navngivelse-DelPåSammeVilkår 4.0
(CC BY-SA 4.0)**, https://creativecommons.org/licenses/by-sa/4.0/deed.no.
Klippene under er bearbeidet (se under) og deles under samme lisens.

| Fil | Art | Kilde i datasettet |
|---|---|---|
| `knolhval.mp3` | Knølhval (*Megaptera novaeangliae*) | Fisheries and Oceans Canada (DFO_CRP), `dfo_crp/audio/wvanisl/DFOCRP.H50bjRcb-WCV1.AURAL117LF.20111206_131500Z.flac`, sekund 243,6–258,6 |
| `spekkhogger.mp3` | Spekkhogger (*Orcinus orca*) | University of Alaska Fairbanks (UAF_NGOS), `uaf/audio/field/20200620_0377.wav`, sekund 481,7–493,7 |

Kildehenvisning for arkivet: NOAA National Centers for Environmental Information (2017).
Passive Acoustic Data Collection. https://doi.org/10.25921/PF0H-SQ72

## Bearbeiding

Klippene ble valgt ut fra datasettets egne merknader (tidsrommet med flest merkede
lyder av arten), og kontrollert med spektrogram. Deretter (ffmpeg):

- Spekkhogger: høypass 1300 Hz (fjerner motorstøy rundt 700 Hz), lavpass 9 kHz,
  støyreduksjon (`afftdn=nr=18`), myk inn-/uttoning, lydstyrke normalisert til −18 LUFS, mono 44,1 kHz, MP3.
- Knølhval: høypass 520 Hz (fjerner konstant støybånd), lavpass 6,5 kHz, samme
  støyreduksjon, inn-/uttoning og normalisering.
