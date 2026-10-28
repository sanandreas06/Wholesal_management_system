'use client';
import { useEffect, useRef, useState } from "react";
import { scanFeedback } from "../lib/scanner";

type Detector = { detect(src: HTMLVideoElement): Promise<{ rawValue: string }[]> };

/** Reads barcodes and QR codes with the phone's (or laptop's) camera, for people who have no scanner, such as a sales rep on delivery.
 *  Uses the browser's own barcode reader where it has one (most Android phones), otherwise a reader that runs in the page.
 *  `keepOpen` keeps scanning after each code (counting stock, receiving goods); otherwise it closes after the first code. */
export default function CameraScanner({ onScan, onClose, keepOpen = false, title = "Scan a barcode" }: {
  onScan: (code: string) => void; onClose: () => void; keepOpen?: boolean; title?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [lastCode, setLastCode] = useState("");
  const cb = useRef(onScan); cb.current = onScan;

  useEffect(() => {
    let stopped = false, stream: MediaStream | null = null, timer = 0;
    let zx: { stop(): void } | null = null;
    const recent = new Map<string, number>();
    const hit = (code: string) => {
      const now = Date.now();
      if ((recent.get(code) ?? 0) > now - 1500) return; // the same code held in front of the camera counts once
      recent.set(code, now);
      scanFeedback(true); setLastCode(code); cb.current(code);
      if (!keepOpen) { stopped = true; onClose(); }
    };
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setError("This browser cannot use the camera. Use Chrome, or a USB scanner."); return; }
      const W = window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } };
      try {
        if (W.BarcodeDetector) {
          const supported = (await W.BarcodeDetector.getSupportedFormats?.()) ?? [];
          const want = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code", "data_matrix"].filter(f => !supported.length || supported.includes(f));
          const det = new W.BarcodeDetector({ formats: want });
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
          if (stopped || !video.current) return;
          video.current.srcObject = stream; await video.current.play();
          const loop = async () => {
            if (stopped || !video.current) return;
            try { const found = await det.detect(video.current); if (found[0]?.rawValue) hit(found[0].rawValue); } catch { /* next frame */ }
            timer = window.setTimeout(loop, 180);
          };
          loop();
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (stopped || !video.current) return;
          const reader = new BrowserMultiFormatReader();
          zx = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } }, audio: false }, video.current, (res) => { if (res && !stopped) hit(res.getText()); });
        }
      } catch (e) {
        const n = (e as { name?: string }).name;
        setError(n === "NotAllowedError" ? "Camera permission was refused. Allow the camera for this site in your browser settings, then try again." : n === "NotFoundError" ? "No camera was found on this device." : "The camera could not start. Close other apps using it and try again.");
      }
    })();
    return () => { stopped = true; clearTimeout(timer); zx?.stop(); stream?.getTracks().forEach(t => t.stop()); };
  }, [keepOpen, onClose]);

  return (
    <div className="cam-back" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="cam" onClick={e => e.stopPropagation()}>
        <div className="cam-head"><strong>{title}</strong><button type="button" className="cam-x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="cam-view">
          <video ref={video} playsInline muted />
          <div className="cam-frame" aria-hidden="true" />
        </div>
        {error ? <p className="cam-err" role="alert">{error}</p>
          : <p className="cam-tip">{lastCode ? <>Read <b>{lastCode}</b>{keepOpen ? ". Scan the next one." : ""}</> : "Hold the barcode inside the frame, about a hand's length away."}</p>}
        {keepOpen && <button type="button" className="cam-done" onClick={onClose}>Done</button>}
      </div>
    </div>
  );
}
