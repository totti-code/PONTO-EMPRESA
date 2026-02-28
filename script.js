const $ = (id) => document.getElementById(id);

// Detecta página atual
const isAdminPage = location.pathname.includes("admin");

// ===== ADMIN (sessão local simples) =====
const ADMIN_KEY = "ponto_admin_session_v1";
const ADMIN_PASSWORD = "1234"; // 🔐 troque

function loadJSON(key, fallback){
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
function saveJSON(key, val){
  localStorage.setItem(key, JSON.stringify(val));
}
function isAdmin(){
  return loadJSON(ADMIN_KEY, { ok:false }).ok === true;
}
function setAdmin(on){
  saveJSON(ADMIN_KEY, { ok: !!on });
}

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
function norm(s){
  return String(s ?? "").toLowerCase().trim();
}
// aceita "dd/mm/aaaa" ou "yyyy-mm-dd"
function anyDateToISO(v){
  const s = String(v ?? "").trim();
  if(!s) return "";
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!m) return "";
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}
function isoToBR(iso){ // yyyy-mm-dd -> dd/mm/yyyy
  if(!iso) return "";
  const s = String(iso);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function hhmm(t){ // "HH:MM:SS" -> "HH:MM"
  if(!t) return "";
  const s = String(t).split("+")[0];
  const parts = s.split(":");
  if(parts.length < 2) return s;
  return `${parts[0].padStart(2,"0")}:${parts[1].padStart(2,"0")}`;
}

function secondsToHHMMStrict(total){
  if(total == null || total < 0) return "";
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
}

// ===== CALCULO DE HORAS =====
function timeToSeconds(t){
  if(!t) return null;
  t = String(t).split("+")[0];
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
  const intervalo = diffSeconds(r.ini_intervalo, r.fim_intervalo);
  return total - (intervalo || 0);
}

function formatHora(h){
  return h ? String(h).split("+")[0] : "-";
}

// ===== ELEMENTOS (SE EXISTIREM) =====
const emp = $("emp");
const dateEl = $("date");
const timeEl = $("time");
const tbody = $("tbody");
const msg = $("msg");
const exportBtn = $("export");
const yearEl = $("year");

// filtros (só existem na ADMIN agora)
const filter = $("filter");
const filterDate = $("filterDate");

if(yearEl) yearEl.textContent = new Date().getFullYear();

// ✅ por padrão, mostrar apenas o dia atual (no ADMIN)
if (filterDate && !filterDate.value) {
  filterDate.value = nowDate();
}

function showMsg(text, ok){
  if(!msg) return;
  msg.style.color = ok ? "#22c55e" : "#ef4444";
  msg.textContent = text;
  setTimeout(()=> (msg.textContent=""), 2500);
}

// ===== RENDER TABELA (SUPABASE) =====
async function render(){
  if(!tbody) return; // se não tiver tabela, não faz nada

  if(!window.supabaseClient){
    tbody.innerHTML = `<tr><td colspan="8">Supabase não inicializado.</td></tr>`;
    return;
  }

  const dateISO = anyDateToISO(filterDate?.value) || nowDate();

  // ✅ JOIN traz o nome automaticamente
  const { data, error } = await window.supabaseClient
    .from("pontos")
    .select("id, emp_id, data, chegada, ini_intervalo, fim_intervalo, saida, funcionarios(nome)")
    .eq("data", dateISO)
    .order("emp_id", { ascending: true });

  if(error){
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="8">Erro ao carregar dados</td></tr>`;
    return;
  }

  const q = norm(filter?.value);

  const rows = (data || []).filter(r => {
    const nome = r.funcionarios?.nome ?? "";
    return !q || norm(r.emp_id).includes(q) || norm(nome).includes(q);
  });

  tbody.innerHTML = rows.map(r => {
    const horas = secondsToHHMM(calcHorasTrabalhadas(r)) || "-";
    const nome = r.funcionarios?.nome ?? "-";
    return `
      <tr>
        <td>${r.data ?? "-"}</td>
        <td>#${r.emp_id} — ${nome}</td>
        <td>${hhmm(r.chegada) || "-"}</td>
        <td>${hhmm(r.ini_intervalo) || "-"}</td>
        <td>${hhmm(r.fim_intervalo) || "-"}</td>
        <td>${hhmm(r.saida) || "-"}</td>
        <td>${horas}</td>
        <td></td>
      </tr>
    `;
  }).join("");

  if(!rows.length){
    tbody.innerHTML = `<tr><td colspan="8">Nenhum registro encontrado.</td></tr>`;
  }
}

// ===== REGISTRO DE PONTO (INDEX) =====
if (emp) {

  async function addRegistro(tipo) {
    try {
      const id = String(emp.value || "").trim();
      if (!id) return showMsg("Informe seu número (ID).", false);

      if (!window.supabaseClient) {
        return showMsg("Supabase não inicializado.", false);
      }

      // valida funcionário
      const { data: func, error: errFunc } = await window.supabaseClient
        .from("funcionarios")
        .select("emp_id, nome")
        .eq("emp_id", id)
        .maybeSingle();

      if (errFunc) {
        console.error(errFunc);
        return showMsg("Erro ao consultar funcionários.", false);
      }
      if (!func?.nome) {
        return showMsg("ID não cadastrado. Procure o admin.", false);
      }

      const data = nowDate();
      const hora = nowTime();

      const coluna = ({
        CHEGADA: "chegada",
        INI_INTERVALO: "ini_intervalo",
        FIM_INTERVALO: "fim_intervalo",
        SAIDA: "saida",
      })[tipo];

      if (!coluna) return showMsg("Tipo inválido.", false);

      // registro do dia
      const { data: existente, error: errSel } = await window.supabaseClient
        .from("pontos")
        .select("id, chegada, ini_intervalo, fim_intervalo, saida")
        .eq("emp_id", id)
        .eq("data", data)
        .maybeSingle();

      if (errSel) {
        console.error(errSel);
        return showMsg("Erro ao buscar registro do dia.", false);
      }

      if (existente && existente[coluna]) {
        return showMsg("Esse horário já foi registrado.", false);
      }

      let result;
      if (existente) {
        result = await window.supabaseClient
          .from("pontos")
          .update({ [coluna]: hora })
          .eq("id", existente.id);
      } else {
        result = await window.supabaseClient
          .from("pontos")
          .insert([{ emp_id: id, data, [coluna]: hora }]);
      }

      if (result.error) {
        console.error(result.error);
        return showMsg("Erro ao salvar no banco.", false);
      }

      showMsg("Registrado com sucesso!", true);

    } catch (e) {
      console.error(e);
      showMsg("Erro inesperado ao registrar.", false);
    }
  }

  window.addRegistro = addRegistro;

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-type]");
    if (btn) window.addRegistro(btn.dataset.type);
  });

  // relógio só no index (se existir no html)
  setInterval(() => {
    if (dateEl) dateEl.value = nowDate();
    if (timeEl) timeEl.value = nowTime();
  }, 1000);
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
      if(adminLogin) adminLogin.style.display = "none";
      if(adminLogout) adminLogout.style.display = "inline-flex";
    } else {
      adminStatus.textContent = "Admin não logado";
      if(adminLogin) adminLogin.style.display = "inline-flex";
      if(adminLogout) adminLogout.style.display = "none";
    }
  }

  async function renderStaff(){
    if(!adminList) return;

    if(!window.supabaseClient){
      adminList.innerHTML = "Supabase não inicializado.";
      return;
    }

    const { data, error } = await window.supabaseClient
      .from("funcionarios")
      .select("emp_id, nome")
      .order("emp_id", { ascending: true });

    if(error){
      console.error(error);
      adminList.innerHTML = "Erro ao carregar funcionários.";
      return;
    }

    adminList.innerHTML = (data || []).map(f=>`
      <div class="staffRow">
        <div class="staffInfo">
          <b>#${f.emp_id}</b> — ${f.nome}
        </div>
      </div>
    `).join("");
  }

  if(adminLogin){
    adminLogin.onclick = ()=>{
      if(adminPass && adminPass.value === ADMIN_PASSWORD){
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
    adminAdd.onclick = async ()=>{
      if(!isAdmin()) return alert("Faça login como admin.");

      const id = String(adminId?.value || "").trim();
      const nome = String(adminNome?.value || "").trim();
      if(!id || !nome) return alert("Preencha ID e nome.");

      const { error } = await window.supabaseClient
        .from("funcionarios")
        .upsert({ emp_id: id, nome });

      if(error){
        console.error(error);
        return alert("Erro ao salvar funcionário.");
      }

      if(adminId) adminId.value = "";
      if(adminNome) adminNome.value = "";
      await renderStaff();
    };
  }

  updateAdminUI();
  renderStaff();

  // ✅ no admin faz sentido renderizar tabela
  render();
}

// ===== EXPORT CSV (SUPABASE) =====
exportBtn.onclick = async ()=>{
  if(!window.supabaseClient) return alert("Supabase não inicializado.");

  const { data, error } = await window.supabaseClient
    .from("pontos")
    .select("data, emp_id, chegada, ini_intervalo, fim_intervalo, saida, funcionarios(nome)")
    .order("data", { ascending: false });

  if(error){
    console.error(error);
    return alert("Erro ao exportar.");
  }
  if(!data?.length) return alert("Sem dados para exportar.");

  const header = [
    "Data",
    "Funcionário",
    "ID",
    "Chegada",
    "Início intervalo",
    "Fim intervalo",
    "Saída",
    "Horas Trabalhadas"
  ];

  const separator = ";";

  const lines = [header.join(separator)].concat(
    data.map(r => {
      const horas = secondsToHHMMStrict(calcHorasTrabalhadas(r)) || "";
      return [
        isoToBR(r.data ?? ""),                 // dd/mm/aaaa
        (r.funcionarios?.nome ?? ""),          // nome
        (r.emp_id ?? ""),                      // id
        hhmm(r.chegada) || "",                 // HH:MM
        hhmm(r.ini_intervalo) || "",
        hhmm(r.fim_intervalo) || "",
        hhmm(r.saida) || "",
        horas                                  // HH:MM
      ].join(separator);
    })
  );

  const blob = new Blob(["\ufeff" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ponto_${nowDate()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
// ===== LISTENERS DOS FILTROS =====
if(filter){
  filter.addEventListener("input", () => render());
}
if(filterDate){
  filterDate.addEventListener("input", () => render());
  filterDate.addEventListener("change", () => render());
}

// ===== START =====
// ✅ Só renderiza automaticamente se existir tabela (admin)
if(tbody){
  render();
}
