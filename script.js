const $ = (id) => document.getElementById(id);

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

// ===== tabela do dia =====
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

// ===== bater ponto =====
const emp = $("emp");
if(emp){
  async function addRegistro(tipo){
    try{
      if(!ensureSb()) return showMsgIndex("Supabase não inicializado.", false);

      const id = String(emp.value || "").trim();
      if(!id) return showMsgIndex("Informe seu número (ID).", false);

      // valida funcionário (você cadastra direto no Supabase)
      const { data: func, error: errFunc } = await sb()
        .from("funcionarios")
        .select("emp_id, nome")
        .eq("emp_id", id)
        .maybeSingle();

      if(errFunc){
        console.error(errFunc);
        return showMsgIndex("Erro ao consultar funcionários.", false);
      }
      if(!func?.nome){
        return showMsgIndex("ID não cadastrado. Procure o responsável.", false);
      }

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

      if(errSel){
        console.error(errSel);
        return showMsgIndex("Erro ao buscar registro do dia.", false);
      }

      if(existente && existente[coluna]){
        return showMsgIndex("Esse horário já foi registrado.", false);
      }

      let result;
      if(existente){
        result = await sb().from("pontos").update({ [coluna]: hora }).eq("id", existente.id);
      } else {
        result = await sb().from("pontos").insert([{ emp_id: id, data: dataDia, [coluna]: hora }]);
      }

      if(result.error){
        console.error(result.error);
        return showMsgIndex("Erro ao salvar.", false);
      }

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
