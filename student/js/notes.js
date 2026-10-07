
"use strict";

document.addEventListener("DOMContentLoaded",()=>{
    auth.onAuthStateChanged(async user=>{
        if(!user){goTo("index.html");return;}
        const courseId=getActiveCourse(), chapterId=getActiveChapter(), topicId=getActiveTopic();
        if(!courseId||!chapterId||!topicId){goTo("courses.html");return;}
        if(!(await hasCourseAccess(courseId,user.uid))){goTo("courses.html");return;}
        await renderNotes(courseId,chapterId,topicId);
    });
});

async function renderNotes(courseId,chapterId,topicId){
    const topic=await getTopic(courseId,chapterId,topicId);
    setText("notesTitle",topic?.title||topic?.name||"Topic Notes");
    setText("notesDescription",topic?.description||"Topic notes");
    const url=topic?.notesUrl||topic?.pdfUrl||topic?.notes||topic?.pdf||"";
    const frame=document.getElementById("notesFrame"), empty=document.getElementById("notesEmpty"), open=document.getElementById("openPdf");
    if(url){
        frame.src=url; frame.style.display="block"; empty.style.display="none"; open.href=url; open.style.display="inline-flex";
    }else{
        frame.style.display="none"; empty.style.display="block"; open.style.display="none";
    }
}
