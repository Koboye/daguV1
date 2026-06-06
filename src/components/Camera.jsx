import { useEffect, useRef, useState } from "react";
import { db, storage, auth } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

export default function Camera({ onClose }) {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const [hasPermission, setHasPermission] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedURL, setRecordedURL] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploaded, setUploaded] = useState(false);
  const [caption, setCaption] = useState("");
  const [facingMode, setFacingMode] = useState("user");
  const [error, setError] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);

  useEffect(() => { startCamera(); return () => stopCamera(); }, [facingMode]);

  const startCamera = async () => {
    stopCamera(); setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setHasPermission(true);
    } catch (err) {
      setHasPermission(false);
      setError(err.name === "NotAllowedError" ? "Camera permission denied. Please allow camera access in your browser settings." : err.name === "NotFoundError" ? "No camera found on this device." : "Could not access camera: " + err.message);
    }
  };

  const stopCamera = () => { if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; } };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = []; setRecordedBlob(null); setRecordedURL(null); setUploaded(false); setRecordingTime(0);
    const recorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => { const blob = new Blob(chunksRef.current, { type: "video/webm" }); setRecordedBlob(blob); setRecordedURL(URL.createObjectURL(blob)); };
    recorder.start(); setIsRecording(true);
    timerRef.current = setInterval(() => { setRecordingTime(t => { if (t >= 59) { stopRecording(); return 60; } return t + 1; }); }, 1000);
  };

  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); clearInterval(timerRef.current); } };
  const discard = () => { setRecordedBlob(null); setRecordedURL(null); setCaption(""); setUploaded(false); setRecordingTime(0); };

  const uploadVideo = async () => {
    if (!recordedBlob || !auth.currentUser) { setError("You must be logged in to post."); return; }
    setUploading(true); setUploadProgress(0);
    try {
      const fileName = `videos/${auth.currentUser.uid}_${Date.now()}.webm`;
      const storageRef = ref(storage, fileName);
      const task = uploadBytesResumable(storageRef, recordedBlob);
      task.on("state_changed",
        snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        err => { setError("Upload failed: " + err.message); setUploading(false); },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          await addDoc(collection(db, "videos"), { url, videoUrl: url, caption: caption.trim(), userId: auth.currentUser.uid, likes: [], comments: [], createdAt: serverTimestamp() });
          setUploaded(true); setUploading(false);
          setTimeout(() => { discard(); onClose?.(); }, 1500);
        }
      );
    } catch (err) { setError("Upload failed: " + err.message); setUploading(false); }
  };

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  if (hasPermission === false) return (
    <div style={{minHeight:"100vh",background:"#000",color:"#fff",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,textAlign:"center"}}>
      <div style={{fontSize:64,marginBottom:16}}>📵</div>
      <h2 style={{fontSize:20,fontWeight:700,marginBottom:8}}>Camera Access Denied</h2>
      <p style={{color:"#888",fontSize:14,marginBottom:24}}>{error}</p>
      <button onClick={startCamera} style={{background:"#ff2d55",border:"none",borderRadius:24,padding:"12px 28px",color:"#fff",fontWeight:700,cursor:"pointer",marginBottom:12}}>Try Again</button>
      <button onClick={onClose} style={{background:"#222",border:"none",borderRadius:24,padding:"12px 28px",color:"#fff",cursor:"pointer"}}>Cancel</button>
    </div>
  );

  if (recordedURL) return (
    <div style={{minHeight:"100vh",background:"#000",color:"#fff",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
      <h2 style={{fontSize:18,fontWeight:700,marginBottom:16}}>Preview Your Video</h2>
      <video src={recordedURL} controls autoPlay style={{width:"100%",maxWidth:380,borderRadius:20,border:"1px solid #222",marginBottom:16}} />
      <input type="text" placeholder="Add a caption..." value={caption} onChange={e=>setCaption(e.target.value)} style={{width:"100%",maxWidth:380,background:"#1a1a1a",border:"1px solid #333",borderRadius:16,padding:"12px 16px",color:"#fff",outline:"none",fontSize:14,marginBottom:16,boxSizing:"border-box"}} />
      {uploading && <div style={{width:"100%",maxWidth:380,marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",color:"#888",fontSize:12,marginBottom:6}}><span>Uploading...</span><span>{uploadProgress}%</span></div><div style={{background:"#222",borderRadius:8,height:6}}><div style={{background:"#ff2d55",height:6,borderRadius:8,width:`${uploadProgress}%`,transition:"width 0.3s"}} /></div></div>}
      {uploaded && <p style={{color:"#06d6a0",fontWeight:700,marginBottom:16}}>✅ Posted successfully!</p>}
      {error && <p style={{color:"#ff2d55",fontSize:13,marginBottom:12}}>{error}</p>}
      <div style={{display:"flex",gap:12,width:"100%",maxWidth:380}}>
        <button onClick={discard} style={{flex:1,background:"#222",border:"none",borderRadius:20,padding:"14px",color:"#fff",fontWeight:700,cursor:"pointer"}}>🗑️ Discard</button>
        <button onClick={uploadVideo} disabled={uploading} style={{flex:1,background:"#ff2d55",border:"none",borderRadius:20,padding:"14px",color:"#fff",fontWeight:700,cursor:"pointer",opacity:uploading?0.6:1}}>{uploading?"Uploading...":"⬆️ Post"}</button>
      </div>
      <button onClick={onClose} style={{marginTop:12,background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:13}}>Cancel</button>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#000",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative"}}>
      <button onClick={onClose} style={{position:"absolute",top:20,left:20,background:"rgba(0,0,0,0.6)",border:"none",borderRadius:"50%",width:40,height:40,color:"#fff",fontSize:18,cursor:"pointer",zIndex:10}}>✕</button>
      <div style={{width:"100%",maxWidth:400,aspectRatio:"9/16",background:"#111",borderRadius:24,overflow:"hidden",position:"relative"}}>
        <video ref={videoRef} autoPlay playsInline muted style={{width:"100%",height:"100%",objectFit:"cover",transform:facingMode==="user"?"scaleX(-1)":"none"}} />
        {isRecording && <div style={{position:"absolute",top:16,left:0,right:0,display:"flex",justifyContent:"center"}}><div style={{background:"#ff2d55",borderRadius:20,padding:"6px 14px",display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:"50%",background:"#fff"}} /><span style={{color:"#fff",fontWeight:700,fontSize:13}}>REC {fmt(recordingTime)}</span></div></div>}
        <button onClick={()=>setFacingMode(p=>p==="user"?"environment":"user")} style={{position:"absolute",top:16,right:16,background:"rgba(0,0,0,0.5)",border:"none",borderRadius:"50%",width:40,height:40,fontSize:20,cursor:"pointer"}}>🔄</button>
      </div>
      <div style={{marginTop:32,display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
        <button onClick={isRecording?stopRecording:startRecording} style={{width:80,height:80,borderRadius:"50%",border:"4px solid #fff",background:"#ff2d55",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {isRecording?<div style={{width:28,height:28,background:"#fff",borderRadius:4}} />:<div style={{width:50,height:50,background:"#c0001a",borderRadius:"50%"}} />}
        </button>
        <p style={{color:"#888",fontSize:12}}>{isRecording?"Tap to stop":"Tap to record"}</p>
        <p style={{color:"#555",fontSize:11}}>Max 60 seconds</p>
      </div>
    </div>
  );
}