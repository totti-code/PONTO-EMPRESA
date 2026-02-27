const $ = (id) => document.getElementById(id);

// Detecta página atual
const isAdminPage = location.pathname.includes("admin");

// ===== STORAGE =====
const STORAGE_KEY = "ponto_registros_v5";
const STAFF_KEY   = "ponto_staff_v1";
const ADMIN_KEY   = "ponto_admin_session_v1";
const ADMIN_PASSWORD = "1234"; // 🔐 ALTERE AQUI SUA SENHA

// ===== UTILS =====
function pad(n){ return String(n).padStart(2,"0"); }
function nowDate(){
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function nowTime(){
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function loadJSON(key, fallback){
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
function saveJSON(key, val){
  localStorage.setItem(key, JSON.stringify(val));
}
function makeId(){
  return crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random();
}
function makeId(){
  return crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random();
}

/* ===== CALCULO DE HORAS ===== */

function timeToSeconds(t){
  if(!t) return null;
  const parts = t.split(":").map(Number);
  if(parts.length < 2) return null;
  const [hh, mm, ss = 0] = parts;
  return hh*3600 + mm*60 + ss;
}

function secondsToHHMM(total){
  if(total == null) return "";
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
}

function diffSeconds(start, end){
  const s = timeToSeconds(start);
  const e = timeToSeconds(end);
  if(s == null || e == null) return null;
  let d = e - s;
  if(d < 0) d += 86400;
  return d;
}

function calcHorasTrabalhadas(r){
  const total = diffSeconds(r.chegada, r.saida);
  if(total == null) return null;

  const intervalo = diffSeconds(r.iniIntervalo, r.fimIntervalo);
  return total - (intervalo || 0);
}

function isAdmin(){
  return loadJSON(ADMIN_KEY, { ok:false }).ok === true;
}
function setAdmin(on){
  saveJSON(ADMIN_KEY, { ok: !!on });
}

// ===== ELEMENTOS (SE EXISTIREM) =====
const emp = $("emp");
const dateEl = $("date");
const timeEl = $("time");
const tbody = $("tbody");
const msg = $("msg");
const filter = $("filter");
const filterDate = $("filterDate");
const exportBtn = $("export");
const clearBtn = $("clear");
const yearEl = $("year");

if(yearEl) yearEl.textContent = new Date().getFullYear();

// ===== STAFF =====
function loadStaff(){ return loadJSON(STAFF_KEY, {}); }
function saveStaff(map){ saveJSON(STAFF_KEY, map); }

// ===== REGISTRO DE PONTO (INDEX.HTML) =====
if(emp){

  function fieldByTipo(tipo){
    return {
      CHEGADA: "chegada",
      INI_INTERVALO: "iniIntervalo",
      FIM_INTERVALO: "fimIntervalo",
      SAIDA: "saida"
    }[tipo];
  }

  function addRegistro(tipo){
    const id = String(emp.value || "").trim();
    if(!id) return showMsg("Informe seu número (ID).", false);

    const staff = loadStaff();
    const nome = staff[id];
    if(!nome) return showMsg("ID não cadastrado. Procure o admin.", false);

    const data = nowDate();
    const hora = nowTime();

    const rows = loadJSON(STORAGE_KEY, []);
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
    }

    const campo = fieldByTipo(tipo);
    if(row[campo]){
      return showMsg("Esse horário já foi registrado.", false);
    }

    row[campo] = hora;

    saveJSON(STORAGE_KEY, rows);
    render();
    showMsg("Registrado com sucesso!", true);
  }

  function showMsg(text, ok){
    if(!msg) return;
    msg.style.color = ok ? "#22c55e" : "#ef4444";
    msg.textContent = text;
    setTimeout(()=> msg.textContent="", 2500);
  }

  document.addEventListener("click", e=>{
    const btn = e.target.closest("button[data-type]");
    if(btn) addRegistro(btn.dataset.type);
  });

  setInterval(()=>{
    if(dateEl) dateEl.value = nowDate();
    if(timeEl) timeEl.value = nowTime();
  },1000);
}

// ===== ADMIN PAGE =====
if(isAdminPage){

  const adminPass = $("adminPass");
  const adminLogin = $("adminLogin");
  const adminLogout = $("adminLogout");
  const adminStatus = $("adminStatus");

  const adminId = $("adminId");
  const adminNome = $("adminNome");
  const adminAdd = $("adminAdd");
  const adminList = $("adminList");

  function updateAdminUI(){
    if(!adminStatus) return;
    if(isAdmin()){
      adminStatus.textContent = "Admin logado";
      adminLogin.style.display = "none";
      adminLogout.style.display = "inline-flex";
    } else {
      adminStatus.textContent = "Admin não logado";
      adminLogin.style.display = "inline-flex";
      adminLogout.style.display = "none";
    }
  }

  if(adminLogin){
    adminLogin.onclick = ()=>{
      if(adminPass.value === ADMIN_PASSWORD){
        setAdmin(true);
        updateAdminUI();
      } else {
        alert("Senha incorreta");
      }
    };
  }

  if(adminLogout){
    adminLogout.onclick = ()=>{
      setAdmin(false);
      updateAdminUI();
    };
  }

  if(adminAdd){
    adminAdd.onclick = ()=>{
      if(!isAdmin()) return alert("Faça login como admin.");
      const id = adminId.value.trim();
      const nome = adminNome.value.trim();
      if(!id || !nome) return;
      const staff = loadStaff();
      staff[id] = nome;
      saveStaff(staff);
      adminId.value = "";
      adminNome.value = "";
      renderStaff();
    };
  }

  function renderStaff(){
    if(!adminList) return;
    const staff = loadStaff();
    adminList.innerHTML = Object.keys(staff).map(id=>`
      <div class="staffRow">
        <div class="staffInfo">
          <b>#${id}</b> — ${staff[id]}
        </div>
      </div>
    `).join("");
  }

  updateAdminUI();
  renderStaff();
}

// ===== RENDER TABELA (AMBAS) =====
function render(){
  if(!tbody) return;

  const rows = loadJSON(STORAGE_KEY, []);

  tbody.innerHTML = rows.map(r=>`
    <tr>
      <td>${r.data}</td>
      <td>#${r.empId} — ${r.funcionario}</td>
      <td>${r.chegada || "-"}</td>
      <td>${r.iniIntervalo || "-"}</td>
      <td>${r.fimIntervalo || "-"}</td>
      <td>${r.saida || "-"}</td>
      <td>
        ${isAdmin() ? `
          <button data-edit="${r.id}" class="iconBtn">Editar</button>
          <button data-del="${r.id}" class="iconBtn">Excluir</button>
        ` : ""}
      </td>
    </tr>
  `).join("");
}

document.addEventListener("click", e=>{

  // ===== EXCLUIR =====
  const del = e.target.closest("button[data-del]");
  if(del && isAdmin()){
    let rows = loadJSON(STORAGE_KEY, []);
    rows = rows.filter(r=>r.id !== del.dataset.del);
    saveJSON(STORAGE_KEY, rows);
    render();
  }

  // ===== EDITAR =====
  const edit = e.target.closest("button[data-edit]");
  if(edit && isAdmin()){

    const rowId = edit.dataset.edit;
    const rows = loadJSON(STORAGE_KEY, []);
    const row = rows.find(r => r.id === rowId);
    if(!row) return;

    const campo = prompt(
      "Qual deseja editar?\n1=Chegada\n2=Início intervalo\n3=Fim intervalo\n4=Saída"
    );

    const map = {
      "1": "chegada",
      "2": "iniIntervalo",
      "3": "fimIntervalo",
      "4": "saida"
    };

    const key = map[campo];
    if(!key) return;

    const atual = row[key] || "";
    const novo = prompt("Novo horário (HH:MM:SS)", atual);
    if(novo === null) return;

    if(!/^\d{2}:\d{2}(:\d{2})?$/.test(novo.trim())){
      alert("Formato inválido. Use HH:MM ou HH:MM:SS");
      return;
    }

    row[key] = novo.trim().length === 5 ? novo.trim() + ":00" : novo.trim();

    saveJSON(STORAGE_KEY, rows);
    render();
  }

});

if(clearBtn){
  clearBtn.onclick = ()=>{
    if(!isAdmin()) return alert("Somente admin pode limpar.");
    if(confirm("Apagar todos os registros?")){
      localStorage.removeItem(STORAGE_KEY);
      render();
    }
  };
}

if(exportBtn){
  exportBtn.onclick = ()=>{
    const rows = loadJSON(STORAGE_KEY, []);
    if(!rows.length) return;
    const header = ["data","empId","funcionario","chegada","iniIntervalo","fimIntervalo","saida","horasTrabalhadas"];

const lines = [header.join(",")].concat(
  rows.map(r => {
    const horas = secondsToHHMM(calcHorasTrabalhadas(r)) || "";
    const obj = { ...r, horasTrabalhadas: horas };

    return header.map(k => `"${String(obj[k] ?? "").replaceAll('"','""')}"`).join(",");
  })
);
    const blob = new Blob([lines.join("\n")], {type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ponto_${nowDate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
}

render();
render();

async function testConnection() {
  const { data, error } = await supabase
    .from("pontos")
    .select("*");

  if (error) {
    console.log("Erro:", error);
  } else {
    console.log("Conectado! Dados:", data);
  }
}

testConnection();
