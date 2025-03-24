import { ActionPanel, Action, Detail, Icon, Color } from "@raycast/api";
import { Product } from "../types";
import { saveProduct, removeSavedProduct, isProductSaved } from "../api/savedProducts";
import { useState, useEffect } from "react";

interface ProductDetailViewProps {
  product: Product;
}

export function ProductDetailView({ product }: ProductDetailViewProps) {
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
  
  // Create markdown content for the product details
  const markdown = `
  # ${product.name}
  
  ${product.tagline}
  
  ${product.description || "No description available."}
  
  ## Details
  
  - **Votes:** ${product.votesCount}
  - **Comments:** ${product.commentsCount}
  - **Launch Date:** ${formattedDate}
  ${product.maker ? `- **Maker:** ${product.maker.name}` : ""}
  
  ${product.topics && product.topics.length > 0 ? `
  ## Topics
  
  ${product.topics.map(topic => `- ${topic.name}`).join("\n")}
  ` : ""}
  `;
  
  return (
    <Detail
      markdown={markdown}
      navigationTitle={product.name}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Name" text={product.name} />
          <Detail.Metadata.Label title="Tagline" text={product.tagline} />
          <Detail.Metadata.Label title="Votes" text={product.votesCount.toString()} />
          <Detail.Metadata.Label title="Comments" text={product.commentsCount.toString()} />
          <Detail.Metadata.Label title="Launch Date" text={formattedDate} />
          {product.maker && (
            <Detail.Metadata.Label title="Maker" text={product.maker.name} />
          )}
          {product.topics && product.topics.length > 0 && (
            <Detail.Metadata.TagList title="Topics">
              {product.topics.map(topic => (
                <Detail.Metadata.TagList.Item key={topic.id} text={topic.name} color={Color.Blue} />
              ))}
            </Detail.Metadata.TagList>
          )}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
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
        </ActionPanel>
      }
    />
  );
}
