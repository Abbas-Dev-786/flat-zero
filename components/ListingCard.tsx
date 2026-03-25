import type { DynamicValue } from "@/lib/types";
import { getDisplayableAttributes } from "@/lib/search-preferences";

interface ListingCardProps {
  title: string;
  rent: string | null;
  location: string;
  exactAddress: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sourceSite: string;
  description: string;
  attributes: Record<string, DynamicValue>;
  thumbnailUrl?: string | null;
  contactPhone: string | null;
  managerName: string | null;
  detailConfidence: number;
  keyAmenities: string[];
  verifiedDetailPage: boolean;
  listingUrl: string;
  onSelect?: () => void;
}

export function ListingCard({
  title,
  rent,
  location,
  exactAddress,
  bedrooms,
  bathrooms,
  sourceSite,
  description,
  attributes,
  thumbnailUrl,
  contactPhone,
  managerName,
  detailConfidence,
  keyAmenities,
  verifiedDetailPage,
  listingUrl,
  onSelect,
}: ListingCardProps) {
  const attributeBadges = [
    ...keyAmenities.map((amenity) => ({
      key: amenity,
      displayText: amenity,
    })),
    ...getDisplayableAttributes(attributes),
  ].slice(0, 5);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl hover:shadow-slate-200">
      {/* Property Image Cover */}
      {thumbnailUrl ? (
        <div className="h-48 w-full relative overflow-hidden bg-slate-100 border-b border-slate-200">
          {/* Fallback pattern if image is broken */}
          <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-image text-slate-300"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover z-10 scale-100 group-hover:scale-105 transition-transform duration-500 ease-in-out"
          />
        </div>
      ) : (
        <div className="h-40 w-full bg-gradient-to-br from-slate-100 to-slate-200 border-b border-slate-200 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-building text-slate-400"
          >
            <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
            <path d="M9 22v-4h6v4" />
            <path d="M8 6h.01" />
            <path d="M16 6h.01" />
            <path d="M12 6h.01" />
            <path d="M12 10h.01" />
            <path d="M12 14h.01" />
            <path d="M16 10h.01" />
            <path d="M16 14h.01" />
            <path d="M8 10h.01" />
            <path d="M8 14h.01" />
          </svg>
        </div>
      )}

      <div className="p-6 flex-1 flex flex-col">
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {verifiedDetailPage && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 shadow-sm">
              Verified page
            </span>
          )}
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 shadow-sm backdrop-blur-md">
            via {sourceSite}
          </span>
        </div>

        <div className="mb-2 text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <span>{rent ? rent : "Price on request"}</span>
          <span className="text-sm font-normal text-slate-500">/ month</span>
        </div>

        <h3 className="text-lg font-semibold text-slate-900 line-clamp-1">
          {title}
        </h3>
        <p className="mt-1 text-sm font-medium text-slate-600">
          {exactAddress ?? location}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
            confidence {(detailConfidence * 100).toFixed(0)}%
          </span>
          {managerName && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
              {managerName}
            </span>
          )}
          {contactPhone && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
              {contactPhone}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-700">
          {bedrooms !== null && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-md px-2.5 py-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-bed text-slate-400"
              >
                <path d="M2 4v16" />
                <path d="M2 8h18a2 2 0 0 1 2 2v10" />
                <path d="M2 17h20" />
                <path d="M6 8v9" />
              </svg>
              <span>{bedrooms} Beds</span>
            </div>
          )}
          {bathrooms !== null && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-md px-2.5 py-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-bath text-slate-400"
              >
                <path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
                <line x1="10" x2="8" y1="5" y2="7" />
                <line x1="2" x2="22" y1="12" y2="12" />
                <line x1="7" x2="7" y1="19" y2="21" />
                <line x1="17" x2="17" y1="19" y2="21" />
              </svg>
              <span>{bathrooms} Baths</span>
            </div>
          )}
        </div>

        <p className="mt-4 text-sm text-slate-500 font-mono line-clamp-2">
          {description}
        </p>

        {attributeBadges.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {attributeBadges.map((attribute) => (
              <span
                key={attribute.key}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
              >
                {attribute.displayText}
              </span>
            ))}
          </div>
        )}

        <a
          href={listingUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-sm text-blue-600 transition-colors hover:text-blue-700"
        >
          Open canonical listing
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 17 17 7" />
            <path d="M7 7h10v10" />
          </svg>
        </a>

        <button
          type="button"
          onClick={onSelect}
          className="mt-6 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          Select this property
        </button>
      </div>

      {/* Interactive CTA overlay on hover */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 z-20"></div>
    </article>
  );
}
