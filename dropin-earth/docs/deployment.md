# Deployment

V1 deployment targets:

- API: containerized Node service.
- Web/Admin: Next.js deployment.
- Database: PostgreSQL + PostGIS.
- Queue/cache: Redis.

Required before canary:

- Run the Prisma-backed API with PostgreSQL and seeded regions/rounds.
- Enable rate limiting.
- Configure structured logs and Sentry DSN.
- Add auth and RBAC to admin mutation routes.
- Wire multisig/timelock treasury controls.
- Publish a red-team finding register.
