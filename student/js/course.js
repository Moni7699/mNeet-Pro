
"use strict";

let coursePageId = "";
let coursePageData = null;

document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(async user => {
        if (!user) { window.location.replace("index.html"); return; }
        coursePageId = getActiveCourse();
        if (!coursePageId) { goTo("courses.html"); return; }
        const access = await hasCourseAccess(coursePageId,user.uid);
        if (!access) { alert("এই course-এর access নেই।"); goTo("courses.html"); return; }
        coursePageData = await getCourse(coursePageId);
        renderCourseHeader();
        loadCourseChapters();
    });
});

function renderCourseHeader() {
    setText("courseTitle",coursePageData?.title || coursePageData?.name || "Biology Course");
    setText("courseDescription",coursePageData?.description || "NEET Biology course");
}

async function loadCourseChapters() {
    const box=document.getElementById("chapterList");
    if(!box) return;
    try {
        const chapters=await getChapters(coursePageId);
        if(!chapters.length){box.innerHTML=`<div class="empty">No chapters added yet.</div>`;return;}
        box.innerHTML=chapters.map((c,i)=>`<button class="chapter-card" onclick="openChapter('${escapeHTML(c.id)}')">
            <span class="chapter-number">${i+1}</span>
            <span><b>${escapeHTML(c.title||c.name||`Chapter ${i+1}`)}</b><small>${escapeHTML(c.description||"Open chapter topics")}</small></span>
            <span>›</span>
        </button>`).join("");
    } catch(e){box.innerHTML=`<div class="empty">Chapters load করা যায়নি।</div>`;}
}

function openChapter(id){setActiveChapter(id);goTo("topic.html");}
