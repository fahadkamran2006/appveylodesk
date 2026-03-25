import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

function AnimatedSphere() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<any>(null!);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = clock.getElapsedTime() * 0.15;
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.2;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={1.2}>
      <mesh ref={meshRef} scale={2.4}>
        <icosahedronGeometry args={[1, 8]} />
        <MeshDistortMaterial
          ref={materialRef}
          color="#6366f1"
          roughness={0.15}
          metalness={0.9}
          distort={0.35}
          speed={2}
          transparent
          opacity={0.85}
        />
      </mesh>
    </Float>
  );
}

function ParticleField() {
  const count = 120;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    return pos;
  }, []);

  const pointsRef = useRef<THREE.Points>(null!);

  useFrame(({ clock }) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = clock.getElapsedTime() * 0.03;
      pointsRef.current.rotation.x = clock.getElapsedTime() * 0.02;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#818cf8"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

export function HeroScene() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1} color="#a5b4fc" />
        <directionalLight position={[-3, -3, 2]} intensity={0.4} color="#6366f1" />
        <pointLight position={[0, 0, 4]} intensity={0.8} color="#c7d2fe" />
        <AnimatedSphere />
        <ParticleField />
      </Canvas>
    </div>
  );
}
