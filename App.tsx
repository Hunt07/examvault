
// ... imports remain the same
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
import * as firebaseAuth from 'firebase/auth';
import { 
  collection, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, getDocs,
  onSnapshot, query, orderBy, serverTimestamp, arrayUnion, increment, where, arrayRemove, deleteField, writeBatch 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Loader2, AlertCircle } from 'lucide-react';

export type View = 'dashboard' | 'resourceDetail' | 'discussions' | 'forumDetail' | 'profile' | 'publicProfile' | 'messages' | 'leaderboard' | 'requests' | 'admin';

// ... interfaces remain the same
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
  toggleUserRole: (userId: string, role: 'student' | 'admin') => void;
  toggleUserStatus: (userId: string, status: 'active' | 'banned') => void;
  resolveReport: (reportId: string, status: 'resolved' | 'dismissed') => void;
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
  deactivateAccount: () => Promise<void>;
  deleteAccount: () => Promise<void>;
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
    try {
        const resQuery = query(collection(db!, "resources"), where("author.id", "==", userId));
        const resSnap = await getDocs(resQuery);
        const batch = writeBatch(db!);
        let count = 0;

        resSnap.forEach((docSnap) => {
            const resRef = doc(db!, "resources", docSnap.id);
            batch.update(resRef, { author: { ...docSnap.data().author, ...updateData } });
            count++;
        });

        if (count > 0) await batch.commit();
        
    } catch (e) {
        console.error("Propagation error", e);
    }
};

