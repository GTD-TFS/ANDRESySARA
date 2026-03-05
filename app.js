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
const companionsInput = document.querySelector("input[name='companionsCount']");
const mainDishChoices = document.querySelector("#mainDishChoices");
const formStartTime = Date.now();
const MIN_FORM_FILL_MS = 4000;
const MIN_BETWEEN_SUBMITS_MS = 30000;
const LAST_SUBMIT_KEY = "boda_rsvp_last_submit";
const dishOptions = [
  "Bacalao gratinado con pisto",
  "Canelón de rabo de toro con picada de pistacho"
];

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
  document.querySelector("#eventVenueName").textContent = "Capricho de Calatrava";
  document.querySelector("#eventVenueAddress").textContent = eventVenue.address;
  document.querySelector("#eventVenueMapLink").href = defaultEvent.eventVenue.mapsUrl;
  document.querySelector("#churchTime").textContent = church.time;
  document.querySelector("#churchAddress").textContent = church.address;
  document.querySelector("#churchMapLink").href = church.mapsUrl;
  const stops = Array.isArray(data.transport?.stops) && data.transport.stops.length >= 2
    ? data.transport.stops
    : defaultEvent.transport.stops;
  const [hotelStop, squareStop] = stops;
  document.querySelector("#pickupHotelTime").textContent = hotelStop.time;
  document.querySelector("#pickupHotelAddress").textContent = hotelStop.address;
  document.querySelector("#pickupHotelMapLink").href = defaultEvent.transport.stops[0].mapUrl;
  document.querySelector("#pickupSquareTime").textContent = squareStop.time;
  document.querySelector("#pickupSquareAddress").textContent = squareStop.address;
  document.querySelector("#pickupSquareMapLink").href = squareStop.mapUrl;

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

function buildDishSummary(selections) {
  const counts = new Map();
  selections.forEach((selection) => {
    counts.set(selection, (counts.get(selection) || 0) + 1);
  });
  return [...counts.entries()].map(([dish, count]) => `${dish} x${count}`).join(" | ");
}

function renderMainDishChoices() {
  if (!mainDishChoices || !companionsInput) return;
  const companionsCount = Math.max(0, Math.min(8, Number(companionsInput.value || 0)));
  const totalGuests = companionsCount + 1;
  const previousValues = Array.from(mainDishChoices.querySelectorAll("select")).map((select) => select.value);
  mainDishChoices.innerHTML = "";

  for (let i = 0; i < totalGuests; i += 1) {
    const wrap = document.createElement("div");
    wrap.className = "dish-choice";

    const label = document.createElement("label");
    label.htmlFor = `mainDishChoice${i}`;
    label.textContent = i === 0 ? "Tu plato" : `Plato acompañante ${i}`;

    const select = document.createElement("select");
    select.id = `mainDishChoice${i}`;
    select.name = "mainDishChoice";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Selecciona un plato";
    select.appendChild(placeholder);

    dishOptions.forEach((dish) => {
      const option = document.createElement("option");
      option.value = dish;
      option.textContent = dish;
      select.appendChild(option);
    });

    select.value = previousValues[i] || "";
    wrap.append(label, select);
    mainDishChoices.appendChild(wrap);
  }
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
  const companionsCount = Number(fd.get("companionsCount") || 0);
  const childrenUnder14Count = Number(fd.get("childrenUnder14Count") || 0);
  const mainDishSelections = fd.getAll("mainDishChoice").map((value) => String(value).trim()).filter(Boolean);
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
    companionsCount,
    childrenUnder14Count,
    dietaryRestriction: fd.get("dietaryRestriction") === "on",
    dietaryNotes: String(fd.get("dietaryNotes") || "").trim(),
    busNeeded: attendance === "yes" ? String(fd.get("busNeeded") || "") : "",
    busReturnTime: attendance === "yes" ? String(fd.get("busReturnTime") || "") : "",
    mainDish: attendance === "yes" ? buildDishSummary(mainDishSelections) : "",
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

  if (attendance === "yes" && (mainDishSelections.length !== companionsCount + 1 || !payload.busNeeded || !payload.mainDish)) {
    statusEl.textContent = "Completa transporte y plato principal.";
    submitBtn.disabled = false;
    return;
  }

  try {
    await setDoc(doc(collection(db, "responses"), dedupeKey), payload);
    window.localStorage.setItem(LAST_SUBMIT_KEY, String(Date.now()));
    form.reset();
    renderMainDishChoices();
    statusEl.textContent = "Respuesta registrada. Gracias.";
  } catch (error) {
    statusEl.textContent = "No se pudo enviar. Si ya enviaste, revisaremos tu respuesta en admin.";
    console.error(error);
  } finally {
    submitBtn.disabled = false;
  }
});

companionsInput?.addEventListener("input", renderMainDishChoices);

loadSettings();
renderMainDishChoices();
