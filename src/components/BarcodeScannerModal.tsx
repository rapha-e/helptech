import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, Flashlight, CheckCircle2, QrCode } from 'lucide-react';

export interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected?: (code: string) => void;
  onScanSuccess?: (code: string) => void;
  title?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onDetected,
  onScanSuccess,
  title = 'Escanear Etiqueta de Patrimônio'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const emitCode = (code: string) => {
    if (onScanSuccess) onScanSuccess(code);
    if (onDetected) onDetected(code);
  };

  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      return;
    }

    let isMounted = true;
    let scanInterval: ReturnType<typeof setInterval> | null = null;

    async function startCamera() {
      try {
        setCameraError(null);

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        if (!isMounted) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play().catch(() => {});
        }

        // Verifica suporte a lanterna
        const track = mediaStream.getVideoTracks()[0];
        const capabilities = (track?.getCapabilities ? track.getCapabilities() : {}) as any;
        if (capabilities && 'torch' in capabilities) {
          setTorchSupported(true);
        }

        // Detecção nativa via BarcodeDetector API (suportado em Chrome/Edge/Android)
        if ('BarcodeDetector' in window) {
          const BarcodeDetectorClass = (window as any).BarcodeDetector;
          const detector = new BarcodeDetectorClass({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8']
          });

          scanInterval = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const rawValue = barcodes[0].rawValue;
                if (rawValue && rawValue.trim()) {
                  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    navigator.vibrate(100);
                  }
                  emitCode(rawValue.trim());
                  onClose();
                }
              }
            } catch {
              // frame detection skip
            }
          }, 300);
        }
      } catch (err: any) {
        console.warn('Acesso à câmera não disponível:', err);
        setCameraError('Câmera indisponível ou permissão não concedida. Digite o patrimônio manualmente abaixo.');
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      if (scanInterval) clearInterval(scanInterval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: !torchOn } as any]
        });
        setTorchOn(!torchOn);
      } catch (e) {
        console.warn('Falha ao acionar lanterna', e);
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(60);
      }
      emitCode(manualCode.trim());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl text-white space-y-4">
        {/* Header */}
        <div className="px-5 pt-4 flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600/30 text-blue-400 rounded-xl">
              <QrCode size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">{title}</h3>
              <p className="text-[11px] text-slate-400">Aponte para o código QR ou de barras</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Câmera / Mirador */}
        <div className="px-5">
          <div className="relative aspect-square w-full bg-black rounded-2xl overflow-hidden border border-slate-700 flex items-center justify-center">
            {cameraError ? (
              <div className="p-4 text-center space-y-2">
                <Camera size={36} className="mx-auto text-slate-600" />
                <p className="text-xs text-rose-400 font-semibold">{cameraError}</p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="w-full h-full object-cover"
                />

                {/* Retículo / Alvo de Leitura */}
                <div className="absolute inset-8 border-2 border-dashed border-blue-400/70 rounded-2xl pointer-events-none flex items-center justify-center">
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />
                </div>

                {/* Lanterna se suportada */}
                {torchSupported && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`absolute bottom-3 right-3 p-2.5 rounded-full backdrop-blur-md transition-colors ${
                      torchOn ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800/80 text-white'
                    }`}
                    title="Alternar Lanterna"
                  >
                    <Flashlight size={16} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Fallback de Digitação Rápida */}
        <form onSubmit={handleManualSubmit} className="px-5 pb-5 space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Ou confirme o patrimônio manualmente:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ex: PAT-2026-9901"
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <CheckCircle2 size={14} /> OK
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
