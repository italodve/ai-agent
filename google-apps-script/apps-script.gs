/**
 * Backend opcional do Painel Sua Imobiliária no Google Apps Script.
 *
 * Permite salvar os IMÓVEIS na própria planilha (nuvem) e ler imóveis + leads
 * de qualquer dispositivo. Sem isto, o painel funciona em modo local
 * (imóveis no navegador) e lê os leads direto da planilha via gviz.
 *
 * COMO USAR:
 * 1. Abra a planilha de leads no Google Sheets.
 * 2. Crie duas abas com estes nomes exatos: "Leads" e "Imoveis".
 *    - "Leads": colunas A=Data, B=Sessão, C=Dados, D=Origem (já alimentada
 *      pelo webhook do ai-agent).
 *    - "Imoveis": deixe vazia; o cabeçalho é criado automaticamente.
 * 3. Extensões > Apps Script, apague tudo e cole este arquivo.
 * 4. Implantar > Nova implantação > App da Web > acesso "Qualquer pessoa".
 * 5. Copie a URL /exec e cole em CONFIG.WEB_APP_URL no app.js do painel.
 */

const LEADS_SHEET = "Leads";
const PROPS_SHEET = "Imoveis";
const PROP_HEADER = [
  "id", "titulo", "tipo", "finalidade", "status", "preco",
  "bairro", "cidade", "quartos", "banheiros", "vagas", "area", "foto", "descricao"
];

function doGet(e) {
  const action = (e.parameter.action || "").toLowerCase();
  if (action === "leads") return json(readLeads());
  if (action === "properties") return json(readProperties());
  return json({ ok: true, service: "painel-mf" });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents || "{}");
  if (body.action === "saveProperty") return json(saveProperty(body.property));
  if (body.action === "deleteProperty") return json(deleteProperty(body.id));
  if (body.action === "deleteLead") return json(deleteLead(body.id));
  return json({ ok: false, error: "ação desconhecida" });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function readLeads() {
  const rows = sheet(LEADS_SHEET).getDataRange().getValues();
  return rows.map(function (r, i) {
    return { id: (r[1] || "row") + "-" + i, date: String(r[0] || ""), data: String(r[2] || r[1] || ""), source: String(r[3] || "") };
  });
}

// Remove a linha do lead correspondente ao id (formato "<sessão>-<índice da linha>",
// gerado pela mesma lógica de readLeads).
function deleteLead(id) {
  const sh = sheet(LEADS_SHEET);
  const rows = sh.getDataRange().getValues();
  for (var i = 0; i < rows.length; i++) {
    var rowId = (rows[i][1] || "row") + "-" + i;
    if (rowId === id) {
      sh.deleteRow(i + 1);
      return { ok: true, deleted: true };
    }
  }
  return { ok: false, error: "não encontrado" };
}

function propsSheet() {
  const sh = sheet(PROPS_SHEET);
  if (sh.getLastRow() === 0) sh.appendRow(PROP_HEADER);
  return sh;
}

function readProperties() {
  const sh = propsSheet();
  const values = sh.getDataRange().getValues();
  const header = values.shift() || PROP_HEADER;
  return values
    .filter(function (r) { return r[0]; })
    .map(function (r) {
      const obj = {};
      header.forEach(function (key, i) { obj[key] = r[i]; });
      return obj;
    });
}

function saveProperty(p) {
  const sh = propsSheet();
  const values = sh.getDataRange().getValues();
  const row = PROP_HEADER.map(function (k) { return p[k] != null ? p[k] : ""; });
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === p.id) {
      sh.getRange(i + 1, 1, 1, PROP_HEADER.length).setValues([row]);
      return { ok: true, updated: true };
    }
  }
  sh.appendRow(row);
  return { ok: true, created: true };
}

function deleteProperty(id) {
  const sh = propsSheet();
  const values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sh.deleteRow(i + 1);
      return { ok: true, deleted: true };
    }
  }
  return { ok: false, error: "não encontrado" };
}
