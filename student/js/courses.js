/* =========================================================
   COURSES PAGE
========================================================= */

"use strict";

let coursesUser = null;

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

                coursesUser = user;

                await loadCoursesPage();

            }
        );

    }
);


async function loadCoursesPage() {

    const container =
        $("courseList");

    if (!container) {
        return;
    }

    showLoading(
        container,
        "Loading courses..."
    );

    try {

        const snapshot =
            await db
                .collection("courses")
                .get();

        if (snapshot.empty) {

            container.innerHTML =
                `<div class="loading-text">
                    No courses available.
                </div>`;

            return;

        }

        container.innerHTML = "";

        snapshot.forEach(function(doc) {

            const data =
                doc.data() || {};

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "course-card";

            card.innerHTML = `
                <h3>
                    ${escapeHtml(
                        data.title ||
                        data.name ||
                        "Biology Course"
                    )}
                </h3>

                <p>
                    ${escapeHtml(
                        data.description ||
                        "NEET Biology preparation course."
                    )}
                </p>

                <div>
                    ${escapeHtml(
                        data.price != null
                            ? "₹" + data.price
                            : "Price unavailable"
                    )}
                </div>

                <button
                    type="button"
                    onclick="openCourse('${doc.id}')"
                >
                    Open Course
                </button>
            `;

            container.appendChild(
                card
            );

        });

    } catch (error) {

        console.error(
            "Courses error:",
            error
        );

        container.innerHTML =
            `<div class="loading-text">
                Course loading failed.
            </div>`;

    }

}


function openCourse(courseId) {

    if (!courseId) return;

    localStorage.setItem(
        "activeCourse",
        courseId
    );

    window.location.href =
        "course.html";

}
