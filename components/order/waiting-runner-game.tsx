"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { cn } from "@/lib/utils";

const W = 360;
const H = 80;
const GROUND = H - 14;
const GRAVITY = 0.55;
const JUMP = -7.5;
const SPEED = 3.2;

/**
 * Compact offline T-Rex-style runner — pure canvas, no network required.
 */
export function WaitingRunnerGame({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [score, setScore] = useState(0);
  const runningRef = useRef(false);
  const rafRef = useRef<number>(0);
  const stateRef = useRef({
    dinoY: GROUND,
    dinoVy: 0,
    grounded: true,
    obstacles: [] as { x: number; w: number; h: number }[],
    frame: 0,
    score: 0,
  });

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (s.grounded) {
      s.dinoVy = JUMP;
      s.grounded = false;
    }
  }, []);

  useEffect(() => {
    if (!expanded) {
      runningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawCtx = ctx;
    runningRef.current = true;
    stateRef.current = {
      dinoY: GROUND,
      dinoVy: 0,
      grounded: true,
      obstacles: [],
      frame: 0,
      score: 0,
    };

    function spawnObstacle() {
      const s = stateRef.current;
      if (s.frame % 90 === 0 && Math.random() > 0.35) {
        s.obstacles.push({ x: W + 10, w: 8 + Math.random() * 6, h: 14 + Math.random() * 10 });
      }
    }

    function tick() {
      if (!runningRef.current) return;
      const s = stateRef.current;
      s.frame += 1;

      s.dinoVy += GRAVITY;
      s.dinoY += s.dinoVy;
      if (s.dinoY >= GROUND) {
        s.dinoY = GROUND;
        s.dinoVy = 0;
        s.grounded = true;
      }

      spawnObstacle();
      s.obstacles = s.obstacles
        .map((o) => ({ ...o, x: o.x - SPEED }))
        .filter((o) => o.x > -20);

      const dinoX = 28;
      const dinoH = 18;
      const dinoW = 16;
      const dinoTop = s.dinoY - dinoH;

      for (const o of s.obstacles) {
        if (
          dinoX + dinoW > o.x &&
          dinoX < o.x + o.w &&
          s.dinoY > GROUND - o.h
        ) {
          s.obstacles = [];
          s.score = 0;
          setScore(0);
        }
      }

      if (s.frame % 6 === 0) {
        s.score += 1;
        setScore(s.score);
      }

      drawCtx.clearRect(0, 0, W, H);
      drawCtx.fillStyle = "#f9fafb";
      drawCtx.fillRect(0, 0, W, H);

      drawCtx.strokeStyle = "#e5e7eb";
      drawCtx.beginPath();
      drawCtx.moveTo(0, GROUND + 1);
      drawCtx.lineTo(W, GROUND + 1);
      drawCtx.stroke();

      drawCtx.fillStyle = "#374151";
      drawCtx.fillRect(dinoX, dinoTop, dinoW, dinoH);
      drawCtx.fillStyle = "#fff";
      drawCtx.fillRect(dinoX + 10, dinoTop + 4, 3, 3);

      drawCtx.fillStyle = "#16a34a";
      for (const o of s.obstacles) {
        drawCtx.fillRect(o.x, GROUND - o.h, o.w, o.h);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded, jump]);

  return (
    <div className={cn("w-full", className)}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white/80 py-1.5 text-[11px] font-medium text-gray-500 transition-colors hover:bg-white hover:text-gray-700"
      >
        <Gamepad2 className="h-3.5 w-3.5" aria-hidden="true" />
        {expanded ? "Hide game" : "Play a game while you wait"}
      </button>

      {expanded && (
        <div className="mt-1.5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="w-full cursor-pointer touch-none"
            onPointerDown={jump}
            role="img"
            aria-label="Jump game — tap or press space to jump"
          />
          <p className="border-t border-gray-100 py-1 text-center text-[10px] text-gray-400">
            Tap or Space to jump · Score: {score}
          </p>
        </div>
      )}
    </div>
  );
}
