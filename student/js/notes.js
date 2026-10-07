"use strict";

/* =========================================================
   mNEET-Pro
   NOTES.JS
   Topic Notes PDF Controller
========================================================= */


/* =========================================================
   GLOBAL
========================================================= */

let notesCourseId =
    getActiveCourse();

let notesChapterId =
    getActiveChapter();

let notesTopicId =
    getActiveTopic();

let notesTopicData =
    null;


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


        await loadNotesPage();

    }
);


/* =========================================================
   ELEMENT
========================================================= */

function notesEl(
    id
) {

    return document.getElementById(id);
}


/* =========================================================
   LOAD
========================================================= */

async function loadNotesPage() {

    if (
        !notesCourseId ||
        !notesChapterId ||
        !notesTopicId
    ) {

        showNotesError(
            "Notes open করার জন্য topic select করুন।"
        );

        return;
    }


    try {

        const topicRef =
            db
                .collection("courses")
                .doc(notesCourseId)
                .collection("chapters")
                .doc(notesChapterId)
                .collection("topics")
                .doc(notesTopicId);


        const snapshot =
            await topicRef.get();


        if (!snapshot.exists) {

            showNotesError(
                "Topic পাওয়া যায়নি।"
            );

            return;
        }


        notesTopicData =
            snapshot.data() || {};


        updateNotesHeader();

        loadNotesPDF();


    } catch (error) {

        console.error(
            "Notes error:",
            error
        );

        showNotesError(
            "Notes load করা যায়নি।"
        );
    }
}


/* =========================================================
   HEADER
========================================================= */

function updateNotesHeader() {

    const title =
        notesTopicData.title ||
        notesTopicData.name ||
        "Topic Notes";


    if (notesEl("notesTitle")) {

        notesEl(
            "notesTitle"
        ).textContent =
            title;
    }


    if (notesEl("topicTitle")) {

        notesEl(
            "topicTitle"
        ).textContent =
            title;
    }


    if (notesEl("notesDescription")) {

        notesEl(
            "notesDescription"
        ).textContent =
            notesTopicData.description ||
            "NCERT Biology Notes";
    }
}


/* =========================================================
   FIND PDF URL
========================================================= */

function getNotesPDFURL() {

    const data =
        notesTopicData || {};


    const possibleFields = [

        "notesPdf",

        "notesURL",

        "notesUrl",

        "pdfUrl",

        "pdfURL",

        "notes",

        "pdf"

    ];


    for (
        let i = 0;
        i < possibleFields.length;
        i++
    ) {

        const value =
            data[
                possibleFields[i]
            ];


        if (
            typeof value === "string" &&
            value.trim()
        ) {

            return value.trim();
        }
    }


    return "";
}


/* =========================================================
   LOAD PDF
========================================================= */

function loadNotesPDF() {

    const url =
        getNotesPDFURL();


    const viewer =
        notesEl(
            "pdfViewer"
        );


    const empty =
        notesEl(
            "notesEmpty"
        );


    const openButton =
        notesEl(
            "openPDFButton"
        );


    if (!url) {

        if (viewer) {
            viewer.style.display =
                "none";
        }

        if (empty) {

            empty.style.display =
                "block";

            empty.innerHTML =
                `
                <div>
                    📚
                </div>

                <strong>
                    Notes PDF not available
                </strong>

                <p>
                    Teacher has not uploaded notes for this topic yet.
                </p>
                `;
        }

        if (openButton) {

            openButton.style.display =
                "none";
        }

        return;
    }


    if (empty) {

        empty.style.display =
            "none";
    }


    if (viewer) {

        viewer.style.display =
            "block";


        viewer.src =
            url;
    }


    if (openButton) {

        openButton.style.display =
            "block";


        openButton.onclick =
            function() {

                window.open(
                    url,
                    "_blank",
                    "noopener,noreferrer"
                );

            };
    }
}


/* =========================================================
   DOWNLOAD / OPEN
========================================================= */

function openNotesPDF() {

    const url =
        getNotesPDFURL();


    if (!url) {

        alert(
            "Notes PDF available নয়।"
        );

        return;
    }


    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );
}


/* =========================================================
   BACK TO TOPIC
========================================================= */

function backToTopic() {

    window.location.href =
        "topic.html";
}


/* =========================================================
   BACK TO COURSE
========================================================= */

function backToCourse() {

    clearActiveTopic();

    window.location.href =
        "course.html";
}


/* =========================================================
   ERROR
========================================================= */

function showNotesError(
    message
) {

    const empty =
        notesEl(
            "notesEmpty"
        );


    if (empty) {

        empty.style.display =
            "block";

        empty.innerHTML =
            `
            <div>
                ⚠️
            </div>

            <strong>
                ${escapeHTML(
                    message
                )}
            </strong>
            `;
    }


    const viewer =
        notesEl(
            "pdfViewer"
        );


    if (viewer) {

        viewer.style.display =
            "none";
    }
}


/* =========================================================
   PRINT
========================================================= */

function printNotes() {

    const viewer =
        notesEl(
            "pdfViewer"
        );


    if (!viewer) {
        return;
    }


    try {

        viewer.contentWindow.print();

    } catch (error) {

        alert(
            "PDF browser-এর নতুন tab-এ open করে print করুন।"
        );
    }
}
