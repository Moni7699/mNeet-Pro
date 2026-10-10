(function () {
  "use strict";

  if (window.MNEETAdminProfile) return;

  const Profile = {
    initialized: false,
    currentUser: null,
    adminData: null,
    db: null,
    auth: null,
    saving: false
  };

  window.MNEETAdminProfile = Profile;

  const $ = (id) => document.getElementById(id);

  const elements = {
    sidebarAvatar: $("sidebarAvatar"),
    sidebarAvatarInitial: $("sidebarAvatarInitial"),
    sidebarAdminName: $("sidebarAdminName"),
    sidebarAdminEmail: $("sidebarAdminEmail"),
    sidebarAdminPhone: $("sidebarAdminPhone"),
    profileContent: $("profileContent")
  };

  function showMessage(message, type) {
    if (
      window.MNEETAdmin &&
      typeof window.MNEETAdmin.showMessage === "function"
    ) {
      window.MNEETAdmin.showMessage(message, type || "warning");
      return;
    }

    const messageElement = $("adminMessage");

    if (messageElement) {
      messageElement.textContent = message;
      messageElement.className =
        "admin-message show " + (type || "warning");
      messageElement.setAttribute("role", "status");
    }
  }

  function getFirebaseServices() {
    const firebaseWrapper = window.MNEETFirebase;

    if (firebaseWrapper && firebaseWrapper.ready) {
      Profile.auth = firebaseWrapper.auth;
      Profile.db = firebaseWrapper.db;
      return true;
    }

    if (
      window.firebase &&
      typeof window.firebase.auth === "function" &&
      typeof window.firebase.firestore === "function"
    ) {
      Profile.auth = window.firebase.auth();
      Profile.db = window.firebase.firestore();
      return true;
    }

    showMessage(
      "Firebase সংযোগ পাওয়া যায়নি। Firebase SDK ও firebase.js পরীক্ষা করো।",
      "error"
    );

    return false;
  }

  function getInitials(name) {
    const cleanedName = String(name || "").trim();

    if (!cleanedName) return "A";

    const words = cleanedName.split(/\s+/);

    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }

    return (
      words[0].charAt(0) + words[words.length - 1].charAt(0)
    ).toUpperCase();
  }

  function safeText(value) {
    return String(value == null ? "" : value);
  }

  function setText(element, value) {
    if (element) {
      element.textContent = safeText(value);
    }
  }

  function getAdminName() {
    return (
      (Profile.adminData && Profile.adminData.name) ||
      (Profile.currentUser && Profile.currentUser.displayName) ||
      "Admin"
    );
  }

  function getAdminEmail() {
    return (
      (Profile.adminData && Profile.adminData.email) ||
      (Profile.currentUser && Profile.currentUser.email) ||
      ""
    );
  }

  function getAdminPhone() {
    return (
      (Profile.adminData && Profile.adminData.phone) ||
      (Profile.currentUser && Profile.currentUser.phoneNumber) ||
      ""
    );
  }

  function updateSidebarIdentity() {
    const name = getAdminName();
    const email = getAdminEmail();
    const phone = getAdminPhone();

    setText(elements.sidebarAdminName, name);
    setText(elements.sidebarAdminEmail, email);
    setText(elements.sidebarAdminPhone, phone);
    setText(elements.sidebarAvatarInitial, getInitials(name));

    if (elements.sidebarAvatar) {
      const imageUrl =
        (Profile.adminData && Profile.adminData.photoURL) ||
        (Profile.currentUser && Profile.currentUser.photoURL) ||
        "";

      if (imageUrl) {
        elements.sidebarAvatar.src = imageUrl;
        elements.sidebarAvatar.alt = name + " profile photo";
        elements.sidebarAvatar.hidden = false;

        if (elements.sidebarAvatarInitial) {
          elements.sidebarAvatarInitial.hidden = true;
        }

        elements.sidebarAvatar.onerror = function () {
          elements.sidebarAvatar.hidden = true;

          if (elements.sidebarAvatarInitial) {
            elements.sidebarAvatarInitial.hidden = false;
          }
        };
      } else {
        elements.sidebarAvatar.removeAttribute("src");
        elements.sidebarAvatar.hidden = true;

        if (elements.sidebarAvatarInitial) {
          elements.sidebarAvatarInitial.hidden = false;
        }
      }
    }

    setText($("topbarAdminName"), name);
    setText($("dashboardWelcome"), "Welcome, " + name);
  }

  function createProfileForm() {
    if (!elements.profileContent) return;

    elements.profileContent.replaceChildren();

    const wrapper = document.createElement("section");
    wrapper.className = "profile-panel";

    const heading = document.createElement("h2");
    heading.textContent = "Admin Profile";

    const description = document.createElement("p");
    description.textContent =
      "তোমার Admin account-এর profile information দেখো ও update করো।";

    const form = document.createElement("form");
    form.id = "adminProfileForm";
    form.noValidate = true;

    const fields = [
      {
        id: "adminProfileName",
        label: "Full Name",
        type: "text",
        autocomplete: "name",
        required: true,
        value: getAdminName()
      },
      {
        id: "adminProfileEmail",
        label: "Email Address",
        type: "email",
        autocomplete: "email",
        required: false,
        value: getAdminEmail(),
        readonly: true
      },
      {
        id: "adminProfilePhone",
        label: "Phone Number",
        type: "tel",
        autocomplete: "tel",
        required: false,
        value: getAdminPhone()
      },
      {
        id: "adminProfilePhotoURL",
        label: "Profile Photo URL",
        type: "url",
        autocomplete: "url",
        required: false,
        value:
          (Profile.adminData && Profile.adminData.photoURL) ||
          (Profile.currentUser && Profile.currentUser.photoURL) ||
          ""
      }
    ];

    fields.forEach(function (field) {
      const group = document.createElement("div");
      group.className = "form-group";

      const label = document.createElement("label");
      label.htmlFor = field.id;
      label.textContent = field.label;

      const input = document.createElement("input");
      input.id = field.id;
      input.name = field.id;
      input.type = field.type;
      input.autocomplete = field.autocomplete;
      input.value = field.value;
      input.required = field.required;

      if (field.readonly) {
        input.readOnly = true;
        input.setAttribute("aria-describedby", "adminProfileEmailHelp");
      }

      if (field.id === "adminProfilePhotoURL") {
        input.placeholder = "https://example.com/photo.jpg";
      }

      group.append(label, input);

      if (field.id === "adminProfileEmail") {
        const help = document.createElement("small");
        help.id = "adminProfileEmailHelp";
        help.textContent =
          "Email পরিবর্তন করতে Firebase Authentication-এর email update/verification process প্রয়োজন।";
        group.appendChild(help);
      }

      form.appendChild(group);
    });

    const previewWrapper = document.createElement("div");
    previewWrapper.className = "profile-photo-preview";

    const previewLabel = document.createElement("p");
    previewLabel.textContent = "Profile Photo Preview";

    const previewImage = document.createElement("img");
    previewImage.id = "adminProfilePhotoPreview";
    previewImage.alt = "Admin profile photo preview";
    previewImage.hidden = true;

    const previewInitial = document.createElement("div");
    previewInitial.id = "adminProfilePhotoInitial";
    previewInitial.className = "profile-photo-initial";
    previewInitial.textContent = getInitials(getAdminName());

    previewWrapper.append(
      previewLabel,
      previewImage,
      previewInitial
    );

    const saveButton = document.createElement("button");
    saveButton.id = "saveAdminProfileButton";
    saveButton.type = "submit";
    saveButton.textContent = "Save Profile";

    const resetButton = document.createElement("button");
    resetButton.id = "resetAdminProfileButton";
    resetButton.type = "button";
    resetButton.textContent = "Reset Changes";

    const actions = document.createElement("div");
    actions.className = "profile-form-actions";
    actions.append(saveButton, resetButton);

    form.append(previewWrapper, actions);
    wrapper.append(heading, description, form);
    elements.profileContent.appendChild(wrapper);

    const photoInput = $("adminProfilePhotoURL");

    photoInput.addEventListener("input", updatePhotoPreview);

    $("adminProfileName").addEventListener("input", function () {
      previewInitial.textContent = getInitials(
        $("adminProfileName").value
      );
    });

    form.addEventListener("submit", saveProfile);

    resetButton.addEventListener("click", function () {
      createProfileForm();
    });

    updatePhotoPreview();
  }

  function updatePhotoPreview() {
    const photoInput = $("adminProfilePhotoURL");
    const previewImage = $("adminProfilePhotoPreview");
    const previewInitial = $("adminProfilePhotoInitial");

    if (!photoInput || !previewImage || !previewInitial) return;

    const photoURL = photoInput.value.trim();

    previewInitial.textContent = getInitials(
      $("adminProfileName")
        ? $("adminProfileName").value
        : getAdminName()
    );

    if (!photoURL) {
      previewImage.removeAttribute("src");
      previewImage.hidden = true;
      previewInitial.hidden = false;
      return;
    }

    try {
      const parsedURL = new URL(photoURL);

      if (parsedURL.protocol !== "https:" &&
          parsedURL.protocol !== "http:") {
        throw new Error("Invalid image URL protocol.");
      }

      previewImage.onload = function () {
        previewImage.hidden = false;
        previewInitial.hidden = true;
      };

      previewImage.onerror = function () {
        previewImage.hidden = true;
        previewInitial.hidden = false;
      };

      previewImage.src = parsedURL.href;
    } catch (error) {
      previewImage.removeAttribute("src");
      previewImage.hidden = true;
      previewInitial.hidden = false;
    }
  }

  function validateProfile(name, phone, photoURL) {
    if (!name || name.length < 2) {
      showMessage("Admin-এর নাম কমপক্ষে ২ অক্ষরের হতে হবে।", "warning");
      return false;
    }

    if (name.length > 100) {
      showMessage("Admin-এর নাম ১০০ অক্ষরের বেশি হতে পারবে না।", "warning");
      return false;
    }

    if (phone && !/^[+0-9()\-\s]{7,20}$/.test(phone)) {
      showMessage("সঠিক Phone Number লিখো।", "warning");
      return false;
    }

    if (photoURL) {
      try {
        const parsedURL = new URL(photoURL);

        if (
          parsedURL.protocol !== "https:" &&
          parsedURL.protocol !== "http:"
        ) {
          throw new Error("Invalid URL protocol.");
        }
      } catch (error) {
        showMessage(
          "Profile Photo URL সঠিক নয়। একটি বৈধ HTTP/HTTPS image URL দাও।",
          "warning"
        );
        return false;
      }
    }

    return true;
  }

  async function saveProfile(event) {
    event.preventDefault();

    if (Profile.saving) return;

    if (!Profile.currentUser || !Profile.db) {
      showMessage(
        "Admin account পাওয়া যায়নি। আবার login করে চেষ্টা করো।",
        "error"
      );
      return;
    }

    if (
      !window.MNEETAdmin ||
      typeof window.MNEETAdmin.isAdminAuthorized !== "function" ||
      !window.MNEETAdmin.isAdminAuthorized()
    ) {
      showMessage(
        "Admin authorization যাচাই করা যায়নি। Profile update বন্ধ রাখা হয়েছে।",
        "error"
      );
      return;
    }

    const name = $("adminProfileName").value.trim();
    const phone = $("adminProfilePhone").value.trim();
    const photoURL = $("adminProfilePhotoURL").value.trim();

    if (!validateProfile(name, phone, photoURL)) return;

    Profile.saving = true;

    const saveButton = $("saveAdminProfileButton");
    const resetButton = $("resetAdminProfileButton");

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "Saving...";
    }

    if (resetButton) resetButton.disabled = true;

    try {
      const uid = Profile.currentUser.uid;

      /*
       * Profile data is stored in users/{uid}, not admins/{uid}.
       * This avoids requiring the client to write to the protected
       * admins collection. Admin role/authorization is not changed here.
       */
      const userProfileRef = Profile.db.collection("users").doc(uid);

      const existingUserDoc = await userProfileRef.get();

      const profileData = {
        name: name,
        phone: phone,
        photoURL: photoURL,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (!existingUserDoc.exists) {
        profileData.uid = uid;
        profileData.email = Profile.currentUser.email || "";
        profileData.role = "admin";
        profileData.createdAt =
          firebase.firestore.FieldValue.serverTimestamp();
      }

      await userProfileRef.set(profileData, { merge: true });

      /*
       * Update Firebase Authentication display name.
       * Photo URL is updated only if supplied; an empty URL clears it.
       */
      await Profile.currentUser.updateProfile({
        displayName: name,
        photoURL: photoURL || null
      });

      Profile.adminData = Object.assign({}, Profile.adminData || {}, {
        name: name,
        phone: phone,
        photoURL: photoURL,
        email: Profile.currentUser.email || ""
      });

      updateSidebarIdentity();

      showMessage("Admin Profile সফলভাবে update হয়েছে।", "success");

      createProfileForm();
    } catch (error) {
      console.error("mNEET admin profile update error:", error);

      if (error && error.code === "permission-denied") {
        showMessage(
          "Firebase Security Rules এই profile update অনুমতি দিচ্ছে না। users collection-এর admin access rules পরীক্ষা করতে হবে।",
          "error"
        );
      } else {
        showMessage(
          "Profile update করা যায়নি। Internet connection ও Firebase Security Rules পরীক্ষা করো।",
          "error"
        );
      }
    } finally {
      Profile.saving = false;

      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "Save Profile";
      }

      if (resetButton) resetButton.disabled = false;
    }
  }

  async function loadAdminProfile(user) {
    if (!user || !Profile.db) return;

    Profile.currentUser = user;

    try {
      const adminDoc = await Profile.db
        .collection("admins")
        .doc(user.uid)
        .get();

      if (!adminDoc.exists || adminDoc.data().active !== true) {
        showMessage(
          "এই account-এর Admin access সক্রিয় নয়।",
          "error"
        );
        return;
      }

      Profile.adminData = adminDoc.data();

      /*
       * Read editable contact/profile information from users/{uid}.
       * Admin authorization continues to depend on admins/{uid}.active.
       */
      try {
        const userDoc = await Profile.db
          .collection("users")
          .doc(user.uid)
          .get();

        if (userDoc.exists) {
          const userData = userDoc.data();

          Profile.adminData = Object.assign({}, Profile.adminData, {
            name:
              userData.name ||
              Profile.adminData.name ||
              user.displayName ||
              "",
            phone:
              userData.phone ||
              Profile.adminData.phone ||
              "",
            photoURL:
              userData.photoURL ||
              Profile.adminData.photoURL ||
              user.photoURL ||
              "",
            email:
              Profile.adminData.email ||
              userData.email ||
              user.email ||
              ""
          });
        }
      } catch (profileReadError) {
        console.warn(
          "mNEET admin profile details could not be loaded:",
          profileReadError
        );
      }

      updateSidebarIdentity();
      createProfileForm();
    } catch (error) {
      console.error("mNEET admin profile load error:", error);

      showMessage(
        "Admin Profile load করা যায়নি। Firebase permission পরীক্ষা করো।",
        "error"
      );
    }
  }

  function init() {
    if (Profile.initialized) return;
    if (!getFirebaseServices()) return;

    Profile.initialized = true;

    Profile.auth.onAuthStateChanged(async function (user) {
      if (!user) {
        Profile.currentUser = null;
        Profile.adminData = null;
        return;
      }

      await loadAdminProfile(user);
    });
  }

  Profile.load = loadAdminProfile;
  Profile.refresh = function () {
    if (Profile.currentUser) {
      return loadAdminProfile(Profile.currentUser);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
