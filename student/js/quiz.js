
"use strict";

let quizQuestions=[], quizIndex=0, quizAnswers={}, quizSubmitted=false;
let quizCourse="",quizChapter="",quizTopic="",questionTimer=null,totalTimer=null;
let perQuestionSeconds=60,totalSeconds=0,qLeft=60;

document.addEventListener("DOMContentLoaded",()=>{
    auth.onAuthStateChanged(async user=>{
        if(!user){goTo("index.html");return;}
        quizCourse=getActiveCourse(); quizChapter=getActiveChapter(); quizTopic=getActiveTopic();
        if(!quizCourse||!quizChapter||!quizTopic){goTo("courses.html");return;}
        if(!(await hasCourseAccess(quizCourse,user.uid))){goTo("courses.html");return;}
        quizQuestions=await getQuizQuestions(quizCourse,quizChapter,quizTopic);
        quizQuestions.sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0));
        if(!quizQuestions.length){document.getElementById("quizArea").innerHTML=`<div class="empty">এই topic-এ কোনো question এখনো দেওয়া হয়নি।</div>`;return;}
        totalSeconds=quizQuestions.length*perQuestionSeconds;
        qLeft=perQuestionSeconds;
        renderQuiz();
        startTimers();
    });
});

function renderQuiz(){
    const q=quizQuestions[quizIndex];
    setText("questionNumber",`${quizIndex+1} / ${quizQuestions.length}`);
    setText("questionText",questionText(q));
    const img=document.getElementById("questionImage");
    const imgUrl=questionImage(q);
    if(imgUrl){img.src=imgUrl;img.style.display="block";}else{img.style.display="none";}
    const options=questionOptions(q);
    const box=document.getElementById("options");
    box.innerHTML=options.map((o,i)=>{
        let cls=quizAnswers[quizIndex]===i?"selected":"";
        if(quizSubmitted){
            if(i===correctIndex(q))cls+=" correct";
            else if(quizAnswers[quizIndex]===i)cls+=" wrong";
        }
        return `<button class="option ${cls}" ${quizSubmitted?"disabled":""} onclick="chooseAnswer(${i})">
            <span>${i+1}</span><b>${escapeHTML(o)}</b>
        </button>`;
    }).join("");
    setText("questionTimer",formatSeconds(qLeft));
    setText("totalTimer",formatSeconds(totalSeconds));
    const sol=document.getElementById("solutionBox");
    if(sol){
        if(quizSubmitted && correctIndex(q)!==quizAnswers[quizIndex]){
            const txt=solutionText(q),url=solutionUrl(q);
            sol.innerHTML=`<h3>Solution</h3><p>${escapeHTML(txt||"Solution provided by teacher.")}</p>${url?`<a href="${escapeHTML(url)}" target="_blank" rel="noopener">Open NCERT Reference</a>`:""}`;
            sol.style.display="block";
        }else sol.style.display="none";
    }
}

function chooseAnswer(i){if(quizSubmitted)return;quizAnswers[quizIndex]=i;renderQuiz();}

function nextQuestion(){if(quizIndex<quizQuestions.length-1){quizIndex++;quizSubmitted=false;qLeft=perQuestionSeconds;renderQuiz();}else finishQuiz();}
function previousQuestion(){if(quizIndex>0){quizIndex--;quizSubmitted=false;renderQuiz();}}

function submitCurrentAnswer(){quizSubmitted=true;renderQuiz();}
function formatSeconds(s){s=Math.max(0,Math.floor(s));return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;}

function startTimers(){
    clearInterval(questionTimer);clearInterval(totalTimer);
    qLeft=perQuestionSeconds;
    questionTimer=setInterval(()=>{
        if(quizSubmitted)return;
        qLeft--;setText("questionTimer",formatSeconds(qLeft));
        if(qLeft<=0){quizSubmitted=true;renderQuiz();if(quizIndex<quizQuestions.length-1){setTimeout(()=>{quizIndex++;quizSubmitted=false;qLeft=perQuestionSeconds;renderQuiz();},500);}else finishQuiz();}
    },1000);
    totalTimer=setInterval(()=>{
        totalSeconds--;setText("totalTimer",formatSeconds(totalSeconds));
        if(totalSeconds<=0){finishQuiz();}
    },1000);
}

async function finishQuiz(){
    clearInterval(questionTimer);clearInterval(totalTimer);
    let correct=0,attempted=0;
    quizQuestions.forEach((q,i)=>{
        if(quizAnswers[i]!==undefined){attempted++;if(quizAnswers[i]===correctIndex(q))correct++;}
    });
    const incorrect=attempted-correct, skipped=quizQuestions.length-attempted;
    const accuracy=attempted?Math.round(correct/attempted*100):0;
    const score=correct*4-incorrect;
    const result={score,correct,incorrect,skipped,total:quizQuestions.length,accuracy,courseId:quizCourse,chapterId:quizChapter,topicId:quizTopic};
    setLocal("lastResult",JSON.stringify(result));
    try{
        await saveAttempt(result);
        await saveStudentData({lastScore:score,accuracy:accuracy});
    }catch(e){console.error(e);}
    goTo("result.html");
}
