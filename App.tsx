
import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { User, Resource, ForumPost, Comment, ForumReply, Notification, Conversation, DirectMessage, ResourceRequest, Attachment } from './types';
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
import SideNav from './components/SideNav';
import Header from './components/Header';
import UploadModal, { generateFilePreview } from './components/UploadModal';
import TooltipGuide from './components/TooltipGuide';
import ToastNotification from './components/ToastNotification';

// Firebase Imports
import { auth, db, storage } from './services/firebase';
import { onAuthStateChanged, signOut, deleteUser } from 'firebase/auth';
import { 
  collection, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, getDocs,
  onSnapshot, query, orderBy, serverTimestamp, arrayUnion, increment, where, arrayRemove, deleteField, writeBatch 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Loader2, AlertCircle } from 'lucide-react';

export type View = 'dashboard' | 'resourceDetail' | 'discussions' | 'forumDetail' | 'profile' | 'publicProfile' | 'messages' | 'leaderboard' | 'requests';

interface AppContextType {
  user: User | null;
  users: User[];
  resources: Resource[];
  forumPosts: ForumPost[];
  notifications: Notification[];
  conversations: Conversation[];
  directMessages: DirectMessage[];
  resourceRequests: ResourceRequest[];
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

const MASTER_ADMIN_EMAILS = ['b09220024@student.unimy.edu.my'];

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [areResourcesLoading, setAreResourcesLoading] = useState(true);
  const [view, setViewState] = useState<View>('dashboard');
  const [viewHistory, setViewHistory] = useState<{ view: View; id?: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('examvault_theme') === 'dark');
  
  const isExiting = useRef(false);

