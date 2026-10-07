
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(async user => {
        if (!user) { window.location.replace("index.html"); return; }
        await renderCoursesPage(user.uid);
    });
});

async function renderCoursesPage(uid) {
    const box = document.getElementById("courseGrid");
    if (!box) return;
    box.innerHTML = `<div class="loading">Loading courses...</div>`;
    try {
        const [courses,purchased] = await Promise.all([getCourses(),getPurchasedCourseIds(uid)]);
        if (!courses.length) { box.innerHTML = `<div class="empty">No courses available.</div>`; return; }
        box.innerHTML = courses.map(c => {
            const access = purchased.includes(c.id);
            const title = c.title || c.name || "Biology Course";
            const desc = c.description || "NEET Biology preparation course.";
            const price = c.price != null ? "₹" + c.price : "Contact";
            return `<article class="course-card">
                <div class="course-cover">🧬</div>
                <div class="course-body">
                    <span class="pill">${access ? "Purchased" : "Locked"}</span>
                    <h3>${escapeHTML(title)}</h3>
                    <p>${escapeHTML(desc)}</p>
                    <strong>${escapeHTML(price)}</strong>
                    <button class="primary-btn" onclick="${access ? `openPurchasedCourse('${escapeHTML(c.id)}')` : `showLockedCourse('${escapeHTML(title)}')`}">
                        ${access ? "Open Course" : "Locked"}
                    </button>
                </div>
            </article>`;
        }).join("");
    } catch(e) { console.error(e); box.innerHTML=`<div class="empty">Courses load করা যায়নি।</div>`; }
}

function openPurchasedCourse(id) { setActiveCourse(id); goTo("course.html"); }
function showLockedCourse(title) { alert(`${title}\n\nএই course এখনো purchase করা হয়নি।`); }
