import type { SearchPreference } from "@/lib/types";

type OutboundCallParams = {
  toPhoneNumber: string;
  propertyAddress: string;
  askingRentText: string | null;
  listingPrice: number | null;
  comparables: number[];
  listingDetails: string;
  leveragePoints: string[];
  userQuestions: string[];
  preferences: SearchPreference[];
};

type ConversationTranscriptEntry = {
  role?: string | null;
  message?: string | null;
  time_in_call_secs?: number | null;
};

type DynamicVariables = {
  listing_price: string;
  avg_price: string;
  target_price: string;
  anchor_price: string;
  max_price: string;
  strategy_mode: "aggressive" | "moderate" | "soft" | "info-only";
  comparables_summary: string;
  pricing_posture: string;
  property_address: string;
  preferences: string;
  pressure_phrases: string;
};

type NegotiationMode = DynamicVariables["strategy_mode"];

type NegotiationStrategy = {
  mode: NegotiationMode;
  avg: number | null;
  target: number | null;
  anchor: number | null;
  maxAcceptable: number | null;
  pricingPosture: string;
  negotiationEnabled: boolean;
  hasComparableStory: boolean;
};

type PriceFormatting = {
  currencySymbol: string | null;
  priceQualifier: string;
};

export type ElevenLabsConversation = {
  agent_id?: string;
  agent_name?: string | null;
  conversation_id?: string;
  status?: "initiated" | "in-progress" | "processing" | "done" | "failed";
  transcript?: ConversationTranscriptEntry[];
  metadata?: {
    call_duration_secs?: number | null;
  } | null;
  analysis?: Record<string, unknown> | null;
  conversation_initiation_client_data?: Record<string, unknown> | null;
};

const PRESSURE_PHRASES = [
  "I'm ready to move quickly",
  "I've seen better options nearby",
  "I can finalize today if we agree",
];

const NO_COMPARABLES_SUMMARY =
  "Comparable market data was not available, so keep any pricing discussion cautious and exploratory.";

const NO_PRICING_CONTEXT_SUMMARY =
  "Reliable pricing context is unavailable for this call, so focus on availability, terms, and next steps.";

// ─── Comparables plausibility guard ───────────────────────────────────────────
// If the average comparable is below MIN_COMPARABLE_RATIO of the listing price,
// or above MAX_COMPARABLE_RATIO, the comparables are from a different market tier
// and should be discarded rather than used to make embarrassing price proposals.
const MIN_COMPARABLE_RATIO = 0.4; // avg must be at least 40% of listing price
const MAX_COMPARABLE_RATIO = 2.5; // avg must be no more than 250% of listing price

function filterPlausibleComparables(
  comparables: number[],
  listingPrice: number | null,
): number[] {
  const usable = comparables.filter((v) => Number.isFinite(v) && v > 0);
  if (!hasValidPrice(listingPrice) || usable.length === 0) return usable;

  const avg = usable.reduce((a, b) => a + b, 0) / usable.length;
  const ratio = avg / listingPrice!;

  if (ratio < MIN_COMPARABLE_RATIO || ratio > MAX_COMPARABLE_RATIO) {
    // The scraped comparables are from a completely different price tier.
    // Return empty so the strategy falls back to info-only or listing-only mode.
    return [];
  }

  return usable;
}
// ──────────────────────────────────────────────────────────────────────────────

