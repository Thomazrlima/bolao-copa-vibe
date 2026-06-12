export type GrupoRow = {
  grupo: string;
  time: string;
  pontuacao: number;
  saldo_gols: number;
  gols_pro: number;
  gols_contra: number;
};

export type JogoGrupo = {
  id: string;
  fase_id: number;
  time1: string;
  time2: string;
  data: string;
  gols1: number | null;
  gols2: number | null;
  encerrado: boolean;
  rodada?: number | null;
};

export type Standing = GrupoRow & {
  jogos: number;
};

export type TeamSlot = {
  grupo: string;
  time: string;
  posicao: 1 | 2 | 3;
  pontuacao: number;
  saldo_gols: number;
  gols_pro: number;
};

export type KnockoutMatch = {
  id: string;
  fase: "16-avos" | "Oitavas" | "Quartas" | "Semifinal" | "Disputa de 3º" | "Final";
  time1: TeamSlot | null;
  time2: TeamSlot | null;
  label1: string;
  label2: string;
};

export type KnockoutBracket = {
  terceirosClassificados: TeamSlot[];
  matrizKey: string | null;
  r32: KnockoutMatch[];
  r16: KnockoutMatch[];
  quartas: KnockoutMatch[];
  semifinais: KnockoutMatch[];
  terceiro: KnockoutMatch;
  final: KnockoutMatch;
};

const GROUP_ORDER = "ABCDEFGHIJKL".split("");
const THIRD_WINNER_SLOTS = ["A", "B", "D", "E", "G", "I", "K", "L"] as const;

