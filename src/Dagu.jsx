// DaguUltimate.jsx — Production-Grade Social Media App
// Firebase + Cloudinary + EmailJS + Real-time Features

import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, limit, where, getDocs, serverTimestamp, increment, arrayUnion, arrayRemove } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

/* ── FIREBASE CONFIG ── */
const firebaseConfig = {
  apiKey: "AIzaSyD9jDk8gijMVAYrsFe4vpojI7GyZnkzGL8",
  authDomain: "dagu-8348c.firebaseapp.com",
  projectId: "dagu-8348c",
  storageBucket: "dagu-8348c.firebasestorage.app",
  messagingSenderId: "259738670911",
  appId: "1:259738670911:web:c4d1116e3697a8f67c658a",
  measurementId: "G-KJW3QQJ26X"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

/* ── CLOUDINARY CONFIG ── */
const CLOUDINARY = {
  cloudName: 'dotvhzjmc',
  uploadPreset: 'g3c7dwdg',
  apiKey: '663977984666791',
};

/* ── EMAILJS CONFIG ── */
const EMAILJS = {
  serviceId: 'service_mtqmvbb',
  templateId: 'template_1k7wiqa',
  publicKey: 'U9fs25Bcx5oQ6A2ru',
};

/* ── CONSTANTS ── */
const AVATAR_COLORS = ['#FF2D55','#AF52DE','#007AFF','#FF9500','#34C759','#00C7BE','#FF3B30','#5856D6','#32ADE6','#FF6B6B','#FFD60A','#30D158'];
const formatNumber = n => { if(!n) return '0'; if(n>=1000000) return (n/1000000).toFixed(1)+'M'; if(n>=1000) return (n/1000).toFixed(1)+'K'; return String(n); };
const timeAgo = ts => { if(!ts) return ''; const d = ts.toDate ? ts.toDate() : new Date(ts); const s=Math.floor((Date.now()-d)/1000); if(s<60) return `${s}s`; if(s<3600) return `${Math.floor(s/60)}m`; if(s<86400) return `${Math.floor(s/3600)}h`; return `${Math.floor(s/86400)}d`; };

/* ── CLOUDINARY UPLOAD ── */
const uploadToCloudinary = async (file, onProgress) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY.uploadPreset);
  fd.append('cloud_name', CLOUDINARY.cloudName);
  const resourceType = file.type.startsWith('video') ? 'video' : 'image';
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/${resourceType}/upload`);
    xhr.upload.onprogress = e => { if(e.lengthComputable) onProgress?.(Math.round((e.loaded/e.total)*100)); };
    xhr.onload = () => { const r = JSON.parse(xhr.responseText); if(r.secure_url) resolve(r.secure_url); else reject(r); };
    xhr.onerror = reject;
    xhr.send(fd);
  });
};

/* ── GLOBAL STYLES ── */
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    body,html{height:100%;overflow:hidden;background:#050505;font-family:'DM Sans',sans-serif}
    ::-webkit-scrollbar{display:none}
    input,textarea,button{font-family:'DM Sans',sans-serif}
    @keyframes heartBurst{0%{transform:scale(0.3) translate(-50%,-50%);opacity:1}100%{transform:scale(2.5) translate(-50%,-50%);opacity:0}}
    @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes bounce{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}
    @keyframes ringPulse{0%{box-shadow:0 0 0 0 rgba(255,45,85,0.5)}100%{box-shadow:0 0 0 16px rgba(255,45,85,0)}}
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes floatUp{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-100px);opacity:0}}
    button:active{transform:scale(0.93)!important}
  `}</style>
);

/* ── LOADING SPINNER ── */
const Spinner = ({size=24,color='#FF2D55'}) => (
  <div style={{width:size,height:size,border:`2.5px solid rgba(255,255,255,0.1)`,borderTop:`2.5px solid ${color}`,borderRadius:'50%',animation:'spin 0.8s linear infinite'}} />
);

/* ── TOAST ── */
const Toast = ({message,type='info',onClose}) => {
  useEffect(()=>{const t=setTimeout(onClose,3000);return()=>clearTimeout(t);},[onClose]);
  const colors = {success:'#06D6A0',error:'#FF2D55',info:'#007AFF',warning:'#FF9500'};
  const icons = {success:'✓',error:'✕',info:'i',warning:'!'};
  return (
    <div style={{position:'fixed',bottom:100,left:'50%',transform:'translateX(-50%)',zIndex:9999,animation:'slideUp 0.3s ease',display:'flex',alignItems:'center',gap:10,background:'rgba(10,10,10,0.95)',backdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:40,padding:'10px 18px 10px 10px',boxShadow:'0 12px 40px rgba(0,0,0,0.6)',whiteSpace:'nowrap',maxWidth:'calc(100vw - 32px)'}}>
      <div style={{width:26,height:26,borderRadius:'50%',background:colors[type],display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:800,fontSize:13,flexShrink:0}}>{icons[type]}</div>
      <span style={{color:'white',fontSize:13,fontWeight:500}}>{message}</span>
    </div>
  );
};

/* ── UPLOAD PROGRESS ── */
const UploadProgress = ({progress,label}) => (
  <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:9000,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20}}>
    <div style={{width:80,height:80,position:'relative',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <svg width="80" height="80" style={{position:'absolute',transform:'rotate(-90deg)'}}>
        <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6"/>
        <circle cx="40" cy="40" r="36" fill="none" stroke="#FF2D55" strokeWidth="6" strokeDasharray={`${2*Math.PI*36*progress/100} ${2*Math.PI*36}`} strokeLinecap="round"/>
      </svg>
      <span style={{color:'white',fontWeight:800,fontSize:18,fontFamily:"'Syne',sans-serif"}}>{progress}%</span>
    </div>
    <div style={{color:'rgba(255,255,255,0.6)',fontSize:14}}>{label||'Uploading...'}</div>
  </div>
);

/* ── AUTH SCREEN ── */
const AuthScreen = ({onAuth,showToast}) => {
  const [mode,setMode] = useState('login');
  const [step,setStep] = useState('form');
  const [loading,setLoading] = useState(false);
  const [form,setForm] = useState({email:'',password:'',username:'',fullName:'',otp:''});
  const [generatedOtp,setGeneratedOtp] = useState('');
  const [otpTimer,setOtpTimer] = useState(0);

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  useEffect(()=>{
    if(otpTimer>0){const i=setInterval(()=>setOtpTimer(t=>t-1),1000);return()=>clearInterval(i);}
  },[otpTimer]);

  const sendOTP = async () => {
    if(!form.email){showToast('Enter your email first','error');return;}
    const code = String(Math.floor(100000+Math.random()*900000));
    setGeneratedOtp(code); setOtpTimer(120);
    try {
      await fetch(`https://api.emailjs.com/api/v1.0/email/send`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({service_id:EMAILJS.serviceId,template_id:EMAILJS.templateId,user_id:EMAILJS.publicKey,template_params:{to_email:form.email,otp_code:code,app_name:'Dagu'}})
      });
      showToast(`OTP sent to ${form.email}`,'success');
      setStep('otp');
    } catch {
      // Still show OTP in alert if email fails
      alert(`Your OTP is: ${code}`);
      setStep('otp');
    }
  };

  const handleSignup = async () => {
    if(form.otp!==generatedOtp){showToast('Invalid OTP','error');return;}
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth,form.email,form.password);
      const color = AVATAR_COLORS[Math.floor(Math.random()*AVATAR_COLORS.length)];
      const userData = {
        uid:cred.user.uid, email:form.email, username:form.username.toLowerCase().replace(/\s/g,'_'),
        fullName:form.fullName, avatar:form.username[0]?.toUpperCase()||'U',
        avatarColor:color, avatarUrl:'', bio:'New to Dagu! 🎬', link:'',
        verified:false, coins:500, walletBalance:0, streak:1,
        followers:[], following:[], postsCount:0,
        subscription:'free', level:1, createdAt:serverTimestamp(),
      };
      await setDoc(doc(db,'users',cred.user.uid),userData);
      await updateProfile(cred.user,{displayName:form.username});
      onAuth(userData);
      showToast(`Welcome to Dagu, @${form.username}! 🎉`,'success');
    } catch(e){showToast(e.message||'Signup failed','error');}
    setLoading(false);
  };

  const handleLogin = async () => {
    if(!form.email||!form.password){showToast('Fill all fields','error');return;}
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth,form.email,form.password);
      const snap = await getDoc(doc(db,'users',cred.user.uid));
      if(snap.exists()){onAuth({...snap.data(),uid:cred.user.uid}); showToast('Welcome back! 👋','success');}
      else {showToast('Account not found','error');}
    } catch(e){showToast(e.message.includes('password')?'Wrong password':e.message.includes('user-not-found')?'Account not found':'Login failed','error');}
    setLoading(false);
  };

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'#050505',overflow:'auto'}}>
      <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 0%,rgba(255,45,85,0.25),rgba(175,82,222,0.1),transparent 60%)',pointerEvents:'none'}}/>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 24px',position:'relative',zIndex:1}}>
        {/* Logo */}
        <div style={{textAlign:'center',marginBottom:40}}>
          <div style={{width:88,height:88,borderRadius:28,background:'linear-gradient(135deg,#FF2D55,#AF52DE)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:44,boxShadow:'0 24px 64px rgba(255,45,85,0.45)'}}>🎬</div>
          <h1 style={{fontSize:56,fontWeight:800,background:'linear-gradient(135deg,#FF2D55,#AF52DE,#007AFF)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',fontFamily:"'Syne',sans-serif",lineHeight:1}}>Dagu</h1>
          <p style={{color:'rgba(255,255,255,0.35)',fontSize:14,marginTop:8}}>{mode==='login'?'Sign in to continue':'Join the community'}</p>
        </div>

        <div style={{width:'100%',maxWidth:360,background:'rgba(255,255,255,0.03)',borderRadius:28,padding:28,border:'1px solid rgba(255,255,255,0.07)',backdropFilter:'blur(20px)'}}>
          {/* Tabs */}
          {step==='form' && (
            <div style={{display:'flex',gap:4,marginBottom:24,background:'rgba(255,255,255,0.04)',borderRadius:20,padding:4}}>
              {['login','signup'].map(m=>(
                <button key={m} onClick={()=>setMode(m)} style={{flex:1,background:mode===m?'rgba(255,45,85,0.9)':'none',border:'none',borderRadius:16,padding:'10px',color:'white',cursor:'pointer',fontSize:13,fontWeight:mode===m?700:400,textTransform:'capitalize',transition:'all 0.2s'}}>{m==='login'?'Sign In':'Sign Up'}</button>
              ))}
            </div>
          )}

          {step==='otp' ? (
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:48,marginBottom:16}}>📱</div>
              <div style={{color:'white',fontWeight:700,fontSize:18,fontFamily:"'Syne',sans-serif",marginBottom:8}}>Enter OTP</div>
              <div style={{color:'rgba(255,255,255,0.4)',fontSize:13,marginBottom:24}}>Sent to {form.email}</div>
              <input placeholder="000000" maxLength={6} value={form.otp} onChange={set('otp')} style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:20,padding:'16px',color:'white',textAlign:'center',fontSize:32,letterSpacing:10,marginBottom:16,outline:'none',boxSizing:'border-box',fontFamily:"'Syne',sans-serif"}}/>
              <button onClick={handleSignup} disabled={loading||form.otp.length!==6} style={{width:'100%',background:form.otp.length===6?'linear-gradient(135deg,#FF2D55,#AF52DE)':'rgba(255,255,255,0.06)',border:'none',borderRadius:20,padding:15,color:'white',fontWeight:700,cursor:'pointer',fontSize:15,marginBottom:12,opacity:loading?0.7:1}}>
                {loading?<Spinner size={20}/>:'Verify & Create Account'}
              </button>
              {otpTimer>0 && <div style={{color:'rgba(255,255,255,0.3)',fontSize:12}}>Resend in {otpTimer}s</div>}
              <button onClick={()=>setStep('form')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:13,marginTop:8}}>← Back</button>
            </div>
          ) : (
            <>
              {mode==='signup' && (
                <>
                  <input placeholder="Full Name" value={form.fullName} onChange={set('fullName')} style={inputStyle}/>
                  <input placeholder="Username" value={form.username} onChange={set('username')} style={inputStyle}/>
                </>
              )}
              <input type="email" placeholder="Email" value={form.email} onChange={set('email')} style={inputStyle}/>
              <input type="password" placeholder="Password" value={form.password} onChange={set('password')} style={inputStyle}/>
              <button onClick={mode==='login'?handleLogin:sendOTP} disabled={loading} style={{width:'100%',background:'linear-gradient(135deg,#FF2D55,#AF52DE)',border:'none',borderRadius:20,padding:15,color:'white',fontWeight:700,cursor:'pointer',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:loading?0.7:1,fontFamily:"'Syne',sans-serif"}}>
                {loading?<><Spinner size={18} color="white"/><span>Please wait...</span></>:(mode==='login'?'Sign In':'Send OTP & Continue →')}
              </button>
            </>
          )}
        </div>
        <p style={{color:'rgba(255,255,255,0.15)',fontSize:11,marginTop:20,textAlign:'center'}}>By continuing you agree to our Terms & Privacy Policy</p>
      </div>
    </div>
  );
};
const inputStyle = {width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:16,padding:'13px 16px',color:'white',marginBottom:12,outline:'none',fontSize:14,boxSizing:'border-box'};

