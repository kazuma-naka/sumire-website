CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('dictionary', 'bug', 'feature')),
  payload_json TEXT NOT NULL,
  contact_email TEXT,
  moderation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  public_title TEXT,
  public_description TEXT,
  public_status TEXT
    CHECK (public_status IS NULL OR public_status IN ('under_review', 'planned', 'in_progress', 'completed', 'not_planned')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS submissions_pending_created
  ON submissions (moderation_status, created_at);

CREATE INDEX IF NOT EXISTS submissions_public_reviewed
  ON submissions (moderation_status, reviewed_at DESC);
