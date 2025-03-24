import { useState, useEffect } from "react";
import { ActionPanel, Action, List, showToast, Toast, Icon } from "@raycast/api";
import { getSavedProducts, removeSavedProduct, searchSavedProducts } from "./api/savedProducts";
import { SavedProduct } from "./types";

export default function SavedProducts() {
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<SavedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    fetchSavedProducts();
  }, []);

  const fetchSavedProducts = async () => {
    setIsLoading(true);
    
    try {
      const savedProducts = await getSavedProducts();
      setProducts(savedProducts);
      setFilteredProducts(savedProducts);
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to fetch saved products",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!searchText) {
      setFilteredProducts(products);
      return;
    }
    
    const search = async () => {
      const results = await searchSavedProducts(searchText);
      setFilteredProducts(results);
    };
    
    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [searchText, products]);

  const handleRemoveProduct = async (productId: string) => {
    try {
      await removeSavedProduct(productId);
      setProducts(products.filter(p => p.productId !== productId));
      setFilteredProducts(filteredProducts.filter(p => p.productId !== productId));
      
      showToast({
        style: Toast.Style.Success,
        title: "Product removed from saved list",
      });
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to remove product",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search saved products..."
      throttle
    >
      <List.Section
        title="Saved Products"
        subtitle={filteredProducts.length > 0 ? `${filteredProducts.length} products` : undefined}
      >
        {filteredProducts.length === 0 ? (
          <List.EmptyView
            title={searchText ? "No Matching Products" : "No Saved Products"}
            description={
              searchText
                ? "Try a different search term"
                : "Save products from other commands to see them here"
            }
            icon={Icon.Star}
          />
        ) : (
          filteredProducts.map((product, index) => (
            <List.Item
              key={product.id}
              title={product.name}
              subtitle={product.tagline}
              icon={{ source: product.thumbnail || Icon.Document }}
              accessories={[
                { 
                  text: `Saved on ${new Date(product.savedAt).toLocaleDateString()}`,
                  tooltip: new Date(product.savedAt).toLocaleString()
                }
              ]}
              actions={
                <ActionPanel>
                  <Action.OpenInBrowser url={product.url} title="Open in Browser" />
                  <Action
                    title="Remove from Saved"
                    icon={Icon.Trash}
                    onAction={() => handleRemoveProduct(product.productId)}
                    shortcut={{ modifiers: ["cmd"], key: "delete" }}
                  />
                  <Action.CopyToClipboard
                    title="Copy URL"
                    content={product.url}
                    shortcut={{ modifiers: ["cmd"], key: "." }}
                  />
                </ActionPanel>
              }
            />
          ))
        )}
      </List.Section>
    </List>
  );
}
