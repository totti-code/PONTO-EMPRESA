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

let currentFuncionario = null;

// ✅ NOVO: semana selecionada (segunda-feira ISO)
let semanaSelecionadaISO = null;

async function getFuncionario(){
  const { data: { user } } = await sb().auth.getUser();
  const { data } = await sb()
    .from("funcionarios")
    .select("emp_id, nome")
    .eq("user_id", user.id)
    .maybeSingle();
  return data;
}

function pad(n){ return String(n).padStart(2,"0"); }

function nowDate(){
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

// ✅ NOVO: calcula o último dia real do mês (corrige fevereiro etc.)
function lastDayOfMonthISO(Y, M){
  // M = 1..12
  const last = new Date(Y, M, 0); // dia 0 do mês seguinte = último dia do mês atual
  return `${Y}-${pad(M)}-${pad(last.getDate())}`;
}

// ✅ monthRange baseado no input YYYY-MM (#mesRef) + último dia real do mês
function monthRangeFromInput(){
  const el = $("mesRef");
  const d = new Date();

  const ym = (el && el.value)
    ? el.value
    : `${d.getFullYear()}-${pad(d.getMonth()+1)}`; // "YYYY-MM"

  const [Y, M] = ym.split("-").map(Number);

  const start = `${Y}-${pad(M)}-01`;
  const end = lastDayOfMonthISO(Y, M);

  return { start, end, ano: Y, mes: M };
}

function timeToSeconds(t){
  if(!t) return 0;
  const parts = t.split(":").map(Number);
  return parts[0]*3600 + parts[1]*60 + (parts[2]||0);
}

function secondsToHHMM(sec){
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function secondsToHHMMsigned(sec){
  const sign = sec >= 0 ? "+" : "-";
  const abs = Math.abs(sec);
  return sign + secondsToHHMM(abs);
}

function calcHoras(r){
  if(!r.chegada || !r.saida) return 0;
  let total = timeToSeconds(r.saida) - timeToSeconds(r.chegada);
  if(r.ini_intervalo && r.fim_intervalo){
    total -= timeToSeconds(r.fim_intervalo) - timeToSeconds(r.ini_intervalo);
  }
  return total > 0 ? total : 0;
}

// ====== METAS ======
const META_NORMAL = 9*3600;             // 09:00 (semana normal seg-sex)
const META_SEMANA_SAB = 7*3600 + 20*60; // 07:20 (seg-sex na semana com sábado)
const META_SABADO = 7*3600 + 20*60;     // 07:20 (sábado na semana com sábado)

// ====== FUNÇÕES DE SEMANA (SEGUNDA-FEIRA) ======
function isoToDate(iso){
  const [y,m,d] = iso.split("-").map(Number);
  return new Date(y, m-1, d);
}

// devolve ISO (YYYY-MM-DD) da segunda-feira da semana da dataISO
function mondayOfWeekISO(dateISO){
  const dt = isoToDate(dateISO);
  const day = dt.getDay(); // 0 dom .. 6 sáb
  const diffToMon = (day === 0) ? 6 : (day - 1);
  dt.setDate(dt.getDate() - diffToMon);
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,"0");
  const d = String(dt.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

// ====== CARREGAR/SALVAR ESCALA DA SEMANA ======
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

// cache simples pra não bater no banco toda linha
const escalaCache = new Map();

async function trabalhaSabadoNaSemana(empId, dataISO){
  const semana = mondayOfWeekISO(dataISO);
  const key = `${empId}|${semana}`;
  if(escalaCache.has(key)) return escalaCache.get(key);

  const val = await getEscalaSemana(empId, semana);
  escalaCache.set(key, val);
  return val;
}

// agora metaDoDia vira async
async function metaDoDia(empId, dataISO){
  const d = isoToDate(dataISO).getDay(); // 0 dom .. 6 sáb
  if(d === 0) return 0;

  const semanaSab = await trabalhaSabadoNaSemana(empId, dataISO);

  if(semanaSab){
    return (d === 6) ? META_SABADO : META_SEMANA_SAB;
  } else {
    return (d === 6) ? 0 : META_NORMAL;
  }
}

// ✅ saldo anterior (mês anterior) vindo do resumo_mes
async function getSaldoAnterior(empId, ano, mes){
  // mês anterior
  let a = ano, m = mes - 1;
  if(m === 0){ m = 12; a = ano - 1; }

  const { data, error } = await sb()
    .from("resumo_mes")
    .select("saldo_acum_seg")
    .eq("emp_id", empId)
    .eq("ano", a)
    .eq("mes", m)
    .maybeSingle();

  if(error){
    console.error(error);
    return 0;
  }
  return data?.saldo_acum_seg ?? 0;
}

async function carregarMes(){
  const { start, end, ano, mes } = monthRangeFromInput();

  const { data, error } = await sb()
    .from("pontos")
    .select("*")
    .eq("emp_id", currentFuncionario.emp_id)
    .gte("data", start)
    .lte("data", end)
    .order("data", { ascending: true });

  if(error){
    console.error(error);
    return;
  }

  let totalSegundos = 0;
  let totalExtras = 0; // (mantido, caso você use em outro lugar)
  let dias = 0;

  let saldoAcumulado = 0;
  let totalSaldoPositivo = 0;
  let totalSaldoNegativo = 0;

  const tbody = $("tbodyMes");
  tbody.innerHTML = "";

  for (const r of data) {
    const horas = calcHoras(r);
    if(horas > 0) dias++;

    totalSegundos += horas;

    const meta = await metaDoDia(currentFuncionario.emp_id, r.data);
    if(horas > meta) totalExtras += (horas - meta);

    const saldoDia = horas - meta;
    saldoAcumulado += saldoDia;

    if(saldoDia >= 0) totalSaldoPositivo += saldoDia;
    else totalSaldoNegativo += (-saldoDia);

    tbody.innerHTML += `
      <tr>
        <td>${r.data}</td>
        <td>${r.chegada || "-"}</td>
        <td>${r.saida || "-"}</td>
        <td>${secondsToHHMM(horas)}</td>
        <td>${meta ? secondsToHHMM(meta) : "-"}</td>
        <td class="${saldoDia >= 0 ? "pos" : "neg"}">
          ${meta ? secondsToHHMMsigned(saldoDia) : "-"}
        </td>
        <td class="${saldoAcumulado >= 0 ? "pos" : "neg"}">
          ${meta ? secondsToHHMMsigned(saldoAcumulado) : "-"}
        </td>
      </tr>
    `;
  }

  const saldoAnterior = await getSaldoAnterior(currentFuncionario.emp_id, ano, mes);
  const saldoAcumuladoReal = saldoAnterior + saldoAcumulado;

  $("dias").textContent = dias;
  $("totalHoras").textContent = secondsToHHMM(totalSegundos);

  $("saldoPos").textContent = secondsToHHMM(totalSaldoPositivo);
  $("saldoNeg").textContent = secondsToHHMM(totalSaldoNegativo);

  $("saldoAcum").textContent = secondsToHHMMsigned(saldoAcumuladoReal);

  $("saldoPos").className = "pos";
  $("saldoNeg").className = "neg";
  $("saldoAcum").className = (saldoAcumuladoReal >= 0 ? "pos" : "neg");

  const { error: upsertErr } = await sb().from("resumo_mes").upsert([{
    emp_id: currentFuncionario.emp_id,
    ano,
    mes,
    dias,
    total_segundos: totalSegundos,
    saldo_pos_seg: totalSaldoPositivo,
    saldo_neg_seg: totalSaldoNegativo,
    saldo_acum_seg: saldoAcumuladoReal,
    updated_at: new Date().toISOString()
  }], { onConflict: "emp_id,ano,mes" });

  if(upsertErr){
    console.error("Erro ao upsert resumo_mes:", upsertErr);
  }
}

// ✅ refreshToggle usa a semana selecionada
async function refreshToggle(){
  const semana = semanaSelecionadaISO || mondayOfWeekISO(nowDate());
  const val = await getEscalaSemana(currentFuncionario.emp_id, semana);
  if($("btnToggleSabado")){
    $("btnToggleSabado").textContent = `Trabalhar sábado: ${val ? "SIM" : "NÃO"}`;
  }
}

(async ()=>{
  const ok = await requireLogin();
  if(!ok) return;

  currentFuncionario = await getFuncionario();
  if(!currentFuncionario){
    alert("Usuário não vinculado.");
    return;
  }

  const d = new Date();
  if($("mesRef")){
    $("mesRef").value = `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
  }
  if($("btnAplicarMes")){
    $("btnAplicarMes").onclick = ()=> carregarMes();
  }

  semanaSelecionadaISO = mondayOfWeekISO(nowDate());
  if($("semanaRef")){
    $("semanaRef").value = semanaSelecionadaISO;
  }
  if($("semanaLabel")){
    $("semanaLabel").textContent = `Início: ${semanaSelecionadaISO}`;
  }

  if($("btnAplicarSemana")){
    $("btnAplicarSemana").onclick = async ()=>{
      const v = $("semanaRef").value;
      if(!v) return;
      semanaSelecionadaISO = mondayOfWeekISO(v);
      $("semanaRef").value = semanaSelecionadaISO;
      $("semanaLabel").textContent = `Início: ${semanaSelecionadaISO}`;
      await refreshToggle();
    };
  }

  if($("btnToggleSabado")){
    $("btnToggleSabado").onclick = async ()=>{
      const semana = semanaSelecionadaISO || mondayOfWeekISO(nowDate());
      const atual = await getEscalaSemana(currentFuncionario.emp_id, semana);
      const ok = await setEscalaSemana(currentFuncionario.emp_id, semana, !atual);
      if(ok){
        escalaCache.clear();
        await refreshToggle();
        carregarMes();
      }
    };
  }

  await refreshToggle();
  carregarMes();
})();
