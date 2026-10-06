// The feature demos' screenshots, made the same way as the hero's: a small
// page per screen, photographed with Chrome, then read by `gyotaku ocr`.
// Run through `bun scripts/demo-shots.ts features`. Every name, number and
// address is made up.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

type Line = { text: string; x: number; y: number; w: number; h: number; score: number };
type Ocr = (png: string, scripts?: string[]) => Line[];

type Screen = {
  id: string;
  name: string;
  w: number;
  h: number;
  // Device pixels per CSS pixel. The misread order confirmation is shot at
  // 1x, like a screenshot from an older laptop, which is what makes its fine
  // print hard enough to misread.
  scale: number;
  css: string;
  html: string;
  scripts?: string[];
  // Scroll the page this far before the shot (the burst of one chat).
  scroll?: number;
};

const EMAIL = `
  body { background: #fff; color: #1f1f1f; padding: 18px 18px; }
  .from { display: flex; align-items: center; gap: 9px; font-size: 12px; color: #5f6368; }
  .avatar { width: 28px; height: 28px; border-radius: 50%; color: #fff; display: grid; place-items: center; font-weight: 600; font-size: 13px; }
  .from b { color: #1f1f1f; font-weight: 600; }
  h1 { font-size: 18px; font-weight: 600; margin: 18px 0 10px; letter-spacing: -0.01em; }
  p { font-size: 14px; line-height: 1.55; color: #3c4043; }
`;

const CHAT_CSS = `
  body { background: #efeae2; font-family: 'Noto Sans', sans-serif; color: #111b21; }
  .bar { position: sticky; top: 0; background: #f0f2f5; padding: 10px 14px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #e0e0e0; z-index: 2; }
  .dot { width: 30px; height: 30px; border-radius: 50%; background: #9fb3c8; }
  .bar b { font-size: 14px; font-weight: 600; }
  .bar small { display: block; font-size: 11px; color: #667781; font-weight: 400; }
  .thread { padding: 10px 12px 14px; display: flex; flex-direction: column; gap: 6px; }
  .in, .out { max-width: 78%; padding: 6px 9px 7px; border-radius: 9px; font-size: 13.5px; line-height: 1.35; box-shadow: 0 1px 0.5px rgb(0 0 0 / 0.13); }
  .in { align-self: flex-start; background: #fff; }
  .out { align-self: flex-end; background: #d9fdd3; }
  .day { align-self: center; font-size: 11px; background: #fff; color: #54656f; padding: 3px 8px; border-radius: 7px; }
`;

// One planning chat, long enough to scroll; the burst is four shots of it,
// each taken a little further down.
const PLANNING = `
  <div class="bar"><div class="dot"></div><div><b>Trip to Jaisalmer</b><small>Aarav, Meera, you</small></div></div>
  <div class="thread">
    <div class="day">Today</div>
    <div class="in">ok so we leave friday night?</div>
    <div class="out">yes, train at 11:40 from Jodhpur</div>
    <div class="in">who's booking the camp</div>
    <div class="out">me, Desert Rose camp, 2 tents</div>
    <div class="in">how much per person</div>
    <div class="out">2,400 with dinner and the jeep safari</div>
    <div class="in">nice. pickup from the station?</div>
    <div class="out">they said 6:30 am at gate 2</div>
    <div class="in">bring jackets, nights are cold</div>
    <div class="out">noted. packing tonight</div>
    <div class="in">see you at the platform</div>
  </div>
`;

function otp(id: string, sender: string, text: string): Screen {
  return {
    id,
    name: `a ${sender} text message`,
    w: 300,
    h: 225,
    scale: 2,
    css: `
      body { background: #f2f2f7; font-family: 'Noto Sans', sans-serif; color: #111; }
      .bar { background: #fff; padding: 10px; text-align: center; border-bottom: 1px solid #e3e3e8; }
      .dot { width: 28px; height: 28px; border-radius: 50%; background: #c7c7cc; margin: 0 auto 3px; }
      .bar b { font-size: 12px; font-weight: 600; }
      .thread { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
      .when { text-align: center; font-size: 10px; color: #8e8e93; }
      .in { align-self: flex-start; max-width: 88%; background: #e5e5ea; padding: 8px 11px; border-radius: 16px; font-size: 13.5px; line-height: 1.35; }
    `,
    html: `<div class="bar"><div class="dot"></div><b>${sender}</b></div>
      <div class="thread"><div class="when">Today 09:41</div><div class="in">${text}</div></div>`,
  };
}

