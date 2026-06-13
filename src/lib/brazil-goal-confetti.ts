import confetti from "canvas-confetti";

const BRAZIL_COLORS = ["#009c3b", "#006b2d", "#8cbd1f", "#ffdf00", "#f7d116"];
const CELEBRATION_DURATION_MS = 60_000;
const CONFETTI_INTERVAL_MS = 180;

let confettiInterval: ReturnType<typeof setInterval> | null = null;
let confettiTimeout: ReturnType<typeof setTimeout> | null = null;
let celebrationEndsAt = 0;
let previewMode = false;

function fireBrazilConfettiBurst() {
  confetti({
    particleCount: 10,
    spread: 80,
    startVelocity: 28,
    origin: { x: Math.random(), y: -0.04 },
    colors: BRAZIL_COLORS,
    gravity: 1.15,
    scalar: 1.05,
    ticks: 420,
    disableForReducedMotion: true,
  });
}

function clearCelebrationTimers() {
  if (confettiInterval) {
    clearInterval(confettiInterval);
    confettiInterval = null;
  }

  if (confettiTimeout) {
    clearTimeout(confettiTimeout);
    confettiTimeout = null;
  }
}

function scheduleCelebrationEnd() {
  if (previewMode) return;

  if (confettiTimeout) {
    clearTimeout(confettiTimeout);
  }

  const remainingMs = Math.max(0, celebrationEndsAt - Date.now());
  confettiTimeout = setTimeout(() => {
    clearCelebrationTimers();
    celebrationEndsAt = 0;
  }, remainingMs);
}

function ensureConfettiLoop() {
  if (confettiInterval) return;

  fireBrazilConfettiBurst();

  confettiInterval = setInterval(() => {
    if (previewMode || Date.now() < celebrationEndsAt) {
      fireBrazilConfettiBurst();
      return;
    }

    clearCelebrationTimers();
    celebrationEndsAt = 0;
  }, CONFETTI_INTERVAL_MS);
}

export function celebrateBrazilGoal() {
  if (previewMode) return;

  const now = Date.now();
  celebrationEndsAt = Math.max(celebrationEndsAt, now) + CELEBRATION_DURATION_MS;
  ensureConfettiLoop();
  scheduleCelebrationEnd();
}

export function startBrazilGoalConfettiPreview() {
  previewMode = true;
  celebrationEndsAt = Number.POSITIVE_INFINITY;
  ensureConfettiLoop();
}

export function stopBrazilGoalConfetti() {
  previewMode = false;
  clearCelebrationTimers();
  celebrationEndsAt = 0;
}
