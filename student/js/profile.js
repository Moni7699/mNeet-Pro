
"use strict";

let profileData={};

document.addEventListener("DOMContentLoaded",()=>{
    auth.onAuthStateChanged(async user=>{
        if(!user){goTo("index.html");return;}
        profileData=await getStudentData(user.uid)||{};
        renderProfile();
    });
});

function renderProfile(){
    const name=profileData.name||auth.currentUser?.displayName||"Student";
    document.querySelectorAll("[data-profile-name]").forEach(e=>e.textContent=name);
    document.querySelectorAll("[data-profile-email]").forEach(e=>e.textContent=profileData.email||auth.currentUser?.email||"");
    const avatar=document.getElementById("profileAvatar"); if(avatar)avatar.textContent=name.charAt(0).toUpperCase();
    const input=document.getElementById("profileName");if(input)input.value=name;
    const dream=document.getElementById("profileDream");if(dream)dream.value=profileData.targetDream||"";
    const date=document.getElementById("profileTargetDate");if(date)date.value=profileData.targetDate||"";
}

async function saveProfile(){
    const name=document.getElementById("profileName")?.value.trim();
    const dream=document.getElementById("profileDream")?.value.trim();
    const date=document.getElementById("profileTargetDate")?.value;
    if(!name){alert("Name দিন।");return;}
    try{
        await auth.currentUser.updateProfile({displayName:name});
        await saveStudentData({name,targetDream:dream||"",targetDate:date||""});
        alert("Profile updated successfully.");
        profileData={...profileData,name,targetDream:dream||"",targetDate:date||""};
        renderProfile();
    }catch(e){alert(e.message||"Profile update করা যায়নি।");}
}
