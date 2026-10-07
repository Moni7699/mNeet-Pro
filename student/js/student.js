"use strict";

/* =========================================================
   mNEET-Pro
   STUDENT.JS
   Student Dashboard Controller
========================================================= */


/* =========================================================
   GLOBAL
========================================================= */

let studentCurrentUser = null;

let studentData = {};

let selectedCourseId = "";

let studentTargetTimer = null;


/* =========================================================
   AUTH
========================================================= */

auth.onAuthStateChanged(
    async function(user) {

        if (!user) {

            window.location.replace(
                "index.html"
            );

            return;
        }

        studentCurrentUser =
            user;

        try {

            await loadStudentDashboard();

        } catch (error) {

            console.error(
                "Dashboard error:",
                error
            );

        }

    }
);


/* =========================================================
   LOAD DASHBOARD
========================================================= */

async function loadStudentDashboard() {

    await loadStudentProfile();

    await loadStudentCourses();

    await loadStudentNotifications();

    loadStudentTheme();

    setupStudentUI();
}


/* =========================================================
   ELEMENT HELPER
========================================================= */

function studentEl(
    id
) {

    return document.getElementById(id);
}


/* =========================================================
   STUDENT PROFILE
========================================================= */

async function loadStudentProfile() {

    const data =
        await getStudentData(
            studentCurrentUser.uid
        );

    studentData =
        data || {

            uid:
                studentCurrentUser.uid,

            name:
                studentCurrentUser.displayName ||
                "Student",

            email:
                studentCurrentUser.email ||
                "",

            targetDate:
                "",

            targetDream:
                "",

            selectedCourse:
                "",

            progress:
                0,

            lastScore:
                null,

            accuracy:
                0,

            streak:
                0
        };


    const name =
        studentData.name ||
        studentCurrentUser.displayName ||
        "Student";


    const email =
        studentData.email ||
        studentCurrentUser.email ||
        "";


    if (studentEl("studentName")) {

        studentEl(
            "studentName"
        ).textContent =
            name;
    }


    if (studentEl("sideName")) {

        studentEl(
            "sideName"
        ).textContent =
            name;
    }


    if (studentEl("sideEmail")) {

        studentEl(
            "sideEmail"
        ).textContent =
            email;
    }


    if (studentEl("avatar")) {

        studentEl(
            "avatar"
        ).textContent =
            name
                .charAt(0)
                .toUpperCase();
    }


    setStudentProgress(
        studentData.progress || 0
    );


    if (studentEl("lastScore")) {

        studentEl(
            "lastScore"
        ).textContent =
            studentData.lastScore != null
                ? studentData.lastScore
                : "—";
    }


    if (studentEl("accuracy")) {

        studentEl(
            "accuracy"
        ).textContent =
            studentData.accuracy != null
                ? safePercentage(
                    studentData.accuracy
                ) + "%"
                : "0%";
    }


    if (studentEl("streak")) {

        studentEl(
            "streak"
        ).textContent =
            studentData.streak || 0;
    }


    updateStudentTarget();
}


/* =========================================================
   LOAD COURSES
========================================================= */

async function loadStudentCourses() {

    const select =
        studentEl(
            "courseSelect"
        );

    if (!select) {
        return;
    }


    select.innerHTML =
        `
        <option value="">
            Loading courses...
        </option>
        `;


    const courses =
        await getCourses();


    select.innerHTML = "";


    if (!courses.length) {

        select.innerHTML =
            `
            <option value="">
                No course available
            </option>
            `;

        selectedCourseId = "";

        updateContinueLearning();

        return;
    }


    courses.forEach(
        function(course) {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                course.id;

            option.textContent =
                course.title ||
                course.name ||
                "Biology Course";

            select.appendChild(
                option
            );

        }
    );


    const saved =
        studentData.selectedCourse ||
        getActiveCourse();


    if (
        saved &&
        courses.some(
            course =>
                course.id === saved
        )
    ) {

        selectedCourseId =
            saved;

        select.value =
            saved;

    } else {

        selectedCourseId =
            courses[0].id;

        select.value =
            selectedCourseId;
    }


    setActiveCourse(
        selectedCourseId
    );


    updateContinueLearning();
}


