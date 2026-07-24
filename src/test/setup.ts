import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Polyfills / stubs for jsdom
if (typeof window !== "undefined") {
  // matchMedia is used by several UI primitives
  if (!window.matchMedia) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
  if (!window.scrollTo) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).scrollTo = () => {};
  }
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!(globalThis as any).IntersectionObserver) {
    (globalThis as any).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    };
  }
  // Radix / other UI primitives sometimes probe pointer capture APIs
  if (typeof Element !== "undefined") {
    if (!(Element.prototype as any).hasPointerCapture) {
      (Element.prototype as any).hasPointerCapture = () => false;
    }
    if (!(Element.prototype as any).scrollIntoView) {
      (Element.prototype as any).scrollIntoView = () => {};
    }
    if (!(Element.prototype as any).releasePointerCapture) {
      (Element.prototype as any).releasePointerCapture = () => {};
    }
  }
}
