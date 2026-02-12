-- Harden mutable search_path warning for search_journal_entries
ALTER FUNCTION public.search_journal_entries(vector, uuid, double precision, integer)
SET search_path = public;
