
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { User, Resource, ForumPost, Comment, ForumReply, Notification, Conversation, DirectMessage, ResourceRequest, Report } from './types';
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

// Firebase Imports
import { auth, db, storage } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  collection, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, getDocs,
  onSnapshot, query, orderBy, arrayUnion, increment, where, arrayRemove, writeBatch 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2 } from 'lucide-react';

export type View = 'dashboard' | 'resourceDetail' | 'discussions' | 'forumDetail' | 'profile' | 'publicProfile' | 'messages' | 'leaderboard' | 'requests' | 'admin';

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
  addForumPost: (post: { title: string; courseCode: string; body: string; tags: string[] }) => void;
  handlePostVote: (postId: string, action: 'up' | 'down') => void;
  deleteForumPost: (postId: string) => Promise<void>;
  addReplyToPost: (postId: string, text: string, parentId: string | null, file?: File) => void;
  handleReplyVote: (postId: string, replyId: string) => void;
  deleteReplyFromPost: (postId: string, reply: ForumReply) => Promise<void>;
  toggleVerifiedAnswer: (postId: string, replyId: string) => void;
  addResourceRequest: (req: { title: string; courseCode: string; details: string }) => void;
  deleteResourceRequest: (requestId: string) => Promise<void>;
  openUploadForRequest: (requestId: string) => void;
  toggleUserSubscription: (userId: string) => void;
  toggleLecturerSubscription: (lecturerName: string) => void;
  toggleCourseCodeSubscription: (courseCode: string) => void;
  updateUserProfile: (data: Partial<User>) => void;
  deleteAccount: () => Promise<void>;
  deactivateAccount: () => Promise<void>;
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
  hasUnreadMessages: boolean;
  hasUnreadDiscussions: boolean;
  isLoading: boolean;
  areResourcesLoading: boolean;
  scrollTargetId: string | null;
  setScrollTargetId: (id: string | null) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info', points?: number) => void;
  banUser: (userId: string) => Promise<void>;
  unbanUser: (userId: string) => Promise<void>;
  toggleAdminStatus: (userId: string) => Promise<void>;
  updateReportStatus: (reportId: string, status: 'resolved' | 'dismissed') => Promise<void>;
}

export const AppContext = React.createContext<AppContextType>({} as AppContextType);

const sanitizeForFirestore = (obj: any): any => JSON.parse(JSON.stringify(obj));

