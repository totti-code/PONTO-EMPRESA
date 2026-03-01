const $ = (id) => document.getElementById(id);
const isAdminPage = location.pathname.includes("admin");

// ===== UTILS =====
function pad(n){ return String(n).padStart(2,"0"); }
function nowDateBR(){
  // dia local do navegador (Brasil)
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function norm(s){ return String(s ?? "").toLowerCase().trim(); }
function isoToBR(iso){
  if(!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return String(iso);
  return `${m[3]}/${m[2]}/${m[1]}`;
}
function fmtTimeBR(ts){
  if(!ts) return "-";
  return new Date(ts).toLocaleTimeString("pt-BR", {
    timeZone: "America/Fortaleza",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function secondsToHHMM(total){
  if(total == null || total < 0) return "";
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
}
function diffSecondsTs(startTs, endTs){
  if(!startTs || !endTs) return null;
  const s = new Date(startTs).getTime();
  const e = new Date(endTs).getTime();
  if(Number.isNaN(s) || Number.isNaN(e)) return null;
  let d = Math.floor((e - s) / 1000);
  if(d < 0) d += 86400;
  return d;
}
function calcHorasTrabalhadasTs(r){
  const total = diffSecondsTs(r.chegada_ts, r.saida_ts);
  if(total == null) return null;
  const intervalo = diffSecondsTs(r.ini_intervalo_ts, r.fim_intervalo_ts);
  return total - (intervalo || 0);
}
function showMsg(text, ok){
  const msg = $("msg");
  if(!msg) return;
  msg.style.color = ok ? "#22c55e" : "#ef4444";
  msg.textContent = text;
  setTimeout(()=> (msg.textContent=""), 2500);
}
function sb(){ return window.supabaseClient; }
function ensureSb(){
  if(!sb()){ console.error("Supabase não inicializado."); return false; }
  return true;
}

// ===== YEAR =====
const yearEl = $("year");
if(yearEl) yearEl.textContent = new Date().getFullYear();

// ===== ADMIN CHECK =====
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

// ===== INDEX CLOCK DISPLAY (apenas visual) =====
const dateEl = $("date");
const timeEl = $("time");
function tickVisualClock(){
  const d = new Date();
  if(dateEl) dateEl.value = nowDateBR();
  if(timeEl){
    // só visual, não é usado pra salvar
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    timeEl.value = `${hh}:${mm}:${ss}`;
  }
}
if(dateEl || timeEl){
  tickVisualClock();
  setInterval(tickVisualClock, 1000);
}

// ===== INDEX: LISTA DE HOJE =====
const todayTbody = $("todayTbody");
const todayLabel = $("todayLabel");
const refreshToday = $("refreshToday");

async function renderToday(){
  if(!todayTbody) return;
  if(!ensureSb()){
    todayTbody.innerHTML = `<tr><td colspan="6">Supabase não inicializado.</td></tr>`;
    return;
  }

  const d = nowDateBR();
  if(todayLabel) todayLabel.textContent = `Dia: ${isoToBR(d)}`;

  const { data, error } = await sb()
    .from("pontos")
    .select("id, emp_id, data, chegada_ts, ini_intervalo_ts, fim_intervalo_ts, saida_ts, funcionarios(nome)")
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
    const horas = secondsToHHMM(calcHorasTrabalhadasTs(r)) || "-";
    return `
      <tr>
        <td class="tdName" title="${nome}">${nome}</td>
        <td>${fmtTimeBR(r.chegada_ts)}</td>
        <td>${fmtTimeBR(r.ini_intervalo_ts)}</td>
        <td>${fmtTimeBR(r.fim_intervalo_ts)}</td>
        <td>${fmtTimeBR(r.saida_ts)}</td>
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

// ===== INDEX: REGISTRAR PONTO (hora do servidor via trigger) =====
const emp = $("emp");

if(emp){
  const MARK = "1970-01-01T00:00:00Z"; // gatilho, o servidor troca por now()

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

      const dataDia = nowDateBR();

      const colunaTs = ({
        CHEGADA: "chegada_ts",
        INI_INTERVALO: "ini_intervalo_ts",
        FIM_INTERVALO: "fim_intervalo_ts",
        SAIDA: "saida_ts",
      })[tipo];

      if(!colunaTs) return showMsg("Tipo inválido.", false);

      // pega a linha do dia
      const { data: existente, error: errSel } = await sb()
        .from("pontos")
        .select("id, chegada_ts, ini_intervalo_ts, fim_intervalo_ts, saida_ts")
        .eq("emp_id", id)
        .eq("data", dataDia)
        .maybeSingle();

      if(errSel){ console.error(errSel); return showMsg("Erro ao buscar registro do dia.", false); }

      // se já tem batida nesse campo
      if(existente && existente[colunaTs]){
        return showMsg("Esse horário já foi registrado.", false);
      }

      let result;
      if(existente){
        // update: manda MARK e o trigger troca por now()
        result = await sb()
          .from("pontos")
          .update({ [colunaTs]: MARK })
          .eq("id", existente.id);
      } else {
        // cria linha do dia com o primeiro ts
        result = await sb()
          .from("pontos")
          .insert([{ emp_id: id, data: dataDia, [colunaTs]: MARK }]);
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

    const d = filterDate?.value || nowDateBR();

    const { data, error } = await sb()
      .from("pontos")
      .select("id, emp_id, data, chegada_ts, ini_intervalo_ts, fim_intervalo_ts, saida_ts, funcionarios(nome)")
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
      const horas = secondsToHHMM(calcHorasTrabalhadasTs(r)) || "-";
      return `
        <tr>
          <td>${isoToBR(r.data ?? "") || "-"}</td>
          <td>#${r.emp_id} — ${nome}</td>
          <td>${fmtTimeBR(r.chegada_ts)}</td>
          <td>${fmtTimeBR(r.ini_intervalo_ts)}</td>
          <td>${fmtTimeBR(r.fim_intervalo_ts)}</td>
          <td>${fmtTimeBR(r.saida_ts)}</td>
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

      if(filterDate && !filterDate.value) filterDate.value = nowDateBR();

      await renderStaff();
      await renderAdminTable();
    } else {
      setStatus("Logado, mas sem permissão (não está na tabela admins).", false);
      if(adminLogin) adminLogin.style.display = "none";
      if(adminLogout) adminLogout.style.display = "inline-flex";
      setAdminUIVisible(false);
    }
  }

  if(adminLogin){
    adminLogin.onclick = async ()=>{
      try{
        const email = String(adminEmail?.value || "").trim();
        const pass = String(adminPass?.value || "").trim();
        if(!email || !pass) return showMsg("Informe email e senha.", false);

        const { error } = await sb().auth.signInWithPassword({ email, password: pass });
        if(error){ console.error(error); return showMsg("Login inválido.", false); }

        showMsg("Logado.", true);
        await syncAuthUI();
      } catch(e){
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
        .select("data, emp_id, chegada_ts, ini_intervalo_ts, fim_intervalo_ts, saida_ts, funcionarios(nome)")
        .order("data", { ascending: false });

      if(error){ console.error(error); return alert("Erro ao exportar."); }
      if(!data?.length) return alert("Sem dados.");

      const header = ["Data","Funcionário","ID","Chegada","Ini intervalo","Fim intervalo","Saída","Horas"];
      const sep = ";";

      const lines = [header.join(sep)].concat(
        data.map(r=>{
          const horas = secondsToHHMM(calcHorasTrabalhadasTs(r)) || "";
          return [
            isoToBR(r.data ?? ""),
            (r.funcionarios?.nome ?? ""),
            (r.emp_id ?? ""),
            fmtTimeBR(r.chegada_ts) === "-" ? "" : fmtTimeBR(r.chegada_ts),
            fmtTimeBR(r.ini_intervalo_ts) === "-" ? "" : fmtTimeBR(r.ini_intervalo_ts),
            fmtTimeBR(r.fim_intervalo_ts) === "-" ? "" : fmtTimeBR(r.fim_intervalo_ts),
            fmtTimeBR(r.saida_ts) === "-" ? "" : fmtTimeBR(r.saida_ts),
            horas
          ].join(sep);
        })
      );

      const blob = new Blob(["\ufeff" + lines.join("\n")], { type:"text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ponto_${nowDateBR()}.csv`;
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
