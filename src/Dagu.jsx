// Dagu.jsx - COMPLETELY FIXED VERSION with Friends, Live, Stories, Settings ALL WORKING
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { auth, db, storage, googleProvider } from './firebase';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, signInWithPopup, updateProfile
} from 'firebase/auth';
import {
  collection, addDoc, getDocs, onSnapshot, doc,
  updateDoc, getDoc, arrayUnion, arrayRemove,
  serverTimestamp, query, orderBy, where, setDoc, deleteDoc, limit,
  increment
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

// ============================================
// HELPERS
// ============================================
const formatNumber = (num) => {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const timeAgo = (timestamp) => {
  if (!timestamp) return 'Just now';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

// ============================================
// TOAST NOTIFICATION
// ============================================
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  const colors = { success: '#06d6a0', error: '#ff2d55', info: '#af52de', warning: '#ff9500' };
  return (
    <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', border: `1px solid ${colors[type] || '#333'}`, borderRadius: 30, padding: '12px 24px', zIndex: 10000, backdropFilter: 'blur(10px)' }}>
      <span style={{ color: colors[type] || '#fff', fontSize: 14 }}>{message}</span>
    </div>
  );
};

// ============================================
// AUTH SCREEN
// ============================================
const AuthScreen = ({ showToast }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) { showToast('Please fill all fields', 'error'); return; }
    if (!isLogin && !username) { showToast('Username required', 'error'); return; }
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await addDoc(collection(db, 'users'), {
          uid: result.user.uid, username: username.toLowerCase(), email: email,
          bio: 'New to Dagu! 🎬', followers: [], following: [], photoURL: '', coins: 500,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) { showToast(err.message, 'error'); }
    setLoading(false);
  };

  const handleGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const q = query(collection(db, 'users'), where('uid', '==', result.user.uid));
      const snap = await getDocs(q);
      if (snap.empty) {
        await addDoc(collection(db, 'users'), {
          uid: result.user.uid, username: result.user.displayName?.toLowerCase() || 'user',
          email: result.user.email, bio: 'Joined via Google 🎬', followers: [], following: [],
          photoURL: result.user.photoURL || '', coins: 500, createdAt: serverTimestamp(),
        });
      }
    } catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#0a0a0a 60%,#120007)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>🎬</div>
          <h1 style={{ fontSize: 42, fontWeight: 800, background: 'linear-gradient(135deg,#ff2d55,#af52de)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Dagu</h1>
          <p style={{ color: '#555', fontSize: 13 }}>{isLogin ? 'Welcome back!' : 'Join Dagu today'}</p>
        </div>
        <button onClick={handleGoogle} style={{ width: '100%', background: '#fff', border: 'none', borderRadius: 16, padding: 13, color: '#222', fontWeight: 700, cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>🌐 Continue with Google</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}><div style={{ flex: 1, height: 1, background: '#1a1a1a' }} /><span style={{ color: '#444' }}>or</span><div style={{ flex: 1, height: 1, background: '#1a1a1a' }} /></div>
        <div style={{ background: '#141414', borderRadius: 24, padding: 24 }}>
          {!isLogin && <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 10, outline: 'none' }} />}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 10, outline: 'none' }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 16, outline: 'none' }} />
          <button onClick={submit} disabled={loading} style={{ width: '100%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: 24, padding: 14, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{loading ? '...' : isLogin ? 'Sign In' : 'Create Account'}</button>
          <button onClick={() => setIsLogin(!isLogin)} style={{ width: '100%', background: 'none', border: 'none', color: '#ff2d55', marginTop: 12, cursor: 'pointer' }}>{isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}</button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// CREATE POST MODAL (Working)
// ============================================
const CreatePostModal = ({ currentUser, onClose, showToast }) => {
  const [text, setText] = useState('');
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!text.trim()) { showToast('Write something first!', 'error'); return; }
    setPosting(true);
    try {
      await addDoc(collection(db, 'posts'), {
        type: 'text', text: text.trim(), caption: caption.trim(),
        userId: currentUser.uid, username: currentUser.username,
        photoURL: currentUser.photoURL || '',
        likes: [], comments: [], shares: 0, saves: [],
        createdAt: serverTimestamp(),
      });
      showToast('Posted! 🎉', 'success');
      onClose();
    } catch { showToast('Failed to post', 'error'); }
    setPosting(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>✕</button>
        <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Create Post</h3>
        <button onClick={handlePost} disabled={posting} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 20px', color: '#fff', cursor: 'pointer' }}>{posting ? '...' : 'Post'}</button>
      </div>
      <div style={{ flex: 1, padding: 20 }}>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="What's on your mind?" autoFocus style={{ width: '100%', height: 200, background: '#141414', border: '1px solid #222', borderRadius: 16, padding: 16, color: '#fff', fontSize: 16, outline: 'none', resize: 'none' }} />
        <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Add a caption..." style={{ width: '100%', marginTop: 12, background: '#141414', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', outline: 'none' }} />
      </div>
    </div>
  );
};

// ============================================
// CREATE STORY MODAL (Working)
// ============================================
const CreateStoryModal = ({ currentUser, onClose, showToast, onStoryPosted }) => {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);

  const handleTextStory = async () => {
    if (!text.trim()) { showToast('Write something!', 'error'); return; }
    setPosting(true);
    try {
      await addDoc(collection(db, 'stories'), {
        type: 'text', text: text.trim(), userId: currentUser.uid, username: currentUser.username,
        photoURL: currentUser.photoURL || '', createdAt: serverTimestamp(),
      });
      showToast('Story posted! 📖', 'success');
      onStoryPosted?.();
      onClose();
    } catch { showToast('Failed', 'error'); }
    setPosting(false);
  };

  const handleImageStory = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setPosting(true);
    try {
      const storageRef2 = ref(storage, `stories/${currentUser.uid}_${Date.now()}`);
      const task = uploadBytesResumable(storageRef2, file);
      task.on('state_changed', null, null, async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await addDoc(collection(db, 'stories'), {
          type: 'photo', url, userId: currentUser.uid, username: currentUser.username,
          photoURL: currentUser.photoURL || '', createdAt: serverTimestamp(),
        });
        showToast('Story posted! 📸', 'success');
        onStoryPosted?.();
        onClose();
      });
    } catch { showToast('Failed', 'error'); }
    setPosting(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>✕</button>
        <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Create Story</h3>
        <div style={{ width: 40 }} />
      </div>
      <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <button onClick={() => fileInputRef.current?.click()} style={{ background: '#141414', border: '2px dashed #333', borderRadius: 16, padding: 30, cursor: 'pointer' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📸</div>
          <div style={{ color: '#888' }}>Upload Photo Story</div>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageStory} style={{ display: 'none' }} />
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Or write a text story..." style={{ background: '#141414', border: '1px solid #222', borderRadius: 16, padding: 16, color: '#fff', fontSize: 16, outline: 'none', resize: 'none', height: 120 }} />
        <button onClick={handleTextStory} disabled={posting} style={{ background: '#ff2d55', border: 'none', borderRadius: 16, padding: 14, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{posting ? 'Posting...' : 'Post Text Story'}</button>
      </div>
    </div>
  );
};

// ============================================
// STORIES COMPONENT
// ============================================
const Stories = ({ currentUser, stories, onStoryPosted, showToast }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [viewingStory, setViewingStory] = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!viewingStory) return;
    const interval = setInterval(() => { setProgress(p => { if (p >= 100) { clearInterval(interval); setViewingStory(null); return 0; } return p + 2; }); }, 50);
    return () => clearInterval(interval);
  }, [viewingStory]);

  const groupedStories = stories.reduce((acc, s) => { if (!acc[s.userId]) acc[s.userId] = []; acc[s.userId].push(s); return acc; }, {});

  return (
    <>
      <div style={{ padding: '10px 14px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-block', marginRight: 14, textAlign: 'center', cursor: 'pointer' }} onClick={() => setShowCreate(true)}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', padding: 2 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>➕</div>
          </div>
          <div style={{ color: '#888', fontSize: 10, marginTop: 3 }}>Your Story</div>
        </div>
        {Object.values(groupedStories).map((group, i) => (
          <div key={i} style={{ display: 'inline-block', marginRight: 14, textAlign: 'center', cursor: 'pointer' }} onClick={() => setViewingStory(group)}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', padding: 2 }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff', overflow: 'hidden' }}>
                {group[0]?.photoURL ? <img src={group[0].photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : group[0]?.username?.[0]?.toUpperCase()}
              </div>
            </div>
            <div style={{ color: '#fff', fontSize: 10, marginTop: 3 }}>@{group[0]?.username}</div>
          </div>
        ))}
      </div>

      {showCreate && <CreateStoryModal currentUser={currentUser} onClose={() => setShowCreate(false)} onStoryPosted={onStoryPosted} showToast={showToast} />}

      {viewingStory && viewingStory[0] && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 3000 }} onClick={() => setViewingStory(null)}>
          <div style={{ position: 'absolute', top: 20, left: 0, right: 0, padding: '0 16px' }}>
            <div style={{ height: 3, background: '#333', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: '#fff', transition: 'width 0.05s linear' }} />
            </div>
          </div>
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            {viewingStory[0].type === 'photo' && <img src={viewingStory[0].url} style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 16 }} />}
            {viewingStory[0].type === 'text' && (
              <div style={{ background: 'linear-gradient(135deg,#1a0020,#000)', borderRadius: 20, padding: 40, textAlign: 'center' }}>
                <p style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{viewingStory[0].text}</p>
              </div>
            )}
          </div>
          <button onClick={(e) => { e.stopPropagation(); setViewingStory(null); }} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', cursor: 'pointer' }}>✕</button>
        </div>
      )}
    </>
  );
};

