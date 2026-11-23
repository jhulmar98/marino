
"use strict";

/* ============================================
   PLAN DE OPERACIONES | SAN ISIDRO
   EDITOR DE RUTAS Y DESPLIEGUE OPERATIVO
   ARCHIVO: index.js
============================================ */

const $ = id => document.getElementById(id);

/* ============================================
   13 IMÁGENES MUNICIPALES
============================================ */

const ASSETS = {
  gaes: "./gaes.png",
  sereno: "./sereno.png",
  brigadistas: "./brigadistas.png",
  transito: "./transito.png",
  "persona-grd": "./persona-grd.png",

  carro: "./carro.png",
  motociclista: "./motociclista.png",
  ciclista: "./ciclista.png",
  "rescate-vehiculo": "./rescate-vehiculo.png",

  grd: "./grd.png",
  estrado: "./estrado.png",
  camara: "./camara.png",
  drones: "./drones.png"
};

/* ============================================
   NOMBRES PREDETERMINADOS
============================================ */

const DEFAULT_NAMES = {
  gaes: "PERSONAL GAES",
  sereno: "PERSONAL DE SERENAZGO",
  brigadistas: "PERSONAL DE BRIGADISTAS",
  transito: "PERSONAL DE TRÁNSITO",
  "persona-grd": "PERSONAL DE GRD",

  carro: "VEHÍCULO MUNICIPAL",
  motociclista: "MOTOCICLISTA",
  ciclista: "CICLISTA",
  "rescate-vehiculo": "VEHÍCULO DE RESCATE",

  grd: "CARPA DE GRD",
  estrado: "ESTRADO MUNICIPAL",
  camara: "CÁMARA DE VIGILANCIA",
  drones: "DRON DE VIGILANCIA",

  via: "AVENIDA O VÍA PRINCIPAL",
  calle: "NOMBRE DE CALLE",
  hora: "PUNTO DE CONTROL",
  texto: "MÓDULO MUNICIPAL"
};

/* ============================================
   ELEMENTOS DE LA LEYENDA
============================================ */

const LEGEND_LABELS = {
  gaes: "Personal GAES",
  sereno: "Personal de Serenazgo",
  brigadistas: "Personal de Brigadistas",
  transito: "Personal de Tránsito",
  "persona-grd": "Personal de GRD",

  carro: "Vehículos municipales",
  motociclista: "Motociclistas",
  ciclista: "Ciclistas",
  "rescate-vehiculo": "Vehículos de rescate",

  grd: "Carpas de GRD",
  estrado: "Estrados municipales",
  camara: "Cámaras de vigilancia",
  drones: "Drones de vigilancia",

  via: "Avenidas señalizadas",
  calle: "Calles señalizadas",
  hora: "Puntos con hora",
  texto: "Módulos / anotaciones"
};

/* ============================================
   CLAVES DE GUARDADO
============================================ */

const ROUTE_KEY = "san_isidro_ruta_v1";
const ITEMS_KEY = "san_isidro_elementos_v1";
const CONFIG_KEY = "san_isidro_encabezado_v1";

const LEGEND_KEY =
  "san_isidro_leyenda_editable_v1";

const CONFIG_IDS = [
  "superTitle",
  "routeTitle",
  "routeDate",
  "startText",
  "endText",

  "exportFormat",
  "pngQuality",
  "exportAutoFit",
  "exportMargin",
  "streetFont",

  "exportShowHeader",
  "exportShowFooter",

  "showLegend",
  "legendTitle",
  "legendShowCounts",
  "legendShowTotal",
  "exportShowLegend"
];

/* ============================================
   UTILIDADES
============================================ */

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]
  );
}

function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function numberOr(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function status(message) {
  $("status").textContent = message;
}

function hasImage(type) {
  return Object.prototype.hasOwnProperty.call(
    ASSETS,
    type
  );
}

function isRoad(type) {
  return type === "via" || type === "calle";
}

function getItemSize(item) {
  return clamp(
    numberOr(item.size, 120),
    30,
    360
  );
}

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return (
    "item_" +
    Date.now() +
    "_" +
    Math.random().toString(36).slice(2)
  );
}

function readStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);

    return stored === null
      ? fallback
      : JSON.parse(stored);

  } catch (error) {
    console.warn(
      "Error al recuperar:",
      key,
      error
    );

    return fallback;
  }
}

/* ============================================
   ESTADO GENERAL
============================================ */

let points = [];
let items = [];

let mode = "idle";
let selectedId = null;
let pendingType = null;

let lastSearch = 0;
let isExporting = false;

const imageCache = new Map();

/* ============================================
   LEYENDA EDITABLE GUARDADA
============================================ */

let legendSettings = readStorage(
  LEGEND_KEY,
  {}
);

if (
  !legendSettings ||
  typeof legendSettings !== "object"
) {
  legendSettings = {};
}

if (
  !legendSettings.rows ||
  typeof legendSettings.rows !== "object"
) {
  legendSettings.rows = {};
}

function saveLegendSettings() {
  try {
    localStorage.setItem(
      LEGEND_KEY,
      JSON.stringify(legendSettings)
    );

  } catch (error) {
    console.warn(
      "No se pudo guardar la leyenda.",
      error
    );
  }
}

/* ============================================
   MAPA PRINCIPAL
============================================ */

const TILE_URL =
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const TILE_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">' +
  "OpenStreetMap</a> contributors";

const map = L.map("map", {
  center: [-12.0965, -77.0290],
  zoom: 15,
  minZoom: 3,
  maxZoom: 19,
  zoomSnap: 0.25,
  zoomControl: true,
  doubleClickZoom: false
});

L.tileLayer(TILE_URL, {
  maxZoom: 19,
  crossOrigin: "anonymous",
  attribution: TILE_ATTRIBUTION
}).addTo(map);

/* ============================================
   CAPAS
============================================ */

const routeLine = L.polyline([], {
  color: "#e2192b",
  weight: 7,
  opacity: 0.98,
  lineCap: "round",
  lineJoin: "round"
}).addTo(map);

const arrowsLayer =
  L.layerGroup().addTo(map);

const verticesLayer =
  L.layerGroup().addTo(map);

const endpointsLayer =
  L.layerGroup().addTo(map);

const itemsLayer =
  L.layerGroup().addTo(map);

/* ============================================
   GUARDAR RUTA, ELEMENTOS Y CONFIGURACIÓN
============================================ */

function save() {
  try {
    localStorage.setItem(
      ROUTE_KEY,
      JSON.stringify(
        points.map(point => [
          point.lat,
          point.lng
        ])
      )
    );

    localStorage.setItem(
      ITEMS_KEY,
      JSON.stringify(items)
    );

    const config = {};

    for (const id of CONFIG_IDS) {
      const element = $(id);

      if (!element) continue;

      config[id] =
        element.type === "checkbox"
          ? element.checked
          : element.value;
    }

    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify(config)
    );

  } catch (error) {
    console.warn(
      "Error de guardado:",
      error
    );
  }
}

/* ============================================
   ESTADÍSTICAS DEL RECORRIDO
============================================ */

function getDistance() {
  let total = 0;

  for (let i = 1; i < points.length; i++) {
    total += map.distance(
      points[i - 1],
      points[i]
    );
  }

  return total;
}

function formatDistance(meters) {
  return meters < 1000
    ? Math.round(meters) + " m"
    : (meters / 1000).toFixed(2) + " km";
}

function updateStats() {
  $("pointsCount").textContent =
    points.length;

  $("distance").textContent =
    formatDistance(getDistance());
}

/* ============================================
   MODOS DE EDICIÓN
============================================ */

function setMode(nextMode) {
  mode = nextMode;

  const container = map.getContainer();

  container.classList.toggle(
    "mode-draw",
    mode === "draw"
  );

  container.classList.toggle(
    "mode-place",
    mode === "place"
  );

  $("btnDraw").disabled =
    mode === "draw";

  $("btnFinish").disabled =
    mode === "idle";

  $("btnEdit").disabled =
    mode === "edit" || points.length === 0;

  $("btnUndo").disabled =
    points.length === 0;

  $("btnPNG").disabled =
    isExporting ||
    (
      points.length < 2 &&
      items.length === 0 &&
      getLegendEntries().length === 0
    );
}

/* ============================================
   ICONOS DE RUTA
============================================ */

function createIcon(html, size = 24) {
  return L.divIcon({
    className: "",
    html,
    iconSize: [size, size],
    iconAnchor: [
      size / 2,
      size / 2
    ]
  });
}

/* ============================================
   INICIO Y DESTINO
============================================ */

