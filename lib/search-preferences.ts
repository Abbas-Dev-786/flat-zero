import type { DynamicValue, SearchCriteria, SearchPreference } from '@/lib/types';

type PreferencePattern = {
  key: string;
  label: string;
  pattern: RegExp;
  value: DynamicValue;
};

const PREFERENCE_PATTERNS: PreferencePattern[] = [
  {
    key: 'pet_friendly',
    label: 'Pet friendly',
    pattern: /\b(?:pet[-\s]?friendly|pets?\s+(?:allowed|welcome))\b/i,
    value: true,
  },
  {
    key: 'parking',
    label: 'Parking',
    pattern: /\b(?:parking|garage|off[-\s]?street parking)\b/i,
    value: true,
  },
  {
    key: 'furnishing',
    label: 'Furnishing',
    pattern: /\bunfurnished\b/i,
    value: 'unfurnished',
  },
  {
    key: 'furnishing',
    label: 'Furnishing',
    pattern: /\bfurnished\b/i,
    value: 'furnished',
  },
  {
    key: 'balcony',
    label: 'Balcony',
    pattern: /\bbalcony\b/i,
    value: true,
  },
  {
    key: 'gym',
    label: 'Gym',
    pattern: /\bgym\b/i,
    value: true,
  },
  {
    key: 'in_unit_laundry',
    label: 'In-unit laundry',
    pattern: /\b(?:in[-\s]?unit laundry|washer(?:\s*\/\s*dryer)?|laundry)\b/i,
    value: true,
  },
  {
    key: 'utilities_included',
    label: 'Utilities included',
    pattern: /\butilities included\b/i,
    value: true,
  },
  {
    key: 'air_conditioning',
    label: 'Air conditioning',
    pattern: /\b(?:air conditioning|a\/c|ac)\b/i,
    value: true,
  },
  {
    key: 'dishwasher',
    label: 'Dishwasher',
    pattern: /\bdishwasher\b/i,
    value: true,
  },
  {
    key: 'garden',
    label: 'Garden',
    pattern: /\b(?:garden|yard|private garden)\b/i,
    value: true,
  },
  {
    key: 'elevator',
    label: 'Elevator',
    pattern: /\b(?:elevator|lift)\b/i,
    value: true,
  },
  {
    key: 'doorman',
    label: 'Doorman',
    pattern: /\bdoorman\b/i,
    value: true,
  },
  {
    key: 'quiet_building',
    label: 'Quiet building',
    pattern: /\bquiet\b/i,
    value: true,
  },
  {
    key: 'near_transit',
    label: 'Near transit',
    pattern: /\b(?:near|close to)\s+(?:subway|tube|metro|station|transit|train)\b/i,
    value: true,
  },
];

function formatLabelFromKey(key: string) {
  return key
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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

function normalizePreferenceKey(key: string | undefined, label: string | undefined) {
  const source = key?.trim() || label?.trim() || 'preference';

  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'preference';
}

export function sanitizeSearchPreferences(
  preferences: Array<Partial<SearchPreference>> | undefined,
) {
  const normalized: SearchPreference[] = [];
  const seenKeys = new Set<string>();

  for (const preference of preferences ?? []) {
    const value = normalizeDynamicValue(preference.value);
    const key = normalizePreferenceKey(preference.key, preference.label);

    if (value === null || seenKeys.has(key)) {
      continue;
    }

    normalized.push({
      key,
      label: preference.label?.trim() || formatLabelFromKey(key),
      value,
    });
    seenKeys.add(key);
  }

  return normalized;
}

export function parseSearchCriteriaFromQuery(query: string): SearchCriteria {
  const normalizedQuery = query.trim();
  const budgetMatch = normalizedQuery.match(
    /\b(?:under|below|max|budget)\s*[$£€]?\s*(\d[\d,]*)/i,
  );
  const bedroomsMatch = normalizedQuery.match(/(\d+)\s*(?:bed|bedroom|br|bhk)\b/i);
  const locationMatch = normalizedQuery.match(
    /\bin\s+([a-zA-Z\s.-]+?)(?=\s+(?:under|below|max|budget|\d+\s*(?:bed|bedroom|br|bhk)\b)|,|$)/i,
  );

  const detectedPreferences = PREFERENCE_PATTERNS.map((pattern) => {
    const match = pattern.pattern.exec(normalizedQuery);
    if (!match || match.index === undefined) {
      return null;
    }

    return {
      index: match.index,
      preference: {
        key: pattern.key,
        label: pattern.label,
        value: pattern.value,
      },
    };
  })
    .filter(
      (
        detected,
      ): detected is {
        index: number;
        preference: SearchPreference;
      } => detected !== null,
    )
    .sort((left, right) => left.index - right.index)
    .map((detected) => detected.preference);

  return {
    query: normalizedQuery,
    location: locationMatch?.[1]?.trim(),
    maxBudget: budgetMatch
      ? Number(budgetMatch[1].replace(/,/g, ''))
      : undefined,
    bedrooms: bedroomsMatch ? Number(bedroomsMatch[1]) : undefined,
    preferences: sanitizeSearchPreferences(detectedPreferences),
  };
}

export function normalizeSearchCriteria(
  input: Partial<SearchCriteria> | null | undefined,
): SearchCriteria | null {
  if (!input?.query?.trim()) {
    return null;
  }

  const parsed = parseSearchCriteriaFromQuery(input.query);
  const providedPreferences = sanitizeSearchPreferences(input.preferences);
  const mergedPreferences = [
    ...providedPreferences,
    ...parsed.preferences.filter(
      (preference) =>
        !providedPreferences.some((provided) => provided.key === preference.key),
    ),
  ];

  return {
    query: input.query.trim(),
    location: input.location?.trim() || parsed.location,
    maxBudget:
      typeof input.maxBudget === 'number' ? input.maxBudget : parsed.maxBudget,
    bedrooms:
      typeof input.bedrooms === 'number' ? input.bedrooms : parsed.bedrooms,
    preferences: mergedPreferences,
  };
}

export function formatDynamicValue(value: DynamicValue) {
  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value);
}

export function formatSearchPreference(preference: SearchPreference) {
  if (typeof preference.value === 'boolean') {
    return preference.value
      ? preference.label
      : `${preference.label}: No`;
  }

  const valueText = formatDynamicValue(preference.value);
  return valueText ? `${preference.label}: ${valueText}` : preference.label;
}

export function preferenceToQueryText(preference: SearchPreference) {
  if (typeof preference.value === 'boolean') {
    return preference.value
      ? preference.label.toLowerCase()
      : `no ${preference.label.toLowerCase()}`;
  }

  const valueText = formatDynamicValue(preference.value);
  return valueText
    ? `${preference.label.toLowerCase()} ${valueText.toLowerCase()}`
    : preference.label.toLowerCase();
}

export function getDisplayableAttributes(
  attributes: Record<string, DynamicValue> | null | undefined,
) {
  return Object.entries(attributes ?? {})
    .map(([key, value]) => {
      if (value === null) {
        return null;
      }

      const label = formatLabelFromKey(key);
      if (typeof value === 'boolean') {
        return {
          key,
          label,
          valueText: value ? null : 'No',
          displayText: value ? label : `${label}: No`,
        };
      }

      const valueText = formatDynamicValue(value);
      if (!valueText) {
        return null;
      }

      return {
        key,
        label,
        valueText,
        displayText: `${label}: ${valueText}`,
      };
    })
    .filter(
      (
        attribute,
      ): attribute is {
        key: string;
        label: string;
        valueText: string | null;
        displayText: string;
      } => attribute !== null,
    );
}
