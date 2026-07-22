import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { logSupabaseError } from "@/lib/log-access-denial";

export const getRouter = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        logSupabaseError(error, {
          modulo: String(query.queryKey?.[0] ?? ""),
          rota: typeof window !== "undefined" ? window.location.pathname : undefined,
        });
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
