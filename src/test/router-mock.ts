import { vi } from "vitest";
import type { ReactNode } from "react";
import { createElement } from "react";

/**
 * Minimal @tanstack/react-router mock for integration tests.
 * Route files call createFileRoute("...")(options) to get a Route object.
 * We expose `useParams`, `useSearch`, `useRouteContext`, and `useLoaderData`
 * on the returned Route object, and let tests override params via
 * `setRouteParams`.
 */

let currentParams: Record<string, string> = {};
let currentSearch: Record<string, unknown> = {};

export function setRouteParams(params: Record<string, string>) {
  currentParams = params;
}
export function setRouteSearch(search: Record<string, unknown>) {
  currentSearch = search;
}
export function resetRouterMock() {
  currentParams = {};
  currentSearch = {};
  navigateSpy.mockClear();
  invalidateSpy.mockClear();
}

export const navigateSpy = vi.fn();
export const invalidateSpy = vi.fn();

const routeApi = {
  useParams: () => currentParams,
  useSearch: () => currentSearch,
  useRouteContext: () => ({}),
  useLoaderData: () => undefined,
  useNavigate: () => navigateSpy,
  useMatch: () => ({ params: currentParams }),
};

export function createFileRoute(_id: string) {
  return (options: any) => ({
    options,
    ...routeApi,
  });
}

export function createRootRoute(options: any) {
  return { options, ...routeApi };
}

export const Outlet = () => createElement("div", { "data-testid": "outlet" });

export function Link({ children, to, params, ...rest }: any) {
  const href = typeof to === "string" ? to : "#";
  return createElement("a", { href, "data-to": to, "data-params": JSON.stringify(params ?? {}), ...rest }, children as ReactNode);
}

export const useNavigate = () => navigateSpy;
export const useRouter = () => ({
  navigate: navigateSpy,
  invalidate: invalidateSpy,
});
export const useParams = () => currentParams;
export const useSearch = () => currentSearch;
export const useRouterState = () => ({ location: { pathname: "/" } });
export const useMatch = () => ({ params: currentParams });
export const useLoaderData = () => undefined;
export const useCanGoBack = () => false;
export function notFound(opts?: any) {
  const e: any = new Error("notFound");
  e.isNotFound = true;
  e.data = opts?.data;
  return e;
}
export function redirect(opts: any) {
  return opts;
}
export const rootRouteId = "__root__";
export const Navigate = () => null;
export const MatchRoute = () => null;
export function linkOptions<T>(opts: T) { return opts; }
export function createLink(x: any) { return x; }
