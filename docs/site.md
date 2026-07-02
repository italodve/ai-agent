# Deivid Vilela · Consultor Imobiliário

Site estático premium em HTML, CSS e JavaScript, com identidade visual dourado sobre azul escuro e foco em conversão (WhatsApp + chat com IA).

## Contato

- WhatsApp / Telefone: **+55 11 98590-6431** (`5511985906431`)
- Região de atuação: Itapevi e região metropolitana de São Paulo
- O número fica em `script.js`, na constante `numeroEmpresa`.

## Imagens

As 8 fotos geradas seguindo o `SCRIPT-GOOGLE-FLOW.md` já estão na raiz do
projeto (nomes exatos usados no `index.html`):

| Arquivo | Proporção | Uso |
| --- | --- | --- |
| `hero.jpg` | 16:9 | Fundo da seção hero |
| `servico-compra.jpg` | 4:3 | Serviço · compra de imóveis |
| `servico-venda.jpg` | 4:3 | Serviço · venda de imóveis |
| `servico-locacao.jpg` | 4:3 | Serviço · locação |
| `imovel-casa.jpg` | 16:9 | Imóveis · casa residencial |
| `imovel-apartamento.jpg` | 4:3 | Imóveis · apartamento |
| `imovel-comercial.jpg` | 4:3 | Imóveis · sala comercial |
| `depoimento.jpg` | 4:3 | Seção de depoimento (cliente satisfeito) |

## Seção "Imóveis disponíveis" (dinâmica)

A seção `#imoveis` mostra os imóveis em carteira em cards
(`article.property-card`), cada um com foto, tipo (venda/locação), título,
bairro, características (quartos/vagas/m²), valor e um botão que abre o
WhatsApp já com uma mensagem mencionando aquele imóvel específico.

Os imóveis **não são mais escritos à mão no HTML**: eles são carregados
automaticamente da planilha do Google alimentada pelo **painel Sua Imobiliária**
([repositório `SIteLeads`](../SIteLeads)). O fluxo é:

1. O Deivid cadastra/edita os imóveis no painel (em modo nuvem).
2. O painel grava os imóveis na aba **`Imoveis`** da planilha.
3. Este site lê essa aba (somente leitura, via endpoint `gviz`) e monta os
   cards ao carregar a página.

Configuração em `script.js`, na constante `IMOVEIS_CONFIG` (`SHEET_ID` e
`SHEET_NAME`). Para a leitura funcionar, a planilha precisa estar compartilhada
como **"Qualquer pessoa com o link pode ver"**.

Regras da vitrine:

- Imóveis com status **Vendido** ou **Locado** não aparecem no site.
- A foto usa a **URL** cadastrada no imóvel; sem URL, cai numa imagem padrão
  conforme o tipo (casa/apartamento/comercial).
- Se a planilha estiver vazia ou indisponível, os **3 cards de exemplo** que
  ficam no `index.html` continuam aparecendo como fallback.

## Integração com o chat (ai-agent)

O chat do site conversa com o backend `ai-agent` (deploy no Railway). A URL base
fica em `script.js`, na constante `AI_AGENT_BASE_URL`. O agente coleta os dados do
lead (interesse, tipo de imóvel, região, valor) e encaminha ao WhatsApp do Deivid.

## Estrutura

- `index.html` — marcação semântica das seções (hero, serviços, imóveis, método, contato, chat).
- `styles.css` — design system dourado/azul escuro, responsivo.
- `script.js` — menu mobile, animações de revelação, formulário → WhatsApp, chat com IA e carregamento dinâmico dos imóveis da planilha.
- `SCRIPT-GOOGLE-FLOW.md` — briefing para o agente gerador de imagens.
