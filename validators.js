/* =========================================================
   mNEET — Shared Validation Utilities
   File: validators.js

   Covers:
   - Student registration and login input validation
   - Student profile validation
   - Course, subject, chapter and topic validation
   - Quiz and question validation
   - Manual payment submission validation
   - PDF, image and document upload validation
   - Safe text and URL validation

   Security:
   - Client-side validation improves usability.
   - Firebase Security Rules and trusted backend functions
     must enforce authorization and data integrity.
   - Students cannot approve their own purchases.
   - Admin authorization must never depend on form validation.
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.MNEETValidators) {
    return;
  }

  const LIMITS = Object.freeze({
    NAME_MIN: 2,
    NAME_MAX: 100,

    PHONE_LENGTH: 10,

    PASSWORD_MIN: 8,
    PASSWORD_MAX: 128,

    EMAIL_MAX: 254,

    TITLE_MIN: 2,
    TITLE_MAX: 150,

    DESCRIPTION_MAX: 5000,

    QUESTION_MAX: 10000,
    OPTION_MAX: 3000,
    SOLUTION_MAX: 10000,

    TRANSACTION_MIN: 6,
    TRANSACTION_MAX: 100,

    PDF_MAX_MB: 20,
    IMAGE_MAX_MB: 5,
    PAYMENT_IMAGE_MAX_MB: 5
  });

  const ALLOWED_QUIZ_TYPES = Object.freeze([
    "topic",
    "assertion_reason",
    "statement_based",
    "match_following",
    "correct_incorrect",
    "diagram_based",
    "pyq",
    "fill_blanks",
    "rapid_revision"
  ]);

  const ALLOWED_PAYMENT_STATUSES = Object.freeze([
    "pending",
    "approved",
    "rejected"
  ]);

  const state = {
    lastErrors: []
  };

  /* ---------------------------------------------------------
     1. BASIC HELPERS
     --------------------------------------------------------- */

  function toString(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value);
  }

  function cleanText(value) {
    return toString(value).trim();
  }

  function normalizeEmail(value) {
    return cleanText(value).toLowerCase();
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object") {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype ||
      prototype === null;
  }

  function hasValue(value) {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === "string") {
      return value.trim().length > 0;
    }

    return true;
  }

  function isWithinLength(value, min, max) {
    const text = cleanText(value);

    return text.length >= min && text.length <= max;
  }

  function isValidEmail(value) {
    const email = normalizeEmail(value);

    if (
      !email ||
      email.length > LIMITS.EMAIL_MAX ||
      /\s/.test(email)
    ) {
      return false;
    }

    return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i
      .test(email);
  }

  function isValidIndianMobile(value) {
    /*
     * Accepts a 10-digit Indian mobile number.
     * An optional +91 or 91 country prefix is accepted.
     */
    const digits = toString(value).replace(/[\s()-]/g, "");

    return /^(?:\+91|91)?[6-9]\d{9}$/.test(digits);
  }

  function normalizeIndianMobile(value) {
    const digits = toString(value).replace(/\D/g, "");

    if (digits.length === 12 && digits.startsWith("91")) {
      return digits.slice(2);
    }

    return digits;
  }

  function isValidPassword(value) {
    const password = toString(value);

    return password.length >= LIMITS.PASSWORD_MIN &&
      password.length <= LIMITS.PASSWORD_MAX;
  }

  function passwordsMatch(password, confirmation) {
    return toString(password) === toString(confirmation);
  }

  function isValidPositiveNumber(value) {
    if (value === "" || value === null || value === undefined) {
      return false;
    }

    const number = Number(value);

    return Number.isFinite(number) && number > 0;
  }

  function isValidNonNegativeNumber(value) {
    if (value === "" || value === null || value === undefined) {
      return false;
    }

    const number = Number(value);

    return Number.isFinite(number) && number >= 0;
  }

  function isValidInteger(value, min, max) {
    if (value === "" || value === null || value === undefined) {
      return false;
    }

    const number = Number(value);

    return Number.isSafeInteger(number) &&
      number >= min &&
      number <= max;
  }

  function isValidDate(value) {
    if (!hasValue(value)) {
      return false;
    }

    const date = value instanceof Date
      ? value
      : new Date(value);

    return !Number.isNaN(date.getTime());
  }

  function validDateRange(startDate, endDate) {
    if (!hasValue(startDate) || !hasValue(endDate)) {
      return true;
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return false;
    }

    return new Date(startDate).getTime() <=
      new Date(endDate).getTime();
  }

  /* ---------------------------------------------------------
     2. VALIDATION RESULT HELPERS
     --------------------------------------------------------- */

  function result(errors) {
    const safeErrors = Array.isArray(errors)
      ? errors
      : [];

    state.lastErrors = safeErrors.slice();

    return {
      valid: safeErrors.length === 0,
      errors: safeErrors,
      message: safeErrors.length === 0
        ? "Validation successful."
        : safeErrors[0]
    };
  }

  function validateRequiredFields(data, fields) {
    const errors = [];

    if (!isPlainObject(data)) {
      return result(["Please provide valid form information."]);
    }

    fields.forEach(function (field) {
      if (!hasValue(data[field.key])) {
        errors.push(field.message);
      }
    });

    return result(errors);
  }

  /* ---------------------------------------------------------
     3. STUDENT SIGN UP
     --------------------------------------------------------- */

  function validateSignUp(data) {
    const errors = [];

    if (!isPlainObject(data)) {
      return result(["Please provide valid registration information."]);
    }

    const name = cleanText(data.name || data.fullName);
    const phone = data.phone;
    const email = normalizeEmail(data.email);
    const password = toString(data.password);
    const confirmPassword = toString(
      data.confirmPassword || data.passwordConfirmation
    );

    if (!isWithinLength(
      name,
      LIMITS.NAME_MIN,
      LIMITS.NAME_MAX
    )) {
      errors.push("Enter your full name.");
    }

    if (!isValidIndianMobile(phone)) {
      errors.push("Enter a valid 10-digit Indian mobile number.");
    }

    if (!isValidEmail(email)) {
      errors.push("Enter a valid email address.");
    }

    if (!isValidPassword(password)) {
      errors.push(
        "Password must contain at least 8 characters."
      );
    }

    if (!passwordsMatch(password, confirmPassword)) {
      errors.push("Password and confirm password do not match.");
    }

    return result(errors);
  }

  /* ---------------------------------------------------------
     4. SIGN IN AND PASSWORD RESET
     --------------------------------------------------------- */

  function validateSignIn(data) {
    const errors = [];

    if (!isPlainObject(data)) {
      return result(["Please provide your sign-in information."]);
    }

    if (!isValidEmail(data.email)) {
      errors.push("Enter a valid email address.");
    }

    if (!toString(data.password)) {
      errors.push("Enter your password.");
    }

    return result(errors);
  }

  function validatePasswordReset(email) {
    return result(
      isValidEmail(email)
        ? []
        : ["Enter a valid email address."]
    );
  }

  function validateNewPassword(password, confirmation) {
    const errors = [];

    if (!isValidPassword(password)) {
      errors.push(
        "Password must contain at least 8 characters."
      );
    }

    if (!passwordsMatch(password, confirmation)) {
      errors.push("The passwords do not match.");
    }

    return result(errors);
  }

  /* ---------------------------------------------------------
     5. STUDENT PROFILE
     --------------------------------------------------------- */

  function validateStudentProfile(data) {
    const errors = [];

    if (!isPlainObject(data)) {
      return result(["Please provide valid profile information."]);
    }

    const name = cleanText(data.name || data.fullName);

    if (!isWithinLength(
      name,
      LIMITS.NAME_MIN,
      LIMITS.NAME_MAX
    )) {
      errors.push("Enter your full name.");
    }

    if (hasValue(data.phone) && !isValidIndianMobile(data.phone)) {
      errors.push("Enter a valid Indian mobile number.");
    }

    if (hasValue(data.email) && !isValidEmail(data.email)) {
      errors.push("Enter a valid email address.");
    }

    const target = cleanText(
      data.target || data.examTarget
    );

    if (target.length > 100) {
      errors.push("Target information is too long.");
    }

    return result(errors);
  }

  /* ---------------------------------------------------------
     6. COURSE VALIDATION
     --------------------------------------------------------- */

  function validateCourse(data) {
    const errors = [];

    if (!isPlainObject(data)) {
      return result(["Please provide valid course information."]);
    }

    const name = cleanText(data.name || data.courseName);
    const description = cleanText(data.description);

    if (!isWithinLength(
      name,
      LIMITS.TITLE_MIN,
      LIMITS.TITLE_MAX
    )) {
      errors.push("Course name must be 2–150 characters.");
    }

    if (description.length > LIMITS.DESCRIPTION_MAX) {
      errors.push("Course description is too long.");
    }

    if (!isValidNonNegativeNumber(data.price)) {
      errors.push("Enter a valid course price.");
    }

    if (!validDateRange(data.startDate, data.endDate)) {
      errors.push("Course end date cannot be before its start date.");
    }

    if (
      hasValue(data.thumbnailUrl) &&
      !isValidHttpUrl(data.thumbnailUrl)
    ) {
      errors.push("Enter a valid course thumbnail URL.");
    }

    return result(errors);
  }

  /* ---------------------------------------------------------
     7. SUBJECT, CHAPTER AND TOPIC VALIDATION
     --------------------------------------------------------- */

  function validateSubject(data) {
    return validateContentNode(
      data,
      "Subject",
      true
    );
  }

  function validateChapter(data) {
    const errors = [];

    if (!isPlainObject(data)) {
      return result(["Please provide valid chapter information."]);
    }

    if (!hasValue(data.subjectId)) {
      errors.push("Select a subject for this chapter.");
    }

    if (!hasValue(data.courseId)) {
      errors.push("Select a course for this chapter.");
    }

    if (!isWithinLength(
      data.name,
      LIMITS.TITLE_MIN,
      LIMITS.TITLE_MAX
    )) {
      errors.push("Enter a valid chapter name.");
    }

    if (
      hasValue(data.order) &&
      !isValidInteger(data.order, 1, 100000)
    ) {
      errors.push("Chapter order must be a positive integer.");
    }

    if (
      hasValue(data.description) &&
      cleanText(data.description).length >
        LIMITS.DESCRIPTION_MAX
    ) {
      errors.push("Chapter description is too long.");
    }

    return result(errors);
  }

  function validateTopic(data) {
    const errors = [];

    if (!isPlainObject(data)) {
      return result(["Please provide valid topic information."]);
    }

    if (!hasValue(data.chapterId)) {
      errors.push("Select a chapter for this topic.");
    }

    if (!isWithinLength(
      data.name,
      LIMITS.TITLE_MIN,
      LIMITS.TITLE_MAX
    )) {
      errors.push("Enter a valid topic name.");
    }

    if (
      hasValue(data.description) &&
      cleanText(data.description).length >
        LIMITS.DESCRIPTION_MAX
    ) {
      errors.push("Topic description is too long.");
    }

    if (
      hasValue(data.order) &&
      !isValidInteger(data.order, 1, 100000)
    ) {
      errors.push("Topic order must be a positive integer.");
    }

    return result(errors);
  }

  function validateContentNode(data, label, requireCourse) {
    const errors = [];

    if (!isPlainObject(data)) {
      return result(["Please provide valid " + label.toLowerCase() + " information."]);
    }

    if (!isWithinLength(
      data.name,
      LIMITS.TITLE_MIN,
      LIMITS.TITLE_MAX
    )) {
      errors.push("Enter a valid " + label.toLowerCase() + " name.");
    }

    if (
      requireCourse &&
      !hasValue(data.courseId)
    ) {
      errors.push("Select a course for this " + label.toLowerCase() + ".");
    }

    if (
      hasValue(data.order) &&
      !isValidInteger(data.order, 1, 100000)
    ) {
      errors.push("Order must be a positive integer.");
    }

    if (
      hasValue(data.description) &&
      cleanText(data.description).length >
        LIMITS.DESCRIPTION_MAX
    ) {
      errors.push("Description is too long.");
    }

    return result(errors);
  }

  /* ---------------------------------------------------------
     8. QUIZ VALIDATION
     --------------------------------------------------------- */

  function validateQuiz(data) {
    const errors = [];

    if (!isPlainObject(data)) {
      return result(["Please provide valid quiz information."]);
    }

    if (!isWithinLength(
      data.name || data.title,
      LIMITS.TITLE_MIN,
      LIMITS.TITLE_MAX
    )) {
      errors.push("Enter a valid quiz title.");
    }

    if (!hasValue(data.courseId)) {
      errors.push("Select a course for this quiz.");
    }

    if (!hasValue(data.chapterId)) {
      errors.push("Select a chapter for this quiz.");
    }

    if (
      hasValue(data.type) &&
      !ALLOWED_QUIZ_TYPES.includes(
        String(data.type).toLowerCase()
      )
    ) {
      errors.push("Select a supported quiz type.");
    }

    if (
      hasValue(data.perQuestionTime) &&
      !isValidInteger(data.perQuestionTime, 1, 3600)
    ) {
      errors.push("Question time must be between 1 and 3600 seconds.");
    }

    if (
      hasValue(data.durationMinutes) &&
      !isValidInteger(data.durationMinutes, 1, 1440)
    ) {
      errors.push("Quiz duration must be between 1 and 1440 minutes.");
    }

    return result(errors);
  }

  /* ---------------------------------------------------------
     9. QUESTION VALIDATION
     --------------------------------------------------------- */

  function validateQuestion(data) {
    const errors = [];

    if (!isPlainObject(data)) {
      return result(["Please provide valid question information."]);
    }

    if (!hasValue(data.quizId)) {
      errors.push("Select a quiz for this question.");
    }

    const questionText = cleanText(
      data.questionText || data.text
    );

    const imageUrl = data.imageUrl ||
      data.questionImage ||
      data.diagramUrl;

    if (
      !questionText &&
      !hasValue(imageUrl)
    ) {
      errors.push("Add question text or a question image.");
    }

    if (questionText.length > LIMITS.QUESTION_MAX) {
      errors.push("Question text is too long.");
    }

    if (
      hasValue(imageUrl) &&
      !isValidHttpUrl(imageUrl)
    ) {
      errors.push("Enter a valid question image URL.");
    }

    const options = getQuestionOptions(data);
    const questionType = String(data.type || "").toLowerCase();

    /*
     * Fill-in-the-blank questions may be text-answer questions.
     * Other supported question types normally need options.
     */
    if (questionType !== "fill_blanks") {
      if (options.length < 2) {
        errors.push("Provide at least two answer options.");
      }

      if (
        options.some(function (option) {
          return option.length > LIMITS.OPTION_MAX;
        })
      ) {
        errors.push("An answer option is too long.");
      }
    }

    if (!hasValue(data.correctAnswer) &&
        !hasValue(data.correctOption) &&
        !hasValue(data.answer)) {
      errors.push("Select or enter the correct answer.");
    }

    if (
      hasValue(data.solution) &&
      cleanText(data.solution).length > LIMITS.SOLUTION_MAX
    ) {
      errors.push("Solution text is too long.");
    }

    if (
      hasValue(data.order) &&
      !isValidInteger(data.order, 1, 1000000)
    ) {
      errors.push("Question order must be a positive integer.");
    }

    return result(errors);
  }

  function getQuestionOptions(data) {
    if (!isPlainObject(data)) {
      return [];
    }

    if (Array.isArray(data.options)) {
      return data.options
        .map(function (option) {
          if (isPlainObject(option)) {
            return cleanText(
              option.text || option.label || option.value
            );
          }

          return cleanText(option);
        })
        .filter(Boolean);
    }

    return [
      data.option1 || data.optionA,
      data.option2 || data.optionB,
      data.option3 || data.optionC,
      data.option4 || data.optionD
    ]
      .map(cleanText)
      .filter(Boolean);
  }

  /* ---------------------------------------------------------
     10. MANUAL PAYMENT SUBMISSION
     --------------------------------------------------------- */

  function validatePaymentSubmission(data) {
    const errors = [];

    if (!isPlainObject(data)) {
      return result(["Please provide valid payment information."]);
    }

    if (!hasValue(data.courseId)) {
      errors.push("Select the course you want to purchase.");
    }

    if (!isWithinLength(
      data.payerName,
      LIMITS.NAME_MIN,
      LIMITS.NAME_MAX
    )) {
      errors.push("Enter the payer's name.");
    }

    const transactionId = cleanText(
      data.transactionId || data.utr || data.referenceNumber
    );

    if (
      transactionId.length < LIMITS.TRANSACTION_MIN ||
      transactionId.length > LIMITS.TRANSACTION_MAX
    ) {
      errors.push("Enter a valid transaction ID or UTR.");
    }

    if (
      hasValue(data.amount) &&
      !isValidNonNegativeNumber(data.amount)
    ) {
      errors.push("Payment amount is invalid.");
    }

    /*
     * The submitted status is never accepted as a way to approve
     * a purchase. The server/Admin workflow must decide approval.
     */
    const status = String(data.status || "pending").toLowerCase();

    if (status !== "pending") {
      errors.push(
        "Students can submit payment for review but cannot approve it."
      );
    }

    return result(errors);
  }

  /* ---------------------------------------------------------
     11. PURCHASE STATUS VALIDATION
     --------------------------------------------------------- */

  function isValidPaymentStatus(status) {
    return ALLOWED_PAYMENT_STATUSES.includes(
      String(status || "").toLowerCase()
    );
  }

  function validateAdminPurchaseDecision(data) {
    const errors = [];

    if (!isPlainObject(data)) {
      return result(["Please provide a valid purchase decision."]);
    }

    if (!hasValue(data.purchaseId)) {
      errors.push("Purchase ID is required.");
    }

    const decision = String(data.decision || "").toLowerCase();

    if (!["approve", "reject"].includes(decision)) {
      errors.push("Select approve or reject.");
    }

    return result(errors);
  }

  /* ---------------------------------------------------------
     12. FILE VALIDATION
     --------------------------------------------------------- */

  function validateFile(file, options) {
    const settings = options || {};
    const errors = [];

    if (!file) {
      return result(["Please select a file."]);
    }

    const allowedTypes = Array.isArray(settings.allowedTypes)
      ? settings.allowedTypes
      : [];

    const maxSizeMB = Number.isFinite(Number(settings.maxSizeMB))
      ? Math.max(0, Number(settings.maxSizeMB))
      : LIMITS.PDF_MAX_MB;

    if (
      allowedTypes.length > 0 &&
      !allowedTypes.includes(file.type)
    ) {
      errors.push("This file type is not allowed.");
    }

    if (
      file.size >
      maxSizeMB * 1024 * 1024
    ) {
      errors.push(
        "File size must not exceed " + maxSizeMB + " MB."
      );
    }

    return result(errors);
  }

  function validatePDF(file) {
    if (!file) {
      return result(["Please select a PDF file."]);
    }

    if (file.type !== "application/pdf") {
      return result(["Only PDF files are allowed."]);
    }

    if (
      file.size >
      LIMITS.PDF_MAX_MB * 1024 * 1024
    ) {
      return result([
        "PDF size must not exceed " + LIMITS.PDF_MAX_MB + " MB."
      ]);
    }

    return result([]);
  }

  function validateImage(file) {
    if (!file) {
      return result(["Please select an image."]);
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
      return result([
        "Only JPG, PNG and WebP images are allowed."
      ]);
    }

    if (
      file.size >
      LIMITS.IMAGE_MAX_MB * 1024 * 1024
    ) {
      return result([
        "Image size must not exceed " + LIMITS.IMAGE_MAX_MB + " MB."
      ]);
    }

    return result([]);
  }

  function validatePaymentScreenshot(file) {
    return validateFile(file, {
      allowedTypes: [
        "image/jpeg",
        "image/png",
        "image/webp"
      ],
      maxSizeMB: LIMITS.PAYMENT_IMAGE_MAX_MB
    });
  }

  /* ---------------------------------------------------------
     13. URL VALIDATION
     --------------------------------------------------------- */

  function isValidHttpUrl(value) {
    const text = cleanText(value);

    if (!text) {
      return false;
    }

    try {
      const url = new URL(text);

      return (
        (url.protocol === "https:" || url.protocol === "http:") &&
        Boolean(url.hostname) &&
        !url.username &&
        !url.password
      );
    } catch (error) {
      return false;
    }
  }

  function validateSocialUrl(value) {
    if (!hasValue(value)) {
      return result([]);
    }

    if (!isValidHttpUrl(value)) {
      return result(["Enter a valid social media URL."]);
    }

    return result([]);
  }

  /* ---------------------------------------------------------
     14. FORM VALIDATION DISPLAY
     --------------------------------------------------------- */

  function clearFieldError(input) {
    if (!input) {
      return;
    }

    input.removeAttribute("aria-invalid");

    const id = input.id;

    if (id) {
      const errorElement = document.getElementById(
        id + "Error"
      );

      if (errorElement) {
        errorElement.textContent = "";
        errorElement.hidden = true;
      }
    }
  }

  function showFieldError(input, message) {
    if (!input) {
      return;
    }

    input.setAttribute("aria-invalid", "true");

    if (input.id) {
      const errorElement = document.getElementById(
        input.id + "Error"
      );

      if (errorElement) {
        errorElement.textContent = cleanText(message);
        errorElement.hidden = false;
        return;
      }
    }

    /*
     * No new colour or inline style is imposed.
     * Existing Green/White theme CSS controls presentation.
     */
  }

  function displayValidationErrors(container, validation) {
    const element = typeof container === "string"
      ? document.getElementById(container)
      : container;

    if (!element) {
      return false;
    }

    const errors = validation &&
      Array.isArray(validation.errors)
      ? validation.errors
      : [];

    element.replaceChildren();

    if (errors.length === 0) {
      element.hidden = true;
      return true;
    }

    const list = document.createElement("ul");

    errors.forEach(function (message) {
      const item = document.createElement("li");

      item.textContent = cleanText(message);

      list.appendChild(item);
    });

    element.appendChild(list);
    element.hidden = false;

    return true;
  }

  /* ---------------------------------------------------------
     15. PUBLIC API
     --------------------------------------------------------- */

  window.MNEETValidators = Object.freeze({
    limits: LIMITS,
    allowedQuizTypes: ALLOWED_QUIZ_TYPES,
    allowedPaymentStatuses: ALLOWED_PAYMENT_STATUSES,

    cleanText: cleanText,
    normalizeEmail: normalizeEmail,

    isValidEmail: isValidEmail,
    isValidIndianMobile: isValidIndianMobile,
    normalizeIndianMobile: normalizeIndianMobile,
    isValidPassword: isValidPassword,
    passwordsMatch: passwordsMatch,

    isValidPositiveNumber: isValidPositiveNumber,
    isValidNonNegativeNumber: isValidNonNegativeNumber,
    isValidInteger: isValidInteger,
    isValidDate: isValidDate,
    validDateRange: validDateRange,

    validateRequiredFields: validateRequiredFields,

    validateSignUp: validateSignUp,
    validateSignIn: validateSignIn,
    validatePasswordReset: validatePasswordReset,
    validateNewPassword: validateNewPassword,

    validateStudentProfile: validateStudentProfile,

    validateCourse: validateCourse,
    validateSubject: validateSubject,
    validateChapter: validateChapter,
    validateTopic: validateTopic,

    validateQuiz: validateQuiz,
    validateQuestion: validateQuestion,

    validatePaymentSubmission: validatePaymentSubmission,
    isValidPaymentStatus: isValidPaymentStatus,
    validateAdminPurchaseDecision: validateAdminPurchaseDecision,

    validateFile: validateFile,
    validatePDF: validatePDF,
    validateImage: validateImage,
    validatePaymentScreenshot: validatePaymentScreenshot,

    isValidHttpUrl: isValidHttpUrl,
    validateSocialUrl: validateSocialUrl,

    clearFieldError: clearFieldError,
    showFieldError: showFieldError,
    displayValidationErrors: displayValidationErrors,

    getLastErrors: function () {
      return state.lastErrors.slice();
    },

    getLastError: function () {
      return state.lastErrors.length
        ? state.lastErrors[0]
        : null;
    }
  });

  console.info("[mNEET] Validators loaded.");

})(window, document);
