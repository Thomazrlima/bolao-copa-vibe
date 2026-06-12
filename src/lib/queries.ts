import type { GuessOutcome } from "@/lib/scoring";

export type Usuario = {
  id: string;
  email: string;
  nome_completo: string;
  telefone: string;
  avatar_url: string | null;
  pontos: number;
  chineladas: number;
  created_at: string;
  updated_at: string;
};

export type RankingUsuario = {
  id: string;
  nome_completo: string;
  pontos: number;
  chineladas: number;
};

export type PerfilPalpite = {
  jogo_id: string;
  fase: string;
  time1: string;
  time2: string;
  data: string;
  palpite: { gols1: number; gols2: number };
  encerrado: boolean;
  resultado: { gols1: number; gols2: number } | null;
  pontos: number | null;
  outcome: GuessOutcome | null;
};

export type PerfilUsuario = RankingUsuario & {
  avatar_url: string | null;
  is_current_user: boolean;
  estatisticas: Record<GuessOutcome, number>;
  palpites: PerfilPalpite[];
};

export type JogoPalpite = {
  user_id: string;
  nome_completo: string;
  avatar_url: string | null;
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
  return requestJson<PalpitesDashboardResponse>("/api/palpites");
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
