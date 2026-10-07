/* =====================================================
   mNEET-PRO
   STUDENT AUTHENTICATION
===================================================== */

"use strict";


/* =====================================================
   AUTH ERROR
===================================================== */

function formatAuthError(error){

    const code =
        error &&
        error.code
            ? error.code
            : "";

    const messages = {

        "auth/invalid-email":
            "Email address সঠিক নয়।",

        "auth/user-not-found":
            "এই email দিয়ে কোনো account পাওয়া যায়নি।",

        "auth/wrong-password":
            "Password ভুল হয়েছে।",

        "auth/invalid-credential":
            "Email অথবা password সঠিক নয়।",

        "auth/user-disabled":
            "এই account বর্তমানে disabled।",

        "auth/too-many-requests":
            "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।",

        "auth/network-request-failed":
            "Internet connection check করুন।",

        "auth/email-already-in-use":
            "এই email দিয়ে ইতিমধ্যে account আছে।",

        "auth/weak-password":
            "Password আরও শক্তিশালী দিন।"

    };

    return new Error(
        messages[code] ||
        (
            error &&
            error.message
        ) ||
        "Authentication error হয়েছে।"
    );

}


/* =====================================================
   LOGIN
===================================================== */

async function studentLogin(
    email,
    password
){

    try{

        const result =
            await auth.signInWithEmailAndPassword(
                email,
                password
            );

        return result.user;

    }catch(error){

        throw formatAuthError(
            error
        );

    }

}


/* =====================================================
   SIGNUP
===================================================== */

async function studentSignup(
    name,
    email,
    password
){

    try{

        const result =
            await auth.createUserWithEmailAndPassword(
                email,
                password
            );

        const user =
            result.user;


        await user.updateProfile({

            displayName:
                name

        });


        await db
            .collection("students")
            .doc(user.uid)
            .set({

                uid:
                    user.uid,

                name:
                    name,

                email:
                    email,

                targetDate:
                    "",

                targetDream:
                    "",

                selectedCourse:
                    "",

                progress:
                    0,

                lastScore:
                    null,

                accuracy:
                    0,

                streak:
                    0,

                createdAt:
                    firebase.firestore.FieldValue.serverTimestamp(),

                updatedAt:
                    firebase.firestore.FieldValue.serverTimestamp()

            },{
                merge:true
            });


        return user;

    }catch(error){

        throw formatAuthError(
            error
        );

    }

}


/* =====================================================
   PASSWORD RESET
===================================================== */

async function resetStudentPassword(
    email
){

    try{

        await auth.sendPasswordResetEmail(
            email
        );

    }catch(error){

        throw formatAuthError(
            error
        );

    }

}


/* =====================================================
   REDIRECT IF LOGGED IN
===================================================== */

function redirectIfLoggedIn(){

    auth.onAuthStateChanged(
        function(user){

            if(user){

                window.location.replace(
                    "dashboard.html"
                );

            }

        }
    );

}
