import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

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
    assert.deepEqual(sourcePair("M89"), ["M73", "M75"]);
    assert.deepEqual(sourcePair("M90"), ["M74", "M77"]);
    assert.deepEqual(sourcePair("M91"), ["M76", "M78"]);
    assert.deepEqual(sourcePair("M92"), ["M79", "M80"]);
    assert.deepEqual(sourcePair("M93"), ["M83", "M84"]);
    assert.deepEqual(sourcePair("M94"), ["M81", "M82"]);
    assert.deepEqual(sourcePair("M95"), ["M86", "M88"]);
    assert.deepEqual(sourcePair("M96"), ["M85", "M87"]);
    assert.deepEqual(sourcePair("M97"), ["M89", "M90"]);
    assert.deepEqual(sourcePair("M98"), ["M93", "M94"]);
    assert.deepEqual(sourcePair("M99"), ["M91", "M92"]);
    assert.deepEqual(sourcePair("M100"), ["M95", "M96"]);
    assert.deepEqual(sourcePair("M101"), ["M97", "M98"]);
    assert.deepEqual(sourcePair("M102"), ["M99", "M100"]);
    assert.deepEqual(sourcePair("M104"), ["M101", "M102"]);
  });

  test("keeps visual order separate from source dependency", () => {
    assert.deepEqual(getKnockoutCodesByPhase(3), [
      "M89",
      "M90",
      "M93",
      "M94",
      "M91",
      "M92",
      "M95",
      "M96",
    ]);
    assert.deepEqual(sourcePair("M98"), ["M93", "M94"]);
    assert.deepEqual(sourcePair("M99"), ["M91", "M92"]);
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
    const pairs = new Map(
      shuffledQuarterCodes.map((code) => [code, derivedPair(code, winnersByCode)]),
    );

    assert.deepEqual(pairs.get("M97"), ["Canada", "France"]);
    assert.deepEqual(pairs.get("M98"), ["Spain", "Belgium"]);
    assert.deepEqual(pairs.get("M99"), ["Norway", "England"]);
    assert.deepEqual(pairs.get("M100"), ["Argentina", "Switzerland"]);
    assert.notDeepEqual(pairs.get("M97"), ["Canada", "Germany"]);
  });

  test("keeps opposite sides apart until the final", () => {
    assert.deepEqual(commonDescendants("M97", "M99"), ["M104"]);
    assert.deepEqual(commonDescendants("M98", "M100"), ["M104"]);
  });

  test("has one unique path per match code and phase slot", () => {
    const codes = KNOCKOUT_PATHS.map((path) => path.code);
    const phaseSlots = KNOCKOUT_PATHS.map((path) => `${path.phaseId}:${path.slot}`);

    assert.equal(new Set(codes).size, codes.length);
    assert.equal(new Set(phaseSlots).size, phaseSlots.length);
  });

  test("chaveamento save path does not delete existing guesses", () => {
    const serviceSource = readFileSync("src/lib/server/chaveamento-service.ts", "utf8");

    assert.match(serviceSource, /\.upsert\(/);
    assert.doesNotMatch(serviceSource, /\.delete\(\)/);
  });
});
