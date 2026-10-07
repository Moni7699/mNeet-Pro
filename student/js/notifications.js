=====================================
"use strict";

document.addEventListener("DOMContentLoaded",()=>{
    auth.onAuthStateChanged(async user=>{
        if(!user){goTo("index.html");return;}
        loadNotificationsPage();
    });
});

async function loadNotificationsPage(){
    const box=document.getElementById("notificationsList");
    try{
        const snap=await db.collection("notifications").orderBy("createdAt","desc").limit(50).get();
        box.innerHTML=snap.empty?`<div class="empty">No notifications.</div>`:
            snap.docs.map(d=>{const n=d.data();return `<article class="notification-card"><h3>${escapeHTML(n.title||"Notification")}</h3><p>${escapeHTML(n.message||n.text||"")}</p><small>${formatDate(n.createdAt)}</small></article>`}).join("");
    }catch(e){box.innerHTML=`<div class="empty">Notifications load করা যায়নি।</div>`;}
}
