const API_ROOT = "https://raps-supabase.asuscomm.com/family-api";
const API = API_ROOT + "/api/client";
const TOKEN_KEY = "jgf_pages_token";

const app = document.querySelector("#app");
let currentUser = null;
let memoriesCache = null;
let assetsCache = { mediaTickets: {}, recollectionTickets: {}, scanTickets: {}, trashTickets: {} };
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

async function refreshTickets(mediaIds = [], recollectionIds = [], scanIds = [], trashIds = []) {
  if (!mediaIds.length && !recollectionIds.length && !scanIds.length && !trashIds.length) return assetsCache;

  const result = await api("/assets", {
    method: "POST",
    body: JSON.stringify({ mediaIds, recollectionIds, scanIds, trashIds })
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
    },
    trashTickets: {
      ...assetsCache.trashTickets,
      ...(result.trashTickets || {})
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

function trashUrl(id) {
  const ticket = assetsCache.trashTickets[id];
  return ticket
    ? API_ROOT + "/api/media/" + encodeURIComponent(id) + "?ticket=" + encodeURIComponent(ticket)
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
    nav.push(["trash", "Trash"]);
    nav.push(["archive-health", "Archive Health"]);
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
  assetsCache = { mediaTickets: {}, recollectionTickets: {}, scanTickets: {}, trashTickets: {} };
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

  const recollectionForm = currentUser?.role !== "viewer"
    ? `
      <form id="recollection-form" class="recollection-form">
        <div class="recollection-form-heading">
          <p class="eyebrow">ADD YOUR PERSPECTIVE</p>
          <h3>I remember this…</h3>
          <p>Tell the part you remember. Your version can be different from someone else's—that is part of preserving family history.</p>
        </div>

        <label>
          What do you remember?
          <textarea name="story" rows="5" maxlength="8000" placeholder="I was seven and cried because I thought Santa forgot my present..."></textarea>
        </label>

        <label>
          About how old were you? <span class="optional">(optional)</span>
          <input name="ageAtMemory" maxlength="80" placeholder="7 years old, a teenager, about 20..." />
        </label>

        <div class="recollection-voice">
          <button type="button" id="recollection-voice-button" class="button button-secondary">● Record this recollection</button>
          <div id="recollection-voice-preview"></div>
        </div>

        <div id="recollection-message"></div>
        <button id="recollection-submit" class="button button-primary">Share what I remember</button>
      </form>
    `
    : "";

  shell(`
    <div class="detail-toolbar">
      <a href="#/memories">← Back to Memories</a>
      ${currentUser?.role === "admin" || currentUser?.role === "curator"
        ? `<a class="button button-secondary" href="#/memories/${id}/edit">Edit & enrich</a>`
        : ""}
    </div>
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
      ${recollectionForm}
    </section>
  `, "memories");

  const form = document.querySelector("#recollection-form");
  if (!form) return;

  const voiceButton = document.querySelector("#recollection-voice-button");
  const voicePreview = document.querySelector("#recollection-voice-preview");
  const submitButton = document.querySelector("#recollection-submit");
  const message = document.querySelector("#recollection-message");

  let recorder = null;
  let stream = null;
  let chunks = [];
  let voiceBlob = null;
  let voiceUrlValue = null;

  voiceButton?.addEventListener("click", async () => {
    if (recorder && recorder.state === "recording") {
      recorder.stop();
      voiceButton.textContent = "● Record this recollection";
      submitButton.disabled = false;
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      chunks = [];

      recorder.addEventListener("dataavailable", event => {
        if (event.data.size > 0) chunks.push(event.data);
      });

      recorder.addEventListener("stop", () => {
        voiceBlob = new Blob(chunks, {
          type: recorder.mimeType || "audio/webm"
        });

        stream?.getTracks().forEach(track => track.stop());
        stream = null;

        if (voiceUrlValue) URL.revokeObjectURL(voiceUrlValue);
        voiceUrlValue = URL.createObjectURL(voiceBlob);

        voicePreview.innerHTML = `
          <div class="voice-upload-preview">
            <strong>Voice recollection ready</strong>
            <audio src="${voiceUrlValue}" controls preload="metadata"></audio>
            <button type="button" id="remove-recollection-voice" class="text-button">Remove recording</button>
          </div>
        `;

        document.querySelector("#remove-recollection-voice")?.addEventListener("click", () => {
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
    const data = new FormData(form);
    const story = String(data.get("story") || "").trim();

    if (!story && !voiceBlob) {
      message.innerHTML = '<div class="error">Write what you remember or record your recollection.</div>';
      return;
    }

    if (voiceBlob) {
      data.append(
        "voice",
        new File([voiceBlob], "family-recollection.webm", {
          type: voiceBlob.type || "audio/webm"
        })
      );
    }

    submitButton.disabled = true;
    submitButton.textContent = "Saving recollection…";
    message.innerHTML = "";

    try {
      await api("/memories/" + encodeURIComponent(id) + "/recollections", {
        method: "POST",
        body: data
      });

      form.reset();
      voiceBlob = null;
      if (voiceUrlValue) URL.revokeObjectURL(voiceUrlValue);
      voiceUrlValue = null;
      voicePreview.innerHTML = "";
      message.innerHTML = '<div class="success">Your recollection was saved and is waiting for family review.</div>';
    } catch (error) {
      message.innerHTML = '<div class="error">' + escapeHtml(error.message || "Could not save recollection.") + '</div>';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Share what I remember";
    }
  });
}

async function renderMemoryEdit(id) {
  if (currentUser?.role !== "admin" && currentUser?.role !== "curator") {
    location.hash = "#/memories/" + id;
    return;
  }

  shell('<div class="loading">Opening curator workspace…</div>', "memories");
  const { memory, history } = await api("/edit/memories/" + encodeURIComponent(id));
  await refreshTickets(memory.media.map(item => item.id), []);

  const monthYear = memory.memoryYear && memory.memoryMonth
    ? String(memory.memoryYear).padStart(4, "0") + "-" + String(memory.memoryMonth).padStart(2, "0")
    : "";

  shell(`
    <div class="detail-toolbar">
      <a href="#/memories/${memory.id}">← Back to Memory</a>
    </div>

    <section class="hero edit-hero">
      <p class="eyebrow">CURATOR WORKSPACE</p>
      <h1>Edit & enrich</h1>
      <p>Improve <strong>${escapeHtml(memory.title)}</strong> as the family learns more. Originals remain preserved even when visible media is archived.</p>
    </section>

    <form id="memory-edit-form" class="editor-panel">
      <label>Memory title<input name="title" required maxlength="180" value="${escapeHtml(memory.title)}" /></label>
      <label>Main story<textarea name="story" rows="8" maxlength="12000">${escapeHtml(memory.story || "")}</textarea></label>

      <div class="field-grid">
        <label>Month / year<input name="monthYear" type="month" min="1000-01" max="2200-12" value="${escapeHtml(monthYear)}" /></label>
        <label>City / town<input name="locality" maxlength="120" value="${escapeHtml(memory.locality || "")}" /></label>
        <label>State / province / region<input name="region" maxlength="120" value="${escapeHtml(memory.region || "")}" /></label>
        <label>Country<input name="country" maxlength="120" value="${escapeHtml(memory.country || "")}" /></label>
      </div>

      <label>People in this Memory<input name="people" maxlength="1000" value="${escapeHtml(memory.people.map(person => person.displayName).join(", "))}" /></label>
      <label>Add more photos, video, or audio<input name="media" type="file" multiple accept="image/*,video/*,audio/*,.heic,.heif,.avif" /></label>
      <label>Change summary<input name="changeSummary" maxlength="240" placeholder="Identified Aunt Maria and corrected the date" /></label>
      <div id="memory-edit-message"></div>
      <button class="button button-primary">Save Memory changes</button>
    </form>

    ${memory.media.length ? `
      <section class="editor-section">
        <div class="editor-section-heading">
          <p class="eyebrow">MEDIA DETAILS</p>
          <h2>Captions, order & cover</h2>
        </div>
        <div class="media-editor-grid">
          ${memory.media.map((item, index) => {
            const src = mediaUrl(item.id);
            return `
              <form class="media-editor-card" data-media-id="${item.id}">
                <div class="media-editor-preview">
                  ${item.kind === "photo"
                    ? `<img src="${src}" alt="${escapeHtml(item.caption || item.originalFilename)}" />`
                    : item.kind === "video"
                      ? `<video src="${src}" controls preload="metadata"></video>`
                      : `<audio src="${src}" controls preload="metadata"></audio>`
                  }
                </div>
                <label>Caption<textarea name="caption" rows="3" maxlength="1000">${escapeHtml(item.caption || "")}</textarea></label>
                <label>Display order<input name="sortOrder" type="number" min="0" max="999" value="${Number.isFinite(item.sortOrder) ? item.sortOrder : index}" /></label>
                ${item.kind === "photo" ? `
                  <label class="cover-checkbox">
                    <input name="makeCover" type="checkbox" ${item.id === memory.coverMediaId ? "checked" : ""} />
                    Use as cover photo
                  </label>
                ` : ""}
                <div class="media-editor-actions">
                  <button class="button button-secondary" type="submit">Save media details</button>
                  <button class="button danger-button" type="button" data-archive-media="${item.id}">Remove from Memory</button>
                  ${currentUser?.role === "admin"
                    ? `<button class="button trash-button" type="button" data-trash-media="${item.id}">Move to Trash</button>`
                    : ""}
                </div>
                <div class="media-editor-message"></div>
              </form>
            `;
          }).join("")}
        </div>
      </section>
    ` : ""}

    <section class="editor-section">
      <div class="editor-section-heading">
        <p class="eyebrow">EDIT HISTORY</p>
        <h2>How this Memory changed</h2>
      </div>
      ${history.length ? `
        <div class="history-list">
          ${history.map(item => `
            <div class="history-row">
              <div><strong>${escapeHtml(item.summary)}</strong><span>by ${escapeHtml(item.changedBy)}</span></div>
              <time>${escapeHtml(new Date(item.createdAt).toLocaleString())}</time>
            </div>
          `).join("")}
        </div>
      ` : '<p class="meta">No curator edits have been recorded yet.</p>'}
    </section>
  `, "memories");

  document.querySelector("#memory-edit-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = document.querySelector("#memory-edit-message");
    const button = form.querySelector("button");
    button.disabled = true;
    button.textContent = "Saving changes…";
    message.innerHTML = "";

    try {
      await api("/edit/memories/" + encodeURIComponent(id), {
        method: "PUT",
        body: data
      });
      message.innerHTML = '<div class="success">Memory updated.</div>';
      await renderMemoryEdit(id);
    } catch (error) {
      message.innerHTML = '<div class="error">' + escapeHtml(error.message || "Could not update Memory.") + '</div>';
      button.disabled = false;
      button.textContent = "Save Memory changes";
    }
  });

  document.querySelectorAll(".media-editor-card").forEach(form => {
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const mediaId = form.dataset.mediaId;
      const data = new FormData(form);
      const message = form.querySelector(".media-editor-message");
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = "Saving…";
      message.innerHTML = "";

      try {
        await api("/edit/memories/" + encodeURIComponent(id) + "/media/" + encodeURIComponent(mediaId), {
          method: "PUT",
          body: JSON.stringify({
            caption: data.get("caption"),
            sortOrder: data.get("sortOrder"),
            makeCover: data.get("makeCover") === "on"
          })
        });
        message.innerHTML = '<div class="success">Media updated.</div>';
        await renderMemoryEdit(id);
      } catch (error) {
        message.innerHTML = '<div class="error">' + escapeHtml(error.message || "Could not update media.") + '</div>';
        button.disabled = false;
        button.textContent = "Save media details";
      }
    });
  });

  document.querySelectorAll("[data-archive-media]").forEach(button => {
    button.addEventListener("click", async () => {
      const mediaId = button.dataset.archiveMedia;
      if (!window.confirm("Remove this media from the visible Memory? The original file will remain preserved.")) return;
      button.disabled = true;

      try {
        await api("/edit/memories/" + encodeURIComponent(id) + "/media/" + encodeURIComponent(mediaId), {
          method: "DELETE"
        });
        await renderMemoryEdit(id);
      } catch (error) {
        window.alert(error.message || "Could not remove media from the Memory.");
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-trash-media]").forEach(button => {
    button.addEventListener("click", async () => {
      const mediaId = button.dataset.trashMedia;
      if (!window.confirm("Move this media to Trash? It will disappear from normal browsing but can still be restored by an admin.")) return;
      button.disabled = true;

      try {
        await api("/edit/memories/" + encodeURIComponent(id) + "/media/" + encodeURIComponent(mediaId) + "/trash", {
          method: "POST"
        });
        await renderMemoryEdit(id);
      } catch (error) {
        window.alert(error.message || "Could not move media to Trash.");
        button.disabled = false;
      }
    });
  });
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
    <div class="detail-toolbar">
      <a href="#/people">← Back to People</a>
      ${currentUser?.role === "admin" || currentUser?.role === "curator"
        ? `<a class="button button-secondary" href="#/people/${id}/edit">Edit & enrich</a>`
        : ""}
    </div>
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

async function renderPersonEdit(id) {
  if (currentUser?.role !== "admin" && currentUser?.role !== "curator") {
    location.hash = "#/people/" + id;
    return;
  }

  shell('<div class="loading">Opening person editor…</div>', "people");
  const { person, otherPeople } = await api("/edit/people/" + encodeURIComponent(id));

  const birthMonthYear = person.birthYear && person.birthMonth
    ? String(person.birthYear).padStart(4, "0") + "-" + String(person.birthMonth).padStart(2, "0")
    : "";
  const deathMonthYear = person.deathYear && person.deathMonth
    ? String(person.deathYear).padStart(4, "0") + "-" + String(person.deathMonth).padStart(2, "0")
    : "";

  shell(`
    <div class="detail-toolbar"><a href="#/people/${person.id}">← Back to profile</a></div>
    <section class="hero edit-hero">
      <p class="eyebrow">CURATOR WORKSPACE</p>
      <h1>Enrich ${escapeHtml(person.displayName)}</h1>
      <p>These private curator controls maintain the family structure. Relationship titles remain hidden from public-facing profiles and the Family Tree.</p>
    </section>

    <form id="person-edit-form" class="editor-panel">
      <label>Display name<input name="displayName" required maxlength="160" value="${escapeHtml(person.displayName)}" /></label>
      <label>Biography / life story<textarea name="biography" rows="7" maxlength="12000">${escapeHtml(person.biography || "")}</textarea></label>
      <div class="field-grid">
        <label>Birth month / year<input name="birthMonthYear" type="month" min="1000-01" max="2200-12" value="${escapeHtml(birthMonthYear)}" /></label>
        <label>Death month / year<input name="deathMonthYear" type="month" min="1000-01" max="2200-12" value="${escapeHtml(deathMonthYear)}" /></label>
      </div>
      <label>Birth place<input name="birthPlace" maxlength="220" value="${escapeHtml(person.birthPlace || "")}" /></label>
      <div id="person-edit-message"></div>
      <button class="button button-primary">Save person profile</button>
    </form>

    <section class="editor-section">
      <div class="editor-section-heading">
        <p class="eyebrow">PRIVATE STRUCTURE</p>
        <h2>Family connections</h2>
        <p>These labels are used only to build the Family Tree and are not shown on the public-facing tree.</p>
      </div>

      ${person.relationships.length ? `
        <div class="private-relations">
          ${person.relationships.map(rel => `
            <div><strong>${escapeHtml(rel.relatedName)}</strong><span>${escapeHtml(rel.label)}</span></div>
          `).join("")}
        </div>
      ` : ""}

      <form id="relationship-form" class="editor-panel compact-editor">
        <div class="field-grid">
          <label>Relative
            <select name="relatedPersonId" required>
              <option value="">Select a person</option>
              ${otherPeople.map(item => `<option value="${item.id}">${escapeHtml(item.displayName)}</option>`).join("")}
            </select>
          </label>
          <label>Relationship
            <select name="label" required>
              <option value="">Select relationship</option>
              <option value="parent">Parent</option>
              <option value="child">Child</option>
              <option value="spouse">Spouse</option>
              <option value="sibling">Sibling</option>
              <option value="grandparent">Grandparent</option>
              <option value="grandchild">Grandchild</option>
              <option value="aunt/uncle">Aunt / Uncle</option>
              <option value="niece/nephew">Niece / Nephew</option>
              <option value="cousin">Cousin</option>
              <option value="other family">Other family</option>
            </select>
          </label>
        </div>
        <div id="relationship-message"></div>
        <button class="button button-secondary">Add relationship</button>
      </form>
    </section>
  `, "people");

  document.querySelector("#person-edit-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = document.querySelector("#person-edit-message");
    const button = form.querySelector("button");
    button.disabled = true;
    button.textContent = "Saving…";
    message.innerHTML = "";

    try {
      await api("/edit/people/" + encodeURIComponent(id), {
        method: "PUT",
        body: JSON.stringify({
          displayName: data.get("displayName"),
          biography: data.get("biography"),
          birthMonthYear: data.get("birthMonthYear"),
          deathMonthYear: data.get("deathMonthYear"),
          birthPlace: data.get("birthPlace")
        })
      });
      message.innerHTML = '<div class="success">Person profile updated.</div>';
      await renderPersonEdit(id);
    } catch (error) {
      message.innerHTML = '<div class="error">' + escapeHtml(error.message || "Could not update person.") + '</div>';
      button.disabled = false;
      button.textContent = "Save person profile";
    }
  });

  document.querySelector("#relationship-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = document.querySelector("#relationship-message");
    const button = form.querySelector("button");
    button.disabled = true;
    button.textContent = "Adding…";
    message.innerHTML = "";

    try {
      await api("/edit/people/" + encodeURIComponent(id) + "/relationships", {
        method: "POST",
        body: JSON.stringify({
          relatedPersonId: data.get("relatedPersonId"),
          label: data.get("label")
        })
      });
      await renderPersonEdit(id);
    } catch (error) {
      message.innerHTML = '<div class="error">' + escapeHtml(error.message || "Could not add relationship.") + '</div>';
      button.disabled = false;
      button.textContent = "Add relationship";
    }
  });
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

function formatHealthBytes(bytes) {
  if (bytes === null || bytes === undefined) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Number(bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return value.toFixed(unit >= 3 ? 1 : 0) + " " + units[unit];
}

function healthDate(value) {
  return value ? new Date(value).toLocaleString() : "Not yet";
}

async function renderArchiveHealth() {
  if (currentUser?.role !== "admin") {
    location.hash = "#/memories";
    return;
  }

  shell('<div class="loading">Checking the family archive…</div>', "archive-health");
  const { health } = await api("/archive-health");

  const state =
    health.integrity.missingFiles > 0 || health.integrity.databaseIssues > 0
      ? "Needs attention"
      : health.integrity.orphanedFiles > 0
        ? "Review recommended"
        : "Healthy";

  const backupFresh =
    health.backups.database.ageHours !== null &&
    health.backups.database.ageHours <= 36;

  shell(`
    <section class="hero archive-health-hero">
      <p class="eyebrow">ARCHIVE HEALTH</p>
      <h1>Keep the family archive trustworthy.</h1>
      <p>Live checks across the database, family media filesystem, backup folder, and nightly integrity report. Nothing is automatically deleted or repaired.</p>
      <div class="health-banner ${state === "Healthy" ? "health-good" : state === "Needs attention" ? "health-bad" : "health-warn"}">
        <strong>${escapeHtml(state)}</strong>
        <span>Checked ${escapeHtml(new Date(health.checkedAt).toLocaleString())}</span>
      </div>
    </section>

    <div class="health-grid">
      <article class="health-card">
        <p class="eyebrow">MEDIA</p>
        <h2>${health.counts.photos.toLocaleString()} photos</h2>
        <div class="health-stat-list">
          <span><strong>${health.counts.videos.toLocaleString()}</strong> videos</span>
          <span><strong>${health.counts.audio.toLocaleString()}</strong> audio files</span>
          <span><strong>${health.counts.voiceRecollections.toLocaleString()}</strong> voice recollections</span>
          <span><strong>${health.counts.trashedMedia.toLocaleString()}</strong> items in Trash</span>
          <span><strong>${health.counts.memories.toLocaleString()}</strong> Memories</span>
          <span><strong>${health.counts.people.toLocaleString()}</strong> people</span>
        </div>
      </article>

      <article class="health-card">
        <p class="eyebrow">CURATION</p>
        <h2>${health.counts.pendingScans.toLocaleString()} scans waiting</h2>
        <div class="health-stat-list">
          <span><strong>${health.counts.pendingMemories}</strong> Memories waiting</span>
          <span><strong>${health.counts.pendingRecollections}</strong> recollections waiting</span>
          <span><strong>${health.counts.approvedMemories}</strong> approved Memories</span>
        </div>
        <a class="text-link" href="#/curate">Open curation queue →</a>
      </article>

      <article class="health-card">
        <p class="eyebrow">STORAGE</p>
        <h2>${formatHealthBytes(health.storage.archiveBytes)} family media</h2>
        <div class="health-stat-list">
          <span><strong>${formatHealthBytes(health.storage.availableBytes)}</strong> available</span>
          <span><strong>${formatHealthBytes(health.storage.usedBytes)}</strong> disk used</span>
          <span><strong>${formatHealthBytes(health.storage.totalBytes)}</strong> disk capacity</span>
        </div>
      </article>

      <article class="health-card">
        <p class="eyebrow">INTEGRITY</p>
        <h2>${health.integrity.missingFiles === 0 && health.integrity.databaseIssues === 0 ? "Core checks passed" : "Review required"}</h2>
        <div class="health-stat-list">
          <span><strong>${health.integrity.missingFiles}</strong> missing referenced files</span>
          <span><strong>${health.integrity.orphanedFiles}</strong> orphaned upload files</span>
          <span><strong>${health.integrity.databaseIssues}</strong> database consistency issues</span>
          <span><strong>${health.integrity.referencedFiles}</strong> referenced file paths checked</span>
        </div>
      </article>

      <article class="health-card health-card-wide">
        <p class="eyebrow">BACKUPS</p>
        <h2>Database backup: ${backupFresh ? "Current" : "Needs setup or refresh"}</h2>
        <div class="backup-status-grid">
          <div>
            <span>Latest database backup</span>
            <strong>${escapeHtml(healthDate(health.backups.database.latestAt))}</strong>
            <small>${escapeHtml(health.backups.database.latestFilename || "No verified .dump file found")}${health.backups.database.latestBytes !== null ? " · " + formatHealthBytes(health.backups.database.latestBytes) : ""}</small>
          </div>
          <div>
            <span>Scheduled integrity scan</span>
            <strong>${escapeHtml(healthDate(health.integrity.lastScheduledScan?.checkedAt || null))}</strong>
            <small>${health.integrity.lastScheduledScan
              ? health.integrity.lastScheduledScan.missingFiles + " missing · " + health.integrity.lastScheduledScan.orphanedFiles + " orphaned · " + health.integrity.lastScheduledScan.databaseIssues + " DB issues"
              : "No scheduled report has run yet"}</small>
          </div>
          <div>
            <span>Full media backup</span>
            <strong>Not configured</strong>
            <small>A second physical destination is still required.</small>
          </div>
        </div>
      </article>
    </div>

    ${health.integrity.missingSamples.length || health.integrity.orphanedSamples.length ? `
      <section class="health-details">
        <p class="eyebrow">DETAILS</p>
        <h2>Items to review</h2>
        ${health.integrity.missingSamples.length ? `
          <div>
            <h3>Missing referenced files</h3>
            <code>${escapeHtml(health.integrity.missingSamples.join("\n"))}</code>
          </div>
        ` : ""}
        ${health.integrity.orphanedSamples.length ? `
          <div>
            <h3>Orphaned upload files</h3>
            <p>These files exist under the managed upload folder but are not referenced by current archive metadata. Nothing is deleted automatically.</p>
            <code>${escapeHtml(health.integrity.orphanedSamples.join("\n"))}</code>
          </div>
        ` : ""}
      </section>
    ` : ""}
  `, "archive-health");
}

async function renderTrash() {
  if (currentUser?.role !== "admin") {
    location.hash = "#/memories";
    return;
  }

  shell('<div class="loading">Opening Trash…</div>', "trash");
  const { items } = await api("/trash");
  await refreshTickets([], [], [], items.map(item => item.id));

  shell(`
    <section class="hero">
      <p class="eyebrow">ADMIN TRASH</p>
      <h1>Deleted family media</h1>
      <p>Items here are hidden from normal family browsing. Restore them if needed, or permanently delete them when you are certain the file should leave the archive.</p>
    </section>

    ${items.length ? `
      <div class="trash-grid">
        ${items.map(item => {
          const src = trashUrl(item.id);
          return `
            <article class="trash-card" data-trash-card="${item.id}">
              <div class="trash-preview">
                ${item.kind === "photo"
                  ? `<img src="${src}" alt="${escapeHtml(item.caption || item.originalFilename)}" loading="lazy" />`
                  : item.kind === "video"
                    ? `<video src="${src}" controls preload="metadata"></video>`
                    : `<audio src="${src}" controls preload="metadata"></audio>`
                }
              </div>
              <div class="trash-copy">
                <p class="eyebrow">${escapeHtml(item.memoryTitle)}</p>
                <h2>${escapeHtml(item.caption || item.originalFilename)}</h2>
                <p class="meta">Moved to Trash ${escapeHtml(new Date(item.trashedAt).toLocaleString())}${item.trashedBy ? " by " + escapeHtml(item.trashedBy) : ""}</p>
                <div class="trash-actions">
                  <button class="button button-secondary" data-restore-trash="${item.id}">Restore</button>
                  <button class="button danger-button" data-delete-trash="${item.id}" data-filename="${escapeHtml(item.originalFilename)}">Delete permanently</button>
                </div>
                <div class="trash-message"></div>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    ` : '<div class="empty">Trash is empty.</div>'}
  `, "trash");

  document.querySelectorAll("[data-restore-trash]").forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.restoreTrash;
      const card = button.closest(".trash-card");
      const message = card.querySelector(".trash-message");
      button.disabled = true;

      try {
        await api("/trash/" + encodeURIComponent(id) + "/restore", {
          method: "POST"
        });
        await renderTrash();
      } catch (error) {
        message.innerHTML = '<div class="error">' + escapeHtml(error.message || "Could not restore this item.") + '</div>';
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-delete-trash]").forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.deleteTrash;
      const filename = button.dataset.filename || "this file";
      const card = button.closest(".trash-card");
      const message = card.querySelector(".trash-message");

      const confirmation = window.prompt(
        "Permanent deletion cannot be undone. Type DELETE to permanently remove " + filename
      );

      if (confirmation !== "DELETE") return;

      button.disabled = true;
      message.innerHTML = "";

      try {
        const result = await api("/trash/" + encodeURIComponent(id), {
          method: "DELETE"
        });

        if (result.fileCleanupWarning) {
          window.alert("The archive record was deleted, but a leftover file may need cleanup during Archive Health.");
        }

        await renderTrash();
      } catch (error) {
        message.innerHTML = '<div class="error">' + escapeHtml(error.message || "Could not permanently delete this item.") + '</div>';
        button.disabled = false;
      }
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
    if (section === "memories" && parts[1] && parts[2] === "edit") return await renderMemoryEdit(parts[1]);
    if (section === "memories" && parts[1]) return await renderMemory(parts[1]);
    if (section === "timeline") return await renderTimeline();
    if (section === "curate") return await renderCurate();
    if (section === "archive-health") return await renderArchiveHealth();
    if (section === "trash") return await renderTrash();
    if (section === "scans" && parts[1]) return await renderScanBatch(parts[1]);
    if (section === "scans") return await renderScans();
    if (section === "family-access") return await renderFamilyAccess();
    if (section === "account") return await renderAccount();
    if (section === "contribute") return await renderContribute();
    if (section === "people" && parts[1] && parts[2] === "edit") return await renderPersonEdit(parts[1]);
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
