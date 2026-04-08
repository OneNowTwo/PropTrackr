const API_ORIGIN = "https://proptrackr.onrender.com";
const SAVE_URL = `${API_ORIGIN}/api/extension/save`;
const SIGN_IN_URL = `${API_ORIGIN}/sign-in`;

const pageUrlEl = document.getElementById("pageUrl");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");

let currentTabUrl = "";
let currentTabId = null;

function setStatus(html, className) {
  statusEl.className = "status" + (className ? " " + className : "");
  statusEl.innerHTML = html;
}

function showLoginMessage() {
  setStatus(
    `Please log in to PropTrackr first — <a href="${SIGN_IN_URL}" target="_blank" rel="noopener noreferrer">sign in</a>`,
    "error",
  );
}

function storageLocalGet(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (obj) => resolve(obj));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const url = tab?.url?.trim() || "";
    currentTabUrl = url;
    currentTabId = tab?.id ?? null;
    if (!url) {
      pageUrlEl.textContent = "Could not read this tab’s URL.";
      saveBtn.disabled = true;
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      pageUrlEl.textContent = url;
      saveBtn.disabled = true;
      setStatus("Open a normal web listing page (http or https).", "error");
      return;
    }
    pageUrlEl.textContent = url;
  });
});

saveBtn.addEventListener("click", async () => {
  if (!currentTabUrl || !/^https?:\/\//i.test(currentTabUrl)) return;
  if (currentTabId == null) {
    setStatus("Could not access this tab.", "error");
    return;
  }

  saveBtn.disabled = true;
  setStatus("Reading page…", "loading");

  let html = "";
  let agents = [];
  let images = [];

  const storageKey = currentTabUrl;
  let storedEntry = null;
  try {
    const stored = await storageLocalGet(storageKey);
    storedEntry = stored[storageKey];
  } catch (_) {
    storedEntry = null;
  }

  const hasStoredImages =
    storedEntry &&
    typeof storedEntry === "object" &&
    Array.isArray(storedEntry.images) &&
    storedEntry.images.length > 0;

  try {
    if (hasStoredImages) {
      images = storedEntry.images;
      agents = Array.isArray(storedEntry.agents) ? storedEntry.agents : [];
      const results = await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        func: () => document.documentElement.outerHTML,
      });
      html = String(results[0]?.result ?? "");
    } else {
      const results = await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        func: async () => {
          const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

          function normalizeImgUrl(s) {
            const t = String(s ?? "").trim();
            if (!t) return "";
            if (t.startsWith("//")) return `https:${t}`;
            return t;
          }

          function pushReastaticUrl(images, raw) {
            const u = normalizeImgUrl(raw);
            if (!u || !u.includes("reastatic")) return;
            if (!/^https?:\/\//i.test(u)) return;
            if (!images.includes(u)) images.push(u);
          }

          function walkForReastaticUrls(obj, images, seen, depth) {
            if (depth > 28 || images.length > 120) return;
            if (obj == null) return;
            const t = typeof obj;
            if (t === "string") {
              if (obj.includes("reastatic")) pushReastaticUrl(images, obj);
              return;
            }
            if (t !== "object") return;
            if (seen.has(obj)) return;
            seen.add(obj);
            if (Array.isArray(obj)) {
              for (let i = 0; i < obj.length; i++) {
                walkForReastaticUrls(obj[i], images, seen, depth + 1);
              }
              return;
            }
            const keys = Object.keys(obj);
            for (let i = 0; i < keys.length; i++) {
              walkForReastaticUrls(obj[keys[i]], images, seen, depth + 1);
            }
          }

          function collectDomReastaticImages(images) {
            document
              .querySelectorAll(
                '[data-src*="reastatic"], [data-lazy*="reastatic"]',
              )
              .forEach((el) => {
                const ds = el.dataset && el.dataset.src;
                const dl = el.dataset && el.dataset.lazy;
                pushReastaticUrl(images, ds || dl);
              });

            document
              .querySelectorAll(
                'img[src*="reastatic"], img[data-src*="reastatic"]',
              )
              .forEach((img) => {
                const src = img.src || img.dataset.src;
                pushReastaticUrl(images, src);
              });

            document
              .querySelectorAll('source[srcset*="reastatic"]')
              .forEach((source) => {
                const urls = source.srcset
                  .split(",")
                  .map((s) => s.trim().split(" ")[0]);
                urls.forEach((url) => pushReastaticUrl(images, url));
              });
          }

          const images = [];

          try {
            const nextData = window.__NEXT_DATA__;
            if (nextData && typeof nextData === "object") {
              const pp = nextData.props && nextData.props.pageProps;
              if (pp && typeof pp === "object") {
                const listing = pp.listing || pp.property;
                if (listing && typeof listing === "object" && Array.isArray(listing.media)) {
                  listing.media.forEach((m) => {
                    if (!m || typeof m !== "object") return;
                    pushReastaticUrl(images, m.url || m.href || m.src);
                  });
                }
                walkForReastaticUrls(pp, images, new WeakSet(), 0);
              }
            }
          } catch (_) {
            /* ignore */
          }

          try {
            if (typeof window.argonaut !== "undefined" && window.argonaut != null) {
              walkForReastaticUrls(window.argonaut, images, new WeakSet(), 0);
            }
          } catch (_) {
            /* ignore */
          }

          collectDomReastaticImages(images);

          if (images.length < 5) {
            const galleryBtn = document.querySelector(
              '[data-testid="listing-details__gallery-image"], [class*="gallery"] img, .details__hero img',
            );
            if (galleryBtn) galleryBtn.click();
            await sleep(1000);
            collectDomReastaticImages(images);
            for (let i = 0; i < 15; i++) {
              const nextBtn = document.querySelector(
                '[aria-label="Next"], [class*="next"], [class*="Next"], button[class*="arrow"]:last-of-type',
              );
              if (nextBtn) nextBtn.click();
              await sleep(300);
              collectDomReastaticImages(images);
            }
            const closeBtn = document.querySelector(
              '[aria-label="Close"], [class*="close"]',
            );
            if (closeBtn) closeBtn.click();
          }

          const agents = [];

          document.querySelectorAll("li.agent-info__agent").forEach((el) => {
            const nameEl = el.querySelector("a.agent-info__name");
            const name = nameEl?.textContent?.trim();

            const phoneEl = el.querySelector(".phone");
            let phone = phoneEl?.textContent?.trim();
            if (phone) phone = phone.replace(/^Call/i, "").trim();

            const photoEl = el.querySelector("img");
            const photo = photoEl?.src;

            if (name && name.length > 2) {
              agents.push({
                name,
                phone: phone || null,
                photo: photo || null,
              });
            }
          });

          if (agents.length === 0) {
            const panel = document.querySelector(".contact-agent-panel");
            if (panel) {
              panel.querySelectorAll("li").forEach((li) => {
                const name = li
                  .querySelector('a[class*="name"]')
                  ?.textContent?.trim();
                let phone = li.querySelector(".phone")?.textContent?.trim();
                if (phone) phone = phone.replace(/^Call/i, "").trim();
                const photo = li.querySelector("img")?.src;
                if (name) agents.push({ name, phone, photo });
              });
            }
          }

          const html = document.documentElement.outerHTML;

          return {
            html,
            agents: agents.slice(0, 3),
            images: images.slice(0, 40),
          };
        },
      });
      const payload = results[0]?.result;
      if (payload && typeof payload === "object" && "html" in payload) {
        html = String(payload.html ?? "");
        agents = Array.isArray(payload.agents) ? payload.agents : [];
        images = Array.isArray(payload.images) ? payload.images : [];
      } else {
        html = typeof payload === "string" ? payload : "";
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not read page HTML.";
    setStatus(msg, "error");
    saveBtn.disabled = false;
    return;
  }

  if (!html || String(html).trim().length < 50) {
    setStatus("Page HTML was empty. Reload the listing and try again.", "error");
    saveBtn.disabled = false;
    return;
  }

  setStatus("Saving…", "loading");

  try {
    const res = await fetch(SAVE_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentTabUrl, html, agents, images }),
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (res.status === 401) {
      showLoginMessage();
      return;
    }

    if (!res.ok || !data || data.ok !== true) {
      const msg =
        (data && typeof data.error === "string" && data.error) ||
        `Something went wrong (${res.status}).`;
      setStatus(msg, "error");
      return;
    }

    const id = data.propertyId;
    const address =
      typeof data.address === "string" && data.address
        ? data.address
        : "Saved";
    const viewUrl = `${API_ORIGIN}/properties/${encodeURIComponent(id)}`;
    setStatus(
      `Saved! <strong>${escapeHtml(address)}</strong><br /><a href="${viewUrl}" target="_blank" rel="noopener noreferrer">View in PropTrackr →</a>`,
      "success",
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error.";
    setStatus(msg, "error");
  } finally {
    saveBtn.disabled = false;
  }
});

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
