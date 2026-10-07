// ==========================================================
// mNEET-Pro
// STUDENT WEBSITE
// FIREBASE INITIALIZATION
// ==========================================================

"use strict";


// ==========================================================
// FIREBASE CONFIGURATION
// ==========================================================

const firebaseConfig = {

    apiKey:
        "AIzaSyApQOM_mtFZ16RiNJEaIUhb4iYFBIBRK58",

    authDomain:
        "mneet-spark.firebaseapp.com",

    databaseURL:
        "https://mneet-spark-default-rtdb.firebaseio.com",

    projectId:
        "mneet-spark",

    storageBucket:
        "mneet-spark.firebasestorage.app",

    messagingSenderId:
        "252201633700",

    appId:
        "1:252201633700:web:1a1e7a2cff1f0b168ea331"

};


// ==========================================================
// FIREBASE INITIALIZATION
// ==========================================================

if (
    typeof firebase === "undefined"
) {

    console.error(
        "Firebase SDK পাওয়া যায়নি।"
    );

} else {

    if (
        !firebase.apps ||
        firebase.apps.length === 0
    ) {

        firebase.initializeApp(
            firebaseConfig
        );

    }

}


// ==========================================================
// FIREBASE AUTH
// ==========================================================

let auth = null;

if (
    typeof firebase !== "undefined" &&
    typeof firebase.auth === "function"
) {

    auth =
        firebase.auth();

}


// ==========================================================
// FIRESTORE
// ==========================================================

let db = null;

if (
    typeof firebase !== "undefined" &&
    typeof firebase.firestore === "function"
) {

    db =
        firebase.firestore();

}


// ==========================================================
// FIREBASE STORAGE
// ==========================================================

let storage = null;

if (
    typeof firebase !== "undefined" &&
    typeof firebase.storage === "function"
) {

    storage =
        firebase.storage();

}


// ==========================================================
// REALTIME DATABASE
// ==========================================================

let realtimeDB = null;

if (
    typeof firebase !== "undefined" &&
    typeof firebase.database === "function"
) {

    realtimeDB =
        firebase.database();

}


// ==========================================================
// FIREBASE STATUS
// ==========================================================

function isFirebaseReady() {

    return (
        typeof firebase !== "undefined" &&
        firebase.apps &&
        firebase.apps.length > 0
    );

}


// ==========================================================
// AUTH STATUS
// ==========================================================

function isAuthReady() {

    return (
        isFirebaseReady() &&
        auth !== null
    );

}


// ==========================================================
// FIRESTORE STATUS
// ==========================================================

function isFirestoreReady() {

    return (
        isFirebaseReady() &&
        db !== null
    );

}


// ==========================================================
// STORAGE STATUS
// ==========================================================

function isStorageReady() {

    return (
        isFirebaseReady() &&
        storage !== null
    );

}


// ==========================================================
// FIREBASE ERROR LOGGER
// ==========================================================

function firebaseError(
    error,
    location
) {

    console.error(
        "Firebase Error:",
        location || "Unknown",
        error
    );

}


// ==========================================================
// STARTUP CHECK
// ==========================================================

if (
    typeof firebase !== "undefined"
) {

    console.log(
        "mNEET-Pro Firebase initialized."
    );

    console.log(
        "Project:",
        firebaseConfig.projectId
    );

} else {

    console.error(
        "mNEET-Pro: Firebase SDK load হয়নি।"
    );

}
