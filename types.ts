
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  joinDate: string;
  lastActive?: string;
  bio: string;
  points: number;
  weeklyPoints: number;
  uploadCount: number;
  course: string;
  currentYear: number;
  currentSemester: number;
  subscriptions: {
    users: string[];
    lecturers: string[];
    courseCodes: string[];
  };
  savedResourceIds: string[];
  savedPostIds: string[];
  savedRequestIds: string[];
  role: 'student' | 'lecturer' | 'admin';
  status: 'active' | 'banned' | 'deactivated';
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

export interface Attachment {
  type: 'image' | 'file';
  url: string;
  name: string;
  size: string;
}

export interface Comment {
  id: string;
  author: User;
  text: string;
  timestamp: string;
  parentId: string | null;
  upvotes: number;
  upvotedBy: string[];
  attachment?: Attachment;
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
  fileUrl: string;
  fileName: string;
  previewImageUrl: string;
  author: User;
  uploadDate: string;
  upvotes: number;
  downvotes: number;
  upvotedBy: string[];
  downvotedBy: string[];
  comments: Comment[];
  contentForAI: string;
  fileBase64?: string;
  mimeType?: string;
}

export interface ForumReply {
  id: string;
  author: User;
  text: string;
  timestamp: string;
  upvotes: number;
  upvotedBy: string[];
  parentId: string | null;
  isVerified: boolean;
  attachment?: Attachment;
}

export interface ForumPost {
  id: string;
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
  Subscription = 'subscription',
  NewResource = 'new_resource',
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
  timestamp: string;
  isRead: boolean;
  resourceId?: string;
  forumPostId?: string;
  replyId?: string;
  commentId?: string;
  conversationId?: string;
  requestId?: string;
}

export enum MessageStatus {
  Sent = 'sent',
  Delivered = 'delivered',
  Read = 'read',
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessageTimestamp: string;
  hiddenBy?: string[]; // Array of user IDs who have hidden this conversation
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  text: string;
  timestamp: string;
  status: MessageStatus;
  isDeleted: boolean;
  editedAt?: string;
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

export interface LogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  actionType: 'upload' | 'delete' | 'social' | 'admin' | 'account' | 'auth';
  description: string;
  targetId?: string;
  timestamp: string;
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
