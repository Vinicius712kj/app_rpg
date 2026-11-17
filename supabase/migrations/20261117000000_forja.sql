-- Estrutura inicial da Forja para um projeto Supabase novo.
begin;

create schema forja_privado;
revoke all on schema forja_privado from public, anon, authenticated;
grant usage on schema forja_privado to authenticated;
alter default privileges in schema forja_privado revoke execute on functions from public;

create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  avatar_url text
);

create table public.campanhas (
  id uuid primary key default gen_random_uuid(),
  mestre_id uuid not null references public.usuarios(id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  sistema text not null check (sistema in ('dnd5e', 'etherion', 'op', 'tormenta')),
  status text not null default 'active' check (status in ('active', 'paused', 'done')),
  entrada_aberta boolean not null default true,
  dados jsonb not null default '{}',
  criado_em timestamptz not null default now()
);

create table public.convites_campanha (
  campanha_id uuid primary key references public.campanhas(id) on delete cascade,
  codigo text not null unique
);

create table public.personagens (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null references public.usuarios(id) on delete cascade,
  campanha_id uuid references public.campanhas(id) on delete set null,
  nome text not null check (btrim(nome) <> ''),
  sistema text not null check (sistema in ('dnd5e', 'etherion', 'op', 'tormenta')),
  dados jsonb not null default '{}',
  criado_em timestamptz not null default now()
);

create table public.solicitacoes_entrada (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  personagem_id uuid not null references public.personagens(id) on delete cascade,
  solicitante_id uuid not null references public.usuarios(id) on delete cascade,
  personagem_nome text not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado')),
  criado_em timestamptz not null default now()
);

create table public.npcs (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  tipo text,
  aparencia text,
  visivel_jogadores boolean not null default false,
  criado_em timestamptz not null default now()
);

create table public.entradas_diario (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  titulo text,
  data_sessao date,
  resumo text,
  criado_em timestamptz not null default now()
);

create table public.notas_mestre (
  campanha_id uuid primary key references public.campanhas(id) on delete cascade,
  conteudo text not null default ''
);

create index campanhas_mestre_idx on public.campanhas (mestre_id);
create index personagens_dono_idx on public.personagens (dono_id);
create index personagens_campanha_idx on public.personagens (campanha_id, dono_id);
create index solicitacoes_campanha_idx on public.solicitacoes_entrada (campanha_id, status);
create index solicitacoes_personagem_idx on public.solicitacoes_entrada (personagem_id);
create index solicitacoes_solicitante_idx on public.solicitacoes_entrada (solicitante_id);
create unique index solicitacoes_uma_pendente_idx
  on public.solicitacoes_entrada (campanha_id, personagem_id) where status = 'pendente';
create index npcs_campanha_idx on public.npcs (campanha_id);
create index entradas_diario_campanha_idx on public.entradas_diario (campanha_id);

create function forja_privado.sincronizar_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.usuarios (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name',
             new.raw_user_meta_data->>'preferred_username', 'Aventureiro'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set username = excluded.username, avatar_url = excluded.avatar_url;
  return new;
end;
$$;

create trigger forja_sincronizar_usuario
after insert or update of raw_user_meta_data on auth.users
for each row execute function forja_privado.sincronizar_usuario();

insert into public.usuarios (id, username, avatar_url)
select id, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name',
                    raw_user_meta_data->>'preferred_username', 'Aventureiro'),
       raw_user_meta_data->>'avatar_url'
from auth.users
on conflict (id) do nothing;

create function forja_privado.gerar_convite()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  loop
    insert into public.convites_campanha (campanha_id, codigo)
    values (new.id, upper(left(replace(gen_random_uuid()::text, '-', ''), 10)))
    on conflict (codigo) do nothing;
    exit when found;
  end loop;
  return new;
end;
$$;

create trigger forja_gerar_convite after insert on public.campanhas
for each row execute function forja_privado.gerar_convite();

-- Estas consultas evitam recursão entre as políticas de campanhas e fichas.
create function forja_privado.eh_mestre(p_campanha_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select from public.campanhas c where c.id = p_campanha_id and c.mestre_id = (select auth.uid())
  );
$$;

create function forja_privado.eh_jogador(p_campanha_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select from public.personagens p where p.campanha_id = p_campanha_id and p.dono_id = (select auth.uid())
  );
$$;

grant execute on function forja_privado.eh_mestre(uuid), forja_privado.eh_jogador(uuid) to authenticated;

alter table public.usuarios enable row level security;
alter table public.campanhas enable row level security;
alter table public.convites_campanha enable row level security;
alter table public.personagens enable row level security;
alter table public.solicitacoes_entrada enable row level security;
alter table public.npcs enable row level security;
alter table public.entradas_diario enable row level security;
alter table public.notas_mestre enable row level security;

revoke all on public.usuarios, public.campanhas, public.convites_campanha, public.personagens,
  public.solicitacoes_entrada, public.npcs, public.entradas_diario, public.notas_mestre
  from public, anon, authenticated;
grant select on public.usuarios, public.campanhas, public.convites_campanha, public.personagens,
  public.solicitacoes_entrada, public.npcs, public.entradas_diario, public.notas_mestre to authenticated;
grant insert (mestre_id, nome, sistema, entrada_aberta, dados),
      update (nome, status, entrada_aberta, dados) on public.campanhas to authenticated;
grant insert (dono_id, campanha_id, nome, sistema, dados),
      update (nome, dados) on public.personagens to authenticated;
grant insert (campanha_id, nome, tipo, aparencia, visivel_jogadores),
      update (nome, tipo, aparencia, visivel_jogadores) on public.npcs to authenticated;
grant insert (campanha_id, titulo, data_sessao, resumo),
      update (titulo, data_sessao, resumo) on public.entradas_diario to authenticated;
grant insert (campanha_id, conteudo), update (campanha_id, conteudo) on public.notas_mestre to authenticated;

create policy usuarios_leitura on public.usuarios for select to authenticated using (true);

create policy campanhas_leitura on public.campanhas for select to authenticated
  using (mestre_id = (select auth.uid()) or forja_privado.eh_jogador(id));
create policy campanhas_criacao on public.campanhas for insert to authenticated
  with check (mestre_id = (select auth.uid()));
create policy campanhas_edicao on public.campanhas for update to authenticated
  using (mestre_id = (select auth.uid())) with check (mestre_id = (select auth.uid()));
create policy convites_leitura on public.convites_campanha for select to authenticated
  using (forja_privado.eh_mestre(campanha_id));

create policy personagens_leitura on public.personagens for select to authenticated
  using (dono_id = (select auth.uid()) or forja_privado.eh_mestre(campanha_id));
create policy personagens_criacao on public.personagens for insert to authenticated
  with check (dono_id = (select auth.uid()) and campanha_id is null);
create policy personagens_edicao on public.personagens for update to authenticated
  using (dono_id = (select auth.uid()) or forja_privado.eh_mestre(campanha_id))
  with check (dono_id = (select auth.uid()) or forja_privado.eh_mestre(campanha_id));

create policy solicitacoes_leitura on public.solicitacoes_entrada for select to authenticated
  using (solicitante_id = (select auth.uid()) or forja_privado.eh_mestre(campanha_id));
create policy npcs_mestre on public.npcs for all to authenticated
  using (forja_privado.eh_mestre(campanha_id)) with check (forja_privado.eh_mestre(campanha_id));
create policy npcs_visiveis on public.npcs for select to authenticated
  using (visivel_jogadores and forja_privado.eh_jogador(campanha_id));
create policy diario_mestre on public.entradas_diario for all to authenticated
  using (forja_privado.eh_mestre(campanha_id)) with check (forja_privado.eh_mestre(campanha_id));
create policy diario_jogador on public.entradas_diario for select to authenticated
  using (forja_privado.eh_jogador(campanha_id));
create policy notas_mestre on public.notas_mestre for all to authenticated
  using (forja_privado.eh_mestre(campanha_id)) with check (forja_privado.eh_mestre(campanha_id));

create function public.buscar_campanha_por_codigo(p_codigo_convite text)
returns table (id uuid, nome text, sistema text, entrada_aberta boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome, c.sistema, c.entrada_aberta
  from public.campanhas c join public.convites_campanha cv on cv.campanha_id = c.id
  where (select auth.uid()) is not null and cv.codigo = upper(btrim(p_codigo_convite));
$$;

create function forja_privado.validar_personagem_entrada(p_id uuid, p_dono_id uuid, p_sistema text)
returns public.personagens language plpgsql set search_path = '' as $$
declare
  ficha public.personagens;
begin
  select * into ficha from public.personagens where id = p_id and dono_id = p_dono_id for update;
  if not found then
    raise exception 'Personagem não encontrado.';
  end if;
  if ficha.campanha_id is not null then
    raise exception 'Este personagem já está em uma campanha.';
  end if;
  if ficha.sistema <> p_sistema then
    raise exception 'O sistema do personagem é diferente do sistema da campanha.';
  end if;
  return ficha;
end;
$$;

create function public.entrar_em_campanha(p_codigo_convite text, p_personagem_id uuid)
returns public.personagens language plpgsql security definer set search_path = '' as $$
declare
  campanha public.campanhas;
  ficha public.personagens;
begin
  select c.* into campanha from public.campanhas c
  join public.convites_campanha cv on cv.campanha_id = c.id
  where cv.codigo = upper(btrim(p_codigo_convite)) for share of c;
  if not found or not campanha.entrada_aberta then
    raise exception 'Campanha não encontrada ou com entrada por aprovação.';
  end if;
  perform forja_privado.validar_personagem_entrada(p_personagem_id, auth.uid(), campanha.sistema);
  update public.personagens set campanha_id = campanha.id where id = p_personagem_id returning * into ficha;
  return ficha;
end;
$$;

create function public.solicitar_entrada_campanha(p_codigo_convite text, p_personagem_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  campanha public.campanhas;
  ficha public.personagens;
begin
  select c.* into campanha from public.campanhas c
  join public.convites_campanha cv on cv.campanha_id = c.id
  where cv.codigo = upper(btrim(p_codigo_convite)) for share of c;
  if not found or campanha.entrada_aberta then
    raise exception 'Campanha não encontrada ou com entrada direta.';
  end if;
  ficha := forja_privado.validar_personagem_entrada(p_personagem_id, auth.uid(), campanha.sistema);
  insert into public.solicitacoes_entrada (campanha_id, personagem_id, solicitante_id, personagem_nome)
  values (campanha.id, ficha.id, ficha.dono_id, ficha.nome)
  on conflict (campanha_id, personagem_id) where status = 'pendente' do nothing;
end;
$$;

create function forja_privado.decidir_solicitacao(p_solicitacao_id uuid, p_aprovar boolean)
returns void language plpgsql set search_path = '' as $$
declare
  pedido public.solicitacoes_entrada;
  sistema_campanha text;
begin
  select * into pedido from public.solicitacoes_entrada
  where id = p_solicitacao_id and status = 'pendente'
    and forja_privado.eh_mestre(campanha_id)
  for update;
  if not found then
    raise exception 'Pedido pendente não encontrado nesta campanha.';
  end if;
  if p_aprovar then
    select sistema into sistema_campanha from public.campanhas where id = pedido.campanha_id;
    perform forja_privado.validar_personagem_entrada(pedido.personagem_id, pedido.solicitante_id, sistema_campanha);
    update public.personagens set campanha_id = pedido.campanha_id where id = pedido.personagem_id;
  end if;
  update public.solicitacoes_entrada set status = case when p_aprovar then 'aprovado' else 'rejeitado' end
  where id = pedido.id;
end;
$$;

create function public.aprovar_solicitacao_entrada(p_solicitacao_id uuid)
returns void language sql security definer set search_path = '' as $$
  select forja_privado.decidir_solicitacao(p_solicitacao_id, true);
$$;

create function public.rejeitar_solicitacao_entrada(p_solicitacao_id uuid)
returns void language sql security definer set search_path = '' as $$
  select forja_privado.decidir_solicitacao(p_solicitacao_id, false);
$$;

create function public.sair_de_campanha(p_personagem_id uuid)
returns public.personagens language plpgsql security definer set search_path = '' as $$
declare
  ficha public.personagens;
begin
  update public.personagens set campanha_id = null
  where id = p_personagem_id and dono_id = (select auth.uid())
  returning * into ficha;
  if not found then
    raise exception 'Personagem não encontrado.';
  end if;
  return ficha;
end;
$$;

create function public.listar_jogadores_campanha(p_campanha_id uuid)
returns table (personagem_id uuid, personagem_nome text, dono_id uuid)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nome, p.dono_id from public.personagens p
  where p.campanha_id = p_campanha_id
    and (forja_privado.eh_mestre(p_campanha_id) or forja_privado.eh_jogador(p_campanha_id))
  order by p.criado_em, p.id;
$$;

revoke execute on all functions in schema forja_privado from public, anon;
revoke execute on function public.buscar_campanha_por_codigo(text), public.entrar_em_campanha(text, uuid),
  public.solicitar_entrada_campanha(text, uuid), public.aprovar_solicitacao_entrada(uuid),
  public.rejeitar_solicitacao_entrada(uuid), public.sair_de_campanha(uuid),
  public.listar_jogadores_campanha(uuid) from public, anon, authenticated;
grant execute on function public.buscar_campanha_por_codigo(text), public.entrar_em_campanha(text, uuid),
  public.solicitar_entrada_campanha(text, uuid), public.aprovar_solicitacao_entrada(uuid),
  public.rejeitar_solicitacao_entrada(uuid), public.sair_de_campanha(uuid),
  public.listar_jogadores_campanha(uuid) to authenticated;

alter publication supabase_realtime add table public.personagens, public.solicitacoes_entrada;

commit;
