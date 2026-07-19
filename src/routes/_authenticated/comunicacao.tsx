import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useServerFn } from "@tanstack/react-query" as any;

export const Route = createFileRoute("/_authenticated/comunicacao")({
  component: ComunicacaoPage,
});

// placeholder to satisfy TS if imports above are wrong
function ComunicacaoPage() { return null; }
