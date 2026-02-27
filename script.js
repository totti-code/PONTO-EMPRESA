const menuBtn = document.getElementById("menuBtn");
const nav = document.getElementById("nav");
const year = document.getElementById("year");
const leadForm = document.getElementById("leadForm");
const whatsBtn = document.getElementById("whatsBtn");
const whatsFloat = document.getElementById("whatsFloat");

// Troque pelo seu WhatsApp (DDD+numero) sem +, espaços ou traços:
const WHATS_NUMBER = "5585999999999";

function buildWhatsLink(message) {
  const text = encodeURIComponent(message);
  return `https://wa.me/${WHATS_NUMBER}?text=${text}`;
}

function setWhatsDefaults() {
  const msg = "Olá! Vim pelo site e gostaria de mais informações.";
  const link = buildWhatsLink(msg);
  whatsBtn.href = link;
  whatsFloat.href = link;
}

menuBtn?.addEventListener("click", () => {
  nav.classList.toggle("open");
});

document.addEventListener("click", (e) => {
  if (!nav.contains(e.target) && e.target !== menuBtn) {
    nav.classList.remove("open");
  }
});

year.textContent = new Date().getFullYear();

setWhatsDefaults();

leadForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(leadForm);
  const nome = data.get("nome");
  const whats = data.get("whats");
  const assunto = data.get("assunto");

  const message =
    `Olá! Meu nome é ${nome}.\n` +
    `Meu WhatsApp: ${whats}\n` +
    `Assunto: ${assunto}\n\n` +
    `Vim pelo site e gostaria de um orçamento.`;

  window.open(buildWhatsLink(message), "_blank");
});
