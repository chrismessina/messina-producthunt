import { ActionPanel, Action, List, Icon } from "@raycast/api";
import { Product } from "../types";
import { saveProduct, removeSavedProduct, isProductSaved } from "../api/savedProducts";
import { useState, useEffect } from "react";
import { ProductDetailView } from "./ProductDetailView";

interface ProductListItemProps {
  product: Product;
  showTopics?: boolean;
}

export function ProductListItem({ product, showTopics = true }: ProductListItemProps) {
  const [isSaved, setIsSaved] = useState<boolean>(false);
  
  useEffect(() => {
    const checkIfSaved = async () => {
      const saved = await isProductSaved(product.id);
      setIsSaved(saved);
    };
    
    checkIfSaved();
  }, [product.id]);
  
  const handleSaveProduct = async () => {
    if (isSaved) {
      await removeSavedProduct(product.id);
      setIsSaved(false);
    } else {
      await saveProduct(product);
      setIsSaved(true);
    }
  };
  
  const formattedDate = new Date(product.createdAt).toLocaleDateString();
  
  return (
    <List.Item
      title={product.name}
      subtitle={product.tagline}
      icon={{ source: product.thumbnail || Icon.Document }}
      accessories={[
        { text: `${product.votesCount} votes` },
        { text: formattedDate },
        ...(product.maker ? [{ text: `by ${product.maker.name}` }] : []),
      ]}
      actions={
        <ActionPanel>
          <Action.Push
            title="View Details"
            icon={Icon.Eye}
            target={<ProductDetailView product={product} />}
          />
          <Action.OpenInBrowser url={product.url} title="Open in Browser" />
          <Action
            title={isSaved ? "Remove from Saved" : "Save Product"}
            icon={isSaved ? Icon.Trash : Icon.Star}
            onAction={handleSaveProduct}
          />
          <Action.CopyToClipboard
            title="Copy URL"
            content={product.url}
            shortcut={{ modifiers: ["cmd"], key: "." }}
          />
          {showTopics && product.topics && product.topics.length > 0 && (
            <ActionPanel.Submenu title="View Topics">
              {product.topics.map((topic) => (
                <Action.Push
                  key={topic.id}
                  title={topic.name}
                  target={<List.Item title={`Products in ${topic.name}`} />}
                  shortcut={{ modifiers: ["cmd"], key: "t" }}
                />
              ))}
            </ActionPanel.Submenu>
          )}
        </ActionPanel>
      }
    />
  );
}
