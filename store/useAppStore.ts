import { create } from 'zustand';
import {
  SearchCriteria,
  Listing,
  ProspectSession,
  CallState,
  LeverageData,
  ListingPatch,
} from '@/lib/types';

const DEFAULT_QUESTIONS = [
  'Is the property still available?',
  'What is the earliest move-in date?',
  'Are any utilities included in the rent?',
  'Is the property pet-friendly?',
  'Is parking available?',
];

const createIdleCallState = (): CallState => ({
  status: 'idle',
  callId: null,
  summary: null,
  questionsAnswered: {},
  viewingScheduled: null,
  transcript: null,
});

function mergeListingWithPatch(listing: Listing, patch: ListingPatch) {
  const nextListing: Listing = {
    ...listing,
    attributes: {
      ...listing.attributes,
      ...(patch.attributes ?? {}),
    },
  };

  for (const [key, value] of Object.entries(patch)) {
    if (key === 'attributes' || value === undefined || value === null) {
      continue;
    }

    Object.assign(nextListing, { [key]: value });
  }

  return nextListing;
}

interface AppState {
  searchCriteria: SearchCriteria | null;
  listings: Listing[];
  isSearching: boolean;

  selectedListing: Listing | null;
  userQuestions: string[];
  isScrapingDetails: boolean;
  currentSession: ProspectSession | null;

  // Actions
  setSearchCriteria: (criteria: SearchCriteria) => void;
  setListings: (listings: Listing[]) => void;
  setIsSearching: (isSearching: boolean) => void;

  setSelectedListing: (listing: Listing | null) => void;
  setUserQuestions: (questions: string[]) => void;
  setIsScrapingDetails: (isScraping: boolean) => void;
  
  startSessionWithListing: (listing: Listing) => void;
  updateSessionLeverage: (leverageData: LeverageData) => void;
  mergeListingData: (listingId: string, patch: ListingPatch) => void;
  updateCallState: (callStateUpdate: Partial<CallState>) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  searchCriteria: null,
  listings: [],
  isSearching: false,

  selectedListing: null,
  userQuestions: DEFAULT_QUESTIONS,
  isScrapingDetails: false,
  currentSession: null,

  setSearchCriteria: (criteria) => set({ searchCriteria: criteria }),
  setListings: (listings) => set({ listings }),
  setIsSearching: (isSearching) => set({ isSearching }),

  setSelectedListing: (listing) => set({ selectedListing: listing }),
  setUserQuestions: (questions) =>
    set((state) => ({
      userQuestions: questions,
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            userQuestions: questions,
          }
        : null,
    })),
  setIsScrapingDetails: (isScraping) => set({ isScrapingDetails: isScraping }),

  startSessionWithListing: (listing) => set((state) => ({
    selectedListing: listing,
    isScrapingDetails: false,
    currentSession: {
      listing,
      userQuestions: [...state.userQuestions],
      leverageData: null,
      callState: createIdleCallState(),
    },
  })),

  updateSessionLeverage: (leverageData) => set((state) => {
    if (!state.currentSession) return state;
    return {
      currentSession: {
        ...state.currentSession,
        leverageData
      },
    };
  }),

  mergeListingData: (listingId, patch) =>
    set((state) => ({
      listings: state.listings.map((listing) =>
        listing.id === listingId ? mergeListingWithPatch(listing, patch) : listing,
      ),
      selectedListing:
        state.selectedListing?.id === listingId
          ? mergeListingWithPatch(state.selectedListing, patch)
          : state.selectedListing,
      currentSession:
        state.currentSession?.listing.id === listingId
          ? {
              ...state.currentSession,
              listing: mergeListingWithPatch(state.currentSession.listing, patch),
            }
          : state.currentSession,
    })),

  updateCallState: (callStateUpdate) => set((state) => {
    if (!state.currentSession) return state;
    return {
      currentSession: {
        ...state.currentSession,
        callState: {
          ...state.currentSession.callState,
          ...callStateUpdate,
        },
      },
    };
  }),

  reset: () => set({
    searchCriteria: null,
    listings: [],
    isSearching: false,
    selectedListing: null,
    userQuestions: DEFAULT_QUESTIONS,
    isScrapingDetails: false,
    currentSession: null,
  }),
}));
