/* =========================================================
   mNEET STUDENT PANEL
   FILE 30: student-purchase.js

   Manual Course Payment:
   - Admin-configured UPI ID
   - Admin-configured payment QR
   - Course price and selection
   - Transaction ID submission
   - Optional payment screenshot
   - Pending / approved / rejected status
   - Purchase history
   - Course access only after approval

   Firebase Compat SDK required.
========================================================= */

(function () {
  "use strict";

  const MODULE_NAME = "MNEETStudentPurchase";
  const STYLE_ID = "mneet-student-purchase-styles";

  const COLLECTIONS = {
    courses: "courses",
    purchases: "purchases",
    settings: "settings",
    users: "users"
  };

  const SETTINGS_DOCUMENT = "general";

  const state = {
    initialized: false,
    loading: false,
    submitting: false,
    currentCourseId: "",
    courses: [],
    purchases: [],
    settings: {},
    lastError: null
  };

  /* =======================================================
     HELPERS
  ======================================================= */

  function getStudentApp() {
    return window.MNEETStudent || null;
  }

  function getDB() {
    if (
      window.MNEETFirebase &&
      window.MNEETFirebase.db
    ) {
      return window.MNEETFirebase.db;
    }

    if (
      window.mneetDB &&
      typeof window.mneetDB.collection === "function"
    ) {
      return window.mneetDB;
    }

    if (
      window.firebase &&
      firebase.apps &&
      firebase.apps.length
    ) {
      return firebase.firestore();
    }

    throw new Error(
      "Firebase database পাওয়া যাচ্ছে না। firebase.js পরীক্ষা করো।"
    );
  }

  function getAuth() {
    if (
      window.firebase &&
      firebase.apps &&
      firebase.apps.length
    ) {
      return firebase.auth();
    }

    return null;
  }

  function getCurrentUser() {
    const student = getStudentApp();

    if (
      student &&
      typeof student.getCurrentUser === "function"
    ) {
      return student.getCurrentUser();
    }

    const auth = getAuth();

    return auth ? auth.currentUser : null;
  }

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getValue(object, keys, fallback) {
    for (const key of keys) {
      if (
        object &&
        object[key] !== undefined &&
        object[key] !== null &&
        object[key] !== ""
      ) {
        return object[key];
      }
    }

    return fallback;
  }

  function getCourseId(course) {
    return clean(
      getValue(course, ["id", "courseId", "courseID"], "")
    );
  }

  function getCourseName(course) {
    return clean(
      getValue(
        course,
        ["name", "courseName", "title"],
        "Course"
      )
    );
  }

  function getPrice(course) {
    const value = Number(
      getValue(course, ["price", "coursePrice", "amount"], 0)
    );

    return Number.isFinite(value) && value >= 0
      ? value
      : 0;
  }

  function formatPrice(value) {
    return "₹" + Number(value || 0).toLocaleString("en-IN", {
      maximumFractionDigits: 2
    });
  }

  function getCourseImage(course) {
    return clean(
      getValue(
        course,
        [
          "thumbnailURL",
          "thumbnailUrl",
          "thumbnail",
          "imageURL",
          "imageUrl"
        ],
        ""
      )
    );
  }

  function getElement(ids) {
    for (const id of ids) {
      const element = document.getElementById(id);

      if (element) {
        return element;
      }
    }

    return null;
  }

  function showMessage(message, type) {
    const box = getElement([
      "studentPurchaseMessage",
      "studentMessage"
    ]);

    if (box) {
      box.textContent = message;
      box.hidden = false;
      box.setAttribute(
        "role",
        type === "error" ? "alert" : "status"
      );
      return;
    }

    window.alert(message);
  }

  function hideMessage() {
    const box = getElement([
      "studentPurchaseMessage"
    ]);

    if (box) {
      box.textContent = "";
      box.hidden = true;
    }
  }

  function statusText(status) {
    const normalized = clean(status).toLowerCase();

    if (
      normalized === "approved" ||
      normalized === "paid" ||
      normalized === "completed"
    ) {
      return "Approved";
    }

    if (normalized === "rejected") {
      return "Rejected";
    }

    return "Pending Admin Approval";
  }

  function isApproved(status) {
    const normalized = clean(status).toLowerCase();

    return (
      normalized === "approved" ||
      normalized === "paid" ||
      normalized === "completed"
    );
  }

  function isPending(status) {
    const normalized = clean(status).toLowerCase();

    return (
      normalized === "" ||
      normalized === "pending" ||
      normalized === "submitted" ||
      normalized === "under_review"
    );
  }

  function isActiveCourse(course) {
    return Boolean(course) &&
      course.active !== false &&
      course.published !== false;
  }

  function isValidUPI(value) {
    const upi = clean(value);

    if (!upi) {
      return false;
    }

    return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9.-]{2,64}$/.test(upi);
  }

  /* =======================================================
     STYLES — GREEN + WHITE ONLY
  ======================================================= */

  function addStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");

    style.id = STYLE_ID;

    style.textContent = `
      .mneet-purchase-wrap {
        width: 100%;
        max-width: 900px;
        margin: 0 auto;
        color: #FFFFFF;
        box-sizing: border-box;
      }

      .mneet-purchase-card {
        border: 1px solid #28513A;
        background: #0D2419;
        border-radius: 16px;
        padding: 18px;
        margin-bottom: 16px;
        box-sizing: border-box;
        min-width: 0;
      }

      .mneet-purchase-title {
        margin: 0 0 12px;
        color: #FFFFFF;
        font-size: 20px;
        font-weight: 800;
        line-height: 1.4;
        overflow-wrap: anywhere;
      }

      .mneet-purchase-description {
        color: #D1D5DB;
        font-size: 14px;
        line-height: 1.7;
        margin: 0 0 14px;
      }

      .mneet-purchase-price {
        color: #22C55E;
        font-size: 24px;
        font-weight: 800;
        margin: 12px 0;
      }

      .mneet-purchase-label {
        display: block;
        color: #FFFFFF;
        font-size: 14px;
        font-weight: 700;
        margin: 14px 0 7px;
      }

      .mneet-purchase-input,
      .mneet-purchase-select,
      .mneet-purchase-textarea {
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        border: 1px solid #28513A;
        border-radius: 10px;
        padding: 12px;
        background: #10291D;
        color: #FFFFFF;
        font-size: 14px;
        outline: none;
      }

      .mneet-purchase-input:focus,
      .mneet-purchase-select:focus,
      .mneet-purchase-textarea:focus {
        border-color: #22C55E;
      }

      .mneet-purchase-input::placeholder,
      .mneet-purchase-textarea::placeholder {
        color: #D1D5DB;
      }

      .mneet-purchase-button {
        display: inline-flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        min-height: 44px;
        margin-top: 14px;
        padding: 12px 16px;
        border: 1px solid #16A34A;
        border-radius: 10px;
        background: #16A34A;
        color: #FFFFFF;
        font-size: 14px;
        font-weight: 800;
        cursor: pointer;
        box-sizing: border-box;
      }

      .mneet-purchase-button:hover {
        background: #15803D;
      }

      .mneet-purchase-button:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }

      .mneet-purchase-button-secondary {
        background: #10291D;
        border-color: #28513A;
      }

      .mneet-purchase-qr {
        display: block;
        width: min(100%, 280px);
        max-height: 350px;
        object-fit: contain;
        margin: 14px auto;
        padding: 8px;
        border: 1px solid #28513A;
        border-radius: 12px;
        background: #FFFFFF;
        box-sizing: border-box;
      }

      .mneet-purchase-payment-info {
        border: 1px solid #28513A;
        background: #10291D;
        padding: 14px;
        border-radius: 12px;
        overflow-wrap: anywhere;
      }

      .mneet-purchase-status {
        display: inline-block;
        padding: 7px 11px;
        border: 1px solid #28513A;
        border-radius: 999px;
        background: #10291D;
        color: #FFFFFF;
        font-size: 12px;
        font-weight: 700;
      }

      .mneet-purchase-note {
        color: #D1D5DB;
        font-size: 13px;
        line-height: 1.7;
        margin-top: 12px;
      }

      .mneet-purchase-history-row {
        border-top: 1px solid #28513A;
        padding: 14px 0;
        overflow-wrap: anywhere;
      }

      .mneet-purchase-history-row:first-child {
        border-top: 0;
      }

      .mneet-purchase-empty {
        border: 1px solid #28513A;
        border-radius: 12px;
        padding: 16px;
        background: #0D2419;
        color: #D1D5DB;
        line-height: 1.7;
      }

      .mneet-purchase-grid {
        display: grid;
        grid-template-columns: repeat(
          auto-fit,
          minmax(min(100%, 240px), 1fr)
        );
        gap: 14px;
      }

      .mneet-purchase-course {
        border: 1px solid #28513A;
        border-radius: 13px;
        padding: 14px;
        background: #0D2419;
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .mneet-purchase-course img {
        display: block;
        width: 100%;
        height: 130px;
        object-fit: cover;
        border-radius: 9px;
        margin-bottom: 12px;
      }

      .mneet-purchase-message {
        border: 1px solid #28513A;
        border-radius: 10px;
        background: #10291D;
        color: #FFFFFF;
        padding: 12px;
        margin-bottom: 14px;
        line-height: 1.6;
      }

      @media (max-width: 480px) {
        .mneet-purchase-card {
          padding: 14px;
          border-radius: 13px;
        }

        .mneet-purchase-title {
          font-size: 18px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* =======================================================
     LOAD COURSE, PAYMENT SETTINGS, PURCHASE HISTORY
  ======================================================= */

  async function loadCourses() {
    const snapshot = await getDB()
      .collection(COLLECTIONS.courses)
      .get();

    state.courses = [];

    snapshot.forEach(function (doc) {
      state.courses.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return state.courses;
  }

  async function loadPaymentSettings() {
    /*
      Settings are read from settings/general.

      Suggested fields:
      - upiId
      - paymentQrUrl
      - supportEmail

      The Admin settings module must save the same field names
      for these values to appear here.
    */

    try {
      const doc = await getDB()
        .collection(COLLECTIONS.settings)
        .doc(SETTINGS_DOCUMENT)
        .get();

      state.settings = doc.exists
        ? (doc.data() || {})
        : {};
    } catch (error) {
      console.warn(
        "[mNEET Purchase] Could not load payment settings:",
        error
      );

      state.settings = {};
    }

    return state.settings;
  }

  async function loadMyPurchases() {
    const user = getCurrentUser();

    if (!user) {
      throw new Error("Login করার পরে আবার চেষ্টা করো।");
    }

    const snapshot = await getDB()
      .collection(COLLECTIONS.purchases)
      .where("userId", "==", user.uid)
      .get();

    state.purchases = [];

    snapshot.forEach(function (doc) {
      state.purchases.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return state.purchases;
  }

  function findCourse(courseId) {
    return state.courses.find(function (course) {
      return getCourseId(course) === clean(courseId);
    }) || null;
  }

  function getCoursePurchaseRecords(courseId) {
    return state.purchases.filter(function (purchase) {
      return clean(
        getValue(
          purchase,
          ["courseId", "courseID", "course_id"],
          ""
        )
      ) === clean(courseId);
    });
  }

  function hasApprovedPurchase(courseId) {
    return getCoursePurchaseRecords(courseId)
      .some(function (purchase) {
        return isApproved(purchase.status || purchase.paymentStatus);
      });
  }

  function hasPendingRequest(courseId) {
    return getCoursePurchaseRecords(courseId)
      .some(function (purchase) {
        const status = purchase.status || purchase.paymentStatus;

        return isPending(status);
      });
  }

  /* =======================================================
     PAYMENT PAGE RENDERING
  ======================================================= */

  function getPurchaseContainer() {
    return getElement([
      "studentPurchaseContent",
      "studentPurchasePageContent",
      "studentPagePurchase"
    ]);
  }

  function renderCoursePicker() {
    const courses = state.courses.filter(isActiveCourse);

    if (!courses.length) {
      return (
        '<div class="mneet-purchase-empty">' +
        "এখন কোনো Active Course নেই। পরে আবার চেষ্টা করো।" +
        "</div>"
      );
    }

    return (
      '<div class="mneet-purchase-grid">' +
      courses.map(function (course) {
        const id = getCourseId(course);
        const name = getCourseName(course);
        const image = getCourseImage(course);
        const price = getPrice(course);

        let imageHTML = "";

        if (image) {
          imageHTML =
            '<img src="' + escapeHTML(image) +
            '" alt="' + escapeHTML(name) + '" loading="lazy">';
        }

        let buttonLabel = "Select Course";
        let disabled = "";

        if (hasApprovedPurchase(id)) {
          buttonLabel = "Already Purchased";
          disabled = " disabled";
        } else if (hasPendingRequest(id)) {
          buttonLabel = "Approval Pending";
          disabled = " disabled";
        }

        return (
          '<article class="mneet-purchase-course">' +
            imageHTML +
            '<h3 class="mneet-purchase-title">' +
              escapeHTML(name) +
            "</h3>" +
            '<div class="mneet-purchase-price">' +
              escapeHTML(formatPrice(price)) +
            "</div>" +
            '<button type="button" class="mneet-purchase-button" ' +
              'data-mneet-select-course="' + escapeHTML(id) + '"' +
              disabled + ">" +
              escapeHTML(buttonLabel) +
            "</button>" +
          "</article>"
        );
      }).join("") +
      "</div>"
    );
  }

  function renderPaymentForm(course) {
    const user = getCurrentUser();

    if (!course) {
      return (
        '<div class="mneet-purchase-empty">' +
        "একটি Course নির্বাচন করো।" +
        "</div>"
      );
    }

    const courseId = getCourseId(course);

    if (hasApprovedPurchase(courseId)) {
      return (
        '<div class="mneet-purchase-card">' +
          '<h2 class="mneet-purchase-title">' +
            escapeHTML(getCourseName(course)) +
          "</h2>" +
          '<div class="mneet-purchase-status">Already Approved</div>' +
          '<p class="mneet-purchase-note">' +
            "এই Course-এর payment approve হয়েছে। Student Panel থেকে Course খুলতে পারো।" +
          "</p>" +
        "</div>"
      );
    }

    if (hasPendingRequest(courseId)) {
      return (
        '<div class="mneet-purchase-card">' +
          '<h2 class="mneet-purchase-title">' +
            escapeHTML(getCourseName(course)) +
          "</h2>" +
          '<div class="mneet-purchase-status">Approval Pending</div>' +
          '<p class="mneet-purchase-note">' +
            "তোমার আগের payment request এখনও review করা হয়নি। একই Course-এর জন্য আরেকটি request জমা দেওয়ার আগে Admin-এর সিদ্ধান্তের অপেক্ষা করো।" +
          "</p>" +
        "</div>"
      );
    }

    const settings = state.settings || {};

    const upiId = clean(
      getValue(settings, ["upiId", "adminUpiId", "paymentUpiId"], "")
    );

    const qrUrl = clean(
      getValue(
        settings,
        ["paymentQrUrl", "qrCodeUrl", "upiQrUrl", "qrImageUrl"],
        ""
      )
    );

    const supportEmail = clean(
      getValue(settings, ["supportEmail", "adminEmail"], "")
    );

    let upiHTML = "";

    if (isValidUPI(upiId)) {
      upiHTML =
        '<p><strong>Admin UPI ID:</strong><br>' +
        '<span id="mneetAdminUPI">' + escapeHTML(upiId) + "</span></p>" +
        '<button type="button" class="mneet-purchase-button mneet-purchase-button-secondary" ' +
        'data-mneet-copy-upi="' + escapeHTML(upiId) + '">' +
        "Copy UPI ID" +
        "</button>";
    } else {
      upiHTML =
        '<p class="mneet-purchase-note">' +
        "Admin-এর UPI ID এখনও সেট করা হয়নি। পেমেন্ট করার আগে Admin-এর সঙ্গে যোগাযোগ করো।" +
        "</p>";
    }

    let qrHTML = "";

    if (qrUrl) {
      qrHTML =
        '<img class="mneet-purchase-qr" src="' +
        escapeHTML(qrUrl) +
        '" alt="Admin payment QR code" loading="lazy">';
    }

    let supportHTML = "";

    if (supportEmail) {
      supportHTML =
        '<p class="mneet-purchase-note">Payment support: ' +
        '<a href="mailto:' + escapeHTML(supportEmail) +
        '" style="color:#22C55E">' +
        escapeHTML(supportEmail) +
        "</a></p>";
    }

    return (
      '<div class="mneet-purchase-card">' +
        '<h2 class="mneet-purchase-title">' +
          escapeHTML(getCourseName(course)) +
        "</h2>" +

        '<p class="mneet-purchase-description">' +
          "Payment করার আগে Course-এর নাম ও amount যাচাই করো।" +
        "</p>" +

        '<div class="mneet-purchase-price">' +
          escapeHTML(formatPrice(getPrice(course))) +
        "</div>" +

        '<div class="mneet-purchase-payment-info">' +
          upiHTML +
          qrHTML +
          supportHTML +
        "</div>" +

        '<p class="mneet-purchase-note">' +
          "পেমেন্ট সম্পন্ন করার পর সঠিক Transaction ID জমা দাও। " +
          "Admin যাচাই করে approve না করা পর্যন্ত Course locked থাকবে।" +
        "</p>" +

        '<form id="mneetPaymentSubmissionForm" novalidate>' +

          '<label class="mneet-purchase-label" for="mneetPayerName">' +
            "Payer Name" +
          "</label>" +
          '<input class="mneet-purchase-input" id="mneetPayerName" ' +
            'name="payerName" type="text" maxlength="100" required ' +
            'autocomplete="name" value="' +
            escapeHTML(
              user && user.displayName ? user.displayName : ""
            ) + '">' +

          '<label class="mneet-purchase-label" for="mneetTransactionId">' +
            "Transaction ID / UTR Number" +
          "</label>" +
          '<input class="mneet-purchase-input" id="mneetTransactionId" ' +
            'name="transactionId" type="text" maxlength="120" required ' +
            'autocomplete="off" placeholder="Enter your transaction reference">' +

          '<label class="mneet-purchase-label" for="mneetPaymentNote">' +
            "Additional Information (Optional)" +
          "</label>" +
          '<textarea class="mneet-purchase-textarea" id="mneetPaymentNote" ' +
            'name="paymentNote" rows="3" maxlength="500" ' +
            'placeholder="Optional payment details"></textarea>' +

          '<label class="mneet-purchase-label" for="mneetPaymentScreenshot">' +
            "Payment Screenshot (Optional)" +
          "</label>" +
          '<input class="mneet-purchase-input" id="mneetPaymentScreenshot" ' +
            'name="paymentScreenshot" type="file" accept="image/jpeg,image/png,image/webp">' +

          '<p class="mneet-purchase-note">' +
            "Screenshot upload-এর জন্য Firebase Storage configuration প্রয়োজন। " +
            "যদি Storage চালু না থাকে, Transaction ID দিয়েই request জমা দেওয়া যাবে।" +
          "</p>" +

          '<button type="submit" class="mneet-purchase-button" id="mneetSubmitPaymentButton">' +
            "Submit Payment Request" +
          "</button>" +

        "</form>" +
      "</div>"
    );
  }

  function renderPurchaseHistory() {
    if (!state.purchases.length) {
      return (
        '<div class="mneet-purchase-empty">' +
        "তোমার এখনও কোনো payment request নেই।" +
        "</div>"
      );
    }

    const sorted = state.purchases.slice().sort(function (a, b) {
      const timeA = a.createdAt && a.createdAt.toMillis
        ? a.createdAt.toMillis()
        : 0;

      const timeB = b.createdAt && b.createdAt.toMillis
        ? b.createdAt.toMillis()
        : 0;

      return timeB - timeA;
    });

    return sorted.map(function (purchase) {
      const course = findCourse(
        getValue(purchase, ["courseId", "courseID"], "")
      );

      const courseName = course
        ? getCourseName(course)
        : clean(
            getValue(
              purchase,
              ["courseName", "name"],
              "Course"
            )
          );

      const status = clean(
        purchase.status || purchase.paymentStatus || "pending"
      );

      const amount = getValue(
        purchase,
        ["amount", "price", "coursePrice"],
        0
      );

      return (
        '<div class="mneet-purchase-history-row">' +
          '<h3 class="mneet-purchase-title">' +
            escapeHTML(courseName) +
          "</h3>" +
          '<p class="mneet-purchase-description">' +
            "Amount: " + escapeHTML(formatPrice(amount)) +
          "</p>" +
          '<span class="mneet-purchase-status">' +
            escapeHTML(statusText(status)) +
          "</span>" +
        "</div>"
      );
    }).join("");
  }

  function render() {
    const container = getPurchaseContainer();

    if (!container) {
      return;
    }

    addStyles();

    const selectedCourse = findCourse(state.currentCourseId);

    container.innerHTML =
      '<div class="mneet-purchase-wrap">' +

        '<div id="studentPurchaseMessage" ' +
          'class="mneet-purchase-message" hidden></div>' +

        '<section class="mneet-purchase-card">' +
          '<h2 class="mneet-purchase-title">Available Courses</h2>' +
          '<p class="mneet-purchase-description">' +
            "Course নির্বাচন করে payment instructions দেখো।" +
          "</p>" +
          renderCoursePicker() +
        "</section>" +

        (
          selectedCourse
            ? renderPaymentForm(selectedCourse)
            : (
              '<section class="mneet-purchase-card">' +
                '<h2 class="mneet-purchase-title">Payment Instructions</h2>' +
                '<p class="mneet-purchase-description">' +
                  "উপরের তালিকা থেকে Course নির্বাচন করো।" +
                "</p>" +
              "</section>"
            )
        ) +

        '<section class="mneet-purchase-card">' +
          '<h2 class="mneet-purchase-title">Purchase History</h2>' +
          renderPurchaseHistory() +
        "</section>" +

      "</div>";
  }

  /* =======================================================
     SUBMIT PAYMENT REQUEST
  ======================================================= */

  async function submitPaymentRequest(event) {
    event.preventDefault();

    if (state.submitting) {
      return;
    }

    hideMessage();

    const user = getCurrentUser();

    if (!user) {
      showMessage(
        "Payment request জমা দিতে Login করতে হবে।",
        "error"
      );
      return;
    }

    const course = findCourse(state.currentCourseId);

    if (!course || !isActiveCourse(course)) {
      showMessage(
        "Course পাওয়া যাচ্ছে না বা Course active নয়।",
        "error"
      );
      return;
    }

    const courseId = getCourseId(course);

    if (hasApprovedPurchase(courseId)) {
      showMessage(
        "এই Course ইতিমধ্যেই approved হয়েছে।",
        "error"
      );
      return;
    }

    if (hasPendingRequest(courseId)) {
      showMessage(
        "এই Course-এর payment request ইতিমধ্যেই pending আছে।",
        "error"
      );
      return;
    }

    const payerName = clean(
      document.getElementById("mneetPayerName")?.value
    );

    const transactionId = clean(
      document.getElementById("mneetTransactionId")?.value
    );

    const paymentNote = clean(
      document.getElementById("mneetPaymentNote")?.value
    );

    const screenshotInput = document.getElementById(
      "mneetPaymentScreenshot"
    );

    const screenshotFile =
      screenshotInput &&
      screenshotInput.files &&
      screenshotInput.files[0]
        ? screenshotInput.files[0]
        : null;

    if (payerName.length < 2) {
      showMessage(
        "Payer Name অন্তত 2 অক্ষরের হতে হবে।",
        "error"
      );
      return;
    }

    if (transactionId.length < 4) {
      showMessage(
        "সঠিক Transaction ID / UTR Number দাও।",
        "error"
      );
      return;
    }

    if (transactionId.length > 120) {
      showMessage(
        "Transaction ID অনেক বড়।",
        "error"
      );
      return;
    }

    if (paymentNote.length > 500) {
      showMessage(
        "Additional Information 500 অক্ষরের মধ্যে রাখো।",
        "error"
      );
      return;
    }

    if (screenshotFile) {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
      ];

      if (!allowedTypes.includes(screenshotFile.type)) {
        showMessage(
          "Screenshot JPG, PNG অথবা WEBP format-এ দিতে হবে।",
          "error"
        );
        return;
      }

      if (screenshotFile.size > 5 * 1024 * 1024) {
        showMessage(
          "Screenshot সর্বোচ্চ 5 MB হতে পারে।",
          "error"
        );
        return;
      }
    }

    state.submitting = true;

    const submitButton = document.getElementById(
      "mneetSubmitPaymentButton"
    );

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }

    try {
      const db = getDB();

      /*
        Never store a request as approved here.
        The Admin must independently verify the payment.
      */

      const purchaseData = {
        userId: user.uid,
        studentId: user.uid,
        studentName: payerName,
        studentEmail: user.email || "",
        courseId: courseId,
        courseName: getCourseName(course),
        amount: getPrice(course),
        currency: "INR",
        transactionId: transactionId,
        paymentNote: paymentNote,
        status: "pending",
        paymentStatus: "pending",
        approvalStatus: "pending",
        paymentMethod: "UPI",
        paymentScreenshotUrl: "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      /*
        Do not upload a screenshot automatically if Storage is
        not configured. The transaction request can still be
        submitted without the optional screenshot.

        This file intentionally does not create or edit the
        Admin approval field.
      */

      if (screenshotFile) {
        const storageAvailable =
          typeof firebase.storage === "function";

        if (
          storageAvailable &&
          firebase.apps &&
          firebase.apps.length
        ) {
          try {
            const storage = firebase.storage();

            const safeFileName = screenshotFile.name
              .replace(/[^a-zA-Z0-9._-]/g, "_")
              .slice(0, 100);

            const storagePath =
              "payment-submissions/" +
              user.uid + "/" +
              Date.now() + "_" +
              safeFileName;

            const uploadTask = await storage
              .ref(storagePath)
              .put(screenshotFile, {
                contentType: screenshotFile.type
              });

            purchaseData.paymentScreenshotUrl =
              await uploadTask.ref.getDownloadURL();

            purchaseData.paymentScreenshotPath = storagePath;
          } catch (uploadError) {
            console.warn(
              "[mNEET Purchase] Screenshot upload failed:",
              uploadError
            );

            throw new Error(
              "Screenshot upload হয়নি। Firebase Storage setup ও Rules পরীক্ষা করো, অথবা screenshot ছাড়া আবার submit করো।"
            );
          }
        } else {
          throw new Error(
            "Firebase Storage চালু নেই। Screenshot ছাড়া আবার submit করো।"
          );
        }
      }

      await db
        .collection(COLLECTIONS.purchases)
        .add(purchaseData);

      await loadMyPurchases();

      render();

      showMessage(
        "Payment request সফলভাবে জমা হয়েছে। Admin যাচাই করে approve না করা পর্যন্ত Course locked থাকবে।",
        "success"
      );
    } catch (error) {
      state.lastError = error;

      console.error(
        "[mNEET Purchase] Submission failed:",
        error
      );

      showMessage(
        error && error.message
          ? error.message
          : "Payment request জমা হয়নি। আবার চেষ্টা করো।",
        "error"
      );
    } finally {
      state.submitting = false;

      const button = document.getElementById(
        "mneetSubmitPaymentButton"
      );

      if (button) {
        button.disabled = false;
        button.textContent = "Submit Payment Request";
      }
    }
  }

  /* =======================================================
     EVENTS
  ======================================================= */

  function handleClick(event) {
    const selectButton = event.target.closest(
      "[data-mneet-select-course]"
    );

    if (selectButton) {
      const courseId = clean(
        selectButton.getAttribute("data-mneet-select-course")
      );

      const course = findCourse(courseId);

      if (!course) {
        showMessage("Course পাওয়া যায়নি।", "error");
        return;
      }

      if (hasApprovedPurchase(courseId)) {
        showMessage(
          "এই Course ইতিমধ্যেই approved হয়েছে।",
          "success"
        );
        return;
      }

      if (hasPendingRequest(courseId)) {
        showMessage(
          "এই Course-এর payment request pending আছে।",
          "success"
        );
        return;
      }

      state.currentCourseId = courseId;
      render();
      return;
    }

    const copyButton = event.target.closest(
      "[data-mneet-copy-upi]"
    );

    if (copyButton) {
      const upiId = clean(
        copyButton.getAttribute("data-mneet-copy-upi")
      );

      if (!upiId) {
        return;
      }

      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        navigator.clipboard.writeText(upiId)
          .then(function () {
            showMessage("UPI ID copied হয়েছে।", "success");
          })
          .catch(function () {
            showMessage(
              "UPI ID copy হয়নি। হাতে select করে copy করো।",
              "error"
            );
          });
      } else {
        showMessage(
          "UPI ID: " + upiId,
          "success"
        );
      }
    }
  }

  function bindEvents() {
    document.addEventListener("click", handleClick);

    document.addEventListener("submit", function (event) {
      if (
        event.target &&
        event.target.id === "mneetPaymentSubmissionForm"
      ) {
        submitPaymentRequest(event);
      }
    });

    document.addEventListener(
      "mneet:student-page-change",
      function (event) {
        const detail = event.detail || {};
        const page = clean(
          detail.page || detail.pageName || detail.name
        ).toLowerCase();

        if (
          page.includes("purchase") ||
          page.includes("availablecourses") ||
          page.includes("available-courses")
        ) {
          refresh().catch(function () {});
        }
      }
    );
  }

  /* =======================================================
     REFRESH / INITIALIZE
  ======================================================= */

  async function refresh(options) {
    if (state.loading) {
      return;
    }

    state.loading = true;

    try {
      const user = getCurrentUser();

      if (!user) {
        throw new Error(
          "প্রথমে Student Account দিয়ে Login করো।"
        );
      }

      const opts = options || {};

      if (opts.courseId) {
        state.currentCourseId = clean(opts.courseId);
      }

      await Promise.all([
        loadCourses(),
        loadPaymentSettings(),
        loadMyPurchases()
      ]);

      render();

      return {
        courses: state.courses.length,
        purchases: state.purchases.length,
        selectedCourseId: state.currentCourseId
      };
    } catch (error) {
      state.lastError = error;

      console.error(
        "[mNEET Purchase] Refresh failed:",
        error
      );

      showMessage(
        error && error.message
          ? error.message
          : "Purchase page load হয়নি।",
        "error"
      );

      throw error;
    } finally {
      state.loading = false;
    }
  }

  function open(options) {
    const opts = options || {};

    if (opts.courseId) {
      state.currentCourseId = clean(opts.courseId);
    }

    return refresh(opts);
  }

  function initialize() {
    if (state.initialized) {
      return;
    }

    addStyles();
    bindEvents();

    state.initialized = true;

    const student = getStudentApp();

    if (student && typeof student.isReady === "function") {
      if (student.isReady()) {
        refresh().catch(function () {});
      }
    } else {
      refresh().catch(function () {});
    }
  }

  window[MODULE_NAME] = {
    initialize: initialize,
    refresh: refresh,
    open: open,
    render: render,

    getCourses: function () {
      return state.courses.slice();
    },

    getPurchases: function () {
      return state.purchases.slice();
    },

    getSelectedCourseId: function () {
      return state.currentCourseId;
    },

    getLastError: function () {
      return state.lastError;
    },

    hasApprovedPurchase: hasApprovedPurchase,
    hasPendingRequest: hasPendingRequest
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }

})();
