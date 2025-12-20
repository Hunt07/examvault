
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

  // Sync dark mode class to root HTML element for reliable dashboard backgrounds
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
        // Dedicated listener for the current user document
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
            if (isMaster && !userData.isAdmin) {
              await updateDoc(doc(db!, "users", firebaseUser.uid), { isAdmin: true });
            }

            setUser(userData);
          } else {
            // New User initialization
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

  // Collection Listeners
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
    await addDoc(collection(db, "notifications"), {
        recipientId, senderId, type, message, timestamp: new Date().toISOString(), isRead: false, ...linkIds
    });
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

  const apiHandleUpload = async (resourceData: any, file: File, coverImage: File | null) => {
      if (!user || !db || !storage) return;
      setIsUploading(true);
      try {
          const storageRef = ref(storage, `resources/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(storageRef);
          let previewUrl = coverImage ? await getDownloadURL(ref(storage, `covers/${Date.now()}`)) : generateFilePreview(file.name);
          
          const newResource: Omit<Resource, 'id'> = {
              ...resourceData, author: sanitizeForFirestore(user), uploadDate: new Date().toISOString(),
              upvotes: 0, downvotes: 0, upvotedBy: [], downvotedBy: [], comments: [],
              fileUrl: downloadURL, fileName: file.name, previewImageUrl: previewUrl, mimeType: file.type
          };
          const docRef = await addDoc(collection(db, "resources"), sanitizeForFirestore(newResource));
          
          if (fulfillingRequest) {
              await updateDoc(doc(db, "resourceRequests", fulfillingRequest.id), { 
                status: ResourceRequestStatus.Fulfilled, 
                fulfillment: { fulfiller: sanitizeForFirestore(user), resourceId: docRef.id, timestamp: new Date().toISOString() } 
              });
              apiSendNotification(fulfillingRequest.requester.id, user.id, NotificationType.RequestFulfilled, `${user.name} fulfilled your request!`, { resourceId: docRef.id });
              apiEarnPoints(50, "Request fulfilled!");
          } else {
              await updateDoc(doc(db, "users", user.id), { uploadCount: increment(1) });
              apiEarnPoints(25, "Resource uploaded!");
          }
          setIsUploadModalOpen(false); setFulfillingRequest(undefined);
      } catch (e) { console.error(e); showToast("Upload failed", "error"); } finally { setIsUploading(false); }
  };

  const apiLogout = async () => {
    if (!auth) return;
    isExiting.current = true;
    try {
        setUser(null); setViewState('dashboard'); setViewHistory([]);
        await signOut(auth);
    } catch (e) { console.error("Sign out failed:", e); } finally { isExiting.current = false; }
  };

  const apiDeactivateAccount = async () => {
    if (!user || !db) return;
    const userId = user.id;
    try {
        isExiting.current = true; setUser(null); setViewState('dashboard');
        await updateDoc(doc(db, "users", userId), { status: 'deactivated' });
        await signOut(auth);
        showToast("Account deactivated.", "info");
    } catch (e) { console.error(e); isExiting.current = false; }
  };

  const apiDeleteAccount = async () => {
    if (!user || !db || !auth.currentUser) return;
    const userId = user.id;
    try {
        isExiting.current = true;
        const userToKill = auth.currentUser;
        const batch = writeBatch(db);
        localStorage.removeItem(`examvault_tour_${userId}`);
        localStorage.removeItem(`examvault_saved_viewed_count_${userId}`);

        const resSnap = await getDocs(query(collection(db, "resources"), where("author.id", "==", userId)));
        resSnap.forEach(d => batch.delete(d.ref));
        const postSnap = await getDocs(query(collection(db, "forumPosts"), where("author.id", "==", userId)));
        postSnap.forEach(d => batch.delete(d.ref));
        const reqSnap = await getDocs(query(collection(db, "resourceRequests"), where("requester.id", "==", userId)));
        reqSnap.forEach(d => batch.delete(d.ref));
        batch.delete(doc(db, "users", userId));
        
        await batch.commit();
        setUser(null); setViewState('dashboard');
        await deleteUser(userToKill);
        showToast("Account purged permanently.", "info");
    } catch (error: any) {
        console.error(error); isExiting.current = false;
        if (error.code === 'auth/requires-recent-login') {
            showToast("Please log in again before deleting.", "error"); await apiLogout();
        }
    }
  };

  const apiHandleVote = async (resourceId: string, action: 'up' | 'down') => {
    if (!user || !db) return;
    const resourceRef = doc(db, "resources", resourceId);
    const resource = resources.find(r => r.id === resourceId);
    if (!resource) return;
    const userId = user.id;
    const isUpvoted = resource.upvotedBy?.includes(userId);
    const isDownvoted = resource.downvotedBy?.includes(userId);
    const updates: any = {};
    if (action === 'up') {
        if (isUpvoted) { updates.upvotes = increment(-1); updates.upvotedBy = arrayRemove(userId); }
        else { updates.upvotes = increment(1); updates.upvotedBy = arrayUnion(userId); if (isDownvoted) { updates.downvotes = increment(-1); updates.downvotedBy = arrayRemove(userId); } }
    } else {
        if (isDownvoted) { updates.downvotes = increment(-1); updates.downvotedBy = arrayRemove(userId); }
        else { updates.downvotes = increment(1); updates.downvotedBy = arrayUnion(userId); if (isUpvoted) { updates.upvotes = increment(-1); updates.upvotedBy = arrayRemove(userId); } }
    }
    await updateDoc(resourceRef, updates);
  };

  const apiAddCommentToResource = async (resourceId: string, text: string, parentId: string | null) => {
    if (!user || !db) return;
    const comment: Comment = { id: `c-${Date.now()}`, author: sanitizeForFirestore(user), text, timestamp: new Date().toISOString(), parentId, upvotes: 0, upvotedBy: [] };
    await updateDoc(doc(db, "resources", resourceId), { comments: arrayUnion(sanitizeForFirestore(comment)) });
    const resource = resources.find(r => r.id === resourceId);
    if (resource && resource.author.id !== user.id) apiSendNotification(resource.author.id, user.id, NotificationType.NewReply, `${user.name} commented on your resource.`, { resourceId });
  };

  const apiHandleCommentVote = async (resourceId: string, commentId: string) => {
    if (!user || !db) return;
    const resRef = doc(db, "resources", resourceId);
    const snap = await getDoc(resRef);
    if (snap.exists()) {
        const updated = (snap.data().comments || []).map((c: any) => {
            if (c.id === commentId) {
                const isUp = c.upvotedBy?.includes(user.id);
                return { ...c, upvotes: isUp ? c.upvotes - 1 : c.upvotes + 1, upvotedBy: isUp ? arrayRemove(user.id) : arrayUnion(user.id) };
            }
            return c;
        });
        await updateDoc(resRef, { comments: updated });
    }
  };

  const apiAddForumPost = async (p: any) => {
      if (!user || !db) return;
      const newPost = { ...p, author: sanitizeForFirestore(user), timestamp: new Date().toISOString(), upvotes: 0, downvotes: 0, upvotedBy: [], downvotedBy: [], replies: [] };
      await addDoc(collection(db, "forumPosts"), sanitizeForFirestore(newPost));
      apiEarnPoints(10, "Discussion posted!");
  };

  const apiAddReplyToPost = async (postId: string, text: string, parentId: string | null, file?: File) => {
      if (!user || !db) return;
      const reply: ForumReply = { id: `r-${Date.now()}`, author: sanitizeForFirestore(user), text, timestamp: new Date().toISOString(), upvotes: 0, upvotedBy: [], isVerified: false, parentId };
      if (file && storage) {
          const sRef = ref(storage, `attachments/${Date.now()}`);
          await uploadBytes(sRef, file);
          reply.attachment = { type: file.type.startsWith('image/') ? 'image' : 'file', url: await getDownloadURL(sRef), name: file.name };
      }
      await updateDoc(doc(db, "forumPosts", postId), { replies: arrayUnion(sanitizeForFirestore(reply)) });
  };

  const apiSendMessage = async (conversationId: string, text: string) => {
      if (!user || !db) return;
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

  const apiHandlePostVote = async (postId: string, action: 'up' | 'down') => {
    if (!user || !db) return;
    const postRef = doc(db, "forumPosts", postId);
    const post = forumPosts.find(p => p.id === postId);
    if (!post) return;
    const userId = user.id;
    const isUpvoted = post.upvotedBy?.includes(userId);
    const isDownvoted = post.downvotedBy?.includes(userId);
    const updates: any = {};
    if (action === 'up') {
        if (isUpvoted) { updates.upvotes = increment(-1); updates.upvotedBy = arrayRemove(userId); }
        else { updates.upvotes = increment(1); updates.upvotedBy = arrayUnion(userId); if (isDownvoted) { updates.downvotes = increment(-1); updates.downvotedBy = arrayRemove(userId); } }
    } else {
        if (isDownvoted) { updates.downvotes = increment(-1); updates.downvotedBy = arrayRemove(userId); }
        else { updates.downvotes = increment(1); updates.downvotedBy = arrayUnion(userId); if (isUpvoted) { updates.upvotes = increment(-1); updates.upvotedBy = arrayRemove(userId); } }
    }
    await updateDoc(postRef, updates);
  };

  const apiHandleReplyVote = async (postId: string, replyId: string) => {
    if (!user || !db) return;
    const postRef = doc(db, "forumPosts", postId);
    const snap = await getDoc(postRef);
    if (snap.exists()) {
        const data = snap.data() as ForumPost;
        const userId = user.id;
        const updatedReplies = data.replies.map(r => {
            if (r.id === replyId) {
                const upvotedBy = r.upvotedBy || [];
                const isUp = upvotedBy.includes(userId);
                return { ...r, upvotes: isUp ? r.upvotes - 1 : r.upvotes + 1, upvotedBy: isUp ? arrayRemove(userId) : arrayUnion(userId) };
            }
            return r;
        });
        await updateDoc(postRef, { replies: updatedReplies });
    }
  };

  const apiToggleVerifiedAnswer = async (postId: string, replyId: string) => {
    if (!db) return;
    const postRef = doc(db, "forumPosts", postId);
    const snap = await getDoc(postRef);
    if (snap.exists()) {
      const data = snap.data() as ForumPost;
      const updatedReplies = data.replies.map(r => {
        if (r.id === replyId) {
          const newState = !r.isVerified;
          if (newState) apiEarnPoints(15, "Marked answer as verified!");
          return { ...r, isVerified: newState };
        }
        return r;
      });
      await updateDoc(postRef, { replies: updatedReplies });
    }
  };

  const apiDeleteResource = async (resourceId: string, fileUrl: string, previewUrl?: string) => {
    if (!user || !db) return;
    setViewState('dashboard');
    setSelectedId(undefined);
    try {
      await deleteDoc(doc(db, "resources", resourceId));
      if (storage) {
        if (fileUrl && fileUrl.startsWith('http')) {
          try { await deleteObject(ref(storage, fileUrl)); } catch (e) {}
        }
        if (previewUrl && previewUrl.includes('firebasestorage')) {
          try { await deleteObject(ref(storage, previewUrl)); } catch (e) {}
        }
      }
      const userRef = doc(db, "users", user.id);
      await updateDoc(userRef, { uploadCount: increment(-1) });
      apiEarnPoints(-25, "Resource deleted.");
    } catch (e) { console.error(e); }
  };

  const apiOpenUploadForRequest = (requestId: string) => {
    const req = resourceRequests.find(r => r.id === requestId);
    if (req) {
      setFulfillingRequest(req);
      setIsUploadModalOpen(true);
    }
  };

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

  useEffect(() => {
    if (user && !isLoading) {
      const hasSeenTour = localStorage.getItem(`examvault_tour_${user.id}`);
      if (!hasSeenTour) { setRunTour(true); setTourStep(1); }
    }
  }, [user, isLoading]);

  const finishTour = () => {
    setRunTour(false); if (user) localStorage.setItem(`examvault_tour_${user.id}`, 'true');
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-bg"><Loader2 size={48} className="animate-spin text-primary-600" /></div>;
  if (!user) return <div className="min-h-screen bg-slate-50 dark:bg-dark-bg"><AuthPage onLogin={() => {}} /></div>;

  return (
    <AppContext.Provider value={{
      user, users, resources, forumPosts, notifications, conversations, directMessages, resourceRequests,
      view, setView, logout: apiLogout, deactivateAccount: apiDeactivateAccount, deleteAccount: apiDeleteAccount, isDarkMode, toggleDarkMode: () => setIsDarkMode(!isDarkMode),
      userRanks, savedResourceIds: user?.savedResourceIds || [], 
      toggleSaveResource: async (id) => { 
        if (!user) return;
        const isS = user.savedResourceIds?.includes(id); 
        await updateDoc(doc(db!, "users", user.id), { savedResourceIds: isS ? arrayRemove(id) : arrayUnion(id) }); 
        showToast(isS ? "Resource removed from bookmarks" : "Resource bookmarked!", "info");
      },
      handleVote: apiHandleVote, addCommentToResource: apiAddCommentToResource, handleCommentVote: apiHandleCommentVote, deleteCommentFromResource: async (resId, comment) => { await updateDoc(doc(db!, "resources", resId), { comments: arrayRemove(comment) }); },
      addForumPost: apiAddForumPost, handlePostVote: apiHandlePostVote, 
      deleteForumPost: async (id) => { await deleteDoc(doc(db!, "forumPosts", id)); setView('discussions'); },
      addReplyToPost: apiAddReplyToPost, handleReplyVote: apiHandleReplyVote,
      deleteReplyFromPost: async (postId, reply) => { await updateDoc(doc(db!, "forumPosts", postId), { replies: arrayRemove(reply) }); },
      toggleVerifiedAnswer: apiToggleVerifiedAnswer,
      addResourceRequest: async (req) => { await addDoc(collection(db!, "resourceRequests"), { ...req, requester: sanitizeForFirestore(user), status: ResourceRequestStatus.Open, timestamp: new Date().toISOString() }); apiEarnPoints(5, "Request posted!"); },
      deleteResourceRequest: async (id) => { await deleteDoc(doc(db!, "resourceRequests", id)); },
      openUploadForRequest: apiOpenUploadForRequest, 
      toggleUserSubscription: async (id) => { 
        if (!user) return;
        const isF = user.subscriptions?.users?.includes(id); 
        await updateDoc(doc(db!, "users", user.id), { "subscriptions.users": isF ? arrayRemove(id) : arrayUnion(id) }); 
        if (!isF) apiSendNotification(id, user.id, NotificationType.Subscription, `${user.name} followed you.`);
        showToast(isF ? "Unfollowed student" : "Following student!", "info");
      },
      toggleLecturerSubscription: async (name) => { 
        if (!user) return;
        const isF = user.subscriptions?.lecturers?.includes(name); 
        await updateDoc(doc(db!, "users", user.id), { "subscriptions.lecturers": isF ? arrayRemove(name) : arrayUnion(name) }); 
        showToast(isF ? "Unfollowed lecturer" : "Following lecturer!", "info");
      },
      toggleCourseCodeSubscription: async (code) => { 
        if (!user) return;
        const isF = user.subscriptions?.courseCodes?.includes(code); 
        await updateDoc(doc(db!, "users", user.id), { "subscriptions.courseCodes": isF ? arrayRemove(code) : arrayUnion(code) }); 
        showToast(isF ? "Unfollowed course" : "Following course!", "info");
      },
      updateUserProfile: async (d) => { if (user) await updateDoc(doc(db!, "users", user.id), d); },
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
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg transition-colors duration-300 flex flex-col">
        <Header onUploadClick={() => { setFulfillingRequest(undefined); setIsUploadModalOpen(true); }} />
        <div className="flex flex-1 relative">
          <SideNav />
          <main className="flex-1 ml-20 transition-all duration-300 min-h-[calc(100vh-5rem)]">
            <div className="pt-4 px-4 md:px-8 pb-8">
                {view === 'dashboard' && <DashboardPage />}
                {view === 'profile' && user && <ProfilePage user={user} allResources={resources} isCurrentUser={true} />}
                {view === 'publicProfile' && selectedId && <ProfilePage user={users.find(u => u.id === selectedId) || user!} allResources={resources} isCurrentUser={selectedId === user?.id} />}
                {view === 'resourceDetail' && selectedId && <ResourceDetailPage resource={resources.find(r => r.id === selectedId)!} />}
                {view === 'discussions' && <DiscussionsPage />}
                {view === 'forumDetail' && selectedId && <ForumPostDetailPage post={forumPosts.find(p => p.id === selectedId)!} />}
                {view === 'requests' && <ResourceRequestsPage />}
                {view === 'messages' && <MessagesPage activeConversationId={selectedId || null} />}
                {view === 'leaderboard' && <LeaderboardPage />}
            </div>
          </main>
        </div>
        {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} onUpload={apiHandleUpload} isLoading={isUploading} fulfillingRequest={fulfillingRequest} />}
        {runTour && <TooltipGuide targetSelector={tourSteps[tourStep - 1]?.selector || 'body'} content={tourSteps[tourStep - 1]?.content || ''} currentStep={tourStep} totalSteps={tourSteps.length} onNext={() => { if (tourStep < tourSteps.length) setTourStep(tourStep + 1); else finishTour(); }} onPrev={() => setTourStep(Math.max(1, tourStep - 1))} onSkip={finishTour} />}
        {toast && <ToastNotification message={toast.message} points={toast.points} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </AppContext.Provider>
  );
};

export default App;
