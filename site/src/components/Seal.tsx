"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

// A hanko, the red seal pressed onto a finished print: 魚拓 carved out of a
// block of shu, so the paper shows through the letters. The glyphs are
// outlines from Harano Aji Mincho Bold (SIL OFL), so the seal looks the same
// whether or not the visitor has a Japanese font.
const GYO =
  "M333 149 322 145C343 89 359 13 352 -54C440 -150 564 33 333 149ZM517 150 508 144C550 92 593 12 600 -57C706 -140 803 76 517 150ZM731 153 722 146C777 90 840 3 861 -73C978 -150 1059 84 731 153ZM308 853C257 705 145 535 29 442L38 433C89 457 138 487 185 522V145H200C186 85 133 41 87 25C56 11 33 -17 44 -53C57 -90 104 -101 143 -81C199 -54 250 24 222 146C271 150 300 172 300 179V203H733V164H752C791 164 850 185 851 192V530C871 534 884 543 891 551L777 638L723 578H521C575 608 632 651 672 684C693 685 704 688 712 696L607 788L547 728H387C405 752 421 776 435 800C464 798 472 803 475 815ZM365 699H548C533 661 511 612 491 578H314L270 595C305 628 337 663 365 699ZM733 549V409H567V549ZM300 549H453V409H300ZM733 380V232H567V380ZM300 380H453V232H300Z";
const TAKU =
  "M346 745 354 716H556C524 519 421 289 283 130L292 121C359 168 419 224 471 287V-90H492C549 -90 584 -64 584 -56V6H797V-79H816C856 -79 915 -57 916 -49V358C938 362 953 372 960 380L843 471L787 408H598L567 420C625 514 668 616 695 716H949C964 716 974 721 977 732C933 774 856 836 856 836L789 745ZM797 35H584V379H797ZM18 358 62 219C73 223 84 234 88 247L161 287V52C161 40 157 36 142 36C124 36 42 41 42 41V27C84 19 103 8 115 -9C128 -27 132 -54 134 -89C256 -78 272 -35 272 44V351C333 388 381 419 418 444L416 455L272 417V585H391C404 585 414 590 417 601C386 637 327 692 327 692L277 613H272V807C297 811 307 821 309 836L161 850V613H31L39 585H161V390C98 375 47 363 18 358Z";

// Font units (1000 per em, y up) into the 64 unit seal: two glyphs stacked
// in the middle with an even margin of red around them.
const SCALE = 0.0215;
const X = 21.3;

export function Seal({ size = 64, className = "" }: { size?: number; className?: string }) {
  const reduce = useReducedMotion();
  const id = useId();
  const cut = `${id}-cut`;
  const ink = `${id}-ink`;

  return (
    <motion.svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="魚拓, gyotaku, in a red seal"
      className={`shrink-0 text-shu ${className}`}
      initial={reduce ? false : { scale: 1.25, opacity: 0, rotate: -9 }}
      whileInView={{ scale: 1, opacity: 1, rotate: -4 }}
      viewport={{ once: true, margin: "-60px" }}
      // Waits for the card it sits on to settle, then presses down.
      transition={{ type: "spring", duration: 0.4, bounce: 0, delay: 0.45 }}
    >
      <defs>
        <mask id={cut}>
          <rect width="64" height="64" fill="white" />
          <g fill="black">
            <path d={GYO} transform={`translate(${X} 28.8) scale(${SCALE} -${SCALE})`} />
            <path d={TAKU} transform={`translate(${X} 51.6) scale(${SCALE} -${SCALE})`} />
          </g>
        </mask>
        {/* A hand pressed seal: edges that wander a little, and a few specks
            where the paper didn't take the ink. */}
        <filter id={ink} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="4" result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.4" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="9" result="specks" />
          <feColorMatrix
            in="specks"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -16 11.6"
            result="holes"
          />
          <feComposite in="rough" in2="holes" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${ink})`}>
        <rect x="5" y="5" width="54" height="54" rx="5" fill="currentColor" mask={`url(#${cut})`} />
      </g>
    </motion.svg>
  );
}
