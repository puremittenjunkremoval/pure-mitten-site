const reveals = document.querySelectorAll(".reveal");
const siteNav = document.querySelector(".site-nav");
const themeToggle = document.querySelector("[data-theme-toggle]");
const navDropdowns = document.querySelectorAll(".nav-dropdown");
let navIsCompact = siteNav?.classList.contains("nav-compact") || false;
let navUpdateFrame = 0;

const setThemeToggleText = () => {
  if (!themeToggle) return;
  const isNight = document.body.classList.contains("night-mode");
  const label = isNight ? "Night Mode" : "Day Mode";
  themeToggle.setAttribute("aria-pressed", String(isNight));
  themeToggle.innerHTML = `<span class="theme-toggle-track" aria-hidden="true"><span class="theme-toggle-thumb"></span><span class="theme-toggle-symbol"></span></span><span class="theme-toggle-text">${label}</span>`;
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
  const shouldBeCompact = navIsCompact ? y > 72 : y > 140;

  if (shouldBeCompact === navIsCompact) return;
  navIsCompact = shouldBeCompact;
  siteNav.classList.toggle("nav-compact", navIsCompact);
};

const scheduleNavSizeUpdate = () => {
  if (navUpdateFrame) return;
  navUpdateFrame = window.requestAnimationFrame(() => {
    navUpdateFrame = 0;
    updateNavSize();
  });
};

updateNavSize();
window.addEventListener("scroll", scheduleNavSizeUpdate, { passive: true });

const closeMobileDropdowns = (except = null) => {
  navDropdowns.forEach((dropdown) => {
    if (dropdown === except) return;
    dropdown.classList.remove("is-open");
    dropdown.querySelector(".nav-dropdown-toggle")?.setAttribute("aria-expanded", "false");
  });
};

navDropdowns.forEach((dropdown) => {
  const toggle = dropdown.querySelector(".nav-dropdown-toggle");
  if (!toggle) return;
  let hoverCloseTimer = 0;

  dropdown.addEventListener("pointerenter", () => {
    if (!window.matchMedia("(min-width: 681px)").matches) return;
    window.clearTimeout(hoverCloseTimer);
    navDropdowns.forEach((otherDropdown) => {
      if (otherDropdown !== dropdown) otherDropdown.classList.remove("is-hover-open");
    });
    dropdown.classList.add("is-hover-open");
  });

  dropdown.addEventListener("pointerleave", () => {
    if (!window.matchMedia("(min-width: 681px)").matches) return;
    window.clearTimeout(hoverCloseTimer);
    hoverCloseTimer = window.setTimeout(() => {
      dropdown.classList.remove("is-hover-open");
    }, 260);
  });

  toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", (event) => {
    if (!window.matchMedia("(max-width: 680px)").matches) return;
    event.preventDefault();

    const willOpen = !dropdown.classList.contains("is-open");
    closeMobileDropdowns(dropdown);
    dropdown.classList.toggle("is-open", willOpen);
    toggle.setAttribute("aria-expanded", String(willOpen));
  });
});

document.addEventListener("click", (event) => {
  if (!window.matchMedia("(max-width: 680px)").matches) return;
  if (!event.target.closest(".nav-dropdown")) closeMobileDropdowns();
});

window.addEventListener("resize", () => {
  navDropdowns.forEach((dropdown) => dropdown.classList.remove("is-hover-open"));
  if (!window.matchMedia("(max-width: 680px)").matches) closeMobileDropdowns();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    navDropdowns.forEach((dropdown) => dropdown.classList.remove("is-hover-open"));
    closeMobileDropdowns();
  }
});

document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
  link.addEventListener("click", () => {
    window.gtag?.("event", "phone_click", { contact_method: "phone" });
  });
});

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
