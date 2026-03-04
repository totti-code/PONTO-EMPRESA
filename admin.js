// ===== helpers base =====
const $ = (id) => document.getElementById(id);
function sb(){ return window.supabaseClient; }

async function requireLogin(){
  const { data } = await sb().auth.getSession();
  if(!data?.session){
    window.location.href = "login.html";
    return false;
  }
  return true;
}

async function isAdmin(){
  const { data: { user } } = await sb().auth.getUser();
  if(!user) return false;

  const { data, error } = await sb()
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if(error){
    console.error(error);
    return false;
  }
  return !!data;
}

async function requireAdmin(){
  const okLogin = await requireLogin();
  if(!okLogin) return false;

  const okAdmin = await isAdmin();
  if(!okAdmin){
    window.location.href = "index.html"; // ou uma tela "sem permissão"
    return false;
  }
  return true;
}

// ===== NOVO: funções Escala (cole abaixo das helpers) =====
function pad(n){ return String(n).padStart(2,"0"); }

function isoToDate(iso){
  const [y,m,d] = iso.split("-").map(Number);
  return new Date(y, m-1, d);
}

function mondayOfWeekISO(dateISO){
  const dt = isoToDate(dateISO);
  const day = dt.getDay(); // 0 dom .. 6 sáb
  const diffToMon = (day === 0) ? 6 : (day - 1);
  dt.setDate(dt.getDate() - diffToMon);
  const y = dt.getFullYear();
  const m = pad(dt.getMonth()+1);
  const d = pad(dt.getDate());
  return `${y}-${m}-${d}`;
}

function showMsg(text, ok){
  const el = document.getElementById("admMsg");
  if(!el) return;
  el.style.color = ok ? "#22c55e" : "#ef4444";
  el.textContent = text;
  setTimeout(()=> (el.textContent=""), 2500);
}

async function loadFuncionariosSelect(){
  const sel = document.getElementById("admEmp");
  if(!sel) return;

  const { data, error } = await sb()
    .from("funcionarios")
    .select("emp_id, nome")
    .order("emp_id", { ascending: true });

  if(error){
    console.error(error);
    sel.innerHTML = `<option value="">Erro ao carregar</option>`;
    return;
  }

  sel.innerHTML =
    `<option value="">Selecione...</option>` +
    (data || []).map(f =>
      `<option value="${f.emp_id}">#${f.emp_id} ${f.nome || ""}</option>`
    ).join("");
}

async function getEscalaSemana(empId, semanaInicioISO){
  const { data, error } = await sb()
    .from("escala_semanal")
    .select("trabalha_sabado")
    .eq("emp_id", empId)
    .eq("semana_inicio", semanaInicioISO)
    .maybeSingle();

  if(error){
    console.error(error);
    return null;
  }
  return data?.trabalha_sabado ?? false;
}

async function setEscalaSemana(empId, semanaInicioISO, trabalhaSabado){
  const { error } = await sb()
    .from("escala_semanal")
    .upsert([{
      emp_id: empId,
      semana_inicio: semanaInicioISO,
      trabalha_sabado: trabalhaSabado,
      updated_at: new Date().toISOString(),
    }], { onConflict: "emp_id,semana_inicio" });

  if(error){
    console.error(error);
    return false;
  }
  return true;
}

async function refreshEscalaUI(){
  const sel = document.getElementById("admEmp");
  const inp = document.getElementById("admSemana");
  const status = document.getElementById("admStatus");
  const btnToggle = document.getElementById("admToggleSabado");

  if(!sel?.value || !inp?.value){
    if(status) status.textContent = "Status: selecione funcionário e semana.";
    if(btnToggle) btnToggle.textContent = "Trabalhar sábado: -";
    if(btnToggle) btnToggle.dataset.val = ""; // limpa
    return;
  }

  const semana = mondayOfWeekISO(inp.value);
  inp.value = semana;

  const val = await getEscalaSemana(sel.value, semana);

  if(status) status.textContent = `Status: semana ${semana} (${val ? "COM sábado" : "SEM sábado"})`;
  if(btnToggle){
    btnToggle.textContent = `Trabalhar sábado: ${val ? "SIM" : "NÃO"}`;
    btnToggle.dataset.val = ""; // estado limpo (sem pendência)
  }
}

async function setupEscalaAdmin(){
  await loadFuncionariosSelect();

  const sel = document.getElementById("admEmp");
  const inp = document.getElementById("admSemana");
  const btnToggle = document.getElementById("admToggleSabado");
  const btnSalvar = document.getElementById("admSalvar");

  if(!sel || !inp || !btnToggle || !btnSalvar){
    console.warn("Elementos do card de escala não encontrados no admin.html");
    return;
  }

  // semana padrão = semana atual
  const d = new Date();
  const hojeISO = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  inp.value = mondayOfWeekISO(hojeISO);

  sel.onchange = ()=> refreshEscalaUI();
  inp.onchange = ()=> refreshEscalaUI();

  btnToggle.onclick = async ()=>{
    if(!sel.value || !inp.value) return showMsg("Selecione funcionário e semana.", false);

    const semana = mondayOfWeekISO(inp.value);

    // se já tem um valor pendente, alterna a partir dele; senão pega do banco
    let base;
    if(btnToggle.dataset.val === "true" || btnToggle.dataset.val === "false"){
      base = (btnToggle.dataset.val === "true");
    } else {
      base = await getEscalaSemana(sel.value, semana);
    }

    const novo = !base;

    // só alterna na tela (não salva ainda)
    btnToggle.dataset.val = novo.toString();
    btnToggle.textContent = `Trabalhar sábado: ${novo ? "SIM" : "NÃO"}`;

    const status = document.getElementById("admStatus");
    if(status) status.textContent = `Status: semana ${semana} (${novo ? "COM sábado" : "SEM sábado"}) (não salvo)`;
  };

  btnSalvar.onclick = async ()=>{
    if(!sel.value || !inp.value) return showMsg("Selecione funcionário e semana.", false);

    const semana = mondayOfWeekISO(inp.value);

    // pega valor desejado (se não clicou no toggle, usa o atual do banco)
    let desejado;
    if(btnToggle.dataset.val === "true" || btnToggle.dataset.val === "false"){
      desejado = (btnToggle.dataset.val === "true");
    } else {
      desejado = await getEscalaSemana(sel.value, semana);
    }

    const ok = await setEscalaSemana(sel.value, semana, desejado);
    if(ok){
      btnToggle.dataset.val = "";
      showMsg("Escala salva!", true);
      await refreshEscalaUI();
    } else {
      showMsg("Erro ao salvar.", false);
    }
  };

  await refreshEscalaUI();
}

// ===== init =====
(async ()=>{
  const ok = await requireAdmin();
  if(!ok) return;

  // ✅ inicializa card de escala
  await setupEscalaAdmin();

  // Logout
  const btnLogout = $("btnLogout");
  if(btnLogout){
    btnLogout.onclick = async ()=>{
      await sb().auth.signOut();
      window.location.href = "login.html";
    };
  }
})();