const SCREENS: Screen[] = [
  // Near matches: the invoice email, an order confirmation whose fine print
  // gyotaku really does misread, and a chat with nothing to do with it.
  // Portrait, like the tiles they sit in, and full to the bottom edge.
  {
    id: "near-mail",
    name: "an invoice email",
    w: 300,
    h: 380,
    scale: 3,
    css: `${EMAIL}
      .btn { display: inline-block; margin-top: 16px; background: #1f1f1f; color: #fff; font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 7px; }
      .foot { margin-top: 18px; padding-top: 12px; border-top: 1px solid #e8eaed; font-size: 11px; color: #80868b; line-height: 1.5; }
    `,
    html: `
      <div class="from"><div class="avatar" style="background:#2f6b4f">F</div><div><b>Fern &amp; Co</b><br>billing@fernandco.example</div></div>
      <h1>Your invoice is ready</h1>
      <p>Invoice #4021</p>
      <p>Amount due 2,340.00</p>
      <p>Due by 12 Oct</p>
      <div class="btn">View and pay</div>
      <div class="foot">Fern &amp; Co, 14 Lake Road, Jodhpur<br>Questions? Reply to this email.</div>
    `,
  },
  {
    id: "near-order",
    name: "an order confirmation",
    w: 300,
    h: 380,
    scale: 1,
    css: `
      body { background: #fff; color: #111; padding: 18px; font-family: 'Liberation Sans', sans-serif; }
      .brand { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; color: #0f766e; }
      h1 { font-size: 19px; margin: 12px 0 6px; }
      p { font-size: 14px; line-height: 1.55; color: #333; }
      .items { margin-top: 12px; border-top: 1px solid #e5e5e5; padding-top: 8px; font-size: 13px; }
      .row { display: flex; justify-content: space-between; line-height: 1.9; color: #333; }
      .total { font-weight: 700; color: #111; border-top: 1px solid #e5e5e5; margin-top: 4px; padding-top: 4px; }
      .fine { margin-top: 18px; font-size: 7px; color: #222; }
    `,
    html: `
      <div class="brand">KAAPI STORE</div>
      <h1>Order confirmed</h1>
      <p>Thanks for shopping with us</p>
      <p>Arrives Tuesday</p>
      <div class="items">
        <div class="row"><span>Pour-over kit</span><span>1,450</span></div>
        <div class="row"><span>Coffee beans, 250 g</span><span>890</span></div>
        <div class="row total"><span>Paid with UPI</span><span>2,340</span></div>
      </div>
      <div class="fine">Invoice #3907</div>
    `,
  },
  {
    id: "near-chat",
    name: "a chat with Mum",
    w: 300,
    h: 380,
    scale: 2,
    css: CHAT_CSS,
    html: `
      <div class="bar"><div class="dot" style="background:#e5a5b5"></div><div><b>Mum</b><small>online</small></div></div>
      <div class="thread">
        <div class="day">Today</div>
        <div class="out">landed! waiting for bags</div>
        <div class="in">call me when you're out</div>
        <div class="out">ok, at gate 4</div>
        <div class="in">did you eat anything on the flight</div>
        <div class="out">just the sandwich</div>
        <div class="in">come home, dinner is ready</div>
        <div class="out">leaving now</div>
        <div class="in">safe ride home</div>
      </div>
    `,
  },

  // Bursts: one chat shot four times while scrolling.
  ...[0, 70, 140, 210].map(
    (scroll, i): Screen => ({
      id: `burst-${i + 1}`,
      name: `a group chat, shot ${i + 1} of 4`,
      w: 260,
      h: 340,
      scale: 2,
      scroll,
      css: CHAT_CSS,
      html: PLANNING,
    }),
  ),

  // Copy lines: a hotel booking confirmation.
  {
    id: "booking",
    name: "a hotel booking confirmation",
    w: 460,
    h: 262,
    scale: 2,
    css: `
      body { background: #fff; color: #1d1d1f; }
      .head { background: #0e3b43; color: #fff; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; }
      .head b { font-size: 15px; letter-spacing: 0.02em; }
      .head span { font-size: 12px; opacity: 0.85; }
      .body { padding: 16px 20px; }
      h1 { font-size: 20px; font-weight: 600; }
      .sub { font-size: 14px; color: #555; margin-top: 3px; }
      dl { display: grid; grid-template-columns: 120px 1fr; gap: 7px 12px; margin-top: 14px; font-size: 14px; }
      dt { color: #6b6b70; }
      dd { font-weight: 600; }
    `,
    html: `
      <div class="head"><b>SAGAR HOTELS</b><span>booking #HS-77120</span></div>
      <div class="body">
        <h1>Booking confirmed</h1>
        <div class="sub">Hotel Sagar, Jodhpur · 2 nights</div>
        <dl>
          <dt>Check-in</dt><dd>Fri 9 Oct, 2 pm</dd>
          <dt>Check-out</dt><dd>Sun 11 Oct, 11 am</dd>
          <dt>Confirmation</dt><dd>HS-77120</dd>
          <dt>Wi-Fi</dt><dd>sagar-guest / lemon-tree-42</dd>
        </dl>
      </div>
    `,
  },

  // Bulk trash: one-time codes from four senders.
  otp("otp-1", "HDFC Bank", "482913 is your OTP for login. Do not share it."),
  otp("otp-2", "Swiggy", "Your Swiggy OTP is 7731. Valid for 10 minutes."),
  otp("otp-3", "Google", "G-305118 is your Google verification code."),
  otp("otp-4", "Zomato", "6620 is your Zomato login OTP."),

  // Clipboard: a picture copied from a chat, never saved anywhere.
  {
    id: "copied",
    name: "a copied picture",
    w: 320,
    h: 240,
    scale: 2,
    css: `
      body { background: #fdf3e1; display: grid; place-items: center; text-align: center; font-family: Inter, sans-serif; }
      .card { padding: 20px; }
      .big { font-size: 28px; font-weight: 600; line-height: 1.1; color: #1f1b16; letter-spacing: -0.02em; }
      .small { margin-top: 12px; font-size: 14px; color: #6b5f4d; }
      .tape { width: 70px; height: 6px; background: #f08a4b; margin: 0 auto 16px; border-radius: 3px; }
    `,
    html: `<div class="card"><div class="tape"></div><div class="big">ship it<br>on friday</div><div class="small">said nobody who had to fix it on saturday</div></div>`,
  },

  // Scripts: a Hindi delivery update with a vertical Japanese label beside it.
  {
    id: "scripts",
    name: "a Hindi order update and a vertical Japanese label",
    w: 420,
    h: 210,
    scale: 2,
    scripts: ["devanagari"],
    css: `
      body { background: #fff; color: #1d1d1f; display: flex; font-family: 'Noto Sans Devanagari', sans-serif; }
      .main { flex: 1; padding: 18px 18px; }
      .tag { font-family: Inter, sans-serif; font-size: 11px; letter-spacing: 0.1em; color: #8a8a8e; }
      h1 { font-size: 21px; font-weight: 600; margin: 8px 0 10px; }
      p { font-size: 16px; line-height: 1.7; color: #333; }
      .side { width: 64px; background: #b5361b; color: #fff; display: grid; place-items: center; }
      .side span { writing-mode: vertical-rl; font-family: 'Harano Aji Gothic', 'Droid Sans Japanese', sans-serif; font-size: 18px; font-weight: 500; letter-spacing: 0.12em; }
    `,
    html: `
      <div class="main">
        <div class="tag">ORDER #4021</div>
        <h1>ऑर्डर का स्टेटस</h1>
        <p>डिलीवरी आज शाम तक</p>
        <p>पता: जोधपुर, राजस्थान</p>
      </div>
      <div class="side"><span>縦書きのテキスト</span></div>
    `,
  },
];

