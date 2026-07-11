import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  KNOCKOUT_PATHS,
  getKnockoutCodesByPhase,
  getKnockoutDescendantCodes,
  getKnockoutPath,
} from "./knockout-paths";

function sourcePair(code: string) {
  const path = getKnockoutPath(code);
  return [path?.source1?.code, path?.source2?.code];
}

function commonDescendants(firstCode: string, secondCode: string) {
  const secondDescendants = new Set(getKnockoutDescendantCodes(secondCode));
  return getKnockoutDescendantCodes(firstCode).filter((code) => secondDescendants.has(code));
}

function derivedPair(code: string, winnersByCode: Record<string, string>) {
  const path = getKnockoutPath(code);
  return [
    path?.source1 ? winnersByCode[path.source1.code] : undefined,
    path?.source2 ? winnersByCode[path.source2.code] : undefined,
  ];
}

describe("knockout paths", () => {
  test("defines every future match from explicit source matches", () => {
    expect(sourcePair("M89")).toEqual(["M73", "M75"]);
    expect(sourcePair("M90")).toEqual(["M74", "M77"]);
    expect(sourcePair("M91")).toEqual(["M76", "M78"]);
    expect(sourcePair("M92")).toEqual(["M79", "M80"]);
    expect(sourcePair("M93")).toEqual(["M83", "M84"]);
    expect(sourcePair("M94")).toEqual(["M81", "M82"]);
    expect(sourcePair("M95")).toEqual(["M86", "M88"]);
    expect(sourcePair("M96")).toEqual(["M85", "M87"]);
    expect(sourcePair("M97")).toEqual(["M89", "M90"]);
    expect(sourcePair("M98")).toEqual(["M93", "M94"]);
    expect(sourcePair("M99")).toEqual(["M91", "M92"]);
    expect(sourcePair("M100")).toEqual(["M95", "M96"]);
    expect(sourcePair("M101")).toEqual(["M97", "M98"]);
    expect(sourcePair("M102")).toEqual(["M99", "M100"]);
    expect(sourcePair("M104")).toEqual(["M101", "M102"]);
  });

  test("keeps visual order separate from source dependency", () => {
    expect(getKnockoutCodesByPhase(3)).toEqual([
      "M89",
      "M90",
      "M93",
      "M94",
      "M91",
      "M92",
      "M95",
      "M96",
    ]);
    expect(sourcePair("M98")).toEqual(["M93", "M94"]);
    expect(sourcePair("M99")).toEqual(["M91", "M92"]);
  });

  test("does not depend on returned array order to derive participants", () => {
    const winnersByCode = {
      M89: "Canada",
      M90: "France",
      M91: "Norway",
      M92: "England",
      M93: "Spain",
      M94: "Belgium",
      M95: "Argentina",
      M96: "Switzerland",
    };
    const shuffledQuarterCodes = [...getKnockoutCodesByPhase(4)].reverse();
    const pairs = new Map(shuffledQuarterCodes.map((code) => [code, derivedPair(code, winnersByCode)]));

    expect(pairs.get("M97")).toEqual(["Canada", "France"]);
    expect(pairs.get("M98")).toEqual(["Spain", "Belgium"]);
    expect(pairs.get("M99")).toEqual(["Norway", "England"]);
    expect(pairs.get("M100")).toEqual(["Argentina", "Switzerland"]);
    expect(pairs.get("M97")).not.toEqual(["Canada", "Germany"]);
  });

  test("keeps opposite sides apart until the final", () => {
    expect(commonDescendants("M97", "M99")).toEqual(["M104"]);
    expect(commonDescendants("M98", "M100")).toEqual(["M104"]);
  });

  test("has one unique path per match code and phase slot", () => {
    const codes = KNOCKOUT_PATHS.map((path) => path.code);
    const phaseSlots = KNOCKOUT_PATHS.map((path) => `${path.phaseId}:${path.slot}`);

    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(phaseSlots).size).toBe(phaseSlots.length);
  });

  test("chaveamento save path does not delete existing guesses", () => {
    const serviceSource = readFileSync("src/lib/server/chaveamento-service.ts", "utf8");

    expect(serviceSource).toContain(".upsert(");
    expect(serviceSource).not.toContain(".delete()");
  });
});
