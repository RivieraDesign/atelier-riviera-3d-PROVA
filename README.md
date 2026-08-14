# Atelier Riviera 3D — Anteprima privata V1

Versione statica del prototipo Atelier Riviera 3D, predisposta per GitHub e Netlify.

## Contenuto

- home editoriale con GF Collection e Alette Collection;
- Alette Coffee Table configurabile sulla geometria Rev. B;
- 16 pietre disponibili sui piani e 12 sulle gambe;
- configurazione indipendente dei tre componenti;
- viste 3D, esploso, rotazione e salvataggio immagine;
- modalità Ambiente con fotografia elaborata esclusivamente nel browser.

## Avvio locale

Requisito: Node.js 22.13 o successivo, fino alla versione 24.

```bash
npm install
npm run dev
```

## Controlli

```bash
npm run lint
npm run typecheck
npm test
```

`npm test` genera anche l’esportazione statica e verifica le due pagine e gli asset principali.

## Pubblicazione Netlify

Il file `netlify.toml` contiene già comando di build e cartella da pubblicare. Collegando questa
repository a Netlify non servono variabili d’ambiente.

Questa anteprima è contrassegnata `noindex`, ma ciò non costituisce una protezione di accesso.
Finché titolarità degli asset e strategia di tutela del design non saranno definite, usare una
repository GitHub privata e proteggere anche il progetto Netlify.

## Privacy della modalità Ambiente

La fotografia scelta dall’utente resta nella memoria del browser, non viene inviata a Riviera
Design e scompare quando viene rimossa o quando la pagina viene chiusa. Il browser conserva nel
`localStorage` soltanto l’identificativo del modello selezionato nella home.

## Diritti

Marchio, fotografie, texture, modello tridimensionale e disegni rimangono soggetti ai diritti dei
rispettivi titolari. Questa repository non concede licenze su tali materiali. Le licenze dei
principali componenti open source sono riepilogate in `THIRD_PARTY_NOTICES.md`.
