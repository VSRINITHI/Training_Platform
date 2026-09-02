-- Migration: Add course metadata fields (prerequisites, learning_outcomes, has_certificate)
-- Additive migration for professional course metadata

ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS prerequisites JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS learning_outcomes JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS has_certificate BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.courses.prerequisites IS 'Structured list of course prerequisites (strings)';
COMMENT ON COLUMN public.courses.learning_outcomes IS 'Structured list of expected learning outcomes (strings)';
COMMENT ON COLUMN public.courses.has_certificate IS 'Whether this course offers a certificate upon completion';
