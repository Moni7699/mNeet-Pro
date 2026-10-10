"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");

const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

setGlobalOptions({
  region: "asia-south1",
  maxInstances: 10
});

// =====================================================
// 1. SHARED AUTHORIZATION HELPERS
// =====================================================

function requireSignedIn(request) {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "এই কাজের জন্য প্রথমে লগ-ইন করো।"
    );
  }

  return request.auth.uid;
}

async function requireAdmin(request) {
  const uid = requireSignedIn(request);

  const adminDoc = await db.collection("admins").doc(uid).get();

  if (!adminDoc.exists || adminDoc.data().active !== true) {
    throw new HttpsError(
      "permission-denied",
      "এই কাজটি করার অনুমতি তোমার নেই।"
    );
  }

  return {
    uid,
    data: adminDoc.data()
  };
}

function requireString(value, fieldName, maxLength = 200) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.trim().length > maxLength
  ) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} সঠিকভাবে দিতে হবে।`
    );
  }

  return value.trim();
}

function approvedPurchaseStatus(status) {
  return ["approved", "paid", "completed"].includes(
    String(status || "").toLowerCase()
  );
}

function safeInteger(value, fieldName, min, max) {
  if (
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} সঠিক নয়।`
    );
  }

  return value;
}


// =====================================================
// 2. ADMIN APPROVES OR REJECTS A PAYMENT
// =====================================================
//
// Input:
// {
//   purchaseId: "Firestore purchase document ID",
//   decision: "approve" | "reject"
// }
//
// This callable is the only supported client-facing
// approval workflow in this file.
// =====================================================

exports.reviewPurchase = onCall(async (request) => {
  const adminUser = await requireAdmin(request);

  const purchaseId = requireString(
    request.data?.purchaseId,
    "Purchase ID",
    200
  );

  const decision = requireString(
    request.data?.decision,
    "Decision",
    20
  ).toLowerCase();

  if (!["approve", "reject"].includes(decision)) {
    throw new HttpsError(
      "invalid-argument",
      "Decision approve অথবা reject হতে হবে।"
    );
  }

  const purchaseRef = db.collection("purchases").doc(purchaseId);

  return db.runTransaction(async (transaction) => {
    const purchaseSnap = await transaction.get(purchaseRef);

    if (!purchaseSnap.exists) {
      throw new HttpsError(
        "not-found",
        "Payment request পাওয়া যায়নি।"
      );
    }

    const purchase = purchaseSnap.data();

    if (purchase.status !== "pending") {
      throw new HttpsError(
        "failed-precondition",
        "এই Payment Request ইতিমধ্যে Review করা হয়েছে।"
      );
    }

    const studentId = requireString(
      purchase.userId,
      "Student ID",
      200
    );

    const courseId = requireString(
      purchase.courseId,
      "Course ID",
      200
    );

    const courseRef = db.collection("courses").doc(courseId);
    const courseSnap = await transaction.get(courseRef);

    if (!courseSnap.exists) {
      throw new HttpsError(
        "not-found",
        "Course পাওয়া যায়নি।"
      );
    }

    const now = FieldValue.serverTimestamp();

    const newStatus = decision === "approve"
      ? "approved"
      : "rejected";

    transaction.update(purchaseRef, {
      status: newStatus,
      paymentStatus: newStatus,
      approvalStatus: newStatus,
      reviewedBy: adminUser.uid,
      reviewedAt: now,
      updatedAt: now
    });

    const accessId = `${studentId}_${courseId}`;
    const accessRef = db.collection("courseAccess").doc(accessId);

    if (decision === "approve") {
      transaction.set(accessRef, {
        userId: studentId,
        courseId,
        purchaseId,
        active: true,
        grantedBy: adminUser.uid,
        grantedAt: now,
        updatedAt: now
      });
    } else {
      // A rejected request must not grant new access.
      // Existing approved access is not revoked here,
      // because another approved purchase may exist.
      transaction.set(
        accessRef,
        {
          userId: studentId,
          courseId,
          lastRejectedPurchaseId: purchaseId,
          updatedAt: now
        },
        { merge: true }
      );
    }

    logger.info("Purchase reviewed", {
      purchaseId,
      studentId,
      courseId,
      decision,
      reviewedBy: adminUser.uid
    });

    return {
      success: true,
      purchaseId,
      status: newStatus,
      courseId
    };
  });
});


// =====================================================
// 3. CHECK IF STUDENT HAS APPROVED COURSE ACCESS
// =====================================================

exports.checkCourseAccess = onCall(async (request) => {
  const uid = requireSignedIn(request);

  const courseId = requireString(
    request.data?.courseId,
    "Course ID",
    200
  );

  const accessId = `${uid}_${courseId}`;

  const accessSnap = await db
    .collection("courseAccess")
    .doc(accessId)
    .get();

  if (!accessSnap.exists) {
    return {
      hasAccess: false,
      courseId
    };
  }

  const access = accessSnap.data();

  return {
    hasAccess:
      access.userId === uid &&
      access.courseId === courseId &&
      access.active === true,
    courseId
  };
});


