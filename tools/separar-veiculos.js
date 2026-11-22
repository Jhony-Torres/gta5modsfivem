// Separa cada veículo de um resource compartilhado em um resource FiveM próprio.
const fs = require("fs");
const path = require("path");
const ROOT = "D:/BaseWickSP/nova-data/resources/[CARROS]";
const OUT = process.argv[2];
const LIST = {
  viaturas_pmesp: ["hiluxpf", "hiluxsw4rota", "sw4tatico", "sw4tor", "corollator", "trailpf", "trailrota", "xre2019", "palioadv", "spinrp3"],
  vrp_viaturas: ["africaprf", "corollapc", "corprf", "cruzeprf2", "l200prf", "trailprf", "dusterpc", "voyagepc"],
  hiluxpmerj1: ["hiluxpmerj1"],
  pcdenarc: ["pcdenarc"],
};

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "latin1") : null);
function findMeta(dir, name) {
  for (const p of [path.join(dir, "data", name), path.join(dir, name)]) if (fs.existsSync(p)) return p;
  return null;
}
// Divide <Item>...</Item> de primeiro nível dentro de um bloco
function items(block) {
  const out = [];
  let i = 0;
  while (true) {
    const s = block.indexOf("<Item", i);
    if (s < 0) break;
    let depth = 0, j = s;
    const re = /<Item\b[^>]*?(\/?)>|<\/Item>/g;
    re.lastIndex = s;
    let m;
    while ((m = re.exec(block))) {
      if (m[0] === "</Item>") depth--;
      else if (m[1] !== "/") depth++;
      else if (depth === 0) { j = re.lastIndex; break; }
      if (depth === 0) { j = re.lastIndex; break; }
    }
    out.push(block.slice(s, j));
    i = j;
  }
  return out;
}
function section(xml, tag) {
  const s = xml.indexOf(`<${tag}>`);
  const e = xml.indexOf(`</${tag}>`, s);
  if (s < 0 || e < 0) return null;
  return { s: s + tag.length + 2, e, body: xml.slice(s + tag.length + 2, e) };
}
const tagv = (it, t) => (it.match(new RegExp(`<${t}>\\s*([^<]*?)\\s*</${t}>`, "i")) || [])[1];

