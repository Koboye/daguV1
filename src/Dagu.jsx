// Dagu.jsx - Using Firebase Storage instead of Cloudinary
import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { db, storage } from './firebase';
import {
  collection, addDoc, onSnapshot, query, orderBy,
  serverTimestamp, getDocs, where, doc, setDoc,
  updateDoc, arrayUnion, arrayRemove, deleteDoc, getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// ============================================
// CONSTANTS (same as before)
// ============================================
const LOGIN_METHODS = [
  { id: 'facebook', name: 'Facebook', icon: '📘', color: '#1877f2' },
  { id: 'google', name: 'Google', icon: '🌐', color: '#4285f4' },
  { id: 'apple', name: 'Apple', icon: '🍎', color: '#000' },
  { id: 'telegram', name: 'Telegram', icon: '📨', color: '#26A5E4' },
  { id: 'whatsapp', name: 'WhatsApp', icon: '📱', color: '#25D366' },
  { id: 'linkedin', name: 'LinkedIn', icon: '🔗', color: '#0077b5' },
  { id: 'imo', name: 'Imo', icon: '💬', color: '#6f4e7c' },
  { id: 'email', name: 'Email', icon: '📧', color: '#ff2d55' },
  { id: 'phone', name: 'Phone', icon: '📞', color: '#34c759' },
  { id: 'national_id', name: 'National ID', icon: '🆔', color: '#ff9500' },
];

const VIRTUAL_GIFTS = [
  { id: 'rose', name: '🌹 Rose', coins: 50, animation: '🌹' },
  { id: 'chocolate', name: '🍫 Chocolate', coins: 100, animation: '🍫' },
  { id: 'bear', name: '🧸 Teddy Bear', coins: 250, animation: '🧸' },
  { id: 'cake', name: '🎂 Cake', coins: 500, animation: '🎂' },
  { id: 'diamond', name: '💎 Diamond', coins: 1000, animation: '💎' },
  { id: 'rocket', name: '🚀 Rocket', coins: 5000, animation: '🚀' },
  { id: 'crown', name: '👑 Crown', coins: 10000, animation: '👑' },
  { id: 'galaxy', name: '🌌 Galaxy', coins: 50000, animation: '🌌' },
];

const SOUND_LIBRARY = [
  { id: 's1', name: 'Sunset Dreams', artist: 'Lofi Beats', duration: '3:24', popular: true, usage: 1250000 },
  { id: 's2', name: 'Creative Flow', artist: 'Chill Mix', duration: '2:56', popular: true, usage: 890000 },
  { id: 's3', name: 'Urban Vibes', artist: 'City Music', duration: '3:45', popular: true, usage: 567000 },
  { id: 's4', name: 'Midnight City', artist: 'Electronic', duration: '4:12', popular: false, usage: 234000 },
  { id: 's5', name: 'Summer Love', artist: 'Pop Hits', duration: '3:02', popular: true, usage: 3456000 },
];

const CATEGORIES = [
  { id: 'foryou', label: 'For You', icon: '🔥', color: '#ff2d55' },
  { id: 'following', label: 'Following', icon: '👥', color: '#06d6a0' },
  { id: 'live', label: 'Live', icon: '🔴', color: '#ff2d55' },
  { id: 'trending', label: 'Trending', icon: '📈', color: '#ffd60a' },
];

const EMOJI_LIST = ['😀','😂','😍','🥰','😎','🤔','😭','😱','🔥','❤️','👍','🎉','✨','💯','🙌','👏','🤝','💪','🎵','📸'];

const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num?.toString() || '0';
};

const getChatId = (uid1, uid2) => [uid1, uid2].sort().join('_');

// ============================================
// TOAST
// ============================================
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 2500); return () => clearTimeout(t); }, [onClose]);
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  return (
    <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(20,20,20,0.97)', border: '1px solid #2a2a2a', borderRadius: 30, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8, zIndex: 9999, whiteSpace: 'nowrap', backdropFilter: 'blur(10px)' }}>
      <span>{icons[type] || 'ℹ️'}</span>
      <span style={{ color: 'white', fontSize: 13 }}>{message}</span>
    </div>
  );
};

