// Mapeia o código de 3 letras das seleções para o código ISO 3166-1 alpha-2
// (ou variantes flagcdn como gb-eng, gb-sct) usado pela flagcdn.com.
export const TEAM_ISO2: Record<string, string> = {
  MEX: "mx",
  CRC: "cr",
  UZB: "uz",
  NOR: "no",
  CAN: "ca",
  ECU: "ec",
  EGY: "eg",
  AUT: "at",
  USA: "us",
  JPN: "jp",
  SEN: "sn",
  AUS: "au",
  BRA: "br",
  URU: "uy",
  TUN: "tn",
  JOR: "jo",
  FRA: "fr",
  KOR: "kr",
  PAR: "py",
  CIV: "ci",
  ARG: "ar",
  BEL: "be",
  QAT: "qa",
  SCO: "gb-sct",
  ENG: "gb-eng",
  SUI: "ch",
  GHA: "gh",
  PAN: "pa",
  ESP: "es",
  CRO: "hr",
  NZL: "nz",
  CPV: "cv",
  POR: "pt",
  MAR: "ma",
  IRN: "ir",
  CUW: "cw",
  GER: "de",
  COL: "co",
  SRB: "rs",
  HAI: "ht",
  ITA: "it",
  NED: "nl",
  ALG: "dz",
  RSA: "za",
  DEN: "dk",
  TUR: "tr",
  CHI: "cl",
  SAU: "sa",
};

export function flagUrl(code?: string, size: 20 | 40 | 80 | 160 | 320 = 80): string | null {
  if (!code) return null;
  const iso = TEAM_ISO2[code];
  if (!iso) return null;
  return `https://flagcdn.com/w${size}/${iso}.png`;
}
