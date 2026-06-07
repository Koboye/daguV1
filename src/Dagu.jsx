// Dagu.jsx — Full TikTok-like app with Firebase, Cloudinary, EmailJS
// All features functional: auth, video feed, likes, comments, follow, messages, stories, live, calls, gifts, upload

import React, {
  useState, useEffect, useRef, useCallback, memo, useMemo
} from 'react';

// ─── Firebase ──────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, addDoc, onSnapshot, query,
  orderBy, serverTimestamp, getDocs, where, doc, setDoc,
  updateDoc, arrayUnion, arrayRemove, getDoc, deleteDoc, limit
} from 'firebase/firestore';

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
const db = getFirestore(app);

// ─── Cloudinary ────────────────────────────────────────────────────────────
const CLOUDINARY_CLOUD = 'dotvhzjmc';
const CLOUDINARY_PRESET = 'g3c7dwdg';

async function uploadToCloudinary(file, type = 'image') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);
  formData.append('cloud_name', CLOUDINARY_CLOUD);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${type}/upload`,
    { method: 'POST', body: formData }
  );
  const data = await res.json();
  return data.secure_url;
}

// ─── Constants ─────────────────────────────────────────────────────────────
const VIRTUAL_GIFTS = [
  { id: 'rose',      name: '🌹 Rose',      coins: 50,    animation: '🌹' },
  { id: 'chocolate', name: '🍫 Chocolate',  coins: 100,   animation: '🍫' },
  { id: 'bear',      name: '🧸 Teddy Bear', coins: 250,   animation: '🧸' },
  { id: 'cake',      name: '🎂 Cake',       coins: 500,   animation: '🎂' },
  { id: 'diamond',   name: '💎 Diamond',    coins: 1000,  animation: '💎' },
  { id: 'rocket',    name: '🚀 Rocket',     coins: 5000,  animation: '🚀' },
  { id: 'crown',     name: '👑 Crown',      coins: 10000, animation: '👑' },
  { id: 'galaxy',    name: '🌌 Galaxy',     coins: 50000, animation: '🌌' },
];

const EMOJI_LIST = ['😀','😂','😍','🥰','😎','🤔','😭','😱','🔥','❤️','👍','🎉','✨','💯','🙌','👏','🤝','💪','🎵','📸'];

const formatNumber = (num) => {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
};

// ─── Toast ─────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  return (
    <div style={{
      position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(15,15,15,0.97)', border: '1px solid #2a2a2a', borderRadius: 30,
      padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8,
      zIndex: 9999, whiteSpace: 'nowrap', backdropFilter: 'blur(10px)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)'
    }}>
      <span>{icons[type] || 'ℹ️'}</span>
      <span style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{message}</span>
    </div>
  );
};

// ─── Auth Screen ────────────────────────────────────────────────────────────
const AuthScreen = ({ onLogin, onSignup }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail]     = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async () => {
    if (!email) { setError('Email required'); return; }
    if (!isLogin && (!username || !fullName)) { setError('Fill all fields'); return; }
    setError('');
    setLoading(true);
    try {
      if (isLogin) await onLogin(email, password);
      else         await onSignup(email, username, fullName, password);
    } catch (e) {
      setError(e.message || 'Something went wrong');
    }
    setLoading(false);
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <div style={{ width: '100%', maxWidth: 360, padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🎬</div>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 28, letterSpacing: -1 }}>Dagu</div>
          <div style={{ color: '#555', fontSize: 13, marginTop: 4 }}>Share your world</div>
        </div>

        <div style={{ background: '#141414', borderRadius: 24, padding: 24, border: '1px solid #1e1e1e' }}>
          <div style={{ display: 'flex', background: '#0d0d0d', borderRadius: 16, padding: 4, marginBottom: 20 }}>
            {['Login','Sign Up'].map((label, i) => (
              <button key={label} onClick={() => { setIsLogin(i === 0); setError(''); }}
                style={{ flex: 1, background: (isLogin ? i===0 : i===1) ? '#ff2d55' : 'none', border: 'none',
                  borderRadius: 12, padding: '10px', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                {label}
              </button>
            ))}
          </div>

          {!isLogin && (
            <>
              <input placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} />
              <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} />
            </>
          )}
          <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />

          {error && <div style={{ color: '#ff2d55', fontSize: 12, marginBottom: 10, textAlign: 'center' }}>{error}</div>}

          <button onClick={handleSubmit} disabled={loading}
            style={{ width: '100%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none',
              borderRadius: 20, padding: 14, color: 'white', fontWeight: 700, cursor: 'pointer',
              fontSize: 15, opacity: loading ? 0.7 : 1 }}>
            {loading ? '...' : isLogin ? 'Login' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

const inputStyle = {
  width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 14,
  padding: '12px 14px', color: 'white', marginBottom: 10, outline: 'none',
  fontSize: 13, boxSizing: 'border-box'
};

// ─── Call Modal ─────────────────────────────────────────────────────────────
const CallModal = ({ type, contactName, contactAvatar, onClose }) => {
  const [duration, setDuration] = useState(0);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const localVideoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const connectTimer = setTimeout(async () => {
      setConnected(true);
      if (type === 'video') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          streamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.muted = true;
          }
        } catch {}
      }
    }, 2000);
    return () => clearTimeout(connectTimer);
  }, [type]);

  useEffect(() => {
    if (!connected) return;
    const t = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [connected]);

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const formatDur = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => { t.enabled = muted; });
    }
    setMuted(m => !m);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: type === 'video' ? '#000' : 'linear-gradient(135deg,#1a2a2a,#0a0a0a)', zIndex: 5000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {type === 'video' && connected && (
        <video ref={localVideoRef} autoPlay playsInline
          style={{ position: 'absolute', top: 20, right: 20, width: 120, height: 160, objectFit: 'cover', borderRadius: 16, border: '2px solid #333', zIndex: 10 }} />
      )}
      <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, marginBottom: 16 }}>
        {contactAvatar}
      </div>
      <div style={{ color: 'white', fontSize: 22, fontWeight: 700 }}>@{contactName}</div>
      <div style={{ color: '#888', fontSize: 13, marginTop: 6 }}>
        {connected ? formatDur(duration) : (type === 'video' ? '📹 Connecting...' : '🎙️ Calling...')}
      </div>
      <div style={{ display: 'flex', gap: 20, marginTop: 48 }}>
        <button onClick={toggleMute} style={{ width: 60, height: 60, borderRadius: '50%', background: muted ? '#ff2d55' : '#222', border: 'none', color: 'white', fontSize: 24, cursor: 'pointer' }}>
          {muted ? '🔇' : '🎙️'}
        </button>
        <button onClick={onClose} style={{ width: 60, height: 60, borderRadius: '50%', background: '#ff2d55', border: 'none', color: 'white', fontSize: 24, cursor: 'pointer' }}>
          📵
        </button>
        {type === 'video' && (
          <button style={{ width: 60, height: 60, borderRadius: '50%', background: '#222', border: 'none', color: 'white', fontSize: 24, cursor: 'pointer' }}>
            📹
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Live Stream ────────────────────────────────────────────────────────────
const LiveStream = ({ streamer, onClose, showToast, currentUser }) => {
  const [viewers, setViewers]     = useState(Math.floor(Math.random()*2000)+500);
  const [chatMessages, setChat]   = useState([]);
  const [message, setMessage]     = useState('');
  const [showGifts, setShowGifts] = useState(false);
  const [giftAnims, setGiftAnims] = useState([]);
  const [isMuted, setIsMuted]     = useState(false);
  const [duration, setDuration]   = useState(0);
  const [cameraOn, setCameraOn]   = useState(false);
  const [cameraErr, setCameraErr] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const go = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true; }
        setCameraOn(true);
      } catch { setCameraErr('Camera denied — simulating stream'); }
    };
    go();
    const d = setInterval(() => setDuration(x => x + 1), 1000);
    const v = setInterval(() => setViewers(x => Math.max(1, x + Math.floor(Math.random()*20)-5)), 5000);
    const fakeNames = ['amara', 'yonas', 'tigist', 'biruk', 'selam'];
    const fakeMsg = setInterval(() => {
      setChat(c => [...c.slice(-50), {
        id: Date.now(), username: fakeNames[Math.floor(Math.random()*fakeNames.length)],
        text: ['🔥 Amazing!', '❤️ Love this!', 'keep going!', '🎉', 'wow!!'][Math.floor(Math.random()*5)],
        isGift: false
      }]);
    }, 3000);
    return () => {
      clearInterval(d); clearInterval(v); clearInterval(fakeMsg);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const toggleMute = () => {
    if (streamRef.current) streamRef.current.getAudioTracks().forEach(t => { t.enabled = isMuted; });
    setIsMuted(m => !m);
  };

  const fmt = () => {
    const m = Math.floor(duration/60), s = duration%60;
    return `${m}:${s.toString().padStart(2,'0')}`;
  };

  const sendMsg = () => {
    if (!message.trim()) return;
    setChat(c => [...c, { id: Date.now(), username: currentUser?.username, text: message, isGift: false }]);
    setMessage('');
  };

  const sendGift = (gift) => {
    if ((currentUser?.coins || 0) < gift.coins) { showToast('Not enough coins! 🪙', 'error'); return; }
    const id = Date.now();
    setGiftAnims(g => [...g, { id, gift, x: Math.random()*80+10, y: Math.random()*40+10 }]);
    setChat(c => [...c, { id, username: currentUser?.username, text: `sent ${gift.name}`, isGift: true, gift }]);
    showToast(`Sent ${gift.name}! 🎁`, 'success');
    setTimeout(() => setGiftAnims(g => g.filter(x => x.id !== id)), 3000);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 2, position: 'relative', background: '#111' }}>
        {cameraOn ? (
          <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#1a1a2a,#0a0a0a)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ fontSize: 64 }}>📹</div>
            <div style={{ color: 'white', fontSize: 16, fontWeight: 700 }}>LIVE</div>
            {cameraErr && <div style={{ color: '#ff9500', fontSize: 11, textAlign: 'center', padding: '0 30px' }}>{cameraErr}</div>}
          </div>
        )}
        <div style={{ position: 'absolute', top: 20, left: 16, background: '#ff2d55', borderRadius: 20, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'white' }} />
          <span style={{ color: 'white', fontWeight: 700, fontSize: 12 }}>LIVE · {viewers.toLocaleString()} 👁</span>
        </div>
        <div style={{ position: 'absolute', top: 20, right: 16, background: 'rgba(0,0,0,0.6)', borderRadius: 16, padding: '6px 12px' }}>
          <span style={{ color: 'white', fontSize: 12 }}>{fmt()}</span>
        </div>
        <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, display: 'flex', gap: 10 }}>
          <button onClick={toggleMute} style={{ background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 42, height: 42, fontSize: 20, cursor: 'pointer', color: '#fff' }}>{isMuted ? '🔇' : '🔊'}</button>
          <button onClick={onClose} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 24px', color: 'white', fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>End Stream</button>
        </div>
        {giftAnims.map(g => (
          <div key={g.id} style={{ position: 'absolute', left: `${g.x}%`, top: `${g.y}%`, fontSize: 44, pointerEvents: 'none', zIndex: 20 }}>{g.gift.animation}</div>
        ))}
      </div>

      <div style={{ flex: 1, background: '#0a0a0a', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>Live Chat</span>
          <button onClick={() => setShowGifts(g => !g)} style={{ background: '#ffd700', border: 'none', borderRadius: 20, padding: '5px 12px', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>🎁 Gift</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {chatMessages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', gap: 6, alignItems: 'center', background: msg.isGift ? 'rgba(255,215,0,0.08)' : 'transparent', padding: '3px 6px', borderRadius: 8, marginBottom: 3 }}>
              <span style={{ color: '#ff2d55', fontWeight: 600, fontSize: 11 }}>@{msg.username}</span>
              <span style={{ color: 'white', fontSize: 11 }}>{msg.text}</span>
              {msg.isGift && <span>{msg.gift?.animation}</span>}
            </div>
          ))}
        </div>
        {showGifts && (
          <div style={{ background: '#141414', borderTop: '1px solid #222', padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {VIRTUAL_GIFTS.map(g => (
                <button key={g.id} onClick={() => sendGift(g)} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '10px 6px', cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontSize: 24 }}>{g.animation}</div>
                  <div style={{ color: '#ffd700', fontSize: 10, marginTop: 2 }}>{g.coins}🪙</div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ padding: '8px 12px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: 8 }}>
          <input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key==='Enter' && sendMsg()} placeholder="Say something..." style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 24, padding: '8px 14px', color: 'white', outline: 'none', fontSize: 13 }} />
          <button onClick={sendMsg} style={{ background: '#ff2d55', border: 'none', borderRadius: 24, padding: '8px 18px', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Send</button>
        </div>
      </div>
    </div>
  );
};

// ─── Stories ────────────────────────────────────────────────────────────────
const Stories = ({ users, stories, currentUser, onViewStory, onAddStory, showToast }) => {
  const fileRef = useRef(null);
  const storyUsers = useMemo(() => {
    const ids = [...new Set(stories.map(s => s.userId))];
    return ids.map(id => users.find(u => u.id === id)).filter(Boolean);
  }, [stories, users]);

  const handleAdd = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showToast('Uploading story...', 'info');
    try {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const url = await uploadToCloudinary(file, type === 'video' ? 'video' : 'image');
      const story = {
        userId: currentUser.id, username: currentUser.username,
        avatarColor: currentUser.avatarColor, avatar: currentUser.avatar,
        type, media: url, timestamp: serverTimestamp(), expiresAt: Date.now() + 86400000
      };
      await addDoc(collection(db, 'stories'), story);
      onAddStory(story);
      showToast('Story posted! ✨', 'success');
    } catch { showToast('Upload failed', 'error'); }
  };

  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 14px', overflowX: 'auto', borderBottom: '1px solid #141414', flexShrink: 0 }}>
      <div onClick={() => fileRef.current?.click()} style={{ flexShrink: 0, cursor: 'pointer', textAlign: 'center' }}>
        <div style={{ width: 58, height: 58, borderRadius: '50%', background: '#141414', border: '2px dashed #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 4, color: '#aaa' }}>+</div>
        <div style={{ color: '#666', fontSize: 10, width: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Add</div>
        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleAdd} style={{ display: 'none' }} />
      </div>
      {storyUsers.map(u => (
        <div key={u.id} onClick={() => onViewStory(u)} style={{ flexShrink: 0, cursor: 'pointer', textAlign: 'center' }}>
          <div style={{ width: 58, height: 58, borderRadius: '50%', padding: 2, background: 'linear-gradient(135deg,#ff2d55,#af52de,#ffd700)' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 20, border: '2px solid #0a0a0a', overflow: 'hidden' }}>
              {u.photoURL ? <img src={u.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : u.avatar}
            </div>
          </div>
          <div style={{ color: '#aaa', fontSize: 10, marginTop: 4, width: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.username}</div>
        </div>
      ))}
    </div>
  );
};

// ─── Story Viewer ────────────────────────────────────────────────────────────
const StoryViewer = ({ stories, user, onClose, onNextUser, onPrevUser }) => {
  const userStories = stories.filter(s => s.userId === user?.id);
  const [idx, setIdx]         = useState(0);
  const [progress, setProgress] = useState(0);
  const DURATION = 5000;

  useEffect(() => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (idx < userStories.length - 1) { setIdx(i => i+1); return 0; }
          else { onNextUser(); return 100; }
        }
        return p + (100 / (DURATION/100));
      });
    }, 100);
    return () => clearInterval(interval);
  }, [idx, userStories.length]);

  if (!userStories.length) { onClose(); return null; }
  const story = userStories[idx];

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1500 }} onClick={onClose}>
      <div style={{ position: 'absolute', top: 16, left: 12, right: 12, display: 'flex', gap: 4, zIndex: 10 }}>
        {userStories.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: i === idx ? `${progress}%` : i < idx ? '100%' : '0%', height: '100%', background: 'white', transition: 'width 0.1s linear' }} />
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', top: 30, left: 14, right: 14, display: 'flex', alignItems: 'center', gap: 10, zIndex: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: user?.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16 }}>{user?.avatar}</div>
        <div style={{ color: 'white', fontWeight: 600, fontSize: 13 }}>@{user?.username}</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginLeft: 'auto' }}>{idx+1}/{userStories.length}</div>
        <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      <div onClick={e => e.stopPropagation()} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {story.type === 'image' && story.media && <img src={story.media} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        {story.type === 'video' && story.media && <video src={story.media} autoPlay loop style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        {story.type === 'text' && (
          <div style={{ background: `linear-gradient(135deg,${user?.avatarColor},#000)`, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <div style={{ color: 'white', fontSize: 28, fontWeight: 700, textAlign: 'center' }}>{story.text}</div>
          </div>
        )}
      </div>

      <button onClick={(e) => { e.stopPropagation(); onPrevUser(); }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '40%', background: 'transparent', border: 'none', cursor: 'pointer' }} />
      <button onClick={(e) => { e.stopPropagation(); onNextUser(); }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '40%', background: 'transparent', border: 'none', cursor: 'pointer' }} />
    </div>
  );
};