// ============================================
// CREATE STORY MODAL - FIXED with Firebase Storage
// ============================================
const CreateStoryModal = ({ onClose, onPost, currentUser, showToast }) => {
  const [storyType, setStoryType] = useState('text');
  const [storyText, setStoryText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setShowCamera(true);
    } catch { showToast?.('Camera access denied', 'error'); }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
      canvas.toBlob(blob => {
        const file = new File([blob], `story_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setSelectedMedia({ file, url: URL.createObjectURL(blob), type: 'image/jpeg' });
        stopCamera();
      }, 'image/jpeg');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) setSelectedMedia({ file, url: URL.createObjectURL(file), type: file.type });
  };

  const handlePost = async () => {
    if (storyType === 'text' && !storyText.trim()) { showToast?.('Enter some text', 'error'); return; }
    if ((storyType === 'photo' || storyType === 'video') && !selectedMedia) { showToast?.('Select media first', 'error'); return; }
    setUploading(true);
    try {
      let mediaUrl = null;
      if (selectedMedia) {
        showToast?.('Uploading to Firebase Storage...', 'info');
        // Upload to Firebase Storage
        const fileExt = selectedMedia.file.name.split('.').pop() || 'jpg';
        const storageRef = ref(storage, `stories/${currentUser.id}/${Date.now()}.${fileExt}`);
        await uploadBytes(storageRef, selectedMedia.file);
        mediaUrl = await getDownloadURL(storageRef);
        showToast?.('Upload complete!', 'success');
      }
      
      const newStory = {
        userId: currentUser.id,
        username: currentUser.username,
        avatar: currentUser.avatar,
        avatarColor: currentUser.avatarColor,
        photoURL: currentUser.photoURL || '',
        type: storyType,
        text: storyText,
        media: mediaUrl,
        timestamp: serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
      await addDoc(collection(db, 'stories'), newStory);
      onPost?.({ ...newStory, id: Date.now(), timestamp: new Date() });
      onClose();
      showToast?.('Story posted! 📸', 'success');
    } catch (err) {
      console.error('Upload error:', err);
      showToast?.('Failed to post story: ' + err.message, 'error');
    } finally { 
      setUploading(false); 
    }
  };

  useEffect(() => () => stopCamera(), []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer' }}>✕</button>
        <h3 style={{ color: 'white', fontSize: 16 }}>Create Story</h3>
        <button onClick={handlePost} disabled={uploading} style={{ background: uploading ? '#555' : '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 16px', color: 'white', fontWeight: 600, cursor: uploading ? 'default' : 'pointer' }}>{uploading ? 'Uploading...' : 'Post'}</button>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid #222' }}>
        {[['text','📝 Text'],['photo','📸 Photo'],['video','🎥 Video']].map(([type, label]) => (
          <button key={type} onClick={() => { setStoryType(type); setSelectedMedia(null); }} style={{ flex: 1, background: storyType === type ? '#ff2d55' : '#1a1a1a', border: 'none', borderRadius: 12, padding: '10px', color: 'white', cursor: 'pointer' }}>{label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {storyType === 'text' && (
          <textarea value={storyText} onChange={e => setStoryText(e.target.value)} placeholder="What's on your mind?" autoFocus
            style={{ width: '100%', height: 200, background: '#141414', border: '1px solid #222', borderRadius: 16, padding: 16, color: 'white', fontSize: 16, outline: 'none', resize: 'none' }} />
        )}
        {(storyType === 'photo' || storyType === 'video') && (
          <div>
            {showCamera && storyType === 'photo' ? (
              <div style={{ position: 'relative' }}>
                <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 16 }} />
                <button onClick={capturePhoto} style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: '#ff2d55', border: 'none', borderRadius: '50%', width: 60, height: 60, fontSize: 28, cursor: 'pointer' }}>📸</button>
                <button onClick={stopCamera} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: 'white', cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <div>
                {selectedMedia && (
                  <div style={{ position: 'relative' }}>
                    {selectedMedia.type.startsWith('image/') ? <img src={selectedMedia.url} alt="preview" style={{ width: '100%', borderRadius: 16 }} /> : <video src={selectedMedia.url} controls style={{ width: '100%', borderRadius: 16 }} />}
                    <button onClick={() => setSelectedMedia(null)} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer' }}>✕</button>
                  </div>
                )}
                <label style={{ display: 'block', textAlign: 'center', padding: 40, background: '#141414', borderRadius: 16, marginTop: 16, cursor: 'pointer' }}>
                  <div style={{ fontSize: 44 }}>📁</div>
                  <div style={{ color: '#888', marginTop: 8 }}>Choose from gallery</div>
                  <input type="file" accept={storyType === 'photo' ? 'image/*' : 'video/*'} onChange={handleFileSelect} style={{ display: 'none' }} />
                </label>
                {storyType === 'photo' && !selectedMedia && (
                  <button onClick={startCamera} style={{ width: '100%', marginTop: 12, background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: 12, color: 'white', cursor: 'pointer' }}>📸 Take a photo</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// STORIES ROW (same as before)
// ============================================
const Stories = ({ users, stories, currentUser, onViewStory, onAddStory, showToast }) => {
  const [showCreateStory, setShowCreateStory] = useState(false);
  const storyUserIds = [...new Set(stories.map(s => s.userId))];
  const usersWithStories = storyUserIds.map(uid => users.find(u => u.id === uid)).filter(Boolean);

  return (
    <>
      <div style={{ padding: '10px 14px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-block', marginRight: 14, textAlign: 'center', cursor: 'pointer' }} onClick={() => setShowCreateStory(true)}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', padding: 2 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>➕</div>
          </div>
          <div style={{ color: '#888', fontSize: 10, marginTop: 3 }}>Your Story</div>
        </div>
        {usersWithStories.map(user => (
          <div key={user.id} style={{ display: 'inline-block', marginRight: 14, textAlign: 'center', cursor: 'pointer' }} onClick={() => onViewStory(user)}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', padding: 2 }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: user.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'white', overflow: 'hidden' }}>
                {user.photoURL ? <img src={user.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user.avatar}
              </div>
            </div>
            <div style={{ color: 'white', fontSize: 10, marginTop: 3 }}>@{user.username}</div>
          </div>
        ))}
      </div>
      {showCreateStory && <CreateStoryModal onClose={() => setShowCreateStory(false)} onPost={onAddStory} currentUser={currentUser} showToast={showToast} />}
    </>
  );
};

// ============================================
// STORY VIEWER (same as before)
// ============================================
const StoryViewer = ({ stories, user, currentUser, onClose, onNextUser, onPrevUser }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const userStories = stories.filter(s => s.userId === user?.id).sort((a, b) => {
    const timeA = a.timestamp?.toDate?.() || new Date(a.timestamp);
    const timeB = b.timestamp?.toDate?.() || new Date(b.timestamp);
    return timeA - timeB;
  });
  const currentStory = userStories[currentIndex];

  useEffect(() => { setProgress(0); setCurrentIndex(0); }, [user?.id]);

  useEffect(() => {
    if (!currentStory) return;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (currentIndex + 1 < userStories.length) { setCurrentIndex(i => i + 1); return 0; }
          else { onNextUser?.(); return 0; }
        }
        return p + 2;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [currentStory, currentIndex, userStories.length, onNextUser]);

  if (!currentStory) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1500 }} onClick={onClose}>
      <div style={{ position: 'absolute', top: 20, left: 0, right: 0, padding: '0 16px', zIndex: 10 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {userStories.map((_, idx) => (
            <div key={idx} style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: idx === currentIndex ? `${progress}%` : idx < currentIndex ? '100%' : '0%', height: '100%', background: '#ff2d55', transition: 'width 0.05s linear' }} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 400, minHeight: 500, background: `linear-gradient(135deg,${user?.avatarColor || '#333'},#000)`, borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          {currentStory.type === 'text' && <div style={{ fontSize: 28, fontWeight: 700, color: 'white', textAlign: 'center' }}>{currentStory.text}</div>}
          {currentStory.type === 'photo' && currentStory.media && <img src={currentStory.media} alt="story" style={{ width: '100%', borderRadius: 16, maxHeight: '70vh', objectFit: 'contain' }} />}
          {currentStory.type === 'video' && currentStory.media && <video src={currentStory.media} autoPlay style={{ width: '100%', borderRadius: 16, maxHeight: '70vh' }} />}
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: user?.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 18, margin: '0 auto 8px', overflow: 'hidden' }}>
              {user?.photoURL ? <img src={user.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user?.avatar}
            </div>
            <div style={{ color: 'white', fontWeight: 600 }}>@{user?.username}</div>
          </div>
        </div>
      </div>
      <button onClick={e => { e.stopPropagation(); onPrevUser(); }} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: 'white', cursor: 'pointer', fontSize: 20, zIndex: 10 }}>←</button>
      <button onClick={e => { e.stopPropagation(); onNextUser(); }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: 'white', cursor: 'pointer', fontSize: 20, zIndex: 10 }}>→</button>
      <button onClick={onClose} style={{ position: 'absolute', top: 40, right: 20, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 38, height: 38, color: 'white', cursor: 'pointer', fontSize: 18, zIndex: 10 }}>✕</button>
    </div>
  );
};

