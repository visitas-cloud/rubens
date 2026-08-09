# Lojas GCM — Mapa, Regiões e Rotas Diárias

Site estático (mobile-first) para a equipe externa visualizar as lojas parceiras,
organizadas em 5 regiões (uma por dia da semana, segunda a sexta), com mapa,
diagrama estilo metrô, lista agrupada e geração de rota direto no Google Maps/Waze.

Agora os dados das lojas podem ficar guardados no **Supabase** (banco de dados
gratuito), e a equipe pode **migrar lojas de uma região/dia para outro** direto
pelo celular — tanto na aba **Região** (clicando na "estação"/loja) quanto na
aba **Lojas** (botão ⇄ no card, ou abrindo o card).

## O que tem no site

- **Mapa** — todas as lojas em um mapa real (OpenStreetMap/Leaflet, gratuito).
- **Região** — diagrama estilo metrô, uma linha vertical por dia da semana.
- **Lojas** — lista agrupada por dia (Segunda · Mooca, Terça · Parque da Mooca...),
  com busca, filtro e botão de mover.
- **Rota diária** — seleciona lojas e abre a rota multi-parada no Google Maps/Waze.
- **Mover loja de região/dia** — em qualquer loja (mapa, região ou lista), dá pra
  trocar o dia/região dela. Se o Supabase estiver configurado, a mudança fica
  salva para sempre e todo mundo que abrir o site vê a atualização.

## Estrutura

```
index.html        → estrutura da página (abas Mapa / Região / Lojas)
style.css         → visual mobile-first (branco, verde claro, azul-marinho)
app.js            → toda a lógica (mapa, diagrama, lista, rotas, mover loja)
config.js         → onde você cola a URL e a chave do SEU Supabase
data.js           → dados locais de reserva (usados só se o Supabase não
                     estiver configurado ou estiver fora do ar)
supabase/schema.sql → cria as tabelas "regioes" e "lojas" no Supabase
supabase/seed.sql   → popula essas tabelas com as lojas da planilha atual
```

## Supabase já configurado

O `config.js` já está com a URL e a chave `anon` do projeto Supabase de vocês
(`tecpyernkybpjzavossp`). Só falta rodar o `supabase/schema.sql` e depois o
`supabase/seed.sql` no SQL Editor do projeto (passo a passo abaixo) — depois
disso o site já lê e grava direto nesse banco.

## Como configurar o Supabase (gratuito)

1. Crie uma conta e um projeto em [supabase.com](https://supabase.com) (plano
   Free já é suficiente).
2. No painel do projeto, vá em **SQL Editor → New query**, cole o conteúdo de
   `supabase/schema.sql` e rode (isso cria as tabelas `regioes` e `lojas`).
3. Abra uma nova query, cole o conteúdo de `supabase/seed.sql` e rode (isso
   cadastra as 5 regiões e as 51 lojas da planilha atual).
4. Vá em **Project Settings → API** e copie:
   - **Project URL**
   - **anon public key**
5. Cole os dois valores no arquivo `config.js`:
   ```js
   const SUPABASE_CONFIG = {
     url: "https://xxxxxxxxxxxx.supabase.co",
     anonKey: "eyJhbGciOi..."
   };
   ```
6. Pronto — agora o site lê e grava direto no seu Supabase. Se `config.js`
   ficar vazio, o site continua funcionando normalmente com os dados locais
   (`data.js`), só que as mudanças de região não são salvas entre sessões.

**Sobre segurança:** por padrão o `schema.sql` libera leitura e escrita da
tabela `lojas` para qualquer pessoa com o link do site (não tem login). Isso é
de propósito, para ser simples de usar pela equipe externa. Se quiser exigir
login para editar, me avise que ajusto as *policies* de RLS no Supabase para
exigir autenticação.

## Projeto Supabase não fica pausado

Projetos gratuitos do Supabase pausam depois de ~1 semana sem nenhuma
atividade na API. Para evitar isso, toda vez que alguém abre o site, o
`app.js` grava automaticamente a hora atual numa tabelinha `app_ping`
(criada pelo `schema.sql`) — isso já conta como atividade e mantém o projeto
ativo. Ou seja: **contanto que alguém da equipe abra o site pelo menos uma
vez por semana, o banco nunca pausa**, sem precisar fazer nada manual.

Se quiser uma garantia extra (por exemplo, em época de férias em que ninguém
abre o site), dá para usar um serviço gratuito de "ping" externo, como o
[cron-job.org](https://cron-job.org) ou o [UptimeRobot](https://uptimerobot.com),
configurado para acessar 1x por semana esta URL (troque pela sua):
```
https://tecpyernkybpjzavossp.supabase.co/rest/v1/app_ping?select=id
```
com o header `apikey: <sua anon key>`. Isso é totalmente opcional.

## Como publicar no GitHub Pages (gratuito)

1. Crie um repositório novo no GitHub (ex: `lojas-gcm`).
2. Suba os arquivos `index.html`, `style.css`, `app.js`, `config.js`, `data.js`
   para a raiz do repositório (a pasta `supabase/` não precisa ir para o site,
   é só para você rodar no painel do Supabase uma vez).
3. Em **Settings → Pages**, escolha **Deploy from a branch**, branch **main**,
   pasta **/(root)**, e salve.
4. Em 1–2 minutos o site estará em `https://SEU-USUARIO.github.io/lojas-gcm/`.
5. No celular, abra o link e use **"Adicionar à tela de início"** para virar
   um app.

## Atualizando a lista de lojas depois

Se a planilha mudar de novo, me envie o novo `.xlsx` que eu gero um `seed.sql`
atualizado — rodando ele no SQL Editor do Supabase, as lojas novas entram e as
que já existem são atualizadas (o campo "região/dia" de lojas que a equipe já
migrou manualmente **não é sobrescrito**, para não perder o trabalho de ajuste
feito na equipe).
