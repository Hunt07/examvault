
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
import AdminPage from './components/pages/AdminPage'; // Import Admin Page
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

interface AppContextType {
  user: User | null;
  users: User[];
  resources: Resource[];
  forumPosts: ForumPost[];
  notifications: Notification[];
  conversations: Conversation[];
  directMessages: DirectMessage[];
  resourceRequests: ResourceRequest[];
  reports: Report[]; // Added reports
  view: View;
  setView: (view: View, id?: string, options?: { replace?: boolean }) => void;
  logout: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  userRanks: Map<string, number>;
  savedResourceIds: string[];
  savedPostIds: string[];
  savedRequestIds: string[];
  toggleSaveResource: (resourceId: string) => void;
  toggleSavePost: (postId: string) => void;
  toggleSaveRequest: (requestId: string) => void;
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
  // Admin Functions
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
  deactivateAccount: () => Promise<void>; // Added deactivateAccount
  deleteAccount: () => Promise<void>; // Added Permanent Delete
  hasUnreadMessages: boolean;
  hasUnreadDiscussions: boolean;
  isLoading: boolean;
  areResourcesLoading: boolean;
  scrollTargetId: string | null;
  setScrollTargetId: (id: string | null) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info', points?: number) => void;
}

export const AppContext = React.createContext<AppContextType>({} as AppContextType);

// Helper to remove undefined values which Firestore hates
const sanitizeForFirestore = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj));
};

// Generate a default SVG avatar with the user's first initial
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

// Extracted Helper for Deep Profile Propagation
const propagateUserUpdates = async (userId: string, updateData: any) => {
    // 1. Propagate to Resources (Author field)
    const resQuery = query(collection(db!, "resources"), where("author.id", "==", userId));
    const resSnap = await getDocs(resQuery);
    const batch = writeBatch(db!);
    let count = 0;

    resSnap.forEach((docSnap) => {
         const resRef = doc(db!, "resources", docSnap.id);
         batch.update(resRef, { author: { ...docSnap.data().author, ...updateData } });
         count++;
    });

    // 2. Propagate to Forum Posts
    const postQuery = query(collection(db!, "forumPosts"), where("author.id", "==", userId));
    const postSnap = await getDocs(postQuery);
    postSnap.forEach((docSnap) => {
         const postRef = doc(db!, "forumPosts", docSnap.id);
         batch.update(postRef, { author: { ...docSnap.data().author, ...updateData } });
         count++;
    });

    // 3. Propagate to Requests
    const reqQuery = query(collection(db!, "resourceRequests"), where("requester.id", "==", userId));
    const reqSnap = await getDocs(reqQuery);
    reqSnap.forEach((docSnap) => {
         const reqRef = doc(db!, "resourceRequests", docSnap.id);
         batch.update(reqRef, { requester: { ...docSnap.data().requester, ...updateData } });
         count++;
    });

    if (count > 0) {
        await batch.commit();
    }

    // 4. Propagate to Comments (inside Resources)
    const allResSnap = await getDocs(collection(db!, "resources"));
    allResSnap.forEach(async (docSnap) => {
        const res = docSnap.data() as Resource;
        if (!res.comments) return;
        
        let changed = false;
        const updatedComments = res.comments.map(c => {
            if (c.author.id === userId) {
                changed = true;
                return { ...c, author: { ...c.author, ...updateData } };
            }
            return c;
        });
        if (changed) {
            await updateDoc(docSnap.ref, { comments: updatedComments });
        }
    });

    // 5. Propagate to Replies (inside Forum Posts)
    const allPostsSnap = await getDocs(collection(db!, "forumPosts"));
    allPostsSnap.forEach(async (docSnap) => {
        const post = docSnap.data() as ForumPost;
        if (!post.replies) return;

        let changed = false;
        const updatedReplies = post.replies.map(r => {
            if (r.author.id === userId) {
                changed = true;
                return { ...r, author: { ...r.author, ...updateData } };
            }
            return r;
        });
        if (changed) {
            await updateDoc(docSnap.ref, { replies: updatedReplies });
        }
    });
};

const MASTER_ADMIN_EMAIL = 'b09220024@student.unimy.edu.my';

