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
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query
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
const adminStatus = document.querySelector("#adminStatus");
const kpis = document.querySelector("#kpis");
const tableWrap = document.querySelector("#tableWrap");
const body = document.querySelector("#responsesBody");

function setStatus(message) {
  adminStatus.textContent = message;
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
      <td>${r.companionsCount ?? 0}</td>
      <td>${r.busNeeded ?? ""} ${r.busReturnTime ?? ""}</td>
      <td>${r.mainDish ?? ""}</td>
      <td>${r.dietaryRestriction ? (r.dietaryNotes || "Sí") : "No"}</td>
    `;
    body.appendChild(tr);
  });
}

async function isAdmin(uid) {
  const adminSnap = await getDoc(doc(db, "admins", uid));
  return adminSnap.exists() && adminSnap.data().enabled === true;
}

function listenResponses() {
  const q = query(collection(db, "responses"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((d) => d.data());
    updateKPIs(items);
    renderRows(items);
  });
}

let unsubscribe = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginForm.style.display = "grid";
    logoutBtn.style.display = "none";
    kpis.style.display = "none";
    tableWrap.style.display = "none";
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
  kpis.style.display = "grid";
  tableWrap.style.display = "block";
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
