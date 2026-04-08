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
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      func: () => {
        const htmlInner = document.documentElement.outerHTML;
        const agentsInner = [];

        document
          .querySelectorAll(
            '[data-testid="agent-details"], .agent-details, [class*="agentDetails"]',
          )
          .forEach((el) => {
            const name = el
              .querySelector(
                '[class*="agentName"], [data-testid="agent-name"]',
              )
              ?.textContent?.trim();
            const phone = el
              .querySelector('[class*="phone"], [data-testid="phone"]')
              ?.textContent?.trim();
            const photo = el.querySelector(
              'img[class*="profilePhoto"], img[class*="agentPhoto"], img[class*="profile"]',
            )?.src;
            if (name) agentsInner.push({ name, phone, photo });
          });

        document
          .querySelectorAll(
            '[class*="AgentDetails"], [class*="agent-card"]',
          )
          .forEach((el) => {
            const name = el
              .querySelector('h3, h4, [class*="name"]')
              ?.textContent?.trim();
            const phone = el
              .querySelector('a[href^="tel:"]')
              ?.textContent?.trim();
            const photo = el.querySelector("img")?.src;
            if (name && name.length > 2 && name.length < 50) {
              agentsInner.push({ name, phone, photo });
            }
          });

        return { html: htmlInner, agents: agentsInner.slice(0, 3) };
      },
    });
    const payload = results[0]?.result;
    if (payload && typeof payload === "object" && "html" in payload) {
      html = String(payload.html ?? "");
      agents = Array.isArray(payload.agents) ? payload.agents : [];
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
      body: JSON.stringify({ url: currentTabUrl, html, agents }),
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
