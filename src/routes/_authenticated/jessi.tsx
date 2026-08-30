import { createFileRoute } from "@tanstack/react-router";
import { JessiLayout } from "@/components/jessi/JessiLayout";

export const Route = createFileRoute("/_authenticated/jessi")({
  component: JessiPage,
  head: () => ({
    meta: [
      { title: "Jessi — Assistente Operacional • Spa de Pet Tia Jéssica" },
      {
        name: "description",
        content: "Assistente Operacional Inteligente para a gestão do Spa de Pet Tia Jéssica.",
      },
    ],
  }),
});

function JessiPage() {
  return <JessiLayout />;
}