function clipText(value: string, limit = 5000) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).trimEnd()}\n\n[Listing details truncated for length]`;
}

function formatPreference(preference: SearchPreference) {
  if (typeof preference.value === "boolean") {
    return preference.value ? preference.label : `${preference.label}: no`;
  }
  if (Array.isArray(preference.value)) {
    return `${preference.label}: ${preference.value.join(", ")}`;
  }
  if (preference.value === null) return preference.label;
  return `${preference.label}: ${preference.value}`;
}

function hasValidPrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function detectPriceQualifier(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("pcm")) return " pcm";
  if (normalized.includes("/month") || normalized.includes("/mo"))
    return " /month";
  if (normalized.includes("per month") || normalized.includes("monthly"))
    return " per month";
  if (
    normalized.includes("pw") ||
    normalized.includes("per week") ||
    normalized.includes("/week")
  )
    return " per week";
  return "";
}

function detectPriceFormatting(
  value: string | null | undefined,
): PriceFormatting {
  const normalized = value?.trim() ?? "";
  if (!normalized) return { currencySymbol: null, priceQualifier: "" };
  if (normalized.includes("₹") || /\bINR\b/i.test(normalized))
    return {
      currencySymbol: "₹",
      priceQualifier: detectPriceQualifier(normalized),
    };
  if (normalized.includes("£") || /\bGBP\b/i.test(normalized))
    return {
      currencySymbol: "£",
      priceQualifier: detectPriceQualifier(normalized),
    };
  if (normalized.includes("€") || /\bEUR\b/i.test(normalized))
    return {
      currencySymbol: "€",
      priceQualifier: detectPriceQualifier(normalized),
    };
  if (normalized.includes("$"))
    return {
      currencySymbol: "$",
      priceQualifier: detectPriceQualifier(normalized),
    };
  return {
    currencySymbol: null,
    priceQualifier: detectPriceQualifier(normalized),
  };
}

function formatPrice(value: number | null, formatting: PriceFormatting) {
  if (!hasValidPrice(value)) return "unavailable";
  const amount = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
  return `${formatting.currencySymbol ?? ""}${amount}${formatting.priceQualifier}`.trim();
}

function getUsableComparables(comparables: number[]) {
  return comparables.filter((value) => Number.isFinite(value) && value > 0);
}

export function buildComparablesSummary(
  comparables: number[],
  formatting: PriceFormatting,
) {
  const usableComparables = getUsableComparables(comparables);
  if (usableComparables.length === 0) return null;

  const min = Math.min(...usableComparables);
  const max = Math.max(...usableComparables);
  const avg =
    usableComparables.reduce((total, value) => total + value, 0) /
    usableComparables.length;

  if (usableComparables.length === 1) {
    return `A similar nearby listing is priced around ${formatPrice(min, formatting)}.`;
  }
  return `Similar flats nearby are priced between ${formatPrice(min, formatting)} and ${formatPrice(max, formatting)}, averaging ${formatPrice(avg, formatting)}.`;
}

export function computeNegotiationStrategy(
  listingPrice: number | null,
  rawComparables: number[],
): NegotiationStrategy {
  // ── Sanity-check comparables against listing price before using them ──
  const comparables = filterPlausibleComparables(rawComparables, listingPrice);
  // ─────────────────────────────────────────────────────────────────────

  const usableComparables = getUsableComparables(comparables);
  const avg =
    usableComparables.length > 0
      ? usableComparables.reduce((total, value) => total + value, 0) /
        usableComparables.length
      : null;

  if (avg !== null && hasValidPrice(listingPrice)) {
    const gapRatio = (listingPrice - avg) / avg;

    if (gapRatio > 0.15) {
      return {
        mode: "aggressive",
        avg: Math.round(avg),
        anchor: Math.round(avg * 0.85),
        target: Math.round(avg * 0.92),
        maxAcceptable: Math.round(Math.min(listingPrice, avg * 0.97)),
        pricingPosture:
          "The listing appears priced well above the nearby market, so negotiate assertively with comparable evidence.",
        negotiationEnabled: true,
        hasComparableStory: true,
      };
    }

    if (gapRatio > 0.05) {
      return {
        mode: "moderate",
        avg: Math.round(avg),
        anchor: Math.round(avg * 0.9),
        target: Math.round(avg * 0.97),
        maxAcceptable: Math.round(Math.min(listingPrice, avg * 1.01)),
        pricingPosture:
          "The listing is slightly above market, so negotiate firmly but stay collaborative.",
        negotiationEnabled: true,
        hasComparableStory: true,
      };
    }

    if (listingPrice <= avg) {
      return {
        mode: "soft",
        avg: Math.round(avg),
        anchor: Math.round(listingPrice * 0.96),
        target: Math.round(listingPrice * 0.99),
        maxAcceptable: Math.round(listingPrice),
        pricingPosture:
          "The asking rent is already close to or below market, so keep the negotiation light and respectful.",
        negotiationEnabled: true,
        hasComparableStory: true,
      };
    }

    return {
      mode: "soft",
      avg: Math.round(avg),
      anchor: Math.round(avg * 0.95),
      target: Math.round(Math.min(listingPrice, avg)),
      maxAcceptable: Math.round(Math.min(listingPrice, avg * 1.02)),
      pricingPosture:
        "The listing is already close to market, so negotiate softly and use readiness to move as the main leverage.",
      negotiationEnabled: true,
      hasComparableStory: true,
    };
  }

  if (avg !== null) {
    return {
      mode: "soft",
      avg: Math.round(avg),
      anchor: Math.round(avg * 0.95),
      target: Math.round(avg),
      maxAcceptable: Math.round(avg * 1.02),
      pricingPosture:
        "The asking rent is unavailable, so use nearby market pricing as a cautious baseline.",
      negotiationEnabled: true,
      hasComparableStory: true,
    };
  }

  if (hasValidPrice(listingPrice)) {
    return {
      mode: "soft",
      avg: Math.round(listingPrice),
      anchor: Math.round(listingPrice * 0.95),
      target: Math.round(listingPrice * 0.98),
      maxAcceptable: Math.round(listingPrice),
      pricingPosture:
        "Comparable market data is limited, so keep the negotiation light and use the call to gather more context.",
      negotiationEnabled: true,
      hasComparableStory: false,
    };
  }

  return {
    mode: "info-only",
    avg: null,
    anchor: null,
    target: null,
    maxAcceptable: null,
    pricingPosture:
      "Reliable pricing data is unavailable, so this call should focus on information-gathering and next steps.",
    negotiationEnabled: false,
    hasComparableStory: false,
  };
}

function buildDynamicVariables(
  params: OutboundCallParams,
  strategy: NegotiationStrategy,
  formatting: PriceFormatting,
): DynamicVariables {
  const comparablesSummary =
    buildComparablesSummary(params.comparables, formatting) ??
    (strategy.negotiationEnabled
      ? NO_COMPARABLES_SUMMARY
      : NO_PRICING_CONTEXT_SUMMARY);

  return {
    listing_price:
      params.askingRentText?.trim() ||
      formatPrice(params.listingPrice, formatting),
    avg_price: formatPrice(strategy.avg, formatting),
    target_price: formatPrice(strategy.target, formatting),
    anchor_price: formatPrice(strategy.anchor, formatting),
    max_price: formatPrice(strategy.maxAcceptable, formatting),
    strategy_mode: strategy.mode,
    comparables_summary: comparablesSummary,
    pricing_posture: strategy.pricingPosture,
    property_address: params.propertyAddress,
    preferences:
      params.preferences.length > 0
        ? params.preferences.map(formatPreference).join("; ")
        : "No additional preferences provided.",
    pressure_phrases: PRESSURE_PHRASES.join("; "),
  };
}

export function buildFirstMessage(
  vars: DynamicVariables,
  strategy: NegotiationStrategy,
) {
  if (strategy.hasComparableStory) {
    return `Hi, I'm calling about your listing at ${vars.property_address}… I've seen a few similar places nearby and wanted to quickly check something about the pricing… is now a good time to talk?`;
  }
  return `Hi, I'm calling about your listing at ${vars.property_address}… I had a couple of quick questions about availability and next steps… is now a good time to talk?`;
}

