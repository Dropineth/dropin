"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  buildGlobalCommandCenterEarthMarkers,
  type GlobalCommandCenterEarthMarker,
  type GlobalCommandCenterMarkerState,
} from "@/lib/canopyproof-global-command-center-earth";
import type { GlobalImpactEarthProps } from "./GlobalImpactEarthLoader";

const legend: readonly { readonly state: GlobalCommandCenterMarkerState; readonly label: string; readonly color: string }[] = [
  { state: "challenged", label: "Challenged", color: "#f87171" },
  { state: "active_risk", label: "Active risk", color: "#fbbf24" },
  { state: "monitored", label: "Monitored", color: "#34d399" },
  { state: "registered", label: "Registered", color: "#60a5fa" },
];

export function GlobalImpactEarth({ regions, dashboardRoot }: GlobalImpactEarthProps) {
  const markers = useMemo(() => buildGlobalCommandCenterEarthMarkers(regions), [regions]);
  const [selectedRegionId, setSelectedRegionId] = useState(markers[0]?.regionId ?? "");
  const selected = markers.find((marker) => marker.regionId === selectedRegionId) ?? markers[0];
  const withheldCount = regions.length - markers.length;

  return (
    <section className="mt-10 border-y border-zinc-800 py-7" aria-labelledby="global-earth-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase text-emerald-300">Public-safe Earth view</p>
          <h2 className="mt-2 text-2xl font-semibold text-white" id="global-earth-title">
            Generalized regional operations
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Markers appear only after independent privacy and safeguarding review. Coordinates are generalized to one degree; exact project and evidence locations never enter this scene.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Earth marker state legend">
          {legend.map((item) => (
            <span className="inline-flex items-center gap-2 text-xs text-zinc-400" key={item.state}>
              <span aria-hidden="true" className="size-2" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div
        aria-label={`${markers.length} approved generalized regions shown on an interactive Earth; ${withheldCount} regions withheld`}
        className="relative mt-5 h-80 w-full overflow-hidden bg-zinc-950 sm:h-auto sm:aspect-[16/7]"
        role="group"
      >
        <Canvas
          aria-hidden="true"
          camera={{ fov: 38, near: 0.1, far: 20, position: [0, 0.15, 3.25] }}
          dpr={[1, 1.5]}
          fallback={<EarthCanvasFallback />}
          frameloop="demand"
          gl={{ alpha: false, antialias: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => gl.setClearColor("#09090b", 1)}
        >
          <ambientLight intensity={1.25} />
          <directionalLight color="#f4f4f5" intensity={2.2} position={[3, 2, 4]} />
          <directionalLight color="#2dd4bf" intensity={0.55} position={[-4, -1, -3]} />
          <EarthScene
            markers={markers}
            onSelect={setSelectedRegionId}
            selectedRegionId={selected?.regionId}
          />
          <OrbitControls enablePan={false} maxDistance={5} minDistance={2.1} />
        </Canvas>
      </div>

      <div className="mt-4 grid gap-4 border-t border-zinc-800 pt-4 lg:grid-cols-[minmax(16rem,0.65fr)_minmax(0,1.35fr)] lg:items-start">
        <label className="text-sm text-zinc-300">
          Reviewed region
          <select
            className="mt-2 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/30 disabled:cursor-not-allowed disabled:text-zinc-600"
            disabled={markers.length === 0}
            onChange={(event) => setSelectedRegionId(event.target.value)}
            value={selected?.regionId ?? ""}
          >
            {markers.length === 0 ? <option value="">No approved public geometry</option> : null}
            {markers.map((marker) => <option key={marker.regionId} value={marker.regionId}>{marker.regionId}</option>)}
          </select>
        </label>
        {selected ? <SelectedRegionSummary marker={selected} /> : <WithheldSummary withheldCount={withheldCount} />}
      </div>

      <p className="mt-4 break-all font-mono text-xs leading-5 text-zinc-600">
        Snapshot root {dashboardRoot}
      </p>
    </section>
  );
}

function EarthScene({
  markers,
  onSelect,
  selectedRegionId,
}: {
  readonly markers: readonly GlobalCommandCenterEarthMarker[];
  readonly onSelect: (regionId: string) => void;
  readonly selectedRegionId?: string | undefined;
}) {
  return (
    <group rotation={[0.08, -0.35, 0]}>
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial color="#16363c" metalness={0.05} roughness={0.88} />
      </mesh>
      <mesh scale={1.003}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#a7f3d0" opacity={0.13} transparent wireframe />
      </mesh>
      {markers.length > 0 ? (
        <MarkerInstances markers={markers} onSelect={onSelect} selectedRegionId={selectedRegionId} />
      ) : null}
    </group>
  );
}

function MarkerInstances({
  markers,
  onSelect,
  selectedRegionId,
}: {
  readonly markers: readonly GlobalCommandCenterEarthMarker[];
  readonly onSelect: (regionId: string) => void;
  readonly selectedRegionId?: string | undefined;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!mesh.current) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    markers.forEach((marker, index) => {
      position.set(...marker.position);
      const selectedScale = marker.regionId === selectedRegionId ? 1.45 : 1;
      scale.setScalar(marker.radius * selectedScale);
      matrix.compose(position, rotation, scale);
      mesh.current?.setMatrixAt(index, matrix);
      mesh.current?.setColorAt(index, new THREE.Color(marker.color));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [markers, selectedRegionId]);

  function selectMarker(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    if (event.instanceId === undefined) return;
    const marker = markers[event.instanceId];
    if (marker) onSelect(marker.regionId);
  }

  return (
    <instancedMesh
      args={[undefined, undefined, markers.length]}
      frustumCulled
      onClick={selectMarker}
      ref={mesh}
    >
      <sphereGeometry args={[1, 10, 10]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}

function SelectedRegionSummary({ marker }: { readonly marker: GlobalCommandCenterEarthMarker }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
      <EarthDatum label="Region" value={marker.regionId} />
      <EarthDatum label="Operational state" value={marker.state.replace("_", " ")} />
      <EarthDatum label="Projects in cohort" value={String(marker.sourceProjectCount)} />
      <EarthDatum label="Active risk alerts" value={String(marker.activeRiskAlertCount)} />
      <EarthDatum label="Latitude" value={`${marker.latitudeDegrees}° generalized`} />
      <EarthDatum label="Longitude" value={`${marker.longitudeDegrees}° generalized`} />
      <EarthDatum label="Precision" value={`${marker.precisionDegrees}°`} />
      <EarthDatum label="Disclosure root" value={marker.disclosureRoot.slice(0, 16)} />
    </dl>
  );
}

function EarthDatum({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-xs uppercase text-zinc-600">{label}</dt>
      <dd className="mt-1 break-words text-zinc-300">{value}</dd>
    </div>
  );
}

function WithheldSummary({ withheldCount }: { readonly withheldCount: number }) {
  return (
    <div className="border-l-2 border-zinc-700 pl-4 text-sm leading-6 text-zinc-400">
      No approved public geometry is available. {withheldCount} regional summaries remain withheld; operational metrics and lineage stay available in the table below.
    </div>
  );
}

function EarthCanvasFallback() {
  return (
    <div className="flex min-h-80 w-full items-center justify-center bg-zinc-950 px-6 text-center text-sm text-zinc-500">
      WebGL is unavailable. Use the verified regional table below.
    </div>
  );
}
