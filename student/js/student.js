
"use strict";

let studentPageUser = null;
let studentPageData = {};

async function initStudentPage() {
    auth.onAuthStateChanged(async function(user) {
        if (!user) { window.location.replace("index.html"); return; }
        studentPageUser = user;
        studentPageData = await getStudentData(user.uid) || {
            name:user.displayName || "Student", email:user.email || ""
        };
        renderStudentIdentity();
        if (typeof loadStudentDashboard === "function") loadStudentDashboard();
    });
}

function renderStudentIdentity() {
    const name = studentPageData.name || studentPageUser.displayName || "Student";
    const email = studentPageData.email || studentPageUser.email || "";
    document.querySelectorAll("[data-student-name]").forEach(e => e.textContent = name);
    document.querySelectorAll("[data-student-email]").forEach(e => e.textContent = email);
    document.querySelectorAll("[data-student-initial]").forEach(e => e.textContent = name.charAt(0).toUpperCase());
}

function applySavedTheme() {
    const dark = getLocal("mneet-theme") === "dark";
    document.body.classList.toggle("dark", dark);
    document.querySelectorAll("[data-theme-text]").forEach(e => e.textContent = dark ? "Light Mode" : "Dark Mode");
}

function toggleTheme() {
    setLocal("mneet-theme", getLocal("mneet-theme") === "dark" ? "light" : "dark");
    applySavedTheme();
}

document.addEventListener("DOMContentLoaded", function() {
    applySavedTheme();
    document.querySelectorAll("[data-logout]").forEach(e => e.addEventListener("click", studentLogout));
    document.querySelectorAll("[data-theme-toggle]").forEach(e => e.addEventListener("click", toggleTheme));
});
