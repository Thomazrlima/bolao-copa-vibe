export type Team = {
  code: string;
  name: string;
  flag: string; // emoji
  group: string; // A..L
  // pre-tournament strength rank (1 = strongest) for seeding mocks
  rank: number;
};

// 48 seleções organizadas em 12 grupos (A..L) — composição plausível
export const TEAMS: Team[] = [
  // A
  { code: "MEX", name: "México", flag: "🇲🇽", group: "A", rank: 14 },
  { code: "CRC", name: "Costa Rica", flag: "🇨🇷", group: "A", rank: 39 },
  { code: "UZB", name: "Uzbequistão", flag: "🇺🇿", group: "A", rank: 47 },
  { code: "NOR", name: "Noruega", flag: "🇳🇴", group: "A", rank: 19 },
  // B
  { code: "CAN", name: "Canadá", flag: "🇨🇦", group: "B", rank: 18 },
  { code: "ECU", name: "Equador", flag: "🇪🇨", group: "B", rank: 26 },
  { code: "EGY", name: "Egito", flag: "🇪🇬", group: "B", rank: 35 },
  { code: "AUT", name: "Áustria", flag: "🇦🇹", group: "B", rank: 22 },
  // C
  { code: "USA", name: "Estados Unidos", flag: "🇺🇸", group: "C", rank: 13 },
  { code: "JPN", name: "Japão", flag: "🇯🇵", group: "C", rank: 11 },
  { code: "SEN", name: "Senegal", flag: "🇸🇳", group: "C", rank: 21 },
  { code: "AUS", name: "Austrália", flag: "🇦🇺", group: "C", rank: 28 },
  // D
  { code: "BRA", name: "Brasil", flag: "🇧🇷", group: "D", rank: 2 },
  { code: "URU", name: "Uruguai", flag: "🇺🇾", group: "D", rank: 12 },
  { code: "TUN", name: "Tunísia", flag: "🇹🇳", group: "D", rank: 41 },
  { code: "JOR", name: "Jordânia", flag: "🇯🇴", group: "D", rank: 46 },
  // E
  { code: "FRA", name: "França", flag: "🇫🇷", group: "E", rank: 3 },
  { code: "KOR", name: "Coreia do Sul", flag: "🇰🇷", group: "E", rank: 20 },
  { code: "PAR", name: "Paraguai", flag: "🇵🇾", group: "E", rank: 30 },
  { code: "CIV", name: "Costa do Marfim", flag: "🇨🇮", group: "E", rank: 25 },
  // F
  { code: "ARG", name: "Argentina", flag: "🇦🇷", group: "F", rank: 1 },
  { code: "BEL", name: "Bélgica", flag: "🇧🇪", group: "F", rank: 9 },
  { code: "QAT", name: "Catar", flag: "🇶🇦", group: "F", rank: 42 },
  { code: "SCO", name: "Escócia", flag: "🏴", group: "F", rank: 24 },
  // G
  { code: "ENG", name: "Inglaterra", flag: "🏴", group: "G", rank: 4 },
  { code: "SUI", name: "Suíça", flag: "🇨🇭", group: "G", rank: 17 },
  { code: "GHA", name: "Gana", flag: "🇬🇭", group: "G", rank: 32 },
  { code: "PAN", name: "Panamá", flag: "🇵🇦", group: "G", rank: 37 },
  // H
  { code: "ESP", name: "Espanha", flag: "🇪🇸", group: "H", rank: 5 },
  { code: "CRO", name: "Croácia", flag: "🇭🇷", group: "H", rank: 10 },
  { code: "NZL", name: "Nova Zelândia", flag: "🇳🇿", group: "H", rank: 38 },
  { code: "CPV", name: "Cabo Verde", flag: "🇨🇻", group: "H", rank: 44 },
  // I
  { code: "POR", name: "Portugal", flag: "🇵🇹", group: "I", rank: 6 },
  { code: "MAR", name: "Marrocos", flag: "🇲🇦", group: "I", rank: 15 },
  { code: "IRN", name: "Irã", flag: "🇮🇷", group: "I", rank: 27 },
  { code: "CUW", name: "Curaçao", flag: "🇨🇼", group: "I", rank: 48 },
  // J
  { code: "GER", name: "Alemanha", flag: "🇩🇪", group: "J", rank: 7 },
  { code: "COL", name: "Colômbia", flag: "🇨🇴", group: "J", rank: 16 },
  { code: "SRB", name: "Sérvia", flag: "🇷🇸", group: "J", rank: 29 },
  { code: "HAI", name: "Haiti", flag: "🇭🇹", group: "J", rank: 45 },
  // K
  { code: "ITA", name: "Itália", flag: "🇮🇹", group: "K", rank: 8 },
  { code: "NED", name: "Holanda", flag: "🇳🇱", group: "K", rank: 23 },
  { code: "ALG", name: "Argélia", flag: "🇩🇿", group: "K", rank: 31 },
  { code: "RSA", name: "África do Sul", flag: "🇿🇦", group: "K", rank: 36 },
  // L
  { code: "DEN", name: "Dinamarca", flag: "🇩🇰", group: "L", rank: 33 },
  { code: "TUR", name: "Turquia", flag: "🇹🇷", group: "L", rank: 34 },
  { code: "CHI", name: "Chile", flag: "🇨🇱", group: "L", rank: 40 },
  { code: "SAU", name: "Arábia Saudita", flag: "🇸🇦", group: "L", rank: 43 },
];

export const TEAM_BY_CODE: Record<string, Team> = Object.fromEntries(TEAMS.map((t) => [t.code, t]));

export const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;
export type GroupKey = (typeof GROUPS)[number];

export function teamsByGroup(g: GroupKey): Team[] {
  return TEAMS.filter((t) => t.group === g);
}