/* =========================================================
   COURSE CHANGE
========================================================= */

function setupCourseSelector() {

    const select =
        studentEl(
            "courseSelect"
        );

    if (!select) {
        return;
    }


    select.addEventListener(
        "change",
        async function() {

            selectedCourseId =
                this.value;

            if (!selectedCourseId) {
                return;
            }


            setActiveCourse(
                selectedCourseId
            );


            try {

                await saveStudentData({

                    selectedCourse:
                        selectedCourseId

                });

                studentData.selectedCourse =
                    selectedCourseId;

                updateContinueLearning();

            } catch (error) {

                console.error(
                    "Course save error:",
                    error
                );

            }

        }
    );
}


/* =========================================================
   CONTINUE LEARNING
========================================================= */

function updateContinueLearning() {

    const title =
        studentEl(
            "continueTitle"
        );

    const sub =
        studentEl(
            "continueSub"
        );


    if (!selectedCourseId) {

        if (title) {
            title.textContent =
                "Start Learning";
        }

        if (sub) {
            sub.textContent =
                "Select a course to continue.";
        }

        return;
    }


    const select =
        studentEl(
            "courseSelect"
        );


    const option =
        select &&
        select.options[
            select.selectedIndex
        ];


    const courseName =
        option
            ? option.textContent
            : "Your Biology Course";


    if (title) {

        title.textContent =
            courseName;
    }


    if (sub) {

        sub.textContent =
            "Continue your Biology preparation.";
    }
}


/* =========================================================
   CONTINUE BUTTON
========================================================= */

function continueLearning() {

    if (!selectedCourseId) {

        alert(
            "প্রথমে একটি course select করুন।"
        );

        return;
    }


    setActiveCourse(
        selectedCourseId
    );


    window.location.href =
        "course.html";
}


/* =========================================================
   PROGRESS
========================================================= */

function setStudentProgress(
    value
) {

    const progress =
        safePercentage(value);


    if (studentEl("progressValue")) {

        studentEl(
            "progressValue"
        ).textContent =
            progress + "%";
    }


    if (studentEl("progressPercent")) {

        studentEl(
            "progressPercent"
        ).textContent =
            progress + "%";
    }


    if (studentEl("progressFill")) {

        studentEl(
            "progressFill"
        ).style.width =
            progress + "%";
    }


    if (studentEl("progressSub")) {

        studentEl(
            "progressSub"
        ).textContent =
            progress > 0
                ? "Keep learning and complete your course."
                : "Start learning to build your progress.";
    }
}


/* =========================================================
   TARGET
========================================================= */

function updateStudentTarget() {

    const date =
        studentData.targetDate || "";

    const dream =
        studentData.targetDream ||
        "Set your dream";


    if (studentEl("targetDream")) {

        studentEl(
            "targetDream"
        ).textContent =
            dream;
    }


    if (studentEl("targetDateInput")) {

        studentEl(
            "targetDateInput"
        ).value =
            date;
    }


    if (studentEl("targetDreamInput")) {

        studentEl(
            "targetDreamInput"
        ).value =
            studentData.targetDream || "";
    }


    startStudentTimer(
        date
    );
}


/* =========================================================
   TARGET MODAL
========================================================= */

function openTargetModal() {

    const modal =
        studentEl(
            "targetModal"
        );

    if (modal) {

        modal.classList.add(
            "active"
        );
    }

    closeStudentSidebar();
}


function closeTargetModal() {

    const modal =
        studentEl(
            "targetModal"
        );

    if (modal) {

        modal.classList.remove(
            "active"
        );
    }
}


