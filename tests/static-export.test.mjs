import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../dist/client/", import.meta.url);

async function readExport(relativePath) {
  const file = new URL(relativePath, outputRoot);
  await access(file);
  return readFile(file, "utf8");
}

test("esporta la home italiana dell’Atelier", async () => {
  const html = await readExport("index.html");

  assert.match(html, /<html[^>]*lang="it"/i);
  assert.match(html, /Atelier Riviera 3D \| Riviera Design/i);
  assert.match(html, /GF Dining Table/);
  assert.match(html, /GF Coffee Table/);
  assert.match(html, /GF Side Table/);
  assert.match(html, /Alette Coffee Table/);
  assert.doesNotMatch(html, /Anteprima riservata/);
  assert.doesNotMatch(html, /GF Collection · Preview 01/);
  assert.doesNotMatch(html, /Prossimo passaggio/);
  assert.doesNotMatch(html, />Materia</);
  assert.match(html, /noindex/i);
});

test("esporta la pagina statica del configuratore Alette", async () => {
  const html = await readExport("configura/alette-coffee.html");

  assert.match(html, /Configura Alette Coffee \| Atelier Riviera 3D/i);
  assert.match(html, /Componi il tuo Alette/);
  assert.match(html, /Piana superiore/);
  assert.match(html, /Gamba 1/);
  assert.match(html, /Gamba 2/);
  assert.match(html, />Ambiente</);
  assert.match(html, /image\/jpeg,image\/png,image\/webp/);
  assert.doesNotMatch(html, /Anteprima riservata/);
});

test("include gli asset indispensabili alla configurazione", async () => {
  const requiredAssets = [
    "atelier/models/alette-coffee-rev-b.glb",
    "atelier/materials/bianco-carrara.webp",
    "atelier/materials/verde-guatemala.jpg",
    "brand/riviera-mark-black.png",
    "brand/alette-coffee-ambientata-v2.png",
    "robots.txt",
  ];

  await Promise.all(requiredAssets.map((asset) => access(new URL(asset, outputRoot))));
});
