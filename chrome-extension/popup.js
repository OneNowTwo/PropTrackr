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

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      func: async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const images = new Set();

        const collectImages = () => {
          document.querySelectorAll("img").forEach((img) => {
            if (img.src && img.src.includes("reastatic")) images.add(img.src);
            if (img.dataset.src && img.dataset.src.includes("reastatic"))
              images.add(img.dataset.src);
          });
          document.querySelectorAll("source").forEach((s) => {
            (s.srcset || "").split(",").forEach((p) => {
              const u = p.trim().split(" ")[0];
              if (u && u.includes("reastatic")) images.add(u);
            });
          });
        };

        collectImages();

        const gallerySelectors = [
          '[data-testid="listing-details__gallery-image"]',
          '[class*="gallery"] img',
          ".details__hero img",
          '[class*="hero"] img',
          'img[src*="reastatic"]',
        ];

        let opened = false;
        for (const sel of gallerySelectors) {
          const el = document.querySelector(sel);
          if (el) {
            el.click();
            opened = true;
            break;
          }
        }

        if (opened) {
          await sleep(2000);
          collectImages();

          for (let i = 0; i < 20; i++) {
            const nextSelectors = [
              '[aria-label="Next photo"]',
              '[aria-label="Next"]',
              'button[aria-label*="next" i]',
              '[class*="next" i] button',
              'button[class*="Next"]',
              '[data-testid*="next" i]',
            ];

            let clicked = false;
            for (const sel of nextSelectors) {
              const btn = document.querySelector(sel);
              if (btn) {
                btn.click();
                clicked = true;
                break;
              }
            }

            await sleep(500);
            collectImages();
            if (!clicked) break;
          }

          const closeSelectors = [
            '[aria-label="Close gallery"]',
            '[aria-label="Close"]',
            'button[class*="close" i]',
            '[data-testid*="close" i]',
          ];
          for (const sel of closeSelectors) {
            const btn = document.querySelector(sel);
            if (btn) {
              btn.click();
              break;
            }
          }
          await sleep(500);
        }

        const agents = [];
        document.querySelectorAll("li.agent-info__agent").forEach((el) => {
          const name = el
            .querySelector("a.agent-info__name")
            ?.textContent?.trim();
          let phone = el.querySelector(".phone")?.textContent?.trim();
          if (phone) phone = phone.replace(/^Call/i, "").trim();
          const photo = el.querySelector("img")?.src;
          if (name && name.length > 2) {
            agents.push({
              name,
              phone: phone || null,
              photo: photo || null,
            });
          }
        });

        return {
          html: document.documentElement.outerHTML,
          images: [...images].slice(0, 40),
          agents: agents.slice(0, 3),
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
