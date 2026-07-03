/* =========================================================================
 * Painel Sua Imobiliária — cadastro de imóveis e gestão de leads
 *
 * CONFIGURAÇÃO:
 * - SHEET_ID: ID da planilha do Google com os leads (já preenchido).
 *   A aba precisa estar acessível ("Qualquer pessoa com o link pode ver").
 * - LEADS_SHEET: nome da aba onde os leads são gravados.
 * - WEB_APP_URL: (opcional) URL de um Apps Script para salvar os imóveis na
 *   nuvem e ler tudo de qualquer dispositivo. Sem isso, os imóveis ficam
 *   salvos apenas neste navegador (localStorage) e os leads são lidos
 *   diretamente da planilha.
 * ========================================================================= */
const CONFIG = {
  SHEET_ID: "1Z1-IkTqozPVzWIdQiZt-rbIxF0XaDfOVn33WxEkY-QI",
  LEADS_SHEET: "Leads",
  WEB_APP_URL: ""
};

const STORE_PROPS = "mf_properties";
const STORE_LEAD_STATUS = "mf_lead_status";
const STORE_LEAD_REMOVED = "mf_lead_removed";
const STORE_WEBAPP = "mf_webapp_url";
const LEAD_STATUSES = ["novo", "aquecido", "vendido"];
const LEAD_STATUS_LABEL = { novo: "Lead novo", aquecido: "Lead aquecido", vendido: "Lead vendido" };
// Compatibilidade com status antigos salvos no navegador.
const LEAD_STATUS_ALIASES = { contatado: "aquecido", fechado: "vendido", descartado: "novo" };

const normalizeLeadStatus = (value) => {
  const s = String(value || "").toLowerCase().trim();
  if (LEAD_STATUSES.includes(s)) return s;
  return LEAD_STATUS_ALIASES[s] || "";
};

// Status guardado neste navegador — usado no modo local e como reserva
// enquanto a planilha ainda não tem status gravado para o lead.
const storedLeadStatus = (id) => normalizeLeadStatus(state.leadStatus[id]) || "novo";

const leadStatusOf = (id) => {
  const lead = state.leads.find((l) => l.id === id);
  return lead ? lead.status : storedLeadStatus(id);
};

/* ---------- utilidades ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const safeParse = (raw, fallback) => {
  try {
    return JSON.parse(raw) || fallback;
  } catch {
    return fallback;
  }
};
const readStore = (key, fallback) => safeParse(localStorage.getItem(key), fallback);
const writeStore = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* armazenamento indisponível */
  }
};

// A URL do Apps Script (modo nuvem) pode ser configurada pela própria interface
// e fica salva no navegador, sobrepondo o valor de CONFIG.WEB_APP_URL. Assim o
// painel passa a gravar os imóveis na planilha — de onde o site público os lê —
// sem precisar editar o código.
CONFIG.WEB_APP_URL = readStore(STORE_WEBAPP, "") || CONFIG.WEB_APP_URL;

const formatBRL = (value) => {
  const n = Number(value);
  if (!value || Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};

const escapeHtml = (str) =>
  String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Formata a data do lead (aceita ISO ou texto livre).
const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

// Quebra o campo "Dados" do lead (ex.: "Nome: Italo | Interesse: comprar")
// em pares rótulo/valor para exibição organizada.
const parseLeadFields = (data) =>
  String(data || "")
    .split(/\s*\|\s*|\s*;\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^([^:]{1,40}):\s*(.+)$/);
      return m ? { label: m[1].trim(), value: m[2].trim() } : { label: "", value: part };
    });

const leadName = (fields) => {
  const nome = fields.find((f) => /nome/i.test(f.label));
  return (nome ? nome.value : fields[0] && fields[0].value) || "Lead";
};

// Tags com os demais dados (valor formatado como moeda).
const leadTagsHtml = (fields) =>
  fields
    .filter((f) => !/nome/i.test(f.label))
    .map((f) => {
      const value = /valor|pre[çc]o/i.test(f.label) ? formatBRL(f.value.replace(/[^\d]/g, "")) : f.value;
      return `<span class="pl-tag">${escapeHtml(value)}</span>`;
    })
    .join("");

