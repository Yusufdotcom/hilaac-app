"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Gamepad2, X } from "lucide-react";
import { brandColorWithAlpha } from "@/lib/brand/restaurant-brand";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const W = 360;
const H = 180;
const GROUND_Y = H - 28;
const GRAVITY = 0.62;
const JUMP_V = -9.4;
const BASE_SPEED = 3.6;
const CHEF_W = 26;
const CHEF_H = 32;
const CHEF_X = 40;

type Obstacle = { x: number; w: number; h: number; kind: "plate" | "tomato" | "pan" };

/**
 * Food-themed endless runner for the order status waiting experience.
 * Opens in a modal — does not permanently consume page space.
 */
export function WaitingGame({
  accent,
  className,
}: {
  accent: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-300",
          "hover:shadow-md active:scale-[0.99]",
          "animate-in fade-in slide-in-from-bottom-2 duration-500",
          className
        )}
        style={{
          borderColor: brandColorWithAlpha(accent, 0.28),
          background: `linear-gradient(135deg, ${brandColorWithAlpha(accent, 0.1)}, ${brandColorWithAlpha(accent, 0.04)} 55%, #fff)`,
          boxShadow: `0 4px 18px ${brandColorWithAlpha(accent, 0.12)}`,
        }}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: accent }}
          >
            <Gamepad2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-[#0F172A]">
              Play a game while you wait
            </span>
            <span className="block text-[11px] text-gray-500">
              Jump over plates · tap or press Space
            </span>
          </span>
        </span>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
          style={{ backgroundColor: accent }}
        >
          Play
        </span>
      </button>

      {mounted && open
        ? createPortal(
            <WaitingGameModal accent={accent} onClose={() => setOpen(false)} />,
            document.body
          )
        : null}
    </>
  );
}

