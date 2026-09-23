const API_ROOT = "https://raps-supabase.asuscomm.com/family-api";
const API = API_ROOT + "/api/client";
const TOKEN_KEY = "jgf_pages_token";

const app = document.querySelector("#app");
let currentUser = null;
let memoriesCache = null;
let assetsCache = { mediaTickets: {}, recollectionTickets: {} };
let mapInstance = null;

function token() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token()) headers.set("Authorization", "Bearer " + token());
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(API + path, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    currentUser = null;
    throw new Error("SESSION_EXPIRED");
  }

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

async function refreshTickets(mediaIds = [], recollectionIds = []) {
  if (!mediaIds.length && !recollectionIds.length) return assetsCache;

  const result = await api("/assets", {
    method: "POST",
    body: JSON.stringify({ mediaIds, recollectionIds })
  });

  assetsCache = {
    mediaTickets: { ...assetsCache.mediaTickets, ...result.mediaTickets },
    recollectionTickets: {
      ...assetsCache.recollectionTickets,
      ...result.recollectionTickets
    }
  };
  return assetsCache;
}

function mediaUrl(id) {
  const ticket = assetsCache.mediaTickets[id];
  return ticket
    ? API_ROOT + "/api/media/" + encodeURIComponent(id) + "?ticket=" + encodeURIComponent(ticket)
    : "";
}

function voiceUrl(id) {
  const ticket = assetsCache.recollectionTickets[id];
  return ticket
    ? API_ROOT + "/api/recollections/" + encodeURIComponent(id) + "/voice?ticket=" + encodeURIComponent(ticket)
    : "";
}

function route() {
  return location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
}

function shell(content, active = "") {
  const nav = [
    ["memories", "Memories"],
    ["people", "People"],
    ["places", "Places"]
  ];

  app.innerHTML = `
    <div class="shell">
      <header class="header">
        <a class="brand" href="#/memories">
          <span class="brand-mark">JG</span>
          <span>
            <strong>Julianne's Garcia Family</strong>
            <small>Our memories. Our stories.</small>
          </span>
        </a>
        <nav class="nav">
          ${nav.map(([href,label]) => `<a class="${active===href?"active":""}" href="#/${href}">${label}</a>`).join("")}
          <button id="signout">Sign out</button>
        </nav>
      </header>
      <main class="main">${content}</main>
      <footer class="footer">
        <span class="status-dot"></span>
        Private family archive · Data served from the Garcia family home server
      </footer>
    </div>
  `;

  document.querySelector("#signout")?.addEventListener("click", logout);
}

function renderLogin(message = "") {
  app.innerHTML = `
    <div class="login-wrap">
      <section class="login-card">
        <p class="eyebrow">PRIVATE FAMILY ARCHIVE</p>
        <h1>Julianne's Garcia Family</h1>
        <p>Our photographs, voices, places, and stories—preserved for the family.</p>
        <form id="login-form" class="form">
          <label>Email<input name="email" type="email" autocomplete="username" required /></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" required /></label>
          ${message ? `<div class="error">${escapeHtml(message)}</div>` : ""}
          <button class="button button-primary">Family sign in</button>
        </form>
      </section>
    </div>
  `;

  document.querySelector("#login-form").addEventListener("submit", login);
}

async function login(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  try {
    const result = await fetch(API + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password")
      })
    });
    const data = await result.json();
    if (!result.ok) throw new Error(data.error || "Could not sign in.");

    sessionStorage.setItem(TOKEN_KEY, data.token);
    currentUser = data.user;
    location.hash = "#/memories";
    await render();
  } catch (error) {
    renderLogin(error.message);
  }
}

async function logout() {
  try {
    if (token()) await api("/auth/logout", { method: "POST" });
  } catch {}
  sessionStorage.removeItem(TOKEN_KEY);
  currentUser = null;
  memoriesCache = null;
  assetsCache = { mediaTickets: {}, recollectionTickets: {} };
  renderLogin();
}

async function ensureUser() {
  if (!token()) return false;
  if (currentUser) return true;
  try {
    const result = await api("/me");
    currentUser = result.user;
    return true;
  } catch {
    return false;
  }
}