function drawEndpoints() {
  endpointsLayer.clearLayers();

  if (!points.length || mode === "edit") {
    return;
  }

  const startText =
    $("startText").value.trim() || "INICIO";

  const endText =
    $("endText").value.trim() || "DESTINO";

  L.marker(points[0], {
    interactive: false,
    icon: createIcon(
      '<div class="endpoint start"></div>'
    )
  })
    .addTo(endpointsLayer)
    .bindTooltip(
      escapeHTML(startText),
      {
        permanent: true,
        direction: "right",
        offset: [12, 0]
      }
    );

  if (points.length > 1) {
    L.marker(
      points[points.length - 1],
      {
        interactive: false,
        icon: createIcon(
          '<div class="endpoint end"></div>'
        )
      }
    )
      .addTo(endpointsLayer)
      .bindTooltip(
        escapeHTML(endText),
        {
          permanent: true,
          direction: "left",
          offset: [-12, 0]
        }
      );
  }
}

/* ============================================
   FLECHAS DE LA RUTA
============================================ */

function drawArrows() {
  arrowsLayer.clearLayers();

  for (let i = 1; i < points.length; i++) {
    const a = map.latLngToLayerPoint(
      points[i - 1]
    );

    const b = map.latLngToLayerPoint(
      points[i]
    );

    const dx = b.x - a.x;
    const dy = b.y - a.y;

    const length = Math.hypot(dx, dy);

    if (length < 35) continue;

    const angle =
      Math.atan2(dy, dx) * 180 / Math.PI;

    const count = Math.min(
      20,
      Math.max(
        1,
        Math.floor(length / 110)
      )
    );

    for (let j = 1; j <= count; j++) {
      const t = j / (count + 1);

      const position = L.point(
        a.x + dx * t,
        a.y + dy * t
      );

      L.marker(
        map.layerPointToLatLng(position),
        {
          interactive: false,

          icon: createIcon(
            '<div class="arrow" style="' +
            "transform:rotate(" +
            angle +
            'deg)">➜</div>'
          )
        }
      ).addTo(arrowsLayer);
    }
  }
}

/* ============================================
   PUNTOS EDITABLES
============================================ */

function drawVertices() {
  verticesLayer.clearLayers();

  if (mode !== "edit") return;

  points.forEach((point, index) => {
    const marker = L.marker(point, {
      draggable: true,
      autoPan: true,

      icon: createIcon(
        '<div class="vertex"></div>',
        16
      )
    }).addTo(verticesLayer);

    marker.on("drag", () => {
      points[index] = marker.getLatLng();

      routeLine.setLatLngs(points);

      drawArrows();
      updateStats();
    });

    marker.on("dragend", () => {
      points[index] = marker.getLatLng();

      renderRoute();

      status(
        "Punto " +
        (index + 1) +
        " actualizado."
      );
    });
  });
}

/* ============================================
   DIBUJAR RECORRIDO
============================================ */

function renderRoute() {
  routeLine.setLatLngs(points);

  drawEndpoints();
  drawVertices();
  drawArrows();

  updateStats();
  updateLegend();

  setMode(mode);
  save();
}

/* ============================================
   VISTA PREVIA DE IMÁGENES
============================================ */

function updateSizeDisplay() {
  $("sizeValue").textContent =
    $("itemSize").value;
}

function updatePreview() {
  const type = $("itemType").value;

  const image = $("previewImage");
  const filename = $("previewFileName");

  if (hasImage(type)) {
    image.style.display = "block";
    image.src = ASSETS[type];

    filename.textContent =
      ASSETS[type].replace("./", "");

  } else {
    image.style.display = "none";

    filename.textContent =
      type === "via"
        ? "Rótulo azul para avenida"
        : type === "calle"
          ? "Rótulo amarillo para calle"
          : "Anotación de texto";
  }
}

$("previewImage").onerror = () => {
  $("previewImage").style.display = "none";

  $("previewFileName").textContent =
    "Imagen no encontrada";
};

$("itemSize").addEventListener(
  "input",
  updateSizeDisplay
);

$("itemType").addEventListener(
  "change",
  () => {
    if (selectedId === null) {
      const type = $("itemType").value;

      $("itemTitle").value =
        DEFAULT_NAMES[type] || "ELEMENTO";

      $("itemSize").value =
        hasImage(type) ? 120 : 90;

      // Las imágenes aparecen sin texto.
      // Los rótulos sí muestran su nombre.

      $("itemShowTitle").checked =
        !hasImage(type);
    }

    updatePreview();
    updateSizeDisplay();
  }
);

/* ============================================
   TAMAÑO DE LOS RÓTULOS
============================================ */

function getItemFont(item) {
  const size = getItemSize(item);

  if (isRoad(item.type)) {
    const multiplier =
      numberOr(
        $("streetFont").value,
        19
      ) / 19;

    return clamp(
      Math.round(
        size / 5 * multiplier
      ),
      13,
      48
    );
  }

  return clamp(
    Math.round(size / 5),
    13,
    35
  );
}

/* ============================================
   HTML DE CADA ELEMENTO
============================================ */

function itemHTML(item) {
  const title = escapeHTML(
    item.title || "ELEMENTO"
  );

  const time = item.time
    ? "<small>HORA: " +
      escapeHTML(item.time) +
      "</small>"
    : "";

  const showTitle =
    item.showTitle !== false;

  const captionContent =
    (showTitle ? title : "") + time;

  const size = getItemSize(item);

  if (hasImage(item.type)) {
    const caption = captionContent
      ? '<div class="map-caption">' +
        captionContent +
        "</div>"
      : "";

    return (
      '<div class="map-tag">' +
      '<img class="map-image" src="' +
      ASSETS[item.type] +
      '" style="width:' +
      size +
      'px" alt="">' +
      caption +
      "</div>"
    );
  }

  const font = getItemFont(item);

  const cssClass =
    item.type === "via"
      ? "via"
      : item.type === "calle"
        ? "street"
        : "";

  const caption = captionContent
    ? '<div class="map-caption ' +
      cssClass +
      '" style="font-size:' +
      font +
      'px">' +
      captionContent +
      "</div>"
    : "";

  return (
    '<div class="map-tag">' +
    '<div class="map-dot"></div>' +
    caption +
    "</div>"
  );
}

/* ============================================
   SELECCIONAR ELEMENTO
============================================ */

function selectItem(id) {
  const item = items.find(
    element => element.id === id
  );

  if (!item) return;

  selectedId = id;

  $("itemType").value = item.type;
  $("itemTitle").value = item.title;

  $("itemTime").value =
    item.time || "";

  $("itemSize").value =
    getItemSize(item);

  $("itemShowTitle").checked =
    item.showTitle !== false;

  updatePreview();
  updateSizeDisplay();

  $("btnUpdate").disabled = false;
  $("btnRemoveItem").disabled = false;
  $("btnCancelItem").disabled = false;

  setMode("idle");

  status(
    "Editando: " +
    item.title +
    ". Puedes cambiar su tamaño, hora o texto."
  );
}

function deselectItem() {
  selectedId = null;

  $("btnUpdate").disabled = true;
  $("btnRemoveItem").disabled = true;
  $("btnCancelItem").disabled = true;
}

/* ============================================
   RENDERIZAR ELEMENTOS
============================================ */

function renderItems() {
  itemsLayer.clearLayers();

  const list = $("itemList");
  list.replaceChildren();

  for (const item of items) {
    const marker = L.marker(
      [item.lat, item.lng],
      {
        draggable: true,
        autoPan: true,
        bubblingMouseEvents: false,

        icon: L.divIcon({
          className: "operation-marker",
          html: itemHTML(item),
          iconSize: [1, 1],
          iconAnchor: [0, 0]
        })
      }
    ).addTo(itemsLayer);

    marker.on("dragend", () => {
      const position = marker.getLatLng();

      item.lat = position.lat;
      item.lng = position.lng;

      save();

      status(
        "Posición actualizada: " +
        item.title
      );
    });

    marker.on("click", () => {
      selectItem(item.id);
    });

    const row =
      document.createElement("div");

    row.className = "annotation-item";

    if (hasImage(item.type)) {
      const thumbnail =
        document.createElement("img");

      thumbnail.src = ASSETS[item.type];
      thumbnail.alt = "";

      row.appendChild(thumbnail);
    }

    const label =
      document.createElement("span");

    label.textContent =
      item.title +
      (item.time ? " · " + item.time : "");

    const edit =
      document.createElement("button");

    edit.type = "button";
    edit.textContent = "Editar";
    edit.className = "blue";

    edit.onclick = () => {
      selectItem(item.id);

      map.panTo(
        [item.lat, item.lng],
        { animate: true }
      );
    };

    const remove =
      document.createElement("button");

    remove.type = "button";
    remove.textContent = "×";
    remove.className = "red";

    remove.onclick = () => {
      deleteItem(item.id);
    };

    row.append(
      label,
      edit,
      remove
    );

    list.appendChild(row);
  }

  updateLegend();
  setMode(mode);
  save();
}

/* ============================================
   ELIMINAR ELEMENTO
============================================ */

function deleteItem(id) {
  const item = items.find(
    element => element.id === id
  );

  if (!item) return;

  if (!confirm(
    '¿Eliminar "' + item.title + '"?'
  )) {
    return;
  }

  items = items.filter(
    element => element.id !== id
  );

  deselectItem();
  renderItems();

  status("Elemento eliminado.");
}

