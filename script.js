const $ = (id) => document.getElementById(id);

// detecção confiável
const isAdminPage = !!document.getElementById("adminLogin");
const isIndexPage = !!document.getElementById("emp");

function sb(){ return window.supabaseClient; }
function ensureSb(){
  if(!sb()){
    console.error("Supabase não inicializado.");
    return false;
  }
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
  const parts = String(t).split("+")[0].split(":").map(Number);
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

function showMsgIndex(text, ok){
  const el = $("msgIndex");
  if(!el) return;
  el.style.color = ok ? "#22c55e" : "#ef4444";
  el.textContent = text;
  setTimeout(()=> (el.textContent=""), 2500);
}
function showMsgAdmin(text, ok){
  const el = $("msgAdmin");
  if(!el) return;
  el.style.color = ok ? "#22c55e" : "#ef4444";
  el.textContent = text;
  setTimeout(()=> (el.textContent=""), 4500);
}

// year
const yearEl = $("year");
if(yearEl) yearEl.textContent = new Date().getFullYear();

// relógio visual
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

// ===== INDEX: tabela do dia =====
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
    .select("emp_id, data, chegada, ini_intervalo, fim_intervalo, saida, funcionarios(nome)")
    .eq("data", d)
    .order("emp_id", { ascending: true });

  if(error){
    console.error(error);
    todayTbody.innerHTML = `<tr><td colspan="6">Erro ao carregar.</td></tr>`;
    return;
  }

  const rows = data || [];
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

// ===== INDEX: bater ponto =====
const emp = $("emp");
if(emp){
  async function addRegistro(tipo){
    try{
      if(!ensureSb()) return showMsgIndex("Supabase não inicializado.", false);

      const id = String(emp.value || "").trim();
      if(!id) return showMsgIndex("Informe seu número (ID).", false);

      // valida funcionário
      const { data: func, error: errFunc } = await sb()
        .from("funcionarios")
        .select("emp_id, nome")
        .eq("emp_id", id)
        .maybeSingle();

      if(errFunc){ console.error(errFunc); return showMsgIndex("Erro ao consultar funcionários.", false); }
      if(!func?.nome) return showMsgIndex("ID não cadastrado. Procure o admin.", false);

      const dataDia = nowDate();
      const hora = nowTime();

      const coluna = ({
        CHEGADA: "chegada",
        INI_INTERVALO: "ini_intervalo",
        FIM_INTERVALO: "fim_intervalo",
        SAIDA: "saida",
      })[tipo];

      if(!coluna) return showMsgIndex("Tipo inválido.", false);

      const { data: existente, error: errSel } = await sb()
        .from("pontos")
        .select("id, chegada, ini_intervalo, fim_intervalo, saida")
        .eq("emp_id", id)
        .eq("data", dataDia)
        .maybeSingle();

      if(errSel){ console.error(errSel); return showMsgIndex("Erro ao buscar registro do dia.", false); }

      if(existente && existente[coluna]){
        return showMsgIndex("Esse horário já foi registrado.", false);
      }

      let result;
      if(existente){
        result = await sb().from("pontos").update({ [coluna]: hora }).eq("id", existente.id);
      } else {
        result = await sb().from("pontos").insert([{ emp_id: id, data: dataDia, [coluna]: hora }]);
      }

      if(result.error){ console.error(result.error); return showMsgIndex("Erro ao salvar.", false); }

      showMsgIndex("Registrado com sucesso!", true);
      renderToday();
    } catch(e){
      console.error(e);
      showMsgIndex("Erro inesperado.", false);
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

  const adminId = $("adminId");
  const adminNome = $("adminNome");
  const adminAdd = $("adminAdd");
  const adminList = $("adminList");

  const filter = $("filter");
  const filterDate = $("filterDate");
  const tbody = $("tbody");

  const exportBtn = $("export");
  const clearBtn = $("clear");

  function setAdminUIVisible(on){
    document.querySelectorAll(".adminOnly").forEach(el=>{
      el.style.display = on ? "" : "none";
    });
  }

  async function checkIsAdmin(){
    const { data: sess } = await sb().auth.getSession();
    const user = sess?.session?.user;
    if(!user) return false;

    const { data, error } = await sb()
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if(error){ console.error(error); return false; }
    return !!data?.user_id;
  }

  async function syncAuthUI(){
    const { data: sess } = await sb().auth.getSession();
    const user = sess?.session?.user;

    if(!user){
      adminStatus.textContent = "Não logado.";
      adminLogin.style.display = "inline-flex";
      adminLogout.style.display = "none";
      setAdminUIVisible(false);
      return;
    }

    const ok = await checkIsAdmin();
    if(ok){
      adminStatus.textContent = `Admin: ${user.email || user.id}`;
      adminLogin.style.display = "none";
      adminLogout.style.display = "inline-flex";
      setAdminUIVisible(true);

      if(filterDate && !filterDate.value) filterDate.value = nowDate();
      await renderStaff();
      await renderAdminTable();
    } else {
      adminStatus.textContent = "Logado, mas sem permissão (não está na tabela admins).";
      adminStatus.style.color = "#ef4444";
      adminLogin.style.display = "none";
      adminLogout.style.display = "inline-flex";
      setAdminUIVisible(false);
      showMsgAdmin("Seu UUID precisa estar em public.admins.", false);
    }
  }

  async function renderStaff(){
    if(!adminList) return;

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

    const d = filterDate?.value || nowDate();
    const q = norm(filter?.value);

    const { data, error } = await sb()
      .from("pontos")
      .select("emp_id, data, chegada, ini_intervalo, fim_intervalo, saida, funcionarios(nome)")
      .eq("data", d)
      .order("emp_id", { ascending: true });

    if(error){
      console.error(error);
      tbody.innerHTML = `<tr><td colspan="8">Erro ao carregar</td></tr>`;
      return;
    }

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

  adminLogin.addEventListener("click", async ()=>{
    try{
      const email = String(adminEmail.value || "").trim();
      const pass  = String(adminPass.value  || "").trim();
      if(!email || !pass) return showMsgAdmin("Informe email e senha.", false);

      const res = await sb().auth.signInWithPassword({ email, password: pass });
      if(res.error) return showMsgAdmin(res.error.message || "Login inválido.", false);

      showMsgAdmin("Logado.", true);
      await syncAuthUI();
    } catch(e){
      console.error(e);
      showMsgAdmin("Erro no login.", false);
    }
  });

  adminLogout.addEventListener("click", async ()=>{
    await sb().auth.signOut();
    showMsgAdmin("Saiu.", true);
    await syncAuthUI();
  });

  adminAdd?.addEventListener("click", async ()=>{
    const id = String(adminId.value || "").trim();
    const nome = String(adminNome.value || "").trim();
    if(!id || !nome) return alert("Preencha ID e nome.");

    const { error } = await sb().from("funcionarios").upsert({ emp_id: id, nome });
    if(error){ console.error(error); return alert("Erro ao salvar funcionário."); }

    adminId.value = "";
    adminNome.value = "";
    renderStaff();
  });

  filter?.addEventListener("input", ()=> renderAdminTable());
  filterDate?.addEventListener("change", ()=> renderAdminTable());

  exportBtn?.addEventListener("click", async ()=>{
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
  });

  clearBtn?.addEventListener("click", async ()=>{
    if(!confirm("Apagar TODOS os registros?")) return;
    const { error } = await sb().from("pontos").delete().neq("id", "");
    if(error){ console.error(error); return alert("Erro ao limpar."); }
    alert("Registros apagados.");
    renderAdminTable();
  });

  sb().auth.onAuthStateChange(()=> syncAuthUI());
  syncAuthUI();
}
