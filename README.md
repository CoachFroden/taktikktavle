# Taktikktavle V2

Digital fotball-taktikktavle bygget med Next.js og SVG.

## V2-funksjoner

- 11er-, 9er-, 7er- og 5er-bane
- Hel bane, angrepshalvdel, siste tredjedel og 16-meter-visning
- Zoom og panorering
- Blå/røde spillere og keepere, ball og kjegler
- Mindre, ryddige spillerfigurer med navn og nummer
- Dra-og-slipp av objekter
- Rett A → B-bevegelse
- Frihåndsbevegelse der spiller eller ball følger tegnet kurve
- Pasningsverktøy fra spiller til spiller
- Piler og stiplede løpslinjer
- Individuell starttid og varighet per bevegelse
- Visuell tidslinje
- Play, pause, scrubber, hastighet og revers av alle bevegelser
- Flere scener/sekvenser med «ny scene fra sluttposisjon»
- Spill hele sekvensen fremover eller baklengs
- Undo/redo og hurtigtaster
- Duplisering og hurtigmeny på objekter
- Startformasjoner: 4-3-3, 4-4-2, 3-4-3, 9er 3-3-2, 7er 2-3-1 og 5er 1-2-1
- Presentasjonsmodus
- PNG-eksport
- Responsivt grensesnitt for PC, nettbrett og mobil
- Lokal lagring i nettleseren
- Bakoverkompatibel åpning av tavler lagret med V1

## Hurtigtaster

- `Mellomrom`: play/pause fremover
- `R`: spill baklengs
- `Ctrl/Cmd + Z`: angre
- `Ctrl/Cmd + Shift + Z` eller `Ctrl/Cmd + Y`: gjør om
- `Delete/Backspace`: slett valgt objekt
- `Esc`: lukk hurtigmeny / avslutt presentasjon

## Kjør lokalt

```bash
npm install
npm run dev
```

Åpne deretter `http://localhost:3000`.

## Produksjon

```bash
npm run build
npm start
```

Prosjektet kan kobles direkte til Vercel via GitHub.

## Lagring

Prosjekter lagres foreløpig i nettleserens `localStorage`. Det betyr at lagringen er knyttet til nettleseren/enheten. En senere versjon kan flytte dette til Firebase eller annen skylagring for flere prosjekter og synkronisering mellom enheter.
