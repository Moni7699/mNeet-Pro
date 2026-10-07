/* =========================================================
   COURSE PAGE
========================================================= */

"use strict";

let activeCourseId = "";

let activeCourseData = {};

document.addEventListener(
    "DOMContentLoaded",
    function() {

        auth.onAuthStateChanged(
            async function(user) {

                if (!user) {

                    window.location.replace(
                        "index.html"
                    );

                    return;

                }

                activeCourseId =
                    localStorage.getItem(
                        "activeCourse"
                    ) || "";

                if (!activeCourseId) {

                    window.location.replace(
                        "courses.html"
                    );

                    return;

                }

                await loadCourse();

            }
        );

    }
);


async function loadCourse() {

    try {

        const doc =
            await db
                .collection("courses")
                .doc(activeCourseId)
                .get();

        if (!doc.exists) {

            alert(
                "Course পাওয়া যায়নি।"
            );

            window.location.href =
                "courses.html";

            return;

        }

        activeCourseData =
            doc.data() || {};

        updateCourseUI();

        await loadChapters();

    } catch (error) {

        console.error(
            "Course load error:",
            error
        );

        alert(
            "Course load করা যায়নি।"
        );

    }

}


function updateCourseUI() {

    const title =
        activeCourseData.title ||
        activeCourseData.name ||
        "Biology Course";

    if ($("courseTitle")) {

        $("courseTitle").textContent =
            title;

    }

    if ($("courseDescription")) {

        $("courseDescription")
            .textContent =
            activeCourseData.description ||
            "NEET Biology preparation course.";

    }

}


async function loadChapters() {

    const container =
        $("chapterList");

    if (!container) return;

    showLoading(
        container,
        "Loading chapters..."
    );

    try {

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

        if (snapshot.empty) {

            container.innerHTML =
                `<div class="loading-text">
                    No chapters added yet.
                </div>`;

            return;

        }

        container.innerHTML = "";

        snapshot.forEach(function(doc) {

            const data =
                doc.data() || {};

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "chapter-item";

            item.innerHTML = `
                <div>
                    <strong>
                        ${escapeHtml(
                            data.title ||
                            data.name ||
                            "Chapter"
                        )}
                    </strong>

                    <small>
                        ${escapeHtml(
                            data.description ||
                            "Biology chapter"
                        )}
                    </small>
                </div>

                <button
                    type="button"
                    onclick="openChapter('${doc.id}')"
                >
                    Open
                </button>
            `;

            container.appendChild(
                item
            );

        });

    } catch (error) {

        console.error(
            "Chapter error:",
            error
        );

        container.innerHTML =
            `<div class="loading-text">
                Chapter loading failed.
            </div>`;

    }

}


function openChapter(chapterId) {

    if (!chapterId) return;

    localStorage.setItem(
        "activeChapter",
        chapterId
    );

    /*
     * Future chapter.html এখানে connect হবে।
     * এখন course page-এ থাকছে যাতে broken page না হয়।
     */

    alert(
        "Chapter selected. Chapter learning page পরের ধাপে connect হবে।"
    );

}
