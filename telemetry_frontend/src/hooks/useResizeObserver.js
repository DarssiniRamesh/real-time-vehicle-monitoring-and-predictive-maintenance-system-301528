import { useEffect, useState } from "react";

/**
 * PUBLIC_INTERFACE
 * useResizeObserver returns the latest {width,height} for a given element ref.
 * Useful for responsive containers (charts, tables).
 *
 * @param {React.RefObject<HTMLElement>} ref
 * @returns {{ width: number, height: number }}
 */
export function useResizeObserver(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref?.current;
    if (!el) return undefined;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      const id = window.setInterval(update, 800);
      window.addEventListener("resize", update);
      return () => {
        window.clearInterval(id);
        window.removeEventListener("resize", update);
      };
    }

    const obs = new ResizeObserver(() => update());
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);

  return size;
}
