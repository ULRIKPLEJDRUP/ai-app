(function () {
  const ACTIVE_PROFILE_ID_KEY = "activeProfileId";
  const ACTIVE_PROFILE_LABEL_KEY = "activeProfileLabel";
  const DEFAULT_PROFILE_ID = "default";
  const DEFAULT_PROFILE_LABEL = "Standard";
  const ADMIN_MODE_KEY = "adminMode";

  function ensureActiveProfileId() {
    let id = localStorage.getItem(ACTIVE_PROFILE_ID_KEY);
    if (!id) {
      id = DEFAULT_PROFILE_ID;
      localStorage.setItem(ACTIVE_PROFILE_ID_KEY, id);
    }
    if (!localStorage.getItem(ACTIVE_PROFILE_LABEL_KEY)) {
      localStorage.setItem(ACTIVE_PROFILE_LABEL_KEY, DEFAULT_PROFILE_LABEL);
    }
    return id;
  }

  function getStoredProfileId() {
    return localStorage.getItem(ACTIVE_PROFILE_ID_KEY) || DEFAULT_PROFILE_ID;
  }

  function getStoredProfileLabel() {
    return localStorage.getItem(ACTIVE_PROFILE_LABEL_KEY) || DEFAULT_PROFILE_LABEL;
  }

  function setActiveProfileMeta(id, label) {
    const safeId = id || DEFAULT_PROFILE_ID;
    const safeLabel = label && String(label).trim() ? String(label).trim() : DEFAULT_PROFILE_LABEL;
    localStorage.setItem(ACTIVE_PROFILE_ID_KEY, safeId);
    localStorage.setItem(ACTIVE_PROFILE_LABEL_KEY, safeLabel);
  }

  function updateActiveProfileBadge(doc) {
    const context = doc || document;
    const label = getStoredProfileLabel();
    context.querySelectorAll("[data-active-profile-label]").forEach((el) => {
      el.textContent = label;
    });
  }

  async function syncActiveProfileMeta() {
    const currentId = ensureActiveProfileId();
    try {
      const res = await fetch("/api/profiles");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const profiles = await res.json();
      const match = profiles.find((p) => p.id === currentId);
      if (match) {
        setActiveProfileMeta(match.id, match.label || match.id);
        updateActiveProfileBadge();
        return profiles;
      }
      if (profiles.length) {
        const fallback = profiles[0];
        setActiveProfileMeta(fallback.id, fallback.label || fallback.id);
        updateActiveProfileBadge();
        if (fallback.id !== currentId) {
          window.location.reload();
        }
        return profiles;
      }
      return [];
    } catch {
      updateActiveProfileBadge();
      return [];
    }
  }

  function withProfileParam(url, profileId) {
    const id = profileId || getStoredProfileId();
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}profileId=${encodeURIComponent(id)}`;
  }

  function isAdminMode() {
    return localStorage.getItem(ADMIN_MODE_KEY) === "1";
  }

  function setAdminMode(flag) {
    localStorage.setItem(ADMIN_MODE_KEY, flag ? "1" : "0");
  }

  function toggleAdminMode() {
    setAdminMode(!isAdminMode());
  }

  function updateAdminToggle(doc) {
    const context = doc || document;
    const admin = isAdminMode();
    context.querySelectorAll("[data-admin-toggle]").forEach((btn) => {
      btn.textContent = admin ? "Admin-tilstand: aktiv" : "Admin-tilstand: låst";
    });
  }

  function applyAdminState(doc) {
    const context = doc || document;
    const admin = isAdminMode();
    if (context.body) {
      context.body.classList.toggle("admin-mode", admin);
      context.body.classList.toggle("admin-locked", !admin);
    }
    updateAdminToggle(context);
    context.querySelectorAll("[data-admin-only]").forEach((el) => {
      if ("disabled" in el) {
        el.disabled = !admin;
      } else if ("readOnly" in el) {
        el.readOnly = !admin;
      }
      if (el.tagName === "DETAILS" && !admin) {
        el.open = false;
      }
      el.classList.toggle("admin-disabled", !admin);
    });
  }

  window.AppState = {
    DEFAULT_PROFILE_ID,
    DEFAULT_PROFILE_LABEL,
    ensureActiveProfileId,
    getStoredProfileId,
    getStoredProfileLabel,
    setActiveProfileMeta,
    updateActiveProfileBadge,
    syncActiveProfileMeta,
    withProfileParam,
    isAdminMode,
    setAdminMode,
    toggleAdminMode,
    applyAdminState,
  };
})();
