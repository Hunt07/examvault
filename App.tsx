
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
import { extractTextFromDocx, extractTextFromPptx } from './services/geminiService';

// Firebase Imports
import { auth, db, storage } from './services/firebase';
import * as firebaseAuth from 'firebase/auth';
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

  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="${color}"/>
      <text x="50" y="65" font-family="Arial, sans-serif" font-size="50" font-weight="bold" fill="white" text-anchor="middle">${initial}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;base64,${btoa(svgString)}`;
};

const propagateUserUpdates = async (userId: string, updateData: any) => {
    const resQuery = query(collection(db!, "resources"), where("author.id", "==", userId));
    const resSnap = await getDocs(resQuery);
    const batch = writeBatch(db!);
    let count = 0;

    resSnap.forEach((docSnap) => {
         const resRef = doc(db!, "resources", docSnap.id);
         batch.update(resRef, { author: { ...docSnap.data().author, ...updateData } });
         count++;
    });

    const postQuery = query(collection(db!, "forumPosts"), where("author.id", "==", userId));
    const postSnap = await getDocs(postQuery);
    postSnap.forEach((docSnap) => {
         const postRef = doc(db!, "forumPosts", docSnap.id);
         batch.update(postRef, { author: { ...docSnap.data().author, ...updateData } });
         count++;
    });

    const reqQuery = query(collection(db!, "resourceRequests"), where("requester.id", "==", userId));
    const reqSnap = await getDocs(reqQuery);
    reqSnap.forEach((docSnap) => {
         const reqRef = doc(db!, "resourceRequests", docSnap.id);
         batch.update(reqRef, { requester: { ...docSnap.data().requester, ...updateData } });
         count++;
    });

    if (count > 0) await batch.commit();
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
    return savedTheme === 'dark';
  });
  
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

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', points?: number) => {
      setToast({ message, type, points });
  };

  const [runTour, setRunTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userRef = doc(db!, "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data() as User;
            setUser(userData);
          } else {
            const displayName = firebaseUser.displayName || "Student";
            const newUser: User = {
              id: firebaseUser.uid,
              name: displayName,
              email: firebaseUser.email || "",
              avatarUrl: generateDefaultAvatar(displayName),
              joinDate: new Date().toISOString(),
              bio: "New student at ExamVault.",
              points: 0,
              weeklyPoints: 0,
              uploadCount: 0,
              course: "General",
              currentYear: 1,
              currentSemester: 1,
              subscriptions: { users: [], lecturers: [], courseCodes: [] },
              savedResourceIds: []
            };
            await setDoc(userRef, newUser);
            setUser(newUser);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
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

    return () => {
      unsubUsers(); unsubResources(); unsubPosts(); unsubRequests(); unsubConvos(); unsubMessages(); unsubNotifs();
    };
  }, [user?.id]);

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
      const userId = user.id;
      await deleteDoc(doc(db, "users", userId));
      await firebaseAuth.deleteUser(auth.currentUser);
      setUser(null);
      setViewState('dashboard');
      showToast("Account deleted permanently.", "info");
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        showToast("Please log out and sign in again to confirm account deletion.", "error");
      } else {
        showToast("Failed to delete account.", "error");
      }
    }
  };

  const earnPoints = async (amount: number, message: string) => {
    if (!user || !db) return;
    await updateDoc(doc(db, "users", user.id), {
        points: increment(amount),
        weeklyPoints: increment(amount)
    });
    setToast({ message, points: amount, type: 'success' });
  };

  const userRanks = useMemo(() => {
    const sorted = [...users].sort((a, b) => b.points - a.points);
    const ranks = new Map<string, number>();
    sorted.forEach((u, index) => ranks.set(u.id, index));
    return ranks;
  }, [users]);

  const handleUpload = async (resourceData: any, file: File, coverImage: File | null) => {
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
              mimeType: file.type, contentForAI: "Content extracted on-demand.",
          };

          await addDoc(collection(db, "resources"), sanitizeForFirestore(newResource));
          earnPoints(25, "Resource uploaded!");
          setIsUploadModalOpen(false);
      } catch (error) {
          showToast("Upload failed.", "error");
      } finally { setIsUploading(false); }
  };

  const deleteResource = async (id: string, url: string) => {
    await deleteDoc(doc(db, "resources", id));
    showToast("Resource deleted.", "info");
  };

  const toggleSaveResource = async (resourceId: string) => {
    if (!user || !db) return;
    const isSaved = user.savedResourceIds?.includes(resourceId);
    await updateDoc(doc(db, "users", user.id), {
        savedResourceIds: isSaved ? arrayRemove(resourceId) : arrayUnion(resourceId)
    });
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-bg"><Loader2 className="animate-spin text-primary-600" size={48} /></div>;
  if (!user) return <AuthPage onLogin={() => {}} />;

  return (
    <AppContext.Provider value={{
      user, users, resources, forumPosts, notifications, conversations, directMessages, resourceRequests,
      view, setView, logout, deleteAccount, isDarkMode, toggleDarkMode: () => setIsDarkMode(!isDarkMode),
      userRanks, savedResourceIds: user.savedResourceIds || [], toggleSaveResource,
      handleVote: () => {}, addCommentToResource: () => {}, handleCommentVote: () => {}, deleteCommentFromResource: async () => {},
      addForumPost: () => {}, handlePostVote: () => {}, deleteForumPost: async () => {}, addReplyToPost: () => {},
      handleReplyVote: () => {}, deleteReplyFromPost: async () => {}, toggleVerifiedAnswer: () => {},
      addResourceRequest: () => {}, deleteResourceRequest: async () => {}, openUploadForRequest: () => {},
      toggleUserSubscription: () => {}, toggleLecturerSubscription: () => {}, toggleCourseCodeSubscription: () => {},
      updateUserProfile: () => {}, sendMessage: () => {}, editMessage: () => {}, deleteMessage: () => {},
      startConversation: () => {}, sendDirectMessageToUser: () => {}, markNotificationAsRead: () => {},
      markAllNotificationsAsRead: () => {}, clearAllNotifications: () => {}, markMessagesAsRead: () => {},
      goBack, hasUnreadMessages: false, hasUnreadDiscussions: false, isLoading, deleteResource, areResourcesLoading,
      scrollTargetId, setScrollTargetId, showToast
    }}>
      <div className={`${isDarkMode ? 'dark' : ''} min-h-screen bg-slate-50 dark:bg-dark-bg transition-colors`}>
        <Header onUploadClick={() => setIsUploadModalOpen(true)} />
        <SideNav />
        <main className="ml-20 pt-4 px-4 md:px-8 pb-8">
          {view === 'dashboard' && <DashboardPage />}
          {view === 'profile' && <ProfilePage user={user} allResources={resources} isCurrentUser={true} />}
          {view === 'resourceDetail' && selectedId && <ResourceDetailPage resource={resources.find(r => r.id === selectedId)!} />}
          {view === 'discussions' && <DiscussionsPage />}
          {view === 'requests' && <ResourceRequestsPage />}
          {view === 'messages' && <MessagesPage activeConversationId={selectedId || null} />}
          {view === 'leaderboard' && <LeaderboardPage />}
        </main>
        {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} onUpload={handleUpload} isLoading={isUploading} />}
        {toast && <ToastNotification message={toast.message} points={toast.points} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </AppContext.Provider>
  );
};

export default App;
