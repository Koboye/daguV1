import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { auth, db, storage } from './firebase';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from 'firebase/auth';
import {
  collection, addDoc, getDocs, onSnapshot, doc,
  updateDoc, getDoc, arrayUnion, arrayRemove,
  serverTimestamp, query, orderBy, where, setDoc
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

// ─── HELPERS ─────────────────────────────────────────────────
const fmt = (num) => {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
};

const fmtTime = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// ─── CAMERA FILTERS ──────────────────────────────────────────
const FILTERS = [
  { id: 'none',       label: 'Normal',   css: 'none' },
  { id: 'vivid',      label: 'Vivid',    css: 'saturate(2) contrast(1.1)' },
  { id: 'warm',       label: 'Warm',     css: 'sepia(0.4) saturate(1.5)' },
  { id: 'cool',       label: 'Cool',     css: 'hue-rotate(30deg) saturate(1.3)' },
  { id: 'bw',         label: 'B&W',      css: 'grayscale(1)' },
  { id: 'fade',       label: 'Fade',     css: 'opacity(0.85) brightness(1.1)' },
  { id: 'drama',      label: 'Drama',    css: 'contrast(1.5) brightness(0.85)' },
  { id: 'vintage',    label: 'Vintage',  css: 'sepia(0.6) contrast(1.1) brightness(0.9)' },
];

const GIFTS = [
  { id: 'rose',    icon: '🌹', price: 50  },
  { id: 'fire',    icon: '🔥', price: 100 },
  { id: 'diamond', icon: '💎', price: 500 },
  { id: 'crown',   icon: '👑', price: 1000},
  { id: 'rocket',  icon: '🚀', price: 2000},
];

const REPORT_REASONS = [
  'Spam or misleading',
  'Harassment or bullying',
  'Hate speech',
  'Violence or dangerous content',
  'Nudity or sexual content',
  'False information',
  'Other',
];

// ─── TOAST ───────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  const bg = { success: '#06d6a0', error: '#ff2d55', info: '#fff', warning: '#ff9500' };
  return (
    <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: '#111', border: `1px solid ${bg[type] || '#333'}`, borderRadius: 30, padding: '10px 20px', color: bg[type] || '#fff', fontSize: 13, zIndex: 9999, whiteSpace: 'nowrap', maxWidth: '90vw', backdropFilter: 'blur(10px)' }}>
      {message}
    </div>
  );
};

