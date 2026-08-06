# Rota Leste — Mapa de Lojas e Rotas Diárias

Site estático (mobile-first) para a equipe de vendas externa visualizar as lojas
parceiras, entender a concentração por bairro/linha e gerar rotas diárias de
visita direto no Google Maps ou Waze, pelo celular.

## O que tem no site

- **Mapa** — todas as 52 lojas em um mapa real (OpenStreetMap/Leaflet, 100% gratuito,
  sem chave de API), com pino colorido por "linha" (grupo de rota/dia da semana).
- **Linhas** — versão ilustrada estilo "mapa de metrô" (inspirada no mapa de metrô
  que você enviou): cada linha colorida é um dia da semana, e cada "estação" é uma
  loja. O tamanho do círculo indica a concentração de gravames no mercado.
- **Lojas** — lista com busca e filtro por linha/dia, para montar uma rota
  personalizada marcando lojas específicas.
- **Rota diária** — seleciona lojas (ou toda uma linha) e abre a rota multi-parada
  direto no app do Google Maps do celular (ou Waze loja a loja), sem precisar de
  chave de API paga.

## Sobre a localização das lojas

As posições no mapa/linhas são posicionadas por **bairro** (nível aproximado),
para dar uma visão rápida da concentração geográfica. A navegação (botões
"Abrir no Maps" / "Abrir no Waze") usa sempre o **endereço completo e exato**
de cada loja (rua, número, bairro, cidade, CEP) — o Google/Waze geocodifica o
endereço exato na hora de abrir a rota. Ou seja: a visão geral é aproximada,
mas a navegação real chega no endereço certo.

Se quiser depois pinos com coordenadas exatas de cada loja (geocodificação
endereço a endereço), dá para gerar isso com uma chave gratuita do
[Nominatim/OpenStreetMap](https://nominatim.org/) ou do Google Geocoding API —
me avise que eu gero o `data.js` atualizado.

## Estrutura

```
index.html      → estrutura da página (3 abas: Mapa / Linhas / Lojas)
style.css       → visual mobile-first (branco, verde claro, azul escuro)
app.js          → toda a lógica (mapa, diagrama de linhas, lista, rotas)
data.js         → dados das lojas gerados a partir da planilha RUBENS_NOVAS_AREAS.xlsx
                  (window.APP_DATA), já no formato usado pelo site
```

Tudo é HTML/CSS/JS puro — não precisa de build, servidor ou banco de dados.

## Como publicar no GitHub Pages (gratuito)

1. Crie um repositório novo no GitHub (pode ser privado ou público),
   por exemplo `rota-leste`.
2. Suba os 4 arquivos (`index.html`, `style.css`, `app.js`, `data.js`) para a
   raiz do repositório — pelo site do GitHub mesmo ("Add file → Upload files")
   ou via git:
   ```bash
   git init
   git add index.html style.css app.js data.js README.md
   git commit -m "Rota Leste - mapa de lojas"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/rota-leste.git
   git push -u origin main
   ```
3. No GitHub, vá em **Settings → Pages**.
4. Em "Build and deployment", escolha **Deploy from a branch**, branch **main**,
   pasta **/(root)**, e salve.
5. Em 1–2 minutos o site estará no ar em:
   `https://SEU-USUARIO.github.io/rota-leste/`
6. No celular, abra esse link e use **"Adicionar à tela de início"** (Chrome/Safari)
   para funcionar como um app.

## Atualizando a lista de lojas depois

Sempre que a planilha mudar, me envie a nova versão do `.xlsx` que eu regenero
o `data.js` automaticamente (mesmo formato), e você só precisa substituir esse
arquivo no repositório — o resto do site continua igual.