/* ============================================
   CONTEOS AUTOMÁTICOS
============================================ */

function getAutomaticCounts() {
  const counts = {};

  for (const item of items) {
    counts[item.type] =
      (counts[item.type] || 0) + 1;
  }

  return counts;
}

/* ============================================
   FILAS DE LEYENDA EDITABLE
============================================ */

function getLegendEntries() {
  const counts = getAutomaticCounts();

  return Object.entries(LEGEND_LABELS)
    .map(([type, defaultLabel]) => {
      const edit =
        legendSettings.rows[type] || {};

      const automaticCount =
        counts[type] || 0;

      const rawCount =
        edit.count === undefined ||
        edit.count === null
          ? ""
          : String(edit.count);

      const manual =
        rawCount.trim() !== "" &&
        Number.isFinite(Number(rawCount)) &&
        Number(rawCount) >= 0;

      const count = manual
        ? Math.floor(Number(rawCount))
        : automaticCount;

      const rawLabel =
        typeof edit.label === "string"
          ? edit.label.trim()
          : "";

      const label =
        rawLabel || defaultLabel;

      const customized =
        rawLabel !== "" &&
        rawLabel !== defaultLabel;

      return {
        type,
        label,
        count,
        automaticCount,
        manual,
        customized
      };
    })
    .filter(entry =>
      entry.automaticCount > 0 ||
      entry.manual ||
      entry.customized
    );
}

/* ============================================
   TOTAL DE LEYENDA
============================================ */

function getLegendTotalCount() {
  const input = $("legendTotalNumber");

  if (
    input &&
    input.value.trim() !== "" &&
    Number.isFinite(Number(input.value)) &&
    Number(input.value) >= 0
  ) {
    return Math.floor(
      Number(input.value)
    );
  }

  return getLegendEntries().reduce(
    (sum, entry) => sum + entry.count,
    0
  );
}

function getLegendTotalText() {
  return (
    $("legendTotalText").value.trim() ||
    "TOTAL DE ELEMENTOS"
  );
}

function legendIsVisible() {
  return (
    $("showLegend").checked &&
    (
      points.length >= 2 ||
      getLegendEntries().length > 0
    )
  );
}

/* ============================================
   LEYENDA EN EL MAPA
============================================ */

function updateLegend() {
  const container = $("mapLegend");

  if (!container) return;

  if (!legendIsVisible()) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }

  const entries = getLegendEntries();

  const showCounts =
    $("legendShowCounts").checked;

  const showTotal =
    $("legendShowTotal").checked;

  const title =
    $("legendTitle").value.trim() ||
    "LEYENDA OPERATIVA";

  let html =
    '<div class="legend-title">' +
    escapeHTML(title) +
    "</div>";

  if (points.length >= 2) {
    html += `
      <div class="legend-row">
        <div class="legend-icon">
          <div class="legend-line"></div>
        </div>
        <span class="legend-label">
          Ruta de desplazamiento
        </span>
      </div>
    `;
  }

  for (const entry of entries) {
    let icon;

    if (hasImage(entry.type)) {
      icon =
        '<img src="' +
        ASSETS[entry.type] +
        '" alt="">';
    } else {
      const symbol =
        entry.type === "via"
          ? "🛣️"
          : entry.type === "calle"
            ? "📍"
            : entry.type === "hora"
              ? "🕒"
              : "●";

      icon =
        '<span class="legend-symbol">' +
        symbol +
        "</span>";
    }

    html += `
      <div class="legend-row">

        <div class="legend-icon">
          ${icon}
        </div>

        <span class="legend-label">
          ${escapeHTML(entry.label)}
        </span>

        ${
          showCounts
            ? '<span class="legend-count">' +
              entry.count +
              "</span>"
            : ""
        }

      </div>
    `;
  }

  if (showTotal) {
    html += `
      <div class="legend-total">

        <span>
          ${escapeHTML(getLegendTotalText())}
        </span>

        <span>
          ${getLegendTotalCount()}
        </span>

      </div>
    `;
  }

  container.innerHTML = html;
  container.hidden = false;

  const counts = getAutomaticCounts();

  document
    .querySelectorAll(
      "#legendEditor [data-legend-count]"
    )
    .forEach(input => {
      const type =
        input.dataset.legendCount;

      input.placeholder =
        "Auto: " + (counts[type] || 0);
    });
}

/* ============================================
   INICIAR EDITOR DE LEYENDA
   UTILIZA LAS FILAS DEL HTML
============================================ */

function initializeLegendEditor() {
  const rows = document.querySelectorAll(
    "#legendEditor [data-legend-type]"
  );

  for (const row of rows) {
    const type = row.dataset.legendType;

    if (!Object.prototype.hasOwnProperty.call(
      LEGEND_LABELS,
      type
    )) {
      continue;
    }

    const labelInput = row.querySelector(
      "[data-legend-label]"
    );

    const countInput = row.querySelector(
      "[data-legend-count]"
    );

    if (!labelInput || !countInput) {
      continue;
    }

    if (!legendSettings.rows[type]) {
      legendSettings.rows[type] = {};
    }

    const edit = legendSettings.rows[type];

    labelInput.value =
      typeof edit.label === "string"
        ? edit.label
        : LEGEND_LABELS[type];

    countInput.value =
      edit.count === undefined ||
      edit.count === null
        ? ""
        : String(edit.count);

    // Descripción editable.

    labelInput.addEventListener(
      "input",
      () => {
        edit.label = labelInput.value;

        saveLegendSettings();
        updateLegend();
        setMode(mode);
      }
    );

    // Cantidad editable.

    countInput.addEventListener(
      "input",
      () => {
        edit.count = countInput.value;

        saveLegendSettings();
        updateLegend();
        setMode(mode);
      }
    );

    countInput.addEventListener(
      "blur",
      () => {
        if (countInput.value !== "") {
          const value =
            Number(countInput.value);

          countInput.value =
            Number.isFinite(value) &&
            value >= 0
              ? String(Math.floor(value))
              : "";
        }

        edit.count = countInput.value;

        saveLegendSettings();
        updateLegend();
      }
    );
  }

  // Texto del total.

  $("legendTotalText").value =
    typeof legendSettings.totalText === "string"
      ? legendSettings.totalText
      : "TOTAL DE ELEMENTOS";

  // Cantidad total.

  $("legendTotalNumber").value =
    legendSettings.totalNumber === undefined ||
    legendSettings.totalNumber === null
      ? ""
      : String(legendSettings.totalNumber);

  $("legendTotalText").addEventListener(
    "input",
    () => {
      legendSettings.totalText =
        $("legendTotalText").value;

      saveLegendSettings();
      updateLegend();
    }
  );

  $("legendTotalNumber").addEventListener(
    "input",
    () => {
      legendSettings.totalNumber =
        $("legendTotalNumber").value;

      saveLegendSettings();
      updateLegend();
    }
  );

  $("legendTotalNumber").addEventListener(
    "blur",
    () => {
      const input = $("legendTotalNumber");

      if (input.value !== "") {
        const number = Number(input.value);

        input.value =
          Number.isFinite(number) &&
          number >= 0
            ? String(Math.floor(number))
            : "";
      }

      legendSettings.totalNumber =
        input.value;

      saveLegendSettings();
      updateLegend();
    }
  );

  updateLegend();
}

/* ============================================
   BOTONES DE RUTA
============================================ */

$("btnDraw").onclick = () => {
  deselectItem();

  setMode("draw");
  renderRoute();

  status(
    points.length
      ? "Continúa dibujando la ruta."
      : "Haz clic para marcar el inicio."
  );
};

$("btnFinish").onclick = () => {
  setMode("idle");
  renderRoute();

  status("Recorrido finalizado y guardado.");
};

$("btnEdit").onclick = () => {
  deselectItem();

  setMode("edit");
  renderRoute();

  status(
    "Arrastra los puntos para editar la ruta."
  );
};

$("btnUndo").onclick = () => {
  if (!points.length) return;

  points.pop();
  renderRoute();

  status("Último punto eliminado.");
};

$("btnClear").onclick = () => {
  if (!points.length) return;

  if (!confirm(
    "¿Borrar toda la ruta? " +
    "Las imágenes y la leyenda se conservarán."
  )) {
    return;
  }

  points = [];

  setMode("idle");
  renderRoute();

  status("Ruta eliminada.");
};

/* ============================================
   CENTRAR EL MAPA EN PANTALLA
============================================ */

function allCoordinates() {
  return [
    ...points,
    ...items.map(item =>
      L.latLng(item.lat, item.lng)
    )
  ];
}

