#!/usr/bin/env bash
# Lager bokstavlyder (lyden, ikke bokstavnavnet: «t», ikke «te») med espeak-ng og ffmpeg.
# Krever: espeak-ng (med norsk bokmål-stemme) og ffmpeg.  Bruk: scripts/generate-letter-sounds.sh
#
# Fonemene er espeak-ng sine koder for nb. Stemte lukkelyder (b, d, g) høres ikke uten en
# ettervokal, så de lages med en svak vokal som klippes kort av.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=sounds/letters
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

# filnavn | fonem | maks lengde i sekunder
LETTERS="
a|A:|0.6
b|b@|0.16
c|s:|0.5
d|d@|0.15
e|e:|0.6
f|f:|0.5
g|g@|0.17
h|hhh|0.5
i|i:|0.6
j|jjj|0.5
k|k|0.4
l|l-|0.5
m|m-|0.5
n|n-|0.5
o|u:|0.6
p|p|0.4
q|k|0.4
r|r-|0.5
s|s:|0.5
t|t|0.4
u|u-:|0.6
v|vvv|0.5
w|vvv|0.5
x|ks|0.5
y|y:|0.6
z|s:|0.5
ae|a:|0.6
oe|Y:|0.6
aa|o:|0.6
"

for row in $LETTERS; do
  IFS='|' read -r name phoneme maxlen <<<"$row"
  espeak-ng -v nb -s 100 -w "$TMP/raw.wav" "[[$phoneme]]" 2>/dev/null
  # Fjern stillhet foran og bak, og kutt til maks lengde med en myk uttoning.
  ffmpeg -v error -y -i "$TMP/raw.wav" -af "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,atrim=0:$maxlen,afade=t=out:st=$(awk "BEGIN{printf \"%.3f\", $maxlen - 0.05}"):d=0.05" "$TMP/trim.wav"
  # Normaliser til samme toppnivå, så svake lyder som «t» og «h» blir like godt hørbare.
  peak=$(ffmpeg -i "$TMP/trim.wav" -af volumedetect -f null - 2>&1 | sed -n 's/.*max_volume: \(-\?[0-9.]*\) dB.*/\1/p')
  gain=$(awk "BEGIN{printf \"%.2f\", -1 - ($peak)}")
  ffmpeg -v error -y -i "$TMP/trim.wav" -af "volume=${gain}dB,adelay=30,apad=pad_dur=0.06" -ac 1 -ar 22050 -b:a 48k "$OUT/$name.mp3"
  echo "$name ($phoneme): $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$name.mp3")s"
done
