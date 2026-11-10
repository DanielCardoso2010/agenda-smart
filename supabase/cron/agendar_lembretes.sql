-- Agenda a Edge Function 'enviar-lembretes' a cada 5 minutos. NÃO é uma migração automática:
-- rode manualmente no SQL Editor DEPOIS de (1) aplicar a migração 0002, (2) publicar a função e
-- (3) cadastrar os segredos da função (CRON_SECRET, RESEND_API_KEY, MAIL_FROM).
-- Troque COLE_AQUI_O_MESMO_CRON_SECRET pelo mesmo valor do segredo CRON_SECRET da função. Não commite o valor.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('COLE_AQUI_O_MESMO_CRON_SECRET', 'cron_secret_lembretes', 'Autoriza o pg_cron na função enviar-lembretes');

select cron.schedule(
  'enviar-lembretes',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url     := 'https://mkgdhpdioxrifjdisnpg.supabase.co/functions/v1/enviar-lembretes',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret_lembretes')
    ),
    body    := '{}'::jsonb
  );
  $job$
);
-- Para desligar:  select cron.unschedule('enviar-lembretes');