export async function makeFeatures({ ocr, base, site }: { ocr: Ocr; base: string; site: string }) {
  const out = join(site, "src/assets/demo/features");
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });

  for (const s of SCREENS) {
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.scale });
    await page.setContent(
      `<!doctype html><meta charset="utf-8"><style>${base} html, body { width: ${s.w}px; min-height: ${s.h}px; } body { font-family: Inter, sans-serif; -webkit-font-smoothing: antialiased; } ${s.css}</style>${s.html}`,
    );
    await page.evaluate(() => document.fonts.ready);
    if (s.scroll) await page.evaluate((y) => window.scrollTo(0, y), s.scroll);
    const png = join(out, `${s.id}.png`);
    await page.screenshot({ path: png });
    await page.close();
    const lines = ocr(png, s.scripts);
    execFileSync("magick", [png, "-quality", "80", join(out, `${s.id}.webp`)]);
    execFileSync("rm", [png]);
    writeFileSync(
      join(out, `${s.id}.json`),
      `${JSON.stringify({ id: s.id, name: s.name, lines }, null, 2)}\n`,
    );
    console.log(`${s.id}: ${lines.map((l) => l.text).join(" | ")}`);
  }
  await browser.close();

  const key = (id: string) => id.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
  const index = [
    "// Generated by scripts/demo-shots.ts features. Don't edit by hand.",
    ...SCREENS.flatMap((s) => [
      `import ${key(s.id)}Image from "./${s.id}.webp";`,
      `import ${key(s.id)}Ocr from "./${s.id}.json";`,
    ]),
    "",
    "export const SHOTS = {",
    ...SCREENS.map((s) => `  ${key(s.id)}: { ...${key(s.id)}Ocr, image: ${key(s.id)}Image },`),
    "};",
    "",
  ].join("\n");
  writeFileSync(join(out, "index.ts"), index);
}
