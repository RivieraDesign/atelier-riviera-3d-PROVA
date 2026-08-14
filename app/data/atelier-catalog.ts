export type PartRole = "plane" | "leg";

export type AtelierPartId =
  | "top"
  | "subtop"
  | "leg-a"
  | "leg-b";

/**
 * Alias mantenuto per compatibilità con eventuali componenti
 * che importano ancora AlettePartId.
 */
export type AlettePartId = AtelierPartId;

export type AtelierProductId =
  | "alette-coffee"
  | "riviera-coffee"
  | "riviera-side"
  | "riviera-dining";

export type ProductPart = {
  id: AtelierPartId;
  meshName: string;
  label: string;
  shortLabel: string;
  role: PartRole;
  specification: string;
  explodeOffset: readonly [
    number,
    number,
    number,
  ];
};

export type AtelierProduct = {
  id: AtelierProductId;
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

export type StoneMaterial = {
  id: string;
  name: string;
  texture: string;
  roughness: number;
  allowedOn: readonly PartRole[];
};

const everyPart: readonly PartRole[] = [
  "plane",
  "leg",
];

const planesOnly: readonly PartRole[] = [
  "plane",
];

export const stoneMaterials: readonly StoneMaterial[] = [
  {
    id: "bianco-carrara",
    name: "Bianco Carrara",
    texture:
      "/atelier/materials/bianco-carrara.webp",
    roughness: 0.42,
    allowedOn: everyPart,
  },
  {
    id: "statuario-vagli",
    name: "Statuario Vagli",
    texture:
      "/atelier/materials/statuario-vagli.jpg",
    roughness: 0.38,
    allowedOn: everyPart,
  },
  {
    id: "arabescato-corchia",
    name: "Arabescato Corchia",
    texture:
      "/atelier/materials/arabescato-corchia.jpg",
    roughness: 0.4,
    allowedOn: everyPart,
  },
  {
    id: "arabescato-vagli",
    name: "Arabescato Vagli",
    texture:
      "/atelier/materials/arabescato-vagli.jpg",
    roughness: 0.4,
    allowedOn: everyPart,
  },
  {
    id: "calacatta-oro",
    name: "Calacatta Oro",
    texture:
      "/atelier/materials/calacatta-oro.jpg",
    roughness: 0.38,
    allowedOn: everyPart,
  },
  {
    id: "calacatta-viola",
    name: "Calacatta Viola",
    texture:
      "/atelier/materials/calacatta-viola.webp",
    roughness: 0.38,
    allowedOn: everyPart,
  },
  {
    id: "travertino",
    name: "Travertino",
    texture:
      "/atelier/materials/travertino.webp",
    roughness: 0.58,
    allowedOn: everyPart,
  },
  {
    id: "verde-guatemala",
    name: "Verde Guatemala",
    texture:
      "/atelier/materials/verde-guatemala.jpg",
    roughness: 0.42,
    allowedOn: everyPart,
  },
  {
    id: "nero-marquina",
    name: "Nero Marquina",
    texture:
      "/atelier/materials/nero-marquina.jpg",
    roughness: 0.36,
    allowedOn: everyPart,
  },
  {
    id: "port-laurent",
    name: "Port Laurent",
    texture:
      "/atelier/materials/port-laurent.jpg",
    roughness: 0.37,
    allowedOn: everyPart,
  },
  {
    id: "ardesia-ligure",
    name: "Ardesia Ligure",
    texture:
      "/atelier/materials/ardesia-ligure.webp",
    roughness: 0.72,
    allowedOn: everyPart,
  },
  {
    id: "azul-macauba",
    name: "Azul Macauba",
    texture:
      "/atelier/materials/azul-macauba.jpg",
    roughness: 0.42,
    allowedOn: planesOnly,
  },
  {
    id: "bardiglio",
    name: "Bardiglio",
    texture:
      "/atelier/materials/bardiglio.jpg",
    roughness: 0.45,
    allowedOn: planesOnly,
  },
  {
    id: "daino-reale",
    name: "Daino Reale",
    texture:
      "/atelier/materials/daino-reale.jpg",
    roughness: 0.44,
    allowedOn: planesOnly,
  },
  {
    id: "emperador-dark",
    name: "Emperador Dark",
    texture:
      "/atelier/materials/emperador-dark.jpg",
    roughness: 0.38,
    allowedOn: planesOnly,
  },
  {
    id: "grigio-perla",
    name: "Grigio Perla",
    texture:
      "/atelier/materials/grigio-perla.jpg",
    roughness: 0.46,
    allowedOn: everyPart,
  },
] as const;

/**
 * Alette Coffee mantiene tre componenti:
 *
 * - Piana
 * - Gamba_A
 * - Gamba_B
 */
export const aletteParts = [
  {
    id: "top",
    meshName: "Piana",
    label: "Piana superiore",
    shortLabel: "Piana",
    role: "plane",
    specification:
      "Ø 1000 × 20 mm · quattro sedi radiali · bordo inclinato",
    explodeOffset: [0, 0.42, 0],
  },
  {
    id: "leg-a",
    meshName: "Gamba_A",
    label: "Gamba uno",
    shortLabel: "Gamba 1",
    role: "leg",
    specification:
      "1000 × 350 × 30 mm · cava centrale dall’alto · due tenoni",
    explodeOffset: [0, 0, 0],
  },
  {
    id: "leg-b",
    meshName: "Gamba_B",
    label: "Gamba due",
    shortLabel: "Gamba 2",
    role: "leg",
    specification:
      "1000 × 350 × 30 mm · cava centrale dal basso · due tenoni",
    explodeOffset: [0, 0.22, 0],
  },
] as const satisfies readonly ProductPart[];

/**
 * GF Coffee, GF Side e GF Dining utilizzano
 * quattro componenti:
 *
 * - Piana
 * - Sottopiana
 * - Gamba_lato_A
 * - Gamba_lato_B
 */
export const rivieraParts = [
  {
    id: "top",
    meshName: "Piana",
    label: "Piano superiore",
    shortLabel: "Piano",
    role: "plane",
    specification:
      "Piano superiore in pietra naturale",
    explodeOffset: [0, 0.48, 0],
  },
  {
    id: "subtop",
    meshName: "Sottopiana",
    label: "Sottopiano",
    shortLabel: "Sottopiano",
    role: "plane",
    specification:
      "Sottopiano in pietra naturale",
    explodeOffset: [0, 0.24, 0],
  },
  {
    id: "leg-a",
    meshName: "Gamba_lato_A",
    label: "Gamba lato A",
    shortLabel: "Gamba A",
    role: "leg",
    specification:
      "Prima gamba strutturale in pietra naturale",
    explodeOffset: [-0.18, 0, 0],
  },
  {
    id: "leg-b",
    meshName: "Gamba_lato_B",
    label: "Gamba lato B",
    shortLabel: "Gamba B",
    role: "leg",
    specification:
      "Seconda gamba strutturale in pietra naturale",
    explodeOffset: [0.18, 0, 0],
  },
] as const satisfies readonly ProductPart[];

export const atelierProducts = {
  "alette-coffee": {
    id: "alette-coffee",
    collection: "Alette Collection",
    name: "Alette Coffee Table",
    shortName: "Alette",
    code: "RD-ALT-CT-1000",
    revision: "B",
    model:
      "/atelier/models/alette-coffee-rev-b.glb",
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
    model:
      "/atelier/models/coffee_table_riviera.glb",
    dimensions: "Ø 80,5 × H 35 cm",
    nominalMass: "Su richiesta",
    parts: rivieraParts,
  },

  /**
   * Correzione dell’associazione:
   * il file dining_table_riviera.glb contiene il modello Side.
   */
  "riviera-side": {
    id: "riviera-side",
    collection: "GF Collection",
    name: "GF Side Table",
    shortName: "Side",
    code: "RD-GF-SIDE",
    revision: "01",
    model:
      "/atelier/models/dining_table_riviera.glb",
    dimensions: "Ø 55 × H 52 cm",
    nominalMass: "Su richiesta",
    parts: rivieraParts,
  },

  /**
   * Correzione dell’associazione:
   * il file side_table_riviera.glb contiene il modello Dining.
   */
  "riviera-dining": {
    id: "riviera-dining",
    collection: "GF Collection",
    name: "GF Dining Table",
    shortName: "Dining",
    code: "RD-GF-DINING",
    revision: "01",
    model:
      "/atelier/models/side_table_riviera.glb",
    dimensions: "Ø 122,5 × H 79 cm",
    nominalMass: "Su richiesta",
    parts: rivieraParts,
  },
} as const satisfies Record<
  AtelierProductId,
  AtelierProduct
>;

/**
 * Esportazione mantenuta per compatibilità con il codice
 * precedente che importa direttamente aletteCoffee.
 */
export const aletteCoffee =
  atelierProducts["alette-coffee"];

/**
 * Controlla se un valore ricevuto dall’URL rappresenta
 * effettivamente uno dei prodotti disponibili.
 */
export function isAtelierProductId(
  value: string | null | undefined,
): value is AtelierProductId {
  return Boolean(
    value &&
      Object.prototype.hasOwnProperty.call(
        atelierProducts,
        value,
      ),
  );
}

/**
 * Restituisce il prodotto richiesto oppure Alette
 * Coffee Table come fallback.
 */
export function getAtelierProduct(
  value: string | null | undefined,
): AtelierProduct {
  if (isAtelierProductId(value)) {
    return atelierProducts[value];
  }

  return atelierProducts["alette-coffee"];
}
