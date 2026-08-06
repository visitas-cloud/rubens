(function(){
  "use strict";
  const DATA = APP_DATA;
  const LOJAS = DATA.lojas;
  const LINHAS = DATA.linhas;

  // ---------- state ----------
  const selected = new Set();      // ids selected for custom route
  let activeLinhaFilter = "all";
  let searchTerm = "";

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
  function linhaNome(id){ return (LINHAS[id] && LINHAS[id].nome) || "Linha"; }
  function linhaDia(id){ return (LINHAS[id] && LINHAS[id].dia) || ""; }

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

    // legend
    const legend = document.getElementById("map-legend");
    legend.innerHTML = '<div class="legend-title">Linhas / dias</div>' +
      Object.entries(LINHAS).map(([id,l]) =>
        `<div class="legend-row"><span class="legend-dot" style="background:${l.cor}"></span>${l.nome} · ${l.dia}</div>`
      ).join("");
  }

  // ==========================================================
  // METRO / LINE DIAGRAM (SVG) — one line per row, stations = lojas
  // ==========================================================
  function buildMetroSVG(){
    const linhaIds = Object.keys(LINHAS).map(Number).sort((a,b)=>a-b);
    const rowH = 150;
    const width = 1000;
    const stationGap = 92;
    const marginLeft = 130;
    const height = linhaIds.length * rowH + 40;

    let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="inherit">`;
    svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`;

    linhaIds.forEach((lid, rowIdx) => {
      const y = 60 + rowIdx * rowH;
      const color = linhaColor(lid);
      const stations = LOJAS.filter(l => l.linha === lid).sort((a,b)=>a.ordemRota-b.ordemRota);
      const lineEndX = marginLeft + (stations.length-1) * stationGap + 40;

      // line title
      svg += `<text x="18" y="${y-28}" class="metro-line-title" fill="${color}">${linhaNome(lid)}</text>`;
      svg += `<text x="18" y="${y-12}" class="metro-day" fill="${color}">${linhaDia(lid)} · ${stations.length} lojas</text>`;

      // rail
      svg += `<line x1="${marginLeft}" y1="${y}" x2="${lineEndX}" y2="${y}" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`;

      stations.forEach((s, i) => {
        const x = marginLeft + i * stationGap;
        const r = 8 + Math.min(s.gravamesMercado||0, 20) * 0.35; // bigger = more concentração de gravames
        svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" stroke="${color}" stroke-width="5" data-store="${s.id}" class="metro-station" style="cursor:pointer"/>`;
        // label alternating above/below to avoid overlap
        const above = i % 2 === 0;
        const labelY = above ? y - 16 : y + 26;
        const subY = above ? y - 4 : y + 38;
        const shortName = s.nome.length > 16 ? s.nome.slice(0,15)+"…" : s.nome;
        svg += `<text x="${x}" y="${labelY}" text-anchor="middle" class="metro-station-label" data-store="${s.id}" style="cursor:pointer">${shortName}</text>`;
        svg += `<text x="${x}" y="${subY}" text-anchor="middle" class="metro-station-sub">${s.bairro}</text>`;
      });
    });

    svg += `</svg>`;
    const holder = document.getElementById("metro-svg-holder");
    holder.innerHTML = svg;
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
      Object.entries(LINHAS).map(([id,l]) => ({id, label:l.dia.split("-")[0]}))
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

  function filteredLojas(){
    return LOJAS.filter(l => {
      if(activeLinhaFilter !== "all" && String(l.linha) !== String(activeLinhaFilter)) return false;
      if(!searchTerm) return true;
      const hay = (l.nome + " " + l.bairro + " " + l.endereco).toLowerCase();
      return hay.includes(searchTerm);
    }).sort((a,b) => a.linha - b.linha || a.ordemRota - b.ordemRota);
  }

  function renderList(){
    const list = document.getElementById("store-list");
    const items = filteredLojas();
    list.innerHTML = "";
    if(items.length === 0){
      list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--ink-soft);font-size:13px;">Nenhuma loja encontrada.</div>';
      return;
    }
    items.forEach(loja => {
      const card = document.createElement("div");
      card.className = "store-card";
      card.innerHTML = `
        <div class="route-check ${selected.has(loja.id) ? "checked":""}" data-check="${loja.id}">${selected.has(loja.id)?"✓":"+"}</div>
        <div class="store-card-main" data-open="${loja.id}">
          <div class="store-card-name">${loja.nome}</div>
          <div class="store-card-addr">${loja.endereco} · ${loja.bairro}</div>
          <div class="store-card-tags">
            <span class="tag navy" style="background:${linhaColor(loja.linha)}22;color:${linhaColor(loja.linha)}">${linhaNome(loja.linha)}</span>
            <span class="tag">${loja.porte || ""}</span>
          </div>
        </div>`;
      list.appendChild(card);
    });
    list.querySelectorAll("[data-open]").forEach(el => el.addEventListener("click", () => openSheet(el.getAttribute("data-open"))));
    list.querySelectorAll("[data-check]").forEach(el => el.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSelect(el.getAttribute("data-check"));
    }));
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
  // STORE DETAIL SHEET
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
        <div class="stat-box"><div class="k">${linhaNome(loja.linha)}</div><div class="v">${linhaDia(loja.linha)}</div></div>
        <div class="stat-box"><div class="k">Gravames no mercado</div><div class="v">${loja.gravamesMercado}</div></div>
        <div class="stat-box"><div class="k">Potencial CB</div><div class="v">${loja.potencialCB}</div></div>
      </div>
      <div class="sheet-actions" style="margin-bottom:10px;">
        <a class="link-btn" href="${mapsSearchUrl(loja)}" target="_blank" rel="noopener">Abrir no Google Maps</a>
        <a class="link-btn alt" href="https://waze.com/ul?q=${encodeURIComponent(loja.enderecoCompleto)}&navigate=yes" target="_blank" rel="noopener">Abrir no Waze</a>
      </div>
      <button class="ghost-btn" id="sheet-toggle-route" style="width:100%;color:var(--navy);border-color:var(--line);padding:11px;border-radius:10px;font-size:13px;">
        ${selected.has(loja.id) ? "Remover da rota do dia" : "Adicionar à rota do dia"}
      </button>
    `;
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
  initMap();
  buildMetroSVG();
  buildFilters();
  renderList();

  // first-time help
  if(!localStorage.getItem("rotaleste_seen")){
    setTimeout(() => { helpSheet.classList.add("show"); helpBackdrop.classList.add("show"); }, 400);
    localStorage.setItem("rotaleste_seen","1");
  }
})();
