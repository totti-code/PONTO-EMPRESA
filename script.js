window.__VERSAO_PONTO__ = "TESTE-LOGIN-1";
console.log("✅ script.js carregou:", window.__VERSAO_PONTO__);

const out = document.getElementById("out");
function log(x){
  console.log(x);
  if(out) out.textContent += (typeof x === "string" ? x : JSON.stringify(x, null, 2)) + "\n";
}

function sb(){ return window.supabaseClient; }

log("Iniciando… versão = " + window.__VERSAO_PONTO__);
log("supabaseClient existe? " + (!!sb()));

const btn = document.getElementById("adminLogin");
const emailEl = document.getElementById("adminEmail");
const passEl  = document.getElementById("adminPass");

log("btn existe? " + (!!btn));
log("emailEl existe? " + (!!emailEl));
log("passEl existe? " + (!!passEl));

if(btn){
  btn.addEventListener("click", async () => {
    try{
      log("Clique detectado ✅");

      const email = String(emailEl?.value || "").trim();
      const pass  = String(passEl?.value  || "").trim();
      log("email=" + email);
      log("senhaLen=" + pass.length);

      if(!sb()){
        log("❌ Supabase não inicializado.");
        return;
      }
      if(!email || !pass){
        log("❌ Preencha email e senha.");
        return;
      }

      log("Tentando signInWithPassword…");
      const res = await sb().auth.signInWithPassword({ email, password: pass });
      log(res);

      if(res.error){
        log("❌ ERRO: " + (res.error.message || "erro"));
      } else {
        log("✅ LOGADO! user=" + (res.data?.user?.email || "ok"));
      }
    }catch(e){
      log("💥 EXCEPTION: " + (e?.message || e));
      console.error(e);
    }
  });
}