const THIRD_PLACE_MATRIX_SOURCE = `
EFGHIJKL:EJIFHGLK
DFGHIJKL:HGIDJFLK
DEGHIJKL:EJIDHGLK
DEFHIJKL:EJIDHFLK
DEFGIJKL:EGIDJFLK
DEFGHJKL:EGJDHFLK
DEFGHIKL:EGIDHFLK
DEFGHIJL:EGJDHFLI
DEFGHIJK:EGJDHFIK
CFGHIJKL:HGICJFLK
CEGHIJKL:EJICHGLK
CEFHIJKL:EJICHFLK
CEFGIJKL:EGICJFLK
CEFGHJKL:EGJCHFLK
CEFGHIKL:EGICHFLK
CEFGHIJL:EGJCHFLI
CEFGHIJK:EGJCHFIK
CDGHIJKL:HGICJDLK
CDFHIJKL:CJIDHFLK
CDFGIJKL:CGIDJFLK
CDFGHJKL:CGJDHFLK
CDFGHIKL:CGIDHFLK
CDFGHIJL:CGJDHFLI
CDFGHIJK:CGJDHFIK
CDEHIJKL:EJICHDLK
CDEGIJKL:EGICJDLK
CDEGHJKL:EGJCHDLK
CDEGHIKL:EGICHDLK
CDEGHIJL:EGJCHDLI
CDEGHIJK:EGJCHDIK
CDEFIJKL:CJEDIFLK
CDEFHJKL:CJEDHFLK
CDEFHIKL:CEIDHFLK
CDEFHIJL:CJEDHFLI
CDEFHIJK:CJEDHFIK
CDEFGJKL:CGEDJFLK
CDEFGIKL:CGEDIFLK
CDEFGIJL:CGEDJFLI
CDEFGIJK:CGEDJFIK
CDEFGHKL:CGEDHFLK
CDEFGHJL:CGJDHFLE
CDEFGHJK:CGJDHFEK
CDEFGHIL:CGEDHFLI
CDEFGHIK:CGEDHFIK
CDEFGHIJ:CGJDHFEI
BFGHIJKL:HJBFIGLK
BEGHIJKL:EJIBHGLK
BEFHIJKL:EJBFIHLK
BEFGIJKL:EJBFIGLK
BEFGHJKL:EJBFHGLK
BEFGHIKL:EGBFIHLK
BEFGHIJL:EJBFHGLI
BEFGHIJK:EJBFHGIK
BDGHIJKL:HJBDIGLK
BDFHIJKL:HJBDIFLK
BDFGIJKL:IGBDJFLK
BDFGHJKL:HGBDJFLK
BDFGHIKL:HGBDIFLK
BDFGHIJL:HGBDJFLI
BDFGHIJK:HGBDJFIK
BDEHIJKL:EJBDIHLK
BDEGIJKL:EJBDIGLK
BDEGHJKL:EJBDHGLK
BDEGHIKL:EGBDIHLK
BDEGHIJL:EJBDHGLI
BDEGHIJK:EJBDHGIK
BDEFIJKL:EJBDIFLK
BDEFHJKL:EJBDHFLK
BDEFHIKL:EIBDHFLK
BDEFHIJL:EJBDHFLI
BDEFHIJK:EJBDHFIK
BDEFGJKL:EGBDJFLK
BDEFGIKL:EGBDIFLK
BDEFGIJL:EGBDJFLI
BDEFGIJK:EGBDJFIK
BDEFGHKL:EGBDHFLK
BDEFGHJL:HGBDJFLE
BDEFGHJK:HGBDJFEK
BDEFGHIL:EGBDHFLI
BDEFGHIK:EGBDHFIK
BDEFGHIJ:HGBDJFEI
BCGHIJKL:HJBCIGLK
BCFHIJKL:HJBCIFLK
BCFGIJKL:IGBCJFLK
BCFGHJKL:HGBCJFLK
BCFGHIKL:HGBCIFLK
BCFGHIJL:HGBCJFLI
BCFGHIJK:HGBCJFIK
BCEHIJKL:EJBCIHLK
BCEGIJKL:EJBCIGLK
BCEGHJKL:EJBCHGLK
BCEGHIKL:EGBCIHLK
BCEGHIJL:EJBCHGLI
BCEGHIJK:EJBCHGIK
BCEFIJKL:EJBCIFLK
BCEFHJKL:EJBCHFLK
BCEFHIKL:EIBCHFLK
BCEFHIJL:EJBCHFLI
BCEFHIJK:EJBCHFIK
BCEFGJKL:EGBCJFLK
BCEFGIKL:EGBCIFLK
BCEFGIJL:EGBCJFLI
BCEFGIJK:EGBCJFIK
BCEFGHKL:EGBCHFLK
BCEFGHJL:HGBCJFLE
BCEFGHJK:HGBCJFEK
BCEFGHIL:EGBCHFLI
BCEFGHIK:EGBCHFIK
BCEFGHIJ:HGBCJFEI
BCDHIJKL:HJBCIDLK
BCDGIJKL:IGBCJDLK
BCDGHJKL:HGBCJDLK
BCDGHIKL:HGBCIDLK
BCDGHIJL:HGBCJDLI
BCDGHIJK:HGBCJDIK
BCDFIJKL:CJBDIFLK
BCDFHJKL:CJBDHFLK
BCDFHIKL:CIBDHFLK
BCDFHIJL:CJBDHFLI
BCDFHIJK:CJBDHFIK
BCDFGJKL:CGBDJFLK
BCDFGIKL:CGBDIFLK
BCDFGIJL:CGBDJFLI
BCDFGIJK:CGBDJFIK
BCDFGHKL:CGBDHFLK
BCDFGHJL:CGBDHFLJ
BCDFGHJK:HGBCJFDK
BCDFGHIL:CGBDHFLI
BCDFGHIK:CGBDHFIK
BCDFGHIJ:HGBCJFDI
BCDEIJKL:EJBCIDLK
BCDEHJKL:EJBCHDLK
BCDEHIKL:EIBCHDLK
BCDEHIJL:EJBCHDLI
BCDEHIJK:EJBCHDIK
BCDEGJKL:EGBCJDLK
BCDEGIKL:EGBCIDLK
BCDEGIJL:EGBCJDLI
BCDEGIJK:EGBCJDIK
BCDEGHKL:EGBCHDLK
BCDEGHJL:HGBCJDLE
BCDEGHJK:HGBCJDEK
BCDEGHIL:EGBCHDLI
BCDEGHIK:EGBCHDIK
BCDEGHIJ:HGBCJDEI
BCDEFJKL:CJBDEFLK
BCDEFIKL:CEBDIFLK
BCDEFIJL:CJBDEFLI
BCDEFIJK:CJBDEFIK
BCDEFHKL:CEBDHFLK
BCDEFHJL:CJBDHFLE
BCDEFHJK:CJBDHFEK
BCDEFHIL:CEBDHFLI
BCDEFHIK:CEBDHFIK
BCDEFHIJ:CJBDHFEI
BCDEFGKL:CGBDEFLK
BCDEFGJL:CGBDJFLE
BCDEFGJK:CGBDJFEK
BCDEFGIL:CGBDEFLI
BCDEFGIK:CGBDEFIK
BCDEFGIJ:CGBDJFEI
BCDEFGHL:CGBDHFLE
BCDEFGHK:CGBDHFEK
BCDEFGHJ:HGBCJFDE
BCDEFGHI:CGBDHFEI
AFGHIJKL:HJIFAGLK
AEGHIJKL:EJIAHGLK
AEFHIJKL:EJIFAHLK
AEFGIJKL:EJIFAGLK
AEFGHJKL:EGJFAHLK
AEFGHIKL:EGIFAHLK
AEFGHIJL:EGJFAHLI
AEFGHIJK:EGJFAHIK
ADGHIJKL:HJIDAGLK
ADFHIJKL:HJIDAFLK
ADFGIJKL:IGJDAFLK
ADFGHJKL:HGJDAFLK
ADFGHIKL:HGIDAFLK
ADFGHIJL:HGJDAFLI
ADFGHIJK:HGJDAFIK
ADEHIJKL:EJIDAHLK
ADEGIJKL:EJIDAGLK
ADEGHJKL:EGJDAHLK
ADEGHIKL:EGIDAHLK
ADEGHIJL:EGJDAHLI
ADEGHIJK:EGJDAHIK
ADEFIJKL:EJIDAFLK
ADEFHJKL:HJEDAFLK
ADEFHIKL:HEIDAFLK
ADEFHIJL:HJEDAFLI
ADEFHIJK:HJEDAFIK
ADEFGJKL:EGJDAFLK
ADEFGIKL:EGIDAFLK
ADEFGIJL:EGJDAFLI
ADEFGIJK:EGJDAFIK
ADEFGHKL:HGEDAFLK
ADEFGHJL:HGJDAFLE
ADEFGHJK:HGJDAFEK
ADEFGHIL:HGEDAFLI
ADEFGHIK:HGEDAFIK
ADEFGHIJ:HGJDAFEI
ACGHIJKL:HJICAGLK
ACFHIJKL:HJICAFLK
ACFGIJKL:IGJCAFLK
ACFGHJKL:HGJCAFLK
ACFGHIKL:HGICAFLK
ACFGHIJL:HGJCAFLI
ACFGHIJK:HGJCAFIK
ACEHIJKL:EJICAHLK
ACEGIJKL:EJICAGLK
ACEGHJKL:EGJCAHLK
ACEGHIKL:EGICAHLK
ACEGHIJL:EGJCAHLI
ACEGHIJK:EGJCAHIK
ACEFIJKL:EJICAFLK
ACEFHJKL:HJECAFLK
ACEFHIKL:HEICAFLK
ACEFHIJL:HJECAFLI
ACEFHIJK:HJECAFIK
ACEFGJKL:EGJCAFLK
ACEFGIKL:EGICAFLK
ACEFGIJL:EGJCAFLI
ACEFGIJK:EGJCAFIK
ACEFGHKL:HGECAFLK
ACEFGHJL:HGJCAFLE
ACEFGHJK:HGJCAFEK
ACEFGHIL:HGECAFLI
ACEFGHIK:HGECAFIK
ACEFGHIJ:HGJCAFEI
ACDHIJKL:HJICADLK
ACDGIJKL:IGJCADLK
ACDGHJKL:HGJCADLK
ACDGHIKL:HGICADLK
ACDGHIJL:HGJCADLI
ACDGHIJK:HGJCADIK
ACDFIJKL:CJIDAFLK
ACDFHJKL:HJFCADLK
ACDFHIKL:HFICADLK
ACDFHIJL:HJFCADLI
ACDFHIJK:HJFCADIK
ACDFGJKL:CGJDAFLK
ACDFGIKL:CGIDAFLK
ACDFGIJL:CGJDAFLI
ACDFGIJK:CGJDAFIK
ACDFGHKL:HGFCADLK
ACDFGHJL:CGJDAFLH
ACDFGHJK:HGJCAFDK
ACDFGHIL:HGFCADLI
ACDFGHIK:HGFCADIK
ACDFGHIJ:HGJCAFDI
ACDEIJKL:EJICADLK
ACDEHJKL:HJECADLK
ACDEHIKL:HEICADLK
ACDEHIJL:HJECADLI
ACDEHIJK:HJECADIK
ACDEGJKL:EGJCADLK
ACDEGIKL:EGICADLK
ACDEGIJL:EGJCADLI
ACDEGIJK:EGJCADIK
ACDEGHKL:HGECADLK
ACDEGHJL:HGJCADLE
ACDEGHJK:HGJCADEK
ACDEGHIL:HGECADLI
ACDEGHIK:HGECADIK
ACDEGHIJ:HGJCADEI
ACDEFJKL:CJEDAFLK
ACDEFIKL:CEIDAFLK
ACDEFIJL:CJEDAFLI
ACDEFIJK:CJEDAFIK
ACDEFHKL:HEFCADLK
ACDEFHJL:HJFCADLE
ACDEFHJK:HJECAFDK
ACDEFHIL:HEFCADLI
ACDEFHIK:HEFCADIK
ACDEFHIJ:HJECAFDI
ACDEFGKL:CGEDAFLK
ACDEFGJL:CGJDAFLE
ACDEFGJK:CGJDAFEK
ACDEFGIL:CGEDAFLI
ACDEFGIK:CGEDAFIK
ACDEFGIJ:CGJDAFEI
ACDEFGHL:HGFCADLE
ACDEFGHK:HGECAFDK
ACDEFGHJ:HGJCAFDE
ACDEFGHI:HGECAFDI
ABGHIJKL:HJBAIGLK
ABFHIJKL:HJBAIFLK
ABFGIJKL:IJBFAGLK
ABFGHJKL:HJBFAGLK
ABFGHIKL:HGBAIFLK
ABFGHIJL:HJBFAGLI
ABFGHIJK:HJBFAGIK
ABEHIJKL:EJBAIHLK
ABEGIJKL:EJBAIGLK
ABEGHJKL:EJBAHGLK
ABEGHIKL:EGBAIHLK
ABEGHIJL:EJBAHGLI
ABEGHIJK:EJBAHGIK
ABEFIJKL:EJBAIFLK
ABEFHJKL:EJBFAHLK
ABEFHIKL:EIBFAHLK
ABEFHIJL:EJBFAHLI
ABEFHIJK:EJBFAHIK
ABEFGJKL:EJBFAGLK
ABEFGIKL:EGBAIFLK
ABEFGIJL:EJBFAGLI
ABEFGIJK:EJBFAGIK
ABEFGHKL:EGBFAHLK
ABEFGHJL:HJBFAGLE
ABEFGHJK:HJBFAGEK
ABEFGHIL:EGBFAHLI
ABEFGHIK:EGBFAHIK
ABEFGHIJ:HJBFAGEI
ABDHIJKL:IJBDAHLK
ABDGIJKL:IJBDAGLK
ABDGHJKL:HJBDAGLK
ABDGHIKL:IGBDAHLK
ABDGHIJL:HJBDAGLI
ABDGHIJK:HJBDAGIK
ABDFIJKL:IJBDAFLK
ABDFHJKL:HJBDAFLK
ABDFHIKL:HIBDAFLK
ABDFHIJL:HJBDAFLI
ABDFHIJK:HJBDAFIK
ABDFGJKL:FJBDAGLK
ABDFGIKL:IGBDAFLK
ABDFGIJL:FJBDAGLI
ABDFGIJK:FJBDAGIK
ABDFGHKL:HGBDAFLK
ABDFGHJL:HGBDAFLJ
ABDFGHJK:HGBDAFJK
ABDFGHIL:HGBDAFLI
ABDFGHIK:HGBDAFIK
ABDFGHIJ:HGBDAFIJ
ABDEIJKL:EJBAIDLK
ABDEHJKL:EJBDAHLK
ABDEHIKL:EIBDAHLK
ABDEHIJL:EJBDAHLI
ABDEHIJK:EJBDAHIK
ABDEGJKL:EJBDAGLK
ABDEGIKL:EGBAIDLK
ABDEGIJL:EJBDAGLI
ABDEGIJK:EJBDAGIK
ABDEGHKL:EGBDAHLK
ABDEGHJL:HJBDAGLE
ABDEGHJK:HJBDAGEK
ABDEGHIL:EGBDAHLI
ABDEGHIK:EGBDAHIK
ABDEGHIJ:HJBDAGEI
ABDEFJKL:EJBDAFLK
ABDEFIKL:EIBDAFLK
ABDEFIJL:EJBDAFLI
ABDEFIJK:EJBDAFIK
ABDEFHKL:HEBDAFLK
ABDEFHJL:HJBDAFLE
ABDEFHJK:HJBDAFEK
ABDEFHIL:HEBDAFLI
ABDEFHIK:HEBDAFIK
ABDEFHIJ:HJBDAFEI
ABDEFGKL:EGBDAFLK
ABDEFGJL:EGBDAFLJ
ABDEFGJK:EGBDAFJK
ABDEFGIL:EGBDAFLI
ABDEFGIK:EGBDAFIK
ABDEFGIJ:EGBDAFIJ
ABDEFGHL:HGBDAFLE
ABDEFGHK:HGBDAFEK
ABDEFGHJ:HGBDAFEJ
ABDEFGHI:HGBDAFEI
ABCHIJKL:IJBCAHLK
ABCGIJKL:IJBCAGLK
ABCGHJKL:HJBCAGLK
ABCGHIKL:IGBCAHLK
ABCGHIJL:HJBCAGLI
ABCGHIJK:HJBCAGIK
ABCFIJKL:IJBCAFLK
ABCFHJKL:HJBCAFLK
ABCFHIKL:HIBCAFLK
ABCFHIJL:HJBCAFLI
ABCFHIJK:HJBCAFIK
ABCFGJKL:CJBFAGLK
ABCFGIKL:IGBCAFLK
ABCFGIJL:CJBFAGLI
ABCFGIJK:CJBFAGIK
ABCFGHKL:HGBCAFLK
ABCFGHJL:HGBCAFLJ
ABCFGHJK:HGBCAFJK
ABCFGHIL:HGBCAFLI
ABCFGHIK:HGBCAFIK
ABCFGHIJ:HGBCAFIJ
ABCEIJKL:EJBAICLK
ABCEHJKL:EJBCAHLK
ABCEHIKL:EIBCAHLK
ABCEHIJL:EJBCAHLI
ABCEHIJK:EJBCAHIK
ABCEGJKL:EJBCAGLK
ABCEGIKL:EGBAICLK
ABCEGIJL:EJBCAGLI
ABCEGIJK:EJBCAGIK
ABCEGHKL:EGBCAHLK
ABCEGHJL:HJBCAGLE
ABCEGHJK:HJBCAGEK
ABCEGHIL:EGBCAHLI
ABCEGHIK:EGBCAHIK
ABCEGHIJ:HJBCAGEI
ABCEFJKL:EJBCAFLK
ABCEFIKL:EIBCAFLK
ABCEFIJL:EJBCAFLI
ABCEFIJK:EJBCAFIK
ABCEFHKL:HEBCAFLK
ABCEFHJL:HJBCAFLE
ABCEFHJK:HJBCAFEK
ABCEFHIL:HEBCAFLI
ABCEFHIK:HEBCAFIK
ABCEFHIJ:HJBCAFEI
ABCEFGKL:EGBCAFLK
ABCEFGJL:EGBCAFLJ
ABCEFGJK:EGBCAFJK
ABCEFGIL:EGBCAFLI
ABCEFGIK:EGBCAFIK
ABCEFGIJ:EGBCAFIJ
ABCEFGHL:HGBCAFLE
ABCEFGHK:HGBCAFEK
ABCEFGHJ:HGBCAFEJ
ABCEFGHI:HGBCAFEI
ABCDIJKL:IJBCADLK
ABCDHJKL:HJBCADLK
ABCDHIKL:HIBCADLK
ABCDHIJL:HJBCADLI
ABCDHIJK:HJBCADIK
ABCDGJKL:CJBDAGLK
ABCDGIKL:IGBCADLK
ABCDGIJL:CJBDAGLI
ABCDGIJK:CJBDAGIK
ABCDGHKL:HGBCADLK
ABCDGHJL:HGBCADLJ
ABCDGHJK:HGBCADJK
ABCDGHIL:HGBCADLI
ABCDGHIK:HGBCADIK
ABCDGHIJ:HGBCADIJ
ABCDFJKL:CJBDAFLK
ABCDFIKL:CIBDAFLK
ABCDFIJL:CJBDAFLI
ABCDFIJK:CJBDAFIK
ABCDFHKL:HFBCADLK
ABCDFHJL:CJBDAFLH
ABCDFHJK:HJBCAFDK
ABCDFHIL:HFBCADLI
ABCDFHIK:HFBCADIK
ABCDFHIJ:HJBCAFDI
ABCDFGKL:CGBDAFLK
ABCDFGJL:CGBDAFLJ
ABCDFGJK:CGBDAFJK
ABCDFGIL:CGBDAFLI
ABCDFGIK:CGBDAFIK
ABCDFGIJ:CGBDAFIJ
ABCDFGHL:CGBDAFLH
ABCDFGHK:HGBCAFDK
ABCDFGHJ:HGBCAFDJ
ABCDFGHI:HGBCAFDI
ABCDEJKL:EJBCADLK
ABCDEIKL:EIBCADLK
ABCDEIJL:EJBCADLI
ABCDEIJK:EJBCADIK
ABCDEHKL:HEBCADLK
ABCDEHJL:HJBCADLE
ABCDEHJK:HJBCADEK
ABCDEHIL:HEBCADLI
ABCDEHIK:HEBCADIK
ABCDEHIJ:HJBCADEI
ABCDEGKL:EGBCADLK
ABCDEGJL:EGBCADLJ
ABCDEGJK:EGBCADJK
ABCDEGIL:EGBCADLI
ABCDEGIK:EGBCADIK
ABCDEGIJ:EGBCADIJ
ABCDEGHL:HGBCADLE
ABCDEGHK:HGBCADEK
ABCDEGHJ:HGBCADEJ
ABCDEGHI:HGBCADEI
ABCDEFKL:CEBDAFLK
ABCDEFJL:CJBDAFLE
ABCDEFJK:CJBDAFEK
ABCDEFIL:CEBDAFLI
ABCDEFIK:CEBDAFIK
ABCDEFIJ:CJBDAFEI
ABCDEFHL:HFBCADLE
ABCDEFHK:HEBCAFDK
ABCDEFHJ:HJBCAFDE
ABCDEFHI:HEBCAFDI
ABCDEFGL:CGBDAFLE
ABCDEFGK:CGBDAFEK
ABCDEFGJ:CGBDAFEJ
ABCDEFGI:CGBDAFEI
ABCDEFGH:HGBCAFDE
`;

