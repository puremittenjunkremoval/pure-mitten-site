const reveals = document.querySelectorAll(".reveal");
const siteNav = document.querySelector(".site-nav");

const updateNavSize = () => {
  if (!siteNav) return;
  siteNav.classList.toggle("nav-compact", window.scrollY > 24);
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
