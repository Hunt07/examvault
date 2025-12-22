import React, { useState, useMemo, useEffect } from 'react';
import type { User, Resource, ForumPost, Comment, ForumReply, Notification, Conversation, DirectMessage, ResourceRequest, Attachment, Report } from './types';
import { NotificationType, MessageStatus, ResourceRequestStatus } from './types';
import AuthPage from './components/pages/AuthPage';
import DashboardPage from './components/pages/DashboardPage';
import ResourceDetailPage from './components/pages/ResourceDetailPage';
import DiscussionsPage from './components/pages/ForumsPage';
import ForumPostDetailPage from './components/pages/ForumPostDetailPage';
import ProfilePage from './components/pages/ProfilePage';
import MessagesPage from './components/pages/MessagesPage';
import LeaderboardPage from './components/pages/LeaderboardPage';
import ResourceRequestsPage from './components/pages/ResourceRequestsPage';
import AdminPage from './components/pages/AdminPage';
import SideNav from './components/SideNav';
import Header from './components/Header';
import UploadModal, { generateFilePreview } from './components/UploadModal';
import TooltipGuide from './components/TooltipGuide';
import ToastNotification from './components/ToastNotification';
import { extractTextFromDocx, extractTextFromPptx, fileToBase64 } from './services/geminiService';

// Firebase Imports
import { auth, db, storage } from './services/firebase';
import * as firebaseAuth from 'firebase/auth';
import { 
  collection, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, getDocs,
  onSnapshot, query, orderBy, arrayUnion, increment, where, arrayRemove, deleteField, writeBatch 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Loader2, AlertCircle } from 'lucide-react';

export type View = 'dashboard' | 'resourceDetail' | 'discussions' | 'forumDetail' | 'profile' | 'publicProfile' | 'messages' | 'leaderboard' | 'requests' | 'admin';

export const MASTER_ADMIN_EMAILS = ['b09220024@student.unimy.edu.my', 'Osama@unimy.edu.my'];

interface AppContextType {
  user: User | null;
  users: User[];
  resources: Resource[];
  forumPosts: ForumPost[];
  notifications: Notification[];
  conversations: Conversation[];
  directMessages: DirectMessage[];
  resourceRequests: ResourceRequest[];
  reports: Report[];
  view: View;
  setView: (view: View, id?: string, options?: { replace?: boolean }) => void;
  logout: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  userRanks: Map<string, number>;
  savedResourceIds: string[];
  toggleSaveResource: (resourceId: string) => void;
  handleVote: (resourceId: string, action: 'up' | 'down') => void;
  addCommentToResource: (resourceId: string, text: string, parentId: string | null) => void;
  handleCommentVote: (resourceId: string, commentId: string) => void;
  deleteCommentFromResource: (resourceId: string, comment: Comment) => Promise<void>;
  addForumPost: (post: { title: string; courseCode: string; body: string; tags: string[] }, file?: File) => void;
  handlePostVote: (postId: string, action: 'up' | 'down') => void;
  deleteForumPost: (postId: string) => Promise<void>;
  addReplyToPost: (postId: string, text: string, parentId: string | null, file?: File) => void;
  handleReplyVote: (postId: string, replyId: string) => void;
  deleteReplyFromPost: (postId: string, reply: ForumReply) => Promise<void>;
  toggleVerifiedAnswer: (postId: string, replyId: string) => void;
  addResourceRequest: (req: { title: string; courseCode: string; details: string }, file?: File) => void;
  deleteResourceRequest: (requestId: string) => Promise<void>;
  openUploadForRequest: (requestId: string) => void;
  toggleUserSubscription: (userId: string) => void;
  toggleLecturerSubscription: (lecturerName: string) => void;
  toggleCourseCodeSubscription: (courseCode: string) => void;
  updateUserProfile: (data: Partial<User>) => void;
  sendMessage: (conversationId: string, text: string) => void;
  editMessage: (messageId: string, newText: string) => void;
  deleteMessage: (messageId: string) => void;
  startConversation: (userId: string, initialMessage?: string) => void;
  sendDirectMessageToUser: (userId: string, text: string) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearAllNotifications: () => void;
  markMessagesAsRead: (conversationId: string) => void;
  goBack: () => void;
  deleteResource: (resourceId: string, fileUrl: string, previewUrl?: string) => Promise<void>;
  banUser: (userId: string) => Promise<void>;
  unbanUser: (userId: string) => Promise<void>;
  toggleAdminStatus: (userId: string) => Promise<void>;
  updateReportStatus: (reportId: string, status: 'resolved' | 'dismissed') => Promise<void>;
  deleteAccount: () => Promise<void>;
  deactivateAccount: () => Promise<void>;
  hasUnreadMessages: boolean;
  hasUnreadDiscussions: boolean;
  isLoading: boolean;
  areResourcesLoading: boolean;
  scrollTargetId: string | null;
  setScrollTargetId: (id: string | null) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info', points?: number) => void;
}