function fitVisibleMap() {
  const coordinates = allCoordinates();

  if (!coordinates.length) {
    status("No hay elementos para centrar.");
    return;
  }

  if (coordinates.length === 1) {
    map.setView(coordinates[0], 17);
    return;
  }

  const rightPadding =
    window.innerWidth > 750
      ? Math.min(
          440,
          window.innerWidth * 0.35
        )
      : 60;

  map.fitBounds(
    L.latLngBounds(coordinates),
    {
      paddingTopLeft: [60, 60],
      paddingBottomRight: [
        rightPadding,
        60
      ],
      maxZoom: 17,
      animate: true
    }
  );

  status("Mapa centrado.");
}

$("btnFit").onclick = fitVisibleMap;

/* ============================================
   COLOCAR ELEMENTOS
============================================ */

$("btnPlace").onclick = () => {
  deselectItem();

  pendingType = $("itemType").value;

  setMode("place");

  status(
    "Haz clic en el mapa para colocar: " +
    (
      $("itemTitle").value.trim() ||
      DEFAULT_NAMES[pendingType]
    )
  );
};

$("btnUpdate").onclick = () => {
  const item = items.find(
    element => element.id === selectedId
  );

  if (!item) return;

  item.type = $("itemType").value;

  item.title =
    $("itemTitle").value.trim() ||
    DEFAULT_NAMES[item.type] ||
    "ELEMENTO";

  item.time =
    $("itemTime").value;

  item.size = clamp(
    numberOr($("itemSize").value, 120),
    30,
    360
  );

  item.showTitle =
    $("itemShowTitle").checked;

  deselectItem();
  renderItems();

  status(
    "Elemento actualizado: " +
    item.title
  );
};

$("btnRemoveItem").onclick = () => {
  if (selectedId) {
    deleteItem(selectedId);
  }
};

$("btnCancelItem").onclick = () => {
  deselectItem();

  status("Edición cancelada.");
};

/* ============================================
   CLIC EN EL MAPA
============================================ */

map.on("click", event => {
  if (mode === "draw") {
    points.push(event.latlng);

    renderRoute();

    status(
      "Punto " +
      points.length +
      " agregado."
    );

    return;
  }

  if (mode === "place") {
    const type = pendingType;

    const item = {
      id: createId(),
      type,

      title:
        $("itemTitle").value.trim() ||
        DEFAULT_NAMES[type] ||
        "ELEMENTO",

      time: $("itemTime").value,

      size: clamp(
        numberOr($("itemSize").value, 120),
        30,
        360
      ),

      showTitle:
        $("itemShowTitle").checked,

      lat: event.latlng.lat,
      lng: event.latlng.lng
    };

    items.push(item);

    setMode("idle");
    renderItems();

    status(
      "Elemento colocado: " +
      item.title
    );
  }
});

map.on("zoomend", drawArrows);
map.on("moveend", drawArrows);

/* ============================================
   BUSCAR CALLES Y LUGARES
============================================ */

async function searchPlace() {
  const query =
    $("searchInput").value.trim();

  if (!query) return;

  if (Date.now() - lastSearch < 1100) {
    return;
  }

  lastSearch = Date.now();

  $("btnSearch").disabled = true;

  status("Buscando ubicación...");

  try {
    const url =
      "https://nominatim.openstreetmap.org/search" +
      "?format=jsonv2" +
      "&limit=1" +
      "&countrycodes=pe" +
      "&q=" +
      encodeURIComponent(
        query + ", Lima, Perú"
      );

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        "Servicio de búsqueda no disponible."
      );
    }

    const data = await response.json();

    if (!data.length) {
      status("Ubicación no encontrada.");
      return;
    }

    map.flyTo(
      [
        Number(data[0].lat),
        Number(data[0].lon)
      ],
      17
    );

    status("Ubicación encontrada.");

  } catch (error) {
    console.error(error);

    status(
      "No se pudo buscar la ubicación."
    );

  } finally {
    $("btnSearch").disabled = false;
  }
}

$("btnSearch").onclick = searchPlace;

$("searchInput").onkeydown = event => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchPlace();
  }
};

/* ============================================
   CAMBIOS DE CONFIGURACIÓN
============================================ */

for (const id of CONFIG_IDS) {
  const element = $(id);

  if (!element) continue;

  element.addEventListener(
    "input",
    () => {
      if (
        id === "startText" ||
        id === "endText"
      ) {
        drawEndpoints();
      }

      if (id === "streetFont") {
        renderItems();
      }

      if (id === "exportMargin") {
        $("exportMarginValue").textContent =
          element.value;
      }

      if (
        id === "showLegend" ||
        id === "legendTitle" ||
        id === "legendShowCounts" ||
        id === "legendShowTotal"
      ) {
        updateLegend();
      }

      save();
    }
  );
}

/* ============================================
   CARGAR IMÁGENES PARA PNG
============================================ */

function loadImage(type) {
  if (!hasImage(type)) {
    return Promise.resolve(null);
  }

  if (imageCache.has(type)) {
    return imageCache.get(type);
  }

  const promise = new Promise(resolve => {
    const image = new Image();

    image.onload = () => resolve(image);

    image.onerror = () => {
      console.warn(
        "Imagen no encontrada:",
        ASSETS[type]
      );

      resolve(null);
    };

    image.src = ASSETS[type];
  });

  imageCache.set(type, promise);

  return promise;
}

async function loadUsedImages() {
  const types = [
    ...new Set(
      [
        ...items.map(item => item.type),
        ...getLegendEntries().map(
          entry => entry.type
        )
      ].filter(hasImage)
    )
  ];

  const entries = await Promise.all(
    types.map(async type => [
      type,
      await loadImage(type)
    ])
  );

  const loaded = new Map(entries);

  const missing = types.filter(
    type => !loaded.get(type)
  );

  if (missing.length) {
    throw new Error(
      "Faltan estas imágenes PNG: " +
      missing.map(
        type => ASSETS[type].replace("./", "")
      ).join(", ")
    );
  }

  return loaded;
}

/* ============================================
   FUNCIONES CANVAS
============================================ */

function roundRect(
  context,
  x,
  y,
  width,
  height,
  radius
) {
  radius = Math.min(
    radius,
    width / 2,
    height / 2
  );

  context.beginPath();
  context.moveTo(x + radius, y);

  context.arcTo(
    x + width,
    y,
    x + width,
    y + height,
    radius
  );

  context.arcTo(
    x + width,
    y + height,
    x,
    y + height,
    radius
  );

  context.arcTo(
    x,
    y + height,
    x,
    y,
    radius
  );

  context.arcTo(
    x,
    y,
    x + width,
    y,
    radius
  );

  context.closePath();
}

function drawCircle(
  context,
  x,
  y,
  radius,
  color
) {
  context.beginPath();

  context.arc(
    x,
    y,
    radius,
    0,
    Math.PI * 2
  );

  context.fillStyle = color;
  context.fill();
}

function exportScale(width) {
  return width / 1920;
}

/* ============================================
   DIVIDIR TEXTOS EN LÍNEAS
============================================ */

function wrapText(
  context,
  text,
  maxWidth
) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate =
      current
        ? current + " " + word
        : word;

    if (
      current &&
      context.measureText(candidate).width >
        maxWidth
    ) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

/* ============================================
   DISTRIBUCIÓN DE TEXTOS PNG
============================================ */

function layoutText(
  context,
  point,
  text,
  time,
  options = {}
) {
  const scale =
    options.scale || 1;

  const fontSize =
    options.fontSize || 17 * scale;

  const padding = 10 * scale;
  const lineHeight = fontSize * 1.25;
  const timeFont = 14 * scale;

  const title =
    String(text || "").trim();

  const timeText =
    time ? "HORA: " + time : "";

  if (!title && !timeText) {
    return null;
  }

  context.save();

  context.font =
    `bold ${fontSize}px Arial`;

  const lines = title
    ? wrapText(
        context,
        title,
        360 * scale
      )
    : [];

  let widest = 0;

  for (const line of lines) {
    widest = Math.max(
      widest,
      context.measureText(line).width
    );
  }

  if (timeText) {
    context.font =
      `bold ${timeFont}px Arial`;

    widest = Math.max(
      widest,
      context.measureText(timeText).width
    );
  }

  context.restore();

  const width = Math.max(
    65 * scale,
    widest + 2 * padding
  );

  const height =
    2 * padding +
    lines.length * lineHeight +
    (timeText ? 22 * scale : 0);

  const align =
    options.align || "center";

  const position =
    options.position || "below";

  let x = point.x;
  let y = point.y;

  if (align === "center") {
    x -= width / 2;
  }

  if (align === "right") {
    x += 20 * scale;
  }

  if (align === "left") {
    x -= width + 20 * scale;
  }

  if (position === "below") {
    y += 13 * scale;
  }

  if (position === "above") {
    y -= height + 20 * scale;
  }

  if (position === "center") {
    y -= height / 2;
  }

  return {
    x,
    y,
    width,
    height,
    lines,
    timeText,
    fontSize,
    timeFont,
    padding,
    lineHeight,
    scale,

    fill: options.fill || "#ffffff",
    border: options.border || "#650078",
    color: options.color || "#172033"
  };
}

