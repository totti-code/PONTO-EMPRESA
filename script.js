const $ = (id) => document.getElementById(id);
const isAdminPage = location.pathname.includes("admin");

function sb(){ return window.supabaseClient; }
function ensureSb(){
  if(!sb()){ console.error("Supabase não inicializado."); return false; }
  return true;
}

function pad(n){ return String(n).padStart(2,"0"); }
function nowDate(){
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function nowTime(){
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function isoToBR(iso){
  if(!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return String(iso);
  return `${m[3]}/${m[2]}/${m[1]}`;
}
function norm(s){ return String(s ?? "").toLowerCase().trim(); }

function hhmm(t){
  if(!t) return "";
  const s = String(t).split("+")[0];
  const parts = s.split(":");
  if(parts.length < 2) return s;
  return `${parts[0].padStart(2,"0")}:${parts[1].padStart(2,"0")}`;
}

function timeToSeconds(t){
  if(!t) return null;
  t = String(t).split("+")[0];
  const parts = t.split(":").map(Number);
  if(parts.length < 2) return null;
  const [hh, mm, ss = 0] = parts;
  return hh*3600 + mm*60 + ss;
}
function diffSeconds(start, end){
  const s = timeToSeconds(start);
  const e = timeToSeconds(end);
  if(s == null || e == null) return null;
  let d = e - s;
  if(d < 0) d += 86400;
  return d;
}
function secondsToHHMM(total){
  if(total == null || total < 0) return "";
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
}
function calcHorasTrabalhadas(r){
  const total = diffSeconds(r.chegada, r.saida);
  if(total == null) return null;
  const intervalo = diffSeconds(r.ini_intervalo, r.fim_intervalo);
  return total - (intervalo || 0);
}

function showMsg(text, ok){
  const msg = $("msg");
  if(!msg) return;
  msg.style.color = ok ? "#22c55e" : "#ef4444";
  msg.textContent = text;
  setTimeout(()=> (msg.textContent=""), 2500);
}

// ===== Year =====
const yearEl = $("year");
if(yearEl) yearEl.textContent = new Date().getFullYear();

// ===== Visual clock (só pra mostrar na tela) =====
const dateEl = $("date");
const timeEl = $("time");
function tick(){
  if(dateEl) dateEl.value = nowDate();
  if(timeEl) timeEl.value = nowTime();
}
if(dateEl || timeEl){
  tick();
  setInterval(tick, 1000);
}

// ===== ADMIN CHECK via tabela admins =====
let cachedAdmin = null;
async function checkIsAdmin(){
  if(!ensureSb()) return false;
  const { data: sess } = await sb().auth.getSession();
  const user = sess?.session?.user;
  if(!user) return false;

  if(cachedAdmin === true) return true;
  if(cachedAdmin === false) return false;

  const { data, error } = await sb()
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if(error){ console.error(error); cachedAdmin = false; return false; }
  cachedAdmin = !!data?.user_id;
  return cachedAdmin;
}
function setAdminUIVisible(on){
  document.querySelectorAll(".adminOnly").forEach(el=>{
    el.style.display = on ? "" : "none";
  });
}

// ===== INDEX: Registros de hoje =====
const todayTbody = $("todayTbody");
const todayLabel = $("todayLabel");
const refreshToday = $("refreshToday");

async function renderToday(){
  if(!todayTbody) return;
  if(!ensureSb()){
    todayTbody.innerHTML = `<tr><td colspan="6">Supabase não inicializado.</td></tr>`;
    return;
  }

  const d = nowDate();
  if(todayLabel) todayLabel.textContent = `Dia: ${isoToBR(d)}`;

  const { data, error } = await sb()
    .from("pontos")
    .select("id, emp_id, data, chegada, ini_intervalo, fim_intervalo, saida, funcionarios(nome)")
    .eq("data", d)
    .order("emp_id", { ascending: true });

  if(error){
    console.error(error);
    todayTbody.innerHTML = `<tr><td colspan="6">Erro ao carregar.</td></tr>`;
    return;
  }

  const rows = (data || []);
  if(!rows.length){
    todayTbody.innerHTML = `<tr><td colspan="6">Nenhum registro hoje.</td></tr>`;
    return;
  }

  todayTbody.innerHTML = rows.map(r=>{
    const nome = r.funcionarios?.nome ? `#${r.emp_id} ${r.funcionarios.nome}` : `#${r.emp_id}`;
    const horas = secondsToHHMM(calcHorasTrabalhadas(r)) || "-";
    return `
      <tr>
        <td class="tdName" title="${nome}">${nome}</td>
        <td>${hhmm(r.chegada) || "-"}</td>
        <td>${hhmm(r.ini_intervalo) || "-"}</td>
        <td>${hhmm(r.fim_intervalo) || "-"}</td>
        <td>${hhmm(r.saida) || "-"}</td>
        <td>${horas}</td>
      </tr>
    `;
  }).join("");
}

if(refreshToday) refreshToday.onclick = ()=> renderToday();
if(todayTbody){
  renderToday();
  setInterval(renderToday, 20000);
}

// ===== INDEX: bater ponto (sem mandar hora, só “marca”, trigger troca por hora servidor) =====
const emp = $("emp");
if(emp){
  const MARK = "00:00:00"; // qualquer hora, o trigger substitui pela hora do servidor

  async function addRegistro(tipo){
    try{
      if(!ensureSb()) return showMsg("Supabase não inicializado.", false);

      const id = String(emp.value || "").trim();
      if(!id) return showMsg("Informe seu número (ID).", false);

      // valida funcionário
      const { data: func, error: errFunc } = await sb()
        .from("funcionarios")
        .select("emp_id, nome")
        .eq("emp_id", id)
        .maybeSingle();

      if(errFunc){ console.error(errFunc); return showMsg("Erro ao consultar funcionários.", false); }
      if(!func?.nome) return showMsg("ID não cadastrado. Procure o admin.", false);

      const dataDia = nowDate();

      const coluna = ({
        CHEGADA: "chegada",
        INI_INTERVALO: "ini_intervalo",
        FIM_INTERVALO: "fim_intervalo",
        SAIDA: "saida",
      })[tipo];

      if(!coluna) return showMsg("Tipo inválido.", false);

      // registro do dia
      const { data: existente, error: errSel } = await sb()
        .from("pontos")
        .select("id, chegada, ini_intervalo, fim_intervalo, saida")
        .eq("emp_id", id)
        .eq("data", dataDia)
        .maybeSingle();

      if(errSel){ console.error(errSel); return showMsg("Erro ao buscar registro do dia.", false); }

      if(existente && existente[coluna]){
        return showMsg("Esse horário já foi registrado.", false);
      }

      let result;
      if(existente){
        result = await sb()
          .from("pontos")
          .update({ [coluna]: MARK })
          .eq("id", existente.id);
      } else {
        result = await sb()
          .from("pontos")
          .insert([{ emp_id: id, data: dataDia, [coluna]: MARK }]);
      }

      if(result.error){ console.error(result.error); return showMsg("Erro ao salvar.", false); }

      showMsg("Registrado com sucesso!", true);
      renderToday();
    } catch(e){
      console.error(e);
      showMsg("Erro inesperado.", false);
    }
  }

  window.addRegistro = addRegistro;

  document.addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-type]");
    if(btn) window.addRegistro(btn.dataset.type);
  });
}

