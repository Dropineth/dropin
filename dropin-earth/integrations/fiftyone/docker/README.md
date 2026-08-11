# FiftyOne Container Gate

No runnable Dockerfile is committed until Security approves an exact FiftyOne
base-image digest. This avoids silently converting a mutable tag into an
institutional runtime.

The approved image must:

- use an exact `sha256` base image and lock all Python/JavaScript dependencies;
- copy only the reviewed `@canopyproof/review` plugin;
- disable runtime plugin, package, model, and dataset downloads;
- run non-root with a read-only root filesystem and bounded scratch volume;
- expose only the internal FiftyOne port behind identity-aware ingress;
- connect only to a dedicated disposable MongoDB and loopback review proxy;
- contain no CanopyProof, database, object-storage, KMS, GitHub, or provider
  credentials;
- publish SBOM, build provenance, signature, vulnerability report, plugin hash,
  and operator allowlist hash.

Adding a Dockerfile requires the parent RFC deployment gate to open. The build
must then be exercised by CI before any environment receives institutional
data.
