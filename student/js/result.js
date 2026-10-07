
"use strict";

document.addEventListener("DOMContentLoaded",()=>{
    auth.onAuthStateChanged(async user=>{
        if(!user){goTo("index.html");return;}
        renderResult();
    });
});

function renderResult(){
    let data={};
    try{data=JSON.parse(getLocal("lastResult","{}"));}catch(_){}
    setText("resultScore",data.score??0);
    setText("resultCorrect",data.correct??0);
    setText("resultWrong",data.incorrect??0);
    setText("resultSkipped",data.skipped??0);
    setText("resultAccuracy",(data.accuracy??0)+"%");
    setText("resultTotal",data.total??0);
    setText("resultCourse",data.courseId||"");
}

function retryQuiz(){
    if(getLocal("activeTopic","")) goTo("quiz.html"); else goTo("courses.html");
}