// ===== ADMIN PAGE =====
if(isAdminPage){
  const adminEmail = $("adminEmail");
  const adminPass = $("adminPass");
  const adminLogin = $("adminLogin");
  const adminLogout = $("adminLogout");
  const adminStatus = $("adminStatus");

  const filter = $("filter");
  const filterDate = $("filterDate");
  const tbody = $("tbody");
  const exportBtn = $("export");
  const clearBtn = $("clear");

  const adminId = $("adminId");
  const adminNome = $("adminNome");
  const adminAdd = $("adminAdd");
  const adminList = $("adminList");

  function setStatus(text, ok=true){
    if(!adminStatus) return;
    adminStatus.style.color = ok ? "" : "#ef4444";
    adminStatus.textContent = text;
  }

  async function renderStaff(){
    if(!adminList) return;
    const ok = await checkIsAdmin();
    if(!ok){ adminList.innerHTML = "Sem permissão."; return; }

    const { data, error } = await sb()
      .from("funcionarios")
      .select("emp_id, nome")
      .order("emp_id", { ascending: true });

    if(error){ console.error(error); adminList.innerHTML = "Erro ao carregar."; return; }

    adminList.innerHTML = (data || []).map(f=>`
      <div class="staffRow">
        <div class="staffInfo">
          <b>#${f.emp_id}</b> — ${f.nome}
        </div>
      </div>
    `).join("") || `<div class="muted small">Nenhum funcionário cadastrado.</div>`;
  }

  async function renderAdminTable(){
    if(!tbody) return;
    const ok = await checkIsAdmin();
    if(!ok){ tbody.innerHTML = `<tr><td colspan="8">Sem permissão.</td></tr>`; return; }

    const d = filterDate?.value || nowDate();

    const { data, error } = await sb()
      .from("pontos")
      .select("id, emp_id, data, chegada, ini_intervalo, fim_intervalo, saida, funcionarios(nome)")
      .eq("data", d)
      .order("emp_id", { ascending: true });

    if(error){ console.error(error); tbody.innerHTML = `<tr><td colspan="8">Erro ao carregar</td></tr>`; return; }

    const q = norm(filter?.value);
    const rows = (data || []).filter(r=>{
      const nome = r.funcionarios?.nome ?? "";
      return !q || norm(r.emp_id).includes(q) || norm(nome).includes(q);
    });

    tbody.innerHTML = rows.map(r=>{
      const nome = r.funcionarios?.nome ?? "-";
      const horas = secondsToHHMM(calcHorasTrabalhadas(r)) || "-";
      return `
        <tr>
          <td>${isoToBR(r.data ?? "") || "-"}</td>
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

    if(!rows.length) tbody.innerHTML = `<tr><td colspan="8">Nenhum registro.</td></tr>`;
  }

  async function syncAuthUI(){
    if(!ensureSb()) return;

    cachedAdmin = null;
    const { data: sess } = await sb().auth.getSession();
    const user = sess?.session?.user;

    if(!user){
      setStatus("Não logado.");
      if(adminLogin) adminLogin.style.display = "inline-flex";
      if(adminLogout) adminLogout.style.display = "none";
      setAdminUIVisible(false);
      return;
    }

    const ok = await checkIsAdmin();
    if(ok){
      setStatus(`Admin: ${user.email || user.id}`);
      if(adminLogin) adminLogin.style.display = "none";
      if(adminLogout) adminLogout.style.display = "inline-flex";
      setAdminUIVisible(true);

      if(filterDate && !filterDate.value) filterDate.value = nowDate();

      await renderStaff();
      await renderAdminTable();
    } else {
      setStatus("Logado, mas sem permissão (não está na tabela admins).", false);
      if(adminLogin) adminLogin.style.display = "none";
      if(adminLogout) adminLogout.style.display = "inline-flex";
      setAdminUIVisible(false);
    }
  }

  if (adminLogin) {
  adminLogin.onclick = async () => {
    try {
      const email = String(adminEmail?.value || "").trim();
      const pass  = String(adminPass?.value  || "").trim();

      if (!email || !pass) return showMsg("Informe email e senha.", false);

      const { error } = await sb().auth.signInWithPassword({ email, password: pass });

      if (error) {
        console.error(error);
        return showMsg("Login inválido.", false);
      }

      showMsg("Logado.", true);
      await syncAuthUI();
    } catch (e) {
      console.error(e);
      showMsg("Erro no login.", false);
    }
  };
}

  if(adminLogout){
    adminLogout.onclick = async ()=>{
      await sb().auth.signOut();
      showMsg("Saiu.", true);
      await syncAuthUI();
    };
  }

  if(adminAdd){
    adminAdd.onclick = async ()=>{
      const ok = await checkIsAdmin();
      if(!ok) return alert("Sem permissão de admin.");

      const id = String(adminId?.value || "").trim();
      const nome = String(adminNome?.value || "").trim();
      if(!id || !nome) return alert("Preencha ID e nome.");

      const { error } = await sb().from("funcionarios").upsert({ emp_id: id, nome });
      if(error){ console.error(error); return alert("Erro ao salvar funcionário."); }

      if(adminId) adminId.value = "";
      if(adminNome) adminNome.value = "";
      await renderStaff();
    };
  }

  if(filter) filter.addEventListener("input", ()=> renderAdminTable());
  if(filterDate){
    filterDate.addEventListener("input", ()=> renderAdminTable());
    filterDate.addEventListener("change", ()=> renderAdminTable());
  }

  if(exportBtn){
    exportBtn.onclick = async ()=>{
      const ok = await checkIsAdmin();
      if(!ok) return alert("Sem permissão de admin.");

      const { data, error } = await sb()
        .from("pontos")
        .select("data, emp_id, chegada, ini_intervalo, fim_intervalo, saida, funcionarios(nome)")
        .order("data", { ascending: false });

      if(error){ console.error(error); return alert("Erro ao exportar."); }
      if(!data?.length) return alert("Sem dados.");

      const header = ["Data","Funcionário","ID","Chegada","Ini intervalo","Fim intervalo","Saída","Horas"];
      const sep = ";";

      const lines = [header.join(sep)].concat(
        data.map(r=>{
          const horas = secondsToHHMM(calcHorasTrabalhadas(r)) || "";
          return [
            isoToBR(r.data ?? ""),
            (r.funcionarios?.nome ?? ""),
            (r.emp_id ?? ""),
            hhmm(r.chegada) || "",
            hhmm(r.ini_intervalo) || "",
            hhmm(r.fim_intervalo) || "",
            hhmm(r.saida) || "",
            horas
          ].join(sep);
        })
      );

      const blob = new Blob(["\ufeff" + lines.join("\n")], { type:"text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ponto_${nowDate()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };
  }

  if(clearBtn){
    clearBtn.onclick = async ()=>{
      const ok = await checkIsAdmin();
      if(!ok) return alert("Sem permissão de admin.");
      if(!confirm("Apagar TODOS os registros?")) return;

      const { error } = await sb().from("pontos").delete().neq("id", "");
      if(error){ console.error(error); alert("Erro ao limpar."); }
      else { alert("Registros apagados."); renderAdminTable(); }
    };
  }

  sb()?.auth?.onAuthStateChange(()=> syncAuthUI());
  syncAuthUI();
}