/* ============================================
   DIBUJAR RÓTULO PNG
============================================ */

function paintText(context, box) {
  if (!box) return;

  context.save();

  context.shadowColor = "#0004";
  context.shadowBlur = 7 * box.scale;
  context.shadowOffsetY = 2 * box.scale;

  roundRect(
    context,
    box.x,
    box.y,
    box.width,
    box.height,
    8 * box.scale
  );

  context.fillStyle = box.fill;
  context.fill();

  context.shadowColor = "transparent";
  context.strokeStyle = box.border;
  context.lineWidth = 2.5 * box.scale;
  context.stroke();

  context.textBaseline = "top";
  context.textAlign = "left";

  context.font =
    `bold ${box.fontSize}px Arial`;

  context.fillStyle = box.color;

  box.lines.forEach((line, index) => {
    context.fillText(
      line,
      box.x + box.padding,
      box.y +
        box.padding +
        index * box.lineHeight
    );
  });

  if (box.timeText) {
    context.font =
      `bold ${box.timeFont}px Arial`;

    context.fillStyle =
      box.fill === "#1d4ed8"
        ? "#ffffff"
        : "#9a3412";

    context.fillText(
      box.timeText,
      box.x + box.padding,
      box.y +
        box.padding +
        box.lines.length *
          box.lineHeight +
        3 * box.scale
    );
  }

  context.restore();
}

/* ============================================
   ELEMENTOS PARA EXPORTACIÓN
============================================ */

function getItemDrawing(
  context,
  exportMap,
  item,
  images,
  scale
) {
  const point =
    exportMap.latLngToContainerPoint(
      [item.lat, item.lng]
    );

  const size =
    getItemSize(item) * scale;

  const title =
    item.showTitle === false
      ? ""
      : item.title;

  const time = item.time || "";

  if (hasImage(item.type)) {
    const image = images.get(item.type);

    const ratio = image
      ? image.naturalHeight /
        image.naturalWidth
      : 1;

    const imageHeight = size * ratio;

    const imageBox = {
      x: point.x - size / 2,
      y: point.y - imageHeight - 7 * scale,
      width: size,
      height: imageHeight
    };

    const label = layoutText(
      context,
      point,
      title,
      time,
      {
        scale,
        fontSize: 16 * scale,
        align: "center",
        position: "below"
      }
    );

    return {
      point,
      image,
      imageBox,
      label,
      type: item.type
    };
  }

  const isVia =
    item.type === "via";

  const isCalle =
    item.type === "calle";

  const label = layoutText(
    context,
    point,
    title,
    time,
    {
      scale,

      fontSize:
        getItemFont(item) * scale,

      align: "center",

      position: isRoad(item.type)
        ? "center"
        : "below",

      fill: isVia
        ? "#1d4ed8"
        : isCalle
          ? "#fff0a0"
          : "#ffffff",

      border: isVia
        ? "#ffffff"
        : isCalle
          ? "#dda800"
          : "#650078",

      color: isVia
        ? "#ffffff"
        : "#172033"
    }
  );

  return {
    point,
    image: null,
    imageBox: null,
    label,
    type: item.type
  };
}

/* ============================================
   LEYENDA PNG: MEDIDAS
============================================ */

function getLegendLayout(
  context,
  width,
  height,
  scale
) {
  const entries = getLegendEntries();

  const hasRoute =
    points.length >= 2;

  const showCounts =
    $("legendShowCounts").checked;

  const showTotal =
    $("legendShowTotal").checked;

  const title =
    $("legendTitle").value.trim() ||
    "LEYENDA OPERATIVA";

  const boxWidth = Math.min(
    380 * scale,
    width * 0.35
  );

  context.save();

  context.font =
    `bold ${16 * scale}px Arial`;

  const titleLines = wrapText(
    context,
    title.toUpperCase(),
    boxWidth - 32 * scale
  );

  const headerHeight = Math.max(
    52 * scale,
    (
      18 +
      titleLines.length * 20 +
      12
    ) * scale
  );

  const labelWidth =
    boxWidth -
    (showCounts ? 110 : 75) * scale;

  const rows = [];

  context.font =
    `${13 * scale}px Arial`;

  if (hasRoute) {
    rows.push({
      type: "route",
      label: "Ruta de desplazamiento",

      lines: wrapText(
        context,
        "Ruta de desplazamiento",
        labelWidth
      ),

      height: 34 * scale,
      count: null
    });
  }

  for (const entry of entries) {
    const lines = wrapText(
      context,
      entry.label,
      labelWidth
    );

    rows.push({
      ...entry,
      lines,

      height: Math.max(
        34 * scale,
        (
          lines.length * 16 +
          10
        ) * scale
      )
    });
  }

  context.font =
    `bold ${13 * scale}px Arial`;

  const totalLines = showTotal
    ? wrapText(
        context,
        getLegendTotalText(),
        boxWidth - 100 * scale
      )
    : [];

  const footerHeight = showTotal
    ? Math.max(
        48 * scale,
        (
          totalLines.length * 17 +
          20
        ) * scale
      )
    : 12 * scale;

  const boxHeight =
    headerHeight +
    rows.reduce(
      (sum, row) => sum + row.height,
      0
    ) +
    footerHeight;

  context.restore();

  return {
    x: 20 * scale,

    y: Math.max(
      10 * scale,
      height - boxHeight - 20 * scale
    ),

    width: boxWidth,
    height: boxHeight,

    headerHeight,
    footerHeight,

    titleLines,
    totalLines,

    rows,
    showCounts,
    showTotal
  };
}

/* ============================================
   LÍMITES VISUALES DEL RECORRIDO
============================================ */

function calculateVisualBounds(
  context,
  exportMap,
  images,
  scale
) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function addBox(x, y, width, height) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);

    maxX = Math.max(
      maxX,
      x + width
    );

    maxY = Math.max(
      maxY,
      y + height
    );
  }

  function addLabel(label) {
    if (!label) return;

    addBox(
      label.x,
      label.y,
      label.width,
      label.height
    );
  }

  // Ruta completa.

  for (const point of points) {
    const p =
      exportMap.latLngToContainerPoint(point);

    addBox(
      p.x - 18 * scale,
      p.y - 18 * scale,
      36 * scale,
      36 * scale
    );
  }

  // Rótulo de inicio.

  if (points.length) {
    const p =
      exportMap.latLngToContainerPoint(
        points[0]
      );

    addLabel(
      layoutText(
        context,
        p,
        $("startText").value || "INICIO",
        "",
        {
          scale,
          align: "right",
          position: "above",
          border: "#16a34a"
        }
      )
    );
  }

  // Rótulo de destino.

  if (points.length > 1) {
    const p =
      exportMap.latLngToContainerPoint(
        points[points.length - 1]
      );

    addLabel(
      layoutText(
        context,
        p,
        $("endText").value || "DESTINO",
        "",
        {
          scale,
          align: "left",
          position: "above"
        }
      )
    );
  }

  // Imágenes y rótulos.

  for (const item of items) {
    const drawing = getItemDrawing(
      context,
      exportMap,
      item,
      images,
      scale
    );

    if (drawing.imageBox) {
      const box = drawing.imageBox;

      addBox(
        box.x,
        box.y,
        box.width,
        box.height
      );
    }

    addLabel(drawing.label);

    if (
      !drawing.imageBox &&
      !drawing.label
    ) {
      addBox(
        drawing.point.x - 10 * scale,
        drawing.point.y - 10 * scale,
        20 * scale,
        20 * scale
      );
    }
  }

  if (!Number.isFinite(minX)) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,

    width: maxX - minX,
    height: maxY - minY,

    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  };
}

/* ============================================
   CENTRADO AUTOMÁTICO CORREGIDO

   IMPORTANTE:
   - NO RESERVA UNA COLUMNA ENTERA
     PARA LA LEYENDA.
   - BUSCA EL MAYOR ZOOM POSIBLE.
   - CENTRA LA RUTA Y SUS ELEMENTOS.
   - RESPETA EL FORMATO 4:3, 16:9, ETC.
============================================ */

