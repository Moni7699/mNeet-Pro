/* =========================================================
   STUDENT AUTHENTICATION
========================================================= */

"use strict";

async function studentLogin(email, password) {

    try {

        const result =
            await auth.signInWithEmailAndPassword(
                email,
                password
            );

        return result.user;

    } catch (error) {

        throw formatAuthError(error);

    }

}


async function studentLogout() {

    await auth.signOut();

}


function redirectIfLoggedIn() {

    auth.onAuthStateChanged(function(user) {

        if (user) {

            const page =
                window.location.pathname
                    .split("/")
                    .pop();

            if (
                page === "" ||
                page === "index.html"
            ) {

                window.location.replace(
                    "dashboard.html"
                );

            }

        }

    });

}


function formatAuthError(error) {

    let message =
        "Login করা যায়নি। আবার চেষ্টা করুন।";

    if (!error) {
        return new Error(message);
    }

    switch (error.code) {

        case "auth/invalid-email":
            message =
                "Email address সঠিক নয়।";
            break;

        case "auth/user-disabled":
            message =
                "এই account disabled করা হয়েছে।";
            break;

        case "auth/user-not-found":
            message =
                "এই email দিয়ে কোনো account পাওয়া যায়নি।";
            break;

        case "auth/wrong-password":
            message =
                "Password সঠিক নয়।";
            break;

        case "auth/invalid-credential":
            message =
                "Email অথবা password সঠিক নয়।";
            break;

        case "auth/too-many-requests":
            message =
                "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
            break;

        case "auth/network-request-failed":
            message =
                "Internet connection check করুন।";
            break;

        default:
            message =
                error.message ||
                message;

    }

    return new Error(message);
}
