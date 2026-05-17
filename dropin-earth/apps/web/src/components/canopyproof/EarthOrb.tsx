const nodes = [
  { className: "node-a", label: "Community planting proof node" },
  { className: "node-b", label: "Water restoration proof node" },
  { className: "node-c", label: "Biodiversity observation proof node" },
  { className: "node-d", label: "Satellite cross-check proof node" },
  { className: "node-e", label: "Field evidence proof node" },
] as const;

export function EarthOrb() {
  return (
    <div aria-label="CanopyProof global restoration evidence orb" className="cp-earth-orb" role="img">
      <div className="cp-earth-glow" />
      <div className="cp-earth-sphere">
        <span className="cp-continent cp-continent-a" />
        <span className="cp-continent cp-continent-b" />
        <span className="cp-continent cp-continent-c" />
        <span className="cp-continent cp-continent-d" />
        <span className="cp-heat cp-heat-a" />
        <span className="cp-heat cp-heat-b" />
        <span className="cp-heat cp-heat-c" />
        {nodes.map((node) => (
          <span aria-label={node.label} className={`cp-proof-node ${node.className}`} key={node.className} />
        ))}
      </div>
      <span className="cp-orbit cp-orbit-a" />
      <span className="cp-orbit cp-orbit-b" />
      <span className="cp-orbit cp-orbit-c" />
    </div>
  );
}