export function buildAgentPrompt({
  listingDetails,
  leveragePoints,
  userQuestions,
  strategy,
}: Pick<
  OutboundCallParams,
  "listingDetails" | "leveragePoints" | "userQuestions"
> & {
  strategy: NegotiationStrategy;
}) {
  const formattedQuestions =
    userQuestions.length > 0
      ? userQuestions.map((question) => `- ${question}`).join("\n")
      : "- Confirm the property is still available and clarify next steps.";

  const formattedResearchNotes =
    leveragePoints.length > 0
      ? leveragePoints.map((point) => `- ${point}`).join("\n")
      : "- No additional research notes were provided.";

  const pricingInstructions = strategy.negotiationEnabled
    ? [
        "Pricing strategy for this call:",
        "- Mode: {{strategy_mode}}.",
        "- Pricing posture: {{pricing_posture}}",
        "- Current asking rent: {{listing_price}}",
        "- Market context: {{comparables_summary}}",
        "- Open the negotiation around {{anchor_price}}.",
        "- Work toward a target of {{target_price}}.",
        "- Your absolute ceiling is {{max_price}}. If the landlord's final offer exceeds this, do NOT accept. Instead say you will check with your client and close the call.",
        "- State your comparable figure ONCE. After that, refer to it only as 'the local market data' or 'what we discussed'. Never repeat the exact number again.",
        "- If the landlord is firm and repeats their price, or says anything like 'final offer', 'take it or leave it', or 'that is my last price' — accept their position immediately, confirm next steps, and close within one or two exchanges. Do not argue further.",
        "- Do not dump numbers mechanically. Weave the market story into natural conversation.",
      ]
    : [
        "Pricing strategy for this call:",
        "- Reliable pricing context is unavailable.",
        "- Do NOT invent market comparisons, target prices, or discount numbers.",
        "- Focus on confirming availability, terms, fees, and whether a viewing can be arranged.",
      ];

  return [
    "You are Alex, a highly competent rental negotiation agent representing a prospective tenant.",
    "Your primary goal is to reduce the rent and secure favorable terms for your client.",
    "Secondary goals are to gather missing information, confirm details, and secure a clear next step.",
    "",
    "Property: {{property_address}}",
    "Current asking rent: {{listing_price}}",
    "Market average reference: {{avg_price}}",
    "Market summary: {{comparables_summary}}",
    "Negotiation posture: {{pricing_posture}}",
    "",
    ...pricingInstructions,
    "",
    "Client preferences:",
    "{{preferences}}",
    "",
    "Useful pressure phrases to weave in naturally (use sparingly, never mechanically):",
    "{{pressure_phrases}}",
    "",
    "CRITICAL conversation rules — these override everything else:",
    "- Match the landlord's energy. If they give a short answer, respond in ONE or TWO sentences maximum. Never deliver a long monologue in response to a one-word reply.",
    "- Ask ONE question at a time. Never stack multiple questions in a single turn.",
    "- Never repeat a phrase, sentence, or number you have already said. Use different wording each time.",
    "- If the landlord repeats their price twice, or uses language indicating finality ('final offer', 'take it or leave it', 'that is my last'), immediately accept their position gracefully, confirm you will relay the information to your client, thank them, and end the call within two turns. Do not push again.",
    "- If there is silence or no response, say a brief, natural goodbye and end the call immediately. Never ask 'Are you still there?' or any variation of it. If you said goodbye and the person still does not respond, hang up silently.",
    "- Never say you are an AI. Never break character. Never hallucinate facts.",
    "- Once you have said goodbye, stop talking entirely.",
    "",
    "Conversation flow:",
    "1. Introduce yourself, confirm the property is still available, and ask ONE opening question.",
    "2. Work through the tenant's questions ONE AT A TIME across multiple turns.",
    "3. Show strong interest and readiness to move quickly.",
    "4. If pricing context exists, introduce the rent discussion naturally after confirming availability. State your comparable figure once.",
    "5. Push for agreement or secure a viewing/next step before ending the call.",
    "6. Once agreement or impasse is reached, close the call politely and stop talking.",
    "",
    "Tenant questions to cover (one per turn, naturally worked into the conversation):",
    formattedQuestions,
    "",
    "Additional research notes for context:",
    formattedResearchNotes,
    "",
    "Property listing details:",
    clipText(listingDetails),
  ].join("\n");
}