/* ── VIDEO CARD ── */
const VideoCard = memo(({video,currentUser,onViewProfile,showToast,onLike}) => {
  const [liked,setLiked] = useState(video.likedBy?.includes(currentUser?.uid));
  const [likeCount,setLikeCount] = useState(video.likes||0);
  const [showComments,setShowComments] = useState(false);
  const [showShare,setShowShare] = useState(false);
  const [comments,setComments] = useState([]);
  const [commentText,setCommentText] = useState('');
  const [heartAnim,setHeartAnim] = useState(false);
  const [muted,setMuted] = useState(true);
  const [paused,setPaused] = useState(false);
  const [showMenu,setShowMenu] = useState(false);
  const videoRef = useRef(null);
  const commentsRef = useRef(null);

  useEffect(()=>{
    if(!video.id) return;
    const q = query(collection(db,'videos',video.id,'comments'),orderBy('createdAt','asc'),limit(50));
    const unsub = onSnapshot(q, snap => setComments(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return unsub;
  },[video.id]);

  useEffect(()=>{
    if(commentsRef.current) commentsRef.current.scrollTop = commentsRef.current.scrollHeight;
  },[comments]);

  const toggleLike = async () => {
    if(!currentUser) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(c=>c+(newLiked?1:-1));
    if(newLiked){setHeartAnim(true); setTimeout(()=>setHeartAnim(false),900);}
    try {
      await updateDoc(doc(db,'videos',video.id),{
        likes:increment(newLiked?1:-1),
        likedBy:newLiked?arrayUnion(currentUser.uid):arrayRemove(currentUser.uid)
      });
    } catch {}
  };

  const addComment = async () => {
    if(!commentText.trim()||!currentUser) return;
    const text = commentText; setCommentText('');
    await addDoc(collection(db,'videos',video.id,'comments'),{
      text, userId:currentUser.uid, username:currentUser.username,
      avatar:currentUser.avatar, avatarColor:currentUser.avatarColor,
      avatarUrl:currentUser.avatarUrl||'', likes:0,
      createdAt:serverTimestamp()
    });
    await updateDoc(doc(db,'videos',video.id),{commentsCount:increment(1)});
  };

  const shareVideo = async () => {
    const url = video.videoUrl;
    try { await navigator.share({title:'Dagu',text:video.description,url}); }
    catch { await navigator.clipboard.writeText(url); showToast('Link copied!','success'); }
  };

  const togglePlay = () => {
    if(!videoRef.current) return;
    if(paused){videoRef.current.play(); setPaused(false);}
    else{videoRef.current.pause(); setPaused(true);}
  };

  return (
    <div style={{position:'absolute',inset:0,background:'#000'}}>
      {/* Video */}
      <video ref={videoRef} src={video.videoUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} loop muted={muted} autoPlay playsInline onDoubleClick={toggleLike} onClick={togglePlay}/>
      {/* Gradient */}
      <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.9) 0%,rgba(0,0,0,0.05) 40%,rgba(0,0,0,0.4) 100%)',pointerEvents:'none'}}/>

      {/* Paused overlay */}
      {paused && <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',pointerEvents:'none'}}><div style={{width:64,height:64,borderRadius:'50%',background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center'}}>⏸</div></div>}

      {/* Heart burst */}
      {heartAnim && <div style={{position:'absolute',top:'50%',left:'50%',pointerEvents:'none',zIndex:20}}><div style={{fontSize:90,animation:'heartBurst 0.9s ease forwards',display:'block'}}>❤️</div></div>}

      {/* Bottom Info */}
      <div style={{position:'absolute',bottom:80,left:14,right:70,zIndex:5}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
          <button onClick={()=>onViewProfile?.(video.userId)} style={{background:'none',border:'none',cursor:'pointer',padding:0,flexShrink:0}}>
            {video.avatarUrl ? <img src={video.avatarUrl} alt="" style={{width:42,height:42,borderRadius:'50%',objectFit:'cover',border:'2px solid rgba(255,255,255,0.5)'}}/>
              : <div style={{width:42,height:42,borderRadius:'50%',background:video.avatarColor,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:800,fontSize:16,border:'2px solid rgba(255,255,255,0.5)'}}>{video.avatar}</div>}
          </button>
          <span onClick={()=>onViewProfile?.(video.userId)} style={{color:'white',fontWeight:700,fontSize:15,cursor:'pointer',fontFamily:"'Syne',sans-serif"}}>@{video.username}</span>
        </div>
        <p style={{color:'rgba(255,255,255,0.9)',fontSize:13,marginBottom:6,lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{video.description}</p>
        {video.song && <div style={{display:'flex',alignItems:'center',gap:6}}>
          <div style={{width:22,height:22,borderRadius:'50%',background:'linear-gradient(135deg,#FF2D55,#AF52DE)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11}}>♪</div>
          <span style={{color:'rgba(255,255,255,0.6)',fontSize:12}}>{video.song}</span>
        </div>}
      </div>

      {/* Right Actions */}
      <div style={{position:'absolute',right:12,bottom:90,display:'flex',flexDirection:'column',alignItems:'center',gap:6,zIndex:6}}>
        {/* Mute */}
        <button onClick={()=>setMuted(m=>!m)} style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(10px)',border:'none',borderRadius:'50%',width:44,height:44,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'white',fontSize:18,marginBottom:4}}>
          {muted?'🔇':'🔊'}
        </button>
        {/* Like */}
        <button onClick={toggleLike} style={{background:'rgba(0,0,0,0.35)',backdropFilter:'blur(10px)',border:'none',borderRadius:'50%',width:50,height:50,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'transform 0.15s'}}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill={liked?'#FF2D55':'none'} stroke={liked?'#FF2D55':'white'} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        </button>
        <span style={{color:'white',fontSize:11,fontWeight:700}}>{formatNumber(likeCount)}</span>
        {/* Comment */}
        <button onClick={()=>setShowComments(true)} style={{background:'rgba(0,0,0,0.35)',backdropFilter:'blur(10px)',border:'none',borderRadius:'50%',width:50,height:50,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',marginTop:4}}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        </button>
        <span style={{color:'white',fontSize:11,fontWeight:700}}>{formatNumber(video.commentsCount||0)}</span>
        {/* Share */}
        <button onClick={shareVideo} style={{background:'rgba(0,0,0,0.35)',backdropFilter:'blur(10px)',border:'none',borderRadius:'50%',width:50,height:50,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',marginTop:4}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
        <span style={{color:'white',fontSize:11,fontWeight:700}}>{formatNumber(video.shares||0)}</span>
        {/* More */}
        <button onClick={()=>setShowMenu(true)} style={{background:'rgba(0,0,0,0.35)',backdropFilter:'blur(10px)',border:'none',borderRadius:'50%',width:50,height:50,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',marginTop:4}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
        </button>
      </div>

      {/* Comments Sheet */}
      {showComments && (
        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.6)',zIndex:50}} onClick={()=>setShowComments(false)}>
          <div onClick={e=>e.stopPropagation()} style={{position:'absolute',bottom:0,left:0,right:0,background:'#0F0F0F',borderTopLeftRadius:28,borderTopRightRadius:28,maxHeight:'75%',display:'flex',flexDirection:'column',animation:'slideUp 0.3s ease',border:'1px solid rgba(255,255,255,0.07)'}}>
            <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
              <span style={{color:'white',fontWeight:700,fontSize:16,fontFamily:"'Syne',sans-serif"}}>{formatNumber(video.commentsCount||0)} Comments</span>
              <button onClick={()=>setShowComments(false)} style={{background:'rgba(255,255,255,0.08)',border:'none',borderRadius:'50%',width:32,height:32,color:'white',cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div ref={commentsRef} style={{flex:1,overflowY:'auto',padding:'12px 16px'}}>
              {comments.length===0&&<div style={{textAlign:'center',color:'rgba(255,255,255,0.2)',padding:32,fontSize:14}}>Be the first to comment!</div>}
              {comments.map(c=>(
                <div key={c.id} style={{display:'flex',gap:10,marginBottom:14,animation:'fadeIn 0.2s ease'}}>
                  {c.avatarUrl?<img src={c.avatarUrl} alt="" style={{width:34,height:34,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
                    :<div style={{width:34,height:34,borderRadius:'50%',background:c.avatarColor||'#333',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:13,flexShrink:0}}>{c.avatar||'U'}</div>}
                  <div style={{flex:1}}>
                    <span style={{color:'white',fontWeight:700,fontSize:13,marginRight:8}}>@{c.username}</span>
                    <span style={{color:'rgba(255,255,255,0.35)',fontSize:11}}>{timeAgo(c.createdAt)}</span>
                    <div style={{color:'rgba(255,255,255,0.85)',fontSize:13,marginTop:3,lineHeight:1.4}}>{c.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{padding:'10px 14px 24px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',gap:10,alignItems:'center',flexShrink:0}}>
              {currentUser?.avatarUrl?<img src={currentUser.avatarUrl} alt="" style={{width:34,height:34,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
                :<div style={{width:34,height:34,borderRadius:'50%',background:currentUser?.avatarColor,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:13,flexShrink:0}}>{currentUser?.avatar}</div>}
              <input value={commentText} onChange={e=>setCommentText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addComment()} placeholder="Add a comment..." style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:28,padding:'10px 16px',color:'white',outline:'none',fontSize:13}}/>
              <button onClick={addComment} style={{background:'linear-gradient(135deg,#FF2D55,#AF52DE)',border:'none',borderRadius:'50%',width:40,height:40,color:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu */}
      {showMenu && (
        <div style={{position:'absolute',inset:0,zIndex:50}} onClick={()=>setShowMenu(false)}>
          <div onClick={e=>e.stopPropagation()} style={{position:'absolute',bottom:160,right:14,background:'rgba(18,18,18,0.98)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:22,padding:6,minWidth:180,animation:'fadeIn 0.2s ease'}}>
            {[
              {label:'Save Video',icon:'💾',action:()=>{showToast('Saved!','success');setShowMenu(false);}},
              {label:'Not Interested',icon:'🚫',action:()=>{showToast('Got it','info');setShowMenu(false);}},
              {label:'Report',icon:'⚠️',action:()=>{showToast('Reported','warning');setShowMenu(false);}},
            ].map(({label,icon,action})=>(
              <button key={label} onClick={action} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'12px 14px',background:'none',border:'none',color:'white',cursor:'pointer',borderRadius:16,fontSize:14}}>
                <span>{icon}</span>{label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

/* ── HOME FEED ── */
const HomeFeed = ({currentUser,showToast,onViewProfile,onOpenSearch}) => {
  const [videos,setVideos] = useState([]);
  const [idx,setIdx] = useState(0);
  const [loading,setLoading] = useState(true);
  const [category,setCategory] = useState('foryou');
  const startY = useRef(null);

  useEffect(()=>{
    setLoading(true);
    const q = query(collection(db,'videos'),orderBy('createdAt','desc'),limit(30));
    const unsub = onSnapshot(q,snap=>{
      setVideos(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
    return unsub;
  },[]);

  const filtered = useMemo(()=>{
    if(category==='foryou') return videos;
    if(category==='following') return videos.filter(v=>currentUser?.following?.includes(v.userId));
    return videos;
  },[videos,category,currentUser]);

  const handleTouchStart = e => startY.current=e.touches[0].clientY;
  const handleTouchEnd = e => {
    if(startY.current===null) return;
    const dy=startY.current-e.changedTouches[0].clientY;
    if(Math.abs(dy)>50){if(dy>0) setIdx(i=>Math.min(filtered.length-1,i+1)); else setIdx(i=>Math.max(0,i-1));}
    startY.current=null;
  };

  if(loading) return <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}><Spinner size={40}/></div>;

  return (
    <div style={{height:'100%',position:'relative',overflow:'hidden'}} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Top bar */}
      <div style={{position:'absolute',top:0,left:0,right:0,zIndex:15,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px 0'}}>
        <div style={{flex:1,display:'flex',justifyContent:'center',gap:24}}>
          {[{id:'foryou',label:'For You'},{id:'following',label:'Following'},{id:'trending',label:'Trending'}].map(c=>(
            <button key={c.id} onClick={()=>{setCategory(c.id);setIdx(0);}} style={{background:'none',border:'none',color:category===c.id?'white':'rgba(255,255,255,0.4)',fontWeight:category===c.id?800:500,fontSize:15,cursor:'pointer',paddingBottom:6,borderBottom:category===c.id?'2.5px solid white':'2.5px solid transparent',fontFamily:"'Syne',sans-serif",transition:'all 0.2s'}}>{c.label}</button>
          ))}
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={onOpenSearch} style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'50%',width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
        </div>
      </div>

      {filtered.length===0 && !loading && (
        <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12}}>
          <div style={{fontSize:56}}>📭</div>
          <div style={{color:'rgba(255,255,255,0.3)',fontSize:15}}>No videos yet</div>
          <div style={{color:'rgba(255,255,255,0.2)',fontSize:13}}>Be the first to post!</div>
        </div>
      )}

      {filtered.map((video,i)=>(
        <div key={video.id} style={{position:'absolute',inset:0,transform:`translateY(${(i-idx)*100}%)`,transition:'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)',pointerEvents:i===idx?'auto':'none'}}>
          <VideoCard video={video} currentUser={currentUser} onViewProfile={onViewProfile} showToast={showToast}/>
        </div>
      ))}

      {/* Progress dots */}
      {filtered.length>1 && (
        <div style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',display:'flex',flexDirection:'column',gap:3,zIndex:10}}>
          {filtered.slice(Math.max(0,idx-3),Math.min(filtered.length,idx+4)).map((_,i)=>{
            const realI=Math.max(0,idx-3)+i;
            return <div key={realI} onClick={()=>setIdx(realI)} style={{width:3,height:realI===idx?22:4,borderRadius:2,background:realI===idx?'white':'rgba(255,255,255,0.2)',cursor:'pointer',transition:'all 0.2s'}}/>;
          })}
        </div>
      )}
    </div>
  );
};

/* ── MESSAGING ── */
const MessagesPage = ({currentUser,users,showToast}) => {
  const [conversations,setConversations] = useState([]);
  const [activeConvo,setActiveConvo] = useState(null);
  const [messages,setMessages] = useState([]);
  const [msgText,setMsgText] = useState('');
  const [allUsers,setAllUsers] = useState([]);
  const [search,setSearch] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(()=>{
    if(!currentUser?.uid) return;
    const q = query(collection(db,'conversations'),where('participants','array-contains',currentUser.uid),orderBy('updatedAt','desc'));
    const unsub = onSnapshot(q,snap=>setConversations(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return unsub;
  },[currentUser?.uid]);

  useEffect(()=>{
    getDocs(collection(db,'users')).then(snap=>setAllUsers(snap.docs.map(d=>({uid:d.id,...d.data()})).filter(u=>u.uid!==currentUser?.uid)));
  },[currentUser?.uid]);

  useEffect(()=>{
    if(!activeConvo?.id) return;
    const q = query(collection(db,'conversations',activeConvo.id,'messages'),orderBy('createdAt','asc'));
    const unsub = onSnapshot(q,snap=>{setMessages(snap.docs.map(d=>({id:d.id,...d.data()})));});
    return unsub;
  },[activeConvo?.id]);

  useEffect(()=>{messagesEndRef.current?.scrollIntoView({behavior:'smooth'});},[messages]);

  const getOrCreateConvo = async (otherUser) => {
    const ids = [currentUser.uid,otherUser.uid].sort();
    const convoId = ids.join('_');
    const convoRef = doc(db,'conversations',convoId);
    const snap = await getDoc(convoRef);
    if(!snap.exists()){
      await setDoc(convoRef,{participants:ids,participantData:{[currentUser.uid]:{username:currentUser.username,avatar:currentUser.avatar,avatarColor:currentUser.avatarColor,avatarUrl:currentUser.avatarUrl||''},[otherUser.uid]:{username:otherUser.username,avatar:otherUser.avatar,avatarColor:otherUser.avatarColor,avatarUrl:otherUser.avatarUrl||''}},lastMessage:'',updatedAt:serverTimestamp()});
    }
    setActiveConvo({id:convoId,participantData:{[currentUser.uid]:{username:currentUser.username},[otherUser.uid]:{username:otherUser.username,avatar:otherUser.avatar,avatarColor:otherUser.avatarColor,avatarUrl:otherUser.avatarUrl||''}}});
  };

  const sendMessage = async () => {
    if(!msgText.trim()||!activeConvo?.id) return;
    const text=msgText; setMsgText('');
    await addDoc(collection(db,'conversations',activeConvo.id,'messages'),{text,from:currentUser.uid,createdAt:serverTimestamp()});
    await updateDoc(doc(db,'conversations',activeConvo.id),{lastMessage:text,updatedAt:serverTimestamp()});
  };

  const otherUser = activeConvo ? Object.entries(activeConvo.participantData||{}).find(([k])=>k!==currentUser?.uid)?.[1] : null;

  const filteredUsers = allUsers.filter(u=>u.username?.toLowerCase().includes(search.toLowerCase())||u.fullName?.toLowerCase().includes(search.toLowerCase()));

  if(activeConvo) return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'#080808'}}>
      <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
        <button onClick={()=>{setActiveConvo(null);setMessages([]);}} style={{background:'none',border:'none',color:'white',cursor:'pointer'}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        {otherUser?.avatarUrl?<img src={otherUser.avatarUrl} alt="" style={{width:40,height:40,borderRadius:'50%',objectFit:'cover'}}/>
          :<div style={{width:40,height:40,borderRadius:'50%',background:otherUser?.avatarColor||'#333',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700}}>{otherUser?.avatar||'?'}</div>}
        <div>
          <div style={{color:'white',fontWeight:700,fontFamily:"'Syne',sans-serif"}}>@{otherUser?.username}</div>
          <div style={{color:'#06D6A0',fontSize:11,display:'flex',alignItems:'center',gap:4}}><div style={{width:6,height:6,borderRadius:'50%',background:'#06D6A0'}}/> Online</div>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:16}}>
        {messages.map(m=>(
          <div key={m.id} style={{display:'flex',justifyContent:m.from===currentUser?.uid?'flex-end':'flex-start',marginBottom:10,animation:'fadeIn 0.2s ease'}}>
            <div style={{maxWidth:'72%',background:m.from===currentUser?.uid?'linear-gradient(135deg,#FF2D55,#AF52DE)':'rgba(255,255,255,0.07)',borderRadius:m.from===currentUser?.uid?'20px 20px 4px 20px':'20px 20px 20px 4px',padding:'10px 14px'}}>
              <span style={{color:'white',fontSize:14,lineHeight:1.4}}>{m.text}</span>
              <div style={{color:'rgba(255,255,255,0.35)',fontSize:10,marginTop:4,textAlign:'right'}}>{timeAgo(m.createdAt)}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef}/>
      </div>
      <div style={{padding:'10px 14px 28px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',gap:10,alignItems:'center',flexShrink:0}}>
        <input value={msgText} onChange={e=>setMsgText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()} placeholder="Message..." style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:28,padding:'11px 16px',color:'white',outline:'none',fontSize:13}}/>
        <button onClick={sendMessage} style={{background:'linear-gradient(135deg,#FF2D55,#AF52DE)',border:'none',borderRadius:'50%',width:44,height:44,color:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'#080808'}}>
      <div style={{padding:'16px 16px 12px',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0}}>
        <div style={{color:'white',fontWeight:800,fontSize:22,fontFamily:"'Syne',sans-serif",marginBottom:12}}>Messages</div>
        <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.05)',borderRadius:20,padding:'10px 14px'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users to message..." style={{flex:1,background:'none',border:'none',color:'white',outline:'none',fontSize:13}}/>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {/* Conversations */}
        {conversations.map(c=>{
          const other = Object.entries(c.participantData||{}).find(([k])=>k!==currentUser?.uid)?.[1];
          return (
            <div key={c.id} onClick={()=>setActiveConvo(c)} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:'pointer'}}>
              <div style={{position:'relative'}}>
                {other?.avatarUrl?<img src={other.avatarUrl} alt="" style={{width:52,height:52,borderRadius:'50%',objectFit:'cover'}}/>
                  :<div style={{width:52,height:52,borderRadius:'50%',background:other?.avatarColor||'#333',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:20}}>{other?.avatar||'?'}</div>}
                <div style={{position:'absolute',bottom:1,right:1,width:12,height:12,background:'#06D6A0',borderRadius:'50%',border:'2px solid #080808'}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{color:'white',fontWeight:700,fontFamily:"'Syne',sans-serif"}}>@{other?.username}</div>
                <div style={{color:'rgba(255,255,255,0.35)',fontSize:12,marginTop:2}}>{c.lastMessage||'Tap to start chatting'}</div>
              </div>
              <div style={{color:'rgba(255,255,255,0.2)',fontSize:11}}>{c.updatedAt?timeAgo(c.updatedAt):''}</div>
            </div>
          );
        })}
        {/* All Users to start chats */}
        {search && <div style={{padding:'12px 16px',color:'rgba(255,255,255,0.3)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>People</div>}
        {(search?filteredUsers:allUsers.slice(0,10)).map(u=>(
          <div key={u.uid} onClick={()=>getOrCreateConvo(u)} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:'pointer'}}>
            {u.avatarUrl?<img src={u.avatarUrl} alt="" style={{width:46,height:46,borderRadius:'50%',objectFit:'cover'}}/>
              :<div style={{width:46,height:46,borderRadius:'50%',background:u.avatarColor||'#333',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:18}}>{u.avatar||u.username?.[0]?.toUpperCase()}</div>}
            <div>
              <div style={{color:'white',fontWeight:600,fontFamily:"'Syne',sans-serif"}}>@{u.username}</div>
              <div style={{color:'rgba(255,255,255,0.3)',fontSize:11,marginTop:2}}>{u.fullName}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── CREATE POST ── */
const CreatePost = ({currentUser,showToast,onDone}) => {
  const [file,setFile] = useState(null);
  const [preview,setPreview] = useState('');
  const [description,setDescription] = useState('');
  const [song,setSong] = useState('');
  const [uploading,setUploading] = useState(false);
  const [progress,setProgress] = useState(0);
  const [showCamera,setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);

  const handleFile = f => {
    if(!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setShowCamera(false);
  };

  const startCamera = async () => {
    try { const s=await navigator.mediaDevices.getUserMedia({video:true,audio:true}); streamRef.current=s; if(videoRef.current) videoRef.current.srcObject=s; setShowCamera(true); }
    catch { showToast('Camera not available','error'); }
  };
  const stopCamera = () => { streamRef.current?.getTracks().forEach(t=>t.stop()); streamRef.current=null; setShowCamera(false); };

  useEffect(()=>()=>stopCamera(),[]);

  const post = async () => {
    if(!file&&!preview){showToast('Select a video or photo first','error');return;}
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file, setProgress);
      await addDoc(collection(db,'videos'),{
        userId:currentUser.uid, username:currentUser.username,
        avatar:currentUser.avatar, avatarColor:currentUser.avatarColor,
        avatarUrl:currentUser.avatarUrl||'',
        description, song: song||'Original Sound',
        videoUrl:url, likes:0, commentsCount:0, shares:0, views:0,
        likedBy:[], createdAt:serverTimestamp(),
      });
      await updateDoc(doc(db,'users',currentUser.uid),{postsCount:increment(1)});
      showToast('Posted! 🚀','success');
      onDone?.();
    } catch(e){showToast('Upload failed. Try again.','error');console.error(e);}
    setUploading(false); setProgress(0);
  };

  if(uploading) return <UploadProgress progress={progress} label="Uploading your post..."/>;

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'#080808'}}>
      <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
        <button onClick={onDone} style={{background:'rgba(255,255,255,0.06)',border:'none',borderRadius:20,padding:'8px 16px',color:'white',cursor:'pointer',fontSize:13}}>Cancel</button>
        <h3 style={{color:'white',fontSize:16,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>New Post</h3>
        <button onClick={post} disabled={!file} style={{background:file?'linear-gradient(135deg,#FF2D55,#AF52DE)':'rgba(255,255,255,0.08)',border:'none',borderRadius:20,padding:'8px 18px',color:'white',fontWeight:700,cursor:file?'pointer':'default',fontSize:13}}>Post</button>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:16}}>
        <div style={{display:'flex',gap:8,marginBottom:14}}>
          <button onClick={()=>{stopCamera();fileRef.current?.click();}} style={{flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:12,color:'white',cursor:'pointer',fontSize:13,fontWeight:600}}>📁 Gallery</button>
          <button onClick={showCamera?stopCamera:startCamera} style={{flex:1,background:showCamera?'linear-gradient(135deg,#FF2D55,#AF52DE)':'rgba(255,255,255,0.05)',border:'none',borderRadius:14,padding:12,color:'white',cursor:'pointer',fontSize:13,fontWeight:600}}>📷 Camera</button>
        </div>
        <input ref={fileRef} type="file" accept="video/*,image/*" onChange={e=>handleFile(e.target.files[0])} style={{display:'none'}}/>

        <div style={{background:'rgba(255,255,255,0.03)',borderRadius:20,marginBottom:14,minHeight:240,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',border:'1px solid rgba(255,255,255,0.06)'}}>
          {showCamera ? (
            <div style={{position:'relative',width:'100%'}}>
              <video ref={videoRef} autoPlay playsInline style={{width:'100%',borderRadius:20,maxHeight:280,objectFit:'cover'}}/>
            </div>
          ) : preview ? (
            file?.type?.startsWith('video/')||preview.includes('video')
              ? <video src={preview} controls style={{width:'100%',borderRadius:20,maxHeight:300}}/>
              : <img src={preview} alt="" style={{width:'100%',borderRadius:20,maxHeight:300,objectFit:'cover'}}/>
          ) : (
            <label style={{textAlign:'center',cursor:'pointer',padding:48,display:'block',width:'100%'}}>
              <div style={{fontSize:52,marginBottom:10}}>🎬</div>
              <div style={{color:'rgba(255,255,255,0.3)',fontSize:14}}>Tap to choose video or photo</div>
              <input type="file" accept="video/*,image/*" onChange={e=>handleFile(e.target.files[0])} style={{display:'none'}}/>
            </label>
          )}
        </div>

        <textarea placeholder="Write a caption... #hashtags" value={description} onChange={e=>setDescription(e.target.value)} style={{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:'12px 14px',color:'white',minHeight:80,outline:'none',fontSize:13,resize:'none',boxSizing:'border-box',marginBottom:12}}/>
        <input placeholder="🎵 Add song name..." value={song} onChange={e=>setSong(e.target.value)} style={{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:16,padding:'12px 14px',color:'white',outline:'none',fontSize:13,boxSizing:'border-box'}}/>
      </div>
    </div>
  );
};

/* ── PROFILE PAGE ── */
const ProfilePage = ({currentUser,setCurrentUser,onLogout,showToast,onViewProfile}) => {
  const [userData,setUserData] = useState(currentUser);
  const [videos,setVideos] = useState([]);
  const [tab,setTab] = useState('posts');
  const [subPage,setSubPage] = useState(null);
  const [showEdit,setShowEdit] = useState(false);
  const [uploading,setUploading] = useState(false);
  const [progress,setProgress] = useState(0);

  useEffect(()=>{
    if(!currentUser?.uid) return;
    const unsub = onSnapshot(doc(db,'users',currentUser.uid),snap=>{if(snap.exists()){const d={...snap.data(),uid:snap.id};setUserData(d);setCurrentUser(d);}});
    return unsub;
  },[currentUser?.uid]);

  useEffect(()=>{
    if(!currentUser?.uid) return;
    const q=query(collection(db,'videos'),where('userId','==',currentUser.uid),orderBy('createdAt','desc'));
    const unsub=onSnapshot(q,snap=>setVideos(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return unsub;
  },[currentUser?.uid]);

  const handleAvatarUpload = async e => {
    const f=e.target.files[0]; if(!f) return;
    setUploading(true);
    try {
      const url=await uploadToCloudinary(f,setProgress);
      await updateDoc(doc(db,'users',currentUser.uid),{avatarUrl:url});
      showToast('Profile photo updated!','success');
    } catch { showToast('Upload failed','error'); }
    setUploading(false);
  };

  if(uploading) return <UploadProgress progress={progress} label="Updating profile photo..."/>;

  /* Settings sub-page */
  if(subPage==='settings') return (
    <div style={{height:'100%',overflowY:'auto',background:'#080808'}}>
      <div style={{padding:'16px 16px 0'}}>
        <button onClick={()=>setSubPage(null)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',cursor:'pointer',display:'flex',alignItems:'center',gap:6,marginBottom:20,fontSize:13}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
        </button>
        <div style={{color:'white',fontWeight:800,fontSize:22,marginBottom:24,fontFamily:"'Syne',sans-serif"}}>Settings</div>
        {[
          {section:'Account',items:[{label:'Edit Profile',action:()=>{setShowEdit(true);setSubPage(null);}},{label:'Change Password',action:()=>showToast('Feature coming soon','info')},{label:'Privacy',action:()=>{}},{label:'Notifications',action:()=>{}}]},
          {section:'Content',items:[{label:'Saved Posts',action:()=>{}},{label:'Liked Videos',action:()=>{}},{label:'Blocked Users',action:()=>{}},{label:'Download Data',action:()=>showToast('Preparing data...','info')}]},
          {section:'Support',items:[{label:'Help Center',action:()=>{}},{label:'Report a Problem',action:()=>showToast('Thanks for reporting','success')},{label:'Terms of Service',action:()=>{}},{label:'Privacy Policy',action:()=>{}}]},
        ].map(({section,items})=>(
          <div key={section} style={{marginBottom:24}}>
            <div style={{color:'rgba(255,255,255,0.3)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>{section}</div>
            <div style={{background:'rgba(255,255,255,0.03)',borderRadius:20,overflow:'hidden',border:'1px solid rgba(255,255,255,0.06)'}}>
              {items.map((item,i,arr)=>(
                <div key={item.label} onClick={item.action} style={{padding:'14px 16px',borderBottom:i<arr.length-1?'1px solid rgba(255,255,255,0.05)':'',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}>
                  <span style={{color:'white',fontSize:14}}>{item.label}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{background:'rgba(255,255,255,0.03)',borderRadius:20,overflow:'hidden',border:'1px solid rgba(255,255,255,0.06)',marginBottom:40}}>
          <div onClick={onLogout} style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.05)',display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
            <span style={{color:'#FF9500',fontSize:14}}>Sign Out</span>
          </div>
          <div onClick={()=>{if(window.confirm('Delete account permanently?')){onLogout();}}} style={{padding:'14px 16px',cursor:'pointer'}}>
            <span style={{color:'#FF2D55',fontSize:14}}>Delete Account</span>
          </div>
        </div>
      </div>
    </div>
  );

  /* Wallet sub-page */
  if(subPage==='wallet') return (
    <div style={{height:'100%',overflowY:'auto',background:'#080808'}}>
      <div style={{padding:'16px 16px 0'}}>
        <button onClick={()=>setSubPage(null)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',cursor:'pointer',display:'flex',alignItems:'center',gap:6,marginBottom:20,fontSize:13}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
        </button>
        <div style={{color:'white',fontWeight:800,fontSize:22,marginBottom:20,fontFamily:"'Syne',sans-serif"}}>Wallet</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:24}}>
          <div style={{background:'linear-gradient(135deg,#FFD700,#FF9500)',borderRadius:22,padding:20}}>
            <div style={{color:'rgba(0,0,0,0.5)',fontSize:11,fontWeight:600,textTransform:'uppercase'}}>Coins</div>
            <div style={{color:'#000',fontSize:32,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{(userData?.coins||0).toLocaleString()}</div>
            <div style={{color:'rgba(0,0,0,0.4)',fontSize:10,marginTop:2}}>🪙 Dagu Coins</div>
          </div>
          <div style={{background:'linear-gradient(135deg,#06D6A0,#00B4D8)',borderRadius:22,padding:20}}>
            <div style={{color:'rgba(0,0,0,0.5)',fontSize:11,fontWeight:600,textTransform:'uppercase'}}>Balance</div>
            <div style={{color:'#000',fontSize:32,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>${(userData?.walletBalance||0).toFixed(2)}</div>
            <div style={{color:'rgba(0,0,0,0.4)',fontSize:10,marginTop:2}}>💵 USD</div>
          </div>
        </div>
        <div style={{color:'rgba(255,255,255,0.3)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>Quick Actions</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {[{label:'Add Coins',icon:'➕',action:async()=>{await updateDoc(doc(db,'users',currentUser.uid),{coins:increment(100)});showToast('+100 coins added!','success');}},{label:'Gift Friend',icon:'🎁',action:()=>showToast('Select a friend to gift','info')},{label:'Withdraw',icon:'💳',action:()=>showToast('Minimum 1000 coins to withdraw','info')},{label:'History',icon:'📊',action:()=>showToast('Transaction history','info')}].map(({label,icon,action})=>(
            <button key={label} onClick={action} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:18,padding:'16px 14px',display:'flex',flexDirection:'column',alignItems:'center',gap:8,cursor:'pointer'}}>
              <span style={{fontSize:28}}>{icon}</span>
              <span style={{color:'white',fontSize:12,fontWeight:600}}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  /* Analytics sub-page */
  if(subPage==='analytics') return (
    <div style={{height:'100%',overflowY:'auto',background:'#080808'}}>
      <div style={{padding:'16px 16px 0'}}>
        <button onClick={()=>setSubPage(null)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',cursor:'pointer',display:'flex',alignItems:'center',gap:6,marginBottom:20,fontSize:13}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> Back
        </button>
        <div style={{color:'white',fontWeight:800,fontSize:22,marginBottom:20,fontFamily:"'Syne',sans-serif"}}>Analytics</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
          {[['Total Views',formatNumber(videos.reduce((s,v)=>s+v.views,0)),'#06D6A0'],['Total Likes',formatNumber(videos.reduce((s,v)=>s+v.likes,0)),'#FF2D55'],['Posts',String(videos.length),'#AF52DE'],['Coins',String(userData?.coins||0),'#FFD700']].map(([label,val,color])=>(
            <div key={label} style={{background:'rgba(255,255,255,0.03)',borderRadius:20,padding:18,border:'1px solid rgba(255,255,255,0.06)'}}>
              <div style={{color:'rgba(255,255,255,0.35)',fontSize:11,textTransform:'uppercase',letterSpacing:0.5}}>{label}</div>
              <div style={{color:color,fontSize:28,fontWeight:800,marginTop:6,fontFamily:"'Syne',sans-serif"}}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{background:'rgba(255,255,255,0.03)',borderRadius:20,padding:20,border:'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{color:'white',fontWeight:700,marginBottom:16,fontFamily:"'Syne',sans-serif"}}>Weekly Activity</div>
          <div style={{height:100,display:'flex',alignItems:'flex-end',gap:6}}>
            {[40,65,45,80,60,90,70].map((h,i)=>(
              <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                <div style={{width:'100%',height:`${h}%`,background:'linear-gradient(180deg,#FF2D55,#AF52DE)',borderRadius:4}}/>
                <span style={{color:'rgba(255,255,255,0.3)',fontSize:9}}>{['M','T','W','T','F','S','S'][i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{height:'100%',overflowY:'auto',background:'#080808'}}>
      {/* Header gradient */}
      <div style={{position:'relative',paddingBottom:20}}>
        <div style={{height:130,background:'linear-gradient(135deg,rgba(255,45,85,0.35),rgba(175,82,222,0.25))',position:'absolute',top:0,left:0,right:0}}/>
        <div style={{position:'relative',padding:'48px 20px 0',textAlign:'center'}}>
          {/* Top buttons */}
          <div style={{position:'absolute',top:10,right:16,display:'flex',gap:8}}>
            <button onClick={()=>setSubPage('settings')} style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'50%',width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            </button>
          </div>
          {/* Avatar */}
          <label style={{position:'relative',display:'inline-block',cursor:'pointer',marginBottom:14}}>
            <div style={{width:96,height:96,borderRadius:'50%',padding:3,background:'conic-gradient(#FF2D55,#FF9500,#AF52DE,#FF2D55)',margin:'0 auto'}}>
              <div style={{width:'100%',height:'100%',borderRadius:'50%',background:'#080808',padding:2}}>
                {userData?.avatarUrl
                  ? <img src={userData.avatarUrl} alt="" style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}}/>
                  : <div style={{width:'100%',height:'100%',borderRadius:'50%',background:userData?.avatarColor,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:800,fontSize:36}}>{userData?.avatar}</div>}
              </div>
            </div>
            <div style={{position:'absolute',bottom:2,right:2,background:'linear-gradient(135deg,#FF2D55,#AF52DE)',border:'2px solid #080808',borderRadius:'50%',width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </div>
            <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{display:'none'}}/>
          </label>
          <div style={{color:'white',fontWeight:800,fontSize:22,fontFamily:"'Syne',sans-serif"}}>@{userData?.username}</div>
          {userData?.verified && <div style={{display:'inline-flex',alignItems:'center',gap:4,color:'#1D9BF0',fontSize:12,marginTop:4,background:'rgba(29,155,240,0.1)',borderRadius:20,padding:'3px 10px'}}>✓ Verified</div>}
          <div style={{color:'rgba(255,255,255,0.45)',fontSize:13,marginTop:8,lineHeight:1.6,maxWidth:260,margin:'8px auto 0'}}>{userData?.bio||'No bio yet'}</div>
          <button onClick={()=>setShowEdit(true)} style={{marginTop:14,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:14,padding:'9px 28px',color:'white',fontWeight:700,cursor:'pointer',fontSize:13,fontFamily:"'Syne',sans-serif"}}>Edit Profile</button>

          {/* Stats */}
          <div style={{display:'flex',justifyContent:'center',gap:0,marginTop:18,background:'rgba(255,255,255,0.03)',borderRadius:20,padding:'14px 0',border:'1px solid rgba(255,255,255,0.06)'}}>
            {[['Posts',videos.length],['Followers',userData?.followers?.length||0],['Following',userData?.following?.length||0]].map(([label,val],i)=>(
              <div key={label} style={{flex:1,textAlign:'center',borderRight:i<2?'1px solid rgba(255,255,255,0.07)':''}}>
                <div style={{color:'white',fontWeight:800,fontSize:20,fontFamily:"'Syne',sans-serif"}}>{formatNumber(val)}</div>
                <div style={{color:'rgba(255,255,255,0.35)',fontSize:11,marginTop:2}}>{label}</div>
              </div>
            ))}
          </div>
          {/* Coins + Streak */}
          <div style={{display:'flex',gap:8,marginTop:10,justifyContent:'center'}}>
            <div style={{background:'rgba(255,165,0,0.1)',border:'1px solid rgba(255,165,0,0.2)',borderRadius:20,padding:'6px 14px',display:'flex',alignItems:'center',gap:6}}>
              <span>🔥</span><span style={{color:'#FF9500',fontSize:12,fontWeight:700}}>{userData?.streak||1} day streak</span>
            </div>
            <div style={{background:'rgba(255,215,0,0.08)',border:'1px solid rgba(255,215,0,0.2)',borderRadius:20,padding:'6px 14px',display:'flex',alignItems:'center',gap:6}}>
              <span>🪙</span><span style={{color:'#FFD700',fontSize:12,fontWeight:700}}>{(userData?.coins||0).toLocaleString()}</span>
            </div>
          </div>

          {/* Quick actions */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginTop:16}}>
            {[{icon:'📊',label:'Analytics',action:()=>setSubPage('analytics')},{icon:'💰',label:'Wallet',action:()=>setSubPage('wallet')},{icon:'⚙️',label:'Settings',action:()=>setSubPage('settings')}].map(({icon,label,action})=>(
              <button key={label} onClick={action} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:18,padding:'14px 6px',display:'flex',flexDirection:'column',alignItems:'center',gap:6,cursor:'pointer'}}>
                <span style={{fontSize:24}}>{icon}</span>
                <span style={{color:'rgba(255,255,255,0.6)',fontSize:11,fontWeight:600}}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderTop:'1px solid rgba(255,255,255,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        {[{id:'posts',icon:'⊞'},{id:'saved',icon:'🔖'},{id:'drafts',icon:'📝'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,background:'none',border:'none',borderTop:tab===t.id?'2px solid #FF2D55':'2px solid transparent',padding:'14px 0',color:tab===t.id?'white':'rgba(255,255,255,0.3)',cursor:'pointer',fontSize:20}}>{t.icon}</button>
        ))}
      </div>
      <div style={{padding:2}}>
        {tab==='posts' && (videos.length===0
          ? <div style={{textAlign:'center',padding:48,color:'rgba(255,255,255,0.2)'}}>
              <div style={{fontSize:48,marginBottom:12}}>🎬</div>
              <div style={{fontSize:15,fontWeight:600}}>No posts yet</div>
              <div style={{fontSize:13,marginTop:4}}>Create your first video!</div>
            </div>
          : <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:2}}>
              {videos.map(v=>(
                <div key={v.id} style={{aspectRatio:'9/16',background:'#1a1a1a',position:'relative',overflow:'hidden'}}>
                  <video src={v.videoUrl} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  <div style={{position:'absolute',bottom:4,left:6,color:'white',fontSize:10,fontWeight:700,background:'rgba(0,0,0,0.6)',borderRadius:6,padding:'2px 6px'}}>{formatNumber(v.views)}</div>
                </div>
              ))}
            </div>
        )}
        {tab==='saved' && <div style={{textAlign:'center',padding:48,color:'rgba(255,255,255,0.2)'}}><div style={{fontSize:40,marginBottom:12}}>🔖</div><div>No saved posts</div></div>}
        {tab==='drafts' && <div style={{textAlign:'center',padding:48,color:'rgba(255,255,255,0.2)'}}><div style={{fontSize:40,marginBottom:12}}>📝</div><div>No drafts</div></div>}
      </div>

      {/* Edit Profile Modal */}
      {showEdit && <EditProfileModal user={userData} onClose={()=>setShowEdit(false)} onSave={async(data)=>{await updateDoc(doc(db,'users',currentUser.uid),data);showToast('Profile updated!','success');setShowEdit(false);}} showToast={showToast}/>}
    </div>
  );
};

/* ── EDIT PROFILE MODAL ── */
const EditProfileModal = ({user,onClose,onSave,showToast}) => {
  const [form,setForm] = useState({username:user?.username||'',bio:user?.bio||'',link:user?.link||'',avatarColor:user?.avatarColor||'#FF2D55'});
  const [saving,setSaving] = useState(false);
  const colors = AVATAR_COLORS;
  const save = async () => {setSaving(true);await onSave(form);setSaving(false);};
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:4000,display:'flex',alignItems:'flex-end'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:'100%',background:'#0F0F0F',borderTopLeftRadius:32,borderTopRightRadius:32,padding:'20px 20px 48px',maxHeight:'90vh',overflowY:'auto',border:'1px solid rgba(255,255,255,0.07)'}}>
        <div style={{width:36,height:4,background:'rgba(255,255,255,0.12)',borderRadius:2,margin:'0 auto 20px'}}/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
          <span style={{color:'white',fontWeight:800,fontSize:20,fontFamily:"'Syne',sans-serif"}}>Edit Profile</span>
          <button onClick={save} disabled={saving} style={{background:'linear-gradient(135deg,#FF2D55,#AF52DE)',border:'none',borderRadius:20,padding:'9px 20px',color:'white',fontWeight:700,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',gap:6}}>
            {saving?<Spinner size={14} color="white"/>:'Save'}
          </button>
        </div>
        {/* Color picker */}
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{width:80,height:80,borderRadius:'50%',background:form.avatarColor,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:800,fontSize:30,margin:'0 auto 12px'}}>{user?.avatar}</div>
          <div style={{color:'rgba(255,255,255,0.4)',fontSize:12,marginBottom:12}}>Profile Color</div>
          <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}>
            {colors.map(c=><div key={c} onClick={()=>setForm(f=>({...f,avatarColor:c}))} style={{width:32,height:32,borderRadius:'50%',background:c,cursor:'pointer',border:c===form.avatarColor?'3px solid white':'3px solid transparent',transition:'all 0.15s'}}/>)}
          </div>
        </div>
        {[{label:'Username',key:'username',prefix:'@'},{label:'Bio',key:'bio',multi:true},{label:'Website',key:'link'}].map(({label,key,prefix,multi})=>(
          <div key={key} style={{marginBottom:14}}>
            <div style={{color:'rgba(255,255,255,0.35)',fontSize:12,marginBottom:7,fontWeight:600,textTransform:'uppercase',letterSpacing:0.5}}>{label}</div>
            {multi ? <textarea value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,padding:'12px 14px',color:'white',outline:'none',fontSize:14,resize:'none',minHeight:70,boxSizing:'border-box'}}/>
              : <div style={{display:'flex',alignItems:'center',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,padding:'12px 14px'}}>
                  {prefix&&<span style={{color:'rgba(255,255,255,0.3)',marginRight:4}}>{prefix}</span>}
                  <input value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{flex:1,background:'none',border:'none',color:'white',outline:'none',fontSize:14}}/>
                </div>}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── USER PROFILE MODAL ── */
const UserProfileModal = ({userId,currentUser,onClose,showToast,onMessage}) => {
  const [user,setUser] = useState(null);
  const [videos,setVideos] = useState([]);
  const [following,setFollowing] = useState(false);
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    if(!userId) return;
    getDoc(doc(db,'users',userId)).then(snap=>{if(snap.exists()){const d={...snap.data(),uid:snap.id};setUser(d);setFollowing(d.followers?.includes(currentUser?.uid));}setLoading(false);});
    const q=query(collection(db,'videos'),where('userId','==',userId),orderBy('createdAt','desc'),limit(12));
    getDocs(q).then(snap=>setVideos(snap.docs.map(d=>({id:d.id,...d.data()}))));
  },[userId]);

  const toggleFollow = async () => {
    if(!user||!currentUser) return;
    const isNowFollowing = !following;
    setFollowing(isNowFollowing);
    await updateDoc(doc(db,'users',userId),{followers:isNowFollowing?arrayUnion(currentUser.uid):arrayRemove(currentUser.uid)});
    await updateDoc(doc(db,'users',currentUser.uid),{following:isNowFollowing?arrayUnion(userId):arrayRemove(userId)});
    showToast(isNowFollowing?`Following @${user.username}!`:`Unfollowed @${user.username}`,'success');
  };

  if(loading) return <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:3000,display:'flex',alignItems:'center',justifyContent:'center'}}><Spinner size={40}/></div>;
  if(!user) return null;

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:3000,display:'flex',alignItems:'flex-end'}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:'100%',background:'#0D0D0D',borderTopLeftRadius:32,borderTopRightRadius:32,maxHeight:'90vh',overflowY:'auto',border:'1px solid rgba(255,255,255,0.07)'}}>
        <div style={{width:36,height:4,background:'rgba(255,255,255,0.12)',borderRadius:2,margin:'16px auto 0'}}/>
        <div style={{display:'flex',justifyContent:'flex-end',padding:'10px 16px 0'}}>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.08)',border:'none',borderRadius:'50%',width:34,height:34,color:'white',cursor:'pointer',fontSize:16}}>✕</button>
        </div>
        <div style={{textAlign:'center',padding:'4px 20px 20px'}}>
          <div style={{width:86,height:86,borderRadius:'50%',padding:2.5,background:'conic-gradient(#FF2D55,#FF9500,#AF52DE,#FF2D55)',margin:'0 auto 14px'}}>
            <div style={{width:'100%',height:'100%',borderRadius:'50%',background:'#0D0D0D',padding:2}}>
              {user.avatarUrl?<img src={user.avatarUrl} alt="" style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}}/>
                :<div style={{width:'100%',height:'100%',borderRadius:'50%',background:user.avatarColor,display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:800,fontSize:30}}>{user.avatar}</div>}
            </div>
          </div>
          <div style={{color:'white',fontWeight:800,fontSize:20,fontFamily:"'Syne',sans-serif"}}>@{user.username}</div>
          {user.verified&&<div style={{display:'inline-flex',alignItems:'center',gap:4,color:'#1D9BF0',fontSize:12,marginTop:4,background:'rgba(29,155,240,0.1)',borderRadius:20,padding:'3px 10px'}}>✓ Verified</div>}
          <div style={{color:'rgba(255,255,255,0.5)',fontSize:13,marginTop:8,lineHeight:1.5}}>{user.bio}</div>
          <div style={{display:'flex',justifyContent:'center',gap:0,marginTop:16,background:'rgba(255,255,255,0.03)',borderRadius:20,padding:'12px 0',border:'1px solid rgba(255,255,255,0.06)'}}>
            {[['Posts',videos.length],['Followers',user.followers?.length||0],['Following',user.following?.length||0]].map(([label,val],i)=>(
              <div key={label} style={{flex:1,textAlign:'center',borderRight:i<2?'1px solid rgba(255,255,255,0.07)':''}}>
                <div style={{color:'white',fontWeight:800,fontSize:18,fontFamily:"'Syne',sans-serif"}}>{formatNumber(val)}</div>
                <div style={{color:'rgba(255,255,255,0.4)',fontSize:11,marginTop:2}}>{label}</div>
              </div>
            ))}
          </div>
          {userId!==currentUser?.uid && (
            <div style={{display:'flex',gap:8,marginTop:14}}>
              <button onClick={toggleFollow} style={{flex:1,background:following?'rgba(255,255,255,0.06)':'linear-gradient(135deg,#FF2D55,#AF52DE)',border:following?'1px solid rgba(255,255,255,0.12)':'none',borderRadius:14,padding:'12px',color:'white',fontWeight:700,cursor:'pointer',fontSize:14,fontFamily:"'Syne',sans-serif"}}>
                {following?'Following ✓':'+ Follow'}
              </button>
              <button onClick={()=>{onMessage?.(userId);onClose();}} style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,padding:'12px',color:'white',fontWeight:600,cursor:'pointer',fontSize:14}}>Message</button>
            </div>
          )}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:2,padding:2}}>
          {videos.map(v=>(
            <div key={v.id} style={{aspectRatio:'9/16',background:'#1a1a1a',position:'relative',overflow:'hidden'}}>
              <video src={v.videoUrl} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              <div style={{position:'absolute',bottom:4,left:4,color:'white',fontSize:10,fontWeight:700,background:'rgba(0,0,0,0.6)',borderRadius:6,padding:'2px 5px'}}>▶ {formatNumber(v.views)}</div>
            </div>
          ))}
        </div>
        <div style={{height:20}}/>
      </div>
    </div>
  );
};

/* ── SEARCH ── */
const SearchPage = ({currentUser,onClose,onViewProfile}) => {
  const [query,setQuery] = useState('');
  const [results,setResults] = useState({users:[],videos:[]});
  const [loading,setLoading] = useState(false);

  useEffect(()=>{
    if(!query.trim()){setResults({users:[],videos:[]});return;}
    setLoading(true);
    const t=setTimeout(async()=>{
      const [uSnap,vSnap] = await Promise.all([
        getDocs(collection(db,'users')),
        getDocs(query(collection(db,'videos'),orderBy('createdAt','desc'),limit(20))),
      ]);
      const q=query.toLowerCase();
      const users=uSnap.docs.map(d=>({uid:d.id,...d.data()})).filter(u=>u.username?.toLowerCase().includes(q)||u.fullName?.toLowerCase().includes(q));
      const videos=vSnap.docs.map(d=>({id:d.id,...d.data()})).filter(v=>v.description?.toLowerCase().includes(q)||v.username?.toLowerCase().includes(q));
      setResults({users,videos});
      setLoading(false);
    },400);
    return()=>clearTimeout(t);
  },[query]);

  return (
    <div style={{position:'absolute',inset:0,background:'#080808',zIndex:200,display:'flex',flexDirection:'column'}}>
      <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',gap:10,alignItems:'center',flexShrink:0}}>
        <div style={{flex:1,display:'flex',alignItems:'center',background:'rgba(255,255,255,0.06)',borderRadius:28,padding:'10px 16px',border:'1px solid rgba(255,255,255,0.08)'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" style={{marginRight:10,flexShrink:0}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search users, videos..." style={{flex:1,background:'none',border:'none',color:'white',outline:'none',fontSize:14}}/>
        </div>
        <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',fontSize:14,cursor:'pointer',fontWeight:600,whiteSpace:'nowrap'}}>Cancel</button>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:12}}>
        {loading && <div style={{display:'flex',justifyContent:'center',padding:32}}><Spinner/></div>}
        {!query && !loading && (
          <div style={{padding:'8px 4px'}}>
            <div style={{color:'rgba(255,255,255,0.3)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:14}}>Trending</div>
            {['#fyp','#trending','#viral','#art','#music','#dance','#food','#travel'].map(tag=>(
              <div key={tag} onClick={()=>setQuery(tag)} style={{padding:'12px 14px',background:'rgba(255,255,255,0.03)',borderRadius:14,marginBottom:8,color:'#007AFF',fontSize:15,fontWeight:700,border:'1px solid rgba(255,255,255,0.05)',cursor:'pointer',fontFamily:"'Syne',sans-serif"}}>{tag}</div>
            ))}
          </div>
        )}
        {results.users.length>0 && <>
          <div style={{color:'rgba(255,255,255,0.3)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:10,padding:'4px 4px 0'}}>People</div>
          {results.users.map(u=>(
            <div key={u.uid} onClick={()=>{onViewProfile?.(u.uid);onClose();}} style={{display:'flex',alignItems:'center',gap:12,padding:'12px',background:'rgba(255,255,255,0.03)',borderRadius:16,marginBottom:8,cursor:'pointer',border:'1px solid rgba(255,255,255,0.05)'}}>
              {u.avatarUrl?<img src={u.avatarUrl} alt="" style={{width:46,height:46,borderRadius:'50%',objectFit:'cover'}}/>
                :<div style={{width:46,height:46,borderRadius:'50%',background:u.avatarColor||'#333',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:18}}>{u.avatar||'U'}</div>}
              <div>
                <div style={{color:'white',fontWeight:700,fontSize:14,fontFamily:"'Syne',sans-serif"}}>@{u.username}</div>
                <div style={{color:'rgba(255,255,255,0.35)',fontSize:11,marginTop:2}}>{u.fullName} · {formatNumber(u.followers?.length||0)} followers</div>
              </div>
            </div>
          ))}
        </>}
        {results.videos.length>0 && <>
          <div style={{color:'rgba(255,255,255,0.3)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:10,padding:'8px 4px 0'}}>Videos</div>
          {results.videos.map(v=>(
            <div key={v.id} style={{padding:'12px',background:'rgba(255,255,255,0.03)',borderRadius:16,marginBottom:8,border:'1px solid rgba(255,255,255,0.05)'}}>
              <div style={{color:'#FF2D55',fontSize:12,fontWeight:700}}>@{v.username}</div>
              <div style={{color:'rgba(255,255,255,0.75)',fontSize:13,marginTop:4,lineHeight:1.4}}>{v.description}</div>
              <div style={{color:'rgba(255,255,255,0.3)',fontSize:11,marginTop:6}}>{formatNumber(v.views)} views · {formatNumber(v.likes)} likes</div>
            </div>
          ))}
        </>}
        {query&&!loading&&results.users.length===0&&results.videos.length===0 && (
          <div style={{textAlign:'center',padding:48,color:'rgba(255,255,255,0.2)'}}>
            <div style={{fontSize:40,marginBottom:12}}>🔍</div>
            <div>No results for "{query}"</div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── NOTIFICATION BELL ── */
const NotificationsPage = ({currentUser}) => {
  const [notifications,setNotifications] = useState([]);
  useEffect(()=>{
    if(!currentUser?.uid) return;
    const q=query(collection(db,'notifications'),where('recipientId','==',currentUser.uid),orderBy('createdAt','desc'),limit(30));
    const unsub=onSnapshot(q,snap=>setNotifications(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return unsub;
  },[currentUser?.uid]);

  const notifIcon = type => ({like:'❤️',comment:'💬',follow:'👤',gift:'🎁'}[type]||'🔔');

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'#080808'}}>
      <div style={{padding:'16px 16px 12px',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0}}>
        <div style={{color:'white',fontWeight:800,fontSize:22,fontFamily:"'Syne',sans-serif"}}>Notifications</div>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {notifications.length===0 && (
          <div style={{textAlign:'center',padding:60,color:'rgba(255,255,255,0.2)'}}>
            <div style={{fontSize:48,marginBottom:12}}>🔔</div>
            <div style={{fontSize:14}}>No notifications yet</div>
          </div>
        )}
        {notifications.map(n=>(
          <div key={n.id} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.04)',background:n.read?'transparent':'rgba(255,45,85,0.04)'}}>
            <div style={{width:44,height:44,borderRadius:'50%',background:n.avatarColor||'#333',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,flexShrink:0}}>
              {n.avatar||notifIcon(n.type)}
            </div>
            <div style={{flex:1}}>
              <div style={{color:'white',fontSize:13,lineHeight:1.4}}>{n.message}</div>
              <div style={{color:'rgba(255,255,255,0.3)',fontSize:11,marginTop:3}}>{timeAgo(n.createdAt)}</div>
            </div>
            <div style={{fontSize:20}}>{notifIcon(n.type)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── MAIN APP ── */
export default function DaguUltimate() {
  const [currentUser,setCurrentUser] = useState(null);
  const [authChecked,setAuthChecked] = useState(false);
  const [activeTab,setActiveTab] = useState('home');
  const [toast,setToast] = useState(null);
  const [showSearch,setShowSearch] = useState(false);
  const [showCreate,setShowCreate] = useState(false);
  const [viewingProfile,setViewingProfile] = useState(null);
  const [unreadNotifs,setUnreadNotifs] = useState(0);

  const showToast = useCallback((message,type='info')=>setToast({message,type}),[]);

  /* Auth listener */
  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async user=>{
      if(user){
        const snap = await getDoc(doc(db,'users',user.uid));
        if(snap.exists()) setCurrentUser({...snap.data(),uid:user.uid});
      } else { setCurrentUser(null); }
      setAuthChecked(true);
    });
    return unsub;
  },[]);

  /* Unread notifications */
  useEffect(()=>{
    if(!currentUser?.uid) return;
    const q=query(collection(db,'notifications'),where('recipientId','==',currentUser.uid),where('read','==',false));
    const unsub=onSnapshot(q,snap=>setUnreadNotifs(snap.size));
    return unsub;
  },[currentUser?.uid]);

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setActiveTab('home');
    showToast('Signed out','info');
  };

  const handleViewProfile = uid => {
    if(uid===currentUser?.uid) setActiveTab('profile');
    else setViewingProfile(uid);
  };

  const handleMessage = uid => {
    setActiveTab('messages');
    setViewingProfile(null);
  };

  if(!authChecked) return (
    <div style={{height:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',background:'#050505'}}>
      <GlobalStyles/>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:52,marginBottom:16}}>🎬</div>
        <Spinner size={36}/>
      </div>
    </div>
  );

  if(!currentUser) return (
    <div style={{maxWidth:430,margin:'0 auto',height:'100dvh',background:'#050505',overflow:'hidden'}}>
      <GlobalStyles/>
      <AuthScreen onAuth={setCurrentUser} showToast={showToast}/>
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );

  const tabs = [
    {id:'home',icon:(a)=><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke={a?'white':'rgba(255,255,255,0.35)'} strokeWidth={a?2.5:2} strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>},
    {id:'search',icon:(a)=><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke={a?'white':'rgba(255,255,255,0.35)'} strokeWidth={a?2.5:2} strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>},
    {id:'create',icon:()=><div style={{width:52,height:34,background:'linear-gradient(135deg,#FF2D55,#AF52DE)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 20px rgba(255,45,85,0.45)'}}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>},
    {id:'notifications',icon:(a)=><div style={{position:'relative'}}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke={a?'white':'rgba(255,255,255,0.35)'} strokeWidth={a?2.5:2} strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>{unreadNotifs>0&&<div style={{position:'absolute',top:-2,right:-4,width:8,height:8,background:'#FF2D55',borderRadius:'50%',border:'1.5px solid #080808'}}/>}</div>},
    {id:'profile',icon:(a)=><svg viewBox="0 0 24 24" width="24" height="24" fill={a?'rgba(255,45,85,0.15)':'none'} stroke={a?'white':'rgba(255,255,255,0.35)'} strokeWidth={a?2.5:2} strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>},
  ];

  return (
    <div style={{maxWidth:430,margin:'0 auto',height:'100dvh',background:'#050505',display:'flex',flexDirection:'column',position:'relative',overflow:'hidden'}}>
      <GlobalStyles/>

      {/* Main Content */}
      <div style={{flex:1,overflow:'hidden',position:'relative',minHeight:0}}>
        {showSearch && <SearchPage currentUser={currentUser} onClose={()=>setShowSearch(false)} onViewProfile={handleViewProfile}/>}
        {showCreate && <CreatePost currentUser={currentUser} showToast={showToast} onDone={()=>{setShowCreate(false);setActiveTab('home');}}/>}

        {!showSearch && !showCreate && (
          <>
            {activeTab==='home' && <HomeFeed currentUser={currentUser} showToast={showToast} onViewProfile={handleViewProfile} onOpenSearch={()=>setShowSearch(true)}/>}
            {activeTab==='search' && <SearchPage currentUser={currentUser} onClose={()=>setActiveTab('home')} onViewProfile={handleViewProfile}/>}
            {activeTab==='notifications' && <NotificationsPage currentUser={currentUser}/>}
            {activeTab==='messages' && <MessagesPage currentUser={currentUser} showToast={showToast}/>}
            {activeTab==='profile' && <ProfilePage currentUser={currentUser} setCurrentUser={setCurrentUser} onLogout={handleLogout} showToast={showToast} onViewProfile={handleViewProfile}/>}
          </>
        )}
      </div>

      {/* Tab Bar */}
      {!showCreate && (
        <div style={{display:'flex',background:'rgba(5,5,5,0.98)',borderTop:'1px solid rgba(255,255,255,0.07)',padding:'12px 8px 28px',flexShrink:0,backdropFilter:'blur(24px)'}}>
          {tabs.map(tab=>{
            const isActive = activeTab===tab.id && !showSearch;
            return (
              <button key={tab.id} onClick={()=>{
                if(tab.id==='create'){setShowCreate(true);}
                else if(tab.id==='search'){setShowSearch(true);setActiveTab('search');}
                else {setActiveTab(tab.id);setShowSearch(false);setShowCreate(false);}
              }} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:0,background:'none',border:'none',cursor:'pointer',padding:'4px 0',position:'relative'}}>
                {tab.icon(isActive)}
                {isActive && tab.id!=='create' && <div style={{position:'absolute',bottom:-10,width:4,height:4,borderRadius:'50%',background:'#FF2D55'}}/>}
              </button>
            );
          })}
        </div>
      )}

      {/* User Profile Modal */}
      {viewingProfile && (
        <UserProfileModal userId={viewingProfile} currentUser={currentUser} onClose={()=>setViewingProfile(null)} showToast={showToast} onMessage={handleMessage}/>
      )}

      {toast && <Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
}