// ─── REPORT MODAL ────────────────────────────────────────────
const ReportModal = ({ targetId, targetType, reportedBy, onClose, showToast }) => {
  const [reason, setReason] = useState('');
  const [sent, setSent] = useState(false);
  const submit = async () => {
    if (!reason) return;
    try {
      await addDoc(collection(db, 'reports'), { targetId, targetType, reportedBy, reason, createdAt: serverTimestamp() });
      setSent(true);
    } catch { showToast('Failed to submit', 'error'); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 5000, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#111', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '80vh', overflowY: 'auto' }}>
        {sent ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h3 style={{ color: '#fff', marginBottom: 8 }}>Report Submitted</h3>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>We will review this report.</p>
            <button onClick={onClose} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '12px 28px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Done</button>
          </div>
        ) : (
          <>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Report</h3>
            {REPORT_REASONS.map(r => (
              <button key={r} onClick={() => setReason(r)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', marginBottom: 8, background: reason === r ? 'rgba(255,45,85,0.15)' : '#1a1a1a', border: reason === r ? '1px solid #ff2d55' : '1px solid #2a2a2a', borderRadius: 14, color: reason === r ? '#ff2d55' : '#ccc', cursor: 'pointer', fontSize: 14 }}>
                {reason === r ? '✓ ' : ''}{r}
              </button>
            ))}
            <button onClick={submit} disabled={!reason} style={{ width: '100%', marginTop: 8, background: reason ? '#ff2d55' : '#222', border: 'none', borderRadius: 20, padding: 14, color: '#fff', fontWeight: 700, cursor: reason ? 'pointer' : 'default', fontSize: 15 }}>Submit Report</button>
            <button onClick={onClose} style={{ width: '100%', background: 'none', border: 'none', color: '#555', marginTop: 10, cursor: 'pointer', fontSize: 13, padding: 8 }}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
};

// ─── CREATE POST SCREEN ───────────────────────────────────────
const CreateScreen = ({ currentUser, onClose, showToast }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  const [mode, setMode] = useState('camera'); // camera | gallery | text
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('user');
  const [filter, setFilter] = useState(FILTERS[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedURL, setRecordedURL] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewURL, setPreviewURL] = useState(null);
  const [postType, setPostType] = useState('video'); // video | photo | text
  const [caption, setCaption] = useState('');
  const [textContent, setTextContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [step, setStep] = useState('capture'); // capture | preview | post

  // Start camera
  useEffect(() => {
    if (mode === 'camera') startCamera();
    return () => stopCamera();
  }, [mode, facingMode]);

  const startCamera = async () => {
    stopCamera();
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; }
      setCameraReady(true);
    } catch (err) {
      setCameraReady(false);
      setCameraError(err.name === 'NotAllowedError' ? 'Camera permission denied. Please allow in browser settings.' : 'Camera not available: ' + err.message);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  // Recording
  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      setRecordedURL(URL.createObjectURL(blob));
      setPostType('video');
      setStep('preview');
    };
    recorder.start();
    setIsRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(t => {
        if (t >= 59) { stopRecording(); return 60; }
        return t + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  // Capture photo
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.filter = filter.css;
    ctx.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(blob => {
      setRecordedBlob(blob);
      setRecordedURL(URL.createObjectURL(blob));
      setPostType('photo');
      setStep('preview');
    }, 'image/jpeg', 0.92);
  };

  // Gallery pick
  const handleGalleryPick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewURL(url);
    setPostType(file.type.startsWith('video') ? 'video' : 'photo');
    setStep('preview');
  };

  // Upload and post
  const handlePost = async () => {
    if (!currentUser?.uid) { showToast('Please log in first', 'error'); return; }
    if (postType === 'text') {
      if (!textContent.trim()) { showToast('Write something first!', 'error'); return; }
      try {
        await addDoc(collection(db, 'posts'), {
          type: 'text', text: textContent.trim(), caption: caption.trim(),
          userId: currentUser.uid, username: currentUser.username,
          photoURL: currentUser.photoURL || '',
          likes: [], comments: [], createdAt: serverTimestamp(),
        });
        showToast('Text post shared! 🎉', 'success');
        onClose();
      } catch { showToast('Failed to post', 'error'); }
      return;
    }

    const blob = recordedBlob || selectedFile;
    if (!blob) { showToast('No media selected', 'error'); return; }
    setUploading(true); setUploadProgress(0);
    try {
      const ext = postType === 'video' ? 'webm' : 'jpg';
      const path = `${postType}s/${currentUser.uid}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, blob);
      task.on('state_changed',
        snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        err => { showToast('Upload failed: ' + err.message, 'error'); setUploading(false); },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          await addDoc(collection(db, 'posts'), {
            type: postType, url, caption: caption.trim(),
            userId: currentUser.uid, username: currentUser.username,
            photoURL: currentUser.photoURL || '',
            likes: [], comments: [], filterUsed: filter.id,
            createdAt: serverTimestamp(),
          });
          showToast('Posted! 🎉', 'success');
          setUploading(false);
          onClose();
        }
      );
    } catch (err) { showToast('Failed: ' + err.message, 'error'); setUploading(false); }
  };

  const discard = () => {
    setRecordedBlob(null); setRecordedURL(null);
    setSelectedFile(null); setPreviewURL(null);
    setStep('capture'); setCaption('');
    if (mode === 'camera') startCamera();
  };

  // ── PREVIEW STEP ──
  if (step === 'preview') {
    const mediaURL = recordedURL || previewURL;
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a1a' }}>
          <button onClick={discard} style={{ background: '#1a1a1a', border: 'none', borderRadius: 20, padding: '8px 14px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>← Back</button>
          <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Preview</h3>
          <button onClick={handlePost} disabled={uploading} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 20px', color: '#fff', fontWeight: 700, cursor: uploading ? 'default' : 'pointer', fontSize: 13, opacity: uploading ? 0.7 : 1 }}>
            {uploading ? `${uploadProgress}%` : 'Post ✓'}
          </button>
        </div>

        {/* Media Preview */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {postType === 'video' ? (
            <video src={mediaURL} controls autoPlay loop style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', filter: filter.css }} />
          ) : (
            <img src={mediaURL} alt="preview" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', filter: filter.css }} />
          )}
          {uploading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <div style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>{uploadProgress}%</div>
              <div style={{ width: 200, background: '#333', borderRadius: 8, height: 6 }}>
                <div style={{ width: `${uploadProgress}%`, background: '#ff2d55', height: '100%', borderRadius: 8, transition: 'width 0.3s' }} />
              </div>
              <div style={{ color: '#888', fontSize: 13 }}>Uploading...</div>
            </div>
          )}
        </div>

        {/* Caption */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #1a1a1a' }}>
          <input
            placeholder="Write a caption..."
            value={caption}
            onChange={e => setCaption(e.target.value)}
            style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16, padding: '12px 16px', color: '#fff', outline: 'none', fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>
      </div>
    );
  }

  // ── TEXT POST STEP ──
  if (mode === 'text') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a1a' }}>
          <button onClick={onClose} style={{ background: '#1a1a1a', border: 'none', borderRadius: 20, padding: '8px 14px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>✕ Cancel</button>
          <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Text Post</h3>
          <button onClick={handlePost} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 20px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Post ✓</button>
        </div>
        <div style={{ flex: 1, padding: 16 }}>
          <textarea
            value={textContent}
            onChange={e => setTextContent(e.target.value)}
            placeholder="What's on your mind? Share something with Dagu..."
            autoFocus
            style={{ width: '100%', height: 220, background: '#141414', border: '1px solid #222', borderRadius: 16, padding: 16, color: '#fff', fontSize: 17, outline: 'none', resize: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}
          />
          <input
            placeholder="Add a caption (optional)..."
            value={caption}
            onChange={e => setCaption(e.target.value)}
            style={{ width: '100%', marginTop: 12, background: '#141414', border: '1px solid #222', borderRadius: 12, padding: '12px 16px', color: '#fff', outline: 'none', fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>
      </div>
    );
  }

  // ── CAMERA STEP ──
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>

      {/* Top Bar */}
      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 }}>
        <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: '#fff', fontSize: 18, cursor: 'pointer' }}>✕</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 40, height: 40, fontSize: 20, cursor: 'pointer' }}>🔄</button>
        </div>
      </div>

      {/* Camera Preview */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#111' }}>
        {cameraError ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📵</div>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>{cameraError}</p>
            <button onClick={startCamera} style={{ background: '#ff2d55', border: 'none', borderRadius: 24, padding: '12px 28px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Try Again</button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: facingMode === 'user' ? 'scaleX(-1)' : 'none', filter: filter.css }}
          />
        )}

        {/* Recording indicator */}
        {isRecording && (
          <div style={{ position: 'absolute', top: 70, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: '#ff2d55', borderRadius: 20, padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>REC {fmtTime(recordingTime)}</span>
            </div>
          </div>
        )}

        {/* Filter selector */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 0', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'inline-flex', gap: 12, padding: '0 16px' }}>
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer' }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: '#333', border: filter.id === f.id ? '2px solid #ff2d55' : '2px solid transparent', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  🎨
                </div>
                <span style={{ color: filter.id === f.id ? '#ff2d55' : '#ccc', fontSize: 10, fontWeight: filter.id === f.id ? 700 : 400 }}>{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ background: '#000', padding: '20px 16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Gallery */}
        <button onClick={() => fileInputRef.current?.click()} style={{ width: 56, height: 56, borderRadius: 14, background: '#1a1a1a', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, cursor: 'pointer' }}>
          🖼️
        </button>
        <input ref={fileInputRef} type="file" accept="video/*,image/*" onChange={handleGalleryPick} style={{ display: 'none' }} />

        {/* Record / Capture Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {/* Video record button */}
          <button
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            style={{ width: 76, height: 76, borderRadius: '50%', border: '4px solid #fff', background: isRecording ? '#ff2d55' : 'rgba(255,45,85,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
          >
            {isRecording
              ? <div style={{ width: 28, height: 28, background: '#fff', borderRadius: 4 }} />
              : <div style={{ width: 52, height: 52, background: '#ff2d55', borderRadius: '50%' }} />
            }
          </button>
          <span style={{ color: '#888', fontSize: 10 }}>{isRecording ? 'Release to stop' : 'Hold to record'}</span>
        </div>

        {/* Photo capture button */}
        <button onClick={capturePhoto} style={{ width: 56, height: 56, borderRadius: '50%', background: '#fff', border: '3px solid #ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, cursor: 'pointer' }}>
          📸
        </button>
      </div>

      {/* Mode switcher at very bottom */}
      <div style={{ background: '#000', borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'center', gap: 24, padding: '10px 0 20px' }}>
        {[['camera', '📹', 'Video'], ['text', '📝', 'Text']].map(([m, icon, label]) => (
          <button key={m} onClick={() => setMode(m)} style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ color: mode === m ? '#ff2d55' : '#555', fontSize: 11, fontWeight: mode === m ? 700 : 400 }}>{label}</span>
            {mode === m && <div style={{ width: 20, height: 2, background: '#ff2d55', borderRadius: 2 }} />}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── VIDEO / PHOTO CARD ───────────────────────────────────────
const PostCard = memo(({ post, currentUser, onViewProfile, onMessage, showToast }) => {
  const [liked, setLiked] = useState((post.likes || []).includes(currentUser?.uid));
  const [likeCount, setLikeCount] = useState((post.likes || []).length);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showGifts, setShowGifts] = useState(false);
  const videoRef = useRef(null);
  const lastTap = useRef(0);

  // Load comments
  useEffect(() => {
    if (!showComments) return;
    const unsub = onSnapshot(
      query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt')),
      snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [showComments, post.id]);

  const toggleLike = async () => {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(c => newLiked ? c + 1 : c - 1);
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        likes: newLiked ? arrayUnion(currentUser.uid) : arrayRemove(currentUser.uid)
      });
    } catch (e) { console.error(e); }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300 && !liked) toggleLike();
    lastTap.current = now;
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    try {
      await addDoc(collection(db, 'posts', post.id, 'comments'), {
        text: commentText, userId: currentUser?.uid,
        username: currentUser?.username || 'user',
        createdAt: serverTimestamp(),
      });
      setCommentText('');
    } catch { showToast('Failed to comment', 'error'); }
  };

  const isVideo = post.type === 'video';
  const isText = post.type === 'text';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000', overflow: 'hidden' }} onClick={handleDoubleTap}>

      {/* Media */}
      {isVideo && <video ref={videoRef} src={post.url} loop playsInline autoPlay muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      {post.type === 'photo' && <img src={post.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      {isText && (
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a0a2e, #0a0a1a, #1a0010)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <p style={{ color: '#fff', fontSize: 24, fontWeight: 700, textAlign: 'center', lineHeight: 1.5 }}>{post.text}</p>
        </div>
      )}

      {/* Gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)', pointerEvents: 'none' }} />

      {/* User info bottom left */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 68, padding: '18px 14px', zIndex: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div onClick={(e) => { e.stopPropagation(); onViewProfile?.(post.userId); }} style={{ width: 42, height: 42, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, border: '2px solid rgba(255,255,255,0.4)', cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
            {post.photoURL ? <img src={post.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (post.username?.[0] || '?').toUpperCase()}
          </div>
          <span onClick={(e) => { e.stopPropagation(); onViewProfile?.(post.userId); }} style={{ color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>@{post.username || 'user'}</span>
          <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} style={{ marginLeft: 'auto', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '4px 10px', color: '#fff', cursor: 'pointer', fontSize: 16 }}>•••</button>
        </div>
        {post.caption && <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>{post.caption}</p>}
      </div>

      {/* Action menu */}
      {showMenu && (
        <div onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} style={{ position: 'absolute', inset: 0, zIndex: 19 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 160, left: 14, background: '#181818', border: '1px solid #2a2a2a', borderRadius: 18, padding: 6, zIndex: 20, minWidth: 190 }}>
            {[
              ['💬', 'Message', () => { onMessage?.(post.userId); setShowMenu(false); }],
              ['⚠️', 'Report',  () => { setShowReport(true); setShowMenu(false); }],
              ['🚫', 'Block',   () => { showToast('User blocked', 'warning'); setShowMenu(false); }],
            ].map(([icon, label, fn]) => (
              <button key={label} onClick={(e) => { e.stopPropagation(); fn(); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: 'none', border: 'none', color: label === 'Block' ? '#ff2d55' : label === 'Report' ? '#ff9500' : '#fff', cursor: 'pointer', borderRadius: 12, fontSize: 13 }}>
                <span style={{ fontSize: 16 }}>{icon}</span>{label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Right action buttons */}
      <div style={{ position: 'absolute', right: 10, bottom: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, zIndex: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <button onClick={(e) => { e.stopPropagation(); toggleLike(); }} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{liked ? '❤️' : '🤍'}</button>
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{fmt(likeCount)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <button onClick={(e) => { e.stopPropagation(); setShowComments(true); }} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 24, cursor: 'pointer' }}>💬</button>
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{fmt(comments.length)}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); setShowGifts(!showGifts); }} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 22, cursor: 'pointer' }}>🎁</button>
        <button onClick={(e) => { e.stopPropagation(); onViewProfile?.(post.userId); }} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 22, cursor: 'pointer' }}>👤</button>
      </div>

      {/* Gifts picker */}
      {showGifts && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 200, right: 10, background: 'rgba(0,0,0,0.95)', borderRadius: 20, padding: 12, zIndex: 30 }}>
          {GIFTS.map(g => (
            <button key={g.id} onClick={() => { showToast(`Sent ${g.icon}! 🎁`, 'success'); setShowGifts(false); }} style={{ display: 'block', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, padding: '8px 12px', marginBottom: 6, cursor: 'pointer', width: '100%', textAlign: 'left', color: '#fff', fontSize: 13 }}>
              {g.icon} <span style={{ color: '#ffd700', fontSize: 11 }}>{g.price}🪙</span>
            </button>
          ))}
        </div>
      )}

      {/* Comments panel */}
      {showComments && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', inset: 0, background: '#0a0a0a', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e1e1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700 }}>💬 Comments</span>
            <button onClick={() => setShowComments(false)} style={{ background: '#1a1a1a', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {comments.length === 0 && <p style={{ color: '#444', textAlign: 'center', marginTop: 40 }}>No comments yet. Be first! 💬</p>}
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{c.username?.[0]?.toUpperCase()}</div>
                <div style={{ background: '#161616', borderRadius: 14, padding: '8px 12px', flex: 1 }}>
                  <div style={{ color: '#ff2d55', fontWeight: 600, fontSize: 11, marginBottom: 4 }}>@{c.username}</div>
                  <p style={{ color: '#ddd', fontSize: 13 }}>{c.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 12px', borderTop: '1px solid #1e1e1e', display: 'flex', gap: 6 }}>
            <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment()} placeholder="Add a comment..." style={{ flex: 1, background: '#161616', border: '1px solid #222', borderRadius: 20, padding: '8px 12px', color: '#fff', outline: 'none', fontSize: 13 }} />
            <button onClick={addComment} style={{ background: commentText.trim() ? '#ff2d55' : '#222', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', cursor: 'pointer', fontSize: 16 }}>↑</button>
          </div>
        </div>
      )}

      {showReport && (
        <ReportModal targetId={post.id} targetType="post" reportedBy={currentUser?.uid} onClose={() => setShowReport(false)} showToast={showToast} />
      )}
    </div>
  );
});

// ─── HOME FEED ────────────────────────────────────────────────
const HomeFeed = ({ posts, currentUser, onViewProfile, onMessage, showToast, followed }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tab, setTab] = useState('foryou');
  const startY = useRef(null);

  const feedPosts = useMemo(() => {
    if (tab === 'following') return posts.filter(p => followed.includes(p.userId));
    return posts;
  }, [posts, tab, followed]);

  const handleTouchStart = e => { startY.current = e.touches[0].clientY; };
  const handleTouchEnd = e => {
    if (startY.current === null) return;
    const dy = startY.current - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 50) {
      if (dy > 0) setCurrentIndex(i => Math.min(feedPosts.length - 1, i + 1));
      else setCurrentIndex(i => Math.max(0, i - 1));
    }
    startY.current = null;
  };

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Tab bar */}
      <div style={{ position: 'absolute', top: 12, left: 0, right: 0, zIndex: 15, display: 'flex', justifyContent: 'center', gap: 8 }}>
        {[['foryou', '🔥 For You'], ['following', '👥 Following']].map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setCurrentIndex(0); }} style={{ background: tab === id ? '#ff2d55' : 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 30, padding: '6px 14px', color: '#fff', fontSize: 12, fontWeight: tab === id ? 700 : 500, cursor: 'pointer', backdropFilter: 'blur(10px)' }}>
            {label}
          </button>
        ))}
      </div>

      {feedPosts.length === 0 ? (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ fontSize: 48 }}>📭</div>
          <div style={{ color: '#555', textAlign: 'center', padding: 20 }}>
            {tab === 'following' ? 'Follow people to see their posts!' : 'No posts yet. Be the first to create!'}
          </div>
          {tab === 'following' && <button onClick={() => setTab('foryou')} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '10px 20px', color: '#fff', cursor: 'pointer' }}>Browse For You</button>}
        </div>
      ) : (
        feedPosts.map((post, idx) => (
          <div key={post.id} style={{ position: 'absolute', inset: 0, transform: `translateY(${(idx - currentIndex) * 100}%)`, transition: 'transform 0.3s', pointerEvents: idx === currentIndex ? 'auto' : 'none' }}>
            <PostCard post={post} currentUser={currentUser} onViewProfile={onViewProfile} onMessage={onMessage} showToast={showToast} />
          </div>
        ))
      )}
    </div>
  );
};

// ─── STORIES ─────────────────────────────────────────────────
const Stories = ({ currentUser, showToast }) => {
  const [stories, setStories] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [text, setText] = useState('');
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'stories'), snap => {
      const now = Date.now();
      setStories(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => {
        const t = s.createdAt?.toDate?.()?.getTime?.() || 0;
        return now - t < 86400000;
      }));
    });
    return unsub;
  }, []);

  const postStory = async () => {
    if (!text.trim()) return;
    try {
      await addDoc(collection(db, 'stories'), { text, type: 'text', userId: currentUser.uid, username: currentUser.username, photoURL: currentUser.photoURL || '', createdAt: serverTimestamp() });
      setText(''); setShowCreate(false); showToast('Story posted!', 'success');
    } catch { showToast('Failed to post story', 'error'); }
  };

  return (
    <>
      <div style={{ padding: '8px 14px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', overflowX: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {/* Add story */}
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', marginRight: 14, cursor: 'pointer' }} onClick={() => setShowCreate(true)}>
          <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', padding: 2 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>➕</div>
          </div>
          <span style={{ color: '#888', fontSize: 9, marginTop: 3 }}>Add</span>
        </div>
        {/* Stories */}
        {stories.map(s => (
          <div key={s.id} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', marginRight: 14, cursor: 'pointer' }} onClick={() => setViewing(s)}>
            <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', padding: 2 }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff', overflow: 'hidden' }}>
                {s.photoURL ? <img src={s.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : s.username?.[0]?.toUpperCase()}
              </div>
            </div>
            <span style={{ color: '#ccc', fontSize: 9, marginTop: 3, maxWidth: 58, overflow: 'hidden', textOverflow: 'ellipsis' }}>@{s.username}</span>
          </div>
        ))}
      </div>

      {/* Create story modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Create Story</h3>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="What's on your mind?" autoFocus style={{ width: '100%', maxWidth: 380, height: 160, background: '#141414', border: '1px solid #222', borderRadius: 16, padding: 16, color: '#fff', fontSize: 16, outline: 'none', resize: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 380 }}>
            <button onClick={() => setShowCreate(false)} style={{ flex: 1, background: '#222', border: 'none', borderRadius: 20, padding: 14, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <button onClick={postStory} style={{ flex: 1, background: '#ff2d55', border: 'none', borderRadius: 20, padding: 14, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Post Story</button>
          </div>
        </div>
      )}

      {/* View story */}
      {viewing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setViewing(null)}>
          <div style={{ background: 'linear-gradient(135deg,#1a0020,#000)', borderRadius: 20, padding: 40, maxWidth: 340, width: '90%', textAlign: 'center' }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 20, margin: '0 auto 12px', overflow: 'hidden' }}>
              {viewing.photoURL ? <img src={viewing.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : viewing.username?.[0]?.toUpperCase()}
            </div>
            <div style={{ color: '#888', fontSize: 12, marginBottom: 20 }}>@{viewing.username}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.5 }}>{viewing.text}</div>
          </div>
          <button onClick={() => setViewing(null)} style={{ position: 'absolute', top: 40, right: 20, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 38, height: 38, color: '#fff', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
      )}
    </>
  );
};

// ─── INBOX ────────────────────────────────────────────────────
const InboxPage = ({ currentUser, openUserId, showToast }) => {
  const [users, setUsers] = useState([]);
  const [activeConvo, setActiveConvo] = useState(openUserId || null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.uid !== currentUser?.uid));
    });
    return unsub;
  }, [currentUser]);

  useEffect(() => { if (openUserId) setActiveConvo(openUserId); }, [openUserId]);

  useEffect(() => {
    if (!activeConvo || !currentUser?.uid) return;
    const convoId = [currentUser.uid, activeConvo].sort().join('_');
    const unsub = onSnapshot(
      query(collection(db, 'messages', convoId, 'msgs'), orderBy('createdAt')),
      snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [activeConvo, currentUser]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!text.trim() || !activeConvo || !currentUser?.uid) return;
    const convoId = [currentUser.uid, activeConvo].sort().join('_');
    const t = text; setText('');
    try {
      await addDoc(collection(db, 'messages', convoId, 'msgs'), { text: t, from: currentUser.uid, createdAt: serverTimestamp() });
    } catch { showToast('Failed to send', 'error'); }
  };

  const otherUser = users.find(u => u.uid === activeConvo || u.id === activeConvo);

  if (activeConvo && otherUser) return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={() => setActiveConvo(null)} style={{ background: '#161616', border: 'none', borderRadius: 20, padding: '7px 12px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>←</button>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, overflow: 'hidden' }}>
          {otherUser.photoURL ? <img src={otherUser.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : otherUser.username?.[0]?.toUpperCase()}
        </div>
        <div>
          <div style={{ color: '#fff', fontWeight: 600 }}>@{otherUser.username}</div>
          <div style={{ color: '#06d6a0', fontSize: 11 }}>● Online</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && <div style={{ textAlign: 'center', color: '#444', fontSize: 13, marginTop: 40 }}>Say hello! 👋</div>}
        {messages.map(msg => {
          const isMe = msg.from === currentUser?.uid;
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{ background: isMe ? '#ff2d55' : '#1a1a1a', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', maxWidth: '75%' }}>
                <div style={{ color: '#fff', fontSize: 13 }}>{msg.text}</div>
                <div style={{ color: isMe ? 'rgba(255,255,255,0.5)' : '#444', fontSize: 9, marginTop: 4, textAlign: 'right' }}>
                  {msg.createdAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div style={{ padding: '10px 12px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: 6, flexShrink: 0 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Message..." style={{ flex: 1, background: '#161616', border: '1px solid #222', borderRadius: 22, padding: '9px 14px', color: '#fff', outline: 'none', fontSize: 13 }} />
        <button onClick={send} style={{ background: text.trim() ? '#ff2d55' : '#222', border: 'none', borderRadius: '50%', width: 38, height: 38, color: '#fff', cursor: 'pointer', fontSize: 18 }}>↑</button>
      </div>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>💬 Messages</h2>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {users.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#444' }}>No users yet</div>}
        {users.map(u => (
          <div key={u.id} onClick={() => setActiveConvo(u.uid || u.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid #111', cursor: 'pointer' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 20, overflow: 'hidden', flexShrink: 0 }}>
              {u.photoURL ? <img src={u.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.username?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>@{u.username}</div>
              <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>Tap to message</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── PROFILE PAGE (other user) ────────────────────────────────
const ViewProfilePage = ({ userId, currentUser, onBack, onMessage, showToast }) => {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const fetch = async () => {
      try {
        // Try uid field first
        let q = query(collection(db, 'users'), where('uid', '==', userId));
        let snap = await getDocs(q);
        if (snap.empty) { const d = await getDoc(doc(db, 'users', userId)); if (d.exists()) { setProfile({ id: d.id, ...d.data() }); } }
        else { setProfile({ id: snap.docs[0].id, ...snap.docs[0].data() }); }
        const data = snap.empty ? null : snap.docs[0].data();
        if (data) { setIsFollowing((data.followers || []).includes(currentUser?.uid)); setFollowerCount((data.followers || []).length); }
        const pq = query(collection(db, 'posts'), where('userId', '==', userId));
        const pSnap = await getDocs(pq);
        setPosts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetch();
  }, [userId]);

  const toggleFollow = async () => {
    const prev = isFollowing;
    setIsFollowing(!prev); setFollowerCount(c => prev ? c - 1 : c + 1);
    try {
      const q = query(collection(db, 'users'), where('uid', '==', userId));
      const snap = await getDocs(q);
      if (!snap.empty) await updateDoc(snap.docs[0].ref, { followers: prev ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) });
      const mq = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
      const mSnap = await getDocs(mq);
      if (!mSnap.empty) await updateDoc(mSnap.docs[0].ref, { following: prev ? arrayRemove(userId) : arrayUnion(userId) });
    } catch { setIsFollowing(prev); setFollowerCount(c => prev ? c + 1 : c - 1); }
  };

  if (loading) return <div style={{ height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>Loading...</div>;
  if (!profile) return <div style={{ height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>User not found</div>;

  const isOwn = profile.uid === currentUser?.uid;

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0a0a0a', paddingBottom: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 0' }}>
        <button onClick={onBack} style={{ background: '#1a1a1a', border: 'none', borderRadius: 20, padding: '8px 14px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>← Back</button>
        {!isOwn && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(!showMenu)} style={{ background: '#1a1a1a', border: 'none', borderRadius: 20, padding: '8px 16px', color: '#fff', cursor: 'pointer', fontSize: 18 }}>•••</button>
            {showMenu && (
              <div style={{ position: 'absolute', top: 44, right: 0, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16, padding: 6, minWidth: 170, zIndex: 50 }}>
                <button onClick={() => { onMessage?.(userId); setShowMenu(false); onBack(); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13 }}>💬 Send Message</button>
                <button onClick={() => { setShowReport(true); setShowMenu(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: '#ff9500', cursor: 'pointer', fontSize: 13 }}>⚠️ Report User</button>
                <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', color: '#ff2d55', cursor: 'pointer', fontSize: 13 }}>🚫 Block User</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '20px 20px 16px' }}>
        <div style={{ width: 86, height: 86, borderRadius: '50%', background: '#ff2d55', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 700, color: '#fff', border: '3px solid #ff2d55', overflow: 'hidden' }}>
          {profile.photoURL ? <img src={profile.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : profile.username?.[0]?.toUpperCase()}
        </div>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>@{profile.username}</h2>
        {profile.bio && <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>{profile.bio}</p>}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 20 }}>
          <div style={{ textAlign: 'center' }}><div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{posts.length}</div><div style={{ color: '#666', fontSize: 11 }}>Posts</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{followerCount}</div><div style={{ color: '#666', fontSize: 11 }}>Followers</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{profile.following?.length || 0}</div><div style={{ color: '#666', fontSize: 11 }}>Following</div></div>
        </div>
        {!isOwn && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={toggleFollow} style={{ background: isFollowing ? '#1a1a1a' : '#ff2d55', border: isFollowing ? '1px solid #333' : 'none', borderRadius: 24, padding: '10px 28px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>{isFollowing ? '✓ Following' : '+ Follow'}</button>
            <button onClick={() => { onMessage?.(userId); onBack(); }} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 24, padding: '10px 20px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>💬 Message</button>
          </div>
        )}
      </div>

      <div style={{ padding: '0 12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 3 }}>
          {posts.map(p => (
            <div key={p.id} style={{ aspectRatio: '9/16', background: '#111', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {p.type === 'video' && <video src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />}
              {p.type === 'photo' && <img src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              {p.type === 'text' && <div style={{ background: 'linear-gradient(135deg,#1a0020,#000)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}><p style={{ color: '#fff', fontSize: 11, textAlign: 'center' }}>{p.text?.substring(0, 60)}</p></div>}
            </div>
          ))}
        </div>
      </div>
      {showReport && <ReportModal targetId={profile.uid || profile.id} targetType="user" reportedBy={currentUser?.uid} onClose={() => setShowReport(false)} showToast={showToast} />}
    </div>
  );
};

// ─── MY PROFILE ───────────────────────────────────────────────
const MyProfile = ({ currentUser, showToast, onLogout }) => {
  const [posts, setPosts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, 'posts'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [currentUser]);

  const changePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser?.uid) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `avatars/${currentUser.uid}_${Date.now()}`);
      const task = uploadBytesResumable(storageRef, file);
      task.on('state_changed', null, null, async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        const q = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
        const snap = await getDocs(q);
        if (!snap.empty) await updateDoc(snap.docs[0].ref, { photoURL: url });
        setUploading(false);
        showToast('Profile photo updated! 🎉', 'success');
      });
    } catch { setUploading(false); showToast('Upload failed', 'error'); }
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0a0a0a', paddingBottom: 80 }}>
      <div style={{ textAlign: 'center', padding: '24px 20px 16px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
          <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, color: '#fff', border: '3px solid #ff2d55', overflow: 'hidden' }}>
            {currentUser?.photoURL ? <img src={currentUser.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : currentUser?.username?.[0]?.toUpperCase()}
          </div>
          <label style={{ position: 'absolute', bottom: 0, right: 0, background: '#ff2d55', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14 }}>
            📷<input ref={fileRef} type="file" accept="image/*" onChange={changePhoto} style={{ display: 'none' }} />
          </label>
        </div>
        {uploading && <p style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>Uploading...</p>}
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>@{currentUser?.username}</h2>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>{currentUser?.bio || 'Dagu Creator 🎬'}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 16 }}>
          <div style={{ textAlign: 'center' }}><div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{posts.length}</div><div style={{ color: '#666', fontSize: 11 }}>Posts</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{currentUser?.followers?.length || 0}</div><div style={{ color: '#666', fontSize: 11 }}>Followers</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{currentUser?.following?.length || 0}</div><div style={{ color: '#666', fontSize: 11 }}>Following</div></div>
        </div>
        <button onClick={onLogout} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 20, padding: '8px 24px', color: '#ff2d55', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>🚪 Logout</button>
      </div>
      <div style={{ padding: '14px 12px' }}>
        <h3 style={{ color: '#888', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>MY POSTS</h3>
        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#444' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎬</div>
            <p style={{ fontSize: 13 }}>No posts yet. Tap ➕ to create!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 3 }}>
            {posts.map(p => (
              <div key={p.id} style={{ aspectRatio: '9/16', background: '#111', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.type === 'video' && <video src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />}
                {p.type === 'photo' && <img src={p.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                {p.type === 'text' && <div style={{ background: 'linear-gradient(135deg,#1a0020,#000)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}><p style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{p.text?.substring(0, 50)}</p></div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── AUTH SCREEN ──────────────────────────────────────────────
const AuthScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!email || !password) { setError('Please fill all fields'); return; }
    if (!isLogin && !username) { setError('Username is required'); return; }
    setLoading(true); setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await addDoc(collection(db, 'users'), {
          uid: result.user.uid,
          username: username.toLowerCase().trim(),
          email: email.trim(),
          bio: 'New to Dagu! 🎬',
          followers: [], following: [],
          photoURL: '', coins: 500,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').replace(/\(auth\/.*?\)\.?/, '').trim());
    }
    setLoading(false);
  };

  return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#0a0a0a 60%,#120007)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 56, marginBottom: 10 }}>🎬</div>
          <h1 style={{ fontSize: 42, fontWeight: 800, background: 'linear-gradient(135deg,#ff2d55,#af52de)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Dagu</h1>
          <p style={{ color: '#555', fontSize: 13, marginTop: 8 }}>{isLogin ? 'Welcome back!' : 'Join Dagu today'}</p>
        </div>
        <div style={{ background: '#141414', borderRadius: 24, padding: 24 }}>
          {error && <div style={{ background: 'rgba(255,45,85,0.1)', border: '1px solid #ff2d55', borderRadius: 12, padding: '10px 14px', color: '#ff2d55', fontSize: 13, marginBottom: 16 }}>{error}</div>}
          {!isLogin && <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 10, outline: 'none', fontSize: 13, boxSizing: 'border-box' }} />}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 10, outline: 'none', fontSize: 13, boxSizing: 'border-box' }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 16, outline: 'none', fontSize: 13, boxSizing: 'border-box' }} />
          <button onClick={submit} disabled={loading} style={{ width: '100%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: 24, padding: 14, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: loading ? 0.7 : 1 }}>
            {loading ? '...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
          <button onClick={() => { setIsLogin(!isLogin); setError(''); }} style={{ width: '100%', background: 'none', border: 'none', color: '#ff2d55', fontSize: 13, cursor: 'pointer', marginTop: 12, padding: 8 }}>
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────
export default function DaguApp() {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = loading
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [followed, setFollowed] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [toast, setToast] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [messageUserId, setMessageUserId] = useState(null);

  const showToast = useCallback((message, type = 'info') => setToast({ message, type }), []);

  // Auth listener
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        try {
          const q = query(collection(db, 'users'), where('uid', '==', user.uid));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            setCurrentUser({ ...data, uid: user.uid, id: snap.docs[0].id });
            setFollowed(data.following || []);
          }
        } catch (e) { console.error(e); }
      } else {
        setFirebaseUser(null);
        setCurrentUser(null);
      }
    });
  }, []);

  // Load posts
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const toggleFollow = async (userId) => {
    if (!currentUser?.uid) return;
    const isFollowing = followed.includes(userId);
    setFollowed(prev => isFollowing ? prev.filter(id => id !== userId) : [...prev, userId]);
    try {
      const q = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
      const snap = await getDocs(q);
      if (!snap.empty) await updateDoc(snap.docs[0].ref, { following: isFollowing ? arrayRemove(userId) : arrayUnion(userId) });
      const tq = query(collection(db, 'users'), where('uid', '==', userId));
      const tSnap = await getDocs(tq);
      if (!tSnap.empty) await updateDoc(tSnap.docs[0].ref, { followers: isFollowing ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) });
    } catch (e) { console.error(e); }
    showToast(isFollowing ? 'Unfollowed' : 'Followed! 🎉', 'success');
  };

  const handleMessage = (userId) => {
    setMessageUserId(userId);
    setActiveTab('inbox');
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setFirebaseUser(null);
    showToast('Logged out', 'info');
  };

  // Loading
  if (firebaseUser === undefined) return (
    <div style={{ height: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 56 }}>🎬</div>
      <div style={{ color: '#555', fontSize: 14 }}>Loading Dagu...</div>
    </div>
  );

  if (!firebaseUser) return <AuthScreen />;

  const TABS = [
    { id: 'home',    icon: '🏠', label: 'Home'    },
    { id: 'friends', icon: '👥', label: 'Friends' },
    { id: 'create',  icon: '➕', label: 'Create'  },
    { id: 'inbox',   icon: '💬', label: 'Inbox'   },
    { id: 'profile', icon: '👤', label: 'Me'      },
  ];

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <style>{`*{margin:0;padding:0;box-sizing:border-box}::-webkit-scrollbar{display:none}button:active{transform:scale(0.95)}`}</style>

      {/* Create screen */}
      {showCreate && <CreateScreen currentUser={currentUser} onClose={() => setShowCreate(false)} showToast={showToast} />}

      {/* Viewing another user's profile */}
      {viewingProfile && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200 }}>
          <ViewProfilePage userId={viewingProfile} currentUser={currentUser} onBack={() => setViewingProfile(null)} onMessage={handleMessage} showToast={showToast} />
        </div>
      )}

      {/* Stories (home only) */}
      {activeTab === 'home' && currentUser && <Stories currentUser={currentUser} showToast={showToast} />}

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        {activeTab === 'home' && (
          <HomeFeed posts={posts} currentUser={currentUser} followed={followed} onViewProfile={uid => setViewingProfile(uid)} onMessage={handleMessage} showToast={showToast} />
        )}

        {activeTab === 'friends' && (
          <div style={{ height: '100%', overflowY: 'auto', background: '#0a0a0a', padding: 14 }}>
            <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 14 }}>👥 Following</h2>
            {posts.filter(p => followed.includes(p.userId)).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#444' }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>👥</div>
                <p>Follow people to see their posts!</p>
              </div>
            ) : (
              posts.filter(p => followed.includes(p.userId)).map(post => (
                <div key={post.id} style={{ background: '#141414', borderRadius: 16, marginBottom: 14, overflow: 'hidden', border: '1px solid #1e1e1e' }}>
                  {post.type === 'video' && <video src={post.url} style={{ width: '100%', maxHeight: 220 }} controls playsInline />}
                  {post.type === 'photo' && <img src={post.url} style={{ width: '100%', maxHeight: 220, objectFit: 'cover' }} />}
                  {post.type === 'text' && <div style={{ background: 'linear-gradient(135deg,#1a0020,#000)', padding: 24, minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#fff', fontSize: 16, textAlign: 'center' }}>{post.text}</p></div>}
                  <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div onClick={() => setViewingProfile(post.userId)} style={{ width: 34, height: 34, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
                      {post.photoURL ? <img src={post.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : post.username?.[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }} onClick={() => setViewingProfile(post.userId)}>@{post.username}</div>
                      {post.caption && <div style={{ color: '#888', fontSize: 11 }}>{post.caption}</div>}
                    </div>
                    <button onClick={() => handleMessage(post.userId)} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '6px 12px', color: '#fff', fontSize: 11, cursor: 'pointer' }}>💬</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'inbox' && (
          <InboxPage currentUser={currentUser} openUserId={messageUserId} showToast={showToast} />
        )}

        {activeTab === 'profile' && (
          <MyProfile currentUser={currentUser} showToast={showToast} onLogout={handleLogout} />
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', background: 'rgba(8,8,8,0.97)', borderTop: '1px solid #161616', padding: '8px 4px 18px', flexShrink: 0, backdropFilter: 'blur(12px)' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => {
            if (tab.id === 'create') { setShowCreate(true); return; }
            setActiveTab(tab.id);
            if (tab.id !== 'inbox') setMessageUserId(null);
          }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}>
            <span style={{ fontSize: tab.id === 'create' ? 28 : 22, transform: activeTab === tab.id ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.15s' }}>{tab.icon}</span>
            <span style={{ fontSize: 10, color: activeTab === tab.id ? '#ff2d55' : '#444', fontWeight: activeTab === tab.id ? 700 : 400 }}>{tab.label}</span>
          </button>
        ))}
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}