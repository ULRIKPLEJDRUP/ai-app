const express = require("express");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const DATA_PATH = path.join(__dirname, "..", "data", "exercises.json");
const EQUIPMENT_PATH = path.join(__dirname, "..", "data", "equipmentCatalog.json");
const PROFILE_PATH = path.join(__dirname, "..", "data", "profile.json");
const VISION_PATH = path.join(__dirname, "..", "data", "vision.json");
const WARMUP_PATH = path.join(__dirname, "..", "data", "warmupExercises.json");
const PROFILES_DIR = path.join(__dirname, "..", "data", "profiles");
const PROFILE_INDEX_PATH = path.join(PROFILES_DIR, "profiles.json");
const DEFAULT_PROFILE_ID = "default";
const DEFAULT_PROFILE_META = { id: DEFAULT_PROFILE_ID, label: "Standard" };
const MUSCLE_PATH = path.join(__dirname, "..", "data", "muscleGroups.json");
const PROGRAM_DIR = path.join(__dirname, "..", "data", "programs");
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
const PROFILE_RM_FILE = "rm.json";
const PROFILE_METRICS_FILE = "metrics.json";
const EXERCISE_METRICS = {
  dips: { count: true },
  pull_ups: { count: true },
  plank: { time: true },
  ab_wheel: { count: true, time: true },
};
const DEFAULT_PROFILE_DATA = {
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
const DEFAULT_VISION = {
  headline: "",
  motivation: "",
  targets: {
    weightKg: "",
    waistCm: "",
    benchKg: "",
    squatKg: "",
    deadliftKg: "",
    cardioGoal: "",
  },
  habits: [],
  deadline: "",
  notes: "",
};
const DEFAULT_PROGRAM_ARCHIVE = { activeProgramId: null, programs: [] };

const app = express();
app.use(express.json({ limit: "200mb" }));

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

ensureDir(UPLOAD_DIR);
ensureDir(AVATAR_DIR);
ensureDir(PROGRESS_DIR);
ensureDir(PROGRAM_DIR);
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
  ensureDir(subDir);
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

ensureDir(PROFILES_DIR);
ensureProfileIndex();
migrateLegacyRmData();

function profileDir(profileId = DEFAULT_PROFILE_ID) {
  const id = profileId || DEFAULT_PROFILE_ID;
  return path.join(PROFILES_DIR, id);
}

function profileFilePath(profileId = DEFAULT_PROFILE_ID) {
  return path.join(profileDir(profileId), "profile.json");
}

function visionFilePath(profileId = DEFAULT_PROFILE_ID) {
  return path.join(profileDir(profileId), "vision.json");
}

function profileRMPath(profileId = DEFAULT_PROFILE_ID) {
  return path.join(profileDir(profileId), PROFILE_RM_FILE);
}

function profileMetricsPath(profileId = DEFAULT_PROFILE_ID) {
  return path.join(profileDir(profileId), PROFILE_METRICS_FILE);
}

function programFilePath(profileId = DEFAULT_PROFILE_ID) {
  const id = profileId || DEFAULT_PROFILE_ID;
  return path.join(PROGRAM_DIR, `${id}.json`);
}

function guessProgramName(blueprint) {
  if (!blueprint || typeof blueprint !== "object") return "Program";
  if (blueprint.name) return String(blueprint.name).trim();
  if (blueprint.programName) return String(blueprint.programName).trim();
  if (blueprint.goal && typeof blueprint.goal === "object" && blueprint.goal.label) {
    return `${blueprint.goal.label} program`;
  }
  if (blueprint.goal && blueprint.goal.key) {
    return `${blueprint.goal.key} program`;
  }
  return "Program";
}

function normalizeArchiveEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const id = entry.id || randomUUID();
  const name = String(entry.name || guessProgramName(entry.blueprint)).trim() || "Program";
  const savedAt = entry.savedAt || new Date().toISOString();
  const blueprint = entry.blueprint && typeof entry.blueprint === "object" ? entry.blueprint : null;
  if (!blueprint) return null;
  return { id, name, savedAt, blueprint };
}

