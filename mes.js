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

// ✅ NOVO: monthRange baseado no input YYYY-MM (#mesRef)
function monthRangeFromInput(){
  const el = $("mesRef");
  const d = new Date();

  const ym = (el && el.value)
    ? el.value
    : `${d.getFullYear()}-${pad(d.getMonth()+1)}`; // "YYYY-MM"

  const [Y, M] = ym.split("-").map(Number);

  const start = `${Y}-${pad(M)}-01`;
  const end = `${Y}-${pad(M)}-31`;
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

// ====== METAS / CICLO (AJUSTE) ======
const META_NORMAL = 9*3600;             // 09:00 (seg-sex na semana normal)
const META_SEMANA_SAB = 7*3600 + 20*60; // 07:20 (seg-sex na semana do sábado)
const META_SABADO = 7*3600 + 20*60;     // 07:20 (sábado na semana do sábado)

// escolha uma SEGUNDA-FEIRA que seja o início de uma semana que tem sábado trabalhado
const CICLO_INICIO = "2026-03-02";

function isoToDate(iso){
  const [y,m,d] = iso.split("-").map(Number);
  return new Date(y, m-1, d);
}
function weekDiff(aISO, bISO){
  const a = isoToDate(aISO);
  const b = isoToDate(bISO);
  return Math.floor((b - a) / (7*24*3600*1000));
}
function dow(iso){ return isoToDate(iso).getDay(); } // 0 dom ... 6 sáb
function isSemanaDeSabado(dataISO){
  const w = weekDiff(CICLO_INICIO, dataISO);
  const mod = ((w % 4) + 4) % 4;
  return mod === 0;
}

function metaDoDia(dataISO){
  const d = dow(dataISO);
  const semanaSab = isSemanaDeSabado(dataISO);

  if(d === 0) return 0; // domingo

  if(semanaSab){
    // seg-sab = 07:20
    return (d === 6) ? META_SABADO : META_SEMANA_SAB;
  } else {
    // semana normal: seg-sex 09:00, sábado 0
    return (d === 6) ? 0 : META_NORMAL;
  }
}

async function carregarMes(){
  // ✅ agora lê do input
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

  data.forEach(r=>{
    const horas = calcHoras(r);
    if(horas > 0) dias++;

    totalSegundos += horas;

    const meta = metaDoDia(r.data);
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
  });

  // ✅ preencher tela (resumo)
  $("dias").textContent = dias;
  $("totalHoras").textContent = secondsToHHMM(totalSegundos);

  $("saldoPos").textContent = secondsToHHMM(totalSaldoPositivo);
  $("saldoNeg").textContent = secondsToHHMM(totalSaldoNegativo);
  $("saldoAcum").textContent = secondsToHHMMsigned(saldoAcumulado);

  $("saldoPos").className = "pos";
  $("saldoNeg").className = "neg";
  $("saldoAcum").className = (saldoAcumulado >= 0 ? "pos" : "neg");

  // ✅ NOVO: upsert no final do carregarMes()
  const { error: upsertErr } = await sb().from("resumo_mes").upsert([{
    emp_id: currentFuncionario.emp_id,
    ano,
    mes,
    dias,
    total_segundos: totalSegundos,
    saldo_pos_seg: totalSaldoPositivo,
    saldo_neg_seg: totalSaldoNegativo,
    saldo_acum_seg: saldoAcumulado,
    updated_at: new Date().toISOString()
  }], { onConflict: "emp_id,ano,mes" });

  if(upsertErr){
    console.error("Erro ao upsert resumo_mes:", upsertErr);
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

  // ✅ NOVO: mês padrão = mês atual + botão aplicar
  const d = new Date();
  if($("mesRef")){
    $("mesRef").value = `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
  }
  if($("btnAplicarMes")){
    $("btnAplicarMes").onclick = ()=> carregarMes();
  }

  carregarMes();
})();
