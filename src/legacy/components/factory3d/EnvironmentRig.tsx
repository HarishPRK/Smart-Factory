import { Environment } from "@react-three/drei";

/**
 * Image-based lighting. Mounted only on the ULTRA tier (gated in FactoryScene).
 * Uses drei's bundled "city" preset so no asset download is required. If a
 * custom Poly Haven HDRI is dropped at /public/hdri/factory_yard_1k.hdr, swap
 * the `preset` prop for `files="/hdri/factory_yard_1k.hdr"`.
 */
export default function EnvironmentRig() {
  return (
    <Environment
      preset="studio"
      background={false}
      environmentIntensity={0.08}
    />
  );
}