function writeProgramArchive(profileId = DEFAULT_PROFILE_ID, archive) {
  const id = resolveProfileId(profileId);
  ensureProfileMeta(id);
  const file = programFilePath(id);
  ensureDir(PROGRAM_DIR);
  const safeArchive = {
    activeProgramId: archive?.activeProgramId || null,
    programs: Array.isArray(archive?.programs) ? archive.programs : [],
  };
  fs.writeFileSync(file, JSON.stringify(safeArchive, null, 2), "utf8");
}

function readProgramArchive(profileId = DEFAULT_PROFILE_ID) {
  const id = resolveProfileId(profileId);
  ensureProfileMeta(id);
  const file = programFilePath(id);
  try {
    if (!fs.existsSync(file)) return { ...DEFAULT_PROGRAM_ARCHIVE };
    const raw = fs.readFileSync(file, "utf8");
    const data = JSON.parse(raw);
    if (data && typeof data === "object" && Array.isArray(data.programs)) {
      const programs = data.programs
        .map((entry) => normalizeArchiveEntry(entry))
        .filter(Boolean);
      const archive = {
        activeProgramId: data.activeProgramId || (programs[0] ? programs[0].id : null),
        programs,
      };
      if (archive.activeProgramId && !programs.some((p) => p.id === archive.activeProgramId)) {
        archive.activeProgramId = programs[0] ? programs[0].id : null;
      }
      return archive;
    }
    if (data && typeof data === "object") {
      const legacyBlueprint = data;
      if (Object.keys(legacyBlueprint).length) {
        const legacyEntry = normalizeArchiveEntry({
          id: randomUUID(),
          name: guessProgramName(legacyBlueprint),
          savedAt: legacyBlueprint.savedAt || new Date().toISOString(),
          blueprint: legacyBlueprint,
        });
        if (legacyEntry) {
          const archive = {
            activeProgramId: legacyEntry.id,
            programs: [legacyEntry],
          };
          writeProgramArchive(id, archive);
          return archive;
        }
      }
    }
  } catch (err) {
    console.warn("Kunne ikke læse program-arkiv", err);
  }
  return { ...DEFAULT_PROGRAM_ARCHIVE };
}

function summarizeProgram(entry) {
  if (!entry) return null;
  const goalKey =
    entry.blueprint && entry.blueprint.goal ? entry.blueprint.goal.key || "" : "";
  const structureKey =
    entry.blueprint && entry.blueprint.structure ? entry.blueprint.structure.key || "" : "";
  return {
    id: entry.id,
    name: entry.name,
    savedAt: entry.savedAt,
    goalKey,
    structureKey,
    goalLabel:
      entry.blueprint && entry.blueprint.goal ? entry.blueprint.goal.label || goalKey : goalKey,
    structureLabel:
      entry.blueprint && entry.blueprint.structure
        ? entry.blueprint.structure.label || structureKey
        : structureKey,
  };
}

function getProfileMeta(profileId = DEFAULT_PROFILE_ID) {
  const id = resolveProfileId(profileId);
  const list = readProfileIndex();
  return (
    list.find((meta) => meta.id === id) || {
      id,
      label: DEFAULT_PROFILE_META.label,
    }
  );
}

function ensureProfileIndex() {
  ensureDir(PROFILES_DIR);
  if (!fs.existsSync(PROFILE_INDEX_PATH)) {
    const payload = { profiles: [DEFAULT_PROFILE_META] };
    fs.writeFileSync(PROFILE_INDEX_PATH, JSON.stringify(payload, null, 2), "utf8");
  }
}

function readProfileIndex() {
  ensureProfileIndex();
  try {
    const raw = fs.readFileSync(PROFILE_INDEX_PATH, "utf8");
    const data = JSON.parse(raw);
    let list = Array.isArray(data?.profiles) ? data.profiles : [];
    if (!list.length) list = [DEFAULT_PROFILE_META];
    return list.map((meta) => ({
      id: slugKey(meta?.id) || DEFAULT_PROFILE_ID,
      label: meta?.label ? String(meta.label).trim() : meta?.id || DEFAULT_PROFILE_META.label,
    }));
  } catch {
    return [DEFAULT_PROFILE_META];
  }
}

