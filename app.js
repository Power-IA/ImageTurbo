/* =====================================================================
   Conversor de Páginas — Gerar com IA / HTML → Imagem (PNG, JPG, WEBP) ou PDF
   100% client-side. Biblioteca: html2canvas (via CDN).
   Geração de HTML: API de Mensagens da Anthropic (chamada direta do navegador).
   ===================================================================== */

(() => {
  "use strict";

  // ---- Estado ----------------------------------------------------------
  let activeTab = "ai";
  let uploadedHtml = null;      // conteúdo do arquivo .html enviado
  let uploadedName = null;      // nome do arquivo enviado
  let generatedHtml = null;     // HTML produzido pela IA
  let generatedSize = null;     // { width, height|null } usado na geração
  let currentResult = null;     // { blob, filename, kind }
  let expandZoom = 1;           // fator de zoom da pré-visualização ampliada
  let expandArtW = 0;
  let expandArtH = 0;

  // ---- Provedores de IA ------------------------------------------------
  const ANTHROPIC_VERSION = "2023-06-01";
  const STORE = {
    provider: "ai_provider",
    keys: "ai_keys",     // mapa { providerId: chave }
    models: "ai_models", // mapa { providerId: modelo }
    bases: "ai_bases",   // mapa { providerId: urlBase }
    system: "ai_system_extra", // instruções de sistema do usuário
    legacyKey: "anthropic_api_key", // versões anteriores
  };
  const THEME_KEY = "ui_theme";

  // api: "anthropic" usa /v1/messages; "openai" usa /chat/completions.
  const PROVIDERS = {
    anthropic: {
      label: "Anthropic (Claude)",
      api: "anthropic",
      baseURL: "https://api.anthropic.com/v1",
      models: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"],
      keyHint: "console.anthropic.com",
    },
    openai: {
      label: "OpenAI",
      api: "openai",
      baseURL: "https://api.openai.com/v1",
      models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"],
      keyHint: "platform.openai.com/api-keys",
    },
    openrouter: {
      label: "OpenRouter",
      api: "openai",
      baseURL: "https://openrouter.ai/api/v1",
      models: [
        "openai/gpt-4o",
        "anthropic/claude-sonnet-4.5",
        "google/gemini-2.0-flash-001",
        "meta-llama/llama-3.3-70b-instruct",
      ],
      keyHint: "openrouter.ai/keys",
    },
    groq: {
      label: "Groq",
      api: "openai",
      baseURL: "https://api.groq.com/openai/v1",
      models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
      keyHint: "console.groq.com/keys",
    },
    deepseek: {
      label: "DeepSeek",
      api: "openai",
      baseURL: "https://api.deepseek.com/v1",
      models: ["deepseek-chat", "deepseek-reasoner"],
      keyHint: "platform.deepseek.com",
    },
    mistral: {
      label: "Mistral",
      api: "openai",
      baseURL: "https://api.mistral.ai/v1",
      models: ["mistral-large-latest", "mistral-small-latest", "codestral-latest"],
      keyHint: "console.mistral.ai",
    },
    xai: {
      label: "xAI (Grok)",
      api: "openai",
      baseURL: "https://api.x.ai/v1",
      models: ["grok-2-latest", "grok-beta"],
      keyHint: "console.x.ai",
    },
    google: {
      label: "Google (Gemini)",
      api: "openai",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
      keyHint: "aistudio.google.com/apikey",
    },
    together: {
      label: "Together AI",
      api: "openai",
      baseURL: "https://api.together.xyz/v1",
      models: [
        "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        "Qwen/Qwen2.5-72B-Instruct-Turbo",
      ],
      keyHint: "api.together.ai/settings/api-keys",
    },
    custom: {
      label: "Personalizado (compatível com OpenAI)",
      api: "openai",
      baseURL: "",
      models: [],
      keyHint: "",
    },
  };

  function providerCfg(id) {
    return PROVIDERS[id] || PROVIDERS.custom;
  }

  // O gerador é especializado em CRIAR IMAGENS (artes gráficas) com HTML/CSS.
  const AI_SYSTEM_BASE =
    "Você é um designer gráfico especialista que cria IMAGENS usando apenas HTML e CSS — não páginas " +
    "web comuns, mas composições visuais prontas para publicação (posts, capas, banners, thumbnails). " +
    "Você domina formas (círculos, retângulos arredondados, triângulos e polígonos via clip-path, blobs, " +
    "ondas, linhas, grades), gradientes, sombras, padrões, tipografia expressiva, ícones em CSS/SVG e " +
    "paletas de cores harmônicas e vibrantes. " +
    "Responda APENAS com um documento HTML completo e autocontido, começando em <!DOCTYPE html>: sem " +
    "markdown, sem cercas de código (```), sem explicações antes ou depois. " +
    "O <body> deve ter margin:0 e conter um único contêiner raiz com a arte; use position/flex/grid para " +
    "compor. Toda a composição precisa caber nas dimensões indicadas, sem rolagem e sem elementos cortados. " +
    "Capriche: fundo elaborado, hierarquia visual clara, ótimo contraste e cores atraentes. Use SVG inline " +
    "ou clip-path para formas quando ajudar. Todo o CSS vai embutido em <style>; fontes do Google Fonts " +
    "(via <link>) são permitidas. Evite imagens externas — prefira formas, gradientes e ícones desenhados " +
    "em CSS/SVG.";

  // Presets de dimensões (largura × altura). h:null = altura automática.
  const SIZE_PRESETS = {
    auto: { w: 1280, h: null },
    ig_post: { w: 1080, h: 1080 },
    ig_portrait: { w: 1080, h: 1350 },
    ig_story: { w: 1080, h: 1920 },
    yt_thumb: { w: 1280, h: 720 },
    fb_post: { w: 1200, h: 630 },
    x_post: { w: 1600, h: 900 },
    li_post: { w: 1200, h: 627 },
    pin: { w: 1000, h: 1500 },
    ebook_cover: { w: 1600, h: 2560 },
    custom: { w: null, h: null },
  };

  // System prompt especializado: CAPAS DE E-BOOK no estilo BRUTALISMO.
  const EBOOK_BRUTALISM_PROMPT =
    "Aja como um especialista em CAPAS DE E-BOOK no estilo BRUTALISMO (brutalist design). Crie uma capa " +
    "vertical de livro impactante, com hierarquia forte e legível até em miniatura. " +
    "Princípios brutalistas obrigatórios: composição em BLOCOS sólidos e assimétricos; bordas GROSSAS pretas; " +
    "contraste altíssimo; NADA de cantos arredondados, sombras suaves ou gradientes sutis. Tipografia GIGANTE " +
    "em CAIXA-ALTA com sans-serif grotesca pesada (Archivo Black, Anton, Helvetica/Arial Black) ou monoespaçada. " +
    "Paleta crua e limitada: preto e branco + 1 ou 2 cores fortes e chapadas (vermelho, amarelo ou azul puros). " +
    "Use estrutura visível, grids quebrados, sobreposições deliberadas, faixas, listras, retângulos preenchidos " +
    "e formas geométricas brutas; desalinhamentos propositais fazem parte da estética. " +
    "Hierarquia da capa: TÍTULO dominante (ocupa boa parte da arte), subtítulo secundário e NOME DO AUTOR bem " +
    "visível (no topo ou no rodapé). Use o título, subtítulo e autor informados pelo usuário; se faltarem, crie " +
    "textos coerentes com o tema. O resultado deve parecer uma capa de e-book pronta para publicação.";

  // Galeria de estilos rápidos: ao clicar, preenche as "Instruções de sistema".
  const QUICK_STYLES = [
    { name: "📕 Capa e-book · Brutalismo", prompt: EBOOK_BRUTALISM_PROMPT, preset: "ebook_cover", featured: true },
    { name: "Minimalista", prompt: "Estilo minimalista: muito espaço em branco, poucos elementos, paleta neutra de 1–2 cores, tipografia limpa sem serifa e hierarquia clara." },
    { name: "Dark / Neon", prompt: "Estilo dark com neon: fundo bem escuro, cores neon vibrantes (ciano, magenta, verde), brilhos/glow e contraste alto." },
    { name: "Retrô anos 80", prompt: "Estilo retrô synthwave anos 80: grade em perspectiva, sol em gradiente, cores magenta/roxo/azul e tipografia retrô." },
    { name: "Corporativo", prompt: "Estilo corporativo profissional: paleta azul/cinza, layout em grade, tipografia sóbria e visual confiável e limpo." },
    { name: "Brutalismo", prompt: "Estilo brutalista: blocos sólidos, bordas grossas pretas, contraste alto, tipografia enorme em caixa-alta, cores cruas e layout assimétrico." },
    { name: "Memphis", prompt: "Estilo Memphis/geométrico: formas geométricas coloridas espalhadas (círculos, zigue-zague, triângulos), cores primárias vibrantes e padrões divertidos." },
    { name: "Glassmorphism", prompt: "Estilo glassmorphism: cartões de vidro fosco (blur), transparências, fundo com gradiente colorido e sombras suaves." },
    { name: "Luxo / Dourado", prompt: "Estilo luxuoso: fundo escuro elegante, detalhes dourados, tipografia serifada refinada e bastante sofisticação." },
    { name: "Cyberpunk", prompt: "Estilo cyberpunk: estética futurista urbana, neon, efeito glitch, tipografia tecnológica e cores ciano/magenta sobre preto." },
  ];

  // ---- Atalhos de DOM --------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const el = {
    tabs: $$(".tab"),
    panels: $$(".panel"),
    // Gerar com IA
    aiPrompt: $("#ai-prompt"),
    aiConfig: $("#ai-config"),
    aiProvider: $("#ai-provider"),
    aiBase: $("#ai-base"),
    aiBaseHint: $("#ai-base-hint"),
    aiKey: $("#ai-key"),
    aiKeyToggle: $("#ai-key-toggle"),
    aiKeyHint: $("#ai-key-hint"),
    aiModelSelect: $("#ai-model-select"),
    aiTestBtn: $("#ai-test-btn"),
    aiTestStatus: $("#ai-test-status"),
    aiSystem: $("#ai-system"),
    styleGallery: $("#style-gallery"),
    aiGenConvertBtn: $("#ai-gen-convert-btn"),
    aiGenerateBtn: $("#ai-generate-btn"),
    aiEditBtn: $("#ai-edit-btn"),
    aiStatus: $("#ai-status"),
    aiPreview: $("#ai-preview"),
    aiPreviewFrame: $("#ai-preview-frame"),
    aiExpandBtn: $("#ai-expand-btn"),
    expandModal: $("#expand-modal"),
    expandFrame: $("#expand-frame"),
    expandClose: $("#expand-close"),
    modalStage: $("#modal-stage"),
    zoomWrap: $("#zoom-wrap"),
    zoomIn: $("#zoom-in"),
    zoomOut: $("#zoom-out"),
    zoomFit: $("#zoom-fit"),
    zoomLevel: $("#zoom-level"),
    // Arquivo / Código
    fileInput: $("#file-input"),
    dropzone: $("#dropzone"),
    fileName: $("#file-name"),
    codeInput: $("#code-input"),
    // Opções de saída
    format: $("#format"),
    preset: $("#preset"),
    width: $("#width"),
    height: $("#height"),
    scale: $("#scale"),
    quality: $("#quality"),
    qualityVal: $("#quality-val"),
    qualityWrap: $("#quality-wrap"),
    convertBtn: $("#convert-btn"),
    resetBtn: $("#reset-btn"),
    status: $("#status"),
    resultCard: $("#result-card"),
    preview: $("#preview"),
    downloadBtn: $("#download-btn"),
    overlay: $("#overlay"),
    overlayText: $("#overlay-text"),
    renderHost: $("#render-host"),
    themeToggle: $("#theme-toggle"),
  };

  // =====================================================================
  //  UI: abas, opções e estados
  // =====================================================================

  function switchTab(name) {
    activeTab = name;
    el.tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
    });
    el.panels.forEach((p) => {
      const on = p.dataset.panel === name;
      p.classList.toggle("is-active", on);
      p.hidden = !on;
    });
  }

  function syncFormatOptions() {
    const fmt = el.format.value;
    const lossy = fmt === "jpeg" || fmt === "webp";
    el.qualityWrap.style.display = lossy ? "" : "none";
  }

  // Aplica o preset de dimensões aos campos largura/altura.
  function syncPreset() {
    const key = el.preset.value;
    const p = SIZE_PRESETS[key] || {};
    const isAuto = key === "auto";
    el.height.disabled = isAuto;
    if (key !== "custom") {
      if (p.w) el.width.value = p.w;
      if (p.h) el.height.value = p.h;
    }
  }

  function clampInt(v, min, max, def) {
    let n = Math.round(Number(v));
    if (!isFinite(n)) n = def;
    return Math.min(max, Math.max(min, n));
  }

  // Lê as dimensões/escala de saída. height === null => altura automática.
  function readOutputOpts() {
    const isAuto = el.preset.value === "auto";
    const width = clampInt(el.width.value, 64, 4096, 1080);
    const height = isAuto ? null : clampInt(el.height.value, 64, 4096, 1080);
    const scale = Number(el.scale.value) || 2;
    return { width, height, scale };
  }

  function setStatus(msg, kind = "info") {
    el.status.textContent = msg || "";
    el.status.className = "status " + (msg ? "is-" + kind : "");
  }

  function setAiStatus(msg, kind = "info") {
    el.aiStatus.textContent = msg || "";
    el.aiStatus.className = "status " + (msg ? "is-" + kind : "");
  }

  function showOverlay(show, text) {
    if (text) el.overlayText.textContent = text;
    el.overlay.hidden = !show;
    el.convertBtn.disabled = show;
  }

  // =====================================================================
  //  Utilitários
  // =====================================================================

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1500);
  }

  function safeBaseName() {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    if (activeTab === "ai") return `pagina-ia-${stamp}`;
    if (activeTab === "file" && uploadedName) {
      return uploadedName.replace(/\.[^.]+$/, "") + `-${stamp}`;
    }
    return `html-${stamp}`;
  }

  // =====================================================================
  //  Geração de HTML com a IA (API da Anthropic)
  // =====================================================================

  function readMap(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}") || {};
    } catch {
      return {};
    }
  }
  function writeMap(key, map) {
    try {
      localStorage.setItem(key, JSON.stringify(map));
    } catch {
      /* localStorage indisponível */
    }
  }
  function getLS(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }
  function setLS(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch {
      /* localStorage indisponível */
    }
  }

  // ---- Tema (claro / escuro) ------------------------------------------
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    el.themeToggle.textContent = t === "dark" ? "☀️" : "🌙";
    el.themeToggle.setAttribute("aria-pressed", t === "dark" ? "true" : "false");
  }

  function initTheme() {
    let t = getLS(THEME_KEY);
    if (t !== "dark" && t !== "light") {
      t =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    }
    applyTheme(t);
  }

  // Preenche URL base, chave, modelo e datalist conforme o provedor selecionado.
  function syncProvider() {
    const id = el.aiProvider.value;
    const P = providerCfg(id);
    const bases = readMap(STORE.bases);
    const keys = readMap(STORE.keys);
    const models = readMap(STORE.models);

    el.aiBase.value = bases[id] || P.baseURL || "";
    el.aiKey.value = keys[id] || "";

    // Combobox de modelos: começa com os sugeridos + o último usado (se houver);
    // "Testar conexão" substitui pela lista ao vivo do provedor.
    const saved = models[id] || "";
    const suggested = P.models.slice();
    if (saved && !suggested.includes(saved)) suggested.unshift(saved);
    fillModelSelect(suggested, saved);

    el.aiKeyHint.innerHTML =
      "A chave fica salva apenas no seu navegador (localStorage) e é enviada diretamente ao provedor." +
      (P.keyHint ? ` Crie a sua em <strong>${P.keyHint}</strong>.` : "");

    setTestStatus("");
  }

  function setTestStatus(msg, kind = "info") {
    el.aiTestStatus.hidden = !msg;
    el.aiTestStatus.textContent = msg || "";
    el.aiTestStatus.className = "status " + (msg ? "is-" + kind : "");
  }

  // Salva os campos atuais no mapa do provedor selecionado.
  function persistCurrentFields() {
    const id = el.aiProvider.value;
    const keys = readMap(STORE.keys);
    const models = readMap(STORE.models);
    const bases = readMap(STORE.bases);
    const k = el.aiKey.value.trim();
    if (k) keys[id] = k;
    else delete keys[id];
    models[id] = el.aiModelSelect.value || "";
    bases[id] = el.aiBase.value.trim();
    writeMap(STORE.keys, keys);
    writeMap(STORE.models, models);
    writeMap(STORE.bases, bases);
    setLS(STORE.provider, id);
  }

  function currentProviderCfg() {
    const id = el.aiProvider.value;
    const P = providerCfg(id);
    return {
      provider: id,
      api: P.api,
      baseURL: el.aiBase.value.trim() || P.baseURL,
      key: el.aiKey.value.trim(),
      model: el.aiModelSelect.value || P.models[0] || "",
    };
  }

  function initProviderState() {
    // Migra a chave antiga da Anthropic (versões anteriores), se houver.
    const legacy = getLS(STORE.legacyKey);
    if (legacy) {
      const keys = readMap(STORE.keys);
      if (!keys.anthropic) {
        keys.anthropic = legacy;
        writeMap(STORE.keys, keys);
      }
      try {
        localStorage.removeItem(STORE.legacyKey);
      } catch {
        /* ignore */
      }
    }
    const saved = getLS(STORE.provider);
    if (saved && PROVIDERS[saved]) el.aiProvider.value = saved;
    syncProvider();
  }

  // Remove eventuais cercas de código (```html ... ```) que o modelo possa incluir.
  function stripCodeFences(s) {
    let t = (s || "").trim();
    const full = t.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/);
    if (full) return full[1].trim();
    return t.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "").trim();
  }

  function buildSystemPrompt(opts) {
    const sizeRule = opts.height
      ? `Importante: o contêiner raiz deve ter EXATAMENTE width:${opts.width}px e height:${opts.height}px ` +
        `e preencher toda essa área (sem rolagem, sem transbordar e sem margens no body).`
      : `Importante: o contêiner raiz deve ter EXATAMENTE width:${opts.width}px; a altura pode ajustar-se ` +
        `ao conteúdo. Sem rolagem horizontal e sem margens no body.`;
    let sys = AI_SYSTEM_BASE + " " + sizeRule;
    const extra = (el.aiSystem.value || "").trim();
    if (extra) sys += "\n\nInstruções adicionais do usuário (siga-as): " + extra;
    return sys;
  }

  function joinUrl(base, path) {
    return base.replace(/\/+$/, "") + path;
  }

  async function postJson(url, headers, body) {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error(
        "Não foi possível contatar o provedor (rede ou CORS). Alguns serviços bloqueiam chamadas " +
          "do navegador; tente outro provedor, um endpoint/proxy com CORS, ou um servidor local. " +
          (e && e.message ? "(" + e.message + ")" : "")
      );
    }
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        const m =
          (err && err.error && (err.error.message || err.error)) ||
          (err && err.message);
        if (m) detail = typeof m === "string" ? m : JSON.stringify(m);
      } catch {
        /* sem corpo JSON */
      }
      if (res.status === 401 || res.status === 403) detail = "Chave inválida ou sem permissão.";
      else if (res.status === 404) detail = "Endpoint ou modelo não encontrado — verifique a URL base e o modelo.";
      else if (res.status === 429) detail = "Limite de uso atingido. Tente novamente em instantes.";
      throw new Error("Falha na geração: " + detail);
    }
    return res.json();
  }

  async function callAnthropic(cfg, system, user) {
    const data = await postJson(
      joinUrl(cfg.baseURL, "/messages"),
      {
        "content-type": "application/json",
        "x-api-key": cfg.key,
        "anthropic-version": ANTHROPIC_VERSION,
        // Permite a chamada direta a partir do navegador (CORS).
        "anthropic-dangerous-direct-browser-access": "true",
      },
      {
        model: cfg.model,
        max_tokens: 16000,
        system: system,
        messages: [{ role: "user", content: user }],
      }
    );
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    return stripCodeFences(text);
  }

  async function callOpenAICompatible(cfg, system, user) {
    const headers = { "content-type": "application/json" };
    if (cfg.key) headers["Authorization"] = "Bearer " + cfg.key;
    if (cfg.provider === "openrouter") {
      headers["HTTP-Referer"] = location.origin || "https://localhost";
      headers["X-Title"] = "Criador de Imagens HTML";
    }
    const data = await postJson(joinUrl(cfg.baseURL, "/chat/completions"), headers, {
      model: cfg.model,
      max_tokens: 16000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const choice = data.choices && data.choices[0];
    const text = (choice && choice.message && choice.message.content) || "";
    return stripCodeFences(typeof text === "string" ? text : "");
  }

  async function generateHtmlFromPrompt(prompt, cfg, opts, presetLabel) {
    const system = buildSystemPrompt(opts);
    const dim = opts.height
      ? `${opts.width}×${opts.height}px`
      : `${opts.width}px de largura (altura flexível)`;
    const user = `Formato/dimensões: ${presetLabel} — ${dim}.\n\nCrie a arte para: ${prompt}`;

    if (cfg.api === "anthropic") return callAnthropic(cfg, system, user);
    return callOpenAICompatible(cfg, system, user);
  }

  // Lista os modelos disponíveis (GET {base}/models) — usado por "Testar conexão".
  async function listModels(cfg) {
    const headers =
      cfg.api === "anthropic"
        ? {
            "x-api-key": cfg.key,
            "anthropic-version": ANTHROPIC_VERSION,
            "anthropic-dangerous-direct-browser-access": "true",
          }
        : cfg.key
        ? { Authorization: "Bearer " + cfg.key }
        : {};

    let res;
    try {
      res = await fetch(joinUrl(cfg.baseURL, "/models"), { headers });
    } catch (e) {
      throw new Error(
        "Não foi possível contatar o provedor (rede ou CORS). " +
          (e && e.message ? "(" + e.message + ")" : "")
      );
    }
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        const m =
          (err && err.error && (err.error.message || err.error)) ||
          (err && err.message);
        if (m) detail = typeof m === "string" ? m : JSON.stringify(m);
      } catch {
        /* sem corpo JSON */
      }
      if (res.status === 401 || res.status === 403) detail = "Chave inválida ou sem permissão.";
      else if (res.status === 404) detail = "Endpoint /models não encontrado nesta URL base.";
      throw new Error(detail);
    }
    const data = await res.json();
    const raw = data.data || data.models || data;
    const list = Array.isArray(raw) ? raw : [];
    return Array.from(
      new Set(
        list
          .map((m) => (typeof m === "string" ? m : m && (m.id || m.name || m.model)))
          .filter(Boolean)
      )
    );
  }

  function fillModelSelect(models, selected) {
    el.aiModelSelect.innerHTML = "";
    if (!models || !models.length) {
      const ph = document.createElement("option");
      ph.value = "";
      ph.textContent = "— clique em Testar conexão —";
      el.aiModelSelect.appendChild(ph);
      return;
    }
    const sorted = models.slice().sort((a, b) => a.localeCompare(b));
    sorted.forEach((m) => {
      const o = document.createElement("option");
      o.value = m;
      o.textContent = m;
      el.aiModelSelect.appendChild(o);
    });
    el.aiModelSelect.value =
      selected && sorted.includes(selected) ? selected : sorted[0];
  }

  async function handleTestConnection() {
    const cfg = currentProviderCfg();
    if (!cfg.baseURL) {
      setTestStatus("Informe a URL base do provedor.", "error");
      return;
    }
    if (!cfg.key && cfg.provider !== "custom") {
      setTestStatus("Informe a chave da API.", "error");
      return;
    }
    el.aiTestBtn.disabled = true;
    setTestStatus("Testando conexão e listando modelos…", "info");
    try {
      const models = await listModels(cfg);
      if (!models.length) {
        setTestStatus("Conectado, mas o provedor não retornou modelos.", "ok");
        return;
      }
      fillModelSelect(models, el.aiModelSelect.value);
      persistCurrentFields();
      setTestStatus(
        `Conexão OK — ${models.length} modelos disponíveis. Selecione um modelo.`,
        "ok"
      );
    } catch (e) {
      console.error(e);
      setTestStatus("Falha: " + (e.message || "erro ao listar modelos."), "error");
    } finally {
      el.aiTestBtn.disabled = false;
    }
  }

  function showAiPreview(html) {
    el.aiPreview.hidden = false;
    el.aiPreviewFrame.srcdoc = html;
  }

  async function handleGenerate() {
    const prompt = el.aiPrompt.value.trim();
    if (!prompt) {
      setAiStatus("Descreva a arte que você quer gerar.", "error");
      el.aiPrompt.focus();
      return false;
    }
    const cfg = currentProviderCfg();
    if (!cfg.baseURL) {
      setAiStatus("Informe a URL base do provedor nas configurações.", "error");
      el.aiConfig.open = true;
      el.aiBase.focus();
      return false;
    }
    if (!cfg.model) {
      setAiStatus("Selecione um modelo (use “Testar conexão” para listar).", "error");
      el.aiConfig.open = true;
      el.aiModelSelect.focus();
      return false;
    }
    if (!cfg.key && cfg.provider !== "custom") {
      setAiStatus("Informe sua chave da API nas configurações.", "error");
      el.aiConfig.open = true;
      el.aiKey.focus();
      return false;
    }
    persistCurrentFields();

    const opts = readOutputOpts();
    const presetLabel =
      (el.preset.selectedOptions[0] &&
        el.preset.selectedOptions[0].textContent.trim()) ||
      "personalizado";

    el.aiGenerateBtn.disabled = true;
    setAiStatus("Gerando a arte com a IA… isso pode levar alguns segundos.", "info");
    showOverlay(true, "Gerando a arte com a IA…");
    let ok = false;
    try {
      const html = await generateHtmlFromPrompt(prompt, cfg, opts, presetLabel);
      if (!html || !/</.test(html)) {
        throw new Error(
          "O provedor não retornou HTML válido. Tente refinar o pedido ou trocar de modelo."
        );
      }
      generatedHtml = html;
      generatedSize = { width: opts.width, height: opts.height };
      showAiPreview(html);
      el.aiEditBtn.hidden = false;
      setAiStatus("HTML gerado! Escolha o formato abaixo e clique em Converter.", "ok");
      ok = true;
    } catch (e) {
      console.error(e);
      generatedHtml = null;
      el.aiPreview.hidden = true;
      setAiStatus(e.message || "Erro ao gerar HTML.", "error");
    } finally {
      el.aiGenerateBtn.disabled = false;
      showOverlay(false);
    }
    return ok;
  }

  async function handleGenerateAndConvert() {
    el.aiGenConvertBtn.disabled = true;
    try {
      const ok = await handleGenerate();
      if (ok) await handleConvert();
    } finally {
      el.aiGenConvertBtn.disabled = false;
    }
  }

  function handleAiEdit() {
    if (!generatedHtml) return;
    el.codeInput.value = generatedHtml;
    switchTab("code");
    setStatus("HTML movido para edição. Ajuste o que quiser e clique em Converter.", "info");
  }

  function applyZoom(z) {
    expandZoom = Math.min(4, Math.max(0.05, z));
    el.expandFrame.style.transform = `scale(${expandZoom})`;
    el.zoomWrap.style.width = expandArtW * expandZoom + "px";
    el.zoomWrap.style.height = expandArtH * expandZoom + "px";
    el.zoomLevel.textContent = Math.round(expandZoom * 100) + "%";
  }

  // Zoom que mostra toda a arte, proporcional, dentro da área visível.
  function fitZoom() {
    if (!expandArtW || !expandArtH) return;
    const rect = el.modalStage.getBoundingClientRect();
    const pad = 36;
    const z = Math.min(
      (rect.width - pad) / expandArtW,
      (rect.height - pad) / expandArtH
    );
    applyZoom(z > 0 ? z : 1);
  }

  function openExpand() {
    if (!generatedHtml) return;
    el.expandModal.hidden = false;
    document.body.style.overflow = "hidden";

    const w = (generatedSize && generatedSize.width) || 1080;
    const fixedH = generatedSize && generatedSize.height;
    el.expandFrame.style.width = w + "px";
    el.expandFrame.style.height = (fixedH || 600) + "px";
    el.expandFrame.style.transform = "scale(1)";

    el.expandFrame.onload = () => {
      let h = fixedH;
      if (!h) {
        try {
          const d = el.expandFrame.contentDocument;
          h = Math.max(d.body.scrollHeight, d.documentElement.scrollHeight, 1);
        } catch {
          h = 1080;
        }
        el.expandFrame.style.height = h + "px";
      }
      expandArtW = w;
      expandArtH = h || 1080;
      fitZoom(); // abre já no zoom que mostra tudo
    };
    el.expandFrame.srcdoc = generatedHtml;
  }

  function closeExpand() {
    el.expandModal.hidden = true;
    el.expandFrame.onload = null;
    el.expandFrame.srcdoc = "";
    el.expandFrame.style.transform = "";
    document.body.style.overflow = "";
  }

  // ---- Galeria de estilos rápidos -------------------------------------

  function applyStyle(style, btn) {
    const wasActive = btn.classList.contains("is-active");
    el.styleGallery
      .querySelectorAll(".style-chip")
      .forEach((c) => c.classList.remove("is-active"));
    if (wasActive) {
      el.aiSystem.value = "";
    } else {
      el.aiSystem.value = style.prompt;
      btn.classList.add("is-active");
      if (style.preset && SIZE_PRESETS[style.preset]) {
        el.preset.value = style.preset;
        syncPreset();
      }
    }
    setLS(STORE.system, el.aiSystem.value);
  }

  function refreshStyleActive() {
    el.styleGallery.querySelectorAll(".style-chip").forEach((c, i) => {
      const s = QUICK_STYLES[i];
      c.classList.toggle("is-active", !!s && s.prompt === el.aiSystem.value);
    });
  }

  function renderStyleGallery() {
    el.styleGallery.innerHTML = "";
    QUICK_STYLES.forEach((style) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "style-chip" + (style.featured ? " featured" : "");
      btn.textContent = style.name;
      if (el.aiSystem.value && el.aiSystem.value === style.prompt) {
        btn.classList.add("is-active");
      }
      btn.addEventListener("click", () => applyStyle(style, btn));
      el.styleGallery.appendChild(btn);
    });
  }

  // =====================================================================
  //  Renderização de HTML em <iframe> e captura com html2canvas
  // =====================================================================

  async function waitForImages(doc, timeout = 9000) {
    const imgs = Array.from(doc.images || []);
    const pending = imgs
      .filter((img) => !img.complete)
      .map(
        (img) =>
          new Promise((res) => {
            img.addEventListener("load", res, { once: true });
            img.addEventListener("error", res, { once: true });
          })
      );
    await Promise.race([
      Promise.all(pending),
      new Promise((res) => setTimeout(res, timeout)),
    ]);
  }

  function renderHtmlInIframe(html, width, height) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.style.width = width + "px";
      iframe.style.height = (height || 800) + "px";
      iframe.style.border = "0";
      iframe.setAttribute("sandbox", "allow-same-origin");
      el.renderHost.appendChild(iframe);

      let settled = false;
      iframe.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new Error("Falha ao renderizar o HTML."));
        }
      };
      iframe.onload = async () => {
        if (settled) return;
        settled = true;
        try {
          const doc = iframe.contentDocument;
          await waitForImages(doc);
          // Aguarda as fontes (Google Fonts etc.) carregarem antes de capturar.
          if (doc.fonts && doc.fonts.ready) {
            await Promise.race([
              doc.fonts.ready,
              new Promise((r) => setTimeout(r, 4000)),
            ]);
          }
          await new Promise((r) => setTimeout(r, 200));
          resolve(iframe);
        } catch (e) {
          reject(e);
        }
      };

      // srcdoc => documento same-origin (about:srcdoc), legível pelo html2canvas
      iframe.srcdoc = html;
    });
  }

  async function captureIframe(iframe, opts) {
    const doc = iframe.contentDocument;
    const body = doc.body;
    const width = opts.width;

    let height;
    if (opts.height) {
      // Dimensões fixas (preset / personalizado) — captura exata width×height.
      height = opts.height;
    } else {
      // Altura automática: mede o CONTEÚDO (body), não o <html>, que herda a
      // altura do viewport do iframe e adicionaria espaço em branco.
      height = Math.max(body.scrollHeight, body.offsetHeight, 1);
      iframe.style.height = height + "px";
      height = Math.max(height, body.scrollHeight, 1);
    }

    const canvas = await html2canvas(body, {
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: width,
      height: height,
      windowWidth: width,
      windowHeight: height,
      scale: opts.scale,
      scrollX: 0,
      scrollY: 0,
    });
    return canvas;
  }

  async function htmlToCanvas(html, opts) {
    const iframe = await renderHtmlInIframe(html, opts.width, opts.height);
    try {
      return await captureIframe(iframe, opts);
    } finally {
      iframe.remove();
    }
  }

  // =====================================================================
  //  Geração dos arquivos de saída a partir de um <canvas>
  // =====================================================================

  function canvasToImageBlob(canvas, format, quality) {
    const mime =
      format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else
            reject(
              new Error(
                `Seu navegador não conseguiu gerar ${format.toUpperCase()}. ` +
                  "Tente outro formato (ex.: PNG)."
              )
            );
        },
        mime,
        quality
      );
    });
  }

  function clampQuality() {
    const q = Number(el.quality.value) / 100;
    return Math.min(1, Math.max(0.1, q || 0.92));
  }

  async function exportCanvas(canvas) {
    const format = el.format.value;
    const quality = clampQuality();
    const base = safeBaseName();
    const blob = await canvasToImageBlob(canvas, format, quality);
    const ext = format === "jpeg" ? "jpg" : format;
    return { blob, filename: `${base}.${ext}`, kind: "image" };
  }

  // =====================================================================
  //  Pré-visualização do resultado
  // =====================================================================

  function showResult(result, meta) {
    currentResult = result;
    el.preview.innerHTML = "";

    const url = URL.createObjectURL(result.blob);
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Pré-visualização da imagem gerada";
    el.preview.appendChild(img);

    const info = document.createElement("p");
    info.className = "preview-meta";
    const kb = (result.blob.size / 1024).toFixed(0);
    info.textContent = `${result.filename} · ${kb} KB${meta ? " · " + meta : ""}`;
    el.preview.appendChild(info);

    el.resultCard.hidden = false;
    el.resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // =====================================================================
  //  Conversão
  // =====================================================================

  async function convertFromHtmlString(html) {
    const opts = readOutputOpts();
    showOverlay(true, "Renderizando e capturando…");
    const canvas = await htmlToCanvas(html, opts);
    const result = await exportCanvas(canvas);
    showResult(result, `${canvas.width}×${canvas.height}px`);
  }

  async function handleConvert() {
    setStatus("");
    currentResult = null;

    try {
      if (activeTab === "ai") {
        if (!generatedHtml) {
          setStatus("Gere o HTML com a IA primeiro (botão “Gerar HTML”).", "error");
          return;
        }
        await convertFromHtmlString(generatedHtml);
      } else if (activeTab === "file") {
        if (!uploadedHtml) {
          setStatus("Selecione um arquivo HTML primeiro.", "error");
          return;
        }
        await convertFromHtmlString(uploadedHtml);
      } else {
        const code = el.codeInput.value.trim();
        if (!code) {
          setStatus("Cole algum código HTML.", "error");
          el.codeInput.focus();
          return;
        }
        await convertFromHtmlString(code);
      }
      setStatus("Pronto! Confira a pré-visualização e clique em Baixar.", "ok");
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Ocorreu um erro na conversão.", "error");
    } finally {
      showOverlay(false);
    }
  }

  // =====================================================================
  //  Manipulação de arquivos (upload / drag & drop)
  // =====================================================================

  function readFile(file) {
    if (!file) return;
    const okType =
      /\.html?$/i.test(file.name) || file.type === "text/html" || file.type === "";
    if (!okType) {
      setStatus("Envie um arquivo .html ou .htm.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      uploadedHtml = String(reader.result || "");
      uploadedName = file.name;
      el.fileName.textContent = file.name;
      setStatus(`Arquivo “${file.name}” carregado.`, "ok");
    };
    reader.onerror = () => setStatus("Não foi possível ler o arquivo.", "error");
    reader.readAsText(file);
  }

  function resetAll() {
    el.aiPrompt.value = "";
    el.codeInput.value = "";
    el.fileInput.value = "";
    uploadedHtml = null;
    uploadedName = null;
    generatedHtml = null;
    generatedSize = null;
    el.fileName.textContent = "Nenhum arquivo escolhido";
    el.aiPreview.hidden = true;
    el.aiEditBtn.hidden = true;
    currentResult = null;
    el.resultCard.hidden = true;
    el.preview.innerHTML = "";
    setStatus("");
    setAiStatus("");
  }

  // =====================================================================
  //  Eventos
  // =====================================================================

  function bindEvents() {
    el.tabs.forEach((t) =>
      t.addEventListener("click", () => switchTab(t.dataset.tab))
    );

    el.format.addEventListener("change", syncFormatOptions);
    el.preset.addEventListener("change", syncPreset);
    [el.width, el.height].forEach((inp) =>
      inp.addEventListener("input", () => {
        // Edição manual dos campos => muda o preset para "Personalizado".
        if (el.preset.value !== "auto" && el.preset.value !== "custom") {
          el.preset.value = "custom";
          el.height.disabled = false;
        }
      })
    );
    el.quality.addEventListener("input", () => {
      el.qualityVal.textContent = el.quality.value + "%";
    });

    el.convertBtn.addEventListener("click", handleConvert);
    el.resetBtn.addEventListener("click", resetAll);

    el.downloadBtn.addEventListener("click", () => {
      if (currentResult) downloadBlob(currentResult.blob, currentResult.filename);
    });

    // Gerar com IA
    el.aiProvider.addEventListener("change", syncProvider);
    [el.aiBase, el.aiKey].forEach((inp) =>
      inp.addEventListener("input", persistCurrentFields)
    );
    el.aiTestBtn.addEventListener("click", handleTestConnection);
    el.aiModelSelect.addEventListener("change", persistCurrentFields);
    el.aiSystem.addEventListener("input", () => {
      setLS(STORE.system, el.aiSystem.value);
      refreshStyleActive();
    });
    el.aiGenConvertBtn.addEventListener("click", handleGenerateAndConvert);
    el.aiGenerateBtn.addEventListener("click", handleGenerate);
    el.aiEditBtn.addEventListener("click", handleAiEdit);
    el.aiKeyToggle.addEventListener("click", () => {
      el.aiKey.type = el.aiKey.type === "password" ? "text" : "password";
    });

    // Pré-visualização com zoom
    el.aiExpandBtn.addEventListener("click", openExpand);
    el.expandClose.addEventListener("click", closeExpand);
    el.zoomIn.addEventListener("click", () => applyZoom(expandZoom * 1.25));
    el.zoomOut.addEventListener("click", () => applyZoom(expandZoom / 1.25));
    el.zoomFit.addEventListener("click", fitZoom);
    el.expandModal.addEventListener("click", (e) => {
      if (e.target === el.expandModal) closeExpand();
    });
    document.addEventListener("keydown", (e) => {
      if (el.expandModal.hidden) return;
      if (e.key === "Escape") closeExpand();
      else if (e.key === "+" || e.key === "=") applyZoom(expandZoom * 1.25);
      else if (e.key === "-") applyZoom(expandZoom / 1.25);
      else if (e.key === "0") fitZoom();
    });
    window.addEventListener("resize", () => {
      if (!el.expandModal.hidden) fitZoom();
    });

    // Tema claro/escuro
    el.themeToggle.addEventListener("click", () => {
      const next =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      setLS(THEME_KEY, next);
    });

    // Upload
    el.dropzone.addEventListener("click", () => el.fileInput.click());
    el.dropzone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        el.fileInput.click();
      }
    });
    el.fileInput.addEventListener("change", (e) => readFile(e.target.files[0]));

    ["dragenter", "dragover"].forEach((ev) =>
      el.dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        el.dropzone.classList.add("is-drag");
      })
    );
    ["dragleave", "drop"].forEach((ev) =>
      el.dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        el.dropzone.classList.remove("is-drag");
      })
    );
    el.dropzone.addEventListener("drop", (e) => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      readFile(file);
    });
  }

  // ---- Init ------------------------------------------------------------
  function init() {
    if (typeof html2canvas === "undefined") {
      setStatus(
        "Não foi possível carregar a biblioteca de captura (verifique sua conexão).",
        "error"
      );
    }
    initTheme();
    bindEvents();
    initProviderState();
    el.aiSystem.value = getLS(STORE.system);
    renderStyleGallery();
    syncFormatOptions();
    syncPreset();
    switchTab("ai");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
