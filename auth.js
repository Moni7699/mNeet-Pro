/* =========================================
   mNEET AUTHENTICATION SYSTEM
   File: auth.js
   Login + Registration + Forgot Password
========================================= */

(function () {
  "use strict";

  const auth = firebase.auth();
  const db = firebase.firestore();

  const ui = window.MNEETAuthUI;

  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const forgotForm = document.getElementById("forgotForm");

  const loginButton = document.getElementById("loginButton");
  const signupButton = document.getElementById("signupButton");
  const resetButton = document.getElementById("resetButton");

  if (!auth || !db || !loginForm || !signupForm || !forgotForm) {
    console.error("mNEET: Authentication setup is incomplete.");
    return;
  }

  /* =========================================
     HELPER FUNCTIONS
  ========================================= */

  function showMessage(message, type) {
    if (ui && typeof ui.showMessage === "function") {
      ui.showMessage(message, type || "error");
      return;
    }

    const box = document.getElementById("authMessage");

    if (box) {
      box.textContent = message;
      box.className = "message show";
    }
  }

  function clearMessage() {
    if (ui && typeof ui.clearMessage === "function") {
      ui.clearMessage();
      return;
    }

    const box = document.getElementById("authMessage");

    if (box) {
      box.textContent = "";
      box.className = "message";
    }
  }

  function getFormValue(form, name) {
    const element = form.elements.namedItem(name);

    return element && typeof element.value === "string"
      ? element.value.trim()
      : "";
  }

  function setButtonLoading(button, loading, loadingText, normalText) {
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? loadingText : normalText;
  }

  function getFirebaseError(error) {
    const code = error && error.code ? error.code : "";

    const messages = {
      "auth/invalid-email":
        "Please enter a valid email address.",

      "auth/user-not-found":
        "No account was found with this email.",

      "auth/wrong-password":
        "Incorrect email or password.",

      "auth/invalid-credential":
        "Incorrect email or password.",

      "auth/email-already-in-use":
        "This email is already registered. Please sign in.",

      "auth/weak-password":
        "Please choose a stronger password with at least 6 characters.",

      "auth/too-many-requests":
        "Too many attempts. Please wait and try again later.",

      "auth/network-request-failed":
        "Network error. Please check your internet connection.",

      "auth/operation-not-allowed":
        "Email and password sign-in is not enabled in Firebase.",

      "auth/requires-recent-login":
        "Please sign in again before performing this action.",

      "permission-denied":
        "Access denied by Firebase security rules.",

      "unavailable":
        "The service is temporarily unavailable. Please try again."
    };

    return messages[code] ||
      "Something went wrong. Please try again.";
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /* =========================================
     STUDENT REGISTRATION
  ========================================= */

  async function handleSignup(event) {
    event.preventDefault();
    clearMessage();

    const fullName = getFormValue(signupForm, "fullName");
    const phone = getFormValue(signupForm, "phone");
    const city = getFormValue(signupForm, "city");
    const email = getFormValue(signupForm, "email").toLowerCase();

    const passwordElement =
      signupForm.elements.namedItem("password");

    const confirmElement =
      signupForm.elements.namedItem("confirmPassword");

    const password = passwordElement ? passwordElement.value : "";
    const confirmPassword = confirmElement
      ? confirmElement.value
      : "";

    if (fullName.length < 2) {
      showMessage("Please enter your full name.");
      return;
    }

    if (!phone || phone.length < 7) {
      showMessage("Please enter a valid phone number.");
      return;
    }

    if (!city) {
      showMessage("Please enter your city.");
      return;
    }

    if (!validateEmail(email)) {
      showMessage("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      showMessage("Password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Passwords do not match.");
      return;
    }

    setButtonLoading(
      signupButton,
      true,
      "Creating Account...",
      "Create Account"
    );

    let createdUser = null;

    try {
      /* Create Firebase Authentication account */

      const credential = await auth.createUserWithEmailAndPassword(
        email,
        password
      );

      createdUser = credential.user;

      /* Set student's display name */

      await createdUser.updateProfile({
        displayName: fullName
      });

      /* Save student profile in Firestore */

      const studentProfile = {
        uid: createdUser.uid,
        fullName: fullName,
        name: fullName,
        phone: phone,
        city: city,
        email: email,
        role: "student",
        accountStatus: "active",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection("users")
        .doc(createdUser.uid)
        .set(studentProfile);

      showMessage(
        "Your account has been created successfully!",
        "success"
      );

      /*
        Auth redirect is handled by auth-guard.js
        after the profile has been saved.
      */

    } catch (error) {
      console.error("mNEET registration error:", error);

      /*
        If account creation succeeded but profile saving failed,
        keep the user signed in so the issue can be investigated.
        Do not silently delete the account.
      */

      if (
        createdUser &&
        error &&
        error.code === "permission-denied"
      ) {
        showMessage(
          "Your account was created, but Firebase denied saving your profile. Please check Firestore security rules."
        );
      } else {
        showMessage(getFirebaseError(error));
      }

    } finally {
      setButtonLoading(
        signupButton,
        false,
        "Creating Account...",
        "Create Account"
      );
    }
  }

  /* =========================================
     STUDENT LOGIN
  ========================================= */

  async function handleLogin(event) {
    event.preventDefault();
    clearMessage();

    const email = getFormValue(loginForm, "email").toLowerCase();

    const passwordElement =
      loginForm.elements.namedItem("password");

    const password = passwordElement
      ? passwordElement.value
      : "";

    if (!validateEmail(email)) {
      showMessage("Please enter a valid email address.");
      return;
    }

    if (!password) {
      showMessage("Please enter your password.");
      return;
    }

    setButtonLoading(
      loginButton,
      true,
      "Signing In...",
      "Sign In"
    );

    try {
      await auth.signInWithEmailAndPassword(email, password);

      showMessage("Login successful. Opening your account...", "success");

      /*
        auth-guard.js handles the authenticated redirect.
      */

    } catch (error) {
      console.error("mNEET login error:", error);
      showMessage(getFirebaseError(error));

    } finally {
      setButtonLoading(
        loginButton,
        false,
        "Signing In...",
        "Sign In"
      );
    }
  }

  /* =========================================
     FORGOT PASSWORD
  ========================================= */

  async function handleForgotPassword(event) {
    event.preventDefault();
    clearMessage();

    const email = getFormValue(forgotForm, "email").toLowerCase();

    if (!validateEmail(email)) {
      showMessage("Please enter a valid email address.");
      return;
    }

    setButtonLoading(
      resetButton,
      true,
      "Sending Reset Link...",
      "Send Reset Link"
    );

    try {
      await auth.sendPasswordResetEmail(email);

      showMessage(
        "If an account exists for this email, a password reset email will be sent. Please check your inbox and spam folder.",
        "success"
      );

      forgotForm.reset();

    } catch (error) {
      console.error("mNEET password reset error:", error);
      showMessage(getFirebaseError(error));

    } finally {
      setButtonLoading(
        resetButton,
        false,
        "Sending Reset Link...",
        "Send Reset Link"
      );
    }
  }

  /* =========================================
     FORM EVENT LISTENERS
  ========================================= */

  loginForm.addEventListener("submit", handleLogin);
  signupForm.addEventListener("submit", handleSignup);
  forgotForm.addEventListener("submit", handleForgotPassword);

  console.log("mNEET authentication initialized.");
})();
