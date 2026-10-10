/* =========================================================
   mNEET STUDENT PANEL
   File: student.js

   Responsibilities:
   - Student authentication
   - Dashboard initialization
   - Student profile identity
   - Main page navigation
   - Dashboard statistics
   - Purchased course access
   - Quiz result summary
   - Logout

   Firebase SDK: Compat 10.14.1
   Theme: Green + White
   ========================================================= */

(function () {
    "use strict";

    if (window.MNEETStudent) {
        return;
    }

    const CONFIG = Object.freeze({
        LOGIN_PAGE: "index.html",
        ADMIN_PAGE: "admin.html",
        STUDENT_PAGE: "student.html",

        COLLECTIONS: Object.freeze({
            ADMINS: "admins",
            USERS: "users",
            COURSES: "courses",
            PURCHASES: "purchases",
            CHAPTERS: "chapters",
            TOPICS: "topics",
            QUIZ_ATTEMPTS: "quizAttempts",
            QUIZ_RESULTS: "quizResults",
            NOTIFICATIONS: "notifications"
        }),

        REFRESH_INTERVAL: 60000
    });


    const state = {
        auth: null,
        db: null,
        user: null,
        profile: null,

        isAdmin: false,
        initialized: false,
        loading: false,
        loggingOut: false,

        activePage: "dashboard",
        activeCourseId: null,

        purchasedCourses: [],
        availableCourses: [],
        purchases: [],
        quizAttempts: [],
        quizResults: [],
        chapters: [],
        topics: [],
        notifications: [],

        dashboardLoaded: false,
        refreshTimer: null,
        authUnsubscribe: null,
        messageTimer: null
    };


    /* =====================================================
       1. GENERAL HELPERS
       ===================================================== */

    function byId(id) {
        return document.getElementById(id);
    }


    function getFirebaseServices() {
        if (
            window.MNEETFirebase &&
            window.MNEETFirebase.ready &&
            window.MNEETFirebase.auth &&
            window.MNEETFirebase.db
        ) {
            state.auth = window.MNEETFirebase.auth;
            state.db = window.MNEETFirebase.db;

            return {
                auth: state.auth,
                db: state.db
            };
        }

        if (
            !window.firebase ||
            !window.firebase.apps ||
            window.firebase.apps.length === 0
        ) {
            throw new Error(
                "Firebase initialize করা হয়নি। firebase.js পরীক্ষা করো।"
            );
        }

        state.auth = window.firebase.auth();
        state.db = window.firebase.firestore();

        return {
            auth: state.auth,
            db: state.db
        };
    }


    function safeText(value, fallback) {
        if (value === null || value === undefined) {
            return fallback || "";
        }

        const text = String(value).trim();

        return text || fallback || "";
    }


    function setText(id, value) {
        const element = byId(id);

        if (element) {
            element.textContent = value === null ||
                value === undefined
                ? ""
                : String(value);
        }
    }


    function showElement(element) {
        if (element) {
            element.hidden = false;
        }
    }


    function hideElement(element) {
        if (element) {
            element.hidden = true;
        }
    }


    function escapeHTML(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function getInitial(name) {
        const cleanName = safeText(name, "Student");

        return cleanName.charAt(0).toUpperCase();
    }


    function getCurrentPageName() {
        const path = window.location.pathname || "";

        return path.split("/").pop().toLowerCase() ||
            CONFIG.LOGIN_PAGE;
    }


    function isValidNumber(value) {
        return (
            typeof value === "number" &&
            Number.isFinite(value)
        );
    }


    function toNumber(value, fallback) {
        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : fallback || 0;
    }


    function getTimestampDate(value) {
        if (!value) {
            return null;
        }

        if (typeof value.toDate === "function") {
            return value.toDate();
        }

        if (value instanceof Date) {
            return value;
        }

        if (typeof value === "number") {
            const date = new Date(value);

            return Number.isNaN(date.getTime())
                ? null
                : date;
        }

        if (typeof value === "string") {
            const date = new Date(value);

            return Number.isNaN(date.getTime())
                ? null
                : date;
        }

        if (
            typeof value.seconds === "number"
        ) {
            return new Date(value.seconds * 1000);
        }

        return null;
    }


    function formatDate(value) {
        const date = getTimestampDate(value);

        if (!date) {
            return "—";
        }

        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }


    function formatPercent(value) {
        const number = Math.max(
            0,
            Math.min(100, toNumber(value, 0))
        );

        return Math.round(number) + "%";
    }


    function getActiveCourseId() {
        return state.activeCourseId;
    }


    function getUserId() {
        return state.user ? state.user.uid : null;
    }


    function getUserEmail() {
        return state.user
            ? safeText(state.user.email)
            : "";
    }


    function getProfileName() {
        if (
            state.profile &&
            state.profile.name
        ) {
            return safeText(state.profile.name, "Student");
        }

        if (
            state.user &&
            state.user.displayName
        ) {
            return safeText(state.user.displayName, "Student");
        }

        return "Student";
    }


    /* =====================================================
       2. MESSAGES
       ===================================================== */

    function showMessage(message, type) {
        const element = byId("studentMessage");

        if (!element) {
            console.log("[mNEET Student]", message);
            return;
        }

        if (state.messageTimer) {
            clearTimeout(state.messageTimer);
            state.messageTimer = null;
        }

        element.textContent = safeText(message);
        element.className = "student-message";

        if (type) {
            element.classList.add(String(type));
        }

        element.hidden = false;

        state.messageTimer = setTimeout(function () {
            element.hidden = true;
        }, 6000);
    }


    function hideMessage() {
        const element = byId("studentMessage");

        if (element) {
            element.hidden = true;
        }

        if (state.messageTimer) {
            clearTimeout(state.messageTimer);
            state.messageTimer = null;
        }
    }


    /* =====================================================
       3. LOADING SCREEN
       ===================================================== */

    function showLoading(message) {
        const loading = byId("studentLoading");
        const app = byId("studentApp");

        if (loading) {
            loading.hidden = false;

            if (message) {
                const paragraph = loading.querySelector("p");

                if (paragraph) {
                    paragraph.textContent = message;
                }
            }
        }

        if (app) {
            app.hidden = true;
        }
    }


    function hideLoading() {
        const loading = byId("studentLoading");
        const app = byId("studentApp");

        if (loading) {
            loading.hidden = true;
        }

        if (app) {
            app.hidden = false;
        }
    }


    /* =====================================================
       4. AUTHORIZATION
       ===================================================== */

    async function verifyAdmin(user) {
        if (!user || !state.db) {
            return false;
        }

        try {
            const document = await state.db
                .collection(CONFIG.COLLECTIONS.ADMINS)
                .doc(user.uid)
                .get();

            if (!document.exists) {
                return false;
            }

            const data = document.data() || {};

            return data.active === true;

        } catch (error) {
            console.error(
                "mNEET Student: Admin verification failed:",
                error
            );

            throw error;
        }
    }


    async function verifyCurrentAccount(user) {
        if (!user) {
            return false;
        }

        const page = getCurrentPageName();

        let adminAuthorized = false;

        try {
            adminAuthorized = await verifyAdmin(user);

        } catch (error) {
            /*
             * If admin verification fails on the Student Panel,
             * do not grant Admin privileges.
             *
             * The Firestore Security Rules must still protect
             * sensitive data and privileged operations.
             */
            console.error(
                "mNEET Student: Could not verify Admin role.",
                error
            );

            if (page === CONFIG.STUDENT_PAGE) {
                showMessage(
                    "Account যাচাই করা যাচ্ছে না। Firebase connection ও Security Rules পরীক্ষা করো।",
                    "error"
                );

                return false;
            }

            throw error;
        }

        if (adminAuthorized) {
            state.isAdmin = true;

            if (page === CONFIG.STUDENT_PAGE) {
                window.location.replace(CONFIG.ADMIN_PAGE);
            }

            return false;
        }

        state.isAdmin = false;

        return true;
    }


    /* =====================================================
       5. STUDENT PROFILE
       ===================================================== */

    async function loadStudentProfile(user) {
        if (!user || !state.db) {
            return null;
        }

        let profile = {};

        try {
            const document = await state.db
                .collection(CONFIG.COLLECTIONS.USERS)
                .doc(user.uid)
                .get();

            if (document.exists) {
                profile = document.data() || {};
            }

        } catch (error) {
            console.error(
                "mNEET Student: Profile load failed:",
                error
            );

            /*
             * Authentication data can still be used to show
             * basic account identity. Other protected data
             * will be loaded separately.
             */
        }

        state.profile = {
            ...profile,
            uid: user.uid,
            name: safeText(
                profile.name,
                safeText(user.displayName, "Student")
            ),
            email: safeText(
                profile.email,
                safeText(user.email)
            ),
            phone: safeText(profile.phone),
            photoURL: safeText(
                profile.photoURL,
                safeText(user.photoURL)
            )
        };

        renderStudentIdentity();

        return state.profile;
    }


    function renderStudentIdentity() {
        const profile = state.profile || {};
        const name = getProfileName();
        const email = safeText(
            profile.email,
            getUserEmail()
        );
        const phone = safeText(profile.phone);
        const photoURL = safeText(profile.photoURL);

        setText("studentSidebarName", name);
        setText("studentSidebarEmail", email);
        setText("studentSidebarPhone", phone);

        setText("studentWelcomeName", name);
        setText("studentTopbarName", name);

        setText("studentSidebarInitial", getInitial(name));
        setText("studentTopbarInitial", getInitial(name));

        const photo = byId("studentSidebarPhoto");
        const initial = byId("studentSidebarInitial");

        if (photo && photoURL) {
            photo.src = photoURL;
            photo.alt = name + " profile photo";
            photo.hidden = false;

            if (initial) {
                initial.hidden = true;
            }

            photo.onerror = function () {
                photo.hidden = true;

                if (initial) {
                    initial.hidden = false;
                }
            };

        } else {
            if (photo) {
                photo.hidden = true;
                photo.removeAttribute("src");
            }

            if (initial) {
                initial.hidden = false;
            }
        }
    }


    /* =====================================================
       6. COURSE ACCESS
       ===================================================== */

    function getPurchaseUserId(data) {
        return safeText(
            data.userId ||
            data.studentId ||
            data.uid ||
            ""
        );
    }


    function getPurchaseCourseId(data, documentId) {
        return safeText(
            data.courseId ||
            data.courseID ||
            documentId ||
            ""
        );
    }


    function getPurchaseStatus(data) {
        const status = safeText(
            data.status ||
            data.paymentStatus ||
            data.approvalStatus ||
            ""
        ).toLowerCase();

        return status;
    }


    function isPurchaseApproved(data) {
        if (!data || typeof data !== "object") {
            return false;
        }

        const status = getPurchaseStatus(data);

        /*
         * Access is granted only for an explicitly approved
         * purchase record.
         *
         * A payment reference submitted by a student is not
         * sufficient to unlock a course.
         */
        return (
            status === "approved" ||
            status === "paid" ||
            status === "completed"
        );
    }


    async function loadPurchases() {
        if (!state.db || !state.user) {
            return [];
        }

        try {
            const snapshot = await state.db
                .collection(CONFIG.COLLECTIONS.PURCHASES)
                .where("userId", "==", state.user.uid)
                .get();

            state.purchases = snapshot.docs.map(function (doc) {
                return {
                    id: doc.id,
                    ...doc.data()
                };
            });

        } catch (error) {
            console.error(
                "mNEET Student: Purchase records could not be loaded:",
                error
            );

            /*
             * Older purchase records may use studentId or uid.
             * Do not automatically unlock courses if the
             * expected query is denied or unavailable.
             */
            state.purchases = [];

            showMessage(
                "কেনা কোর্সের তথ্য লোড করা যায়নি। Firestore purchases data ও read permissions পরীক্ষা করো।",
                "error"
            );
        }

        return state.purchases;
    }


    async function loadCourses() {
        if (!state.db) {
            return [];
        }

        try {
            const snapshot = await state.db
                .collection(CONFIG.COLLECTIONS.COURSES)
                .get();

            const allCourses = snapshot.docs.map(function (doc) {
                return {
                    id: doc.id,
                    ...doc.data()
                };
            });

            state.availableCourses = allCourses.filter(
                function (course) {
                    return (
                        course.active === true &&
                        course.published !== false
                    );
                }
            );

            return allCourses;

        } catch (error) {
            console.error(
                "mNEET Student: Course list could not be loaded:",
                error
            );

            state.availableCourses = [];

            return [];
        }
    }


    function buildPurchasedCourses() {
        const courseMap = new Map();

        state.availableCourses.forEach(function (course) {
            courseMap.set(course.id, course);
        });

        const purchased = [];

        state.purchases.forEach(function (purchase) {
            if (!isPurchaseApproved(purchase)) {
                return;
            }

            const courseId = getPurchaseCourseId(purchase);

            if (!courseId) {
                return;
            }

            const course = courseMap.get(courseId);

            if (!course) {
                return;
            }

            if (!courseMap.has(courseId)) {
                return;
            }

            if (
                !purchased.some(function (item) {
                    return item.id === courseId;
                })
            ) {
                purchased.push({
                    ...course,
                    purchaseStatus: getPurchaseStatus(purchase)
                });
            }
        });

        state.purchasedCourses = purchased;

        if (
            state.activeCourseId &&
            !purchased.some(function (course) {
                return course.id === state.activeCourseId;
            })
        ) {
            state.activeCourseId = null;
        }

        return purchased;
    }


    function getPurchasedCourseIds() {
        return state.purchasedCourses.map(function (course) {
            return course.id;
        });
    }


    function hasCourseAccess(courseId) {
        if (!courseId) {
            return false;
        }

        return state.purchasedCourses.some(function (course) {
            return course.id === courseId;
        });
    }


    /* =====================================================
       7. QUIZ ATTEMPTS AND RESULTS
       ===================================================== */

    async function loadCollectionForUser(collectionName) {
        if (!state.db || !state.user) {
            return [];
        }

        try {
            const snapshot = await state.db
                .collection(collectionName)
                .where("userId", "==", state.user.uid)
                .get();

            return snapshot.docs.map(function (doc) {
                return {
                    id: doc.id,
                    ...doc.data()
                };
            });

        } catch (error) {
            console.warn(
                "mNEET Student: Could not load collection:",
                collectionName,
                error
            );

            return [];
        }
    }


    async function loadQuizData() {
        const results = await Promise.all([
            loadCollectionForUser(
                CONFIG.COLLECTIONS.QUIZ_ATTEMPTS
            ),
            loadCollectionForUser(
                CONFIG.COLLECTIONS.QUIZ_RESULTS
            )
        ]);

        state.quizAttempts = results[0];
        state.quizResults = results[1];

        return {
            attempts: state.quizAttempts,
            results: state.quizResults
        };
    }


    function getResultAccuracy(result) {
        if (
            isValidNumber(result.accuracy)
        ) {
            return Math.max(
                0,
                Math.min(100, result.accuracy)
            );
        }

        if (
            isValidNumber(result.accuracyPercent)
        ) {
            return Math.max(
                0,
                Math.min(100, result.accuracyPercent)
            );
        }

        const correct = toNumber(
            result.correctAnswers !== undefined
                ? result.correctAnswers
                : result.correct,
            0
        );

        const incorrect = toNumber(
            result.incorrectAnswers !== undefined
                ? result.incorrectAnswers
                : result.incorrect,
            0
        );

        const answered = correct + incorrect;

        if (answered <= 0) {
            return 0;
        }

        return (correct / answered) * 100;
    }


    function getResultScore(result) {
        return toNumber(
            result.score !== undefined
                ? result.score
                : result.totalScore,
            0
        );
    }


    function getResultDate(result) {
        return (
            result.submittedAt ||
            result.completedAt ||
            result.createdAt ||
            result.timestamp ||
            null
        );
    }


    function getFilteredResults() {
        const courseId = state.activeCourseId;

        if (!courseId) {
            return state.quizResults.slice();
        }

        return state.quizResults.filter(function (result) {
            return result.courseId === courseId;
        });
    }


    function getAverageAccuracy(results) {
        if (!results || results.length === 0) {
            return 0;
        }

        const total = results.reduce(
            function (sum, result) {
                return sum + getResultAccuracy(result);
            },
            0
        );

        return total / results.length;
    }


    /* =====================================================
       8. CHAPTERS AND TOPICS
       ===================================================== */

    async function loadChaptersAndTopics() {
        if (!state.db) {
            return;
        }

        const courseIds = getPurchasedCourseIds();

        if (courseIds.length === 0) {
            state.chapters = [];
            state.topics = [];
            return;
        }

        try {
            const chapterSnapshot = await state.db
                .collection(CONFIG.COLLECTIONS.CHAPTERS)
                .get();

            state.chapters = chapterSnapshot.docs
                .map(function (doc) {
                    return {
                        id: doc.id,
                        ...doc.data()
                    };
                })
                .filter(function (chapter) {
                    return courseIds.includes(chapter.courseId);
                });

        } catch (error) {
            console.warn(
                "mNEET Student: Chapters could not be loaded:",
                error
            );

            state.chapters = [];
        }

        try {
            const topicSnapshot = await state.db
                .collection(CONFIG.COLLECTIONS.TOPICS)
                .get();

            state.topics = topicSnapshot.docs
                .map(function (doc) {
                    return {
                        id: doc.id,
                        ...doc.data()
                    };
                })
                .filter(function (topic) {
                    return courseIds.includes(topic.courseId);
                });

        } catch (error) {
            console.warn(
                "mNEET Student: Topics could not be loaded:",
                error
            );

            state.topics = [];
        }
    }


    /* =====================================================
       9. DASHBOARD STATISTICS
       ===================================================== */

    function renderDashboardStatistics() {
        const courses = state.purchasedCourses || [];
        const attempts = state.quizAttempts || [];
        const results = getFilteredResults();

        setText(
            "studentStatCourses",
            String(courses.length)
        );

        setText(
            "studentStatAttempts",
            String(attempts.length)
        );

        const accuracy = getAverageAccuracy(results);

        setText(
            "studentStatAccuracy",
            formatPercent(accuracy)
        );

        const progress = calculateOverallProgress();

        setText(
            "studentStatProgress",
            formatPercent(progress)
        );

        const progressBar = byId("studentStatProgressBar");

        if (progressBar) {
            progressBar.style.width = formatPercent(progress);
        }
    }


    function calculateOverallProgress() {
        const courses = state.purchasedCourses || [];

        if (courses.length === 0) {
            return 0;
        }

        let progressTotal = 0;
        let progressCount = 0;

        courses.forEach(function (course) {
            const progress = toNumber(
                course.progressPercent !== undefined
                    ? course.progressPercent
                    : course.progress,
                NaN
            );

            if (
                Number.isFinite(progress) &&
                progress >= 0 &&
                progress <= 100
            ) {
                progressTotal += progress;
                progressCount++;
            }
        });

        if (progressCount > 0) {
            return progressTotal / progressCount;
        }

        /*
         * Until student-progress.js provides persisted progress,
         * do not fabricate a completion percentage.
         */
        return 0;
    }


    /* =====================================================
       10. CONTINUE LEARNING
       ===================================================== */

    function renderContinueLearning() {
        const container = byId("studentContinueLearning");

        if (!container) {
            return;
        }

        const courses = state.purchasedCourses || [];

        if (courses.length === 0) {
            container.innerHTML = `
                <div class="student-empty-state">
                    <div class="student-empty-icon">▤</div>

                    <h3>No approved course yet</h3>

                    <p>
                        Your purchased courses will appear here
                        after Admin approves your payment.
                    </p>

                    <button
                        type="button"
                        class="student-primary-button"
                        data-student-page="available-courses"
                    >
                        Explore Courses
                    </button>
                </div>
            `;

            return;
        }

        container.innerHTML = courses.map(
            function (course) {
                const courseName = escapeHTML(
                    safeText(course.name, "Untitled Course")
                );

                const description = escapeHTML(
                    safeText(course.description, "")
                );

                const thumbnail = safeText(
                    course.thumbnailUrl ||
                    course.thumbnail ||
                    ""
                );

                const price = toNumber(course.price, 0);

                const progress = Math.max(
                    0,
                    Math.min(
                        100,
                        toNumber(course.progressPercent, 0)
                    )
                );

                const thumbnailHTML = thumbnail
                    ? `
                        <div class="student-course-thumbnail">
                            <img
                                src="${escapeHTML(thumbnail)}"
                                alt="${courseName}"
                                loading="lazy"
                            >
                        </div>
                    `
                    : `
                        <div class="student-course-thumbnail">
                            <div class="student-course-thumbnail-placeholder">
                                mNEET
                            </div>
                        </div>
                    `;

                return `
                    <article class="student-course-card">

                        ${thumbnailHTML}

                        <div class="student-course-card-body">

                            <h3>${courseName}</h3>

                            <p>${description}</p>

                            <div class="student-course-progress">

                                <div class="student-course-progress-label">
                                    <span>Course Progress</span>
                                    <strong>${formatPercent(progress)}</strong>
                                </div>

                                <div class="student-progress-track">
                                    <div
                                        class="student-progress-fill"
                                        style="width:${progress}%"
                                    ></div>
                                </div>

                            </div>

                            <div class="student-course-card-actions">

                                <button
                                    type="button"
                                    class="student-primary-button"
                                    data-student-open-course="${escapeHTML(course.id)}"
                                >
                                    Continue Learning
                                </button>

                            </div>

                        </div>

                    </article>
                `;
            }
        ).join("");
    }


    /* =====================================================
       11. RECENT RESULTS
       ===================================================== */

    function renderRecentResults() {
        const container = byId("studentRecentResults");

        if (!container) {
            return;
        }

        const results = getFilteredResults()
            .slice()
            .sort(function (a, b) {
                const dateA = getTimestampDate(
                    getResultDate(a)
                );

                const dateB = getTimestampDate(
                    getResultDate(b)
                );

                return (
                    (dateB ? dateB.getTime() : 0) -
                    (dateA ? dateA.getTime() : 0)
                );
            })
            .slice(0, 5);

        if (results.length === 0) {
            container.innerHTML = `
                <div class="student-empty-state">

                    <h3>No quiz results yet</h3>

                    <p>
                        Complete a quiz to see your scores here.
                    </p>

                </div>
            `;

            return;
        }

        container.innerHTML = `
            <div class="student-table-wrapper">

                <table class="student-table">

                    <thead>
                        <tr>
                            <th>Quiz</th>
                            <th>Score</th>
                            <th>Accuracy</th>
                            <th>Date</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${results.map(function (result) {
                            const quizName = escapeHTML(
                                safeText(
                                    result.quizName ||
                                    result.title ||
                                    result.name,
                                    "Quiz"
                                )
                            );

                            const score = getResultScore(result);

                            const accuracy = formatPercent(
                                getResultAccuracy(result)
                            );

                            const date = formatDate(
                                getResultDate(result)
                            );

                            return `
                                <tr>
                                    <td>${quizName}</td>
                                    <td>${score}</td>
                                    <td>${accuracy}</td>
                                    <td>${date}</td>
                                </tr>
                            `;
                        }).join("")}
                    </tbody>

                </table>

            </div>
        `;
    }


    /* =====================================================
       12. RECENT NOTIFICATIONS
       ===================================================== */

    async function loadRecentNotifications() {
        if (!state.db) {
            return [];
        }

        try {
            const snapshot = await state.db
                .collection(CONFIG.COLLECTIONS.NOTIFICATIONS)
                .where("published", "==", true)
                .get();

            const courseIds = getPurchasedCourseIds();

            state.notifications = snapshot.docs
                .map(function (doc) {
                    return {
                        id: doc.id,
                        ...doc.data()
                    };
                })
                .filter(function (notification) {
                    const audience = safeText(
                        notification.audience,
                        "all"
                    ).toLowerCase();

                    const courseId = safeText(
                        notification.courseId
                    );

                    if (
                        audience === "all" ||
                        audience === "all_students" ||
                        audience === "students"
                    ) {
                        return true;
                    }

                    if (
                        audience === "course" ||
                        notification.type === "course"
                    ) {
                        return courseIds.includes(courseId);
                    }

                    return true;
                })
                .sort(function (a, b) {
                    const dateA = getTimestampDate(
                        a.publishedAt || a.createdAt
                    );

                    const dateB = getTimestampDate(
                        b.publishedAt || b.createdAt
                    );

                    return (
                        (dateB ? dateB.getTime() : 0) -
                        (dateA ? dateA.getTime() : 0)
                    );
                })
                .slice(0, 5);

            renderRecentNotifications();

            return state.notifications;

        } catch (error) {
            console.warn(
                "mNEET Student: Notifications could not be loaded:",
                error
            );

            state.notifications = [];

            renderRecentNotifications();

            return [];
        }
    }


    function renderRecentNotifications() {
        const container = byId(
            "studentRecentNotifications"
        );

        if (!container) {
            return;
        }

        if (state.notifications.length === 0) {
            container.innerHTML = `
                <div class="student-empty-state">

                    <h3>No notifications available</h3>

                    <p>
                        Published announcements will appear here.
                    </p>

                </div>
            `;

            return;
        }

        container.innerHTML = state.notifications.map(
            function (notification) {
                const title = escapeHTML(
                    safeText(notification.title, "Announcement")
                );

                const message = escapeHTML(
                    safeText(notification.message, "")
                );

                const date = formatDate(
                    notification.publishedAt ||
                    notification.createdAt
                );

                return `
                    <article class="student-notification-item">

                        <div class="student-notification-icon">
                            ♧
                        </div>

                        <div class="student-notification-body">

                            <h3>${title}</h3>

                            <p>${message}</p>

                            <time>${escapeHTML(date)}</time>

                        </div>

                    </article>
                `;
            }
        ).join("");
    }


    /* =====================================================
       13. DASHBOARD REFRESH
       ===================================================== */

    async function refreshDashboard(options) {
        if (
            !state.user ||
            !state.db ||
            state.loading
        ) {
            return false;
        }

        const settings = options || {};

        state.loading = true;

        try {
            await loadPurchases();

            await loadCourses();

            buildPurchasedCourses();

            await Promise.all([
                loadQuizData(),
                loadChaptersAndTopics(),
                loadRecentNotifications()
            ]);

            renderStudentIdentity();
            renderDashboardStatistics();
            renderContinueLearning();
            renderRecentResults();

            state.dashboardLoaded = true;

            return true;

        } catch (error) {
            console.error(
                "mNEET Student: Dashboard refresh failed:",
                error
            );

            if (!settings.silent) {
                showMessage(
                    "Dashboard লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করো।",
                    "error"
                );
            }

            return false;

        } finally {
            state.loading = false;
        }
    }


    /* =====================================================
       14. PAGE NAVIGATION
       ===================================================== */

    const PAGE_CONFIG = Object.freeze({
        dashboard: {
            sectionId: "studentPageDashboard",
            title: "Dashboard"
        },

        courses: {
            sectionId: "studentPageCourses",
            title: "My Courses"
        },

        "available-courses": {
            sectionId: "studentPageAvailableCourses",
            title: "Available Courses"
        },

        study: {
            sectionId: "studentPageStudy",
            title: "Study"
        },

        "topic-practice": {
            sectionId: "studentPageTopicPractice",
            title: "Topic Wise Practice"
        },

        "chapter-practice": {
            sectionId: "studentPageChapterPractice",
            title: "Chapter Wise Practice"
        },

        ncert: {
            sectionId: "studentPageNcert",
            title: "NCERT Books"
        },

        notes: {
            sectionId: "studentPageNotes",
            title: "Notes"
        },

        pyq: {
            sectionId: "studentPagePyq",
            title: "Previous Year Questions"
        },

        "mock-tests": {
            sectionId: "studentPageMockTests",
            title: "Mock Tests"
        },

        results: {
            sectionId: "studentPageResults",
            title: "Quiz Results"
        },

        progress: {
            sectionId: "studentPageProgress",
            title: "My Progress"
        },

        "weak-points": {
            sectionId: "studentPageWeakPoints",
            title: "Weak Points"
        },

        "purchase-history": {
            sectionId: "studentPagePurchaseHistory",
            title: "Purchase History"
        },

        notifications: {
            sectionId: "studentPageNotifications",
            title: "Notifications"
        },

        profile: {
            sectionId: "studentPageProfile",
            title: "My Profile"
        },

        settings: {
            sectionId: "studentPageSettings",
            title: "Settings"
        },

        quiz: {
            sectionId: "studentQuizPage",
            title: "Quiz"
        },

        "pdf-reader": {
            sectionId: "studentPdfReaderPage",
            title: "PDF Reader"
        }
    });


    function normalizePageName(pageName) {
        return safeText(pageName, "dashboard")
            .toLowerCase()
            .replace(/_/g, "-")
            .trim();
    }


    function showPage(pageName, options) {
        const name = normalizePageName(pageName);
        const page = PAGE_CONFIG[name];

        if (!page) {
            console.warn(
                "mNEET Student: Unknown page:",
                name
            );

            return false;
        }

        const settings = options || {};

        const target = byId(page.sectionId);

        if (!target) {
            console.warn(
                "mNEET Student: Page container missing:",
                page.sectionId
            );

            return false;
        }

        document.querySelectorAll(
            "[data-student-section]"
        ).forEach(function (section) {
            section.hidden = true;
            section.classList.remove("active");
        });

        target.hidden = false;
        target.classList.add("active");

        document.querySelectorAll(
            "[data-student-page]"
        ).forEach(function (button) {
            const buttonPage = normalizePageName(
                button.getAttribute("data-student-page")
            );

            const active = buttonPage === name;

            button.classList.toggle("active", active);

            if (active) {
                button.setAttribute(
                    "aria-current",
                    "page"
                );
            } else {
                button.removeAttribute("aria-current");
            }
        });

        state.activePage = name;

        setText("studentPageTitle", page.title);

        if (!settings.preserveScroll) {
            window.scrollTo({
                top: 0,
                behavior: "auto"
            });
        }

        document.dispatchEvent(
            new CustomEvent("mneet:student-page-change", {
                detail: {
                    page: name,
                    title: page.title,
                    user: state.user,
                    courseId: state.activeCourseId
                }
            })
        );

        /*
         * Student modules can listen for the custom event:
         * mneet:student-page-change
         *
         * Each module can load only when its page becomes active.
         */

        return true;
    }


    function navigateTo(pageName, options) {
        return showPage(pageName, options);
    }


    function openCourse(courseId) {
        const id = safeText(courseId);

        if (!id) {
            showMessage(
                "কোর্স নির্বাচন করা যায়নি।",
                "error"
            );

            return false;
        }

        if (!hasCourseAccess(id)) {
            showMessage(
                "এই কোর্সে প্রবেশের জন্য Admin-এর payment approval প্রয়োজন।",
                "error"
            );

            return false;
        }

        state.activeCourseId = id;

        try {
            sessionStorage.setItem(
                "mneetActiveCourse",
                id
            );

            localStorage.setItem(
                "activeCourse",
                id
            );

        } catch (error) {
            console.warn(
                "mNEET Student: Could not save active course.",
                error
            );
        }

        showPage("study");

        document.dispatchEvent(
            new CustomEvent("mneet:student-course-change", {
                detail: {
                    courseId: id,
                    course: state.purchasedCourses.find(
                        function (course) {
                            return course.id === id;
                        }
                    ) || null
                }
            })
        );

        return true;
    }


    function restoreActiveCourse() {
        let courseId = "";

        try {
            courseId =
                sessionStorage.getItem("mneetActiveCourse") ||
                localStorage.getItem("activeCourse") ||
                "";

        } catch (error) {
            courseId = "";
        }

        if (courseId && hasCourseAccess(courseId)) {
            state.activeCourseId = courseId;
        } else {
            state.activeCourseId = null;
        }
    }


    /* =====================================================
       15. NAVIGATION EVENTS
       ===================================================== */

    function setupNavigationEvents() {
        if (state.navigationEventsReady) {
            return;
        }

        state.navigationEventsReady = true;

        document.addEventListener("click", function (event) {
            const pageButton = event.target.closest(
                "[data-student-page]"
            );

            if (pageButton) {
                const pageName = pageButton.getAttribute(
                    "data-student-page"
                );

                showPage(pageName);

                return;
            }

            const courseButton = event.target.closest(
                "[data-student-open-course]"
            );

            if (courseButton) {
                const courseId = courseButton.getAttribute(
                    "data-student-open-course"
                );

                openCourse(courseId);
            }
        });


        const notificationButton = byId(
            "studentNotificationButton"
        );

        if (
            notificationButton &&
            !notificationButton.dataset.bound
        ) {
            notificationButton.dataset.bound = "true";

            notificationButton.addEventListener(
                "click",
                function () {
                    showPage("notifications");
                }
            );
        }


        const topbarProfile = byId(
            "studentTopbarProfile"
        );

        if (
            topbarProfile &&
            !topbarProfile.dataset.bound
        ) {
            topbarProfile.dataset.bound = "true";

            topbarProfile.addEventListener(
                "click",
                function () {
                    showPage("profile");
                }
            );
        }


        const year = byId("studentCurrentYear");

        if (year) {
            year.textContent = String(
                new Date().getFullYear()
            );
        }
    }


    /* =====================================================
       16. LOGOUT
       ===================================================== */

    async function logout() {
        if (
            state.loggingOut ||
            !state.auth
        ) {
            return;
        }

        const confirmed = window.confirm(
            "তুমি কি mNEET থেকে Logout করতে চাও?"
        );

        if (!confirmed) {
            return;
        }

        state.loggingOut = true;

        showLoading("Signing out...");

        try {
            await state.auth.signOut();

            window.location.replace(
                CONFIG.LOGIN_PAGE
            );

        } catch (error) {
            console.error(
                "mNEET Student: Logout failed:",
                error
            );

            state.loggingOut = false;

            hideLoading();

            showMessage(
                "Logout করা যায়নি। আবার চেষ্টা করো।",
                "error"
            );
        }
    }


    function setupLogout() {
        const buttonIds = [
            "studentSidebarLogout"
        ];

        buttonIds.forEach(function (id) {
            const button = byId(id);

            if (
                button &&
                !button.dataset.bound
            ) {
                button.dataset.bound = "true";

                button.addEventListener(
                    "click",
                    logout
                );
            }
        });
    }


    /* =====================================================
       17. THEME BUTTON
       ===================================================== */

    function setupThemeButton() {
        const button = byId("studentThemeToggle");

        if (
            !button ||
            button.dataset.bound
        ) {
            return;
        }

        button.dataset.bound = "true";

        button.addEventListener("click", function () {
            /*
             * theme.js will manage the actual theme preference.
             * This event allows that module to handle the click.
             */
            document.dispatchEvent(
                new CustomEvent("mneet:student-theme-toggle")
            );
        });
    }


    /* =====================================================
       18. REFRESH TIMER
       ===================================================== */

    function setupRefreshTimer() {
        if (state.refreshTimer) {
            clearInterval(state.refreshTimer);
        }

        state.refreshTimer = setInterval(
            function () {
                if (
                    document.visibilityState === "visible" &&
                    state.user &&
                    !state.loading &&
                    !state.loggingOut
                ) {
                    refreshDashboard({
                        silent: true
                    });
                }
            },
            CONFIG.REFRESH_INTERVAL
        );
    }


    /* =====================================================
       19. INITIALIZE STUDENT PANEL
       ===================================================== */

    async function initializeStudent(user) {
        if (!user) {
            state.user = null;
            state.profile = null;

            showLoading("Redirecting to login...");

            window.location.replace(
                CONFIG.LOGIN_PAGE
            );

            return;
        }

        state.user = user;

        const authorizedStudent =
            await verifyCurrentAccount(user);

        /*
         * Admin verification can redirect an Admin to admin.html.
         * Do not show the Student Panel in that case.
         */
        if (!authorizedStudent) {
            return;
        }

        showLoading("Loading your dashboard...");

        await loadStudentProfile(user);

        await refreshDashboard({
            silent: false
        });

        restoreActiveCourse();

        setupNavigationEvents();
        setupLogout();
        setupThemeButton();

        renderStudentIdentity();
        renderDashboardStatistics();
        renderContinueLearning();
        renderRecentResults();

        if (!state.initialized) {
            state.initialized = true;

            setupRefreshTimer();

            document.dispatchEvent(
                new CustomEvent("mneet:student-ready", {
                    detail: {
                        user: state.user,
                        profile: state.profile,
                        purchasedCourses:
                            state.purchasedCourses
                    }
                })
            );
        }

        hideLoading();

        showPage("dashboard", {
            preserveScroll: true
        });
    }


    /* =====================================================
       20. AUTH STATE LISTENER
       ===================================================== */

    function setupAuthentication() {
        const services = getFirebaseServices();

        if (state.authUnsubscribe) {
            state.authUnsubscribe();
            state.authUnsubscribe = null;
        }

        state.authUnsubscribe =
            services.auth.onAuthStateChanged(
                async function (user) {
                    if (!user) {
                        state.user = null;
                        state.profile = null;
                        state.purchasedCourses = [];
                        state.purchases = [];
                        state.quizAttempts = [];
                        state.quizResults = [];

                        showLoading("Redirecting to login...");

                        if (
                            getCurrentPageName() !==
                            CONFIG.LOGIN_PAGE
                        ) {
                            window.location.replace(
                                CONFIG.LOGIN_PAGE
                            );
                        }

                        return;
                    }

                    try {
                        await initializeStudent(user);

                    } catch (error) {
                        console.error(
                            "mNEET Student: Initialization failed:",
                            error
                        );

                        hideLoading();

                        showMessage(
                            "Student Dashboard চালু করা যায়নি। Firebase connection ও Firestore permissions পরীক্ষা করো।",
                            "error"
                        );
                    }
                }
            );
    }


    /* =====================================================
       21. PUBLIC API
       ===================================================== */

    const publicAPI = {
        config: CONFIG,
        state: state,

        initialize: setupAuthentication,

        refreshDashboard: refreshDashboard,

        showPage: showPage,
        navigateTo: navigateTo,
        openCourse: openCourse,

        logout: logout,

        showMessage: showMessage,
        hideMessage: hideMessage,

        getCurrentUser: function () {
            return state.user;
        },

        getProfile: function () {
            return state.profile;
        },

        getActivePage: function () {
            return state.activePage;
        },

        getActiveCourseId: getActiveCourseId,

        getPurchasedCourses: function () {
            return state.purchasedCourses.slice();
        },

        getAvailableCourses: function () {
            return state.availableCourses.slice();
        },

        getPurchases: function () {
            return state.purchases.slice();
        },

        getQuizAttempts: function () {
            return state.quizAttempts.slice();
        },

        getQuizResults: function () {
            return state.quizResults.slice();
        },

        getChapters: function () {
            return state.chapters.slice();
        },

        getTopics: function () {
            return state.topics.slice();
        },

        getNotifications: function () {
            return state.notifications.slice();
        },

        hasCourseAccess: hasCourseAccess,

        isAdmin: function () {
            return state.isAdmin;
        },

        isReady: function () {
            return state.initialized;
        }
    };


    window.MNEETStudent = publicAPI;


    /* =====================================================
       22. START
       ===================================================== */

    function start() {
        if (state.startCalled) {
            return;
        }

        state.startCalled = true;

        setupNavigationEvents();
        setupLogout();
        setupThemeButton();

        try {
            setupAuthentication();

        } catch (error) {
            console.error(
                "mNEET Student: Firebase startup failed:",
                error
            );

            showLoading("Firebase connection unavailable.");

            showMessage(
                "Firebase চালু করা যায়নি। firebase.js এবং Firebase SDK পরীক্ষা করো।",
                "error"
            );
        }
    }


    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            start,
            { once: true }
        );

    } else {
        start();
    }

})();
