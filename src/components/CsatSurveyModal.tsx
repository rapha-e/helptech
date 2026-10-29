import React, { useState } from 'react';
import { Star, MessageSquare, CheckCircle2, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface CsatSurveyModalProps {
  isOpen: boolean;
  ticketProtocol: string;
  technicianName?: string;
  onClose: () => void;
  onSubmitRating: (rating: number, comment: string) => void;
}

export const CsatSurveyModal: React.FC<CsatSurveyModalProps> = ({
  isOpen,
  ticketProtocol,
  technicianName = 'Técnico de Campo',
  onClose,
  onSubmitRating
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitRating(rating, comment.trim());
    setSubmitted(true);
    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } catch {
      // confetti fallback
    }
    setTimeout(() => {
      onClose();
      setSubmitted(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">Pesquisa de Satisfação SEEDF</h3>
            <p className="text-[11px] text-slate-500">Ordem de Serviço: {ticketProtocol}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-2 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 size={28} />
            </div>
            <h4 className="font-bold text-slate-800 text-sm">Avaliação Registrada!</h4>
            <p className="text-xs text-slate-500">Obrigado por ajudar a aprimorar o atendimento nas escolas do DF.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center space-y-1">
              <p className="text-xs text-slate-700 font-medium">
                Como você avalia a qualidade do atendimento prestado por <strong>{technicianName}</strong>?
              </p>

              {/* Estrelas interativas */}
              <div className="flex justify-center gap-2 py-3">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = (hoverRating !== null ? hoverRating : rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform hover:scale-115 focus:outline-none"
                    >
                      <Star
                        size={28}
                        className={isFilled ? 'text-amber-400 fill-amber-400 drop-shadow-xs' : 'text-slate-200'}
                      />
                    </button>
                  );
                })}
              </div>

              <span className="text-[11px] font-bold text-amber-600 block">
                {rating === 5 && '⭐ Excelente! Muito satisfeito.'}
                {rating === 4 && '👍 Bom atendimento.'}
                {rating === 3 && '😐 Regular / Atendeu aos requisitos.'}
                {rating === 2 && '👎 Ruim / Deixou a desejar.'}
                {rating === 1 && '⚠️ Muito insatisfeito.'}
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <MessageSquare size={13} className="text-blue-600" />
                Comentário ou observação sobre o serviço (Opcional):
              </label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ex: O técnico foi muito pontual e educado. Os computadores da sala de informática voltaram a funcionar perfeitamente."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={15} /> Enviar Avaliação
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