export const THIRD_PLACE_MATRIX = new Map(
  THIRD_PLACE_MATRIX_SOURCE.trim()
    .split("\n")
    .map((line) => {
      const [key, value] = line.split(":");
      return [key, value.split("")];
    }),
);

export function computeLiveStandings(grupos: GrupoRow[], jogos: JogoGrupo[]): Standing[] {
  const map = new Map<string, Standing>();

  grupos.forEach((row) => {
    map.set(row.time, {
      ...row,
      pontuacao: 0,
      saldo_gols: 0,
      gols_pro: 0,
      gols_contra: 0,
      jogos: 0,
    });
  });

  jogos.forEach((jogo) => {
    if (jogo.gols1 == null || jogo.gols2 == null) return;

    const home = map.get(jogo.time1);
    const away = map.get(jogo.time2);
    if (!home || !away || home.grupo !== away.grupo) return;

    home.jogos += 1;
    away.jogos += 1;
    home.gols_pro += jogo.gols1;
    home.gols_contra += jogo.gols2;
    away.gols_pro += jogo.gols2;
    away.gols_contra += jogo.gols1;

    if (jogo.gols1 > jogo.gols2) {
      home.pontuacao += 3;
    } else if (jogo.gols1 < jogo.gols2) {
      away.pontuacao += 3;
    } else {
      home.pontuacao += 1;
      away.pontuacao += 1;
    }
  });

  map.forEach((row) => {
    row.saldo_gols = row.gols_pro - row.gols_contra;
  });

  return [...map.values()];
}