let toastTimer;
const toast = (message) => {
  const el = $("[data-toast]");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
};

/* ---------- estado ---------- */
const state = {
  properties: [],
  leads: [],
  leadStatus: readStore(STORE_LEAD_STATUS, {}),
  isDraggingLead: false
};

/* ---------- camada de dados: LEADS ---------- */
// Lê os leads da planilha via endpoint gviz (não precisa publicar a planilha,
// basta o compartilhamento "qualquer pessoa com o link pode ver").
async function fetchLeadsFromSheet() {
  const removed = readStore(STORE_LEAD_REMOVED, []);

  // O status gravado na planilha (coluna E) tem prioridade; se a planilha
  // ainda não tiver status para o lead, vale o guardado neste navegador.
  const withStatus = (l) => ({ ...l, status: normalizeLeadStatus(l.status) || storedLeadStatus(l.id) });

  if (CONFIG.WEB_APP_URL) {
    const res = await fetch(`${CONFIG.WEB_APP_URL}?action=leads`);
    if (!res.ok) throw new Error(`web app ${res.status}`);
    const leads = await res.json();
    return leads.filter((l) => !removed.includes(l.id)).map(withStatus);
  }

  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
    CONFIG.LEADS_SHEET
  )}`;
  const res = await fetch(url);
  const text = await res.text();
  const json = JSON.parse(text.replace(/^[\s\S]*?setResponse\(/, "").replace(/\);?\s*$/, ""));
  const rows = json.table.rows || [];

  return rows
    .map((row, index) => {
      const cells = (row.c || []).map((cell) => (cell && cell.v != null ? String(cell.v) : ""));
      return {
        id: `${cells[1] || "row"}-${index}`,
        date: cells[0] || "",
        data: cells[2] || cells[1] || "",
        source: cells[3] || "",
        status: cells[4] || ""
      };
    })
    .filter((l) => !removed.includes(l.id))
    .map(withStatus);
}

// Salva o status do lead em tempo real: atualiza a tela na hora, guarda uma
// cópia neste navegador e, em modo nuvem, grava na coluna E da planilha —
// assim o status aparece igual em qualquer dispositivo.
async function persistLeadStatus(id, status) {
  if (!id || !LEAD_STATUSES.includes(status)) return;
  if (leadStatusOf(id) === status) return;

  const lead = state.leads.find((l) => l.id === id);
  if (lead) lead.status = status;
  state.leadStatus[id] = status;
  writeStore(STORE_LEAD_STATUS, state.leadStatus);
  renderOverview();
  renderLeads();

  if (!CONFIG.WEB_APP_URL) return;
  try {
    const res = await fetch(CONFIG.WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "setLeadStatus", id, status })
    });
    if (!res.ok) throw new Error(`web app ${res.status}`);
  } catch {
    toast("Não deu para gravar o status na planilha — ficou salvo só neste navegador.");
  }
}

// Remove um lead: apaga na planilha (via Apps Script, se configurado) e
// sempre oculta localmente, já que a leitura padrão via gviz é somente
// leitura e não permite apagar linhas diretamente.
async function removeLead(id) {
  if (CONFIG.WEB_APP_URL) {
    try {
      await fetch(CONFIG.WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "deleteLead", id })
      });
    } catch {
      /* ignora; ocultamos localmente abaixo */
    }
  }
  const removed = readStore(STORE_LEAD_REMOVED, []);
  if (!removed.includes(id)) {
    removed.push(id);
    writeStore(STORE_LEAD_REMOVED, removed);
  }
  delete state.leadStatus[id];
  writeStore(STORE_LEAD_STATUS, state.leadStatus);
}

/* ---------- camada de dados: IMÓVEIS ---------- */
async function fetchProperties() {
  if (CONFIG.WEB_APP_URL) {
    try {
      const res = await fetch(`${CONFIG.WEB_APP_URL}?action=properties`);
      if (res.ok) return await res.json();
    } catch {
      /* cai para o armazenamento local */
    }
  }
  return readStore(STORE_PROPS, []);
}

async function persistProperty(property) {
  if (CONFIG.WEB_APP_URL) {
    try {
      await fetch(CONFIG.WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "saveProperty", property })
      });
    } catch {
      /* ignora; mantém cópia local abaixo */
    }
  }
  const list = readStore(STORE_PROPS, []);
  const idx = list.findIndex((p) => p.id === property.id);
  if (idx >= 0) list[idx] = property;
  else list.push(property);
  writeStore(STORE_PROPS, list);
}

async function removeProperty(id) {
  if (CONFIG.WEB_APP_URL) {
    try {
      await fetch(CONFIG.WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "deleteProperty", id })
      });
    } catch {
      /* ignora */
    }
  }
  writeStore(STORE_PROPS, readStore(STORE_PROPS, []).filter((p) => p.id !== id));
}

/* ---------- carregamento ---------- */
async function loadAll() {
  state.properties = await fetchProperties();
  try {
    state.leads = await fetchLeadsFromSheet();
    setConnection(true);
  } catch (err) {
    // Mantém os leads já carregados: uma falha passageira de rede (inclusive
    // na atualização automática) não deve esvaziar o painel.
    console.warn("Falha ao ler leads da planilha:", err.message);
    setConnection(false);
  }
  renderAll();
}

function setConnection(online) {
  const cloud = Boolean(CONFIG.WEB_APP_URL);
  const dot = $("[data-conn-dot]");
  dot.classList.toggle("is-online", online);
  dot.classList.toggle("is-cloud", online && cloud);
  $("[data-conn-label]").textContent = !online
    ? "Sem conexão"
    : cloud
      ? "Modo nuvem"
      : "Modo local";
}

/* ---------- render: VISÃO GERAL ---------- */
function renderOverview() {
  const props = state.properties;
  const available = props.filter((p) => p.status === "Disponível").length;
  const newLeads = state.leads.filter((l) => l.status === "novo").length;

  $('[data-kpi="properties"]').textContent = props.length;
  $('[data-kpi="available"]').textContent = available;
  $('[data-kpi="leads"]').textContent = state.leads.length;
  $('[data-kpi="newLeads"]').textContent = newLeads;

  const statuses = ["Disponível", "Reservado", "Vendido", "Locado"];
  const max = Math.max(1, ...statuses.map((s) => props.filter((p) => p.status === s).length));
  $("[data-status-chart]").innerHTML = statuses
    .map((s) => {
      const count = props.filter((p) => p.status === s).length;
      return `<div class="bar-item"><span>${s}</span><div class="bar-track"><div class="bar-fill" style="width:${
        (count / max) * 100
      }%"></div></div><b>${count}</b></div>`;
    })
    .join("");

  renderPipeline();
}

