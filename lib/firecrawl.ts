import { createHash } from 'crypto';
import {
  FirecrawlClient,
  type Document,
  type JsonFormat,
  type SearchRequest,
  type SearchResultWeb,
} from '@mendable/firecrawl-js';
import type {
  DynamicValue,
  Listing,
  ListingPatch,
  PropertyDossier,
  PropertyFact,
  SearchCriteria,
  SearchStreamEvent,
  SourceKind,
  SourceLink,
} from '@/lib/types';
import { preferenceToQueryText } from '@/lib/search-preferences';

export type FirecrawlSearchResult = SearchResultWeb | Document;

type ListingExtractionAttribute = {
  key?: string | null;
  label?: string | null;
  value?: string | number | boolean | string[] | null;
};

type ListingExtractionFact = {
  label?: string | null;
  value?: string | null;
};

type AgentResearchSource = {
  url?: string | null;
  label?: string | null;
  kind?: string | null;
  note?: string | null;
};

export type ListingExtraction = {
  propertyName?: string | null;
  propertyLocation?: string | null;
  exactAddress?: string | null;
  canonicalUrl?: string | null;
  summary?: string | null;
  monthlyRent?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  petPolicy?: string | null;
  availableFrom?: string | null;
  contactNumber?: string | null;
  contactEmail?: string | null;
  managerName?: string | null;
  leaseTerms?: string | null;
  mainPropertyImageUrl?: string | null;
  pageType?:
    | 'listing_detail'
    | 'search_results'
    | 'category_page'
    | 'property_overview'
    | 'unknown'
    | null;
  keyAmenities?: string[] | null;
  feesAndPolicies?: ListingExtractionFact[] | null;
  notableConcerns?: string[] | null;
  extraAttributes?: ListingExtractionAttribute[] | null;
};

export type AgentPropertyResearch = {
  overview?: string | null;
  exactAddress?: string | null;
  managerName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  availability?: string | null;
  leaseTerms?: string | null;
  petPolicy?: string | null;
  keyAmenities?: string[] | null;
  feesAndPolicies?: ListingExtractionFact[] | null;
  notableConcerns?: string[] | null;
  supportingSources?: AgentResearchSource[] | null;
};

type ListingCandidate = {
  rawUrl: string;
  canonicalUrl: string;
  title: string | null;
  description: string;
  score: number;
  sourceSite: string;
};

type DiscoverCanonicalListingsOptions = {
  targetCount?: number;
  onEvent?: (event: SearchStreamEvent) => Promise<void> | void;
};

type BuildPatchOptions = {
  sourceLinks?: SourceLink[];
};

const DEFAULT_ENRICHED_LISTING_TARGET = 5;
const DISCOVERY_RESULTS_PER_QUERY = 8;
const MAX_CANDIDATES_TO_SCRAPE = 12;
const SCRAPE_CONCURRENCY = 3;
const AGENT_MAX_CREDITS = 35;
const SEARCH_REQUEST_TIMEOUT_MS = 25_000;
const SCRAPE_REQUEST_TIMEOUT_MS = 20_000;
const SUPPORTING_SEARCH_TIMEOUT_MS = 15_000;

const DETAIL_PAGE_TYPES = new Set(['listing_detail', 'property_overview']);

const RENTAL_SEARCH_DOMAINS = [
  'apartments.com',
  'zillow.com',
  'streeteasy.com',
  'renthop.com',
  'realtor.com',
  'rent.com',
];

const TRACKING_QUERY_PARAMS = new Set([
  'bb',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'trk',
  'src',
  'campaign',
  'from',
  'ref',
  'searchQueryState',
  'viewport',
  'zoom',
  'bounds',
  'redirected',
  'tracking',
  'cid',
  'sid',
  's',
  'sk',
  'so',
]);

const PRESERVED_QUERY_PARAMS = new Set([
  'id',
  'listingid',
  'listing_id',
  'propertyid',
  'property_id',
  'unit',
  'unitid',
  'unit_id',
]);

const GENERIC_PATH_SEGMENTS = new Set([
  'apartments-for-rent',
  'apartment-for-rent',
  'apartments',
  'rentals',
  'rental',
  'for-rent',
  'homes-for-rent',
  'houses-for-rent',
  'condos-for-rent',
  'townhomes-for-rent',
  'search',
  'map',
  'neighborhood',
  'neighborhoods',
  'city',
  'cheap',
  'luxury',
  'new',
  'pet-friendly',
  'furnished',
  'short-term',
  'studio',
]);

const GENERIC_PATH_PATTERNS = [
  /^\d+-beds?$/i,
  /^\d+-bedrooms?$/i,
  /^\d+-bathrooms?$/i,
  /^\d+-baths?$/i,
  /^under-\d+/i,
  /^max-\d+/i,
];

const SEARCH_TITLE_PATTERNS = [
  /\bapartments?\s+for\s+rent\b/i,
  /\bhomes?\s+for\s+rent\b/i,
  /\brentals?\s+in\b/i,
  /\blistings?\s+in\b/i,
  /\bresults?\b/i,
  /\bnear\s+[A-Za-z]/i,
];

const DETAIL_PAGE_TEXT_PATTERNS = [
  /\brequest (?:a )?tour\b/i,
  /\bcontact (?:this )?(?:property|manager|leasing office)\b/i,
  /\bapply now\b/i,
  /\bavailable now\b/i,
  /\bunit\b/i,
  /\bsq\.?\s*ft\b/i,
  /\bmanaged by\b/i,
  /\bproperty details\b/i,
  /\bpet policy\b/i,
];

const LOCATION_ALIASES: Record<string, string> = {
  nyc: 'New York City',
  newyorkcity: 'New York City',
  sf: 'San Francisco',
  la: 'Los Angeles',
};

