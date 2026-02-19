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
const formStartTime = Date.now();
const MIN_FORM_FILL_MS = 4000;
const MIN_BETWEEN_SUBMITS_MS = 30000;
const LAST_SUBMIT_KEY = "boda_rsvp_last_submit";

function setEventUI(data) {
  document.querySelector("#coupleNames").textContent = data.coupleNames;
  const eventDate = new Date(data.eventDate);
  document.querySelector("#eventDateLabel").textContent = eventDate.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).toUpperCase();
  document.querySelector("#saveTheDate").textContent = `Resérvate la fecha, ${eventDate.toLocaleDateString("es-ES")}`;
  const eventVenue = data.eventVenue || {
    name: defaultEvent.eventVenue.name,
    address: data.ceremony?.address || defaultEvent.eventVenue.address,
    mapsUrl: data.ceremony?.mapsUrl || defaultEvent.eventVenue.mapsUrl
  };
  const church = data.church || {
    time: data.ceremony?.time || defaultEvent.church.time,
    address: defaultEvent.church.address,
    mapsUrl: defaultEvent.church.mapsUrl
  };
  document.querySelector("#eventVenueName").textContent = eventVenue.name || defaultEvent.eventVenue.name;
  document.querySelector("#eventVenueAddress").textContent = eventVenue.address;
  document.querySelector("#eventVenueMapLink").href = eventVenue.mapsUrl;
  document.querySelector("#churchTime").textContent = church.time;
  document.querySelector("#churchAddress").textContent = church.address;
  document.querySelector("#churchMapLink").href = church.mapsUrl;
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.textContent = "Enviando...";
  submitBtn.disabled = true;

  const fd = new FormData(form);
  const hpValue = String(fd.get("website") || "").trim();
  const attendance = fd.get("attendance");
  const firstName = String(fd.get("firstName") || "").trim();
  const lastName = String(fd.get("lastName") || "").trim();
  const contactRef = String(fd.get("contactRef") || "").trim();
  const policeNationalGala = String(fd.get("policeNationalGala") || "");
  const lodgingPlace = String(fd.get("lodgingPlace") || "");
  const normalizedKey = `${normalizeText(firstName)}|${normalizeText(lastName)}|${normalizeText(contactRef)}`;
  const dedupeKey = await sha256Hex(normalizedKey);

  if (hpValue.length > 0) {
    statusEl.textContent = "No se pudo enviar. Inténtalo de nuevo.";
    submitBtn.disabled = false;
    return;
  }

  if (Date.now() - formStartTime < MIN_FORM_FILL_MS) {
    statusEl.textContent = "Espera unos segundos y vuelve a enviar.";
    submitBtn.disabled = false;
    return;
  }

  const lastSubmitAt = Number(window.localStorage.getItem(LAST_SUBMIT_KEY) || 0);
  if (Date.now() - lastSubmitAt < MIN_BETWEEN_SUBMITS_MS) {
    statusEl.textContent = "Has enviado hace un momento. Espera 30 segundos.";
    submitBtn.disabled = false;
    return;
  }

  const payload = {
    createdAt: serverTimestamp(),
    source: "public-form",
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    contactRef,
    attendance,
    policeNationalGala,
    lodgingPlace,
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

  if (!attendance || !firstName || !lastName || !contactRef || !policeNationalGala || !lodgingPlace) {
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
    window.localStorage.setItem(LAST_SUBMIT_KEY, String(Date.now()));
    form.reset();
    statusEl.textContent = "Respuesta registrada. Gracias.";
  } catch (error) {
    statusEl.textContent = "No se pudo enviar. Si ya enviaste, revisaremos tu respuesta en admin.";
    console.error(error);
  } finally {
    submitBtn.disabled = false;
  }
});

loadSettings();