function autoFitExportMap(
  exportMap,
  context,
  width,
  height,
  images,
  scale,
  includeLegend
) {
  const coordinates = allCoordinates();

  if (!coordinates.length) {
    exportMap.setView(
      map.getCenter(),
      map.getZoom(),
      { animate: false }
    );

    return;
  }

  const marginPercent = clamp(
    numberOr(
      $("exportMargin").value,
      5
    ),
    5,
    30
  ) / 100;

  const marginX = Math.max(
    12 * scale,
    width * marginPercent
  );

  const marginY = Math.max(
    12 * scale,
    height * marginPercent
  );

  const availableWidth =
    width - marginX * 2;

  const availableHeight =
    height - marginY * 2;

  const geographicBounds =
    L.latLngBounds(coordinates);

  const baseCenter =
    geographicBounds.getCenter();

  /*
   * Se evalúa cada nivel de zoom en un
   * mapa virtual sin modificar el mapa
   * real durante las mediciones.
   */

  function evaluateZoom(zoom) {
    const projectedCenter =
      exportMap.project(
        baseCenter,
        zoom
      );

    const virtualMap = {
      latLngToContainerPoint(latlng) {
        const projected =
          exportMap.project(
            L.latLng(latlng),
            zoom
          );

        return L.point(
          projected.x -
            projectedCenter.x +
            width / 2,

          projected.y -
            projectedCenter.y +
            height / 2
        );
      }
    };

    const bounds =
      calculateVisualBounds(
        context,
        virtualMap,
        images,
        scale
      );

    if (!bounds) {
      return {
        fits: true,
        zoom,
        center: baseCenter
      };
    }

    const fits =
      bounds.width <= availableWidth &&
      bounds.height <= availableHeight;

    const shiftX =
      width / 2 -
      bounds.centerX;

    const shiftY =
      height / 2 -
      bounds.centerY;

    const correctedCenterPixel =
      L.point(
        projectedCenter.x - shiftX,
        projectedCenter.y - shiftY
      );

    const correctedCenter =
      exportMap.unproject(
        correctedCenterPixel,
        zoom
      );

    return {
      fits,
      zoom,
      center: correctedCenter,
      width: bounds.width,
      height: bounds.height
    };
  }

  /*
   * Búsqueda binaria del zoom máximo
   * que mantiene todo el contenido
   * visible en el PNG.
   */

  let minimumZoom = 3;
  let maximumZoom = 18.5;

  let best =
    evaluateZoom(minimumZoom);

  for (
    let attempt = 0;
    attempt < 24;
    attempt++
  ) {
    const zoom =
      (minimumZoom + maximumZoom) / 2;

    const candidate =
      evaluateZoom(zoom);

    if (candidate.fits) {
      best = candidate;
      minimumZoom = zoom;
    } else {
      maximumZoom = zoom;
    }
  }

  /*
   * Pequeño margen de seguridad
   * para que los elementos no
   * queden cortados por redondeo.
   */

  const finalZoom = Math.max(
    3,
    best.zoom - 0.025
  );

  const result =
    evaluateZoom(finalZoom);

  exportMap.setView(
    result.center,
    finalZoom,
    { animate: false }
  );

  exportMap.invalidateSize({
    animate: false
  });
}

/* ============================================
   PINTAR RUTA EN PNG
============================================ */

function paintRoute(
  context,
  exportMap,
  scale
) {
  if (!points.length) return;

  const coordinates = points.map(point =>
    exportMap.latLngToContainerPoint(point)
  );

  if (coordinates.length > 1) {
    context.save();

    context.lineJoin = "round";
    context.lineCap = "round";

    context.beginPath();

    coordinates.forEach((p, index) => {
      if (index === 0) {
        context.moveTo(p.x, p.y);
      } else {
        context.lineTo(p.x, p.y);
      }
    });

    // Borde blanco.

    context.strokeStyle = "#ffffff";
    context.lineWidth = 19 * scale;
    context.stroke();

    // Ruta roja principal.

    context.strokeStyle = "#e2192b";
    context.lineWidth = 11 * scale;
    context.stroke();

    // Flechas de dirección.

    for (
      let i = 1;
      i < coordinates.length;
      i++
    ) {
      const a = coordinates[i - 1];
      const b = coordinates[i];

      const dx = b.x - a.x;
      const dy = b.y - a.y;

      const length = Math.hypot(dx, dy);

      if (length < 45 * scale) {
        continue;
      }

      const angle = Math.atan2(dy, dx);

      const count = Math.min(
        35,
        Math.max(
          1,
          Math.floor(
            length / (120 * scale)
          )
        )
      );

      for (let j = 1; j <= count; j++) {
        const t = j / (count + 1);

        context.save();

        context.translate(
          a.x + dx * t,
          a.y + dy * t
        );

        context.rotate(angle);

        context.beginPath();

        context.moveTo(13 * scale, 0);
        context.lineTo(-7 * scale, -8 * scale);
        context.lineTo(-2 * scale, 0);
        context.lineTo(-7 * scale, 8 * scale);

        context.closePath();

        context.fillStyle = "#ffffff";
        context.fill();

        context.restore();
      }
    }

    context.restore();
  }

  // INICIO

  const start = coordinates[0];

  drawCircle(
    context,
    start.x,
    start.y,
    15 * scale,
    "#ffffff"
  );

  drawCircle(
    context,
    start.x,
    start.y,
    10 * scale,
    "#16a34a"
  );

  paintText(
    context,
    layoutText(
      context,
      start,
      $("startText").value || "INICIO",
      "",
      {
        scale,
        align: "right",
        position: "above",
        border: "#16a34a"
      }
    )
  );

  // DESTINO

  if (coordinates.length > 1) {
    const end =
      coordinates[coordinates.length - 1];

    drawCircle(
      context,
      end.x,
      end.y,
      15 * scale,
      "#ffffff"
    );

    drawCircle(
      context,
      end.x,
      end.y,
      10 * scale,
      "#650078"
    );

    paintText(
      context,
      layoutText(
        context,
        end,
        $("endText").value || "DESTINO",
        "",
        {
          scale,
          align: "left",
          position: "above",
          border: "#650078"
        }
      )
    );
  }
}

/* ============================================
   PINTAR LAS 13 IMÁGENES Y RÓTULOS
============================================ */

function paintItems(
  context,
  exportMap,
  images,
  scale
) {
  const drawings = items.map(item =>
    getItemDrawing(
      context,
      exportMap,
      item,
      images,
      scale
    )
  );

  // Imágenes primero.

  for (const drawing of drawings) {
    if (
      drawing.imageBox &&
      drawing.image
    ) {
      const box = drawing.imageBox;

      context.save();

      context.shadowColor = "#0005";
      context.shadowBlur = 7 * scale;
      context.shadowOffsetY = 3 * scale;

      context.drawImage(
        drawing.image,
        box.x,
        box.y,
        box.width,
        box.height
      );

      context.restore();

    } else if (
      !drawing.imageBox &&
      !isRoad(drawing.type)
    ) {
      drawCircle(
        context,
        drawing.point.x,
        drawing.point.y,
        9 * scale,
        "#650078"
      );
    }
  }

  // Textos por encima.

  for (const drawing of drawings) {
    paintText(
      context,
      drawing.label
    );
  }
}

/* ============================================
   DIBUJAR LEYENDA EDITABLE EN PNG
============================================ */

function paintLegend(
  context,
  width,
  height,
  scale,
  images
) {
  const entries = getLegendEntries();

  const hasRoute =
    points.length >= 2;

  if (!entries.length && !hasRoute) {
    return;
  }

  const layout = getLegendLayout(
    context,
    width,
    height,
    scale
  );

  const x = layout.x;
  const y = layout.y;

  context.save();

  // Fondo blanco.

  context.shadowColor = "#0004";
  context.shadowBlur = 12 * scale;

  roundRect(
    context,
    x,
    y,
    layout.width,
    layout.height,
    10 * scale
  );

  context.fillStyle =
    "rgba(255,255,255,0.97)";

  context.fill();

  context.shadowColor = "transparent";
  context.strokeStyle = "#d0d5dd";
  context.lineWidth = 1.5 * scale;
  context.stroke();

  // Título editable.

  context.textAlign = "left";
  context.textBaseline = "middle";

  context.font =
    `bold ${16 * scale}px Arial`;

  context.fillStyle = "#650078";

  layout.titleLines.forEach(
    (title, index) => {
      context.fillText(
        title,
        x + 16 * scale,
        y + (23 + index * 20) * scale,
        layout.width - 32 * scale
      );
    }
  );

  let cursorY =
    y + layout.headerHeight;

  // Filas con nombres y números
  // personalizados.

  for (const row of layout.rows) {
    const centerY =
      cursorY + row.height / 2;

    if (row.type === "route") {
      context.fillStyle = "#e2192b";

      context.fillRect(
        x + 16 * scale,
        centerY - 3 * scale,
        29 * scale,
        6 * scale
      );

    } else if (hasImage(row.type)) {
      const image = images.get(row.type);

      if (image) {
        const maxWidth = 30 * scale;
        const maxHeight = 27 * scale;

        const factor = Math.min(
          maxWidth / image.naturalWidth,
          maxHeight / image.naturalHeight
        );

        const iw =
          image.naturalWidth * factor;

        const ih =
          image.naturalHeight * factor;

        context.drawImage(
          image,
          x + 16 * scale +
            (maxWidth - iw) / 2,
          centerY - ih / 2,
          iw,
          ih
        );
      }

    } else {
      context.fillStyle =
        row.type === "via"
          ? "#1d4ed8"
          : row.type === "calle"
            ? "#dda800"
            : "#650078";

      context.beginPath();

      context.arc(
        x + 30 * scale,
        centerY,
        6 * scale,
        0,
        Math.PI * 2
      );

      context.fill();
    }

    // Descripción.

    context.textAlign = "left";

    context.font =
      `${13 * scale}px Arial`;

    context.fillStyle = "#1f2937";

    const lineHeight =
      16 * scale;

    const firstLineY =
      centerY -
      (row.lines.length - 1) *
        lineHeight / 2;

    row.lines.forEach(
      (text, index) => {
        context.fillText(
          text,
          x + 55 * scale,
          firstLineY +
            index * lineHeight,
          layout.width -
            (
              layout.showCounts
                ? 110
                : 75
            ) * scale
        );
      }
    );

    // Cantidad editable.

    if (
      row.type !== "route" &&
      layout.showCounts
    ) {
      context.textAlign = "right";

      context.font =
        `bold ${14 * scale}px Arial`;

      context.fillStyle = "#172554";

      context.fillText(
        String(row.count),
        x + layout.width - 18 * scale,
        centerY
      );
    }

    cursorY += row.height;
  }

  // Total personalizado.

  if (layout.showTotal) {
    context.strokeStyle = "#e4e7ec";

    context.beginPath();

    context.moveTo(
      x + 16 * scale,
      cursorY + 3 * scale
    );

    context.lineTo(
      x + layout.width - 16 * scale,
      cursorY + 3 * scale
    );

    context.stroke();

    context.textAlign = "left";

    context.font =
      `bold ${13 * scale}px Arial`;

    context.fillStyle = "#650078";

    const lineHeight =
      17 * scale;

    const totalY =
      cursorY + 17 * scale;

    layout.totalLines.forEach(
      (text, index) => {
        context.fillText(
          text,
          x + 16 * scale,
          totalY + index * lineHeight,
          layout.width - 100 * scale
        );
      }
    );

    context.textAlign = "right";

    context.font =
      `bold ${16 * scale}px Arial`;

    context.fillText(
      String(getLegendTotalCount()),
      x + layout.width - 18 * scale,
      cursorY +
        layout.footerHeight / 2
    );
  }

  context.restore();
}

