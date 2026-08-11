-- O perfil comercial precisa nascer junto com auth.users. Depender do
-- primeiro login deixava nome, telefone e endereço presos no localStorage
-- enquanto a confirmação de e-mail estava pendente.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Contas que não vieram do formulário do Esboce podem não possuir estes
  -- metadados. Nesse caso não fabricamos um perfil comercial incompleto.
  if nullif(btrim(new.raw_user_meta_data ->> 'nome'), '') is null
     or nullif(btrim(new.raw_user_meta_data ->> 'telefone'), '') is null then
    return new;
  end if;

  insert into public.profiles (
    id, nome, telefone, cep, estado, cidade, bairro, rua, numero
  ) values (
    new.id,
    btrim(new.raw_user_meta_data ->> 'nome'),
    btrim(new.raw_user_meta_data ->> 'telefone'),
    nullif(btrim(new.raw_user_meta_data ->> 'cep'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'estado'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'cidade'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'bairro'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'rua'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'numero'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user_profile() from public;
revoke all on function public.handle_new_user_profile() from anon;
revoke all on function public.handle_new_user_profile() from authenticated;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Recupera automaticamente contas sem perfil que já possuam os metadados.
-- Perfis existentes nunca são sobrescritos.
insert into public.profiles (
  id, nome, telefone, cep, estado, cidade, bairro, rua, numero
)
select
  users.id,
  btrim(users.raw_user_meta_data ->> 'nome'),
  btrim(users.raw_user_meta_data ->> 'telefone'),
  nullif(btrim(users.raw_user_meta_data ->> 'cep'), ''),
  nullif(btrim(users.raw_user_meta_data ->> 'estado'), ''),
  nullif(btrim(users.raw_user_meta_data ->> 'cidade'), ''),
  nullif(btrim(users.raw_user_meta_data ->> 'bairro'), ''),
  nullif(btrim(users.raw_user_meta_data ->> 'rua'), ''),
  nullif(btrim(users.raw_user_meta_data ->> 'numero'), '')
from auth.users as users
where nullif(btrim(users.raw_user_meta_data ->> 'nome'), '') is not null
  and nullif(btrim(users.raw_user_meta_data ->> 'telefone'), '') is not null
on conflict (id) do nothing;
