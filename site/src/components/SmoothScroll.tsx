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
        // Lands each section's top divider right under the 64px header.
        anchors: { offset: -64 },
        stopInertiaOnNavigate: true,
      }}
    />
  );
}
