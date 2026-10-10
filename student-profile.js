/* =========================================================
   mNEET STUDENT PROFILE
   File: student-profile.js
   Location: Repository Root

   Features:
   1. View and edit student profile
   2. Update name, phone and target/exam information
   3. Upload profile photo using Firebase Storage
   4. Update Firebase Authentication display name
   5. Change password after current-password verification
   6. Send password-reset email
   7. Synchronize profile information with the sidebar

   Colour palette: Green + White only
========================================================= */

(function () {
  "use strict";

  const COLLECTIONS = {
    USERS: "users"
  };

  const STORAGE_FOLDER = "student-profiles";

  const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

  const state = {
    user: null,
    db: null,
    auth: null,
    storage: null,
    profile: {},
    loading: false,
    initialized: false,
    photoURL: "",
    elementsReady: false
  };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const escapeHTML = (value) => {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  function getFirebaseServices() {
    const firebaseApp = window.MNEETFirebase;

    if (
      !firebaseApp ||
      !firebaseApp.auth ||
      !firebaseApp.db
    ) {
      throw new Error(
        "Firebase চালু হয়নি। firebase.js এবং Firebase SDK পরীক্ষা করো।"
      );
    }

    state.auth = firebaseApp.auth;
    state.db = firebaseApp.db;

    if (
      window.firebase &&
      typeof window.firebase.storage === "function"
    ) {
      try {
        state.storage = window.firebase.storage();
      } catch (error) {
        state.storage = null;
      }
    }

    return true;
  }

  function getProfileContainer() {
    return (
      document.getElementById("studentPageProfile") ||
      document.getElementById("studentProfileContent") ||
      document.getElementById("studentProfileContainer")
    );
  }

  function getCurrentName() {
    return (
      state.profile.name ||
      state.user.displayName ||
      ""
    );
  }

  function getCurrentPhone() {
    return state.profile.phone || "";
  }

  function getCurrentTarget() {
    return (
      state.profile.target ||
      state.profile.examTarget ||
      state.profile.targetExam ||
      ""
    );
  }

  function getCurrentPhoto() {
    return (
      state.profile.photoURL ||
      state.profile.photoUrl ||
      state.user.photoURL ||
      ""
    );
  }

  function showMessage(message, type) {
    const text = String(message || "");

    if (
      window.MNEETStudent &&
      typeof window.MNEETStudent.showMessage === "function"
    ) {
      window.MNEETStudent.showMessage(text);

      const messageElement =
        document.getElementById("studentMessage");

      if (messageElement) {
        messageElement.dataset.type = type || "success";
      }

      return;
    }

    let box = document.getElementById(
      "studentProfileMessage"
    );

    if (!box) {
      const container = getProfileContainer();

      if (!container) {
        window.alert(text);
        return;
      }

      box = document.createElement("div");
      box.id = "studentProfileMessage";
      box.className = "student-profile-message";

      container.prepend(box);
    }

    box.textContent = text;
    box.dataset.type = type || "success";
    box.hidden = false;

    box.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  function clearMessage() {
    const box = document.getElementById(
      "studentProfileMessage"
    );

    if (box) {
      box.hidden = true;
      box.textContent = "";
    }
  }

  function setButtonLoading(button, loading, loadingText) {
    if (!button) return;

    if (loading) {
      button.dataset.originalText =
        button.textContent || "Save";

      button.disabled = true;
      button.textContent = loadingText || "Please wait...";
      button.setAttribute("aria-busy", "true");
    } else {
      button.disabled = false;

      if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
      }

      button.removeAttribute("aria-busy");
    }
  }

  function getInitials(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!parts.length) return "S";

    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  function renderProfile() {
    const container = getProfileContainer();

    if (!container) {
      console.warn(
        "mNEET Profile: student profile container পাওয়া যায়নি।"
      );
      return;
    }

    const name = getCurrentName();
    const email = state.user.email || "";
    const phone = getCurrentPhone();
    const target = getCurrentTarget();
    const photoURL = getCurrentPhoto();

    state.photoURL = photoURL;

    container.innerHTML = `
      <section class="student-profile">

        <header class="student-profile-header">
          <div>
            <h2>My Profile</h2>
            <p>
              View and update your mNEET student information.
            </p>
          </div>

          <div class="student-profile-badge">
            Student Account
          </div>
        </header>

        <div class="student-profile-card">

          <div class="student-profile-photo-area">

            <div class="student-profile-avatar"
                 id="studentProfileAvatar">

              ${
                photoURL
                  ? `
                    <img
                      id="studentProfilePhoto"
                      src="${escapeHTML(photoURL)}"
                      alt="Student profile photo"
                    >
                  `
                  : `
                    <span id="studentProfileInitial">
                      ${escapeHTML(getInitials(name))}
                    </span>
                  `
              }

            </div>

            <div class="student-profile-photo-details">
              <h3>${escapeHTML(name || "Student")}</h3>

              <p>${escapeHTML(email)}</p>

              <label
                for="studentProfilePhotoInput"
                class="student-profile-upload-button"
              >
                Upload Profile Photo
              </label>

              <input
                id="studentProfilePhotoInput"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
              >

              <p class="student-profile-help">
                JPG, PNG or WebP. Maximum size: 5 MB.
              </p>
            </div>

          </div>

          <form id="studentProfileForm"
                class="student-profile-form">

            <div class="student-profile-field">
              <label for="studentProfileName">
                Full Name
              </label>

              <input
                id="studentProfileName"
                name="name"
                type="text"
                maxlength="100"
                autocomplete="name"
                value="${escapeHTML(name)}"
                required
              >
            </div>

            <div class="student-profile-field">
              <label for="studentProfileEmail">
                Email Address
              </label>

              <input
                id="studentProfileEmail"
                name="email"
                type="email"
                value="${escapeHTML(email)}"
                readonly
                aria-describedby="studentProfileEmailHelp"
              >

              <small id="studentProfileEmailHelp">
                Email is connected to Firebase Authentication.
              </small>
            </div>

            <div class="student-profile-field">
              <label for="studentProfilePhone">
                Phone Number
              </label>

              <input
                id="studentProfilePhone"
                name="phone"
                type="tel"
                maxlength="20"
                autocomplete="tel"
                value="${escapeHTML(phone)}"
                placeholder="Enter your phone number"
                required
              >
            </div>

            <div class="student-profile-field">
              <label for="studentProfileTarget">
                Target / Exam Information
              </label>

              <input
                id="studentProfileTarget"
                name="target"
                type="text"
                maxlength="100"
                value="${escapeHTML(target)}"
                placeholder="Enter your exam target"
              >
            </div>

            <div class="student-profile-actions">
              <button
                type="submit"
                id="studentProfileSaveButton"
                class="student-profile-primary-button"
              >
                Save Profile
              </button>
            </div>

          </form>

        </div>

        <section class="student-profile-card
                        student-profile-security">

          <div class="student-profile-section-heading">
            <h3>Account Security</h3>

            <p>
              Change your password or receive a password
              reset link by email.
            </p>
          </div>

          <form id="studentChangePasswordForm"
                class="student-profile-form">

            <div class="student-profile-field">
              <label for="studentCurrentPassword">
                Current Password
              </label>

              <input
                id="studentCurrentPassword"
                name="currentPassword"
                type="password"
                autocomplete="current-password"
                minlength="6"
                required
              >
            </div>

            <div class="student-profile-field">
              <label for="studentNewPassword">
                New Password
              </label>

              <input
                id="studentNewPassword"
                name="newPassword"
                type="password"
                autocomplete="new-password"
                minlength="6"
                required
              >
            </div>

            <div class="student-profile-field">
              <label for="studentConfirmNewPassword">
                Confirm New Password
              </label>

              <input
                id="studentConfirmNewPassword"
                name="confirmNewPassword"
                type="password"
                autocomplete="new-password"
                minlength="6"
                required
              >
            </div>

            <div class="student-profile-actions">
              <button
                type="submit"
                id="studentChangePasswordButton"
                class="student-profile-primary-button"
              >
                Change Password
              </button>

              <button
                type="button"
                id="studentSendPasswordResetButton"
                class="student-profile-secondary-button"
              >
                Send Reset Email
              </button>
            </div>

          </form>

        </section>

      </section>
    `;

    addProfileStyles();
    bindProfileEvents();
    synchronizeSidebar();
  }

  function addProfileStyles() {
    if (document.getElementById("studentProfileStyles")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "studentProfileStyles";

    style.textContent = `
      .student-profile {
        width: 100%;
        max-width: 1000px;
        margin: 0 auto;
        color: #FFFFFF;
      }

      .student-profile-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 22px;
      }

      .student-profile-header h2 {
        margin: 0 0 8px;
        color: #FFFFFF;
        font-size: clamp(22px, 4vw, 30px);
      }

      .student-profile-header p,
      .student-profile-section-heading p {
        margin: 0;
        color: #D1D5DB;
        line-height: 1.6;
      }

      .student-profile-badge {
        border: 1px solid #28513A;
        background: #10291D;
        color: #FFFFFF;
        padding: 9px 13px;
        border-radius: 22px;
        font-size: 13px;
      }

      .student-profile-card {
        background: #0D2419;
        border: 1px solid #28513A;
        border-radius: 16px;
        padding: clamp(16px, 3vw, 26px);
        margin-bottom: 20px;
        box-sizing: border-box;
      }

      .student-profile-photo-area {
        display: flex;
        align-items: center;
        gap: 20px;
        flex-wrap: wrap;
        padding-bottom: 24px;
        margin-bottom: 24px;
        border-bottom: 1px solid #28513A;
      }

      .student-profile-avatar {
        width: 96px;
        height: 96px;
        flex: 0 0 96px;
        border-radius: 50%;
        overflow: hidden;
        background: #10291D;
        border: 2px solid #16A34A;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #FFFFFF;
        font-size: 30px;
        font-weight: 700;
      }

      .student-profile-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .student-profile-photo-details {
        min-width: 0;
      }

      .student-profile-photo-details h3 {
        margin: 0 0 7px;
        color: #FFFFFF;
        overflow-wrap: anywhere;
      }

      .student-profile-photo-details p {
        margin: 0 0 12px;
        color: #D1D5DB;
        overflow-wrap: anywhere;
      }

      .student-profile-upload-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 40px;
        padding: 9px 14px;
        border-radius: 9px;
        background: #16A34A;
        color: #FFFFFF;
        font-weight: 600;
        cursor: pointer;
        box-sizing: border-box;
      }

      .student-profile-upload-button:hover {
        background: #22C55E;
      }

      .student-profile-photo-details .student-profile-help {
        margin: 9px 0 0;
        font-size: 12px;
      }

      .student-profile-form {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
      }

      .student-profile-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
      }

      .student-profile-field label {
        color: #FFFFFF;
        font-size: 14px;
        font-weight: 600;
      }

      .student-profile-field input {
        width: 100%;
        min-height: 45px;
        padding: 11px 12px;
        box-sizing: border-box;
        border: 1px solid #28513A;
        border-radius: 9px;
        background: #10291D;
        color: #FFFFFF;
        font: inherit;
        outline: none;
      }

      .student-profile-field input:focus {
        border-color: #22C55E;
        box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.18);
      }

      .student-profile-field input[readonly] {
        opacity: 0.8;
        cursor: not-allowed;
      }

      .student-profile-field input::placeholder {
        color: #D1D5DB;
        opacity: 0.75;
      }

      .student-profile-field small {
        color: #D1D5DB;
        line-height: 1.5;
      }

      .student-profile-actions {
        grid-column: 1 / -1;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        margin-top: 4px;
      }

      .student-profile-primary-button,
      .student-profile-secondary-button {
        min-height: 44px;
        border-radius: 9px;
        padding: 11px 16px;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      .student-profile-primary-button {
        border: 1px solid #16A34A;
        background: #16A34A;
        color: #FFFFFF;
      }

      .student-profile-primary-button:hover {
        background: #22C55E;
      }

      .student-profile-secondary-button {
        border: 1px solid #28513A;
        background: #10291D;
        color: #FFFFFF;
      }

      .student-profile-secondary-button:hover {
        border-color: #22C55E;
      }

      .student-profile-primary-button:disabled,
      .student-profile-secondary-button:disabled {
        opacity: 0.65;
        cursor: wait;
      }

      .student-profile-section-heading {
        margin-bottom: 22px;
      }

      .student-profile-section-heading h3 {
        margin: 0 0 8px;
        color: #FFFFFF;
      }

      .student-profile-message {
        margin-bottom: 16px;
        padding: 13px 15px;
        border-radius: 10px;
        border: 1px solid #28513A;
        background: #0D2419;
        color: #FFFFFF;
        line-height: 1.6;
      }

      .student-profile-message[hidden] {
        display: none;
      }

      @media (max-width: 600px) {
        .student-profile-form {
          grid-template-columns: minmax(0, 1fr);
        }

        .student-profile-actions {
          flex-direction: column;
          align-items: stretch;
        }

        .student-profile-primary-button,
        .student-profile-secondary-button {
          width: 100%;
        }

        .student-profile-photo-area {
          align-items: flex-start;
        }

        .student-profile-avatar {
          width: 76px;
          height: 76px;
          flex-basis: 76px;
          font-size: 24px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function bindProfileEvents() {
    const profileForm = document.getElementById(
      "studentProfileForm"
    );

    const passwordForm = document.getElementById(
      "studentChangePasswordForm"
    );

    const photoInput = document.getElementById(
      "studentProfilePhotoInput"
    );

    const resetButton = document.getElementById(
      "studentSendPasswordResetButton"
    );

    if (profileForm) {
      profileForm.addEventListener("submit", saveProfile);
    }

    if (passwordForm) {
      passwordForm.addEventListener(
        "submit",
        changePassword
      );
    }

    if (photoInput) {
      photoInput.addEventListener(
        "change",
        uploadProfilePhoto
      );
    }

    if (resetButton) {
      resetButton.addEventListener(
        "click",
        sendPasswordReset
      );
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    clearMessage();

    if (!state.user || !state.db) {
      showMessage(
        "তোমার Session পাওয়া যায়নি। আবার Login করো।",
        "error"
      );
      return;
    }

    const nameInput = document.getElementById(
      "studentProfileName"
    );

    const phoneInput = document.getElementById(
      "studentProfilePhone"
    );

    const targetInput = document.getElementById(
      "studentProfileTarget"
    );

    const button = document.getElementById(
      "studentProfileSaveButton"
    );

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const target = targetInput.value.trim();

    if (name.length < 2) {
      showMessage(
        "Full Name অন্তত 2 অক্ষরের হতে হবে।",
        "error"
      );
      nameInput.focus();
      return;
    }

    if (phone.length < 7) {
      showMessage(
        "সঠিক Phone Number লিখো।",
        "error"
      );
      phoneInput.focus();
      return;
    }

    setButtonLoading(button, true, "Saving...");

    try {
      const profileRef = state.db
        .collection(COLLECTIONS.USERS)
        .doc(state.user.uid);

      const updateData = {
        name: name,
        phone: phone,
        target: target,
        updatedAt:
          window.firebase.firestore.FieldValue.serverTimestamp()
      };

      await profileRef.set(updateData, {
        merge: true
      });

      if (state.user.displayName !== name) {
        await state.user.updateProfile({
          displayName: name
        });
      }

      state.profile = {
        ...state.profile,
        ...updateData,
        name: name,
        phone: phone,
        target: target
      };

      synchronizeSidebar();

      const photoDetails = document.querySelector(
        ".student-profile-photo-details h3"
      );

      if (photoDetails) {
        photoDetails.textContent = name;
      }

      const initials = document.getElementById(
        "studentProfileInitial"
      );

      if (initials) {
        initials.textContent = getInitials(name);
      }

      showMessage(
        "তোমার Profile সফলভাবে Update হয়েছে।",
        "success"
      );

    } catch (error) {
      console.error(
        "mNEET Profile Save Error:",
        error
      );

      if (error.code === "permission-denied") {
        showMessage(
          "Firebase Rules Profile Update অনুমতি দিচ্ছে না। Firestore Rules পরীক্ষা করতে হবে।",
          "error"
        );
      } else {
        showMessage(
          getFriendlyError(error),
          "error"
        );
      }

    } finally {
      setButtonLoading(button, false);
    }
  }

  async function uploadProfilePhoto(event) {
    clearMessage();

    const input = event.target;
    const file = input.files && input.files[0];

    if (!file) return;

    if (!state.user) {
      showMessage(
        "প্রথমে Login করো।",
        "error"
      );
      input.value = "";
      return;
    }

    if (!state.storage) {
      showMessage(
        "Firebase Storage চালু নেই। firebase.js এবং student.html-এ Firebase Storage SDK যুক্ত আছে কি না পরীক্ষা করো।",
        "error"
      );
      input.value = "";
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
      showMessage(
        "শুধু JPG, PNG অথবা WebP ছবি Upload করা যাবে।",
        "error"
      );
      input.value = "";
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      showMessage(
        "ছবির Size 5 MB-এর মধ্যে রাখো।",
        "error"
      );
      input.value = "";
      return;
    }

    const avatar = document.getElementById(
      "studentProfileAvatar"
    );

    if (!avatar) {
      input.value = "";
      return;
    }

    const uploadLabel = document.querySelector(
      'label[for="studentProfilePhotoInput"]'
    );

    const originalLabel = uploadLabel
      ? uploadLabel.textContent
      : "";

    if (uploadLabel) {
      uploadLabel.textContent = "Uploading...";
      uploadLabel.style.pointerEvents = "none";
    }

    try {
      const extension =
        file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : "jpg";

      const filePath =
        STORAGE_FOLDER +
        "/" +
        state.user.uid +
        "/profile." +
        extension;

      const storageRef = state.storage.ref(filePath);

      const snapshot = await storageRef.put(file, {
        contentType: file.type,
        customMetadata: {
          ownerUid: state.user.uid
        }
      });

      const photoURL = await snapshot.ref.getDownloadURL();

      const profileRef = state.db
        .collection(COLLECTIONS.USERS)
        .doc(state.user.uid);

      await profileRef.set(
        {
          photoURL: photoURL,
          updatedAt:
            window.firebase.firestore.FieldValue.serverTimestamp()
        },
        {
          merge: true
        }
      );

      await state.user.updateProfile({
        photoURL: photoURL
      });

      state.profile.photoURL = photoURL;
      state.photoURL = photoURL;

      renderAvatar(photoURL);
      synchronizeSidebar();

      showMessage(
        "Profile Photo সফলভাবে Update হয়েছে।",
        "success"
      );

    } catch (error) {
      console.error(
        "mNEET Profile Photo Upload Error:",
        error
      );

      if (error.code === "storage/unauthorized") {
        showMessage(
          "Firebase Storage Rules ছবি Upload করতে অনুমতি দিচ্ছে না।",
          "error"
        );
      } else if (error.code === "permission-denied") {
        showMessage(
          "Firestore Rules Photo URL Save করতে অনুমতি দিচ্ছে না।",
          "error"
        );
      } else {
        showMessage(
          getFriendlyError(error),
          "error"
        );
      }

    } finally {
      if (uploadLabel) {
        uploadLabel.textContent = originalLabel;
        uploadLabel.style.pointerEvents = "";
      }

      input.value = "";
    }
  }

  function renderAvatar(photoURL) {
    const avatar = document.getElementById(
      "studentProfileAvatar"
    );

    if (!avatar) return;

    if (photoURL) {
      avatar.innerHTML = `
        <img
          id="studentProfilePhoto"
          src="${escapeHTML(photoURL)}"
          alt="Student profile photo"
        >
      `;
    } else {
      avatar.innerHTML = `
        <span id="studentProfileInitial">
          ${escapeHTML(getInitials(getCurrentName()))}
        </span>
      `;
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    clearMessage();

    if (!state.user || !state.auth) {
      showMessage(
        "তোমার Session পাওয়া যায়নি। আবার Login করো।",
        "error"
      );
      return;
    }

    const currentPassword = document.getElementById(
      "studentCurrentPassword"
    ).value;

    const newPassword = document.getElementById(
      "studentNewPassword"
    ).value;

    const confirmPassword = document.getElementById(
      "studentConfirmNewPassword"
    ).value;

    const button = document.getElementById(
      "studentChangePasswordButton"
    );

    if (!state.user.email) {
      showMessage(
        "এই Account-এর Email পাওয়া যায়নি।",
        "error"
      );
      return;
    }

    if (newPassword.length < 6) {
      showMessage(
        "নতুন Password অন্তত 6 অক্ষরের হতে হবে।",
        "error"
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage(
        "New Password এবং Confirm Password মিলছে না।",
        "error"
      );
      return;
    }

    if (currentPassword === newPassword) {
      showMessage(
        "নতুন Password-টি বর্তমান Password থেকে আলাদা হতে হবে।",
        "error"
      );
      return;
    }

    setButtonLoading(button, true, "Verifying...");

    try {
      const credential =
        window.firebase.auth.EmailAuthProvider.credential(
          state.user.email,
          currentPassword
        );

      await state.user.reauthenticateWithCredential(
        credential
      );

      await state.user.updatePassword(newPassword);

      const passwordForm = document.getElementById(
        "studentChangePasswordForm"
      );

      if (passwordForm) {
        passwordForm.reset();
      }

      showMessage(
        "Password সফলভাবে পরিবর্তন হয়েছে।",
        "success"
      );

    } catch (error) {
      console.error(
        "mNEET Password Change Error:",
        error
      );

      if (
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential" ||
        error.code === "auth/invalid-login-credentials"
      ) {
        showMessage(
          "বর্তমান Password সঠিক নয়। আবার পরীক্ষা করো।",
          "error"
        );
      } else if (
        error.code === "auth/requires-recent-login"
      ) {
        showMessage(
          "নিরাপত্তার জন্য আবার Login করে Password পরিবর্তন করো।",
          "error"
        );
      } else {
        showMessage(
          getFriendlyError(error),
          "error"
        );
      }

    } finally {
      setButtonLoading(button, false);
    }
  }

  async function sendPasswordReset() {
    clearMessage();

    if (!state.user || !state.user.email || !state.auth) {
      showMessage(
        "Password Reset-এর জন্য Email পাওয়া যায়নি।",
        "error"
      );
      return;
    }

    const button = document.getElementById(
      "studentSendPasswordResetButton"
    );

    setButtonLoading(button, true, "Sending...");

    try {
      await state.auth.sendPasswordResetEmail(
        state.user.email
      );

      showMessage(
        "Password Reset Link তোমার Email-এ পাঠানো হয়েছে। Inbox এবং Spam Folder পরীক্ষা করো।",
        "success"
      );

    } catch (error) {
      console.error(
        "mNEET Password Reset Error:",
        error
      );

      showMessage(
        getFriendlyError(error),
        "error"
      );

    } finally {
      setButtonLoading(button, false);
    }
  }

  function synchronizeSidebar() {
    const name = getCurrentName();
    const phone = getCurrentPhone();
    const photoURL = getCurrentPhoto();
    const email = state.user
      ? state.user.email || ""
      : "";

    const nameIds = [
      "studentSidebarName",
      "studentTopbarName",
      "studentWelcomeName"
    ];

    nameIds.forEach((id) => {
      const element = document.getElementById(id);

      if (element && name) {
        element.textContent = name;
      }
    });

    const emailIds = [
      "studentSidebarEmail"
    ];

    emailIds.forEach((id) => {
      const element = document.getElementById(id);

      if (element) {
        element.textContent = email;
      }
    });

    const phoneIds = [
      "studentSidebarPhone"
    ];

    phoneIds.forEach((id) => {
      const element = document.getElementById(id);

      if (element) {
        element.textContent = phone;
      }
    });

    const initialIds = [
      "studentSidebarInitial",
      "studentTopbarInitial"
    ];

    initialIds.forEach((id) => {
      const element = document.getElementById(id);

      if (element) {
        element.textContent = getInitials(name);
      }
    });

    const sidebarPhoto = document.getElementById(
      "studentSidebarPhoto"
    );

    if (sidebarPhoto) {
      if (photoURL) {
        sidebarPhoto.src = photoURL;
        sidebarPhoto.hidden = false;
        sidebarPhoto.alt = "Student profile photo";
      } else {
        sidebarPhoto.removeAttribute("src");
        sidebarPhoto.hidden = true;
      }
    }

    const sidebarPhone = document.getElementById(
      "studentSidebarPhone"
    );

    if (sidebarPhone && !phone) {
      sidebarPhone.textContent = "";
    }
  }

  async function loadProfile() {
    if (!state.user || !state.db) {
      throw new Error(
        "Student Login Session পাওয়া যায়নি।"
      );
    }

    const snapshot = await state.db
      .collection(COLLECTIONS.USERS)
      .doc(state.user.uid)
      .get();

    state.profile = snapshot.exists
      ? snapshot.data() || {}
      : {};

    state.photoURL = getCurrentPhoto();

    renderProfile();

    return state.profile;
  }

  function getFriendlyError(error) {
    if (!error) {
      return "একটি সমস্যা হয়েছে। আবার চেষ্টা করো।";
    }

    const messages = {
      "auth/weak-password":
        "Password আরও শক্তিশালী করো।",

      "auth/too-many-requests":
        "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করো।",

      "auth/network-request-failed":
        "Internet Connection পরীক্ষা করো।",

      "auth/user-token-expired":
        "তোমার Session শেষ হয়েছে। আবার Login করো।",

      "storage/unauthorized":
        "Firebase Storage Rules অনুমতি দিচ্ছে না।",

      "permission-denied":
        "Firebase Security Rules এই কাজের অনুমতি দিচ্ছে না।"
    };

    return (
      messages[error.code] ||
      error.message ||
      "একটি সমস্যা হয়েছে। আবার চেষ্টা করো।"
    );
  }

  async function initialize() {
    if (state.initialized) return;

    try {
      getFirebaseServices();

      const user = state.auth.currentUser;

      if (!user) {
        return;
      }

      state.user = user;

      await loadProfile();

      state.initialized = true;

    } catch (error) {
      console.error(
        "mNEET Student Profile Initialization Error:",
        error
      );

      showMessage(
        getFriendlyError(error),
        "error"
      );
    }
  }

  function refresh() {
    state.initialized = false;

    return initialize();
  }

  function bindAuthListener() {
    try {
      getFirebaseServices();

      state.auth.onAuthStateChanged(async (user) => {
        state.user = user || null;
        state.initialized = false;

        if (!user) {
          return;
        }

        try {
          await loadProfile();
          state.initialized = true;
        } catch (error) {
          console.error(
            "mNEET Profile Reload Error:",
            error
          );
        }
      });

    } catch (error) {
      console.error(
        "mNEET Profile Auth Listener Error:",
        error
      );
    }
  }

  window.MNEETStudentProfile = {
    initialize,
    refresh,
    loadProfile,
    renderProfile,
    synchronizeSidebar,

    getProfile: function () {
      return { ...state.profile };
    },

    getUser: function () {
      return state.user;
    }
  };

  function start() {
    if (state.elementsReady) return;

    state.elementsReady = true;

    try {
      getFirebaseServices();
      bindAuthListener();
    } catch (error) {
      console.warn(
        "mNEET Student Profile অপেক্ষা করছে Firebase-এর জন্য।"
      );
    }

    document.addEventListener(
      "mneet:student-ready",
      function () {
        initialize();
      }
    );

    document.addEventListener(
      "mneet:student-page-change",
      function (event) {
        const detail = event.detail || {};
        const page = String(
          detail.page || detail.pageName || ""
        ).toLowerCase();

        if (
          page === "profile" ||
          page === "studentpageprofile"
        ) {
          initialize();
        }
      }
    );

    if (document.readyState !== "loading") {
      initialize();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      { once: true }
    );
  } else {
    start();
  }

})();