// ============================================
// CAMERA UPLOAD - FIXED with Firebase Storage
// ============================================
const CameraUpload = ({ onUpload, onClose, showToast, currentUser }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setShowCamera(true);
    } catch { showToast?.('Camera access denied', 'error'); }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setShowCamera(false);
  };

  const captureVideo = () => {
    showToast?.('Video recording: Use "Choose from gallery" for now', 'info');
  };

  const handleFileSelect = e => { const f = e.target.files[0]; if (f) setSelectedFile({ file: f, url: URL.createObjectURL(f), type: f.type }); };

  const handleUpload = async () => {
    if (!selectedFile) { showToast?.('Select media first', 'error'); return; }
    setUploading(true);
    try {
      showToast?.('Uploading to Firebase Storage...', 'info');
      
      // Upload to Firebase Storage
      const fileExt = selectedFile.file.name.split('.').pop() || 'mp4';
      const storageRef = ref(storage, `videos/${currentUser.id}/${Date.now()}.${fileExt}`);
      await uploadBytes(storageRef, selectedFile.file);
      const videoUrl = await getDownloadURL(storageRef);
      
      showToast?.('Upload complete! Saving...', 'success');

      const newVideo = {
        userId: currentUser?.id,
        username: currentUser?.username,
        avatar: currentUser?.avatar,
        avatarColor: currentUser?.avatarColor,
        photoURL: currentUser?.photoURL || '',
        verified: currentUser?.verified || false,
        description: description || 'New post! 🔥',
        videoUrl,
        likes: 0,
        commentCount: 0,
        shares: 0,
        views: 0,
        hashtags: [],
        song: 'Original sound',
        category: 'foryou',
        createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'videos'), newVideo);
      onUpload?.({ id: docRef.id, ...newVideo });
      showToast?.('Posted! 🚀', 'success');
      onClose?.();
    } catch (err) {
      console.error('Upload error:', err);
      showToast?.('Upload failed: ' + err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => () => stopCamera(), []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a1a' }}>
        <button onClick={onClose} style={{ background: '#161616', border: 'none', borderRadius: 20, padding: '8px 14px', color: 'white', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
        <h3 style={{ color: 'white', fontSize: 15, fontWeight: 700 }}>Create Post</h3>
        <button onClick={handleUpload} disabled={uploading} style={{ background: uploading ? '#555' : '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 14px', color: 'white', fontWeight: 700, cursor: uploading ? 'default' : 'pointer', fontSize: 13 }}>{uploading ? 'Uploading...' : 'Post'}</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {showCamera ? (
          <div style={{ position: 'relative' }}>
            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 16 }} />
            <button onClick={captureVideo} style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: '#ff2d55', border: 'none', borderRadius: '50%', width: 64, height: 64, fontSize: 28, cursor: 'pointer' }}>🎥</button>
            <button onClick={stopCamera} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: 'white', cursor: 'pointer' }}>✕</button>
          </div>
        ) : selectedFile ? (
          <div style={{ position: 'relative' }}>
            {selectedFile.type.startsWith('image/') ? <img src={selectedFile.url} alt="preview" style={{ width: '100%', borderRadius: 16 }} /> : <video src={selectedFile.url} controls style={{ width: '100%', borderRadius: 16 }} />}
            <button onClick={() => setSelectedFile(null)} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer' }}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'block', textAlign: 'center', padding: 40, background: '#141414', borderRadius: 16, cursor: 'pointer' }}>
              <div style={{ fontSize: 44 }}>📁</div>
              <div style={{ color: '#888', marginTop: 8 }}>Choose from gallery</div>
              <input type="file" accept="image/*,video/*" onChange={handleFileSelect} style={{ display: 'none' }} />
            </label>
            <button onClick={startCamera} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: 14, color: 'white', cursor: 'pointer', fontSize: 14 }}>📸 Open Camera</button>
          </div>
        )}
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your post... #hashtags" style={{ width: '100%', marginTop: 14, background: '#141414', border: '1px solid #222', borderRadius: 14, padding: 12, color: 'white', resize: 'none', height: 80, outline: 'none', fontSize: 13 }} />
      </div>
    </div>
  );
};

