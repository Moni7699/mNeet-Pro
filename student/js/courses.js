"use strict";

/* =====================================================
   mNEET-PRO
   COURSES PAGE
===================================================== */

let coursesUser = null;
let allCourses = [];


/* =====================================================
   AUTH
===================================================== */

auth.onAuthStateChanged(async function(user){

    if(!user){

        window.location.replace("index.html");
        return;

    }

    coursesUser = user;

    loadTheme();

    await loadCourses();

});


/* =====================================================
   LOAD COURSES
===================================================== */

async function loadCourses(){

    const container =
        document.getElementById("courseList");

    if(!container){
        return;
    }

    container.innerHTML = `
        <div class="empty-state">
            Loading courses...
        </div>
    `;

    try{

        const snapshot =
            await db
                .collection("courses")
                .get();

        allCourses = [];

        snapshot.forEach(function(doc){

            allCourses.push({

                id: doc.id,

                ...doc.data()

            });

        });


        if(!allCourses.length){

            container.innerHTML = `
                <div class="empty-state">
                    <div style="font-size:35px;">📚</div>
                    <div style="margin-top:10px;">
                        No courses available yet.
                    </div>
                </div>
            `;

            return;

        }


        await renderPurchasedCourses();

    }catch(error){

        console.error(
            "Courses load error:",
            error
        );

        container.innerHTML = `
            <div class="empty-state">
                Course load করা যায়নি।
                <br>
                Internet connection check করুন।
            </div>
        `;

    }

}


/* =====================================================
   PURCHASED COURSES
===================================================== */

async function renderPurchasedCourses(){

    const container =
        document.getElementById("courseList");

    if(!container){
        return;
    }

    container.innerHTML = "";

    let purchasedCount = 0;


    for(
        const course of allCourses
    ){

        let purchased = false;

        try{

            const purchaseDoc =
                await db
                    .collection("purchases")
                    .doc(coursesUser.uid)
                    .get();


            if(purchaseDoc.exists){

                const purchaseData =
                    purchaseDoc.data() || {};

                purchased =
                    purchaseData[
                        course.id
                    ] === true;

            }

        }catch(error){

            console.error(
                "Purchase check error:",
                error
            );

        }


        if(purchased){

            purchasedCount++;

            container.appendChild(
                createCourseCard(
                    course,
                    true
                )
            );

        }

    }


    /*
     * If user has no purchased course,
     * show all available courses as locked/buy.
     */

    if(!purchasedCount){

        allCourses.forEach(
            function(course){

                container.appendChild(
                    createCourseCard(
                        course,
                        false
                    )
                );

            }
        );

    }

}


/* =====================================================
   COURSE CARD
===================================================== */

function createCourseCard(
    course,
    purchased
){

    const card =
        document.createElement(
            "div"
        );

    card.className =
        "card";

    card.style.marginBottom =
        "14px";


    const title =
        escapeHtml(
            course.title ||
            course.name ||
            "Biology Course"
        );


    const description =
        escapeHtml(
            course.description ||
            "Complete NEET Biology preparation course."
        );


    const price =
        course.price != null
            ? "₹" + course.price
            : "Course";


    card.innerHTML = `

        <div
            style="
                display:flex;
                gap:13px;
                align-items:flex-start;
            "
        >

            <div
                style="
                    width:52px;
                    height:52px;
                    border-radius:14px;
                    background:#e8f5e9;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:24px;
                    flex-shrink:0;
                "
            >
                📚
            </div>


            <div style="flex:1;">

                <div
                    style="
                        font-size:15px;
                        font-weight:900;
                    "
                >
                    ${title}
                </div>


                <div
                    style="
                        margin-top:5px;
                        color:#718078;
                        font-size:10px;
                        line-height:1.5;
                    "
                >
                    ${description}
                </div>


                <div
                    style="
                        margin-top:9px;
                        color:#0d6035;
                        font-size:14px;
                        font-weight:900;
                    "
                >
                    ${price}
                </div>

            </div>

        </div>


        <button
            class="${
                purchased
                    ? "primary-btn"
                    : "secondary-btn"
            }"
            style="margin-top:14px;"
            onclick="${
                purchased
                    ? `openCourse('${course.id}')`
                    : `buyCourse('${course.id}')`
            }"
        >

            ${
                purchased
                    ? "Open Course"
                    : "🔒 Buy Course"
            }

        </button>

    `;


    return card;

}


/* =====================================================
   OPEN COURSE
===================================================== */

async function openCourse(
    courseId
){

    if(!courseId){
        return;
    }

    setActiveCourse(
        courseId
    );


    if(coursesUser){

        try{

            await db
                .collection("students")
                .doc(coursesUser.uid)
                .set({

                    selectedCourse:
                        courseId,

                    updatedAt:
                        firebase.firestore.FieldValue
                            .serverTimestamp()

                },{
                    merge:true
                });

        }catch(error){

            console.error(
                "Selected course save error:",
                error
            );

        }

    }


    window.location.href =
        "course.html";

}


/* =====================================================
   BUY COURSE
===================================================== */

function buyCourse(
    courseId
){

    if(!courseId){
        return;
    }


    /*
     * Payment gateway will be connected later.
     * For now user is sent to a purchase page
     * if available.
     */

    localStorage.setItem(
        "pendingCourse",
        courseId
    );


    if(
        document.body.dataset.purchasePage ===
        "true"
    ){

        return;

    }


    const confirmed =
        confirm(
            "এই course purchase করতে চান?"
        );


    if(!confirmed){
        return;
    }


    /*
     * IMPORTANT:
     * Do NOT mark a course as purchased
     * without successful payment.
     */

    alert(
        "Purchase system এখনও connect করা হয়নি। Payment system connect করার পর এখানে automatic access দেওয়া হবে।"
    );

}
