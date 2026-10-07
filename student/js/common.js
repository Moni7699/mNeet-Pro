/* =====================================================
   mNEET-PRO
   COMMON STUDENT FUNCTIONS
===================================================== */

"use strict";


/* =====================================================
   HTML ESCAPE
===================================================== */

function escapeHtml(value){

    return String(value ?? "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#039;");

}


/* =====================================================
   AUTH REQUIRED
===================================================== */

function requireLogin(){

    return new Promise(
        function(resolve){

            auth.onAuthStateChanged(
                function(user){

                    if(!user){

                        window.location.replace(
                            "index.html"
                        );

                        return;

                    }

                    resolve(user);

                }
            );

        }
    );

}


/* =====================================================
   LOGOUT
===================================================== */

async function logoutStudent(){

    const ok =
        confirm(
            "আপনি কি logout করতে চান?"
        );

    if(!ok){
        return;
    }

    try{

        await auth.signOut();

        localStorage.removeItem(
            "activeCourse"
        );

        localStorage.removeItem(
            "activeTopic"
        );

        window.location.replace(
            "index.html"
        );

    }catch(error){

        console.error(
            "Logout error:",
            error
        );

        alert(
            "Logout করা যায়নি। আবার চেষ্টা করুন।"
        );

    }

}


/* =====================================================
   SAVE ACTIVE COURSE
===================================================== */

function setActiveCourse(courseId){

    if(!courseId){
        return;
    }

    localStorage.setItem(
        "activeCourse",
        courseId
    );

}


/* =====================================================
   GET ACTIVE COURSE
===================================================== */

function getActiveCourse(){

    return localStorage.getItem(
        "activeCourse"
    ) || "";

}


/* =====================================================
   SAVE ACTIVE TOPIC
===================================================== */

function setActiveTopic(topicId){

    if(!topicId){
        return;
    }

    localStorage.setItem(
        "activeTopic",
        topicId
    );

}


/* =====================================================
   GET ACTIVE TOPIC
===================================================== */

function getActiveTopic(){

    return localStorage.getItem(
        "activeTopic"
    ) || "";

}


/* =====================================================
   OPEN EXTERNAL
===================================================== */

function openExternal(url){

    if(!url){
        return;
    }

    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );

}


/* =====================================================
   FORMAT DATE
===================================================== */

function formatDate(value){

    if(!value){
        return "";
    }

    let date;

    if(
        value &&
        typeof value.toDate === "function"
    ){

        date =
            value.toDate();

    }else{

        date =
            new Date(value);

    }

    if(
        Number.isNaN(
            date.getTime()
        )
    ){

        return "";

    }

    return date.toLocaleDateString(
        "en-IN",
        {
            day:"2-digit",
            month:"short",
            year:"numeric"
        }
    );

}


/* =====================================================
   FORMAT TIME
===================================================== */

function formatTime(value){

    if(!value){
        return "";
    }

    let date;

    if(
        value &&
        typeof value.toDate === "function"
    ){

        date =
            value.toDate();

    }else{

        date =
            new Date(value);

    }

    if(
        Number.isNaN(
            date.getTime()
        )
    ){

        return "";

    }

    return date.toLocaleTimeString(
        "en-IN",
        {
            hour:"2-digit",
            minute:"2-digit"
        }
    );

}


/* =====================================================
   DARK MODE
===================================================== */

function loadTheme(){

    const theme =
        localStorage.getItem(
            "mneet-theme"
        );

    if(theme === "dark"){

        document.body.classList.add(
            "dark-mode"
        );

    }else{

        document.body.classList.remove(
            "dark-mode"
        );

    }

    updateThemeUI();

}


/* =====================================================
   TOGGLE THEME
===================================================== */

function toggleTheme(){

    const dark =
        document.body.classList.toggle(
            "dark-mode"
        );

    localStorage.setItem(
        "mneet-theme",
        dark
            ? "dark"
            : "light"
    );

    updateThemeUI();

}


/* =====================================================
   THEME UI
===================================================== */

function updateThemeUI(){

    const icon =
        document.getElementById(
            "themeIcon"
        );

    const text =
        document.getElementById(
            "themeText"
        );

    if(!icon || !text){
        return;
    }

    const dark =
        document.body.classList.contains(
            "dark-mode"
        );

    if(dark){

        icon.textContent =
            "☀️";

        text.textContent =
            "White Mode";

    }else{

        icon.textContent =
            "🌙";

        text.textContent =
            "Dark Mode";

    }

}


/* =====================================================
   PROFILE NAVIGATION
===================================================== */

function openProfile(){

    window.location.href =
        "profile.html";

}


/* =====================================================
   COURSES NAVIGATION
===================================================== */

function goCourses(){

    window.location.href =
        "courses.html";

}


/* =====================================================
   HOME
===================================================== */

function goHome(){

    window.location.href =
        "dashboard.html";

}


/* =====================================================
   NOTIFICATIONS
===================================================== */

function goNotifications(){

    window.location.href =
        "notifications.html";

}


/* =====================================================
   PRACTICE
===================================================== */

function goPractice(){

    const course =
        getActiveCourse();

    if(course){

        window.location.href =
            "course.html";

    }else{

        window.location.href =
            "courses.html";

    }

}


/* =====================================================
   TODAY DATE KEY
===================================================== */

function todayKey(){

    const now =
        new Date();

    return [
        now.getFullYear(),
        String(
            now.getMonth()+1
        ).padStart(2,"0"),
        String(
            now.getDate()
        ).padStart(2,"0")
    ].join("-");

}
