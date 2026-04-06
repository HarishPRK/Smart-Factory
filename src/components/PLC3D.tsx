import { ReactThreeFiber } from "@react-three/fiber";
declare module "react-three-fiber" {
    export interface ThreeElements {
        mesh: ReactThreeFiber.Object3DNode<THREE.Mesh, typeof THREE.Mesh>;
        group: ReactThreeFiber.Object3DNode<THREE.Group, typeof THREE.Group>;
        components: ReactThreeFiber.Object3DNode<THREE.Group, typeof THREE.Group>;
    }
}   

export { default as PLC3D } from "./PLC3D";
export { default as PLCControlRoom } from "./factory3d/PLCControlRoom";
export { default as ZoneTabs } from "./ZoneTabs";

interface PLC3DProps {
    plcData: Record<string, number>;
    onComponentClick: (componentId: string) => void;
}

interface PLCComponentProps {
    id: string;
    compponet: string,

    light : string,
    value: number;
    onClick: (id: string) => void;  
    onClick: (id: string) => void;
    asset
}

component PLCComponent {
    const { id, component, value, onClick } = props;
    return (
        <mesh onClick={() => onClick(id)}>
            {/* Render the component based on its type and value */}
        </mesh>
    );
}
mesh oneClick={() => onClick(id)}>
    {/* Render the component based on its type and value */}
</mesh>

