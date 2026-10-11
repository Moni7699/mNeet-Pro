/* =========================================================
   mNEET AUTHENTICATION SYSTEM
   File: auth.js

   Sign In, Sign Up, Forgot Password, Student Profile.
   Role-based navigation is handled by auth-guard.js.
========================================================= */

(function (window, document) {
  "use strict";

  const MIN_PASSWORD_LENGTH = 6;
  const MIN_NAME_LENGTH = 2;

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

  let initialized = false;

  function getServices() {
    const services = window.MNEETFirebase;

    if (
      !services ||
      services.ready !== true ||
      !services.auth ||
      !services.db
    ) {
      throw new Error(
        "Firebase প্রস্তুত নয়। firebase.js এবং SDK scripts পরীক্ষা করো।"
      );
    }

    return services;
  }

  function showMessage(message, type = "error") {
    if (!elements.message) return;

    elements.message.textContent = String(message || "");
    elements.message.className =
      "auth-message " + type + " show";
  }

  function clearMessage() {
    if (!elements.message) return;

    elements.message.textContent = "";
    elements.message.className = "auth-message";
  }

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

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeName(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }

  function getFriendlyError(error) {
    const code = error && error.code ? error.code : "";

    const messages = {
      "auth/invalid-email": "সঠিক Email Address দাও।",
      "auth/user-not-found": "এই Email দিয়ে account পাওয়া যায়নি।",
      "auth/wrong-password": "Email অথবা Password সঠিক নয়।",
      "auth/invalid-credential": "Email অথবা Password সঠিক নয়।",
      "auth/invalid-login-credentials": "Email অথবা Password সঠিক নয়।",
      "auth/email-already-in-use": "এই Email দিয়ে account আগে থেকেই আছে। Sign In করো।",
      "auth/weak-password": "Password অন্তত ৬টি character-এর হতে হবে।",
      "auth/too-many-requests": "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করো।",
      "auth/network-request-failed": "Internet connection পরীক্ষা করে আবার চেষ্টা করো।",
      "auth/operation-not-allowed": "Firebase-এ Email/Password Authentication চালু করো।",
      "permission-denied": "Firestore Security Rules এই কাজের অনুমতি দিচ্ছে না।",
      "unavailable": "Firebase service সাময়িকভাবে পাওয়া যাচ্ছে না।"
    };

    return messages[code] ||
      (error && error.message) ||
      "কাজটি সম্পন্ন হয়নি। আবার চেষ্টা করো।";
  }

  /* =======================================================
     SIGN IN

     Do not redirect here. auth-guard.js is responsible
     for deciding whether the user enters Admin or Student.
  ======================================================= */

  async function handleSignIn(event) {
    event.preventDefault();
    clearMessage();

    if (elements.signInButton.disabled) return;

    const email = normalizeEmail(elements.signInEmail.value);
    const password = elements.signInPassword.value;

    if (!validEmail(email)) {
      showMessage("সঠিক Email Address দাও।");
      elements.signInEmail.focus();
      return;
    }

    if (!password) {
      showMessage("Password লিখো।");
      elements.signInPassword.focus();
      return;
    }

    try {
      const { auth } = getServices();

      setLoading(
        elements.signInButton,
        true,
        "Signing In...",
        "Sign In"
      );

      await auth.signInWithEmailAndPassword(email, password);

      showMessage(
        "Login সফল হয়েছে। Account যাচাই করা হচ্ছে...",
        "success"
      );

      /*
       * No redirect here.
       * auth-guard.js handles role verification and navigation.
       */

    } catch (error) {
      console.error("mNEET sign-in error:", error);
      showMessage(getFriendlyError(error));

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
  ======================================================= */

  async function handleSignUp(event) {
    event.preventDefault();
    clearMessage();

    if (elements.signUpButton.disabled) return;

    const name = normalizeName(elements.signUpName.value);
    const phone = String(elements.signUpPhone.value || "").trim();
    const email = normalizeEmail(elements.signUpEmail.value);
    const password = elements.signUpPassword.value;
    const confirmPassword = elements.confirmPassword.value;

    if (name.length < MIN_NAME_LENGTH) {
      showMessage("তোমার সম্পূর্ণ নাম লিখো।");
      elements.signUpName.focus();
      return;
    }

    if (!validPhone(phone)) {
      showMessage("সঠিক Phone Number লিখো।");
      elements.signUpPhone.focus();
      return;
    }

    if (!validEmail(email)) {
      showMessage("সঠিক Email Address দাও।");
      elements.signUpEmail.focus();
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      showMessage("Password অন্তত ৬টি character-এর হতে হবে।");
      elements.signUpPassword.focus();
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Password এবং Confirm Password মিলছে না।");
      elements.confirmPassword.focus();
      return;
    }

    let accountCreated = false;

    try {
      const { auth, db } = getServices();

      setLoading(
        elements.signUpButton,
        true,
        "Creating Account...",
        "Create Account"
      );

      const credential = await auth.createUserWithEmailAndPassword(
        email,
        password
      );

      const user = credential.user;
      accountCreated = true;

      await user.updateProfile({
        displayName: name
      });

      await db.collection("users").doc(user.uid).set({
        uid: user.uid,
        name: name,
        fullName: name,
        phone: phone,
        email: email,
        role: "student",
        accountStatus: "active",
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });

      showMessage(
        "Account তৈরি হয়েছে। তোমার Dashboard খোলা হচ্ছে...",
        "success"
      );

      /*
       * auth-guard.js handles the redirect.
       * Registration never creates an Admin document.
       */

    } catch (error) {
      console.error("mNEET sign-up error:", error);

      if (accountCreated) {
        showMessage(
          "Authentication account তৈরি হয়েছে, কিন্তু profile save সম্পূর্ণ হয়নি। একই Email দিয়ে আবার Sign Up না করে Sign In করো। " +
          getFriendlyError(error)
        );
      } else {
        showMessage(getFriendlyError(error));
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
      showMessage("সঠিক registered Email Address দাও।");
      elements.resetEmail.focus();
      return;
    }

    try {
      const { auth } = getServices();

      setLoading(
        elements.resetPasswordButton,
        true,
        "Sending Email...",
        "Send Reset Email"
      );

      await auth.sendPasswordResetEmail(email);

      showMessage(
        "যদি এই Email দিয়ে account থাকে, তাহলে password reset email পাঠানো হয়েছে। Inbox ও Spam folder পরীক্ষা করো।",
        "success"
      );

    } catch (error) {
      console.error("mNEET password reset error:", error);

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
        showMessage(getFriendlyError(error));
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
     INITIALIZATION
  ======================================================= */

  function initialize() {
    if (initialized) return;

    try {
      getServices();

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

      initialized = true;
      console.info("mNEET authentication initialized.");

    } catch (error) {
      console.error("mNEET authentication initialization failed:", error);

      showMessage(
        "mNEET চালু করা যায়নি। Firebase SDK, firebase.js এবং Internet connection পরীক্ষা করো।"
      );
    }
  }

  initialize();

  window.MNEETAuth = Object.freeze({
    initialize: initialize,
    getFriendlyError: getFriendlyError
  });

})(window, document);
