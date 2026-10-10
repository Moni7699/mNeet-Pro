/* =========================================================
   mNEET — Shared Date & Time Utilities
   File: date-utils.js
   Purpose:
   - Consistent date and time formatting
   - Firebase Timestamp support
   - Date input conversion
   - Date range validation
   - Quiz duration and elapsed-time formatting
   - Safe date comparisons
   Theme: Green & White compatible
   ========================================================= */

(function (window) {
  "use strict";

  const MNEETDateUtils = {};

  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];

  const SHORT_MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const DAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];

  /* ---------------------------------------------------------
     1. Convert supported date values to a valid Date
     Supports:
     - Date
     - Firebase Timestamp
     - Firestore timestamp-like objects
     - Unix milliseconds
     - ISO date strings
     - Firestore seconds/nanoseconds objects
     --------------------------------------------------------- */

  function toDate(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime())
        ? null
        : new Date(value.getTime());
    }

    // Firebase Timestamp
    if (
      typeof value === "object" &&
      typeof value.toDate === "function"
    ) {
      try {
        const converted = value.toDate();

        return converted instanceof Date &&
          !Number.isNaN(converted.getTime())
          ? converted
          : null;
      } catch (error) {
        return null;
      }
    }

    // Firestore timestamp-like object
    if (
      typeof value === "object" &&
      typeof value.seconds === "number"
    ) {
      const milliseconds =
        value.seconds * 1000 +
        Math.floor((value.nanoseconds || 0) / 1000000);

      const converted = new Date(milliseconds);

      return Number.isNaN(converted.getTime())
        ? null
        : converted;
    }

    // JavaScript number: Unix timestamp in milliseconds
    if (typeof value === "number") {
      const converted = new Date(value);

      return Number.isNaN(converted.getTime())
        ? null
        : converted;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (!trimmed) {
        return null;
      }

      // Treat YYYY-MM-DD as a local calendar date.
      const dateOnlyMatch = trimmed.match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

      if (dateOnlyMatch) {
        const year = Number(dateOnlyMatch[1]);
        const month = Number(dateOnlyMatch[2]);
        const day = Number(dateOnlyMatch[3]);

        const converted = new Date(year, month - 1, day);

        if (
          converted.getFullYear() !== year ||
          converted.getMonth() !== month - 1 ||
          converted.getDate() !== day
        ) {
          return null;
        }

        return converted;
      }

      const converted = new Date(trimmed);

      return Number.isNaN(converted.getTime())
        ? null
        : converted;
    }

    return null;
  }

  MNEETDateUtils.toDate = toDate;

  /* ---------------------------------------------------------
     2. Date validity
     --------------------------------------------------------- */

  MNEETDateUtils.isValidDate = function (value) {
    return toDate(value) !== null;
  };

  MNEETDateUtils.isEmptyDate = function (value) {
    return value === null ||
      value === undefined ||
      value === "";
  };

  /* ---------------------------------------------------------
     3. Date formatting
     --------------------------------------------------------- */

  MNEETDateUtils.formatDate = function (
    value,
    options
  ) {
    const date = toDate(value);

    if (!date) {
      return options && options.fallback !== undefined
        ? String(options.fallback)
        : "—";
    }

    const settings = Object.assign(
      {
        style: "long",
        locale: "en-IN"
      },
      options || {}
    );

    if (settings.style === "short") {
      return [
        String(date.getDate()).padStart(2, "0"),
        String(date.getMonth() + 1).padStart(2, "0"),
        date.getFullYear()
      ].join("/");
    }

    if (settings.style === "iso") {
      return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
      ].join("-");
    }

    if (settings.style === "medium") {
      return (
        date.getDate() +
        " " +
        SHORT_MONTHS[date.getMonth()] +
        " " +
        date.getFullYear()
      );
    }

    if (settings.style === "long") {
      return (
        date.getDate() +
        " " +
        MONTHS[date.getMonth()] +
        " " +
        date.getFullYear()
      );
    }

    try {
      return new Intl.DateTimeFormat(
        settings.locale,
        settings.intlOptions || {}
      ).format(date);
    } catch (error) {
      return (
        date.getDate() +
        " " +
        MONTHS[date.getMonth()] +
        " " +
        date.getFullYear()
      );
    }
  };

  /* ---------------------------------------------------------
     4. Time formatting
     --------------------------------------------------------- */

  MNEETDateUtils.formatTime = function (
    value,
    options
  ) {
    const date = toDate(value);

    if (!date) {
      return options && options.fallback !== undefined
        ? String(options.fallback)
        : "—";
    }

    const settings = Object.assign(
      {
        locale: "en-IN",
        hour12: true,
        includeSeconds: false
      },
      options || {}
    );

    const formatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hour12: settings.hour12
    };

    if (settings.includeSeconds) {
      formatOptions.second = "2-digit";
    }

    try {
      return new Intl.DateTimeFormat(
        settings.locale,
        formatOptions
      ).format(date);
    } catch (error) {
      return [
        String(date.getHours()).padStart(2, "0"),
        String(date.getMinutes()).padStart(2, "0")
      ].join(":");
    }
  };

  /* ---------------------------------------------------------
     5. Date and time together
     --------------------------------------------------------- */

  MNEETDateUtils.formatDateTime = function (
    value,
    options
  ) {
    const date = toDate(value);

    if (!date) {
      return options && options.fallback !== undefined
        ? String(options.fallback)
        : "—";
    }

    const settings = Object.assign(
      {
        locale: "en-IN",
        hour12: true,
        style: "long"
      },
      options || {}
    );

    return (
      MNEETDateUtils.formatDate(date, {
        style: settings.style,
        locale: settings.locale
      }) +
      " · " +
      MNEETDateUtils.formatTime(date, {
        locale: settings.locale,
        hour12: settings.hour12,
        includeSeconds: settings.includeSeconds
      })
    );
  };

  /* ---------------------------------------------------------
     6. Convert a date to HTML input format
     --------------------------------------------------------- */

  MNEETDateUtils.toDateInputValue = function (value) {
    const date = toDate(value);

    if (!date) {
      return "";
    }

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  };

  MNEETDateUtils.toDateTimeLocalValue = function (value) {
    const date = toDate(value);

    if (!date) {
      return "";
    }

    return (
      MNEETDateUtils.toDateInputValue(date) +
      "T" +
      String(date.getHours()).padStart(2, "0") +
      ":" +
      String(date.getMinutes()).padStart(2, "0")
    );
  };

  /* ---------------------------------------------------------
     7. Start and end date validation
     --------------------------------------------------------- */

  MNEETDateUtils.isValidDateRange = function (
    startValue,
    endValue,
    options
  ) {
    const settings = Object.assign(
      {
        allowMissingStart: true,
        allowMissingEnd: true,
        allowEqual: true
      },
      options || {}
    );

    const startMissing = MNEETDateUtils.isEmptyDate(
      startValue
    );

    const endMissing = MNEETDateUtils.isEmptyDate(
      endValue
    );

    if (startMissing && !settings.allowMissingStart) {
      return {
        valid: false,
        message: "Start date is required."
      };
    }

    if (endMissing && !settings.allowMissingEnd) {
      return {
        valid: false,
        message: "End date is required."
      };
    }

    const start = startMissing ? null : toDate(startValue);
    const end = endMissing ? null : toDate(endValue);

    if (!startMissing && !start) {
      return {
        valid: false,
        message: "Start date is invalid."
      };
    }

    if (!endMissing && !end) {
      return {
        valid: false,
        message: "End date is invalid."
      };
    }

    if (start && end) {
      if (settings.allowEqual && start.getTime() > end.getTime()) {
        return {
          valid: false,
          message: "End date must be on or after the start date."
        };
      }

      if (!settings.allowEqual && start.getTime() >= end.getTime()) {
        return {
          valid: false,
          message: "End date must be after the start date."
        };
      }
    }

    return {
      valid: true,
      message: ""
    };
  };

  /* ---------------------------------------------------------
     8. Date comparison
     --------------------------------------------------------- */

  MNEETDateUtils.compareDates = function (
    firstValue,
    secondValue
  ) {
    const first = toDate(firstValue);
    const second = toDate(secondValue);

    if (!first || !second) {
      return null;
    }

    if (first.getTime() < second.getTime()) {
      return -1;
    }

    if (first.getTime() > second.getTime()) {
      return 1;
    }

    return 0;
  };

  MNEETDateUtils.isBefore = function (
    firstValue,
    secondValue
  ) {
    return MNEETDateUtils.compareDates(
      firstValue,
      secondValue
    ) === -1;
  };

  MNEETDateUtils.isAfter = function (
    firstValue,
    secondValue
  ) {
    return MNEETDateUtils.compareDates(
      firstValue,
      secondValue
    ) === 1;
  };

  MNEETDateUtils.isSameDate = function (
    firstValue,
    secondValue
  ) {
    const first = toDate(firstValue);
    const second = toDate(secondValue);

    if (!first || !second) {
      return false;
    }

    return (
      first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate()
    );
  };

  /* ---------------------------------------------------------
     9. Course availability dates
     --------------------------------------------------------- */

  MNEETDateUtils.isWithinDateRange = function (
    startValue,
    endValue,
    referenceValue
  ) {
    const reference = toDate(
      referenceValue === undefined
        ? new Date()
        : referenceValue
    );

    if (!reference) {
      return false;
    }

    const startMissing = MNEETDateUtils.isEmptyDate(
      startValue
    );

    const endMissing = MNEETDateUtils.isEmptyDate(
      endValue
    );

    const start = startMissing ? null : toDate(startValue);
    const end = endMissing ? null : toDate(endValue);

    if (!startMissing && !start) {
      return false;
    }

    if (!endMissing && !end) {
      return false;
    }

    if (start && reference.getTime() < start.getTime()) {
      return false;
    }

    if (end && reference.getTime() > end.getTime()) {
      return false;
    }

    return true;
  };

  /* ---------------------------------------------------------
     10. Relative date labels
     --------------------------------------------------------- */

  MNEETDateUtils.getRelativeDateLabel = function (
    value,
    referenceValue
  ) {
    const date = toDate(value);
    const reference = toDate(
      referenceValue === undefined
        ? new Date()
        : referenceValue
    );

    if (!date || !reference) {
      return "—";
    }

    const dateDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    const referenceDay = new Date(
      reference.getFullYear(),
      reference.getMonth(),
      reference.getDate()
    );

    const difference = Math.round(
      (dateDay.getTime() - referenceDay.getTime()) /
      86400000
    );

    if (difference === 0) {
      return "Today";
    }

    if (difference === -1) {
      return "Yesterday";
    }

    if (difference === 1) {
      return "Tomorrow";
    }

    if (difference < 0) {
      return Math.abs(difference) + " days ago";
    }

    return "In " + difference + " days";
  };

  /* ---------------------------------------------------------
     11. Duration formatting for quiz timers and results
     --------------------------------------------------------- */

  MNEETDateUtils.formatDuration = function (
    totalSeconds,
    options
  ) {
    const settings = Object.assign(
      {
        includeSeconds: true,
        compact: false
      },
      options || {}
    );

    const numericValue = Number(totalSeconds);

    if (!Number.isFinite(numericValue)) {
      return "—";
    }

    const total = Math.max(
      0,
      Math.floor(numericValue)
    );

    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;

    if (settings.compact) {
      if (hours > 0) {
        return (
          hours +
          "h " +
          String(minutes).padStart(2, "0") +
          "m"
        );
      }

      if (minutes > 0) {
        return (
          minutes +
          "m " +
          String(seconds).padStart(2, "0") +
          "s"
        );
      }

      return seconds + "s";
    }

    if (hours > 0) {
      return (
        String(hours).padStart(2, "0") +
        ":" +
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0")
      );
    }

    if (settings.includeSeconds) {
      return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0")
      );
    }

    return String(minutes).padStart(2, "0") + " min";
  };

  /* ---------------------------------------------------------
     12. Calculate elapsed seconds
     --------------------------------------------------------- */

  MNEETDateUtils.getElapsedSeconds = function (
    startValue,
    endValue
  ) {
    const start = toDate(startValue);
    const end = toDate(
      endValue === undefined
        ? new Date()
        : endValue
    );

    if (!start || !end) {
      return null;
    }

    return Math.max(
      0,
      Math.floor(
        (end.getTime() - start.getTime()) / 1000
      )
    );
  };

  /* ---------------------------------------------------------
     13. Start-of-day and end-of-day
     --------------------------------------------------------- */

  MNEETDateUtils.startOfDay = function (value) {
    const date = toDate(value);

    if (!date) {
      return null;
    }

    date.setHours(0, 0, 0, 0);
    return date;
  };

  MNEETDateUtils.endOfDay = function (value) {
    const date = toDate(value);

    if (!date) {
      return null;
    }

    date.setHours(23, 59, 59, 999);
    return date;
  };

  /* ---------------------------------------------------------
     14. Add days without changing the original date
     --------------------------------------------------------- */

  MNEETDateUtils.addDays = function (
    value,
    days
  ) {
    const date = toDate(value);
    const amount = Number(days);

    if (!date || !Number.isFinite(amount)) {
      return null;
    }

    date.setDate(date.getDate() + Math.trunc(amount));

    return date;
  };

  /* ---------------------------------------------------------
     15. Get calendar information
     --------------------------------------------------------- */

  MNEETDateUtils.getCalendarParts = function (value) {
    const date = toDate(value);

    if (!date) {
      return null;
    }

    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      monthName: MONTHS[date.getMonth()],
      shortMonthName: SHORT_MONTHS[date.getMonth()],
      day: date.getDate(),
      dayName: DAYS[date.getDay()],
      dayOfWeek: date.getDay(),
      hours: date.getHours(),
      minutes: date.getMinutes(),
      seconds: date.getSeconds(),
      milliseconds: date.getMilliseconds()
    };
  };

  /* ---------------------------------------------------------
     16. Date for sorting
     Invalid/missing values sort as zero.
     --------------------------------------------------------- */

  MNEETDateUtils.getTimestamp = function (value) {
    const date = toDate(value);

    return date ? date.getTime() : 0;
  };

  MNEETDateUtils.sortAscending = function (
    firstValue,
    secondValue
  ) {
    return (
      MNEETDateUtils.getTimestamp(firstValue) -
      MNEETDateUtils.getTimestamp(secondValue)
    );
  };

  MNEETDateUtils.sortDescending = function (
    firstValue,
    secondValue
  ) {
    return (
      MNEETDateUtils.getTimestamp(secondValue) -
      MNEETDateUtils.getTimestamp(firstValue)
    );
  };

  /* ---------------------------------------------------------
     17. Human-readable date/time for notices
     --------------------------------------------------------- */

  MNEETDateUtils.getAnnouncementDateLabel = function (
    value,
    referenceValue
  ) {
    const date = toDate(value);

    if (!date) {
      return "—";
    }

    const relative = MNEETDateUtils.getRelativeDateLabel(
      date,
      referenceValue
    );

    return (
      relative +
      " · " +
      MNEETDateUtils.formatTime(date)
    );
  };

  /* ---------------------------------------------------------
     18. Get current date and time
     --------------------------------------------------------- */

  MNEETDateUtils.now = function () {
    return new Date();
  };

  MNEETDateUtils.nowAsDateInput = function () {
    return MNEETDateUtils.toDateInputValue(
      new Date()
    );
  };

  MNEETDateUtils.nowAsDateTimeLocalInput = function () {
    return MNEETDateUtils.toDateTimeLocalValue(
      new Date()
    );
  };

  /* ---------------------------------------------------------
     19. Safe conversion to ISO string
     --------------------------------------------------------- */

  MNEETDateUtils.toISOString = function (value) {
    const date = toDate(value);

    return date ? date.toISOString() : "";
  };

  /* ---------------------------------------------------------
     20. Public constants
     --------------------------------------------------------- */

  MNEETDateUtils.MONTHS = Object.freeze(
    MONTHS.slice()
  );

  MNEETDateUtils.SHORT_MONTHS = Object.freeze(
    SHORT_MONTHS.slice()
  );

  MNEETDateUtils.DAYS = Object.freeze(
    DAYS.slice()
  );

  window.MNEETDateUtils = Object.freeze(
    MNEETDateUtils
  );

})(window);
