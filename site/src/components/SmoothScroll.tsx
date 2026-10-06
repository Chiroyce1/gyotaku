"use client";

import { ReactLenis } from "lenis/react";

// Wheel scrolling glides instead of stepping, and in-page links (install,
// back to top) travel there instead of jumping. Touch scrolling stays
// native, and Lenis turns itself off under reduced motion.
export function SmoothScroll() {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.12,
        // Clears the 56px sticky header with a little air.
        anchors: { offset: -72 },
        stopInertiaOnNavigate: true,
      }}
    />
  );
}
