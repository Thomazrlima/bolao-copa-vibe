export type EspecialQuestion = {
  id: string;
  question: string;
  options: readonly string[];
};

export const ESPECIAIS_DEADLINE_ISO = "2026-06-13T19:00:00.000Z";
export const CAMPEAO_BOLAO_QUESTION_ID = "campeao-bolao";
export const MULTI_CORRECT_ESPECIAL_QUESTION_IDS = [
  "artilheiro-copa",
  "selecao-surpresa",
] as const;

export function especiaisAreOpen(now = Date.now()) {
  return now < new Date(ESPECIAIS_DEADLINE_ISO).getTime();
}

export const ESPECIAIS: readonly EspecialQuestion[] = [
  {
    id: CAMPEAO_BOLAO_QUESTION_ID,
    question: "Quem será o grande campeão do bolão?",
    options: [],
  },
  {
    id: "primeiro-gol-brasil",
    question: "Quem faz o primeiro gol do Brasil?",
    options: ["Raphinha", "Vini Jr.", "Paquetá", "Cunha", "Casemiro", "Guimarães", "Outro"],
  },
  {
    id: "ultimo-gol-brasil",
    question: "Quem faz o último gol do Brasil?",
    options: [
      "Raphinha",
      "Vini Jr.",
      "Paquetá",
      "Cunha",
      "Casemiro",
      "Guimarães",
      "Rayan",
      "Endrick",
      "Luiz Henrique",
      "Neymar",
      "Outro",
    ],
  },
  {
    id: "cr7-ou-messi",
    question: "Quem faz mais gols na Copa?",
    options: ["CR7", "Messi", "Empatam"],
  },
  {
    id: "minutos-neymar",
    question: "Quantos minutos Neymar fica em campo?",
    options: ["25", "50", "75", "100", "150", "200", "+250"],
  },
  {
    id: "artilheiro-copa",
    question: "Quem será o artilheiro da Copa?",
    options: [
      "Mbappé",
      "Dembélé",
      "Messi",
      "Julián Álvarez",
      "CR7",
      "Haaland",
      "Yamal",
      "Kane",
      "Outro",
    ],
  },
  {
    id: "revelacao-copa",
    question: "Quem será a revelação da Copa?",
    options: [
      "Arda Guller",
      "Yamal",
      "Olisie",
      "Endrick",
      "Rayan",
      "Nico Paz",
      "Doue",
      "Cherki",
      "João Neves",
      "N/A",
    ],
  },
  {
    id: "campeao",
    question: "Quem será o campeão?",
    options: [
      "Brasil",
      "Argentina",
      "Portugal",
      "Itália",
      "Espanha",
      "Alemanha",
      "França",
      "Inglaterra",
      "Outro",
    ],
  },
  {
    id: "fase-brasil",
    question: "Até que fase o Brasil vai?",
    options: ["Grupos", "16-avos", "Oitavas", "Quartas", "Semifinal", "Final"],
  },
  {
    id: "selecao-surpresa",
    question: "Qual desses países vai mais longe na Copa?",
    options: ["Noruega", "Marrocos", "Bélgica", "Uruguai", "Colômbia"],
  },
  {
    id: "eliminada-primeiro",
    question: "Qual dessas seleções será eliminada primeiro?",
    options: ["Argentina", "Brasil", "França", "Espanha", "Inglaterra", "Alemanha", "Portugal"],
  },
] as const;

export function getEspecialQuestion(id: string) {
  return ESPECIAIS.find((question) => question.id === id);
}

export function allowsMultipleCorrectAnswers(id: string) {
  return MULTI_CORRECT_ESPECIAL_QUESTION_IDS.includes(
    id as (typeof MULTI_CORRECT_ESPECIAL_QUESTION_IDS)[number],
  );
}
