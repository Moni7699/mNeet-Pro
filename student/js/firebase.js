/* =====================================================
   mNEET-PRO
   FIREBASE INITIALIZATION
===================================================== */

"use strict";

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


/* =====================================================
   INITIALIZE
===================================================== */

if(
    typeof firebase !== "undefined" &&
    !firebase.apps.length
){

    firebase.initializeApp(
        firebaseConfig
    );

}


/* =====================================================
   SERVICES
===================================================== */

const auth =
    firebase.auth();

const db =
    firebase.firestore();


/* =====================================================
   OPTIONAL SERVICES
===================================================== */

let realtimeDB = null;
let storage = null;

if(
    typeof firebase.database === "function"
){

    realtimeDB =
        firebase.database();

}

if(
    typeof firebase.storage === "function"
){

    storage =
        firebase.storage();

}
