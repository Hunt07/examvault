
import React, { useState, useMemo, useEffect } from 'react';
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
// Fix: Use named imports for Firebase Auth functions
import { onAuthStateChanged, signOut, deleteUser } from 'firebase/auth';
import { 
  collection, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, getDocs,
  onSnapshot, query, orderBy, arrayUnion, increment, where, arrayRemove, deleteField, writeBatch 
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
  
  const [users, setUsers] = useState<User[]>([]);
  const [rawResources, setRawResources] = useState<Resource[]>([]);
  const [rawForumPosts, setRawForumPosts] = useState<ForumPost[]>([]);
  const [rawRequests, setRawRequests] = useState<ResourceRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fulfillingRequest, setFulfillingRequest] = useState<ResourceRequest | undefined>(undefined);
  const [toast, setToast] = useState<{ message: string; points?: number; type?: 'success' | 'error' | 'info' } | null>(null);
  const [runTour, setRunTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', points?: number) => setToast({ message, type, points });

  // Filtering Logic: Hide content from deactivated or banned users
  const activeUserIds = useMemo(() => {
    return new Set(users.filter(u => !u.status || u.status === 'active').map(u => u.id));
  }, [users]);

  const resources = useMemo(() => rawResources.filter(r => activeUserIds.has(r.author.id) || (user && r.author.id === user.id)), [rawResources, activeUserIds, user]);
  const forumPosts = useMemo(() => rawForumPosts.filter(p => activeUserIds.has(p.author.id) || (user && p.author.id === user.id)), [rawForumPosts, activeUserIds, user]);
  const resourceRequests = useMemo(() => rawRequests.filter(r => activeUserIds.has(r.requester.id) || (user && r.requester.id === user.id)), [rawRequests, activeUserIds, user]);

  useEffect(() => {
    if (!auth || !db) { setIsLoading(false); return; }
    // Fix: Use onAuthStateChanged directly
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userRef = doc(db!, "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          const isMaster = MASTER_ADMIN_EMAILS.includes(firebaseUser.email || '');

          if (userSnap.exists()) {
            const userData = userSnap.data() as User;
            // AUTO-REACTIVATION: If user logs in while deactivated, restore them
            if (userData.status === 'deactivated') {
                await updateDoc(userRef, { status: 'active' });
                userData.status = 'active';
                showToast("Welcome back! Your account has been reactivated.", "success");
            }
            if (isMaster && !userData.isAdmin) {
                await updateDoc(userRef, { isAdmin: true });
                userData.isAdmin = true;
            }
            setUser(userData);
          } else {
            const displayName = firebaseUser.displayName || "Student";
            const newUser: User = {
              id: firebaseUser.uid, name: displayName, email: firebaseUser.email || "",
              avatarUrl: generateDefaultAvatar(displayName), joinDate: new Date().toISOString(),
              bio: "Academic explorer on ExamVault.", points: 0, weeklyPoints: 0, uploadCount: 0,
              course: "General", currentYear: 1, currentSemester: 1,
              subscriptions: { users: [], lecturers: [], courseCodes: [] }, savedResourceIds: [],
              status: 'active', isAdmin: isMaster
            };
            await setDoc(userRef, newUser);
            setUser(newUser);
          }
        } catch (error) { console.error("Auth fetch error:", error); }
      } else { setUser(null); setViewState('dashboard'); }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    setAreResourcesLoading(true);
    const unsubUsers = onSnapshot(collection(db, "users"), (s) => setUsers(s.docs.map(d => d.data() as User)));
    const unsubResources = onSnapshot(query(collection(db, "resources"), orderBy("uploadDate", "desc")), (s) => {
      setRawResources(s.docs.map(d => ({ id: d.id, ...d.data() } as Resource)));
      setAreResourcesLoading(false);
    });
    const unsubPosts = onSnapshot(query(collection(db, "forumPosts"), orderBy("timestamp", "desc")), (s) => setRawForumPosts(s.docs.map(d => ({ id: d.id, ...d.data() } as ForumPost))));
    const unsubRequests = onSnapshot(query(collection(db, "resourceRequests"), orderBy("timestamp", "desc")), (s) => setRawRequests(s.docs.map(d => ({ id: d.id, ...d.data() } as ResourceRequest))));
    const unsubConvos = onSnapshot(query(collection(db, "conversations"), where("participants", "array-contains", user.id)), (s) => setConversations(s.docs.map(d => ({ id: d.id, ...d.data() } as Conversation))));
    const unsubMessages = onSnapshot(query(collection(db, "directMessages"), orderBy("timestamp", "asc")), (s) => setDirectMessages(s.docs.map(d => ({ id: d.id, ...d.data() } as DirectMessage))));
    const unsubNotifs = onSnapshot(query(collection(db, "notifications"), where("recipientId", "==", user.id)), (s) => setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() } as Notification))));
    return () => { unsubUsers(); unsubResources(); unsubPosts(); unsubRequests(); unsubConvos(); unsubMessages(); unsubNotifs(); };
  }, [user?.id]);

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

  // Fix: Use signOut directly
  const logout = async () => { await signOut(auth); setUser(null); setViewState('dashboard'); };

  const deactivateAccount = async () => {
    if (!user || !db) return;
    await updateDoc(doc(db, "users", user.id), { status: 'deactivated' });
    showToast("Account deactivated. Log in anytime to restore your data.", "info");
    await logout();
  };

  const deleteAccount = async () => {
    if (!user || !db || !auth.currentUser) return;
    try {
        const batch = writeBatch(db);
        // Purge Resources
        const resSnap = await getDocs(query(collection(db, "resources"), where("author.id", "==", user.id)));
        resSnap.forEach(d => batch.delete(d.ref));
        // Purge Posts
        const postSnap = await getDocs(query(collection(db, "forumPosts"), where("author.id", "==", user.id)));
        postSnap.forEach(d => batch.delete(d.ref));
        // Purge Requests
        const reqSnap = await getDocs(query(collection(db, "resourceRequests"), where("requester.id", "==", user.id)));
        reqSnap.forEach(d => batch.delete(d.ref));
        // Purge User
        batch.delete(doc(db, "users", user.id));
        
        await batch.commit();
        // Fix: Use deleteUser directly
        await deleteUser(auth.currentUser);
        setUser(null); setViewState('dashboard');
        showToast("Account and all associated content permanently deleted.", "info");
    } catch (error) {
        console.error("Purge failed:", error);
        showToast("Failed to purge account data. Try again later.", "error");
    }
  };

  const handleUpload = async (resourceData: any, file: File, coverImage: File | null) => {
    if (!user) return;
    setIsUploading(true);
    try {
        const storageRef = ref(storage, `resources/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        let previewUrl = coverImage ? await (async () => {
            const coverRef = ref(storage, `covers/${Date.now()}_${coverImage.name}`);
            await uploadBytes(coverRef, coverImage);
            return await getDownloadURL(coverRef);
        })() : generateFilePreview(file.name);
        const newResource: Omit<Resource, 'id'> = {
            ...resourceData, author: sanitizeForFirestore(user), uploadDate: new Date().toISOString(),
            upvotes: 0, downvotes: 0, upvotedBy: [], downvotedBy: [], comments: [],
            fileUrl: downloadURL, fileName: file.name, previewImageUrl: previewUrl,
            mimeType: file.type, contentForAI: "Shared through ExamVault.",
        };
        await addDoc(collection(db, "resources"), sanitizeForFirestore(newResource));
        setIsUploadModalOpen(false); showToast("Resource shared!", "success", 25);
    } catch (error) { showToast("Upload failed.", "error"); } finally { setIsUploading(false); }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('examvault_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('examvault_theme', 'light');
    }
  }, [isDarkMode]);

  const tourSteps = [
    { selector: 'body', content: "Welcome back! Content from deactivated users is now hidden." },
    { selector: '#tour-sidenav', content: "Use the sidebar to explore." }
  ];

  return (
    <AppContext.Provider value={{
      user, users, resources, forumPosts, notifications, conversations, directMessages, resourceRequests,
      view, setView, logout, deactivateAccount, deleteAccount, isDarkMode, toggleDarkMode: () => setIsDarkMode(!isDarkMode),
      userRanks, savedResourceIds: user?.savedResourceIds || [], 
      toggleSaveResource: async (id) => {
        if (user) await updateDoc(doc(db, "users", user.id), { savedResourceIds: user.savedResourceIds.includes(id) ? arrayRemove(id) : arrayUnion(id) });
      },
      handleVote: () => {}, addCommentToResource: () => {}, handleCommentVote: () => {}, deleteCommentFromResource: async () => {},
      addForumPost: () => {}, handlePostVote: () => {}, deleteForumPost: async () => {},
      addReplyToPost: () => {}, handleReplyVote: () => {}, deleteReplyFromPost: async () => {},
      toggleVerifiedAnswer: () => {}, addResourceRequest: () => {}, deleteResourceRequest: async () => {},
      openUploadForRequest: () => {}, toggleUserSubscription: () => {}, toggleLecturerSubscription: () => {}, toggleCourseCodeSubscription: () => {},
      updateUserProfile: async (d) => { if (user) await updateDoc(doc(db, "users", user.id), d); },
      sendMessage: () => {}, editMessage: () => {}, deleteMessage: () => {},
      startConversation: () => {}, sendDirectMessageToUser: () => {}, markNotificationAsRead: () => {},
      markAllNotificationsAsRead: () => {}, clearAllNotifications: () => {}, markMessagesAsRead: () => {},
      goBack, deleteResource: async (id) => { if (db) await deleteDoc(doc(db, "resources", id)); },
      hasUnreadMessages: false, hasUnreadDiscussions: false, isLoading, areResourcesLoading,
      scrollTargetId, setScrollTargetId, showToast
    }}>
      <div className={`${isDarkMode ? 'dark' : ''} min-h-screen bg-slate-50 dark:bg-dark-bg transition-colors duration-300 flex flex-col`}>
        <Header onUploadClick={() => setIsUploadModalOpen(true)} />
        <div className="flex flex-1 relative">
          <SideNav />
          <main className="flex-1 ml-20 transition-all duration-300 min-h-[calc(100vh-5rem)]">
            <div className="pt-4 px-4 md:px-8 pb-8">
                {view === 'dashboard' && <DashboardPage />}
                {view === 'profile' && user && <ProfilePage user={user} allResources={resources} isCurrentUser={true} />}
                {view === 'publicProfile' && selectedId && <ProfilePage user={users.find(u => u.id === selectedId) || user!} allResources={resources} isCurrentUser={selectedId === user?.id} />}
                {view === 'resourceDetail' && (resources.find(r => r.id === selectedId) ? <ResourceDetailPage resource={resources.find(r => r.id === selectedId)!} /> : <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary-500" size={40} /></div>)}
                {view === 'discussions' && <DiscussionsPage />}
                {view === 'forumDetail' && (forumPosts.find(p => p.id === selectedId) ? <ForumPostDetailPage post={forumPosts.find(p => p.id === selectedId)!} /> : <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary-500" size={40} /></div>)}
                {view === 'requests' && <ResourceRequestsPage />}
                {view === 'messages' && <MessagesPage activeConversationId={selectedId || null} />}
                {view === 'leaderboard' && <LeaderboardPage />}
            </div>
          </main>
        </div>
        {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} onUpload={handleUpload} isLoading={isUploading} />}
        {toast && <ToastNotification message={toast.message} points={toast.points} type={toast.type} onClose={() => setToast(null)} />}
        {runTour && <TooltipGuide targetSelector={tourSteps[tourStep]?.selector || 'body'} content={tourSteps[tourStep]?.content || ''} currentStep={tourStep + 1} totalSteps={tourSteps.length} onNext={() => tourStep < tourSteps.length - 1 ? setTourStep(tourStep + 1) : setRunTour(false)} onPrev={() => setTourStep(Math.max(0, tourStep - 1))} onSkip={() => setRunTour(false)} />}
      </div>
    </AppContext.Provider>
  );
};

export default App;
