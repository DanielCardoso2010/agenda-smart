-- 0002 — Ajustes sobre o esquema JÁ EXISTENTE (perfis, compromissos, preferencias, lembretes).
-- Estado verificado em 2026-11-09: tabelas vazias (0 usuários), RLS ligada, políticas por usuário já criadas.
-- Atômica: se qualquer comando falhar, nada é gravado.

-- 1) Permissões mínimas para a Data API.
--    Antes: anon/authenticated SEM SELECT/INSERT/UPDATE/DELETE (o painel receberia "permission denied")
--    e COM TRUNCATE/REFERENCES/TRIGGER sobrando.
revoke all on public.perfis, public.compromissos, public.preferencias, public.lembretes from anon, authenticated;
grant select on public.perfis to authenticated;
grant update (nome) on public.perfis to authenticated;                       -- e-mail não é editável pelo cliente
grant select, insert, update, delete on public.compromissos to authenticated;
grant select, insert, update on public.preferencias to authenticated;
-- lembretes: usuário só enxerga colunas seguras (sem erro/resend_id); quem escreve é o banco/backend
grant select (id, compromisso_id, antecedencia_minutos, horario_envio, status, enviado_em) on public.lembretes to authenticated;

-- 2) compromissos: campos que o painel usa + validações
alter table public.compromissos alter column user_id set default auth.uid();
alter table public.compromissos
  add column categoria text not null default 'Estudos',
  add column prioridade text not null default 'Média',
  add column lembrete_min integer not null default 0,
  add constraint compromissos_categoria_check check (categoria in ('Estudos','Trabalho','Pessoal','Saúde','Outros')),
  add constraint compromissos_prioridade_check check (prioridade in ('Baixa','Média','Alta')),
  add constraint compromissos_lembrete_min_check check (lembrete_min in (0,30,60,1440)),
  add constraint compromissos_titulo_tamanho check (char_length(btrim(titulo)) between 1 and 100),
  add constraint compromissos_descricao_tamanho check (char_length(coalesce(descricao,'')) <= 500);

-- 3) limite por usuário (evita abuso de cota/armazenamento)
create function public.limitar_compromissos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.compromissos where user_id = new.user_id) >= 2000 then
    raise exception 'Limite de 2000 compromissos por usuário atingido.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger compromissos_limite
before insert on public.compromissos
for each row execute function public.limitar_compromissos();

-- 4) lembretes derivados do compromisso: 1 lembrete pendente por compromisso pendente com lembrete_min > 0.
--    Se o horário do lembrete já passou mas o compromisso ainda não começou, o lembrete é criado e sai no próximo ciclo.
create function public.sincronizar_lembretes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.lembretes where compromisso_id = new.id and status = 'pendente';
  if new.status = 'pendente' and new.lembrete_min > 0 and new.inicio > now() then
    insert into public.lembretes (user_id, compromisso_id, antecedencia_minutos, horario_envio)
    values (new.user_id, new.id, new.lembrete_min, new.inicio - make_interval(mins => new.lembrete_min))
    on conflict (compromisso_id, antecedencia_minutos, horario_envio) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.sincronizar_lembretes() from public, anon, authenticated;
create trigger compromissos_sincroniza_lembretes
after insert or update of inicio, status, lembrete_min on public.compromissos
for each row execute function public.sincronizar_lembretes();

-- 5) endurecimento: função existente sem search_path fixo
alter function public.atualizar_updated_at() set search_path = '';

-- 6) funções internas: não podem ser invocadas como RPC por clientes anon/authenticated.
-- Os triggers continuam executando suas funções normalmente.
revoke execute on function public.criar_perfil_usuario() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
