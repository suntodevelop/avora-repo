import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
// Keep the supplied artwork. Estimate its white matte per channel, then subtract
// the matte before compositing so downscaled edges do not carry white fringes.
const filter =
  '<filter id="remove-white" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="red"/><feColorMatrix in="SourceGraphic" values="0 1 0 0 0  0 1 0 0 0  0 1 0 0 0  0 0 0 0 1" result="green"/><feColorMatrix in="SourceGraphic" values="0 0 1 0 0  0 0 1 0 0  0 0 1 0 0  0 0 0 0 1" result="blue"/><feBlend in="red" in2="green" mode="darken" result="min-rg"/><feBlend in="min-rg" in2="blue" mode="darken" result="min-rgb"/><feComponentTransfer in="min-rgb" result="normalized-white"><feFuncR type="linear" slope="1.030928"/><feFuncG type="linear" slope="1.030928"/><feFuncB type="linear" slope="1.030928"/></feComponentTransfer><feComponentTransfer in="normalized-white" result="white-strength"><feFuncR type="gamma" amplitude="1" exponent="4" offset="0"/><feFuncG type="gamma" amplitude="1" exponent="4" offset="0"/><feFuncB type="gamma" amplitude="1" exponent="4" offset="0"/></feComponentTransfer><feColorMatrix in="white-strength" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1 0 0 0 0" result="white-matte"/><feComposite in="SourceGraphic" in2="white-matte" operator="arithmetic" k1="0" k2="1" k3="-1" k4="0"/></filter>';
const source = readFileSync("public/brand/avora-logo.jpg").toString("base64");
function svg(viewBox, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${viewBox}"><title>${title}</title><defs>${filter}</defs><image width="1254" height="1254" filter="url(#remove-white)" xlink:href="data:image/jpeg;base64,${source}"/></svg>`;
}
for (const file of [
  "public/brand/avora-logo.svg",
  "public/brand/avora-logo-transparent.svg",
])
  writeFileSync(file, svg("40 160 1170 990", "AVORA MEDIA"));
for (const file of ["public/brand/avora-mark.svg"])
  writeFileSync(file, svg("175 165 990 675", "AVORA"));

// Render only the cropped symbol into the favicon pixel canvas. No letter pixels
// are present in these files, including when Chrome ignores an SVG viewport.
const symbol = Buffer.from(svg("175 165 990 675", "AVORA"));
const sizes = [32, 48, 64];
const entries = [];
for (const size of sizes) {
  const png = await sharp(symbol)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  entries.push({ size, png });
  if (size === 64)
    writeFileSync("public/brand/favicon-avora-symbol-v2.png", png);
}
const header = Buffer.alloc(6 + 16 * entries.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);
let offset = header.length;
entries.forEach(({ size, png }, index) => {
  const start = 6 + index * 16;
  header[start] = size;
  header[start + 1] = size;
  header.writeUInt16LE(1, start + 4);
  header.writeUInt16LE(32, start + 6);
  header.writeUInt32LE(png.length, start + 8);
  header.writeUInt32LE(offset, start + 12);
  offset += png.length;
});
const ico = Buffer.concat([header, ...entries.map((entry) => entry.png)]);
writeFileSync("public/brand/favicon-avora-symbol-v2.ico", ico);
writeFileSync("public/favicon.ico", ico);
