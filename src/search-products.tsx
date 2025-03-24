import { useState, useEffect } from "react";
import { ActionPanel, Action, List, showToast, Toast, openExtensionPreferences } from "@raycast/api";
import { searchProducts } from "./api/client";
import { ProductListItem } from "./components/ProductListItem";
import { Product } from "./types";
import { getDeveloperToken } from "./api/config";

export default function SearchProducts() {
  const [searchText, setSearchText] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [endCursor, setEndCursor] = useState("");
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
    
    const fetchProducts = async () => {
      if (!searchText) {
        setProducts([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      
      try {
        const result = await searchProducts(searchText);
        
        if (result.error) {
          showToast({
            style: Toast.Style.Failure,
            title: "Failed to search products",
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
          title: "Failed to search products",
          message: error instanceof Error ? error.message : String(error),
        });
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchProducts, 300);
    return () => clearTimeout(debounce);
  }, [searchText, hasToken]);

  const loadMore = async () => {
    if (!hasNextPage || !endCursor) return;
    
    try {
      const result = await searchProducts(searchText, 20, endCursor);
      
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
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search for products..."
      throttle
    >
      <List.Section title="Results" subtitle={products.length > 0 ? `${products.length} products` : undefined}>
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