// Funil de leads: uma coluna por etapa (novo / aquecido / vendido), com os
// leads dentro e a opção de mover de etapa ali mesmo.
function renderPipeline() {
  const board = $("[data-pipeline]");
  if (state.leads.length === 0) {
    board.innerHTML = '<p class="empty-state">Sem leads ainda. Eles aparecem aqui assim que chegam pela planilha.</p>';
    return;
  }

  board.innerHTML = LEAD_STATUSES.map((status) => {
    const leads = state.leads.filter((l) => l.status === status);
    const cards = leads
      .map((l) => {
        const fields = parseLeadFields(l.data);
        const meta = [formatDate(l.date), l.source].filter(Boolean).map(escapeHtml).join(" · ");
        const options = LEAD_STATUSES.map(
          (s) => `<option value="${s}" ${s === status ? "selected" : ""}>${LEAD_STATUS_LABEL[s]}</option>`
        ).join("");
        return `<div class="pl-card" draggable="true" data-lead-id="${escapeHtml(l.id)}">
          <div class="pl-card-head">
            <p class="pl-name">${escapeHtml(leadName(fields))}</p>
            <button class="pl-delete" data-delete-lead="${escapeHtml(l.id)}" type="button" title="Excluir lead">×</button>
          </div>
          <div class="pl-tags">${leadTagsHtml(fields)}</div>
          ${meta ? `<small>${meta}</small>` : ""}
          <select class="lead-status-select" data-lead-status="${escapeHtml(l.id)}">${options}</select>
        </div>`;
      })
      .join("");
    return `<div class="pl-col pl-${status}" data-status="${status}">
      <div class="pl-col-head"><span>${LEAD_STATUS_LABEL[status]}</span><b>${leads.length}</b></div>
      <div class="pl-col-body">${cards || '<p class="pl-empty">Solte um lead aqui</p>'}</div>
    </div>`;
  }).join("");
}

