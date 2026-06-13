do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'grupos'
  ) then
    alter publication supabase_realtime drop table public.grupos;
  end if;
end;
$$;
