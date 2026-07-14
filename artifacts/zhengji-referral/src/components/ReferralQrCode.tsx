import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

/**
 * Renders a scannable QR code for a partner's referral link, plus a
 * download-as-PNG button. Kiri partners need something they can screenshot
 * or print at their counter, not just a copy-pasteable URL.
 */
export function ReferralQrCode({ link }: { link: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!link || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, link, { width: 180, margin: 1 }).catch(
      () => {},
    );
    QRCode.toDataURL(link, { width: 512, margin: 1 })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [link]);

  if (!link) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas ref={canvasRef} className="rounded border" />
      <a
        href={dataUrl ?? undefined}
        download="referral-qr-code.png"
        className={`text-xs underline text-primary hover:text-primary/80 ${
          dataUrl ? "" : "pointer-events-none opacity-50"
        }`}
      >
        Download QR | 下载二维码
      </a>
    </div>
  );
}
