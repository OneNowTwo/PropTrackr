export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export type AgentPerformanceBrief = {
  agentId: string;
  name: string;
  agencyName: string | null;
  averageRating: number | null;
  noteCount: number;
  recentNotes: {
    note: string;
    rating: number | null;
    category: string | null;
  }[];
};

export type AgentContext = {
  userName: string | undefined;
  properties: AgentProperty[];
  upcomingInspections: AgentInspection[];
  recentEmails: AgentEmail[];
  suburbs: string[];
  voiceNoteSummaries: string[];
  /** Buyer performance notes and ratings per agent (household). */
  agentPerformance: AgentPerformanceBrief[];
};

export type AgentProperty = {
  id: string;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  price: number | null;
  status: string;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  auctionDate: string | null;
  auctionTime: string | null;
  notesSummary: string | null;
  listingUrl: string | null;
};

export type AgentInspection = {
  address: string;
  suburb: string;
  date: string;
  startTime: string;
  attended: boolean;
};

export type AgentEmail = {
  from: string;
  subject: string;
  date: string;
  propertyAddress: string | null;
};
