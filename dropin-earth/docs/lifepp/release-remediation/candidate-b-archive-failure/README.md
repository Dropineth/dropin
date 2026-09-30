# Candidate B archive failure retained

Actual HEAD: `83b06e6c5df399d7f745cf301a6276f94e503db5`. A clean fixed-runtime install passed, then the unchanged supply-chain gate rejected an accidentally tracked full coverage generation file in the evidence archive. The local full run is FAIL; unexecuted commands are not green. A separate five-command B local build/workerd/fixture run passed, but is not the full Trust Gate.

The subsequent documentation-only correction removes the generated coverage file from Git. Its unchanged original remains in candidate A's downloaded GitHub artifact and local ignored reports; the existing coverage totals and compact report remain reviewable. The archive manifest lists the omission. No gate, threshold, test or failure report was removed or relaxed. The correcting commit requires fresh complete remote workflows.

`native-initdb.json` records a separate local PostgreSQL 17.10 environment failure: its compiled Homebrew timezone directory is missing. No global installation was modified. Native PostgreSQL remains a required remote check using the existing disposable CI container.