let firecrawlClient: FirecrawlClient | null = null;

const listingFactSchema = {
  type: 'object',
  properties: {
    label: { type: ['string', 'null'] },
    value: { type: ['string', 'null'] },
  },
  additionalProperties: false,
} as const;

const sourceLinkSchema = {
  type: 'object',
  properties: {
    url: { type: ['string', 'null'] },
    label: { type: ['string', 'null'] },
    kind: { type: ['string', 'null'] },
    note: { type: ['string', 'null'] },
  },
  additionalProperties: false,
} as const;

const listingExtractionFormat: JsonFormat = {
  type: 'json',
  prompt: [
    'Extract structured rental listing data from this page.',
    'Classify pageType as "listing_detail" only when the page is for one specific property or unit that a renter could directly inquire about.',
    'Classify category, search, neighborhood, and filtered inventory pages as "search_results" or "category_page".',
    'Prefer exact on-page facts over summaries. If the page shows a canonical listing URL or share URL, return it in canonicalUrl.',
    'Find the specific property manager or leasing contact phone number and email when present. Ignore generic website-wide support numbers.',
    'Return 3 to 5 renter-relevant amenities in keyAmenities.',
    'Use null when a field is absent, and do not invent values.',
  ].join(' '),
  schema: {
    type: 'object',
    properties: {
      propertyName: { type: ['string', 'null'] },
      propertyLocation: { type: ['string', 'null'] },
      exactAddress: { type: ['string', 'null'] },
      canonicalUrl: { type: ['string', 'null'] },
      summary: { type: ['string', 'null'] },
      monthlyRent: { type: ['string', 'null'] },
      bedrooms: { type: ['number', 'null'] },
      bathrooms: { type: ['number', 'null'] },
      petPolicy: { type: ['string', 'null'] },
      availableFrom: { type: ['string', 'null'] },
      contactNumber: { type: ['string', 'null'] },
      contactEmail: { type: ['string', 'null'] },
      managerName: { type: ['string', 'null'] },
      leaseTerms: { type: ['string', 'null'] },
      mainPropertyImageUrl: { type: ['string', 'null'] },
      pageType: {
        type: ['string', 'null'],
        enum: [
          'listing_detail',
          'search_results',
          'category_page',
          'property_overview',
          'unknown',
          null,
        ],
      },
      keyAmenities: {
        type: ['array', 'null'],
        items: { type: 'string' },
      },
      feesAndPolicies: {
        type: ['array', 'null'],
        items: listingFactSchema,
      },
      notableConcerns: {
        type: ['array', 'null'],
        items: { type: 'string' },
      },
      extraAttributes: {
        type: ['array', 'null'],
        items: {
          type: 'object',
          properties: {
            key: { type: ['string', 'null'] },
            label: { type: ['string', 'null'] },
            value: {
              oneOf: [
                { type: 'string' },
                { type: 'number' },
                { type: 'boolean' },
                {
                  type: 'array',
                  items: { type: 'string' },
                },
                { type: 'null' },
              ],
            },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  },
};

const propertyResearchAgentSchema = {
  type: 'object',
  properties: {
    overview: { type: ['string', 'null'] },
    exactAddress: { type: ['string', 'null'] },
    managerName: { type: ['string', 'null'] },
    contactPhone: { type: ['string', 'null'] },
    contactEmail: { type: ['string', 'null'] },
    availability: { type: ['string', 'null'] },
    leaseTerms: { type: ['string', 'null'] },
    petPolicy: { type: ['string', 'null'] },
    keyAmenities: {
      type: ['array', 'null'],
      items: { type: 'string' },
    },
    feesAndPolicies: {
      type: ['array', 'null'],
      items: listingFactSchema,
    },
    notableConcerns: {
      type: ['array', 'null'],
      items: { type: 'string' },
    },
    supportingSources: {
      type: ['array', 'null'],
      items: sourceLinkSchema,
    },
  },
  additionalProperties: false,
} as const;

const CANONICAL_ATTRIBUTE_KEYS = new Set([
  'property_name',
  'title',
  'property_location',
  'location',
  'exact_address',
  'monthly_rent',
  'rent',
  'bedrooms',
  'bathrooms',
  'pet_policy',
  'pet_friendly',
  'available_from',
  'contact_number',
  'phone',
  'contact_email',
  'manager_name',
  'main_property_image_url',
  'image',
  'thumbnail',
  'summary',
  'lease_terms',
  'canonical_url',
  'page_type',
]);

function getClient() {
  if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY is not set');
  }

  firecrawlClient ??= new FirecrawlClient({
    apiKey: process.env.FIRECRAWL_API_KEY,
  });

  return firecrawlClient;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function isDocument(result: FirecrawlSearchResult): result is Document {
  return 'metadata' in result || 'markdown' in result || 'json' in result;
}

function trimString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeTextList(values: string[] | null | undefined, limit?: number) {
  const normalized = (values ?? [])
    .map((value) => trimString(value))
    .filter((value): value is string => value !== null);

  if (!limit) {
    return normalized;
  }

  return normalized.slice(0, limit);
}

function normalizePropertyFacts(
  values: ListingExtractionFact[] | null | undefined,
): PropertyFact[] {
  return (values ?? [])
    .map((fact) => {
      const label = trimString(fact?.label);
      const value = trimString(fact?.value);

      if (!label || !value) {
        return null;
      }

      return { label, value };
    })
    .filter((fact): fact is PropertyFact => fact !== null);
}

function normalizeSourceKind(kind: string | null | undefined): SourceKind {
  switch (kind?.trim().toLowerCase()) {
    case 'listing':
    case 'search':
    case 'agent':
    case 'comparable':
    case 'reputation':
    case 'management':
      return kind.trim().toLowerCase() as SourceKind;
    default:
      return 'other';
  }
}

export function dedupeSourceLinks(sourceLinks: SourceLink[]) {
  const seen = new Set<string>();
  const deduped: SourceLink[] = [];

  for (const link of sourceLinks) {
    const normalizedUrl = canonicalizeListingUrl(link.url) ?? trimString(link.url);
    const label = trimString(link.label);

    if (!normalizedUrl || !label) {
      continue;
    }

    const key = `${normalizedUrl}::${label.toLowerCase()}::${link.kind}`;
    if (seen.has(key)) {
      continue;
    }

    deduped.push({
      url: normalizedUrl,
      label,
      kind: link.kind,
      note: trimString(link.note),
    });
    seen.add(key);
  }

  return deduped;
}

function normalizeAgentSourceLinks(
  sourceLinks: AgentResearchSource[] | null | undefined,
): SourceLink[] {
  const normalizedLinks: SourceLink[] = [];

  for (const link of sourceLinks ?? []) {
      const url = trimString(link?.url);
      const label = trimString(link?.label);

      if (!url || !label) {
        continue;
      }

      normalizedLinks.push({
        url,
        label,
        kind: normalizeSourceKind(link?.kind),
        note: trimString(link?.note),
      });
  }

  return dedupeSourceLinks(normalizedLinks);
}

function stripMarkdown(value: string) {
  return value
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMarkdownHeading(markdown?: string) {
  if (!markdown) {
    return null;
  }

  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function firstValidImage(images?: string[], ogImage?: string) {
  const candidates = [...(images ?? []), ...(ogImage ? [ogImage] : [])];

  for (const image of candidates) {
    if (!image) {
      continue;
    }

    const lowered = image.toLowerCase();
    if (
      lowered.includes('favicon') ||
      lowered.includes('icon') ||
      lowered.includes('logo')
    ) {
      continue;
    }

    return image;
  }

  return null;
}

function createListingId(url: string) {
  return createHash('sha1').update(url).digest('hex');
}

function looksLikeSearchTitle(title: string | null) {
  if (!title) {
    return false;
  }

  return SEARCH_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

function normalizeLocationAlias(location: string | null | undefined) {
  const trimmed = trimString(location);
  if (!trimmed) {
    return null;
  }

  const condensed = trimmed.toLowerCase().replace(/[^a-z]/g, '');
  return LOCATION_ALIASES[condensed] ?? trimmed;
}

function getPreferredRentalDomains(location?: string | null) {
  const normalized = normalizeLocationAlias(location)?.toLowerCase() ?? '';

  if (
    normalized.includes('new york') ||
    normalized.includes('manhattan') ||
    normalized.includes('brooklyn') ||
    normalized.includes('queens') ||
    normalized.includes('bronx')
  ) {
    return ['streeteasy.com', 'renthop.com', 'apartments.com', 'zillow.com'];
  }

  return RENTAL_SEARCH_DOMAINS;
}

function looksLikeDetailPageText(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return DETAIL_PAGE_TEXT_PATTERNS.some((pattern) => pattern.test(value));
}

function looksLikeExactAddress(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /\b\d{1,5}\s+[A-Za-z0-9.'-]+\b/.test(value);
}

function looksLikeGenericSegment(segment: string) {
  const lowered = segment.toLowerCase();
  return (
    GENERIC_PATH_SEGMENTS.has(lowered) ||
    GENERIC_PATH_PATTERNS.some((pattern) => pattern.test(lowered))
  );
}

type UrlSignal = {
  canonicalUrl: string;
  score: number;
  isGeneric: boolean;
};

function analyzeListingUrl(url: string): UrlSignal | null {
  const canonicalUrl = canonicalizeListingUrl(url);
  if (!canonicalUrl) {
    return null;
  }

  try {
    const parsed = new URL(canonicalUrl);
    const segments = parsed.pathname
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean);
    const genericSegments = segments.filter(looksLikeGenericSegment);
    const lastSegment = segments.at(-1) ?? '';

    let score = 0;

    if (segments.length >= 2) {
      score += 18;
    }

    if (segments.length >= 3) {
      score += 10;
    }

    if (lastSegment.length >= 12) {
      score += 8;
    }

    if (/\d/.test(lastSegment)) {
      score += 6;
    }

    if (genericSegments.length > 0) {
      score -= genericSegments.length * 18;
    }

    if (segments.length <= 1) {
      score -= 20;
    }

    if (parsed.search) {
      score -= 10;
    }

    return {
      canonicalUrl,
      score,
      isGeneric: genericSegments.length > 0 || segments.length <= 1,
    };
  } catch {
    return null;
  }
}

export function canonicalizeListingUrl(url: string | null | undefined) {
  const rawUrl = trimString(url);
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    const nextParams = new URLSearchParams();

    for (const [key, value] of parsed.searchParams.entries()) {
      const normalizedKey = key.trim().toLowerCase();

      if (!normalizedKey) {
        continue;
      }

      if (
        TRACKING_QUERY_PARAMS.has(normalizedKey) ||
        normalizedKey.startsWith('utm_')
      ) {
        continue;
      }

      if (PRESERVED_QUERY_PARAMS.has(normalizedKey)) {
        nextParams.set(key, value);
      }
    }

    parsed.search = nextParams.toString();
    parsed.hash = '';
    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, '/');

    if (parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeDynamicValue(value: unknown): DynamicValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => {
        if (
          typeof item === 'string' ||
          typeof item === 'number' ||
          typeof item === 'boolean'
        ) {
          return String(item).trim();
        }

        return null;
      })
      .filter((item): item is string => Boolean(item));

    return normalized.length > 0 ? normalized : null;
  }

  return null;
}

function normalizeAttributeKey(
  key: string | null | undefined,
  label: string | null | undefined,
) {
  const source = trimString(key) || trimString(label) || 'attribute';

  return (
    source
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'attribute'
  );
}

export function normalizeListingAttributes(
  extraction: ListingExtraction | null | undefined,
) {
  const attributes: Record<string, DynamicValue> = {};

  for (const attribute of extraction?.extraAttributes ?? []) {
    const normalizedValue = normalizeDynamicValue(attribute?.value);
    const key = normalizeAttributeKey(attribute?.key, attribute?.label);

    if (normalizedValue === null || CANONICAL_ATTRIBUTE_KEYS.has(key)) {
      continue;
    }

    attributes[key] = normalizedValue;
  }

  return attributes;
}

export function toPlainTextSnippet(
  value: string | null | undefined,
  maxLength = 280,
) {
  if (!value) {
    return '';
  }

  const snippet = stripMarkdown(value);
  if (snippet.length <= maxLength) {
    return snippet;
  }

  return `${snippet.slice(0, maxLength - 1).trimEnd()}...`;
}

export function getSearchResultUrl(result: FirecrawlSearchResult) {
  if ('url' in result && typeof result.url === 'string') {
    return result.url;
  }

  if (!isDocument(result)) {
    return null;
  }

  const sourceUrl = result.metadata?.sourceURL;
  const metadataUrl = result.metadata?.url;

  if (typeof sourceUrl === 'string' && sourceUrl.trim()) {
    return sourceUrl;
  }

  if (typeof metadataUrl === 'string' && metadataUrl.trim()) {
    return metadataUrl;
  }

  return null;
}

export function getListingExtraction(result: FirecrawlSearchResult) {
  if (!isDocument(result) || !result.json || typeof result.json !== 'object') {
    return null;
  }

  return result.json as ListingExtraction;
}

export const getSearchResultJson = getListingExtraction;

export function getSearchResultTitle(result: FirecrawlSearchResult) {
  if ('title' in result && typeof result.title === 'string' && result.title.trim()) {
    return result.title.trim();
  }

  if (!isDocument(result)) {
    return null;
  }

  return (
    (typeof result.metadata?.title === 'string' && result.metadata.title.trim()
      ? result.metadata.title.trim()
      : null) ?? firstMarkdownHeading(result.markdown)
  );
}

export function getSearchResultText(result: FirecrawlSearchResult) {
  if (!isDocument(result)) {
    return [result.title, result.description].filter(Boolean).join(' ');
  }

  const parts = [
    result.markdown,
    result.summary,
    typeof result.metadata?.description === 'string'
      ? result.metadata.description
      : '',
    typeof result.metadata?.title === 'string' ? result.metadata.title : '',
  ];

  return stripMarkdown(parts.filter(Boolean).join(' '));
}

export function getSearchResultImage(result: FirecrawlSearchResult) {
  if (!isDocument(result)) {
    return null;
  }

  return firstValidImage(
    Array.isArray(result.images) ? result.images : undefined,
    typeof result.metadata?.ogImage === 'string' ? result.metadata.ogImage : undefined,
  );
}

export function buildListingPatchFromExtraction(
  extraction: ListingExtraction | null | undefined,
  options: BuildPatchOptions = {},
) {
  const patch: ListingPatch = {};

  if (!extraction) {
    if (options.sourceLinks) {
      patch.sourceLinks = dedupeSourceLinks(options.sourceLinks);
    }
    return patch;
  }

  const propertyName = trimString(extraction.propertyName);
  const propertyLocation = trimString(extraction.propertyLocation);
  const exactAddress = trimString(extraction.exactAddress);
  const canonicalUrl = canonicalizeListingUrl(extraction.canonicalUrl);
  const summary = trimString(extraction.summary);
  const monthlyRent = trimString(extraction.monthlyRent);
  const petPolicy = trimString(extraction.petPolicy);
  const availableFrom = trimString(extraction.availableFrom);
  const contactNumber = trimString(extraction.contactNumber);
  const managerName = trimString(extraction.managerName);
  const mainPropertyImageUrl = trimString(extraction.mainPropertyImageUrl);

  if (propertyName) {
    patch.title = propertyName;
  }

  if (propertyLocation) {
    patch.location = propertyLocation;
  }

  if (exactAddress) {
    patch.exactAddress = exactAddress;
  }

  if (canonicalUrl) {
    patch.listingUrl = canonicalUrl;
  }

  if (summary) {
    patch.description = summary;
  }

  if (monthlyRent) {
    patch.rent = monthlyRent;
  }

  if (typeof extraction.bedrooms === 'number' && Number.isFinite(extraction.bedrooms)) {
    patch.bedrooms = extraction.bedrooms;
  }

  if (
    typeof extraction.bathrooms === 'number' &&
    Number.isFinite(extraction.bathrooms)
  ) {
    patch.bathrooms = extraction.bathrooms;
  }

  if (petPolicy) {
    patch.petPolicy = petPolicy;
  }

  if (availableFrom) {
    patch.availableFrom = availableFrom;
  }

  if (contactNumber) {
    patch.contactPhone = contactNumber;
  }

  if (managerName) {
    patch.managerName = managerName;
  }

  if (mainPropertyImageUrl) {
    patch.thumbnailUrl = mainPropertyImageUrl;
  }

  const amenities = normalizeTextList(extraction.keyAmenities, 5);
  if (amenities.length > 0) {
    patch.keyAmenities = amenities;
  }

  const pageType = trimString(extraction.pageType);
  patch.verifiedDetailPage = pageType ? DETAIL_PAGE_TYPES.has(pageType) : false;
  patch.attributes = normalizeListingAttributes(extraction);

  const sourceLinks = dedupeSourceLinks(options.sourceLinks ?? []);
  if (sourceLinks.length > 0) {
    patch.sourceLinks = sourceLinks;
  }

  return patch;
}

function mergeSourceLinks(
  listingUrl: string,
  rawSearchUrl: string | null,
  sourceLinks: SourceLink[],
) {
  const links: SourceLink[] = [
    {
      url: listingUrl,
      label: 'Canonical listing',
      kind: 'listing',
    },
  ];

  if (rawSearchUrl && rawSearchUrl !== listingUrl) {
    links.push({
      url: rawSearchUrl,
      label: 'Original search result',
      kind: 'search',
    });
  }

  return dedupeSourceLinks([...links, ...sourceLinks]);
}

function computeDetailConfidence(
  extraction: ListingExtraction | null,
  markdown: string,
  baseCandidateScore: number,
) {
  let confidence = 0.2;
  const pageType = trimString(extraction?.pageType);

  if (pageType === 'listing_detail') {
    confidence += 0.35;
  } else if (pageType === 'property_overview') {
    confidence += 0.2;
  }

  if (trimString(extraction?.exactAddress)) {
    confidence += 0.15;
  } else if (looksLikeExactAddress(markdown)) {
    confidence += 0.08;
  }

  if (trimString(extraction?.monthlyRent) || extractRentFromText(markdown)) {
    confidence += 0.1;
  }

  if (
    typeof extraction?.bedrooms === 'number' ||
    typeof extraction?.bathrooms === 'number'
  ) {
    confidence += 0.08;
  }

  if (normalizeTextList(extraction?.keyAmenities, 5).length > 0) {
    confidence += 0.06;
  }

  if (trimString(extraction?.contactNumber) || trimString(extraction?.managerName)) {
    confidence += 0.07;
  }

  if (looksLikeDetailPageText(markdown)) {
    confidence += 0.08;
  }

  confidence += Math.max(0, Math.min(0.1, baseCandidateScore / 200));

  return Math.max(0, Math.min(0.99, Number(confidence.toFixed(2))));
}

function isVerifiedDetailPage(
  extraction: ListingExtraction | null,
  markdown: string,
  confidence: number,
  candidate: ListingCandidate,
) {
  const pageType = trimString(extraction?.pageType);

  if (pageType && DETAIL_PAGE_TYPES.has(pageType)) {
    return true;
  }

  if (pageType === 'search_results' || pageType === 'category_page') {
    return false;
  }

  const hasAddress = trimString(extraction?.exactAddress) || looksLikeExactAddress(markdown);
  const hasPrice = Boolean(trimString(extraction?.monthlyRent) || extractRentFromText(markdown));
  const hasBedsOrBaths =
    typeof extraction?.bedrooms === 'number' ||
    typeof extraction?.bathrooms === 'number' ||
    extractBedroomsFromText(markdown) !== null ||
    extractBathroomsFromText(markdown) !== null;
  const hasManagementSignals = Boolean(
    trimString(extraction?.contactNumber) ||
      trimString(extraction?.managerName) ||
      looksLikeDetailPageText(markdown),
  );
  const hasAmenitySignals = normalizeTextList(extraction?.keyAmenities, 5).length > 0;
  const hasCoreFacts =
    hasPrice && (hasBedsOrBaths || hasManagementSignals || hasAmenitySignals);
  const likelyDetailUrl = !analyzeListingUrl(candidate.canonicalUrl)?.isGeneric;

  if (hasAddress && hasCoreFacts && confidence >= 0.52) {
    return true;
  }

  return Boolean(likelyDetailUrl && hasCoreFacts && confidence >= 0.48);
}

function buildListingFromScrape(
  candidate: ListingCandidate,
  scraped: Document,
  fallbackLocation?: string,
): Listing | null {
  const extraction = getListingExtraction(scraped);
  const patch = buildListingPatchFromExtraction(extraction);
  const markdown = scraped.markdown ?? '';
  const canonicalUrl =
    patch.listingUrl ??
    canonicalizeListingUrl(getSearchResultUrl(scraped)) ??
    candidate.canonicalUrl;

  if (!canonicalUrl) {
    return null;
  }

  const confidence = computeDetailConfidence(extraction, markdown, candidate.score);
  const verifiedDetailPage = isVerifiedDetailPage(
    extraction,
    markdown,
    confidence,
    candidate,
  );

  if (!verifiedDetailPage) {
    return null;
  }

  const description =
    patch.description ??
    trimString(extraction?.summary) ??
    toPlainTextSnippet(getSearchResultText(scraped), 220);
  const sourceLinks = mergeSourceLinks(canonicalUrl, candidate.rawUrl, patch.sourceLinks ?? []);
  const title =
    patch.title ??
    getSearchResultTitle(scraped) ??
    candidate.title ??
    'Untitled listing';
  const location = patch.location ?? fallbackLocation ?? 'Location unavailable';

  return {
    id: createListingId(canonicalUrl),
    title,
    rent: patch.rent ?? extractRentFromText(markdown),
    location,
    exactAddress: patch.exactAddress ?? null,
    bedrooms: patch.bedrooms ?? extractBedroomsFromText(markdown),
    bathrooms: patch.bathrooms ?? extractBathroomsFromText(markdown),
    petPolicy: patch.petPolicy ?? inferPetPolicy(markdown),
    availableFrom: patch.availableFrom ?? extractAvailableFromText(markdown),
    listingUrl: canonicalUrl,
    rawSearchUrl: candidate.rawUrl,
    thumbnailUrl: patch.thumbnailUrl ?? getSearchResultImage(scraped),
    contactPhone: patch.contactPhone ?? extractPhoneNumber(markdown),
    managerName: patch.managerName ?? null,
    detailConfidence: confidence,
    keyAmenities: patch.keyAmenities ?? [],
    sourceLinks,
    verifiedDetailPage,
    description: description || 'No structured listing summary was extracted.',
    sourceSite: getSourceSite(canonicalUrl),
    attributes: patch.attributes ?? {},
  };
}

function buildDiscoveryIntent(criteria: SearchCriteria) {
  const parts: string[] = [criteria.query.trim()];
  const normalizedLocation = normalizeLocationAlias(criteria.location);

  if (normalizedLocation) {
    parts.push(`"${normalizedLocation}"`);
  }

  if (criteria.maxBudget && !/\b(?:under|below|max|budget)\b/i.test(criteria.query)) {
    parts.push(`under ${criteria.maxBudget}`);
  }

  if (criteria.bedrooms && !/\b\d+\s*(?:bed|bedroom|br|bhk)\b/i.test(criteria.query)) {
    parts.push(`${criteria.bedrooms} bedroom`);
  }

  for (const preference of criteria.preferences) {
    const text = preferenceToQueryText(preference).trim();
    if (text) {
      parts.push(text);
    }
  }

  parts.push('apartment rental listing');

  return parts.filter(Boolean).join(' ');
}

export function buildDiscoveryQueries(criteria: SearchCriteria) {
  const intent = buildDiscoveryIntent(criteria);
  const preferredDomains = getPreferredRentalDomains(criteria.location);
  const negativeFilters = [
    '-inurl:apartments-for-rent',
    '-inurl:homes-for-rent',
    '-inurl:for-rent',
    '-inurl:search',
    '-inurl:map',
    '-inurl:pet-friendly',
    '-inurl:studio',
    '-inurl:1-bedroom',
    '-inurl:2-bedrooms',
    '-inurl:3-bedrooms',
  ].join(' ');

  const queries = [
    `${intent} ${negativeFilters}`,
    ...preferredDomains.slice(0, 3).map((domain) => {
      return `${intent} site:${domain} ${negativeFilters}`;
    }),
  ];

  return Array.from(
    new Set(
      queries
        .map((query) => query.replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    ),
  ).slice(0, 3);
}

export async function searchListings(
  query: string,
  location?: string | null,
  limit = 10,
) {
  const request: Omit<SearchRequest, 'query'> = {
    limit,
    location: location ?? undefined,
    sources: ['web'],
    timeout: 60_000,
  };

  const result = await withTimeout(
    getClient().search(query, request),
    SEARCH_REQUEST_TIMEOUT_MS,
    'Listing discovery search',
  );

  return result.web ?? [];
}

export async function searchSupportingContext(
  query: string,
  limit: number,
  location?: string | null,
) {
  const request: Omit<SearchRequest, 'query'> = {
    limit,
    location: location ?? undefined,
    sources: ['web'],
    scrapeOptions: {
      formats: ['markdown'],
      onlyMainContent: true,
      actions: [{ type: 'wait', milliseconds: 1_500 }],
    },
  };

  const result = await withTimeout(
    getClient().search(query, request),
    SUPPORTING_SEARCH_TIMEOUT_MS,
    'Supporting research search',
  );

  return result.web ?? [];
}

export async function scrapeListingUrl(url: string) {
  return withTimeout(
    getClient().scrape(url, {
      formats: ['markdown', listingExtractionFormat],
      onlyMainContent: false,
      timeout: SCRAPE_REQUEST_TIMEOUT_MS,
      actions: [{ type: 'wait', milliseconds: 2_500 }],
    }),
    SCRAPE_REQUEST_TIMEOUT_MS + 5_000,
    'Listing detail scrape',
  );
}

export async function researchListingWithAgent({
  listingUrl,
  title,
  location,
  exactAddress,
}: {
  listingUrl: string;
  title?: string | null;
  location?: string | null;
  exactAddress?: string | null;
}) {
  const prompt = [
    'Research this rental listing and return a factual renter dossier.',
    `Canonical listing URL: ${listingUrl}`,
    title ? `Property name: ${title}` : null,
    exactAddress ? `Known exact address: ${exactAddress}` : null,
    location ? `Known location: ${location}` : null,
    'Start from the listing page, then verify missing facts using supporting sources if needed.',
    'Prefer exact listing-page facts when present.',
    'Include supportingSources with the URLs you used for key corroborating facts.',
    'Do not invent information. Use null or empty arrays when a fact cannot be verified.',
  ]
    .filter(Boolean)
    .join('\n');

  const result = await getClient().agent({
    urls: [listingUrl],
    prompt,
    schema: propertyResearchAgentSchema,
    maxCredits: AGENT_MAX_CREDITS,
    strictConstrainToURLs: false,
    model: 'spark-1-mini',
    pollInterval: 2,
    timeout: 90,
  });

  if (result.status !== 'completed' || !result.data || typeof result.data !== 'object') {
    return null;
  }

  return result.data as AgentPropertyResearch;
}

function scoreSearchCandidate(
  result: FirecrawlSearchResult,
  fallbackLocation?: string,
): ListingCandidate | null {
  const rawUrl = trimString(getSearchResultUrl(result));
  if (!rawUrl) {
    return null;
  }

  const urlSignal = analyzeListingUrl(rawUrl);
  if (!urlSignal) {
    return null;
  }

  let score = urlSignal.score;
  const title = trimString(getSearchResultTitle(result));
  const description = toPlainTextSnippet(getSearchResultText(result), 220);
  const textBlob = [title, description, fallbackLocation].filter(Boolean).join(' ');

  if (looksLikeSearchTitle(title)) {
    score -= 18;
  }

  if (looksLikeExactAddress(textBlob)) {
    score += 14;
  }

  if (extractRentFromText(textBlob)) {
    score += 8;
  }

  if (extractBedroomsFromText(textBlob) !== null || extractBathroomsFromText(textBlob) !== null) {
    score += 8;
  }

  if (looksLikeDetailPageText(textBlob)) {
    score += 10;
  }

  if (urlSignal.isGeneric && score < 8) {
    return null;
  }

  return {
    rawUrl,
    canonicalUrl: urlSignal.canonicalUrl,
    title,
    description,
    score,
    sourceSite: getSourceSite(urlSignal.canonicalUrl),
  };
}

async function emitEvent(
  callback: DiscoverCanonicalListingsOptions['onEvent'],
  event: SearchStreamEvent,
) {
  await callback?.(event);
}

async function scrapeAndVerifyCandidate(
  candidate: ListingCandidate,
  fallbackLocation?: string,
) {
  const scraped = await scrapeListingUrl(candidate.canonicalUrl);
  return buildListingFromScrape(candidate, scraped, fallbackLocation);
}

export async function discoverCanonicalListings(
  criteria: SearchCriteria,
  options: DiscoverCanonicalListingsOptions = {},
) {
  const targetCount = options.targetCount ?? DEFAULT_ENRICHED_LISTING_TARGET;
  const queries = buildDiscoveryQueries(criteria);

  await emitEvent(options.onEvent, {
    type: 'status',
    phase: 'discovering',
    message: 'Searching rental sites for detail pages...',
    target: targetCount,
  });

  const rawQueryResultsSettled = await Promise.allSettled(
    queries.map((query) => searchListings(query, criteria.location, DISCOVERY_RESULTS_PER_QUERY)),
  );
  const rawQueryResults = rawQueryResultsSettled
    .filter(
      (
        result,
      ): result is PromiseFulfilledResult<Awaited<ReturnType<typeof searchListings>>> =>
        result.status === 'fulfilled',
    )
    .map((result) => result.value);

  if (rawQueryResults.length === 0) {
    throw new Error(
      'Search timed out while verifying listing pages. Please try a broader query.',
    );
  }

  const candidateMap = new Map<string, ListingCandidate>();

  for (const results of rawQueryResults) {
    for (const result of results) {
      const candidate = scoreSearchCandidate(result, criteria.location);
      if (!candidate) {
        continue;
      }

      const existing = candidateMap.get(candidate.canonicalUrl);
      if (!existing || existing.score < candidate.score) {
        candidateMap.set(candidate.canonicalUrl, candidate);
      }
    }
  }

  const sortedCandidates = [...candidateMap.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_CANDIDATES_TO_SCRAPE);

  await emitEvent(options.onEvent, {
    type: 'status',
    phase: 'filtering',
    message: `Found ${sortedCandidates.length} candidate URLs. Verifying which ones are actual listing detail pages...`,
    scanned: sortedCandidates.length,
    accepted: 0,
    target: targetCount,
  });

  const listings: Listing[] = [];
  const acceptedUrls = new Set<string>();
  let scannedCount = 0;
  let cursor = 0;

  const workerCount = Math.min(SCRAPE_CONCURRENCY, sortedCandidates.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < sortedCandidates.length) {
      const candidate = sortedCandidates[cursor];
      cursor += 1;

      if (!candidate || listings.length >= targetCount) {
        return;
      }

      const listing = await scrapeAndVerifyCandidate(candidate, criteria.location).catch(
        () => null,
      );

      scannedCount += 1;

      if (listing && !acceptedUrls.has(listing.listingUrl) && listings.length < targetCount) {
        acceptedUrls.add(listing.listingUrl);
        listings.push(listing);

        await emitEvent(options.onEvent, {
          type: 'listing',
          listing,
        });
      }

      await emitEvent(options.onEvent, {
        type: 'status',
        phase: 'scraping',
        message:
          listings.length >= targetCount
            ? `Verified ${listings.length} strong listing pages.`
            : `Verified ${listings.length} listing pages after checking ${scannedCount} candidates...`,
        scanned: scannedCount,
        accepted: listings.length,
        target: targetCount,
      });
    }
  });

  await Promise.all(workers);

  await emitEvent(options.onEvent, {
    type: 'status',
    phase: 'complete',
    message:
      listings.length > 0
        ? `Found ${listings.length} verified property detail pages.`
        : 'No verified property detail pages were found for this search.',
    scanned: scannedCount,
    accepted: listings.length,
    target: targetCount,
  });

  return listings;
}

export function buildPropertyDossier(
  listingExtraction: ListingExtraction | null,
  agentResearch: AgentPropertyResearch | null,
  baseSourceLinks: SourceLink[] = [],
): PropertyDossier {
  const sourceLinks = dedupeSourceLinks([
    ...baseSourceLinks,
    ...normalizeAgentSourceLinks(agentResearch?.supportingSources),
  ]);

  return {
    overview:
      trimString(agentResearch?.overview) ??
      trimString(listingExtraction?.summary) ??
      null,
    exactAddress:
      trimString(listingExtraction?.exactAddress) ??
      trimString(agentResearch?.exactAddress) ??
      null,
    managerName:
      trimString(listingExtraction?.managerName) ??
      trimString(agentResearch?.managerName) ??
      null,
    contactPhone:
      trimString(listingExtraction?.contactNumber) ??
      trimString(agentResearch?.contactPhone) ??
      null,
    contactEmail:
      trimString(listingExtraction?.contactEmail) ??
      trimString(agentResearch?.contactEmail) ??
      null,
    availability:
      trimString(listingExtraction?.availableFrom) ??
      trimString(agentResearch?.availability) ??
      null,
    leaseTerms:
      trimString(listingExtraction?.leaseTerms) ??
      trimString(agentResearch?.leaseTerms) ??
      null,
    petPolicy:
      trimString(listingExtraction?.petPolicy) ??
      trimString(agentResearch?.petPolicy) ??
      null,
    keyAmenities: Array.from(
      new Set([
        ...normalizeTextList(listingExtraction?.keyAmenities, 6),
        ...normalizeTextList(agentResearch?.keyAmenities, 6),
      ]),
    ).slice(0, 6),
    feesAndPolicies: normalizePropertyFacts(
      normalizePropertyFacts(listingExtraction?.feesAndPolicies).length > 0
        ? listingExtraction?.feesAndPolicies
        : agentResearch?.feesAndPolicies,
    ),
    notableConcerns: Array.from(
      new Set([
        ...normalizeTextList(listingExtraction?.notableConcerns, 5),
        ...normalizeTextList(agentResearch?.notableConcerns, 5),
      ]),
    ).slice(0, 5),
    sourceLinks,
  };
}

export function extractPhoneNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const candidates = value.match(/\+?\d[\d\s().-]{7,}\d/g) ?? [];

  for (const candidate of candidates) {
    const cleaned = candidate.replace(/\D/g, '');
    if (cleaned.length >= 10) {
      const areaCode = cleaned.startsWith('1') ? cleaned.slice(1, 4) : cleaned.slice(0, 3);
      if (['800', '888', '877', '866', '855', '833', '844'].includes(areaCode)) {
        continue;
      }
      return candidate.trim();
    }
  }

  return null;
}

export function extractRentFromText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const monthlyMatch =
    value.match(
      /(?:[$£€₹]\s?\d[\d,]*(?:\.\d{2})?|\b\d[\d,]*(?:\.\d{2})?\s?(?:USD|GBP|EUR|INR))\s*(?:\/\s*month|per month|pcm|monthly)/i,
    ) ??
    value.match(/[$£€₹]\s?\d[\d,]*(?:\.\d{2})?/);

  return monthlyMatch?.[0]?.trim() ?? null;
}

export function rentToNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const numeric = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function extractBedroomsFromText(value: string | null | undefined) {
  const match = value?.match(/(\d+(?:\.\d+)?)\s*(?:bed|bedroom|br)\b/i);
  if (!match) {
    return null;
  }

  const bedrooms = Number(match[1]);
  return Number.isFinite(bedrooms) ? bedrooms : null;
}

export function extractBathroomsFromText(value: string | null | undefined) {
  const match = value?.match(/(\d+(?:\.\d+)?)\s*(?:bath|bathroom)\b/i);
  if (!match) {
    return null;
  }

  const bathrooms = Number(match[1]);
  return Number.isFinite(bathrooms) ? bathrooms : null;
}

export function extractAvailableFromText(value: string | null | undefined) {
  const match = value?.match(
    /available(?:\s+from)?[:\s]+([A-Za-z]{3,9}\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}\/\d{1,2}\/\d{2,4}|immediately)/i,
  );

  return match?.[1]?.trim() ?? null;
}

function inferPetPolicy(text: string) {
  if (!text) {
    return null;
  }

  if (/\b(?:pet-friendly|pets allowed|cats allowed|dogs allowed)\b/i.test(text)) {
    return 'Pet-friendly';
  }

  if (/\bno pets\b/i.test(text)) {
    return 'No pets';
  }

  if (/\bpet\b/i.test(text)) {
    return 'Ask landlord';
  }

  return null;
}

export function getSourceSite(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'listing site';
  }
}

