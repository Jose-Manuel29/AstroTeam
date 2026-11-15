import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "AstroTeam · Visualizador del Polo Sur Lunar",
  description: "Selección de sitios de alunizaje en el Polo Sur Lunar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-[#02040a] text-slate-200 antialiased">{children}</body>
    </html>
  );
}
