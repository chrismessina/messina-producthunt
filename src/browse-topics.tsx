import { useState, useEffect } from "react";
import { ActionPanel, Action, List, showToast, Toast, openExtensionPreferences } from "@raycast/api";
import { getTopics, getProductsByTopic } from "./api/client";
import { ProductListItem } from "./components/ProductListItem";
import { Product, Topic } from "./types";
import { getDeveloperToken } from "./api/config";

export default function BrowseTopics() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [filteredTopics, setFilteredTopics] = useState<Topic[]>([]);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const checkToken = async () => {
      const token = await getDeveloperToken();
      setHasToken(!!token);
      
      if (token) {
        fetchTopics();
      } else {
        setIsLoading(false);
      }
    };
    
    checkToken();
  }, []);

  const fetchTopics = async () => {
    setIsLoading(true);
    
    try {
      const result = await getTopics();
      
      if (result.error) {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to fetch topics",
          message: result.error,
        });
        setTopics([]);
        setFilteredTopics([]);
      } else {
        setTopics(result.topics);
        setFilteredTopics(result.topics);
      }
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to fetch topics",
        message: error instanceof Error ? error.message : String(error),
      });
      setTopics([]);
      setFilteredTopics([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (topics.length === 0) return;
    
    if (!searchText) {
      setFilteredTopics(topics);
      return;
    }
    
    const lowerSearchText = searchText.toLowerCase();
    const filtered = topics.filter(
      topic => topic.name.toLowerCase().includes(lowerSearchText) || 
               (topic.description && topic.description.toLowerCase().includes(lowerSearchText))
    );
    
    setFilteredTopics(filtered);
  }, [searchText, topics]);

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
      searchBarPlaceholder="Search topics..."
      throttle
    >
      <List.Section title="Topics" subtitle={filteredTopics.length > 0 ? `${filteredTopics.length} topics` : undefined}>
        {filteredTopics.map((topic) => (
          <List.Item
            key={topic.id}
            title={topic.name}
            subtitle={topic.description}
            actions={
              <ActionPanel>
                <Action.Push
                  title={`Browse ${topic.name} Products`}
                  target={<TopicProductsView topic={topic} />}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

function TopicProductsView({ topic }: { topic: Topic }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [endCursor, setEndCursor] = useState("");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    
    try {
      const result = await getProductsByTopic(topic.slug);
      
      if (result.error) {
        showToast({
          style: Toast.Style.Failure,
          title: `Failed to fetch ${topic.name} products`,
          message: result.error,
        });
        setProducts([]);
      } else {
        setProducts(result.products);
        setHasNextPage(result.hasNextPage);
        setEndCursor(result.endCursor);
      }
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: `Failed to fetch ${topic.name} products`,
        message: error instanceof Error ? error.message : String(error),
      });
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = async () => {
    if (!hasNextPage || !endCursor) return;
    
    try {
      const result = await getProductsByTopic(topic.slug, 20, endCursor);
      
      if (result.error) {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to load more products",
          message: result.error,
        });
      } else {
        setProducts([...products, ...result.products]);
        setHasNextPage(result.hasNextPage);
        setEndCursor(result.endCursor);
      }
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to load more products",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <List isLoading={isLoading}>
      <List.Section title={`${topic.name} Products`} subtitle={products.length > 0 ? `${products.length} products` : undefined}>
        {products.map((product) => (
          <ProductListItem key={product.id} product={product} />
        ))}
      </List.Section>
      {hasNextPage && (
        <List.Item
          title="Load More"
          actions={
            <ActionPanel>
              <Action title="Load More" onAction={loadMore} />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}
