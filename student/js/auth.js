"use strict";

// ==========================================================
// mNEET-Pro
// STUDENT AUTHENTICATION SYSTEM
// Login • Signup • Logout • Session Protection
// ==========================================================


// ==========================================================
// AUTH STATE
// ==========================================================

let currentStudent = null;


// ==========================================================
// WAIT FOR FIREBASE
// ==========================================================

function waitForAuth() {

    if (
        typeof firebase === "undefined" ||
        typeof firebase.auth !== "function"
    ) {

        setTimeout(
            waitForAuth,
            300
        );

        return;
    }


    if (
        typeof auth === "undefined" ||
        !auth
    ) {

        setTimeout(
            waitForAuth,
            300
        );

        return;
    }


    startAuthListener();

}


// ==========================================================
// AUTH LISTENER
// ==========================================================

function startAuthListener() {

    auth.onAuthStateChanged(
        function (user) {

            currentStudent = user || null;

            window.dispatchEvent(
                new CustomEvent(
                    "mneetAuthReady",
                    {
                        detail: {
                            user: user || null
                        }
                    }
                )
            );

        }
    );

}


// ==========================================================
// LOGIN
// ==========================================================

async function studentLogin(
    email,
    password
) {

    email =
        String(email || "")
            .trim();

    password =
        String(password || "");


    if (!email) {

        throw new Error(
            "Email address দিন।"
        );

    }


    if (!password) {

        throw new Error(
            "Password দিন।"
        );

    }


    try {

        const result =
            await auth.signInWithEmailAndPassword(
                email,
                password
            );


        currentStudent =
            result.user;


        return result.user;

    } catch (error) {

        throw formatAuthError(
            error
        );

    }

}


// ==========================================================
// SIGN UP
// ==========================================================

async function studentSignup(
    name,
    email,
    password
) {

    name =
        String(name || "")
            .trim();

    email =
        String(email || "")
            .trim();

    password =
        String(password || "");


    if (!name) {

        throw new Error(
            "আপনার নাম দিন।"
        );

    }


    if (!email) {

        throw new Error(
            "Email address দিন।"
        );

    }


    if (password.length < 6) {

        throw new Error(
            "Password কমপক্ষে 6 characters হতে হবে।"
        );

    }


    try {

        const result =
            await auth.createUserWithEmailAndPassword(
                email,
                password
            );


        currentStudent =
            result.user;


        // --------------------------------------------------
        // CREATE STUDENT PROFILE
        // --------------------------------------------------

        if (
            typeof db !== "undefined" &&
            db &&
            result.user
        ) {

            await db
                .collection("users")
                .doc(result.user.uid)
                .set(
                    {
                        name:
                            name,

                        email:
                            email,

                        role:
                            "student",

                        status:
                            "active",

                        createdAt:
                            firebase.firestore.FieldValue.serverTimestamp(),

                        updatedAt:
                            firebase.firestore.FieldValue.serverTimestamp()
                    },
                    {
                        merge:
                            true
                    }
                );

            }


        return result.user;

    } catch (error) {

        throw formatAuthError(
            error
        );

    }

}


// ==========================================================
// LOGOUT
// ==========================================================

async function studentLogout() {

    if (
        typeof auth === "undefined" ||
        !auth
    ) {

        return;

    }


    try {

        await auth.signOut();

        currentStudent =
            null;

        window.location.href =
            "index.html";

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

        alert(
            "Logout করা যায়নি। আবার চেষ্টা করুন।"
        );

    }

}


// ==========================================================
// GET CURRENT STUDENT
// ==========================================================

function getCurrentStudent() {

    if (
        typeof auth !== "undefined" &&
        auth &&
        auth.currentUser
    ) {

        return auth.currentUser;

    }


    return currentStudent;

}


// ==========================================================
// REQUIRE LOGIN
// ==========================================================

function requireStudentLogin() {

    if (
        typeof auth === "undefined" ||
        !auth
    ) {

        setTimeout(
            requireStudentLogin,
            300
        );

        return;

    }


    const unsubscribe =
        auth.onAuthStateChanged(
            function (user) {

                unsubscribe();

                if (!user) {

                    window.location.href =
                        "index.html";

                    return;

                }


                currentStudent =
                    user;

            }
        );

}


// ==========================================================
// REDIRECT IF ALREADY LOGGED IN
// ==========================================================

function redirectIfLoggedIn() {

    if (
        typeof auth === "undefined" ||
        !auth
    ) {

        setTimeout(
            redirectIfLoggedIn,
            300
        );

        return;

    }


    const unsubscribe =
        auth.onAuthStateChanged(
            function (user) {

                unsubscribe();

                if (!user) {

                    return;

                }


                const page =
                    window.location.pathname
                        .split("/")
                        .pop()
                        .toLowerCase();


                if (
                    page === "index.html" ||
                    page === ""
                ) {

                    window.location.href =
                        "dashboard.html";

                }

            }
        );

}


// ==========================================================
// AUTH ERROR HANDLER
// ==========================================================

function formatAuthError(
    error
) {

    if (!error) {

        return new Error(
            "Unknown authentication error."
        );

    }


    switch (
        error.code
    ) {

        case "auth/invalid-email":

            return new Error(
                "Email address সঠিক নয়।"
            );


        case "auth/user-not-found":

            return new Error(
                "এই email দিয়ে কোনো account পাওয়া যায়নি।"
            );


        case "auth/wrong-password":

            return new Error(
                "Password সঠিক নয়।"
            );


        case "auth/invalid-credential":

            return new Error(
                "Email অথবা password সঠিক নয়।"
            );


        case "auth/email-already-in-use":

            return new Error(
                "এই email দিয়ে ইতিমধ্যে account আছে।"
            );


        case "auth/weak-password":

            return new Error(
                "Password আরও শক্তিশালী দিন।"
            );


        case "auth/too-many-requests":

            return new Error(
                "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।"
            );


        case "auth/network-request-failed":

            return new Error(
                "Internet connection সমস্যা হয়েছে।"
            );


        case "auth/user-disabled":

            return new Error(
                "এই account বর্তমানে disabled।"
            );


        default:

            return new Error(
                error.message ||
                "Authentication failed."
            );

    }

}


// ==========================================================
// AUTO START
// ==========================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        waitForAuth();

    }
);
