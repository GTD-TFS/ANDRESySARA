import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginForm = document.querySelector("#loginForm");
const loginBtn = document.querySelector("#loginBtn");
const emailInput = document.querySelector("#emailInput");
const passwordInput = document.querySelector("#passwordInput");
const logoutBtn = document.querySelector("#logoutBtn");
const exportBtn = document.querySelector("#exportBtn");
const adminStatus = document.querySelector("#adminStatus");
const kpis = document.querySelector("#kpis");
const tableWrap = document.querySelector("#tableWrap");
const cardsWrap = document.querySelector("#cardsWrap");
const body = document.querySelector("#responsesBody");

const editDialog = document.querySelector("#editDialog");
const editForm = document.querySelector("#editForm");
const cancelEditBtn = document.querySelector("#cancelEditBtn");
const editId = document.querySelector("#editId");
const editFullName = document.querySelector("#editFullName");
const editAttendance = document.querySelector("#editAttendance");
const editPoliceNationalGala = document.querySelector("#editPoliceNationalGala");
const editCompanionsCount = document.querySelector("#editCompanionsCount");
const editBusNeeded = document.querySelector("#editBusNeeded");
const editBusReturnTime = document.querySelector("#editBusReturnTime");
const editMainDish = document.querySelector("#editMainDish");
const editSongRequest = document.querySelector("#editSongRequest");
const editDietaryNotes = document.querySelector("#editDietaryNotes");
const editComments = document.querySelector("#editComments");

let unsubscribe = null;
let currentItems = [];

function setStatus(message) {
  adminStatus.textContent = message;
}

function csvEscape(value) {
  const s = String(value ?? "").replaceAll('"', '""');
  return `"${s}"`;
}

function updateKPIs(items) {
  const total = items.length;
  const yes = items.filter((r) => r.attendance === "yes").length;
  const no = items.filter((r) => r.attendance === "no").length;
  const maybe = items.filter((r) => r.attendance === "maybe").length;
  const companions = items.reduce((acc, r) => acc + (Number(r.companionsCount) || 0), 0);
  const busYes = items.filter((r) => r.busNeeded === "yes").length;

  document.querySelector("#kpiTotal").textContent = String(total);
  document.querySelector("#kpiYes").textContent = String(yes);
  document.querySelector("#kpiNo").textContent = String(no);
  document.querySelector("#kpiMaybe").textContent = String(maybe);
  document.querySelector("#kpiCompanions").textContent = String(companions);
  document.querySelector("#kpiBusYes").textContent = String(busYes);
}

function renderRows(items) {
  body.innerHTML = "";
  items.forEach((r) => {
    const tr = document.createElement("tr");
    const created = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString("es-ES") : "-";
    tr.innerHTML = `
      <td>${created}</td>
      <td>${r.fullName ?? ""}</td>
      <td>${r.attendance ?? ""}</td>
      <td>${r.policeNationalGala === "yes" ? "Sí" : "No"}</td>
      <td>${r.companionsCount ?? 0}</td>
      <td>${r.busNeeded ?? ""} ${r.busReturnTime ?? ""}</td>
      <td>${r.mainDish ?? ""}</td>
      <td>${r.songRequest ?? ""}</td>
      <td>${r.dietaryRestriction ? (r.dietaryNotes || "Sí") : "No"}</td>
      <td>
        <button data-action="edit" data-id="${r.id}" type="button">Editar</button>
        <button data-action="delete" data-id="${r.id}" type="button">Eliminar</button>
      </td>
    `;
    body.appendChild(tr);
  });
}

function renderCards(items) {
  cardsWrap.innerHTML = "";
  items.forEach((r) => {
    const created = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString("es-ES") : "-";
    const card = document.createElement("article");
    card.className = "admin-card";
    card.innerHTML = `
      <h3>${r.fullName ?? "Sin nombre"}</h3>
      <p><strong>Fecha:</strong> ${created}</p>
      <p><strong>Asistencia:</strong> ${r.attendance ?? ""}</p>
      <p><strong>Policía Nac. gala:</strong> ${r.policeNationalGala === "yes" ? "Sí" : "No"}</p>
      <p><strong>Acompañantes:</strong> ${r.companionsCount ?? 0}</p>
      <p><strong>Bus:</strong> ${r.busNeeded ?? ""} ${r.busReturnTime ?? ""}</p>
      <p><strong>Plato:</strong> ${r.mainDish ?? ""}</p>
      <p><strong>Música:</strong> ${r.songRequest ?? ""}</p>
      <p><strong>Dieta:</strong> ${r.dietaryRestriction ? (r.dietaryNotes || "Sí") : "No"}</p>
      <p><strong>Comentarios:</strong> ${r.comments ?? ""}</p>
      <div class="admin-card-actions">
        <button data-action="edit" data-id="${r.id}" type="button">Editar</button>
        <button data-action="delete" data-id="${r.id}" type="button">Eliminar</button>
      </div>
    `;
    cardsWrap.appendChild(card);
  });
}

