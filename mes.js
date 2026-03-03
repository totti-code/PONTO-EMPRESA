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

function monthRange(){
  const d = new Date();
  const start = `${d.getFullYear()}-${pad(d.getMonth()+1)}-01`;
  const end = `${d.getFullYear()}-${pad(d.getMonth()+1)}-31`;
  return { start, end };
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

function calcHoras(r){
  if(!r.chegada || !r.saida) return 0;
  let total = timeToSeconds(r.saida) - timeToSeconds(r.chegada);
  if(r.ini_intervalo && r.fim_intervalo){
    total -= timeToSeconds(r.fim_intervalo) - timeToSeconds(r.ini_intervalo);
  }
  return total > 0 ? total : 0;
}

async function carregarMes(){

  const { start, end } = monthRange();

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
  let totalExtras = 0;
  let dias = 0;

  const tbody = $("tbodyMes");
  tbody.innerHTML = "";

  data.forEach(r=>{
    const horas = calcHoras(r);
    if(horas > 0) dias++;

    totalSegundos += horas;

    const cargaDia = 9 * 3600;
    if(horas > cargaDia)
      totalExtras += (horas - cargaDia);

    tbody.innerHTML += `
      <tr>
        <td>${r.data}</td>
        <td>${r.chegada || "-"}</td>
        <td>${r.saida || "-"}</td>
        <td>${secondsToHHMM(horas)}</td>
      </tr>
    `;
  });

  $("dias").textContent = dias;
  $("totalHoras").textContent = secondsToHHMM(totalSegundos);
  $("horasExtras").textContent = secondsToHHMM(totalExtras);
}

(async ()=>{
  const ok = await requireLogin();
  if(!ok) return;

  currentFuncionario = await getFuncionario();
  if(!currentFuncionario){
    alert("Usuário não vinculado.");
    return;
  }

  carregarMes();
})();
