// Makes the demos' screenshots and reads them with gyotaku itself.
//
//   bun scripts/demo-shots.ts            the hero's eight (src/assets/demo)
//   bun scripts/demo-shots.ts features   the feature demos' (src/assets/demo/features)
//
// Each screen below is drawn as a small page and photographed with Chrome at
// 3x, the way a person would screenshot an app, then `gyotaku ocr --boxes`
// reads it. The demo searches exactly the text gyotaku read and lights the
// boxes it found, so what the page shows is what the app would do. Needs
// google-chrome and an installed gyotaku (cargo install --path crates/cli).
// No real person's data: every name, number and address is made up.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const SITE = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(SITE, "src/assets/demo");
const FONTS = join(SITE, "assets/fonts");
const W = 440;
const H = 330;
const SCALE = 3;

const font = (file: string) =>
  `data:font/ttf;base64,${readFileSync(join(FONTS, file)).toString("base64")}`;

const BASE_FONTS = `
@font-face { font-family: Inter; font-weight: 400; src: url(${font("Inter-400.ttf")}); }
@font-face { font-family: Inter; font-weight: 600; src: url(${font("Inter-600.ttf")}); }
* { box-sizing: border-box; margin: 0; padding: 0; }
`;

const BASE = `${BASE_FONTS}
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
body { font-family: Inter, sans-serif; -webkit-font-smoothing: antialiased; }
`;

type Screen = { id: string; name: string; css: string; html: string };

