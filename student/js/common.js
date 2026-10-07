/* =========================================================
   COMMON STUDENT FUNCTIONS
========================================================= */

"use strict";

function $(id) {
    return document.getElementById(id);
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function showLoading(element, text = "Loading...") {

    if (!element) return;

    element.innerHTML =
        `<div class="loading-text">${escapeHtml(text)}</div>`;

}


function saveLocal(key, value) {

    try {

        localStorage.setItem(
            key,
            JSON.stringify(value)
        );

    } catch (error) {

        console.error(
            "LocalStorage save error:",
            error
        );

    }

}


function getLocal(key, fallback = null) {

    try {

        const value =
            localStorage.getItem(key);

        if (value === null) {
            return fallback;
        }

        return JSON.parse(value);

    } catch (error) {

        return fallback;

    }

}


function setActiveNav(page) {

    document
        .querySelectorAll(".nav-item")
        .forEach(function(item) {

            item.classList.remove("active");

        });

    const target =
        document.querySelector(
            `[data-page="${page}"]`
        );

    if (target) {
        target.classList.add("active");
    }

}


function goTo(url) {

    window.location.href = url;

}


function openExternal(url) {

    if (!url) return;

    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );

}


function debounce(fn, delay = 300) {

    let timer;

    return function() {

        const context = this;
        const args = arguments;

        clearTimeout(timer);

        timer =
            setTimeout(function() {

                fn.apply(
                    context,
                    args
                );

            }, delay);

    };

}


function formatDate(dateValue) {

    if (!dateValue) {
        return "—";
    }

    let date;

    if (
        dateValue &&
        typeof dateValue.toDate === "function"
    ) {

        date =
            dateValue.toDate();

    } else {

        date =
            new Date(dateValue);

    }

    if (isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


function formatTimestamp(timestamp) {

    if (!timestamp) {
        return "—";
    }

    try {

        const date =
            timestamp.toDate
                ? timestamp.toDate()
                : new Date(timestamp);

        return date.toLocaleString(
            "en-IN"
        );

    } catch (error) {

        return "—";

    }

}
