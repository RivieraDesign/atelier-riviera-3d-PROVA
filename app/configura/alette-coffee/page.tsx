/* eslint-disable @next/next/no-img-element -- Il marchio locale è già ottimizzato e condiviso con l’Atelier. */
/* eslint-disable @next/next/no-html-link-for-pages -- Usiamo navigazione completa per compatibilità con Vinext. */
import type { Metadata } from "next";
import AletteConfigurator from "../../components/configurator/AletteConfigurator";
import { aletteCoffee } from "../../data/atelier-catalog";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Configura Alette Coffee | Atelier Riviera 3D",
  description: "Componi Alette Coffee Table scegliendo la pietra di ogni elemento.",
};

export default function AletteCoffeePage() {
  return (
    <main className="configurator-page">
      <header className="topbar configurator-topbar">
        <a className="brand" href="/" aria-label="Atelier Riviera 3D - torna alla selezione">
          <span className="brand-mark" aria-hidden="true">
            <img src="/brand/riviera-mark-black.png" alt="" />
          </span>
          <span>Riviera Design</span>
        </a>
      </header>

      <section className="product-introduction" aria-labelledby="alette-title">
        <a className="back-link" href="/">← Torna alle collezioni</a>
        <div className="product-intro-copy">
          <p className="eyebrow">Alette Collection · Coffee 01</p>
          <h1 id="alette-title">Alette<br /><em>Coffee Table</em></h1>
          <p>
            Tre elementi in pietra naturale si incontrano in un equilibrio essenziale:
            una piana e due gambe ad incastro, senza colle né viti.
          </p>
        </div>
        <dl className="product-facts">
          <div><dt>Geometria</dt><dd>Rev. {aletteCoffee.revision}</dd></div>
          <div><dt>Dimensioni</dt><dd>{aletteCoffee.dimensions}</dd></div>
          <div><dt>Componenti</dt><dd>3 elementi</dd></div>
          <div><dt>Peso nominale</dt><dd>{aletteCoffee.nominalMass}</dd></div>
        </dl>
      </section>

      <AletteConfigurator />

      <section className="configuration-note" aria-labelledby="preview-note-title">
        <p className="eyebrow">Nota sulla configurazione</p>
        <h2 id="preview-note-title">La materia non si ripete mai allo stesso modo.</h2>
        <p>
          Questa esperienza rappresenta proporzioni, abbinamenti e carattere generale della pietra.
          Venature, tono, finitura e disponibilità vengono confermati sulla lastra reale insieme a Riviera Design.
        </p>
      </section>

      <footer>
        <span>Riviera Design</span>
        <span>Atelier Riviera 3D · Alette Coffee Rev. B</span>
        <a href="#alette-title">Torna all’inizio ↑</a>
      </footer>
    </main>
  );
}