export const AppContext = React.createContext<AppContextType>({} as AppContextType);

const sanitizeForFirestore = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj));
};

const generateDefaultAvatar = (name: string): string => {
  const initial = name && name.length > 0 ? name.charAt(0).toUpperCase() : '?';
  const colors = ['#2563eb', '#db2777', '#ca8a04', '#16a34a', '#dc2626', '#7c3aed', '#0891b2', '#be123c'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${color}"/><text x="50" y="65" font-family="Arial, sans-serif" font-size="50" font-weight="bold" fill="white" text-anchor="middle">${initial}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svgString.trim())}`;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [areResourcesLoading, setAreResourcesLoading] = useState(true);
  const [view, setViewState] = useState<View>('dashboard');
  const [viewHistory, setViewHistory] = useState<{ view: View; id?: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('examvault_theme');
    if (savedTheme) return savedTheme === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  const [users, setUsers] = useState<User[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [resourceRequests, setResourceRequests] = useState<ResourceRequest[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fulfillingRequest, setFulfillingRequest] = useState<ResourceRequest | undefined>(undefined);
  const [toast, setToast] = useState<{ message: string; points?: number; type?: 'success' | 'error' | 'info' } | null>(null);
  const [runTour, setRunTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', points?: number) => {
      setToast({ message, type, points });
  };

  useEffect(() => {
    if (!auth || !db) { setIsLoading(false); return; }
    const unsubscribe = firebaseAuth.onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userRef = doc(db!, "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data() as User;
            if (MASTER_ADMIN_EMAILS.includes(userData.email) && !userData.isAdmin) {
                await updateDoc(userRef, { isAdmin: true });
            }
            setUser({ ...userData, id: firebaseUser.uid });
          } else {
            const dn = firebaseUser.displayName || "Student";
            const avatar = generateDefaultAvatar(dn);
            const newUser: User = { id: firebaseUser.uid, name: dn, email: firebaseUser.email || "", avatarUrl: avatar, joinDate: new Date().toISOString(), bio: "Student", points: 0, weeklyPoints: 0, uploadCount: 0, course: "Student", currentYear: 1, currentSemester: 1, subscriptions: { users: [], lecturers: [], courseCodes: [] }, savedResourceIds: [], isAdmin: MASTER_ADMIN_EMAILS.includes(firebaseUser.email || '') };
            await setDoc(userRef, newUser);
            setUser(newUser);
          }
        } catch (error) { console.error(error); }
      } else { setUser(null); setViewState('dashboard'); }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    setAreResourcesLoading(true);
    const unsubUsers = onSnapshot(collection(db, "users"), (s) => setUsers(s.docs.map(d => ({ ...d.data(), id: d.id } as User))));
    const unsubResources = onSnapshot(query(collection(db, "resources"), orderBy("uploadDate", "desc")), (s) => { setResources(s.docs.map(d => ({ id: d.id, ...d.data() } as Resource))); setAreResourcesLoading(false); });
    const unsubPosts = onSnapshot(query(collection(db, "forumPosts"), orderBy("timestamp", "desc")), (s) => setForumPosts(s.docs.map(d => ({ id: d.id, ...d.data() } as ForumPost))));
    const unsubRequests = onSnapshot(query(collection(db, "resourceRequests"), orderBy("timestamp", "desc")), (s) => setResourceRequests(s.docs.map(d => ({ id: d.id, ...d.data() } as ResourceRequest))));
    const unsubConvos = onSnapshot(query(collection(db, "conversations"), where("participants", "array-contains", user.id)), (s) => setConversations(s.docs.map(d => ({ id: d.id, ...d.data() } as Conversation))));
    const unsubMessages = onSnapshot(query(collection(db, "directMessages"), orderBy("timestamp", "asc")), (s) => setDirectMessages(s.docs.map(d => ({ id: d.id, ...d.data() } as DirectMessage))));
    const unsubNotifs = onSnapshot(query(collection(db, "notifications"), where("recipientId", "==", user.id)), (s) => setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() } as Notification))));
    const unsubReports = onSnapshot(query(collection(db, "reports"), orderBy("timestamp", "desc")), (s) => setReports(s.docs.map(d => ({ id: d.id, ...d.data() } as Report))));
    return () => { unsubUsers(); unsubResources(); unsubPosts(); unsubRequests(); unsubConvos(); unsubMessages(); unsubNotifs(); unsubReports(); };
  }, [user?.id]);

  const setView = (newView: View, id?: string, options?: { replace?: boolean }) => {
    if (!options?.replace) setViewHistory(prev => [...prev, { view: newView, id }]);
    setViewState(newView); setSelectedId(id); window.scrollTo(0, 0);
  };

  const goBack = () => {
    if (viewHistory.length > 1) {
      const newHistory = [...viewHistory]; newHistory.pop(); 
      const prev = newHistory[newHistory.length - 1];
      setViewHistory(newHistory); setViewState(prev.view); setSelectedId(prev.id);
    } else { setViewState('dashboard'); setSelectedId(undefined); }
  };

  const logout = async () => { if (auth) await firebaseAuth.signOut(auth); setUser(null); setViewState('dashboard'); };

  const earnPoints = async (amount: number, message: string) => {
    if (!user || !db) return;
    await updateDoc(doc(db, "users", user.id), { points: increment(amount), weeklyPoints: increment(amount) });
    setToast({ message, points: amount, type: amount > 0 ? 'success' : 'info' });
  };

  const userRanks = useMemo(() => {
    const sorted = [...users].sort((a, b) => b.points - a.points);
    const ranks = new Map<string, number>();
    sorted.forEach((u, index) => ranks.set(u.id, index));
    return ranks;
  }, [users]);

  const handleUpload = async (resourceData: any, file: File, coverImage: File | null) => {
      if (!user || !db || !storage) { showToast("Upload service unavailable.", "error"); return; }
      setIsUploading(true);
      try {
          // Pre-extract text to avoid CORS issues for AI features
          let extractedText = "";
          let fileBase64Data = "";
          const mimeType = file.type;
          if (mimeType.includes('word')) extractedText = await extractTextFromDocx(file);
          else if (mimeType.includes('presentation')) extractedText = await extractTextFromPptx(file);
          else if (file.size < 1.2 * 1024 * 1024) fileBase64Data = await fileToBase64(file);

          const storageRef = ref(storage, `resources/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(storageRef);

          let previewUrl = coverImage ? await getDownloadURL(ref(storage, `covers/${Date.now()}_${coverImage.name}`)) : generateFilePreview(file.name);
          if (coverImage) await uploadBytes(ref(storage, `covers/${Date.now()}_${coverImage.name}`), coverImage);

          const newResource = { ...resourceData, author: sanitizeForFirestore(user), uploadDate: new Date().toISOString(), upvotes: 0, downvotes: 0, upvotedBy: [], downvotedBy: [], comments: [], fileUrl: downloadURL, fileName: file.name, previewImageUrl: previewUrl, fileBase64: fileBase64Data, extractedText, mimeType, contentForAI: "Content in file..." };
          const docRef = await addDoc(collection(db, "resources"), sanitizeForFirestore(newResource));
          
          if (fulfillingRequest) {
               await updateDoc(doc(db, "resourceRequests", fulfillingRequest.id), { status: ResourceRequestStatus.Fulfilled, fulfillment: { fulfiller: sanitizeForFirestore(user), resourceId: docRef.id, timestamp: new Date().toISOString() } });
               earnPoints(50, "Request fulfilled!");
          } else {
               await updateDoc(doc(db, "users", user.id), { uploadCount: increment(1) });
               earnPoints(25, "Resource uploaded!");
          }
          setIsUploadModalOpen(false);
      } catch (error) { showToast("Upload failed.", "error"); } finally { setIsUploading(false); }
  };

  const deleteResource = async (resourceId: string, fileUrl: string, previewUrl?: string) => {
      if (!user || !db) return;
      setViewState('dashboard');
      try {
          await deleteDoc(doc(db, "resources", resourceId));
          if (storage) {
            if (fileUrl?.startsWith('http')) try { await deleteObject(ref(storage, fileUrl)); } catch(e){}
            if (previewUrl?.includes('firebasestorage')) try { await deleteObject(ref(storage, previewUrl)); } catch(e){}
          }
          earnPoints(-25, "Resource removed.");
      } catch (error) { showToast("Delete failed.", "error"); }
  };

  const handleVote = async (id: string, action: 'up' | 'down') => {
    if (!user || !db) return;
    const res = resources.find(r => r.id === id); if (!res) return;
    const ref = doc(db, "resources", id);
    const isUp = res.upvotedBy?.includes(user.id);
    const isDown = res.downvotedBy?.includes(user.id);
    if (action === 'up') await updateDoc(ref, { upvotes: increment(isUp ? -1 : 1), upvotedBy: isUp ? arrayRemove(user.id) : arrayUnion(user.id), downvotes: isDown ? increment(-1) : increment(0), downvotedBy: isDown ? arrayRemove(user.id) : arrayUnion() });
    else await updateDoc(ref, { downvotes: increment(isDown ? -1 : 1), downvotedBy: isDown ? arrayRemove(user.id) : arrayUnion(user.id), upvotes: isUp ? increment(-1) : increment(0), upvotedBy: isUp ? arrayRemove(user.id) : arrayUnion() });
  };

  const addCommentToResource = async (id: string, text: string, parentId: string | null) => {
    if (!user || !db) return;
    await updateDoc(doc(db, "resources", id), { comments: arrayUnion(sanitizeForFirestore({ id: `c-${Date.now()}`, author: sanitizeForFirestore(user), text, timestamp: new Date().toISOString(), parentId, upvotes: 0, upvotedBy: [] })) });
  };

  const markMessagesAsRead = async (id: string) => { if (user && db) { const unread = directMessages.filter(m => m.conversationId === id && m.recipientId === user.id && m.status !== MessageStatus.Read); if (unread.length) { const b = writeBatch(db); unread.forEach(m => b.update(doc(db!, "directMessages", m.id), { status: MessageStatus.Read })); await b.commit(); } } };

  const appContextValue: AppContextType = {
    user, users, resources, forumPosts, notifications, conversations, directMessages, resourceRequests, reports, view, setView, logout, isDarkMode, toggleDarkMode: () => setIsDarkMode(!isDarkMode),
    userRanks, savedResourceIds: user?.savedResourceIds || [],
    toggleSaveResource: async (id) => user && await updateDoc(doc(db!, "users", user.id), { savedResourceIds: user.savedResourceIds?.includes(id) ? arrayRemove(id) : arrayUnion(id) }),
    handleVote, addCommentToResource,
    handleCommentVote: async (rid, cid) => { if (!user || !db) return; const snap = await getDoc(doc(db!, "resources", rid)); if (snap.exists()) { const upd = snap.data().comments.map((c: any) => c.id === cid ? { ...c, upvotes: c.upvotedBy.includes(user.id) ? c.upvotes - 1 : c.upvotes + 1, upvotedBy: c.upvotedBy.includes(user.id) ? arrayRemove(user.id) : arrayUnion(user.id) } : c); await updateDoc(doc(db!, "resources", rid), { comments: upd }); } },
    deleteCommentFromResource: async (rid, c) => { if (db) await updateDoc(doc(db!, "resources", rid), { comments: arrayRemove(c) }); },
    addForumPost: async (pd) => { if (!user || !db) return; await addDoc(collection(db!, "forumPosts"), sanitizeForFirestore({ ...pd, author: sanitizeForFirestore(user), timestamp: new Date().toISOString(), upvotes: 0, downvotes: 0, upvotedBy: [], downvotedBy: [], replies: [] })); earnPoints(10, "Post created!"); },
    handlePostVote: async (id, action) => { if (!user || !db) return; const p = forumPosts.find(x => x.id === id); if (!p) return; await updateDoc(doc(db!, "forumPosts", id), { upvotes: action === 'up' ? increment(p.upvotedBy.includes(user.id) ? -1 : 1) : increment(0), upvotedBy: action === 'up' ? (p.upvotedBy.includes(user.id) ? arrayRemove(user.id) : arrayUnion(user.id)) : arrayRemove() }); },
    deleteForumPost: async (id) => { if (db) await deleteDoc(doc(db!, "forumPosts", id)); setViewState('discussions'); },
    addReplyToPost: async (id, tx, pi) => { if (!user || !db) return; await updateDoc(doc(db!, "forumPosts", id), { replies: arrayUnion(sanitizeForFirestore({ id: `r-${Date.now()}`, author: sanitizeForFirestore(user), text: tx, timestamp: new Date().toISOString(), upvotes: 0, upvotedBy: [], isVerified: false, parentId: pi })) }); },
    handleReplyVote: async (id, rid) => { if (!user || !db) return; const snap = await getDoc(doc(db!, "forumPosts", id)); if (snap.exists()) { const upd = snap.data().replies.map((r: any) => r.id === rid ? { ...r, upvotes: r.upvotedBy.includes(user.id) ? r.upvotes - 1 : r.upvotes + 1, upvotedBy: r.upvotedBy.includes(user.id) ? arrayRemove(user.id) : arrayUnion(user.id) } : r); await updateDoc(doc(db!, "forumPosts", id), { replies: upd }); } },
    deleteReplyFromPost: async (id, r) => { if (db) await updateDoc(doc(db!, "forumPosts", id), { replies: arrayRemove(r) }); },
    toggleVerifiedAnswer: async (id, rid) => { if (!db) return; const snap = await getDoc(doc(db!, "forumPosts", id)); if (snap.exists()) { const upd = snap.data().replies.map((r: any) => r.id === rid ? { ...r, isVerified: !r.isVerified } : r); await updateDoc(doc(db!, "forumPosts", id), { replies: upd }); } },
    addResourceRequest: async (rd) => { if (!user || !db) return; await addDoc(collection(db!, "resourceRequests"), sanitizeForFirestore({ requester: sanitizeForFirestore(user), timestamp: new Date().toISOString(), status: ResourceRequestStatus.Open, ...rd })); earnPoints(5, "Request posted!"); },
    deleteResourceRequest: async (id) => { if (db) await deleteDoc(doc(db!, "resourceRequests", id)); },
    openUploadForRequest: (id) => { const req = resourceRequests.find(r => r.id === id); if (req) { setFulfillingRequest(req); setIsUploadModalOpen(true); } },
    toggleUserSubscription: async (id) => { if (user && db) await updateDoc(doc(db!, "users", user.id), { "subscriptions.users": user.subscriptions.users.includes(id) ? arrayRemove(id) : arrayUnion(id) }); },
    toggleLecturerSubscription: async (n) => { if (user && db) await updateDoc(doc(db!, "users", user.id), { "subscriptions.lecturers": user.subscriptions.lecturers.includes(n) ? arrayRemove(n) : arrayUnion(n) }); },
    toggleCourseCodeSubscription: async (c) => { if (user && db) await updateDoc(doc(db!, "users", user.id), { "subscriptions.courseCodes": user.subscriptions.courseCodes.includes(c) ? arrayRemove(c) : arrayUnion(c) }); },
    updateUserProfile: async (d) => { if (user && db) await updateDoc(doc(db!, "users", user.id), d); },
    sendMessage: async (id, tx) => { if (user && db) await addDoc(collection(db!, "directMessages"), { conversationId: id, senderId: user.id, text: tx, timestamp: new Date().toISOString(), status: MessageStatus.Sent }); },
    editMessage: async (id, tx) => { if (db) await updateDoc(doc(db!, "directMessages", id), { text: tx }); },
    deleteMessage: async (id) => { if (db) await updateDoc(doc(db!, "directMessages", id), { isDeleted: true }); },
    startConversation: async (uid, msg) => { if (!user || !db) return; const ex = conversations.find(c => c.participants.includes(user.id) && c.participants.includes(uid)); let cid = ex?.id; if (!cid) cid = (await addDoc(collection(db!, "conversations"), { participants: [user.id, uid], lastMessageTimestamp: new Date().toISOString() })).id; if (msg) await addDoc(collection(db!, "directMessages"), { conversationId: cid, senderId: user.id, text: msg, timestamp: new Date().toISOString(), status: MessageStatus.Sent }); setViewState('messages'); setSelectedId(cid); },
    sendDirectMessageToUser: async (uid, tx) => { if (!user || !db) return; const ex = conversations.find(c => c.participants.includes(user.id) && c.participants.includes(uid)); let cid = ex?.id || (await addDoc(collection(db!, "conversations"), { participants: [user.id, uid], lastMessageTimestamp: new Date().toISOString() })).id; await addDoc(collection(db!, "directMessages"), { conversationId: cid, senderId: user.id, text: tx, timestamp: new Date().toISOString(), status: MessageStatus.Sent }); },
    markNotificationAsRead: async (id) => { if (db) await updateDoc(doc(db!, "notifications", id), { isRead: true }); },
    markAllNotificationsAsRead: () => notifications.forEach(n => updateDoc(doc(db!, "notifications", n.id), { isRead: true })),
    clearAllNotifications: async () => { if (user && db) { const sn = await getDocs(query(collection(db!, "notifications"), where("recipientId", "==", user.id))); const b = writeBatch(db!); sn.forEach(d => b.delete(d.ref)); await b.commit(); } },
    markMessagesAsRead, goBack, deleteResource,
    banUser: async (uid) => { if (db) await updateDoc(doc(db!, "users", uid), { status: 'banned' }); },
    unbanUser: async (uid) => { if (db) await updateDoc(doc(db!, "users", uid), { status: 'active' }); },
    toggleAdminStatus: async (uid) => { if (db) { const snap = await getDoc(doc(db!, "users", uid)); if (snap.exists()) await updateDoc(doc(db!, "users", uid), { isAdmin: !(snap.data() as User).isAdmin }); } },
    updateReportStatus: async (id, s) => { if (db) await updateDoc(doc(db!, "reports", id), { status: s }); },
    deleteAccount: async () => { if (user && db) { await deleteDoc(doc(db!, "users", user.id)); await logout(); } },
    deactivateAccount: async () => { if (user && db) { await updateDoc(doc(db!, "users", user.id), { status: 'deactivated' }); await logout(); } },
    hasUnreadMessages: directMessages.some(m => m.recipientId === user?.id && m.status !== MessageStatus.Read),
    hasUnreadDiscussions: false, isLoading, areResourcesLoading, scrollTargetId, setScrollTargetId, showToast
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-bg"><Loader2 size={48} className="animate-spin text-primary-600" /></div>;
  if (!user) return <AuthPage onLogin={() => {}} />;

  return (
    <AppContext.Provider value={appContextValue}>
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg transition-colors duration-300">
        <Header onUploadClick={() => { setFulfillingRequest(undefined); setIsUploadModalOpen(true); }} />
        <SideNav />
        <main className="ml-20 pt-4 px-4 md:px-8 pb-8 min-h-screen">
          {view === 'dashboard' && <DashboardPage />}
          {view === 'resourceDetail' && selectedId && <ResourceDetailPage resource={resources.find(r => r.id === selectedId) || resources[0]} />}
          {view === 'discussions' && <DiscussionsPage />}
          {view === 'forumDetail' && selectedId && <ForumPostDetailPage post={forumPosts.find(p => p.id === selectedId) || forumPosts[0]} />}
          {view === 'profile' && user && <ProfilePage user={user} allResources={resources} isCurrentUser={true} />}
          {view === 'publicProfile' && selectedId && <ProfilePage user={users.find(u => u.id === selectedId) || user} allResources={resources} isCurrentUser={selectedId === user.id} />}
          {view === 'messages' && <MessagesPage activeConversationId={selectedId || null} />}
          {view === 'leaderboard' && <LeaderboardPage />}
          {view === 'requests' && <ResourceRequestsPage />}
          {view === 'admin' && <AdminPage />}
        </main>
        {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} onUpload={handleUpload} fulfillingRequest={fulfillingRequest} isLoading={isUploading} />}
        {toast && <ToastNotification message={toast.message} points={toast.points} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </AppContext.Provider>
  );
};
export default App;