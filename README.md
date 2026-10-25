# HelpTech Escolas DF • Service Desk & Field Service v2.0 (Master Release)

Plataforma integrada de Service Desk, Despacho Inteligente Georreferenciado e Governança de TI para as unidades de ensino da rede pública do Distrito Federal (**SEEDF**), cobrindo as **15 Regionais de Ensino (CREs)** e o catálogo de escolas oficiais.

---

## 🏛️ 1. Interfaces e Papéis de Acesso (RBAC)

O sistema conta com seletor de perfis no topo para navegação fluida entre os 3 atores principais:

### 1.1 Portal do Gestor Escolar (`ROLE_SCHOOL_USER`)
* **Sem necessidade de login com senha** para abertura rápida de chamados.
* **Wizard Guiado em 3 Etapas:**
  1. *Escola & Contato:* Seleção com busca instantânea por nome, CRE ou código INEP, dados do gestor e telefone WhatsApp.
  2. *Defeito & Matriz de SLA:* Categoria do defeito, nível de urgência (Baixa, Média, Alta, Crítica) e patrimônio SEEDF.
  3. *Evidências com WebP:* Upload de fotos com compressão client-side via Canvas API para economia de franquia móvel.
* **Resiliência Offline:** Rascunho salvo continuamente no `localStorage` contra quedas de sinal em sala de aula.
* **Acompanhamento Transparente:** Consulta por protocolo (`OS-2026-XXXXX`) ou `tracking_token`, aprovação/rejeição de orçamentos e visualização da OS oficial.

### 1.2 PWA Técnico de Atendimento em Campo (`ROLE_FIELD_TECH`)
* **Mobile-First Responsivo:** Projetado para uso em smartphones com conectividade 4G/5G.
* **Alerta com Timeout de 20 Minutos:** Contagem regressiva em tempo real com barra de progresso. Se o técnico não aceitar, a vaga é re-despachada automaticamente para o próximo técnico mais próximo.
* **Check-in GPS:** Validação presencial por proximidade geográfica da unidade escolar.
* **Diagnóstico & Orçamento de Peças:** Lançamento de laudo, peças e serviços com cálculo automático de subtotais e envio direto para o gestor escolar.
* **Assinatura Digital Vetorial em Tela:** Coleta do traçado da assinatura do diretor em tempo real via Canvas API e serialização em SVG limpo.

### 1.3 Dashboard Central & Controladoria (`ROLE_CENTRAL_ADMIN`)
* **Visão Kanban Multi-CRE:** Organização de chamados por colunas de status (Aberto, Despachado, Em Deslocamento/Campo, Orçamento & Peças, Concluído).
* **Filtros Dinâmicos:** Filtro por CRE (15 Regionais) e por nível de urgência.
* **Triagem Manual de Exceção:** Despacho manual para casos de limite de capacidade ou indisponibilidade de técnicos.
* **Prestação de Contas:** Auditoria de valores de peças e serviços aplicados por chamado e por CRE.
* **Simulador de Despacho Geoespacial:** Teste em tempo real do algoritmo de cálculo euclidiano/Haversine e balanceamento de carga.
* **Visualizador Supabase DDL:** Acesso ao schema SQL completo com download integrado.

---

## 🛠️ 2. Topologia & Banco de Dados (PostgreSQL 16 / Supabase)

O script completo DDL está localizado em [`supabase/schema.sql`](file:///c:/Users/rapha/Documents/HELPTECHINFO/supabase/schema.sql), contendo:
* Extensões: `uuid-ossp`, `cube` e `earthdistance`.
* Tabelas: `regional_coordinations`, `schools`, `technicians`, `ticket_categories`, `tickets`, `ticket_dispatch_logs`, `ticket_attachments`, `ticket_quotes`, `ticket_quote_items`, `ticket_completions`.
* Função SQL `get_best_candidate_technician(p_school_lat, p_school_lng, p_excluded_techs)`.
* Seeds oficiais das 15 CREs e Unidades Escolares do DF.

---

## 🚀 3. Como Executar Localmente

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento
npm run dev

# 3. Compilar bundle de produção
npm run build
```

A aplicação estará disponível em `http://localhost:5173/`.
