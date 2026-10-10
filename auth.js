/* ========================================
   mNEET AUTHENTICATION
   Sign In / Sign Up / Password Reset
   ======================================== */

(function () {
    "use strict";

    const $ = function (id) {
        return document.getElementById(id);
    };

    let currentMode = "login";

    let isSubmitting = false;

    /*
     * Wait until Firebase is ready.
     */
    function getFirebase() {
        if (
            !window.mneetFirebase ||
            !window.mneetFirebase.auth ||
            !window.mneetFirebase.db
        ) {
            throw new Error(
                "Firebase is not ready. Please refresh the page."
            );
        }

        return window.mneetFirebase;
    }

    /*
     * Show a message on the page.
     */
    function showMessage(message, type) {
        const box = $("messageBox");

        if (!box) {
            return;
        }

        box.textContent = message;

        box.className = "message-box " + (type || "info");

        box.hidden = false;
    }

    /*
     * Hide the current message.
     */
    function clearMessage() {
        const box = $("messageBox");

        if (!box) {
            return;
        }

        box.textContent = "";

        box.hidden = true;

        box.className = "message-box";
    }

    /*
     * Prevent duplicate form submissions.
     */
    function setSubmitting(form, button, submitting, text) {
        isSubmitting = submitting;

        if (button) {
            button.disabled = submitting;

            if (text) {
                button.textContent = submitting
                    ? "Please wait..."
                    : text;
            }
        }

        if (form) {
            const controls = form.querySelectorAll(
                "input, button"
            );

            controls.forEach(function (control) {
                if (control === button) {
                    return;
                }

                control.disabled = submitting;
            });
        }
    }

    /*
     * Convert Firebase errors into readable messages.
     */
    function getReadableError(error) {
        const code = error && error.code
            ? error.code
            : "";

        switch (code) {
            case "auth/invalid-email":
                return "Please enter a valid email address.";

            case "auth/user-not-found":
            case "auth/invalid-credential":
            case "auth/wrong-password":
                return "Email or password is incorrect.";

            case "auth/email-already-in-use":
                return "This email is already registered. Please sign in.";

            case "auth/weak-password":
                return "Please choose a stronger password.";

            case "auth/too-many-requests":
                return "Too many attempts. Please wait and try again later.";

            case "auth/network-request-failed":
                return "Network error. Check your internet connection.";

            case "auth/operation-not-allowed":
                return "Email/Password login is not enabled in Firebase.";

            case "auth/user-disabled":
                return "This account has been disabled.";

            case "auth/requires-recent-login":
                return "Please sign in again before doing this.";

            case "permission-denied":
            case "firestore/permission-denied":
                return "Database permission denied. Check your Firestore rules.";

            default:
                console.error("Authentication error:", error);

                return "Something went wrong. Please try again.";
        }
    }

    /*
     * Switch between Login, Sign Up and Forgot Password.
     */
    function showMode(mode) {
        currentMode = mode;

        clearMessage();

        $("loginForm").hidden = mode !== "login";

        $("signupForm").hidden = mode !== "signup";

        $("forgotPasswordForm").hidden =
            mode !== "forgot";

        if (mode === "login") {
            $("formTitle").textContent = "Welcome Back!";

            $("formSubtitle").textContent =
                "Sign in to continue your NEET preparation.";

            $("loginEmail").focus();

        } else if (mode === "signup") {
            $("formTitle").textContent =
                "Create Your Account";

            $("formSubtitle").textContent =
                "Join mNEET and start your medical journey.";

            $("fullName").focus();

        } else {
            $("formTitle").textContent =
                "Reset Your Password";

            $("formSubtitle").textContent =
                "We will email you a password reset link.";

            $("resetEmail").focus();
        }
    }

    /*
     * Route the signed-in user.
     *
     * Admin access requires:
     * admins/{uid}
     * active === true
     *
     * Everyone else must have a student profile:
     * users/{uid}
     */
    async function routeSignedInUser(user) {
        const services = getFirebase();

        const db = services.db;

        // Admin check first.
        const adminDoc = await db
            .collection("admins")
            .doc(user.uid)
            .get();

        if (
            adminDoc.exists &&
            adminDoc.data().active === true
        ) {
            window.location.replace("admin.html");

            return;
        }

        // Student profile check.
        const userDoc = await db
            .collection("users")
            .doc(user.uid)
            .get();

        if (!userDoc.exists) {
            await services.auth.signOut();

            showMessage(
                "Student profile was not found. Please register first or contact support.",
                "error"
            );

            showMode("login");

            return;
        }

        const profile = userDoc.data();

        if (profile.status !== "active") {
            await services.auth.signOut();

            showMessage(
                "Your account is not active. Please contact support.",
                "error"
            );

            showMode("login");

            return;
        }

        // Never trust a client-provided role for admin access.
        // Only admins/{uid}.active === true grants admin routing.
        window.location.replace("student.html");
    }

    /*
     * LOGIN
     */
    async function handleLogin(event) {
        event.preventDefault();

        if (isSubmitting) {
            return;
        }

        clearMessage();

        const form = $("loginForm");

        const button = $("loginButton");

        const email = $("loginEmail")
            .value
            .trim()
            .toLowerCase();

        const password = $("loginPassword").value;

        if (!email || !password) {
            showMessage(
                "Please enter both email and password.",
                "error"
            );

            return;
        }

        setSubmitting(
            form,
            button,
            true,
            "Sign In"
        );

        try {
            const services = getFirebase();

            // Firebase verifies the credentials.
            const result = await services.auth
                .signInWithEmailAndPassword(
                    email,
                    password
                );

            await routeSignedInUser(result.user);

        } catch (error) {
            showMessage(
                getReadableError(error),
                "error"
            );

        } finally {
            setSubmitting(
                form,
                button,
                false,
                "Sign In"
            );
        }
    }

    /*
     * SIGN UP
     */
    async function handleSignup(event) {
        event.preventDefault();

        if (isSubmitting) {
            return;
        }

        clearMessage();

        const form = $("signupForm");

        const button = $("signupButton");

        const fullName = $("fullName")
            .value
            .trim();

        const phone = $("phone")
            .value
            .trim();

        const email = $("signupEmail")
            .value
            .trim()
            .toLowerCase();

        const city = $("city")
            .value
            .trim();

        const password = $("signupPassword").value;

        const confirmPassword =
            $("confirmPassword").value;

        // Basic input validation.
        if (
            !fullName ||
            !phone ||
            !email ||
            !city ||
            !password ||
            !confirmPassword
        ) {
            showMessage(
                "Please fill in all required fields.",
                "error"
            );

            return;
        }

        if (!/^[0-9]{10}$/.test(phone)) {
            showMessage(
                "Enter a valid 10-digit Indian mobile number.",
                "error"
            );

            return;
        }

        if (password.length < 8) {
            showMessage(
                "Password must contain at least 8 characters.",
                "error"
            );

            return;
        }

        if (password !== confirmPassword) {
            showMessage(
                "Password and Confirm Password do not match.",
                "error"
            );

            return;
        }

        setSubmitting(
            form,
            button,
            true,
            "Create Account"
        );

        let createdUser = null;

        try {
            const services = getFirebase();

            // Create the Firebase Authentication account.
            const result = await services.auth
                .createUserWithEmailAndPassword(
                    email,
                    password
                );

            createdUser = result.user;

            const uid = createdUser.uid;

            // Save the student profile in Firestore.
            const userData = {
                uid: uid,

                fullName: fullName,

                phone: phone,

                email: email,

                city: city,

                role: "student",

                status: "active",

                createdAt: services.serverTimestamp(),

                updatedAt: services.serverTimestamp()
            };

            await services.db
                .collection("users")
                .doc(uid)
                .set(userData);

            // Optional display name in Firebase Authentication.
            await createdUser.updateProfile({
                displayName: fullName
            });

            showMessage(
                "Account created successfully. Opening your dashboard...",
                "success"
            );

            await routeSignedInUser(createdUser);

        } catch (error) {
            /*
             * If Authentication succeeded but profile creation failed,
             * sign out the incomplete account.
             *
             * Do not automatically delete the account here:
             * deletion requires recent authentication and may fail.
             */
            if (createdUser) {
                try {
                    await createdUser.getIdToken(true);
                } catch (_) {
                    // Keep the original error for display.
                }
            }

            showMessage(
                getReadableError(error),
                "error"
            );

        } finally {
            setSubmitting(
                form,
                button,
                false,
                "Create Account"
            );
        }
    }

    /*
     * FORGOT PASSWORD
     */
    async function handleForgotPassword(event) {
        event.preventDefault();

        if (isSubmitting) {
            return;
        }

        clearMessage();

        const form = $("forgotPasswordForm");

        const button = $("resetButton");

        const email = $("resetEmail")
            .value
            .trim()
            .toLowerCase();

        if (!email) {
            showMessage(
                "Please enter your registered email address.",
                "error"
            );

            return;
        }

        setSubmitting(
            form,
            button,
            true,
            "Send Reset Link"
        );

        try {
            const services = getFirebase();

            await services.auth
                .sendPasswordResetEmail(email);

            showMessage(
                "If this email can receive a reset message, Firebase will send a password reset link. Check your inbox and spam folder.",
                "success"
            );

        } catch (error) {
            showMessage(
                getReadableError(error),
                "error"
            );

        } finally {
            setSubmitting(
                form,
                button,
                false,
                "Send Reset Link"
            );
        }
    }

    /*
     * Connect form events.
     */
    function initializeAuthPage() {
        $("loginForm").addEventListener(
            "submit",
            handleLogin
        );

        $("signupForm").addEventListener(
            "submit",
            handleSignup
        );

        $("forgotPasswordForm").addEventListener(
            "submit",
            handleForgotPassword
        );

        $("showSignup").addEventListener(
            "click",
            function () {
                showMode("signup");
            }
        );

        $("showLogin").addEventListener(
            "click",
            function () {
                showMode("login");
            }
        );

        $("showForgotPassword").addEventListener(
            "click",
            function () {
                // Preserve the email the student already entered.
                $("resetEmail").value =
                    $("loginEmail").value.trim();

                showMode("forgot");
            }
        );

        $("backToLogin").addEventListener(
            "click",
            function () {
                showMode("login");
            }
        );

        $("currentYear").textContent =
            new Date().getFullYear();

        /*
         * Check whether a session already exists.
         * The guard handles the role routing.
         */
        if (window.mneetAuthGuard) {
            window.mneetAuthGuard.checkCurrentPage();
        }
    }

    /*
     * Expose limited helpers for auth-guard.js.
     */
    window.mneetAuth = {
        showMessage: showMessage,
        clearMessage: clearMessage,
        showMode: showMode,
        routeSignedInUser: routeSignedInUser,
        getFirebase: getFirebase
    };

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeAuthPage
        );
    } else {
        initializeAuthPage();
    }

})();
