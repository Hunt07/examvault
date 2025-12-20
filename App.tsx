
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
  const [rawResources, setRawResources] = useState<Resource[]>([]);
  const [rawForumPosts, setRawForumPosts] = useState<ForumPost[]>([]);
  const [rawRequests, setRawRequests] = useState<ResourceRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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

  const activeUserIds = useMemo(() => {
    return new Set(users.filter(u => !u.status || u.status === 'active').map(u => u.id));
  }, [users]);

  const resources = useMemo(() => rawResources.filter(r => activeUserIds.has(r.author.id) || (user && r.author.id === user.id)), [rawResources, activeUserIds, user]);
  const forumPosts = useMemo(() => rawForumPosts.filter(p => activeUserIds.has(p.author.id) || (user && p.author.id === user.id)), [rawForumPosts, activeUserIds, user]);
  const resourceRequests = useMemo(() => rawRequests.filter(r => activeUserIds.has(r.requester.id) || (user && r.requester.id === user.id)), [rawRequests, activeUserIds, user]);

  useEffect(() => {
    if (!auth || !db) { setIsLoading(false); return; }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (isExiting.current) return;

      if (firebaseUser) {
        try {
          const userRef = doc(db!, "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          const isMaster = MASTER_ADMIN_EMAILS.includes(firebaseUser.email || '');

          if (userSnap.exists()) {
            const userData = userSnap.data() as User;
            
            if (userData.status === 'deactivated') {
                const hasLoginIntent = sessionStorage.getItem('examvault_login_intent') === 'true';
                if (hasLoginIntent) {
                    await updateDoc(userRef, { status: 'active' });
                    userData.status = 'active';
                    sessionStorage.removeItem('examvault_login_intent');
                    showToast("Welcome back! Your account has been reactivated.", "success");
                    setUser(userData);
                } else {
                    await signOut(auth);
                    setUser(null);
                }
            } else {
                if (isMaster && !userData.isAdmin) {
                    await updateDoc(userRef, { isAdmin: true });
                    userData.isAdmin = true;
                }
                setUser(userData);
            }
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
        } catch (error) { 
            console.error("Auth fetch error:", error); 
            setUser(null);
        }
      } else { 
          setUser(null); 
          setViewState('dashboard'); 
      }
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

  const logout = async () => {
    if (!auth) return;
    isExiting.current = true;
    try {
        setUser(null);
        setViewState('dashboard');
        setViewHistory([]);
        await signOut(auth);
    } catch (e) {
        console.error("Sign out failed:", e);
    } finally {
        isExiting.current = false;
    }
  };

  const deactivateAccount = async () => {
    if (!user || !db) return;
    const userId = user.id;
    try {
        isExiting.current = true;
        setUser(null);
        setViewState('dashboard');
        await updateDoc(doc(db, "users", userId), { status: 'deactivated' });
        await signOut(auth);
        showToast("Account deactivated. Log back in to restore.", "info");
    } catch (e) {
        console.error("Deactivation error:", e);
        isExiting.current = false;
        showToast("Deactivation failed. Please try again.", "error");
    }
  };

  const deleteAccount = async () => {
    if (!user || !db || !auth.currentUser) return;
    const userId = user.id;
    try {
        isExiting.current = true;
        const userToKill = auth.currentUser;
        const batch = writeBatch(db);

        // CLEAR LOCAL FLAGS so the tour restarts on next login
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
        setUser(null); 
        setViewState('dashboard');
        await deleteUser(userToKill);
        showToast("Account purged permanently.", "info");
    } catch (error: any) {
        console.error("Purge failed:", error);
        isExiting.current = false;
        if (error.code === 'auth/requires-recent-login') {
            showToast("Please log in again before deleting your account.", "error");
            await logout();
        } else {
            showToast("Failed to delete account.", "error");
        }
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
      if (!hasSeenTour) {
        setRunTour(true);
        setTourStep(1);
      }
    }
  }, [user, isLoading]);

  const finishTour = () => {
    setRunTour(false);
    if (user) {
      localStorage.setItem(`examvault_tour_${user.id}`, 'true');
    }
  };

  if (isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-bg">
            <Loader2 size={48} className="animate-spin text-primary-600" />
        </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg transition-colors duration-300">
        <AuthPage onLogin={() => {}} />
      </div>
    );
  }

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
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg transition-colors duration-300 flex flex-col">
        <Header onUploadClick={() => setIsUploadModalOpen(true)} />
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
        {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} onUpload={() => {}} isLoading={isUploading} />}
        {runTour && (
            <TooltipGuide
                targetSelector={tourSteps[tourStep - 1]?.selector || 'body'}
                content={tourSteps[tourStep - 1]?.content || ''}
                currentStep={tourStep}
                totalSteps={tourSteps.length}
                onNext={() => {
                    if (tourStep < tourSteps.length) {
                        setTourStep(tourStep + 1);
                    } else {
                        finishTour();
                    }
                }}
                onPrev={() => setTourStep(Math.max(1, tourStep - 1))}
                onSkip={finishTour}
            />
        )}
        {toast && <ToastNotification message={toast.message} points={toast.points} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </AppContext.Provider>
  );
};

export default App;
