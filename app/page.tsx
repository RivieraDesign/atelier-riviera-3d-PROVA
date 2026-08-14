"use client";

/* eslint-disable @next/next/no-img-element -- Le immagini editoriali locali sono già preparate per questa anteprima. */
/* eslint-disable @next/next/no-html-link-for-pages -- Usiamo navigazione completa per compatibilità con Vinext. */

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { AtelierProductId } from "./data/atelier-catalog";

type SelectionModel = {
  id: AtelierProductId;
  collection: string;
  kicker: string;
  name: string;
  description: string;
  image: string;
  specifications: string;
};

const CONFIGURATOR_ROUTE =
  "/configura/alette-coffee";

const gfModels: readonly SelectionModel[] = [
  {
    id: "riviera-dining",
    collection: "GF",
    kicker: "Spazio conviviale",
    name: "GF Dining Table",
    description:
      "Una presenza architettonica pensata per riunire lo spazio intorno alla materia.",
    image: "/brand/dining.jpg",
    specifications:
      "Ø 122,5 × H 79 cm · 4 elementi",
  },
  {
    id: "riviera-coffee",
    collection: "GF",
    kicker: "Living e hospitality",
    name: "GF Coffee Table",
    description:
      "Una composizione raccolta, equilibrata tra gesto scultoreo e vita quotidiana.",
    image: "/brand/coffee.jpg",
    specifications:
      "Ø 80,5 × H 35 cm · 4 elementi",
  },
  {
    id: "riviera-side",
    collection: "GF",
    kicker: "Accento compatto",
    name: "GF Side Table",
    description:
      "Un elemento essenziale per affiancare sedute, letti e divani.",
    image: "/brand/side.jpg",
    specifications:
      "Ø 55 × H 52 cm · 4 elementi",
  },
];

const aletteModel: SelectionModel = {
  id: "alette-coffee",
  collection: "Alette",
  kicker:
    "Nuova collezione · Modello 3D disponibile",
  name: "Alette Coffee Table",
  description:
    "Una piana e due gambe si incontrano in un equilibrio netto, interamente affidato alla geometria dell’incastro.",
  image:
    "/brand/alette-coffee-ambientata-v2.png",
  specifications:
    "Ø 1000 × H 350 mm · 3 elementi",
};

const models: readonly SelectionModel[] = [
  ...gfModels,
  aletteModel,
];

