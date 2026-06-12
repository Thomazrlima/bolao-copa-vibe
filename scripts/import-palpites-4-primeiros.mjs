import { spawnSync } from "node:child_process";
import fs from "node:fs";

const CSV_PATH = "data/bolao_4_primeiros.csv";

const MATCHES = [
  {
    eventId: "2391728",
    homeColumn: "Placar do México",
    awayColumn: "Placar da África do Sul",
  },
  {
    eventId: "2461103",
    homeColumn: "Placar da Coreia do Sul",
    awayColumn: "Placar da  Tchéquia",
  },
  {
    eventId: "2461104",
    homeColumn: "Placar do Canadá",
    awayColumn: "Placar da Bósnia",
  },
  {
    eventId: "2391729",
    homeColumn: "Placar dos Estados Unidos",
    awayColumn: "Placar do Paraguai",
  },
];

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
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Placar invalido no CSV: ${value}`);
  }
  return String(parsed);
}

function formTimestampToIso(value) {
  const [datePart, timePart] = value.split(" ");
  const [day, month, year] = datePart.split("/");
  return `${year}-${month}-${day}T${timePart}-03:00`;
}

function loadDatabaseUrl() {
  const env = fs.readFileSync(".env.local", "utf8");
  const line = env.split(/\r?\n/).find((item) => item.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL nao encontrado em .env.local");
  return line.slice("DATABASE_URL=".length);
}

const text = fs.readFileSync(CSV_PATH, "utf8");
const [headers, ...rows] = parseCsv(text);
const headerIndex = Object.fromEntries(headers.map((header, index) => [header.trim(), index]));

const values = rows
  .filter((row) => row.length > 1)
  .flatMap((row) => {
    const email = row[headerIndex.Email].trim().toLowerCase();
    const criadoEm = formTimestampToIso(row[headerIndex["Carimbo de data/hora"]]);

    return MATCHES.map((match) =>
      [
        quote(email),
        quote(match.eventId),
        score(row[headerIndex[match.homeColumn]]),
        score(row[headerIndex[match.awayColumn]]),
        `${quote(criadoEm)}::timestamptz`,
      ].join(", "),
    );
  });

const sql = `
with input (email, sportsdb_event_id, gols1, gols2, criado_em) as (
  values
    (${values.join("),\n    (")})
), resolved as (
  select
    u.id as user_id,
    j.id as jogo_id,
    j.fase_id,
    j.time1,
    j.time2,
    input.gols1::integer as gols1,
    input.gols2::integer as gols2,
    input.criado_em::timestamptz as criado_em
  from input
  join public.usuarios u on lower(u.email::text) = input.email
  join public.jogos j on j.sportsdb_event_id = input.sportsdb_event_id
)
insert into public.palpites (
  user_id,
  jogo_id,
  fase_id,
  time1,
  time2,
  gols1,
  gols2,
  criado_em
)
select
  user_id,
  jogo_id,
  fase_id,
  time1,
  time2,
  gols1,
  gols2,
  criado_em
from resolved
on conflict (user_id, jogo_id) do update
set
  fase_id = excluded.fase_id,
  time1 = excluded.time1,
  time2 = excluded.time2,
  gols1 = excluded.gols1,
  gols2 = excluded.gols2,
  criado_em = excluded.criado_em;

select
  count(*) as palpites_importados,
  count(distinct user_id) as usuarios,
  count(distinct jogo_id) as jogos
from public.palpites
where jogo_id in (
  select id
  from public.jogos
  where sportsdb_event_id in (${MATCHES.map((match) => quote(match.eventId)).join(", ")})
);
`;

const result = spawnSync("psql", [loadDatabaseUrl(), "-v", "ON_ERROR_STOP=1"], {
  input: sql,
  stdio: ["pipe", "inherit", "inherit"],
  encoding: "utf8",
});

process.exit(result.status ?? 1);
