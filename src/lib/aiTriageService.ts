export interface AiTriageResult {
  detectedCategory: string;
  suggestedUrgency: 'baixa' | 'media' | 'alta' | 'critica';
  confidenceScore: number;
  probableIssue: string;
  selfResolutionSteps: string[];
  likelySpareParts: string[];
}

export function analyzeTicketDescription(title: string, description: string): AiTriageResult | null {
  const text = `${title} ${description}`.toLowerCase().trim();
  if (text.length < 8) return null;

  // 1. Rede / Internet / Wi-Fi
  if (/internet|rede|wi-?fi|roteador|switch|cabo|conectar|offline|sem sinal/i.test(text)) {
    return {
      detectedCategory: 'cat-001', // Rede e Conectividade
      suggestedUrgency: /secretaria|direcao|matricula|provas/i.test(text) ? 'alta' : 'media',
      confidenceScore: 0.92,
      probableIssue: 'Instabilidade de link ou rompimento de cabo UTP local',
      selfResolutionSteps: [
        'Verifique se os LEDs do roteador ou switch da escola estão acesos em verde ou laranja contínuo.',
        'Desconecte o cabo de rede RJ-45 da porta do computador e plugue novamente até ouvir o clique de trava.',
        'Reinicie o modem/roteador da operadora desligando-o da tomada por 30 segundos.'
      ],
      likelySpareParts: ['Cabo de Rede UTP CAT6 Furukawa Azul', 'Conector Macho RJ-45 CAT6', 'Roteador / Access Point Dual Band Gigabit']
    };
  }

  // 2. Hardware / Computador não liga / Fonte / Travamento
  if (/n[aã]o liga|desliga|fonte|tela preta|bipe|bipando|mem[oó]ria|aquec|cheiro de queimado/i.test(text)) {
    return {
      detectedCategory: 'cat-002', // Hardware e Periféricos
      suggestedUrgency: 'alta',
      confidenceScore: 0.89,
      probableIssue: 'Falha no fornecimento de energia (fonte ATX) ou oxidação de memória RAM',
      selfResolutionSteps: [
        'Confira se a chave seletora de tensão traseira (110V/220V) e o botão I/O da fonte estão acionados.',
        'Teste o cabo de energia em outra tomada para descartar falha no filtro de linha ou disjuntor da sala.',
        'Desconecte todos os periféricos USB adicionais (pendrives, caixas de som) e tente ligar novamente.'
      ],
      likelySpareParts: ['Fonte ATX 500W 80 Plus Bronze PFC Ativo', 'Memória RAM DDR4 8GB 2666MHz Kingston', 'SSD 480GB Kingston SATA III']
    };
  }

  // 3. Impressora / Escaneamento
  if (/impressora|toner|papel preso|imprime|impress[aã]o|mancha|scanner/i.test(text)) {
    return {
      detectedCategory: 'cat-003', // Impressoras e Copiadoras
      suggestedUrgency: 'baixa',
      confidenceScore: 0.94,
      probableIssue: 'Atolamento mecânico de papel ou esgotamento de cartucho de toner',
      selfResolutionSteps: [
        'Abra a tampa frontal e puxe suavemente qualquer folha presa no sentido de saída do papel.',
        'Retire o toner, agite suavemente na horizontal e recoloque até travar.',
        'Desligue a impressora por 1 minuto no botão frontal para limpar a fila de impressão da memória.'
      ],
      likelySpareParts: ['Kit de Roletes Tracionadores', 'Cartucho de Toner Compatível']
    };
  }

  // 4. Periféricos / Teclado / Mouse / Monitor
  if (/mouse|teclado|monitor|tela|imagem|cursor|letra/i.test(text)) {
    return {
      detectedCategory: 'cat-002',
      suggestedUrgency: 'baixa',
      confidenceScore: 0.85,
      probableIssue: 'Mau contato na porta USB ou cabo de vídeo HDMI/VGA folgado',
      selfResolutionSteps: [
        'Conecte o mouse/teclado em outra porta USB traseira da CPU.',
        'Aperte os parafusos laterais do cabo VGA ou troque o cabo HDMI de entrada no monitor.'
      ],
      likelySpareParts: ['Kit Teclado e Mouse USB ABNT2 Padrão SEEDF', 'Cabo HDMI 2.0 1.8m']
    };
  }

  return null;
}