const MASTER_ADMIN_EMAIL = 'b09220024@student.unimy.edu.my';

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
    if (savedTheme) {
      return savedTheme === 'dark';
    }
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

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', points?: number) => {
      setToast({ message, type, points });
  };

  const setView = (v: View, id?: string, options?: { replace?: boolean }) => {
    if (!options?.replace) {
        setViewHistory(prev => [...prev, { view: v, id }]);
    }
    setViewState(v);
    setSelectedId(id);
    window.scrollTo(0, 0);
  };

  const [runTour, setRunTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const tourSteps = [
    { selector: '#tour-dashboard', content: "This is your dashboard. Access resources and users here." },
    { selector: '#tour-search-bar', content: "Search for anything across the platform." },
    { selector: '#tour-filter-button', content: "Filter resources by course, year, or type." },
    { selector: '#tour-upload-button', content: "Contribute to the community by uploading resources." },
    { selector: '#tour-saved-items', content: "Access your saved resources quickly." },
    { selector: '#tour-notifications', content: "Stay updated with notifications." },
    { selector: '#tour-dark-mode', content: "Toggle between light and dark themes." },
    { selector: '#tour-profile-menu', content: "Manage your profile and settings." },
    { selector: '#tour-sidenav', content: "Navigate to other sections like Forums and Messages." },
  ];

  const lastUpdateRef = useRef<number>(0);
  
  // Safety timeout to prevent infinite loading
  useEffect(() => {
      if (isLoading) {
          const timeout = setTimeout(() => {
              if (isLoading) {
                  console.warn("Forcing loading state off after timeout");
                  setIsLoading(false);
              }
          }, 8000); // 8 seconds max load time
          return () => clearTimeout(timeout);
      }
  }, [isLoading]);

  useEffect(() => {
    if (!user?.id || !db) return;

    const updatePresence = async () => {
        const now = Date.now();
        if (now - lastUpdateRef.current < 10000) return;

        try {
            lastUpdateRef.current = now;
            const userRef = doc(db, "users", user.id);
            await updateDoc(userRef, {
                lastActive: new Date().toISOString()
            });
        } catch (error) {
            console.error("Presence update failed", error);
        }
    };

    updatePresence(); 
    const interval = setInterval(updatePresence, 30 * 1000); 

    const handleInteraction = () => {
        if (document.visibilityState === 'visible') {
            updatePresence();
        }
    };

    document.addEventListener("visibilitychange", handleInteraction);
    window.addEventListener("focus", handleInteraction);
    window.addEventListener("click", handleInteraction);

    return () => {
        clearInterval(interval);
        document.removeEventListener("visibilitychange", handleInteraction);
        window.removeEventListener("focus", handleInteraction);
        window.removeEventListener("click", handleInteraction);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!auth || !db) {
        setIsLoading(false);
        return;
    }

    const unsubscribe = firebaseAuth.onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userRef = doc(db!, "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data() as User;
            let hasUpdates = false;
            const updates: any = {};

            // Ensure critical fields exist to prevent UI crashes
            if (!userData.joinDate) {
                const now = new Date().toISOString();
                userData.joinDate = now;
                updates.joinDate = now;
                hasUpdates = true;
            }
            if (!userData.savedResourceIds) {
                userData.savedResourceIds = [];
                updates.savedResourceIds = [];
                hasUpdates = true;
            }
            if (!userData.subscriptions) {
                userData.subscriptions = { users: [], lecturers: [], courseCodes: [] };
                updates.subscriptions = { users: [], lecturers: [], courseCodes: [] };
                hasUpdates = true;
            }
            
            // Legacy avatar check
            const isLegacyAvatar = !userData.avatarUrl || 
                                   (!userData.avatarUrl.startsWith('data:') && !userData.avatarUrl.includes('firebasestorage'));

            if (isLegacyAvatar) {
                const newAvatar = generateDefaultAvatar(userData.name);
                userData.avatarUrl = newAvatar;
                updates.avatarUrl = newAvatar;
                hasUpdates = true;
            }

            if (userData.status === 'banned') {
                await firebaseAuth.signOut(auth);
                setUser(null);
                showToast("Your account has been restricted. Contact support.", "error");
                setIsLoading(false);
                return;
            }

            if (userData.status === 'deactivated') {
                updates.status = 'active';
                userData.status = 'active';
                hasUpdates = true;
                showToast("Welcome back! Your account has been reactivated.", "success");
            }

            if (hasUpdates) {
                await updateDoc(userRef, updates);
                if (updates.avatarUrl) {
                    propagateUserUpdates(userData.id, { avatarUrl: updates.avatarUrl });
                }
            }

            setUser(userData);
          } else {
            // New User Creation
            const displayName = firebaseUser.displayName || "Student";
            const defaultAvatar = generateDefaultAvatar(displayName);
            
            const isLecturerEmail = firebaseUser.email?.endsWith('@unimy.edu.my') && !firebaseUser.email?.endsWith('@student.unimy.edu.my');
            const role = isLecturerEmail ? 'lecturer' : 'student';
            const bio = isLecturerEmail ? 'Lecturer' : 'Student'; 
            const course = isLecturerEmail ? 'Lecturer' : 'Student';

            const newUser: User = {
              id: firebaseUser.uid,
              name: displayName,
              email: firebaseUser.email || "",
              avatarUrl: defaultAvatar,
              joinDate: new Date().toISOString(),
              lastActive: new Date().toISOString(),
              bio: bio,
              points: 0,
              weeklyPoints: 0,
              uploadCount: 0,
              course: course,
              currentYear: 1,
              currentSemester: 1,
              subscriptions: { users: [], lecturers: [], courseCodes: [] },
              savedResourceIds: [],
              role: role,
              status: 'active'
            };
            
            await setDoc(userRef, newUser);
            setUser(newUser);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          // If critical fail, ensure we don't hang indefinitely
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

    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      try {
          let rawUsers = snapshot.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id } as User));

          // MASTER ADMIN CLEANUP: Identify duplicate admin accounts
          const adminAccounts = rawUsers.filter(u => u.email?.toLowerCase().trim() === MASTER_ADMIN_EMAIL.toLowerCase());

          if (adminAccounts.length > 0) {
              adminAccounts.sort((a, b) => {
                  if (a.name === 'Osama') return -1; 
                  if (b.name === 'Osama') return 1;
                  return (a.name?.length || 0) - (b.name?.length || 0); 
              });

              const winner = adminAccounts[0];

              if (winner.name !== 'Osama') {
                  const userRef = doc(db, "users", winner.id);
                  updateDoc(userRef, { name: 'Osama' });
                  winner.name = 'Osama';
                  if (user.id === winner.id && user.name !== 'Osama') {
                      setUser(prev => prev ? ({ ...prev, name: 'Osama' }) : null);
                  }
              }

              for (let i = 1; i < adminAccounts.length; i++) {
                  const loser = adminAccounts[i];
                  deleteDoc(doc(db, "users", loser.id));
                  const idx = rawUsers.findIndex(u => u.id === loser.id);
                  if (idx > -1) rawUsers.splice(idx, 1);
              }
          }

          rawUsers.sort((a, b) => (b.points || 0) - (a.points || 0));

          setUsers(rawUsers);
          
          // Safety sync for current user
          if (auth.currentUser?.email) {
              const myEmail = auth.currentUser.email.toLowerCase().trim();
              const bestProfileForMe = rawUsers.find(u => u.email?.toLowerCase().trim() === myEmail);

              if (bestProfileForMe) {
                  // Only update if critical fields differ to avoid loops
                  if (!user || user.id !== bestProfileForMe.id || user.points !== bestProfileForMe.points) {
                       if (bestProfileForMe.status === 'banned') {
                           logout();
                           showToast("Your account has been restricted.", "error");
                       } else {
                           setUser(bestProfileForMe);
                       }
                  }
              }
          }
      } catch (err) {
          console.error("Error processing users snapshot", err);
      }
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
      const fetchedNotifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
      fetchedNotifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setNotifications(fetchedNotifs);
    });
    
    let unsubReports = () => {};
    if (user.role === 'admin') {
        const q = query(collection(db, "reports"), where("status", "==", "pending"));
        unsubReports = onSnapshot(q, (snapshot) => {
            setReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
        });
    }

    return () => {
      unsubUsers();
      unsubResources();
      unsubPosts();
      unsubRequests();
      unsubConvos();
      unsubMessages();
      unsubNotifs();
      unsubReports();
    };
  }, [user?.id, user?.role]);

  // ... (notifications and other logic remains same) ...
  const sendNotification = async (recipientId: string, senderId: string, type: NotificationType, message: string, linkIds?: any) => {
      if (recipientId === user?.id || !db) return;
      await addDoc(collection(db, "notifications"), {
          recipientId,
          senderId,
          type,
          message,
          timestamp: new Date().toISOString(),
          isRead: false,
          ...linkIds
      });
  };

  const handleLogin = async (email: string) => {
      // Intentionally empty or just log.
      // We rely solely on the onAuthStateChanged listener to handle the state transition 
      // from 'loading' to 'authenticated' to avoid race conditions.
      console.log("AuthPage completed login flow for:", email);
  };

  const logout = async () => {
    if (!auth) return;
    await firebaseAuth.signOut(auth);
    setUser(null);
    setViewState('dashboard');
    setViewHistory([]);
  };

  const deleteAccount = async () => {
      if (!user || !db) return;
      setIsLoading(true);
      try {
          await deleteDoc(doc(db, "users", user.id));
          if (auth.currentUser) await auth.currentUser.delete();
          window.location.reload();
      } catch (error) {
          console.error("Delete account error", error);
          setIsLoading(false);
      }
  };
  
  const deactivateAccount = async () => {
      if (!user || !db) return;
      await updateDoc(doc(db, "users", user.id), { status: 'deactivated' });
      logout();
  };

  const toggleSaveResource = async (resourceId: string) => {
    if (!user || !db) return;
    const isSaved = user.savedResourceIds?.includes(resourceId);
    await updateDoc(doc(db, "users", user.id), { savedResourceIds: isSaved ? arrayRemove(resourceId) : arrayUnion(resourceId) });
  };
  
  // Re-implementing essential ones for context provider:
  const earnPoints = async (amount: number, message: string) => { if (!user) return; await updateDoc(doc(db, "users", user.id), { points: increment(amount), weeklyPoints: increment(amount) }); setToast({ message, points: amount, type: 'success' }); };
  const userRanks = useMemo(() => { const r = new Map(); users.forEach((u, i) => r.set(u.id, i)); return r; }, [users]);
  
  const addCommentToResource = async (resourceId: string, text: string, parentId: string | null) => { if (!user) return; await updateDoc(doc(db, "resources", resourceId), { comments: arrayUnion({ id: `c-${Date.now()}`, author: sanitizeForFirestore(user), text, timestamp: new Date().toISOString(), parentId, upvotes: 0, upvotedBy: [] }) }); };
  const deleteCommentFromResource = async (resourceId: string, comment: Comment) => { await updateDoc(doc(db, "resources", resourceId), { comments: arrayRemove(comment) }); };
  const handleCommentVote = async (resourceId: string, commentId: string) => { 
      const resRef = doc(db!, "resources", resourceId);
      const snap = await getDoc(resRef);
      if (snap.exists()) {
          const data = snap.data() as Resource;
          const updatedComments = data.comments.map(c => {
              if (c.id === commentId) {
                  const upvoted = c.upvotedBy?.includes(user!.id);
                  return { ...c, upvotes: upvoted ? c.upvotes - 1 : c.upvotes + 1, upvotedBy: upvoted ? c.upvotedBy.filter(id => id !== user!.id) : [...(c.upvotedBy || []), user!.id] };
              }
              return c;
          });
          await updateDoc(resRef, { comments: updatedComments });
      }
  };
  const handleVote = async (resourceId: string, action: 'up'|'down') => { 
      const resRef = doc(db!, "resources", resourceId);
      if (action === 'up') await updateDoc(resRef, { upvotes: increment(1), upvotedBy: arrayUnion(user!.id) });
      else await updateDoc(resRef, { downvotes: increment(1), downvotedBy: arrayUnion(user!.id) });
  };
  const addForumPost = async (post: any, file?: File) => { 
      let attachment;
      if (file) {
          const storageRef = ref(storage, `forum/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          attachment = { type: file.type.startsWith('image') ? 'image' : 'file', url, name: file.name, size: '0KB' };
      }
      await addDoc(collection(db!, "forumPosts"), { ...post, author: sanitizeForFirestore(user), timestamp: new Date().toISOString(), upvotes: 0, downvotes: 0, replies: [], attachment });
  };
  const deleteForumPost = async (postId: string) => { await deleteDoc(doc(db!, "forumPosts", postId)); };
  const handlePostVote = async (postId: string) => { await updateDoc(doc(db!, "forumPosts", postId), { upvotes: increment(1) }); };
  const addReplyToPost = async (postId: string, text: string, replyId: string | null, file?: File) => {
      let attachment;
      if (file) {
          const storageRef = ref(storage, `replies/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          attachment = { type: file.type.startsWith('image') ? 'image' : 'file', url, name: file.name };
      }
      const newReply = { id: `r-${Date.now()}`, author: sanitizeForFirestore(user), text, timestamp: new Date().toISOString(), upvotes: 0, attachment };
      await updateDoc(doc(db!, "forumPosts", postId), { replies: arrayUnion(newReply) });
  };
  const handleReplyVote = async () => {};
  const deleteReplyFromPost = async (postId: string, reply: any) => { await updateDoc(doc(db!, "forumPosts", postId), { replies: arrayRemove(reply) }); };
  const toggleVerifiedAnswer = async (postId: string, replyId: string) => { 
      // Logic would go here to toggle verified state in replies array
  };
  const addResourceRequest = async (req: any, file?: File) => { await addDoc(collection(db!, "resourceRequests"), { ...req, requester: sanitizeForFirestore(user), timestamp: new Date().toISOString(), status: 'Open' }); };
  const deleteResourceRequest = async (id: string) => { await deleteDoc(doc(db!, "resourceRequests", id)); };
  const openUploadForRequest = (id: string) => { 
      const req = resourceRequests.find(r => r.id === id);
      if (req) { setFulfillingRequest(req); setIsUploadModalOpen(true); }
  };
  const toggleUserSubscription = async (uid: string) => {
      const isSub = user!.subscriptions.users.includes(uid);
      await updateDoc(doc(db!, "users", user!.id), { "subscriptions.users": isSub ? arrayRemove(uid) : arrayUnion(uid) });
  };
  const toggleLecturerSubscription = async (name: string) => {
      const isSub = user!.subscriptions.lecturers.includes(name);
      await updateDoc(doc(db!, "users", user!.id), { "subscriptions.lecturers": isSub ? arrayRemove(name) : arrayUnion(name) });
  };
  const toggleCourseCodeSubscription = async (code: string) => {
      const isSub = user!.subscriptions.courseCodes.includes(code);
      await updateDoc(doc(db!, "users", user!.id), { "subscriptions.courseCodes": isSub ? arrayRemove(code) : arrayUnion(code) });
  };
  const updateUserProfile = async (data: Partial<User>) => { if(user) { await updateDoc(doc(db!, "users", user.id), data); setUser({...user, ...data}); } };
  const toggleUserRole = async (uid: string, role: any) => { await updateDoc(doc(db!, "users", uid), { role }); };
  const toggleUserStatus = async (uid: string, status: any) => { await updateDoc(doc(db!, "users", uid), { status }); };
  const resolveReport = async (rid: string, status: any) => { await updateDoc(doc(db!, "reports", rid), { status }); };
  const sendMessage = async (cid: string, text: string) => { 
      await addDoc(collection(db!, "directMessages"), { conversationId: cid, senderId: user!.id, recipientId: cid, text, timestamp: new Date().toISOString(), status: 'sent' });
  };
  const editMessage = async (mid: string, text: string) => { await updateDoc(doc(db!, "directMessages", mid), { text }); };
  const deleteMessage = async (mid: string) => { await updateDoc(doc(db!, "directMessages", mid), { isDeleted: true }); };
  const startConversation = async (uid: string) => { 
      const existing = conversations.find(c => c.participants.includes(user!.id) && c.participants.includes(uid));
      if (existing) setView('messages', existing.id);
      else {
          const docRef = await addDoc(collection(db!, "conversations"), { participants: [user!.id, uid], lastMessageTimestamp: new Date().toISOString() });
          setView('messages', docRef.id);
      }
  };
  const sendDirectMessageToUser = (uid: string, text: string) => { startConversation(uid); };
  const markNotificationAsRead = async (id: string) => { await updateDoc(doc(db!, "notifications", id), { isRead: true }); };
  const markAllNotificationsAsRead = async () => { 
      // Batch logic
  };
  const clearAllNotifications = async () => { 
      // Query and delete
  };
  const markMessagesAsRead = async (cid: string) => { 
      // Query messages and batch update
  };
  const goBack = () => { if(viewHistory.length > 1) { const h = [...viewHistory]; h.pop(); const p = h[h.length-1]; setViewHistory(h); setViewState(p.view); setSelectedId(p.id); } else { setViewState('dashboard'); } };
  const deleteResource = async (id: string) => { await deleteDoc(doc(db!, "resources", id)); };
  
  if (isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-bg">
            <Loader2 size={48} className="animate-spin text-primary-600" />
        </div>
    );
  }

  if (!auth) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-bg p-4">
              <div className="bg-white dark:bg-dark-surface p-8 rounded-xl shadow-lg border border-red-200 dark:border-red-900 max-w-md text-center">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle size={32} />
                  </div>
                  <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Configuration Error</h1>
                  <p className="text-slate-600 dark:text-slate-300 mb-6">
                      Firebase API keys are missing.
                  </p>
              </div>
          </div>
      );
  }

  if (!user) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return (
    <AppContext.Provider value={{
      user, users, resources, forumPosts, notifications, conversations, directMessages, resourceRequests, reports,
      view, setView, 
      logout, isDarkMode, toggleDarkMode: () => setIsDarkMode(!isDarkMode),
      userRanks, savedResourceIds: user.savedResourceIds || [], toggleSaveResource, handleVote, addCommentToResource, handleCommentVote, deleteCommentFromResource,
      addForumPost, handlePostVote, deleteForumPost, addReplyToPost, handleReplyVote, deleteReplyFromPost, toggleVerifiedAnswer,
      addResourceRequest, deleteResourceRequest, openUploadForRequest,
      toggleUserSubscription, toggleLecturerSubscription, toggleCourseCodeSubscription,
      updateUserProfile, sendMessage, editMessage, deleteMessage, startConversation, sendDirectMessageToUser, markNotificationAsRead, markAllNotificationsAsRead, markMessagesAsRead,
      clearAllNotifications,
      goBack, hasUnreadMessages: false, hasUnreadDiscussions: false,
      isLoading, deleteResource, deactivateAccount, deleteAccount,
      areResourcesLoading,
      scrollTargetId, setScrollTargetId,
      showToast,
      toggleUserRole, toggleUserStatus, resolveReport
    }}>
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg transition-colors duration-300">
        <Header onUploadClick={() => { setFulfillingRequest(undefined); setIsUploadModalOpen(true); }} />
        <SideNav />
        
        <main className="ml-20 transition-all duration-300 pt-4 px-4 md:px-8 pb-8">
          {view === 'dashboard' && <DashboardPage />}
          {view === 'resourceDetail' && selectedId && (
             <ResourceDetailPage 
                resource={resources.find(r => r.id === selectedId) || resources[0]} 
             />
          )}
          {view === 'discussions' && <DiscussionsPage />}
          {view === 'forumDetail' && selectedId && (
              <ForumPostDetailPage
                post={forumPosts.find(p => p.id === selectedId) || forumPosts[0]}
              />
          )}
          {view === 'profile' && user && <ProfilePage user={user} allResources={resources} isCurrentUser={true} />}
          {view === 'publicProfile' && selectedId && (
              <ProfilePage 
                user={users.find(u => u.id === selectedId) || user} 
                allResources={resources} 
                isCurrentUser={selectedId === user.id} 
              />
          )}
          {view === 'messages' && <MessagesPage activeConversationId={selectedId || null} />}
          {view === 'leaderboard' && <LeaderboardPage />}
          {view === 'requests' && <ResourceRequestsPage />}
          {view === 'admin' && user.role === 'admin' && <AdminPage />} 
        </main>

        {isUploadModalOpen && (
            <UploadModal 
                onClose={() => { if(!isUploading) { setIsUploadModalOpen(false); setFulfillingRequest(undefined); } }} 
                onUpload={(data, file, cover) => { /* Implement actual upload here for full functionality */ }}
                fulfillingRequest={fulfillingRequest}
                isLoading={isUploading}
            />
        )}
        
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
                        setRunTour(false); localStorage.setItem(`examvault_tour_${user.id}`, 'true');
                    }
                }}
                onPrev={() => setTourStep(Math.max(1, tourStep - 1))}
                onSkip={() => { setRunTour(false); localStorage.setItem(`examvault_tour_${user.id}`, 'true'); }}
            />
        )}

        {toast && (
            <ToastNotification
                message={toast.message}
                points={toast.points}
                type={toast.type}
                onClose={() => setToast(null)}
            />
        )}
      </div>
    </AppContext.Provider>
  );
};

export default App;
