export type PartRole = "plane" | "leg";

export type ProductPart = {
  id: "top" | "leg-a" | "leg-b";
  meshName: "Piana" | "Gamba_A" | "Gamba_B";
  label: string;
  shortLabel: string;
  role: PartRole;
  specification: string;
  explodeOffset: readonly [number, number, number];
};

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

export const aletteCoffee = {
  id: "alette-coffee",
  collection: "Alette Collection",
  name: "Alette Coffee Table",
  code: "RD-ALT-CT-1000",
  revision: "B",
  model: "/atelier/models/alette-coffee-rev-b.glb",
  dimensions: "Ø 1000 × H 350 mm",
  nominalMass: "77,8 kg",
  parts: [
    {
      id: "top",
      meshName: "Piana",
      label: "Piana superiore",
      shortLabel: "Piana",
      role: "plane",
      specification: "Ø 1000 × 20 mm · quattro sedi radiali · bordo inclinato",
      explodeOffset: [0, 0.42, 0],
    },
    {
      id: "leg-a",
      meshName: "Gamba_A",
      label: "Gamba uno",
      shortLabel: "Gamba 1",
      role: "leg",
      specification: "1000 × 350 × 30 mm · cava centrale dall’alto · due tenoni",
      explodeOffset: [0, 0, 0],
    },
    {
      id: "leg-b",
      meshName: "Gamba_B",
      label: "Gamba due",
      shortLabel: "Gamba 2",
      role: "leg",
      specification: "1000 × 350 × 30 mm · cava centrale dal basso · due tenoni",
      explodeOffset: [0, 0.22, 0],
    },
  ] satisfies readonly ProductPart[],
} as const;

export type AlettePartId = (typeof aletteCoffee.parts)[number]["id"];