function WaitingGameModal({
  accent,
  onClose,
}: {
  accent: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [runId, setRunId] = useState(0);

  const jumpRef = useRef<() => void>(() => {});
  const runningRef = useRef(false);
  const rafRef = useRef(0);
  const gameOverRef = useRef(false);

  const restart = useCallback(() => {
    setGameOver(false);
    setScore(0);
    setRunId((n) => n + 1);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const maybeCtx = canvas.getContext("2d");
    if (!maybeCtx) return;
    // Capture a definite non-null context for nested draw helpers (TS control-flow).
    const ctx: CanvasRenderingContext2D = maybeCtx;

    gameOverRef.current = false;
    runningRef.current = true;

    const state = {
      y: GROUND_Y,
      vy: 0,
      grounded: true,
      obstacles: [] as Obstacle[],
      frame: 0,
      score: 0,
      speed: BASE_SPEED,
    };

    jumpRef.current = () => {
      if (gameOverRef.current) return;
      if (state.grounded) {
        state.vy = JUMP_V;
        state.grounded = false;
      }
    };

    function spawn() {
      if (state.frame < 40) return;
      const gap = Math.max(55, 95 - Math.floor(state.score / 40));
      if (state.frame % gap !== 0) return;
      if (Math.random() < 0.35) return;
      const kinds: Obstacle["kind"][] = ["plate", "tomato", "pan"];
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      const h = kind === "pan" ? 28 : kind === "plate" ? 16 : 20;
      const w = kind === "pan" ? 22 : kind === "plate" ? 26 : 16;
      state.obstacles.push({ x: W + 8, w, h, kind });
    }

    function drawChef(x: number, top: number) {
      // Body (chef coat)
      ctx.fillStyle = "#F8FAFC";
      ctx.fillRect(x + 4, top + 12, 18, 18);
      // Hat
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.ellipse(x + 13, top + 8, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x + 6, top + 8, 14, 6);
      // Face
      ctx.fillStyle = "#FCD9B0";
      ctx.fillRect(x + 8, top + 14, 12, 10);
      // Eyes
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(x + 10, top + 17, 2, 2);
      ctx.fillRect(x + 16, top + 17, 2, 2);
    }

    function drawObstacle(o: Obstacle) {
      const top = GROUND_Y - o.h;
      if (o.kind === "plate") {
        ctx.fillStyle = "#E2E8F0";
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2, GROUND_Y - 4, o.w / 2, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2, GROUND_Y - 7, o.w / 3, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (o.kind === "tomato") {
        ctx.fillStyle = "#EF4444";
        ctx.beginPath();
        ctx.arc(o.x + o.w / 2, top + o.h / 2, o.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#22C55E";
        ctx.fillRect(o.x + o.w / 2 - 1, top, 2, 5);
      } else {
        ctx.fillStyle = "#64748B";
        ctx.fillRect(o.x, top + 8, o.w, o.h - 8);
        ctx.fillStyle = "#94A3B8";
        ctx.fillRect(o.x - 4, top + 6, o.w + 8, 4);
      }
    }

    function tick() {
      if (!runningRef.current) return;

      if (!gameOverRef.current) {
        state.frame += 1;
        state.speed = BASE_SPEED + Math.min(2.2, state.score / 120);

        state.vy += GRAVITY;
        state.y += state.vy;
        if (state.y >= GROUND_Y) {
          state.y = GROUND_Y;
          state.vy = 0;
          state.grounded = true;
        }

        spawn();
        state.obstacles = state.obstacles
          .map((o) => ({ ...o, x: o.x - state.speed }))
          .filter((o) => o.x > -40);

        const chefTop = state.y - CHEF_H;
        for (const o of state.obstacles) {
          const hit =
            CHEF_X + CHEF_W - 4 > o.x &&
            CHEF_X + 4 < o.x + o.w &&
            state.y > GROUND_Y - o.h + 2;
          if (hit) {
            gameOverRef.current = true;
            setGameOver(true);
            break;
          }
        }

        if (!gameOverRef.current && state.frame % 5 === 0) {
          state.score += 1;
          setScore(state.score);
        }
      }

      // Background
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#F8FAFC");
      sky.addColorStop(1, brandColorWithAlpha(accent, 0.12));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Ground
      ctx.fillStyle = "#0F172A";
      ctx.globalAlpha = 0.08;
      ctx.fillRect(0, GROUND_Y + 1, W, H - GROUND_Y);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = brandColorWithAlpha(accent, 0.35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y + 1);
      ctx.lineTo(W, GROUND_Y + 1);
      ctx.stroke();

      drawChef(CHEF_X, state.y - CHEF_H);
      for (const o of state.obstacles) drawObstacle(o);

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jumpRef.current();
      }
      if (e.code === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKey);
    };
  }, [accent, onClose, runId]);

  return (
    <div
      className="fixed inset-0 z-[220] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="waiting-game-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0F172A]/55 backdrop-blur-[2px]"
        aria-label="Close game"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300 rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-5"
        style={{ boxShadow: `0 -8px 40px ${brandColorWithAlpha(accent, 0.25)}` }}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p id="waiting-game-title" className="text-base font-bold text-[#0F172A]">
              Chef Run
            </p>
            <p className="text-xs text-gray-500">Score: {score}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-gray-100">
          <canvas
            key={runId}
            ref={canvasRef}
            width={W}
            height={H}
            className="h-auto w-full touch-none cursor-pointer"
            onPointerDown={() => jumpRef.current()}
            role="img"
            aria-label="Chef run game — tap or press space to jump"
          />
          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0F172A]/45 backdrop-blur-[1px]">
              <p className="text-lg font-bold text-white">Game over</p>
              <p className="text-sm text-white/90">Score: {score}</p>
              <Button
                type="button"
                className="rounded-xl border-0 px-6 font-semibold text-white"
                style={{ backgroundColor: accent }}
                onClick={restart}
              >
                Restart
              </Button>
            </div>
          )}
        </div>

        <p className="mt-3 text-center text-[11px] text-gray-500">
          Tap the game or press Space to jump
        </p>
      </div>
    </div>
  );
}
