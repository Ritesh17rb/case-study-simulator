// LLM service configured for OpenAI-compatible streaming; defaults to LLM Foundry
import { asyncLLM } from "asyncllm";
import { openaiConfig } from "bootstrap-llm-provider";

const STORAGE_KEY = "bootstrapLLMProvider_openaiConfig";
const DEFAULT_BASE_URL = "https://llmfoundry.straive.com/openai/v1"; // OpenAI-compatible

export async function fetchAIResponse(history) {
  const systemPrompt = [
    "You are a strategy simulation engine.",
    "1. Present a business case study problem to the user.",
    "2. The user is the CEO/Manager.",
    "3. Wait for their decision.",
    "4. Evaluate their decision and move the simulation forward (time passes, consequences happen).",
    "5. Keep it concise.",
  ].join("\n");

  try {
    const cfg = await loadOrInitOpenAIConfig();
    const baseUrl = cfg?.baseUrl || DEFAULT_BASE_URL;
    const apiKey = cfg?.apiKey || "";
    const model = (cfg?.models?.[0]) || "gpt-4o-mini"; // pick a small default; provider may alias

    let full = "";
    const body = { model, stream: true, messages: [{ role: "system", content: systemPrompt }, ...history] };
    for await (const { content, error } of asyncLLM(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    })) {
      if (error) throw new Error(error);
      if (content) full = content;
    }
    if (full) return full;
  } catch (e) {
    console.warn("LLM stream failed; falling back to simulator:", e?.message || e);
  }

  // Fallback simulator
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!history || history.length === 0) {
        resolve(
          "Welcome, CEO. Your company 'TechFlow' is losing 10% revenue month-over-month due to a new competitor. You have $1M in the bank. Do you (A) Launch a marketing campaign or (B) Cut costs to survive?"
        );
        return;
      }
      const last = (history[history.length - 1]?.content || "").toLowerCase();
      if (last.includes("marketing") || last.trim() === "a") {
        resolve(
          "You launched a marketing campaign ($200k). Revenue ticked up by 2%, but burn rate is high. The engineering team is complaining about old servers. Do you (A) Ignore them or (B) Invest in infrastructure?"
        );
      } else {
        resolve(
          "Interesting choice. The board is watching closely. A rival just poached your CTO. What is your immediate response?"
        );
      }
    }, 800);
  });
}

export async function* streamAIResponse(history) {
  try {
    const cfg = await loadOrInitOpenAIConfig();
    const baseUrl = cfg?.baseUrl || DEFAULT_BASE_URL;
    const apiKey = cfg?.apiKey || "";
    const model = (cfg?.models?.[0]) || "gpt-4o-mini";

    const body = { model, stream: true, messages: history };
    for await (const { content, error } of asyncLLM(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    })) {
      if (error) throw new Error(error);
      if (content) yield content;
    }
  } catch (e) {
    console.warn("streamAIResponse failed:", e?.message || e);
  }
}

async function loadOrInitOpenAIConfig() {
  // Prefer existing config
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.baseUrl) return parsed;
    }
  } catch {}

  // Initialize with LLM Foundry default without prompting the user
  const init = { baseUrl: DEFAULT_BASE_URL, apiKey: "" };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(init)); } catch {}

  // Optionally prompt user when they click Configure; here we just return init
  return init;
}
