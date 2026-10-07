/* =========================================================
   STUDENT PROFILE
========================================================= */

"use strict";

let profileUser = null;

document.addEventListener(
    "DOMContentLoaded",
    function() {

        auth.onAuthStateChanged(
            async function(user) {

                if (!user) {

                    window.location.replace(
                        "index.html"
                    );

                    return;

                }

                profileUser = user;

                await loadProfile();

            }
        );

    }
);


async function loadProfile() {

    try {

        const doc =
            await db
                .collection("students")
                .doc(profileUser.uid)
                .get();

        const data =
            doc.exists
                ? doc.data()
                : {};

        const name =
            data.name ||
            profileUser.displayName ||
            "Student";

        const email =
            data.email ||
            profileUser.email ||
            "";

        const phone =
            data.phone ||
            "";

        if ($("profileName")) {

            $("profileName").textContent =
                name;

        }

        if ($("profileEmail")) {

            $("profileEmail").textContent =
                email;

        }

        if ($("profilePhone")) {

            $("profilePhone").textContent =
                phone || "Not added";

        }

        if ($("profileAvatar")) {

            $("profileAvatar").textContent =
                name
                    .charAt(0)
                    .toUpperCase();

        }

    } catch (error) {

        console.error(
            "Profile error:",
            error
        );

    }

}


/* =========================================================
   PROFILE UPDATE
========================================================= */

async function saveProfile() {

    if (!profileUser) return;

    const name =
        $("profileNameInput")
            ? $("profileNameInput")
                .value
                .trim()
            : "";

    const phone =
        $("profilePhoneInput")
            ? $("profilePhoneInput")
                .value
                .trim()
            : "";

    if (!name) {

        alert(
            "Name দিন।"
        );

        return;

    }

    try {

        await db
            .collection("students")
            .doc(profileUser.uid)
            .set(
                {
                    name: name,
                    phone: phone,
                    email:
                        profileUser.email ||
                        "",
                    updatedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()
                },
                {
                    merge: true
                }
            );

        alert(
            "Profile updated successfully."
        );

        await loadProfile();

    } catch (error) {

        console.error(
            "Profile update error:",
            error
        );

        alert(
            "Profile update করা যায়নি।"
        );

    }

}