function downloadCsv(items) {
  const headers = [
    "Fecha",
    "Nombre",
    "Asistencia",
    "PoliciaNacionalGala",
    "Acompanantes",
    "BusNecesario",
    "HoraVueltaBus",
    "PlatoPrincipal",
    "Cancion",
    "RestriccionDietetica",
    "DetalleDieta",
    "Comentarios",
    "Contacto"
  ];

  const rows = items.map((r) => [
    r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString("es-ES") : "",
    r.fullName ?? "",
    r.attendance ?? "",
    r.policeNationalGala ?? "",
    r.companionsCount ?? 0,
    r.busNeeded ?? "",
    r.busReturnTime ?? "",
    r.mainDish ?? "",
    r.songRequest ?? "",
    r.dietaryRestriction ? "sí" : "no",
    r.dietaryNotes ?? "",
    r.comments ?? "",
    r.contactRef ?? ""
  ]);

  const csv = [headers, ...rows].map((line) => line.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "invitados-boda.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function openEditDialog(item) {
  editId.value = item.id;
  editFullName.value = item.fullName ?? "";
  editAttendance.value = item.attendance ?? "yes";
  editPoliceNationalGala.value = item.policeNationalGala ?? "no";
  editCompanionsCount.value = String(item.companionsCount ?? 0);
  editBusNeeded.value = item.busNeeded ?? "";
  editBusReturnTime.value = item.busReturnTime ?? "";
  editMainDish.value = item.mainDish ?? "";
  editSongRequest.value = item.songRequest ?? "";
  editDietaryNotes.value = item.dietaryNotes ?? "";
  editComments.value = item.comments ?? "";
  editDialog.showModal();
}

async function handleTableAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const id = button.dataset.id;
  const item = currentItems.find((it) => it.id === id);
  if (!item) return;

  if (action === "edit") {
    openEditDialog(item);
    return;
  }

  if (action === "delete") {
    const ok = window.confirm(`¿Eliminar a ${item.fullName ?? "este invitado"}?`);
    if (!ok) return;
    await deleteDoc(doc(db, "responses", id));
  }
}

async function isAdmin(uid) {
  const adminSnap = await getDoc(doc(db, "admins", uid));
  return adminSnap.exists() && adminSnap.data().enabled === true;
}

function listenResponses() {
  const q = query(collection(db, "responses"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    currentItems = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    updateKPIs(currentItems);
    renderRows(currentItems);
    renderCards(currentItems);
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginForm.style.display = "grid";
    logoutBtn.style.display = "none";
    exportBtn.style.display = "none";
    kpis.style.display = "none";
    tableWrap.style.display = "none";
    cardsWrap.style.display = "none";
    if (unsubscribe) unsubscribe();
    setStatus("Inicia sesión con correo para ver respuestas.");
    return;
  }

  const allowed = await isAdmin(user.uid);
  if (!allowed) {
    setStatus("Tu cuenta no tiene permisos de admin.");
    await signOut(auth);
    return;
  }

  loginForm.style.display = "none";
  logoutBtn.style.display = "inline-block";
  exportBtn.style.display = "inline-block";
  kpis.style.display = "grid";
  tableWrap.style.display = "block";
  cardsWrap.style.display = "grid";
  setStatus(`Sesión activa: ${user.email}`);
  if (unsubscribe) unsubscribe();
  unsubscribe = listenResponses();
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginBtn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
  } catch (error) {
    setStatus("No se pudo iniciar sesión con email/contraseña.");
    console.error(error);
  } finally {
    loginBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

exportBtn.addEventListener("click", () => {
  downloadCsv(currentItems);
});

body.addEventListener("click", (event) => {
  handleTableAction(event).catch((err) => {
    console.error(err);
    setStatus("No se pudo completar la acción.");
  });
});

cardsWrap.addEventListener("click", (event) => {
  handleTableAction(event).catch((err) => {
    console.error(err);
    setStatus("No se pudo completar la acción.");
  });
});

cancelEditBtn.addEventListener("click", () => {
  editDialog.close();
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = editId.value;
  if (!id) return;

  const payload = {
    fullName: editFullName.value.trim(),
    attendance: editAttendance.value,
    policeNationalGala: editPoliceNationalGala.value,
    companionsCount: Number(editCompanionsCount.value || 0),
    busNeeded: editBusNeeded.value,
    busReturnTime: editBusReturnTime.value,
    mainDish: editMainDish.value.trim(),
    songRequest: editSongRequest.value.trim(),
    dietaryRestriction: editDietaryNotes.value.trim().length > 0,
    dietaryNotes: editDietaryNotes.value.trim(),
    comments: editComments.value.trim(),
    status: "edited_by_admin"
  };

  try {
    await updateDoc(doc(db, "responses", id), payload);
    editDialog.close();
    setStatus("Invitado actualizado correctamente.");
  } catch (error) {
    console.error(error);
    setStatus("No se pudo guardar la edición.");
  }
});