export function sortStandings(a: Standing, b: Standing, jogos: JogoGrupo[]) {
  if (b.pontuacao !== a.pontuacao) return b.pontuacao - a.pontuacao;

  const direct = compareDirect(a, b, jogos);
  if (direct !== 0) return direct;

  if (b.saldo_gols !== a.saldo_gols) return b.saldo_gols - a.saldo_gols;
  if (b.gols_pro !== a.gols_pro) return b.gols_pro - a.gols_pro;
  return a.time.localeCompare(b.time);
}

export function groupStandings(grupos: GrupoRow[], jogos: JogoGrupo[]) {
  const liveRows = computeLiveStandings(grupos, jogos);
  const grouped = new Map<string, Standing[]>();

  liveRows.forEach((row) => {
    if (!grouped.has(row.grupo)) grouped.set(row.grupo, []);
    grouped.get(row.grupo)!.push(row);
  });

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, standings]) => ({
      group,
      standings: standings.sort((a, b) => sortStandings(a, b, jogos)),
    }));
}

export function buildKnockoutBracket(grupos: GrupoRow[], jogos: JogoGrupo[]): KnockoutBracket {
  const groups = groupStandings(grupos, jogos);
  const standingsByGroup = new Map(groups.map((group) => [group.group, group.standings]));
  const thirds = groups
    .map(({ standings }) => standings[2])
    .filter(Boolean)
    .sort((a, b) => sortStandings(a, b, jogos))
    .slice(0, 8)
    .map((standing) => toTeamSlot(standing, 3));
  const matrizKey = thirds
    .map((third) => third.grupo)
    .sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b))
    .join("");
  const matrixRow = THIRD_PLACE_MATRIX.get(matrizKey) ?? [];
  const thirdByGroup = new Map(thirds.map((third) => [third.grupo, third]));
  const thirdOpponentByWinner = new Map(
    THIRD_WINNER_SLOTS.map((group, index) => [group, thirdByGroup.get(matrixRow[index]) ?? null]),
  );

  const at = (group: string, position: 1 | 2 | 3) => {
    const standing = standingsByGroup.get(group)?.[position - 1];
    return standing ? toTeamSlot(standing, position) : null;
  };

  const r32: KnockoutMatch[] = [
    match("M73", "16-avos", at("A", 2), at("B", 2), "2º Grupo A", "2º Grupo B"),
    match(
      "M74",
      "16-avos",
      at("E", 1),
      thirdOpponentByWinner.get("E") ?? null,
      "1º Grupo E",
      "Melhor 3º",
    ),
    match("M75", "16-avos", at("F", 1), at("C", 2), "1º Grupo F", "2º Grupo C"),
    match("M76", "16-avos", at("C", 1), at("F", 2), "1º Grupo C", "2º Grupo F"),
    match(
      "M77",
      "16-avos",
      at("I", 1),
      thirdOpponentByWinner.get("I") ?? null,
      "1º Grupo I",
      "Melhor 3º",
    ),
    match("M78", "16-avos", at("E", 2), at("I", 2), "2º Grupo E", "2º Grupo I"),
    match(
      "M79",
      "16-avos",
      at("A", 1),
      thirdOpponentByWinner.get("A") ?? null,
      "1º Grupo A",
      "Melhor 3º",
    ),
    match(
      "M80",
      "16-avos",
      at("L", 1),
      thirdOpponentByWinner.get("L") ?? null,
      "1º Grupo L",
      "Melhor 3º",
    ),
    match(
      "M81",
      "16-avos",
      at("D", 1),
      thirdOpponentByWinner.get("D") ?? null,
      "1º Grupo D",
      "Melhor 3º",
    ),
    match(
      "M82",
      "16-avos",
      at("G", 1),
      thirdOpponentByWinner.get("G") ?? null,
      "1º Grupo G",
      "Melhor 3º",
    ),
    match("M83", "16-avos", at("K", 2), at("L", 2), "2º Grupo K", "2º Grupo L"),
    match("M84", "16-avos", at("H", 1), at("J", 2), "1º Grupo H", "2º Grupo J"),
    match(
      "M85",
      "16-avos",
      at("B", 1),
      thirdOpponentByWinner.get("B") ?? null,
      "1º Grupo B",
      "Melhor 3º",
    ),
    match("M86", "16-avos", at("J", 1), at("H", 2), "1º Grupo J", "2º Grupo H"),
    match(
      "M87",
      "16-avos",
      at("K", 1),
      thirdOpponentByWinner.get("K") ?? null,
      "1º Grupo K",
      "Melhor 3º",
    ),
    match("M88", "16-avos", at("D", 2), at("G", 2), "2º Grupo D", "2º Grupo G"),
  ];

  const r16 = [
    match("M89", "Oitavas", null, null, "Vencedor M73", "Vencedor M75"),
    match("M90", "Oitavas", null, null, "Vencedor M74", "Vencedor M77"),
    match("M91", "Oitavas", null, null, "Vencedor M76", "Vencedor M78"),
    match("M92", "Oitavas", null, null, "Vencedor M79", "Vencedor M80"),
    match("M93", "Oitavas", null, null, "Vencedor M83", "Vencedor M84"),
    match("M94", "Oitavas", null, null, "Vencedor M81", "Vencedor M82"),
    match("M95", "Oitavas", null, null, "Vencedor M86", "Vencedor M88"),
    match("M96", "Oitavas", null, null, "Vencedor M85", "Vencedor M87"),
  ];

  return {
    terceirosClassificados: thirds,
    matrizKey: matrizKey.length === 8 ? matrizKey : null,
    r32,
    r16,
    quartas: [
      match("M97", "Quartas", null, null, "Vencedor M89", "Vencedor M90"),
      match("M98", "Quartas", null, null, "Vencedor M93", "Vencedor M94"),
      match("M99", "Quartas", null, null, "Vencedor M91", "Vencedor M92"),
      match("M100", "Quartas", null, null, "Vencedor M95", "Vencedor M96"),
    ],
    semifinais: [
      match("M101", "Semifinal", null, null, "Vencedor M97", "Vencedor M98"),
      match("M102", "Semifinal", null, null, "Vencedor M99", "Vencedor M100"),
    ],
    terceiro: match("M103", "Disputa de 3º", null, null, "Perdedor M101", "Perdedor M102"),
    final: match("M104", "Final", null, null, "Vencedor M101", "Vencedor M102"),
  };
}

