-- Run this in Supabase SQL Editor.
-- This script aligns older and newer schemas used by the backend.
-- It also adds basic RLS policies so anon/authenticated keys can read/write.
-- For production, tighten policies by user ownership instead of open access.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Keep compatibility with projects that already have a minimal generated_resumes table.
CREATE TABLE IF NOT EXISTS public.generated_resumes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  resume_text TEXT NOT NULL DEFAULT '',
  job_description TEXT NOT NULL DEFAULT '',
  ats_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.generated_resumes
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS github_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS github_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS generated_resume_markdown TEXT,
  ADD COLUMN IF NOT EXISTS ats_analysis JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS resume_text TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID;

UPDATE public.generated_resumes
SET generated_resume_markdown = COALESCE(generated_resume_markdown, resume_text)
WHERE generated_resume_markdown IS NULL;

UPDATE public.generated_resumes
SET resume_text = COALESCE(resume_text, generated_resume_markdown, '')
WHERE resume_text IS NULL;

ALTER TABLE public.generated_resumes
  ALTER COLUMN resume_text SET DEFAULT '',
  ALTER COLUMN job_description SET DEFAULT '',
  ALTER COLUMN ats_score SET DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.parser_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('github', 'linkedin_url', 'linkedin_pdf', 'resume')),
  source_key TEXT,
  raw_text TEXT,
  parsed_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_parser_records_source_key_created_at
  ON public.parser_records (source, source_key, created_at DESC);

-- Basic grants for REST access
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_resumes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parser_records TO anon, authenticated;

-- Enable and configure RLS
ALTER TABLE public.generated_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parser_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS generated_resumes_anon_all ON public.generated_resumes;
CREATE POLICY generated_resumes_anon_all
  ON public.generated_resumes
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS generated_resumes_authenticated_all ON public.generated_resumes;
CREATE POLICY generated_resumes_authenticated_all
  ON public.generated_resumes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS parser_records_anon_all ON public.parser_records;
CREATE POLICY parser_records_anon_all
  ON public.parser_records
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS parser_records_authenticated_all ON public.parser_records;
CREATE POLICY parser_records_authenticated_all
  ON public.parser_records
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