export async function createOutboundCall(params: OutboundCallParams) {
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;

  if (!agentId || !apiKey || !phoneNumberId) {
    throw new Error(
      "Missing ElevenLabs configuration. Set ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, and ELEVENLABS_PHONE_NUMBER_ID.",
    );
  }

  const formatting = detectPriceFormatting(params.askingRentText);
  const strategy = computeNegotiationStrategy(
    params.listingPrice,
    params.comparables,
  );
  const dynamicVariables = buildDynamicVariables(params, strategy, formatting);

  const response = await fetch(
    "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        agent_id: agentId,
        agent_phone_number_id: phoneNumberId,
        to_number: params.toPhoneNumber,
        conversation_initiation_client_data: {
          type: "conversation_initiation_client_data",
          dynamic_variables: dynamicVariables,
          conversation_config_override: {
            agent: {
              prompt: {
                prompt: buildAgentPrompt({
                  listingDetails: params.listingDetails,
                  leveragePoints: params.leveragePoints,
                  userQuestions: params.userQuestions,
                  strategy,
                }),
              },
              first_message: buildFirstMessage(dynamicVariables, strategy),
            },
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    const overrideHint =
      response.status === 422
        ? " Make sure prompt and first-message overrides are enabled for the agent in ElevenLabs."
        : "";
    throw new Error(
      `Failed to create outbound call: ${response.status} ${errorText}${overrideHint}`,
    );
  }

  return response.json() as Promise<{
    success?: boolean;
    message?: string;
    conversation_id?: string | null;
    callSid?: string | null;
  }>;
}

export async function getConversationStatus(conversationId: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
    {
      method: "GET",
      headers: { "xi-api-key": apiKey },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch conversation status: ${response.status}`);
  }

  return response.json() as Promise<ElevenLabsConversation>;
}