function compareDirect(a: Standing, b: Standing, jogos: JogoGrupo[]) {
  const directGame = jogos.find(
    (jogo) =>
      jogo.gols1 != null &&
      jogo.gols2 != null &&
      ((jogo.time1 === a.time && jogo.time2 === b.time) ||
        (jogo.time1 === b.time && jogo.time2 === a.time)),
  );

  if (!directGame || directGame.gols1 == null || directGame.gols2 == null) return 0;

  const aGoals = directGame.time1 === a.time ? directGame.gols1 : directGame.gols2;
  const bGoals = directGame.time1 === b.time ? directGame.gols1 : directGame.gols2;

  if (aGoals > bGoals) return -1;
  if (aGoals < bGoals) return 1;
  return 0;
}

function toTeamSlot(standing: Standing, posicao: 1 | 2 | 3): TeamSlot {
  return {
    grupo: standing.grupo,
    time: standing.time,
    posicao,
    pontuacao: standing.pontuacao,
    saldo_gols: standing.saldo_gols,
    gols_pro: standing.gols_pro,
  };
}

function match(
  id: string,
  fase: KnockoutMatch["fase"],
  time1: TeamSlot | null,
  time2: TeamSlot | null,
  label1: string,
  label2: string,
): KnockoutMatch {
  return { id, fase, time1, time2, label1, label2 };
}
