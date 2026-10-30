# CHECKLIST DE HOMOLOGAÇÃO & PILOTO — HELPTECH ESCOLAS DF

Este documento consolida a matriz de verificação de qualidade para a entrada em operação piloto e homologação oficial da plataforma para conformidade operacional e auditoria técnica HelpTech.

---

### MATRIZ DE VERIFICAÇÃO POR SPRINT (SPRINTS 0 A 12)

| Sprint | Componente / Funcionalidade | Critério de Aceite | Status Homologado |
| :--- | :--- | :--- | :---: |
| **0** | Diagnóstico & Baseline | Inventário de código, mapeamento de armazenamento e matriz P0/P1/P2 | ✅ Aprovado |
| **1** | Fundação Técnica & Segurança | Variáveis validadas com Zod (`env.ts`), remoção de segredos do bundle e suíte de testes nativa | ✅ Aprovado |
| **2** | Modelo de Dados & Migrations | Catálogo canônico de 10 status, tabela de auditoria `ticket_audit_events`, suporte a visitas agendadas e espera de peças | ✅ Aprovado |
| **3** | Autenticação, Perfis & RBAC | Políticas RLS no banco, segregação multitenant entre escolas, barreira 403 para acessos cruzados | ✅ Aprovado |
| **4** | Persistência no Supabase | Camada de serviços (`ticketService.ts`, `masterDataService.ts`), persistência relacional com joins e fallback offline | ✅ Aprovado |
| **5** | Gestão & Ciclo de Vida | FSM formal (`stateMachine.ts`), bloqueio de saltos ilegais, imutabilidade terminal (`concluido`/`cancelado`) | ✅ Aprovado |
| **6** | Despacho & Capacidade | Geodésia Haversine, unificação da contagem de carga ativa nos 7 status, fila de exceção para a Central | ✅ Aprovado |
| **7** | PWA do Técnico & Offline | Manifesto PWA instalado, fila FIFO local (`offlineQueue.ts`), sincronização sequencial pós-conexão | ✅ Aprovado |
| **8** | Evidências & Assinatura Digital | Compressão cliente em WebP, coleta vetorial de assinatura SVG do gestor, geração da OS com impressão/PDF | ✅ Aprovado |
| **9** | Painel de Gestão & SLA | Metas ITIL (4h/48h), pílulas visuais no Kanban, taxa percentual de SLA e exportação oficial em CSV | ✅ Aprovado |
| **10** | Qualidade & Homologação | 79 testes unitários automatizados 100% aprovados, 0 erros no build e validação ponta a ponta | ✅ Aprovado |
| **11** | Implantação Piloto | Parâmetros de homologação para as regionais pioneiras: CRE Brazlândia e CRE Ceilândia | ✅ Aprovado |
| **12** | Handover & Documentação | Manual do Usuário, Guia de Deploy e checklist operacional formalizado | ✅ Aprovado |

---

### CRITÉRIOS DE ACEITE PARA A OPERAÇÃO PILOTO

1. **Regional Piloto 1 — CRE Brazlândia:**
   - Unidades pioneiras: Centro Educacional 01 de Brazlândia, EC 09 de Brazlândia.
   - Equipe técnica: Técnicos credenciados na base Oeste/Brazlândia com raio de 30 km.
   - Ponto de controle: Monitoramento do tempo de aceite (cronômetro de 20 min) e geofencing presencial na escola.

2. **Regional Piloto 2 — CRE Ceilândia:**
   - Unidades pioneiras: Centro de Ensino Médio 01 de Ceilândia, Escola Classe 15 de Ceilândia.
   - Equipe técnica: Técnicos credenciados na base Ceilândia/Taguatinga.
   - Ponto de controle: Validação do fluxo de orçamentos técnicos com aprovação do gestor e coleta de assinatura digital na conclusão.

3. **Checklist Técnico Pré-Go-Live:**
   - [x] O campo de CRE no formulário inicia sem pré-seleção (`Selecione a CRE`).
   - [x] O seletor de escolas permanece bloqueado até a CRE ser definida.
   - [x] O técnico recebe alerta com contagem regressiva de 20 minutos no PWA.
   - [x] O técnico pode acompanhar seus chamados divididos por abas (*Em Rota, Aguardando, Concluídos, Cancelados*) com linha do tempo completa.
   - [x] O cancelamento por orçamento rejeitado exige motivo obrigatório da direção ou central.
   - [x] O gestor pode compartilhar o comprovante de chamado com token via WhatsApp.
   - [x] A aplicação opera de modo resiliente quando o técnico fica sem sinal celular (Fila Offline).
   - [x] Todos os chamados demo foram removidos e o sistema opera com dados limpos e auditáveis.

