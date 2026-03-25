# 🏠 FlatZero — AI That Negotiates Your Rent

FlatZero is an AI-powered agent that finds apartments and negotiates rent on your behalf through real phone calls.

It uses **Firecrawl Search** to gather real-time rental listings and market data, and **ElevenLabs voice agents** to call landlords, ask questions, and negotiate better deals—just like a human would.

---

## 🚀 Demo

🎥 Watch the demo: _(add your video link here)_

> “I let an AI negotiate my rent…”

---

## ⚡ Problem

Apartment hunting is broken:

- Listings are fragmented across platforms
- Information is incomplete
- Negotiation is manual, awkward, and time-consuming

Most people **overpay simply because they don’t negotiate**.

---

## 💡 Solution

FlatZero automates the entire process:

1. 🔍 **Searches listings** using Firecrawl
2. 📊 **Analyzes market prices** to find leverage
3. 📞 **Calls landlords** using ElevenLabs voice agents
4. 💬 **Negotiates rent** in natural, human-like conversations

👉 Result: Better deals, zero effort.

---

## 🧠 How It Works

### 1. Data Layer (Firecrawl)

- Fetches rental listings from the web
- Extracts structured data (price, location, amenities)
- Finds comparable properties for pricing insights

### 2. Negotiation Engine

- Computes:
  - Market average
  - Target price
  - Anchor price
- Generates negotiation strategy dynamically

### 3. Voice Agent (ElevenLabs)

- Initiates real phone calls
- Uses natural speech + expressive tone
- Adapts responses during conversation
- Negotiates based on real-time context

---

## 🔥 Key Features

- 🤖 **Autonomous negotiation agent**
- 📞 **Real phone call execution**
- 🧠 **Market-aware pricing strategy**
- 🎙️ **Human-like voice conversations**
- ⚡ **End-to-end automation**

---

## 🧪 Example Outcome

- Original Rent: ₹18,000
- Negotiated Rent: ₹16,500
- Savings: ₹1,500/month

---

## 🛠️ Tech Stack

- **Frontend:** Next.js, Zustand
- **Backend:** Node.js API routes
- **Voice AI:** ElevenLabs (Conversational Agents)
- **Web Data:** Firecrawl Search API

---

## 🧩 API Integration

### ElevenLabs

- Outbound calling
- Dynamic prompt injection
- Expressive voice control

### Firecrawl

- Real-time search
- Structured data extraction
- Market comparison insights

---

## 🎯 What Makes It Unique

Most AI tools:

- help you search ❌
- help you schedule ❌

FlatZero:

> **actually negotiates for you**

This flips the role of AI from assistant → decision-maker.

---

## 🚀 Future Improvements

- Multi-property parallel negotiation
- Personality-based negotiation styles
- Automated booking & scheduling
- Live deal comparison dashboard

---

## 📦 Setup

```bash
git clone https://github.com/your-username/flatzero.git
cd flatzero
npm install

Create .env:

FIRECRAWL_API_KEY=your_key
ELEVENLABS_API_KEY=your_key

Run:

npm run dev
```

🤝 Acknowledgements
Firecrawl
— web data extraction
ElevenLabs
— voice AI agents
🧠 Built For

ElevenLabs Hackathon
