

IMPORTANT SETUP NOTES
- This is a separate panel folder. Keep the folder name when uploading it to the matching repository path.
- Firebase project config is in js/firebase.js. Confirm it matches your own Firebase project.
- Enable Firebase Authentication (Email/Password), Firestore and Storage if the panel uses uploads.
- Create and test Firestore Security Rules before using real student payments or private course content. Never unlock a course only because a student submitted a transaction reference.
- Test all workflows in your own Firebase project before publishing; this source has not been connected to or end-to-end tested against your live database here.
