"use client";
/* eslint-disable @next/next/no-img-element -- Le immagini editoriali locali sono già preparate per questa anteprima. */

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

const gfModels = [
  {
    id: "dining",
    collection: "GF",
    kicker: "Spazio conviviale",
    name: "GF Dining Table",
    description: "Una presenza architettonica pensata per riunire lo spazio intorno alla materia.",
    image: "/brand/dining.jpg",
    configurable: false,
  },
  {
    id: "coffee",
    collection: "GF",
    kicker: "Living e hospitality",
    name: "GF Coffee Table",
    description: "Una composizione raccolta, equilibrata tra gesto scultoreo e vita quotidiana.",
    image: "/brand/coffee.jpg",
    configurable: false,
  },
  {
    id: "side",
    collection: "GF",
    kicker: "Accento compatto",
    name: "GF Side Table",
    description: "Un elemento essenziale per affiancare sedute, letti e divani.",
    image: "/brand/side.jpg",
    configurable: false,
  },
] as const;

const aletteModel = {
  id: "alette-coffee",
  collection: "Alette",
  kicker: "Nuova collezione · Modello 3D disponibile",
  name: "Alette Coffee Table",
  description: "Una piana e due gambe si incontrano in un equilibrio netto, interamente affidato alla geometria dell’incastro.",
  configurable: true,
  route: "/configura/alette-coffee",
} as const;

const models = [...gfModels, aletteModel] as const;
type ModelId = (typeof models)[number]["id"];

