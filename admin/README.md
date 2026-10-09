# mNEET-Pro Admin Panel

Green-themed, mobile-friendly Admin Panel for mNEET-Pro.

## 1. Folder Structure

admin/
├── index.html
├── css/
│   └── admin.css
├── js/
│   ├── firebase.js
│   └── app.js
├── assets/
│   └── avatar.svg
├── firestore.rules
├── storage.rules
├── README.md
└── .nojekyll

## 2. Firebase Requirements

Firebase project:
- Project ID: mneet-spark
- Authentication: Email/Password
- Database: Cloud Firestore
- File uploads: Firebase Storage

Configure Firebase Authentication in the Firebase Console.

Create the required Firestore collections and configure
security rules before using the panel.

## 3. Admin Account

The panel checks the following Firestore document:

users/{adminUid}

Required fields:

- role: "admin"
- status: "active"

Only an authorized administrator should receive this role.

Do not allow public signup to create administrator accounts.

## 4. GitHub Pages

1. Open the GitHub repository.
2. Open Settings.
3. Select Pages.
4. Choose the main branch.
5. Select the root directory.
6. Save the settings.

After GitHub Pages finishes deploying, open:

https://moni7699.github.io/mNeet-Pro/admin/

## 5. Important Security Notes

- Never publish private service-account keys.
- Firebase client configuration is not a substitute for security rules.
- Publish Firestore rules through the Firebase Console.
- Publish Storage rules through the Firebase Console.
- Test all rules before allowing real students to use the app.
- Keep payment approval restricted to authorized administrators.

## 6. Current Implementation Status

The current app.js provides:

- Email/password sign-in
- Signup form
- Password reset
- Admin role verification
- Profile information display
- Sidebar navigation
- Dark/light mode
- Basic dashboard counts
- Logout

Course management, chapter/topic management, quiz editing,
PDF uploads, payment approvals, student management,
notifications, and detailed result reports still require
their respective implementations.

This README describes the current starter implementation.
It does not claim that every planned Admin Panel feature
is already functional.
