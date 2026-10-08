mNEET-Pro Admin Panel — Firebase Setup

1) Upload the whole admin/ folder to your web host (or copy it into mNEET-Pro/admin/).
2) The supplied frontend config currently points to the Firebase project:
   mneet-spark
   If your real mBio World Firebase project is different, edit:
   admin/js/firebase-config.js
   using Firebase Console > Project settings > Your apps > Web app > SDK setup.

3) Firebase Authentication:
   - Enable Email/Password.
   - Create the admin user in Authentication.
   - Copy that user's UID.
   - Create Firestore document: admins/{UID}
     { active: true }
   The login will then allow that account into the Admin Panel.

4) Firestore structure used by this panel:
   courses/{courseId}
     chapters/{chapterId}
       topics/{topicId}
         quizzes/{quizId}
           questions/{questionId}
         notes/{noteId}
       ncert/{pdfId}       <-- chapter-level
       pyq/{pdfId}         <-- chapter-level
   students/{uid}
   purchases/{uid}        <-- fields such as { courseId: true }
   notifications/{id}
   settings/app
   admins/{uid}

5) Storage is optional if you use direct PDF/image URLs. File upload requires Firebase Storage to be enabled.
   Some Firebase projects require billing/Blaze for Storage. If Storage is unavailable, the URL fields still work.

6) firestore.rules and storage.rules are included as a starting security baseline. IMPORTANT:
   If the student app already has production Firestore rules, merge these admin conditions with those rules instead of blindly replacing them.

7) This package was syntax-checked with Node.js. Browser/Firebase runtime testing still requires your actual Firebase project because this environment cannot sign into your Firebase account.