export default function Home() {
  const [selected, setSelected] = useState<ModelId>("dining");
  const collection = useRef<HTMLElement>(null);
  const modelButtons = useRef<Partial<Record<ModelId, HTMLButtonElement | null>>>({});

  useEffect(() => {
    const stored = window.localStorage.getItem("atelier-riviera-model") as ModelId | null;
    if (!stored || !models.some((model) => model.id === stored)) return;
    const frame = window.requestAnimationFrame(() => setSelected(stored));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function chooseModel(id: ModelId, moveFocus = false) {
    setSelected(id);
    window.localStorage.setItem("atelier-riviera-model", id);
    if (moveFocus) window.requestAnimationFrame(() => modelButtons.current[id]?.focus());
  }

  function handleModelKeys(event: KeyboardEvent<HTMLButtonElement>, id: ModelId) {
    const ids = models.map((model) => model.id);
    const index = ids.indexOf(id);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % ids.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + ids.length) % ids.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = ids.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    chooseModel(ids[nextIndex], true);
  }

  const current = models.find((model) => model.id === selected) ?? models[0];

  return (
    <main>
      <section className="hero" aria-labelledby="atelier-title">
        <header className="topbar">
          <a className="brand" href="https://riviera-design.com/" aria-label="Riviera Design - torna al sito">
            <span className="brand-mark" aria-hidden="true">
              <img src="/brand/riviera-mark-black.png" alt="" />
            </span>
            <span>Riviera Design</span>
          </a>
          <span className="private-badge">Anteprima riservata</span>
        </header>

        <div className="hero-copy">
          <p className="eyebrow">Riviera Design presenta</p>
          <h1 id="atelier-title">Atelier Riviera <em>3D</em></h1>
          <p className="claim">Configura la materia.<br />Componi il tuo Riviera.</p>
          <p className="intro">
            Esplora GF Collection e Alette Collection. Scegli il modello e costruisci una composizione personale
            attraverso pietre, proporzioni e dettagli.
          </p>
          
        </div>

        <div className="hero-visual" role="img" aria-label="GF Coffee Table ambientato in un interno contemporaneo">
          <div className="image-wash" />
          <div className="stone-orbit stone-orbit-one" />
          <div className="stone-orbit stone-orbit-two" />
          <span className="visual-caption">GF Collection · Preview 01</span>
        </div>

        <p className="hero-note">
          La configurazione è un’anteprima progettuale. Materiali, disponibilità e fattibilità
          vengono verificati insieme a Riviera Design.
        </p>
      </section>

      

        <div className="collection-selector" role="radiogroup" aria-labelledby="models-title">
          <div className="collection-family">
            <div className="family-heading">
              <div><span>GF</span><h3>GF Collection</h3></div>
              <p>Quattro elementi · doppia piana · tre proporzioni</p>
            </div>
            <div className="model-grid model-grid--gf">
              {gfModels.map((model, index) => {
                const active = selected === model.id;
                return (
                  <button
                    key={model.id}
                    ref={(element) => { modelButtons.current[model.id] = element; }}
                    className={`model-card ${active ? "is-selected" : ""}`}
                    role="radio"
                    aria-checked={active}
                    tabIndex={active ? 0 : -1}
                    onKeyDown={(event) => handleModelKeys(event, model.id)}
                    onClick={() => chooseModel(model.id)}
                  >
                    <span className="card-index">0{index + 1}</span>
                    <span className="card-image"><img src={model.image} alt="" /></span>
                    <span className="card-copy">
                      <small>{model.kicker}</small>
                      <strong>{model.name}</strong>
                      <span>{model.description}</span>
                    </span>
                    <span className="selection-state">{active ? "Selezionato" : "Seleziona"}<b aria-hidden="true">{active ? "●" : "○"}</b></span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="collection-family collection-family--alette">
            <div className="family-heading family-heading--alette">
              <div><span>A</span><h3>Alette Collection</h3></div>
              <p>Tre elementi · una sola piana · nuova geometria</p>
            </div>
            <div className="model-grid model-grid--alette">
              <button
                ref={(element) => { modelButtons.current[aletteModel.id] = element; }}
                className={`model-card model-card--feature ${selected === aletteModel.id ? "is-selected" : ""}`}
                role="radio"
                aria-checked={selected === aletteModel.id}
                tabIndex={selected === aletteModel.id ? 0 : -1}
                onKeyDown={(event) => handleModelKeys(event, aletteModel.id)}
                onClick={() => chooseModel(aletteModel.id)}
              >
                <span className="alette-card-visual" aria-hidden="true">
                  <img src="/brand/alette-coffee-ambientata-v2.png" alt="" />
                  <small>Rev. B · 12.08.2026</small>
                </span>
                <span className="card-index">04</span>
                <span className="card-copy">
                  <small>{aletteModel.kicker}</small>
                  <strong>{aletteModel.name}</strong>
                  <span>{aletteModel.description}</span>
                  <span className="feature-specs">Ø 1000 × H 350 mm <b>·</b> 3 elementi</span>
                </span>
                <span className="selection-state">{selected === aletteModel.id ? "Selezionato" : "Seleziona"}<b aria-hidden="true">{selected === aletteModel.id ? "●" : "○"}</b></span>
              </button>
            </div>
          </div>
        </div>

        <div className={`next-step ${current.configurable ? "is-ready" : ""}`}>
          <div>
            <span>Prossimo passaggio</span>
            <strong>Materia</strong>
          </div>
          {current.configurable ? (
            <a className="next-step-action" href={current.route}>
              Configura {current.name.replace(" Table", "")}
              <span aria-hidden="true">→</span>
            </a>
          ) : (
            <button disabled title="Sarà attivato quando disporremo delle geometrie GF definitive">
              Continua con {current.name.replace(" Table", "")}
              <span aria-hidden="true">→</span>
            </button>
          )}
          <p>
            {current.configurable
              ? "Geometria Alette Rev. B · configurazione disponibile"
              : "Geometrie GF in validazione · il percorso si aprirà qui"}
          </p>
        </div>
      </section>

      <footer>
        <span>Riviera Design</span>
        <span>Atelier Riviera 3D · prototipo interno 2026</span>
        <a href="#atelier-title">Torna all’inizio ↑</a>
      </footer>
    </main>
  );
}
