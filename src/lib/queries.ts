import type { GuessOutcome } from "@/lib/scoring";
import type { RankingBadgeKey } from "@/lib/ranking-badges";
import {
  MOCK_PALPITE_ID_PREFIX,
  MOCK_PENDING_GUESSES_ENABLED,
  nowAsStoredBrasiliaMs,
} from "@/lib/palpite-deadlines";

export type AvatarPath = string;

export type Usuario = {
  id: string;
  email: string;
  nome_completo: string;
  telefone: string;
  avatar_url: AvatarPath | null;
  pontos: number;
  chineladas: number;
  created_at: string;
  updated_at: string;
};

export type RankingUsuario = {
  id: string;
  nome_completo: string;
  avatar_url: AvatarPath | null;
  pontos: number;
  pontos_oficiais: number;
  chineladas: number;
  chineladas_oficiais: number;
  posicao: number;
  posicao_base: number;
  variacao: number;
  movimento: "partial" | "final" | null;
};

export type PerfilPalpite = {
  jogo_id: string;
  fase: string;
  time1: string;
  time2: string;
  data: string;
  palpite: { gols1: number; gols2: number };
  encerrado: boolean;
  iniciado: boolean;
  ao_vivo: boolean;
  resultado: { gols1: number; gols2: number } | null;
  pontos: number | null;
  outcome: GuessOutcome | null;
};

export type PerfilUsuario = RankingUsuario & {
  avatar_url: AvatarPath | null;
  is_current_user: boolean;
  badges: RankingBadgeKey[];
  estatisticas: Record<GuessOutcome, number>;
  especiais: {
    acertos: number;
    pontos: number;
  };
  palpites: PerfilPalpite[];
};

export type JogoPalpite = {
  user_id: string;
  nome_completo: string;
  avatar_url: AvatarPath | null;
  palpite: { gols1: number; gols2: number };
  pontos: number | null;
  outcome: GuessOutcome | null;
  chinelada: boolean;
  criado_em: string;
};

export type JogoPalpitesResponse = {
  jogo: {
    id: string;
    fase_id: number;
    time1: string;
    time2: string;
    data: string;
    gols1: number | null;
    gols2: number | null;
    encerrado: boolean;
    placar_status: "upcoming" | "live" | "finished" | null;
    transmissao_url: string | null;
  };
  palpites: JogoPalpite[];
};

export type PalpitesDashboardResponse = {
  jogos: Array<{
    id: string;
    fase_id: number;
    fase: string;
    grupo: string | null;
    rodada: number | null;
    time1: string;
    time2: string;
    data: string;
    gols1: number | null;
    gols2: number | null;
    encerrado: boolean;
    iniciado: boolean;
    ao_vivo: boolean;
    placar_status: "upcoming" | "live" | "finished" | null;
    sportsdb_status: string | null;
    palpite: { gols1: number; gols2: number } | null;
    pontos: number | null;
    outcome: GuessOutcome | null;
  }>;
  resumo: {
    feitos: number;
    pendentes: number;
    pontos: number;
    posicao: number | null;
  };
  geral: {
    participantes: number;
    palpites: number;
    chineladas: number;
    media_pontos: number;
    outcomes: Array<{ outcome: GuessOutcome; count: number }>;
    rodadas: Array<{ round: string; geral: number; voce: number }>;
    jogo_popular: { id: string; time1: string; time2: string } | null;
    palpites_populares: Array<{ score: string; count: number; percent: number }>;
  };
  pessoal: {
    nome: string;
    posicao: number | null;
    pontos: number;
    chineladas: number;
    encerrados: number;
    acertos: number;
    outcomes: Array<{ outcome: GuessOutcome; count: number }>;
    evolucao: Array<{ game: string; points: number }>;
  };
};

export type EspecialResposta = {
  pergunta_id: string;
  resposta: string;
  atualizado_em: string;
};

type ApiErrorBody = {
  error?: string;
};

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;

  if (!response.ok) {
    throw new Error(body.error ?? "Não foi possível carregar os dados.");
  }

  return body as T;
}

