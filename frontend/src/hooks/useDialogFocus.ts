import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.getAttribute("aria-hidden") !== "true",
  );
}

export function useDialogFocus<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
): RefObject<T> {
  const containerRef = useRef<T>(null) as RefObject<T>;
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    previousFocus.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const preferred = container?.querySelector<HTMLElement>("[data-autofocus]");
    const initial = preferred ?? focusableElements(container)[0] ?? container;
    const focusTimer = window.setTimeout(() => initial?.focus(), 0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusableElements(container);
      if (!items.length) {
        event.preventDefault();
        container?.focus();
        return;
      }

      const active = document.activeElement;
      const outside = !container?.contains(active);
      if (event.shiftKey && (active === items[0] || outside)) {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (!event.shiftKey && (active === items[items.length - 1] || outside)) {
        event.preventDefault();
        items[0].focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      const previous = previousFocus.current;
      if (previous?.isConnected) {
        previous.focus();
      }
    };
  }, [open]);

  return containerRef;
}