function writeProfileIndex(list) {
  const sanitized = Array.isArray(list)
    ? list
        .map((meta) => {
          const id = slugKey(meta?.id);
          if (!id) return null;
          return { id, label: meta?.label || meta?.name || id };
        })
        .filter(Boolean)
    : [];
  const finalList = sanitized.length ? sanitized : [DEFAULT_PROFILE_META];
  ensureDir(PROFILE_INDEX_PATH ? path.dirname(PROFILE_INDEX_PATH) : PROFILES_DIR);
  fs.writeFileSync(PROFILE_INDEX_PATH, JSON.stringify({ profiles: finalList }, null, 2), "utf8");
}

function ensureProfileMeta(profileId = DEFAULT_PROFILE_ID, label = "") {
  const id = slugKey(profileId) || DEFAULT_PROFILE_ID;
  const list = readProfileIndex();
  const existing = list.find((meta) => meta.id === id);
  if (existing) {
    if (label && label !== existing.label) {
      existing.label = label;
      writeProfileIndex(list);
    }
    return existing;
  }
  const labelValue = label || `Profil ${id}`;
  list.push({ id, label: labelValue });
  writeProfileIndex(list);
  return { id, label: labelValue };
}

function resolveProfileId(value) {
  const slug = slugKey(value);
  return slug || DEFAULT_PROFILE_ID;
}

function getProfileIdFromRequest(req) {
  const raw = req.query?.profileId || req.headers["x-profile-id"] || DEFAULT_PROFILE_ID;
  return resolveProfileId(raw);
}

function normalizeProfileMetaPayload(body) {
  const desiredLabel = String(body?.label || body?.name || "").trim();
  const idInput = body?.id || body?.key || "";
  const id = slugKey(idInput || desiredLabel);
  if (!id) throw new Error("Profilnavn er påkrævet");
  const label = desiredLabel || `Profil ${id}`;
  return { id, label };
}

function migrateLegacyRmData() {
  try {
    if (!fs.existsSync(DATA_PATH)) return;
    const dbRaw = fs.readFileSync(DATA_PATH, "utf8");
    const db = JSON.parse(dbRaw);
    const rmData = {};
    let touched = false;
    for (const ex of db.exercises || []) {
      if (ex.rm && typeof ex.rm === "object" && Object.keys(ex.rm).length) {
        rmData[ex.key] = ex.rm;
        delete ex.rm;
        touched = true;
      }
    }
    if (Object.keys(rmData).length) {
      ensureDir(profileDir(DEFAULT_PROFILE_ID));
      if (!fs.existsSync(profileRMPath(DEFAULT_PROFILE_ID))) {
        fs.writeFileSync(profileRMPath(DEFAULT_PROFILE_ID), JSON.stringify(rmData, null, 2), "utf8");
      }
    }
    if (touched) {
      fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2), "utf8");
    }
  } catch (err) {
    console.warn("Kunne ikke migrere RM-data", err);
  }
}

function readProfileRM(profileId = DEFAULT_PROFILE_ID) {
  const id = resolveProfileId(profileId);
  ensureProfileMeta(id);
  const filePath = profileRMPath(id);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : {};
    }
  } catch {
    // ignore
  }
  writeProfileRM(id, {});
  return {};
}

function writeProfileRM(profileId = DEFAULT_PROFILE_ID, data = {}) {
  const id = resolveProfileId(profileId);
  ensureProfileMeta(id);
  const dir = profileDir(id);
  ensureDir(dir);
  fs.writeFileSync(profileRMPath(id), JSON.stringify(data, null, 2), "utf8");
}

function readProfileMetrics(profileId = DEFAULT_PROFILE_ID) {
  const id = resolveProfileId(profileId);
  ensureProfileMeta(id);
  const filePath = profileMetricsPath(id);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : {};
    }
  } catch {
    // ignore
  }
  writeProfileMetrics(id, {});
  return {};
}

function writeProfileMetrics(profileId = DEFAULT_PROFILE_ID, data = {}) {
  const id = resolveProfileId(profileId);
  ensureProfileMeta(id);
  const dir = profileDir(id);
  ensureDir(dir);
  fs.writeFileSync(profileMetricsPath(id), JSON.stringify(data, null, 2), "utf8");
}

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

