const express = require("express");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const DATA_PATH = path.join(__dirname, "..", "data", "exercises.json");
const EQUIPMENT_PATH = path.join(__dirname, "..", "data", "equipmentCatalog.json");
const PROFILE_PATH = path.join(__dirname, "..", "data", "profile.json");
const MUSCLE_PATH = path.join(__dirname, "..", "data", "muscleGroups.json");
const DEFAULT_MUSCLES = [
  { key: "shoulder", label: "Skulder" },
  { key: "knee", label: "Knæ" },
  { key: "lower_back", label: "Nedre ryg" },
  { key: "upper_back", label: "Øvre ryg/nakke" },
  { key: "hip", label: "Hofte" },
  { key: "ankle", label: "Ankel/fod" },
  { key: "elbow", label: "Albue" },
  { key: "wrist", label: "Håndled" },
  { key: "core", label: "Core" },
  { key: "cardio", label: "Kredsløb/lunger" },
  { key: "other", label: "Andet" },
];
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
const AVATAR_DIR = path.join(UPLOAD_DIR, "avatar");
const PROGRESS_DIR = path.join(UPLOAD_DIR, "progress");

const app = express();
app.use(express.json({ limit: "200mb" }));

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

ensureDir(UPLOAD_DIR);
ensureDir(AVATAR_DIR);
ensureDir(PROGRESS_DIR);
app.use("/uploads", express.static(UPLOAD_DIR));

function readDb() {
  try {
    if (!fs.existsSync(DATA_PATH)) return { exercises: [] };
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    const db = JSON.parse(raw);
    if (!db.exercises) db.exercises = [];
    return db;
  } catch {
    return { exercises: [] };
  }
}

function writeDb(db) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2), "utf8");
}

function slugKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function safeFilename(name) {
  return String(name || "file")
    .replace(/[^a-z0-9_.-]+/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function uniqueFilename(original) {
  const base = safeFilename(original) || "file";
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${stamp}_${rand}_${base}`;
}

function toPublicPath(absPath) {
  const rel = path.relative(UPLOAD_DIR, absPath).replace(/\\/g, "/");
  return `/uploads/${rel}`;
}

function resolveUploadPath(subDir, filename) {
  const finalName = uniqueFilename(filename);
  const abs = path.join(subDir, finalName);
  return abs;
}

function deleteFileIfExists(absPath) {
  if (!absPath) return;
  try {
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
  } catch {
    // ignore
  }
}

function absoluteFromPublic(publicPath) {
  const clean = String(publicPath || "").replace(/^\/+uploads\/?/i, "");
  const abs = path.join(UPLOAD_DIR, clean);
  if (!abs.startsWith(UPLOAD_DIR)) return null;
  return abs;
}

const MUSCLE_GROUP_KEYS = [
  "shoulder",
  "knee",
  "lower_back",
  "upper_back",
  "hip",
  "ankle",
  "elbow",
  "wrist",
  "cardio",
  "other",
];

function normalizeEquipmentEntry(entry) {
  if (!entry) return null;
  if (typeof entry === "string") {
    const key = slugKey(entry);
    if (!key) return null;
    return { key, label: key, tags: [] };
  }

  let key = typeof entry.key === "string" ? slugKey(entry.key) : "";
  if (!key) {
    key = slugKey(entry.id || entry.name || entry.label || "");
  }
  if (!key) return null;

  const label = String(entry.label || entry.name || entry.key || key).trim() || key;
  let tags = [];
  if (Array.isArray(entry.tags)) {
    tags = entry.tags.map((t) => String(t || "").trim()).filter(Boolean);
  } else if (typeof entry.tags === "string") {
    tags = entry.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  return { key, label, tags };
}

function readEquipmentCatalog() {
  try {
    if (!fs.existsSync(EQUIPMENT_PATH)) return [];
    const raw = fs.readFileSync(EQUIPMENT_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const rawList = Array.isArray(parsed?.equipment) ? parsed.equipment : Array.isArray(parsed) ? parsed : [];

    const normalized = rawList
      .map((entry) => normalizeEquipmentEntry(entry))
      .filter(Boolean);

    const hasLegacyEntries = rawList.some(
      (entry) =>
        typeof entry === "string" ||
        !entry ||
        typeof entry.key !== "string" ||
        !entry.label ||
        !Array.isArray(entry.tags)
    );
    if (hasLegacyEntries) {
      writeEquipmentCatalog(normalized);
    }

    return normalized;
  } catch (err) {
    console.warn("Kunne ikke læse equipmentCatalog", err);
    return [];
  }
}

function writeEquipmentCatalog(items) {
  const normalized = items
    .map((entry) => normalizeEquipmentEntry(entry))
    .filter(Boolean);
  const payload = { equipment: normalized };
  fs.mkdirSync(path.dirname(EQUIPMENT_PATH), { recursive: true });
  fs.writeFileSync(EQUIPMENT_PATH, JSON.stringify(payload, null, 2), "utf8");
}

function equipmentKeySet() {
  return new Set(readEquipmentCatalog().map((item) => item.key));
}

function readMuscleCatalog() {
  try {
    if (!fs.existsSync(MUSCLE_PATH)) {
      fs.mkdirSync(path.dirname(MUSCLE_PATH), { recursive: true });
      fs.writeFileSync(MUSCLE_PATH, JSON.stringify({ muscles: DEFAULT_MUSCLES }, null, 2), "utf8");
      return DEFAULT_MUSCLES;
    }
    const raw = fs.readFileSync(MUSCLE_PATH, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data?.muscles) ? data.muscles : DEFAULT_MUSCLES;
  } catch {
    return DEFAULT_MUSCLES;
  }
}

function writeMuscleCatalog(items) {
  const payload = { muscles: items };
  fs.mkdirSync(path.dirname(MUSCLE_PATH), { recursive: true });
  fs.writeFileSync(MUSCLE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

function muscleKeySet() {
  return new Set(readMuscleCatalog().map((item) => item.key));
}

function readProfile() {
  try {
    if (!fs.existsSync(PROFILE_PATH)) {
      const empty = {
        username: "",
        gender: "",
        age: "",
        bodyType: "",
        weightKg: "",
        heightCm: "",
        waistCm: "",
        trainingExperience: "",
        trainingFrequency: "",
        profileImagePath: "",
        progressPhotos: [],
        injuries: [],
        injuryNotes: "",
      };
      fs.mkdirSync(path.dirname(PROFILE_PATH), { recursive: true });
      fs.writeFileSync(PROFILE_PATH, JSON.stringify(empty, null, 2), "utf8");
      return empty;
    }
    const raw = fs.readFileSync(PROFILE_PATH, "utf8");
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function writeProfile(profile) {
  fs.mkdirSync(path.dirname(PROFILE_PATH), { recursive: true });
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2), "utf8");
}

function inferType(ex) {
  if (ex.type) return ex.type;
  const tags = ex.tags || [];
  if (tags.includes("isolation")) return "isolation";
  if (tags.includes("compound")) return "compound";
  return "";
}

// Hent alle øvelser som RM-rækker
app.get("/api/rm", (req, res) => {
  const db = readDb();
  const rows = (db.exercises || [])
    .map((ex) => ({
      exerciseKey: ex.key,
      name: ex.name || ex.key,
      type: inferType(ex),
      equipment: Array.isArray(ex.equipment) ? ex.equipment : [],
      muscleGroups: Array.isArray(ex.muscleGroups) ? ex.muscleGroups : [],
      rm: ex.rm || {},
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "da"));

  res.json(rows);
});

// Hent udstyrskatalog (bruges til dropdowns mm.)
app.get("/api/equipment", (req, res) => {
  const catalog = readEquipmentCatalog().sort((a, b) => {
    return (a.label || a.key).localeCompare(b.label || b.key, "da");
  });
  res.json(catalog);
});

app.get("/api/muscles", (req, res) => {
  const catalog = readMuscleCatalog().sort((a, b) => {
    return (a.label || a.key).localeCompare(b.label || b.key, "da");
  });
  res.json(catalog);
});

function normalizeEquipmentPayload(body) {
  const key = slugKey(body?.key);
  if (!key) throw new Error("Key er påkrævet (brug bogstaver/tal)");

  const label = String(body?.label || body?.name || "").trim() || key;
  let tags = [];
  if (Array.isArray(body?.tags)) {
    tags = body.tags.map((t) => String(t || "").trim()).filter(Boolean);
  } else if (typeof body?.tags === "string") {
    tags = body.tags.split(",").map((t) => t.trim()).filter(Boolean);
  }

  return { key, label, tags };
}

// Tilføj eller opdater udstyr
app.post("/api/equipment", (req, res) => {
  try {
    const payload = normalizeEquipmentPayload(req.body);
    const catalog = readEquipmentCatalog();
    const existingIndex = catalog.findIndex((item) => item.key === payload.key);
    if (existingIndex >= 0) {
      catalog[existingIndex] = { ...catalog[existingIndex], ...payload };
    } else {
      catalog.push(payload);
    }
    writeEquipmentCatalog(catalog);
    res.json(payload);
  } catch (err) {
    res.status(400).json({ error: err.message || "Ugyldigt payload" });
  }
});

// Slet udstyr og fjern referencer fra øvelser
app.delete("/api/equipment/:key", (req, res) => {
  const key = String(req.params.key || "").trim();
  if (!key) return res.status(400).json({ error: "Key mangler" });

  const catalog = readEquipmentCatalog();
  const filtered = catalog.filter((item) => item.key !== key);
  if (filtered.length === catalog.length) {
    return res.status(404).json({ error: "Udstyr findes ikke" });
  }

  writeEquipmentCatalog(filtered);

  // Fjern udstyr fra øvelser, så vi ikke har dangling keys
  const db = readDb();
  if (Array.isArray(db.exercises)) {
    for (const ex of db.exercises) {
      if (Array.isArray(ex.equipment)) {
        ex.equipment = ex.equipment.filter((eq) => eq !== key);
      }
    }
    writeDb(db);
  }

  res.json({ ok: true });
});

function normalizeMusclePayload(body) {
  const key = slugKey(body?.key);
  if (!key) throw new Error("Key er påkrævet");
  const label = String(body?.label || "").trim() || key;
  return { key, label };
}

app.post("/api/muscles", (req, res) => {
  try {
    const payload = normalizeMusclePayload(req.body);
    const catalog = readMuscleCatalog();
    const idx = catalog.findIndex((item) => item.key === payload.key);
    if (idx >= 0) catalog[idx] = payload;
    else catalog.push(payload);
    writeMuscleCatalog(catalog);
    res.json(payload);
  } catch (err) {
    res.status(400).json({ error: err.message || "Ugyldigt payload" });
  }
});

app.delete("/api/muscles/:key", (req, res) => {
  const key = String(req.params.key || "").trim();
  if (!key) return res.status(400).json({ error: "Key mangler" });
  const catalog = readMuscleCatalog();
  const filtered = catalog.filter((item) => item.key !== key);
  if (filtered.length === catalog.length) {
    return res.status(404).json({ error: "Muskel findes ikke" });
  }
  writeMuscleCatalog(filtered);
  res.json({ ok: true });
});

// Personlige data
app.get("/api/profile", (req, res) => {
  res.json(readProfile());
});

function sanitizeProfile(body) {
  const profile = readProfile();
  const copyFields = [
    "username",
    "gender",
    "age",
    "bodyType",
    "weightKg",
    "heightCm",
    "waistCm",
    "trainingExperience",
    "trainingFrequency",
    "injuryNotes",
  ];
  for (const key of copyFields) {
    const val = body?.[key];
    if (val === undefined || val === null) continue;
    profile[key] = String(val).trim();
  }

  if (body?.profileImagePath !== undefined) {
    const imgPath = typeof body.profileImagePath === "string" ? body.profileImagePath.trim() : "";
    profile.profileImagePath = imgPath;
  }

  if (Array.isArray(body?.progressPhotos)) {
    profile.progressPhotos = body.progressPhotos
      .map((item) => {
        const date = String(item?.date || "").trim();
        const pathValue = typeof item?.path === "string" ? item.path.trim() : "";
        if (!date || !pathValue) return null;
        return { date, path: pathValue };
      })
      .filter(Boolean);
  }

  if (Array.isArray(body?.injuries)) {
    profile.injuries = body.injuries
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  return profile;
}

app.post("/api/profile", (req, res) => {
  try {
    const updated = sanitizeProfile(req.body || {});
    writeProfile(updated);
    res.json({ ok: true, profile: updated });
  } catch (err) {
    res.status(400).json({ error: err.message || "Ugyldigt profil-data" });
  }
});

app.post("/api/profile/avatar", express.raw({ limit: "50mb", type: "*/*" }), (req, res) => {
  const originalName = req.headers["x-filename"] || "avatar";
  if (!req.body || !req.body.length) {
    return res.status(400).json({ error: "Tomt upload" });
  }
  try {
    const absPath = resolveUploadPath(AVATAR_DIR, originalName);
    fs.writeFileSync(absPath, req.body);
    const publicPath = toPublicPath(absPath);
    res.json({ path: publicPath });
  } catch (err) {
    res.status(500).json({ error: "Kunne ikke gemme billede" });
  }
});

app.delete("/api/profile/avatar", (req, res) => {
  const pathParam = req.query.path || req.body?.path;
  const absPath = absoluteFromPublic(pathParam);
  if (!absPath) return res.status(400).json({ error: "Ugyldig sti" });
  deleteFileIfExists(absPath);
  res.json({ ok: true });
});

app.post("/api/profile/progress-photo", express.raw({ limit: "50mb", type: "*/*" }), (req, res) => {
  const date = String(req.query.date || req.headers["x-date"] || "").trim();
  const originalName = req.headers["x-filename"] || "progress";
  if (!date) return res.status(400).json({ error: "Dato mangler" });
  if (!req.body || !req.body.length) return res.status(400).json({ error: "Tomt upload" });
  try {
    const absPath = resolveUploadPath(PROGRESS_DIR, originalName);
    fs.writeFileSync(absPath, req.body);
    const publicPath = toPublicPath(absPath);
    res.json({ date, path: publicPath });
  } catch (err) {
    res.status(500).json({ error: "Kunne ikke gemme foto" });
  }
});

app.delete("/api/profile/progress-photo", (req, res) => {
  const pathParam = req.query.path || req.body?.path;
  const absPath = absoluteFromPublic(pathParam);
  if (!absPath) return res.status(400).json({ error: "Ugyldig sti" });
  deleteFileIfExists(absPath);
  res.json({ ok: true });
});

app.post("/api/exercise-muscles", (req, res) => {
  const { exerciseKey, muscles } = req.body || {};
  if (!exerciseKey || !Array.isArray(muscles)) {
    return res.status(400).json({ error: "Missing exerciseKey/muscles" });
  }

  const allowed = muscleKeySet();
  const sanitized = Array.from(
    new Set(
      muscles
        .map((key) => slugKey(key))
        .filter((key) => key && allowed.has(key))
    )
  );

  const db = readDb();
  const ex = (db.exercises || []).find((x) => x.key === exerciseKey);
  if (!ex) return res.status(404).json({ error: "Exercise not found" });

  ex.muscleGroups = sanitized;
  writeDb(db);
  res.json({ ok: true, muscleGroups: sanitized });
});

// Gem én celle tilbage i exercises.json
app.post("/api/rm", (req, res) => {
  const { exerciseKey, rep, value } = req.body || {};

  if (!exerciseKey || rep === undefined || rep === null) {
    return res.status(400).json({ error: "Missing exerciseKey/rep" });
  }

  const r = String(rep);
  if (!["1", "3", "5", "8", "10"].includes(r)) {
    return res.status(400).json({ error: "Invalid rep" });
  }

  const db = readDb();
  const ex = (db.exercises || []).find((x) => x.key === exerciseKey);
  if (!ex) return res.status(404).json({ error: "Exercise not found" });

  if (!ex.rm) ex.rm = {};

  if (value === null || value === "") {
    delete ex.rm[r];
  } else {
    const n = Number(value);
    if (!Number.isFinite(n)) return res.status(400).json({ error: "Invalid value" });
    ex.rm[r] = n;
  }

  writeDb(db);
  res.json({ ok: true });
});

// Opdater hvilke udstyrstyper en øvelse kræver
app.post("/api/exercise-equipment", (req, res) => {
  const { exerciseKey, equipmentKeys } = req.body || {};
  if (!exerciseKey || !Array.isArray(equipmentKeys)) {
    return res.status(400).json({ error: "Missing exerciseKey/equipmentKeys" });
  }

  const allowed = equipmentKeySet();
  const sanitized = Array.from(
    new Set(
      equipmentKeys
        .map((key) => String(key || "").trim())
        .filter((key) => key && allowed.has(key))
    )
  );

  const db = readDb();
  const ex = (db.exercises || []).find((x) => x.key === exerciseKey);
  if (!ex) return res.status(404).json({ error: "Exercise not found" });

  ex.equipment = sanitized;
  writeDb(db);
  res.json({ ok: true, equipment: sanitized });
});

// UI
app.get("/rm", (req, res) => {
  res.sendFile(path.join(__dirname, "rm.html"));
});

app.get("/equipment", (req, res) => {
  res.sendFile(path.join(__dirname, "equipment.html"));
});

app.get("/profile", (req, res) => {
  res.sendFile(path.join(__dirname, "profile.html"));
});

app.get("/muscles", (req, res) => {
  res.sendFile(path.join(__dirname, "muscles.html"));
});

app.listen(PORT, () => {
  console.log("Exercise UI running on http://localhost:" + PORT);
});
