# Cadastro de Advogados — Dia da Eleição

Plataforma para a Coordenação Jurídica cadastrar advogados de apoio jurídico
(não fiscais nem delegados de partido) designados a cada município da
Paraíba no dia da eleição.

- **Frontend**: site estático (`public/`), sem build step, hospedado no Netlify.
- **Backend**: Supabase (Postgres + Auth + Storage).
- **Exportação**: Netlify Function gera `.xlsx` sob demanda, restrita ao admin autenticado.
- **Integração opcional**: outra Netlify Function grava a planilha exportada numa pasta do Google Drive.

## Estrutura

```
public/                     site estático (publicado no Netlify)
  index.html                formulário público de cadastro
  js/form.js                lógica do formulário (validação, upload, insert)
  js/config.js               ⚠️ criar a partir de config.example.js (não versionar)
  admin/
    index.html               login do coordenador jurídico
    dashboard.html            listagem, filtros, status, exportação
netlify/functions/
  export-xlsx.js              gera e devolve o .xlsx (admin autenticado)
  sync-drive.js                grava a planilha no Google Drive (opcional)
supabase/
  001_schema.sql               tabelas + trigger de zona eleitoral automática
  002_rls_policies.sql         políticas de RLS
  003_storage.sql              bucket privado da carteira da OAB
  004_seed_municipios_zonas.sql  os 223 municípios da PB e suas zonas eleitorais
```

## 1. Origem dos dados município → zona eleitoral

A tabela `municipios_zonas` (arquivo `004_seed_municipios_zonas.sql`) foi
populada a partir do documento **"Todos os Municípios da Paraíba — Zona,
Advogado e Telefone"**, elaborado pela própria Coordenação Jurídica em
07/09/2026 com base na relação oficial do TRE-PB (com checagem cruzada na
planilha da Operação Voto Seguro da PMPB). Os 223 nomes de município foram
conferidos contra a lista oficial do IBGE.

**Atenção:** o município **Natuba** está com zona em branco — a fonte
consultada não localizou a zona eleitoral desse município. Antes do dia da
eleição, confirme com o TRE-PB e atualize:

```sql
update public.municipios_zonas set zonas = array['NN'] where municipio = 'Natuba';
```

Se novos municípios de apoio, correções de zona ou desmembramentos
aparecerem depois, edite a tabela diretamente pelo SQL Editor do Supabase
(ou pelo próprio dashboard admin, que tem permissão de leitura/gestão dessa
tabela para o usuário autenticado).

## 2. Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode nesta ordem:
   - `supabase/001_schema.sql`
   - `supabase/002_rls_policies.sql`
   - `supabase/003_storage.sql`
   - `supabase/004_seed_municipios_zonas.sql`
3. Em **Authentication → Providers**, mantenha **Email** habilitado.
4. Em **Authentication → Settings**, **desative "Allow new users to sign
   up"** — o acesso ao dashboard deve ficar restrito a um único usuário,
   criado manualmente no passo seguinte.
5. Em **Authentication → Users → Add user**, crie a conta da Coordenação
   Jurídica (e-mail + senha). Esse é o único login do dashboard admin.
6. Em **Project Settings → API**, anote:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY` (vai no frontend, é uma chave pública)
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ secreta, só nas Netlify Functions)

## 3. Configurar o frontend

```bash
cp public/js/config.example.js public/js/config.js
```

Edite `public/js/config.js` com `SUPABASE_URL` e `SUPABASE_ANON_KEY`. Esse
arquivo é seguro para publicar (a chave `anon` é pública por design — a
segurança vem das políticas de RLS), mas fica fora do git por padrão
(`.gitignore`) para evitar acoplar o repositório a um projeto Supabase
específico.

## 4. Deploy no Netlify

### Opção A — via CLI

```bash
npm install
npx netlify-cli deploy --prod
```

Quando perguntado, aponte o **publish directory** para `public` e o
**functions directory** para `netlify/functions` (já configurado em
`netlify.toml`, então o CLI deve detectar automaticamente).

### Opção B — via GitHub + painel do Netlify

1. Suba este repositório para o GitHub.
2. No painel do Netlify, **Add new site → Import an existing project**.
3. Build command: (nenhum) · Publish directory: `public` · Functions directory: `netlify/functions`.
4. Em **Site configuration → Environment variables**, adicione (ver `.env.example`):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - (opcional) `GOOGLE_SERVICE_ACCOUNT_JSON`
   - (opcional) `GOOGLE_DRIVE_FOLDER_ID`
5. Deploy.

O formulário público fica em `/` e o dashboard em `/admin/`.

## 5. Integração opcional com Google Drive

1. No [Google Cloud Console](https://console.cloud.google.com/), crie um
   projeto (ou use um existente) e ative a **Google Drive API**.
2. Crie uma **conta de serviço** (IAM & Admin → Service Accounts) e gere
   uma **chave JSON**.
3. No Google Drive, crie/escolha a pasta de destino e **compartilhe-a**
   com o e-mail da conta de serviço (campo `client_email` do JSON),
   permissão de **Editor**.
4. Copie o ID da pasta (parte final da URL, depois de `/folders/`).
5. No Netlify, defina as variáveis de ambiente:
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: o conteúdo do JSON, colado em uma linha só.
   - `GOOGLE_DRIVE_FOLDER_ID`: o ID copiado no passo anterior.
6. No dashboard admin, o botão **"☁ Salvar no Drive"** passa a funcionar
   (se as variáveis não estiverem definidas, o botão avisa que a
   integração não está configurada — a exportação normal em Excel
   continua funcionando independentemente disso).

## 6. Segurança e privacidade — resumo do que já está implementado

- CPF e demais dados sensíveis só são legíveis por quem está autenticado
  como admin (política de RLS `advogados: leitura restrita ao admin`);
  o formulário público só tem permissão de `INSERT`.
- O bucket `oab-documentos` é **privado**; o upload anônimo só pode gravar
  dentro de `pendentes/` e não pode ler/listar; a leitura (inclusive para
  gerar o link temporário de visualização usado no dashboard) exige sessão
  autenticada.
- A zona eleitoral é **preenchida pelo banco** (trigger `security definer`
  em `001_schema.sql`), não pelo que o navegador do advogado envia —
  evita que alguém manipule esse campo no cliente.
- A exportação em Excel roda só dentro da Netlify Function
  `export-xlsx.js`, que exige um token de sessão válido do Supabase Auth
  antes de usar a `service_role key` — essa chave nunca chega ao navegador.
- Cadastro público (self-signup) deve permanecer **desativado** no
  Supabase Auth, para que "usuário autenticado" continue significando
  "a Coordenação Jurídica".

## 7. Rodando localmente

```bash
npm install
npx netlify-cli dev
```

O Netlify CLI serve `public/` e as functions juntos (necessário para o
dashboard chamar `/.netlify/functions/export-xlsx` localmente). Crie um
`.env` local (baseado em `.env.example`) para as variáveis das functions.
