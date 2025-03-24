import { useState, useEffect } from "react";
import { ActionPanel, Action, List, showToast, Toast, Icon, openExtensionPreferences } from "@raycast/api";
import { searchUsers, getUserByUsername } from "./api/client";
import { User } from "./types";
import { getDeveloperToken } from "./api/config";

export default function UserProfile() {
  const [searchText, setSearchText] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const checkToken = async () => {
      const token = await getDeveloperToken();
      setHasToken(!!token);
      setIsLoading(false);
    };
    
    checkToken();
  }, []);

  useEffect(() => {
    if (!hasToken) return;
    
    const fetchUsers = async () => {
      if (!searchText) {
        setUsers([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      
      try {
        const result = await searchUsers(searchText);
        
        if (result.error) {
          showToast({
            style: Toast.Style.Failure,
            title: "Failed to search users",
            message: result.error,
          });
          setUsers([]);
        } else {
          setUsers(result.users);
        }
      } catch (error) {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to search users",
          message: error instanceof Error ? error.message : String(error),
        });
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchText, hasToken]);

  if (!hasToken) {
    return (
      <List isLoading={isLoading}>
        <List.EmptyView
          title="Developer Token Required"
          description="Please set your Product Hunt developer token in preferences"
          actions={
            <ActionPanel>
              <Action title="Open Extension Preferences" onAction={openExtensionPreferences} />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search users by name or username..."
      throttle
    >
      <List.Section title="Results" subtitle={users.length > 0 ? `${users.length} users` : undefined}>
        {users.map((user) => (
          <List.Item
            key={user.id}
            title={user.name}
            subtitle={`@${user.username}`}
            icon={{ source: user.avatarUrl || Icon.Person }}
            accessories={[
              ...(user.headline ? [{ text: user.headline }] : []),
              ...(user.productsCount ? [{ text: `${user.productsCount} products` }] : []),
              ...(user.followersCount ? [{ text: `${user.followersCount} followers` }] : []),
            ]}
            actions={
              <ActionPanel>
                <Action.Push
                  title="View User Profile"
                  target={<UserDetailView username={user.username} />}
                />
                {user.twitterUsername && (
                  <Action.OpenInBrowser
                    title="Open Twitter Profile"
                    url={`https://twitter.com/${user.twitterUsername}`}
                  />
                )}
                {user.websiteUrl && (
                  <Action.OpenInBrowser
                    title="Open Website"
                    url={user.websiteUrl}
                  />
                )}
                <Action.OpenInBrowser
                  title="Open Product Hunt Profile"
                  url={`https://www.producthunt.com/@${user.username}`}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

function UserDetailView({ username }: { username: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserDetails = async () => {
      setIsLoading(true);
      
      try {
        const result = await getUserByUsername(username);
        
        if (result.error) {
          showToast({
            style: Toast.Style.Failure,
            title: "Failed to fetch user details",
            message: result.error,
          });
          setUser(null);
        } else if (result.user) {
          setUser(result.user);
        }
      } catch (error) {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to fetch user details",
          message: error instanceof Error ? error.message : String(error),
        });
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserDetails();
  }, [username]);

  if (!user && !isLoading) {
    return (
      <List>
        <List.EmptyView
          title="User Not Found"
          description={`Could not find user with username: ${username}`}
        />
      </List>
    );
  }

  return (
    <List isLoading={isLoading}>
      {user && (
        <>
          <List.Item
            title={user.name}
            subtitle={`@${user.username}`}
            icon={{ source: user.avatarUrl || Icon.Person }}
            accessories={[
              ...(user.headline ? [{ text: user.headline }] : []),
            ]}
            actions={
              <ActionPanel>
                <Action.OpenInBrowser
                  title="Open Product Hunt Profile"
                  url={`https://www.producthunt.com/@${user.username}`}
                />
                {user.twitterUsername && (
                  <Action.OpenInBrowser
                    title="Open Twitter Profile"
                    url={`https://twitter.com/${user.twitterUsername}`}
                  />
                )}
                {user.websiteUrl && (
                  <Action.OpenInBrowser
                    title="Open Website"
                    url={user.websiteUrl}
                  />
                )}
              </ActionPanel>
            }
          />
          <List.Item
            title="Products"
            subtitle={user.productsCount ? `${user.productsCount} products` : "No products"}
            icon={Icon.Box}
            actions={
              <ActionPanel>
                <Action.OpenInBrowser
                  title="View Products on Product Hunt"
                  url={`https://www.producthunt.com/@${user.username}/made`}
                />
              </ActionPanel>
            }
          />
          <List.Item
            title="Followers"
            subtitle={user.followersCount ? `${user.followersCount} followers` : "No followers"}
            icon={Icon.Person}
            actions={
              <ActionPanel>
                <Action.OpenInBrowser
                  title="View Followers on Product Hunt"
                  url={`https://www.producthunt.com/@${user.username}/followers`}
                />
              </ActionPanel>
            }
          />
        </>
      )}
    </List>
  );
}