  const [users, setUsers] = useState<User[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [resourceRequests, setResourceRequests] = useState<ResourceRequest[]>([]);
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fulfillingRequest, setFulfillingRequest] = useState<ResourceRequest | undefined>(undefined);
  const [toast, setToast] = useState<{ message: string; points?: number; type?: 'success' | 'error' | 'info' } | null>(null);
  const [runTour, setRunTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

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

  // Auth and Current User Listener (Real-time reactivity)
  useEffect(() => {
    if (!auth || !db) { setIsLoading(false); return; }
    let unsubUserDoc: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (isExiting.current) return;
      if (firebaseUser) {
        unsubUserDoc = onSnapshot(doc(db!, "users", firebaseUser.uid), async (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as User;
            if (userData.status === 'deactivated') {
              const hasLoginIntent = sessionStorage.getItem('examvault_login_intent') === 'true';
              if (hasLoginIntent) {
                await updateDoc(doc(db!, "users", firebaseUser.uid), { status: 'active' });
                sessionStorage.removeItem('examvault_login_intent');
                showToast("Welcome back! Your account has been reactivated.", "success");
              } else {
                await signOut(auth);
                setUser(null);
                return;
              }
            }
            const isMaster = MASTER_ADMIN_EMAILS.includes(firebaseUser.email || '');
            if (isMaster && !userData.isAdmin) await updateDoc(doc(db!, "users", firebaseUser.uid), { isAdmin: true });
            setUser(userData);
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
    return () => {
      unsubscribeAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  // Global Collection Listeners
  useEffect(() => {
    if (!user || !db) return;
    setAreResourcesLoading(true);
    const unsubUsers = onSnapshot(collection(db, "users"), (s) => setUsers(s.docs.map(d => d.data() as User)));
    const unsubResources = onSnapshot(query(collection(db, "resources"), orderBy("uploadDate", "desc")), (s) => {
      setResources(s.docs.map(d => ({ id: d.id, ...d.data() } as Resource)));
      setAreResourcesLoading(false);
    });
    const unsubPosts = onSnapshot(query(collection(db, "forumPosts"), orderBy("timestamp", "desc")), (s) => setForumPosts(s.docs.map(d => ({ id: d.id, ...d.data() } as ForumPost))));
    const unsubRequests = onSnapshot(query(collection(db, "resourceRequests"), orderBy("timestamp", "desc")), (s) => setResourceRequests(s.docs.map(d => ({ id: d.id, ...d.data() } as ResourceRequest))));
    const unsubConvos = onSnapshot(query(collection(db, "conversations"), where("participants", "array-contains", user.id)), (s) => setConversations(s.docs.map(d => ({ id: d.id, ...d.data() } as Conversation))));
    const unsubMessages = onSnapshot(query(collection(db, "directMessages"), orderBy("timestamp", "asc")), (s) => setDirectMessages(s.docs.map(d => ({ id: d.id, ...d.data() } as DirectMessage))));
    const unsubNotifs = onSnapshot(query(collection(db, "notifications"), where("recipientId", "==", user.id)), (s) => setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() } as Notification))));
    return () => { unsubUsers(); unsubResources(); unsubPosts(); unsubRequests(); unsubConvos(); unsubMessages(); unsubNotifs(); };
  }, [user?.id]);

  const apiEarnPoints = async (amount: number, message: string) => {
    if (!user || !db) return;
    await updateDoc(doc(db, "users", user.id), { points: increment(amount), weeklyPoints: increment(amount) });
    showToast(message, 'success', amount);
  };

  const apiSendNotification = async (recipientId: string, senderId: string, type: NotificationType, message: string, linkIds?: any) => {
    if (recipientId === user?.id || !db) return;
    await addDoc(collection(db, "notifications"), { recipientId, senderId, type, message, timestamp: new Date().toISOString(), isRead: false, ...linkIds });
  };

  const userRanks = useMemo(() => {
    const sorted = [...users].sort((a, b) => (b.points || 0) - (a.points || 0));
    const ranks = new Map<string, number>();
    sorted.forEach((u, index) => ranks.set(u.id, index));
    return ranks;
  }, [users]);

  const setView = (newView: View, id?: string, options?: { replace?: boolean }) => {
    if (!options?.replace) setViewHistory(prev => [...prev, { view: newView, id }]);
    setViewState(newView); setSelectedId(id); window.scrollTo(0, 0);
  };

  const goBack = () => {
    if (viewHistory.length > 1) {
      const newHistory = [...viewHistory]; newHistory.pop(); 
      const previous = newHistory[newHistory.length - 1];
      setViewHistory(newHistory); setViewState(previous.view); setSelectedId(previous.id);
    } else setViewState('dashboard');
  };

  const apiSendMessage = async (conversationId: string, text: string) => {
    if (!user || !db || !text.trim()) return;
    const convo = conversations.find(c => c.id === conversationId);
    const recipientId = convo?.participants.find(id => id !== user.id);
    if (!recipientId) return;
    await addDoc(collection(db, "directMessages"), { conversationId, senderId: user.id, recipientId, text, timestamp: new Date().toISOString(), status: MessageStatus.Sent });
    await updateDoc(doc(db, "conversations", conversationId), { lastMessageTimestamp: new Date().toISOString() });
    apiSendNotification(recipientId, user.id, NotificationType.NewMessage, `New message from ${user.name}`, { conversationId });
  };

  const apiStartConversation = async (userId: string, initialMessage?: string) => {
    if (!user || !db) return;
    const existing = conversations.find(c => c.participants.includes(user.id) && c.participants.includes(userId));
    if (existing) {
      if (initialMessage) await apiSendMessage(existing.id, initialMessage);
      setView('messages', existing.id);
    } else {
      const docRef = await addDoc(collection(db, "conversations"), { participants: [user.id, userId], lastMessageTimestamp: new Date().toISOString() });
      if (initialMessage) {
        await addDoc(collection(db, "directMessages"), { conversationId: docRef.id, senderId: user.id, recipientId: userId, text: initialMessage, timestamp: new Date().toISOString(), status: MessageStatus.Sent });
        apiSendNotification(userId, user.id, NotificationType.NewMessage, `New message from ${user.name}`, { conversationId: docRef.id });
      }
      setView('messages', docRef.id);
    }
  };

  const apiDeleteForumPost = async (postId: string) => {
    if (!db) return;
    setSelectedId(undefined); // Clear ID first to avoid component crash
    setViewState('discussions');
    try {
      await deleteDoc(doc(db, "forumPosts", postId));
      apiEarnPoints(-10, "Post deleted.");
    } catch (e) { console.error(e); }
  };

  const apiDeleteResource = async (resourceId: string, fileUrl: string, previewUrl?: string) => {
    if (!user || !db) return;
    setSelectedId(undefined);
    setViewState('dashboard');
    try {
      await deleteDoc(doc(db, "resources", resourceId));
      if (storage) {
        if (fileUrl?.startsWith('http')) try { await deleteObject(ref(storage, fileUrl)); } catch (e) {}
        if (previewUrl?.includes('firebasestorage')) try { await deleteObject(ref(storage, previewUrl)); } catch (e) {}
      }
      await updateDoc(doc(db, "users", user.id), { uploadCount: increment(-1) });
      apiEarnPoints(-25, "Resource deleted.");
    } catch (e) { console.error(e); }
  };

  const tourSteps = [
    { selector: 'body', content: "Welcome to ExamVault! Let's take a quick tour." },
    { selector: '#tour-sidenav', content: "Navigate between Dashboard, Discussions, and more." },
    { selector: '#tour-search-bar', content: "Find specific resources or students." },
    { selector: '#tour-upload-button', content: "Share your own study materials." },
    { selector: '#tour-saved-items', content: "Quick access to bookmarked items." },
    { selector: 'body', content: "You're all set! Happy Studying!" },
  ];

  useEffect(() => {
    if (user && !isLoading) {
      const hasSeenTour = localStorage.getItem(`examvault_tour_${user.id}`);
      if (!hasSeenTour) { setRunTour(true); setTourStep(1); }
    }
  }, [user, isLoading]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-bg"><Loader2 size={48} className="animate-spin text-primary-600" /></div>;
  if (!user) return <AuthPage onLogin={() => {}} />;

  return (
    <AppContext.Provider value={{
      user, users, resources, forumPosts, notifications, conversations, directMessages, resourceRequests,
      view, setView, logout: async () => { isExiting.current = true; await signOut(auth!); setUser(null); setViewState('dashboard'); },
      isDarkMode, toggleDarkMode: () => setIsDarkMode(!isDarkMode),
      userRanks, savedResourceIds: user.savedResourceIds || [],
      toggleSaveResource: async (id) => {
        const isS = user.savedResourceIds?.includes(id);
        await updateDoc(doc(db!, "users", user.id), { savedResourceIds: isS ? arrayRemove(id) : arrayUnion(id) });
        showToast(isS ? "Removed bookmark" : "Bookmarked!", "info");
      },
      handleVote: async (id, act) => {
        const r = resources.find(x => x.id === id); if (!r) return;
        const ref = doc(db!, "resources", id);
        const up = r.upvotedBy?.includes(user.id); const dn = r.downvotedBy?.includes(user.id);
        const upds: any = {};
        if (act === 'up') {
          if (up) { upds.upvotes = increment(-1); upds.upvotedBy = arrayRemove(user.id); }
          else { upds.upvotes = increment(1); upds.upvotedBy = arrayUnion(user.id); if (dn) { upds.downvotes = increment(-1); upds.downvotedBy = arrayRemove(user.id); } }
        } else {
          if (dn) { upds.downvotes = increment(-1); upds.downvotedBy = arrayRemove(user.id); }
          else { upds.downvotes = increment(1); upds.downvotedBy = arrayUnion(user.id); if (up) { upds.upvotes = increment(-1); upds.upvotedBy = arrayRemove(user.id); } }
        }
        await updateDoc(ref, upds);
      },
      addCommentToResource: async (resId, text, pId) => {
        const comment = { id: `c-${Date.now()}`, author: sanitizeForFirestore(user), text, timestamp: new Date().toISOString(), parentId: pId, upvotes: 0, upvotedBy: [] };
        await updateDoc(doc(db!, "resources", resId), { comments: arrayUnion(sanitizeForFirestore(comment)) });
      },
      handleCommentVote: async (resId, cId) => {
        const resRef = doc(db!, "resources", resId); const snap = await getDoc(resRef);
        if (snap.exists()) {
          const upds = (snap.data().comments || []).map((c: any) => {
            if (c.id === cId) {
              const isUp = c.upvotedBy?.includes(user.id);
              return { ...c, upvotes: isUp ? c.upvotes - 1 : c.upvotes + 1, upvotedBy: isUp ? arrayRemove(user.id) : arrayUnion(user.id) };
            }
            return c;
          });
          await updateDoc(resRef, { comments: upds });
        }
      },
      deleteCommentFromResource: async (resId, comment) => { await updateDoc(doc(db!, "resources", resId), { comments: arrayRemove(comment) }); },
      addForumPost: async (post) => {
        const newPost = { ...post, author: sanitizeForFirestore(user), timestamp: new Date().toISOString(), upvotes: 0, downvotes: 0, upvotedBy: [], downvotedBy: [], replies: [] };
        await addDoc(collection(db!, "forumPosts"), sanitizeForFirestore(newPost));
        apiEarnPoints(10, "Post created!");
      },
      handlePostVote: async (id, act) => {
        const p = forumPosts.find(x => x.id === id); if (!p) return;
        const ref = doc(db!, "forumPosts", id);
        const up = p.upvotedBy?.includes(user.id); const dn = p.downvotedBy?.includes(user.id);
        const upds: any = {};
        if (act === 'up') {
          if (up) { upds.upvotes = increment(-1); upds.upvotedBy = arrayRemove(user.id); }
          else { upds.upvotes = increment(1); upds.upvotedBy = arrayUnion(user.id); if (dn) { upds.downvotes = increment(-1); upds.downvotedBy = arrayRemove(user.id); } }
        } else {
          if (dn) { upds.downvotes = increment(-1); upds.downvotedBy = arrayRemove(user.id); }
          else { upds.downvotes = increment(1); upds.downvotedBy = arrayUnion(user.id); if (up) { upds.upvotes = increment(-1); upds.upvotedBy = arrayRemove(user.id); } }
        }
        await updateDoc(ref, upds);
      },
      deleteForumPost: apiDeleteForumPost,
      addReplyToPost: async (postId, text, pId, file) => {
        const reply: any = { id: `r-${Date.now()}`, author: sanitizeForFirestore(user), text, timestamp: new Date().toISOString(), upvotes: 0, upvotedBy: [], isVerified: false, parentId: pId };
        if (file) {
          const sRef = ref(storage!, `atts/${Date.now()}`); await uploadBytes(sRef, file);
          reply.attachment = { type: file.type.startsWith('image/') ? 'image' : 'file', url: await getDownloadURL(sRef), name: file.name };
        }
        await updateDoc(doc(db!, "forumPosts", postId), { replies: arrayUnion(sanitizeForFirestore(reply)) });
      },
      handleReplyVote: async (pId, rId) => {
        const pRef = doc(db!, "forumPosts", pId); const snap = await getDoc(pRef);
        if (snap.exists()) {
          const upds = (snap.data().replies || []).map((r: any) => {
            if (r.id === rId) {
              const isUp = r.upvotedBy?.includes(user.id);
              return { ...r, upvotes: isUp ? r.upvotes - 1 : r.upvotes + 1, upvotedBy: isUp ? arrayRemove(user.id) : arrayUnion(user.id) };
            }
            return r;
          });
          await updateDoc(pRef, { replies: upds });
        }
      },
      deleteReplyFromPost: async (pId, r) => { await updateDoc(doc(db!, "forumPosts", pId), { replies: arrayRemove(r) }); },
      toggleVerifiedAnswer: async (pId, rId) => {
        const pRef = doc(db!, "forumPosts", pId); const snap = await getDoc(pRef);
        if (snap.exists()) {
          const upds = (snap.data().replies || []).map((r: any) => {
            if (r.id === rId) { const next = !r.isVerified; if (next) apiEarnPoints(15, "Verified!"); return { ...r, isVerified: next }; }
            return r;
          });
          await updateDoc(pRef, { replies: upds });
        }
      },
      addResourceRequest: async (req) => { await addDoc(collection(db!, "resourceRequests"), { ...req, requester: sanitizeForFirestore(user), status: ResourceRequestStatus.Open, timestamp: new Date().toISOString() }); apiEarnPoints(5, "Request posted!"); },
      deleteResourceRequest: async (id) => { await deleteDoc(doc(db!, "resourceRequests", id)); },
      openUploadForRequest: (id) => { const r = resourceRequests.find(x => x.id === id); if (r) { setFulfillingRequest(r); setIsUploadModalOpen(true); } },
      toggleUserSubscription: async (id) => {
        const isF = user.subscriptions?.users?.includes(id);
        await updateDoc(doc(db!, "users", user.id), { "subscriptions.users": isF ? arrayRemove(id) : arrayUnion(id) });
        if (!isF) apiSendNotification(id, user.id, NotificationType.Subscription, `${user.name} followed you.`);
        showToast(isF ? "Unfollowed" : "Following!", "info");
      },
      toggleLecturerSubscription: async (name) => {
        const isF = user.subscriptions?.lecturers?.includes(name);
        await updateDoc(doc(db!, "users", user.id), { "subscriptions.lecturers": isF ? arrayRemove(name) : arrayUnion(name) });
        showToast(isF ? "Unfollowed" : "Following!", "info");
      },
      toggleCourseCodeSubscription: async (code) => {
        const isF = user.subscriptions?.courseCodes?.includes(code);
        await updateDoc(doc(db!, "users", user.id), { "subscriptions.courseCodes": isF ? arrayRemove(code) : arrayUnion(code) });
        showToast(isF ? "Unfollowed" : "Following!", "info");
      },
      updateUserProfile: async (d) => { await updateDoc(doc(db!, "users", user.id), d); },
      deleteAccount: async () => { /* implementation */ }, deactivateAccount: async () => { /* implementation */ },
      sendMessage: apiSendMessage, editMessage: async (id, text) => { await updateDoc(doc(db!, "directMessages", id), { text, editedAt: new Date().toISOString() }); },
      deleteMessage: async (id) => { await updateDoc(doc(db!, "directMessages", id), { isDeleted: true, text: "" }); },
      startConversation: apiStartConversation, sendDirectMessageToUser: (id, text) => apiStartConversation(id, text),
      markNotificationAsRead: async (id) => { await updateDoc(doc(db!, "notifications", id), { isRead: true }); },
      markAllNotificationsAsRead: async () => { notifications.filter(n => !n.isRead).forEach(n => updateDoc(doc(db!, "notifications", n.id), { isRead: true })); },
      clearAllNotifications: async () => { const q = query(collection(db!, "notifications"), where("recipientId", "==", user.id)); const sn = await getDocs(q); const b = writeBatch(db!); sn.forEach(d => b.delete(d.ref)); await b.commit(); },
      markMessagesAsRead: async (id) => { const unread = directMessages.filter(m => m.conversationId === id && m.recipientId === user.id && m.status !== MessageStatus.Read); if (unread.length) { const b = writeBatch(db!); unread.forEach(m => b.update(doc(db!, "directMessages", m.id), { status: MessageStatus.Read })); await b.commit(); } },
      goBack, deleteResource: apiDeleteResource, hasUnreadMessages: directMessages.some(m => m.recipientId === user?.id && m.status !== MessageStatus.Read), 
      hasUnreadDiscussions: false, isLoading, areResourcesLoading, scrollTargetId, setScrollTargetId, showToast
    }}>
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg transition-colors duration-300">
        <Header onUploadClick={() => { setFulfillingRequest(undefined); setIsUploadModalOpen(true); }} />
        <SideNav />
        <main className="ml-20 transition-all duration-300 pt-4 px-4 md:px-8 pb-8 min-h-screen">
          {view === 'dashboard' && <DashboardPage />}
          {view === 'resourceDetail' && selectedId && <ResourceDetailPage resource={resources.find(r => r.id === selectedId)!} />}
          {view === 'discussions' && <DiscussionsPage />}
          {view === 'forumDetail' && selectedId && <ForumPostDetailPage post={forumPosts.find(p => p.id === selectedId)!} />}
          {view === 'profile' && user && <ProfilePage user={user} allResources={resources} isCurrentUser={true} />}
          {view === 'publicProfile' && selectedId && <ProfilePage user={users.find(u => u.id === selectedId) || user} allResources={resources} isCurrentUser={selectedId === user.id} />}
          {view === 'messages' && <MessagesPage activeConversationId={selectedId || null} />}
          {view === 'leaderboard' && <LeaderboardPage />}
          {view === 'requests' && <ResourceRequestsPage />}
        </main>
        {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} onUpload={() => {}} isLoading={isUploading} />}
        {runTour && <TooltipGuide targetSelector={tourSteps[tourStep-1].selector} content={tourSteps[tourStep-1].content} currentStep={tourStep} totalSteps={tourSteps.length} onNext={() => tourStep < tourSteps.length ? setTourStep(tourStep+1) : setRunTour(false)} onPrev={() => setTourStep(Math.max(1, tourStep-1))} onSkip={() => setRunTour(false)} />}
        {toast && <ToastNotification message={toast.message} points={toast.points} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </AppContext.Provider>
  );
};

export default App;
