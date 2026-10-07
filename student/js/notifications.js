/* =========================================================
   STUDENT NOTIFICATIONS PAGE
========================================================= */

"use strict";

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

                await loadAllNotifications();

            }
        );

    }
);


async function loadAllNotifications() {

    const container =
        $("allNotifications");

    if (!container) return;

    showLoading(
        container,
        "Loading notifications..."
    );

    try {

        const snapshot =
            await db
                .collection("notifications")
                .orderBy(
                    "createdAt",
                    "desc"
                )
                .limit(50)
                .get();

        if (snapshot.empty) {

            container.innerHTML =
                `<div class="notification-empty">
                    No notifications available.
                </div>`;

            return;

        }

        container.innerHTML = "";

        snapshot.forEach(function(doc) {

            const data =
                doc.data() || {};

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "notification-item";

            item.innerHTML = `
                <div class="notification-title">
                    ${escapeHtml(
                        data.title ||
                        "Notification"
                    )}
                </div>

                <div class="notification-text">
                    ${escapeHtml(
                        data.message ||
                        data.text ||
                        ""
                    )}
                </div>
            `;

            container.appendChild(
                item
            );

        });

    } catch (error) {

        console.error(
            "Notification page error:",
            error
        );

        container.innerHTML =
            `<div class="notification-empty">
                Notifications could not be loaded.
            </div>`;

    }

}
