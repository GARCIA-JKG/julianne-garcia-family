const API_ROOT = "https://raps-supabase.asuscomm.com/family-api";
const API = API_ROOT + "/api/client";
const TOKEN_KEY = "jgf_pages_token";

const app = document.querySelector("#app");
let currentUser = null;
let memoriesCache = null;
let assetsCache = { mediaTickets: {}, recollectionTickets: {}, scanTickets: {} };
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

async function refreshTickets(mediaIds = [], recollectionIds = [], scanIds = []) {
  if (!mediaIds.length && !recollectionIds.length && !scanIds.length) return assetsCache;

  const result = await api("/assets", {
    method: "POST",
    body: JSON.stringify({ mediaIds, recollectionIds, scanIds })
  });

  assetsCache = {
    mediaTickets: { ...assetsCache.mediaTickets, ...(result.mediaTickets || {}) },
    recollectionTickets: {
      ...assetsCache.recollectionTickets,
      ...(result.recollectionTickets || {})
    },
    scanTickets: {
      ...assetsCache.scanTickets,
      ...(result.scanTickets || {})
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

function scanUrl(id) {
  const ticket = assetsCache.scanTickets[id];
  return ticket
    ? API_ROOT + "/api/imports/items/" + encodeURIComponent(id) + "?ticket=" + encodeURIComponent(ticket)
    : "";
}

function route() {
  return location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
}

function shell(content, active = "") {
  const nav = [
    ["memories", "Memories"],
    ["timeline", "Family Tree"],
    ["people", "People"],
    ["places", "Places"]
  ];

  if (currentUser?.role === "admin" || currentUser?.role === "curator") {
    nav.push(["curate", "Curate"]);
    nav.push(["scans", "Scan Inbox"]);
  }

  if (currentUser?.role === "admin") {
    nav.push(["family-access", "Family Access"]);
  }

  if (currentUser?.role !== "viewer") {
    nav.push(["contribute", "Share a Memory"]);
  }

  nav.push(["account", "Account"]);

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
          ${nav.map(([href,label]) => `<a class="${active===href?"active":""} ${href==="contribute"?"nav-cta":""}" href="#/${href}">${label}</a>`).join("")}
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
        <p class="login-help">
          Forgot your password? Ask the family administrator to reset it.
        </p>
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
  assetsCache = { mediaTickets: {}, recollectionTickets: {}, scanTickets: {} };
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
        ${person.relationships.map(r => `<a href="#/people/${r.relatedPersonId}"><strong>${escapeHtml(r.relatedName)}</strong></a>`).join("")}
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

async function renderTimeline() {
  shell('<div class="loading">Opening the Family Tree…</div>', "timeline");

  const { tree } = await api("/family-tree");
  const generations = Array.from(
    { length: tree.generationCount },
    (_, index) => tree.people.filter(person => person.generation === index)
  );

  shell(`
    <section class="hero family-tree-hero">
      <p class="eyebrow">OUR FAMILY STORY</p>
      <h1>Family Tree</h1>
      <p>Follow the Garcia family across generations. The tree shows names and connections without assigning family titles.</p>
    </section>

    ${tree.people.length ? `
      <div class="family-tree">
        ${generations.map((people, generationIndex) => `
          <section class="family-generation">
            <div class="generation-marker">
              <span>Generation ${generationIndex + 1}</span>
            </div>

            <div class="generation-people">
              ${people.map(person => {
                const connected = tree.connections
                  .filter(connection => connection.leftId === person.id || connection.rightId === person.id)
                  .map(connection => connection.leftId === person.id ? connection.rightId : connection.leftId);
                const branchCount = tree.branches.filter(branch => branch.fromId === person.id).length;

                return `
                  <a class="family-tree-person" href="#/people/${person.id}">
                    <div class="family-tree-monogram">${escapeHtml(person.displayName.slice(0,1).toUpperCase())}</div>
                    <div class="family-tree-person-copy">
                      <h2>${escapeHtml(person.displayName)}</h2>
                      ${person.birthLabel || person.deathLabel
                        ? `<p>${escapeHtml([person.birthLabel, person.deathLabel].filter(Boolean).join(" — "))}</p>`
                        : ""}
                      ${person.birthPlace ? `<p>${escapeHtml(person.birthPlace)}</p>` : ""}
                      <span>
                        ${person.memoryCount} ${person.memoryCount === 1 ? "Memory" : "Memories"}
                        ${connected.length ? " · " + connected.length + " connection" + (connected.length === 1 ? "" : "s") : ""}
                        ${branchCount ? " · " + branchCount + " branch" + (branchCount === 1 ? "" : "es") : ""}
                      </span>
                    </div>
                  </a>
                `;
              }).join("")}
            </div>
          </section>
        `).join("")}
      </div>
    ` : '<div class="empty">Add people and connect them to begin the family story.</div>'}
  `, "timeline");
}

function formatUploadBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

async function renderContribute() {
  if (currentUser?.role === "viewer") {
    location.hash = "#/memories";
    return;
  }

  shell(`
    <section class="hero contribute-hero">
      <p class="eyebrow">SHARE A FAMILY MEMORY</p>
      <h1>Help Julianne learn the story.</h1>
      <p>Upload photos or video, write what you remember, or record the story in your own voice. Small details matter too.</p>
    </section>

    <form id="memory-form" class="memory-form">
      <fieldset>
        <legend>1. Add photos, video, or a voice</legend>

        <label class="upload-zone">
          <span class="upload-icon">＋</span>
          <strong>Choose family media</strong>
          <span>Photos or videos from your phone or computer</span>
          <input id="memory-media" type="file" multiple accept="image/*,video/*,.heic,.heif,.avif" />
        </label>

        <section id="upload-previews" class="upload-preview-section hidden">
          <div class="upload-preview-heading">
            <div>
              <strong id="preview-count">0 items ready</strong>
              <span>Check these before sharing the Memory.</span>
            </div>
            <button type="button" id="clear-media" class="text-button">Clear all</button>
          </div>
          <div id="preview-grid" class="upload-preview-grid"></div>
        </section>

        <div class="voice-controls">
          <button type="button" id="voice-button" class="button button-secondary">● Record the story in your voice</button>
          <div id="voice-preview"></div>
        </div>
      </fieldset>

      <fieldset>
        <legend>2. Tell the story</legend>

        <label>
          Memory title
          <input type="text" name="title" required maxlength="180" placeholder="Grandma's graduation, Dad's first car..." />
        </label>

        <div class="field-grid">
          <label>
            About when?
            <input type="month" name="monthYear" />
            <small>Month and year are enough.</small>
          </label>

          <label>
            City
            <input type="text" name="locality" maxlength="120" placeholder="Honolulu" />
          </label>

          <label>
            State / region
            <input type="text" name="region" maxlength="120" placeholder="Hawaii" />
          </label>

          <label>
            Country
            <input type="text" name="country" maxlength="120" placeholder="United States" />
          </label>
        </div>

        <label>
          Who is in this memory?
          <input type="text" name="people" maxlength="1000" placeholder="Grandma, Grandpa, Aunt Maria..." />
        </label>

        <label>
          What should Julianne know about this?
          <textarea name="story" rows="8" maxlength="12000" placeholder="Tell the story the way you would tell it sitting together at the kitchen table..."></textarea>
        </label>
      </fieldset>

      <div id="memory-form-message"></div>
      <button id="memory-submit" type="submit" class="button button-primary">Share this Memory</button>
    </form>
  `, "contribute");

  const form = document.querySelector("#memory-form");
  const input = document.querySelector("#memory-media");
  const previewSection = document.querySelector("#upload-previews");
  const previewGrid = document.querySelector("#preview-grid");
  const previewCount = document.querySelector("#preview-count");
  const clearButton = document.querySelector("#clear-media");
  const voiceButton = document.querySelector("#voice-button");
  const voicePreview = document.querySelector("#voice-preview");
  const submitButton = document.querySelector("#memory-submit");
  const message = document.querySelector("#memory-form-message");

  let selectedFiles = [];
  let previewUrls = [];
  let recorder = null;
  let voiceStream = null;
  let voiceChunks = [];
  let voiceBlob = null;
  let voiceUrlValue = null;

  function revokePreviews() {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    previewUrls = [];
  }

  function renderPreviews() {
    revokePreviews();
    previewGrid.innerHTML = "";

    previewSection.classList.toggle("hidden", selectedFiles.length === 0);
    previewCount.textContent =
      selectedFiles.length + " " + (selectedFiles.length === 1 ? "item" : "items") + " ready";

    selectedFiles.forEach((file, index) => {
      const extension = (file.name.split(".").pop() || "").toLowerCase();
      const canImagePreview = file.type.startsWith("image/") && !["heic","heif"].includes(extension);
      const canVideoPreview = file.type.startsWith("video/");
      const url = canImagePreview || canVideoPreview ? URL.createObjectURL(file) : "";
      if (url) previewUrls.push(url);

      const card = document.createElement("article");
      card.className = "upload-preview-card";
      card.innerHTML = `
        <div class="upload-preview-media">
          ${canImagePreview
            ? `<img src="${url}" alt="${escapeHtml(file.name)}" />`
            : canVideoPreview
              ? `<video src="${url}" controls muted preload="metadata"></video>`
              : `<div class="upload-file-fallback"><span>▧</span><strong>${escapeHtml(extension.toUpperCase() || "FILE")}</strong></div>`
          }
        </div>
        <div class="upload-preview-details">
          <div>
            <strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong>
            <span>${formatUploadBytes(file.size)}</span>
          </div>
          <button type="button" class="preview-remove-button" data-remove="${index}">Remove</button>
        </div>
      `;
      previewGrid.appendChild(card);
    });

    previewGrid.querySelectorAll("[data-remove]").forEach(button => {
      button.addEventListener("click", () => {
        selectedFiles.splice(Number(button.dataset.remove), 1);
        renderPreviews();
      });
    });
  }

  input.addEventListener("change", () => {
    selectedFiles = Array.from(input.files || []).slice(0, 25);
    renderPreviews();
  });

  clearButton.addEventListener("click", () => {
    selectedFiles = [];
    input.value = "";
    renderPreviews();
  });

  voiceButton.addEventListener("click", async () => {
    if (recorder && recorder.state === "recording") {
      recorder.stop();
      voiceButton.textContent = "● Record the story in your voice";
      submitButton.disabled = false;
      return;
    }

    try {
      voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(voiceStream);
      voiceChunks = [];

      recorder.addEventListener("dataavailable", event => {
        if (event.data.size > 0) voiceChunks.push(event.data);
      });

      recorder.addEventListener("stop", () => {
        voiceBlob = new Blob(voiceChunks, {
          type: recorder.mimeType || "audio/webm"
        });

        voiceStream?.getTracks().forEach(track => track.stop());
        voiceStream = null;

        if (voiceUrlValue) URL.revokeObjectURL(voiceUrlValue);
        voiceUrlValue = URL.createObjectURL(voiceBlob);

        voicePreview.innerHTML = `
          <div class="voice-upload-preview">
            <strong>Voice story ready</strong>
            <span>Listen before adding it to the Memory.</span>
            <audio src="${voiceUrlValue}" controls preload="metadata"></audio>
            <button type="button" id="remove-voice" class="text-button">Remove recording</button>
          </div>
        `;

        document.querySelector("#remove-voice")?.addEventListener("click", () => {
          voiceBlob = null;
          if (voiceUrlValue) URL.revokeObjectURL(voiceUrlValue);
          voiceUrlValue = null;
          voicePreview.innerHTML = "";
        });
      });

      recorder.start();
      voiceButton.textContent = "■ Stop recording";
      submitButton.disabled = true;
      message.innerHTML = "";
    } catch {
      message.innerHTML = '<div class="error">Microphone access was not available on this device.</div>';
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    submitButton.disabled = true;
    submitButton.textContent = "Saving Memory…";
    message.innerHTML = "";

    const data = new FormData(form);
    for (const file of selectedFiles) data.append("media", file);

    if (voiceBlob) {
      data.append(
        "media",
        new File([voiceBlob], "family-voice-story.webm", {
          type: voiceBlob.type || "audio/webm"
        })
      );
    }

    try {
      await api("/memories", { method: "POST", body: data });
      selectedFiles = [];
      renderPreviews();
      if (voiceUrlValue) URL.revokeObjectURL(voiceUrlValue);
      voiceUrlValue = null;
      voiceBlob = null;
      voicePreview.innerHTML = "";
      form.reset();
      message.innerHTML = '<div class="success">Memory saved. It is waiting for a family curator to review it.</div>';
    } catch (error) {
      message.innerHTML = '<div class="error">' + escapeHtml(error.message || "Could not save this Memory.") + '</div>';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Share this Memory";
    }
  });
}

async function renderCurate() {
  if (currentUser?.role !== "admin" && currentUser?.role !== "curator") {
    location.hash = "#/memories";
    return;
  }

  shell('<div class="loading">Opening the family review queue…</div>', "curate");
  const { memories, recollections } = await api("/curate");

  const mediaIds = memories.flatMap(memory => memory.media.map(item => item.id));
  const voiceIds = recollections.filter(item => item.hasVoice).map(item => item.id);
  await refreshTickets(mediaIds, voiceIds);

  const allCaughtUp = memories.length === 0 && recollections.length === 0;

  shell(`
    <section class="hero">
      <p class="eyebrow">FAMILY CURATOR</p>
      <h1>Stories waiting for review</h1>
      <p>Review new Memories and Family Recollections before they join the shared archive.</p>
    </section>

    ${allCaughtUp ? `
      <div class="empty">
        <strong>ALL CAUGHT UP</strong><br>
        No family stories are waiting for review.
      </div>
    ` : ""}

    ${memories.length ? `
      <section class="review-section">
        <div class="review-section-heading">
          <p class="eyebrow">NEW MEMORIES</p>
          <h2>${memories.length} waiting</h2>
        </div>

        <div class="review-list">
          ${memories.map(memory => `
            <article class="review-card" data-review-memory="${memory.id}">
              <div class="review-copy">
                <p class="eyebrow">${escapeHtml(memory.dateLabel || "DATE UNKNOWN")} · ${escapeHtml(memory.place || "PLACE UNKNOWN")}</p>
                <h2>${escapeHtml(memory.title)}</h2>
                <p>${escapeHtml(memory.story || "No written story was included.")}</p>
                <p class="review-meta">Shared by ${escapeHtml(memory.contributor || "Family member")} · ${memory.media.length} media item${memory.media.length === 1 ? "" : "s"}</p>
                ${memory.people?.length ? `<p class="review-meta">${escapeHtml(memory.people.map(person => person.displayName).join(" · "))}</p>` : ""}
              </div>

              ${memory.media.length ? `
                <div class="review-media-grid">
                  ${memory.media.map(item => {
                    const src = mediaUrl(item.id);
                    if (item.kind === "photo") {
                      return `<img src="${src}" alt="${escapeHtml(item.caption || item.originalFilename)}" loading="lazy" />`;
                    }
                    if (item.kind === "video") {
                      return `<video src="${src}" controls preload="metadata"></video>`;
                    }
                    return `<audio src="${src}" controls preload="metadata"></audio>`;
                  }).join("")}
                </div>
              ` : ""}

              <div class="review-actions">
                <button class="button button-primary" data-memory-decision="approved" data-id="${memory.id}">Approve</button>
                <button class="button button-secondary" data-memory-decision="rejected" data-id="${memory.id}">Reject</button>
                <div class="review-message"></div>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    ` : ""}

    ${recollections.length ? `
      <section class="review-section">
        <div class="review-section-heading">
          <p class="eyebrow">FAMILY RECOLLECTIONS</p>
          <h2>${recollections.length} waiting</h2>
        </div>

        <div class="review-list">
          ${recollections.map(item => `
            <article class="review-card" data-review-recollection="${item.id}">
              <div class="review-copy">
                <p class="eyebrow">ADDITIONAL PERSPECTIVE</p>
                <h2>${escapeHtml(item.contributor)} remembers…</h2>
                ${item.story ? `<blockquote class="review-recollection-quote">“${escapeHtml(item.story)}”</blockquote>` : ""}
                <p class="review-meta">On Memory: <strong>${escapeHtml(item.memoryTitle || "Untitled Memory")}</strong>${item.ageAtMemory ? " · About " + escapeHtml(item.ageAtMemory) + " at the time" : ""}</p>
                ${item.hasVoice ? `<audio class="review-audio" src="${voiceUrl(item.id)}" controls preload="metadata"></audio>` : ""}
              </div>

              <div class="review-actions">
                <button class="button button-primary" data-recollection-decision="approved" data-id="${item.id}">Approve</button>
                <button class="button button-secondary" data-recollection-decision="rejected" data-id="${item.id}">Reject</button>
                <div class="review-message"></div>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    ` : ""}
  `, "curate");

  async function decide(kind, id, status, button) {
    const card = button.closest(".review-card");
    const buttons = card.querySelectorAll("button");
    const message = card.querySelector(".review-message");
    buttons.forEach(item => item.disabled = true);
    message.innerHTML = "";

    try {
      await api("/curate/" + kind + "/" + encodeURIComponent(id), {
        method: "POST",
        body: JSON.stringify({ status })
      });

      card.classList.add("review-resolved");
      message.innerHTML = '<div class="success">' + (status === "approved" ? "Approved." : "Rejected.") + '</div>';
      setTimeout(() => renderCurate(), 250);
    } catch (error) {
      message.innerHTML = '<div class="error">' + escapeHtml(error.message || "Could not save review decision.") + '</div>';
      buttons.forEach(item => item.disabled = false);
    }
  }

  document.querySelectorAll("[data-memory-decision]").forEach(button => {
    button.addEventListener("click", () => {
      decide("memories", button.dataset.id, button.dataset.memoryDecision, button);
    });
  });

  document.querySelectorAll("[data-recollection-decision]").forEach(button => {
    button.addEventListener("click", () => {
      decide("recollections", button.dataset.id, button.dataset.recollectionDecision, button);
    });
  });
}

async function renderScans() {
  if (currentUser?.role !== "admin" && currentUser?.role !== "curator") {
    location.hash = "#/memories";
    return;
  }

  shell('<div class="loading">Opening the Scan Inbox…</div>', "scans");
  const { batches } = await api("/scans");

  shell(`
    <section class="hero">
      <p class="eyebrow">SCAN INBOX</p>
      <h1>Turn boxes of prints into family history.</h1>
      <p>Upload scans first. Curate them later. Nothing joins the family archive until you group it into a Memory.</p>
    </section>

    <form id="scan-batch-form" class="scan-batch-form">
      <label>
        Batch name
        <input name="name" required maxlength="160" placeholder="Grandma's photo box — September 2026" />
      </label>
      <div class="field-grid">
        <label>
          Source
          <input name="source" maxlength="200" placeholder="Grandma's blue album, shoebox #2..." />
        </label>
        <label>
          Notes
          <input name="notes" maxlength="500" placeholder="Mostly California, probably 1970s–80s" />
        </label>
      </div>
      <div id="scan-batch-message"></div>
      <button class="button button-primary">Create scan batch</button>
    </form>

    <div class="scan-batch-list">
      ${batches.length ? batches.map(batch => `
        <a class="scan-batch-card" href="#/scans/${batch.id}">
          <div>
            <p class="eyebrow">${escapeHtml(new Date(batch.createdAt).toLocaleDateString())}</p>
            <h2>${escapeHtml(batch.name)}</h2>
            ${batch.source ? `<p>${escapeHtml(batch.source)}</p>` : ""}
          </div>
          <div class="scan-batch-stats">
            <span><strong>${batch.total}</strong> scans</span>
            <span><strong>${batch.pending}</strong> to curate</span>
            <span><strong>${batch.curated}</strong> curated</span>
          </div>
        </a>
      `).join("") : '<div class="empty">Create a batch when you begin a scan session.</div>'}
    </div>
  `, "scans");

  document.querySelector("#scan-batch-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const button = form.querySelector("button");
    const message = document.querySelector("#scan-batch-message");
    button.disabled = true;
    button.textContent = "Creating…";
    message.innerHTML = "";

    try {
      const result = await api("/scans", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          source: data.get("source"),
          notes: data.get("notes")
        })
      });
      location.hash = "#/scans/" + result.id;
    } catch (error) {
      message.innerHTML = '<div class="error">' + escapeHtml(error.message || "Could not create scan batch.") + '</div>';
      button.disabled = false;
      button.textContent = "Create scan batch";
    }
  });
}

async function renderScanBatch(id) {
  if (currentUser?.role !== "admin" && currentUser?.role !== "curator") {
    location.hash = "#/memories";
    return;
  }

  shell('<div class="loading">Opening scan batch…</div>', "scans");
  const { batch } = await api("/scans/" + encodeURIComponent(id));
  const pending = batch.items.filter(item => item.status === "pending");

  await refreshTickets([], [], pending.map(item => item.id));

  shell(`
    <p><a href="#/scans">← Back to Scan Inbox</a></p>
    <section class="hero scan-hero">
      <p class="eyebrow">SCAN BATCH</p>
      <h1>${escapeHtml(batch.name)}</h1>
      ${batch.source ? `<p>Source: ${escapeHtml(batch.source)}</p>` : ""}
      ${batch.notes ? `<p>${escapeHtml(batch.notes)}</p>` : ""}
    </section>

    <section class="scan-upload-panel">
      <div>
        <p class="eyebrow">BULK UPLOAD</p>
        <h2>Add scanned prints</h2>
        <p>Choose a whole scan session at once. Files upload three at a time so a large batch does not overload the family server.</p>
      </div>
      <label class="upload-zone">
        <span class="upload-icon">＋</span>
        <strong id="scan-upload-label">Choose scanned photos</strong>
        <span>JPG, PNG, HEIC/HEIF, WebP, GIF, or AVIF</span>
        <input id="scan-files" type="file" accept="image/*,.heic,.heif,.avif" multiple />
      </label>
      <div id="scan-progress"></div>
      <div id="scan-upload-errors"></div>
    </section>

    ${pending.length ? `
      <section class="scan-curation">
        <div class="scan-toolbar">
          <div>
            <p class="eyebrow">CURATION TABLE</p>
            <h2>Group scans into a Memory</h2>
            <p>Select the photos that belong together, then describe that moment once.</p>
          </div>
          <button id="scan-select-all" class="button button-secondary" type="button">Select all</button>
        </div>

        <div class="scan-grid">
          ${pending.map(item => `
            <button type="button" class="scan-tile" data-scan-id="${item.id}">
              <img src="${scanUrl(item.id)}" alt="${escapeHtml(item.originalFilename)}" loading="lazy" />
              <span class="scan-check"></span>
              <span class="scan-name">${escapeHtml(item.originalFilename)}</span>
            </button>
          `).join("")}
        </div>

        <form id="scan-curate-form" class="scan-curate-form">
          <div class="scan-selection-count"><strong id="selected-count">0</strong> scans selected</div>
          <label>
            Memory title
            <input name="title" maxlength="180" required placeholder="Christmas at Grandma's house" />
          </label>
          <div class="field-grid">
            <label>About when?<input type="month" name="monthYear" /></label>
            <label>City<input name="locality" maxlength="120" /></label>
            <label>State / region<input name="region" maxlength="120" /></label>
            <label>Country<input name="country" maxlength="120" /></label>
          </div>
          <label>
            Who appears in these photos?
            <input name="people" maxlength="1000" placeholder="Grandma, Grandpa, Mom..." />
          </label>
          <label>
            What is the story?
            <textarea name="story" rows="5" maxlength="12000" placeholder="What should Julianne know when she sees these photos?"></textarea>
          </label>
          <div id="scan-curate-message"></div>
          <button id="scan-curate-submit" class="button button-primary" disabled>Curate selected scans into a Memory</button>
        </form>
      </section>
    ` : '<div class="empty">No uncurated scans remain in this batch.</div>'}
  `, "scans");

  const fileInput = document.querySelector("#scan-files");
  const uploadLabel = document.querySelector("#scan-upload-label");
  const progressBox = document.querySelector("#scan-progress");
  const errorBox = document.querySelector("#scan-upload-errors");

  fileInput?.addEventListener("change", async () => {
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;

    fileInput.disabled = true;
    uploadLabel.textContent = "Uploading scans…";
    errorBox.innerHTML = "";

    let cursor = 0;
    let completed = 0;
    let failed = 0;
    const errors = [];

    function updateProgress() {
      progressBox.innerHTML = `
        <div class="scan-progress">
          <strong>${completed + failed} / ${files.length}</strong>
          <span>${completed} uploaded${failed ? " · " + failed + " failed" : ""}</span>
          <progress max="${files.length}" value="${completed + failed}"></progress>
        </div>
      `;
    }

    async function worker() {
      while (cursor < files.length) {
        const index = cursor++;
        const file = files[index];
        const data = new FormData();
        data.append("file", file);

        try {
          await api("/scans/" + encodeURIComponent(id) + "/items", {
            method: "POST",
            body: data
          });
          completed += 1;
        } catch (error) {
          failed += 1;
          errors.push(file.name + ": " + (error.message || "Upload failed"));
        }
        updateProgress();
      }
    }

    updateProgress();
    await Promise.all([worker(), worker(), worker()]);

    if (errors.length) {
      errorBox.innerHTML = '<div class="error">' + errors.slice(0, 10).map(escapeHtml).join("<br>") + '</div>';
    }

    if (completed > 0) {
      await renderScanBatch(id);
      return;
    }

    fileInput.disabled = false;
    uploadLabel.textContent = "Choose scanned photos";
  });

  const selected = new Set();
  const tiles = Array.from(document.querySelectorAll("[data-scan-id]"));
  const count = document.querySelector("#selected-count");
  const curateSubmit = document.querySelector("#scan-curate-submit");
  const selectAll = document.querySelector("#scan-select-all");

  function syncSelection() {
    tiles.forEach(tile => {
      const active = selected.has(tile.dataset.scanId);
      tile.classList.toggle("selected", active);
      tile.querySelector(".scan-check").textContent = active ? "✓" : "";
      tile.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (count) count.textContent = String(selected.size);
    if (curateSubmit) curateSubmit.disabled = selected.size === 0;
    if (selectAll) selectAll.textContent = selected.size === tiles.length && tiles.length ? "Clear selection" : "Select all";
  }

  tiles.forEach(tile => {
    tile.addEventListener("click", () => {
      const itemId = tile.dataset.scanId;
      if (selected.has(itemId)) selected.delete(itemId);
      else selected.add(itemId);
      syncSelection();
    });
  });

  selectAll?.addEventListener("click", () => {
    if (selected.size === tiles.length) selected.clear();
    else tiles.forEach(tile => selected.add(tile.dataset.scanId));
    syncSelection();
  });

  document.querySelector("#scan-curate-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!selected.size) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const message = document.querySelector("#scan-curate-message");
    curateSubmit.disabled = true;
    curateSubmit.textContent = "Creating Memory…";
    message.innerHTML = "";

    try {
      const result = await api("/scans/" + encodeURIComponent(id) + "/curate", {
        method: "POST",
        body: JSON.stringify({
          itemIds: Array.from(selected),
          title: data.get("title"),
          monthYear: data.get("monthYear"),
          locality: data.get("locality"),
          region: data.get("region"),
          country: data.get("country"),
          people: data.get("people"),
          story: data.get("story")
        })
      });
      location.hash = "#/memories/" + result.memoryId;
    } catch (error) {
      message.innerHTML = '<div class="error">' + escapeHtml(error.message || "Could not curate these scans.") + '</div>';
      curateSubmit.disabled = false;
      curateSubmit.textContent = "Curate selected scans into a Memory";
    }
  });
}

async function renderAccount() {
  shell(`
    <section class="hero account-hero">
      <p class="eyebrow">YOUR FAMILY ACCOUNT</p>
      <h1>${escapeHtml(currentUser.displayName)}</h1>
      <p>${escapeHtml(currentUser.email)} · ${escapeHtml(currentUser.role)}</p>
    </section>

    <section class="account-panel">
      <h2>Change your password</h2>
      <p>Use a password you do not reuse on another website. Changing it signs out your other family-archive sessions.</p>

      <form id="account-password-form" class="account-form">
        <label>
          Current password
          <input name="currentPassword" type="password" autocomplete="current-password" required />
        </label>
        <label>
          New password
          <input name="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="200" required />
        </label>
        <label>
          Confirm new password
          <input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="200" required />
        </label>
        <div id="account-password-message"></div>
        <button class="button button-primary">Change password</button>
      </form>
    </section>
  `, "account");

  document.querySelector("#account-password-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = document.querySelector("#account-password-message");
    const button = form.querySelector("button");
    const next = String(data.get("newPassword") || "");
    const confirm = String(data.get("confirmPassword") || "");

    message.innerHTML = "";

    if (next !== confirm) {
      message.innerHTML = '<div class="error">New passwords do not match.</div>';
      return;
    }

    button.disabled = true;
    button.textContent = "Changing…";

    try {
      await api("/account/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: data.get("currentPassword"),
          newPassword: next
        })
      });

      form.reset();
      message.innerHTML = '<div class="success">Password updated. Other sessions were signed out.</div>';
    } catch (error) {
      message.innerHTML = '<div class="error">' + escapeHtml(error.message || "Could not change password.") + '</div>';
    } finally {
      button.disabled = false;
      button.textContent = "Change password";
    }
  });
}

