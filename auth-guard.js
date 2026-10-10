/* ========================================
   mNEET AUTH GUARD
   Authentication and Role Routing
   ======================================== */

(function () {
    "use strict";

    let checkStarted = false;

    /*
     * Detect the current page.
     */
    function getCurrentPage() {
        const path = window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();

        return path || "index.html";
    }

    /*
     * Wait until Firebase is initialized.
     */
    function waitForFirebase(timeoutMs) {
        return new Promise(function (resolve, reject) {
            const startedAt = Date.now();

            function check() {
                if (
                    window.mneetFirebase &&
                    window.mneetFirebase.auth &&
                    window.mneetFirebase.db
                ) {
                    resolve(window.mneetFirebase);

                    return;
                }

                if (Date.now() - startedAt >= timeoutMs) {
                    reject(
                        new Error(
                            "Firebase initialization timed out."
                        )
                    );

                    return;
                }

                setTimeout(check, 100);
            }

            check();
        });
    }

    /*
     * Check current authentication and role.
     */
    async function checkCurrentPage() {
        if (checkStarted) {
            return;
        }

        checkStarted = true;

        const page = getCurrentPage();

        const isLoginPage = page === "index.html";

        const isAdminPage = page === "admin.html";

        const isStudentPage = page === "student.html";

        try {
            const services = await waitForFirebase(10000);

            /*
             * Wait for Firebase to restore its saved session.
             */
            const user = await new Promise(function (
                resolve,
                reject
            ) {
                let unsubscribe = null;

                const timeout = setTimeout(function () {
                    if (unsubscribe) {
                        unsubscribe();
                    }

                    reject(
                        new Error(
                            "Authentication check timed out."
                        )
                    );
                }, 10000);

                unsubscribe =
                    services.auth.onAuthStateChanged(
                        function (currentUser) {
                            clearTimeout(timeout);

                            if (unsubscribe) {
                                unsubscribe();
                            }

                            resolve(currentUser);
                        },
                        function (error) {
                            clearTimeout(timeout);

                            if (unsubscribe) {
                                unsubscribe();
                            }

                            reject(error);
                        }
                    );
            });

            /*
             * Not signed in:
             * protect dashboard pages.
             */
            if (!user) {
                if (!isLoginPage) {
                    window.location.replace("index.html");
                }

                return;
            }

            /*
             * Check admin privileges using Firestore.
             */
            const adminDoc = await services.db
                .collection("admins")
                .doc(user.uid)
                .get();

            const isActiveAdmin =
                adminDoc.exists &&
                adminDoc.data().active === true;

            /*
             * On the Login page, send signed-in users
             * to the correct dashboard.
             */
            if (isLoginPage) {
                if (window.mneetAuth) {
                    await window.mneetAuth
                        .routeSignedInUser(user);
                }

                return;
            }

            /*
             * Only active admins may enter admin.html.
             */
            if (isAdminPage && !isActiveAdmin) {
                const userDoc = await services.db
                    .collection("users")
                    .doc(user.uid)
                    .get();

                if (
                    userDoc.exists &&
                    userDoc.data().status === "active"
                ) {
                    window.location.replace("student.html");

                } else {
                    await services.auth.signOut();

                    window.location.replace("index.html");
                }

                return;
            }

            /*
             * Active admin opening student.html:
             * route to the admin dashboard.
             */
            if (isStudentPage && isActiveAdmin) {
                window.location.replace("admin.html");

                return;
            }

            /*
             * Verify the student profile.
             */
            if (isStudentPage) {
                const userDoc = await services.db
                    .collection("users")
                    .doc(user.uid)
                    .get();

                if (
                    !userDoc.exists ||
                    userDoc.data().status !== "active"
                ) {
                    await services.auth.signOut();

                    window.location.replace("index.html");
                }

                return;
            }

            /*
             * Protect other application pages too.
             * Their individual pages can add more checks later.
             */
            if (!isActiveAdmin) {
                const userDoc = await services.db
                    .collection("users")
                    .doc(user.uid)
                    .get();

                if (
                    !userDoc.exists ||
                    userDoc.data().status !== "active"
                ) {
                    await services.auth.signOut();

                    window.location.replace("index.html");
                }
            }

        } catch (error) {
            console.error(
                "mNEET authentication guard error:",
                error
            );

            /*
             * Do not silently grant access if verification fails.
             */
            if (!isLoginPage) {
                document.body.innerHTML = "";

                const message = document.createElement("div");

                message.style.cssText = [
                    "max-width:520px",
                    "margin:60px auto",
                    "padding:24px",
                    "font-family:Arial,sans-serif",
                    "line-height:1.6",
                    "color:#ffffff",
                    "background:#111c2f",
                    "border:1px solid #26364c",
                    "border-radius:12px"
                ].join(";");

                message.textContent =
                    "Unable to verify your account. Check your internet connection and Firebase permissions, then refresh the page.";

                document.body.style.background = "#0b1220";

                document.body.appendChild(message);
            } else if (window.mneetAuth) {
                window.mneetAuth.showMessage(
                    "Unable to verify your account. Check your internet connection and Firebase configuration.",
                    "error"
                );
            }

        } finally {
            checkStarted = false;
        }
    }

    /*
     * Export the guard for other pages.
     */
    window.mneetAuthGuard = {
        checkCurrentPage: checkCurrentPage
    };

    /*
     * Automatically check protected pages.
     */
    document.addEventListener(
        "DOMContentLoaded",
        function () {
            checkCurrentPage();
        }
    );

})();
