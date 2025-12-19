
import React, { useState, useMemo, useEffect } from 'react';
import type { User, Resource, ForumPost, Comment, ForumReply, Notification, Conversation, DirectMessage, ResourceRequest, Attachment, CommunityReport } from './types';
import { NotificationType, MessageStatus, ResourceRequestStatus, ReportStatus } from './types';
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
import TooltipGuide from './components/TooltipGuide';

// Firebase Imports
import { auth, db, storage } from './services/firebase';
import * as firebaseAuth from 'firebase/auth';
import { 
  collection, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  onSnapshot, query, orderBy, arrayUnion, increment, where, arrayRemove, deleteField, writeBatch 
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
  reports: CommunityReport[];
  view: View;
  setView: (view: View, id?: string, options?: { replace?: boolean }) => void;
  logout: () => void;
  deleteAccount: () => Promise<void>;
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
  updateUserStatus: (userId: string, status: 'active' | 'banned', reason?: string) => Promise<void>;
  sendMessage: (conversationId: string, text: string) => void;
  editMessage: (messageId: string, newText: string) => void;
  deleteMessage: (messageId: string) => void;
  startConversation: (userId: string, initialMessage?: string) => void;
  sendDirectMessageToUser: (userId: string, text: string) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearAllNotifications: () => void;
  markMessagesAsRead: (conversationId: string) => void;
  resolveReport: (reportId: string, status: ReportStatus) => Promise<void>;
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

const MASTER_ADMIN_EMAILS = [
  'b09220024@student.unimy.edu.my', 
];

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

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [areResourcesLoading, setAreResourcesLoading] = useState(true);
  const [view, setViewState] = useState<View>('dashboard');
  const [viewHistory, setViewHistory] = useState<{ view: View; id?: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);
  const [banError, setBanError] = useState<string | null>(null);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('examvault_theme');
    return savedTheme === 'dark';
  });
  
  const [users, setUsers] = useState<User[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [resourceRequests, setResourceRequests] = useState<ResourceRequest[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; points?: number; type?: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', points?: number) => {
    setToast({ message, type, points });
  };

  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userRef = doc(db, "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          
          const email = firebaseUser.email || "";
          const isPermittedAdmin = MASTER_ADMIN_EMAILS.includes(email) || !email.includes('student.'); 

          if (userSnap.exists()) {
            const userData = userSnap.data() as User;
            
            // Check for ban status
            if (userData.status === 'banned') {
              setBanError(`This account has been restricted: ${userData.banReason || 'No reason specified.'}`);
              await firebaseAuth.signOut(auth);
              setUser(null);
              setIsLoading(false);
              return;
            }

            if (userData.isAdmin !== isPermittedAdmin) {
                await updateDoc(userRef, { isAdmin: isPermittedAdmin });
                userData.isAdmin = isPermittedAdmin;
            }
            setUser(userData);
          } else {
            const displayName = firebaseUser.displayName || "Student";
            const newUser: User = {
              id: firebaseUser.uid,
              name: displayName,
              email: email,
              avatarUrl: generateDefaultAvatar(displayName),
              joinDate: new Date().toISOString(),
              bio: "Academic explorer on ExamVault.",
              points: 0,
              weeklyPoints: 0,
              uploadCount: 0,
              course: "General",
              currentYear: 1,
              currentSemester: 1,
              subscriptions: { users: [], lecturers: [], courseCodes: [] },
              savedResourceIds: [],
              isAdmin: isPermittedAdmin,
              status: 'active'
            };
            await setDoc(userRef, newUser);
            setUser(newUser);
          }
        } catch (error) {
          console.error("User fetch error:", error);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    setAreResourcesLoading(true);

    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      setUsers(snapshot.docs.map(d => d.data() as User));
    });

    const unsubResources = onSnapshot(query(collection(db, "resources"), orderBy("uploadDate", "desc")), (snapshot) => {
      setResources(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Resource)));
      setAreResourcesLoading(false);
    });

    const unsubPosts = onSnapshot(query(collection(db, "forumPosts"), orderBy("timestamp", "desc")), (snapshot) => {
      setForumPosts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ForumPost)));
    });

    const unsubRequests = onSnapshot(query(collection(db, "resourceRequests"), orderBy("timestamp", "desc")), (snapshot) => {
      setResourceRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ResourceRequest)));
    });

    const unsubConvos = onSnapshot(query(collection(db, "conversations"), where("participants", "array-contains", user.id)), (snapshot) => {
      setConversations(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Conversation)));
    });

    const unsubMessages = onSnapshot(query(collection(db, "directMessages"), orderBy("timestamp", "asc")), (snapshot) => {
        setDirectMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DirectMessage)));
    });

    const unsubNotifs = onSnapshot(query(collection(db, "notifications"), where("recipientId", "==", user.id)), (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    });

    let unsubReports = () => {};
    if (user.isAdmin) {
       unsubReports = onSnapshot(query(collection(db, "reports"), orderBy("timestamp", "desc")), (snapshot) => {
          setReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CommunityReport)));
       });
    }

    return () => {
      unsubUsers(); unsubResources(); unsubPosts(); unsubRequests(); unsubConvos(); unsubMessages(); unsubNotifs(); unsubReports();
    };
  }, [user?.id, user?.isAdmin]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('examvault_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('examvault_theme', 'light');
    }
  }, [isDarkMode]);

  const setView = (newView: View, id?: string, options?: { replace?: boolean }) => {
    if (!options?.replace) setViewHistory(prev => [...prev, { view: newView, id }]);
    setViewState(newView);
    setSelectedId(id);
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    if (viewHistory.length > 1) {
      const newHistory = [...viewHistory];
      newHistory.pop(); 
      const previous = newHistory[newHistory.length - 1];
      setViewHistory(newHistory);
      setViewState(previous.view);
      setSelectedId(previous.id);
    } else setViewState('dashboard');
  };

  const logout = async () => {
    await firebaseAuth.signOut(auth);
    setUser(null);
    setViewState('dashboard');
  };

  const deleteAccount = async () => {
    if (!user || !auth.currentUser || !db) return;
    try {
      await deleteDoc(doc(db, "users", user.id));
      await firebaseAuth.deleteUser(auth.currentUser);
      setUser(null);
      setViewState('dashboard');
      showToast("Account deleted.", "info");
    } catch (error: any) {
      showToast("Session expired. Please log out and back in.", "error");
    }
  };

  const resolveReport = async (reportId: string, status: ReportStatus) => {
    if (!db || !user?.isAdmin) return;
    await updateDoc(doc(db, "reports", reportId), { status });
    showToast(`Report ${status}`, "info");
  };

  const updateUserStatus = async (userId: string, status: 'active' | 'banned', reason?: string) => {
    if (!db || !user?.isAdmin) return;
    await updateDoc(doc(db, "users", userId), { status, banReason: reason || "" });
    showToast(`User ${status === 'banned' ? 'restricted' : 'activated'}`, "success");
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
            ...resourceData,
            author: sanitizeForFirestore(user), 
            uploadDate: new Date().toISOString(),
            upvotes: 0, downvotes: 0, upvotedBy: [], downvotedBy: [], comments: [],
            fileUrl: downloadURL, fileName: file.name, previewImageUrl: previewUrl,
            mimeType: file.type, contentForAI: "Shared through ExamVault.",
        };

        await addDoc(collection(db, "resources"), sanitizeForFirestore(newResource));
        setIsUploadModalOpen(false);
        showToast("Resource shared!", "success", 25);
    } catch (error) {
        showToast("Upload failed.", "error");
    } finally { setIsUploading(false); }
  };

  const userRanks = useMemo(() => {
    const sorted = [...users].sort((a, b) => b.points - a.points);
    const ranks = new Map<string, number>();
    sorted.forEach((u, index) => ranks.set(u.id, index));
    return ranks;
  }, [users]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-bg"><Loader2 className="animate-spin text-primary-600" size={48} /></div>;
  
  if (!user) return <div className="min-h-screen">
    <AuthPage onLogin={() => {}} />
    {banError && (
      <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-2xl border-t-4 border-red-500 max-w-md text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-6">{banError}</p>
          <button onClick={() => setBanError(null)} className="bg-primary-600 text-white font-bold py-2 px-6 rounded-lg">Dismiss</button>
        </div>
      </div>
    )}
  </div>;

  const activePost = forumPosts.find(p => p.id === selectedId);
  const activeResource = resources.find(r => r.id === selectedId);

  return (
    <AppContext.Provider value={{
      user, users, resources, forumPosts, notifications, conversations, directMessages, resourceRequests, reports,
      view, setView, logout, deleteAccount, isDarkMode, toggleDarkMode: () => setIsDarkMode(!isDarkMode),
      userRanks, savedResourceIds: user.savedResourceIds || [], 
      toggleSaveResource: async (id) => {
        const isSaved = user.savedResourceIds.includes(id);
        await updateDoc(doc(db, "users", user.id), { savedResourceIds: isSaved ? arrayRemove(id) : arrayUnion(id) });
      },
      handleVote: async (id, act) => {}, 
      addCommentToResource: async (id, txt, par) => {}, 
      handleCommentVote: async (id, cid) => {},
      deleteCommentFromResource: async (rid, c) => {
        if (!user.isAdmin && user.id !== c.author.id) return;
        await updateDoc(doc(db, "resources", rid), { comments: arrayRemove(c) });
        showToast("Comment deleted", "success");
      },
      addForumPost: async (p) => {}, 
      handlePostVote: async (id, act) => {},
      deleteForumPost: async (id) => {
          await deleteDoc(doc(db, "forumPosts", id));
          showToast("Post deleted", "success");
          setView('discussions');
      },
      addReplyToPost: async (id, txt, par, f) => {}, 
      handleReplyVote: async (id, rid) => {},
      deleteReplyFromPost: async (pid, r) => {
          if (!user.isAdmin && user.id !== r.author.id) return;
          await updateDoc(doc(db, "forumPosts", pid), { replies: arrayRemove(r) });
          showToast("Reply deleted", "success");
      },
      toggleVerifiedAnswer: async (id, rid) => {},
      addResourceRequest: async (r) => {}, 
      deleteResourceRequest: async (id) => {
          await deleteDoc(doc(db, "resourceRequests", id));
          showToast("Request deleted", "success");
      },
      openUploadForRequest: (id) => {},
      toggleUserSubscription: (id) => {}, 
      toggleLecturerSubscription: (l) => {}, 
      toggleCourseCodeSubscription: (c) => {},
      updateUserProfile: (d) => {}, 
      updateUserStatus,
      sendMessage: (cid, txt) => {}, 
      editMessage: (mid, txt) => {}, 
      deleteMessage: (mid) => {},
      startConversation: (id, txt) => {}, 
      sendDirectMessageToUser: (id, txt) => {}, 
      markNotificationAsRead: (id) => {},
      markAllNotificationsAsRead: () => {}, 
      clearAllNotifications: () => {}, 
      markMessagesAsRead: (cid) => {},
      resolveReport,
      goBack, hasUnreadMessages: false, hasUnreadDiscussions: false, isLoading, areResourcesLoading,
      deleteResource: async (id, f, p) => { 
        await deleteDoc(doc(db, "resources", id)); 
        showToast("Deleted.", "info"); 
        if (view === 'resourceDetail') setView('dashboard');
      },
      scrollTargetId, setScrollTargetId, showToast
    }}>
      <div className={`${isDarkMode ? 'dark' : ''} min-h-screen bg-slate-50 dark:bg-dark-bg transition-colors duration-300 flex flex-col`}>
        <Header onUploadClick={() => setIsUploadModalOpen(true)} />
        <div className="flex flex-1">
          <SideNav />
          <main className="flex-1 ml-20 pt-4 px-4 md:px-8 pb-8 transition-all duration-300">
            {view === 'dashboard' && <DashboardPage />}
            {view === 'profile' && <ProfilePage user={user} allResources={resources} isCurrentUser={true} />}
            {view === 'publicProfile' && selectedId && <ProfilePage user={users.find(u => u.id === selectedId) || user} allResources={resources} isCurrentUser={selectedId === user.id} />}
            {view === 'resourceDetail' && (activeResource ? <ResourceDetailPage resource={activeResource} /> : <Loader2 className="animate-spin m-auto" />)}
            {view === 'discussions' && <DiscussionsPage />}
            {view === 'forumDetail' && (activePost ? <ForumPostDetailPage post={activePost} /> : <Loader2 className="animate-spin m-auto" />)}
            {view === 'requests' && <ResourceRequestsPage />}
            {view === 'messages' && <MessagesPage activeConversationId={selectedId || null} />}
            {view === 'leaderboard' && <LeaderboardPage />}
            {view === 'admin' && user.isAdmin && <AdminPage />}
          </main>
        </div>
        {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} onUpload={handleUpload} isLoading={isUploading} />}
        {toast && <ToastNotification message={toast.message} points={toast.points} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </AppContext.Provider>
  );
};

export default App;