function readWarmupCatalog() {
  try {
    if (!fs.existsSync(WARMUP_PATH)) {
      writeWarmupCatalog([]);
      return [];
    }
    const raw = fs.readFileSync(WARMUP_PATH, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data?.exercises) ? data.exercises : [];
  } catch {
    return [];
  }
}

function writeWarmupCatalog(items) {
  const payload = { exercises: Array.isArray(items) ? items : [] };
  fs.mkdirSync(path.dirname(WARMUP_PATH), { recursive: true });
  fs.writeFileSync(WARMUP_PATH, JSON.stringify(payload, null, 2), "utf8");
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

function readProfile(profileId = DEFAULT_PROFILE_ID) {
  const id = resolveProfileId(profileId);
  ensureProfileMeta(id);
  const filePath = profileFilePath(id);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(raw);
      return { ...DEFAULT_PROFILE_DATA, ...(data || {}) };
    }
    if (id === DEFAULT_PROFILE_ID && fs.existsSync(PROFILE_PATH)) {
      const legacyRaw = fs.readFileSync(PROFILE_PATH, "utf8");
      const legacyData = JSON.parse(legacyRaw);
      const merged = { ...DEFAULT_PROFILE_DATA, ...(legacyData || {}) };
      writeProfile(id, merged);
      return merged;
    }
  } catch {
    // ignore
  }
  writeProfile(id, { ...DEFAULT_PROFILE_DATA });
  return { ...DEFAULT_PROFILE_DATA };
}

function writeProfile(profileId = DEFAULT_PROFILE_ID, profile) {
  const id = resolveProfileId(profileId);
  ensureProfileMeta(id);
  const dir = profileDir(id);
  ensureDir(dir);
  fs.writeFileSync(profileFilePath(id), JSON.stringify(profile, null, 2), "utf8");
}

function readVision(profileId = DEFAULT_PROFILE_ID) {
  const id = resolveProfileId(profileId);
  ensureProfileMeta(id);
  const filePath = visionFilePath(id);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(raw);
      return { ...DEFAULT_VISION, ...(data || {}) };
    }
    if (id === DEFAULT_PROFILE_ID && fs.existsSync(VISION_PATH)) {
      const legacyRaw = fs.readFileSync(VISION_PATH, "utf8");
      const legacyData = JSON.parse(legacyRaw);
      const merged = { ...DEFAULT_VISION, ...(legacyData || {}) };
      writeVision(id, merged);
      return merged;
    }
  } catch {
    // ignore
  }
  writeVision(id, { ...DEFAULT_VISION });
  return { ...DEFAULT_VISION };
}

function writeVision(profileId = DEFAULT_PROFILE_ID, vision) {
  const id = resolveProfileId(profileId);
  ensureProfileMeta(id);
  const dir = profileDir(id);
  ensureDir(dir);
  fs.writeFileSync(visionFilePath(id), JSON.stringify(vision, null, 2), "utf8");
}

function readProgramBlueprint(profileId = DEFAULT_PROFILE_ID) {
  const archive = readProgramArchive(profileId);
  if (!archive.programs.length) return null;
  let entry = archive.programs.find((p) => p.id === archive.activeProgramId);
  if (!entry) entry = archive.programs[0];
  if (!entry) return null;
  return {
    ...entry.blueprint,
    programId: entry.id,
    programName: entry.name,
    savedAt: entry.savedAt,
  };
}

