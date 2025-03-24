import { Action, ActionPanel, Form, useNavigation, getPreferenceValues, openExtensionPreferences } from "@raycast/api";

interface Preferences {
  developerToken?: string;
}

export default function SetDeveloperToken() {
  const { pop } = useNavigation();
  const preferences = getPreferenceValues<Preferences>();
  const hasToken = !!preferences.developerToken;

  return (
    <Form
      actions={
        <ActionPanel>
          <Action title="Open Extension Preferences" onAction={openExtensionPreferences} />
          <Action title="Close" onAction={pop} />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Developer Token Status"
        text={hasToken ? "✅ Developer token is set" : "❌ Developer token is not set"}
      />
      <Form.Description
        title="How to get a token"
        text="1. Go to https://www.producthunt.com/v2/oauth/applications
2. Sign in to your Product Hunt account
3. Copy your developer token from the dashboard"
      />
      <Form.Description
        title="How to set your token"
        text="1. Open Raycast Preferences
2. Go to Extensions
3. Find Product Hunt extension
4. Enter your developer token in the preferences section"
      />
    </Form>
  );
}
