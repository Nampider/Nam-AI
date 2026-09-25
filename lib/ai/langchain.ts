import "server-only";
import { ChatOpenAI } from "@langchain/openai";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";

// Local dev: the API key. Production: leave AZURE_API_KEY empty and this becomes a function that
// fetches a Microsoft Entra ID token for the app's managed identity (no key to leak or rotate).
const credential =
  process.env.AZURE_API_KEY ||
  getBearerTokenProvider(new DefaultAzureCredential(), "https://ai.azure.com/.default");

export const lcChatModel = new ChatOpenAI({
  model: process.env.FOUNDRY_CHAT_DEPLOYMENT!, // your deployment name, e.g. DeepSeek-V4-Pro
  configuration: {
    baseURL: process.env.FOUNDRY_BASE_URL!, // e.g. https://<resource>.services.ai.azure.com/openai/v1
    apiKey: credential,
  },
});