function writeProgramBlueprint(profileId = DEFAULT_PROFILE_ID, blueprint) {
  const archive = readProgramArchive(profileId);
  if (!blueprint) {
    writeProgramArchive(profileId, { ...DEFAULT_PROGRAM_ARCHIVE });
    return null;
  }
  const updatedBlueprint = { ...blueprint, savedAt: blueprint.savedAt || new Date().toISOString() };
  updatedBlueprint.programName = guessProgramName(updatedBlueprint);
  let targetId = archive.activeProgramId;
  if (!targetId && archive.programs.length) {
    targetId = archive.programs[0].id;
  }
  if (!targetId) {
    targetId = randomUUID();
    archive.programs.push({
      id: targetId,
      name: updatedBlueprint.programName,
      savedAt: updatedBlueprint.savedAt,
      blueprint: updatedBlueprint,
    });
    archive.activeProgramId = targetId;
  } else {
    const idx = archive.programs.findIndex((p) => p.id === targetId);
    if (idx >= 0) {
      archive.programs[idx] = {
        ...archive.programs[idx],
        name: updatedBlueprint.programName,
        savedAt: updatedBlueprint.savedAt,
        blueprint: updatedBlueprint,
      };
    } else {
      archive.programs.push({
        id: targetId,
        name: updatedBlueprint.programName,
        savedAt: updatedBlueprint.savedAt,
        blueprint: updatedBlueprint,
      });
      archive.activeProgramId = targetId;
    }
  }
  writeProgramArchive(profileId, archive);
  return archive.programs.find((p) => p.id === targetId) || null;
}

function getProgramEntry(profileId = DEFAULT_PROFILE_ID, programId) {
  if (!programId) return null;
  const archive = readProgramArchive(profileId);
  return archive.programs.find((entry) => entry.id === programId) || null;
}