/* ============================================
   ENCABEZADO PNG
============================================ */

function paintHeader(
  context,
  width,
  height,
  scale
) {
  const gradient =
    context.createLinearGradient(
      0,
      0,
      width,
      0
    );

  gradient.addColorStop(0, "#172554");
  gradient.addColorStop(1, "#650078");

  context.fillStyle = gradient;

  context.fillRect(
    0,
    0,
    width,
    height
  );

  context.fillStyle = "#fbbf24";

  context.fillRect(
    0,
    height - 6 * scale,
    width,
    6 * scale
  );

  context.fillRect(
    24 * scale,
    18 * scale,
    5 * scale,
    height - 43 * scale
  );

  const top =
    $("superTitle").value.trim() ||
    "PLAN DE OPERACIONES | SAN ISIDRO";

  const title =
    $("routeTitle").value.trim() ||
    "RECORRIDO DE IDA";

  context.textAlign = "left";
  context.textBaseline = "alphabetic";

  context.fillStyle = "#e9d5ff";

  context.font =
    `bold ${17 * scale}px Arial`;

  context.fillText(
    top.toUpperCase(),
    46 * scale,
    35 * scale,
    width - 90 * scale
  );

  context.fillStyle = "#ffffff";

  context.font =
    `bold ${38 * scale}px Arial`;

  context.fillText(
    title.toUpperCase(),
    46 * scale,
    83 * scale,
    width - 90 * scale
  );

  const rawDate = $("routeDate").value;

  if (rawDate) {
    const date = new Date(
      rawDate + "T12:00:00"
    );

    const formatted =
      date.toLocaleDateString(
        "es-PE",
        {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric"
        }
      );

    context.font =
      `${16 * scale}px Arial`;

    context.fillStyle = "#f4e8ff";

    context.fillText(
      formatted.toUpperCase(),
      46 * scale,
      114 * scale,
      width - 90 * scale
    );
  }
}

/* ============================================
   PIE DE PÁGINA PNG
============================================ */

function paintFooter(
  context,
  width,
  top,
  height,
  scale
) {
  context.fillStyle = "#ffffff";

  context.fillRect(
    0,
    top,
    width,
    height
  );

  context.fillStyle = "#650078";

  context.fillRect(
    0,
    top,
    width,
    4 * scale
  );

  context.fillStyle = "#e2192b";

  context.fillRect(
    24 * scale,
    top + 24 * scale,
    35 * scale,
    6 * scale
  );

  context.textAlign = "left";

  context.font =
    `bold ${14 * scale}px Arial`;

  context.fillStyle = "#1f2937";

  context.fillText(
    "RUTA Y SENTIDO DE DESPLAZAMIENTO",
    70 * scale,
    top + 31 * scale
  );

  context.font =
    `${13 * scale}px Arial`;

  context.fillText(
    "Distancia: " +
    formatDistance(getDistance()) +
    "  |  Puntos: " +
    points.length +
    "  |  Elementos en mapa: " +
    items.length,
    24 * scale,
    top + 59 * scale
  );

  context.fillStyle = "#64748b";

  context.font =
    `${11 * scale}px Arial`;

  context.fillText(
    "Mapa: © OpenStreetMap contributors · ODbL",
    24 * scale,
    top + height - 12 * scale
  );
}

/* ============================================
   DIMENSIONES DE EXPORTACIÓN
============================================ */

function getExportDimensions() {
  const width =
    numberOr(
      $("pngQuality").value,
      2560
    );

  const format =
    $("exportFormat").value;

  let ratio = 16 / 9;

  if (format === "4:3") {
    ratio = 4 / 3;
  }

  if (format === "a4") {
    ratio = 297 / 210;
  }

  if (format === "1:1") {
    ratio = 1;
  }

  return {
    width,
    height: Math.round(width / ratio)
  };
}

/* ============================================
   ESPERAR CARGA DE CALLES
============================================ */

function waitForTiles(
  tileLayer,
  timeout = 20000
) {
  return new Promise(resolve => {
    let finished = false;
    let timer;

    function finish() {
      if (finished) return;

      finished = true;

      clearTimeout(timer);

      tileLayer.off("load", finish);

      resolve();
    }

    tileLayer.on("load", finish);

    timer = setTimeout(
      finish,
      timeout
    );

    setTimeout(() => {
      if (!tileLayer.isLoading()) {
        finish();
      }
    }, 250);
  });
}

/* ============================================
   PINTAR CALLES EN EL CANVAS
============================================ */

function paintMapTiles(
  context,
  tileLayer,
  container,
  width,
  height
) {
  const containerRect =
    container.getBoundingClientRect();

  const images = [
    ...tileLayer
      .getContainer()
      .querySelectorAll(
        "img.leaflet-tile-loaded"
      )
  ];

  let painted = 0;

  for (const image of images) {
    if (
      !image.complete ||
      !image.naturalWidth
    ) {
      continue;
    }

    const rect =
      image.getBoundingClientRect();

    const x =
      rect.left - containerRect.left;

    const y =
      rect.top - containerRect.top;

    if (
      x + rect.width <= 0 ||
      y + rect.height <= 0 ||
      x >= width ||
      y >= height
    ) {
      continue;
    }

    context.drawImage(
      image,
      x,
      y,
      rect.width,
      rect.height
    );

    painted++;
  }

  return painted;
}

/* ============================================
   DESCARGAR PNG
============================================ */

function downloadPNG(blob, filename) {
  const url = URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 3000);
}

/* ============================================
   EXPORTACIÓN PNG
============================================ */

