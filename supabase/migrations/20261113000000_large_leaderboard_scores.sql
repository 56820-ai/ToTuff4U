-- Cookie Clicker scores can exceed BIGINT (and JavaScript's safe-integer range).
-- PostgreSQL NUMERIC preserves these large integer values exactly.
alter table public.scores
  alter column score type numeric
  using score::numeric;
