# GUIA DE IMPLANTAÇÃO E DEPLOY — HELPTECH ESCOLAS DF

Este guia detalha o passo a passo para configuração de infraestrutura, execução de migrations, políticas de segurança e publicação do sistema em ambiente de Homologação (Staging) e Produção.

---

### 1. ARQUITETURA DE INFRAESTRUTURA

- **Frontend:** Single Page Application (SPA) e Progressive Web App (PWA) construído com **React 19 + TypeScript + Vite**.
- **Backend / BaaS:** **Supabase (PostgreSQL 16)** com extensões `uuid-ossp`, `cube` e `earthdistance` para geodésia esférica.
- **Storage:** Supabase Storage Bucket com políticas de leitura pública para anexos de evidências (`ticket-attachments`).
- **Segurança:** Row Level Security (RLS) habilitado em 100% das tabelas operacionais, com segregação por escola e técnico.

---

### 2. VARIÁVEIS DE AMBIENTE (.env)

Crie o arquivo `.env` na raiz do projeto com base no arquivo `.env.example`:

```bash
# URL do projeto Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co

# Chave pública anônima (segura para exposição no cliente com RLS ativado)
# NUNCA insira a service_role_key aqui!
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Ambiente de execução ('development' | 'staging' | 'production')
VITE_APP_ENV=production
```

> **Aviso de Segurança:** O módulo `src/lib/env.ts` valida estas variáveis em tempo de execução via Zod. Se uma chave for inválida ou vazia, o sistema interrompe a execução com um erro explícito para evitar falhas silenciosas.

---

### 3. BANCO DE DADOS SUPABASE (MIGRATIONS SQL)

Acesse o **SQL Editor** do seu painel Supabase e execute as migrations versionadas na ordem numérica:

1. `supabase/migrations/20261028000001_core_schema.sql`:
   - Criação das tabelas centrais: `regional_coordinations`, `schools`, `technicians`, `ticket_categories`, `tickets`, `ticket_quotes`, `ticket_completions`, `ticket_attachments` e `ticket_dispatch_logs`.
   - Extensões geográficas `cube` e `earthdistance`.
2. `supabase/migrations/20261028000002_status_normalization_and_audit.sql`:
   - Normalização dos 10 status canônicos com a adição de `visita_agendada` e `aguardando_terceiro`.
   - Criação da tabela de auditoria imutável `ticket_audit_events` e da tabela de perfis `system_users`.
3. `supabase/migrations/20261028000003_dispatch_engine_update.sql`:
   - Atualização da função PL/pgSQL `get_best_candidate_technician` com a contagem unificada dos 7 status operacionais de campo.
4. `supabase/migrations/20261028000004_rls_policies.sql`:
   - Habilitação obrigatória de RLS em todas as tabelas.
   - Criação das políticas de isolamento multitenant para Escolas, Técnicos e Administradores.

*(Alternativamente, o arquivo consolidado `supabase/schema.sql` (v2.1 Master) contém o DDL completo pronto para execução única em bancos novos).*

---

### 4. CONFIGURAÇÃO DO SUPABASE STORAGE

1. No menu lateral do Supabase, clique em **Storage** -> **New Bucket**.
2. Nomeie o bucket como: `ticket-attachments`.
3. Marque a opção **Public Bucket** (leitura pública via URL com hash do protocolo).
4. Tamanho máximo por arquivo: `10MB`.
5. Tipos MIME aceitos: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `application/pdf`.

---

### 5. VALIDAÇÃO LOCAL PRÉ-DEPLOY

Antes de enviar para produção, execute os comandos de validação automatizada:

```bash
# Executa linter (oxlint), verificação de tipos (tsc) e suíte com 39 testes unitários
npm run validate
```

Critério de Aceite:
- `oxlint`: 0 erros.
- `tsc -b && vite build`: Compilação de assets em `dist/` gerada com sucesso.
- `node --test tests/*.test.mjs`: **39 testes aprovados (0 falhas)**.

---

### 6. DEPLOY EM PRODUÇÃO (VERCEL / NETLIFY / CLOUD RUN)

#### 6.1 Deploy na Vercel:
1. Conecte o repositório Git ao painel da Vercel.
2. Defina os parâmetros de build:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Adicione as variáveis de ambiente em **Settings > Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_ENV` = `production`
4. Clique em **Deploy**.

#### 6.2 Deploy no Netlify:
1. Crie um arquivo `netlify.toml` na raiz ou configure via interface:
   ```toml
   [build]
     command = "npm run build"
     publish = "dist"

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```
2. Configure as variáveis de ambiente e publique.

