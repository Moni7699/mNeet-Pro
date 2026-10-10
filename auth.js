/* =====================================================
   mNEET AUTHENTICATION SYSTEM
   File: auth.js

   Features:
   1. Student/Admin account sign-in through Firebase
   2. Account registration
   3. Full name, phone, email and password validation
   4. Confirm password validation
   5. Password reset email
   6. Admin authorization through admins/{uid}
   7. Student/Admin role-based redirection
   8. Safe error messages
   9. Loading and duplicate-submission protection

   Required files:
   index.html
   auth.css
   firebase.js
   auth-guard.js
===================================================== */

(() => {
  "use strict";

  /* =====================================================
     CONFIGURATION
  ===================================================== */

  const CONFIG = Object.freeze({
    ADMIN_PAGE: "admin.html",
    STUDENT_PAGE: "student.html",

    // Registration creates a normal student account.
    // Admin access must be granted separately in Firestore.
    DEFAULT_ROLE: "student",

    MIN_PASSWORD_LENGTH: 6,
    MIN_NAME_LENGTH: 2,
    PHONE_MIN_LENGTH: 10,
    PHONE_MAX_LENGTH: 15
  });

  /* =====================================================
     ELEMENT REFERENCES
  ===================================================== */

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

  /* =====================================================
     FIREBASE REFERENCES
  ===================================================== */

  let auth = null;
  let db = null;

  let initialized = false;
  let redirecting = false;

  /* =====================================================
     GENERAL HELPERS
  ===================================================== */

  function getFirebaseServices() {
    if (!window.firebase) {
      throw new Error(
        "Firebase SDK load হয়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করো।"
      );
    }

    if (!window.firebase.apps || window.firebase.apps.length === 0) {
      throw new Error(
        "Firebase initialize হয়নি। firebase.js ফাইল পরীক্ষা করো।"
      );
    }

    if (!auth) {
      auth = window.firebase.auth();
    }

    if (!db) {
      db = window.firebase.firestore();
    }

    return { auth, db };
  }

  function showMessage(message, type = "error") {
    if (!elements.message) {
      return;
    }

    elements.message.textContent = String(message || "");

    elements.message.className =
      "auth-message " + type + " show";
  }

  function clearMessage() {
    if (!elements.message) {
      return;
    }

    elements.message.textContent = "";
    elements.message.className = "auth-message";
  }

  function setButtonLoading(button, loading, loadingText, originalText) {
    if (!button) {
      return;
    }

    if (loading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText =
          originalText || button.textContent.trim();
      }

      button.disabled = true;
      button.textContent = loadingText || "Please wait...";
    } else {
      button.disabled = false;

      button.textContent =
        button.dataset.originalText ||
        originalText ||
        button.textContent;

      delete button.dataset.originalText;
    }
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeName(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function normalizePhone(value) {
    return String(value || "").trim().replace(/[\s()-]/g, "");
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidPhone(phone) {
    const digits = phone.replace(/\D/g, "");

    return (
      digits.length >= CONFIG.PHONE_MIN_LENGTH &&
      digits.length <= CONFIG.PHONE_MAX_LENGTH
    );
  }

  function friendlyError(error) {
    const code = error && error.code ? error.code : "";

    const messages = {
      "auth/invalid-email":
        "সঠিক Email Address দাও।",

      "auth/user-not-found":
        "এই Email দিয়ে কোনো account পাওয়া যায়নি।",

      "auth/wrong-password":
        "Email অথবা Password সঠিক নয়।",

      "auth/invalid-credential":
        "Email অথবা Password সঠিক নয়।",

      "auth/invalid-login-credentials":
        "Email অথবা Password সঠিক নয়।",

      "auth/email-already-in-use":
        "এই Email দিয়ে আগে থেকেই account তৈরি আছে। Sign In করো।",

      "auth/weak-password":
        "Password আরও শক্তিশালী করো। অন্তত ৬টি character ব্যবহার করো।",

      "auth/too-many-requests":
        "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করো।",

      "auth/network-request-failed":
        "ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করো।",

      "auth/operation-not-allowed":
        "Firebase Console-এ Email/Password Authentication চালু আছে কি না পরীক্ষা করো।",

      "auth/requires-recent-login":
        "নিরাপত্তার জন্য আবার Sign In করে চেষ্টা করো।",

      "permission-denied":
        "Firebase Security Rules অনুযায়ী এই কাজের অনুমতি নেই।",

      "unavailable":
        "Firebase সার্ভিস এখন পাওয়া যাচ্ছে না। পরে আবার চেষ্টা করো।"
    };

    return messages[code] ||
      "কাজটি সম্পন্ন করা যায়নি। তথ্য ও Firebase configuration পরীক্ষা করে আবার চেষ্টা করো।";
  }

  /* =====================================================
     SAFE SECTION NAVIGATION
  ===================================================== */

  function showSection(sectionName) {
    if (
      window.MNEETAuthUI &&
      typeof window.MNEETAuthUI.showSection === "function"
    ) {
      window.MNEETAuthUI.showSection(sectionName);
    }
  }

  /* =====================================================
     ADMIN AUTHORIZATION
     
     An admin is authorized only if:
     admins/{uid} exists AND active === true.

     A normal student must never receive admin access
     merely because they have signed in.
  ===================================================== */

  async function getAuthorizedRole(user) {
    const { db } = getFirebaseServices();

    const adminRef = db.collection("admins").doc(user.uid);
    const adminSnapshot = await adminRef.get();

    if (
      adminSnapshot.exists &&
      adminSnapshot.data() &&
      adminSnapshot.data().active === true
    ) {
      return "admin";
    }

    return CONFIG.DEFAULT_ROLE;
  }

  async function redirectAfterLogin(user) {
    if (redirecting) {
      return;
    }

    redirecting = true;

    try {
      const role = await getAuthorizedRole(user);

      if (role === "admin") {
        window.location.replace(CONFIG.ADMIN_PAGE);
        return;
      }

      window.location.replace(CONFIG.STUDENT_PAGE);
    } catch (error) {
      redirecting = false;

      console.error("mNEET authorization check failed:", error);

      showMessage(
        "তোমার account যাচাই করা যায়নি। Firebase Security Rules এবং admins collection পরীক্ষা করে আবার চেষ্টা করো।",
        "error"
      );

      // Do not sign out automatically here. This avoids
      // destroying a valid session when Firestore is offline.
    }
  }

  /* =====================================================
     SIGN IN
  ===================================================== */

  async function handleSignIn(event) {
    event.preventDefault();
    clearMessage();

    const email = normalizeEmail(elements.signInEmail.value);
    const password = elements.signInPassword.value;

    if (!email || !isValidEmail(email)) {
      showMessage("সঠিক Email Address দাও।");
      elements.signInEmail.focus();
      return;
    }

    if (!password) {
      showMessage("Password লিখো।");
      elements.signInPassword.focus();
      return;
    }

    setButtonLoading(
      elements.signInButton,
      true,
      "Signing In...",
      "Sign In"
    );

    try {
      const { auth } = getFirebaseServices();

      const credential = await auth.signInWithEmailAndPassword(
        email,
        password
      );

      await redirectAfterLogin(credential.user);
    } catch (error) {
      console.error("Sign-in error:", error);

      showMessage(friendlyError(error));

      setButtonLoading(
        elements.signInButton,
        false,
        "",
        "Sign In"
      );
    }
  }

  /* =====================================================
     SIGN UP

     Public registration creates a normal student account.
     Registration never grants admin privileges.
  ===================================================== */

  async function handleSignUp(event) {
    event.preventDefault();
    clearMessage();

    const fullName = normalizeName(elements.signUpName.value);
    const phone = normalizePhone(elements.signUpPhone.value);
    const email = normalizeEmail(elements.signUpEmail.value);
    const password = elements.signUpPassword.value;
    const confirmPassword = elements.confirmPassword.value;

    if (fullName.length < CONFIG.MIN_NAME_LENGTH) {
      showMessage("তোমার সম্পূর্ণ নাম লিখো।");
      elements.signUpName.focus();
      return;
    }

    if (!isValidPhone(phone)) {
      showMessage(
        "সঠিক Phone Number লিখো। দেশের code ব্যবহার করলে সেটিও সঠিকভাবে দাও।"
      );
      elements.signUpPhone.focus();
      return;
    }

    if (!isValidEmail(email)) {
      showMessage("সঠিক Email Address দাও।");
      elements.signUpEmail.focus();
      return;
    }

    if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
      showMessage("Password অন্তত ৬টি character-এর হতে হবে।");
      elements.signUpPassword.focus();
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Password এবং Confirm Password মিলছে না।");
      elements.confirmPassword.focus();
      return;
    }

    setButtonLoading(
      elements.signUpButton,
      true,
      "Creating Account...",
      "Create Account"
    );

    let createdUser = null;

    try {
      const { auth, db } = getFirebaseServices();

      const credential = await auth.createUserWithEmailAndPassword(
        email,
        password
      );

      createdUser = credential.user;

      await createdUser.updateProfile({
        displayName: fullName
      });

      /*
       * Save student profile.
       *
       * This writes only to users/{uid}.
       * It does NOT write to admins/{uid}.
       *
       * The Firestore rules must permit a newly registered
       * user to create their own limited profile document.
       */

      await db.collection("users").doc(createdUser.uid).set({
        uid: createdUser.uid,
        name: fullName,
        phone: phone,
        email: email,
        role: "student",
        target: "NEET 2027",
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        accountStatus: "active"
      });

      showMessage(
        "Account সফলভাবে তৈরি হয়েছে। এখন তোমার account যাচাই করা হচ্ছে...",
        "success"
      );

      await redirectAfterLogin(createdUser);
    } catch (error) {
      console.error("Sign-up error:", error);

      /*
       * If Auth creation succeeded but profile creation failed,
       * the Auth account may still exist. Never create an admin
       * record or silently grant elevated permissions.
       */

      if (
        createdUser &&
        error &&
        error.code === "permission-denied"
      ) {
        showMessage(
          "Account তৈরি হয়েছে, কিন্তু profile save করা যায়নি। Firebase Firestore Rules-এ users/{uid} create permission পরীক্ষা করতে হবে। একই Email দিয়ে আবার Sign Up করার আগে Sign In চেষ্টা করো।",
          "error"
        );
      } else {
        showMessage(friendlyError(error));
      }

      setButtonLoading(
        elements.signUpButton,
        false,
        "",
        "Create Account"
      );
    }
  }

  /* =====================================================
     FORGOT PASSWORD
  ===================================================== */

  async function handleForgotPassword(event) {
    event.preventDefault();
    clearMessage();

    const email = normalizeEmail(elements.resetEmail.value);

    if (!email || !isValidEmail(email)) {
      showMessage("সঠিক registered Email Address দাও।");
      elements.resetEmail.focus();
      return;
    }

    setButtonLoading(
      elements.resetPasswordButton,
      true,
      "Sending Email...",
      "Send Reset Email"
    );

    try {
      const { auth } = getFirebaseServices();

      /*
       * Avoid revealing whether an email is registered.
       */

      await auth.sendPasswordResetEmail(email);

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
        showMessage(friendlyError(error));
      }
    } finally {
      setButtonLoading(
        elements.resetPasswordButton,
        false,
        "",
        "Send Reset Email"
      );
    }
  }

  /* =====================================================
     PASSWORD VISIBILITY

     Supports the existing optional checkbox IDs.
     The main HTML remains compatible if these controls
     are added later.
  ===================================================== */

  function setupPasswordVisibility() {
    const pairs = [
      {
        toggleId: "showSignInPassword",
        inputId: "signInPassword"
      },
      {
        toggleId: "showSignUpPassword",
        inputId: "signUpPassword"
      }
    ];

    pairs.forEach(pair => {
      const toggle = document.getElementById(pair.toggleId);
      const input = document.getElementById(pair.inputId);

      if (!toggle || !input) {
        return;
      }

      toggle.addEventListener("change", () => {
        input.type = toggle.checked ? "text" : "password";
      });
    });
  }

  /* =====================================================
     AUTH STATE

     An already signed-in user is redirected only after
     the role check succeeds.
  ===================================================== */

  function setupAuthStateListener() {
    const { auth } = getFirebaseServices();

    auth.onAuthStateChanged(user => {
      if (!user) {
        redirecting = false;
        return;
      }

      const currentPage = window.location.pathname
        .split("/")
        .pop()
        .toLowerCase();

      if (
        currentPage === "" ||
        currentPage === "index.html"
      ) {
        redirectAfterLogin(user);
      }
    });
  }

  /* =====================================================
     INITIALIZATION
  ===================================================== */

  function initialize() {
    if (initialized) {
      return;
    }

    initialized = true;

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

      setupPasswordVisibility();
      setupAuthStateListener();

    } catch (error) {
      console.error("mNEET initialization error:", error);

      showMessage(
        "mNEET চালু করা যায়নি। firebase.js, Firebase SDK এবং internet connection পরীক্ষা করো।",
        "error"
      );
    }
  }

  /*
   * firebase.js is loaded before auth.js in index.html.
   * defer scripts execute in document order.
   */

  initialize();

})();
