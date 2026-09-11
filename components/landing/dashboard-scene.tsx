"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useReducedMotion } from "framer-motion";

const ASPECT = 1400 / 900;
const BASE_X = THREE.MathUtils.degToRad(15);
const BASE_Y = THREE.MathUtils.degToRad(-5);

function DashboardPlane({
  textureUrl,
  reduceMotion,
}: {
  textureUrl: string;
  reduceMotion: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const spin = useRef(0);
  const { pointer } = useThree();
  const texture = useTexture(textureUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    if (reduceMotion) {
      mesh.rotation.x = BASE_X;
      mesh.rotation.y = BASE_Y;
      return;
    }

    spin.current += 0.001 * Math.min(delta * 60, 2);
    const parallaxX = pointer.y * 0.05;
    const parallaxY = pointer.x * 0.05;
    mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, BASE_X + parallaxX, 0.1);
    mesh.rotation.y = THREE.MathUtils.lerp(
      mesh.rotation.y,
      BASE_Y + spin.current + parallaxY,
      0.1
    );
  });

  const height = 3.15;
  const width = height * ASPECT;

  return (
    <mesh ref={meshRef} position={[0.2, -0.25, 0]} rotation={[BASE_X, BASE_Y, 0]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} roughness={0.5} metalness={0.04} />
    </mesh>
  );
}

export function DashboardScene({
  textureUrl = "/marketing/hilaac-dashboard.png",
}: {
  textureUrl?: string;
}) {
  const reduceMotion = useReducedMotion() === true;

  return (
    <div className="relative h-[300px] w-full sm:h-[380px] lg:h-[440px] xl:h-[480px]">
      <div
        className="pointer-events-none absolute -inset-8 rounded-[2rem] bg-hilaac-gold/15 blur-3xl"
        aria-hidden="true"
      />
      <Canvas
        className="h-full w-full touch-none"
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.15, 5.4], fov: 36 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[-3.2, 4.2, 3.2]} intensity={1.4} color="#fff8ee" />
        <directionalLight position={[2.5, -0.5, 2]} intensity={0.28} color="#C9A84C" />
        <Suspense fallback={null}>
          <DashboardPlane textureUrl={textureUrl} reduceMotion={reduceMotion} />
        </Suspense>
      </Canvas>
    </div>
  );
}
