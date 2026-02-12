-- Schedule automatic processing for accounts pending deletion (+60 days).
-- The processor deletes due accounts from auth.users, cascading linked data.

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron extension is not available in this environment: %', SQLERRM;
  END;
END $$;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    SELECT jobid
    INTO v_job_id
    FROM cron.job
    WHERE jobname = 'process_due_account_deletions_daily'
    LIMIT 1;

    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;

    PERFORM cron.schedule(
      'process_due_account_deletions_daily',
      '17 2 * * *',
      $job$SELECT public.process_due_account_deletions(200);$job$
    );
  ELSE
    RAISE NOTICE 'cron schema not found: automatic account deletion job was not scheduled.';
  END IF;
END $$;
