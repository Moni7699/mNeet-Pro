"use strict";

/* =========================================================
   mNEET-Pro
   TOPIC.JS
   Course → Chapter → Topic Controller
========================================================= */


/* =========================================================
   GLOBAL
========================================================= */

let topicCourseId =
    getActiveCourse();

let topicChapterId =
    getActiveChapter();

let topicCourseData =
    null;

let topicChapterData =
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


        try {

            await loadTopicPage();

        } catch (error) {

            console.error(
                "Topic page error:",
                error
            );

            showTopicMessage(
                "Data load করা যায়নি।"
            );
        }

    }
);


/* =========================================================
   ELEMENT
========================================================= */

function topicEl(
    id
) {

    return document.getElementById(id);
}


/* =========================================================
   LOAD PAGE
========================================================= */

async function loadTopicPage() {

    if (!topicCourseId) {

        showTopicMessage(
            "Course select করা হয়নি।"
        );

        return;
    }


    topicCourseData =
        await getCourse(
            topicCourseId
        );


    if (!topicCourseData) {

        showTopicMessage(
            "Course পাওয়া যায়নি।"
        );

        return;
    }


    setTopicCourseHeader(
        topicCourseData
    );


    await loadChapters();
}


/* =========================================================
   COURSE HEADER
========================================================= */

function setTopicCourseHeader(
    course
) {

    const title =
        course.title ||
        course.name ||
        "Biology Course";


    if (topicEl("courseTitle")) {

        topicEl(
            "courseTitle"
        ).textContent =
            title;
    }


    if (topicEl("courseName")) {

        topicEl(
            "courseName"
        ).textContent =
            title;
    }
}


/* =========================================================
   LOAD CHAPTERS
========================================================= */

async function loadChapters() {

    const list =
        topicEl(
            "chapterList"
        );


    if (!list) {
        return;
    }


    list.innerHTML =
        `
        <div class="loading">
            Loading chapters...
        </div>
        `;


    try {

        const snapshot =
            await db
                .collection("courses")
                .doc(topicCourseId)
                .collection("chapters")
                .get();


        list.innerHTML = "";


        if (snapshot.empty) {

            list.innerHTML =
                `
                <div class="empty">
                    No chapters available.
                </div>
                `;

            return;
        }


        const chapters = [];


        snapshot.forEach(
            function(doc) {

                chapters.push({

                    id:
                        doc.id,

                    ...(
                        doc.data() || {}
                    )

                });

            }
        );


        chapters.sort(
            function(a,b) {

                const x =
                    Number(
                        a.order ??
                        a.chapterNumber ??
                        9999
                    );

                const y =
                    Number(
                        b.order ??
                        b.chapterNumber ??
                        9999
                    );

                return x - y;
            }
        );


        chapters.forEach(
            function(chapter,index) {

                const card =
                    document.createElement(
                        "div"
                    );


                card.className =
                    "chapter-card";


                const chapterNumber =
                    chapter.chapterNumber ||
                    chapter.number ||
                    index + 1;


                const title =
                    chapter.title ||
                    chapter.name ||
                    "Chapter " +
                    chapterNumber;


                card.innerHTML =
                    `
                    <div class="chapter-info">

                        <div class="chapter-number">
                            ${escapeHTML(
                                chapterNumber
                            )}
                        </div>

                        <div>

                            <div class="chapter-title">
                                ${escapeHTML(
                                    title
                                )}
                            </div>

                            <div class="chapter-sub">
                                ${escapeHTML(
                                    chapter.description ||
                                    "Open chapter to view topics"
                                )}
                            </div>

                        </div>

                    </div>

                    <button class="chapter-open">
                        Open
                    </button>
                    `;


                card
                    .querySelector(
                        ".chapter-open"
                    )
                    .addEventListener(
                        "click",
                        function() {

                            openChapter(
                                chapter.id
                            );

                        }
                    );


                list.appendChild(
                    card
                );

            }
        );


    } catch (error) {

        console.error(
            "Chapter error:",
            error
        );


        list.innerHTML =
            `
            <div class="empty">
                Chapter load failed.
            </div>
            `;
    }
}


/* =========================================================
   OPEN CHAPTER
========================================================= */

function openChapter(
    chapterId
) {

    if (!chapterId) {
        return;
    }


    setActiveCourse(
        topicCourseId
    );


    setActiveChapter(
        chapterId
    );


    window.location.href =
        "topic.html";
}


/* =========================================================
   LOAD TOPICS
========================================================= */