export function buildSourceLink(
  url: string | null | undefined,
  label: string,
  kind: SourceKind,
  note?: string | null,
) {
  const normalizedUrl = canonicalizeListingUrl(url);
  const normalizedLabel = trimString(label);

  if (!normalizedUrl || !normalizedLabel) {
    return null;
  }

  return {
    url: normalizedUrl,
    label: normalizedLabel,
    kind,
    note: trimString(note),
  } satisfies SourceLink;
}

export function searchResultsToSourceLinks(
  results: FirecrawlSearchResult[],
  kind: SourceKind,
  maxResults = 3,
) {
  const links: SourceLink[] = [];

  for (const result of results.slice(0, maxResults)) {
    const url = getSearchResultUrl(result);
    const label = getSearchResultTitle(result) ?? getSourceSite(url ?? '');
    const snippet = toPlainTextSnippet(getSearchResultText(result), 120);
    const link = buildSourceLink(url, label, kind, snippet || null);

    if (link) {
      links.push(link);
    }
  }

  return dedupeSourceLinks(links);
}

export function summarizeSearchResults(
  results: FirecrawlSearchResult[],
  maxResults = 3,
) {
  const lines = results
    .slice(0, maxResults)
    .map((result) => {
      const title =
        getSearchResultTitle(result) ?? getSearchResultUrl(result) ?? 'Untitled result';
      const text = getSearchResultText(result);
      const rent = extractRentFromText(text);
      const source = getSearchResultUrl(result);
      const sourceLabel = source ? ` (${getSourceSite(source)})` : '';
      const rentLabel = rent ? ` - ${rent}` : '';
      const snippet = toPlainTextSnippet(text, 140);

      return `${title}${sourceLabel}${rentLabel}${snippet ? `: ${snippet}` : ''}`;
    })
    .filter(Boolean);

  return lines.join('\n');
}

export {
  AGENT_MAX_CREDITS,
  DEFAULT_ENRICHED_LISTING_TARGET,
  DETAIL_PAGE_TYPES,
};
