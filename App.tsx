
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { User, Resource, ForumPost, Comment, ForumReply, Notification, Conversation, DirectMessage, ResourceRequest, Report, Attachment } from './types';
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
import ToastNotification from './components/ToastNotification';
import { extractTextFromDocx, extractTextFromPptx, fileToBase64 } from './services/geminiService';

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
  addCommentToResource: (resourceId: string, text: string, parentId: string | null, attachment?: Attachment) => void;
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

  const [rawUsers, setRawUsers] = useState<User[]>([]);
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

  const users = useMemo(() => {
    const emailMap = new Map<string, User>();
    rawUsers.forEach(u => {
      const emailKey = u.email.toLowerCase();
      const existing = emailMap.get(emailKey);
      if (!existing || u.id === user?.id || u.points > existing.points) emailMap.set(emailKey, u);
    });
    return Array.from(emailMap.values());
  }, [rawUsers, user?.id]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', points?: number) => setToast({ message, type, points });

  useEffect(() => {
    if (isDarkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('examvault_theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('examvault_theme', 'light'); }
  }, [isDarkMode]);

  useEffect(() => {
    if (!auth || !db) { setIsLoading(false); return; }
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (isExiting.current) return;
      if (firebaseUser) {
        onSnapshot(doc(db!, "users", firebaseUser.uid), async (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as User;
            if (userData.status === 'banned') { showToast("Banned account", "error"); await signOut(auth); setUser(null); }
            else if (userData.status === 'deactivated') {
              if (sessionStorage.getItem('examvault_login_intent') === 'true') {
                await updateDoc(doc(db!, "users", firebaseUser.uid), { status: 'active' });
                sessionStorage.removeItem('examvault_login_intent');
                showToast("Welcome back!", "success");
              } else { await signOut(auth); setUser(null); }
            } else {
              if (MASTER_ADMIN_EMAILS.includes(firebaseUser.email || '') && !userData.isAdmin) await updateDoc(doc(db!, "users", firebaseUser.uid), { isAdmin: true });
              setUser({ ...userData, id: docSnap.id });
            }
          } else {
            const dn = firebaseUser.displayName || "Student";
            const nu: User = { id: firebaseUser.uid, name: dn, email: firebaseUser.email || "", avatarUrl: generateDefaultAvatar(dn), joinDate: new Date().toISOString(), bio: "Student", points: 0, weeklyPoints: 0, uploadCount: 0, course: "General", currentYear: 1, currentSemester: 1, subscriptions: { users: [], lecturers: [], courseCodes: [] }, savedResourceIds: [], status: 'active', isAdmin: MASTER_ADMIN_EMAILS.includes(firebaseUser.email || '') };
            await setDoc(doc(db!, "users", firebaseUser.uid), nu);
          }
          setIsLoading(false);
        });
      } else { setUser(null); setViewState('dashboard'); setIsLoading(false); }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    setAreResourcesLoading(true);
    const unsubUsers = onSnapshot(collection(db, "users"), (s) => setRawUsers(s.docs.map(d => ({ ...d.data(), id: d.id } as User))));
    const unsubResources = onSnapshot(query(collection(db, "resources"), orderBy("uploadDate", "desc")), (s) => { setResources(s.docs.map(d => ({ id: d.id, ...d.data() } as Resource))); setAreResourcesLoading(false); });
    const unsubPosts = onSnapshot(query(collection(db, "forumPosts"), orderBy("timestamp", "desc")), (s) => setForumPosts(s.docs.map(d => ({ id: d.id, ...d.data() } as ForumPost))));
    const unsubRequests = onSnapshot(query(collection(db, "resourceRequests"), orderBy("timestamp", "desc")), (s) => setResourceRequests(s.docs.map(d => ({ id: d.id, ...d.data() } as ResourceRequest))));
    const unsubConvos = onSnapshot(query(collection(db, "conversations"), where("participants", "array-contains", user.id)), (s) => setConversations(s.docs.map(d => ({ id: d.id, ...d.data() } as Conversation))));
    const unsubMessages = onSnapshot(query(collection(db, "directMessages"), orderBy("timestamp", "asc")), (s) => setDirectMessages(s.docs.map(d => ({ id: d.id, ...d.data() } as DirectMessage))));
    const unsubNotifs = onSnapshot(query(collection(db, "notifications"), where("recipientId", "==", user.id)), (s) => setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() } as Notification))));
    let unsubReports = () => {};
    if (user.isAdmin) unsubReports = onSnapshot(query(collection(db, "reports"), orderBy("timestamp", "desc")), (s) => setReports(s.docs.map(d => ({ id: d.id, ...d.data() } as Report))));
    return () => { unsubUsers(); unsubResources(); unsubPosts(); unsubRequests(); unsubConvos(); unsubMessages(); unsubNotifs(); unsubReports(); };
  }, [user?.id, user?.isAdmin]);

  const earnPoints = async (uid: string, amt: number, msg: string) => {
    if (!db) return;
    await updateDoc(doc(db, "users", uid), { points: increment(amt), weeklyPoints: increment(amt) });
    if (uid === user?.id) showToast(msg, amt > 0 ? 'success' : 'info', amt);
  };

  const appContextValue: AppContextType = {
    user, users, resources, forumPosts, notifications, conversations, directMessages, resourceRequests, reports, view, setView: (v, id, o) => { if (!o?.replace) setViewHistory(p => [...p, { view: v, id }]); setViewState(v); setSelectedId(id); window.scrollTo(0, 0); },
    logout: async () => { isExiting.current = true; if (auth) await signOut(auth); setUser(null); },
    isDarkMode, toggleDarkMode: () => setIsDarkMode(!isDarkMode),
    userRanks: new Map(users.sort((a,b) => b.points - a.points).map((u, i) => [u.id, i])),
    savedResourceIds: user?.savedResourceIds || [],
    toggleSaveResource: async (id) => user && await updateDoc(doc(db!, "users", user.id), { savedResourceIds: user.savedResourceIds?.includes(id) ? arrayRemove(id) : arrayUnion(id) }),
    handleVote: async (id, action) => {
      const resource = resources.find(x => x.id === id); if (!resource || !user || !db) return;
      const resRef = doc(db, "resources", id);
      if (action === 'up') await updateDoc(resRef, { upvotes: increment(resource.upvotedBy?.includes(user.id) ? -1 : 1), upvotedBy: resource.upvotedBy?.includes(user.id) ? arrayRemove(user.id) : arrayUnion(user.id) });
      else await updateDoc(resRef, { downvotes: increment(resource.downvotedBy?.includes(user.id) ? -1 : 1), downvotedBy: resource.downvotedBy?.includes(user.id) ? arrayRemove(user.id) : arrayUnion(user.id) });
    },
    addCommentToResource: async (rid, txt, pid, attachment) => {
      if (!user || !db) return;
      await updateDoc(doc(db!, "resources", rid), { comments: arrayUnion(sanitizeForFirestore({ id: `c-${Date.now()}`, author: user, text: txt, timestamp: new Date().toISOString(), parentId: pid, upvotes: 0, upvotedBy: [], attachment: attachment || null })) });
    },
    handleCommentVote: async (rid, cid) => {
        const snap = await getDoc(doc(db!, "resources", rid));
        if (snap.exists() && user) {
            const upds = (snap.data().comments as Comment[]).map(c => c.id === cid ? { ...c, upvotes: c.upvotedBy.includes(user.id) ? c.upvotes - 1 : c.upvotes + 1, upvotedBy: c.upvotedBy.includes(user.id) ? arrayRemove(user.id) : arrayUnion(user.id) } : c);
            await updateDoc(doc(db!, "resources", rid), { comments: upds });
        }
    },
    deleteCommentFromResource: async (rid, c) => await updateDoc(doc(db!, "resources", rid), { comments: arrayRemove(c) }),
    addForumPost: async (p) => { await addDoc(collection(db!, "forumPosts"), { ...p, author: sanitizeForFirestore(user), timestamp: new Date().toISOString(), upvotes: 0, downvotes: 0, upvotedBy: [], downvotedBy: [], replies: [] }); if (user) earnPoints(user.id, 10, "Post created!"); },
    handlePostVote: async (id) => { const p = forumPosts.find(x => x.id === id); if (!p || !user) return; await updateDoc(doc(db!, "forumPosts", id), { upvotes: increment(p.upvotedBy?.includes(user.id) ? -1 : 1), upvotedBy: p.upvotedBy?.includes(user.id) ? arrayRemove(user.id) : arrayUnion(user.id) }); },
    deleteForumPost: async (id) => { const p = forumPosts.find(x => x.id === id); setViewState('discussions'); if (db) { await deleteDoc(doc(db!, "forumPosts", id)); if (p) earnPoints(p.author.id, -10, "Post deleted"); } },
    addReplyToPost: async (id, txt, pid) => await updateDoc(doc(db!, "forumPosts", id), { replies: arrayUnion(sanitizeForFirestore({ id: `r-${Date.now()}`, author: user, text: txt, timestamp: new Date().toISOString(), upvotes: 0, upvotedBy: [], isVerified: false, parentId: pid })) }),
    handleReplyVote: async (id, rid) => {
        const snap = await getDoc(doc(db!, "forumPosts", id));
        if (snap.exists() && user) {
            const upds = (snap.data().replies as ForumReply[]).map(r => r.id === rid ? { ...r, upvotes: r.upvotedBy.includes(user.id) ? r.upvotes - 1 : r.upvotes + 1, upvotedBy: r.upvotedBy.includes(user.id) ? arrayRemove(user.id) : arrayUnion(user.id) } : r);
            await updateDoc(doc(db!, "forumPosts", id), { replies: upds });
        }
    },
    deleteReplyFromPost: async (id, r) => await updateDoc(doc(db!, "forumPosts", id), { replies: arrayRemove(r) }),
    toggleVerifiedAnswer: async (id, rid) => {
        const snap = await getDoc(doc(db!, "forumPosts", id));
        if (snap.exists()) {
            const upds = (snap.data().replies as ForumReply[]).map(r => r.id === rid ? { ...r, isVerified: !r.isVerified } : r);
            await updateDoc(doc(db!, "forumPosts", id), { replies: upds });
        }
    },
    addResourceRequest: async (q) => { await addDoc(collection(db!, "resourceRequests"), { ...q, requester: sanitizeForFirestore(user), status: ResourceRequestStatus.Open, timestamp: new Date().toISOString() }); if (user) earnPoints(user.id, 5, "Request submitted!"); },
    deleteResourceRequest: async (id) => await deleteDoc(doc(db!, "resourceRequests", id)),
    openUploadForRequest: (id) => { const r = resourceRequests.find(x => x.id === id); if (r) { setFulfillingRequest(r); setIsUploadModalOpen(true); } },
    toggleUserSubscription: async (id) => user && await updateDoc(doc(db!, "users", user.id), { "subscriptions.users": user.subscriptions?.users?.includes(id) ? arrayRemove(id) : arrayUnion(id) }),
    toggleLecturerSubscription: async (n) => user && await updateDoc(doc(db!, "users", user.id), { "subscriptions.lecturers": user.subscriptions?.lecturers?.includes(n) ? arrayRemove(n) : arrayUnion(n) }),
    toggleCourseCodeSubscription: async (c) => user && await updateDoc(doc(db!, "users", user.id), { "subscriptions.courseCodes": user.subscriptions?.courseCodes?.includes(c) ? arrayRemove(c) : arrayUnion(c) }),
    updateUserProfile: async (d) => user && await updateDoc(doc(db!, "users", user.id), d),
    deleteAccount: async () => user && await deleteDoc(doc(db!, "users", user.id)),
    deactivateAccount: async () => user && await updateDoc(doc(db!, "users", user.id), { status: 'deactivated' }),
    sendMessage: async (id, txt) => user && await addDoc(collection(db!, "directMessages"), { conversationId: id, senderId: user.id, text: txt, timestamp: new Date().toISOString(), status: MessageStatus.Sent }),
    editMessage: async (id, txt) => await updateDoc(doc(db!, "directMessages", id), { text: txt }),
    deleteMessage: async (id) => await updateDoc(doc(db!, "directMessages", id), { isDeleted: true }),
    startConversation: async (uid, msg) => { 
        if (!user || !db) return;
        const ex = conversations.find(c => c.participants.includes(user.id) && c.participants.includes(uid));
        let cid = ex?.id;
        if (!cid) cid = (await addDoc(collection(db!, "conversations"), { participants: [user.id, uid], lastMessageTimestamp: new Date().toISOString() })).id;
        if (msg) await addDoc(collection(db!, "directMessages"), { conversationId: cid, senderId: user.id, recipientId: uid, text: msg, timestamp: new Date().toISOString(), status: MessageStatus.Sent });
        setViewState('messages'); setSelectedId(cid);
    },
    sendDirectMessageToUser: async (uid, text) => {
        if (!user || !db) return;
        const ex = conversations.find(c => c.participants.includes(user.id) && c.participants.includes(uid));
        let cid = ex?.id || (await addDoc(collection(db!, "conversations"), { participants: [user.id, uid], lastMessageTimestamp: new Date().toISOString() })).id;
        await addDoc(collection(db!, "directMessages"), { conversationId: cid, senderId: user.id, recipientId: uid, text, timestamp: new Date().toISOString(), status: MessageStatus.Sent });
    },
    markNotificationAsRead: async (id) => await updateDoc(doc(db!, "notifications", id), { isRead: true }),
    markAllNotificationsAsRead: () => notifications.forEach(n => updateDoc(doc(db!, "notifications", n.id), { isRead: true })),
    clearAllNotifications: async () => { if (!user) return; const sn = await getDocs(query(collection(db!, "notifications"), where("recipientId", "==", user.id))); const b = writeBatch(db!); sn.forEach(d => b.delete(d.ref)); await b.commit(); },
    markMessagesAsRead: async (id) => { if (!user) return; const un = directMessages.filter(m => m.conversationId === id && m.recipientId === user.id && m.status !== MessageStatus.Read); if (un.length) { const b = writeBatch(db!); un.forEach(m => b.update(doc(db!, "directMessages", m.id), { status: MessageStatus.Read })); await b.commit(); } },
    goBack: () => { if (viewHistory.length > 1) { const nh = [...viewHistory]; nh.pop(); const p = nh[nh.length-1]; setViewState(p.view); setSelectedId(p.id); setViewHistory(nh); } else setViewState('dashboard'); },
    deleteResource: async (id) => { setViewState('dashboard'); if (db) await deleteDoc(doc(db!, "resources", id)); },
    hasUnreadMessages: directMessages.some(m => m.recipientId === user?.id && m.status !== MessageStatus.Read),
    hasUnreadDiscussions: false, isLoading, areResourcesLoading, scrollTargetId, setScrollTargetId, showToast,
    banUser: async (uid) => await updateDoc(doc(db!, "users", uid), { status: 'banned' }),
    unbanUser: async (uid) => await updateDoc(doc(db!, "users", uid), { status: 'active' }),
    toggleAdminStatus: async (uid) => { const t = rawUsers.find(x => x.id === uid); if (t) await updateDoc(doc(db!, "users", uid), { isAdmin: !t.isAdmin }); },
    updateReportStatus: async (id, s) => await updateDoc(doc(db!, "reports", id), { status: s }),
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
          {view === 'resourceDetail' && selectedId && <ResourceDetailPage resource={resources.find(r => r.id === selectedId)!} />}
          {view === 'discussions' && <DiscussionsPage />}
          {view === 'forumDetail' && selectedId && <ForumPostDetailPage post={forumPosts.find(p => p.id === selectedId)!} />}
          {view === 'profile' && <ProfilePage user={user} allResources={resources} isCurrentUser={true} />}
          {view === 'publicProfile' && selectedId && <ProfilePage user={users.find(u => u.id === selectedId) || user} allResources={resources} isCurrentUser={selectedId === user.id} />}
          {view === 'messages' && <MessagesPage activeConversationId={selectedId || null} />}
          {view === 'leaderboard' && <LeaderboardPage />}
          {view === 'requests' && <ResourceRequestsPage />}
          {view === 'admin' && user.isAdmin && <AdminPage />}
        </main>
        {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} onUpload={async (d, f, ci) => {
            if (!user || !db || !storage) return;
            setIsUploading(true);
            try {
                // 1. Data Prep for AI (Avoid CORS later)
                let extractedText = "";
                let fileBase64 = "";
                const mime = f.type;
                if (mime.includes('word')) extractedText = await extractTextFromDocx(f);
                else if (mime.includes('powerpoint')) extractedText = await extractTextFromPptx(f);
                else if (f.size < 1024 * 1024) fileBase64 = await fileToBase64(f);

                // 2. Standard Upload
                const sr = ref(storage, `res/${Date.now()}_${f.name}`); await uploadBytes(sr, f); const du = await getDownloadURL(sr);
                const pu = ci ? await getDownloadURL(ref(storage, `cv/${Date.now()}_${ci.name}`)) : generateFilePreview(f.name);
                const nr = { ...d, author: sanitizeForFirestore(user), uploadDate: new Date().toISOString(), upvotes: 0, downvotes: 0, upvotedBy: [], downvotedBy: [], comments: [], fileUrl: du, fileName: f.name, previewImageUrl: pu, mimeType: mime, extractedText, fileBase64 };
                const dr = await addDoc(collection(db!, "resources"), sanitizeForFirestore(nr));
                
                if (fulfillingRequest) {
                  await updateDoc(doc(db!, "resourceRequests", fulfillingRequest.id), { status: ResourceRequestStatus.Fulfilled, fulfillment: { fulfiller: sanitizeForFirestore(user), resourceId: dr.id, timestamp: new Date().toISOString() } });
                  await earnPoints(user.id, 50, "Request fulfilled!");
                } else await earnPoints(user.id, 25, "Uploaded successfully!");
                setIsUploadModalOpen(false);
            } catch (e) { showToast("Upload failed", "error"); } finally { setIsUploading(false); }
        }} isLoading={isUploading} fulfillingRequest={fulfillingRequest} />}
        {toast && <ToastNotification message={toast.message} points={toast.points} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </AppContext.Provider>
  );
};
export default App;
