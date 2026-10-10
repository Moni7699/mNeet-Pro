/* =========================================================
   mNEET — Shared Project Constants
   File: constants.js

   Requirements:
   - Admin-controlled NEET preparation platform
   - No Teacher Panel
   - Course → Subject → Chapter → Topic → Quiz → Questions
   - Manual payment approval
   - Student progress and quiz results
   - Green and White design system compatibility
   ========================================================= */

(function (window) {
  "use strict";

  const constants = {};

  /* =======================================================
     1. PROJECT INFORMATION
     ======================================================= */

  constants.APP = Object.freeze({
    name: "mNEET",
    fullName: "mNEET NEET Preparation",
    projectId: "mneet-spark",
    defaultTarget: "NEET",
    defaultTheme: "dark",
    supportedThemes: Object.freeze([
      "dark",
      "light"
    ])
  });

  /* =======================================================
     2. PAGE PATHS
     ======================================================= */

  constants.PAGES = Object.freeze({
    LOGIN: "index.html",
    ADMIN: "admin.html",
    STUDENT: "student.html"
  });

  /* =======================================================
     3. FIREBASE COLLECTION NAMES
     Use these names consistently in frontend modules.
     ======================================================= */

  constants.COLLECTIONS = Object.freeze({
    ADMINS: "admins",
    USERS: "users",

    COURSES: "courses",
    SUBJECTS: "subjects",
    CHAPTERS: "chapters",
    TOPICS: "topics",

    QUIZZES: "quizzes",
    QUESTIONS: "questions",
    QUESTION_ANSWERS: "questionAnswers",

    NOTES: "notes",
    NCERT: "ncert",
    PYQ: "pyq",

    PURCHASES: "purchases",
    COURSE_ACCESS: "courseAccess",

    QUIZ_ATTEMPTS: "quizAttempts",
    QUIZ_RESULTS: "quizResults",

    STUDENT_PROGRESS: "studentProgress",
    STUDENT_NCERT_PROGRESS: "studentNcertProgress",
    STUDENT_MATERIAL_PROGRESS: "studentMaterialProgress",

    NOTIFICATIONS: "notifications",
    STUDENT_NOTIFICATION_READS: "studentNotificationReads",

    SETTINGS: "settings",
    MOCK_TESTS: "mockTests",
    MOCK_TEST_ATTEMPTS: "mockTestAttempts",

    STUDENT_SETTINGS: "studentSettings",
    SUPPORT_REQUESTS: "supportRequests"
  });

  /* =======================================================
     4. FIREBASE DOCUMENT IDS
     ======================================================= */

  constants.DOCUMENTS = Object.freeze({
    GENERAL_SETTINGS: "general"
  });

  /* =======================================================
     5. USER ROLES
     No teacher role or teacher panel.
     ======================================================= */

  constants.ROLES = Object.freeze({
    ADMIN: "admin",
    STUDENT: "student"
  });

  /* =======================================================
     6. ACCOUNT STATUS
     ======================================================= */

  constants.ACCOUNT_STATUS = Object.freeze({
    ACTIVE: "active",
    INACTIVE: "inactive",
    SUSPENDED: "suspended"
  });

  /* =======================================================
     7. COURSE STATUS
     ======================================================= */

  constants.COURSE_STATUS = Object.freeze({
    ACTIVE: "active",
    INACTIVE: "inactive",
    PUBLISHED: "published",
    DRAFT: "draft"
  });

  /* =======================================================
     8. PURCHASE AND PAYMENT STATUS
     Admin approval is required before course access.
     ======================================================= */

  constants.PAYMENT_STATUS = Object.freeze({
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
    PAID: "paid",
    COMPLETED: "completed",
    REFUNDED: "refunded"
  });

  constants.APPROVED_PAYMENT_STATUSES = Object.freeze([
    "approved",
    "paid",
    "completed"
  ]);

  constants.PENDING_PAYMENT_STATUSES = Object.freeze([
    "pending"
  ]);

  constants.REJECTED_PAYMENT_STATUSES = Object.freeze([
    "rejected"
  ]);

  /* =======================================================
     9. QUIZ STATUS
     ======================================================= */

  constants.QUIZ_STATUS = Object.freeze({
    DRAFT: "draft",
    ACTIVE: "active",
    PUBLISHED: "published",
    INACTIVE: "inactive"
  });

  /* =======================================================
     10. REQUIRED QUIZ TYPES
     ======================================================= */

  constants.QUIZ_TYPES = Object.freeze({
    TOPIC: "topic",
    ASSERTION_REASON: "assertion_reason",
    STATEMENT_BASED: "statement_based",
    MATCH_FOLLOWING: "match_following",
    CORRECT_INCORRECT: "correct_incorrect",
    DIAGRAM_BASED: "diagram_based",
    PYQ: "pyq",
    FILL_BLANKS: "fill_blanks",
    RAPID_REVISION: "rapid_revision"
  });

  constants.QUIZ_TYPE_LABELS = Object.freeze({
    topic: "Topic Wise Practice",
    assertion_reason: "Assertion–Reason",
    statement_based: "Statement Based",
    match_following: "Match the Following",
    correct_incorrect: "Correct / Incorrect",
    diagram_based: "Diagram Based",
    pyq: "Previous Year Questions",
    fill_blanks: "Fill in the Blanks",
    rapid_revision: "Rapid Revision"
  });

  /* =======================================================
     11. QUIZ DEFAULTS
     Admin settings may override these defaults.
     ======================================================= */

  constants.QUIZ_DEFAULTS = Object.freeze({
    QUESTION_TIME_SECONDS: 60,
    ATTEMPT_TIME_REDUCTION_SECONDS: 10,
    POSITIVE_MARKS: 4,
    NEGATIVE_MARKS: 1,
    UNANSWERED_MARKS: 0,
    MIN_QUESTION_TIME_SECONDS: 1,
    MAX_QUESTION_TIME_SECONDS: 3600
  });

  /* =======================================================
     12. QUIZ ANSWER STATUS
     ======================================================= */

  constants.ANSWER_STATUS = Object.freeze({
    CORRECT: "correct",
    INCORRECT: "incorrect",
    SKIPPED: "skipped",
    UNANSWERED: "unanswered"
  });

  constants.QUIZ_ATTEMPT_STATUS = Object.freeze({
    IN_PROGRESS: "in_progress",
    SUBMITTED: "submitted",
    COMPLETED: "completed",
    TIMEOUT: "timeout"
  });

  /* =======================================================
     13. MATERIAL TYPES
     ======================================================= */

  constants.MATERIAL_TYPES = Object.freeze({
    NOTES: "notes",
    NCERT: "ncert",
    PYQ: "pyq"
  });

  /* =======================================================
     14. NOTIFICATION TYPES
     ======================================================= */

  constants.NOTIFICATION_TYPES = Object.freeze({
    GENERAL: "general",
    COURSE: "course",
    NOTES: "notes",
    QUIZ: "quiz",
    COURSE_UPDATE: "course_update"
  });

  constants.NOTIFICATION_STATUS = Object.freeze({
    DRAFT: "draft",
    PUBLISHED: "published"
  });

  constants.NOTIFICATION_AUDIENCES = Object.freeze({
    ALL: "all",
    STUDENTS: "students",
    COURSE: "course",
    PURCHASED_COURSE: "purchased_course",
    SPECIFIC_USER: "specific_user",
    SPECIFIC_USERS: "specific_users"
  });

  /* =======================================================
     15. FILE UPLOAD LIMITS
     These are frontend validation defaults.
     Firebase Storage Rules must enforce limits separately.
     ======================================================= */

  constants.FILE_LIMITS = Object.freeze({
    IMAGE_BYTES: 5 * 1024 * 1024,
    PDF_BYTES: 20 * 1024 * 1024,
    PAYMENT_SCREENSHOT_BYTES: 5 * 1024 * 1024
  });

  constants.FILE_TYPES = Object.freeze({
    IMAGE_MIME_TYPES: Object.freeze([
      "image/jpeg",
      "image/png",
      "image/webp"
    ]),

    PDF_MIME_TYPES: Object.freeze([
      "application/pdf"
    ])
  });

  /* =======================================================
     16. STORAGE PATHS
     Must match the Firebase Storage Rules and upload modules.
     ======================================================= */

  constants.STORAGE_PATHS = Object.freeze({
    COURSE_THUMBNAILS: "course-thumbnails",
    NOTES: "notes",
    NCERT: "ncert",
    PYQ: "pyq",
    QUESTION_IMAGES: "question-images",
    PAYMENT_QR: "payment-qr",
    ADMIN_PROFILES: "admin-profiles",
    STUDENT_PROFILES: "student-profiles",
    PAYMENT_SCREENSHOTS: "payment-screenshots",
    STUDENT_ATTACHMENTS: "student-attachments"
  });

  /* =======================================================
     17. STUDENT NAVIGATION KEYS
     ======================================================= */

  constants.STUDENT_PAGES = Object.freeze({
    DASHBOARD: "dashboard",
    COURSES: "courses",
    AVAILABLE_COURSES: "availableCourses",
    STUDY: "study",
    CHAPTERS: "chapters",
    TOPICS: "topics",
    TOPIC_PRACTICE: "topicPractice",
    CHAPTER_PRACTICE: "chapterPractice",
    NCERT: "ncert",
    NOTES: "notes",
    PYQ: "pyq",
    MOCK_TESTS: "mockTests",
    RESULTS: "results",
    PROGRESS: "progress",
    WEAK_POINTS: "weakPoints",
    PURCHASE_HISTORY: "purchaseHistory",
    NOTIFICATIONS: "notifications",
    PROFILE: "profile",
    SETTINGS: "settings",
    PURCHASE: "purchase"
  });

  /* =======================================================
     18. ADMIN NAVIGATION KEYS
     ======================================================= */

  constants.ADMIN_PAGES = Object.freeze({
    DASHBOARD: "dashboard",
    COURSES: "courses",
    SUBJECTS: "subjects",
    CHAPTERS: "chapters",
    TOPICS: "topics",
    QUIZZES: "quizzes",
    QUESTIONS: "questions",
    NOTES: "notes",
    NCERT: "ncert",
    PYQ: "pyq",
    STUDENTS: "students",
    PURCHASES: "purchases",
    NOTIFICATIONS: "notifications",
    PROFILE: "profile",
    SETTINGS: "settings"
  });

  /* =======================================================
     19. THEME COLORS
     Green and White only.
     ======================================================= */

  constants.THEME = Object.freeze({
    DEFAULT: "dark",

    COLORS: Object.freeze({
      BACKGROUND: "#071A12",
      CARD: "#0D2419",
      PRIMARY_GREEN: "#16A34A",
      LIGHT_GREEN: "#22C55E",
      WHITE: "#FFFFFF",
      SECONDARY_WHITE: "#D1D5DB",
      INPUT_BACKGROUND: "#10291D",
      BORDER_GREEN: "#28513A"
    })
  });

  /* =======================================================
     20. SOCIAL LINK SETTING KEYS
     Admin-configured links for the Student Panel.
     ======================================================= */

  constants.SOCIAL_SETTINGS = Object.freeze({
    FACEBOOK: "facebookUrl",
    INSTAGRAM: "instagramUrl",
    YOUTUBE: "youtubeUrl",
    WHATSAPP: "whatsappUrl"
  });

  /* =======================================================
     21. PROFILE FIELD NAMES
     ======================================================= */

  constants.PROFILE_FIELDS = Object.freeze({
    NAME: "name",
    FULL_NAME: "fullName",
    EMAIL: "email",
    PHONE: "phone",
    TARGET: "target",
    EXAM_TARGET: "examTarget",
    PHOTO_URL: "photoURL",
    ACCOUNT_STATUS: "accountStatus",
    CREATED_AT: "createdAt",
    UPDATED_AT: "updatedAt"
  });

  /* =======================================================
     22. COMMON FIRESTORE FIELD NAMES
     ======================================================= */

  constants.FIELDS = Object.freeze({
    USER_ID: "userId",
    STUDENT_ID: "studentId",
    COURSE_ID: "courseId",
    SUBJECT_ID: "subjectId",
    CHAPTER_ID: "chapterId",
    TOPIC_ID: "topicId",
    QUIZ_ID: "quizId",
    QUESTION_ID: "questionId",
    ORDER: "order",
    ACTIVE: "active",
    PUBLISHED: "published",
    STATUS: "status",
    CREATED_AT: "createdAt",
    UPDATED_AT: "updatedAt",
    PUBLISHED_AT: "publishedAt"
  });

  /* =======================================================
     23. DATE AND TIME FORMAT DEFAULTS
     ======================================================= */

  constants.DATE_FORMATS = Object.freeze({
    LOCALE: "en-IN",
    DATE_STYLE: "long",
    TIME_HOUR12: true
  });

  /* =======================================================
     24. SUPPORT REQUEST STATUS
     ======================================================= */

  constants.SUPPORT_STATUS = Object.freeze({
    OPEN: "open",
    IN_PROGRESS: "in_progress",
    RESOLVED: "resolved",
    CLOSED: "closed"
  });

  /* =======================================================
     25. GENERAL HELPERS
     ======================================================= */

  constants.isApprovedPaymentStatus = function (status) {
    return constants.APPROVED_PAYMENT_STATUSES.includes(
      String(status || "").trim().toLowerCase()
    );
  };

  constants.isPendingPaymentStatus = function (status) {
    return constants.PENDING_PAYMENT_STATUSES.includes(
      String(status || "").trim().toLowerCase()
    );
  };

  constants.isRejectedPaymentStatus = function (status) {
    return constants.REJECTED_PAYMENT_STATUSES.includes(
      String(status || "").trim().toLowerCase()
    );
  };

  constants.isValidQuizType = function (type) {
    return Object.values(constants.QUIZ_TYPES).includes(
      String(type || "").trim()
    );
  };

  constants.getQuizTypeLabel = function (type) {
    const normalized = String(type || "").trim();

    return constants.QUIZ_TYPE_LABELS[normalized] ||
      normalized ||
      "Quiz";
  };

  constants.getCollectionName = function (key) {
    return constants.COLLECTIONS[
      String(key || "").trim().toUpperCase()
    ] || null;
  };

  constants.getPagePath = function (key) {
    return constants.PAGES[
      String(key || "").trim().toUpperCase()
    ] || null;
  };

  /* =======================================================
     26. PUBLIC API
     ======================================================= */

  window.MNEETConstants = Object.freeze(constants);

})(window);
