/* =====================================================
   mNEET AUTHENTICATION
   File: auth.js

   Responsibilities:
   1. Student registration
   2. Email/password sign-in
   3. Password reset
   4. Student profile creation
   5. Display authentication messages

   Dashboard routing belongs to auth-guard.js.
   No independent redirect is performed here.
===================================================== */

(function (window, document) {
  "use strict";

  const LOGIN_PAGE = "index.html";

  let auth = null;
  let db = null;
  let initialized = false;

  const UI = function () {
    return window.MNEETAuthUI || null;
  };

  function showMessage(message, type) {
    const ui = UI();

    if (ui && typeof ui.showMessage === "function") {
      ui.showMessage(message, type || "error");
      return;
    }

    console.log(message);
  }

  function clearMessage() {
    const ui = UI();

    if (ui && typeof ui.clearMessage === "function") {
      ui.clearMessage();
    }
  }

  function getFirebaseServices() {
    const services = window.MNEETFirebase;

    if (
      !services ||
      services.ready !== true ||
      !services.auth ||
      !services.db
    ) {
      throw new Error(
        "Firebase প্রস্তুত নয়। firebase.js এবং Firebase SDK পরীক্ষা করো।"
      );
    }

    auth = services.auth;
    db = services.db;

    return { auth: auth, db: db };
  }

  function friendlyError(error) {
    const code = error && error.code ? error.code : "";

    const messages = {
      "auth/invalid-email":
        "সঠিক Email Address লিখো।",

      "auth/user-disabled":
        "এই অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে।",

      "auth/user-not-found":
        "এই Email দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি।",

      "auth/wrong-password":
        "Email অথবা Password সঠিক নয়।",

      "auth/invalid-credential":
        "Email অথবা Password সঠিক নয়।",

      "auth/email-already-in-use":
        "এই Email দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট আছে। Sign In করো।",

      "auth/weak-password":
        "আরও শক্তিশালী Password ব্যবহার করো।",

      "auth/network-request-failed":
        "Internet connection পরীক্ষা করে আবার চেষ্টা করো।",

      "auth/too-many-requests":
        "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করো।",

      "auth/operation-not-allowed":
        "Firebase Console-এ Email/Password Sign-In চালু আছে কি না পরীক্ষা করো।",

      "permission-denied":
        "Firebase Security Rules এই কাজের অনুমতি দিচ্ছে না।"
    };

    return messages[code] ||
      (error && error.message) ||
      "কাজটি সম্পন্ন হয়নি। আবার চেষ্টা করো।";
  }

  function setBusy(button, busy, busyText, normalText) {
    if (!button) return;

    button.disabled = busy;
    button.textContent = busy ? busyText : normalText;
  }

  function getFormValue(form, name) {
    const element = form.elements.namedItem(name);
    return element ? element.value.trim() : "";
  }

  /* =====================================================
     STUDENT REGISTRATION
  ===================================================== */

  async function handleSignup(event) {
    event.preventDefault();
    clearMessage();

    const form = event.currentTarget;
    const button = document.getElementById("signupButton");

    const fullName = getFormValue(form, "fullName");
    const phone = getFormValue(form, "phone");
    const email = getFormValue(form, "email").toLowerCase();

    const passwordElement = form.elements.namedItem("password");
    const confirmElement =
      form.elements.namedItem("confirmPassword");

    const password = passwordElement
      ? passwordElement.value
      : "";

    const confirmPassword = confirmElement
      ? confirmElement.value
      : "";

    if (fullName.length < 2) {
      showMessage("তোমার সম্পূর্ণ নাম লিখো।");
      return;
    }

    if (!phone) {
      showMessage("Phone Number লিখো।");
      return;
    }

    if (!email) {
      showMessage("Email Address লিখো।");
      return;
    }

    if (password.length < 6) {
      showMessage("Password কমপক্ষে ৬ অক্ষরের হতে হবে।");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("দুটি Password মিলছে না।");
      return;
    }

    setBusy(button, true, "Creating Account...", "Create Account");

    let createdUser = null;

    try {
      const services = getFirebaseServices();

      const credential =
        await services.auth.createUserWithEmailAndPassword(
          email,
          password
        );

      createdUser = credential.user;

      await createdUser.updateProfile({
        displayName: fullName
      });

      /*
       * New registrations always receive the student role.
       * Registration must never create an Admin account.
       */

      await services.db
        .collection("users")
        .doc(createdUser.uid)
        .set({
          uid: createdUser.uid,
          fullName: fullName,
          name: fullName,
          phone: phone,
          email: email,
          role: "student",
          accountStatus: "active",
          createdAt:
            window.firebase.firestore.FieldValue.serverTimestamp()
        });

      showMessage(
        "Registration সফল হয়েছে। তোমার Dashboard খোলা হচ্ছে...",
        "success"
      );

      /*
       * auth-guard.js owns all dashboard navigation.
       * Do not redirect here.
       */

    } catch (error) {
      console.error("mNEET Registration Error:", error);

      /*
       * If Authentication succeeded but profile creation failed,
       * do not silently claim that registration fully succeeded.
       */

      if (createdUser) {
        showMessage(
          "অ্যাকাউন্ট তৈরি হয়েছে, কিন্তু Student Profile সংরক্ষণ হয়নি। " +
          "Firebase Security Rules পরীক্ষা করো। " +
          friendlyError(error)
        );
      } else {
        showMessage(friendlyError(error));
      }

    } finally {
      setBusy(button, false, "", "Create Account");
    }
  }

  /* =====================================================
     SIGN IN
  ===================================================== */

  async function handleLogin(event) {
    event.preventDefault();
    clearMessage();

    const form = event.currentTarget;
    const button = document.getElementById("loginButton");

    const email = getFormValue(form, "email").toLowerCase();

    const passwordElement = form.elements.namedItem("password");
    const password = passwordElement
      ? passwordElement.value
      : "";

    if (!email || !password) {
      showMessage("Email এবং Password দুটোই লিখো।");
      return;
    }

    setBusy(button, true, "Signing In...", "Sign In");

    try {
      const services = getFirebaseServices();

      /*
       * Sign in through Firebase Authentication.
       */

      await services.auth.signInWithEmailAndPassword(
        email,
        password
      );

      showMessage(
        "Login সফল হয়েছে। Account যাচাই করা হচ্ছে...",
        "success"
      );

      /*
       * Do not perform role detection or redirection here.
       * auth-guard.js will verify the user's role.
       */

    } catch (error) {
      console.error("mNEET Login Error:", error);
      showMessage(friendlyError(error));

    } finally {
      setBusy(button, false, "", "Sign In");
    }
  }

  /* =====================================================
     FORGOT PASSWORD
  ===================================================== */

  async function handleForgotPassword(event) {
    event.preventDefault();
    clearMessage();

    const form = event.currentTarget;
    const button = document.getElementById("resetButton");

    const email = getFormValue(form, "email").toLowerCase();

    if (!email) {
      showMessage("তোমার registered Email লিখো।");
      return;
    }

    setBusy(button, true, "Sending...", "Send Reset Link");

    try {
      const services = getFirebaseServices();

      await services.auth.sendPasswordResetEmail(email);

      showMessage(
        "Password Reset Link পাঠানোর অনুরোধ সফল হয়েছে। " +
        "তোমার Email Inbox পরীক্ষা করো।",
        "success"
      );

    } catch (error) {
      console.error("mNEET Password Reset Error:", error);
      showMessage(friendlyError(error));

    } finally {
      setBusy(button, false, "", "Send Reset Link");
    }
  }

  /* =====================================================
     INITIALIZATION
  ===================================================== */

  function initialize() {
    if (initialized) return;

    const page = (
      window.location.pathname.split("/").pop() || LOGIN_PAGE
    ).toLowerCase();

    if (page !== LOGIN_PAGE && page !== "") {
      return;
    }

    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    const forgotForm = document.getElementById("forgotForm");

    if (!loginForm || !signupForm || !forgotForm) {
      console.error(
        "mNEET Auth: Required forms পাওয়া যায়নি। index.html পরীক্ষা করো।"
      );
      return;
    }

    try {
      getFirebaseServices();
    } catch (error) {
      console.error("mNEET Auth Initialization Error:", error);
      showMessage(error.message);
      return;
    }

    loginForm.addEventListener("submit", handleLogin);
    signupForm.addEventListener("submit", handleSignup);
    forgotForm.addEventListener("submit", handleForgotPassword);

    initialized = true;

    console.info("mNEET Authentication initialized.");
  }

  /*
   * Wait until the DOM is ready.
   */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  /*
   * Public API for diagnostics or future controlled use.
   */

  window.MNEETAuth = Object.freeze({
    initialize: initialize,
    getFirebaseServices: getFirebaseServices
  });

})(window, document);