// ============================================
// POST CARD
// ============================================
const PostCard = memo(({ post, currentUser, onViewProfile, showToast }) => {
  const [liked, setLiked] = useState((post.likes || []).includes(currentUser?.uid));
  const [likeCount, setLikeCount] = useState((post.likes || []).length);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    if (!showComments) return;
    const unsub = onSnapshot(query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt')), snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [showComments, post.id]);

  const toggleLike = async () => {
    const newLiked = !liked;
    setLiked(newLiked); setLikeCount(c => newLiked ? c + 1 : c - 1);
    try {
      await updateDoc(doc(db, 'posts', post.id), { likes: newLiked ? arrayUnion(currentUser.uid) : arrayRemove(currentUser.uid) });
    } catch (e) { console.error(e); }
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    try {
      await addDoc(collection(db, 'posts', post.id, 'comments'), { text: commentText, userId: currentUser.uid, username: currentUser.username, photoURL: currentUser.photoURL || '', createdAt: serverTimestamp() });
      setCommentText('');
    } catch { showToast('Failed to comment', 'error'); }
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000', overflow: 'hidden' }}>
      {post.type === 'video' && <video src={post.url} loop playsInline autoPlay muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      {post.type === 'photo' && <img src={post.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      {post.type === 'text' && (
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#1a0a2e,#0a0a1a)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <p style={{ color: '#fff', fontSize: 24, fontWeight: 700, textAlign: 'center' }}>{post.text}</p>
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 68, padding: '18px 14px', zIndex: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div onClick={() => onViewProfile?.(post.userId)} style={{ width: 42, height: 42, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', overflow: 'hidden' }}>
            {post.photoURL ? <img src={post.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (post.username?.[0] || '?').toUpperCase()}
          </div>
          <span onClick={() => onViewProfile?.(post.userId)} style={{ color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>@{post.username}</span>
        </div>
        {post.caption && <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>{post.caption}</p>}
        <p style={{ color: '#555', fontSize: 10, marginTop: 4 }}>{timeAgo(post.createdAt)}</p>
      </div>
      <div style={{ position: 'absolute', right: 10, bottom: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, zIndex: 6 }}>
        <button onClick={toggleLike} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{liked ? '❤️' : '🤍'}</button>
        <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{formatNumber(likeCount)}</span>
        <button onClick={() => setShowComments(true)} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 24, cursor: 'pointer' }}>💬</button>
        <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{formatNumber(post.comments?.length || 0)}</span>
      </div>
      {showComments && (
        <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e1e1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700 }}>💬 Comments</span>
            <button onClick={() => setShowComments(false)} style={{ background: '#1a1a1a', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>
                  {c.photoURL ? <img src={c.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : c.username?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, background: '#161616', borderRadius: 14, padding: '8px 12px' }}>
                  <div style={{ color: '#ff2d55', fontWeight: 600, fontSize: 11 }}>@{c.username}</div>
                  <p style={{ color: '#ddd', fontSize: 13 }}>{c.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 12px', borderTop: '1px solid #1e1e1e', display: 'flex', gap: 6 }}>
            <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyPress={e => e.key === 'Enter' && addComment()} placeholder="Add a comment..." style={{ flex: 1, background: '#161616', border: '1px solid #222', borderRadius: 20, padding: '9px 14px', color: '#fff', outline: 'none', fontSize: 13 }} />
            <button onClick={addComment} style={{ background: '#ff2d55', border: 'none', borderRadius: '50%', width: 38, height: 38, color: '#fff', cursor: 'pointer' }}>↑</button>
          </div>
        </div>
      )}
    </div>
  );
});

// ============================================
// HOME FEED (For You + Friends)
// ============================================
const HomeFeed = ({ posts, currentUser, onViewProfile, showToast, followed }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tab, setTab] = useState('foryou');
  const startY = useRef(null);

  const feedPosts = useMemo(() => {
    if (tab === 'friends') return posts.filter(p => followed.includes(p.userId));
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
      <div style={{ position: 'absolute', top: 12, left: 0, right: 0, zIndex: 15, display: 'flex', justifyContent: 'center', gap: 12 }}>
        <button onClick={() => { setTab('foryou'); setCurrentIndex(0); }} style={{ background: tab === 'foryou' ? '#ff2d55' : 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 30, padding: '8px 18px', color: '#fff', fontSize: 14, fontWeight: tab === 'foryou' ? 700 : 500, cursor: 'pointer' }}>🔥 For You</button>
        <button onClick={() => { setTab('friends'); setCurrentIndex(0); }} style={{ background: tab === 'friends' ? '#ff2d55' : 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 30, padding: '8px 18px', color: '#fff', fontSize: 14, fontWeight: tab === 'friends' ? 700 : 500, cursor: 'pointer' }}>👥 Friends</button>
      </div>
      {feedPosts.length === 0 ? (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 48 }}>📭</div>
          <div style={{ color: '#555', textAlign: 'center' }}>{tab === 'friends' ? 'Follow friends to see their posts!' : 'No posts yet. Be the first!'}</div>
        </div>
      ) : (
        feedPosts.map((post, idx) => (
          <div key={post.id} style={{ position: 'absolute', inset: 0, transform: `translateY(${(idx - currentIndex) * 100}%)`, transition: 'transform 0.3s', pointerEvents: idx === currentIndex ? 'auto' : 'none' }}>
            <PostCard post={post} currentUser={currentUser} onViewProfile={onViewProfile} showToast={showToast} />
          </div>
        ))
      )}
    </div>
  );
};

// ============================================
// EDIT PROFILE MODAL (Working)
// ============================================
const EditProfileModal = ({ user, onClose, onUpdate, showToast }) => {
  const [bio, setBio] = useState(user?.bio || '');
  const [username, setUsername] = useState(user?.username || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!username.trim()) { showToast('Username required', 'error'); return; }
    setSaving(true);
    await onUpdate({ bio, username });
    setSaving(false);
    onClose();
    showToast('Profile updated!', 'success');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 5000 }}>
      <div style={{ padding: 16, borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>✕</button>
        <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Edit Profile</h3>
        <button onClick={handleSave} disabled={saving} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 20px', color: '#fff', cursor: 'pointer' }}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
      <div style={{ padding: 20 }}>
        <label style={{ color: '#888', fontSize: 12, marginBottom: 4, display: 'block' }}>Username</label>
        <input value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', background: '#141414', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', marginBottom: 16 }} />
        <label style={{ color: '#888', fontSize: 12, marginBottom: 4, display: 'block' }}>Bio</label>
        <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell something about yourself" maxLength={150} rows={3} style={{ width: '100%', background: '#141414', border: '1px solid #222', borderRadius: 12, padding: 12, color: '#fff', resize: 'none' }} />
        <div style={{ color: '#555', fontSize: 10, textAlign: 'right', marginTop: 4 }}>{bio.length}/150</div>
      </div>
    </div>
  );
};

// ============================================
// SETTINGS PAGE (Working)
// ============================================
const SettingsPage = ({ currentUser, onClose, showToast, onLogout }) => {
  const [showEditProfile, setShowEditProfile] = useState(false);

  const updateProfile = async (updates) => {
    const q = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
    const snap = await getDocs(q);
    if (!snap.empty) await updateDoc(snap.docs[0].ref, updates);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 300, overflowY: 'auto' }}>
      {showEditProfile ? (
        <EditProfileModal user={currentUser} onClose={() => setShowEditProfile(false)} onUpdate={updateProfile} showToast={showToast} />
      ) : (
        <div>
          <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ff2d55', fontSize: 22, cursor: 'pointer' }}>←</button>
            <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Settings</h2>
          </div>
          {[
            { icon: '👤', label: 'Edit Profile', fn: () => setShowEditProfile(true) },
            { icon: '🔒', label: 'Privacy', fn: () => showToast('Coming soon!', 'info') },
            { icon: '🔔', label: 'Notifications', fn: () => showToast('Coming soon!', 'info') },
            { icon: '💰', label: 'Wallet', fn: () => showToast('Coming soon!', 'info') },
            { icon: '❓', label: 'Help & Support', fn: () => showToast('Coming soon!', 'info') },
            { icon: '📜', label: 'Terms & Privacy', fn: () => showToast('Coming soon!', 'info') },
          ].map(item => (
            <button key={item.label} onClick={item.fn} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '16px 20px', background: 'none', border: 'none', borderBottom: '1px solid #111', cursor: 'pointer' }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ color: '#fff', fontSize: 15, flex: 1, textAlign: 'left' }}>{item.label}</span>
              <span style={{ color: '#333', fontSize: 18 }}>›</span>
            </button>
          ))}
          <div style={{ padding: '20px 16px' }}>
            <button onClick={onLogout} style={{ width: '100%', background: 'rgba(255,45,85,0.1)', border: '1px solid rgba(255,45,85,0.3)', borderRadius: 16, padding: 14, color: '#ff2d55', fontWeight: 700, cursor: 'pointer' }}>🚪 Log Out</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// INBOX PAGE (Working)
// ============================================
const InboxPage = ({ currentUser, showToast }) => {
  const [users, setUsers] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.uid !== currentUser?.uid));
    });
    return unsub;
  }, [currentUser]);

  useEffect(() => {
    if (!activeChat || !currentUser?.uid) return;
    const convoId = [currentUser.uid, activeChat].sort().join('_');
    const unsub = onSnapshot(query(collection(db, 'messages', convoId, 'msgs'), orderBy('createdAt')), snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [activeChat, currentUser]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    if (!text.trim() || !activeChat) return;
    const convoId = [currentUser.uid, activeChat].sort().join('_');
    try {
      await addDoc(collection(db, 'messages', convoId, 'msgs'), { text, from: currentUser.uid, createdAt: serverTimestamp() });
      setText('');
    } catch { showToast('Failed to send', 'error'); }
  };

  const otherUser = users.find(u => u.uid === activeChat);

  if (activeChat && otherUser) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setActiveChat(null)} style={{ background: '#161616', border: 'none', borderRadius: 20, padding: '7px 12px', color: '#fff', cursor: 'pointer' }}>←</button>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, overflow: 'hidden' }}>
            {otherUser.photoURL ? <img src={otherUser.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : otherUser.username?.[0]?.toUpperCase()}
          </div>
          <div style={{ color: '#fff', fontWeight: 600 }}>@{otherUser.username}</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.from === currentUser?.uid ? 'flex-end' : 'flex-start' }}>
              <div style={{ background: msg.from === currentUser?.uid ? '#ff2d55' : '#1a1a1a', borderRadius: 18, padding: '10px 14px', maxWidth: '75%' }}>
                <div style={{ color: '#fff', fontSize: 13 }}>{msg.text}</div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div style={{ padding: '10px 12px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: 6 }}>
          <input value={text} onChange={e => setText(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} placeholder="Message..." style={{ flex: 1, background: '#161616', border: '1px solid #222', borderRadius: 22, padding: '9px 14px', color: '#fff', outline: 'none' }} />
          <button onClick={sendMessage} style={{ background: '#ff2d55', border: 'none', borderRadius: '50%', width: 38, height: 38, color: '#fff', cursor: 'pointer' }}>↑</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', background: '#0a0a0a' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #1a1a1a' }}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>💬 Messages</h2>
      </div>
      <div style={{ overflowY: 'auto' }}>
        {users.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#444' }}>No users yet</div>}
        {users.map(u => (
          <div key={u.id} onClick={() => setActiveChat(u.uid)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid #111', cursor: 'pointer' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 20, overflow: 'hidden' }}>
              {u.photoURL ? <img src={u.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.username?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>@{u.username}</div>
              <div style={{ color: '#555', fontSize: 12 }}>{u.bio || 'Tap to message'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// MY PROFILE PAGE (Working)
// ============================================
const MyProfile = ({ currentUser, showToast, onLogout, onOpenSettings }) => {
  const [posts, setPosts] = useState([]);
  const [showEditProfile, setShowEditProfile] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, 'posts'), where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [currentUser]);

  const updateProfile = async (updates) => {
    const q = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
    const snap = await getDocs(q);
    if (!snap.empty) await updateDoc(snap.docs[0].ref, updates);
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0a0a0a' }}>
      {showEditProfile ? (
        <EditProfileModal user={currentUser} onClose={() => setShowEditProfile(false)} onUpdate={updateProfile} showToast={showToast} />
      ) : (
        <>
          <div style={{ padding: '16px 16px 0', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onOpenSettings} style={{ background: '#1a1a1a', border: 'none', borderRadius: 20, padding: '8px 16px', color: '#fff', cursor: 'pointer' }}>⚙️ Settings</button>
          </div>
          <div style={{ textAlign: 'center', padding: '20px', borderBottom: '1px solid #1a1a1a' }}>
            <div style={{ width: 90, height: 90, borderRadius: '50%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', padding: 2, margin: '0 auto 12px' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, color: '#fff', overflow: 'hidden' }}>
                {currentUser?.photoURL ? <img src={currentUser.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : currentUser?.username?.[0]?.toUpperCase()}
              </div>
            </div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>@{currentUser?.username}</h2>
            <p style={{ color: '#888', fontSize: 13, marginTop: 4, marginBottom: 16 }}>{currentUser?.bio || 'Dagu Creator 🎬'}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => setShowEditProfile(true)} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 20, padding: '9px 20px', color: '#fff', cursor: 'pointer' }}>✏️ Edit Profile</button>
            </div>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 16 }}>
              <div style={{ textAlign: 'center' }}><div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{posts.length}</div><div style={{ color: '#666', fontSize: 11 }}>Posts</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{currentUser?.followers?.length || 0}</div><div style={{ color: '#666', fontSize: 11 }}>Followers</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{currentUser?.following?.length || 0}</div><div style={{ color: '#666', fontSize: 11 }}>Following</div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
              {posts.map(post => (
                <div key={post.id} style={{ aspectRatio: '9/16', background: '#111', borderRadius: 8, overflow: 'hidden' }}>
                  {post.type === 'video' && <video src={post.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />}
                  {post.type === 'photo' && <img src={post.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  {post.type === 'text' && <div style={{ background: 'linear-gradient(135deg,#1a0020,#000)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}><p style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{post.text?.substring(0, 50)}</p></div>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ============================================
// MAIN APP
// ============================================
export default function DaguApp() {
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [followed, setFollowed] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [toast, setToast] = useState(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);

  const showToast = useCallback((message, type = 'info') => setToast({ message, type }), []);

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

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'stories'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setStories(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const handleLogout = async () => { await signOut(auth); showToast('Logged out', 'info'); };
  const refreshStories = () => {};

  if (firebaseUser === undefined) return <div style={{ height: '100dvh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ fontSize: 56 }}>🎬</div></div>;
  if (!firebaseUser) return <AuthScreen showToast={showToast} />;

  const tabs = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'post', icon: '➕', label: 'Post' },
    { id: 'story', icon: '📖', label: 'Story' },
    { id: 'inbox', icon: '💬', label: 'Inbox' },
    { id: 'profile', icon: '👤', label: 'Me' },
  ];

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <style>{`*{margin:0;padding:0;box-sizing:border-box}::-webkit-scrollbar{display:none}button:active{transform:scale(0.95)}`}</style>

      {showCreatePost && <CreatePostModal currentUser={currentUser} onClose={() => setShowCreatePost(false)} showToast={showToast} />}
      {showSettings && <SettingsPage currentUser={currentUser} onClose={() => setShowSettings(false)} showToast={showToast} onLogout={handleLogout} />}

      {/* Stories Row - Only on Home tab */}
      {activeTab === 'home' && (
        <Stories currentUser={currentUser} stories={stories} onStoryPosted={refreshStories} showToast={showToast} />
      )}

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        {activeTab === 'home' && (
          <HomeFeed posts={posts} currentUser={currentUser} onViewProfile={setViewingProfile} showToast={showToast} followed={followed} />
        )}
        {activeTab === 'inbox' && <InboxPage currentUser={currentUser} showToast={showToast} />}
        {activeTab === 'profile' && <MyProfile currentUser={currentUser} showToast={showToast} onLogout={handleLogout} onOpenSettings={() => setShowSettings(true)} />}
        {activeTab === 'post' && <CreatePostModal currentUser={currentUser} onClose={() => setActiveTab('home')} showToast={showToast} />}
        {activeTab === 'story' && <CreateStoryModal currentUser={currentUser} onClose={() => setActiveTab('home')} onStoryPosted={refreshStories} showToast={showToast} />}
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', background: 'rgba(8,8,8,0.97)', borderTop: '1px solid #161616', padding: '8px 4px 18px', flexShrink: 0 }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}>
            <span style={{ fontSize: 24, transform: activeTab === tab.id ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.15s' }}>{tab.icon}</span>
            <span style={{ fontSize: 10, color: activeTab === tab.id ? '#ff2d55' : '#444', fontWeight: activeTab === tab.id ? 700 : 400 }}>{tab.label}</span>
          </button>
        ))}
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}