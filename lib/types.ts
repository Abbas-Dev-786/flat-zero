export type DynamicValue = string | number | boolean | string[] | null;

export type SourceKind =
  | 'listing'
  | 'search'
  | 'agent'
  | 'comparable'
  | 'reputation'
  | 'management'
  | 'other';

export interface SourceLink {
  url: string;
  label: string;
  kind: SourceKind;
  note?: string | null;
}

export interface PropertyFact {
  label: string;
  value: string;
}

export interface PropertyDossier {
  overview: string | null;
  exactAddress: string | null;
  managerName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  availability: string | null;
  leaseTerms: string | null;
  petPolicy: string | null;
  keyAmenities: string[];
  feesAndPolicies: PropertyFact[];
  notableConcerns: string[];
  sourceLinks: SourceLink[];
}

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
  exactAddress: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  petPolicy: string | null;
  availableFrom: string | null;
  listingUrl: string;
  rawSearchUrl: string | null;
  thumbnailUrl: string | null;
  contactPhone: string | null;
  managerName: string | null;
  detailConfidence: number;
  keyAmenities: string[];
  sourceLinks: SourceLink[];
  verifiedDetailPage: boolean;
  description: string;
  sourceSite: string;
  attributes: Record<string, DynamicValue>;
}

export type ListingPatch = Partial<Omit<Listing, 'id'>>;

export interface LeverageData {
  listingMarkdown: string;
  landlordReputationSummary: string | null;
  marketComparablesSummary: string | null;
  comparableRents: number[];
  negotiationPoints: string[];
  contactPhone: string | null;
  dossier: PropertyDossier | null;
  sourceLinks: SourceLink[];
}

export type SearchStreamEvent =
  | {
      type: 'status';
      phase: 'discovering' | 'filtering' | 'scraping' | 'complete';
      message: string;
      scanned?: number;
      accepted?: number;
      target?: number;
    }
  | {
      type: 'listing';
      listing: Listing;
    }
  | {
      type: 'complete';
      total: number;
    }
  | {
      type: 'error';
      error: string;
    };

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