async function exportPNG() {
  const hasContent =
    points.length >= 2 ||
    items.length > 0 ||
    getLegendEntries().length > 0;

  if (!hasContent) {
    status(
      "Primero dibuja una ruta o coloca elementos."
    );

    return;
  }

  if (isExporting) return;

  isExporting = true;
  setMode(mode);

  const button = $("btnPNG");

  button.textContent =
    "Preparando PNG...";

  let exportMap = null;
  let exportContainer = null;

  try {
    status(
      "Preparando mapa, imágenes y leyenda..."
    );

    const dimensions =
      getExportDimensions();

    const width = dimensions.width;
    const height = dimensions.height;

    const scale =
      exportScale(width);

    const includeHeader =
      $("exportShowHeader").checked;

    const includeFooter =
      $("exportShowFooter").checked;

    const includeLegend =
      $("exportShowLegend").checked &&
      (
        points.length >= 2 ||
        getLegendEntries().length > 0
      );

    const headerHeight = includeHeader
      ? Math.round(135 * scale)
      : 0;

    const footerHeight = includeFooter
      ? Math.round(88 * scale)
      : 0;

    const mapWidth = width;

    const mapHeight =
      height -
      headerHeight -
      footerHeight;

    if (mapHeight < 200) {
      throw new Error(
        "Área insuficiente para exportar el mapa."
      );
    }

    // Cargar imágenes utilizadas.

    const images =
      await loadUsedImages();

    // Contenedor temporal.

    exportContainer =
      document.createElement("div");

    exportContainer.style.cssText = [
      "position:absolute",
      "left:-100000px",
      "top:0",
      "visibility:hidden",
      "pointer-events:none",
      "width:" + mapWidth + "px",
      "height:" + mapHeight + "px"
    ].join(";");

    document.body.appendChild(
      exportContainer
    );

    // Mapa independiente para exportación.

    exportMap = L.map(
      exportContainer,
      {
        center: map.getCenter(),
        zoom: map.getZoom(),

        minZoom: 3,
        maxZoom: 19,
        zoomSnap: 0,

        zoomControl: false,
        attributionControl: false,
        doubleClickZoom: false,

        zoomAnimation: false,
        fadeAnimation: false
      }
    );

    const exportTiles = L.tileLayer(
      TILE_URL,
      {
        maxZoom: 19,
        crossOrigin: "anonymous",
        updateWhenZooming: false
      }
    ).addTo(exportMap);

    exportMap.invalidateSize({
      animate: false
    });

    // Canvas final.

    const canvas =
      document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context =
      canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "No se pudo iniciar Canvas."
      );
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    context.fillStyle = "#ffffff";

    context.fillRect(
      0,
      0,
      width,
      height
    );

    // Nuevo centrado automático.

    if ($("exportAutoFit").checked) {
      autoFitExportMap(
        exportMap,
        context,
        mapWidth,
        mapHeight,
        images,
        scale,
        includeLegend
      );

    } else {
      exportMap.setView(
        map.getCenter(),
        map.getZoom(),
        { animate: false }
      );
    }

    status(
      "Cargando las calles del mapa..."
    );

    await waitForTiles(exportTiles);

    // Encabezado.

    if (includeHeader) {
      paintHeader(
        context,
        width,
        headerHeight,
        scale
      );
    }

    // Área cartográfica.

    context.save();

    context.beginPath();

    context.rect(
      0,
      headerHeight,
      mapWidth,
      mapHeight
    );

    context.clip();

    context.translate(
      0,
      headerHeight
    );

    context.fillStyle = "#edf2f7";

    context.fillRect(
      0,
      0,
      mapWidth,
      mapHeight
    );

    const painted = paintMapTiles(
      context,
      exportTiles,
      exportContainer,
      mapWidth,
      mapHeight
    );

    if (!painted) {
      throw new Error(
        "No se cargó el mapa base."
      );
    }

    // Ruta.

    paintRoute(
      context,
      exportMap,
      scale
    );

    // Personal, vehículos, drones,
    // cámaras, carpas y otros elementos.

    paintItems(
      context,
      exportMap,
      images,
      scale
    );

    // Leyenda con cantidades editadas.

    if (includeLegend) {
      paintLegend(
        context,
        mapWidth,
        mapHeight,
        scale,
        images
      );
    }

    // Atribución OpenStreetMap.

    context.save();

    context.textAlign = "right";

    context.font =
      `${11 * scale}px Arial`;

    const attribution =
      "© OpenStreetMap contributors";

    const attributionWidth =
      context.measureText(
        attribution
      ).width;

    context.fillStyle = "#fffffff0";

    context.fillRect(
      mapWidth -
        attributionWidth -
        20 * scale,
      mapHeight - 23 * scale,
      attributionWidth + 14 * scale,
      20 * scale
    );

    context.fillStyle = "#344054";

    context.fillText(
      attribution,
      mapWidth - 12 * scale,
      mapHeight - 8 * scale
    );

    context.restore();
    context.restore();

    // Pie de página.

    if (includeFooter) {
      paintFooter(
        context,
        width,
        headerHeight + mapHeight,
        footerHeight,
        scale
      );
    }

    status(
      "Generando PNG de " +
      width +
      " × " +
      height +
      " píxeles..."
    );

    const blob = await new Promise(
      (resolve, reject) => {
        canvas.toBlob(
          result => {
            if (result) {
              resolve(result);
            } else {
              reject(
                new Error(
                  "No se pudo crear el PNG."
                )
              );
            }
          },
          "image/png"
        );
      }
    );

    const safeTitle = (
      $("routeTitle").value ||
      "RECORRIDO"
    )
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();

    const date =
      $("routeDate").value ||
      "sin_fecha";

    const filename =
      safeTitle +
      "_" +
      date +
      "_" +
      width +
      "x" +
      height +
      ".png";

    downloadPNG(
      blob,
      filename
    );

    status(
      "PNG exportado correctamente. " +
      "Incluye la ruta, imágenes y leyenda."
    );

  } catch (error) {
    console.error(error);

    status(
      "Error al exportar: " +
      error.message
    );

    alert(
      "No se pudo exportar el PNG.\n\n" +
      error.message +
      "\n\nAbre el proyecto con Live Server " +
      "o localhost y comprueba la conexión."
    );

  } finally {
    if (exportMap) {
      exportMap.remove();
    }

    if (exportContainer) {
      exportContainer.remove();
    }

    isExporting = false;

    button.textContent =
      "EXPORTAR MAPA EN PNG";

    setMode(mode);
  }
}

$("btnPNG").onclick = exportPNG;

/* ============================================
   RECUPERAR RUTA GUARDADA
============================================ */

function restoreRoute() {
  const stored = readStorage(
    ROUTE_KEY,
    []
  );

  if (!Array.isArray(stored)) return;

  points = stored
    .map(value => {
      if (Array.isArray(value)) {
        return {
          lat: Number(value[0]),
          lng: Number(value[1])
        };
      }

      if (
        value &&
        typeof value === "object"
      ) {
        return {
          lat: Number(value.lat),
          lng: Number(value.lng)
        };
      }

      return null;
    })
    .filter(value =>
      value &&
      Number.isFinite(value.lat) &&
      Number.isFinite(value.lng) &&
      Math.abs(value.lat) <= 90 &&
      Math.abs(value.lng) <= 180
    )
    .map(value =>
      L.latLng(
        value.lat,
        value.lng
      )
    );
}

/* ============================================
   RECUPERAR ELEMENTOS GUARDADOS
============================================ */

function restoreItems() {
  const stored =
    readStorage(ITEMS_KEY, null) ??
    readStorage(
      "san_isidro_marcas_v3",
      []
    );

  if (!Array.isArray(stored)) return;

  const validTypes = [
    ...Object.keys(ASSETS),
    "via",
    "calle",
    "hora",
    "texto"
  ];

  items = stored
    .filter(item => {
      if (!item) return false;

      const lat = Number(item.lat);
      const lng = Number(item.lng);

      return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
      );
    })
    .map(item => {
      const type =
        validTypes.includes(item.type)
          ? item.type
          : "texto";

      return {
        id: String(
          item.id || createId()
        ),

        type,

        title: String(
          item.title ||
          item.text ||
          DEFAULT_NAMES[type] ||
          "ELEMENTO"
        ),

        time: String(
          item.time || ""
        ),

        size: clamp(
          numberOr(item.size, 120),
          30,
          360
        ),

        showTitle:
          item.showTitle !== false,

        lat: Number(item.lat),
        lng: Number(item.lng)
      };
    });
}

/* ============================================
   RECUPERAR CONFIGURACIÓN
============================================ */

function restoreConfig() {
  const config = readStorage(
    CONFIG_KEY,
    {}
  );

  if (
    !config ||
    typeof config !== "object"
  ) {
    return;
  }

  for (const id of CONFIG_IDS) {
    const element = $(id);

    if (
      !element ||
      config[id] === undefined
    ) {
      continue;
    }

    if (element.type === "checkbox") {
      element.checked =
        config[id] === true ||
        config[id] === "true";

      continue;
    }

    if (element.tagName === "SELECT") {
      const exists = [
        ...element.options
      ].some(
        option =>
          option.value ===
          String(config[id])
      );

      if (!exists) continue;
    }

    element.value =
      String(config[id]);
  }
}

/* ============================================
   INICIALIZACIÓN GENERAL
============================================ */

function initialize() {
  restoreRoute();
  restoreItems();
  restoreConfig();

  // Recuperar textos y cantidades de
  // todas las filas de la leyenda,
  // incluidas las 13 imágenes.

  initializeLegendEditor();

  updatePreview();
  updateSizeDisplay();

  $("exportMarginValue").textContent =
    $("exportMargin").value;

  setMode("idle");

  renderRoute();
  renderItems();
  updateLegend();

  if (points.length > 1) {
    fitVisibleMap();

    status(
      "Ruta recuperada. Puedes agregar " +
      "nuevas imágenes y editar la leyenda."
    );

  } else if (items.length) {
    fitVisibleMap();

    status(
      "Elementos anteriores recuperados."
    );

  } else {
    status(
      "Mapa listo para dibujar rutas " +
      "y colocar elementos municipales."
    );
  }

  // Precargar todas las imágenes.

  for (const type of Object.keys(ASSETS)) {
    loadImage(type);
  }
}

initialize();
