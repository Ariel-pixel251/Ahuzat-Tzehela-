import QRCode from "qrcode";

/** A QR code as inline SVG (rendered on the server). */
export async function QrCode({ value, label, className = "size-48" }: { value: string; label: string; className?: string }) {
  const svg = await QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return <div role="img" aria-label={label} className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
