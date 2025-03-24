import { getPreferenceValues } from "@raycast/api";

export const API_URL = "https://api.producthunt.com/v2/api/graphql";

interface Preferences {
  developerToken?: string;
}

// Get the developer token from preferences
export async function getDeveloperToken(): Promise<string | undefined> {
  const preferences = getPreferenceValues<Preferences>();
  return preferences.developerToken;
}

// Get headers for API requests
export async function getHeaders(): Promise<Record<string, string>> {
  const token = await getDeveloperToken();
  
  if (!token) {
    throw new Error("Developer token not found. Please set it in preferences.");
  }
  
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
}
