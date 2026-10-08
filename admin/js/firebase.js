"use strict";
if(typeof firebase === "undefined") throw new Error("Firebase SDK did not load.");
const firebaseConfig = window.MBIO_FIREBASE_CONFIG;
if(!firebaseConfig || !firebaseConfig.projectId) throw new Error("Firebase configuration is missing.");
if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
window.auth = firebase.auth();
window.db = firebase.firestore();
window.storage = typeof firebase.storage === "function" ? firebase.storage() : null;
window.FIREBASE_PROJECT_ID = firebaseConfig.projectId;
