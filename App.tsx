
// App.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
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

// Firebase Imports
import { auth, db, storage } from './services/firebase';
import { onAuthStateChanged, signOut, deleteUser } from 'firebase/auth';
import { 
  collection, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, getDocs,
  onSnapshot, query, orderBy, serverTimestamp, arrayUnion, increment, where, arrayRemove, deleteField, writeBatch 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Loader2, AlertCircle } from 'lucide-react';

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

const MASTER_ADMIN_EMAILS = ['b09220024@student.unimy.edu.my'];

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
  const [runTour, setRunTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const tourSteps = [
    { selector: 'body', content: "Welcome to ExamVault! Let's take a quick tour of your new study hub." },
    { selector: '#tour-sidenav', content: "Use the sidebar to navigate between the Dashboard, Discussions, Requests, Messages, and Leaderboard." },
    { selector: '#tour-search-bar', content: "Quickly find resources, users, or courses using the global search." },
    { selector: '#tour-filter-button', content: "Use filters to narrow down resources by year, semester, lecturer, or type." },
    { selector: '#tour-requests', content: "Can't find what you need? Check the Requests page to ask the community or help others." },
    { selector: '#tour-upload-button', content: "Contribute to the community by uploading your own past papers and notes." },
    { selector: '#tour-saved-items', content: "Access your bookmarked resources quickly from here." },
    { selector: '#tour-notifications', content: "Stay updated with new uploads, replies, and messages." },
    { selector: '#tour-dark-mode', content: "Toggle between Light and Dark mode for comfortable reading." },
    { selector: '#tour-profile-menu', content: "Manage your profile and settings here." },
    { selector: 'body', content: "You're all set! Happy Studying!" },
  ];

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

  // Auth and Current User Listener
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
               showToast("This account has been banned due to community guidelines violation.", "error");
               await signOut(auth);
               setUser(null);
               setIsLoading(false);
               return;
            }
            if (userData.status === 'deactivated') {
              const hasLoginIntent = sessionStorage.getItem('examvault_login_intent') === 'true';
              if (hasLoginIntent) {
                await updateDoc(doc(db!, "users", firebaseUser.uid), { status: 'active' });
                sessionStorage.removeItem('examvault_login_intent');
                showToast("Welcome back! Your account has been reactivated.", "success");
              } else {
                await signOut(auth);
                setUser(null);
                setIsLoading(false);
                return;
              }
            }
            const isMaster = MASTER_ADMIN_EMAILS.includes(firebaseUser.email || '');
            if (isMaster && !userData.isAdmin) await updateDoc(doc(db!, "users", firebaseUser.uid), { isAdmin: true });
            setUser({ ...userData, id: docSnap.id });
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
    
    const unsubUsers = onSnapshot(collection(db, "users"), (s) => {
        const emailMap = new Map<string, User>();
        s.docs.forEach((docSnap) => {
            const data = docSnap.data() as User;
            const u = { ...data, id: docSnap.id };
            // DO NOT filter deactivated/banned here, admin needs to see them
            const normalizedEmail = (u.email || "").toLowerCase().trim();
            if (!normalizedEmail) return;
            const existing = emailMap.get(normalizedEmail);
            if (existing) {
                if ((u.points || 0) > (existing.points || 0)) emailMap.set(normalizedEmail, u);
            } else emailMap.set(normalizedEmail, u);
        });
        setUsers(Array.from(emailMap.values()));
    });

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
        unsubReports = onSnapshot(query(collection(db, "reports"), orderBy("timestamp", "desc")), (s) => {
            setReports(s.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
        });
    }

    return () => { 
        unsubUsers(); unsubResources(); unsubPosts(); unsubRequests(); unsubConvos(); unsubMessages(); unsubNotifs(); 
        unsubReports();
    };
  }, [user?.id, user?.isAdmin]);

  useEffect(() => {
    if (user && !isLoading && !runTour) {
      const hasSeenTour = localStorage.getItem(`examvault_tour_${user.id}`);
      if (!hasSeenTour) { setRunTour(true); setTourStep(1); }
    }
  }, [user?.id, isLoading, runTour]);

  const handleFinishTour = () => {
    setRunTour(false);
    if (user) localStorage.setItem(`examvault_tour_${user.id}`, 'true');
  };

  const sendNotification = async (recipientId: string, senderId: string, type: NotificationType, message: string, linkIds?: any) => {
    if (recipientId === user?.id || !db) return;
    await addDoc(collection(db, "notifications"), { recipientId, senderId, type, message, timestamp: new Date().toISOString(), isRead: false, ...linkIds });
  };

  const apiDeactivateAccount = async () => {
    if (!user || !db) return;
    try {
        isExiting.current = true;
        await updateDoc(doc(db, "users", user.id), { status: 'deactivated' });
        await signOut(auth!);
        setUser(null);
        setViewState('dashboard');
        showToast("Account deactivated. Log back in to restore your profile.", "info");
    } catch (e) {
        isExiting.current = false;
        showToast("Failed to deactivate account.", "error");
    }
  };

  const apiDeleteAccount = async () => {
    if (!user || !db || !auth.currentUser) return;
    const userId = user.id;
    try {
        isExiting.current = true;
        const currentUser = auth.currentUser;
        const batch = writeBatch(db);
        const resSnap = await getDocs(query(collection(db, "resources"), where("author.id", "==", userId)));
        resSnap.forEach(d => batch.delete(d.ref));
        const postSnap = await getDocs(query(collection(db, "forumPosts"), where("author.id", "==", userId)));
        postSnap.forEach(d => batch.delete(d.ref));
        const reqSnap = await getDocs(query(collection(db, "resourceRequests"), where("requester.id", "==", userId)));
        reqSnap.forEach(d => batch.delete(d.ref));
        batch.delete(doc(db, "users", userId));
        await batch.commit();
        await deleteUser(currentUser);
        setUser(null);
        setViewState('dashboard');
        showToast("Account permanently deleted.", "info");
    } catch (error: any) {
        isExiting.current = false;
        showToast("Deletion failed.", "error");
    }
  };

  const userRanks = useMemo(() => {
    const activeUsers = users.filter(u => u.status !== 'deactivated' && u.status !== 'banned');
    const sorted = [...activeUsers].sort((a, b) => (b.points || 0) - (a.points || 0));
    const ranks = new Map<string, number>();
    sorted.forEach((u, index) => ranks.set(u.id, index));
    return ranks;
  }, [users]);

  const currentResource = useMemo(() => resources.find(r => r.id === selectedId), [resources, selectedId]);
  const currentForumPost = useMemo(() => forumPosts.find(p => p.id === selectedId), [forumPosts, selectedId]);

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
    sendNotification(recipientId, user.id, NotificationType.NewMessage, `New message from ${user.name}`, { conversationId });
  };

  const apiStartConversation = async (userId: string, initialMessage?: string) => {
    if (!user || !db) return;
    const existing = conversations.find(c => c.participants.includes(user.id) && c.participants.includes(userId));
    if (existing) {
      if (initialMessage) await apiSendMessage(existing.id, initialMessage);
      setView('messages', existing.id);
    } else {
      const docRef = await addDoc(collection(db, "conversations"), { participants: [user.id, userId], lastMessageTimestamp: new Date().toISOString() });
      if (initialMessage) await apiSendMessage(docRef.id, initialMessage);
      setView('messages', docRef.id);
    }
  };

  const handleUpload = async (resourceData: any, file: File, coverImage: File | null) => {
    if (!user || !db || !storage) return;
    setIsUploading(true);
    try {
        const storageRef = ref(storage, `resources/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        let previewUrl = coverImage ? await getDownloadURL(ref(storage, `covers/${Date.now()}_${coverImage.name}`)) : generateFilePreview(file.name);
        const newResource: Omit<Resource, 'id'> = {
            ...resourceData, author: sanitizeForFirestore(user), uploadDate: new Date().toISOString(), upvotes: 0, downvotes: 0, upvotedBy: [], downvotedBy: [], comments: [], fileUrl: downloadURL, fileName: file.name, previewImageUrl: previewUrl, mimeType: file.type, contentForAI: `Title: ${resourceData.title}.`,
        };
        const docRef = await addDoc(collection(db, "resources"), sanitizeForFirestore(newResource));
        const pts = fulfillingRequest ? 50 : 25;
        await updateDoc(doc(db, "users", user.id), { uploadCount: increment(1), points: increment(pts), weeklyPoints: increment(pts) });
        if (fulfillingRequest) {
            await updateDoc(doc(db, "resourceRequests", fulfillingRequest.id), { status: ResourceRequestStatus.Fulfilled, fulfillment: { fulfiller: sanitizeForFirestore(user), resourceId: docRef.id, timestamp: new Date().toISOString() } });
        }
        showToast("Uploaded!", "success", pts);
        setIsUploadModalOpen(false);
    } catch (e) { showToast("Upload failed.", "error"); } finally { setIsUploading(false); }
  };

  const deleteResource = async (id: string) => { setViewState('dashboard'); setSelectedId(undefined); if (db) await deleteDoc(doc(db!, "resources", id)); };

  const handleVote = async (id: string, act: 'up' | 'down') => {
    const r = resources.find(x => x.id === id); if (!r || !user) return;
    const upvoted = r.upvotedBy?.includes(user.id);
    const downvoted = r.downvotedBy?.includes(user.id);
    const updates: any = {};
    if (act === 'up') {
      if (upvoted) { updates.upvotes = increment(-1); updates.upvotedBy = arrayRemove(user.id); }
      else { updates.upvotes = increment(1); updates.upvotedBy = arrayUnion(user.id); if (downvoted) { updates.downvotes = increment(-1); updates.downvotedBy = arrayRemove(user.id); } }
    } else {
      if (downvoted) { updates.downvotes = increment(-1); updates.downvotedBy = arrayRemove(user.id); }
      else { updates.downvotes = increment(1); updates.downvotedBy = arrayUnion(user.id); if (upvoted) { updates.upvotes = increment(-1); updates.upvotedBy = arrayRemove(user.id); } }
    }
    await updateDoc(doc(db!, "resources", id), updates);
  };

  const handlePostVote = async (id: string, act: 'up' | 'down') => {
    const p = forumPosts.find(x => x.id === id); if (!p || !user) return;
    const upvoted = p.upvotedBy?.includes(user.id);
    const downvoted = p.downvotedBy?.includes(user.id);
    const updates: any = {};
    if (act === 'up') {
      if (upvoted) { updates.upvotes = increment(-1); updates.upvotedBy = arrayRemove(user.id); }
      else { updates.upvotes = increment(1); updates.upvotedBy = arrayUnion(user.id); if (downvoted) { updates.downvotes = increment(-1); updates.downvotedBy = arrayRemove(user.id); } }
    } else {
      if (downvoted) { updates.downvotes = increment(-1); updates.downvotedBy = arrayRemove(user.id); }
      else { updates.downvotes = increment(1); updates.downvotedBy = arrayUnion(user.id); if (upvoted) { updates.upvotes = increment(-1); updates.upvotedBy = arrayRemove(user.id); } }
    }
    await updateDoc(doc(db!, "forumPosts", id), updates);
  };

  const appContextValue: AppContextType = {
    user, users, resources, forumPosts, notifications, conversations, directMessages, resourceRequests, reports, view, setView, 
    logout: async () => { isExiting.current = true; if (auth) await signOut(auth); setUser(null); setViewState('dashboard'); },
    isDarkMode, toggleDarkMode: () => setIsDarkMode(!isDarkMode), userRanks, savedResourceIds: user?.savedResourceIds || [],
    toggleSaveResource: async (id) => {
      if (!user) return;
      const isS = user.savedResourceIds?.includes(id);
      await updateDoc(doc(db!, "users", user.id), { savedResourceIds: isS ? arrayRemove(id) : arrayUnion(id) });
    },
    handleVote,
    addCommentToResource: async (resId, text, pId) => {
      await updateDoc(doc(db!, "resources", resId), { comments: arrayUnion({ id: `c-${Date.now()}`, author: sanitizeForFirestore(user), text, timestamp: new Date().toISOString(), parentId: pId, upvotes: 0, upvotedBy: [] }) });
    },
    handleCommentVote: async (resId, cId) => {
      const snap = await getDoc(doc(db!, "resources", resId));
      if (snap.exists()) {
        const upds = snap.data().comments.map((c: any) => c.id === cId ? { ...c, upvotes: c.upvotedBy.includes(user!.id) ? c.upvotes - 1 : c.upvotes + 1, upvotedBy: c.upvotedBy.includes(user!.id) ? arrayRemove(user!.id) : arrayUnion(user!.id) } : c);
        await updateDoc(doc(db!, "resources", resId), { comments: upds });
      }
    },
    deleteCommentFromResource: async (resId, comment) => { await updateDoc(doc(db!, "resources", resId), { comments: arrayRemove(comment) }); },
    addForumPost: async (post) => {
      await addDoc(collection(db!, "forumPosts"), { ...post, author: sanitizeForFirestore(user), timestamp: new Date().toISOString(), upvotes: 0, downvotes: 0, upvotedBy: [], downvotedBy: [], replies: [] });
    },
    handlePostVote,
    deleteForumPost: async (id) => { setViewState('discussions'); setSelectedId(undefined); if (db) await deleteDoc(doc(db!, "forumPosts", id)); },
    addReplyToPost: async (id, text, pId) => {
      await updateDoc(doc(db!, "forumPosts", id), { replies: arrayUnion({ id: `r-${Date.now()}`, author: sanitizeForFirestore(user), text, timestamp: new Date().toISOString(), upvotes: 0, upvotedBy: [], isVerified: false, parentId: pId }) });
    },
    handleReplyVote: async (pId, rId) => {
      const snap = await getDoc(doc(db!, "forumPosts", pId));
      if (snap.exists()) {
        const upds = snap.data().replies.map((r: any) => r.id === rId ? { ...r, upvotes: r.upvotedBy.includes(user!.id) ? r.upvotes - 1 : r.upvotes + 1, upvotedBy: r.upvotedBy.includes(user!.id) ? arrayRemove(user!.id) : arrayUnion(user!.id) } : r);
        await updateDoc(doc(db!, "forumPosts", pId), { replies: upds });
      }
    },
    deleteReplyFromPost: async (pId, r) => { await updateDoc(doc(db!, "forumPosts", pId), { replies: arrayRemove(r) }); },
    toggleVerifiedAnswer: async (pId, rId) => {
      const snap = await getDoc(doc(db!, "forumPosts", pId));
      if (snap.exists()) {
        const upds = snap.data().replies.map((r: any) => r.id === rId ? { ...r, isVerified: !r.isVerified } : r);
        await updateDoc(doc(db!, "forumPosts", pId), { replies: upds });
      }
    },
    addResourceRequest: async (req) => { await addDoc(collection(db!, "resourceRequests"), { ...req, requester: sanitizeForFirestore(user), status: ResourceRequestStatus.Open, timestamp: new Date().toISOString() }); },
    deleteResourceRequest: async (id) => { await deleteDoc(doc(db!, "resourceRequests", id)); },
    openUploadForRequest: (id) => { const r = resourceRequests.find(x => x.id === id); if (r) { setFulfillingRequest(r); setIsUploadModalOpen(true); } },
    toggleUserSubscription: async (id) => { 
        if (!user || !db) return;
        const isCurrentlyFollowing = user.subscriptions?.users?.includes(id);
        const userRef = doc(db, "users", user.id);
        if (isCurrentlyFollowing) {
            await updateDoc(userRef, { "subscriptions.users": arrayRemove(id) });
        } else {
            await updateDoc(userRef, { "subscriptions.users": arrayUnion(id) });
            sendNotification(id, user.id, NotificationType.Subscription, `${user.name} started following you!`, { senderId: user.id });
        }
    },
    toggleLecturerSubscription: async (n) => { if (user) await updateDoc(doc(db!, "users", user.id), { "subscriptions.lecturers": user.subscriptions?.lecturers?.includes(n) ? arrayRemove(n) : arrayUnion(n) }); },
    toggleCourseCodeSubscription: async (c) => { if (user) await updateDoc(doc(db!, "users", user.id), { "subscriptions.courseCodes": user.subscriptions?.courseCodes?.includes(c) ? arrayRemove(c) : arrayUnion(c) }); },
    updateUserProfile: async (d) => { if (user) await updateDoc(doc(db!, "users", user.id), d); },
    deleteAccount: apiDeleteAccount, deactivateAccount: apiDeactivateAccount,
    sendMessage: apiSendMessage, editMessage: async (id, text) => { await updateDoc(doc(db!, "directMessages", id), { text }); },
    deleteMessage: async (id) => { await updateDoc(doc(db!, "directMessages", id), { isDeleted: true }); },
    startConversation: apiStartConversation, sendDirectMessageToUser: (id, text) => apiStartConversation(id, text),
    markNotificationAsRead: async (id) => { await updateDoc(doc(db!, "notifications", id), { isRead: true }); },
    markAllNotificationsAsRead: async () => { notifications.forEach(n => updateDoc(doc(db!, "notifications", n.id), { isRead: true })); },
    clearAllNotifications: async () => { if (!user) return; const sn = await getDocs(query(collection(db!, "notifications"), where("recipientId", "==", user.id))); const b = writeBatch(db!); sn.forEach(d => b.delete(d.ref)); await b.commit(); },
    markMessagesAsRead: async (id) => { if (!user) return; const unread = directMessages.filter(m => m.conversationId === id && m.recipientId === user.id && m.status !== MessageStatus.Read); if (unread.length) { const b = writeBatch(db!); unread.forEach(m => b.update(doc(db!, "directMessages", m.id), { status: MessageStatus.Read })); await b.commit(); } },
    goBack, deleteResource, hasUnreadMessages: directMessages.some(m => m.recipientId === user?.id && m.status !== MessageStatus.Read), 
    hasUnreadDiscussions: false, isLoading, areResourcesLoading, scrollTargetId, setScrollTargetId, showToast,
    banUser: async (uId) => { if (user?.isAdmin && db) await updateDoc(doc(db, "users", uId), { status: 'banned' }); },
    unbanUser: async (uId) => { if (user?.isAdmin && db) await updateDoc(doc(db, "users", uId), { status: 'active' }); },
    updateReportStatus: async (rId, status) => { if (user?.isAdmin && db) await updateDoc(doc(db, "reports", rId), { status }); }
  };

  // Determine main UI content based on state
  let content;
  if (isLoading) {
    content = <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-bg transition-colors duration-300"><Loader2 size={48} className="animate-spin text-primary-600" /></div>;
  } else if (!user) {
    content = <AuthPage onLogin={() => {}} />;
  } else {
    content = (
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg transition-colors duration-300">
        <Header onUploadClick={() => { setFulfillingRequest(undefined); setIsUploadModalOpen(true); }} />
        <SideNav />
        <main className="ml-20 transition-all duration-300 pt-4 px-4 md:px-8 pb-8 min-h-screen">
          {view === 'dashboard' && <DashboardPage />}
          {view === 'resourceDetail' && selectedId && currentResource && <ResourceDetailPage resource={currentResource} />}
          {view === 'discussions' && <DiscussionsPage />}
          {view === 'forumDetail' && selectedId && currentForumPost && <ForumPostDetailPage post={currentForumPost} />}
          {view === 'profile' && user && <ProfilePage user={user} allResources={resources} isCurrentUser={true} />}
          {view === 'publicProfile' && selectedId && <ProfilePage user={users.find(u => u.id === selectedId) || user} allResources={resources} isCurrentUser={selectedId === user.id} />}
          {view === 'messages' && <MessagesPage activeConversationId={selectedId || null} />}
          {view === 'leaderboard' && <LeaderboardPage />}
          {view === 'requests' && <ResourceRequestsPage />}
          {view === 'admin' && user.isAdmin && <AdminPage />}
        </main>
        {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} onUpload={handleUpload} isLoading={isUploading} fulfillingRequest={fulfillingRequest} />}
        {runTour && <TooltipGuide targetSelector={tourSteps[tourStep-1]?.selector || 'body'} content={tourSteps[tourStep-1]?.content || ''} currentStep={tourStep} totalSteps={tourSteps.length} onNext={() => tourStep < tourSteps.length ? setTourStep(tourStep + 1) : handleFinishTour()} onPrev={() => setTourStep(Math.max(1, tourStep-1))} onSkip={handleFinishTour} />}
      </div>
    );
  }

  return (
    <AppContext.Provider value={appContextValue}>
      {content}
      {toast && <ToastNotification message={toast.message} points={toast.points} type={toast.type} onClose={() => setToast(null)} />}
    </AppContext.Provider>
  );
};
export default App;