/* ---------- render: IMÓVEIS ---------- */
function renderProperties() {
  const term = $("[data-property-search]").value.trim().toLowerCase();
  const filter = $("[data-property-filter]").value;
  const grid = $("[data-property-grid]");

  const list = state.properties.filter((p) => {
    const matchTerm =
      !term ||
      [p.titulo, p.bairro, p.cidade, p.tipo].some((v) => String(v || "").toLowerCase().includes(term));
    const matchStatus = !filter || p.status === filter;
    return matchTerm && matchStatus;
  });

  $("[data-property-empty]").hidden = state.properties.length !== 0;

  grid.innerHTML = list
    .map((p) => {
      const photo = p.foto
        ? `<div class="property-photo" style="background-image:url('${escapeHtml(p.foto)}')"></div>`
        : `<div class="property-photo">${escapeHtml(p.tipo || "Imóvel")}</div>`;
      const meta = [
        p.quartos ? `${p.quartos} quartos` : "",
        p.banheiros ? `${p.banheiros} banh.` : "",
        p.vagas ? `${p.vagas} vagas` : "",
        p.area ? `${p.area} m²` : ""
      ]
        .filter(Boolean)
        .map((m) => `<span>${escapeHtml(m)}</span>`)
        .join("");
      return `<article class="property-card">
        ${photo}
        <div class="property-body">
          <span class="badge ${escapeHtml(p.status)}">${escapeHtml(p.status)} · ${escapeHtml(p.finalidade || "")}</span>
          <h3>${escapeHtml(p.titulo)}</h3>
          <span class="property-price">${formatBRL(p.preco)}</span>
          <div class="property-meta"><span>${escapeHtml([p.bairro, p.cidade].filter(Boolean).join(", ") || "—")}</span></div>
          <div class="property-meta">${meta}</div>
          <div class="card-actions">
            <button class="button ghost" data-edit="${p.id}">Editar</button>
            <button class="button ghost" data-delete="${p.id}">Excluir</button>
          </div>
        </div>
      </article>`;
    })
    .join("");
}

/* ---------- render: LEADS ---------- */
function renderLeads() {
  const term = $("[data-lead-search]").value.trim().toLowerCase();
  const filter = $("[data-lead-filter]").value;
  const tbody = $("[data-lead-rows]");

  const list = state.leads.filter((l) => {
    const matchTerm = !term || [l.data, l.source, l.date].some((v) => String(v || "").toLowerCase().includes(term));
    const matchStatus = !filter || l.status === filter;
    return matchTerm && matchStatus;
  });

  $("[data-lead-empty]").hidden = state.leads.length !== 0;

  tbody.innerHTML = list
    .map((l) => {
      const status = l.status;
      const options = LEAD_STATUSES.map(
        (s) => `<option value="${s}" ${s === status ? "selected" : ""}>${LEAD_STATUS_LABEL[s]}</option>`
      ).join("");
      const fields = parseLeadFields(l.data);
      const dataHtml = fields.length
        ? `<strong class="lead-name">${escapeHtml(leadName(fields))}</strong><div class="pl-tags">${leadTagsHtml(fields)}</div>`
        : "—";
      return `<tr>
        <td>${escapeHtml(formatDate(l.date) || "—")}</td>
        <td class="lead-data">${dataHtml}</td>
        <td>${escapeHtml(l.source || "—")}</td>
        <td><select class="lead-status-select" data-lead-status="${escapeHtml(l.id)}">${options}</select></td>
        <td><button class="button ghost" data-delete-lead="${escapeHtml(l.id)}" type="button">Excluir</button></td>
      </tr>`;
    })
    .join("");
}

function renderAll() {
  renderOverview();
  renderProperties();
  renderLeads();
}

