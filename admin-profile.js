/* ==========================================
   mNEET ADMIN PANEL
   File: admin-profile.js
   Admin Profile Management
========================================== */

(function () {
  "use strict";

  window.MNEETAdmin = window.MNEETAdmin || {};

  const Admin = window.MNEETAdmin;

  if (Admin.profileModuleLoaded) return;
  Admin.profileModuleLoaded = true;

  let profileInitialized = false;
  let profileLoading = false;

  /* ==========================================
     HELPERS
  ========================================== */

  function getAuth() {
    if (typeof firebase === "undefined") return null;

    return firebase.auth();
  }

  function getDB() {
    if (typeof firebase === "undefined") return null;

    return firebase.firestore();
  }

  function getCurrentUser() {
    const auth = getAuth();

    return auth ? auth.currentUser : null;
  }

  function showMessage(message, type = "info") {
    if (typeof Admin.showMessage === "function") {
      Admin.showMessage(message, type);
    } else {
      alert(message);
    }
  }

  function getElement(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const element = getElement(id);

    if (element) {
      element.textContent = value || "";
    }
  }

  /* ==========================================
     GET PROFILE CONTAINER
  ========================================== */

  function getProfileContainer() {
    return getElement("profileModule");
  }

  /* ==========================================
     CREATE PROFILE UI
  ========================================== */

  function createProfileUI() {
    const container = getProfileContainer();

    if (!container) return null;

    let card = getElement("adminProfileCard");

    if (card) return card;

    card = document.createElement("div");
    card.id = "adminProfileCard";
    card.className = "module-card";

    card.innerHTML = `
      <div class="module-header">
        <div>
          <h2>Admin Profile</h2>
          <p>Manage your administrator account.</p>
        </div>
      </div>

      <form id="adminProfileForm" class="admin-form">

        <div class="form-group">
          <label for="profileFullName">Full Name</label>
          <input
            type="text"
            id="profileFullName"
            name="fullName"
            placeholder="Enter your full name"
            maxlength="100"
            required
          >
        </div>

        <div class="form-group">
          <label for="profileEmail">Email Address</label>
          <input
            type="email"
            id="profileEmail"
            name="email"
            readonly
          >
          <small>Email is managed by Firebase Authentication.</small>
        </div>

        <div class="form-group">
          <label for="profileUid">Admin UID</label>
          <input
            type="text"
            id="profileUid"
            name="uid"
            readonly
          >
        </div>

        <div class="form-actions">
          <button
            type="submit"
            class="btn btn-primary"
            id="saveAdminProfileButton"
          >
            Save Profile
          </button>
        </div>

      </form>

      <hr>

      <div class="module-header">
        <div>
          <h3>Change Password</h3>
          <p>
            A password reset email will be sent to your
            registered email address.
          </p>
        </div>
      </div>

      <form id="adminPasswordResetForm" class="admin-form">

        <div class="form-group">
          <label for="passwordResetEmail">Registered Email</label>
          <input
            type="email"
            id="passwordResetEmail"
            readonly
          >
        </div>

        <div class="form-actions">
          <button
            type="submit"
            class="btn btn-secondary"
            id="sendPasswordResetButton"
          >
            Send Password Reset Email
          </button>
        </div>

      </form>
    `;

    container.appendChild(card);

    return card;
  }

  /* ==========================================
     LOAD ADMIN PROFILE
  ========================================== */

  async function loadProfile() {
    if (profileLoading) return;

    profileLoading = true;

    try {
      const user = getCurrentUser();
      const db = getDB();

      if (!user || !db) {
        showMessage(
          "Firebase connection বা Admin login পাওয়া যায়নি।",
          "error"
        );
        return;
      }

      const adminRef = db.collection("admins").doc(user.uid);
      const snapshot = await adminRef.get();

      if (!snapshot.exists) {
        showMessage(
          "Admin profile পাওয়া যায়নি।",
          "error"
        );
        return;
      }

      const data = snapshot.data();

      if (!data || data.active !== true) {
        showMessage(
          "এই অ্যাকাউন্টের Admin অনুমতি নেই।",
          "error"
        );

        return;
      }

      const name =
        data.name ||
        user.displayName ||
        "";

      setText("sidebarAdminName", name);

      const nameInput = getElement("profileFullName");
      const emailInput = getElement("profileEmail");
      const uidInput = getElement("profileUid");
      const resetEmail = getElement("passwordResetEmail");

      if (nameInput) nameInput.value = name;
      if (emailInput) emailInput.value = user.email || "";
      if (uidInput) uidInput.value = user.uid;

      if (resetEmail) {
        resetEmail.value = user.email || "";
      }

    } catch (error) {
      console.error("Profile loading failed:", error);

      showMessage(
        "Admin profile লোড করা যায়নি। Firebase Rules পরীক্ষা করো।",
        "error"
      );

    } finally {
      profileLoading = false;
    }
  }

  /* ==========================================
     SAVE ADMIN NAME
  ========================================== */

  async function saveProfile(event) {
    event.preventDefault();

    const user = getCurrentUser();
    const db = getDB();

    const nameInput = getElement("profileFullName");
    const saveButton = getElement("saveAdminProfileButton");

    if (!user || !db || !nameInput) {
      showMessage(
        "Admin account পাওয়া যায়নি। আবার login করো।",
        "error"
      );
      return;
    }

    const newName = nameInput.value.trim();

    if (newName.length < 2) {
      showMessage(
        "নাম কমপক্ষে ২ অক্ষরের হতে হবে।",
        "warning"
      );
      return;
    }

    if (newName.length > 100) {
      showMessage(
        "নাম ১০০ অক্ষরের বেশি হতে পারবে না।",
        "warning"
      );
      return;
    }

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "Saving...";
    }

    try {
      const adminRef = db.collection("admins").doc(user.uid);

      const snapshot = await adminRef.get();

      if (!snapshot.exists || snapshot.data().active !== true) {
        throw new Error("ADMIN_ACCESS_DENIED");
      }

      /*
       * Save only the name field.
       * The active permission field is not changed.
       */
      await adminRef.update({
        name: newName
      });

      /*
       * Update Firebase Auth display name.
       */
      await user.updateProfile({
        displayName: newName
      });

      const currentAdmin =
        typeof Admin.getCurrentAdmin === "function"
          ? Admin.getCurrentAdmin()
          : null;

      if (currentAdmin) {
        currentAdmin.name = newName;
      }

      setText("sidebarAdminName", newName);
      setText("dashboardWelcome", "Welcome, " + newName);

      const avatar = getElement("sidebarAvatar");

      if (avatar) {
        avatar.textContent =
          newName.charAt(0).toUpperCase();
      }

      showMessage(
        "Admin profile সফলভাবে আপডেট হয়েছে।",
        "success"
      );

    } catch (error) {
      console.error("Profile save failed:", error);

      if (error.message === "ADMIN_ACCESS_DENIED") {
        showMessage(
          "Admin অনুমতি যাচাই করা যায়নি।",
          "error"
        );
      } else {
        showMessage(
          "Profile Save করা যায়নি। Firestore Rules পরীক্ষা করো।",
          "error"
        );
      }

    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "Save Profile";
      }
    }
  }

  /* ==========================================
     SEND PASSWORD RESET EMAIL
  ========================================== */

  async function sendPasswordReset(event) {
    event.preventDefault();

    const user = getCurrentUser();
    const auth = getAuth();
    const button = getElement("sendPasswordResetButton");

    if (!user || !auth || !user.email) {
      showMessage(
        "Firebase account-এর email পাওয়া যায়নি।",
        "error"
      );
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "Sending...";
    }

    try {
      await auth.sendPasswordResetEmail(user.email);

      showMessage(
        "Password reset email পাঠানো হয়েছে। Inbox ও Spam folder পরীক্ষা করো।",
        "success"
      );

    } catch (error) {
      console.error("Password reset failed:", error);

      showMessage(
        "Reset email পাঠানো যায়নি। Firebase Authentication settings পরীক্ষা করো।",
        "error"
      );

    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Send Password Reset Email";
      }
    }
  }

  /* ==========================================
     REGISTER EVENTS
  ========================================== */

  function registerEvents() {
    if (profileInitialized) return;

    const profileForm = getElement("adminProfileForm");
    const passwordForm = getElement("adminPasswordResetForm");

    if (profileForm) {
      profileForm.addEventListener(
        "submit",
        saveProfile
      );
    }

    if (passwordForm) {
      passwordForm.addEventListener(
        "submit",
        sendPasswordReset
      );
    }

    profileInitialized = true;
  }

  /* ==========================================
     INITIALIZE PROFILE MODULE
  ========================================== */

  async function init() {
    const card = createProfileUI();

    if (!card) return;

    registerEvents();

    await loadProfile();
  }

  /* ==========================================
     REGISTER MODULE
  ========================================== */

  Admin.modules = Admin.modules || {};

  Admin.modules.profile = {
    init: init,
    render: init,
    load: loadProfile
  };

})();
