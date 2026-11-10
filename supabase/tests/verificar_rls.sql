-- VERIFICAÇÃO de permissões/RLS/gatilhos. A migração 0002 já deve estar aplicada.
-- Seguro por construção: o bloco termina SEMPRE com RAISE EXCEPTION (o relatório aparece na mensagem de erro),
-- o que desfaz tudo, inclusive os usuários e dados de teste. Nada fica gravado.
-- Execute manualmente no SQL Editor de um ambiente de teste. Cada linha do relatório deve dizer "ok".
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  r text := E'\n'; n int; c1 uuid; ini timestamptz := now() + interval '3 hours';
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (u1,'authenticated','authenticated','t1@teste.local','{"name":"Teste Um"}'),
    (u2,'authenticated','authenticated','t2@teste.local','{"name":"Teste Dois"}');
  r := r || 'T01 cadastro cria perfil e preferencias: ' || case when (select count(*) from public.perfis where id in (u1,u2))=2 and (select count(*) from public.preferencias where user_id in (u1,u2))=2 then 'ok' else 'FALHOU' end || E'\n';
  insert into public.compromissos (user_id,titulo,inicio) values (u2,'do usuario 2',ini);

  perform set_config('request.jwt.claims', json_build_object('sub',u1,'role','authenticated')::text, true);
  set local role authenticated;

  begin insert into public.compromissos (titulo,inicio,lembrete_min,categoria) values ('meu',ini,60,'Saúde') returning id into c1;
    r := r || 'T02 usuario insere sem informar user_id: ok' || E'\n';
  exception when others then r := r || 'T02 FALHOU: '||sqlerrm||E'\n'; end;

  begin insert into public.compromissos (user_id,titulo,inicio) values (u2,'intruso',ini);
    r := r || 'T03 FALHOU: gravou em nome de outro usuario' || E'\n';
  exception when others then r := r || 'T03 bloqueia gravar em nome de outro (ok, '||sqlstate||')'||E'\n'; end;

  select count(*) into n from public.compromissos;
  r := r || 'T04 usuario enxerga so os proprios (esperado 1, veio '||n||'): '||case when n=1 then 'ok' else 'FALHOU' end||E'\n';

  update public.compromissos set titulo='x' where user_id=u2; get diagnostics n = row_count;
  r := r || 'T05 nao altera linha de outro (linhas afetadas '||n||'): '||case when n=0 then 'ok' else 'FALHOU' end||E'\n';

  begin perform erro from public.lembretes;
    r := r || 'T06 FALHOU: usuario leu a coluna erro de lembretes' || E'\n';
  exception when others then r := r || 'T06 coluna erro/resend_id de lembretes protegida (ok)'||E'\n'; end;
  begin truncate public.compromissos; r := r || 'T07 FALHOU: TRUNCATE permitido'||E'\n';
  exception when others then r := r || 'T07 TRUNCATE bloqueado (ok)'||E'\n'; end;

  begin insert into public.compromissos (titulo,inicio,categoria) values ('c',ini,'Invalida'); r := r||'T08 FALHOU: categoria invalida aceita'||E'\n';
  exception when others then r := r||'T08 categoria invalida recusada (ok)'||E'\n'; end;
  begin insert into public.compromissos (titulo,inicio,fim) values ('c',ini,ini - interval '1 hour'); r := r||'T09 FALHOU: fim antes do inicio aceito'||E'\n';
  exception when others then r := r||'T09 fim antes do inicio recusado (ok)'||E'\n'; end;

  begin update public.perfis set nome='Novo Nome' where id=u1; r := r||'T10 usuario edita o proprio nome: ok'||E'\n';
  exception when others then r := r||'T10 FALHOU: '||sqlerrm||E'\n'; end;
  begin update public.perfis set email='outro@x.com' where id=u1; r := r||'T11 FALHOU: usuario alterou e-mail do perfil'||E'\n';
  exception when others then r := r||'T11 e-mail do perfil nao editavel (ok)'||E'\n'; end;
  begin update public.preferencias set antecedencias_minutos='{45}' where user_id=u1; r := r||'T12 FALHOU: antecedencia invalida aceita'||E'\n';
  exception when others then r := r||'T12 antecedencia invalida recusada (ok)'||E'\n'; end;
  update public.preferencias set email_ativo=false where user_id=u1; get diagnostics n = row_count;
  r := r || 'T13 usuario edita as proprias preferencias (linhas '||n||'): '||case when n=1 then 'ok' else 'FALHOU' end||E'\n';

  reset role;
  set local role anon;
  begin perform 1 from public.compromissos; r := r||'T14 FALHOU: anon leu compromissos'||E'\n';
  exception when others then r := r||'T14 anon sem acesso (ok)'||E'\n'; end;
  reset role;

  select count(*) into n from public.lembretes where compromisso_id=c1 and status='pendente' and horario_envio = ini - interval '60 minutes';
  r := r || 'T15 gatilho criou 1 lembrete pendente 60 min antes: '||case when n=1 then 'ok' else 'FALHOU ('||n||')' end||E'\n';
  update public.compromissos set inicio = ini + interval '1 hour' where id=c1;
  select count(*) into n from public.lembretes where compromisso_id=c1 and status='pendente' and horario_envio = ini;
  r := r || 'T16 remarcar substitui o lembrete (sem duplicar): '||case when n=1 and (select count(*) from public.lembretes where compromisso_id=c1)=1 then 'ok' else 'FALHOU' end||E'\n';
  update public.compromissos set status='cancelado' where id=c1;
  select count(*) into n from public.lembretes where compromisso_id=c1;
  r := r || 'T17 cancelar remove o lembrete pendente: '||case when n=0 then 'ok' else 'FALHOU' end||E'\n';
  update public.compromissos set status='pendente', lembrete_min=0 where id=c1;
  select count(*) into n from public.lembretes where compromisso_id=c1;
  r := r || 'T18 sem lembrete_min nao cria lembrete: '||case when n=0 then 'ok' else 'FALHOU' end||E'\n';
  update public.compromissos set lembrete_min=30 where id=c1;
  delete from public.compromissos where id=c1;
  select count(*) into n from public.lembretes where compromisso_id=c1;
  r := r || 'T19 excluir compromisso nao deixa lembrete orfao (cascata): '||case when n=0 then 'ok' else 'FALHOU' end||E'\n';

  insert into public.compromissos (user_id,titulo,inicio) select u2,'lote '||g,ini from generate_series(1,1999) g;
  perform set_config('request.jwt.claims', json_build_object('sub',u2,'role','authenticated')::text, true);
  set local role authenticated;
  begin insert into public.compromissos (titulo,inicio) values ('estoura',ini); r := r||'T20 FALHOU: passou do limite de 2000'||E'\n';
  exception when others then r := r||'T20 limite de 2000 compromissos por usuario (ok)'||E'\n'; end;
  reset role;

  raise exception 'RELATORIO (tudo foi desfeito):%', r;
end $$;
