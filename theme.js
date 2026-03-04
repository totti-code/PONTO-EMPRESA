(function(){
  function setTheme(theme){
    const isPink = theme === "pink";
    document.body.classList.toggle("theme-pink", isPink);
    localStorage.setItem("theme", theme);

    const btn = document.getElementById("btnTheme");
    if(btn) btn.textContent = isPink ? "Tema padrão" : "Tema rosa";
  }

  function init(){
    const saved = localStorage.getItem("theme") || "default";
    setTheme(saved);

    const btn = document.getElementById("btnTheme");
    if(btn){
      btn.addEventListener("click", () => {
        const isPink = document.body.classList.contains("theme-pink");
        setTheme(isPink ? "default" : "pink");
      });
    }
  }

  // ✅ funciona tanto antes quanto depois do carregamento da página
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
