"use client";

/* eslint-disable @next/next/no-img-element -- Il marchio locale è già ottimizzato e condiviso con l’Atelier. */
/* eslint-disable @next/next/no-html-link-for-pages -- Usiamo navigazione completa per compatibilità con Vinext. */

import {
  useEffect,
  useState,
} from "react";
import AletteConfigurator from "../../components/configurator/AletteConfigurator";
import {
  atelierProducts,
  isAtelierProductId,
  type AtelierProduct,
  type AtelierProductId,
} from "../../data/atelier-catalog";

const DEFAULT_PRODUCT_ID: AtelierProductId =
  "alette-coffee";

type ProductPresentation = {
  eyebrow: string;
  heading: string;
  headingDetail: string;
  description: string;
  geometry: string;
};

const productPresentations: Record<
  AtelierProductId,
  ProductPresentation
> = {
  "alette-coffee": {
    eyebrow:
      "Alette Collection · Coffee 01",
    heading: "Alette",
    headingDetail: "Coffee Table",
    description:
      "Tre elementi in pietra naturale si incontrano in un equilibrio essenziale: una piana e due gambe ad incastro, senza colle né viti.",
    geometry:
      "Una piana · due gambe",
  },

  "riviera-coffee": {
    eyebrow:
      "GF Collection · Coffee Table",
    heading: "GF",
    headingDetail: "Coffee Table",
    description:
      "Una composizione raccolta e scultorea, costruita attraverso la sovrapposizione di due piani e l’incontro delle gambe in pietra naturale.",
    geometry:
      "Doppio piano · due gambe",
  },

  "riviera-side": {
    eyebrow:
      "GF Collection · Side Table",
    heading: "GF",
    headingDetail: "Side Table",
    description:
      "Un elemento compatto da affiancare a sedute, letti e divani, caratterizzato dal doppio piano e dalla costruzione interamente a incastro.",
    geometry:
      "Doppio piano · due gambe",
  },

  "riviera-dining": {
    eyebrow:
      "GF Collection · Dining Table",
    heading: "GF",
    headingDetail: "Dining Table",
    description:
      "Una presenza architettonica pensata per lo spazio conviviale. Il doppio piano e le gambe speculari trasformano la pietra in una composizione sospesa.",
    geometry:
      "Doppio piano · due gambe",
  },
};

function getRequestedProductId(): AtelierProductId {
  if (typeof window === "undefined") {
    return DEFAULT_PRODUCT_ID;
  }

  const requestedProductId =
    new URLSearchParams(
      window.location.search,
    ).get("model");

  if (isAtelierProductId(requestedProductId)) {
    return requestedProductId;
  }

  const storedProductId =
    window.localStorage.getItem(
      "atelier-riviera-model",
    );

  if (isAtelierProductId(storedProductId)) {
    return storedProductId;
  }

  return DEFAULT_PRODUCT_ID;
}

export default function ConfiguratorPage() {
  const [
    selectedProductId,
    setSelectedProductId,
  ] = useState<AtelierProductId>(
    DEFAULT_PRODUCT_ID,
  );

  const selectedProduct: AtelierProduct =
    atelierProducts[selectedProductId];

  const presentation =
    productPresentations[selectedProductId];

  useEffect(() => {
    const requestedProductId =
      getRequestedProductId();

    window.localStorage.setItem(
      "atelier-riviera-model",
      requestedProductId,
    );

    setSelectedProductId(
      requestedProductId,
    );
  }, []);

  const componentCount =
    selectedProduct.parts.length;

  return (
    <main className="configurator-page">
      <header className="topbar configurator-topbar">
        <a
          className="brand"
          href="/"
          aria-label="Atelier Riviera 3D - torna alla selezione"
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

      <section
        className="product-introduction"
        aria-labelledby="product-title"
      >
        <a
          className="back-link"
          href="/"
        >
          ← Torna alle collezioni
        </a>

        <div className="product-intro-copy">
          <p className="eyebrow">
            {presentation.eyebrow}
          </p>

          <h1 id="product-title">
            {presentation.heading}
            <br />

            <em>
              {presentation.headingDetail}
            </em>
          </h1>

          <p>
            {presentation.description}
          </p>
        </div>

        <dl className="product-facts">
          <div>
            <dt>Modello</dt>

            <dd>
              {selectedProduct.code}
            </dd>
          </div>

          <div>
            <dt>Revisione</dt>

            <dd>
              {selectedProduct.revision}
            </dd>
          </div>

          <div>
            <dt>Dimensioni</dt>

            <dd>
              {selectedProduct.dimensions}
            </dd>
          </div>

          <div>
            <dt>Geometria</dt>

            <dd>
              {presentation.geometry}
            </dd>
          </div>

          <div>
            <dt>Componenti</dt>

            <dd>
              {componentCount}{" "}
              {componentCount === 1
                ? "elemento"
                : "elementi"}
            </dd>
          </div>

          <div>
            <dt>Peso nominale</dt>

            <dd>
              {selectedProduct.nominalMass}
            </dd>
          </div>
        </dl>
      </section>

      <AletteConfigurator />

      <section
        className="configuration-note"
        aria-labelledby="preview-note-title"
      >
        <p className="eyebrow">
          Nota sulla configurazione
        </p>

        <h2 id="preview-note-title">
          La materia non si ripete mai
          allo stesso modo.
        </h2>

        <p>
          Questa esperienza rappresenta
          proporzioni, abbinamenti e
          carattere generale della
          pietra. Venature, tono, finitura
          e disponibilità vengono
          confermati sulla lastra reale
          insieme a Riviera Design.
        </p>
      </section>

      <footer>
        <span>Riviera Design</span>

        <span>
          Atelier Riviera 3D ·{" "}
          {selectedProduct.name} · Rev.{" "}
          {selectedProduct.revision}
        </span>

        <a href="#product-title">
          Torna all’inizio ↑
        </a>
      </footer>
    </main>
  );
}
