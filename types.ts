
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  joinDate: string;
  lastActive?: string; // Timestamp for online status
  bio: string;
  points: number;
  weeklyPoints: number;
  uploadCount: number;
  course: string;
  currentYear: number;
  currentSemester: number;
  subscriptions: UserSubscriptions;
  savedResourceIds: string[];
  role: 'student' | 'admin' | 'lecturer';
  status: 'active' | 'banned';
}

export interface UserSubscriptions {
  users: string[]; // array of user IDs
  lecturers: string[]; // array of lecturer names
  courseCodes: string[]; // array of course codes
}

export enum ResourceType {
  PastPaper = 'Past Paper',
  Notes = 'Notes',
  Assignment = 'Assignment',
  Other = 'Other',
}

export enum ExamType {
    Midterm = 'Midterm',
    Final = 'Final',
    Quiz = 'Quiz',
}

export enum SemesterIntake {
    Feb = 'Feb',
    May = 'May',
    Sep = 'Sep',
}

export interface Comment {
  id: string;
  author: User;
  text: string;
  timestamp: string;
  parentId?: string | null;
  upvotes: number;
  upvotedBy: string[];
}

export interface Resource {
  id: string;
  type: ResourceType;
  title: string;
  courseCode: string;
  courseName: string;
  lecturer?: string;
  year: number;
  semester: SemesterIntake;
  examType?: ExamType;
  description: string;
  fileUrl: string; // URL to PDF/image
  fileName: string; // Original name of the uploaded file
  fileBase64?: string; // Base64 data for AI analysis
  mimeType?: string; // Mime type for AI analysis
  previewImageUrl: string; // URL for a thumbnail
  author: User;
  uploadDate: string;
  upvotes: number;
  downvotes: number;
  upvotedBy: string[];
  downvotedBy: string[];
  comments: Comment[];
  contentForAI: string; // Mock text content for Gemini (fallback)
}

export interface Attachment {
  type: 'image' | 'file';
  url: string;
  name: string;
  size?: string;
}

export interface ForumReply {
  id: string;
  author: User;
  text: string;
  timestamp: string;
  upvotes: number;
  upvotedBy: string[];
  isVerified: boolean;
  parentId?: string | null;
  attachment?: Attachment;
}

export interface ForumPost {
  id:string;
  title: string;
  author: User;
  timestamp: string;
  courseCode: string;
  body: string;
  tags: string[];
  upvotes: number;
  downvotes: number;
  upvotedBy: string[];
  downvotedBy: string[];
  replies: ForumReply[];
  attachment?: Attachment;
}

export enum NotificationType {
  NewResource = 'new_resource',
  Subscription = 'subscription',
  NewMessage = 'new_message',
  NewForumPost = 'new_forum_post',
  NewReply = 'new_reply',
  RequestFulfilled = 'request_fulfilled',
  NewRequest = 'new_request',
}

export interface Notification {
  id: string;
  recipientId: string;
  senderId?: string;
  type: NotificationType;
  message: string;
  resourceId?: string;
  conversationId?: string;
  forumPostId?: string;
  commentId?: string;
  replyId?: string;
  requestId?: string;
  timestamp: string;
  isRead: boolean;
}

export enum MessageStatus {
  Sent = 'sent',
  Delivered = 'delivered',
  Read = 'read',
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  text: string;
  timestamp: string;
  status: MessageStatus;
  isDeleted?: boolean;
  editedAt?: string;
}

export interface Conversation {
  id: string;
  participants: [string, string]; // Array of two user IDs
  lastMessageTimestamp: string;
}

export interface Flashcard {
  term: string;
  definition: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

export enum ResourceRequestStatus {
  Open = 'Open',
  Fulfilled = 'Fulfilled',
}

export interface ResourceRequest {
  id: string;
  requester: User;
  timestamp: string;
  courseCode: string;
  title: string;
  details: string;
  status: ResourceRequestStatus;
  attachment?: Attachment;
  fulfillment?: {
    fulfiller: User;
    resourceId: string;
    timestamp: string;
  };
}

export interface Report {
  id: string;
  resourceId: string;
  resourceTitle: string;
  uploaderId: string;
  uploaderName: string;
  reporterId: string;
  reporterName: string;
  reason: string;
  timestamp: string;
  status: 'pending' | 'resolved' | 'dismissed';
}
