BEGIN;
CREATE TABLE IF NOT EXISTS cg_tenants (id UUID PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS cg_tenant_memberships (
  tenant_id UUID NOT NULL REFERENCES cg_tenants(id), user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('operator','agronomist','auditor','admin')), active BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, user_id)
);
CREATE TABLE IF NOT EXISTS cg_cases (
  id BIGSERIAL PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES cg_tenants(id), field_id TEXT NOT NULL,
  crop TEXT NOT NULL, species TEXT NOT NULL, region TEXT NOT NULL, season TEXT NOT NULL, captured_at TIMESTAMPTZ NOT NULL,
  symptoms TEXT NOT NULL, source_type TEXT NOT NULL, observation_fingerprint CHAR(64) NOT NULL,
  status TEXT NOT NULL DEFAULT 'ingested' CHECK (status IN ('ingested','assessed','expert_review','approved','rejected','dispatched','completed','cancelled')),
  idempotency_key TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS cg_evidence (id BIGSERIAL PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES cg_cases(id), kind TEXT NOT NULL, uri TEXT NOT NULL, sha256 CHAR(64) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(case_id, sha256));
CREATE TABLE IF NOT EXISTS cg_provider_syncs (id BIGSERIAL PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES cg_tenants(id), provider TEXT NOT NULL, cursor TEXT, status TEXT NOT NULL CHECK(status IN ('pending','running','succeeded','failed')), attempt_count INTEGER NOT NULL DEFAULT 0, error_code TEXT, error_detail TEXT, source_version TEXT, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, UNIQUE(tenant_id, provider, cursor));
CREATE TABLE IF NOT EXISTS cg_outbox (id BIGSERIAL PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES cg_tenants(id), topic TEXT NOT NULL, aggregate_id BIGINT NOT NULL, payload JSONB NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), delivered_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS cg_audit_events (id BIGSERIAL PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES cg_tenants(id), case_id BIGINT REFERENCES cg_cases(id), actor_id INTEGER REFERENCES users(id), action TEXT NOT NULL, before_state JSONB, after_state JSONB, occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS cg_cases_tenant_status_idx ON cg_cases(tenant_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS cg_outbox_pending_idx ON cg_outbox(available_at) WHERE delivered_at IS NULL;
COMMIT;
