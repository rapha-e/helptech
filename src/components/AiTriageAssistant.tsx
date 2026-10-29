import React from 'react';
import { Sparkles, CheckCircle, Wrench, Package } from 'lucide-react';
import type { AiTriageResult } from '../lib/aiTriageService';

interface AiTriageAssistantProps {
  triage: AiTriageResult;
  onApplyCategory: (categoryId: string, urgency: 'baixa' | 'media' | 'alta' | 'critica') => void;
  onDismiss: () => void;
}

export const AiTriageAssistant: React.FC<AiTriageAssistantProps> = ({
  triage,
  onApplyCategory,
  onDismiss
}) => {
  return (
    <div className="bg-gradient-to-br from-indigo-50/90 to-blue-50/90 border border-indigo-200/80 rounded-2xl p-4 shadow-sm space-y-3 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles size={16} />
          </div>
          <div>
            <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
              Diagnóstico Preditivo HelpTech IA
              <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded-full">
                {Math.round(triage.confidenceScore * 100)}% precisão
              </span>
            </span>
            <p className="text-[11px] text-indigo-700 font-medium">{triage.probableIssue}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-slate-400 hover:text-slate-600 font-medium"
        >
          Ocultar
        </button>
      </div>

      {/* Checklist de Auto-Resolução */}
      <div className="bg-white/80 backdrop-blur-xs rounded-xl p-3 border border-indigo-100 space-y-1.5">
        <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
          <Wrench size={13} className="text-indigo-600" />
          Dicas de auto-resolução rápida (tente antes de aguardar o deslocamento):
        </div>
        <ul className="space-y-1 text-[11px] text-slate-600 pl-1">
          {triage.selfResolutionSteps.map((step, idx) => (
            <li key={idx} className="flex items-start gap-1.5">
              <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Previsão de Peças */}
      {triage.likelySpareParts.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 bg-white/50 px-2.5 py-1.5 rounded-lg border border-slate-200/60">
          <Package size={12} className="text-amber-500 shrink-0" />
          <span>Peças comumente utilizadas: <strong>{triage.likelySpareParts.slice(0, 2).join(', ')}</strong></span>
        </div>
      )}

      {/* Ação rápida para autocompletar categoria recomendada */}
      <div className="flex items-center justify-between pt-1 border-t border-indigo-100/60">
        <span className="text-[10.5px] text-indigo-700">
          Urgência calculada: <strong className="uppercase">{triage.suggestedUrgency}</strong>
        </span>
        <button
          type="button"
          onClick={() => onApplyCategory(triage.detectedCategory, triage.suggestedUrgency)}
          className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-100/80 hover:bg-indigo-100 px-3 py-1 rounded-lg transition-colors flex items-center gap-1"
        >
          <CheckCircle size={13} /> Aplicar Categoria & Urgência Recomendadas
        </button>
      </div>
    </div>
  );
};
