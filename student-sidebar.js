/* =========================================================
   mNEET STUDENT SIDEBAR
   File: student-sidebar.js

   Features:
   - Mobile sidebar open/close
   - Navigation integration with student.js
   - Active menu highlighting
   - Student profile display integration
   - Notifications navigation
   - Social links from Firebase settings
   - Theme toggle integration
   - Secure Firebase logout
   - Keyboard accessibility
   - Green + White theme compatible

   Dependencies:
   firebase.js
   student.js
   theme.js
   ========================================================= */

(function () {
    "use strict";

    const MNEETStudentSidebar = {};

    const SELECTORS = {
        sidebar: "#studentSidebar",
        overlay: "#studentSidebarOverlay",
        toggle: "#studentSidebarToggle",
        close: "#studentSidebarClose",
        logout: "#studentSidebarLogout",
        notificationButton: "#studentNotificationButton",
        topbarProfile: "#studentTopbarProfile",
        themeToggle: "#studentThemeToggle",

        navLinks: "[data-student-page]",
        sections: "[data-student-section]"
    };

    const SOCIAL_LINKS = {
        facebook: {
            element: "#studentFacebookLink",
            keys: [
                "facebook",
                "facebookUrl",
                "facebookLink",
                "facebookURL"
            ]
        },

        instagram: {
            element: "#studentInstagramLink",
            keys: [
                "instagram",
                "instagramUrl",
                "instagramLink",
                "instagramURL"
            ]
        },

        youtube: {
            element: "#studentYouTubeLink",
            keys: [
                "youtube",
                "youtubeUrl",
                "youtubeLink",
                "youtubeURL"
            ]
        },

        whatsapp: {
            element: "#studentWhatsAppLink",
            keys: [
                "whatsapp",
                "whatsappUrl",
                "whatsappLink",
                "whatsappURL"
            ]
        }
    };

    const PAGE_TITLES = {
        dashboard: "Dashboard",
        courses: "My Courses",
        "available-courses": "Available Courses",
        study: "Study",
        "topic-practice": "Topic Wise Practice",
        "chapter-practice": "Chapter Wise Practice",
        ncert: "NCERT Books",
        notes: "Topic Notes",
        pyq: "Previous Year Questions",
        "mock-tests": "Mock Tests",
        results: "Quiz Results",
        progress: "My Progress",
        "weak-points": "Weak Points",
        "purchase-history": "Purchase History",
        notifications: "Notifications",
        profile: "My Profile",
        settings: "Settings",
        quiz: "Quiz",
        "pdf-reader": "PDF Reader"
    };

    let initialized = false;
    let previousBodyOverflow = "";
    let escapeHandler = null;


    /* =====================================================
       1. DOM HELPERS
       ===================================================== */

    function $(selector, root) {
        return (root || document).querySelector(selector);
    }

    function $all(selector, root) {
        return Array.from(
            (root || document).querySelectorAll(selector)
        );
    }

    function getSidebar() {
        return $(SELECTORS.sidebar);
    }

    function getOverlay() {
        return $(SELECTORS.overlay);
    }

    function getStudentAPI() {
        return window.MNEETStudent || null;
    }

    function getFirebaseAuth() {
        if (
            window.MNEETFirebase &&
            window.MNEETFirebase.auth
        ) {
            return window.MNEETFirebase.auth;
        }

        if (window.mneetAuth) {
            return window.mneetAuth;
        }

        if (
            window.firebase &&
            typeof window.firebase.auth === "function"
        ) {
            return window.firebase.auth();
        }

        return null;
    }


    /* =====================================================
       2. MOBILE DETECTION
       ===================================================== */

    function isMobileLayout() {
        return window.matchMedia(
            "(max-width: 760px)"
        ).matches;
    }


    /* =====================================================
       3. SIDEBAR OPEN / CLOSE
       ===================================================== */

    function openSidebar() {
        const sidebar = getSidebar();
        const overlay = getOverlay();
        const toggle = $(SELECTORS.toggle);

        if (!sidebar || !isMobileLayout()) {
            return;
        }

        sidebar.classList.add("is-open");

        if (overlay) {
            overlay.classList.add("is-visible");
            overlay.setAttribute("aria-hidden", "false");
        }

        if (toggle) {
            toggle.setAttribute("aria-expanded", "true");
        }

        previousBodyOverflow = document.body.style.overflow;

        document.body.style.overflow = "hidden";

        const closeButton = $(SELECTORS.close);

        if (closeButton) {
            window.setTimeout(function () {
                closeButton.focus({
                    preventScroll: true
                });
            }, 50);
        }
    }


    function closeSidebar(options) {
        options = options || {};

        const sidebar = getSidebar();
        const overlay = getOverlay();
        const toggle = $(SELECTORS.toggle);

        if (sidebar) {
            sidebar.classList.remove("is-open");
        }

        if (overlay) {
            overlay.classList.remove("is-visible");
            overlay.setAttribute("aria-hidden", "true");
        }

        if (toggle) {
            toggle.setAttribute("aria-expanded", "false");
        }

        document.body.style.overflow = previousBodyOverflow;

        if (
            options.restoreFocus &&
            toggle &&
            isMobileLayout()
        ) {
            toggle.focus({
                preventScroll: true
            });
        }
    }


    function toggleSidebar() {
        const sidebar = getSidebar();

        if (!sidebar) {
            return;
        }

        if (sidebar.classList.contains("is-open")) {
            closeSidebar({
                restoreFocus: false
            });
        } else {
            openSidebar();
        }
    }


    /* =====================================================
       4. NAVIGATION
       ===================================================== */

    function normalizePage(page) {
        return String(page || "")
            .trim()
            .toLowerCase();
    }


    function getPageFromElement(element) {
        if (!element) {
            return "";
        }

        return normalizePage(
            element.getAttribute("data-student-page")
        );
    }


    function getActivePage() {
        const api = getStudentAPI();

        if (
            api &&
            typeof api.getActivePage === "function"
        ) {
            const activePage = api.getActivePage();

            if (activePage) {
                return normalizePage(activePage);
            }
        }

        const activeSection = $(
            '[data-student-section].active'
        );

        if (activeSection) {
            return normalizePage(
                activeSection.getAttribute(
                    "data-student-section"
                )
            );
        }

        const visibleSection = $all(
            SELECTORS.sections
        ).find(function (section) {
            return !section.hidden;
        });

        if (visibleSection) {
            return normalizePage(
                visibleSection.getAttribute(
                    "data-student-section"
                )
            );
        }

        return "dashboard";
    }


    function setActiveNavigation(page) {
        page = normalizePage(page);

        $all(SELECTORS.navLinks).forEach(
            function (link) {
                const linkPage = getPageFromElement(link);

                const isActive = linkPage === page;

                link.classList.toggle(
                    "active",
                    isActive
                );

                if (isActive) {
                    link.setAttribute(
                        "aria-current",
                        "page"
                    );
                } else {
                    link.removeAttribute(
                        "aria-current"
                    );
                }
            }
        );
    }


    function updatePageTitle(page) {
        page = normalizePage(page);

        const title = $("#studentPageTitle");

        if (!title) {
            return;
        }

        title.textContent =
            PAGE_TITLES[page] || "mNEET";
    }


    function navigateTo(page) {
        page = normalizePage(page);

        if (!page) {
            return false;
        }

        const api = getStudentAPI();

        /*
         * Use the existing student.js navigation API.
         * Do not replace the existing page-navigation logic.
         */

        if (
            api &&
            typeof api.navigateTo === "function"
        ) {
            api.navigateTo(page);
        } else if (
            api &&
            typeof api.showPage === "function"
        ) {
            api.showPage(page);
        } else {
            /*
             * If student.js has not initialized yet,
             * wait for its initialization rather than
             * creating a second navigation system.
             */

            document.dispatchEvent(
                new CustomEvent(
                    "mneet:student-navigation-request",
                    {
                        detail: {
                            page: page
                        }
                    }
                )
            );

            return false;
        }

        setActiveNavigation(page);
        updatePageTitle(page);

        if (isMobileLayout()) {
            closeSidebar({
                restoreFocus: false
            });
        }

        return true;
    }


    function handleNavigationClick(event) {
        const link = event.target.closest(
            SELECTORS.navLinks
        );

        if (!link) {
            return;
        }

        /*
         * Buttons that only trigger navigation
         * should not submit any surrounding form.
         */

        if (
            link.tagName === "BUTTON" ||
            link.tagName === "A"
        ) {
            event.preventDefault();
        }

        const page = getPageFromElement(link);

        if (!page) {
            return;
        }

        navigateTo(page);
    }


    function synchronizeNavigation() {
        const page = getActivePage();

        setActiveNavigation(page);
        updatePageTitle(page);
    }


    /* =====================================================
       5. NOTIFICATION BUTTON
       ===================================================== */

    function openNotifications() {
        navigateTo("notifications");
    }


    function handleNotificationButton() {
        const button = $(
            SELECTORS.notificationButton
        );

        if (!button) {
            return;
        }

        button.addEventListener(
            "click",
            openNotifications
        );
    }


    /* =====================================================
       6. TOPBAR PROFILE BUTTON
       ===================================================== */

    function openProfile() {
        navigateTo("profile");
    }


    function handleProfileButton() {
        const button = $(
            SELECTORS.topbarProfile
        );

        if (!button) {
            return;
        }

        button.addEventListener(
            "click",
            openProfile
        );
    }


    /* =====================================================
       7. THEME BUTTON
       ===================================================== */

    function toggleTheme() {
        /*
         * theme.js owns theme persistence and theme
         * implementation. Use its public API if present.
         */

        const themeAPI = window.MNEETTheme;

        if (
            themeAPI &&
            typeof themeAPI.toggle === "function"
        ) {
            themeAPI.toggle();
            return;
        }

        if (
            themeAPI &&
            typeof themeAPI.toggleTheme === "function"
        ) {
            themeAPI.toggleTheme();
            return;
        }

        /*
         * Support a common shared theme implementation
         * without forcing a second theme system.
         */

        if (
            window.MNEETCommon &&
            typeof window.MNEETCommon.toggleTheme ===
                "function"
        ) {
            window.MNEETCommon.toggleTheme();
            return;
        }

        document.dispatchEvent(
            new CustomEvent(
                "mneet:theme-toggle-request"
            )
        );
    }


    function handleThemeButton() {
        const button = $(SELECTORS.themeToggle);

        if (!button) {
            return;
        }

        button.addEventListener(
            "click",
            toggleTheme
        );
    }


    /* =====================================================
       8. SOCIAL LINKS
       ===================================================== */

    function isAllowedWebLink(value, type) {
        if (
            typeof value !== "string" ||
            !value.trim()
        ) {
            return false;
        }

        try {
            const url = new URL(value.trim());

            if (
                url.protocol !== "https:" &&
                url.protocol !== "http:"
            ) {
                return false;
            }

            const hostname = url.hostname
                .toLowerCase()
                .replace(/^www\./, "");

            const allowedHosts = {
                facebook: [
                    "facebook.com",
                    "m.facebook.com",
                    "fb.com"
                ],

                instagram: [
                    "instagram.com"
                ],

                youtube: [
                    "youtube.com",
                    "m.youtube.com",
                    "youtu.be"
                ],

                whatsapp: [
                    "wa.me",
                    "whatsapp.com",
                    "api.whatsapp.com"
                ]
            };

            const allowed =
                allowedHosts[type] || [];

            return allowed.some(function (host) {
                return (
                    hostname === host ||
                    hostname.endsWith("." + host)
                );
            });
        } catch (error) {
            return false;
        }
    }


    function findSocialSettings(data) {
        if (
            !data ||
            typeof data !== "object"
        ) {
            return {};
        }

        /*
         * Support the common settings document
         * structures used by the admin settings page.
         */

        const candidates = [
            data,
            data.socialLinks,
            data.social,
            data.links,
            data.general,
            data.settings,
            data.data
        ].filter(function (item) {
            return (
                item &&
                typeof item === "object"
            );
        });

        const result = {};

        Object.keys(SOCIAL_LINKS).forEach(
            function (type) {
                const keys = SOCIAL_LINKS[type].keys;

                for (
                    let i = 0;
                    i < candidates.length;
                    i++
                ) {
                    const candidate = candidates[i];

                    for (
                        let j = 0;
                        j < keys.length;
                        j++
                    ) {
                        const value =
                            candidate[keys[j]];

                        if (
                            typeof value === "string" &&
                            value.trim()
                        ) {
                            result[type] = value.trim();
                            return;
                        }
                    }
                }
            }
        );

        return result;
    }


    function applySocialLinks(data) {
        const socialSettings =
            findSocialSettings(data);

        Object.keys(SOCIAL_LINKS).forEach(
            function (type) {
                const config = SOCIAL_LINKS[type];

                const link = $(config.element);

                if (!link) {
                    return;
                }

                const value = socialSettings[type];

                if (
                    !value ||
                    !isAllowedWebLink(value, type)
                ) {
                    link.removeAttribute("href");
                    link.hidden = true;
                    return;
                }

                link.href = value;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.hidden = false;
            }
        );
    }


    function loadSocialLinks() {
        const api = getStudentAPI();

        /*
         * Prefer existing shared settings data when available.
         */

        if (
            api &&
            typeof api.getSettings === "function"
        ) {
            try {
                Promise.resolve(
                    api.getSettings()
                ).then(function (settings) {
                    applySocialLinks(settings);
                }).catch(function () {
                    applySocialLinks({});
                });

                return;
            } catch (error) {
                // Continue with Firestore fallback.
            }
        }

        const db =
            window.MNEETFirebase &&
            window.MNEETFirebase.db
                ? window.MNEETFirebase.db
                : window.mneetDB;

        if (!db) {
            applySocialLinks({});
            return;
        }

        /*
         * The admin settings document name may vary
         * between deployments. Check common locations.
         */

        const candidates = [
            ["settings", "general"],
            ["settings", "social"],
            ["appSettings", "general"]
        ];

        let index = 0;

        function tryNextDocument() {
            if (index >= candidates.length) {
                applySocialLinks({});
                return;
            }

            const path = candidates[index++];
            const collectionName = path[0];
            const documentId = path[1];

            db.collection(collectionName)
                .doc(documentId)
                .get()
                .then(function (snapshot) {
                    if (
                        snapshot.exists &&
                        Object.keys(
                            findSocialSettings(
                                snapshot.data()
                            )
                        ).length > 0
                    ) {
                        applySocialLinks(
                            snapshot.data()
                        );

                        return;
                    }

                    tryNextDocument();
                })
                .catch(function () {
                    tryNextDocument();
                });
        }

        tryNextDocument();
    }


    /* =====================================================
       9. STUDENT PROFILE SYNCHRONIZATION
       ===================================================== */

    function synchronizeStudentIdentity() {
        const api = getStudentAPI();

        if (
            !api ||
            typeof api.getProfile !== "function"
        ) {
            return;
        }

        let profile;

        try {
            profile = api.getProfile();
        } catch (error) {
            return;
        }

        if (
            !profile ||
            typeof profile !== "object"
        ) {
            return;
        }

        const name =
            profile.name ||
            profile.fullName ||
            profile.displayName ||
            "Student";

        const email = profile.email || "";
        const phone = profile.phone || "";

        const nameElement = $(
            "#studentSidebarName"
        );

        const emailElement = $(
            "#studentSidebarEmail"
        );

        const phoneElement = $(
            "#studentSidebarPhone"
        );

        const topbarName = $(
            "#studentTopbarName"
        );

        const welcomeName = $(
            "#studentWelcomeName"
        );

        const initial = String(name)
            .trim()
            .charAt(0)
            .toUpperCase() || "S";

        const sidebarInitial = $(
            "#studentSidebarInitial"
        );

        const topbarInitial = $(
            "#studentTopbarInitial"
        );

        if (nameElement) {
            nameElement.textContent = name;
        }

        if (emailElement) {
            emailElement.textContent = email;
        }

        if (phoneElement) {
            phoneElement.textContent = phone;
        }

        if (topbarName) {
            topbarName.textContent = name;
        }

        if (welcomeName) {
            welcomeName.textContent = name;
        }

        if (sidebarInitial) {
            sidebarInitial.textContent = initial;
        }

        if (topbarInitial) {
            topbarInitial.textContent = initial;
        }

        const photo = $(
            "#studentSidebarPhoto"
        );

        if (photo) {
            const photoURL =
                profile.photoURL ||
                profile.photoUrl ||
                profile.photo ||
                "";

            if (
                typeof photoURL === "string" &&
                photoURL.trim()
            ) {
                photo.src = photoURL.trim();
                photo.hidden = false;

                if (sidebarInitial) {
                    sidebarInitial.hidden = true;
                }

                photo.onerror = function () {
                    photo.hidden = true;

                    if (sidebarInitial) {
                        sidebarInitial.hidden = false;
                    }
                };
            } else {
                photo.removeAttribute("src");
                photo.hidden = true;

                if (sidebarInitial) {
                    sidebarInitial.hidden = false;
                }
            }
        }
    }


    /* =====================================================
       10. UNREAD NOTIFICATION COUNT
       ===================================================== */

    function updateUnreadCount(count) {
        count = Number(count);

        if (!Number.isFinite(count) || count < 0) {
            count = 0;
        }

        count = Math.floor(count);

        const sidebarCount = $(
            "#studentUnreadCount"
        );

        const topbarDot = $(
            "#studentTopbarUnreadCount"
        );

        if (sidebarCount) {
            sidebarCount.textContent =
                count > 99 ? "99+" : String(count);

            sidebarCount.hidden = count === 0;
        }

        if (topbarDot) {
            topbarDot.hidden = count === 0;
        }
    }


    function handleUnreadCountEvent(event) {
        const detail =
            event && event.detail
                ? event.detail
                : {};

        const count =
            typeof detail.count === "number"
                ? detail.count
                : detail.unreadCount;

        if (typeof count === "number") {
            updateUnreadCount(count);
        }
    }


    /* =====================================================
       11. SECURE LOGOUT
       ===================================================== */

    async function logout() {
        const button = $(SELECTORS.logout);

        if (
            button &&
            button.disabled
        ) {
            return;
        }

        const confirmed = window.confirm(
            "Are you sure you want to log out of mNEET?"
        );

        if (!confirmed) {
            return;
        }

        if (button) {
            button.disabled = true;
        }

        try {
            const auth = getFirebaseAuth();

            if (
                !auth ||
                typeof auth.signOut !== "function"
            ) {
                throw new Error(
                    "Firebase Authentication is not available."
                );
            }

            await auth.signOut();

            /*
             * auth-guard.js should handle the signed-out
             * state. This redirect is a safe fallback.
             */

            window.location.replace("index.html");
        } catch (error) {
            console.error(
                "mNEET logout failed:",
                error
            );

            if (button) {
                button.disabled = false;
            }

            const api = getStudentAPI();

            if (
                api &&
                typeof api.showMessage === "function"
            ) {
                api.showMessage(
                    "Logout failed. Please check your internet connection and try again.",
                    "error"
                );
            } else {
                window.alert(
                    "Logout failed. Please check your internet connection and try again."
                );
            }
        }
    }


    /* =====================================================
       12. KEYBOARD ACCESSIBILITY
       ===================================================== */

    function handleEscapeKey(event) {
        if (event.key !== "Escape") {
            return;
        }

        const sidebar = getSidebar();

        if (
            sidebar &&
            sidebar.classList.contains("is-open")
        ) {
            closeSidebar({
                restoreFocus: true
            });
        }
    }


    function handleResize() {
        if (!isMobileLayout()) {
            closeSidebar({
                restoreFocus: false
            });
        }
    }


    /* =====================================================
       13. EVENT REGISTRATION
       ===================================================== */

    function registerSidebarEvents() {
        const toggle = $(SELECTORS.toggle);
        const close = $(SELECTORS.close);
        const overlay = getOverlay();
        const logoutButton = $(SELECTORS.logout);
        const navigation = $(".student-navigation");

        if (toggle) {
            toggle.addEventListener(
                "click",
                toggleSidebar
            );
        }

        if (close) {
            close.addEventListener(
                "click",
                function () {
                    closeSidebar({
                        restoreFocus: true
                    });
                }
            );
        }

        if (overlay) {
            overlay.addEventListener(
                "click",
                function () {
                    closeSidebar({
                        restoreFocus: true
                    });
                }
            );
        }

        if (navigation) {
            navigation.addEventListener(
                "click",
                handleNavigationClick
            );
        }

        /*
         * Dashboard quick links and other buttons outside
         * the sidebar also use data-student-page.
         *
         * A single delegated listener supports all of them.
         */

        document.addEventListener(
            "click",
            function (event) {
                const element = event.target.closest(
                    SELECTORS.navLinks
                );

                if (!element) {
                    return;
                }

                /*
                 * Sidebar links are handled by the sidebar
                 * listener above. Outside links are handled here.
                 */

                if (
                    navigation &&
                    navigation.contains(element)
                ) {
                    return;
                }

                handleNavigationClick(event);
            }
        );

        if (logoutButton) {
            logoutButton.addEventListener(
                "click",
                logout
            );
        }

        handleNotificationButton();
        handleProfileButton();
        handleThemeButton();

        escapeHandler = handleEscapeKey;

        document.addEventListener(
            "keydown",
            escapeHandler
        );

        window.addEventListener(
            "resize",
            handleResize
        );

        document.addEventListener(
            "mneet:student-page-change",
            synchronizeNavigation
        );

        document.addEventListener(
            "mneet:student-profile-updated",
            synchronizeStudentIdentity
        );

        document.addEventListener(
            "mneet:unread-count-updated",
            handleUnreadCountEvent
        );

        document.addEventListener(
            "mneet:notifications-updated",
            handleUnreadCountEvent
        );

        document.addEventListener(
            "mneet:student-settings-loaded",
            function (event) {
                applySocialLinks(
                    event.detail || {}
                );
            }
        );

        /*
         * The theme implementation can dispatch this event
         * after it has changed the saved theme.
         */

        document.addEventListener(
            "mneet:theme-changed",
            function () {
                const button = $(
                    SELECTORS.themeToggle
                );

                if (button) {
                    button.setAttribute(
                        "aria-pressed",
                        document.documentElement
                            .getAttribute("data-theme") ===
                            "light"
                            ? "true"
                            : "false"
                    );
                }
            }
        );
    }


    /* =====================================================
       14. INITIALIZATION
       ===================================================== */

    function initialize() {
        if (initialized) {
            return;
        }

        if (!getSidebar()) {
            return;
        }

        initialized = true;

        registerSidebarEvents();

        synchronizeNavigation();
        synchronizeStudentIdentity();

        loadSocialLinks();

        closeSidebar({
            restoreFocus: false
        });
    }


    /* =====================================================
       15. PUBLIC API
       ===================================================== */

    MNEETStudentSidebar.initialize = initialize;

    MNEETStudentSidebar.open = openSidebar;

    MNEETStudentSidebar.close = closeSidebar;

    MNEETStudentSidebar.toggle = toggleSidebar;

    MNEETStudentSidebar.navigateTo = navigateTo;

    MNEETStudentSidebar.setActiveNavigation =
        setActiveNavigation;

    MNEETStudentSidebar.synchronizeNavigation =
        synchronizeNavigation;

    MNEETStudentSidebar.synchronizeStudentIdentity =
        synchronizeStudentIdentity;

    MNEETStudentSidebar.applySocialLinks =
        applySocialLinks;

    MNEETStudentSidebar.updateUnreadCount =
        updateUnreadCount;

    MNEETStudentSidebar.logout = logout;

    window.MNEETStudentSidebar =
        MNEETStudentSidebar;


    /* =====================================================
       16. START
       ===================================================== */

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );
    } else {
        initialize();
    }

})();
