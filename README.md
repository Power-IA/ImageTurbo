# Criador de Imagens HTML

Site em **HTML + CSS + JavaScript puro** para **criar imagens com elementos HTML** (posts, thumbnails, banners). A arte vem de:

- um **HTML gerado por IA** (especialista em design gráfico) a partir de um prompt, **ou**
- um **arquivo `.html`** enviado, **ou**
- um **trecho de código HTML** colado

…e é exportada como **imagem** (`PNG`, `JPG`, `WEBP`), com download direto. A conversão roda inteiramente no navegador. Tem **modo claro/escuro** (botão no cabeçalho).

## Dimensões (redes sociais)

Um seletor de **Dimensões** define o tamanho exato da arte e da exportação:

| Preset | Tamanho |
|---|---|
| Instagram · Post | 1080×1080 |
| Instagram · Retrato | 1080×1350 |
| Instagram · Story/Reels | 1080×1920 |
| YouTube · Thumbnail | 1280×720 |
| Facebook · Post | 1200×630 |
| X/Twitter · Post | 1600×900 |
| LinkedIn · Post | 1200×627 |
| Pinterest · Pin | 1000×1500 |
| E-book · Capa | 1600×2560 |
| Personalizado | largura × altura à sua escolha |
| Automático | largura fixa, altura ajustada ao conteúdo |

A **escala** multiplica a resolução final (um post 1080×1080 em 2× exporta 2160×2160). Use **1× (exato)** para o tamanho exato do preset.

## Como usar

1. Abra o `index.html` no navegador (duplo clique já funciona).
   - É necessário **internet** na primeira carga, pois usa `html2canvas` via CDN.
2. Escolha a aba: **Gerar com IA**, **Arquivo HTML** ou **Código HTML**.
3. Escolha o **formato** (PNG/JPG/WEBP), as **dimensões** e a qualidade.
4. Clique em **Converter** e depois em **Baixar**.

## Gerar com IA

A IA é instruída a atuar como **designer gráfico**, criando composições visuais (formas, gradientes, cores, tipografia) no tamanho escolhido em **Dimensões**. Na aba **Gerar com IA**:

1. Descreva a arte desejada no prompt.
2. Em **Configurações da IA**, escolha o **provedor**, informe a **chave** e o **modelo**.
   - **Testar conexão:** valida a chave/URL e lista os modelos do provedor (`GET {base}/models`) numa combobox para seleção.
   - **Estilos rápidos:** chips que preenchem as instruções de sistema com um clique (Minimalista, Dark/Neon, Retrô, Corporativo, Brutalismo, Memphis, Glassmorphism, Luxo, Cyberpunk e **📕 Capa e-book · Brutalismo**, que já ajusta as dimensões para 1600×2560).
   - **Instruções de sistema (opcional):** texto adicionado ao prompt de sistema do gerador (mantém a especialização gráfica e as dimensões). Salvo no `localStorage`.
3. Clique em **⚡ Gerar e converter** (faz tudo de uma vez) ou em **Só gerar HTML** para revisar a pré-visualização antes. Use **🔍 Ampliar (zoom)** para abrir o visualizador, que já abre no zoom que mostra toda a arte proporcionalmente, com controles **−/+/Ajustar** (e teclas `+`, `−`, `0`, `Esc`).
4. Se gerou só o HTML, clique em **Converter** para a imagem (ou em **Editar no Código HTML** para ajustar antes).

### Provedores

| Provedor | API | URL base padrão |
|---|---|---|
| Anthropic (Claude) | nativa `/v1/messages` | `https://api.anthropic.com/v1` |
| OpenAI | OpenAI `/chat/completions` | `https://api.openai.com/v1` |
| OpenRouter | OpenAI | `https://openrouter.ai/api/v1` |
| Groq | OpenAI | `https://api.groq.com/openai/v1` |
| DeepSeek | OpenAI | `https://api.deepseek.com/v1` |
| Mistral | OpenAI | `https://api.mistral.ai/v1` |
| xAI (Grok) | OpenAI | `https://api.x.ai/v1` |
| Google (Gemini) | OpenAI | `https://generativelanguage.googleapis.com/v1beta/openai` |
| Together AI | OpenAI | `https://api.together.xyz/v1` |
| **Personalizado** | OpenAI | informe a sua URL base |

- Qualquer serviço **compatível com a OpenAI** funciona em **Personalizado** — basta a URL base (sem `/chat/completions`). Inclui Azure OpenAI, Ollama (`http://localhost:11434/v1`), LM Studio, vLLM, etc.
- A URL base é **editável para todos os provedores** (útil para gateways/proxies).
- A **chave** e o **modelo** são guardados por provedor apenas no `localStorage`. Como é client-side, quem tiver acesso ao navegador pode lê-los — não use em página pública compartilhada.

### CORS

A chamada vai direto do navegador ao provedor. OpenAI, OpenRouter, Groq e Anthropic costumam permitir; outros podem bloquear (CORS). Nesses casos, use um endpoint/proxy que habilite CORS, ou um provedor local (Ollama/LM Studio).

## Caminhos de conversão

| Entrada | Mecanismo | Observações |
|---|---|---|
| Gerar com IA | API da Anthropic gera o HTML → `html2canvas` captura | Requer chave de API e internet |
| Arquivo HTML | Renderiza em `<iframe>` e captura com `html2canvas` | 100% local |
| Código HTML | Idem | 100% local |

A captura usa `html2canvas`; por segurança do navegador, alguns recursos de outros domínios (certas imagens/fontes) podem não aparecer perfeitamente.

## Arquivos

```
conversor-web/
├── index.html   # estrutura e textos
├── styles.css   # aparência (responsivo)
├── app.js       # lógica de geração (IA) e conversão
└── README.md
```

## Privacidade

A conversão acontece no seu navegador. No modo **Gerar com IA**, apenas o texto do prompt e a chave seguem para a API da Anthropic.
