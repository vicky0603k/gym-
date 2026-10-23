import { GateQr } from "./gate-qr";

export const metadata = { title: "Gate QR" };

/** Gate display. Staff-only: the owner layout and /api/qr-token both require a staff session. */
export default function GateQrPage() {
  return <GateQr />;
}