async function loadTopics(
    chapterId
) {

    if (!topicCourseId || !chapterId) {
        return;
    }


    const list =
        topicEl(
            "topicList"
        );


    if (!list) {
        return;
    }


    list.innerHTML =
        `
        <div class="loading">
            Loading topics...
        </div>
        `;


    try {

        const chapterSnap =
            await db
                .collection("courses")
                .doc(topicCourseId)
                .collection("chapters")
                .doc(chapterId)
                .get();


        if (chapterSnap.exists) {

            topicChapterData =
                chapterSnap.data() || {};


            if (
                topicEl(
                    "chapterTitle"
                )
            ) {

                topicEl(
                    "chapterTitle"
                ).textContent =
                    topicChapterData.title ||
                    topicChapterData.name ||
                    "Chapter";
            }
        }


        const snapshot =
            await db
                .collection("courses")
                .doc(topicCourseId)
                .collection("chapters")
                .doc(chapterId)
                .collection("topics")
                .get();


        list.innerHTML = "";


        if (snapshot.empty) {

            list.innerHTML =
                `
                <div class="empty">
                    No topics available.
                </div>
                `;

            return;
        }


        const topics = [];


        snapshot.forEach(
            function(doc) {

                topics.push({

                    id:
                        doc.id,

                    ...(
                        doc.data() || {}
                    )

                });

            }
        );


        topics.sort(
            function(a,b) {

                return (
                    Number(
                        a.order ?? 9999
                    ) -
                    Number(
                        b.order ?? 9999
                    )
                );
            }
        );


        for (
            let i = 0;
            i < topics.length;
            i++
        ) {

            const topic =
                topics[i];


            await renderTopic(
                topic,
                i + 1,
                list
            );
        }


    } catch (error) {

        console.error(
            "Topic error:",
            error
        );


        list.innerHTML =
            `
            <div class="empty">
                Topic load failed.
            </div>
            `;
    }
}


/* =========================================================
   RENDER TOPIC
========================================================= */

async function renderTopic(
    topic,
    number,
    list
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "topic-card";


    const title =
        topic.title ||
        topic.name ||
        "Topic " + number;


    const description =
        topic.description ||
        "Practice questions and notes";


    card.innerHTML =
        `
        <div class="topic-number">
            ${number}
        </div>

        <div class="topic-content">

            <div class="topic-title">
                ${escapeHTML(
                    title
                )}
            </div>

            <div class="topic-description">
                ${escapeHTML(
                    description
                )}
            </div>

        </div>

        <div class="topic-actions">

            <button
                class="topic-quiz-btn"
                type="button"
            >
                Quiz
            </button>

            <button
                class="topic-notes-btn"
                type="button"
            >
                Notes
            </button>

        </div>
        `;


    card
        .querySelector(
            ".topic-quiz-btn"
        )
        .addEventListener(
            "click",
            function() {

                openTopicQuiz(
                    topic.id
                );

            }
        );


    card
        .querySelector(
            ".topic-notes-btn"
        )
        .addEventListener(
            "click",
            function() {

                openTopicNotes(
                    topic.id
                );

            }
        );


    list.appendChild(
        card
    );
}


/* =========================================================
   OPEN TOPIC QUIZ
========================================================= */

function openTopicQuiz(
    topicId
) {

    if (
        !topicCourseId ||
        !topicChapterId ||
        !topicId
    ) {

        return;
    }


    setActiveCourse(
        topicCourseId
    );


    setActiveChapter(
        topicChapterId
    );


    setActiveTopic(
        topicId
    );


    window.location.href =
        "quiz.html";
}


/* =========================================================
   OPEN NOTES
========================================================= */

function openTopicNotes(
    topicId
) {

    if (
        !topicCourseId ||
        !topicChapterId ||
        !topicId
    ) {

        return;
    }


    setActiveCourse(
        topicCourseId
    );


    setActiveChapter(
        topicChapterId
    );


    setActiveTopic(
        topicId
    );


    window.location.href =
        "notes.html";
}


/* =========================================================
   BACK
========================================================= */

function topicBack() {

    if (topicChapterId) {

        clearActiveChapter();

        window.location.href =
            "course.html";

    } else {

        window.location.href =
            "dashboard.html";
    }
}


/* =========================================================
   MESSAGE
========================================================= */

function showTopicMessage(
    message
) {

    const possible =
        [
            "topicList",
            "chapterList",
            "message"
        ];


    for (
        let i = 0;
        i < possible.length;
        i++
    ) {

        const el =
            topicEl(
                possible[i]
            );


        if (el) {

            el.innerHTML =
                `
                <div class="empty">
                    ${escapeHTML(
                        message
                    )}
                </div>
                `;

            return;
        }
    }
}


/* =========================================================
   AUTO MODE
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        if (
            topicChapterId &&
            topicEl("topicList")
        ) {

            await loadTopics(
                topicChapterId
            );

        }

    }
);
