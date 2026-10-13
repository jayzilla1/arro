// Builds figma.html: every Arro screen side by side as static phone frames,
// so a Figma import plugin (html.to.design) can bring them all in at once.
// Run from the repo root: node tools/make-figma-page.js
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const W = 390, H = 844;
const SCREENS = [
  ["splash", "1 Splash"], ["welcome", "2 Welcome"], ["need", "3 What do you need"],
  ["estimate", "4 Estimate your cost"], ["discover", "5 Discover"], ["place-1", "6 Place details"],
  ["saved", "7 Saved"], ["rights", "8 Know your rights"], ["profile", "9 Profile"],
];

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]) === "/" ? "index.html" : req.url.split("?")[0]);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    const type = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" }[path.extname(file)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type }); res.end(data);
  });
}).listen(0);

(async () => {
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const frames = [];
  for (const [route, label] of SCREENS) {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.goto(base + "#" + route);
    await page.waitForTimeout(600);
    frames.push(await page.evaluate(([label]) => {
      const symbols = Object.fromEntries([...document.querySelectorAll("symbol")].map(s => [s.id, s]));
      const parts = [document.querySelector(".screen.active")];
      const tabbar = document.getElementById("tabbar");
      if (!tabbar.hidden) parts.push(tabbar);
      // Mark anything the browser isn't showing, so it is left out of the copy.
      parts.forEach(el => el.querySelectorAll("*").forEach(n => {
        if (getComputedStyle(n).display === "none") n.setAttribute("data-drop", "");
      }));
      const html = parts.map(el => {
        const c = el.cloneNode(true);
        c.querySelectorAll("[data-drop]").forEach(n => n.remove());
        // Inline each icon so Figma gets real vector paths instead of <use> references.
        c.querySelectorAll("svg use").forEach(u => {
          const sym = symbols[(u.getAttribute("href") || "").slice(1)];
          const svg = u.closest("svg");
          if (!sym) return;
          svg.setAttribute("viewBox", sym.getAttribute("viewBox"));
          svg.innerHTML = sym.innerHTML;
        });
        return c.outerHTML;
      }).join("\n");
      return `<figure class="frame"><figcaption>${label}</figcaption><main class="app" data-name="${label}">${html}</main></figure>`;
    }, [label]));
    await page.close();
  }
  await browser.close(); server.close();

  const head = fs.readFileSync(path.join(ROOT, "index.html"), "utf8").match(/<head>[\s\S]*?<\/head>/)[0]
    .replace(/<title>.*<\/title>/, "<title>Arro · all screens for Figma</title>");
  const out = `<!doctype html>
<html lang="en">
${head.replace("</head>", `  <style>
    /* Lay every screen out as a fixed-size phone frame, side by side. */
    body { background: #E4E1DA; margin: 0; }
    /* Three across fits the plugin's 1440px desktop width. */
    .board { display: grid; grid-template-columns: repeat(3, ${W}px); gap: 64px 56px; padding: 64px 56px; width: max-content; }
    .frame { margin: 0; }
    .frame figcaption { font: 600 14px/1 Figtree, sans-serif; color: #4A5263; margin-bottom: 12px; }
    .frame .app { width: ${W}px; max-width: none; height: ${H}px; min-height: 0; margin: 0; overflow: hidden; transform: translateZ(0); }
    .frame .screen { min-height: ${H}px; animation: none; }
    .frame .discover { height: ${H}px; min-height: 0; }
    .frame .tabbar, .frame .place-top { position: absolute; }
    .frame * { animation: none !important; transition: none !important; }
  </style>
</head>`)}
<body>
  <div class="board">
${frames.join("\n")}
  </div>
</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, "figma.html"), out);
  console.log("Wrote figma.html with", frames.length, "screens");
})();