/* =========================================================
   SAVE TARGET
========================================================= */

async function saveTarget() {

    if (!studentCurrentUser) {
        return;
    }


    const date =
        studentEl(
            "targetDateInput"
        )?.value || "";


    const dream =
        (
            studentEl(
                "targetDreamInput"
            )?.value || ""
        ).trim();


    if (!date) {

        alert(
            "Target date select করুন।"
        );

        return;
    }


    try {

        await saveStudentData({

            targetDate:
                date,

            targetDream:
                dream ||
                "NEET Target"

        });


        studentData.targetDate =
            date;

        studentData.targetDream =
            dream ||
            "NEET Target";


        updateStudentTarget();

        closeTargetModal();

    } catch (error) {

        console.error(
            "Target save error:",
            error
        );

        alert(
            "Target save করা যায়নি।"
        );
    }
}


/* =========================================================
   TARGET TIMER
========================================================= */

function startStudentTimer(
    date
) {

    if (studentTargetTimer) {

        clearInterval(
            studentTargetTimer
        );
    }


    if (!date) {

        setStudentTimer(
            0,
            0,
            0,
            0
        );

        return;
    }


    function update() {

        const target =
            new Date(
                date +
                "T23:59:59"
            ).getTime();


        const now =
            Date.now();


        let diff =
            target - now;


        if (diff < 0) {
            diff = 0;
        }


        const days =
            Math.floor(
                diff /
                86400000
            );


        const hours =
            Math.floor(
                (
                    diff %
                    86400000
                ) /
                3600000
            );


        const minutes =
            Math.floor(
                (
                    diff %
                    3600000
                ) /
                60000
            );


        const seconds =
            Math.floor(
                (
                    diff %
                    60000
                ) /
                1000
            );


        setStudentTimer(
            days,
            hours,
            minutes,
            seconds
        );
    }


    update();


    studentTargetTimer =
        setInterval(
            update,
            1000
        );
}


function setStudentTimer(
    days,
    hours,
    minutes,
    seconds
) {

    if (studentEl("days")) {

        studentEl("days").textContent =
            days;
    }

    if (studentEl("hours")) {

        studentEl("hours").textContent =
            hours;
    }

    if (studentEl("minutes")) {

        studentEl("minutes").textContent =
            minutes;
    }

    if (studentEl("seconds")) {

        studentEl("seconds").textContent =
            seconds;
    }
}


/* =========================================================
   NOTIFICATIONS
========================================================= */

async function loadStudentNotifications() {

    const list =
        studentEl(
            "notificationList"
        );


    if (!list || !db) {
        return;
    }


    try {

        const snapshot =
            await db
                .collection("notifications")
                .orderBy(
                    "createdAt",
                    "desc"
                )
                .limit(10)
                .get();


        if (snapshot.empty) {

            list.innerHTML =
                `
                <div class="notification-empty">
                    No new notifications.
                </div>
                `;

            return;
        }


        list.innerHTML = "";


        let count = 0;


        snapshot.forEach(
            function(doc) {

                const data =
                    doc.data() || {};


                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "notification-item";


                item.innerHTML =
                    `
                    <div class="notification-title">
                        ${escapeHTML(
                            data.title ||
                            "Notification"
                        )}
                    </div>

                    <div class="notification-text">
                        ${escapeHTML(
                            data.message ||
                            data.text ||
                            ""
                        )}
                    </div>
                    `;


                list.appendChild(
                    item
                );

                count++;
            }
        );


        const badge =
            studentEl(
                "notificationBadge"
            );


        if (
            badge &&
            count > 0
        ) {

            badge.textContent =
                count > 9
                    ? "9+"
                    : count;

            badge.style.display =
                "flex";
        }

    } catch (error) {

        console.error(
            "Notification error:",
            error
        );

        list.innerHTML =
            `
            <div class="notification-empty">
                No notifications available.
            </div>
            `;
    }
}