const FirebaseSetup = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-red-100">
      <div className="flex items-center gap-3 text-red-600 mb-4">
        <AlertCircle size={32} />
        <h2 className="text-xl font-bold">Firebase Configuration Error</h2>
      </div>
      <p className="text-slate-600 mb-4">
        The application could not connect to Firebase services. This is likely due to missing environment variables.
      </p>
      <div className="bg-slate-100 p-4 rounded-lg overflow-x-auto">
        <code className="text-xs text-slate-700">
          Check your .env file or Vercel/Netlify configuration.
        </code>
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<{title: string, message: string, code?: string, details?: string} | null>(null);
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
  const [reports, setReports] = useState<Report[]>([]); // New state for reports
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fulfillingRequest, setFulfillingRequest] = useState<ResourceRequest | undefined>(undefined);

  const [toast, setToast] = useState<{ message: string; points?: number; type?: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', points?: number) => {
      setToast({ message, type, points });
  };

  const [runTour, setRunTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // Apply Dark Mode Class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('examvault_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('examvault_theme', 'light');
    }
  }, [isDarkMode]);

  // Presence Heartbeat
  const lastUpdateRef = useRef<number>(0);
  
  useEffect(() => {
    if (!user?.id || !db) return;

    const updatePresence = async () => {
        const now = Date.now();
        // Throttle updates to at least every 10 seconds to avoid spamming on focus/click
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

    updatePresence(); // Initial update
    
    // Increased frequency to 30 seconds for near "real-time" accuracy
    const interval = setInterval(updatePresence, 30 * 1000); 

    const handleInteraction = () => {
        if (document.visibilityState === 'visible') {
            updatePresence();
        }
    };

    document.addEventListener("visibilitychange", handleInteraction);
    window.addEventListener("focus", handleInteraction);
    window.addEventListener("click", handleInteraction); // Update on clicks too

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
            if (!userData.savedPostIds) {
                userData.savedPostIds = [];
                updates.savedPostIds = [];
                hasUpdates = true;
            }
            if (!userData.savedRequestIds) {
                userData.savedRequestIds = [];
                updates.savedRequestIds = [];
                hasUpdates = true;
            }
            if (!userData.subscriptions) {
                userData.subscriptions = { users: [], lecturers: [], courseCodes: [] };
                updates.subscriptions = { users: [], lecturers: [], courseCodes: [] };
                hasUpdates = true;
            }
            // Ensure Role and Status exist
            if (!userData.role) {
                userData.role = 'student';
                updates.role = 'student';
                hasUpdates = true;
            }
            if (!userData.status) {
                userData.status = 'active';
                updates.status = 'active';
                hasUpdates = true;
            }

            const isLegacyAvatar = !userData.avatarUrl || 
                                   (!userData.avatarUrl.startsWith('data:') && !userData.avatarUrl.includes('firebasestorage'));

            if (isLegacyAvatar) {
                const newAvatar = generateDefaultAvatar(userData.name);
                userData.avatarUrl = newAvatar;
                updates.avatarUrl = newAvatar;
                hasUpdates = true;
            }

            // Check if user is banned
            if (userData.status === 'banned') {
                await firebaseAuth.signOut(auth);
                setUser(null);
                showToast("Your account has been restricted. Contact support.", "error");
                setIsLoading(false);
                return;
            }

            // Handle Reactivation
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
            
            // Trigger tour if not done
            if (!localStorage.getItem(`examvault_tour_${userData.id}`)) {
                setRunTour(true);
            }

          } else {
            const displayName = firebaseUser.displayName || "Student";
            const defaultAvatar = generateDefaultAvatar(displayName);
            
            // Check for lecturer email
            const isLecturerEmail = firebaseUser.email?.endsWith('@unimy.edu.my') && !firebaseUser.email?.endsWith('@student.unimy.edu.my');
            const role = isLecturerEmail ? 'lecturer' : 'student';
            const bio = isLecturerEmail ? 'Lecturer' : 'Student'; // Default bio for new lecturers
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
              savedPostIds: [],
              savedRequestIds: [],
              role: role,
              status: 'active'
            };
            
            await setDoc(userRef, newUser);
            setUser(newUser);
            setRunTour(true); // Always run for new users
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

  // ... (useEffect for data fetching snapshots remains the same) ...
  useEffect(() => {
    if (!user || !db) return;

    setAreResourcesLoading(true);

    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      // 1. Fetch raw data
      let rawUsers = snapshot.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id } as User));

      // 2. MASTER ADMIN CLEANUP
      const adminAccounts = rawUsers.filter(u => u.email.toLowerCase().trim() === MASTER_ADMIN_EMAIL.toLowerCase());

      if (adminAccounts.length > 0) {
          adminAccounts.sort((a, b) => {
              if (a.name === 'Osama') return -1; 
              if (b.name === 'Osama') return 1;
              return a.name.length - b.name.length;
          });

          const winner = adminAccounts[0];

          if (winner.name !== 'Osama') {
              const userRef = doc(db, "users", winner.id);
              updateDoc(userRef, { name: 'Osama' });
              winner.name = 'Osama';
              if (user.id === winner.id) {
                  setUser({ ...user, name: 'Osama' });
              }
          }

          for (let i = 1; i < adminAccounts.length; i++) {
              const loser = adminAccounts[i];
              deleteDoc(doc(db, "users", loser.id));
              const idx = rawUsers.findIndex(u => u.id === loser.id);
              if (idx > -1) rawUsers.splice(idx, 1);
          }
      }

      // Sort users for display list (admin priority)
      rawUsers.sort((a, b) => {
          const emailA = a.email.toLowerCase().trim();
          const emailB = b.email.toLowerCase().trim();
          if (emailA !== emailB) return 0;
          if (a.role === 'admin' && b.role !== 'admin') return -1;
          if (b.role === 'admin' && a.role !== 'admin') return 1;
          return b.points - a.points;
      });

      const fetchedUsers: User[] = [];
      const batch = writeBatch(db!);
      let needsCommit = false;
      const usersToPropagate: { id: string, avatarUrl: string }[] = [];
      const seenEmails = new Set<string>();

      rawUsers.forEach((u) => {
        const normalizedEmail = u.email.toLowerCase().trim();
        if (seenEmails.has(normalizedEmail)) return;
        seenEmails.add(normalizedEmail);

        if (!u.role) u.role = 'student';
        if (!u.status) u.status = 'active';

        if (u.email === MASTER_ADMIN_EMAIL && u.role !== 'admin') {
             const ref = doc(db!, "users", u.id);
             batch.update(ref, { role: 'admin' });
             needsCommit = true;
             u.role = 'admin';
        }
        
        const isLecturerEmail = u.email.endsWith('@unimy.edu.my') && !u.email.endsWith('@student.unimy.edu.my');
        if (isLecturerEmail) {
            let updates: any = {};
            if (u.role === 'student') {
                updates.role = 'lecturer';
                updates.course = 'Lecturer';
                u.role = 'lecturer';
                u.course = 'Lecturer';
            }
            if (u.bio === 'Student' || u.bio === 'student' || u.bio === 'I am a student at UNIMY.') {
                updates.bio = 'Lecturer';
                u.bio = 'Lecturer';
            }
            if (Object.keys(updates).length > 0) {
                const ref = doc(db!, "users", u.id);
                batch.update(ref, updates);
                needsCommit = true;
            }
        }

        const isLegacy = !u.avatarUrl || (!u.avatarUrl.startsWith('data:') && !u.avatarUrl.includes('firebasestorage.googleapis.com'));
        if (isLegacy) {
            const newAvatar = generateDefaultAvatar(u.name);
            u.avatarUrl = newAvatar;
            const ref = doc(db!, "users", u.id);
            batch.update(ref, { avatarUrl: newAvatar });
            needsCommit = true;
            usersToPropagate.push({ id: u.id, avatarUrl: newAvatar });
        }
        fetchedUsers.push(u);
      });

      if (needsCommit) {
          batch.commit().then(() => {
              usersToPropagate.forEach(u => propagateUserUpdates(u.id, { avatarUrl: u.avatarUrl }));
          }).catch(e => console.error("Batch update failed", e));
      }

      setUsers(fetchedUsers);
      
      if (auth.currentUser?.email) {
          const myEmail = auth.currentUser.email.toLowerCase().trim();
          const bestProfileForMe = fetchedUsers.find(u => u.email.toLowerCase().trim() === myEmail);
          if (bestProfileForMe) {
              if (!user || user.id !== bestProfileForMe.id || JSON.stringify(user) !== JSON.stringify(bestProfileForMe)) {
                   if (bestProfileForMe.status === 'banned') {
                       logout();
                       showToast("Your account has been restricted.", "error");
                   } else {
                       setUser(bestProfileForMe);
                   }
              }
          }
      }
    });

    let unsubReports = () => {};
    if (user.role === 'admin') {
        const q = query(collection(db, "reports"), where("status", "==", "pending"));
        unsubReports = onSnapshot(q, (snapshot) => {
            const fetchedReports = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Report));
            fetchedReports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setReports(fetchedReports);
        });
    }

    const unsubResources = onSnapshot(query(collection(db, "resources"), orderBy("uploadDate", "desc")), (snapshot) => {
      setResources(snapshot.docs.map(d => {
          const data = d.data();
          return { 
              id: d.id, 
              ...data,
              upvotedBy: data.upvotedBy || [],
              downvotedBy: data.downvotedBy || [],
          } as Resource;
      }));
      setAreResourcesLoading(false);
    });

    const unsubPosts = onSnapshot(query(collection(db, "forumPosts"), orderBy("timestamp", "desc")), (snapshot) => {
      setForumPosts(snapshot.docs.map(d => {
          const data = d.data();
          return {
              id: d.id,
              ...data,
              upvotedBy: data.upvotedBy || [],
              downvotedBy: data.downvotedBy || [],
              replies: (data.replies || []).map((r: any) => ({...r, upvotedBy: r.upvotedBy || []}))
          } as ForumPost;
      }));
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

    return () => {
      unsubUsers(); unsubResources(); unsubPosts(); unsubRequests(); unsubConvos(); unsubMessages(); unsubNotifs(); unsubReports();
    };
  }, [user?.id, user?.role]);

  const sendNotification = async (recipientId: string, senderId: string, type: NotificationType, message: string, linkIds?: any) => {
      if (recipientId === user?.id || !db) return;
      await addDoc(collection(db, "notifications"), { recipientId, senderId, type, message, timestamp: new Date().toISOString(), isRead: false, ...linkIds });
  };
  
  const logout = async () => { if (!auth) return; await firebaseAuth.signOut(auth); setUser(null); setViewState('dashboard'); setViewHistory([]); };
  
  const deactivateAccount = async () => {
      if (!user || !db) return;
      try {
          const userRef = doc(db, "users", user.id);
          await updateDoc(userRef, { status: 'deactivated' });
          await logout();
      } catch (error) { console.error("Failed to deactivate", error); showToast("Failed to deactivate account.", "error"); }
  };

  const deleteAccount = async () => {
      if (!user || !db) return;
      setIsLoading(true);
      try {
          const resQuery = query(collection(db, "resources"), where("author.id", "==", user.id));
          const resSnap = await getDocs(resQuery);
          for (const docSnap of resSnap.docs) {
              const res = docSnap.data() as Resource;
              await deleteResource(docSnap.id, res.fileUrl, res.previewImageUrl);
          }
          const postQuery = query(collection(db, "forumPosts"), where("author.id", "==", user.id));
          const postSnap = await getDocs(postQuery);
          for (const docSnap of postSnap.docs) { await deleteDoc(doc(db, "forumPosts", docSnap.id)); }
          
          const reqQuery = query(collection(db, "resourceRequests"), where("requester.id", "==", user.id));
          const reqSnap = await getDocs(reqQuery);
          for (const docSnap of reqSnap.docs) { await deleteDoc(doc(db, "resourceRequests", docSnap.id)); }

          await deleteDoc(doc(db, "users", user.id));
          localStorage.removeItem(`examvault_tour_${user.id}`);
          if (auth.currentUser) await auth.currentUser.delete(); else await logout();
          window.location.reload();
      } catch (error) { setIsLoading(false); showToast("Failed to delete account.", "error"); }
  };

  const toggleSaveResource = async (resourceId: string) => { if (!user) return; const isSaved = user.savedResourceIds?.includes(resourceId); await updateDoc(doc(db, "users", user.id), { savedResourceIds: isSaved ? arrayRemove(resourceId) : arrayUnion(resourceId) }); };
  const toggleSavePost = async (postId: string) => { if (!user) return; const isSaved = user.savedPostIds?.includes(postId); await updateDoc(doc(db, "users", user.id), { savedPostIds: isSaved ? arrayRemove(postId) : arrayUnion(postId) }); };
  const toggleSaveRequest = async (requestId: string) => { if (!user) return; const isSaved = user.savedRequestIds?.includes(requestId); await updateDoc(doc(db, "users", user.id), { savedRequestIds: isSaved ? arrayRemove(requestId) : arrayUnion(requestId) }); };

  const earnPoints = async (amount: number, message: string) => { if (!user) return; await updateDoc(doc(db, "users", user.id), { points: increment(amount), weeklyPoints: increment(amount) }); setToast({ message, points: amount, type: amount > 0 ? 'success' : 'info' }); };
  
  // Rank calculation based strictly on points and then ID for determinism
  const userRanks = useMemo(() => {
      // Sort primarily by points (desc), secondarily by ID (asc) to prevent jitter on equal scores
      const sortedByPoints = [...users].sort((a, b) => b.points - a.points || a.id.localeCompare(b.id));
      const r = new Map();
      sortedByPoints.forEach((u, i) => r.set(u.id, i));
      return r;
  }, [users]);

  const toggleUserRole = async (uid: string, role: any) => { if (user?.role === 'admin') await updateDoc(doc(db!, "users", uid), { role }); };
  const toggleUserStatus = async (uid: string, status: any) => { if (user?.role === 'admin') await updateDoc(doc(db!, "users", uid), { status }); };
  const resolveReport = async (rid: string, status: any) => { if (user?.role === 'admin') await updateDoc(doc(db!, "reports", rid), { status }); };

  const handleUpload = async (resourceData: any, file: File, coverImage: File | null) => {
      if (!user || !db || !storage) return;
      setIsUploading(true);
      try {
          const storageRef = ref(storage, `resources/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(storageRef);
          let previewUrl = generateFilePreview(file.name);
          if (coverImage) {
              const coverRef = ref(storage, `covers/${Date.now()}_${coverImage.name}`);
              await uploadBytes(coverRef, coverImage);
              previewUrl = await getDownloadURL(coverRef);
          }
          const newResource = { ...resourceData, author: sanitizeForFirestore(user), uploadDate: new Date().toISOString(), upvotes: 0, downvotes: 0, upvotedBy: [], downvotedBy: [], comments: [], fileUrl: downloadURL, fileName: file.name, previewImageUrl: previewUrl, fileBase64: "", mimeType: file.type, contentForAI: "Content is in the file..." };
          const docRef = await addDoc(collection(db, "resources"), sanitizeForFirestore(newResource));
          
          if (fulfillingRequest) {
              await updateDoc(doc(db, "resourceRequests", fulfillingRequest.id), {
                  status: 'Fulfilled',
                  fulfillment: {
                      fulfiller: sanitizeForFirestore(user),
                      resourceId: docRef.id,
                      timestamp: new Date().toISOString()
                  }
              });
              await sendNotification(fulfillingRequest.requester.id, user.id, NotificationType.RequestFulfilled, `${user.name} fulfilled your request for '${fulfillingRequest.title}'`, { requestId: fulfillingRequest.id, resourceId: docRef.id });
              earnPoints(50, "Request Fulfilled!");
              setFulfillingRequest(undefined);
          } else {
              earnPoints(25, "Resource Uploaded!");
          }

          // Notify subscribers
          const subscribers = users.filter(u => 
             u.subscriptions.users.includes(user.id) || 
             (newResource.lecturer && u.subscriptions.lecturers.includes(newResource.lecturer)) ||
             u.subscriptions.courseCodes.includes(newResource.courseCode)
          );
          
          const uniqueRecipients = new Set(subscribers.map(s => s.id));
          uniqueRecipients.delete(user.id);
          
          uniqueRecipients.forEach(async (recipientId) => {
             const recipient = users.find(u => u.id === recipientId);
             let msg = `${user.name} uploaded a new resource: '${newResource.title}'`;
             if (recipient?.subscriptions.lecturers.includes(newResource.lecturer || '')) {
                 msg = `New resource for ${newResource.lecturer}: '${newResource.title}'`;
             } else if (recipient?.subscriptions.courseCodes.includes(newResource.courseCode)) {
                 msg = `New resource for ${newResource.courseCode}: '${newResource.title}'`;
             }
             await sendNotification(recipientId, user.id, NotificationType.Subscription, msg, { resourceId: docRef.id });
          });

          setIsUploadModalOpen(false);
          showToast("Upload successful!", "success");
      } catch (error) { console.error(error); setToast({ message: "Upload failed.", type: 'error' }); } finally { setIsUploading(false); }
  };

  const deleteResource = async (resourceId: string, fileUrl: string, previewUrl?: string) => {
      if (!user || !db) return;
      
      try {
          // 1. Get the resource first to identify the author and calculate point reduction
          const resRef = doc(db, "resources", resourceId);
          const resSnap = await getDoc(resRef);
          
          if (!resSnap.exists()) {
             throw new Error("Resource not found");
          }
          
          const resourceData = resSnap.data() as Resource;
          const authorId = resourceData.author.id;

          // 2. Delete the document
          await deleteDoc(resRef);
          
          // 3. Delete files from Storage
          if (fileUrl.includes('firebasestorage')) {
             try {
                const fileRef = ref(storage, fileUrl);
                await deleteObject(fileRef);
             } catch(e) { console.warn("Could not delete file", e); }
          }
           if (previewUrl && previewUrl.includes('firebasestorage')) {
             try {
                const prevRef = ref(storage, previewUrl);
                await deleteObject(prevRef);
             } catch(e) { console.warn("Could not delete preview", e); }
          }

          // 4. Deduct Points & Update Stats
          // Standard upload points = 25. Decrement upload count.
          const userRef = doc(db, "users", authorId);
          await updateDoc(userRef, {
              points: increment(-25),
              weeklyPoints: increment(-25),
              uploadCount: increment(-1)
          });

          // 5. Navigate away if on detail view
          if (view === 'resourceDetail' && selectedId === resourceId) { 
              setViewState('dashboard'); 
              setSelectedId(undefined); 
          }
          
          // 6. Show notification with negative points
          showToast("Resource deleted.", "info", -25);

      } catch (error) { 
          console.error(error); 
          setToast({ message: "Failed to delete resource.", type: 'error' }); 
      }
  };

  const handleVote = async (resourceId: string, action: 'up' | 'down') => {
      if (!user || !db) return;
      const resRef = doc(db, "resources", resourceId);
      const resSnap = await getDoc(resRef);
      if (!resSnap.exists()) return;
      const resData = resSnap.data() as Resource;
      const isUp = resData.upvotedBy?.includes(user.id);
      const isDown = resData.downvotedBy?.includes(user.id);
      
      const batch = writeBatch(db);

      if (action === 'up') {
          if (isUp) {
               batch.update(resRef, { upvotes: increment(-1), upvotedBy: arrayRemove(user.id) });
          } else {
               batch.update(resRef, { upvotes: increment(1), upvotedBy: arrayUnion(user.id) });
               if (isDown) batch.update(resRef, { downvotes: increment(-1), downvotedBy: arrayRemove(user.id) });
          }
      } else {
          if (isDown) {
               batch.update(resRef, { downvotes: increment(-1), downvotedBy: arrayRemove(user.id) });
          } else {
               batch.update(resRef, { downvotes: increment(1), downvotedBy: arrayUnion(user.id) });
               if (isUp) batch.update(resRef, { upvotes: increment(-1), upvotedBy: arrayRemove(user.id) });
          }
      }
      await batch.commit();
  };

  const addCommentToResource = async (resourceId: string, text: string, parentId: string | null) => {
      if (!user || !db) return;
      const newComment = { id: `c-${Date.now()}`, author: sanitizeForFirestore(user), text, timestamp: new Date().toISOString(), parentId, upvotes: 0, upvotedBy: [] };
      await updateDoc(doc(db, "resources", resourceId), { comments: arrayUnion(sanitizeForFirestore(newComment)) });
      
      const res = resources.find(r => r.id === resourceId);
      if (res) {
          // 1. Notify Resource Author (if they didn't write the comment)
          if (res.author.id !== user.id) {
              await sendNotification(res.author.id, user.id, NotificationType.NewForumPost, `${user.name} commented on your resource '${res.title}'`, { resourceId: res.id, commentId: newComment.id });
          }

          // 2. Notify Parent Comment Author (if reply and not self, and distinct from resource author)
          if (parentId) {
              const parentComment = res.comments.find(c => c.id === parentId);
              if (parentComment && parentComment.author.id !== user.id && parentComment.author.id !== res.author.id) {
                   await sendNotification(parentComment.author.id, user.id, NotificationType.NewReply, `${user.name} replied to your comment on '${res.title}'`, { resourceId: res.id, commentId: newComment.id });
              }
          }
      }
  };

  const deleteCommentFromResource = async (resourceId: string, comment: Comment) => {
      if (!db) return;
      try {
          const resRef = doc(db, "resources", resourceId);
          const snap = await getDoc(resRef);
          if (snap.exists()) {
             const data = snap.data() as Resource;
             const updatedComments = data.comments.filter(c => c.id !== comment.id);
             await updateDoc(resRef, { comments: updatedComments });
          }
          setToast({ message: "Comment deleted.", type: 'success' });
      } catch (error) {
          console.error("Failed to delete comment", error);
          setToast({ message: "Failed to delete comment.", type: 'error' });
      }
  };

  const handleCommentVote = async (resourceId: string, commentId: string) => { 
      if (!user || !db) return;
      const resRef = doc(db, "resources", resourceId);
      const resSnap = await getDoc(resRef);
      if (!resSnap.exists()) return;
      const resData = resSnap.data() as Resource;
      const updatedComments = resData.comments.map(c => {
          if (c.id === commentId) {
             const hasVoted = c.upvotedBy?.includes(user.id);
             return {
                 ...c,
                 upvotes: hasVoted ? c.upvotes - 1 : c.upvotes + 1,
                 upvotedBy: hasVoted ? c.upvotedBy.filter(id => id !== user.id) : [...(c.upvotedBy || []), user.id]
             };
          }
          return c;
      });
      await updateDoc(resRef, { comments: updatedComments });
  };

  const addForumPost = async (postData: any, file?: File) => {
      if (!user || !db) return;
      let attachment = undefined;
      if (file) {
          const storageRef = ref(storage, `attachments/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          attachment = { type: file.type.startsWith('image/') ? 'image' : 'file', url, name: file.name, size: (file.size / 1024).toFixed(0) + ' KB' };
      }
      const newPost = { ...postData, author: sanitizeForFirestore(user), timestamp: new Date().toISOString(), upvotes: 0, downvotes: 0, replies: [], attachment };
      const refDoc = await addDoc(collection(db, "forumPosts"), sanitizeForFirestore(newPost));
      earnPoints(10, "Discussion Created!");

      const subscribers = users.filter(u => u.subscriptions.courseCodes.includes(postData.courseCode));
      subscribers.forEach(async (sub) => {
          if (sub.id !== user.id) {
              await sendNotification(sub.id, user.id, NotificationType.NewForumPost, `New discussion in ${postData.courseCode}: '${postData.title}'`, { forumPostId: refDoc.id });
          }
      });
  };

  const deleteForumPost = async (postId: string) => { if(!db) return; setViewState('discussions'); await deleteDoc(doc(db, "forumPosts", postId)); };
  
  const handlePostVote = async (postId: string, action: 'up' | 'down') => { 
      if (!user || !db) return;
      const postRef = doc(db, "forumPosts", postId);
      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) return;
      const postData = postSnap.data() as ForumPost;
      const isUp = postData.upvotedBy?.includes(user.id);
      const isDown = postData.downvotedBy?.includes(user.id);
      
      const batch = writeBatch(db);
      if (action === 'up') {
          if (isUp) {
               batch.update(postRef, { upvotes: increment(-1), upvotedBy: arrayRemove(user.id) });
          } else {
               batch.update(postRef, { upvotes: increment(1), upvotedBy: arrayUnion(user.id) });
               if (isDown) batch.update(postRef, { downvotes: increment(-1), downvotedBy: arrayRemove(user.id) });
          }
      } else {
           if (isDown) {
               batch.update(postRef, { downvotes: increment(-1), downvotedBy: arrayRemove(user.id) });
          } else {
               batch.update(postRef, { downvotes: increment(1), downvotedBy: arrayUnion(user.id) });
               if (isUp) batch.update(postRef, { upvotes: increment(-1), upvotedBy: arrayRemove(user.id) });
          }
      }
      await batch.commit();
  };

  const addReplyToPost = async (postId: string, text: string, parentId: string | null, file?: File) => {
      if (!user || !db) return;
      let attachment = undefined;
      if (file) {
          const storageRef = ref(storage, `attachments/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          attachment = { type: file.type.startsWith('image/') ? 'image' : 'file', url, name: file.name, size: (file.size / 1024).toFixed(0) + ' KB' };
      }
      const newReply = { id: `reply-${Date.now()}`, author: sanitizeForFirestore(user), text, timestamp: new Date().toISOString(), upvotes: 0, parentId, isVerified: false, attachment };
      await updateDoc(doc(db, "forumPosts", postId), { replies: arrayUnion(sanitizeForFirestore(newReply)) });
      
      const post = forumPosts.find(p => p.id === postId);
      if (post && post.author.id !== user.id) {
          await sendNotification(post.author.id, user.id, NotificationType.NewReply, `${user.name} replied to your post '${post.title}'`, { forumPostId: postId, replyId: newReply.id });
      }
  };

  const deleteReplyFromPost = async (postId: string, reply: ForumReply) => {
      if (!db) return;
      try {
          const postRef = doc(db, "forumPosts", postId);
          const snap = await getDoc(postRef);
          if (snap.exists()) {
             const data = snap.data() as ForumPost;
             const updatedReplies = data.replies.filter(r => r.id !== reply.id);
             await updateDoc(postRef, { replies: updatedReplies });
          }
          setToast({ message: "Reply deleted.", type: 'success' });
      } catch (error) {
          console.error("Delete reply failed", error);
          setToast({ message: "Failed to delete reply.", type: 'error' });
      }
  };

  const handleReplyVote = async (postId: string, replyId: string) => {
      if (!user || !db) return;
      const postRef = doc(db, "forumPosts", postId);
      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) return;
      const postData = postSnap.data() as ForumPost;
      const updatedReplies = postData.replies.map(r => {
          if (r.id === replyId) {
             const hasVoted = r.upvotedBy?.includes(user.id);
             return {
                 ...r,
                 upvotes: hasVoted ? r.upvotes - 1 : r.upvotes + 1,
                 upvotedBy: hasVoted ? r.upvotedBy.filter(id => id !== user.id) : [...(r.upvotedBy || []), user.id]
             };
          }
          return r;
      });
      await updateDoc(postRef, { replies: updatedReplies });
  };

  const toggleVerifiedAnswer = async (postId: string, replyId: string) => {
      if (!user || !db) return;
      const postRef = doc(db, "forumPosts", postId);
      const postSnap = await getDoc(postRef);
      if (!postSnap.exists()) return;
      const postData = postSnap.data() as ForumPost;
      
      let authorId = "";
      const updatedReplies = postData.replies.map(r => {
          if (r.id === replyId) {
              authorId = r.author.id;
              return { ...r, isVerified: !r.isVerified };
          }
          return r;
      });
      await updateDoc(postRef, { replies: updatedReplies });
      
      const reply = updatedReplies.find(r => r.id === replyId);
      if (reply && reply.isVerified) {
          earnPoints(15, "Answer Verified!");
          if (authorId && authorId !== user.id) {
               await updateDoc(doc(db, "users", authorId), { points: increment(15), weeklyPoints: increment(15) });
               await sendNotification(authorId, user.id, NotificationType.NewReply, `Your reply in '${postData.title}' was marked as Verified!`, { forumPostId: postId, replyId: replyId });
          }
      }
  };
  
  const addResourceRequest = async (reqData: any, file?: File) => {
      if (!user || !db) return;
      let attachment = undefined;
      if (file) {
          const storageRef = ref(storage, `attachments/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          attachment = { type: file.type.startsWith('image/') ? 'image' : 'file', url, name: file.name, size: (file.size / 1024).toFixed(0) + ' KB' };
      }
      const newReq = { requester: sanitizeForFirestore(user), timestamp: new Date().toISOString(), status: 'Open', ...reqData, attachment };
      const refDoc = await addDoc(collection(db, "resourceRequests"), sanitizeForFirestore(newReq));
      earnPoints(5, "Request Posted!");
      
      const potentialHelpers = users.filter(u => u.subscriptions.courseCodes.includes(reqData.courseCode) && u.id !== user.id);
      potentialHelpers.forEach(async (u) => {
          await sendNotification(u.id, user.id, NotificationType.NewRequest, `${user.name} requested a resource for ${reqData.courseCode}`, { requestId: refDoc.id });
      });
  };

  const deleteResourceRequest = async (requestId: string) => { if (!db) return; await deleteDoc(doc(db, "resourceRequests", requestId)); };
  
  const openUploadForRequest = (id: string) => { const req = resourceRequests.find(r => r.id === id); if (req) { setFulfillingRequest(req); setIsUploadModalOpen(true); } };
  
  const toggleUserSubscription = async (uid: string) => {
      if (!user || !db) return;
      const isSub = user.subscriptions.users.includes(uid);
      const updated = isSub ? arrayRemove(uid) : arrayUnion(uid);
      await updateDoc(doc(db, "users", user.id), { "subscriptions.users": updated });
      if (!isSub) {
          await sendNotification(uid, user.id, NotificationType.Subscription, `${user.name} started following you.`);
      }
  };
  const toggleLecturerSubscription = async (name: string) => {
      if (!user || !db) return;
      const isSub = user.subscriptions.lecturers.includes(name);
      await updateDoc(doc(db, "users", user.id), { "subscriptions.lecturers": isSub ? arrayRemove(name) : arrayUnion(name) });
  };
  const toggleCourseCodeSubscription = async (code: string) => {
      if (!user || !db) return;
      const isSub = user.subscriptions.courseCodes.includes(code);
      await updateDoc(doc(db, "users", user.id), { "subscriptions.courseCodes": isSub ? arrayRemove(code) : arrayUnion(code) });
  };

  const updateUserProfile = async (data: Partial<User>) => {
      if (!user || !db) return;
      await updateDoc(doc(db, "users", user.id), data);
      await propagateUserUpdates(user.id, data);
      showToast("Profile updated successfully.", "success");
  };

  const sendMessage = async (cid: string, text: string) => {
      if (!user || !db) return;
      const msg = { conversationId: cid, senderId: user.id, recipientId: "", text, timestamp: new Date().toISOString(), status: MessageStatus.Sent, isDeleted: false };
      
      // Determine recipient
      const convo = conversations.find(c => c.id === cid);
      if (convo) {
          msg.recipientId = convo.participants.find(p => p !== user.id) || "";
      }

      await addDoc(collection(db, "directMessages"), msg);
      await updateDoc(doc(db, "conversations", cid), { lastMessageTimestamp: msg.timestamp });
      
      if (msg.recipientId) {
          await sendNotification(msg.recipientId, user.id, NotificationType.NewMessage, `${user.name} sent you a message.`, { conversationId: cid });
      }
  };

  const editMessage = async (mid: string, text: string) => {
      if (!db) return;
      await updateDoc(doc(db, "directMessages", mid), { text, editedAt: new Date().toISOString() });
  };

  const deleteMessage = async (mid: string) => {
      if (!db) return;
      await updateDoc(doc(db, "directMessages", mid), { isDeleted: true, text: '' });
  };

  const startConversation = async (uid: string, msg?: string) => {
      if (!user || !db) return;
      // Check if conversation exists
      const existing = conversations.find(c => c.participants.includes(user.id) && c.participants.includes(uid));
      let cid = existing?.id;
      
      if (!existing) {
          const newConvo = { participants: [user.id, uid], lastMessageTimestamp: new Date().toISOString() };
          const ref = await addDoc(collection(db, "conversations"), newConvo);
          cid = ref.id;
      }
      
      if (msg && cid) {
          await sendMessage(cid, msg);
      }
      
      setView('messages', cid);
  };
  
  const sendDirectMessageToUser = (uid: string, text: string) => { startConversation(uid, text); };
  
  const markNotificationAsRead = async (id: string) => { if (!db) return; await updateDoc(doc(db, "notifications", id), { isRead: true }); };
  const markAllNotificationsAsRead = async () => {
      if (!user || !db) return;
      const batch = writeBatch(db);
      notifications.filter(n => !n.isRead && n.recipientId === user.id).forEach(n => {
          batch.update(doc(db, "notifications", n.id), { isRead: true });
      });
      await batch.commit();
  };
  const clearAllNotifications = async () => {
      if (!user || !db) return;
      const batch = writeBatch(db);
      notifications.filter(n => n.recipientId === user.id).forEach(n => {
          batch.delete(doc(db, "notifications", n.id));
      });
      await batch.commit();
  };
  
  const markMessagesAsRead = async (cid: string) => {
      if (!user || !db) return;
      const batch = writeBatch(db);
      directMessages.filter(m => m.conversationId === cid && m.recipientId === user.id && m.status !== MessageStatus.Read).forEach(m => {
           batch.update(doc(db, "directMessages", m.id), { status: MessageStatus.Read });
      });
      await batch.commit();
  };

  const setView = (newView: View, id?: string, options?: { replace?: boolean }) => {
    setViewState(newView);
    setSelectedId(id);
    window.scrollTo(0, 0);
    
    setViewHistory(currentHistory => {
        const newEntry = { view: newView, id };
        if (options?.replace && currentHistory.length > 0) {
            const updated = [...currentHistory];
            updated[updated.length - 1] = newEntry;
            return updated;
        }
        return [...currentHistory, newEntry];
    });
  };

  const goBack = () => { if(viewHistory.length > 1) { const h = [...viewHistory]; h.pop(); const p = h[h.length-1]; setViewHistory(h); setViewState(p.view); setSelectedId(p.id); } else { setViewState('dashboard'); } };

  const tourSteps = [
    { selector: '#tour-dashboard', content: 'This is your dashboard.' },
    { selector: '#tour-search-bar', content: 'Search here.' },
    { selector: '#tour-filter-button', content: 'Filter resources.' },
    { selector: '#tour-upload-button', content: 'Upload resources.' },
    { selector: '#tour-discussions', content: 'Join discussions.' },
    { selector: '#tour-requests', content: 'View requests.' },
    { selector: '#tour-messages', content: 'Chat here.' },
    { selector: '#tour-leaderboard', content: 'Leaderboard.' },
    { selector: '#tour-profile-menu', content: 'Profile settings.' },
  ];

  // Logic to calculate unread states
  const hasUnreadMessages = useMemo(() => {
    if (!user) return false;
    return directMessages.some(m => m.recipientId === user.id && m.status !== MessageStatus.Read);
  }, [directMessages, user]);

  const hasUnreadDiscussions = useMemo(() => {
    if (!user) return false;
    return notifications.some(n => !n.isRead && n.recipientId === user.id && (n.type === NotificationType.NewForumPost || n.type === NotificationType.NewReply));
  }, [notifications, user]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-bg"><Loader2 size={48} className="animate-spin text-primary-600" /></div>;
  if (!auth) return <div>Auth Error</div>; // Simplified error view for brevity
  if (!user) return <AuthPage onLogin={() => {}} />;

  return (
    <AppContext.Provider value={{
      user, users, resources, forumPosts, notifications, conversations, directMessages, resourceRequests, reports,
      view, setView, logout, isDarkMode, toggleDarkMode: () => setIsDarkMode(!isDarkMode),
      userRanks, 
      savedResourceIds: user.savedResourceIds || [],
      savedPostIds: user.savedPostIds || [],
      savedRequestIds: user.savedRequestIds || [],
      toggleSaveResource, toggleSavePost, toggleSaveRequest,
      handleVote, addCommentToResource, handleCommentVote, deleteCommentFromResource,
      addForumPost, handlePostVote, deleteForumPost, addReplyToPost, handleReplyVote, deleteReplyFromPost, toggleVerifiedAnswer,
      addResourceRequest, deleteResourceRequest, openUploadForRequest,
      toggleUserSubscription, toggleLecturerSubscription, toggleCourseCodeSubscription,
      updateUserProfile, sendMessage, editMessage, deleteMessage, startConversation, sendDirectMessageToUser, markNotificationAsRead, markAllNotificationsAsRead, markMessagesAsRead,
      clearAllNotifications, goBack, hasUnreadMessages, hasUnreadDiscussions,
      isLoading, deleteResource, deactivateAccount, deleteAccount,
      areResourcesLoading, scrollTargetId, setScrollTargetId, showToast, toggleUserRole, toggleUserStatus, resolveReport
    }}>
      <div className="min-h-screen bg-slate-50 dark:bg-dark-bg transition-colors duration-300">
        <Header onUploadClick={() => { setFulfillingRequest(undefined); setIsUploadModalOpen(true); }} />
        <SideNav />
        <main className="ml-20 transition-all duration-300 pt-4 px-4 md:px-8 pb-8">
          {view === 'dashboard' && <DashboardPage />}
          {view === 'resourceDetail' && selectedId && <ResourceDetailPage resource={resources.find(r => r.id === selectedId) || resources[0]} />}
          {view === 'discussions' && <DiscussionsPage />}
          {view === 'forumDetail' && selectedId && <ForumPostDetailPage post={forumPosts.find(p => p.id === selectedId) || forumPosts[0]} />}
          {view === 'profile' && user && <ProfilePage user={user} allResources={resources} isCurrentUser={true} />}
          {view === 'publicProfile' && selectedId && <ProfilePage user={users.find(u => u.id === selectedId) || user} allResources={resources} isCurrentUser={selectedId === user.id} />}
          {view === 'messages' && <MessagesPage activeConversationId={selectedId || null} />}
          {view === 'leaderboard' && <LeaderboardPage />}
          {view === 'requests' && <ResourceRequestsPage />}
          {view === 'admin' && user.role === 'admin' && <AdminPage />} 
        </main>
        {isUploadModalOpen && <UploadModal onClose={() => { if(!isUploading) { setIsUploadModalOpen(false); setFulfillingRequest(undefined); } }} onUpload={handleUpload} fulfillingRequest={fulfillingRequest} isLoading={isUploading} />}
        {runTour && <TooltipGuide targetSelector={tourSteps[tourStep - 1]?.selector || 'body'} content={tourSteps[tourStep - 1]?.content || ''} currentStep={tourStep} totalSteps={tourSteps.length} onNext={() => { if (tourStep < tourSteps.length) setTourStep(tourStep + 1); else { setRunTour(false); localStorage.setItem(`examvault_tour_${user.id}`, 'true'); } }} onPrev={() => setTourStep(Math.max(1, tourStep - 1))} onSkip={() => { setRunTour(false); localStorage.setItem(`examvault_tour_${user.id}`, 'true'); }} />}
        {toast && <ToastNotification message={toast.message} points={toast.points} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </AppContext.Provider>
  );
};

export default App;
