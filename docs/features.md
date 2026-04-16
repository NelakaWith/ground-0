# Ground-0: Platform Features & Implementation

This document outlines the core features of the Ground-0 platform, leveraging information delta analysis and multi-phase LLM processing to provide unparalleled media transparency.

---

## 1. The "Coverage Ratio" Meter
*Visualizing Phase 1 & 3*

Ground News uses a horizontal bar to show the distribution of Left/Center/Right sources. 

> [!TIP]
> **Implementation for Ground-0:** Since you have Entity Detection, your meter shouldn't just be "General Bias." It should be **"Entity-Specific Sentiment Distribution."**

- **The Feature:** For a specific event (e.g., "VAT Increase"), show a bar representing the ratio of Positive vs. Negative framing detected in your Pass 2 analysis across all sources.
- **Why it works:** It validates your "Information Delta" visually. If 80% of the bar is "Critical," and one source is "Supportive," the outlier is immediately obvious.

---

## 2. The "Blindspot" Feed
*Leveraging Phase 1 & 5*

Ground News’ most famous feature is highlighting stories that one side of the spectrum is completely ignoring.

- **Implementation:** Use Near-Duplicate Detection and Event Clustering to identify **"Asymmetric Coverage."**
- **The Feature:** A "Media Silence" dashboard. If the scraper identifies an event covered by 5 Private outlets but 0 State-owned outlets, it flags it as a **"State Media Blindspot."**
- **YC Angle:** This turns your scraping "Hustle" into a proprietary metric: **The Omission Index.**

---

## 3. "Charged Word" Highlighting
*Enhancing Phase 2*

Ground News shows a "Bias Comparison" summary. Ground-0 takes this further with **Double-Pass Analysis.**

- **The Feature:** An interactive "Heatmap" of the article text where extracted "Charged Adjectives" are highlighted.
- **Interaction:** Clicking a highlighted word (e.g., *"Crippling"*) shows a tooltip: *"Used 14x more frequently in Private media than State media."*
- **Why it works:** It provides **"Proof of Work"** for LLM analysis. It shows the user exactly why a story was flagged as biased.

---

## 4. Ownership Transparency Tags
*Data Moat for Phase 4*

Ground News tags sources by ownership (e.g., "Billionaire Owned").

- **Implementation:** In the Sri Lankan context, this is a **Knowledge Moat.**
- **The Feature:** Add metadata tags to every article like:
  - `[STATE-CONTROLLED]`
  - `[RELIANCE ON AD REVENUE]`
  - `[LINKED TO PARTY X]`
- **Technical Twist:** Use Phase 5 Agents to fetch the latest board of directors or public funding records to keep these tags automated and "live."

---

## 5. Side-by-Side Headline Comparison
*The "Delta" UI*

- **The Feature:** A **"Battle of the Headlines"** UI.
- **Implementation:** Group event clusters and display the headline from the most "Positive" outlet and the most "Negative" outlet side-by-side.
- **Technical Value:** This is the easiest way to demonstrate **"Target-Dependent Bias"** logic to a judge or investor.
