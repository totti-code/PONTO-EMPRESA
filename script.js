const $ = (id) => document.getElementById(id);

const emp = $("emp");
const dateEl = $("date");
const timeEl = $("time");
const msg = $("msg");
const tbody = $("tbody");
const filter = $("filter");
const filterDate = $("filterDate");
const exportBtn = $("export");
const clearBtn = $("clear");
$("year").textContent = new Date().getFullYear();

const STORAGE_KEY = "ponto_registros_v1";

function pad(n){ return String(n).padStart(2,"0"); }
function nowDate(){
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function nowTime(){
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function load(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch{ return []; }
}
function save(rows){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function setMsg(text, ok=true){
  msg.style.color = ok ? "#22c55e" : "#ef4444";
  msg.textContent = text;
  if(text) setTimeout(()=> msg.textContent="", 2500);
}

function addRegistro(tipo){
  const funcionario = (emp.value || "").trim();
  if(!funcionario) return setMsg("Informe o funcionário (Nome/ID).", false);

  const data = dateEl.value || nowDate();
  const hora = timeEl.value || nowTime();

  const rows = load();
  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    data,
    hora,
    funcionario,
    tipo
  };
  rows.unshift(item);
  save(rows);
  setMsg(`Registrado: ${tipo} — ${funcionario} (${data} ${hora})`, true);
  render();
}

function removeRegistro(id){
  const rows = load().filter(r => r.id !== id);
  save(rows);
  render();
}

function getFiltered(rows){
  const f = (filter.value || "").trim().toLowerCase();
  const d = (filterDate.value || "").trim();
  return rows.filter(r => {
    const okName = !f || r.funcionario.toLowerCase().includes(f);
    const okDate = !d || r.data === d;
    return okName && okDate;
  });
}

function render(){
  const rows = getFiltered(load());
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.data}</td>
      <td>${r.hora}</td>
      <td>${escapeHtml(r.funcionario)}</td>
      <td>${prettyTipo(r.tipo)}</td>
      <td><button class="iconBtn" data-del="${r.id}">Excluir</button></td>
    </tr>
  `).join("") || `<tr><td colspan="5" class="muted">Nenhum registro.</td></tr>`;
}

function prettyTipo(t){
  const map = {
    CHEGADA: "Chegada",
    INI_INTERVALO: "Início intervalo",
    FIM_INTERVALO: "Fim intervalo",
    SAIDA: "Saída"
  };
  return map[t] || t;
}

function escapeHtml(str){
  return str.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
            .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function exportCSV(){
  const rows = getFiltered(load());
  if(!rows.length) return setMsg("Nada para exportar com esses filtros.", false);

  const header = ["data","hora","funcionario","tipo"];
  const lines = [header.join(",")].concat(
    rows.map(r => header.map(k => `"${String(r[k]).replaceAll('"','""')}"`).join(","))
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

// Inicializa data/hora
dateEl.value = nowDate();
timeEl.value = nowTime();
setInterval(()=> { timeEl.value = nowTime(); }, 1000);

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-type]");
  if(btn) addRegistro(btn.dataset.type);

  const del = e.target.closest("button[data-del]");
  if(del) removeRegistro(del.dataset.del);
});

filter.addEventListener("input", render);
filterDate.addEventListener("change", render);
exportBtn.addEventListener("click", exportCSV);

clearBtn.addEventListener("click", () => {
  const ok = confirm("Tem certeza que deseja APAGAR todos os registros deste navegador?");
  if(!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  render();
  setMsg("Registros apagados.", true);
});

render();
