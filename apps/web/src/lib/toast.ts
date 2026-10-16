export type ToastKind = "success" | "error" | "info";
export interface ToastItem { id: number; kind: ToastKind; text: string }
type Listener = (t: ToastItem) => void;

const listeners = new Set<Listener>();
let nextId = 1;

function push(kind: ToastKind, text: string) {
  const t = { id: nextId++, kind, text };
  listeners.forEach(l => l(t));
}

/** Small non-blocking messages that replace browser pop-ups. */
export const toast = {
  success: (text: string) => push("success", text),
  error: (text: string) => push("error", text),
  info: (text: string) => push("info", text),
  subscribe: (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; },
};
