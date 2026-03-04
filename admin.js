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

(async ()=>{
  const ok = await requireAdmin();
  if(!ok) return;

  // Logout
  const btnLogout = $("btnLogout");
  if(btnLogout){
    btnLogout.onclick = async ()=>{
      await sb().auth.signOut();
      window.location.href = "login.html";
    };
  }
})();