async function renderFamilyAccess() {
  if (currentUser?.role !== "admin") {
    location.hash = "#/memories";
    return;
  }

  shell('<div class="loading">Opening family access…</div>', "family-access");
  const { users } = await api("/admin/users");

  shell(`
    <section class="hero">
      <p class="eyebrow">FAMILY ACCESS</p>
      <h1>Family accounts</h1>
      <p>Create private accounts for relatives and reset a password when someone gets locked out.</p>
    </section>

    <section class="family-access-layout">
      <form id="create-family-user-form" class="account-panel family-user-create">
        <h2>Create family account</h2>
        <div class="field-grid">
          <label>
            Name
            <input name="displayName" required maxlength="120" />
          </label>
          <label>
            Email
            <input name="email" type="email" required maxlength="254" />
          </label>
          <label>
            Temporary password
            <input name="password" type="password" required minlength="12" maxlength="200" autocomplete="new-password" />
          </label>
          <label>
            Role
            <select name="role">
              <option value="family">Family — view and contribute</option>
              <option value="curator">Curator — review memories</option>
              <option value="viewer">Viewer — browse only</option>
            </select>
          </label>
        </div>
        <div id="create-family-user-message"></div>
        <button class="button button-primary">Create family account</button>
      </form>

      <section class="family-user-list">
        ${users.map(user => `
          <article class="family-user-row">
            <div class="family-user-identity">
              <strong>${escapeHtml(user.displayName)}</strong>
              <span>${escapeHtml(user.email)}</span>
              <small>${escapeHtml(user.role)}${user.active ? "" : " · inactive"}</small>
            </div>

            ${user.id !== currentUser.id ? `
              <form class="family-reset-form" data-user-id="${user.id}">
                <label>
                  New temporary password
                  <input name="newPassword" type="password" minlength="12" maxlength="200" autocomplete="new-password" required ${user.active ? "" : "disabled"} />
                </label>
                <button class="button button-secondary" ${user.active ? "" : "disabled"}>Reset password</button>
                <div class="family-reset-message"></div>
              </form>
            ` : '<span class="current-account-note">Your account · change password under Account</span>'}
          </article>
        `).join("")}
      </section>
    </section>
  `, "family-access");

  document.querySelector("#create-family-user-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = document.querySelector("#create-family-user-message");
    const button = form.querySelector("button");
    message.innerHTML = "";
    button.disabled = true;
    button.textContent = "Creating…";

    try {
      await api("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          displayName: data.get("displayName"),
          email: data.get("email"),
          password: data.get("password"),
          role: data.get("role")
        })
      });

      await renderFamilyAccess();
    } catch (error) {
      message.innerHTML = '<div class="error">' + escapeHtml(error.message || "Could not create family account.") + '</div>';
      button.disabled = false;
      button.textContent = "Create family account";
    }
  });

  document.querySelectorAll(".family-reset-form").forEach(form => {
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const userId = form.dataset.userId;
      const data = new FormData(form);
      const message = form.querySelector(".family-reset-message");
      const button = form.querySelector("button");
      message.innerHTML = "";
      button.disabled = true;
      button.textContent = "Resetting…";

      try {
        await api("/admin/users/" + encodeURIComponent(userId) + "/password", {
          method: "POST",
          body: JSON.stringify({
            newPassword: data.get("newPassword")
          })
        });

        form.reset();
        message.innerHTML = '<div class="success">Password reset. Existing sessions for this account were signed out.</div>';
      } catch (error) {
        message.innerHTML = '<div class="error">' + escapeHtml(error.message || "Could not reset password.") + '</div>';
      } finally {
        button.disabled = false;
        button.textContent = "Reset password";
      }
    });
  });
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
    if (section === "timeline") return await renderTimeline();
    if (section === "curate") return await renderCurate();
    if (section === "scans" && parts[1]) return await renderScanBatch(parts[1]);
    if (section === "scans") return await renderScans();
    if (section === "family-access") return await renderFamilyAccess();
    if (section === "account") return await renderAccount();
    if (section === "contribute") return await renderContribute();
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
