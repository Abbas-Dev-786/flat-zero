import type { DynamicValue } from '@/lib/types';
import { getDisplayableAttributes } from '@/lib/search-preferences';

interface ListingCardProps {
  title: string;
  rent: string | null;
  location: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sourceSite: string;
  description: string;
  attributes: Record<string, DynamicValue>;
  thumbnailUrl?: string | null;
  onSelect?: () => void;
}

export function ListingCard({
  title,
  rent,
  location,
  bedrooms,
  bathrooms,
  sourceSite,
  description,
  attributes,
  thumbnailUrl,
  onSelect,
}: ListingCardProps) {
  const attributeBadges = getDisplayableAttributes(attributes).slice(0, 3);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition-all hover:-translate-y-1 hover:border-blue-500/50 hover:bg-white/10 hover:shadow-2xl hover:shadow-blue-500/20">
      {/* Property Image Cover */}
      {thumbnailUrl ? (
        <div className="h-48 w-full relative overflow-hidden bg-black/50 border-b border-white/5">
           {/* Fallback pattern if image is broken */}
           <div className="absolute inset-0 bg-blue-900/10 flex items-center justify-center">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-image text-white/20"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
           </div>
           {/* eslint-disable-next-line @next/next/no-img-element */}
           <img src={thumbnailUrl} alt={title} className="absolute inset-0 w-full h-full object-cover z-10 scale-100 group-hover:scale-105 transition-transform duration-500 ease-in-out" />
        </div>
      ) : (
        <div className="h-40 w-full bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border-b border-white/5 flex items-center justify-center">
           <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-building text-white/20"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
        </div>
      )}

      <div className="p-6 flex-1 flex flex-col">
        <div className="absolute top-4 right-4 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs font-semibold text-blue-300 ring-1 ring-inset ring-blue-500/30 shadow-xl z-20">
          via {sourceSite}
        </div>
        
        <div className="mb-2 text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <span>{rent ? rent : 'Price on request'}</span>
          <span className="text-sm font-normal text-gray-400">/ month</span>
        </div>
        
        <h3 className="text-lg font-semibold text-gray-100 line-clamp-1">{title}</h3>
        <p className="mt-1 text-sm text-gray-400 font-medium">{location}</p>
        
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-300">
          {bedrooms !== null && (
            <div className="flex items-center gap-1.5 bg-white/5 rounded-md px-2.5 py-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bed text-gray-400"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>
              <span>{bedrooms} Beds</span>
            </div>
          )}
          {bathrooms !== null && (
            <div className="flex items-center gap-1.5 bg-white/5 rounded-md px-2.5 py-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bath text-gray-400"><path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><line x1="10" x2="8" y1="5" y2="7"/><line x1="2" x2="22" y1="12" y2="12"/><line x1="7" x2="7" y1="19" y2="21"/><line x1="17" x2="17" y1="19" y2="21"/></svg>
              <span>{bathrooms} Baths</span>
            </div>
          )}
        </div>

        <p className="mt-4 text-sm text-gray-400/80 font-mono line-clamp-2">
          {description}
        </p>

        {attributeBadges.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {attributeBadges.map((attribute) => (
              <span
                key={attribute.key}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-200"
              >
                {attribute.displayText}
              </span>
            ))}
          </div>
        )}

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