export async function getCurrentUsuario() {
  const response = await fetch("/api/usuarios/me", { cache: "no-store" });

  if (response.status === 401) return null;

  const body = (await response.json().catch(() => ({}))) as { usuario?: Usuario; error?: string };

  if (!response.ok) {
    throw new Error(body.error ?? "Não foi possível carregar seu perfil.");
  }

  return body.usuario ?? null;
}

export async function updateCurrentUsuario(payload: {
  nome_completo?: string;
  telefone?: string;
  avatar_url?: string | null;
}) {
  const body = await requestJson<{ usuario: Usuario }>("/api/usuarios/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return body.usuario;
}

export async function updateCurrentUserPassword(payload: {
  current_password: string;
  new_password: string;
}) {
  await requestJson<{ ok: boolean }>("/api/usuarios/me/senha", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function createUsuario(payload: {
  email: string;
  nome_completo: string;
  telefone: string;
}) {
  return requestJson<{
    usuario: Pick<Usuario, "id" | "email" | "nome_completo" | "telefone" | "pontos" | "chineladas">;
    temporary_password: string;
    email_confirmation_required: boolean;
  }>("/api/usuarios", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getRanking() {
  const body = await requestJson<{ ranking: RankingUsuario[] }>("/api/ranking");
  return body.ranking;
}

export async function getPerfil(id: string) {
  const body = await requestJson<{ perfil: PerfilUsuario }>(
    `/api/perfis/${encodeURIComponent(id)}`,
  );

  return body.perfil;
}

export async function getPalpitesDoJogo(jogoId: string) {
  return requestJson<JogoPalpitesResponse>(`/api/jogos/${encodeURIComponent(jogoId)}/palpites`);
}

export async function getPalpitesDashboard() {
  const dashboard = await requestJson<PalpitesDashboardResponse>("/api/palpites");
  return MOCK_PENDING_GUESSES_ENABLED ? withMockPendingGuesses(dashboard) : dashboard;
}

export async function savePalpite(jogoId: string, palpite: { gols1: number; gols2: number }) {
  return requestJson<{ palpite: { jogo_id: string; gols1: number; gols2: number } }>(
    `/api/jogos/${encodeURIComponent(jogoId)}/palpites`,
    { method: "PUT", body: JSON.stringify(palpite) },
  );
}

export async function getPalpitesEspeciais() {
  const body = await requestJson<{ respostas: EspecialResposta[] }>("/api/palpites/especiais");
  return body.respostas;
}

export async function savePalpiteEspecial(perguntaId: string, resposta: string) {
  const body = await requestJson<{ resposta: EspecialResposta }>("/api/palpites/especiais", {
    method: "PUT",
    body: JSON.stringify({ pergunta_id: perguntaId, resposta }),
  });
  return body.resposta;
}

function withMockPendingGuesses(dashboard: PalpitesDashboardResponse): PalpitesDashboardResponse {
  const now = nowAsStoredBrasiliaMs();
  const mockGames: PalpitesDashboardResponse["jogos"] = [
    buildMockGame("24h", "Brasil", "Marrocos", now + 23 * 60 * 60_000),
    buildMockGame("6h", "Argentina", "Japão", now + 5 * 60 * 60_000),
    buildMockGame("1h", "França", "Senegal", now + 45 * 60_000),
    buildMockGame("10min", "Portugal", "México", now + 8 * 60_000),
  ];

  return {
    ...dashboard,
    jogos: [...mockGames, ...dashboard.jogos],
    resumo: {
      ...dashboard.resumo,
      pendentes: dashboard.resumo.pendentes + mockGames.length,
    },
  };
}

function buildMockGame(
  id: string,
  time1: string,
  time2: string,
  timestamp: number,
): PalpitesDashboardResponse["jogos"][number] {
  return {
    id: `${MOCK_PALPITE_ID_PREFIX}${id}`,
    fase_id: 1,
    fase: "Demonstração",
    grupo: "Mock",
    rodada: null,
    time1,
    time2,
    data: new Date(timestamp).toISOString(),
    gols1: null,
    gols2: null,
    encerrado: false,
    iniciado: false,
    ao_vivo: false,
    placar_status: "upcoming",
    sportsdb_status: null,
    palpite: null,
    pontos: null,
    outcome: null,
  };
}
