import { useState, useEffect } from "react";
import { ActionPanel, Action, List, showToast, Toast, openExtensionPreferences } from "@raycast/api";
import { getUpcomingProducts } from "./api/client";
import { ProductListItem } from "./components/ProductListItem";
import { Product } from "./types";
import { getDeveloperToken } from "./api/config";

export default function UpcomingProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [endCursor, setEndCursor] = useState("");
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const checkToken = async () => {
      const token = await getDeveloperToken();
      setHasToken(!!token);
      
      if (token) {
        fetchProducts();
      } else {
        setIsLoading(false);
      }
    };
    
    checkToken();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    
    try {
      const result = await getUpcomingProducts();
      
      if (result.error) {
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to fetch upcoming products",
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
        title: "Failed to fetch upcoming products",
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
      const result = await getUpcomingProducts(20, endCursor);
      
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
    <List isLoading={isLoading}>
      <List.Section title="Upcoming Products" subtitle={products.length > 0 ? `${products.length} products` : undefined}>
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
