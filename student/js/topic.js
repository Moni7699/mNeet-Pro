
"use strict";

let topicCourseId="", topicChapterId="";

document.addEventListener("DOMContentLoaded",()=>{
    auth.onAuthStateChanged(async user=>{
        if(!user){goTo("index.html");return;}
        topicCourseId=getActiveCourse();
        topicChapterId=getActiveChapter();
        if(!topicCourseId||!topicChapterId){goTo("courses.html");return;}
        if(!(await hasCourseAccess(topicCourseId,user.uid))){goTo("courses.html");return;}
        await renderTopicPage();
    });
});

async function renderTopicPage(){
    const chapterSnap=await db.collection("courses").doc(topicCourseId).collection("chapters").doc(topicChapterId).get();
    const chapter=chapterSnap.exists?chapterSnap.data():{};
    setText("chapterTitle",chapter.title||chapter.name||"Chapter");
    const topics=await getTopics(topicCourseId,topicChapterId);
    const box=document.getElementById("topicList");
    if(!topics.length){box.innerHTML=`<div class="empty">No topics added yet.</div>`;return;}
    box.innerHTML=topics.map((t,i)=>{
        const notes=!!(t.notesUrl||t.pdfUrl||t.notes||t.pdf);
        const quiz=!!(t.hasQuiz||t.quizId||t.quiz||t.quizzes);
        return `<article class="topic-card">
            <div class="topic-index">${i+1}</div>
            <div class="topic-main"><h3>${escapeHTML(t.title||t.name||`Topic ${i+1}`)}</h3><p>${escapeHTML(t.description||"Practice this topic.")}</p></div>
            <div class="topic-actions">
                <button class="small-btn" onclick="openTopicQuiz('${escapeHTML(t.id)}')">📝 Quiz</button>
                <button class="small-btn secondary" onclick="openTopicNotes('${escapeHTML(t.id)}')">📄 Notes</button>
            </div>
        </article>`;
    }).join("");
}

function openTopicQuiz(id){setActiveTopic(id);setActiveQuiz("");goTo("quiz.html");}
function openTopicNotes(id){setActiveTopic(id);goTo("notes.html");}
