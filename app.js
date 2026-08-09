(function(){
  "use strict";

  // ---------- state (mutable — populated from Supabase or fallback) ----------
  let LOJAS = [];
  let LINHAS = {};
  let usingSupabase = false;
  let supabase = null;

  const selected = new Set();      // ids selected for custom route
  let activeLinhaFilter = "all";
  let searchTerm = "";

  // ---------- Supabase / data loading ----------
  async function loadData(){
    const cfg = window.SUPABASE_CONFIG || {};
    if(cfg.url && cfg.anonKey && window.supabase){
      try{
        supabase = window.supabase.createClient(cfg.url, cfg.anonKey);
        const [{data: regioes, error: e1}, {data: lojas, error: e2}] = await Promise.all([
          supabase.from("regioes").select("*").order("ordem"),
          supabase.from("lojas").select("*")
        ]);
        if(e1 || e2) throw (e1 || e2);
        if(regioes && regioes.length && lojas && lojas.length){
          LINHAS = {};
          regioes.forEach(r => { LINHAS[r.id] = { nome: r.nome, cor: r.cor, dia: r.dia }; });
          LOJAS = lojas.map(l => ({
            id: l.id, nome: l.nome, cnpj: l.cnpj, endereco: l.endereco, bairro: l.bairro,
            cidade: l.cidade, uf: l.uf, cep: l.cep, enderecoCompleto: l.endereco_completo,
            porte: l.porte, gravamesMercado: l.gravames_mercado, potencialCB: l.potencial_cb,
            zona: l.zona, lat: l.lat, lng: l.lng, linha: l.linha, ordemRota: l.ordem_rota
          }));
          usingSupabase = true;
          return;
        }
      }catch(err){
        console.warn("Supabase indisponível, usando dados locais.", err);
      }
    }
    // fallback: dados locais embutidos (data.js)
    LINHAS = FALLBACK_DATA.linhas;
    LOJAS = FALLBACK_DATA.lojas;
    usingSupabase = false;
  }

  // ---------- ping (mantém o projeto Supabase free ativo, sem pausar) ----------
  async function pingSupabase(){
    if(!usingSupabase || !supabase) return;
    try{
      await supabase.from("app_ping").update({ last_ping: new Date().toISOString() }).eq("id", 1);
    }catch(err){
      console.warn("Ping ao Supabase falhou (não crítico):", err);
    }
  }

  async function moveStoreToLinha(storeId, newLinhaId){
    const loja = byId(storeId);
    if(!loja) return;
    loja.linha = newLinhaId;
    if(usingSupabase && supabase){
      const { error } = await supabase.from("lojas").update({ linha: newLinhaId }).eq("id", storeId);
      if(error){ console.error(error); alert("Não foi possível salvar no Supabase. A mudança foi aplicada só nesta tela."); }
    }
    refreshAll();
  }

  function refreshAll(){
    rebuildMapMarkers();
    buildMetroSVG();
    buildFilters();
    renderList();
  }

  // ---------- helpers ----------
  function byId(id){ return LOJAS.find(l => l.id === id); }

  function mapsSearchUrl(loja){
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(loja.enderecoCompleto);
  }

  function mapsDirectionsUrl(lojasArr){
    if(lojasArr.length === 0) return "#";
    if(lojasArr.length === 1) return mapsSearchUrl(lojasArr[0]);
    const dest = lojasArr[lojasArr.length-1];
    const waypoints = lojasArr.slice(0, -1).map(l => encodeURIComponent(l.enderecoCompleto)).join("|");
    return "https://www.google.com/maps/dir/?api=1"
      + "&destination=" + encodeURIComponent(dest.enderecoCompleto)
      + (waypoints ? "&waypoints=" + waypoints : "")
      + "&travelmode=driving";
  }

  function linhaColor(id){ return (LINHAS[id] && LINHAS[id].cor) || "#0D2C54"; }
  function linhaNome(id){ return (LINHAS[id] && LINHAS[id].nome) || "Região"; }
  function linhaDia(id){ return (LINHAS[id] && LINHAS[id].dia) || ""; }
  function linhaIdsOrdenadas(){ return Object.keys(LINHAS).map(Number).sort((a,b)=>a-b); }

  function regionSelectHTML(currentId, selectId){
    const opts = linhaIdsOrdenadas().map(lid =>
      `<option value="${lid}" ${lid === currentId ? "selected" : ""}>${linhaDia(lid)} — ${linhaNome(lid)}</option>`
    ).join("");
    return `<select id="${selectId}" class="region-select">${opts}</select>`;
  }

  // ---------- tabs ----------
  const tabs = document.querySelectorAll(".tab");
  const views = { map: document.getElementById("view-map"), metro: document.getElementById("view-metro"), list: document.getElementById("view-list") };
  tabs.forEach(t => t.addEventListener("click", () => {
    tabs.forEach(x => { x.classList.remove("active"); x.setAttribute("aria-selected","false"); });
    t.classList.add("active"); t.setAttribute("aria-selected","true");
    Object.values(views).forEach(v => v.classList.remove("active"));
    views[t.dataset.view].classList.add("active");
    if(t.dataset.view === "map" && map){ setTimeout(()=>map.invalidateSize(), 80); }
  }));

  // ==========================================================
  // MAP VIEW (Leaflet)
  // ==========================================================
  let map, markersLayer;
  function initMap(){
    map = L.map("leaflet-map", { zoomControl:false, attributionControl:true }).setView([-23.558,-46.552], 12);
    L.control.zoom({position:"bottomright"}).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom:19,
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
    rebuildMapMarkers();
  }

  function rebuildMapMarkers(){
    if(!markersLayer) return;
    markersLayer.clearLayers();
    LOJAS.forEach(loja => {
      const color = linhaColor(loja.linha);
      const icon = L.divIcon({
        className: "",
        html: `<div class="store-pin" style="background:${color};position:relative;"></div>`,
        iconSize: [26,26],
        iconAnchor: [13,26],
        popupAnchor: [0,-24]
      });
      const marker = L.marker([loja.lat, loja.lng], {icon});
      marker.bindPopup(
        `<div class="popup-title">${loja.nome}</div>
         <div class="popup-sub">${loja.bairro} &middot; ${linhaNome(loja.linha)} (${linhaDia(loja.linha)})</div>
         <a class="popup-btn" href="${mapsSearchUrl(loja)}" target="_blank" rel="noopener">Abrir no Maps</a>`
      );
      marker.on("click", () => openSheet(loja.id));
      marker.addTo(markersLayer);
    });

    const legend = document.getElementById("map-legend");
    legend.innerHTML = '<div class="legend-title">Regiões / dias</div>' +
      linhaIdsOrdenadas().map(lid =>
        `<div class="legend-row"><span class="legend-dot" style="background:${linhaColor(lid)}"></span>${linhaNome(lid)} · ${linhaDia(lid)}</div>`
      ).join("");
  }

  // ==========================================================
  // REGIÃO — uma linha vertical por região/dia da semana, estações = lojas
  // ==========================================================
  function buildMetroSVG(){
    const holder = document.getElementById("metro-svg-holder");
    holder.innerHTML = "";

    linhaIdsOrdenadas().forEach(lid => {
      const color = linhaColor(lid);
      const stations = LOJAS.filter(l => l.linha === lid).sort((a,b)=>a.ordemRota-b.ordemRota);

      const width = 360;
      const stationGap = 74;
      const topPad = 70;
      const bottomPad = 20;
      const railX = 34;
      const height = topPad + Math.max(stations.length - 1, 0) * stationGap + bottomPad;

      let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="inherit">`;
      svg += `<text x="0" y="18" class="metro-day" fill="${color}">${linhaDia(lid)}</text>`;
      svg += `<text x="0" y="40" class="metro-line-title" fill="${color}">${linhaNome(lid)}</text>`;

      if(stations.length){
        const railTop = topPad;
        const railBottom = topPad + (stations.length - 1) * stationGap;
        svg += `<line x1="${railX}" y1="${railTop}" x2="${railX}" y2="${railBottom}" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`;

        stations.forEach((s, i) => {
          const y = topPad + i * stationGap;
          const r = 8 + Math.min(s.gravamesMercado||0, 20) * 0.35;
          svg += `<circle cx="${railX}" cy="${y}" r="${r}" fill="#ffffff" stroke="${color}" stroke-width="5" data-store="${s.id}" class="metro-station" style="cursor:pointer"/>`;
          const textX = railX + 26;
          const shortName = s.nome.length > 30 ? s.nome.slice(0,29)+"…" : s.nome;
          svg += `<text x="${textX}" y="${y-4}" class="metro-station-label" data-store="${s.id}" style="cursor:pointer">${shortName}</text>`;
          svg += `<text x="${textX}" y="${y+13}" class="metro-station-sub">${s.endereco}</text>`;
        });
      }

      svg += `</svg>`;

      const group = document.createElement("div");
      group.className = "metro-group";
      group.innerHTML = svg;
      holder.appendChild(group);
    });

    holder.querySelectorAll("[data-store]").forEach(el => {
      el.addEventListener("click", () => openSheet(el.getAttribute("data-store")));
    });
  }

  // ==========================================================
  // LIST VIEW
  // ==========================================================
  function buildFilters(){
    const wrap = document.getElementById("linha-filters");
    const chips = [{id:"all", label:"Todas"}].concat(
      linhaIdsOrdenadas().map(lid => ({id:String(lid), label:linhaDia(lid).split("-")[0]}))
    );
    wrap.innerHTML = "";
    chips.forEach(c => {
      const btn = document.createElement("button");
      btn.className = "chip" + (c.id === activeLinhaFilter ? " active" : "");
      btn.textContent = c.label;
      btn.dataset.id = c.id;
      btn.addEventListener("click", () => {
        activeLinhaFilter = c.id;
        wrap.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        renderList();
      });
      wrap.appendChild(btn);
    });
  }

  function renderList(){
    const list = document.getElementById("store-list");
    list.innerHTML = "";

    const linhaIds = linhaIdsOrdenadas()
      .filter(lid => activeLinhaFilter === "all" || String(lid) === String(activeLinhaFilter));

    let anyResults = false;

    linhaIds.forEach(lid => {
      const items = LOJAS.filter(l => {
        if(l.linha !== lid) return false;
        if(!searchTerm) return true;
        const hay = (l.nome + " " + l.bairro + " " + l.endereco).toLowerCase();
        return hay.includes(searchTerm);
      }).sort((a,b) => a.ordemRota - b.ordemRota);

      if(items.length === 0) return;
      anyResults = true;

      const color = linhaColor(lid);
      const section = document.createElement("div");
      section.className = "list-section";
      section.innerHTML = `
        <div class="list-section-header" style="border-left-color:${color}">
          <span class="list-section-day">${linhaDia(lid)}</span>
          <span class="list-section-name" style="color:${color}">${linhaNome(lid)}</span>
          <span class="list-section-count">${items.length} ${items.length===1?"loja":"lojas"}</span>
        </div>`;
      const cardsWrap = document.createElement("div");
      items.forEach(loja => {
        const card = document.createElement("div");
        card.className = "store-card";
        card.innerHTML = `
          <div class="route-check ${selected.has(loja.id) ? "checked":""}" data-check="${loja.id}">${selected.has(loja.id)?"✓":"+"}</div>
          <div class="store-card-main" data-open="${loja.id}">
            <div class="store-card-name">${loja.nome}</div>
            <div class="store-card-addr">${loja.endereco} · ${loja.bairro}</div>
            <div class="store-card-tags">
              <span class="tag">${loja.porte || ""}</span>
            </div>
          </div>
          <button class="move-btn" data-move="${loja.id}" title="Mover para outro dia">⇄</button>`;
        cardsWrap.appendChild(card);
      });
      section.appendChild(cardsWrap);
      list.appendChild(section);
    });

    if(!anyResults){
      list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--ink-soft);font-size:13px;">Nenhuma loja encontrada.</div>';
      return;
    }

    list.querySelectorAll("[data-open]").forEach(el => el.addEventListener("click", () => openSheet(el.getAttribute("data-open"))));
    list.querySelectorAll("[data-check]").forEach(el => el.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSelect(el.getAttribute("data-check"));
    }));
    list.querySelectorAll("[data-move]").forEach(el => el.addEventListener("click", (e) => {
      e.stopPropagation();
      openMoveInline(el.getAttribute("data-move"), el);
    }));
  }

  // quick inline move popover from the list card's ⇄ button
  let openMovePopover = null;
  function openMoveInline(storeId, anchorEl){
    if(openMovePopover){ openMovePopover.remove(); openMovePopover = null; }
    const loja = byId(storeId);
    if(!loja) return;
    const pop = document.createElement("div");
    pop.className = "move-popover";
    pop.innerHTML = `<div class="move-popover-title">Mover para outro dia</div>${regionSelectHTML(loja.linha, "inline-move-select")}`;
    anchorEl.parentElement.appendChild(pop);
    openMovePopover = pop;
    const select = pop.querySelector("#inline-move-select");
    select.addEventListener("change", async () => {
      await moveStoreToLinha(storeId, Number(select.value));
      pop.remove();
      openMovePopover = null;
    });
    document.addEventListener("click", function closeOnce(e){
      if(!pop.contains(e.target) && e.target !== anchorEl){
        pop.remove(); openMovePopover = null;
        document.removeEventListener("click", closeOnce);
      }
    }, {capture:true});
  }

  document.getElementById("search-input").addEventListener("input", (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    renderList();
  });

  // ==========================================================
  // ROUTE SELECTION + BAR
  // ==========================================================
  function toggleSelect(id){
    if(selected.has(id)) selected.delete(id); else selected.add(id);
    renderList();
    updateRouteBar();
  }

  function updateRouteBar(){
    const bar = document.getElementById("route-bar");
    const count = selected.size;
    document.getElementById("route-bar-count").textContent =
      count === 0 ? "Nenhuma loja selecionada" : count + (count===1 ? " loja selecionada" : " lojas selecionadas");
    bar.classList.toggle("show", count > 0);
  }

  document.getElementById("route-clear").addEventListener("click", () => {
    selected.clear(); renderList(); updateRouteBar();
  });
  document.getElementById("route-go").addEventListener("click", () => {
    const arr = Array.from(selected).map(byId).filter(Boolean)
      .sort((a,b)=> a.linha-b.linha || a.ordemRota-b.ordemRota);
    if(arr.length === 0) return;
    window.open(mapsDirectionsUrl(arr), "_blank");
  });

  // ==========================================================
  // STORE DETAIL SHEET (usado pelo Mapa, Região e Lojas)
  // ==========================================================
  const sheet = document.getElementById("store-sheet");
  const sheetBackdrop = document.getElementById("sheet-backdrop");
  function openSheet(id){
    const loja = byId(id);
    if(!loja) return;
    document.getElementById("sheet-content").innerHTML = `
      <div class="sheet-title">${loja.nome}</div>
      <div class="sheet-addr">${loja.enderecoCompleto}</div>
      <div class="sheet-grid">
        <div class="stat-box"><div class="k">Porte</div><div class="v">${loja.porte || "—"}</div></div>
        <div class="stat-box"><div class="k">Dia da rota</div><div class="v">${linhaDia(loja.linha)}</div></div>
        <div class="stat-box"><div class="k">Região</div><div class="v">${linhaNome(loja.linha)}</div></div>
        <div class="stat-box"><div class="k">Gravames no mercado</div><div class="v">${loja.gravamesMercado}</div></div>
        <div class="stat-box"><div class="k">Potencial CB</div><div class="v">${loja.potencialCB}</div></div>
      </div>
      <div class="sheet-actions" style="margin-bottom:10px;">
        <a class="link-btn" href="${mapsSearchUrl(loja)}" target="_blank" rel="noopener">Abrir no Google Maps</a>
        <a class="link-btn alt" href="https://waze.com/ul?q=${encodeURIComponent(loja.enderecoCompleto)}&navigate=yes" target="_blank" rel="noopener">Abrir no Waze</a>
      </div>
      <div class="move-field">
        <label for="sheet-move-select">Mover esta loja para outra região / dia</label>
        ${regionSelectHTML(loja.linha, "sheet-move-select")}
      </div>
      <button class="ghost-btn" id="sheet-toggle-route" style="width:100%;color:var(--navy);border-color:var(--line);padding:11px;border-radius:10px;font-size:13px;margin-top:10px;">
        ${selected.has(loja.id) ? "Remover da rota do dia" : "Adicionar à rota do dia"}
      </button>
      ${!usingSupabase ? '<div class="offline-note">Supabase não configurado: mudanças de região ficam só nesta sessão. Veja config.js.</div>' : ""}
    `;
    document.getElementById("sheet-move-select").addEventListener("change", async (e) => {
      await moveStoreToLinha(loja.id, Number(e.target.value));
      closeSheet();
    });
    document.getElementById("sheet-toggle-route").addEventListener("click", () => {
      toggleSelect(loja.id);
      closeSheet();
    });
    sheet.classList.add("show");
    sheetBackdrop.classList.add("show");
  }
  function closeSheet(){ sheet.classList.remove("show"); sheetBackdrop.classList.remove("show"); }
  sheetBackdrop.addEventListener("click", closeSheet);

  // ==========================================================
  // HELP SHEET
  // ==========================================================
  const helpSheet = document.getElementById("help-sheet");
  const helpBackdrop = document.getElementById("help-backdrop");
  document.getElementById("btn-help").addEventListener("click", () => {
    helpSheet.classList.add("show"); helpBackdrop.classList.add("show");
  });
  function closeHelp(){ helpSheet.classList.remove("show"); helpBackdrop.classList.remove("show"); }
  helpBackdrop.addEventListener("click", closeHelp);
  document.getElementById("help-close").addEventListener("click", closeHelp);

  // ==========================================================
  // INIT
  // ==========================================================
  (async function init(){
    await loadData();
    pingSupabase();
    initMap();
    buildMetroSVG();
    buildFilters();
    renderList();

    if(!localStorage.getItem("lojasgcm_seen")){
      setTimeout(() => { helpSheet.classList.add("show"); helpBackdrop.classList.add("show"); }, 400);
      localStorage.setItem("lojasgcm_seen","1");
    }
  })();
})();