export default function Home() {
  const [selected, setSelected] =
    useState<AtelierProductId>(
      "riviera-dining",
    );

  const modelButtons = useRef<
    Partial<
      Record<
        AtelierProductId,
        HTMLButtonElement | null
      >
    >
  >({});

  useEffect(() => {
    const storedProductId =
      window.localStorage.getItem(
        "atelier-riviera-model",
      );

    const storedModel = models.find(
      (model) =>
        model.id === storedProductId,
    );

    if (!storedModel) return;

    const frame =
      window.requestAnimationFrame(() => {
        setSelected(storedModel.id);
      });

    return () =>
      window.cancelAnimationFrame(frame);
  }, []);

  function selectModel(
    productId: AtelierProductId,
    moveFocus = false,
  ) {
    setSelected(productId);

    window.localStorage.setItem(
      "atelier-riviera-model",
      productId,
    );

    if (moveFocus) {
      window.requestAnimationFrame(
        () =>
          modelButtons.current[
            productId
          ]?.focus(),
      );
    }
  }

  function openConfigurator(
    productId: AtelierProductId,
  ) {
    selectModel(productId);

    const destination =
      `${CONFIGURATOR_ROUTE}?model=${encodeURIComponent(
        productId,
      )}`;

    window.location.assign(destination);
  }

  function handleModelKeys(
    event: KeyboardEvent<HTMLButtonElement>,
    productId: AtelierProductId,
  ) {
    const ids = models.map(
      (model) => model.id,
    );

    const currentIndex =
      ids.indexOf(productId);

    let nextIndex: number | null =
      null;

    if (
      event.key === "ArrowRight" ||
      event.key === "ArrowDown"
    ) {
      nextIndex =
        (currentIndex + 1) %
        ids.length;
    }

    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowUp"
    ) {
      nextIndex =
        (currentIndex -
          1 +
          ids.length) %
        ids.length;
    }

    if (event.key === "Home") {
      nextIndex = 0;
    }

    if (event.key === "End") {
      nextIndex = ids.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();

    selectModel(
      ids[nextIndex],
      true,
    );
  }

  return (
    <main>
      <section
        className="hero"
        aria-labelledby="atelier-title"
      >
        <header className="topbar">
          <a
            className="brand"
            href="https://riviera-design.com/"
            aria-label="Riviera Design - torna al sito"
          >
            <span
              className="brand-mark"
              aria-hidden="true"
            >
              <img
                src="/brand/riviera-mark-black.png"
                alt=""
              />
            </span>

            <span>Riviera Design</span>
          </a>
        </header>

        <div className="hero-copy">
          <p className="eyebrow">
            Riviera Design presenta
          </p>

          <h1 id="atelier-title">
            Atelier Riviera <em>3D</em>
          </h1>

          <p className="claim">
            Configura la materia.
            <br />
            Componi il tuo Riviera.
          </p>

          <p className="intro">
            Esplora GF Collection e
            Alette Collection. Scegli il
            modello e costruisci una
            composizione personale
            attraverso pietre,
            proporzioni e dettagli.
          </p>
        </div>

        <div
          className="hero-visual"
          role="img"
          aria-label="GF Coffee Table ambientato in un interno contemporaneo"
        >
          <div className="image-wash" />

          <div className="stone-orbit stone-orbit-one" />

          <div className="stone-orbit stone-orbit-two" />
        </div>

        <p className="hero-note">
          La configurazione è
          un’anteprima progettuale.
          Materiali, disponibilità e
          fattibilità vengono verificati
          insieme a Riviera Design.
        </p>
      </section>

      <section
        className="collection"
        aria-label="Scegli il modello"
      >
        <div
          className="collection-selector"
          role="radiogroup"
          aria-label="Modelli disponibili"
        >
          <div className="collection-family">
            <div className="family-heading">
              <div>
                <h3>GF Collection</h3>
              </div>

              <p>
                Quattro elementi · doppia
                piana · tre proporzioni
              </p>
            </div>

            <div className="model-grid model-grid--gf">
              {gfModels.map((model) => {
                const active =
                  selected === model.id;

                return (
                  <button
                    key={model.id}
                    ref={(element) => {
                      modelButtons.current[
                        model.id
                      ] = element;
                    }}
                    type="button"
                    className={`model-card ${
                      active
                        ? "is-selected"
                        : ""
                    }`}
                    role="radio"
                    aria-checked={active}
                    aria-label={`Configura ${model.name}`}
                    tabIndex={
                      active ? 0 : -1
                    }
                    onFocus={() =>
                      selectModel(
                        model.id,
                      )
                    }
                    onKeyDown={(event) =>
                      handleModelKeys(
                        event,
                        model.id,
                      )
                    }
                    onClick={() =>
                      openConfigurator(
                        model.id,
                      )
                    }
                  >
                    <span className="card-image">
                      <img
                        src={model.image}
                        alt=""
                      />
                    </span>

                    <span className="card-copy">
                      <small>
                        {model.kicker}
                      </small>

                      <strong>
                        {model.name}
                      </strong>

                      <span>
                        {
                          model.description
                        }
                      </span>

                      <span className="feature-specs card-specs">
                        {
                          model.specifications
                        }
                      </span>
                    </span>

                    <span className="selection-state">
                      <span>
                        Configura
                      </span>

                      <b aria-hidden="true">
                        →
                      </b>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="collection-family collection-family--alette">
            <div className="family-heading family-heading--alette">
              <div>
                <h3>
                  Alette Collection
                </h3>
              </div>

              <p>
                Tre elementi · una sola
                piana · nuova geometria
              </p>
            </div>

            <div className="model-grid model-grid--alette">
              <button
                ref={(element) => {
                  modelButtons.current[
                    aletteModel.id
                  ] = element;
                }}
                type="button"
                className={`model-card model-card--feature ${
                  selected ===
                  aletteModel.id
                    ? "is-selected"
                    : ""
                }`}
                role="radio"
                aria-checked={
                  selected ===
                  aletteModel.id
                }
                aria-label={`Configura ${aletteModel.name}`}
                tabIndex={
                  selected ===
                  aletteModel.id
                    ? 0
                    : -1
                }
                onFocus={() =>
                  selectModel(
                    aletteModel.id,
                  )
                }
                onKeyDown={(event) =>
                  handleModelKeys(
                    event,
                    aletteModel.id,
                  )
                }
                onClick={() =>
                  openConfigurator(
                    aletteModel.id,
                  )
                }
              >
                <span
                  className="alette-card-visual"
                  aria-hidden="true"
                >
                  <img
                    src={
                      aletteModel.image
                    }
                    alt=""
                  />

                  <small>
                    Rev. B · 12.08.2026
                  </small>
                </span>

                <span className="card-copy">
                  <small>
                    {aletteModel.kicker}
                  </small>

                  <strong>
                    {aletteModel.name}
                  </strong>

                  <span>
                    {
                      aletteModel.description
                    }
                  </span>

                  <span className="feature-specs">
                    {
                      aletteModel.specifications
                    }
                  </span>
                </span>

                <span className="selection-state">
                  <span>Configura</span>

                  <b aria-hidden="true">
                    →
                  </b>
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <span>Riviera Design</span>

        <span>
          Atelier Riviera 3D ·
          prototipo interno 2026
        </span>

        <a href="#atelier-title">
          Torna all’inizio ↑
        </a>
      </footer>
    </main>
  );
}
