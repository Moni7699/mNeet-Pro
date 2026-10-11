/* ========================================
   mNEET AUTHENTICATION DESIGN
   Green + White Theme
   Light + Dark Mode
======================================== */

:root {
  color-scheme: light;

  --page-bg: #F5FAF6;
  --card-bg: #FFFFFF;
  --primary: #1B5E20;
  --primary-hover: #164D1A;
  --text: #10291D;
  --muted: #42634D;
  --input-bg: #F4FBF6;
  --border: #D5E7D9;
  --soft-bg: #E8F5EB;
  --shadow: 0 12px 36px rgba(16, 41, 29, 0.08);

  --radius-small: 10px;
  --radius-medium: 14px;
  --radius-large: 22px;

  --transition: 0.2s ease;
}

html[data-theme="dark"] {
  color-scheme: dark;

  --page-bg: #071A12;
  --card-bg: #0D2419;
  --primary: #22C55E;
  --primary-hover: #16A34A;
  --text: #FFFFFF;
  --muted: #D1D5DB;
  --input-bg: #10291D;
  --border: #28513A;
  --soft-bg: #10291D;
  --shadow: 0 12px 36px rgba(0, 0, 0, 0.2);
}

/* RESET */

* {
  box-sizing: border-box;
}

html {
  min-height: 100%;
  scroll-behavior: smooth;
  background: var(--page-bg);
}

body {
  margin: 0;
  min-height: 100vh;
  padding: 24px 16px;

  display: flex;
  align-items: center;
  justify-content: center;

  background: var(--page-bg);
  color: var(--text);

  font-family: Arial, Helvetica, sans-serif;
  -webkit-font-smoothing: antialiased;

  transition:
    background var(--transition),
    color var(--transition);
}

button,
input,
textarea,
select {
  font: inherit;
}

button {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

button:focus-visible,
input:focus-visible,
a:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
}

[hidden],
.hidden {
  display: none !important;
}

/* MAIN PAGE */

.page {
  width: 100%;
  max-width: 470px;
  margin: auto;
}

/* THEME BUTTON */

.top-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 20px;
}

.theme-toggle {
  min-height: 42px;
  padding: 9px 14px;

  border: 1px solid var(--border);
  border-radius: 12px;

  background: var(--card-bg);
  color: var(--text);

  font-size: 13px;
  font-weight: 700;

  transition: background var(--transition);
}

.theme-toggle:hover {
  background: var(--soft-bg);
}

/* BRAND */

.brand {
  margin-bottom: 26px;
  text-align: center;
}

.logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  min-width: 112px;
  min-height: 70px;
  padding: 10px;
  margin-bottom: 18px;

  border: 2px solid var(--primary);
  border-radius: 20px;

  font-size: 35px;
  font-weight: 900;
  letter-spacing: -2px;
}

.logo-m {
  color: var(--text);
}

.logo-neet {
  color: var(--primary);
}

.brand h1 {
  margin: 0 0 10px;
  font-size: clamp(26px, 6vw, 34px);
  line-height: 1.3;
}

.brand p {
  margin: 0;
  color: var(--muted);
  font-size: 15px;
  line-height: 1.7;
}

/* AUTH CARD */

.card {
  width: 100%;
  padding: 26px 22px;

  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-large);

  box-shadow: var(--shadow);

  transition:
    background var(--transition),
    border-color var(--transition);
}

/* LOGIN / SIGNUP TABS */

.tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;

  padding: 5px;
  margin-bottom: 27px;

  background: var(--soft-bg);
  border-radius: 13px;
}

.tab {
  min-width: 0;
  min-height: 46px;
  padding: 12px 8px;

  border: 0;
  border-radius: 10px;

  background: transparent;
  color: var(--muted);

  font-size: 15px;
  font-weight: 700;

  transition:
    background var(--transition),
    color var(--transition);
}

.tab:hover {
  color: var(--text);
}

.tab.active {
  background: var(--primary);
  color: #FFFFFF;
}

