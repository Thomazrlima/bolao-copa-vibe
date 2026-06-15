export type ConfederationCode = "UEFA" | "CONMEBOL" | "CONCACAF" | "CAF" | "AFC" | "OFC";

export type SelectionIdentity = {
  region: string;
  confederation: {
    code: ConfederationCode;
    name: string;
  };
  location: {
    latitude: number;
    longitude: number;
  };
};

const CONFEDERATIONS: Record<ConfederationCode, string> = {
  UEFA: "União das Associações Europeias de Futebol",
  CONMEBOL: "Confederação Sul-Americana de Futebol",
  CONCACAF: "Confederação de Futebol da América do Norte, Central e Caribe",
  CAF: "Confederação Africana de Futebol",
  AFC: "Confederação Asiática de Futebol",
  OFC: "Confederação de Futebol da Oceania",
};

const SELECTION_META: Record<
  string,
  {
    region: string;
    confederation: ConfederationCode;
    latitude: number;
    longitude: number;
  }
> = {
  ALG: { region: "África", confederation: "CAF", latitude: 28.03, longitude: 1.66 },
  ARG: { region: "America do Sul", confederation: "CONMEBOL", latitude: -38.42, longitude: -63.62 },
  AUS: { region: "Ásia", confederation: "AFC", latitude: -25.27, longitude: 133.78 },
  AUT: { region: "Europa", confederation: "UEFA", latitude: 47.52, longitude: 14.55 },
  BEL: { region: "Europa", confederation: "UEFA", latitude: 50.5, longitude: 4.47 },
  BIH: { region: "Europa", confederation: "UEFA", latitude: 43.92, longitude: 17.68 },
  BRA: { region: "America do Sul", confederation: "CONMEBOL", latitude: -14.24, longitude: -51.93 },
  CAN: {
    region: "America do Norte",
    confederation: "CONCACAF",
    latitude: 56.13,
    longitude: -106.35,
  },
  CHI: { region: "America do Sul", confederation: "CONMEBOL", latitude: -35.68, longitude: -71.54 },
  CIV: { region: "África", confederation: "CAF", latitude: 7.54, longitude: -5.55 },
  COD: { region: "África", confederation: "CAF", latitude: -4.04, longitude: 21.76 },
  COL: { region: "America do Sul", confederation: "CONMEBOL", latitude: 4.57, longitude: -74.3 },
  CPV: { region: "África", confederation: "CAF", latitude: 16, longitude: -24 },
  CRC: { region: "America do Norte", confederation: "CONCACAF", latitude: 9.75, longitude: -83.75 },
  CRO: { region: "Europa", confederation: "UEFA", latitude: 45.1, longitude: 15.2 },
  CUW: {
    region: "America do Norte",
    confederation: "CONCACAF",
    latitude: 12.17,
    longitude: -68.99,
  },
  CZE: { region: "Europa", confederation: "UEFA", latitude: 49.82, longitude: 15.47 },
  DEN: { region: "Europa", confederation: "UEFA", latitude: 56.26, longitude: 9.5 },
  ECU: { region: "America do Sul", confederation: "CONMEBOL", latitude: -1.83, longitude: -78.18 },
  EGY: { region: "África", confederation: "CAF", latitude: 26.82, longitude: 30.8 },
  ENG: { region: "Europa", confederation: "UEFA", latitude: 52.36, longitude: -1.17 },
  ESP: { region: "Europa", confederation: "UEFA", latitude: 40.46, longitude: -3.75 },
  FRA: { region: "Europa", confederation: "UEFA", latitude: 46.23, longitude: 2.21 },
  GER: { region: "Europa", confederation: "UEFA", latitude: 51.17, longitude: 10.45 },
  GHA: { region: "África", confederation: "CAF", latitude: 7.95, longitude: -1.02 },
  HAI: {
    region: "America do Norte",
    confederation: "CONCACAF",
    latitude: 18.97,
    longitude: -72.29,
  },
  IRN: { region: "Ásia", confederation: "AFC", latitude: 32.43, longitude: 53.69 },
  IRQ: { region: "Ásia", confederation: "AFC", latitude: 33.22, longitude: 43.68 },
  ITA: { region: "Europa", confederation: "UEFA", latitude: 41.87, longitude: 12.57 },
  JOR: { region: "Ásia", confederation: "AFC", latitude: 30.59, longitude: 36.24 },
  JPN: { region: "Ásia", confederation: "AFC", latitude: 36.2, longitude: 138.25 },
  KOR: { region: "Ásia", confederation: "AFC", latitude: 35.91, longitude: 127.77 },
  MAR: { region: "África", confederation: "CAF", latitude: 31.79, longitude: -7.09 },
  MEX: {
    region: "America do Norte",
    confederation: "CONCACAF",
    latitude: 23.63,
    longitude: -102.55,
  },
  NED: { region: "Europa", confederation: "UEFA", latitude: 52.13, longitude: 5.29 },
  NOR: { region: "Europa", confederation: "UEFA", latitude: 60.47, longitude: 8.47 },
  NZL: { region: "Oceania", confederation: "OFC", latitude: -40.9, longitude: 174.89 },
  PAN: { region: "America do Norte", confederation: "CONCACAF", latitude: 8.54, longitude: -80.78 },
  PAR: { region: "America do Sul", confederation: "CONMEBOL", latitude: -23.44, longitude: -58.44 },
  POR: { region: "Europa", confederation: "UEFA", latitude: 39.4, longitude: -8.22 },
  QAT: { region: "Ásia", confederation: "AFC", latitude: 25.35, longitude: 51.18 },
  RSA: { region: "África", confederation: "CAF", latitude: -30.56, longitude: 22.94 },
  SAU: { region: "Ásia", confederation: "AFC", latitude: 23.89, longitude: 45.08 },
  SCO: { region: "Europa", confederation: "UEFA", latitude: 56.49, longitude: -4.2 },
  SEN: { region: "África", confederation: "CAF", latitude: 14.5, longitude: -14.45 },
  SRB: { region: "Europa", confederation: "UEFA", latitude: 44.02, longitude: 21.01 },
  SUI: { region: "Europa", confederation: "UEFA", latitude: 46.82, longitude: 8.23 },
  SWE: { region: "Europa", confederation: "UEFA", latitude: 60.13, longitude: 18.64 },
  TUN: { region: "África", confederation: "CAF", latitude: 33.89, longitude: 9.54 },
  TUR: { region: "Europa", confederation: "UEFA", latitude: 38.96, longitude: 35.24 },
  URU: { region: "America do Sul", confederation: "CONMEBOL", latitude: -32.52, longitude: -55.77 },
  USA: {
    region: "America do Norte",
    confederation: "CONCACAF",
    latitude: 37.09,
    longitude: -95.71,
  },
  UZB: { region: "Ásia", confederation: "AFC", latitude: 41.38, longitude: 64.59 },
};

export function getSelectionIdentity(code?: string | null): SelectionIdentity | null {
  if (!code) return null;

  const meta = SELECTION_META[code];
  if (!meta) return null;

  return {
    region: meta.region,
    confederation: {
      code: meta.confederation,
      name: CONFEDERATIONS[meta.confederation],
    },
    location: {
      latitude: meta.latitude,
      longitude: meta.longitude,
    },
  };
}