// =====================================================
// 4. GET A QUIZ WITHOUT ANSWER KEYS
// =====================================================
//
// Student-facing question data is read from the protected
// question collection by this trusted backend.
//
// The backend removes answer keys and solutions before
// returning question data to the student.
// =====================================================

exports.getQuizForStudent = onCall(async (request) => {
  const uid = requireSignedIn(request);

  const quizId = requireString(
    request.data?.quizId,
    "Quiz ID",
    200
  );

  const quizRef = db.collection("quizzes").doc(quizId);
  const quizSnap = await quizRef.get();

  if (!quizSnap.exists) {
    throw new HttpsError("not-found", "Quiz পাওয়া যায়নি।");
  }

  const quiz = quizSnap.data();

  if (quiz.active === false || quiz.published === false) {
    throw new HttpsError(
      "failed-precondition",
      "এই Quiz বর্তমানে উপলব্ধ নয়।"
    );
  }

  const courseId = requireString(
    quiz.courseId,
    "Quiz Course ID",
    200
  );

  const accessSnap = await db
    .collection("courseAccess")
    .doc(`${uid}_${courseId}`)
    .get();

  if (
    !accessSnap.exists ||
    accessSnap.data().userId !== uid ||
    accessSnap.data().active !== true
  ) {
    throw new HttpsError(
      "permission-denied",
      "এই Quiz দেখতে Course Access প্রয়োজন।"
    );
  }

  const questionsSnap = await db
    .collection("questions")
    .where("quizId", "==", quizId)
    .get();

  const questions = questionsSnap.docs
    .map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        order: Number.isFinite(data.order) ? data.order : 0,
        questionText: data.questionText || data.text || "",
        questionImage: data.questionImage || data.imageUrl || "",
        options: Array.isArray(data.options)
          ? data.options
          : [
              data.option1 || "",
              data.option2 || "",
              data.option3 || "",
              data.option4 || ""
            ],
        type: data.type || quiz.type || "topic"
      };
    })
    .sort((a, b) => a.order - b.order);

  return {
    quiz: {
      id: quizSnap.id,
      title: quiz.title || quiz.name || "Practice Quiz",
      courseId,
      chapterId: quiz.chapterId || "",
      topicId: quiz.topicId || "",
      type: quiz.type || "topic",
      questionTime: Number(quiz.questionTime) || 60,
      totalTime: Number(quiz.totalTime) || 0,
      totalQuestions: questions.length
    },
    questions
  };
});


// =====================================================
// 5. SUBMIT AND GRADE A QUIZ SECURELY
// =====================================================
//
// Input:
// {
//   quizId: "...",
//   answers: [
//     { questionId: "...", selectedOption: "A" }
//   ]
// }
//
// The client does not submit its own score.
// The backend checks the answers and calculates the result.
// =====================================================

