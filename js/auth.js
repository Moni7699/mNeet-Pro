"use strict";

(() => {
  // ==========================================
  // mNEET AUTHENTICATION SYSTEM
  // Login, Registration, Password Reset,
  // Remember Email, Student/Admin Routing
  // ==========================================

  const $ = (id) => document.getElementById(id);

  const REMEMBERED_EMAIL_KEY = "mneetRememberedEmail";

  let auth = null;
  let db = null;

  let isSubmitting = false;
  let sessionCheckInProgress = false;
  let redirectStarted = false;

  const elements = {
    message: $("message"),

    loginForm: $("loginForm"),
    registerForm: $("registerForm"),

    loginTab: $("loginTab"),
    registerTab: $("registerTab"),

    loginEmail: $("loginEmail"),
    loginPassword: $("loginPassword"),

    registerName: $("registerName"),
    registerPhone: $("registerPhone"),
    registerEmail: $("registerEmail"),
    registerCity: $("registerCity"),
    registerPassword: $("registerPassword"),
    confirmPassword: $("confirmPassword"),

    loginButton: $("loginButton"),
    registerButton: $("registerButton"),

    forgotPassword: $("forgotPassword"),
    rememberMe: $("rememberMe"),

    formHeading: $("formHeading"),
    formDescription: $("formDescription")
  };

  // ==========================================
  // MESSAGE HELPERS
  // ==========================================

  function showMessage(message, type = "error") {
    if (!elements.message) {
      console.log(message);
      return;
    }

    elements.message.textContent = message;
    elements.message.className = "message " + type;
    elements.message.hidden = false;
  }

  function clearMessage() {
    if (!elements.message) return;

    elements.message.textContent = "";
    elements.message.hidden = true;
    elements.message.className = "message";
  }

  // ==========================================
  // ACCOUNT HELPERS
  // ==========================================

  function normalizeRole(role) {
    return String(role || "")
      .trim()
      .toLowerCase();
  }

  function isAccountInactive(profile) {
    return String(profile?.status || "")
      .trim()
      .toLowerCase() === "inactive";
  }

  async function getUserProfile(uid) {
    if (!db || !uid) {
      throw new Error("PROFILE_LOOKUP_UNAVAILABLE");
    }

    const snapshot = await db
      .collection("users")
      .doc(uid)
      .get();

    if (!snapshot.exists) {
      return null;
    }

    return snapshot.data() || null;
  }

  // ==========================================
  // DASHBOARD REDIRECT
  // ==========================================

  function redirectByRole(role) {
    if (redirectStarted) return;

    const normalizedRole = normalizeRole(role);

    let destination = "";

    if (normalizedRole === "admin") {
      destination = "admin.html";
    } else if (normalizedRole === "student") {
      destination = "student.html";
    } else {
      showMessage(
        "এই account-এর role student অথবা admin হতে হবে।",
        "error"
      );

      return;
    }

    redirectStarted = true;

    window.location.replace(destination);
  }

  // ==========================================
  // REMEMBER EMAIL
  // ==========================================

  function saveRememberedEmail(email) {
    try {
      if (elements.rememberMe?.checked) {
        localStorage.setItem(
          REMEMBERED_EMAIL_KEY,
          email
        );
      } else {
        localStorage.removeItem(
          REMEMBERED_EMAIL_KEY
        );
      }
    } catch (error) {
      console.warn(
        "Remember email unavailable:",
        error
      );
    }
  }

  function setupRememberedEmail() {
    try {
      const savedEmail = localStorage.getItem(
        REMEMBERED_EMAIL_KEY
      );

      if (savedEmail && elements.loginEmail) {
        elements.loginEmail.value = savedEmail;

        if (elements.rememberMe) {
          elements.rememberMe.checked = true;
        }
      }
    } catch (error) {
      console.warn(
        "Could not restore remembered email:",
        error
      );
    }
  }

  // ==========================================
  // BUTTON LOADING
  // ==========================================

  function setSubmitting(loading, formType) {
    isSubmitting = loading;

    const button =
      formType === "register"
        ? elements.registerButton
        : elements.loginButton;

    if (!button) return;

    button.disabled = loading;

    const text = button.querySelector(".button-text");
    const loader = button.querySelector(".button-loader");

    if (text) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = text.textContent;
      }

      if (loading) {
        text.textContent =
          formType === "register"
            ? "Creating Account..."
            : "Logging in...";
      } else {
        text.textContent = button.dataset.originalText;
      }
    }

    if (loader) {
      loader.hidden = !loading;
    }
  }

  // ==========================================
  // LOGIN / REGISTRATION TABS
  // ==========================================

  function showLoginForm() {
    if (!elements.loginForm || !elements.registerForm) {
      return;
    }

    elements.loginForm.hidden = false;
    elements.registerForm.hidden = true;

    elements.loginTab?.classList.add("active");
    elements.registerTab?.classList.remove("active");

    elements.loginTab?.setAttribute(
      "aria-selected",
      "true"
    );

    elements.registerTab?.setAttribute(
      "aria-selected",
      "false"
    );

    if (elements.formHeading) {
      elements.formHeading.textContent = "Welcome Back!";
    }

    if (elements.formDescription) {
      elements.formDescription.textContent =
        "Login to continue your NEET preparation.";
    }

    clearMessage();
  }

  function showRegisterForm() {
    if (!elements.loginForm || !elements.registerForm) {
      return;
    }

    elements.loginForm.hidden = true;
    elements.registerForm.hidden = false;

    elements.loginTab?.classList.remove("active");
    elements.registerTab?.classList.add("active");

    elements.loginTab?.setAttribute(
      "aria-selected",
      "false"
    );

    elements.registerTab?.setAttribute(
      "aria-selected",
      "true"
    );

    if (elements.formHeading) {
      elements.formHeading.textContent =
        "Create Your Account";
    }

    if (elements.formDescription) {
      elements.formDescription.textContent =
        "Join mNEET and start your preparation.";
    }

    clearMessage();
  }

  function setupTabs() {
    elements.loginTab?.addEventListener(
      "click",
      showLoginForm
    );

    elements.registerTab?.addEventListener(
      "click",
      showRegisterForm
    );

    $("openRegister")?.addEventListener(
      "click",
      showRegisterForm
    );

    $("openLogin")?.addEventListener(
      "click",
      showLoginForm
    );
  }

  // ==========================================
  // PASSWORD VISIBILITY
  // ==========================================

  function setupPasswordToggles() {
    document
      .querySelectorAll(".password-toggle")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const input = $(button.dataset.target);

          if (!input) return;

          const showPassword =
            input.type === "password";

          input.type = showPassword
            ? "text"
            : "password";

          button.textContent = showPassword
            ? "Hide"
            : "Show";

          button.setAttribute(
            "aria-label",
            showPassword
              ? "Hide password"
              : "Show password"
          );
        });
      });
  }

  // ==========================================
  // LOGIN
  // ==========================================

  async function handleLogin(event) {
    event.preventDefault();

    if (isSubmitting || redirectStarted) {
      return;
    }

    if (!auth || !db) {
      showMessage(
        "Firebase চালু হয়নি। Firebase SDK এবং js/firebase.js পরীক্ষা করো।"
      );

      return;
    }

    const email =
      elements.loginEmail?.value.trim().toLowerCase() || "";

    const password =
      elements.loginPassword?.value || "";

    if (!email || !password) {
      showMessage("Email এবং password দুটোই দাও।");
      return;
    }

    if (!elements.loginEmail.checkValidity()) {
      showMessage("সঠিক email address দাও।");
      return;
    }

    saveRememberedEmail(email);

    setSubmitting(true, "login");

    try {
      await auth.setPersistence(
        firebase.auth.Auth.Persistence.LOCAL
      );

      const credential =
        await auth.signInWithEmailAndPassword(
          email,
          password
        );

      const user = credential.user;

      if (!user) {
        throw new Error("AUTH_USER_MISSING");
      }

      const profile = await getUserProfile(user.uid);

      if (!profile) {
        await auth.signOut();

        showMessage(
          "তোমার users profile পাওয়া যায়নি। Firestore document পরীক্ষা করো।"
        );

        return;
      }

      if (isAccountInactive(profile)) {
        await auth.signOut();

        showMessage(
          "এই account নিষ্ক্রিয়। Admin-এর সাহায্য নাও।"
        );

        return;
      }

      const role = normalizeRole(profile.role);

      if (role !== "admin" && role !== "student") {
        await auth.signOut();

        showMessage(
          "এই account-এর role student অথবা admin হতে হবে।"
        );

        return;
      }

      showMessage(
        "Login successful. Dashboard খুলছে...",
        "success"
      );

      redirectByRole(role);

    } catch (error) {
      console.error("Login error:", error);

      showMessage(getFriendlyError(error));

    } finally {
      setSubmitting(false, "login");
    }
  }

  // ==========================================
  // REGISTRATION
  // ==========================================

  async function handleRegistration(event) {
    event.preventDefault();

    if (isSubmitting || redirectStarted) {
      return;
    }

    if (!auth || !db) {
      showMessage(
        "Firebase চালু হয়নি। Firebase SDK এবং js/firebase.js পরীক্ষা করো।"
      );

      return;
    }

    const fullName =
      elements.registerName?.value.trim() || "";

    const phone =
      elements.registerPhone?.value.trim() || "";

    const email =
      elements.registerEmail?.value.trim().toLowerCase() || "";

    const city =
      elements.registerCity?.value.trim() || "";

    const password =
      elements.registerPassword?.value || "";

    const confirmPassword =
      elements.confirmPassword?.value || "";

    if (
      !fullName ||
      !phone ||
      !email ||
      !city ||
      !password ||
      !confirmPassword
    ) {
      showMessage("সব তথ্য পূরণ করো.");
      return;
    }

    if (fullName.length < 2) {
      showMessage(
        "Full Name অন্তত 2 অক্ষরের হতে হবে।"
      );

      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      showMessage(
        "সঠিক 10-digit Indian mobile number দাও।"
      );

      return;
    }

    if (!elements.registerEmail.checkValidity()) {
      showMessage("সঠিক email address দাও।");
      return;
    }

    if (password.length < 8) {
      showMessage(
        "Password অন্তত 8 অক্ষরের হতে হবে।"
      );

      return;
    }

    if (password !== confirmPassword) {
      showMessage(
        "Password এবং Confirm Password মিলছে না।"
      );

      return;
    }

    setSubmitting(true, "register");

    let createdUser = null;

    try {
      await auth.setPersistence(
        firebase.auth.Auth.Persistence.LOCAL
      );

      const credential =
        await auth.createUserWithEmailAndPassword(
          email,
          password
        );

      createdUser = credential.user;

      if (!createdUser) {
        throw new Error("AUTH_USER_MISSING");
      }

      await createdUser.updateProfile({
        displayName: fullName
      });

      const profile = {
        uid: createdUser.uid,
        fullName: fullName,
        phone: phone,
        email: email,
        city: city,
        role: "student",
        status: "active",
        createdAt:
          firebase.firestore.FieldValue.serverTimestamp()
      };

      await db
        .collection("users")
        .doc(createdUser.uid)
        .set(profile);

      saveRememberedEmail(email);

      showMessage(
        "Account তৈরি হয়েছে। Student Dashboard খুলছে...",
        "success"
      );

      redirectByRole("student");

    } catch (error) {
      console.error("Registration error:", error);

      /*
       * Registration failed after account creation.
       * Do not silently delete the Firebase account.
       * Report the error so the incomplete profile
       * can be diagnosed safely.
       */

      showMessage(getFriendlyError(error));

    } finally {
      setSubmitting(false, "register");
    }
  }

  // ==========================================
  // FORGOT PASSWORD
  // ==========================================

  async function handleForgotPassword() {
    if (!auth) {
      showMessage("Firebase চালু হয়নি।");
      return;
    }

    const email =
      elements.loginEmail?.value.trim().toLowerCase() || "";

    if (
      !email ||
      !elements.loginEmail.checkValidity()
    ) {
      showMessage(
        "প্রথমে সঠিক Email Address দাও।"
      );

      elements.loginEmail?.focus();

      return;
    }

    try {
      if (elements.forgotPassword) {
        elements.forgotPassword.disabled = true;
      }

      await auth.sendPasswordResetEmail(email);

      showMessage(
        "যদি এই Email-এর জন্য reset করা যায়, তাহলে reset email পাঠানো হবে। Inbox ও Spam folder দেখো।",
        "success"
      );

    } catch (error) {
      console.error("Password reset error:", error);

      showMessage(getFriendlyError(error));

    } finally {
      if (elements.forgotPassword) {
        elements.forgotPassword.disabled = false;
      }
    }
  }

  // ==========================================
  // EXISTING LOGIN SESSION
  // ==========================================

  async function routeAuthenticatedUser(user) {
    if (
      !user ||
      !auth ||
      !db ||
      sessionCheckInProgress ||
      isSubmitting ||
      redirectStarted
    ) {
      return;
    }

    sessionCheckInProgress = true;

    try {
      const profile = await getUserProfile(user.uid);

      if (!profile) {
        showMessage(
          "Login session আছে, কিন্তু users profile পাওয়া যায়নি।"
        );

        return;
      }

      if (isAccountInactive(profile)) {
        showMessage(
          "এই account নিষ্ক্রিয়। Admin-এর সাহায্য নাও।"
        );

        return;
      }

      const role = normalizeRole(profile.role);

      if (role === "admin" || role === "student") {
        redirectByRole(role);
      } else {
        showMessage(
          "এই account-এর role সঠিকভাবে সেট করা নেই।"
        );
      }

    } catch (error) {
      console.error("Session routing error:", error);

      showMessage(getFriendlyError(error));

    } finally {
      sessionCheckInProgress = false;
    }
  }

  // ==========================================
  // FRIENDLY ERROR MESSAGES
  // ==========================================

  function getFriendlyError(error) {
    const code = error?.code || "";

    switch (code) {
      case "auth/invalid-email":
        return "Email address সঠিক নয়।";

      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Email অথবা Password সঠিক নয়।";

      case "auth/email-already-in-use":
        return "এই Email দিয়ে account আগে থেকেই আছে। Login করো।";

      case "auth/weak-password":
        return "আরও শক্তিশালী password ব্যবহার করো।";

      case "auth/too-many-requests":
        return "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করো।";

      case "auth/network-request-failed":
        return "Internet connection পরীক্ষা করে আবার চেষ্টা করো।";

      case "auth/operation-not-allowed":
        return "Firebase Console-এ Email/Password Authentication চালু করো।";

      case "auth/invalid-api-key":
        return "Firebase API key পরীক্ষা করো।";

      case "permission-denied":
      case "firestore/permission-denied":
        return "Firestore permission-এর কারণে profile পড়া বা সংরক্ষণ করা যায়নি।";

      case "PROFILE_LOOKUP_UNAVAILABLE":
        return "Firestore profile পরীক্ষা করা যায়নি।";

      case "AUTH_USER_MISSING":
        return "Firebase user পাওয়া যায়নি। আবার চেষ্টা করো।";

      default:
        return (
          "কাজটি সম্পন্ন হয়নি। Error: " +
          (code || error?.message || "Unknown error")
        );
    }
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  function initialize() {
    const year = $("currentYear");

    if (year) {
      year.textContent = new Date().getFullYear();
    }

    setupTabs();
    setupPasswordToggles();
    setupRememberedEmail();

    elements.loginForm?.addEventListener(
      "submit",
      handleLogin
    );

    elements.registerForm?.addEventListener(
      "submit",
      handleRegistration
    );

    elements.forgotPassword?.addEventListener(
      "click",
      handleForgotPassword
    );

    if (
      typeof window.firebase === "undefined" ||
      !window.auth ||
      !window.db
    ) {
      showMessage(
        "Firebase চালু হয়নি। index.html-এ Firebase SDK এবং js/firebase.js-এর order পরীক্ষা করো।"
      );

      return;
    }

    auth = window.auth;
    db = window.db;

    auth.onAuthStateChanged(
      async (user) => {
        if (
          user &&
          !isSubmitting &&
          !redirectStarted
        ) {
          await routeAuthenticatedUser(user);
        }
      },
      (error) => {
        console.error("Auth state error:", error);

        showMessage(
          "Login session যাচাই করা যায়নি। আবার চেষ্টা করো।"
        );
      }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }
})();