html[data-theme="dark"] .tab.active {
  color: #071A12;
}

/* FORM HEADINGS */

.section-title {
  margin: 0 0 8px;
  color: var(--text);
  font-size: 27px;
  font-weight: 800;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.section-subtitle {
  margin: 0 0 24px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.7;
}

/* INPUT FIELDS */

.field {
  width: 100%;
  margin-bottom: 17px;
}

.field label {
  display: block;
  margin-bottom: 8px;

  color: var(--text);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
}

.field input {
  display: block;
  width: 100%;
  min-height: 49px;
  padding: 13px 14px;

  border: 1px solid var(--border);
  border-radius: 11px;

  outline: none;
  background: var(--input-bg);
  color: var(--text);

  font-size: 15px;

  transition:
    border-color var(--transition),
    background var(--transition);
}

.field input::placeholder {
  color: var(--muted);
  opacity: 0.8;
}

.field input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--soft-bg);
}

.field input:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* FORGOT PASSWORD */

.forgot-row {
  display: flex;
  justify-content: flex-end;
  margin: -3px 0 18px;
}

/* TEXT BUTTONS */

.link-button {
  display: inline-block;
  padding: 4px 0;

  border: 0;
  background: transparent;
  color: var(--primary);

  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
  text-align: left;
}

.link-button:hover {
  text-decoration: underline;
}

.link-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* PRIMARY BUTTON */

.submit-button {
  display: flex;
  width: 100%;
  min-height: 51px;

  align-items: center;
  justify-content: center;

  padding: 13px 18px;

  border: 1px solid var(--primary);
  border-radius: 11px;

  background: var(--primary);
  color: #FFFFFF;

  font-size: 16px;
  font-weight: 800;
  text-align: center;

  transition:
    background var(--transition),
    border-color var(--transition),
    opacity var(--transition);
}

html[data-theme="dark"] .submit-button {
  color: #071A12;
}

.submit-button:hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
  color: #FFFFFF;
}

html[data-theme="dark"] .submit-button:hover {
  color: #071A12;
}

.submit-button:active {
  opacity: 0.85;
}

.submit-button:disabled {
  opacity: 0.65;
  cursor: wait;
}

/* FORM FOOTER */

.form-footer {
  margin-top: 21px;

  color: var(--muted);
  font-size: 14px;
  line-height: 1.9;
  text-align: center;
}

/* AUTH MESSAGES */

.message {
  display: none;
  width: 100%;

  margin-top: 18px;
  padding: 12px;

  border: 1px solid var(--border);
  border-radius: 11px;

  background: var(--soft-bg);
  color: var(--text);

  font-size: 13px;
  line-height: 1.7;

  overflow-wrap: anywhere;
}

.message.show {
  display: block;
}

/* PAGE FOOTER */

.footer {
  width: 100%;
  margin-top: 22px;

  color: var(--muted);
  font-size: 12px;
  line-height: 1.9;
  text-align: center;
}

/* LINKS */

a {
  color: var(--primary);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* MOBILE RESPONSIVE */

@media (max-width: 480px) {
  body {
    padding: 22px 14px;
  }

  .brand {
    margin-bottom: 22px;
  }

  .brand p {
    font-size: 14px;
  }

  .card {
    padding: 22px 18px;
    border-radius: 18px;
  }

  .tabs {
    margin-bottom: 25px;
  }

  .section-subtitle {
    margin-bottom: 22px;
  }

  .field {
    margin-bottom: 18px;
  }
}

@media (max-width: 360px) {
  body {
    padding: 18px 10px;
  }

  .card {
    padding: 18px 14px;
    border-radius: 15px;
  }

  .logo {
    font-size: 31px;
  }

  .section-title {
    font-size: 24px;
  }

  .field input {
    padding: 12px;
    font-size: 14px;
  }

  .submit-button {
    min-height: 48px;
    font-size: 15px;
  }
}

/* ACCESSIBILITY */

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