// ============================================
// ENHANCED VIDEO CARD (simplified)
// ============================================
const EnhancedVideoCard = memo(({ video, currentUser, onLike, onComment, onShare, onFollow, onMessage, onVoiceCall, onVideoCall, followed, showToast, onViewProfile }) => {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const videoRef = useRef(null);
  const lastTap = useRef(0);

  useEffect(() => {
    if (!showComments || !video.id) return;
    const unsub = onSnapshot(
      query(collection(db, 'videos', video.id, 'comments'), orderBy('timestamp', 'desc')),
      snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [showComments, video.id]);

  const handleDoubleTap = async (e) => {
    const now = Date.now();
    if (now - lastTap.current < 300 && !liked) {
      setLiked(true);
      setLikeCount(p => p + 1);
      await updateDoc(doc(db, 'videos', video.id), { likes: likeCount + 1 }).catch(() => {});
    }
    lastTap.current = now;
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    const newComment = {
      username: currentUser?.username,
      avatar: currentUser?.avatar,
      avatarColor: currentUser?.avatarColor,
      text: commentText,
      likes: 0,
      replies: [],
      timestamp: serverTimestamp(),
    };
    await addDoc(collection(db, 'videos', video.id, 'comments'), newComment);
    setCommentText('');
    showToast?.('Comment added!', 'success');
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000', overflow: 'hidden' }} onDoubleClick={handleDoubleTap}>
      <video ref={videoRef} src={video.videoUrl} loop playsInline autoPlay muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)', pointerEvents: 'none' }} />

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 68, padding: '18px 14px', zIndex: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div onClick={() => onViewProfile?.(video.userId)} style={{ position: 'relative', cursor: 'pointer' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: video.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 16, border: '2px solid rgba(255,255,255,0.4)', overflow: 'hidden' }}>
              {video.photoURL ? <img src={video.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : video.avatar}
            </div>
          </div>
          <span onClick={() => onViewProfile?.(video.userId)} style={{ color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>@{video.username}</span>
          <button onClick={() => onFollow?.(video.userId)} style={{ padding: '5px 14px', borderRadius: 20, background: followed?.includes(video.userId) ? 'transparent' : '#ff2d55', border: followed?.includes(video.userId) ? '1px solid rgba(255,255,255,0.4)' : 'none', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{followed?.includes(video.userId) ? 'Following' : '+ Follow'}</button>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, marginBottom: 6 }}>{video.description}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🎵</span>
          <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{video.song || 'Original sound'}</span>
        </div>
      </div>

      <div style={{ position: 'absolute', right: 10, bottom: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, zIndex: 6 }}>
        <button onClick={() => { if (!liked) { setLiked(true); setLikeCount(p => p + 1); updateDoc(doc(db, 'videos', video.id), { likes: likeCount + 1 }).catch(() => {}); } }} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{liked ? '❤️' : '🤍'}</button>
        <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>{formatNumber(likeCount)}</span>
        <button onClick={() => setShowComments(true)} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 24, cursor: 'pointer' }}>💬</button>
        <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>{formatNumber((video.commentCount || 0) + comments.length)}</span>
        <button onClick={() => { onShare?.(video.id); showToast?.('Share options opened', 'info'); }} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 46, height: 46, fontSize: 24, cursor: 'pointer' }}>↗️</button>
      </div>

      {showComments && (
        <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e1e1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'white', fontWeight: 700 }}>💬 Comments ({comments.length})</span>
            <button onClick={() => setShowComments(false)} style={{ background: '#1a1a1a', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {comments.map(comment => (
              <div key={comment.id} style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: comment.avatarColor || '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', flexShrink: 0, fontSize: 13 }}>{comment.avatar || '?'}</div>
                <div style={{ flex: 1, background: '#161616', borderRadius: 14, padding: '8px 12px' }}>
                  <div style={{ color: '#ff2d55', fontWeight: 600, fontSize: 11 }}>@{comment.username}</div>
                  <p style={{ color: '#ddd', fontSize: 13, marginTop: 4 }}>{comment.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 12px', borderTop: '1px solid #1e1e1e', display: 'flex', gap: 8 }}>
            <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyPress={e => e.key === 'Enter' && addComment()} placeholder="Add a comment..." style={{ flex: 1, background: '#161616', border: '1px solid #222', borderRadius: 20, padding: '9px 14px', color: 'white', outline: 'none', fontSize: 13 }} />
            <button onClick={addComment} style={{ background: '#ff2d55', border: 'none', borderRadius: 20, padding: '8px 18px', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
});

// ============================================
// HOME FEED
// ============================================
const HomeFeed = ({ videos, onLike, onComment, onShare, onFollow, onMessage, onVoiceCall, onVideoCall, followed, showToast, onLive, currentUser, onViewProfile }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState('foryou');
  const categoryVideos = useMemo(() => {
    if (activeCategory === 'following') return videos.filter(v => followed.includes(v.userId));
    return videos;
  }, [videos, activeCategory, followed]);
  const startY = useRef(null);
  
  const handleTouchStart = e => { startY.current = e.touches[0].clientY; };
  const handleTouchEnd = e => {
    if (startY.current === null) return;
    const dy = startY.current - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 50) {
      if (dy > 0) setCurrentIndex(i => Math.min(categoryVideos.length - 1, i + 1));
      else setCurrentIndex(i => Math.max(0, i - 1));
    }
    startY.current = null;
  };
  
  if (!categoryVideos.length) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 48 }}>📭</div>
        <div style={{ color: '#555', textAlign: 'center', padding: 20 }}>{activeCategory === 'following' ? "You're not following anyone yet!" : "No videos yet — be the first to post!"}</div>
      </div>
    );
  }
  
  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div style={{ position: 'absolute', top: 12, left: 0, right: 0, zIndex: 15, display: 'flex', justifyContent: 'center', gap: 6 }}>
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setCurrentIndex(0); if (cat.id === 'live') onLive?.(); }} style={{ background: activeCategory === cat.id ? cat.color : 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 30, padding: '5px 12px', color: 'white', fontSize: 11, fontWeight: activeCategory === cat.id ? 700 : 500, cursor: 'pointer', backdropFilter: 'blur(10px)' }}>
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>
      {categoryVideos.map((video, idx) => (
        <div key={video.id} style={{ position: 'absolute', inset: 0, opacity: idx === currentIndex ? 1 : 0, transform: `translateY(${(idx - currentIndex) * 100}%)`, transition: 'transform 0.3s', pointerEvents: idx === currentIndex ? 'auto' : 'none' }}>
          <EnhancedVideoCard video={video} currentUser={currentUser} onLike={onLike} onComment={onComment} onShare={onShare} onFollow={onFollow} onMessage={onMessage} onVoiceCall={onVoiceCall} onVideoCall={onVideoCall} followed={followed} showToast={showToast} onViewProfile={onViewProfile} />
        </div>
      ))}
    </div>
  );
};

