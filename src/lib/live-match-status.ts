export function liveMatchStatusLabel(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) return "Ao vivo";

  if (
    /^(1h|first half|1st half|first|1st|primeiro tempo|1º tempo|1o tempo|primeira etapa)$/.test(
      normalized,
    )
  ) {
    return "1º tempo";
  }

  if (
    /^(ht|half time|halftime|interval|intervalo|meio tempo)$/.test(normalized) ||
    normalized.includes("half time")
  ) {
    return "Intervalo";
  }

  if (
    /^(2h|second half|2nd half|second|2nd|segundo tempo|2º tempo|2o tempo|segunda etapa)$/.test(
      normalized,
    )
  ) {
    return "2º tempo";
  }

  return status;
}