const SCREENS: Screen[] = [
  {
    id: "invoice",
    name: "an invoice email",
    css: `
      body { background: #fff; color: #1f1f1f; padding: 22px 24px; }
      .from { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #5f6368; }
      .avatar { width: 30px; height: 30px; border-radius: 50%; background: #2f6b4f; color: #fff; display: grid; place-items: center; font-weight: 600; font-size: 14px; }
      .from b { color: #1f1f1f; font-weight: 600; }
      .from .date { margin-left: auto; }
      h1 { font-size: 21px; font-weight: 600; margin: 20px 0 6px; letter-spacing: -0.01em; }
      .meta { font-size: 15px; color: #5f6368; }
      .due { margin-top: 26px; font-size: 13px; color: #5f6368; }
      .amount { font-size: 26px; font-weight: 600; margin-top: 2px; }
      .row { display: flex; align-items: end; justify-content: space-between; }
      .pay { background: #1f1f1f; color: #fff; font-size: 14px; font-weight: 600; padding: 10px 18px; border-radius: 8px; }
    `,
    html: `
      <div class="from"><div class="avatar">F</div><div><b>Fern &amp; Co</b><br>billing@fernandco.example</div><span class="date">Oct 3</span></div>
      <h1>Your invoice from Fern &amp; Co</h1>
      <div class="meta">Invoice #4021 · due 12 Oct</div>
      <div class="row"><div><div class="due">Amount due 2,340.00</div><div class="amount">₹ 2,340.00</div></div><div class="pay">Pay now</div></div>
    `,
  },
  {
    id: "otp",
    name: "a bank text message",
    css: `
      body { background: #f2f2f7; font-family: 'Noto Sans', sans-serif; color: #111; }
      .bar { background: #fff; padding: 14px; text-align: center; border-bottom: 1px solid #e3e3e8; }
      .dot { width: 34px; height: 34px; border-radius: 50%; background: #c7c7cc; margin: 0 auto 4px; }
      .bar b { font-size: 13px; font-weight: 500; }
      .thread { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
      .when { text-align: center; font-size: 11px; color: #8e8e93; }
      .in { align-self: flex-start; max-width: 80%; background: #e5e5ea; padding: 10px 13px; border-radius: 18px; font-size: 15px; line-height: 1.35; }
      .out { align-self: flex-end; background: #0a84ff; color: #fff; padding: 9px 13px; border-radius: 18px; font-size: 15px; }
    `,
    html: `
      <div class="bar"><div class="dot"></div><b>AX-NOVABK</b></div>
      <div class="thread">
        <div class="when">Today 09:41</div>
        <div class="in">Your OTP is 482913 for login to Nova Bank. Do not share it with anyone.</div>
        <div class="out">got it, thanks</div>
      </div>
    `,
  },
  {
    id: "terminal",
    name: "a terminal with a build error",
    css: `
      body { background: #15161a; color: #d7dae0; font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.55; }
      .title { height: 30px; display: flex; align-items: center; gap: 7px; padding: 0 12px; background: #1d1f24; border-bottom: 1px solid #2a2d33; }
      .title i { width: 11px; height: 11px; border-radius: 50%; display: block; }
      .title span { margin: 0 auto; color: #8b9099; font-size: 11px; }
      pre { padding: 12px 14px; white-space: pre-wrap; font: inherit; }
      .err { color: #ff6b6b; font-weight: 600; }
      .dim { color: #6b9eff; }
      .ok { color: #8bd5a0; }
    `,
    // Pasted from a real `cargo build` of a crate that uses an undefined value.
    html: `
      <div class="title"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span>zsh</span></div>
<pre><span class="ok">$</span> cargo build
<span class="ok">   Compiling</span> shots v0.1.0
<span class="err">error[E0425]</span>: cannot find value \`config\` in this scope
<span class="dim"> --&gt;</span> src/main.rs:2:16
<span class="dim">  |</span>
<span class="dim">2 |</span>     let path = config.screenshots_dir();
<span class="dim">  |</span>                <span class="err">^^^^^^ not found in this scope</span>

<span class="err">error</span>: could not compile \`shots\`</pre>
    `,
  },
  {
    id: "boarding",
    name: "a boarding pass",
    css: `
      body { background: #e9edf3; display: grid; place-items: center; }
      .pass { width: 404px; background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 3px rgb(0 0 0 / 0.12); }
      .band { background: #1d3a6b; color: #fff; display: flex; justify-content: space-between; padding: 10px 16px; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; }
      .route { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 4px; font-size: 30px; font-weight: 600; color: #14213d; }
      .cities { display: flex; justify-content: space-between; padding: 0 16px; font-size: 12px; color: #6b7280; }
      .tear { border-top: 2px dashed #d5dbe5; margin: 14px 16px; }
      .gate { padding: 0 16px; font-size: 18px; font-weight: 600; color: #14213d; }
      .row { display: flex; justify-content: space-between; padding: 10px 16px 16px; font-size: 14px; color: #14213d; }
      .row small { display: block; font-size: 10px; color: #6b7280; letter-spacing: 0.08em; }
    `,
    html: `
      <div class="pass">
        <div class="band"><span>BOARDING PASS</span><span>SK 2041</span></div>
        <div class="route"><span>DEL</span><span style="font-size:20px;color:#9aa4b2">✈</span><span>BOM</span></div>
        <div class="cities"><span>Delhi</span><span>Mumbai</span></div>
        <div class="tear"></div>
        <div class="gate">Gate 14 · boards 06:35</div>
        <div class="row"><span><small>SEAT</small>22A</span><span><small>CLASS</small>Economy</span><span><small>PNR</small>K7Q2ZD</span></div>
      </div>
    `,
  },
  {
    id: "wifi",
    name: "a Wi-Fi card",
    css: `
      body { background: #f6f5f2; color: #1c1c1e; padding: 26px; }
      h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }
      p { font-size: 13px; color: #6b6b70; margin-top: 4px; }
      .box { margin-top: 22px; display: flex; gap: 18px; align-items: center; }
      .rows { flex: 1; background: #fff; border-radius: 12px; border: 1px solid #e6e4df; }
      .rows div { padding: 13px 16px; font-size: 15px; }
      .rows div + div { border-top: 1px solid #eeece8; }
      .qr { width: 96px; height: 96px; background: repeating-conic-gradient(#1c1c1e 0 25%, #fff 0 50%) 0 0/16px 16px; border: 6px solid #fff; outline: 1px solid #e6e4df; border-radius: 6px; }
    `,
    html: `
      <h1>Guest Wi-Fi</h1>
      <p>Welcome! Scan the code or type it in.</p>
      <div class="box">
        <div class="rows"><div>Network: fernhouse-5g</div><div>Password: lemon-tree-42</div></div>
        <div class="qr"></div>
      </div>
    `,
  },
  {
    id: "sheet",
    name: "a budget spreadsheet",
    css: `
      body { background: #fff; color: #202124; font-size: 14px; }
      .top { background: #1e7a46; color: #fff; padding: 10px 14px; font-weight: 600; font-size: 15px; }
      table { width: 100%; border-collapse: collapse; }
      td, th { border: 1px solid #e2e3e5; padding: 8px 12px; text-align: left; }
      th { background: #f6f7f8; color: #6b6f76; font-weight: 400; font-size: 12px; text-align: center; }
      td.n { text-align: right; font-variant-numeric: tabular-nums; }
      td.i { width: 34px; background: #f6f7f8; color: #6b6f76; text-align: center; font-size: 12px; }
      tr.total td { font-weight: 600; }
    `,
    html: `
      <div class="top">Q3 budget</div>
      <table>
        <tr><th></th><th>A</th><th>B</th></tr>
        <tr><td class="i">1</td><td>Rent</td><td class="n">1,200</td></tr>
        <tr><td class="i">2</td><td>Travel</td><td class="n">340</td></tr>
        <tr><td class="i">3</td><td>Groceries</td><td class="n">610</td></tr>
        <tr class="total"><td class="i">4</td><td>Total</td><td class="n">2,150</td></tr>
      </table>
    `,
  },
  {
    id: "notes",
    name: "a shopping list note",
    css: `
      body { background: #fdf8e7; color: #2b2a26; padding: 24px 26px; }
      .head { display: flex; justify-content: space-between; align-items: baseline; }
      h1 { font-size: 24px; font-weight: 600; }
      .head span { font-size: 12px; color: #9a9378; }
      ul { list-style: none; margin-top: 16px; display: flex; flex-direction: column; gap: 11px; font-size: 16px; }
      li { display: flex; align-items: center; gap: 10px; }
      li i { width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid #b9b39a; display: block; }
      li.done { color: #a19b84; text-decoration: line-through; }
      li.done i { background: #d9a531; border-color: #d9a531; }
    `,
    html: `
      <div class="head"><h1>Shopping</h1><span>5 items</span></div>
      <ul>
        <li><i></i>oat milk</li>
        <li class="done"><i></i>basil</li>
        <li><i></i>eggs x12</li>
        <li><i></i>dish soap</li>
        <li><i></i>coffee beans</li>
      </ul>
    `,
  },
  {
    id: "map",
    name: "a delivery address on a map",
    css: `
      body { background: #e8eee6; position: relative; }
      .road { position: absolute; background: #fff; }
      .park { position: absolute; background: #cfe3c6; border-radius: 4px; }
      .water { position: absolute; background: #c6dcf0; border-radius: 6px; }
      .pin { position: absolute; left: 286px; top: 74px; width: 18px; height: 18px; border-radius: 50%; background: #e2442f; border: 3px solid #fff; box-shadow: 0 1px 4px rgb(0 0 0 / 0.3); }
      .card { position: absolute; left: 14px; right: 14px; bottom: 14px; background: #fff; border-radius: 12px; padding: 14px 16px; box-shadow: 0 2px 10px rgb(0 0 0 / 0.12); }
      .card small { font-size: 11px; color: #6b7280; letter-spacing: 0.04em; }
      .card b { display: block; font-size: 18px; font-weight: 600; margin-top: 2px; color: #111827; }
      .card p { font-size: 14px; color: #374151; margin-top: 2px; }
    `,
    html: `
      <div class="road" style="left:0;right:0;top:120px;height:14px;transform:rotate(-8deg)"></div>
      <div class="road" style="top:0;bottom:0;left:250px;width:12px;transform:rotate(6deg)"></div>
      <div class="park" style="left:40px;top:30px;width:90px;height:60px"></div>
      <div class="water" style="left:330px;top:20px;width:80px;height:50px"></div>
      <div class="pin"></div>
      <div class="card"><small>DELIVERY ADDRESS</small><b>221 Lake Road</b><p>Jodhpur 342030 · call on arrival</p></div>
    `,
  },
];

