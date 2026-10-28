-- pg_net was created in public; reinstall it in the extensions schema (its API stays in schema net).
drop extension if exists pg_net;
create extension pg_net with schema extensions;
