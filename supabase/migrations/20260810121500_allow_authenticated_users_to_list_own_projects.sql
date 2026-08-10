-- Projetos podem ser criados por usuários autenticados, mas a política
-- existente de SELECT não contempla o papel `authenticated`. Isso faz o
-- INSERT funcionar e, logo depois, "Meus projetos" receber uma lista vazia.
--
-- A política abaixo permite que cada usuário autenticado leia apenas as
-- linhas cujo user_id corresponde ao seu próprio auth.uid(). Ela não altera
-- as políticas existentes usadas pelos links públicos compartilhados.

alter table public.projects enable row level security;

drop policy if exists "authenticated_users_select_own_projects"
  on public.projects;

create policy "authenticated_users_select_own_projects"
  on public.projects
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
