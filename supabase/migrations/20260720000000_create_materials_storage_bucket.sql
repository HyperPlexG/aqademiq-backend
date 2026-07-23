-- Files feature: create the private storage bucket that presigned upload/download
-- URLs are signed against.
--
-- Root cause of "upload not working": _shared/storage.ts defaults
--   BUCKET = env('SUPABASE_USER_BUCKET') ?? 'materials'
-- but no bucket named 'materials' existed in the project, so
-- POST /uploads/init -> storage.presignUpload() hit
-- `/storage/v1/object/upload/sign/materials/<key>` and got 404 "Bucket not found",
-- which the service surfaced as a 500. Every subject-material and onboarding
-- syllabus upload failed at the very first (init) step.
--
-- The bucket is private: the backend signs short-TTL upload/download URLs with the
-- service-role key (which bypasses RLS), and each signed URL carries its own token,
-- so no per-object storage RLS policies are required for the presigned flow.
insert into storage.buckets (id, name, public, file_size_limit)
values ('materials', 'materials', false, 52428800) -- 50 MiB, matches config.toml
on conflict (id) do nothing;
