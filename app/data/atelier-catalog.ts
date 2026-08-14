export type PartRole = "plane" | "leg";

export type AlettePartId = "top" | "leg-a" | "leg-b";

export type ProductPart = {
  id: AlettePartId;
  meshName: string;
  label: string;
  shortLabel: string;
  role: PartRole;
  specification: string;
  explodeOffset: readonly [number, number, number];
};

export type AtelierProduct = {
  id: string;
  collection: string;
  name: string;
  shortName: string;
  code: string;
  revision: string;
  model: string;
  dimensions: string;
  nominalMass: string;
  parts: readonly ProductPart[];
};

export type AtelierProductId =
  | "alette-coffee"
  | "riviera-coffee"
  | "riviera-side"
  | "riviera-dining";

export type StoneMaterial = {
  id: string;
  name: string;
  texture: string;
  roughness: number;
  allowedOn: readonly PartRole[];
};

const everyPart: readonly PartRole[] = ["plane", "leg"];
const planesOnly: readonly PartRole[] = ["plane"];

export const stoneMaterials: readonly StoneMaterial[] = [
  { id: "bianco-carrara", name: "Bianco Carrara", texture: "/atelier/materials/bianco-carrara.webp", roughness: 0.42, allowedOn: everyPart },
  { id: "statuario-vagli", name: "Statuario Vagli", texture: "/atelier/materials/statuario-vagli.jpg", roughness: 0.38, allowedOn: everyPart },
  { id: "arabescato-corchia", name: "Arabescato Corchia", texture: "/atelier/materials/arabescato-corchia.jpg", roughness: 0.4, allowedOn: everyPart },
  { id: "arabescato-vagli", name: "Arabescato Vagli", texture: "/atelier/materials/arabescato-vagli.jpg", roughness: 0.4, allowedOn: everyPart },
  { id: "calacatta-oro", name: "Calacatta Oro", texture: "/atelier/materials/calacatta-oro.jpg", roughness: 0.38, allowedOn: everyPart },
  { id: "calacatta-viola", name: "Calacatta Viola", texture: "/atelier/materials/calacatta-viola.webp", roughness: 0.38, allowedOn: everyPart },
  { id: "travertino", name: "Travertino", texture: "/atelier/materials/travertino.webp", roughness: 0.58, allowedOn: everyPart },
  { id: "verde-guatemala", name: "Verde Guatemala", texture: "/atelier/materials/verde-guatemala.jpg", roughness: 0.42, allowedOn: everyPart },
  { id: "nero-marquina", name: "Nero Marquina", texture: "/atelier/materials/nero-marquina.jpg", roughness: 0.36, allowedOn: everyPart },
  { id: "port-laurent", name: "Port Laurent", texture: "/atelier/materials/port-laurent.jpg", roughness: 0.37, allowedOn: everyPart },
  { id: "ardesia-ligure", name: "Ardesia Ligure", texture: "/atelier/materials/ardesia-ligure.webp", roughness: 0.72, allowedOn: everyPart },
  { id: "azul-macauba", name: "Azul Macauba", texture: "/atelier/materials/azul-macauba.jpg", roughness: 0.42, allowedOn: planesOnly },
  { id: "bardiglio", name: "Bardiglio", texture: "/atelier/materials/bardiglio.jpg", roughness: 0.45, allowedOn: planesOnly },
  { id: "daino-reale", name: "Daino Reale", texture: "/atelier/materials/daino-reale.jpg", roughness: 0.44, allowedOn: planesOnly },
  { id: "emperador-dark", name: "Emperador Dark", texture: "/atelier/materials/emperador-dark.jpg", roughness: 0.38, allowedOn: planesOnly },
  { id: "grigio-perla", name: "Grigio Perla", texture: "/atelier/materials/grigio-perla.jpg", roughness: 0.46, allowedOn: everyPart },
] as const;

export const aletteParts = [
  {
    id: "top",
    meshName: "Piana",
    label: "Piana superiore",
    shortLabel: "Piana",
    role: "plane",
    specification: "Piano superiore in pietra naturale",
    explodeOffset: [0, 0.42, 0],
  },
  {
    id: "leg-a",
    meshName: "Gamba_A",
    label: "Gamba uno",
    shortLabel: "Gamba 1",
    role: "leg",
    specification: "Prima gamba strutturale in pietra naturale",
    explodeOffset: [0, 0, 0],
  },
  {
    id: "leg-b",
    meshName: "Gamba_B",
    label: "Gamba due",
    shortLabel: "Gamba 2",
    role: "leg",
    specification: "Seconda gamba strutturale in pietra naturale",
    explodeOffset: [0, 0.22, 0],
  },
] satisfies readonly ProductPart[];

export const atelierProducts: Record<AtelierProductId, AtelierProduct> = {
  "alette-coffee": {
    id: "alette-coffee",
    collection: "Alette Collection",
    name: "Alette Coffee Table",
    shortName: "Alette",
    code: "RD-ALT-CT-1000",
    revision: "B",
    model: "/atelier/models/alette-coffee-rev-b.glb",
    dimensions: "Ø 1000 × H 350 mm",
    nominalMass: "77,8 kg",
    parts: aletteParts,
  },

  "riviera-coffee": {
    id: "riviera-coffee",
    collection: "GF Collection",
    name: "GF Coffee Table",
    shortName: "Coffee",
    code: "RD-GF-COFFEE",
    revision: "01",
    model: "/atelier/models/coffee_table_riviera.glb",
    dimensions: "Ø 80,5 × H 35 cm",
    nominalMass: "Su richiesta",
    parts: aletteParts,
  },

  "riviera-side": {
    id: "riviera-side",
    collection: "GF Collection",
    name: "GF Side Table",
    shortName: "Side",
    code: "RD-GF-SIDE",
    revision: "01",
    model: "/atelier/models/side_table_riviera.glb",
    dimensions: "Ø 55 × H 52 cm",
    nominalMass: "Su richiesta",
    parts: aletteParts,
  },

  "riviera-dining": {
    id: "riviera-dining",
    collection: "GF Collection",
    name: "GF Dining Table",
    shortName: "Dining",
    code: "RD-GF-DINING",
    revision: "01",
    model: "/atelier/models/dining_table_riviera.glb",
    dimensions: "Ø 122,5 × H 79 cm",
    nominalMass: "Su richiesta",
    parts: aletteParts,
  },
};

export const aletteCoffee = atelierProducts["alette-coffee"];

export type AlettePartId = (typeof aletteCoffee.parts)[number]["id"];
