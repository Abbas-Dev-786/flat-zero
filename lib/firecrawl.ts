import {
  FirecrawlClient,
  type Document,
  type JsonFormat,
  type SearchResultWeb,
} from '@mendable/firecrawl-js';
import type { DynamicValue, ListingPatch } from '@/lib/types';

export type FirecrawlSearchResult = SearchResultWeb | Document;

type ListingExtractionAttribute = {
  key?: string | null;
  label?: string | null;
  value?: string | number | boolean | string[] | null;
};

export type ListingExtraction = {
  propertyName?: string | null;
  propertyLocation?: string | null;
  monthlyRent?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  petPolicy?: string | null;
  availableFrom?: string | null;
  contactNumber?: string | null;
  mainPropertyImageUrl?: string | null;
  extraAttributes?: ListingExtractionAttribute[] | null;
};

let firecrawlClient: FirecrawlClient | null = null;

const listingExtractionFormat: JsonFormat = {
  type: 'json',
  prompt:
    'Extract structured rental listing data from this page. Use null for any field that is not clearly present. Populate extraAttributes only with non-canonical renter-relevant facts such as parking, furnishing, balcony, laundry, gym, utilities included, elevator, doorman, quiet building, or lease terms. Do not repeat the canonical fields inside extraAttributes. Use short snake_case keys and clear human labels.',
  schema: {
    type: 'object',
    properties: {
      propertyName: { type: ['string', 'null'] },
      propertyLocation: { type: ['string', 'null'] },
      monthlyRent: { type: ['string', 'null'] },
      bedrooms: { type: ['number', 'null'] },
      bathrooms: { type: ['number', 'null'] },
      petPolicy: { type: ['string', 'null'] },
      availableFrom: { type: ['string', 'null'] },
      contactNumber: { type: ['string', 'null'] },
      mainPropertyImageUrl: { type: ['string', 'null'] },
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

const CANONICAL_ATTRIBUTE_KEYS = new Set([
  'property_name',
  'title',
  'property_location',
  'location',
  'monthly_rent',
  'rent',
  'bedrooms',
  'bathrooms',
  'pet_policy',
  'pet_friendly',
  'available_from',
  'contact_number',
  'phone',
  'main_property_image_url',
  'image',
  'thumbnail',
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

function isDocument(result: FirecrawlSearchResult): result is Document {
  return 'metadata' in result || 'markdown' in result || 'json' in result;
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

export async function searchListings(query: string, location?: string | null, limit = 10) {
  const searchOptions: any = {
    limit,
    tbs: 'qdr:w',
    scrapeOptions: {
      formats: ['markdown', listingExtractionFormat],
      onlyMainContent: true,
    },
  };

  if (location) {
    searchOptions.location = location;
  }

  const result = await getClient().search(query, searchOptions);

  return result.web ?? [];
}

export async function searchSupportingContext(query: string, limit: number) {
  const result = await getClient().search(query, {
    limit,
    scrapeOptions: {
      formats: ['markdown'],
      onlyMainContent: true,
    },
  });

  return result.web ?? [];
}

export async function scrapeListingUrl(url: string) {
  return getClient().scrape(url, {
    formats: ['markdown', listingExtractionFormat],
    onlyMainContent: true,
  });
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
      : null) ??
    firstMarkdownHeading(result.markdown)
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

export function toPlainTextSnippet(value: string | null | undefined, maxLength = 280) {
  if (!value) {
    return '';
  }

  const snippet = stripMarkdown(value);
  if (snippet.length <= maxLength) {
    return snippet;
  }

  return `${snippet.slice(0, maxLength - 1).trimEnd()}...`;
}

function trimString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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

function normalizeAttributeKey(key: string | null | undefined, label: string | null | undefined) {
  const source = trimString(key) || trimString(label) || 'attribute';

  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'attribute';
}

export function normalizeListingAttributes(extraction: ListingExtraction | null | undefined) {
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

export function buildListingPatchFromExtraction(
  extraction: ListingExtraction | null | undefined,
) {
  const patch: ListingPatch = {};

  if (!extraction) {
    return patch;
  }

  const propertyName = trimString(extraction.propertyName);
  const propertyLocation = trimString(extraction.propertyLocation);
  const monthlyRent = trimString(extraction.monthlyRent);
  const petPolicy = trimString(extraction.petPolicy);
  const availableFrom = trimString(extraction.availableFrom);
  const contactNumber = trimString(extraction.contactNumber);
  const mainPropertyImageUrl = trimString(extraction.mainPropertyImageUrl);

  if (propertyName) {
    patch.title = propertyName;
  }

  if (propertyLocation) {
    patch.location = propertyLocation;
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

  if (mainPropertyImageUrl) {
    patch.thumbnailUrl = mainPropertyImageUrl;
  }

  patch.attributes = normalizeListingAttributes(extraction);

  return patch;
}

export function extractPhoneNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const candidates = value.match(/\+?\d[\d\s().-]{7,}\d/g) ?? [];

  for (const candidate of candidates) {
    if (candidate.replace(/\D/g, '').length >= 10) {
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
      /(?:[$£€]\s?\d[\d,]*(?:\.\d{2})?|\b\d[\d,]*(?:\.\d{2})?\s?(?:USD|GBP|EUR))\s*(?:\/\s*month|per month|pcm|monthly)/i,
    ) ??
    value.match(/[$£€]\s?\d[\d,]*(?:\.\d{2})?/);

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

export function getSourceSite(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'listing site';
  }
}

export function summarizeSearchResults(results: FirecrawlSearchResult[], maxResults = 3) {
  const lines = results
    .slice(0, maxResults)
    .map((result) => {
      const title = getSearchResultTitle(result) ?? getSearchResultUrl(result) ?? 'Untitled result';
      const text = getSearchResultText(result);
      const rent = extractRentFromText(text);
      const source = getSearchResultUrl(result);
      const sourceLabel = source ? ` (${getSourceSite(source)})` : '';
      const rentLabel = rent ? ` - ${rent}` : '';
      const snippet = toPlainTextSnippet(text, 140);

      return `${title}${sourceLabel}${rentLabel}${snippet ? `: ${snippet}` : ''}`;
    })
    .filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : null;
}
