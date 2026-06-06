import { useEffect, useState } from "react";
import { db, auth, storage } from "../firebase";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { signOut } from "firebase/auth";

const REPORT_REASONS = [
  "Spam or misleading",
  "Harassment or bullying",
  "Hate speech",
  "Violence or dangerous content",
  "Nudity or sexual content",
  "False information",
  "Other",
];

export default function Profile({ userId, currentUserId, onBack, onMessage }) {
  const [profile, setProfile] = useState(null);
  const [videos, setVideos] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [showEditPic, setShowEditPic] = useState(false);
  const [uploading, setUploading] = useState(false);

  const targetId = userId || currentUserId;
  const isOwn = currentUserId === targetId;

  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    const fetch = async () => {
      try {
        const snap = await getDoc(doc(db, "users", targetId));
        if (snap.exists()) {
          const data = snap.data();
          setProfile(data);
          setIsFollowing(data.followers?.includes(currentUserId) || false);
          setFollowerCount(data.followers?.length || 0);
        }
        const q = query(collection(db, "videos"), where("userId", "==", targetId));
        const vSnap = await getDocs(q);
        setVideos(vSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetch();
  }, [targetId, currentUserId]);

  const toggleFollow = async () => {
    if (!currentUserId) return;
    const prev = isFollowing;
    setIsFollowing(!prev); setFollowerCount(c => prev ? c - 1 : c + 1);
    try {
      await updateDoc(doc(db, "users", targetId), { followers: prev ? arrayRemove(currentUserId) : arrayUnion(currentUserId) });
      await updateDoc(doc(db, "users", currentUserId), { following: prev ? arrayRemove(targetId) : arrayUnion(targetId) });
    } catch { setIsFollowing(prev); setFollowerCount(c => prev ? c + 1 : c - 1); }
  };

  const handleReport = async () => {
    if (!reportReason) return;
    try {
      await addDoc(collection(db, "reports"), {
        reportedUserId: targetId,
        reportedBy: currentUserId,
        reason: reportReason,
        createdAt: serverTimestamp(),
      });
      setReportSent(true);
    } catch (e) { console.error(e); }
  };

  const handlePickPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUserId) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `avatars/${currentUserId}_${Date.now()}`);
      const task = uploadBytesResumable(storageRef, file);
      task.on("state_changed", null, null, async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await updateDoc(doc(db, "users", currentUserId), { photoURL: url });
        setProfile(p => ({ ...p, photoURL: url }));
        setUploading(false); setShowEditPic(false);
      });
    } catch { setUploading(false); }
  };

  if (loading) return (
    <div style={{minHeight:"100vh",background:"#000",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:"#555",fontSize:14}}>Loading profile...</div>
    </div>
  );

  if (!profile) return (
    <div style={{minHeight:"100vh",background:"#000",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:"#555",fontSize:14}}>User not found</div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#0a0a0a",color:"#fff",paddingBottom:100}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 16px 0"}}>
        <button onClick={onBack} style={{background:"#1a1a1a",border:"none",borderRadius:20,padding:"8px 14px",color:"#fff",cursor:"pointer",fontSize:13}}>← Back</button>
        {!isOwn && (
          <button onClick={() => setShowMenu(!showMenu)} style={{background:"#1a1a1a",border:"none",borderRadius:"50%",width:38,height:38,color:"#fff",fontSize:20,cursor:"pointer",position:"relative"}}>
            •••
            {showMenu && (
              <div style={{position:"absolute",top:44,right:0,background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:16,padding:6,minWidth:160,zIndex:50}}>
                <button onClick={() => { onMessage?.(targetId); setShowMenu(false); }} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",color:"#fff",cursor:"pointer",fontSize:13}}>💬 Send Message</button>
                <button onClick={() => { setShowReport(true); setShowMenu(false); }} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",color:"#ff9500",cursor:"pointer",fontSize:13}}>⚠️ Report User</button>
                <button style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",color:"#ff2d55",cursor:"pointer",fontSize:13}}>🚫 Block User</button>
              </div>
            )}
          </button>
        )}
        {isOwn && (
          <button onClick={() => signOut(auth)} style={{background:"#1a1a1a",border:"none",borderRadius:20,padding:"8px 14px",color:"#ff2d55",cursor:"pointer",fontSize:13}}>Logout</button>
        )}
      </div>

      {/* Profile Info */}
      <div style={{textAlign:"center",padding:"24px 20px 16px"}}>
        <div style={{position:"relative",display:"inline-block",marginBottom:12}}>
          {profile.photoURL ? (
            <img src={profile.photoURL} alt="avatar" style={{width:90,height:90,borderRadius:"50%",objectFit:"cover",border:"3px solid #ff2d55"}} />
          ) : (
            <div style={{width:90,height:90,borderRadius:"50%",background:"#ff2d55",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,fontWeight:700,border:"3px solid #ff2d55"}}>
              {profile.username?.[0]?.toUpperCase()}
            </div>
          )}
          {isOwn && (
            <label style={{position:"absolute",bottom:0,right:0,background:"#ff2d55",borderRadius:"50%",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14}}>
              📷
              <input type="file" accept="image/*" onChange={handlePickPhoto} style={{display:"none"}} />
            </label>
          )}
        </div>
        {uploading && <p style={{color:"#888",fontSize:12,marginBottom:8}}>Uploading photo...</p>}
        <h2 style={{fontSize:20,fontWeight:700,marginBottom:4}}>@{profile.username}</h2>
        {profile.bio && <p style={{color:"#888",fontSize:13,marginBottom:16}}>{profile.bio}</p>}

        {/* Stats */}
        <div style={{display:"flex",justifyContent:"center",gap:32,marginBottom:20}}>
          <div style={{textAlign:"center"}}><div style={{fontWeight:700,fontSize:18}}>{videos.length}</div><div style={{color:"#666",fontSize:11}}>Videos</div></div>
          <div style={{textAlign:"center"}}><div style={{fontWeight:700,fontSize:18}}>{followerCount}</div><div style={{color:"#666",fontSize:11}}>Followers</div></div>
          <div style={{textAlign:"center"}}><div style={{fontWeight:700,fontSize:18}}>{profile.following?.length || 0}</div><div style={{color:"#666",fontSize:11}}>Following</div></div>
        </div>

        {/* Action Buttons */}
        {!isOwn && (
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            <button onClick={toggleFollow} style={{background:isFollowing?"#1a1a1a":"#ff2d55",border:isFollowing?"1px solid #333":"none",borderRadius:24,padding:"10px 28px",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:14}}>
              {isFollowing ? "✓ Following" : "+ Follow"}
            </button>
            <button onClick={() => onMessage?.(targetId)} style={{background:"#1a1a1a",border:"1px solid #333",borderRadius:24,padding:"10px 20px",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:14}}>
              💬 Message
            </button>
          </div>
        )}
      </div>

      {/* Videos Grid */}
      <div style={{padding:"0 12px"}}>
        <h3 style={{color:"#888",fontSize:12,fontWeight:600,marginBottom:10,paddingLeft:4}}>VIDEOS</h3>
        {videos.length === 0 ? (
          <div style={{textAlign:"center",padding:40,color:"#444"}}>
            <div style={{fontSize:40,marginBottom:10}}>🎬</div>
            <p style={{fontSize:13}}>No videos yet</p>
          </div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3}}>
            {videos.map(v => (
              <div key={v.id} style={{aspectRatio:"9/16",background:"#111",borderRadius:8,overflow:"hidden"}}>
                <video src={v.url || v.videoUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} muted playsInline />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report Modal */}
      {showReport && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"flex-end"}} onClick={() => setShowReport(false)}>
          <div onClick={e => e.stopPropagation()} style={{width:"100%",background:"#111",borderTopLeftRadius:28,borderTopRightRadius:28,padding:24}}>
            {reportSent ? (
              <div style={{textAlign:"center",padding:"20px 0"}}>
                <div style={{fontSize:48,marginBottom:12}}>✅</div>
                <h3 style={{color:"#fff",fontSize:18,fontWeight:700,marginBottom:8}}>Report Submitted</h3>
                <p style={{color:"#888",fontSize:13,marginBottom:20}}>Thank you. We will review this report.</p>
                <button onClick={() => { setShowReport(false); setReportSent(false); setReportReason(""); }} style={{background:"#ff2d55",border:"none",borderRadius:20,padding:"12px 28px",color:"#fff",fontWeight:700,cursor:"pointer"}}>Done</button>
              </div>
            ) : (
              <>
                <h3 style={{color:"#fff",fontSize:18,fontWeight:700,marginBottom:6}}>Report @{profile.username}</h3>
                <p style={{color:"#666",fontSize:13,marginBottom:16}}>Why are you reporting this account?</p>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
                  {REPORT_REASONS.map(reason => (
                    <button key={reason} onClick={() => setReportReason(reason)} style={{textAlign:"left",padding:"12px 16px",background:reportReason===reason?"rgba(255,45,85,0.15)":"#1a1a1a",border:reportReason===reason?"1px solid #ff2d55":"1px solid #2a2a2a",borderRadius:14,color:reportReason===reason?"#ff2d55":"#ccc",cursor:"pointer",fontSize:14}}>
                      {reportReason === reason ? "✓ " : ""}{reason}
                    </button>
                  ))}
                </div>
                <button onClick={handleReport} disabled={!reportReason} style={{width:"100%",background:reportReason?"#ff2d55":"#222",border:"none",borderRadius:20,padding:"14px",color:"#fff",fontWeight:700,cursor:reportReason?"pointer":"default",fontSize:15}}>
                  Submit Report
                </button>
                <button onClick={() => setShowReport(false)} style={{width:"100%",background:"none",border:"none",color:"#555",marginTop:10,cursor:"pointer",fontSize:13,padding:"8px"}}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}