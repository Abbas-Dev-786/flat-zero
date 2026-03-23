'use client';

import { LeverageData } from '@/lib/types';

interface LeveragePanelProps {
  data: LeverageData | null;
  isLoading: boolean;
}

export function LeveragePanel({ data, isLoading }: LeveragePanelProps) {
  if (isLoading) {
    return (
      <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md animate-pulse">
        <div className="flex items-center gap-3 mb-6">
           <div className="w-10 h-10 rounded-full bg-blue-500/20"></div>
           <div className="h-6 w-48 bg-gray-700 rounded-md"></div>
        </div>
        <div className="space-y-4">
          <div className="h-4 w-full bg-gray-700/50 rounded-md"></div>
          <div className="h-4 w-5/6 bg-gray-700/50 rounded-md"></div>
          <div className="h-4 w-4/6 bg-gray-700/50 rounded-md"></div>
        </div>
        <div className="mt-8 flex items-center justify-center">
          <div className="flex items-center text-blue-400 gap-2">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span>Running Deep Scrape & Gathering Intel...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="w-full rounded-2xl border border-blue-500/20 bg-gradient-to-b from-blue-900/10 to-transparent p-6 backdrop-blur-md shadow-2xl shadow-blue-900/10">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
        <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-check"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Agent Leverage Brief</h2>
          <p className="text-xs text-blue-300 font-medium">Mission intel successfully acquired</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-crosshair"><circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/></svg>
            Key Negotiation Points
          </h3>
          <ul className="space-y-2">
            {data.negotiationPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-3 bg-white/5 rounded-lg p-3 border border-white/5">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold mt-0.5">{i + 1}</span>
                <span className="text-sm text-gray-200">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bar-chart-3"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
              Market Intel
            </h4>
            <p className="text-sm text-gray-300">
              {data.marketComparablesSummary || "Insufficient comparable data in this area. Will rely on direct value propositions."}
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-building"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
              Landlord Rep
            </h4>
            <p className="text-sm text-gray-300">
              {data.landlordReputationSummary || "No major red flags found in landlord reputation history. Looks clear."}
            </p>
          </div>
        </div>

        {data.contactPhone && (
          <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-xl mt-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-circle-2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            <span className="text-sm font-medium">Extracted Target Phone: <strong className="tracking-wider">{data.contactPhone}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