// ============================================
// CONVERSATION VIEW - FIXED with Firebase Storage
// ============================================
const ConversationView = ({ currentUser, otherUser, onBack, showToast }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const messagesEndRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);

  const chatId = getChatId(currentUser?.id, otherUser?.id);

  useEffect(() => {
    if (!chatId) return;
    const unsub = onSnapshot(
      query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp')),
      snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [chatId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => chunksRef.current.push(e.data);
      recorder.onstop = () => { 
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setVoiceBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch { showToast?.('Microphone access denied', 'error'); }
  };

  const stopVoice = () => {
    recorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleFileSelect = e => {
    const file = e.target.files[0];
    if (file) setAttachedFile(file);
  };

  const handleSend = async () => {
    if (!text.trim() && !voiceBlob && !attachedFile) return;
    
    let voiceUrl = null;
    let fileUrl = null;
    
    try {
      // Upload voice to Firebase Storage
      if (voiceBlob) {
        const voiceRef = ref(storage, `chats/${chatId}/voice_${Date.now()}.webm`);
        await uploadBytes(voiceRef, voiceBlob);
        voiceUrl = await getDownloadURL(voiceRef);
      }
      
      // Upload file to Firebase Storage
      if (attachedFile) {
        const fileRef = ref(storage, `chats/${chatId}/file_${Date.now()}_${attachedFile.name}`);
        await uploadBytes(fileRef, attachedFile);
        fileUrl = await getDownloadURL(fileRef);
      }

      await setDoc(doc(db, 'chats', chatId), {
        participants: [currentUser.id, otherUser?.id],
        lastMessage: text || '📎 Attachment',
        lastMessageAt: serverTimestamp(),
      }, { merge: true });

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        from: currentUser.id,
        to: otherUser?.id,
        text: text || '',
        voiceUrl: voiceUrl || null,
        fileUrl: fileUrl || null,
        fileName: attachedFile?.name || null,
        fileType: attachedFile?.type || null,
        timestamp: serverTimestamp(),
        read: false,
      });

      setText('');
      setVoiceBlob(null);
      setAttachedFile(null);
      setShowEmoji(false);
    } catch (err) {
      console.error('Send error:', err);
      showToast?.('Failed to send: ' + err.message, 'error');
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: '#161616', border: 'none', borderRadius: 20, padding: '7px 12px', color: 'white', cursor: 'pointer', fontSize: 13 }}>←</button>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: otherUser?.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', overflow: 'hidden' }}>
          {otherUser?.photoURL ? <img src={otherUser.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : otherUser?.avatar}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'white', fontWeight: 600 }}>@{otherUser?.username}</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && <div style={{ textAlign: 'center', color: '#444', fontSize: 13, marginTop: 40 }}>Say hello to @{otherUser?.username}! 👋</div>}
        {messages.map(msg => {
          const isMe = msg.from === currentUser?.id;
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{ background: isMe ? '#ff2d55' : '#1a1a1a', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', maxWidth: '75%' }}>
                {msg.text && <div style={{ color: 'white', fontSize: 13 }}>{msg.text}</div>}
                {msg.voiceUrl && <audio src={msg.voiceUrl} controls style={{ height: 30, maxWidth: 180 }} />}
                {msg.fileUrl && (
                  msg.fileType?.startsWith('image/') ? 
                    <img src={msg.fileUrl} alt="" style={{ maxWidth: 180, borderRadius: 8, marginTop: msg.text ? 6 : 0 }} /> : 
                    <div style={{ color: '#ddd', fontSize: 11, marginTop: 4 }}>📎 {msg.fileName}</div>
                )}
                <div style={{ color: isMe ? 'rgba(255,255,255,0.5)' : '#444', fontSize: 9, marginTop: 4, textAlign: 'right' }}>
                  {msg.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'sending...'}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      {showEmoji && (
        <div style={{ background: '#161616', padding: 10, display: 'flex', flexWrap: 'wrap', gap: 6, borderTop: '1px solid #222' }}>
          {EMOJI_LIST.map(e => <button key={e} onClick={() => setText(p => p + e)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: 2 }}>{e}</button>)}
        </div>
      )}
      {(voiceBlob || attachedFile) && (
        <div style={{ background: '#161616', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #222' }}>
          {voiceBlob && <><span>🎙️</span><audio src={URL.createObjectURL(voiceBlob)} controls style={{ flex: 1, height: 28 }} /></>}
          {attachedFile && <><span>📎</span><span style={{ color: '#ccc', fontSize: 11, flex: 1 }}>{attachedFile.name}</span></>}
          <button onClick={() => { setVoiceBlob(null); setAttachedFile(null); }} style={{ background: '#333', border: 'none', borderRadius: '50%', width: 22, height: 22, color: 'white', cursor: 'pointer', fontSize: 12 }}>✕</button>
        </div>
      )}
      <div style={{ padding: '10px 12px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={() => setShowEmoji(p => !p)} style={{ background: '#1a1a1a', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 17, cursor: 'pointer' }}>😊</button>
        <button onMouseDown={startVoice} onMouseUp={stopVoice} onTouchStart={startVoice} onTouchEnd={stopVoice} style={{ background: isRecording ? '#ff2d55' : '#1a1a1a', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 17, cursor: 'pointer' }}>🎙️</button>
        <button onClick={() => fileInputRef.current?.click()} style={{ background: '#1a1a1a', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 17, cursor: 'pointer' }}>📎</button>
        <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" onChange={handleFileSelect} style={{ display: 'none' }} />
        <input value={text} onChange={e => setText(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} placeholder="Message..." style={{ flex: 1, background: '#161616', border: '1px solid #222', borderRadius: 22, padding: '9px 14px', color: 'white', outline: 'none', fontSize: 13 }} />
        <button onClick={handleSend} style={{ background: '#ff2d55', border: 'none', borderRadius: '50%', width: 36, height: 36, color: 'white', cursor: 'pointer', fontSize: 17 }}>↑</button>
      </div>
    </div>
  );
};

// ============================================
// INBOX PAGE
// ============================================
const InboxPage = ({ users, currentUser, showToast }) => {
  const [activeConversation, setActiveConversation] = useState(null);
  const [recentChats, setRecentChats] = useState([]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = onSnapshot(
      query(collection(db, 'chats'), where('participants', 'array-contains', currentUser.id)),
      snap => setRecentChats(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [currentUser?.id]);

  if (activeConversation) {
    const otherUser = users.find(u => u.id === activeConversation);
    return <ConversationView currentUser={currentUser} otherUser={otherUser} onBack={() => setActiveConversation(null)} showToast={showToast} />;
  }

  const otherUsers = users.filter(u => u.id !== currentUser?.id);
  const chatUserIds = recentChats.map(c => c.participants.find(p => p !== currentUser.id)).filter(Boolean);
  const orderedUserIds = [...chatUserIds, ...otherUsers.map(u => u.id).filter(id => !chatUserIds.includes(id))];
  const displayUsers = orderedUserIds.map(id => users.find(u => u.id === id)).filter(Boolean);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      <div style={{ padding: '16px 16px', borderBottom: '1px solid #1a1a1a' }}>
        <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>💬 Messages</h2>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {displayUsers.map(u => {
          const chat = recentChats.find(c => c.participants.includes(u.id));
          return (
            <div key={u.id} onClick={() => setActiveConversation(u.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid #111', cursor: 'pointer' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 20, overflow: 'hidden' }}>
                {u.photoURL ? <img src={u.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.avatar}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>@{u.username}</div>
                <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>{chat?.lastMessage || 'Tap to chat'}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// PROFILE PAGE - FIXED with Firebase Storage
// ============================================
const ProfilePage = ({ user, setCurrentUser, onLogout, users, showToast, onShowAnalytics, onShowQRCode }) => {
  const [activeSubPage, setActiveSubPage] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      showToast?.('Photo too large (max 5MB)', 'error');
      return;
    }
    
    setUploadingPhoto(true);
    try {
      showToast?.('Uploading photo...', 'info');
      const storageRef = ref(storage, `users/${user.id}/profile_${Date.now()}.jpg`);
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'users', user.id), { photoURL });
      setCurrentUser(u => ({ ...u, photoURL }));
      showToast?.('Profile picture updated! ✅', 'success');
    } catch (err) {
      console.error('Photo upload error:', err);
      showToast?.('Upload failed: ' + err.message, 'error');
    } finally { 
      setUploadingPhoto(false); 
    }
  };

  if (activeSubPage === 'settings') return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0a0a0a' }}>
      <div style={{ padding: 16 }}>
        <button onClick={() => setActiveSubPage(null)} style={{ background: '#161616', border: 'none', borderRadius: 20, padding: '8px 14px', color: 'white', cursor: 'pointer', fontSize: 12, marginBottom: 16 }}>← Back</button>
        <h2 style={{ color: 'white', marginBottom: 16, fontSize: 20, fontWeight: 700 }}>⚙️ Settings</h2>
        <button onClick={onLogout} style={{ width: '100%', background: '#ff2d55', border: 'none', borderRadius: 24, padding: 14, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>🚪 Log Out</button>
      </div>
    </div>
  );

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#0a0a0a' }}>
      <div style={{ padding: 20, textAlign: 'center', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ position: 'relative', width: 80, margin: '0 auto 12px' }}>
          <div onClick={() => photoInputRef.current?.click()} style={{ width: 80, height: 80, borderRadius: '50%', background: user?.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 32, border: '3px solid #ff2d55', cursor: 'pointer', overflow: 'hidden' }}>
            {user?.photoURL ? <img src={user.photoURL} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user?.avatar}
          </div>
          <div onClick={() => photoInputRef.current?.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, background: '#ff2d55', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12 }}>📷</div>
          <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
          {uploadingPhoto && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11 }}>...</div>}
        </div>
        <div style={{ color: 'white', fontWeight: 700, fontSize: 20 }}>@{user?.username}</div>
        <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>{user?.bio}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginTop: 16 }}>
          <div style={{ textAlign: 'center' }}><div style={{ color: 'white', fontWeight: 700 }}>{user?.followers?.length || 0}</div><div style={{ color: '#666', fontSize: 11 }}>Followers</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ color: 'white', fontWeight: 700 }}>{user?.following?.length || 0}</div><div style={{ color: '#666', fontSize: 11 }}>Following</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ color: '#ffd700', fontWeight: 700 }}>{user?.coins || 500}</div><div style={{ color: '#666', fontSize: 11 }}>Coins 🪙</div></div>
        </div>
        <button onClick={() => setActiveSubPage('settings')} style={{ marginTop: 16, background: '#141414', border: '1px solid #1e1e1e', borderRadius: 24, padding: '8px 24px', color: 'white', cursor: 'pointer' }}>⚙️ Settings</button>
      </div>
    </div>
  );
};

// ============================================
// AUTH SCREEN (simplified)
// ============================================
const AuthScreen = ({ onLogin, onSignup }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');

  const handleSubmit = () => {
    if (!email) { alert('Please enter email'); return; }
    if (!isLogin && (!username || !fullName)) { alert('Please enter all fields'); return; }
    if (isLogin) onLogin(email);
    else onSignup(email, username, fullName);
  };

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'linear-gradient(160deg,#0a0a0a 60%,#120007)' }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 56, marginBottom: 10 }}>🎬</div>
          <h1 style={{ fontSize: 42, fontWeight: 800, background: 'linear-gradient(135deg,#ff2d55,#af52de)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Dagu</h1>
          <p style={{ color: '#555', fontSize: 12, marginTop: 8 }}>{isLogin ? 'Welcome back!' : 'Create your account'}</p>
        </div>
        <div style={{ background: '#141414', borderRadius: 20, padding: 24 }}>
          {!isLogin && (
            <>
              <input placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: 'white', marginBottom: 10, outline: 'none', fontSize: 13, boxSizing: 'border-box' }} />
              <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: 'white', marginBottom: 10, outline: 'none', fontSize: 13, boxSizing: 'border-box' }} />
            </>
          )}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 12, padding: 12, color: 'white', marginBottom: 10, outline: 'none', fontSize: 13, boxSizing: 'border-box' }} />
          <button onClick={handleSubmit} style={{ width: '100%', background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: 24, padding: 14, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>{isLogin ? 'Login' : 'Sign Up'}</button>
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button onClick={() => setIsLogin(!isLogin)} style={{ background: 'none', border: 'none', color: '#ff2d55', fontSize: 13, cursor: 'pointer' }}>{isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN APP
// ============================================
export default function DaguApp() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [videos, setVideos] = useState([]);
  const [stories, setStories] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [toast, setToast] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showCall, setShowCall] = useState(null);
  const [showLiveStream, setShowLiveStream] = useState(null);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [followed, setFollowed] = useState([]);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [storyViewerUser, setStoryViewerUser] = useState(null);

  const showToast = useCallback((message, type = 'info') => setToast({ message, type }), []);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubVideos = onSnapshot(
      query(collection(db, 'videos'), orderBy('createdAt', 'desc')),
      snap => setVideos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const unsubStories = onSnapshot(
      query(collection(db, 'stories'), orderBy('timestamp', 'desc')),
      snap => {
        const now = Date.now();
        const validStories = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => {
            const ts = s.timestamp?.toDate?.() || (s.timestamp instanceof Date ? s.timestamp : new Date(s.timestamp));
            return (now - ts.getTime()) < 24 * 60 * 60 * 1000;
          });
        setStories(validStories);
      }
    );

    return () => { unsubUsers(); unsubVideos(); unsubStories(); };
  }, []);

  useEffect(() => {
    if (currentUser?.following) setFollowed(currentUser.following);
  }, [currentUser?.id]);

  const handleLogin = async (email) => {
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
      if (!snap.empty) {
        const userData = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setCurrentUser(userData);
        setFollowed(userData.following || []);
        showToast(`Welcome back, @${userData.username}! 👋`, 'success');
      } else {
        alert('User not found. Please sign up first.');
      }
    } catch { showToast('Login failed. Try again.', 'error'); }
  };

  const handleSignup = async (email, username, fullName) => {
    try {
      const existing = await getDocs(query(collection(db, 'users'), where('username', '==', username)));
      if (!existing.empty) { showToast('Username already taken', 'error'); return; }
      const newUser = {
        username, email, fullName,
        avatar: username[0].toUpperCase(),
        avatarColor: `hsl(${Math.random() * 360},70%,60%)`,
        verified: false, bio: 'New to Dagu! 🎬',
        followers: [], following: [],
        coins: 500, walletBalance: 0,
        level: 1, streak: 1, subscription: 'free', photoURL: ''
      };
      const newRef = doc(collection(db, 'users'));
      await setDoc(newRef, newUser);
      setCurrentUser({ id: newRef.id, ...newUser });
      setFollowed([]);
      showToast(`Welcome to Dagu, @${username}! 🎉`, 'success');
    } catch { showToast('Signup failed. Try again.', 'error'); }
  };

  const handleLogout = () => { setCurrentUser(null); setFollowed([]); showToast('Logged out', 'info'); };

  const toggleFollow = async (userId) => {
    if (!currentUser?.id) return;
    const isFollowing = followed.includes(userId);
    const newFollowed = isFollowing ? followed.filter(id => id !== userId) : [...followed, userId];
    setFollowed(newFollowed);
    showToast(isFollowing ? 'Unfollowed' : 'Followed! 🎉', 'success');
    await updateDoc(doc(db, 'users', currentUser.id), {
      following: isFollowing ? arrayRemove(userId) : arrayUnion(userId)
    });
    await updateDoc(doc(db, 'users', userId), {
      followers: isFollowing ? arrayRemove(currentUser.id) : arrayUnion(currentUser.id)
    });
    setCurrentUser(u => ({ ...u, following: newFollowed }));
  };

  const handleViewProfile = (userId) => {
    const user = users.find(u => u.id === userId);
    if (user) setViewingProfile(user);
  };

  const handleMessage = (userId) => {
    setActiveTab('inbox');
  };

  const handleViewStory = (user) => {
    const userStories = stories.filter(s => s.userId === user.id);
    if (userStories.length > 0) { setStoryViewerUser(user); setShowStoryViewer(true); }
    else showToast('No stories to view', 'info');
  };

  const storyUserList = [...new Set(stories.map(s => s.userId))].map(uid => users.find(u => u.id === uid)).filter(Boolean);
  const currentStoryIndex = storyUserList.findIndex(u => u?.id === storyViewerUser?.id);

  const goToNextStoryUser = () => {
    if (currentStoryIndex < storyUserList.length - 1) setStoryViewerUser(storyUserList[currentStoryIndex + 1]);
    else { setShowStoryViewer(false); setStoryViewerUser(null); }
  };

  const goToPrevStoryUser = () => {
    if (currentStoryIndex > 0) setStoryViewerUser(storyUserList[currentStoryIndex - 1]);
  };

  if (!currentUser) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <AuthScreen onLogin={handleLogin} onSignup={handleSignup} />
      </div>
    );
  }

  const tabs = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'create', icon: '➕', label: 'Create' },
    { id: 'inbox', icon: '💬', label: 'Inbox' },
    { id: 'profile', icon: '👤', label: 'Profile' },
  ];

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}
        ::-webkit-scrollbar{display:none}
        @keyframes heartBurst{0%{transform:scale(0.4) translateY(0);opacity:1}100%{transform:scale(1.5) translateY(-60px);opacity:0}}
        button:active{transform:scale(0.95)}
      `}</style>

      {showCall && <CallModal type={showCall.type} contactName={showCall.contactName} contactAvatar={showCall.contactAvatar} onClose={() => setShowCall(null)} />}
      {showStoryViewer && storyViewerUser && (
        <StoryViewer stories={stories} user={storyViewerUser} currentUser={currentUser}
          onClose={() => { setShowStoryViewer(false); setStoryViewerUser(null); }}
          onNextUser={goToNextStoryUser} onPrevUser={goToPrevStoryUser}
        />
      )}
      {viewingProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 3000, display: 'flex', alignItems: 'flex-end' }} onClick={() => setViewingProfile(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#0f0f0f', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 90, height: 90, borderRadius: '50%', background: viewingProfile.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 36, margin: '0 auto 12px', overflow: 'hidden' }}>
                {viewingProfile.photoURL ? <img src={viewingProfile.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : viewingProfile.avatar}
              </div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 20 }}>@{viewingProfile.username}</div>
              <div style={{ color: '#888', fontSize: 13, marginTop: 6 }}>{viewingProfile.bio}</div>
            </div>
            <button onClick={() => toggleFollow(viewingProfile.id)} style={{ width: '100%', background: followed.includes(viewingProfile.id) ? '#222' : '#ff2d55', border: followed.includes(viewingProfile.id) ? '1px solid #333' : 'none', borderRadius: 24, padding: '12px', color: 'white', fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
              {followed.includes(viewingProfile.id) ? '✓ Following' : '+ Follow'}
            </button>
            <button onClick={() => { handleMessage(viewingProfile.id); setViewingProfile(null); }} style={{ width: '100%', background: '#222', border: '1px solid #333', borderRadius: 24, padding: '12px', color: 'white', fontWeight: 700, cursor: 'pointer' }}>💬 Message</button>
          </div>
        </div>
      )}

      {/* Stories Row */}
      {activeTab === 'home' && !showStoryViewer && (
        <Stories users={users} stories={stories} currentUser={currentUser} onViewStory={handleViewStory} onAddStory={() => {}} showToast={showToast} />
      )}

      {/* Top Bar */}
      {activeTab !== 'profile' && (
        <div style={{ padding: '10px 14px', background: '#0a0a0a', borderBottom: '1px solid #141414', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ flex: 1, background: '#141414', border: '1px solid #1e1e1e', borderRadius: 24, padding: '9px 14px', color: '#555', fontSize: 13 }}>🔍 Search users, videos...</div>
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        {showCamera && <CameraUpload onUpload={() => {}} onClose={() => setShowCamera(false)} showToast={showToast} currentUser={currentUser} />}

        {!showCamera && (
          <>
            {activeTab === 'home' && (
              <HomeFeed videos={videos} currentUser={currentUser}
                onLike={() => {}} onComment={() => {}} onShare={() => {}}
                onFollow={toggleFollow} onMessage={handleMessage}
                onVoiceCall={uid => { const u = users.find(uu => uu.id === uid); setShowCall({ type: 'audio', contactName: u?.username, contactAvatar: u?.avatar }); }}
                onVideoCall={uid => { const u = users.find(uu => uu.id === uid); setShowCall({ type: 'video', contactName: u?.username, contactAvatar: u?.avatar }); }}
                followed={followed} showToast={showToast}
                onLive={() => setShowLiveStream(currentUser)}
                onViewProfile={handleViewProfile}
              />
            )}
            {activeTab === 'create' && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
                <div style={{ fontSize: 52, marginBottom: 8 }}>🎬</div>
                <div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>Create & Share</div>
                <button onClick={() => setShowCamera(true)} style={{ width: '100%', maxWidth: 280, background: 'linear-gradient(135deg,#ff2d55,#af52de)', border: 'none', borderRadius: 24, padding: '18px 20px', color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>📷 Open Camera</button>
              </div>
            )}
            {activeTab === 'inbox' && (
              <InboxPage users={users} currentUser={currentUser} showToast={showToast} />
            )}
            {activeTab === 'profile' && (
              <ProfilePage user={currentUser} setCurrentUser={setCurrentUser} onLogout={handleLogout} users={users} showToast={showToast} onShowAnalytics={() => {}} onShowQRCode={() => {}} />
            )}
          </>
        )}
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', background: 'rgba(8,8,8,0.97)', borderTop: '1px solid #161616', padding: '8px 4px 18px', flexShrink: 0, backdropFilter: 'blur(12px)' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'create') setShowCamera(true); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}>
            <span style={{ fontSize: tab.id === 'create' ? 26 : 20, transform: activeTab === tab.id ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.15s' }}>{tab.icon}</span>
            <span style={{ fontSize: 10, color: activeTab === tab.id ? '#ff2d55' : '#444', fontWeight: activeTab === tab.id ? 700 : 400 }}>{tab.label}</span>
          </button>
        ))}
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}

// ============================================
// CALL MODAL (simplified)
// ============================================
const CallModal = ({ type, contactName, contactAvatar, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      alert('📞 Call feature coming soon!\n\nFor production, integrate WebRTC with Twilio, Agora, or Daily.co');
      onClose();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);
  
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(160deg,#0d0d0d,#1a0a1a)', zIndex: 2500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: 60 }}>
        <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#FF2D55', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 40, margin: '0 auto 20px' }}>{contactAvatar || '?'}</div>
        <div style={{ color: 'white', fontSize: 24, fontWeight: 700 }}>@{contactName}</div>
        <div style={{ color: '#888', fontSize: 14, marginTop: 8 }}>{type === 'video' ? '📹 Video calling...' : '🎙️ Calling...'}</div>
      </div>
      <button onClick={onClose} style={{ background: '#ff2d55', border: 'none', borderRadius: '50%', width: 64, height: 64, fontSize: 28, cursor: 'pointer' }}>📵</button>
    </div>
  );
};