/* ---------- exportação CSV ---------- */
function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/* ---------- modal de imóvel ---------- */
const modal = $("[data-modal]");
const propertyForm = $("[data-property-form]");

function openPropertyModal(property) {
  propertyForm.reset();
  $("[data-modal-title]").textContent = property ? "Editar imóvel" : "Novo imóvel";
  if (property) {
    Object.entries(property).forEach(([key, value]) => {
      if (propertyForm.elements[key]) propertyForm.elements[key].value = value;
    });
  } else {
    propertyForm.elements.id.value = "";
  }
  modal.hidden = false;
}
const closeModal = () => (modal.hidden = true);

propertyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(propertyForm);
  const data = Object.fromEntries(formData.entries());

  // A foto agora é uma URL (link de imagem já publicada). Guardar links —
  // e não imagens embutidas — mantém os dados leves o bastante para caberem
  // na planilha e permite que o site público exiba a mesma foto.
  data.id = data.id || `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await persistProperty(data);
  state.properties = await fetchProperties();
  closeModal();
  renderAll();
  toast("Imóvel salvo.");
});

/* ---------- navegação ---------- */
function switchView(view) {
  $$("[data-view]").forEach((el) => el.classList.toggle("is-active", el.dataset.view === view));
  $$("[data-view-link]").forEach((el) => el.classList.toggle("is-active", el.dataset.viewLink === view));
  const titles = { overview: "Visão geral", properties: "Imóveis", leads: "Leads" };
  $("[data-view-title]").textContent = titles[view] || "";
  $("[data-sidebar]").classList.remove("is-open");
}

/* ---------- eventos ---------- */
function bindEvents() {
  $$("[data-view-link]").forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.viewLink)));
  $("[data-menu-toggle]").addEventListener("click", () => $("[data-sidebar]").classList.toggle("is-open"));
  $("[data-new-property]").addEventListener("click", () => openPropertyModal(null));
  $("[data-refresh]").addEventListener("click", () => {
    toast("Atualizando…");
    loadAll();
  });
  $$("[data-modal-close]").forEach((btn) => btn.addEventListener("click", closeModal));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  bindSettings();

  $("[data-property-search]").addEventListener("input", renderProperties);
  $("[data-property-filter]").addEventListener("change", renderProperties);
  $("[data-lead-search]").addEventListener("input", renderLeads);
  $("[data-lead-filter]").addEventListener("change", renderLeads);

  // ações nos cards de imóveis (delegação)
  $("[data-property-grid]").addEventListener("click", async (e) => {
    const editId = e.target.getAttribute("data-edit");
    const deleteId = e.target.getAttribute("data-delete");
    if (editId) openPropertyModal(state.properties.find((p) => p.id === editId));
    if (deleteId && confirm("Excluir este imóvel?")) {
      await removeProperty(deleteId);
      state.properties = await fetchProperties();
      renderAll();
      toast("Imóvel excluído.");
    }
  });

  // remoção de lead — tanto na tabela quanto no funil da visão geral
  const onLeadDeleteClick = async (e) => {
    const deleteId = e.target.getAttribute("data-delete-lead");
    if (!deleteId) return;
    if (!confirm("Excluir este lead? Esta ação não pode ser desfeita.")) return;
    await removeLead(deleteId);
    state.leads = state.leads.filter((l) => l.id !== deleteId);
    renderAll();
    toast("Lead excluído.");
  };
  $("[data-lead-rows]").addEventListener("click", onLeadDeleteClick);

  // status dos leads — tanto na tabela quanto no funil da visão geral
  const onLeadStatusChange = (e) => {
    const id = e.target.getAttribute("data-lead-status");
    if (!id) return;
    persistLeadStatus(id, e.target.value);
  };
  $("[data-lead-rows]").addEventListener("change", onLeadStatusChange);
  const pipeline = $("[data-pipeline]");
  pipeline.addEventListener("change", onLeadStatusChange);
  pipeline.addEventListener("click", onLeadDeleteClick);

  // Arrastar leads entre as colunas do funil.
  pipeline.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".pl-card");
    if (!card) return;
    state.isDraggingLead = true;
    e.dataTransfer.setData("text/plain", card.dataset.leadId);
    e.dataTransfer.effectAllowed = "move";
    card.classList.add("is-dragging");
  });
  pipeline.addEventListener("dragend", (e) => {
    state.isDraggingLead = false;
    e.target.closest(".pl-card")?.classList.remove("is-dragging");
  });
  pipeline.addEventListener("dragover", (e) => {
    const col = e.target.closest(".pl-col");
    if (!col) return;
    e.preventDefault();
    $$(".pl-col").forEach((c) => c.classList.toggle("is-drop", c === col));
  });
  pipeline.addEventListener("dragleave", (e) => {
    if (!pipeline.contains(e.relatedTarget)) $$(".pl-col").forEach((c) => c.classList.remove("is-drop"));
  });
  pipeline.addEventListener("drop", (e) => {
    state.isDraggingLead = false;
    const col = e.target.closest(".pl-col");
    $$(".pl-col").forEach((c) => c.classList.remove("is-drop"));
    if (!col) return;
    e.preventDefault();
    persistLeadStatus(e.dataTransfer.getData("text/plain"), col.dataset.status);
  });

  $("[data-export-properties]").addEventListener("click", () => {
    const header = ["Título", "Tipo", "Finalidade", "Status", "Preço", "Bairro", "Cidade", "Quartos", "Banheiros", "Vagas", "Área", "Descrição"];
    const rows = state.properties.map((p) => [p.titulo, p.tipo, p.finalidade, p.status, p.preco, p.bairro, p.cidade, p.quartos, p.banheiros, p.vagas, p.area, p.descricao]);
    downloadCsv("imoveis-mf.csv", [header, ...rows]);
  });

  $("[data-export-leads]").addEventListener("click", () => {
    const header = ["Data", "Dados", "Origem", "Status"];
    const rows = state.leads.map((l) => [l.date, l.data, l.source, LEAD_STATUS_LABEL[l.status]]);
    downloadCsv("leads-mf.csv", [header, ...rows]);
  });
}

/* ---------- configuração (modo nuvem) ---------- */
function bindSettings() {
  const settingsModal = $("[data-settings-modal]");
  const settingsForm = $("[data-settings-form]");
  if (!settingsModal || !settingsForm) return;

  const openSettings = () => {
    settingsForm.elements.webAppUrl.value = CONFIG.WEB_APP_URL || "";
    settingsModal.hidden = false;
  };
  const closeSettings = () => (settingsModal.hidden = true);

  const applyWebAppUrl = (url) => {
    CONFIG.WEB_APP_URL = url;
    writeStore(STORE_WEBAPP, url);
    closeSettings();
    loadAll();
  };

  $("[data-open-settings]")?.addEventListener("click", openSettings);
  $$("[data-settings-close]").forEach((btn) => btn.addEventListener("click", closeSettings));
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const url = settingsForm.elements.webAppUrl.value.trim().replace(/\/+$/, "");
    applyWebAppUrl(url);
    toast(url ? "Modo nuvem ativado." : "Voltou ao modo local.");
  });

  $("[data-settings-clear]")?.addEventListener("click", () => {
    applyWebAppUrl("");
    toast("Voltou ao modo local.");
  });
}

/* ---------- atualização em tempo real ---------- */
// Recarrega leads e imóveis periodicamente: leads novos vindos do chat e
// mudanças de status feitas em outro dispositivo aparecem sem precisar de F5.
// Pausa quando a aba está em segundo plano, durante um arraste no funil, com
// modal aberto ou com um campo/select em uso, para não atrapalhar o corretor.
const AUTO_REFRESH_MS = 15000;
setInterval(() => {
  const settingsModal = $("[data-settings-modal]");
  const modalOpen = !modal.hidden || (settingsModal && !settingsModal.hidden);
  const active = document.activeElement;
  const interacting = active && ["SELECT", "INPUT", "TEXTAREA"].includes(active.tagName);
  if (document.hidden || state.isDraggingLead || modalOpen || interacting) return;
  loadAll();
}, AUTO_REFRESH_MS);

/* ---------- init ---------- */
bindEvents();
loadAll();
