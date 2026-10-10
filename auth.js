/* =========================================================
   mNEET AUTHENTICATION SYSTEM
   File: auth.js

   Features:
   - Sign In
   - Student Registration
   - Confirm Password Validation
   - Forgot Password
   - Firebase Authentication
   - Student Profile Creation
   - Admin Verification
   - Role-Based Redirection

   Admin access requires:
   admins/{uid}.active === true

   Public registration never grants Admin access.
========================================================= */

(function (window, document) {
  "use strict";

  const CONFIG = Object.freeze({
    ADMIN_PAGE: "admin.html",
    STUDENT_PAGE: "student.html",
    LOGIN_PAGE: "index.html",
    MIN_PASSWORD_LENGTH: 6,
    MIN_NAME_LENGTH: 2
  });

  const elements = {
    message: document.getElementById("authMessage"),

    signInForm: document.getElementById("signInForm"),
    signInEmail: document.getElementById("signInEmail"),
    signInPassword: document.getElementById("signInPassword"),
    signInButton: document.getElementById("signInButton"),

    signUpForm: document.getElementById("signUpForm"),
    signUpName: document.getElementById("signUpName"),
    signUpPhone: document.getElementById("signUpPhone"),
    signUpEmail: document.getElementById("signUpEmail"),
    signUpPassword: document.getElementById("signUpPassword"),
    confirmPassword: document.getElementById("confirmPassword"),
    signUpButton: document.getElementById("signUpButton"),

    forgotPasswordForm: document.getElementById("forgotPasswordForm"),
    resetEmail: document.getElementById("resetEmail"),
    resetPasswordButton: document.getElementById("resetPasswordButton")
  };

  let auth = null;
  let db = null;
  let initialized = false;
  let redirectStarted = false;
  let authListenerRegistered = false;

  /* =======================================================
     FIREBASE SERVICES
  ======================================================= */

  function getFirebaseServices() {
    const services = window.MNEETFirebase;

    if (
      !services ||
      services.ready !== true ||
      !services.auth ||
      !services.db
    ) {
      throw new Error(
        "Firebase প্রস্তুত নয়। firebase.js এবং index.html-এর SDK scripts পরীক্ষা করো।"
      );
    }

    auth = services.auth;
    db = services.db;

    return { auth, db };
  }

  /* =======================================================
     MESSAGE HELPERS
  ======================================================= */

  function showMessage(message, type) {
    if (!elements.message) return;

    elements.message.textContent = String(message || "");

    elements.message.className =
      "auth-message " + (type || "error") + " show";
  }

  function clearMessage() {
    if (!elements.message) return;

    elements.message.textContent = "";
    elements.message.className = "auth-message";
  }

  /* =======================================================
     BUTTON LOADING
  ======================================================= */

  function setLoading(button, loading, loadingText, defaultText) {
    if (!button) return;

    if (loading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText =
          button.textContent.trim() || defaultText;
      }

      button.disabled = true;
      button.textContent = loadingText;
    } else {
      button.disabled = false;

      button.textContent =
        button.dataset.originalText || defaultText;

      delete button.dataset.originalText;
    }
  }

  /* =======================================================
     INPUT HELPERS
  ======================================================= */

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeName(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function normalizePhone(value) {
    return String(value || "").trim();
  }

  function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validPhone(phone) {
    const digits = phone.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }

  /* =======================================================
     FRIENDLY ERROR MESSAGES
  ======================================================= */

  function getFriendlyError(error) {
    const code = error && error.code
      ? error.code
      : "";

    const messages = {
      "auth/invalid-email":
        "সঠিক Email Address দাও।",

      "auth/user-not-found":
        "এই Email দিয়ে account পাওয়া যায়নি।",

      "auth/wrong-password":
        "Email অথবা Password সঠিক নয়।",

      "auth/invalid-credential":
        "Email অথবা Password সঠিক নয়।",

      "auth/invalid-login-credentials":
        "Email অথবা Password সঠিক নয়।",

      "auth/email-already-in-use":
        "এই Email দিয়ে account আগে থেকেই আছে। Sign In করো।",

      "auth/weak-password":
        "Password অন্তত ৬টি character-এর হতে হবে।",

      "auth/too-many-requests":
        "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করো।",

      "auth/network-request-failed":
        "Internet connection পরীক্ষা করে আবার চেষ্টা করো।",

      "auth/operation-not-allowed":
        "Firebase Console-এ Email/Password Authentication চালু করো।",

      "permission-denied":
        "Firebase Security Rules এই কাজের অনুমতি দিচ্ছে না।",

      "unavailable":
        "Firebase service সাময়িকভাবে পাওয়া যাচ্ছে না।",

      "functions/not-found":
        "প্রয়োজনীয় backend function পাওয়া যায়নি।"
    };

    return messages[code] ||
      (
        error && error.message
          ? error.message
          : "কাজটি সম্পন্ন হয়নি। আবার চেষ্টা করো।"
      );
  }

  /* =======================================================
     ADMIN VERIFICATION

     Only admins/{uid}.active === true grants Admin access.
  ======================================================= */

  async function verifyAdmin(user) {
    const services = getFirebaseServices();

    if (!user || !user.uid) {
      return false;
    }

    const snapshot = await services.db
      .collection("admins")
      .doc(user.uid)
      .get();

    if (!snapshot.exists) {
      return false;
    }

    const data = snapshot.data() || {};

    return data.active === true;
  }

  /* =======================================================
     REDIRECT AFTER AUTHENTICATION

     Do not redirect until Admin status has been checked.
  ======================================================= */

  async function redirectAfterLogin(user) {
    if (redirectStarted || !user) return;

    redirectStarted = true;

    try {
      const admin = await verifyAdmin(user);

      const destination = admin
        ? CONFIG.ADMIN_PAGE
        : CONFIG.STUDENT_PAGE;

      window.location.replace(destination);

    } catch (error) {
      console.error("mNEET role verification failed:", error);

      redirectStarted = false;

      showMessage(
        "তোমার account যাচাই করা যায়নি। Internet connection এবং admins collection-এর Firestore Rules পরীক্ষা করো।",
        "error"
      );
    }
  }

  /* =======================================================
     SIGN IN
  ======================================================= */

  async function handleSignIn(event) {
    event.preventDefault();
    clearMessage();

    if (elements.signInButton.disabled) return;

    const email = normalizeEmail(elements.signInEmail.value);
    const password = elements.signInPassword.value;

    if (!validEmail(email)) {
      showMessage("সঠিক Email Address দাও।", "error");
      elements.signInEmail.focus();
      return;
    }

    if (!password) {
      showMessage("Password লিখো।", "error");
      elements.signInPassword.focus();
      return;
    }

    try {
      const services = getFirebaseServices();

      setLoading(
        elements.signInButton,
        true,
        "Signing In...",
        "Sign In"
      );

      const credential =
        await services.auth.signInWithEmailAndPassword(
          email,
          password
        );

      await redirectAfterLogin(credential.user);

    } catch (error) {
      console.error("Sign-in error:", error);

      showMessage(getFriendlyError(error), "error");

      setLoading(
        elements.signInButton,
        false,
        "",
        "Sign In"
      );
    }
  }

  /* =======================================================
     STUDENT REGISTRATION

     Registration creates a normal student account.
     It never writes to admins/{uid}.
  ======================================================= */

  async function handleSignUp(event) {
    event.preventDefault();
    clearMessage();

    if (elements.signUpButton.disabled) return;

    const name = normalizeName(elements.signUpName.value);
    const phone = normalizePhone(elements.signUpPhone.value);
    const email = normalizeEmail(elements.signUpEmail.value);
    const password = elements.signUpPassword.value;
    const confirmPassword = elements.confirmPassword.value;

    if (name.length < CONFIG.MIN_NAME_LENGTH) {
      showMessage("তোমার সম্পূর্ণ নাম লিখো।", "error");
      elements.signUpName.focus();
      return;
    }

    if (!validPhone(phone)) {
      showMessage(
        "সঠিক Phone Number লিখো।",
        "error"
      );
      elements.signUpPhone.focus();
      return;
    }

    if (!validEmail(email)) {
      showMessage("সঠিক Email Address দাও।", "error");
      elements.signUpEmail.focus();
      return;
    }

    if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
      showMessage(
        "Password অন্তত ৬টি character-এর হতে হবে।",
        "error"
      );
      elements.signUpPassword.focus();
      return;
    }

    if (password !== confirmPassword) {
      showMessage(
        "Password এবং Confirm Password মিলছে না।",
        "error"
      );
      elements.confirmPassword.focus();
      return;
    }

    let accountCreated = false;

    try {
      const services = getFirebaseServices();

      setLoading(
        elements.signUpButton,
        true,
        "Creating Account...",
        "Create Account"
      );

      const credential =
        await services.auth.createUserWithEmailAndPassword(
          email,
          password
        );

      const user = credential.user;
      accountCreated = true;

      /*
       * Update Firebase Auth display name.
       */

      await user.updateProfile({
        displayName: name
      });

      /*
       * Create the user's profile.
       *
       * Do not assign a fixed NEET target here.
       * The student can set target information in their profile.
       */

      await services.db
        .collection("users")
        .doc(user.uid)
        .set({
          uid: user.uid,
          name: name,
          fullName: name,
          phone: phone,
          email: email,
          role: "student",
          accountStatus: "active",
          createdAt:
            window.firebase.firestore.FieldValue.serverTimestamp()
        });

      showMessage(
        "Account তৈরি হয়েছে। তোমার account যাচাই করা হচ্ছে...",
        "success"
      );

      await redirectAfterLogin(user);

    } catch (error) {
      console.error("Sign-up error:", error);

      if (
        accountCreated &&
        error &&
        (
          error.code === "permission-denied" ||
          error.code === "firestore/permission-denied"
        )
      ) {
        showMessage(
          "Firebase Authentication-এ account তৈরি হয়েছে, কিন্তু profile save হয়নি। Sign Up আবার না করে একই Email দিয়ে Sign In চেষ্টা করো। Firestore Rules পরীক্ষা করতে হবে।",
          "error"
        );
      } else if (accountCreated) {
        showMessage(
          "Account তৈরি হয়েছে, কিন্তু profile সম্পূর্ণ করা যায়নি। একই Email দিয়ে আবার Sign Up না করে Sign In চেষ্টা করো।",
          "error"
        );
      } else {
        showMessage(getFriendlyError(error), "error");
      }

      setLoading(
        elements.signUpButton,
        false,
        "",
        "Create Account"
      );
    }
  }

  /* =======================================================
     FORGOT PASSWORD
  ======================================================= */

  async function handleForgotPassword(event) {
    event.preventDefault();
    clearMessage();

    if (elements.resetPasswordButton.disabled) return;

    const email = normalizeEmail(elements.resetEmail.value);

    if (!validEmail(email)) {
      showMessage(
        "সঠিক registered Email Address দাও।",
        "error"
      );
      elements.resetEmail.focus();
      return;
    }

    try {
      const services = getFirebaseServices();

      setLoading(
        elements.resetPasswordButton,
        true,
        "Sending Email...",
        "Send Reset Email"
      );

      await services.auth.sendPasswordResetEmail(email);

      showMessage(
        "যদি এই Email দিয়ে account থাকে, তাহলে password reset email পাঠানো হয়েছে। Inbox ও Spam folder পরীক্ষা করো।",
        "success"
      );

    } catch (error) {
      console.error("Password reset error:", error);

      if (
        error &&
        (
          error.code === "auth/user-not-found" ||
          error.code === "auth/invalid-email"
        )
      ) {
        showMessage(
          "যদি এই Email দিয়ে account থাকে, তাহলে reset email পাঠানো হবে। Email Address পরীক্ষা করো।",
          "success"
        );
      } else {
        showMessage(getFriendlyError(error), "error");
      }

    } finally {
      setLoading(
        elements.resetPasswordButton,
        false,
        "",
        "Send Reset Email"
      );
    }
  }

  /* =======================================================
     AUTH STATE LISTENER

     auth-guard.js also has a listener. This listener is
     retained for compatibility with the current project.
     The redirect lock prevents repeated redirects.
  ======================================================= */

  function registerAuthListener() {
    if (authListenerRegistered) return;

    const services = getFirebaseServices();

    authListenerRegistered = true;

    services.auth.onAuthStateChanged(function (user) {
      if (!user) {
        redirectStarted = false;
        return;
      }

      const page = (
        window.location.pathname.split("/").pop() || "index.html"
      ).toLowerCase();

      if (page === "" || page === "index.html") {
        redirectAfterLogin(user);
      }
    });
  }

  /* =======================================================
     INITIALIZATION
  ======================================================= */

  function initialize() {
    if (initialized) return;

    try {
      getFirebaseServices();

      if (elements.signInForm) {
        elements.signInForm.addEventListener(
          "submit",
          handleSignIn
        );
      }

      if (elements.signUpForm) {
        elements.signUpForm.addEventListener(
          "submit",
          handleSignUp
        );
      }

      if (elements.forgotPasswordForm) {
        elements.forgotPasswordForm.addEventListener(
          "submit",
          handleForgotPassword
        );
      }

      registerAuthListener();

      initialized = true;

      console.info(
        "mNEET authentication initialized."
      );

    } catch (error) {
      console.error(
        "mNEET authentication initialization failed:",
        error
      );

      showMessage(
        "mNEET চালু করা যায়নি। Firebase SDK, firebase.js এবং internet connection পরীক্ষা করো।",
        "error"
      );
    }
  }

  /*
   * All scripts in index.html use defer, so the DOM is
   * available when this file executes.
   */

  initialize();

  /*
   * Public API for debugging and future integration.
   */

  window.MNEETAuth = Object.freeze({
    initialize: initialize,
    verifyAdmin: verifyAdmin,
    redirectAfterLogin: redirectAfterLogin,
    getFriendlyError: getFriendlyError
  });

})(window, document);