type Line = { text: string; x: number; y: number; w: number; h: number; score: number };

function ocr(png: string, scripts: string[] = []): Line[] {
  const args = ["ocr", "--boxes", ...scripts.flatMap((s) => ["--script", s]), png];
  // GYOTAKU picks a specific build, for when an older one is first on PATH.
  const out = execFileSync(process.env.GYOTAKU ?? "gyotaku", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return out
    .split("\n")
    .map((row) => row.match(/^([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)\s+([\d.]+)\s+(.*)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({
      x: +m[1],
      y: +m[2],
      w: +m[3],
      h: +m[4],
      score: +m[5],
      text: m[6],
    }));
}

if (process.argv[2] === "features") {
  const { makeFeatures } = await import("./feature-shots");
  await makeFeatures({ ocr, base: BASE_FONTS, site: SITE });
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });

for (const s of SCREENS) {
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${BASE}${s.css}</style>${s.html}`);
  await page.evaluate(() => document.fonts.ready);
  const png = join(OUT, `${s.id}.png`);
  await page.screenshot({ path: png });
  const lines = ocr(png);
  // WebP for the site; the PNG is only what gyotaku read.
  execFileSync("magick", [png, "-quality", "82", join(OUT, `${s.id}.webp`)]);
  execFileSync("rm", [png]);
  writeFileSync(
    join(OUT, `${s.id}.json`),
    `${JSON.stringify({ id: s.id, name: s.name, lines }, null, 2)}\n`,
  );
  console.log(`${s.id}: ${lines.map((l) => l.text).join(" | ")}`);
}
await browser.close();

// One module the demo imports, so every image is a static import (sized, with
// a blur placeholder) and every reading sits next to its picture.
const index = [
  "// Generated by scripts/demo-shots.ts. Don't edit by hand.",
  ...SCREENS.flatMap((s, i) => [
    `import img${i} from "./${s.id}.webp";`,
    `import ocr${i} from "./${s.id}.json";`,
  ]),
  "",
  "export const DEMO_SHOTS = [",
  ...SCREENS.map((_, i) => `  { ...ocr${i}, image: img${i} },`),
  "];",
  "",
].join("\n");
writeFileSync(join(OUT, "index.ts"), index);