async function renderMemories() {
  shell(`<div class="loading">Opening the family archive…</div>`, "memories");

  const { memories } = await api("/memories");
  memoriesCache = memories;

  const firstPhotoIds = memories
    .map(m => m.media.find(item => item.kind === "photo")?.id)
    .filter(Boolean);

  await refreshTickets(firstPhotoIds, []);

  shell(`
    <section class="hero">
      <p class="eyebrow">OUR FAMILY HISTORY</p>
      <h1>Every picture has a story.</h1>
      <p>Explore the photographs, voices, people, and places that made the Garcia family.</p>
    </section>
    ${memories.length ? `
      <div class="grid">
        ${memories.map(memory => {
          const photo = memory.media.find(item => item.kind === "photo");
          const src = photo ? mediaUrl(photo.id) : "";
          return `
            <a class="card" href="#/memories/${memory.id}">
              <div class="card-media">
                ${src ? `<img src="${src}" alt="${escapeHtml(photo.caption || memory.title)}" loading="lazy" />` : "◇"}
              </div>
              <div class="card-body">
                <p class="eyebrow">${escapeHtml(memory.dateLabel || "DATE UNKNOWN")} · ${escapeHtml(memory.place || "PLACE UNKNOWN")}</p>
                <h2>${escapeHtml(memory.title)}</h2>
                <p>${escapeHtml((memory.story || "This Memory is waiting for its story.").slice(0,180))}</p>
                <div class="meta">${escapeHtml(memory.people.map(p => p.displayName).join(" · ") || "People not identified yet")}</div>
              </div>
            </a>
          `;
        }).join("")}
      </div>
    ` : '<div class="empty">No approved Memories yet.</div>'}
  `, "memories");
}

async function renderMemory(id) {
  shell('<div class="loading">Opening this Memory…</div>', "memories");
  const { memory } = await api("/memories/" + encodeURIComponent(id));

  const mediaIds = memory.media.map(item => item.id);
  const recollectionIds = memory.recollections.filter(r => r.hasVoice).map(r => r.id);
  await refreshTickets(mediaIds, recollectionIds);

  const mediaHtml = memory.media.map(item => {
    const src = mediaUrl(item.id);
    if (item.kind === "photo") {
      return `<figure><img src="${src}" alt="${escapeHtml(item.caption || item.originalFilename)}" />${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ""}</figure>`;
    }
    if (item.kind === "video") {
      return `<figure><video src="${src}" controls preload="metadata"></video>${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ""}</figure>`;
    }
    return `<figure><audio src="${src}" controls preload="metadata"></audio></figure>`;
  }).join("");

  shell(`
    <p><a href="#/memories">← Back to Memories</a></p>
    <section class="memory-layout">
      <div class="media-stack">${mediaHtml || '<div class="empty">This Memory is told in words.</div>'}</div>
      <aside class="story-panel">
        <p class="eyebrow">${escapeHtml(memory.dateLabel || "DATE UNKNOWN")} · ${escapeHtml(memory.place || "PLACE UNKNOWN")}</p>
        <h1>${escapeHtml(memory.title)}</h1>
        <p class="story-text">${escapeHtml(memory.story || "This Memory does not have a written story yet.")}</p>
        <p><strong>People</strong><br><span class="people-links">${memory.people.length ? memory.people.map(p => `<a href="#/people/${p.id}">${escapeHtml(p.displayName)}</a>`).join(", ") : "Not identified yet"}</span></p>
        <p class="meta">Shared by ${escapeHtml(memory.contributor || "Family member")}</p>
      </aside>
    </section>
    <section class="recollections">
      <p class="eyebrow">FAMILY RECOLLECTIONS</p>
      <h2 class="page-title">Everyone remembers a different piece.</h2>
      ${memory.recollections.length ? memory.recollections.map(r => `
        <article class="recollection">
          <strong>${escapeHtml(r.contributor)}</strong>
          <span class="meta">${r.ageAtMemory ? " · About " + escapeHtml(r.ageAtMemory) + " at the time" : ""}</span>
          ${r.story ? `<blockquote>“${escapeHtml(r.story)}”</blockquote>` : ""}
          ${r.hasVoice ? `<audio src="${voiceUrl(r.id)}" controls preload="metadata"></audio>` : ""}
        </article>
      `).join("") : '<div class="empty">No additional recollections yet.</div>'}
    </section>
  `, "memories");
}

async function renderPeople() {
  shell('<div class="loading">Opening family profiles…</div>', "people");
  const { people } = await api("/people");

  shell(`
    <section class="hero">
      <p class="eyebrow">OUR PEOPLE</p>
      <h1>The people behind the memories.</h1>
      <p>Every person is a thread connecting photographs, places, relationships, and stories.</p>
    </section>
    <div class="grid">
      ${people.map(person => `
        <a class="card" href="#/people/${person.id}">
          <div class="card-media"><span class="monogram">${escapeHtml(person.displayName.slice(0,1).toUpperCase())}</span></div>
          <div class="card-body">
            <h2>${escapeHtml(person.displayName)}</h2>
            <p>${escapeHtml([person.birthLabel, person.deathLabel].filter(Boolean).join(" — ") || person.birthPlace || "")}</p>
            <div class="meta">${person.memoryCount} approved ${person.memoryCount===1?"Memory":"Memories"}</div>
          </div>
        </a>
      `).join("")}
    </div>
  `, "people");
}

