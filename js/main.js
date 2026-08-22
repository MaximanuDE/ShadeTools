const THEME_KEY = "theme";

function getPreferredTheme() {
    const stored = localStorage.getItem(THEME_KEY);

    if (stored === "light" || stored === "dark") {
        return stored;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

function applyTheme(theme) {
    document.documentElement.setAttribute("data-bs-theme", theme);

    const icon = document.querySelector("#themeToggle i");

    if (icon) {
        icon.className = theme === "dark" ? "bi bi-sun" : "bi bi-moon-stars";
    }
}

function setActiveNavLink() {
    const currentPath = window.location.pathname;

    document.querySelectorAll(".nav-link").forEach((link) => {
        const linkPath = new URL(link.getAttribute("href"), window.location.origin).pathname;

        const isActive = linkPath === "/"
            ? currentPath === "/"
            : currentPath === linkPath || currentPath.startsWith(linkPath);

        link.classList.toggle("active", isActive);

        if (isActive) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });
}

function setupScrollReveal() {
    const items = document.querySelectorAll(".reveal");

    if (!items.length) {
        return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!("IntersectionObserver" in window) || prefersReducedMotion) {
        return;
    }

    // Elements only start out hidden once we commit to revealing them —
    // avoids content staying invisible if the observer never fires.
    document.documentElement.setAttribute("data-reveal", "");

    const revealAll = () => items.forEach((item) => item.classList.add("is-visible"));

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

    items.forEach((item) => observer.observe(item));

    window.setTimeout(revealAll, 3000);
}

async function loadComponent(id, path) {
    const element = document.getElementById(id);

    if (!element) {
        return;
    }

    try {
        const response = await fetch(path);

        if (!response.ok) {
            throw new Error(`Failed to load component: ${path}`);
        }

        element.innerHTML = await response.text();

        if (id === "header") {
            applyTheme(getPreferredTheme());
            setActiveNavLink();
        }
    } catch (error) {
        console.error(error);
    }
}

applyTheme(getPreferredTheme());

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!localStorage.getItem(THEME_KEY)) {
        applyTheme(getPreferredTheme());
    }
});

document.addEventListener("click", (event) => {
    const toggle = event.target.closest("#themeToggle");

    if (!toggle) {
        return;
    }

    const next = document.documentElement.getAttribute("data-bs-theme") === "dark"
        ? "light"
        : "dark";

    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
});

document.addEventListener("DOMContentLoaded", () => {
    loadComponent("header", "/components/header.html");
    loadComponent("footer", "/components/footer.html");
    setupScrollReveal();
});
