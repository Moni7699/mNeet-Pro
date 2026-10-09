(function(){
  const $ = (s, root=document) => root.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
  const msg = (text, bad=false) => { let box=$('#message'); if(!box){box=document.createElement('div');box.id='message';document.body.prepend(box);} box.className='message '+(bad?'error':'');box.textContent=text;box.hidden=false; };
  const getParam = k => new URLSearchParams(location.search).get(k);
  const go = (page, params={}) => { const u=new URL(page,location.href); Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v)); location.href=u.href; };
  const requireUser = () => new Promise((resolve,reject)=>{ if(!window.auth){msg('Firebase load hoyni. Internet/config check korun.',true);reject(new Error('Firebase missing'));return;} const off=auth.onAuthStateChanged(user=>{off();if(!user){go('index.html');reject(new Error('Login required'));}else resolve(user);}); });
  const logout = async()=>{await auth.signOut(); location.href='index.html';};
  const purchaseApproved = async(uid, courseId)=>{ const d=await db.collection('purchases').doc(uid+'_'+courseId).get(); return d.exists && d.data().uid===uid && d.data().courseId===courseId && d.data().status==='approved'; };
  const loadSettings = async()=>{try{let d=await db.collection('settings').doc('payment').get();return d.exists?d.data():{};}catch(e){return {};}};
  window.$ = $; window.MN={$,esc,money,msg,getParam,go,requireUser,logout,purchaseApproved,loadSettings};
  document.addEventListener('click',e=>{const b=e.target.closest('[data-logout]');if(b)logout();});
})();
