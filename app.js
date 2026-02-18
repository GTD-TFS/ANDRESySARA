import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { firebaseConfig, defaultEvent } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const form = document.querySelector("#rsvpForm");
const statusEl = document.querySelector("#formStatus");
const submitBtn = document.querySelector("#submitBtn");
const attendanceOnly = document.querySelectorAll(".attendance-only");

function setEventUI(data) {
  document.querySelector("#coupleNames").textContent = data.coupleNames;
  const eventDate = new Date(data.eventDate);
  document.querySelector("#eventDateLabel").textContent = eventDate.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).toUpperCase();
  document.querySelector("#saveTheDate").textContent = `Resérvate la fecha, ${eventDate.toLocaleDateString("es-ES")}`;
  document.querySelector("#ceremonyTime").textContent = data.ceremony.time;
  document.querySelector("#ceremonyAddress").textContent = data.ceremony.address;
  document.querySelector("#ceremonyMapLink").href = data.ceremony.mapsUrl;
  document.querySelector("#pickupTime").textContent = data.transport.pickupTime;
  document.querySelector("#pickupAddress").textContent = data.transport.pickupAddress;
  document.querySelector("#pickupMapLink").href = data.transport.pickupMapUrl;

  const diffMs = eventDate.getTime() - Date.now();
  const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  document.querySelector("#daysLeft").textContent = String(days);
}

async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "event"));
    setEventUI(snap.exists() ? snap.data() : defaultEvent);
  } catch {
    setEventUI(defaultEvent);
  }
}

function normalizeText(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function handleAttendanceVisibility(attendance) {
  const show = attendance === "yes";
  attendanceOnly.forEach((block) => {
    block.style.display = show ? "grid" : "none";
  });
}

document.querySelectorAll("input[name='attendance']").forEach((radio) => {
  radio.addEventListener("change", () => handleAttendanceVisibility(radio.value));
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.textContent = "Enviando...";
  submitBtn.disabled = true;

  const fd = new FormData(form);
  const attendance = fd.get("attendance");
  const firstName = String(fd.get("firstName") || "").trim();
  const lastName = String(fd.get("lastName") || "").trim();
  const contactRef = String(fd.get("contactRef") || "").trim();
  const normalizedKey = `${normalizeText(firstName)}|${normalizeText(lastName)}|${normalizeText(contactRef)}`;
  const dedupeKey = await sha256Hex(normalizedKey);

  const payload = {
    createdAt: serverTimestamp(),
    source: "public-form",
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    contactRef,
    attendance,
    companionsCount: Number(fd.get("companionsCount") || 0),
    dietaryRestriction: fd.get("dietaryRestriction") === "on",
    dietaryNotes: String(fd.get("dietaryNotes") || "").trim(),
    busNeeded: attendance === "yes" ? String(fd.get("busNeeded") || "") : "",
    busReturnTime: attendance === "yes" ? String(fd.get("busReturnTime") || "") : "",
    mainDish: attendance === "yes" ? String(fd.get("mainDish") || "") : "",
    songRequest: attendance === "yes" ? String(fd.get("songRequest") || "").trim() : "",
    comments: String(fd.get("comments") || "").trim(),
    dedupeKey,
    status: "active"
  };

  if (!attendance || !firstName || !lastName || !contactRef) {
    statusEl.textContent = "Revisa los campos obligatorios.";
    submitBtn.disabled = false;
    return;
  }

  if (attendance === "yes" && (!payload.busNeeded || !payload.mainDish)) {
    statusEl.textContent = "Completa transporte y plato principal.";
    submitBtn.disabled = false;
    return;
  }

  try {
    await setDoc(doc(collection(db, "responses"), dedupeKey), payload);
    form.reset();
    handleAttendanceVisibility("");
    statusEl.textContent = "Respuesta registrada. Gracias.";
  } catch (error) {
    statusEl.textContent = "No se pudo enviar. Si ya enviaste, revisaremos tu respuesta en admin.";
    console.error(error);
  } finally {
    submitBtn.disabled = false;
  }
});

loadSettings();
handleAttendanceVisibility("");
