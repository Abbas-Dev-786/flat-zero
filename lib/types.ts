export type DynamicValue = string | number | boolean | string[] | null;

export interface SearchPreference {
  key: string;
  label: string;
  value: DynamicValue;
}

export interface SearchCriteria {
  query: string;
  location?: string;
  maxBudget?: number;
  bedrooms?: number;
  preferences: SearchPreference[];
}

export interface Listing {
  id: string;
  title: string;
  rent: string | null;
  location: string;
  bedrooms: number | null;
  bathrooms: number | null;
  petPolicy: string | null;
  availableFrom: string | null;
  listingUrl: string;
  thumbnailUrl: string | null;
  contactPhone: string | null;
  description: string;
  sourceSite: string;
  attributes: Record<string, DynamicValue>;
}

export type ListingPatch = Partial<Omit<Listing, 'id'>>;

export interface LeverageData {
  listingMarkdown: string;
  landlordReputationSummary: string | null;
  marketComparablesSummary: string | null;
  negotiationPoints: string[];
  contactPhone: string | null;
}

export interface CallState {
  status: 'idle' | 'initiating' | 'in-progress' | 'completed' | 'failed';
  callId: string | null;
  summary: string | null;
  questionsAnswered: Record<string, string>;
  viewingScheduled: string | null;
  transcript: string | null;
}

export interface ProspectSession {
  listing: Listing;
  userQuestions: string[];
  leverageData: LeverageData | null;
  callState: CallState;
}
