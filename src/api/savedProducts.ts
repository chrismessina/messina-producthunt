import { LocalStorage } from "@raycast/api";
import { Product, SavedProduct } from "../types";

const SAVED_PRODUCTS_KEY = "producthunt_saved_products";

export async function getSavedProducts(): Promise<SavedProduct[]> {
  const savedProductsJson = await LocalStorage.getItem<string>(SAVED_PRODUCTS_KEY);
  if (!savedProductsJson) {
    return [];
  }
  
  try {
    return JSON.parse(savedProductsJson) as SavedProduct[];
  } catch (error) {
    console.error("Error parsing saved products:", error);
    return [];
  }
}

export async function saveProduct(product: Product): Promise<void> {
  const savedProducts = await getSavedProducts();
  
  // Check if product is already saved
  if (savedProducts.some(p => p.productId === product.id)) {
    return;
  }
  
  const savedProduct: SavedProduct = {
    id: `saved-${product.id}`,
    productId: product.id,
    name: product.name,
    tagline: product.tagline,
    url: product.url,
    thumbnail: product.thumbnail,
    savedAt: new Date().toISOString(),
  };
  
  savedProducts.push(savedProduct);
  await LocalStorage.setItem(SAVED_PRODUCTS_KEY, JSON.stringify(savedProducts));
}

export async function removeSavedProduct(productId: string): Promise<void> {
  const savedProducts = await getSavedProducts();
  const updatedProducts = savedProducts.filter(p => p.productId !== productId);
  await LocalStorage.setItem(SAVED_PRODUCTS_KEY, JSON.stringify(updatedProducts));
}

export async function isProductSaved(productId: string): Promise<boolean> {
  const savedProducts = await getSavedProducts();
  return savedProducts.some(p => p.productId === productId);
}

export async function searchSavedProducts(query: string): Promise<SavedProduct[]> {
  const savedProducts = await getSavedProducts();
  
  if (!query) {
    return savedProducts;
  }
  
  const lowerQuery = query.toLowerCase();
  return savedProducts.filter(
    product => 
      product.name.toLowerCase().includes(lowerQuery) || 
      product.tagline.toLowerCase().includes(lowerQuery)
  );
}
