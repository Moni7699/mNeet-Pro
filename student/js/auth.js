=====================================
"use strict";

async function studentLogin(email, password) {
    try {
        const result = await auth.signInWithEmailAndPassword(
            String(email || "").trim(), String(password || "")
        );
        return result.user;
    } catch (e) {
        throw formatAuthError(e);
    }
}

async function studentSignup(name, email, password) {
    name = String(name || "").trim();
    email = String(email || "").trim();
    password = String(password || "");

    if (!name) throw new Error("Name দিন।");
    if (!email) throw new Error("Email দিন।");
    if (password.length < 6) throw new Error("Password কমপক্ষে 6 characters দিন।");

    try {
        const result = await auth.createUserWithEmailAndPassword(email, password);
        const user = result.user;
        await user.updateProfile({displayName:name});
        await db.collection("students").doc(user.uid).set({
            uid:user.uid, name, email,
            targetDate:"", targetDream:"",
            selectedCourse:"", progress:0,
            lastScore:null, accuracy:0, streak:0,
            createdAt:firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt:firebase.firestore.FieldValue.serverTimestamp()
        }, {merge:true});
        return user;
    } catch (e) {
        throw formatAuthError(e);
    }
}

async function resetStudentPassword(email) {
    try {
        await auth.sendPasswordResetEmail(String(email || "").trim());
    } catch (e) {
        throw formatAuthError(e);
    }
}

async function studentLogout() {
    try {
        await auth.signOut();
        ["activeCourse","activeChapter","activeTopic","activeQuiz","quizState"].forEach(removeLocal);
        window.location.replace("index.html");
    } catch (e) {
        alert("Logout করা যায়নি। আবার চেষ্টা করুন।");
    }
}
