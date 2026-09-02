-- Migration: Create user_invitations table
-- Run this against the Supabase database (via Supabase SQL Editor or psql)
-- This is a strictly ADDITIVE migration - no existing tables are modified.

CREATE TABLE IF NOT EXISTS public.user_invitations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'INSTRUCTOR')),
    status          TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'FAILED', 'CANCELLED')),
    invited_by_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
    supabase_user_id UUID,
    invited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at     TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    resent_count    INTEGER NOT NULL DEFAULT 0,
    notes           TEXT
);

-- Partial unique index: only ONE pending invitation per email at a time
-- Expired, accepted, cancelled invites don't block re-inviting
CREATE UNIQUE INDEX IF NOT EXISTS uq_invitations_email_pending
    ON public.user_invitations(lower(email))
    WHERE status = 'PENDING';

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.user_invitations(lower(email));
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.user_invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON public.user_invitations(invited_by_id);

COMMENT ON TABLE public.user_invitations IS 'Tracks Admin-sent user invitations with status lifecycle';
COMMENT ON COLUMN public.user_invitations.role IS 'The DataCaliper role pre-assigned to the invited user (USER or INSTRUCTOR only)';
COMMENT ON COLUMN public.user_invitations.status IS 'PENDING: sent; ACCEPTED: user activated; EXPIRED: 7-day window passed; FAILED: Supabase API error; CANCELLED: admin cancelled';