const generateDefaultAvatar = (name: string): string => {
  const initial = name && name.length > 0 ? name.charAt(0).toUpperCase() : '?';
  const colors = ['#2563eb', '#db2777', '#ca8a04', '#16a34a', '#dc2626', '#7c3aed', '#0891b2', '#be123c'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const color = colors[Math.abs(hash) % colors.length];
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="${color}"/><text x="50" y="65" font-family="Arial, sans-serif" font-size="50" font-weight="bold" fill="white" text-anchor="middle">${initial}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svgString.trim())}`;
};

export const MASTER_ADMIN_EMAILS = ['b09220024@student.unimy.edu.my'];

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [areResourcesLoading, setAreResourcesLoading] = useState(true);
  const [view, setViewState] = useState<View>('dashboard');
  const [viewHistory, setViewHistory] = useState<{ view: View; id?: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);
  const isExiting = useRef(false);

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
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('examvault_theme') === 'dark');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', points?: number) => setToast({ message, type, points });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('examvault_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('examvault_theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (!auth || !db) { setIsLoading(false); return; }
    let unsubUserDoc: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (isExiting.current) return;
      if (firebaseUser) {
        unsubUserDoc = onSnapshot(doc(db!, "users", firebaseUser.uid), async (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as User;
            if (userData.status === 'banned') {
               showToast("This account has been banned.", "error");
               await signOut(auth);
               setUser(null);
            } else if (userData.status === 'deactivated') {
              const hasLoginIntent = sessionStorage.getItem('examvault_login_intent') === 'true';
              if (hasLoginIntent) {
                await updateDoc(doc(db!, "users", firebaseUser.uid), { status: 'active' });
                sessionStorage.removeItem('examvault_login_intent');
                showToast("Account reactivated!", "success");
              } else {
                await signOut(auth);
                setUser(null);
              }
            } else {
                const isMaster = MASTER_ADMIN_EMAILS.includes(firebaseUser.email || '');
                if (isMaster && !userData.isAdmin) await updateDoc(doc(db!, "users", firebaseUser.uid), { isAdmin: true });
                setUser({ ...userData, id: docSnap.id });
            }
          } else {
            const displayName = firebaseUser.displayName || "Student";
            const newUser: User = {
              id: firebaseUser.uid, name: displayName, email: firebaseUser.email || "",
              avatarUrl: generateDefaultAvatar(displayName), joinDate: new Date().toISOString(),
              bio: "Academic explorer on ExamVault.", points: 0, weeklyPoints: 0, uploadCount: 0,
              course: "General", currentYear: 1, currentSemester: 1,
              subscriptions: { users: [], lecturers: [], courseCodes: [] }, savedResourceIds: [],
              status: 'active', isAdmin: MASTER_ADMIN_EMAILS.includes(firebaseUser.email || '')
            };
            await setDoc(doc(db!, "users", firebaseUser.uid), newUser);
          }
          setIsLoading(false);
        });
      } else { 
        setUser(null); 
        setViewState('dashboard'); 
        setIsLoading(false);
      }
    });
    return () => { unsubscribeAuth(); if (unsubUserDoc) unsubUserDoc(); };
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    setAreResourcesLoading(true);
    
    const unsubUsers = onSnapshot(collection(db, "users"), (s) => setUsers(s.docs.map(d => ({ ...d.data(), id: d.id } as User))));
    const unsubResources = onSnapshot(query(collection(db, "resources"), orderBy("uploadDate", "desc")), (s) => {
      setResources(s.docs.map(d => ({ id: d.id, ...d.data() } as Resource)));
      setAreResourcesLoading(false);
    });
    const unsubPosts = onSnapshot(query(collection(db, "forumPosts"), orderBy("timestamp", "desc")), (s) => setForumPosts(s.docs.map(d => ({ id: d.id, ...d.data() } as ForumPost))));
    const unsubRequests = onSnapshot(query(collection(db, "resourceRequests"), orderBy("timestamp", "desc")), (s) => setResourceRequests(s.docs.map(d => ({ id: d.id, ...d.data() } as ResourceRequest))));
    const unsubConvos = onSnapshot(query(collection(db, "conversations"), where("participants", "array-contains", user.id)), (s) => setConversations(s.docs.map(d => ({ id: d.id, ...d.data() } as Conversation))));
    const unsubMessages = onSnapshot(query(collection(db, "directMessages"), orderBy("timestamp", "asc")), (s) => setDirectMessages(s.docs.map(d => ({ id: d.id, ...d.data() } as DirectMessage))));
    const unsubNotifs = onSnapshot(query(collection(db, "notifications"), where("recipientId", "==", user.id)), (s) => setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() } as Notification))));
    
    let unsubReports = () => {};
    if (user.isAdmin) {
        unsubReports = onSnapshot(query(collection(db, "reports"), orderBy("timestamp", "desc")), (s) => setReports(s.docs.map(d => ({ id: d.id, ...d.data() } as Report))));
    }
    return () => { unsubUsers(); unsubResources(); unsubPosts(); unsubRequests(); unsubConvos(); unsubMessages(); unsubNotifs(); unsubReports(); };
  }, [user?.id, user?.isAdmin]);

  const setView = (newView: View, id?: string, options?: { replace?: boolean }) => {
    if (!options?.replace) setViewHistory(prev => [...prev, { view: newView, id }]);
    setViewState(newView); setSelectedId(id); window.scrollTo(0, 0);
  };

  const appContextValue: AppContextType = {
    user, users, resources, forumPosts, notifications, conversations, directMessages, resourceRequests, reports, view, setView, 
    logout: async () => { isExiting.current = true; if (auth) await signOut(auth); setUser(null); },
    isDarkMode, toggleDarkMode: () => setIsDarkMode(!isDarkMode), userRanks: new Map(users.map((u, i) => [u.id, i])), savedResourceIds: user?.savedResourceIds || [],
    toggleSaveResource: async (id) => user && await updateDoc(doc(db!, "users", user.id), { savedResourceIds: user.savedResourceIds?.includes(id) ? arrayRemove(id) : arrayUnion(id) }),
    handleVote: async (id, act) => {
        const r = resources.find(x => x.id === id); if (!r || !user) return;
        const isUp = r.upvotedBy?.includes(user.id);
        await updateDoc(doc(db!, "resources", id), { upvotes: isUp ? increment(-1) : increment(1), upvotedBy: isUp ? arrayRemove(user.id) : arrayUnion(user.id) });
    },
    addCommentToResource: async (resId, text, pId) => await updateDoc(doc(db!, "resources", resId), { comments: arrayUnion({ id: `c-${Date.now()}`, author: sanitizeForFirestore(user), text, timestamp: new Date().toISOString(), parentId: pId, upvotes: 0, upvotedBy: [] }) }),
    handleCommentVote: async (resId, cId) => {
      const snap = await getDoc(doc(db!, "resources", resId));
      if (snap.exists()) {
        const upds = (snap.data().comments as Comment[]).map(c => c.id === cId ? { ...c, upvotes: c.upvotedBy.includes(user!.id) ? c.upvotes - 1 : c.upvotes + 1, upvotedBy: c.upvotedBy.includes(user!.id) ? arrayRemove(user!.id) : arrayUnion(user!.id) } : c);
        await updateDoc(doc(db!, "resources", resId), { comments: upds });
      }
    },
    deleteCommentFromResource: async (resId, comment) => await updateDoc(doc(db!, "resources", resId), { comments: arrayRemove(comment) }),
    addForumPost: async (post) => {
      await addDoc(collection(db!, "forumPosts"), { ...post, author: sanitizeForFirestore(user), timestamp: new Date().toISOString(), upvotes: 0, downvotes: 0, upvotedBy: [], downvotedBy: [], replies: [] });
      showToast("Post created!", "success", 10);
    },
    handlePostVote: async (id, act) => {
        const p = forumPosts.find(x => x.id === id); if (!p || !user) return;
        const isUp = p.upvotedBy?.includes(user.id);
        await updateDoc(doc(db!, "forumPosts", id), { upvotes: isUp ? increment(-1) : increment(1), upvotedBy: isUp ? arrayRemove(user.id) : arrayUnion(user.id) });
    },
    deleteForumPost: async (id) => { setViewState('discussions'); if (db) await deleteDoc(doc(db!, "forumPosts", id)); },
    addReplyToPost: async (id, text, pId) => await updateDoc(doc(db!, "forumPosts", id), { replies: arrayUnion({ id: `r-${Date.now()}`, author: sanitizeForFirestore(user), text, timestamp: new Date().toISOString(), upvotes: 0, upvotedBy: [], isVerified: false, parentId: pId }) }),
    handleReplyVote: async (pId, rId) => {
      const snap = await getDoc(doc(db!, "forumPosts", pId));
      if (snap.exists()) {
        const upds = (snap.data().replies as ForumReply[]).map(r => r.id === rId ? { ...r, upvotes: r.upvotedBy.includes(user!.id) ? r.upvotes - 1 : r.upvotes + 1, upvotedBy: r.upvotedBy.includes(user!.id) ? arrayRemove(user!.id) : arrayUnion(user!.id) } : r);
        await updateDoc(doc(db!, "forumPosts", pId), { replies: upds });
      }
    },
    deleteReplyFromPost: async (pId, r) => await updateDoc(doc(db!, "forumPosts", pId), { replies: arrayRemove(r) }),
    toggleVerifiedAnswer: async (pId, rId) => {
      const snap = await getDoc(doc(db!, "forumPosts", pId));
      if (snap.exists()) {
        const upds = (snap.data().replies as ForumReply[]).map(r => r.id === rId ? { ...r, isVerified: !r.isVerified } : r);
        await updateDoc(doc(db!, "forumPosts", pId), { replies: upds });
      }
    },
    addResourceRequest: async (req) => await addDoc(collection(db!, "resourceRequests"), { ...req, requester: sanitizeForFirestore(user), status: ResourceRequestStatus.Open, timestamp: new Date().toISOString() }),
    deleteResourceRequest: async (id) => await deleteDoc(doc(db!, "resourceRequests", id)),
    openUploadForRequest: (id) => { const r = resourceRequests.find(x => x.id === id); if (r) { setFulfillingRequest(r); setIsUploadModalOpen(true); } },
    toggleUserSubscription: async (id) => user && await updateDoc(doc(db!, "users", user.id), { "subscriptions.users": user.subscriptions?.users?.includes(id) ? arrayRemove(id) : arrayUnion(id) }),
    toggleLecturerSubscription: async (n) => user && await updateDoc(doc(db!, "users", user.id), { "subscriptions.lecturers": user.subscriptions?.lecturers?.includes(n) ? arrayRemove(n) : arrayUnion(n) }),
    toggleCourseCodeSubscription: async (c) => user && await updateDoc(doc(db!, "users", user.id), { "subscriptions.courseCodes": user.subscriptions?.courseCodes?.includes(c) ? arrayRemove(c) : arrayUnion(c) }),
    updateUserProfile: async (d) => user && await updateDoc(doc(db!, "users", user.id), d),
    deleteAccount: async () => user && await deleteDoc(doc(db!, "users", user.id)), 
    deactivateAccount: async () => user && await updateDoc(doc(db!, "users", user.id), { status: 'deactivated' }),
    sendMessage: async (id, text) => user && await addDoc(collection(db!, "directMessages"), { conversationId: id, senderId: user.id, text, timestamp: new Date().toISOString(), status: MessageStatus.Sent }),
    editMessage: async (id, text) => await updateDoc(doc(db!, "directMessages", id), { text }),
    deleteMessage: async (id) => await updateDoc(doc(db!, "directMessages", id), { isDeleted: true }),
    startConversation: async (uid, msg) => { if (user && db) { const dr = await addDoc(collection(db!, "conversations"), { participants: [user.id, uid], lastMessageTimestamp: new Date().toISOString() }); if (msg) await addDoc(collection(db!, "directMessages"), { conversationId: dr.id, senderId: user.id, text: msg, timestamp: new Date().toISOString(), status: MessageStatus.Sent }); setView('messages', dr.id); } },
    sendDirectMessageToUser: (id, text) => user && addDoc(collection(db!, "directMessages"), { recipientId: id, senderId: user.id, text, timestamp: new Date().toISOString(), status: MessageStatus.Sent }),
    markNotificationAsRead: async (id) => await updateDoc(doc(db!, "notifications", id), { isRead: true }),
    markAllNotificationsAsRead: async () => notifications.forEach(n => updateDoc(doc(db!, "notifications", n.id), { isRead: true })),
    clearAllNotifications: async () => { if (!user) return; const sn = await getDocs(query(collection(db!, "notifications"), where("recipientId", "==", user.id))); const b = writeBatch(db!); sn.forEach(d => b.delete(d.ref)); await b.commit(); },
    markMessagesAsRead: async (id) => { if (!user) return; const unread = directMessages.filter(m => m.conversationId === id && m.recipientId === user.id && m.status !== MessageStatus.Read); if (unread.length) { const b = writeBatch(db!); unread.forEach(m => b.update(doc(db!, "directMessages", m.id), { status: MessageStatus.Read })); await b.commit(); } },
    goBack: () => { if (viewHistory.length > 1) { const newHistory = [...viewHistory]; newHistory.pop(); const prev = newHistory[newHistory.length-1]; setViewState(prev.view); setSelectedId(prev.id); setViewHistory(newHistory); } else setViewState('dashboard'); },
    deleteResource: async (id, fileUrl, previewUrl) => { setViewState('dashboard'); if (db) await deleteDoc(doc(db!, "resources", id)); },
    hasUnreadMessages: directMessages.some(m => m.recipientId === user?.id && m.status !== MessageStatus.Read), 
    hasUnreadDiscussions: false, isLoading, areResourcesLoading, scrollTargetId, setScrollTargetId, showToast,
    banUser: async (uId) => user?.isAdmin && await updateDoc(doc(db!, "users", uId), { status: 'banned' }),
    unbanUser: async (uId) => user?.isAdmin && await updateDoc(doc(db!, "users", uId), { status: 'active' }),
    toggleAdminStatus: async (uId) => {
        if (!user?.isAdmin) return;
        const target = users.find(u => u.id === uId);
        if (!target) return;
        await updateDoc(doc(db!, "users", uId), { isAdmin: !target.isAdmin });
    },
    updateReportStatus: async (rId, status) => user?.isAdmin && await updateDoc(doc(db!, "reports", rId), { status }),
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-bg"><Loader2 size={48} className="animate-spin text-primary-600" /></div>;
  if (!user) return <AuthPage onLogin={() => {}} />;

  const currentResource = resources.find(r => r.id === selectedId);
  const currentForumPost = forumPosts.find(p => p.id === selectedId);

  return (
    <AppContext.Provider value={appContextValue}>
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg transition-colors duration-300">
        <Header onUploadClick={() => { setFulfillingRequest(undefined); setIsUploadModalOpen(true); }} />
        <SideNav />
        <main className="ml-20 pt-4 px-4 md:px-8 pb-8 min-h-screen">
          {view === 'dashboard' && <DashboardPage />}
          {view === 'resourceDetail' && selectedId && currentResource && <ResourceDetailPage resource={currentResource} />}
          {view === 'discussions' && <DiscussionsPage />}
          {view === 'forumDetail' && selectedId && currentForumPost && <ForumPostDetailPage post={currentForumPost} />}
          {view === 'profile' && <ProfilePage user={user} allResources={resources} isCurrentUser={true} />}
          {view === 'publicProfile' && selectedId && <ProfilePage user={users.find(u => u.id === selectedId) || user} allResources={resources} isCurrentUser={selectedId === user.id} />}
          {view === 'messages' && <MessagesPage activeConversationId={selectedId || null} />}
          {view === 'leaderboard' && <LeaderboardPage />}
          {view === 'requests' && <ResourceRequestsPage />}
          {view === 'admin' && user.isAdmin && <AdminPage />}
        </main>
        {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} onUpload={async (d, f, c) => {
            if (!user || !db || !storage) return;
            setIsUploading(true);
            try {
                const sRef = ref(storage, `res/${Date.now()}_${f.name}`);
                await uploadBytes(sRef, f);
                const dUrl = await getDownloadURL(sRef);
                const pUrl = c ? await getDownloadURL(ref(storage, `cv/${Date.now()}_${c.name}`)) : generateFilePreview(f.name);
                const nRes = { ...d, author: sanitizeForFirestore(user), uploadDate: new Date().toISOString(), upvotes: 0, downvotes: 0, upvotedBy: [], downvotedBy: [], comments: [], fileUrl: dUrl, fileName: f.name, previewImageUrl: pUrl, mimeType: f.type };
                const dRef = await addDoc(collection(db!, "resources"), sanitizeForFirestore(nRes));
                if (fulfillingRequest) await updateDoc(doc(db!, "resourceRequests", fulfillingRequest.id), { status: ResourceRequestStatus.Fulfilled, fulfillment: { fulfiller: sanitizeForFirestore(user), resourceId: dRef.id, timestamp: new Date().toISOString() } });
                showToast("Uploaded successfully!", "success", fulfillingRequest ? 50 : 25);
                setIsUploadModalOpen(false);
            } catch (e) { showToast("Upload failed", "error"); } finally { setIsUploading(false); }
        }} isLoading={isUploading} fulfillingRequest={fulfillingRequest} />}
        {toast && <ToastNotification message={toast.message} points={toast.points} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </AppContext.Provider>
  );
};
export default App;
