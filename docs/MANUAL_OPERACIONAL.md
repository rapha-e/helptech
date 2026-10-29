# MANUAL OPERACIONAL — HELPTECH ESCOLAS DF
## Plataforma de Service Desk & Field Service Inteligente (v2.0 Master)

Este manual descreve o fluxo de trabalho operacional e as melhores práticas para os 3 perfis de acesso ao sistema: **Gestor Escolar**, **Técnico de Campo (PWA)** e **Central de Operações / Controladoria**.

---

### 1. PERFIL: GESTOR ESCOLAR (Autoatendimento das Unidades do DF)

#### 1.1 Abertura de Chamado em 3 Etapas:
1. **Etapa 1 — CRE, Escola & Contato:**
   - Selecione a **Coordenação Regional de Ensino (CRE)**. Por padrão de segurança, o campo inicia em branco para evitar aberturas em regionais erradas.
   - Selecione a **Unidade Escolar**. O campo de busca permite localizar por nome, CEP ou endereço oficial da escola.
   - Preencha o **Nome do Solicitante**, **Cargo** (Diretor, Vice-Diretor, Secretário ou Chefe de Secretaria) e o **Telefone WhatsApp** (com DDD).
2. **Etapa 2 — Defeito Técnico & SLA:**
   - Selecione a **Categoria Técnica** (ex: Redes/Wi-Fi, Computadores/Servidores, Impressoras/Scanners, Elétrica/Nobreak, Softwares Pedagógicos).
   - Informe o **Nº de Patrimônio SEEDF** do equipamento (opcional, se aplicável).
   - Defina o **Nível de Urgência** (Baixa, Média, Alta, Crítica) e detalhe a descrição da ocorrência (mínimo de 15 caracteres).
3. **Etapa 3 — Fotos de Evidência & Envio:**
   - Anexe fotos da falha técnica. O sistema comprime automaticamente as imagens em **formato WebP** antes do envio, economizando até 80% do tráfego de dados da escola.
   - Clique em **"Enviar Solicitação"**. Um protocolo oficial no padrão `OS-YYYY-XXXXX` e um token criptográfico de rastreamento são gerados instantaneamente.

#### 1.2 Acompanhamento e Notificações:
- O gestor pode clicar em **"Salvar no WhatsApp"** para enviar o comprovante com o link de rastreamento diretamente para o telefone da direção.
- Na aba **"Rastrear Chamados"**, o gestor pesquisa pelo número do WhatsApp ou pelo protocolo para ver o status em tempo real.
- **Aprovação de Orçamentos:** Caso o técnico lance um orçamento de peças, o gestor recebe o laudo no portal e pode aprovar ou rejeitar com justificativa obrigatória.
- **Encerramento da OS:** Ao término do atendimento, o gestor assina digitalmente na tela do celular do técnico para homologar a conclusão do serviço.

---

### 2. PERFIL: TÉCNICO DE CAMPO (PWA Mobile-First)

#### 2.1 Despacho Inteligente e Aceite (Prazo de 20 Minutos):
- O chamado mais próximo é despachado automaticamente para o técnico elegível via cálculo geodésico (Fórmula de Haversine).
- O técnico visualiza um alerta com **cronômetro regressivo de 20 minutos**.
- **Aceitar Chamado:** Altera o status para `em_deslocamento` e inicia o trajeto.
- **Recusar Chamado:** Exige preenchimento de justificativa. O sistema aciona automaticamente o re-despacho para o próximo técnico elegível no raio da regional.

#### 2.2 Check-in Presencial com Geofencing:
- Ao chegar na escola, o técnico clica em **"Confirmar Chegada na Escola"**.
- O sistema valida a proximidade por GPS (tolerância de até 1,5 km do colégio) e transiciona o chamado para `em_atendimento`.

#### 2.3 Gestão de Pendências e Agendamentos:
- **Agendar Visita:** Caso o atendimento demande retorno em dia/horário específico, o técnico registra a data e notas de agendamento (`visita_agendada`).
- **Aguardando Peça:** Sinaliza pausa por falta de componente em estoque (`aguardando_peca`).
- **Aguardando Terceiros:** Sinaliza dependência de concessionária de energia ou operadora de telecomunicações (`aguardando_terceiro`).
- **Lançar Orçamento:** Permite cadastrar itens de peças/serviços com laudo diagnóstico para aprovação do gestor ou central (`aguardando_orcamento`).

#### 2.4 Finalização e Coleta de Assinatura:
- Para concluir a OS, o técnico preenche o **Resumo Técnico dos Serviços Executados**, coleta o **Nome Completo** e **Matrícula SEEDF/CPF** do gestor e colhe a **Assinatura Digital Vetorial (SVG)** na tela sensível ao toque.

#### 2.5 Operação Offline:
- Se o técnico estiver em subsolo ou área rural sem sinal celular, o PWA opera em **Modo Offline**:
  - Todas as ações são armazenadas na fila local `FIFO`.
  - Ao recuperar a conexão, o botão **"Sincronizar"** descarrega as mutações em lote no Supabase sem perda de dados.

---

### 3. PERFIL: CENTRAL DE OPERAÇÕES & CONTROLADORIA

#### 3.1 Visão Kanban Multi-CRE:
- Monitoramento em 5 colunas operacionais com contadores em tempo real.
- Cada card exibe a pílula de SLA calculada: `No Prazo`, `Em Risco (< 8h)` ou `SLA Estourado (+Xh)`.
- **Fila de Exceção:** Chamados em aberto que não encontraram técnico disponível por saturação de capacidade podem ser despachados manualmente para qualquer técnico credenciado.

#### 3.2 Painel Executivo de Governança & SLA:
- Indicadores de taxa percentual de conformidade de SLA (meta 95%).
- Distribuição proporcional de demandas por CRE (todas as 15 regionais do DF).
- Tabela de produtividade técnica com tempo médio de atendimento e OSs concluídas.
- **Exportação CSV Oficial:** Download em um clique de todos os chamados estruturados para auditoria e prestação de contas com a SEEDF.

#### 3.3 Prestação de Contas de Orçamentos:
- Auditoria contábil de todas as peças e serviços orçados, com laudos técnicos, total homologado e histórico de decisões.

#### 3.4 Gestão de Cadastros (CRUD RBAC):
- Cadastro, edição, ativação/desativação e ajuste de raio de atendimento de técnicos.
- Gestão de usuários administrativos (Admin, Controladoria, Auditor Externo).
- Trava de segurança para restauração de banco exigindo digitação de token de autorização (`CONFIRMAR-RESET`).

