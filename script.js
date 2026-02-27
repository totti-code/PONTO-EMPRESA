const $ = (id) => document.getElementById(id);

// ====== ELEMENTOS (ponto) ======
const emp = $("emp");         // ID numérico
const dateEl = $("date");
const timeEl = $("time");
const msg = $("msg");
const tbody = $("tbody");
const filter = $("filter");
const filterDate = $("filterDate");
const exportBtn = $("export");
const clearBtn = $("clear");
$("year").textContent = new Date().getFullYear();

// ====== ELEMENTOS (admin) - VOCÊ VAI CRIAR NO HTML ======
const adminPass = $("adminPass");
const adminLoginBtn = $("adminLogin");
const adminLogoutBtn = $("adminLogout");
const adminStatus = $("adminStatus");

const adminId = $("adminId");
const adminNome = $("adminNome");
const adminAddBtn = $("adminAdd");
const adminList = $("adminList");

// ====== STORAGE ======
const STORAGE_KEY = "ponto_registros_v4";
const STAFF_KEY   = "ponto_staff_v1";
const ADMIN_KEY   = "ponto_admin_session_v1";

// ⚠️ SENHA ADMIN (front-end). Troque para a sua.
const ADMIN_PASSWORD = "1234";

function pad(n){ return String(n).padStart(2,"0"); }
function nowDate(){
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function nowTime(){
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function nowDateTime(){
  return { data: nowDate(), hora: nowTime() };
}

function loadJSON(key, fallback){
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
function saveJSON(key, val){
  localStorage.setItem(key, JSON.stringify(val));
}

function setMsg(text, ok=true){
  msg.style.color = ok ? "#22c55e" : "#ef4444";
  msg.textContent = text;
  if(text) setTimeout(()=> msg.textContent="", 2500);
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function makeId(){
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
}

function normalizeId(value){
  return String(value ?? "").trim();
}

// ====== ADMIN SESSION ======
function isAdmin(){
  return loadJSON(ADMIN_KEY, { ok:false }).ok === true;
}

function setAdminMode(on){
  saveJSON(ADMIN_KEY, { ok: !!on });

  // trava/libera campos de data/hora
  // usuário comum: sempre travado; admin: liberado
  dateEl.readOnly = !on;
  timeEl.readOnly = !on;
  dateEl.disabled = !on;
  timeEl.disabled = !on;

  // trava input admin (cadastro)
  adminId.disabled = !on;
  adminNome.disabled = !on;
  adminAddBtn.disabled = !on;
  adminPass.disabled = on; // quando loga, trava senha

  adminLoginBtn.style.display = on ? "none" : "inline-flex";
  adminLogoutBtn.style.display = on ? "inline-flex" : "none";

  adminStatus.textContent = on ? "Modo Admin: ATIVO" : "Modo Admin: DESATIVADO";
}

function adminLogin(){
  const pass = (adminPass.value || "").trim();
  if(pass !== ADMIN_PASSWORD){
    setMsg("Senha de admin incorreta.", false);
    return;
  }
  setAdminMode(true);
  setMsg("Admin logado. Ajustes liberados.", true);
}

function adminLogout(){
  setAdminMode(false);
  adminPass.value = "";
  setMsg("Admin saiu. Ajustes bloqueados.", true);
}

// ====== CADASTRO (ADMIN) ======
function loadStaff(){ return loadJSON(STAFF_KEY, {}); }
function saveStaff(map){ saveJSON(STAFF_KEY, map); }

function addStaff(){
  if(!isAdmin()) return setMsg("Apenas admin pode cadastrar.", false);

  const id = normalizeId(adminId.value);
  const nome = (adminNome.value || "").trim();

  if(!id) return setMsg("Admin: informe o número (ID).", false);
  if(!/^\d+$/.test(id)) return setMsg("Admin: o ID deve conter apenas números.", false);
  if(!nome) return setMsg("Admin: informe o nome.", false);

  const staff = loadStaff();

  if(staff[id] && staff[id].toLowerCase() !== nome.toLowerCase()){
    const ok = confirm(`O ID ${id} já está cadastrado como "${staff[id]}". Deseja alterar para "${nome}"?`);
    if(!ok) return;
  }

  staff[id] = nome;
  saveStaff(staff);

  adminId.value = "";
  adminNome.value = "";
  renderStaff();
  setMsg(`Admin: cadastrado ID ${id} → ${nome}`, true);
}

function removeStaff(id){
  if(!isAdmin()) return setMsg("Apenas admin pode remover cadastro.", false);

  const staff = loadStaff();
  if(!staff[id]) return;

  const ok = confirm(`Remover cadastro do ID ${id} (${staff[id]})?`);
  if(!ok) return;

  delete staff[id];
  saveStaff(staff);
  renderStaff();
  setMsg(`Admin: removido ID ${id}`, true);
}

function renderStaff(){
  const staff = loadStaff();
  const ids = Object.keys(staff).sort((a,b)=> Number(a)-Number(b));

  adminList.innerHTML = ids.map(id => `
    <div class="staffRow">
      <div class="staffInfo">
        <b>#${escapeHtml(id)}</b> — ${escapeHtml(staff[id])}
      </div>
      <button class="iconBtn" data-staff-del="${escapeHtml(id)}" ${isAdmin() ? "" : "disabled"}>Excluir</button>
    </div>
  `).join("") || `<div class="muted">Nenhum funcionário cadastrado.</div>`;
}

// ====== REGISTROS (1 por dia) ======
function loadRows(){ return loadJSON(STORAGE_KEY, []); }
function saveRows(rows){ saveJSON(STORAGE_KEY, rows); }

function fieldByTipo(tipo){
  const map = {
    CHEGADA: "chegada",
    INI_INTERVALO: "iniIntervalo",
    FIM_INTERVALO: "fimIntervalo",
    SAIDA: "saida"
  };
  return map[tipo] || null;
}
function prettyCampo(c){
  const map = {
    chegada: "Chegada",
    iniIntervalo: "Início intervalo",
    fimIntervalo: "Fim intervalo",
    saida: "Saída"
  };
  return map[c] || c;
}

function addRegistro(tipo){
  const id = normalizeId(emp.value);
  if(!id) return setMsg("Informe seu número (ID).", false);
  if(!/^\d+$/.test(id)) return setMsg("O ID deve conter apenas números.", false);

  const staff = loadStaff();
  const nome = staff[id];
  if(!nome){
    return setMsg(`ID ${id} não cadastrado. Procure o admin.`, false);
  }

  const campo = fieldByTipo(tipo);
  if(!campo) return setMsg("Tipo inválido.", false);

  // ✅ data/hora:
  // - usuário comum: SEMPRE pega do computador
  // - admin: pode usar o que estiver no input (ajustado)
  let data, hora;
  if(isAdmin()){
    data = dateEl.value || nowDate();
    hora = timeEl.value || nowTime();
  } else {
    const dt = nowDateTime();
    data = dt.data;
    hora = dt.hora;
  }

  const rows = loadRows();
  let row = rows.find(r => r.empId === id && r.data === data);

  if(!row){
    row = {
      id: makeId(),
      data,
      empId: id,
      funcionario: nome,
      chegada: "",
      iniIntervalo: "",
      fimIntervalo: "",
      saida: ""
    };
    rows.unshift(row);
  } else {
    row.funcionario = nome;
  }

  if(row[campo]){
    return setMsg(`Já existe ${prettyCampo(campo)} para ${nome} (#${id}) em ${data}: ${row[campo]}`, false);
  }

  row[campo] = hora;

  saveRows(rows);
  setMsg(`Registrado: ${prettyCampo(campo)} — ${nome} (#${id}) (${data} ${hora})`, true);
  render();
}

function removeRegistro(rowId){
  if(!isAdmin()) return setMsg("Apenas admin pode excluir registros.", false);

  const rows = loadRows().filter(r => r.id !== rowId);
  saveRows(rows);
  render();
  setMsg("Registro excluído.", true);
}

function getFiltered(rows){
  const f = (filter.value || "").trim().toLowerCase();
  const d = (filterDate.value || "").trim();

  return rows.filter(r => {
    const nome = String(r.funcionario || "").toLowerCase();
    const id = String(r.empId || "").toLowerCase();
    const okName = !f || nome.includes(f) || id.includes(f);
    const okDate = !d || r.data === d;
    return okName && okDate;
  });
}

function render(){
  const rows = getFiltered(loadRows());

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.data}</td>
      <td>#${escapeHtml(r.empId)} — ${escapeHtml(r.funcionario)}</td>
      <td>${r.chegada || "-"}</td>
      <td>${r.iniIntervalo || "-"}</td>
      <td>${r.fimIntervalo || "-"}</td>
      <td>${r.saida || "-"}</td>
      <td><button class="iconBtn" data-del="${r.id}" ${isAdmin() ? "" : "disabled"}>Excluir</button></td>
    </tr>
  `).join("") || `<tr><td colspan="7" class="muted">Nenhum registro.</td></tr>`;
}

function exportCSV(){
  const rows = getFiltered(loadRows());
  if(!rows.length) return setMsg("Nada para exportar com esses filtros.", false);

  const header = ["data","empId","funcionario","chegada","iniIntervalo","fimIntervalo","saida"];
  const lines = [header.join(",")].concat(
    rows.map(r => header.map(k => `"${String(r[k] ?? "").replaceAll('"','""')}"`).join(","))
  );

  const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ponto_${nowDate()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  setMsg("CSV exportado!", true);
}

// ====== INIT ======
function syncClockForUsers(){
  // usuário comum: força sempre o relógio do PC no input (só display)
  if(!isAdmin()){
    dateEl.value = nowDate();
    timeEl.value = nowTime();
  }
}

setInterval(syncClockForUsers, 1000);
filter.addEventListener("input", render);
filterDate.addEventListener("change", render);
exportBtn.addEventListener("click", exportCSV);

clearBtn.addEventListener("click", () => {
  if(!isAdmin()) return setMsg("Apenas admin pode apagar tudo.", false);

  const ok = confirm("Tem certeza que deseja APAGAR todos os registros deste navegador?");
  if(!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  render();
  setMsg("Registros apagados.", true);
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-type]");
  if(btn) addRegistro(btn.dataset.type);

  const del = e.target.closest("button[data-del]");
  if(del) removeRegistro(del.dataset.del);

  const staffDel = e.target.closest("button[data-staff-del]");
  if(staffDel) removeStaff(staffDel.dataset.staffDel);
});

// admin buttons
adminLoginBtn.addEventListener("click", adminLogin);
adminLogoutBtn.addEventListener("click", adminLogout);
adminAddBtn.addEventListener("click", addStaff);

// aplica modo admin salvo (se tiver)
setAdminMode(isAdmin());
syncClockForUsers();
renderStaff();
render();