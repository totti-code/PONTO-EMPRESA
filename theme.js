(function(){
  function setTheme(theme){
    const isPink = theme === "pink";
    document.body.classList.toggle("theme-pink", isPink);
    localStorage.setItem("theme", theme);

    const btn = document.getElementById("btnTheme");
    if(btn) btn.textContent = isPink ? "Tema padrão" : "Tema rosa";
  }

  document.addEventListener("DOMContentLoaded", () => {
    const saved = localStorage.getItem("theme") || "default";
    setTheme(saved);

    const btn = document.getElementById("btnTheme");
    if(btn){
      btn.addEventListener("click", () => {
        const current = document.body.classList.contains("theme-pink") ? "pink" : "default";
        setTheme(current === "pink" ? "default" : "pink");
      });
    }
  });
})();
