(function () {
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

  function collectAgentsFromDom() {
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

    return agents.slice(0, 3);
  }

  function mergeNextDataFromScript(images) {
    const el = document.getElementById("__NEXT_DATA__");
    if (!el || !el.textContent) return;
    try {
      const nextData = JSON.parse(el.textContent);
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
    } catch (_) {
      /* ignore */
    }
  }

  async function runCollection() {
    const href = window.location.href;
    const images = [];
    const agents = collectAgentsFromDom();

    mergeNextDataFromScript(images);
    collectDomReastaticImages(images);

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

    const payload = {
      images: images.slice(0, 40),
      agents,
      collectedAt: Date.now(),
    };

    console.log(
      "[PropTrackr content] images collected:",
      images.length,
      images.slice(0, 3),
    );

    await new Promise((resolve) => {
      chrome.storage.local.set({ [href]: payload }, () => {
        if (chrome.runtime.lastError) {
          console.warn(
            "[PropTrackr] storage save failed",
            chrome.runtime.lastError.message,
          );
        }
        console.log(
          "[PropTrackr content] stored to storage for:",
          window.location.href,
        );
        console.log("[PropTrackr content] image count stored:", images.length);
        resolve();
      });
    });
  }

  setTimeout(() => {
    runCollection().catch((err) =>
      console.warn("[PropTrackr] collection failed", err),
    );
  }, 800);
})();