function sanitizeProgramSavePayload(body) {
  if (!body || typeof body !== "object") throw new Error("Payload mangler");
  const programId = body.programId ? String(body.programId).trim() || null : null;
  const setActive = Boolean(body.setActive);
  const nameInput = String(body.name || "").trim();
  const blueprint = body.blueprint && typeof body.blueprint === "object" ? body.blueprint : body;
  if (!blueprint || typeof blueprint !== "object" || !blueprint.goal || !blueprint.structure) {
    throw new Error("Blueprint mangler mål og struktur");
  }
  const name =
    nameInput || guessProgramName(blueprint) || (blueprint.goal?.label || "Program");
  return { programId, setActive, name, blueprint };
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
  const profileId = getProfileIdFromRequest(req);
  const rmData = readProfileRM(profileId);
  const metricsData = readProfileMetrics(profileId);
  const db = readDb();
  const rows = (db.exercises || [])
    .map((ex) => ({
      exerciseKey: ex.key,
      name: ex.name || ex.key,
      type: inferType(ex),
      equipment: Array.isArray(ex.equipment) ? ex.equipment : [],
      muscleGroups: Array.isArray(ex.muscleGroups) ? ex.muscleGroups : [],
      rm: rmData?.[ex.key] || {},
      metricTypes: EXERCISE_METRICS[ex.key] || null,
      metrics: metricsData?.[ex.key] || {},
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

function normalizeWarmupPayload(body) {
  const key = slugKey(body?.key || body?.name);
  if (!key) throw new Error("Key/navn er påkrævet");
  const name = String(body?.name || body?.label || key).trim();
  const type = String(body?.type || "").trim();
  let equipment = [];
  if (Array.isArray(body?.equipment)) {
    equipment = body.equipment.map((eq) => slugKey(eq) || "").filter(Boolean);
  } else if (typeof body?.equipment === "string") {
    equipment = body.equipment
      .split(",")
      .map((eq) => slugKey(eq))
      .filter(Boolean);
  }
  const reps = body?.reps === "" || body?.reps === null ? null : Number(body?.reps);
  const timeSeconds =
    body?.timeSeconds === "" || body?.timeSeconds === null ? null : Number(body?.timeSeconds);
  const durationSeconds =
    body?.durationSeconds === "" || body?.durationSeconds === null
      ? null
      : Number(body?.durationSeconds);
  const sets =
    body?.sets === "" || body?.sets === null || body?.sets === undefined
      ? null
      : Number(body?.sets);
  const restSeconds =
    body?.restSeconds === "" || body?.restSeconds === null || body?.restSeconds === undefined
      ? null
      : Number(body?.restSeconds);
  return {
    key,
    name,
    type,
    equipment,
    reps: Number.isFinite(reps) ? reps : null,
    timeSeconds: Number.isFinite(timeSeconds) ? timeSeconds : null,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    sets: Number.isFinite(sets) ? Math.max(1, Math.round(sets)) : null,
    restSeconds: Number.isFinite(restSeconds) ? Math.max(0, restSeconds) : null,
  };
}

app.get("/api/warmup", (req, res) => {
  const list = readWarmupCatalog().sort((a, b) => (a.name || a.key).localeCompare(b.name || b.key, "da"));
  res.json(list);
});

app.post("/api/warmup", (req, res) => {
  try {
    const payload = normalizeWarmupPayload(req.body || {});
    const current = readWarmupCatalog();
    const idx = current.findIndex((item) => item.key === payload.key);
    if (idx >= 0) current[idx] = { ...current[idx], ...payload };
    else current.push(payload);
    writeWarmupCatalog(current);
    res.json(payload);
  } catch (err) {
    res.status(400).json({ error: err.message || "Ugyldigt opvarmningsdata" });
  }
});

app.delete("/api/warmup/:key", (req, res) => {
  const key = slugKey(req.params.key);
  if (!key) return res.status(400).json({ error: "Key mangler" });
  const list = readWarmupCatalog();
  const filtered = list.filter((item) => item.key !== key);
  if (filtered.length === list.length) return res.status(404).json({ error: "Øvelse findes ikke" });
  writeWarmupCatalog(filtered);
  res.json({ ok: true });
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
  const profileId = getProfileIdFromRequest(req);
  res.json(readProfile(profileId));
});

function sanitizeProfile(profileId, body) {
  const profile = readProfile(profileId);
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
  const profileId = getProfileIdFromRequest(req);
  try {
    const updated = sanitizeProfile(profileId, req.body || {});
    writeProfile(profileId, updated);
    res.json({ ok: true, profile: updated, profileId });
  } catch (err) {
    res.status(400).json({ error: err.message || "Ugyldigt profil-data" });
  }
});

app.get("/api/profiles", (req, res) => {
  res.json(readProfileIndex());
});

app.post("/api/profiles", (req, res) => {
  try {
    const meta = normalizeProfileMetaPayload(req.body || {});
    const cloneSource = req.body?.cloneFrom ? resolveProfileId(req.body.cloneFrom) : null;
    ensureProfileMeta(meta.id, meta.label);
    if (cloneSource && cloneSource !== meta.id) {
      writeProfile(meta.id, readProfile(cloneSource));
      writeVision(meta.id, readVision(cloneSource));
    } else {
      readProfile(meta.id);
      readVision(meta.id);
    }
    res.json(meta);
  } catch (err) {
    res.status(400).json({ error: err.message || "Kunne ikke oprette profil" });
  }
});

function sanitizeVision(profileId, body) {
  const current = readVision(profileId);
  const safe = { ...DEFAULT_VISION, ...current };
  safe.headline = String(body?.headline ?? safe.headline ?? "").trim();
  safe.motivation = String(body?.motivation ?? safe.motivation ?? "").trim();
  safe.deadline = String(body?.deadline ?? safe.deadline ?? "").trim();
  safe.notes = String(body?.notes ?? safe.notes ?? "").trim();

  const incomingTargets = body?.targets && typeof body.targets === "object" ? body.targets : {};
  safe.targets = {
    weightKg: String(incomingTargets.weightKg ?? safe.targets.weightKg ?? "").trim(),
    waistCm: String(incomingTargets.waistCm ?? safe.targets.waistCm ?? "").trim(),
    benchKg: String(incomingTargets.benchKg ?? safe.targets.benchKg ?? "").trim(),
    squatKg: String(incomingTargets.squatKg ?? safe.targets.squatKg ?? "").trim(),
    deadliftKg: String(incomingTargets.deadliftKg ?? safe.targets.deadliftKg ?? "").trim(),
    cardioGoal: String(incomingTargets.cardioGoal ?? safe.targets.cardioGoal ?? "").trim(),
  };

  if (Array.isArray(body?.habits)) {
    safe.habits = body.habits
      .map((habit) => ({
        title: String(habit?.title || "").trim(),
        cadence: String(habit?.cadence || "").trim(),
        link: String(habit?.link || "").trim(),
      }))
      .filter((habit) => habit.title);
  }

  return safe;
}

app.get("/api/vision", (req, res) => {
  const profileId = getProfileIdFromRequest(req);
  res.json(readVision(profileId));
});

app.post("/api/vision", (req, res) => {
  const profileId = getProfileIdFromRequest(req);
  try {
    const updated = sanitizeVision(profileId, req.body || {});
    writeVision(profileId, updated);
    res.json({ ok: true, vision: updated, profileId });
  } catch (err) {
    res.status(400).json({ error: err.message || "Ugyldigt vision-data" });
  }
});

app.get("/api/program-blueprint", (req, res) => {
  const profileId = getProfileIdFromRequest(req);
  const meta = getProfileMeta(profileId);
  const blueprint = readProgramBlueprint(meta.id);
  res.json({
    profileId: meta.id,
    profileLabel: meta.label,
    activeProgramId: blueprint?.programId || null,
    blueprint,
  });
});

app.post("/api/program-blueprint", (req, res) => {
  const profileId = getProfileIdFromRequest(req);
  const meta = getProfileMeta(profileId);
  const payload = req.body && typeof req.body === "object" ? req.body : null;
  if (!payload || !payload.goal || !payload.structure) {
    return res.status(400).json({ error: "Blueprint mangler mål og struktur" });
  }
  const toSave = {
    ...payload,
    savedAt: payload.savedAt || new Date().toISOString(),
  };
  writeProgramBlueprint(meta.id, toSave);
  res.json({ ok: true, profileId: meta.id, profileLabel: meta.label, blueprint: toSave });
});

app.get("/api/programs", (req, res) => {
  const profileId = getProfileIdFromRequest(req);
  const meta = getProfileMeta(profileId);
  const archive = readProgramArchive(meta.id);
  res.json({
    profileId: meta.id,
    profileLabel: meta.label,
    activeProgramId: archive.activeProgramId,
    programs: archive.programs.map((entry) => summarizeProgram(entry)),
  });
});

app.get("/api/programs/:programId", (req, res) => {
  const profileId = getProfileIdFromRequest(req);
  const meta = getProfileMeta(profileId);
  const entry = getProgramEntry(meta.id, req.params.programId);
  if (!entry) return res.status(404).json({ error: "Program findes ikke" });
  res.json({ profileId: meta.id, profileLabel: meta.label, program: entry });
});

app.post("/api/programs", (req, res) => {
  const profileId = getProfileIdFromRequest(req);
  const meta = getProfileMeta(profileId);
  try {
    const payload = sanitizeProgramSavePayload(req.body || {});
    const archive = readProgramArchive(meta.id);
    const now = new Date().toISOString();
    const id = payload.programId || randomUUID();
    const entry = {
      id,
      name: payload.name,
      savedAt: now,
      blueprint: { ...payload.blueprint, savedAt: now, programName: payload.name },
    };
    const idx = archive.programs.findIndex((p) => p.id === id);
    if (idx >= 0) archive.programs[idx] = entry;
    else archive.programs.push(entry);
    if (payload.setActive || !archive.activeProgramId) {
      archive.activeProgramId = id;
    }
    writeProgramArchive(meta.id, archive);
    res.json({
      ok: true,
      profileId: meta.id,
      activeProgramId: archive.activeProgramId,
      program: entry,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || "Kunne ikke gemme program" });
  }
});

app.delete("/api/programs/:programId", (req, res) => {
  const profileId = getProfileIdFromRequest(req);
  const meta = getProfileMeta(profileId);
  const archive = readProgramArchive(meta.id);
  const id = req.params.programId;
  const idx = archive.programs.findIndex((p) => p.id === id);
  if (idx < 0) return res.status(404).json({ error: "Program findes ikke" });
  archive.programs.splice(idx, 1);
  if (archive.activeProgramId === id) {
    archive.activeProgramId = archive.programs[0] ? archive.programs[0].id : null;
  }
  writeProgramArchive(meta.id, archive);
  res.json({
    ok: true,
    profileId: meta.id,
    activeProgramId: archive.activeProgramId,
    programs: archive.programs.map((entry) => summarizeProgram(entry)),
  });
});

app.post("/api/programs/:programId/activate", (req, res) => {
  const profileId = getProfileIdFromRequest(req);
  const meta = getProfileMeta(profileId);
  const archive = readProgramArchive(meta.id);
  const id = req.params.programId;
  if (!archive.programs.some((p) => p.id === id)) {
    return res.status(404).json({ error: "Program findes ikke" });
  }
  archive.activeProgramId = id;
  writeProgramArchive(meta.id, archive);
  res.json({
    ok: true,
    profileId: meta.id,
    activeProgramId: archive.activeProgramId,
  });
});

app.post("/api/profile/avatar", express.raw({ limit: "50mb", type: "*/*" }), (req, res) => {
  const profileId = getProfileIdFromRequest(req);
  const originalName = req.headers["x-filename"] || "avatar";
  if (!req.body || !req.body.length) {
    return res.status(400).json({ error: "Tomt upload" });
  }
  try {
    const profileAvatarDir = path.join(AVATAR_DIR, profileId);
    const absPath = resolveUploadPath(profileAvatarDir, originalName);
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
  const profileId = getProfileIdFromRequest(req);
  const date = String(req.query.date || req.headers["x-date"] || "").trim();
  const originalName = req.headers["x-filename"] || "progress";
  if (!date) return res.status(400).json({ error: "Dato mangler" });
  if (!req.body || !req.body.length) return res.status(400).json({ error: "Tomt upload" });
  try {
    const profileProgressDir = path.join(PROGRESS_DIR, profileId);
    const absPath = resolveUploadPath(profileProgressDir, originalName);
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

// Gem én celle tilbage i profilens RM-data
app.post("/api/rm", (req, res) => {
  const profileId = getProfileIdFromRequest(req);
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

  const rmData = readProfileRM(profileId);
  const target = rmData[exerciseKey] ? { ...rmData[exerciseKey] } : {};
  if (value === null || value === "") {
    delete target[r];
  } else {
    const n = Number(value);
    if (!Number.isFinite(n)) return res.status(400).json({ error: "Invalid value" });
    target[r] = n;
  }

  if (Object.keys(target).length) {
    rmData[exerciseKey] = target;
  } else {
    delete rmData[exerciseKey];
  }

  writeProfileRM(profileId, rmData);
  res.json({ ok: true, profileId, rm: rmData[exerciseKey] || {} });
});

app.post("/api/rm-metric", (req, res) => {
  const profileId = getProfileIdFromRequest(req);
  const { exerciseKey, metric, value } = req.body || {};

  if (!exerciseKey || !metric) {
    return res.status(400).json({ error: "Missing exerciseKey/metric" });
  }

  const allowed = EXERCISE_METRICS[exerciseKey];
  if (!allowed || !allowed[metric]) {
    return res.status(400).json({ error: "Metric not allowed for exercise" });
  }

  const metrics = readProfileMetrics(profileId);
  const target = metrics[exerciseKey] ? { ...metrics[exerciseKey] } : {};

  if (value === null || value === "" || value === undefined) {
    delete target[metric];
  } else {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return res.status(400).json({ error: "Invalid metric value" });
    }
    target[metric] = num;
  }

  if (Object.keys(target).length) {
    metrics[exerciseKey] = target;
  } else {
    delete metrics[exerciseKey];
  }

  writeProfileMetrics(profileId, metrics);
  res.json({ ok: true, profileId, metrics: metrics[exerciseKey] || {} });
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

app.get("/common.js", (req, res) => {
  res.type("application/javascript").sendFile(path.join(__dirname, "common.js"));
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

app.get("/profiles", (req, res) => {
  res.sendFile(path.join(__dirname, "profiles.html"));
});

app.get("/vision", (req, res) => {
  res.sendFile(path.join(__dirname, "vision.html"));
});

app.get("/program", (req, res) => {
  res.sendFile(path.join(__dirname, "program.html"));
});

app.get("/programs", (req, res) => {
  res.sendFile(path.join(__dirname, "programs.html"));
});

app.get("/execute", (req, res) => {
  res.sendFile(path.join(__dirname, "execute.html"));
});

app.get("/warmup", (req, res) => {
  res.sendFile(path.join(__dirname, "warmup.html"));
});

app.listen(PORT, () => {
  console.log("Exercise UI running on http://localhost:" + PORT);
});