async function renderPerson(id) {
  shell('<div class="loading">Opening family profile…</div>', "people");
  const { person } = await api("/people/" + encodeURIComponent(id));
  const photos = person.memories.map(m => m.photoMediaId).filter(Boolean);
  await refreshTickets(photos, []);

  shell(`
    <p><a href="#/people">← Back to People</a></p>
    <header class="person-hero">
      <div class="monogram">${escapeHtml(person.displayName.slice(0,1).toUpperCase())}</div>
      <div>
        <p class="eyebrow">FAMILY PROFILE</p>
        <h1 class="page-title">${escapeHtml(person.displayName)}</h1>
        <p class="intro">${escapeHtml([person.birthLabel, person.deathLabel].filter(Boolean).join(" — "))}${person.birthPlace ? "<br>From " + escapeHtml(person.birthPlace) : ""}</p>
      </div>
    </header>
    <section>
      <p class="eyebrow">THEIR STORY</p>
      <p class="story-text">${escapeHtml(person.biography || "Their connected Memories are beginning to tell the story.")}</p>
    </section>
    ${person.relationships.length ? `
      <div class="relationships">
        ${person.relationships.map(r => `<a href="#/people/${r.relatedPersonId}"><strong>${escapeHtml(r.relatedName)}</strong> · ${escapeHtml(r.label)}</a>`).join("")}
      </div>
    ` : ""}
    <section>
      <p class="eyebrow">CONNECTED MEMORIES</p>
      <h2 class="page-title">${person.memories.length} family stories</h2>
      <div class="grid" style="margin-top:24px">
        ${person.memories.map(memory => `
          <a class="card" href="#/memories/${memory.id}">
            <div class="card-media">${memory.photoMediaId ? `<img src="${mediaUrl(memory.photoMediaId)}" alt="${escapeHtml(memory.title)}" loading="lazy" />` : "◇"}</div>
            <div class="card-body">
              <p class="eyebrow">${escapeHtml(memory.dateLabel || "DATE UNKNOWN")}</p>
              <h3>${escapeHtml(memory.title)}</h3>
              <p>${escapeHtml(memory.place || "")}</p>
            </div>
          </a>
        `).join("")}
      </div>
    </section>
  `, "people");
}

async function renderPlaces() {
  shell('<div class="loading">Mapping family history…</div>', "places");
  const { places } = await api("/places");

  shell(`
    <section class="hero">
      <p class="eyebrow">OUR PLACES</p>
      <h1>Where our family story happened.</h1>
      <p>Approved Memories are mapped using broad family-history locations, not street addresses.</p>
    </section>
    <div id="family-map" class="map"></div>
    <div class="grid">
      ${places.map(place => `
        <a class="card" href="#/memories/${place.id}">
          <div class="card-body">
            <p class="eyebrow">${escapeHtml(place.dateLabel || "DATE UNKNOWN")}</p>
            <h3>${escapeHtml(place.title)}</h3>
            <p>${escapeHtml(place.place || "")}</p>
          </div>
        </a>
      `).join("")}
    </div>
  `, "places");

  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }

  if (!places.length || !window.L) return;
  mapInstance = L.map("family-map", { scrollWheelZoom: false });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(mapInstance);

  const bounds = [];
  for (const place of places) {
    if (typeof place.latitude !== "number" || typeof place.longitude !== "number") continue;
    const point = [place.latitude, place.longitude];
    bounds.push(point);
    const marker = L.circleMarker(point, { radius: 7, weight: 2, fillOpacity: .85 }).addTo(mapInstance);
    marker.bindPopup(`<strong>${escapeHtml(place.title)}</strong><br><small>${escapeHtml(place.place || "")}</small><br><a href="#/memories/${place.id}">Open Memory →</a>`);
  }

  if (bounds.length === 1) mapInstance.setView(bounds[0], 7);
  else if (bounds.length) mapInstance.fitBounds(bounds, { padding: [30,30], maxZoom: 7 });
}

async function render() {
  const signedIn = await ensureUser();
  if (!signedIn) {
    renderLogin();
    return;
  }

  const parts = route();
  const section = parts[0] || "memories";

  try {
    if (section === "memories" && parts[1]) return await renderMemory(parts[1]);
    if (section === "people" && parts[1]) return await renderPerson(parts[1]);
    if (section === "people") return await renderPeople();
    if (section === "places") return await renderPlaces();
    return await renderMemories();
  } catch (error) {
    if (error.message === "SESSION_EXPIRED") return renderLogin("Your family session expired. Please sign in again.");
    shell(`<div class="error">${escapeHtml(error.message || "Could not load the family archive.")}</div>`, section);
  }
}

window.addEventListener("hashchange", render);
render();
