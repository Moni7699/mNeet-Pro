"use strict";

/* =====================================================
   mNEET-PRO
   COURSE PAGE
===================================================== */

let courseUser = null;

let activeCourseId = "";

let activeCourseData = null;


/* =====================================================
   AUTH
===================================================== */

auth.onAuthStateChanged(async function(user){

    if(!user){

        window.location.replace(
            "index.html"
        );

        return;

    }

    courseUser = user;

    loadTheme();

    activeCourseId =
        getActiveCourse();


    if(!activeCourseId){

        alert(
            "প্রথমে একটি course select করুন।"
        );

        window.location.replace(
            "courses.html"
        );

        return;

    }


    await verifyPurchase();

});


/* =====================================================
   VERIFY PURCHASE
===================================================== */

async function verifyPurchase(){

    try{

        const purchaseDoc =
            await db
                .collection("purchases")
                .doc(courseUser.uid)
                .get();


        if(!purchaseDoc.exists){

            alert(
                "এই course-এর access পাওয়া যায়নি।"
            );

            window.location.replace(
                "courses.html"
            );

            return;

        }


        const purchaseData =
            purchaseDoc.data() || {};


        if(
            purchaseData[
                activeCourseId
            ] !== true
        ){

            alert(
                "এই course এখনও purchased হয়নি।"
            );

            window.location.replace(
                "courses.html"
            );

            return;

        }


        await loadCourse();

    }catch(error){

        console.error(
            "Purchase verification error:",
            error
        );

        alert(
            "Course access verify করা যায়নি।"
        );

        window.location.replace(
            "courses.html"
        );

    }

}


/* =====================================================
   LOAD COURSE
===================================================== */

async function loadCourse(){

    try{

        const doc =
            await db
                .collection("courses")
                .doc(activeCourseId)
                .get();


        if(!doc.exists){

            alert(
                "Course পাওয়া যায়নি।"
            );

            window.location.replace(
                "courses.html"
            );

            return;

        }


        activeCourseData =
            doc.data() || {};


        updateCourseHeader();

        await loadChapters();

    }catch(error){

        console.error(
            "Course load error:",
            error
        );

        showCourseError();

    }

}


/* =====================================================
   COURSE HEADER
===================================================== */

function updateCourseHeader(){

    const title =
        document.getElementById(
            "courseTitle"
        );

    const description =
        document.getElementById(
            "courseDescription"
        );


    if(title){

        title.textContent =
            activeCourseData.title ||
            activeCourseData.name ||
            "Biology Course";

    }


    if(description){

        description.textContent =
            activeCourseData.description ||
            "NEET Biology Complete Course";

    }

}


/* =====================================================
   LOAD CHAPTERS
===================================================== */

async function loadChapters(){

    const container =
        document.getElementById(
            "chapterList"
        );


    if(!container){
        return;
    }


    container.innerHTML = `
        <div class="empty-state">
            Loading chapters...
        </div>
    `;


    try{

        const snapshot =
            await db
                .collection("courses")
                .doc(activeCourseId)
                .collection("chapters")
                .orderBy(
                    "order",
                    "asc"
                )
                .get();


        container.innerHTML = "";


        if(snapshot.empty){

            container.innerHTML = `
                <div class="empty-state">
                    <div style="font-size:35px;">
                        📚
                    </div>

                    <div style="margin-top:10px;">
                        No chapters added yet.
                    </div>
                </div>
            `;

            return;

        }


        snapshot.forEach(
            function(doc){

                const chapter =
                    doc.data() || {};

                const card =
                    createChapterCard(
                        doc.id,
                        chapter
                    );

                container.appendChild(
                    card
                );

            }
        );

    }catch(error){

        /*
         * If order field is not available,
         * retry without orderBy.
         */

        console.warn(
            "Ordered chapter query failed:",
            error
        );


        try{

            const snapshot =
                await db
                    .collection("courses")
                    .doc(activeCourseId)
                    .collection("chapters")
                    .get();


            container.innerHTML = "";


            if(snapshot.empty){

                container.innerHTML = `
                    <div class="empty-state">
                        No chapters available.
                    </div>
                `;

                return;

            }


            snapshot.forEach(
                function(doc){

                    container.appendChild(
                        createChapterCard(
                            doc.id,
                            doc.data() || {}
                        )
                    );

                }
            );

        }catch(secondError){

            console.error(
                "Chapter load error:",
                secondError
            );

            container.innerHTML = `
                <div class="empty-state">
                    Chapters load করা যায়নি।
                </div>
            `;

        }

    }

}


/* =====================================================
   CHAPTER CARD
===================================================== */

function createChapterCard(
    chapterId,
    chapter
){

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "card";


    card.style.marginBottom =
        "12px";


    const title =
        escapeHtml(
            chapter.title ||
            chapter.name ||
            "Biology Chapter"
        );


    const number =
        chapter.number ||
        chapter.order ||
        "";


    card.innerHTML = `

        <div
            style="
                display:flex;
                align-items:center;
                gap:12px;
            "
        >

            <div
                style="
                    width:45px;
                    height:45px;
                    border-radius:13px;
                    background:#e8f5e9;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    color:#0d6035;
                    font-size:16px;
                    font-weight:900;
                    flex-shrink:0;
                "
            >
                ${
                    number
                        ? number
                        : "📖"
                }
            </div>


            <div style="flex:1;">

                <div
                    style="
                        font-size:14px;
                        font-weight:900;
                    "
                >
                    ${title}
                </div>


                <div
                    style="
                        margin-top:4px;
                        color:#7b857f;
                        font-size:10px;
                    "
                >
                    Open chapter topics
                </div>

            </div>


            <div
                style="
                    color:#198754;
                    font-size:22px;
                "
            >
                ›
            </div>

        </div>

    `;


    card.addEventListener(
        "click",
        function(){

            openChapter(
                chapterId
            );

        }
    );


    return card;

}


/* =====================================================
   OPEN CHAPTER
===================================================== */

function openChapter(
    chapterId
){

    if(!chapterId){
        return;
    }


    localStorage.setItem(
        "activeChapter",
        chapterId
    );


    window.location.href =
        "topics.html";

}


/* =====================================================
   ERROR
===================================================== */

function showCourseError(){

    const container =
        document.getElementById(
            "chapterList"
        );


    if(container){

        container.innerHTML = `
            <div class="empty-state">
                Course load করা যায়নি।
            </div>
        `;

    }

}
