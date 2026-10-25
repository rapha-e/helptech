# Arquitetura Antifalhas & Governança Operacional • HelpTech Informática
## Ecossistema de Service Desk & Field Service Inteligente para Escolas do DF (SEEDF)

Este documento consolida a arquitetura antifalhas, a máquina de estados operacionais e os padrões de mercado (ITIL 4 / COBIT) implementados no software.

---

### 1. Diagnóstico dos Fluxos e Soluções Antifalhas Implementadas

| Fluxo Anterior | Risco Operacional | Solução Antifalhas Implementada |
| :--- | :--- | :--- |
| **Acompanhamento Aberto Global** | Violação de sigilo (um gestor via chamados de outras escolas). | **Segregação Estrita (Zero-Leakage):** Consulta local privada e filtro restrito unívoco por WhatsApp do solicitante ou Protocolo. |
| **Despacho Estático Sem Fallback** | Chamado ficava "preso" se o técnico não atendesse ou rejeitasse. | **Despacho com Timeout Regressivo (20m):** Re-despacho automático ao 2º técnico mais próximo por Earthdistance. |
| **Fluxo Linear Inflexível** | Sem suporte a falta de peças ou dependência de concessionárias (ex: Neoenergia, operadoras de fibra). | **Novos Status Operacionais:** `visita_agendada`, `aguardando_peca`, `aguardando_terceiro`, com congelamento auditável de SLA. |
| **Comunicação Cega (Silenciosa)** | O gestor escolar ficava sem saber se o técnico estava a caminho ou quando iria comparecer. | **Motor de Notificações Multicanal + Botão WhatsApp Direto:** O técnico contata a escola em um clique com a OS referenciada. |
| **Encerramento Sem Validação de Campo** | Risco de cobrança de serviços não realizados. | **Cerca Geográfica (Geofencing GPS 1.5km) + Assinatura Digital na Tela do Celular.** |

---

### 2. Matriz de Perfis e Segregação de Responsabilidades (RBAC & RACI)

1. **Gestor Escolar / Solicitante (Direção, Vice-Direção, Secretaria):**
   - Abre chamados em 3 etapas guiadas.
   - Acompanha **exclusivamente os seus chamados** (via WhatsApp ou protocolo).
   - Aprova ou rejeita orçamentos de peças apresentados pelo técnico.
   - Acompanha notificações automáticas e confere a conclusão do serviço presencialmente, assinando a OS digitalmente.

2. **Técnico de Campo (Field Service - PWA Mobile):**
   - Recebe chamados despachados por proximidade geográfica da escola.
   - Cronômetro de 20 minutos para dar Aceite ou Recusar com justificativa formal.
   - Botão direto de WhatsApp para agendar visita e alinhar detalhes com a escola.
   - Check-in por GPS validado por cerca eletrônica (raio máximo de 1.5 km).
   - Lançamento de laudo e orçamento de peças/serviços.
   - Sinalização de estados de espera (`visita_agendada`, `aguardando_peca`, `aguardando_terceiro`).
   - Coleta de assinatura digital na tela do celular e emissão do termo de conformidade.

3. **Controladoria & Gestão HelpTech (Central de Despacho):**
   - Painel Kanban em tempo real com visão consolidada das 14 CREs do DF.
   - Monitoramento de SLAs, chamados em atraso e re-despacho manual de contingência.
   - Homologação de orçamentos e interface com fornecedores e logística de peças.

4. **Gestão SEEDF (Nível Estratégico):**
   - Acompanhamento de relatórios consolidados de conformidade técnica, tempo médio de resposta (MTTR) e auditoria de Ordens de Serviço assinadas.

---

### 3. Ciclo de Vida da Máquina de Estados (State Machine)

1. `aberto` -> Chamado registrado no sistema pela escola. Notificação de confirmação enviada ao WhatsApp do solicitante.
2. `despachado` -> Motor de geolocalização seleciona o técnico mais próximo. Técnico notificado com prazo de 20 min para aceite.
3. `em_deslocamento` -> Técnico aceitou o chamado e está em trânsito.
4. `visita_agendada` -> Técnico alinhou dia e horário futuro com a direção escolar.
5. `em_atendimento` -> Técnico realizou check-in presencial por GPS na escola.
6. `aguardando_orcamento` -> Diagnóstico técnico aponta necessidade de componentes.
7. `aguardando_peca` -> Escola aprovou o orçamento; chamado aguarda envio de peças pela logística central (SLA pausado).
8. `aguardando_terceiro` -> Dependência de concessionária elétrica ou operadora de internet (SLA pausado).
9. `concluido` -> Reparo concluído, atestado e assinado na tela pelo responsável escolar.
10. `cancelado` -> Chamado encerrado por motivo formal justificado.

---

### 4. Pilares de Engenharia Antifalhas Adotados

- **Idempotência Operacional:** Chaves únicas e persistência de rascunhos para evitar chamados duplicados.
- **Failover Automático no Despacho:** Algoritmo round-robin geoespacial ordenado pela menor distância de rota.
- **Auditoria Imutável (Event Sourcing):** Cada mudança de estado gera um registro com autor, data/hora e justificativa.
- **Transparência Reativa:** O usuário recebe notificações em cada marco crítico da ordem de serviço.
