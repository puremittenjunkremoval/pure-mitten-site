const reveals = document.querySelectorAll(".reveal");
const siteNav = document.querySelector(".site-nav");
const themeToggle = document.querySelector("[data-theme-toggle]");
let navIsCompact = false;

const setThemeToggleText = () => {
  if (!themeToggle) return;
  const isNight = document.body.classList.contains("night-mode");
  const label = isNight ? "Day Mode" : "Night Mode";
  const icon = isNight ? "D" : "N";
  themeToggle.setAttribute("aria-pressed", String(isNight));
  themeToggle.innerHTML = `<span class="theme-toggle-icon" aria-hidden="true">${icon}</span><span>${label}</span>`;
};

const savedTheme = localStorage.getItem("pureMittenTheme");
if (savedTheme === "night") {
  document.body.classList.add("night-mode");
}
setThemeToggleText();

themeToggle?.addEventListener("click", () => {
  document.body.classList.toggle("night-mode");
  localStorage.setItem("pureMittenTheme", document.body.classList.contains("night-mode") ? "night" : "day");
  setThemeToggleText();
});

const updateNavSize = () => {
  if (!siteNav) return;
  const y = window.scrollY || document.documentElement.scrollTop || 0;

  if (!navIsCompact && y > 140) {
    navIsCompact = true;
    siteNav.classList.add("nav-compact");
  } else if (navIsCompact && y < 12) {
    navIsCompact = false;
    siteNav.classList.remove("nav-compact");
  }
};

updateNavSize();
window.addEventListener("scroll", updateNavSize, { passive: true });

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add("visible"), index * 70);
      }
    });
  }, { threshold: 0.12 });

  reveals.forEach((item) => observer.observe(item));
} else {
  reveals.forEach((item) => item.classList.add("visible"));
}
