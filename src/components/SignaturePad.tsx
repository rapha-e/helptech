import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, Check, PenTool } from 'lucide-react';

interface SignaturePadProps {
  onSave: (svgPath: string) => void;
  disabled?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, disabled = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [paths, setPaths] = useState<string[]>([]);
  const currentPathRef = useRef<string>('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configuração do traçado
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
  }, []);

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (disabled) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasStroke(true);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    currentPathRef.current = `M ${Math.round(coords.x)} ${Math.round(coords.y)}`;
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing || disabled) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    currentPathRef.current += ` L ${Math.round(coords.x)} ${Math.round(coords.y)}`;
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPathRef.current) {
      const updated = [...paths, currentPathRef.current];
      setPaths(updated);
      onSave(updated.join(' '));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
    setPaths([]);
    currentPathRef.current = '';
    onSave('');
  };

  return (
    <div className="signature-container bg-slate-50 border border-slate-300 rounded-xl p-3 shadow-inner">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <PenTool size={14} className="text-blue-600" />
          <span>Assinatura Digital do Responsável Escolar</span>
        </div>
        <button
          type="button"
          onClick={clearCanvas}
          disabled={!hasStroke || disabled}
          className="text-xs flex items-center gap-1 text-slate-500 hover:text-rose-600 disabled:opacity-40 transition-colors"
        >
          <RotateCcw size={12} />
          Limpar traço
        </button>
      </div>

      <div className="relative border-2 border-dashed border-slate-300 rounded-lg bg-white overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          width={450}
          height={160}
          className="w-full h-40 cursor-crosshair bg-white"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasStroke && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400 text-xs">
            Assine com o dedo ou caneta touch dentro desta área
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>Vetor SVG criptografado no comprovante</span>
        {hasStroke && (
          <span className="text-emerald-600 font-medium flex items-center gap-0.5">
            <Check size={12} /> Traço capturado
          </span>
        )}
      </div>
    </div>
  );
};