exports.submitQuiz = onCall(async (request) => {
  const uid = requireSignedIn(request);

  const quizId = requireString(
    request.data?.quizId,
    "Quiz ID",
    200
  );

  const answers = request.data?.answers;

  if (!Array.isArray(answers) || answers.length > 1000) {
    throw new HttpsError(
      "invalid-argument",
      "Quiz answers সঠিকভাবে পাঠানো হয়নি।"
    );
  }

  const quizRef = db.collection("quizzes").doc(quizId);
  const quizSnap = await quizRef.get();

  if (!quizSnap.exists) {
    throw new HttpsError("not-found", "Quiz পাওয়া যায়নি।");
  }

  const quiz = quizSnap.data();

  if (quiz.active === false || quiz.published === false) {
    throw new HttpsError(
      "failed-precondition",
      "এই Quiz বর্তমানে উপলব্ধ নয়।"
    );
  }

  const courseId = requireString(
    quiz.courseId,
    "Quiz Course ID",
    200
  );

  const accessSnap = await db
    .collection("courseAccess")
    .doc(`${uid}_${courseId}`)
    .get();

  if (
    !accessSnap.exists ||
    accessSnap.data().userId !== uid ||
    accessSnap.data().active !== true
  ) {
    throw new HttpsError(
      "permission-denied",
      "এই Quiz Submit করার জন্য Course Access প্রয়োজন।"
    );
  }

  const questionSnap = await db
    .collection("questions")
    .where("quizId", "==", quizId)
    .get();

  if (questionSnap.empty) {
    throw new HttpsError(
      "failed-precondition",
      "এই Quiz-এ কোনো Question পাওয়া যায়নি।"
    );
  }

  const questionMap = new Map();

  questionSnap.docs.forEach((doc) => {
    questionMap.set(doc.id, {
      id: doc.id,
      ...doc.data()
    });
  });

  const answerMap = new Map();

  for (const answer of answers) {
    if (
      !answer ||
      typeof answer.questionId !== "string" ||
      typeof answer.selectedOption !== "string"
    ) {
      throw new HttpsError(
        "invalid-argument",
        "কোনো Answer সঠিক format-এ নেই।"
      );
    }

    if (!questionMap.has(answer.questionId)) {
      throw new HttpsError(
        "invalid-argument",
        "এই Quiz-এর অন্তর্ভুক্ত নয় এমন Question পাঠানো হয়েছে।"
      );
    }

    if (answerMap.has(answer.questionId)) {
      throw new HttpsError(
        "invalid-argument",
        "একই Question-এর একাধিক Answer পাঠানো হয়েছে।"
      );
    }

    answerMap.set(
      answer.questionId,
      answer.selectedOption.trim()
    );
  }

  const settingsSnap = await db
    .collection("settings")
    .doc("general")
    .get();

  const settings = settingsSnap.exists
    ? settingsSnap.data()
    : {};

  const positiveMarks = Number.isFinite(settings.positiveMarks)
    ? settings.positiveMarks
    : 4;

  const negativeMarks = Number.isFinite(settings.negativeMarks)
    ? settings.negativeMarks
    : 1;

  const totalQuestions = questionMap.size;

  let correct = 0;
  let incorrect = 0;
  let skipped = 0;
  let score = 0;

  const review = [];

  for (const [questionId, question] of questionMap.entries()) {
    const selected = answerMap.get(questionId) || "";

    const correctAnswer = String(
      question.correctAnswer ||
      question.correctOption ||
      question.answer ||
      ""
    ).trim();

    if (!selected) {
      skipped++;

      review.push({
        questionId,
        selectedOption: "",
        status: "skipped"
      });

      continue;
    }

    if (!correctAnswer) {
      throw new HttpsError(
        "failed-precondition",
        `Question ${questionId}-এর সঠিক Answer Admin-কে সেট করতে হবে।`
      );
    }

    const normalise = (value) => {
      const text = String(value).trim().toUpperCase();

      if (["1", "OPTION1", "OPTION A"].includes(text)) return "A";
      if (["2", "OPTION2", "OPTION B"].includes(text)) return "B";
      if (["3", "OPTION3", "OPTION C"].includes(text)) return "C";
      if (["4", "OPTION4", "OPTION D"].includes(text)) return "D";

      return text;
    };

    const isCorrect =
      normalise(selected) === normalise(correctAnswer);

    if (isCorrect) {
      correct++;
      score += positiveMarks;
    } else {
      incorrect++;
      score -= negativeMarks;
    }

    review.push({
      questionId,
      selectedOption: selected,
      status: isCorrect ? "correct" : "incorrect"
    });
  }

  const accuracy = totalQuestions > 0
    ? Math.round((correct / totalQuestions) * 10000) / 100
    : 0;

  const attemptRef = db.collection("quizAttempts").doc();
  const resultRef = db.collection("quizResults").doc();

  const now = FieldValue.serverTimestamp();

  const result = {
    userId: uid,
    quizId,
    courseId,
    chapterId: quiz.chapterId || "",
    topicId: quiz.topicId || "",
    totalQuestions,
    correct,
    incorrect,
    skipped,
    score,
    accuracy,
    review,
    createdAt: now
  };

  await db.runTransaction(async (transaction) => {
    transaction.set(attemptRef, {
      ...result,
      submittedAt: now,
      status: "submitted"
    });

    transaction.set(resultRef, {
      ...result,
      attemptId: attemptRef.id
    });
  });

  logger.info("Quiz submitted and graded", {
    uid,
    quizId,
    attemptId: attemptRef.id,
    resultId: resultRef.id,
    score
  });

  return {
    success: true,
    attemptId: attemptRef.id,
    resultId: resultRef.id,
    totalQuestions,
    correct,
    incorrect,
    skipped,
    score,
    accuracy,
    review
  };
});


// =====================================================
// 6. KEEP ACCESS RECORD CONSISTENT WHEN A PURCHASE
// DOCUMENT IS CHANGED OUTSIDE THE REVIEW FUNCTION
// =====================================================
//
// Direct student writes are blocked by Firestore Rules.
// This trigger is a second layer of protection.
// =====================================================

exports.syncPurchaseAccess = onDocumentUpdated(
  "purchases/{purchaseId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (!before || !after) return;

    // Only process actual status transitions.
    if (before.status === after.status) return;

    const studentId = after.userId;
    const courseId = after.courseId;

    if (
      typeof studentId !== "string" ||
      typeof courseId !== "string"
    ) {
      logger.error("Purchase is missing userId/courseId", {
        purchaseId: event.params.purchaseId
      });
      return;
    }

    const accessRef = db
      .collection("courseAccess")
      .doc(`${studentId}_${courseId}`);

    if (approvedPurchaseStatus(after.status)) {
      await accessRef.set(
        {
          userId: studentId,
          courseId,
          purchaseId: event.params.purchaseId,
          active: true,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      return;
    }

    if (after.status === "rejected") {
      // Do not revoke access if another approved purchase
      // exists for this same student and course.
      const otherApproved = await db
        .collection("purchases")
        .where("userId", "==", studentId)
        .where("courseId", "==", courseId)
        .get();

      const stillApproved = otherApproved.docs.some((doc) => {
        if (doc.id === event.params.purchaseId) return false;

        return approvedPurchaseStatus(doc.data().status);
      });

      if (!stillApproved) {
        await accessRef.set(
          {
            userId: studentId,
            courseId,
            active: false,
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      }
    }
  }
);
