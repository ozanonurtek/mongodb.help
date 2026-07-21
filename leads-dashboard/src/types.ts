export type Stats = {
  users: { total: number; last24h: number; last7d: number };
  questions: {
    total: number;
    anonymous: number;
    signedIn: number;
    up: number;
    down: number;
  };
  tickets: Record<string, number>;
  shares: {
    total: number;
    last24h: number;
    last7d: number;
    totalViews: number;
    forks: { total: number; last24h: number };
  };
};

export type ShareRow = {
  shareId: string;
  token: string;
  chatId: string;
  title: string | null;
  ownerId: string;
  ownerEmail: string | null;
  views: number;
  forks: number;
  createdAt: number;
};

export type Lead = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  providers: string[];
  createdAt: string | number | null;
  lastActive: number | null;
  questionCount: number;
  ticketCount: number;
  negativeFeedbackCount: number;
  // Present on lead detail (not the list endpoint).
  shares?: { created: number; totalForks: number };
};

export type AdminQuestion = {
  id: string;
  email: string | null;
  isAnon: boolean;
  inputRedacted: string;
  classifiedType: string;
  language: string;
  feedback: string | null;
  feedbackNote?: string | null;
  createdAt: number;
  userId: string;
};

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type Ticket = {
  id: string;
  email: string | null;
  userId: string;
  subject: string;
  status: TicketStatus;
  priority?: string;
  relatedQueryId?: string | null;
  messages?: { author: string; body: string; createdAt: number }[];
  createdAt: number;
  updatedAt: number;
};
