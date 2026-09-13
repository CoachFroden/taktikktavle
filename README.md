# Taktikktavle

Digital taktikktavle for fotball, bygget med Next.js og SVG.

## Første versjon

- Velg 11er-, 9er-, 7er- eller 5er-bane
- Legg inn blå/røde spillere og keepere
- Legg inn ball og kjegler
- Dra objektene fritt rundt på banen
- Gi spillere og ball navn/nummer
- Tegn piler og stiplede løpslinjer
- Sett A → B-bevegelse på flere objekter samtidig
- Spill av, pause og reset animasjonen
- Velg avspillingshastighet
- Lagre og åpne én tavle lokalt i nettleseren
- Responsivt oppsett for PC, nettbrett og mobil

## Kjør lokalt

```bash
npm install
npm run dev
```

Åpne deretter `http://localhost:3000`.

## Bygg produksjonsversjon

```bash
npm run build
npm start
```

Prosjektet kan deployes direkte på Vercel som et vanlig Next.js-prosjekt.

## Neste naturlige steg

- Flere sekvenser/steg på en tidslinje
- Flere lagrede øvelser i stedet for bare én lokal tavle
- Kopier/dupliser objekter
- Angre/gjør om for alle operasjoner
- Halv bane / tredjedelsvisning
- Driblelinjer og fritegning
- Eksport som bilde/PDF
- Delbare taktikklenker
- Integrasjon mot CoachTool