/* =========================================================
   SIDEBAR
========================================================= */

function openStudentSidebar() {

    studentEl(
        "sidebar"
    )?.classList.add(
        "active"
    );

    studentEl(
        "overlay"
    )?.classList.add(
        "active"
    );
}


function closeStudentSidebar() {

    studentEl(
        "sidebar"
    )?.classList.remove(
        "active"
    );

    studentEl(
        "overlay"
    )?.classList.remove(
        "active"
    );
}


/* =========================================================
   NOTIFICATION PANEL
========================================================= */

function setupNotificationPanel() {

    studentEl(
        "notificationButton"
    )?.addEventListener(
        "click",
        function() {

            studentEl(
                "notificationPanel"
            )?.classList.toggle(
                "active"
            );
        }
    );


    studentEl(
        "notificationClose"
    )?.addEventListener(
        "click",
        function() {

            studentEl(
                "notificationPanel"
            )?.classList.remove(
                "active"
            );
        }
    );
}


/* =========================================================
   THEME
========================================================= */

function loadStudentTheme() {

    const theme =
        getLocal(
            "mneet-theme",
            "light"
        );


    if (theme === "dark") {

        applyStudentDarkTheme();

    } else {

        applyStudentLightTheme();
    }
}


function toggleTheme() {

    const current =
        getLocal(
            "mneet-theme",
            "light"
        );


    if (current === "dark") {

        setLocal(
            "mneet-theme",
            "light"
        );

        applyStudentLightTheme();

    } else {

        setLocal(
            "mneet-theme",
            "dark"
        );

        applyStudentDarkTheme();
    }
}


function applyStudentDarkTheme() {

    document.body.classList.add(
        "dark-mode"
    );


    if (studentEl("themeIcon")) {

        studentEl(
            "themeIcon"
        ).textContent =
            "☀️";
    }


    if (studentEl("themeText")) {

        studentEl(
            "themeText"
        ).textContent =
            "White Mode";
    }
}


function applyStudentLightTheme() {

    document.body.classList.remove(
        "dark-mode"
    );


    if (studentEl("themeIcon")) {

        studentEl(
            "themeIcon"
        ).textContent =
            "🌙";
    }


    if (studentEl("themeText")) {

        studentEl(
            "themeText"
        ).textContent =
            "Dark Mode";
    }
}


/* =========================================================
   PROFILE
========================================================= */

function openProfile() {

    closeStudentSidebar();

    window.location.href =
        "profile.html";
}


/* =========================================================
   EXTERNAL
========================================================= */

function openExternal(
    url
) {

    openExternalLink(url);
}


/* =========================================================
   LOGOUT
========================================================= */

async function logoutStudent() {

    const ok =
        confirm(
            "আপনি কি logout করতে চান?"
        );


    if (!ok) {
        return;
    }


    await studentLogout();
}


/* =========================================================
   NAVIGATION
========================================================= */

function goHome() {

    window.location.href =
        "dashboard.html";
}


function goCourses() {

    window.location.href =
        "courses.html";
}


function goPractice() {

    window.location.href =
        "courses.html";
}


/* =========================================================
   SETUP
========================================================= */

function setupStudentUI() {

    studentEl(
        "menuButton"
    )?.addEventListener(
        "click",
        openStudentSidebar
    );


    studentEl(
        "sidebarClose"
    )?.addEventListener(
        "click",
        closeStudentSidebar
    );


    studentEl(
        "overlay"
    )?.addEventListener(
        "click",
        closeStudentSidebar
    );


    setupNotificationPanel();

    setupCourseSelector();
}


/* =========================================================
   ESCAPE MODAL
========================================================= */

document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key === "Escape"
        ) {

            closeStudentSidebar();

            studentEl(
                "notificationPanel"
            )?.classList.remove(
                "active"
            );

            closeTargetModal();
        }
    }
);
