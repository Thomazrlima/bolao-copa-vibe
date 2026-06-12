import { spawnSync } from "node:child_process";
import fs from "node:fs";

const CSV_PATH = "data/fase_grupos.csv";
const TEAM_TRANSLATIONS = {
  Algeria: "Argélia",
  Argentina: "Argentina",
  Australia: "Austrália",
  Austria: "Áustria",
  Belgium: "Bélgica",
  "Bosnia-Herzegovina": "Bósnia e Herzegovina",
  Brazil: "Brasil",
  Canada: "Canadá",
  "Cape Verde": "Cabo Verde",
  Colombia: "Colômbia",
  Croatia: "Croácia",
  Curaçao: "Curaçao",
  "Czech Republic": "Tchéquia",
  "DR Congo": "RD Congo",
  Ecuador: "Equador",
  Egypt: "Egito",
  England: "Inglaterra",
  France: "França",
  Germany: "Alemanha",
  Ghana: "Gana",
  Haiti: "Haiti",
  Iran: "Irã",
  Iraq: "Iraque",
  "Ivory Coast": "Costa do Marfim",
  Japan: "Japão",
  Jordan: "Jordânia",
  Mexico: "México",
  Morocco: "Marrocos",
  Netherlands: "Países Baixos",
  "New Zealand": "Nova Zelândia",
  Norway: "Noruega",
  Panama: "Panamá",
  Paraguay: "Paraguai",
  Portugal: "Portugal",
  Qatar: "Catar",
  "Saudi Arabia": "Arábia Saudita",
  Scotland: "Escócia",
  Senegal: "Senegal",
  "South Africa": "África do Sul",
  "South Korea": "Coreia do Sul",
  Spain: "Espanha",
  Sweden: "Suécia",
  Switzerland: "Suíça",
  Tunisia: "Tunísia",
  Turkey: "Turquia",
  USA: "Estados Unidos",
  Uruguay: "Uruguai",
  Uzbekistan: "Uzbequistão",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows;
}

function quote(value) {
  if (value == null) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function score(value) {
  if (value === "") return "null";
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? String(parsed) : "null";
}

function translateTeam(team) {
  return TEAM_TRANSLATIONS[team] ?? team;
}

function utcTimestampToBrasiliaStoredIso(value) {
  const utc = new Date(`${value.replace(" ", "T")}Z`);
  utc.setUTCHours(utc.getUTCHours() - 3);
  return utc.toISOString();
}

function loadDatabaseUrl() {
  const env = fs.readFileSync(".env.local", "utf8");
  const line = env.split(/\r?\n/).find((item) => item.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL nao encontrado em .env.local");
  return line.slice("DATABASE_URL=".length);
}

const text = fs.readFileSync(CSV_PATH, "utf8");
const [headers, ...rows] = parseCsv(text);
const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]));

const values = rows
  .filter((row) => row.length > 1)
  .map((row) => {
    const eventId = row[headerIndex.idEvent];
    const timestampUtc = row[headerIndex.strTimestamp];
    const homeScore = row[headerIndex["Home Score"]];
    const awayScore = row[headerIndex["Away Score"]];
    const hasScore = homeScore !== "" && awayScore !== "";

    return [
      quote(eventId),
      "1",
      quote(translateTeam(row[headerIndex["Home Team"]])),
      quote(translateTeam(row[headerIndex["Away Team"]])),
      `${quote(utcTimestampToBrasiliaStoredIso(timestampUtc))}::timestamptz`,
      score(homeScore),
      score(awayScore),
      hasScore ? "true" : "false",
    ].join(", ");
  });

const sql = `
insert into public.jogos (
  sportsdb_event_id,
  fase_id,
  time1,
  time2,
  data,
  gols1,
  gols2,
  encerrado
)
values
  (${values.join("),\n  (")})
on conflict (sportsdb_event_id) do update
set
  fase_id = excluded.fase_id,
  time1 = excluded.time1,
  time2 = excluded.time2,
  data = excluded.data,
  gols1 = coalesce(excluded.gols1, public.jogos.gols1),
  gols2 = coalesce(excluded.gols2, public.jogos.gols2),
  encerrado = excluded.encerrado or public.jogos.encerrado;

select
  count(*) as jogos_importados,
  min(data) as primeiro_jogo_brasilia,
  max(data) as ultimo_jogo_brasilia
from public.jogos
where sportsdb_event_id is not null;
`;

const result = spawnSync("psql", [loadDatabaseUrl(), "-v", "ON_ERROR_STOP=1"], {
  input: sql,
  stdio: ["pipe", "inherit", "inherit"],
  encoding: "utf8",
});

process.exit(result.status ?? 1);
