# Agenda Smart

Aplicação web de agenda de compromissos com autenticação, banco de dados e lembretes por e-mail usando **Supabase**. O frontend é estático e pode ser hospedado no **GitHub Pages**.

## Arquitetura atual

- **Supabase Auth:** cadastro, confirmação de e-mail, login, logout e recuperação/redefinição de senha.
- **Supabase Database (PostgreSQL):** `perfis`, `compromissos`, `preferencias` e `lembretes`.
- **RLS:** políticas por usuário; cada pessoa só acessa seus próprios dados.
- **Supabase Edge Function:** `enviar-lembretes`, já publicada no projeto.
- **Resend:** entrega dos lembretes por e-mail (requer chave e remetente configurados).
- **GitHub Pages:** hospeda somente os arquivos do frontend; banco, autenticação e envio ficam no Supabase.

O navegador usa apenas a chave **publishable** em `js/supabaseClient.js`. Nunca coloque `service_role`, `sb_secret`, `CRON_SECRET` ou `RESEND_API_KEY` no código do site ou no GitHub.

## Configuração do Supabase

O frontend está apontado para o projeto `mkgdhpdioxrifjdisnpg` (`https://mkgdhpdioxrifjdisnpg.supabase.co`). Se usar outro projeto, atualize a URL e a chave publishable em `js/supabaseClient.js`.

No painel Supabase:

1. Em **Authentication → URL Configuration**, defina a Site URL para o endereço publicado e inclua nas Redirect URLs:
   - `http://localhost:5500/**`
   - `https://SEU-USUARIO.github.io/agenda-smart/**`
2. Em **Authentication → Providers → Email**, configure se a confirmação de e-mail será obrigatória.
3. Para uso real, configure SMTP próprio em **Authentication → SMTP**. O envio padrão do Supabase é limitado para testes.
4. A estrutura SQL e as políticas RLS estão representadas em `supabase/migrations/`. A migração `0002_ajustes_painel_permissoes_colunas_lembretes.sql` já foi aplicada no projeto conectado.

## Publicar no GitHub Pages

1. Crie um repositório público chamado `agenda-smart` (ou ajuste o caminho nas Redirect URLs se escolher outro nome).
2. Envie **o conteúdo desta pasta** para a raiz do repositório — `index.html`, `login.html`, `dashboard.html`, `css/`, `js/`, `assets/` e `supabase/`.
3. No GitHub, abra **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**, branch `main` e pasta `/ (root)`; salve.
5. Aguarde a publicação e teste `https://SEU-USUARIO.github.io/agenda-smart/`.
6. Volte ao Supabase e confira se o endereço publicado está cadastrado nas Redirect URLs.

O arquivo `.nojekyll` evita que o GitHub Pages aplique processamento Jekyll ao projeto.

## Rodar localmente

Na pasta do projeto, inicie um servidor HTTP (não abra os HTML diretamente como `file://`):

```bash
python3 -m http.server 5500
```

Abra `http://localhost:5500`.

## Lembretes automáticos por e-mail

A Edge Function `enviar-lembretes` já existe no projeto Supabase e usa `supabase/functions/enviar-lembretes/` como fonte versionada. Para ativar o envio automático:

1. Crie/valide sua conta no Resend e configure um domínio remetente verificado. O remetente de teste `onboarding@resend.dev` só entrega para o endereço autorizado da conta Resend.
2. Em **Supabase → Edge Functions → Secrets**, configure `CRON_SECRET`, `RESEND_API_KEY` e `MAIL_FROM`. A função usa também a chave administrativa do Supabase somente no servidor (`SUPABASE_SECRET_KEYS`/`SUPABASE_SERVICE_ROLE_KEY`, conforme a configuração do projeto); nunca exponha essa chave no navegador.
3. Habilite as extensões `pg_cron` e `pg_net` no Supabase e configure o segredo no Vault.
4. Revise e execute `supabase/cron/agendar_lembretes.sql` no SQL Editor, substituindo o marcador pelo mesmo `CRON_SECRET` configurado na função. Não faça commit desse valor.
5. Confirme em **Database → Cron Jobs** que `enviar-lembretes` está agendado para cada 5 minutos e monitore os logs da Edge Function.

**Atenção:** no momento da revisão, a Edge Function estava publicada, mas `pg_cron`/`pg_net` não estavam habilitados e o Vault não tinha o segredo do agendamento. Portanto, lembretes automáticos ainda precisam dessa configuração para funcionar.

## Estrutura

- `index.html`, `login.html`, `dashboard.html`: páginas do site.
- `css/style.css`: estilos.
- `js/supabaseClient.js`: conexão pública com Supabase.
- `js/auth.js`: autenticação.
- `js/dados.js`: acesso aos dados.
- `js/dashboard.js`: interface e calendário.
- `supabase/migrations/`: histórico SQL.
- `supabase/functions/enviar-lembretes/`: código da função de e-mail.
- `supabase/cron/`: agendamento do envio.
- `supabase/tests/`: script de verificação de RLS e gatilhos.