const report = [];
for (const [res, models] of Object.entries(LIST)) {
  const dir = path.join(ROOT, res);
  const streamDir = fs.readdirSync(dir).find((d) => d.toLowerCase() === "stream");
  const streamFiles = streamDir ? fs.readdirSync(path.join(dir, streamDir)) : [];
  const vm = read(findMeta(dir, "vehicles.meta"));
  const hm = read(findMeta(dir, "handling.meta"));
  const cv = read(findMeta(dir, "carvariations.meta"));
  const cc = read(findMeta(dir, "carcols.meta"));
  const vInit = section(vm, "InitDatas");
  const vItems = items(vInit.body);
  const vRel = section(vm, "txdRelationships");
  const relItems = vRel ? items(vRel.body) : [];

  for (const model of models) {
    const it = vItems.find((x) => (tagv(x, "modelName") || "").toLowerCase() === model);
    if (!it) { report.push({ model, error: "sem entrada no vehicles.meta" }); continue; }
    const txd = (tagv(it, "txdName") || model).toLowerCase();
    const handlingId = (tagv(it, "handlingId") || model).toLowerCase();
    // cadeia de texturas pai
    const txds = new Set([model, txd]);
    const rels = [];
    let cur = txd;
    for (let k = 0; k < 5; k++) {
      const r = relItems.find((x) => (tagv(x, "child") || "").toLowerCase() === cur);
      if (!r) break;
      rels.push(r);
      cur = (tagv(r, "parent") || "").toLowerCase();
      if (!cur || cur === "vehshare") break;
      txds.add(cur);
    }
    const want = (f) => {
      const b = f.toLowerCase().replace(/\.(yft|ytd)$/, "");
      if (txds.has(b) || txds.has(b.replace(/\+hi$/, "")) || b === model + "_hi") return true;
      return b.startsWith(model + "_") && /\.(yft|ytd)$/i.test(f);
    };
    const files = streamFiles.filter(want);
    const dest = path.join(OUT, model);
    fs.mkdirSync(path.join(dest, "stream"), { recursive: true });
    fs.mkdirSync(path.join(dest, "data"), { recursive: true });
    for (const f of files) fs.copyFileSync(path.join(dir, streamDir, f), path.join(dest, "stream", f));

    const head = (xml) => xml.slice(0, xml.indexOf("<", 2) > 0 ? 0 : 0);
    // vehicles.meta
    let v = vm.slice(0, vInit.s) + "\n" + it + "\n" + vm.slice(vInit.e);
    if (vRel) {
      const vr = section(v, "txdRelationships");
      v = v.slice(0, vr.s) + "\n" + rels.join("\n") + "\n" + v.slice(vr.e);
    }
    fs.writeFileSync(path.join(dest, "data", "vehicles.meta"), v, "latin1");
    const metas = ["vehicles.meta"];
    // handling.meta
    if (hm) {
      const hs = section(hm, "HandlingData");
      const h = items(hs.body).find((x) => (tagv(x, "handlingName") || "").toLowerCase() === handlingId);
      if (h) { fs.writeFileSync(path.join(dest, "data", "handling.meta"), hm.slice(0, hs.s) + "\n" + h + "\n" + hm.slice(hs.e), "latin1"); metas.push("handling.meta"); }
    }
    // carvariations.meta
    if (cv) {
      const cs = section(cv, "variationData");
      const c = cs && items(cs.body).find((x) => (tagv(x, "modelName") || "").toLowerCase() === model);
      if (c) { fs.writeFileSync(path.join(dest, "data", "carvariations.meta"), cv.slice(0, cs.s) + "\n" + c + "\n" + cv.slice(cs.e), "latin1"); metas.push("carvariations.meta"); }
    }
    // carcols.meta (kits e sirenes compartilhados: arquivo completo)
    if (cc) { fs.writeFileSync(path.join(dest, "data", "carcols.meta"), cc, "latin1"); metas.push("carcols.meta"); }

    const types = { "vehicles.meta": "VEHICLE_METADATA_FILE", "handling.meta": "HANDLING_FILE", "carvariations.meta": "VEHICLE_VARIATION_FILE", "carcols.meta": "CARCOLS_FILE" };
    const order = ["handling.meta", "vehicles.meta", "carcols.meta", "carvariations.meta"].filter((m) => metas.includes(m));
    fs.writeFileSync(
      path.join(dest, "fxmanifest.lua"),
      `fx_version 'cerulean'\ngame 'gta5'\n\ndescription '${model} - pacote gta5modsfivem.com.br'\n\nfiles {\n${order.map((m) => `  'data/${m}'`).join(",\n")}\n}\n\n${order.map((m) => `data_file '${types[m]}' 'data/${m}'`).join("\n")}\n`
    );
    fs.writeFileSync(
      path.join(dest, "LEIA-ME.txt"),
      `${model} - viatura para FiveM\r\n\r\nInstalacao:\r\n1. Coloque a pasta "${model}" dentro de resources do seu servidor.\r\n2. Adicione "ensure ${model}" no server.cfg.\r\n3. Reinicie o servidor. Spawn pelo nome: ${model}\r\n\r\nDistribuido por gta5modsfivem.com.br\r\n`
    );
    const size = files.reduce((s, f) => s + fs.statSync(path.join(dir, streamDir, f)).size, 0);
    const it2 = it;
    report.push({ model, res, gameName: tagv(it2, "gameName"), make: tagv(it2, "vehicleMakeName"), type: tagv(it2, "type"), layout: tagv(it2, "layout"), files, metas, mb: +(size / 1048576).toFixed(1) });
  }
}
fs.writeFileSync(path.join(OUT, "_report.json"), JSON.stringify(report, null, 1));
for (const r of report) console.log(r.model, r.error || `${r.files.length} arquivos ${r.mb}MB metas=${r.metas.length} game=${r.gameName} layout=${r.layout}`);
