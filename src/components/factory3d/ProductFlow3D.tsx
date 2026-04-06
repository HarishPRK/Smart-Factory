"use no memo";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDigitalTwinStore } from "../../stores/digitalTwinStore";

interface ProductFlow3DProps {
  path: [number, number, number][];
}

const MAX_PRODUCTS = 30;

/**
 * ProductFlow3D — Performance-optimized
 *
 * Uses InstancedMesh with per-instance color.
 * Reads products via getState() in useFrame — zero React re-renders.
 * No per-product pointLights (was the biggest GPU bottleneck).
 */
const ProductFlow3D: React.FC<ProductFlow3DProps> = ({ path }) => {
  const instanceRef = useRef<THREE.InstancedMesh>(null);
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const hideMatrix = useMemo(() => new THREE.Matrix4().makeTranslation(0, -100, 0), []);

  const getPathPosition = (t: number): [number, number, number] => {
    const clampedT = Math.max(0, Math.min(1, t));
    const totalT = clampedT * (path.length - 1);
    const segIdx = Math.min(Math.floor(totalT), path.length - 2);
    const segT = totalT - segIdx;
    const a = path[segIdx];
    const b = path[segIdx + 1];
    return [
      a[0] + (b[0] - a[0]) * segT,
      a[1] + (b[1] - a[1]) * segT + 0.15,
      a[2] + (b[2] - a[2]) * segT,
    ];
  };

  useFrame(() => {
    if (!instanceRef.current) return;

    // Read directly from store — no React subscription
    const products = useDigitalTwinStore.getState().products;
    const visibleCount = Math.min(products.length, MAX_PRODUCTS);

    for (let i = 0; i < MAX_PRODUCTS; i++) {
      if (i < visibleCount) {
        const product = products[i];
        const pos = getPathPosition(product.progress);
        tempMatrix.makeTranslation(pos[0], pos[1], pos[2]);
        instanceRef.current.setMatrixAt(i, tempMatrix);
        tempColor.set(product.color);
        instanceRef.current.setColorAt(i, tempColor);
      } else {
        instanceRef.current.setMatrixAt(i, hideMatrix);
      }
    }

    instanceRef.current.instanceMatrix.needsUpdate = true;
    if (instanceRef.current.instanceColor) {
      instanceRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={instanceRef} args={[undefined, undefined, MAX_PRODUCTS]} castShadow>
      <boxGeometry args={[0.15, 0.12, 0.15]} />
      <meshStandardMaterial
        color="#10b981"
        metalness={0.2}
        roughness={0.6}
        emissive="#059669"
        emissiveIntensity={0.15}
      />
    </instancedMesh>
  );
};

export default ProductFlow3D;
