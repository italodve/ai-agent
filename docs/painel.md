# Painel Sua Imobiliária — Imóveis e Leads

Dashboard web (HTML/CSS/JS puro, sem build) para **cadastrar casas/apartamentos** e **gerir os leads** que chegam pelo chat do site, integrado à planilha do Google.

## Funcionalidades

- **Visão geral**: indicadores (imóveis, disponíveis, total de leads, leads novos), gráfico de imóveis por status e leads recentes.
- **Imóveis**: cadastro, edição e exclusão de imóveis (tipo, finalidade, preço, bairro, cidade, quartos, banheiros, vagas, área, foto, descrição), com busca, filtro por status e exportação CSV.
- **Leads**: tabela e funil com os leads lidos da planilha, busca, filtro e mudança de status (**lead novo / aquecido / vendido**) com exportação CSV. Em modo nuvem, o status é gravado **em tempo real na coluna E da aba `Leads`** — todos os dispositivos veem o mesmo status. O painel também se atualiza sozinho a cada 15 segundos, então leads novos capturados pelo chat aparecem sem recarregar a página.

## Como funciona (dois modos)

### Modo local (padrão, sem configuração)
- Os **leads** são lidos direto da planilha do Google (endpoint `gviz`). Basta a planilha estar compartilhada como **"Qualquer pessoa com o link pode ver"**.
- Os **imóveis** ficam salvos **neste navegador** (localStorage) e o status dos leads também.

> Limitação: neste modo os imóveis ficam só neste navegador e **não aparecem no site público**, e o status dos leads não sincroniza entre dispositivos. Para publicá-los e ter o status em tempo real na planilha, use o modo nuvem.

### Modo nuvem (recomendado, necessário para o site público)
Salva os imóveis na própria planilha (aba `Imoveis`), de onde o **site público**
([repositório `site-imob`](../site-imob)) os lê e exibe automaticamente.

1. Abra a planilha de leads e crie as abas **`Leads`** e **`Imoveis`**.
2. Em **Extensões > Apps Script**, cole o conteúdo de [`apps-script.gs`](./apps-script.gs).
3. **Implantar > Nova implantação > App da Web**, acesso **"Qualquer pessoa"**, e copie a URL `/exec`.
4. No painel, clique no indicador de status no rodapé da barra lateral (⚙ **Modo local**), cole a URL `/exec` e salve. A configuração fica guardada neste navegador — não é preciso editar código. (Alternativamente, dá para preencher `CONFIG.WEB_APP_URL` no [`app.js`](./app.js).)

> **Fotos dos imóveis:** informe a **URL** de uma imagem já publicada (ex.: link de uma foto hospedada). É essa URL que o site público exibe. Não é feito upload de arquivo, pois imagens embutidas não caberiam na célula da planilha.

## Configuração (`app.js`)

```js
const CONFIG = {
  SHEET_ID: "1Z1-IkTqozPVzWIdQiZt-rbIxF0XaDfOVn33WxEkY-QI", // planilha dos leads
  LEADS_SHEET: "Leads",   // nome da aba dos leads
  WEB_APP_URL: ""         // URL do Apps Script (modo nuvem); pode ser definida pela interface
};
```

> A URL do modo nuvem também pode ser configurada pela própria interface (⚙ no rodapé da barra lateral) e fica salva no navegador, sobrepondo o valor acima.

## Rodando localmente

É um site estático. Sirva por HTTP (recomendado, evita bloqueios do navegador):

```bash
python3 -m http.server 8080
# abra http://localhost:8080
```

Ou publique em qualquer hospedagem estática (Railway, Vercel, Netlify, GitHub Pages).

## Estrutura

- `index.html` — estrutura do painel
- `styles.css` — estilo (identidade Sua Imobiliária, responsivo)
- `app.js` — lógica, fonte de dados e renderização
- `apps-script.gs` — backend opcional no Google Apps Script
