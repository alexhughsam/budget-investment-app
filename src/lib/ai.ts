import Anthropic from "@anthropic-ai/sdk";

// Every AI feature degrades visibly when no key is configured (house rule 1:
// never fabricate). Callers must branch on aiAvailable() and show a real
// "not configured" state instead of a guessed value.
export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const MODEL = process.env.HEARTH_AI_MODEL ?? "claude-opus-4-8";

function client() {
  return new Anthropic();
}

export type CategorySuggestion = { transactionId: string; category: string; merchant: string | null };

const CATEGORIZE_SCHEMA = {
  type: "object" as const,
  properties: {
    suggestions: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          transactionId: { type: "string" as const },
          category: { type: "string" as const, description: "Exactly one of the provided category names" },
          merchant: {
            anyOf: [{ type: "string" as const }, { type: "null" as const }],
            description: "Cleaned-up human merchant name, or null if unclear",
          },
        },
        required: ["transactionId", "category", "merchant"],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
};

// Categorization is an LLM problem, not a regex pile (house rule 3): we describe
// the behavior and let the model reason over the raw descriptions.
export async function categorizeTransactions(
  txns: Array<{ id: string; description: string; amountCents: number; date: string }>,
  categoryNames: string[],
): Promise<CategorySuggestion[]> {
  if (!aiAvailable() || txns.length === 0) return [];
  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 16000,
    system:
      "You categorize personal bank/card transactions for a US+Canada household. " +
      "For each transaction pick the single best category from the provided list — never invent a new one. " +
      "Use 'Transfers' for movements between the household's own accounts (payments to credit cards, brokerage funding, e-transfers between spouses). " +
      "Use your knowledge of merchant names (e.g. 'TIM HORTONS #4021' is Restaurants; 'PC - PREAUTH TELUS' is Utilities & Phone). " +
      "Also return a cleaned human-readable merchant name when you can infer one, else null. " +
      "If a transaction is genuinely ambiguous, choose 'Uncategorized' rather than guessing.",
    output_config: {
      format: { type: "json_schema", schema: CATEGORIZE_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content:
          `Categories: ${categoryNames.join(", ")}\n\nTransactions (JSON):\n` +
          JSON.stringify(
            txns.map((t) => ({ transactionId: t.id, date: t.date, description: t.description, amountCents: t.amountCents })),
          ),
      },
    ],
  });
  if (response.stop_reason === "refusal") return [];
  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  try {
    const parsed = JSON.parse(text) as { suggestions: CategorySuggestion[] };
    return parsed.suggestions.filter((s) => categoryNames.includes(s.category));
  } catch {
    return [];
  }
}

// Advisor memo. The model researches with web search when available and must cite
// data with dates. It advises only — no trading (house rule 4).
export async function writeAdvisorMemo(input: {
  kind: "allocation" | "pick";
  contextMarkdown: string;
  pickBudgetCents: number;
  currency: string;
  pastMemosSummary: string;
}): Promise<{ title: string; body: string } | null> {
  if (!aiAvailable()) return null;
  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
    system:
      "You are the investment research assistant inside Hearth, a private budgeting app used by one couple (Alex and Nancy). " +
      "You are a sharp analyst friend, not a guru: state uncertainty plainly, never promise returns, and when data is thin your default advice is 'leave it in the ETF bucket'. " +
      "Their strategy is fixed: ~90% of investable money goes to broad low-cost index ETFs on a schedule; at most 10% (funded by Robinhood Gold Card cashback) may go to individual stock picks. " +
      "You NEVER place trades and never ask for credentials — you write short research memos a human acts on. " +
      "Hard rule: never recommend deploying more than the stated pick budget; refuse politely if asked to exceed it, and say why. " +
      "Every factual number you cite must carry its as-of date and source. If you could not verify a number, say so instead of citing it. " +
      "You also learn from your own track record: the memo should briefly note what your past recommendations got right or wrong when relevant. " +
      "End every pick memo with one line reminding them the pick sleeve is capped entertainment money and that ~90% of active managers lag the index over long periods. " +
      "Format: markdown, <= 600 words. Start with a single-line title prefixed 'TITLE: '.",
    messages: [
      {
        role: "user",
        content:
          `Memo type: ${input.kind}\n` +
          `Pick budget available: ${input.pickBudgetCents} cents ${input.currency} (hard ceiling)\n\n` +
          `Household context:\n${input.contextMarkdown}\n\n` +
          `Your past recommendations and outcomes:\n${input.pastMemosSummary || "(none yet)"}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") return null;
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!text) return null;
  const match = text.match(/^TITLE:\s*(.+)$/m);
  const title = match?.[1]?.trim() ?? (input.kind === "pick" ? "Stock pick memo" : "Allocation memo");
  const body = text.replace(/^TITLE:\s*.+$/m, "").trim();
  return { title, body };
}