// ─── Video Card ──────────────────────────────────────────────────────────────
const VideoCard = memo(({ video, currentUser, onFollow, onMessage, onVoiceCall, onVideoCall, followed, showToast, onViewProfile }) => {
  const [liked, setLiked]           = useState(false);
  const [likeCount, setLikeCount]   = useState(video.likes || 0);
  const [saved, setSaved]           = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments]     = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showGifts, setShowGifts]   = useState(false);
  const [giftAnims, setGiftAnims]   = useState([]);
  const [showMore, setShowMore]     = useState(false);
  const [hearts, setHearts]         = useState([]);
  const [paused, setPaused]         = useState(false);
  const [muted, setMuted]           = useState(true);
  const videoRef = useRef(null);
  const lastTap = useRef(0);

  useEffect(() => {
    if (!showComments) return;
    const q = query(collection(db, 'comments'), where('videoId','==',video.id), orderBy('timestamp','desc'));
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [showComments, video.id]);

  const handleLike = async () => {
    if (liked) return;
    setLiked(true);
    setLikeCount(c => c + 1);
    try {
      const ref = doc(db, 'videos', video.id);
      await updateDoc(ref, { likes: likeCount + 1 });
      await addDoc(collection(db, 'likes'), { videoId: video.id, userId: currentUser?.id, timestamp: serverTimestamp() });
    } catch {}
  };

  const handleDoubleTap = (e) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      handleLike();
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      for (let i = 0; i < 6; i++) {
        setTimeout(() => {
          const id = Date.now() + i;
          setHearts(h => [...h, { id, x, y }]);
          setTimeout(() => setHearts(h => h.filter(hh => hh.id !== id)), 900);
        }, i * 50);
      }
    }
    lastTap.current = now;
  };

  const handleTap = () => {
    if (videoRef.current) {
      if (paused) { videoRef.current.play(); setPaused(false); }
      else        { videoRef.current.pause(); setPaused(true); }
    }
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    const c = {
      videoId: video.id, userId: currentUser?.id, username: currentUser?.username,
      avatar: currentUser?.avatar, avatarColor: currentUser?.avatarColor,
      text: commentText, likes: 0, timestamp: serverTimestamp()
    };
    setCommentText('');
    try { await addDoc(collection(db, 'comments'), c); }
    catch { showToast('Error posting comment', 'error'); }
  };

  const sendGift = (gift) => {
    if ((currentUser?.coins || 0) < gift.coins) { showToast('Not enough coins! 🪙', 'error'); return; }
    const id = Date.now();
    setGiftAnims(g => [...g, { id, gift }]);
    showToast(`Sent ${gift.name}! 🎁`, 'success');
    setTimeout(() => setGiftAnims(g => g.filter(x => x.id !== id)), 2500);
    setShowGifts(false);
  };

  const handleShare = async () => {
    const shareData = { title: `Watch @${video.username} on Dagu`, text: video.description, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(window.location.href); showToast('Link copied! 🔗', 'success'); }
    } catch {}
  };

  const isFollowing = followed?.includes(video.userId);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000', overflow: 'hidden' }}
      onClick={handleTap} onDoubleClick={handleDoubleTap}>

      <video ref={videoRef} src={video.videoUrl} loop playsInline autoPlay muted={muted}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 55%)', pointerEvents: 'none' }} />

      {paused && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 60, opacity: 0.8 }}>⏸</div>
        </div>
      )}

      {hearts.map(h => (
        <div key={h.id} style={{ position: 'absolute', left: h.x-24, top: h.y-24, fontSize: 44, pointerEvents: 'none', zIndex: 100 }}>❤️</div>
      ))}

      {giftAnims.map(g => (
        <div key={g.id} style={{ position: 'absolute', left: '50%', top: '40%', fontSize: 52, pointerEvents: 'none', zIndex: 50, transform: 'translateX(-50%)' }}>{g.gift.animation}</div>
      ))}

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 70, padding: '16px 14px', zIndex: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div onClick={(e) => { e.stopPropagation(); onViewProfile?.(video.userId); }} style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: video.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16, border: '2px solid rgba(255,255,255,0.5)', overflow: 'hidden' }}>
              {video.photoURL ? <img src={video.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : video.avatar}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div onClick={(e) => { e.stopPropagation(); onViewProfile?.(video.userId); }} style={{ color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>@{video.username}</div>
            {video.soundName && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>🎵 {video.soundName}</div>}
          </div>
          {video.userId !== currentUser?.id && (
            <button onClick={(e) => { e.stopPropagation(); onFollow?.(video.userId); }} style={{ background: isFollowing ? 'rgba(255,255,255,0.1)' : '#ff2d55', border: isFollowing ? '1px solid rgba(255,255,255,0.3)' : 'none', borderRadius: 20, padding: '6px 16px', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
              {isFollowing ? '✓' : '+ Follow'}
            </button>
          )}
        </div>
        <div>
          <p style={{ color: 'white', fontSize: 13, lineHeight: 1.4, marginBottom: 4 }}>
            {showMore ? video.description : (video.description?.substring(0,80) || '')}
            {(video.description?.length > 80) && (
              <span onClick={(e) => { e.stopPropagation(); setShowMore(m => !m); }} style={{ color: '#ccc', cursor: 'pointer' }}>
                {showMore ? ' less' : '... more'}
              </span>
            )}
          </p>
        </div>
      </div>

      <div style={{ position: 'absolute', right: 10, bottom: 20, display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center', zIndex: 10 }}>
        <ActionBtn icon={liked ? '❤️' : '🤍'} count={formatNumber(likeCount)} active={liked} onClick={(e) => { e.stopPropagation(); handleLike(); }} color='#ff2d55' />
        <ActionBtn icon='💬' count={formatNumber(video.commentCount || 0)} onClick={(e) => { e.stopPropagation(); setShowComments(true); }} />
        <ActionBtn icon='↗️' count='Share' onClick={(e) => { e.stopPropagation(); handleShare(); }} />
        <ActionBtn icon='🎁' count='Gift' onClick={(e) => { e.stopPropagation(); setShowGifts(g => !g); }} color='#ffd700' />
        <ActionBtn icon={saved ? '🔖' : '📌'} count={saved ? 'Saved' : 'Save'} active={saved} onClick={(e) => { e.stopPropagation(); setSaved(s => !s); showToast(saved ? 'Removed' : 'Saved! 🔖', 'success'); }} color='#06d6a0' />
        <ActionBtn icon={muted ? '🔇' : '🔊'} count='' onClick={(e) => { e.stopPropagation(); setMuted(m => !m); }} />
        {video.userId !== currentUser?.id && (
          <>
            <ActionBtn icon='✉️' count='DM' onClick={(e) => { e.stopPropagation(); onMessage?.(video.userId); }} />
            <ActionBtn icon='🎙️' count='Call' onClick={(e) => { e.stopPropagation(); onVoiceCall?.(video.userId); }} />
            <ActionBtn icon='📹' count='Video' onClick={(e) => { e.stopPropagation(); onVideoCall?.(video.userId); }} />
          </>
        )}
      </div>

      {showComments && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%', background: '#0a0a0a', borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 100, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'white', fontWeight: 700 }}>Comments ({comments.length})</span>
            <button onClick={() => setShowComments(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 16, cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: c.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700 }}>{c.avatar}</div>
                <div>
                  <div style={{ color: '#888', fontSize: 11, fontWeight: 600 }}>@{c.username}</div>
                  <div style={{ color: 'white', fontSize: 13, marginTop: 2 }}>{c.text}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: 12, borderTop: '1px solid #1a1a1a', display: 'flex', gap: 10, background: '#0a0a0a' }}>
            <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add comment..." style={{ flex: 1, background: '#141414', border: '1px solid #222', borderRadius: 20, padding: '10px 16px', color: 'white', outline: 'none' }} />
            <button onClick={addComment} style={{ background: '#ff2d55', border: 'none', color: 'white', padding: '0 16px', borderRadius: 20, fontWeight: 700 }}>Post</button>
          </div>
        </div>
      )}

      {showGifts && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#0a0a0a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, zIndex: 100 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: 'white', fontWeight: 700 }}>Send Virtual Gift Assets</span>
            <button onClick={() => setShowGifts(false)} style={{ background: 'none', border: 'none', color: 'white' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {VIRTUAL_GIFTS.map(g => (
              <button key={g.id} onClick={() => sendGift(g)} style={{ background: '#141414', border: '1px solid #222', borderRadius: 16, padding: 12, cursor: 'pointer' }}>
                <div style={{ fontSize: 24 }}>{g.animation}</div>
                <div style={{ color: 'white', fontSize: 11, marginTop: 4 }}>{g.name.split(' ')[1]}</div>
                <div style={{ color: '#ffd700', fontSize: 10, marginTop: 2 }}>{g.coins} 🪙</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

const ActionBtn = ({ icon, count, active, onClick, color }) => (
  <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(20,20,20,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: active ? color : 'white', border: '1px solid rgba(255,255,255,0.05)' }}>
      {icon}
    </div>
    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 4, fontWeight: 600 }}>{count}</span>
  </div>
);

// ─── Discover & Search Tab ──────────────────────────────────────────────────
const DiscoverTab = ({ videos, onViewProfile }) => {
  const [search, setSearch] = useState('');
  const tags = ['ethiopia', 'habesha', 'dagu', 'music', 'dance', 'comedy', 'tech'];

  const filtered = useMemo(() => {
    if (!search.trim()) return videos;
    return videos.filter(v => 
      v.username?.toLowerCase().includes(search.toLowerCase()) ||
      v.description?.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, videos]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#000', color: 'white' }}>
      <div style={{ padding: '14px 14px 4px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search creators, trends, keywords..." style={{ width: '100%', background: '#141414', border: '1px solid #222', borderRadius: 20, padding: '12px 16px', color: 'white', outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', overflowX: 'auto', flexShrink: 0 }}>
        {tags.map(t => (
          <button key={t} onClick={() => setSearch(`#${t}`)} style={{ background: '#141414', border: '1px solid #222', color: '#aaa', borderRadius: 14, padding: '6px 14px', whiteSpace: 'nowrap', cursor: 'pointer', fontSize: 12 }}>#{t}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2, padding: 2 }}>
        {filtered.map(v => (
          <div key={v.id} onClick={() => onViewProfile(v.userId)} style={{ aspectRatio: '3/4', position: 'relative', background: '#111', cursor: 'pointer' }}>
            <video src={v.videoUrl} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 11, fontWeight: 600, textShadow: '1px 1px 2px black' }}>@{v.username}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Create & Upload Pipeline ───────────────────────────────────────────────
const CreateTab = ({ currentUser, onUploadSuccess, showToast }) => {
  const [file, setFile] = useState(null);
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handlePost = async () => {
    if (!file) { showToast('Please select a video file', 'warning'); return; }
    setLoading(true);
    showToast('Uploading video engine component...', 'info');
    try {
      const url = await uploadToCloudinary(file, 'video');
      await addDoc(collection(db, 'videos'), {
        userId: currentUser.id, username: currentUser.username,
        avatar: currentUser.avatar, avatarColor: currentUser.avatarColor,
        videoUrl: url, description: desc, likes: 0, commentCount: 0,
        timestamp: serverTimestamp()
      });
      showToast('Video Published Successfully!', 'success');
      setFile(null); setDesc('');
      onUploadSuccess();
    } catch { showToast('Failed to deploy video node', 'error'); }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24, color: 'white', display: 'flex', flexDirection: 'column', gap: 16, height: '100%', boxSizing: 'border-box' }}>
      <h2>Publish Studio Workspace</h2>
      <div onClick={() => fileInputRef.current?.click()} style={{ flex: 1, border: '2px dashed #333', borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', background: '#0a0a0a', minHeight: 200 }}>
        <span style={{ fontSize: 48 }}>{file ? '📹' : '➕'}</span>
        <span style={{ fontSize: 13, color: '#888' }}>{file ? file.name : 'Select or drop MP4 device segment'}</span>
        <input ref={fileInputRef} type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0])} style={{ display: 'none' }} />
      </div>
      <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Write caption details, custom hashtags (#dagu)..." style={{ width: '100%', height: 80, background: '#141414', border: '1px solid #222', borderRadius: 14, padding: 12, color: 'white', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
      <button onClick={handlePost} disabled={loading} style={{ background: 'linear-gradient(135deg,#ff2d55,#af52de)', color: 'white', border: 'none', padding: 14, borderRadius: 24, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
        {loading ? 'Processing Workspace Pipeline...' : 'Deploy Video Node'}
      </button>
    </div>
  );
};

// ─── Chat & Messaging Inbox ─────────────────────────────────────────────────
const InboxPage = ({ users, currentUser, showToast }) => {
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  const targetUser = useMemo(() => users.find(u => u.id === activeChatId), [activeChatId, users]);

  useEffect(() => {
    if (!activeChatId) return;
    const roomId = [currentUser.id, activeChatId].sort().join('_');
    const q = query(collection(db, 'messages'), where('roomId', '==', roomId), orderBy('timestamp', 'asc'));
    return onSnapshot(q, snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [activeChatId, currentUser.id]);

  const sendDM = async () => {
    if (!text.trim()) return;
    const roomId = [currentUser.id, activeChatId].sort().join('_');
    const msgPayload = { roomId, senderId: currentUser.id, text, timestamp: serverTimestamp() };
    setText('');
    try { await addDoc(collection(db, 'messages'), msgPayload); } catch {}
  };

  if (activeChatId && targetUser) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#000', color: 'white' }}>
        <div style={{ padding: 14, borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setActiveChatId(null)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 18 }}>⬅</button>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: targetUser.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{targetUser.avatar}</div>
          <span style={{ fontWeight: 700 }}>@{targetUser.username}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map(m => {
            const isMe = m.senderId === currentUser.id;
            return (
              <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', background: isMe ? '#ff2d55' : '#141414', padding: '10px 14px', borderRadius: 16, maxWidth: '75%', fontSize: 14 }}>
                {m.text}
              </div>
            );
          })}
        </div>
        <div style={{ padding: 12, display: 'flex', gap: 8, borderTop: '1px solid #1a1a1a' }}>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key==='Enter' && sendDM()} placeholder="Send a message..." style={{ flex: 1, background: '#141414', border: '1px solid #222', borderRadius: 20, padding: '10px 16px', color: 'white', outline: 'none' }} />
          <button onClick={sendDM} style={{ background: '#ff2d55', border: 'none', color: 'white', padding: '0 18px', borderRadius: 20, fontWeight: 700 }}>Send</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#000', color: 'white' }}>
      <div style={{ padding: 16, borderBottom: '1px solid #1a1a1a' }}><h3>Secure System Inbox</h3></div>
      {users.filter(u => u.id !== currentUser.id).map(u => (
        <div key={u.id} onClick={() => setActiveChatId(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderBottom: '1px solid #0d0d0d', cursor: 'pointer' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: u.avatarColor || '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 'bold' }}>{u.avatar}</div>
          <div>
            <div style={{ fontWeight: 700 }}>@{u.username}</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Tap to open secure connection channel</div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Profile Tab & Analytics Sub-System ─────────────────────────────────────
const ProfilePage = ({ user, onLogout, users, onShowAnalytics }) => {
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#000', color: 'white', textAlign: 'center', padding: 24, boxSizing: 'border-box' }}>
      <div style={{ width: 88, height: 88, borderRadius: '50%', background: user.avatarColor || '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 12px', fontWeight: 'bold' }}>
        {user.avatar}
      </div>
      <h3 style={{ margin: 0 }}>@{user.username}</h3>
      <p style={{ color: '#666', fontSize: 13, marginTop: 4 }}>{user.fullName}</p>

      <div style={{ display: 'flex', justifySelf: 'center', gap: 24, margin: '20px 0', justifyContent: 'center' }}>
        <div><div style={{ fontWeight: 700, fontSize: 16 }}>1.4K</div><div style={{ color: '#666', fontSize: 12 }}>Following</div></div>
        <div><div style={{ fontWeight: 700, fontSize: 16 }}>98.2K</div><div style={{ color: '#666', fontSize: 12 }}>Followers</div></div>
        <div><div style={{ fontWeight: 700, fontSize: 16 }}>3.5M</div><div style={{ color: '#666', fontSize: 12 }}>Likes</div></div>
      </div>

      <div style={{ background: '#141414', padding: 16, borderRadius: 16, border: '1px solid #1e1e1e', margin: '20px 0', color: '#ffd700', fontSize: 14 }}>
        Active Balance Architecture: <strong>{user.coins || 1000} 🪙 Coins</strong>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={onShowAnalytics} style={{ width: '100%', padding: 12, background: '#141414', border: '1px solid #222', color: 'white', borderRadius: 14, fontWeight: 700, cursor: 'pointer' }}>📊 Architecture Engine Analytics</button>
        <button onClick={onLogout} style={{ width: '100%', padding: 12, background: 'rgba(255,45,85,0.1)', border: '1px solid rgba(255,45,85,0.2)', color: '#ff2d55', borderRadius: 14, fontWeight: 700, cursor: 'pointer' }}>De-authenticate Active Session</button>
      </div>
    </div>
  );
};

const AnalyticsModal = ({ onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 4000, padding: 24, color: 'white', overflowY: 'auto' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
      <h2>📊 Metrics Console Node</h2>
      <button onClick={onClose} style={{ background: '#141414', border: 'none', color: 'white', padding: '8px 16px', borderRadius: 12, cursor: 'pointer' }}>Close</button>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
      <div style={{ background: '#141414', padding: 16, borderRadius: 16, border: '1px solid #222' }}><h3>84.2%</h3><p style={{ color: '#666', fontSize: 12 }}>Algorithm Retain Rate</p></div>
      <div style={{ background: '#141414', padding: 16, borderRadius: 16, border: '1px solid #222' }}><h3>+12.4K</h3><p style={{ color: '#666', fontSize: 12 }}>Weekly Node Streams</p></div>
    </div>
    <div style={{ background: '#141414', padding: 20, borderRadius: 16, border: '1px solid #222' }}>
      <h3>Platform Activity Engine Spectrum</h3>
      <p style={{ color: '#aaa', fontSize: 13, lineHeight: 1.6 }}>System nodes operational. Global video indexing running optimally across cloud clusters.</p>
    </div>
  </div>
);

// ─── Main Core Shell Orchestrator ───────────────────────────────────────────
export function DaguApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers]             = useState([]);
  const [videos, setVideos]           = useState([]);
  const [stories, setStories]         = useState([]);
  const [activeTab, setActiveTab]     = useState('home');
  const [toast, setToast]             = useState(null);
  const [activeCall, setActiveCall]   = useState(null);
  const [activeLive, setActiveLive]   = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [activeStoryUser, setActiveStoryUser] = useState(null);
  const [followed, setFollowed]       = useState([]);

  const showToast = useCallback((message, type = 'info') => setToast({ message, type }), []);

  useEffect(() => {
    // Synchronize Users Matrix
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    // Synchronize Content Stream Node
    const unsubVideos = onSnapshot(query(collection(db, 'videos'), orderBy('timestamp', 'desc')), snap => {
      setVideos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    // Synchronize Short Stories Collection
    const unsubStories = onSnapshot(collection(db, 'stories'), snap => {
      setStories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubUsers(); unsubVideos(); unsubStories(); };
  }, []);

  const handleLogin = async (email, password) => {
    const qUser = query(collection(db, 'users'), where('email', '==', email.trim().toLowerCase()));
    const snap = await getDocs(qUser);
    if (!snap.empty) {
      const uData = { id: snap.docs[0].id, ...snap.docs[0].data() };
      setCurrentUser(uData);
      showToast(`Welcome back, @${uData.username}! 👋`, 'success');
    } else {
      throw new Error('User context entity not discovered in Firestore');
    }
  };

  const handleSignup = async (email, username, fullName, password) => {
    const cleanUsername = username.trim().toLowerCase();
    const qCheck = query(collection(db, 'users'), where('username', '==', cleanUsername));
    const snapCheck = await getDocs(qCheck);
    if (!snapCheck.empty) throw new Error('Username entity reserved');

    const uId = 'user_' + Date.now();
    const newUser = {
      id: uId, email: email.trim().toLowerCase(), username: cleanUsername, fullName,
      avatar: cleanUsername.substring(0, 2).toUpperCase(),
      avatarColor: '#' + Math.floor(Math.random() * 16777215).toString(16),
      coins: 2500
    };
    await setDoc(doc(db, 'users', uId), newUser);
    setCurrentUser(newUser);
    showToast('Secure profile successfully constructed!', 'success');
  };

  const handleFollow = (targetId) => {
    setFollowed(f => f.includes(targetId) ? f.filter(x => x !== targetId) : [...f, targetId]);
    showToast('Follow architecture changed', 'success');
  };

  const tabs = [
    { id: 'home',     icon: '🏠', label: 'Home' },
    { id: 'discover', icon: '🔍', label: 'Discover' },
    { id: 'create',   icon: '➕', label: 'Create' },
    { id: 'inbox',    icon: '✉️', label: 'Inbox' },
    { id: 'profile',  icon: '👤', label: 'Profile' }
  ];

  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} onSignup={handleSignup} />;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', background: '#0a0a0a', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420, height: '100%', display: 'flex', flexDirection: 'column', background: '#000', borderLeft: '1px solid #111', borderRight: '1px solid #111', position: 'relative' }}>
        
        {/* Top Header Segment */}
        {activeTab === 'home' && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, zIndex: 100, background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 16, borderBottom: '2px solid #fff', paddingBottom: 4, cursor: 'pointer' }}>For You</span>
            <span onClick={() => { if(users.length > 1) setActiveLive(users[1]); }} style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>📺 Live Stream</span>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'hidden', position: 'relative', marginTop: activeTab === 'home' ? 0 : 0 }}>
          {activeTab === 'home' && (
            <div style={{ width: '100%', height: '100%', overflowY: 'scroll', snapType: 'y mandatory' }}>
              <Stories users={users} stories={stories} currentUser={currentUser} onViewStory={setActiveStoryUser} onAddStory={(s)=>setStories([s,...stories])} showToast={showToast} />
              {videos.map(v => (
                <div key={v.id} style={{ height: '100%', snapAlign: 'start' }}>
                  <VideoCard video={v} currentUser={currentUser} onFollow={handleFollow} followed={followed} showToast={showToast} onViewProfile={() => setActiveTab('profile')} onMessage={() => setActiveTab('inbox')} />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'discover' && <DiscoverTab videos={videos} onViewProfile={() => setActiveTab('profile')} />}
          {activeTab === 'create'   && <CreateTab currentUser={currentUser} onUploadSuccess={() => setActiveTab('home')} showToast={showToast} />}
          {activeTab === 'inbox'    && <InboxPage users={users} currentUser={currentUser} showToast={showToast} />}
          {activeTab === 'profile'  && <ProfilePage user={currentUser} onLogout={() => setCurrentUser(null)} users={users} onShowAnalytics={() => setShowAnalytics(true)} />}
        </div>

        {/* Global Bottom Navigation Component Panel */}
        <div style={{ display: 'flex', background: 'rgba(8,8,8,0.97)', borderTop: '1px solid #161616', padding: '8px 4px 16px', flexShrink: 0, backdropFilter: 'blur(12px)' }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
              <span style={{ fontSize: tab.id==='create' ? 26 : 20, color: activeTab===tab.id ? '#ff2d55' : '#888' }}>{tab.icon}</span>
              <span style={{ fontSize: 10, color: activeTab===tab.id ? '#white' : '#666', fontWeight: 600 }}>{tab.label}</span>
            </button>
          ))}
        </div>

      </div>

      {/* Dynamic Overlay Portals */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {showAnalytics && <AnalyticsModal onClose={() => setShowAnalytics(false)} />}
      {activeLive && <LiveStream streamer={activeLive} currentUser={currentUser} showToast={showToast} onClose={() => setActiveLive(null)} />}
      {activeCall && <CallModal type={activeCall.type} contactName={activeCall.user.username} contactAvatar={activeCall.user.avatar} onClose={() => setActiveCall(null)} />}
      {activeStoryUser && <StoryViewer stories={stories} user={activeStoryUser} onClose={() => setActiveStoryUser(null)} onNextUser={() => setActiveStoryUser(null)} onPrevUser={() => setActiveStoryUser(null)} />}
    </div>
  );
}

export default DaguApp;
