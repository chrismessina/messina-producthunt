import fetch from "node-fetch";
import { API_URL, getHeaders } from "./config";
import {
  SEARCH_PRODUCTS_QUERY,
  GET_TRENDING_PRODUCTS_QUERY,
  GET_TOPICS_QUERY,
  SEARCH_USERS_QUERY,
  GET_USER_BY_USERNAME_QUERY,
  GET_UPCOMING_PRODUCTS_QUERY,
  GET_LAUNCH_ARCHIVE_QUERY,
  GET_PRODUCTS_BY_TOPIC_QUERY,
} from "./queries";
import {
  ApiResponse,
  Product,
  ProductsResponse,
  Topic,
  TopicsResponse,
  User,
  UserResponse,
  UpcomingProductsResponse,
  LaunchArchiveResponse,
  TimeRange,
} from "../types";

async function executeQuery<T>(query: string, variables: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
  try {
    const headers = await getHeaders();
    
    const response = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json() as { data: T, errors?: Array<{ message: string }> };
    
    if (result.errors && result.errors.length > 0) {
      throw new Error(result.errors[0].message);
    }
    
    return { data: result.data };
  } catch (error) {
    console.error("API Error:", error);
    return { data: {} as T, error: error instanceof Error ? error.message : String(error) };
  }
}

// Transform API response to our Product type
function transformProduct(node: Record<string, unknown>): Product {
  return {
    id: node.id as string,
    name: node.name as string,
    tagline: node.tagline as string,
    description: (node.description as string) || "",
    url: node.url as string,
    thumbnail: (node.thumbnail as { url: string })?.url || "",
    votesCount: node.votesCount as number,
    commentsCount: node.commentsCount as number,
    createdAt: node.createdAt as string,
    topics: ((node.topics as { edges: Array<{ node: Record<string, unknown> }> })?.edges || []).map((edge) => ({
      id: edge.node.id as string,
      name: edge.node.name as string,
      slug: edge.node.slug as string,
    })),
    maker: node.user ? {
      id: (node.user as Record<string, unknown>).id as string,
      name: (node.user as Record<string, unknown>).name as string,
      username: (node.user as Record<string, unknown>).username as string,
      headline: (node.user as Record<string, unknown>).headline as string | undefined,
      avatarUrl: (node.user as Record<string, unknown>).profileImage as string || "",
    } : undefined,
  };
}

interface SearchProductsResponse {
  search: {
    edges: Array<{
      node: Record<string, unknown>;
    }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
  };
}

export async function searchProducts(query: string, first: number = 20, after?: string): Promise<{
  products: Product[];
  hasNextPage: boolean;
  endCursor: string;
  error?: string;
}> {
  const response = await executeQuery<SearchProductsResponse>(SEARCH_PRODUCTS_QUERY, { query, first, after });
  
  if (response.error) {
    return { products: [], hasNextPage: false, endCursor: "", error: response.error };
  }
  
  if (!response.data.search || !response.data.search.edges) {
    return { products: [], hasNextPage: false, endCursor: "", error: "Invalid search response" };
  }
  
  const products = response.data.search.edges
    .filter(edge => edge.node && typeof edge.node === 'object')
    .map(edge => transformProduct(edge.node as unknown as Record<string, unknown>));
  
  return {
    products,
    hasNextPage: response.data.search.pageInfo.hasNextPage,
    endCursor: response.data.search.pageInfo.endCursor,
  };
}

export async function getTrendingProducts(first: number = 20, after?: string): Promise<{
  products: Product[];
  hasNextPage: boolean;
  endCursor: string;
  error?: string;
}> {
  const response = await executeQuery<ProductsResponse>(GET_TRENDING_PRODUCTS_QUERY, { first, after });
  
  if (response.error) {
    return { products: [], hasNextPage: false, endCursor: "", error: response.error };
  }
  
  const products = response.data.posts.edges.map(edge => transformProduct(edge.node as unknown as Record<string, unknown>));
  
  return {
    products,
    hasNextPage: response.data.posts.pageInfo.hasNextPage,
    endCursor: response.data.posts.pageInfo.endCursor,
  };
}

export async function getTopics(): Promise<{
  topics: Topic[];
  error?: string;
}> {
  const response = await executeQuery<TopicsResponse>(GET_TOPICS_QUERY);
  
  if (response.error) {
    return { topics: [], error: response.error };
  }
  
  const topics = response.data.topics.edges.map(edge => ({
    id: edge.node.id,
    name: edge.node.name,
    slug: edge.node.slug,
    description: edge.node.description,
  }));
  
  return { topics };
}

interface SearchResponse {
  search: {
    edges: Array<{
      node: Record<string, unknown>;
    }>;
  };
}

export async function searchUsers(query: string, first: number = 20): Promise<{
  users: User[];
  error?: string;
}> {
  const response = await executeQuery<SearchResponse>(SEARCH_USERS_QUERY, { query, first });
  
  if (response.error) {
    return { users: [], error: response.error };
  }
  
  const users = response.data.search.edges.map((edge) => ({
    id: edge.node.id as string,
    name: edge.node.name as string,
    username: edge.node.username as string,
    headline: edge.node.headline as string | undefined,
    avatarUrl: edge.node.profileImage as string,
    profileImage: edge.node.profileImage as string,
    websiteUrl: edge.node.websiteUrl as string | undefined,
    twitterUsername: edge.node.twitterUsername as string | undefined,
    productsCount: edge.node.productsCount as number | undefined,
    followersCount: edge.node.followersCount as number | undefined,
  }));
  
  return { users };
}

export async function getUserByUsername(username: string): Promise<{
  user?: User;
  error?: string;
}> {
  const response = await executeQuery<UserResponse>(GET_USER_BY_USERNAME_QUERY, { username });
  
  if (response.error) {
    return { error: response.error };
  }
  
  if (!response.data.user) {
    return { error: "User not found" };
  }
  
  const user: User = {
    id: response.data.user.id,
    name: response.data.user.name,
    username: response.data.user.username,
    headline: response.data.user.headline,
    avatarUrl: response.data.user.profileImage || "",
    profileImage: response.data.user.profileImage,
    websiteUrl: response.data.user.websiteUrl,
    twitterUsername: response.data.user.twitterUsername,
    productsCount: response.data.user.productsCount,
    followersCount: response.data.user.followersCount,
  };
  
  return { user };
}

export async function getUpcomingProducts(first: number = 20, after?: string): Promise<{
  products: Product[];
  hasNextPage: boolean;
  endCursor: string;
  error?: string;
}> {
  const response = await executeQuery<UpcomingProductsResponse>(GET_UPCOMING_PRODUCTS_QUERY, { first, after });
  
  if (response.error) {
    return { products: [], hasNextPage: false, endCursor: "", error: response.error };
  }
  
  const products = response.data.upcoming.edges.map(edge => transformProduct(edge.node as unknown as Record<string, unknown>));
  
  return {
    products,
    hasNextPage: response.data.upcoming.pageInfo.hasNextPage,
    endCursor: response.data.upcoming.pageInfo.endCursor,
  };
}

export async function getLaunchArchive(
  timeRange: TimeRange,
  first: number = 20,
  after?: string
): Promise<{
  products: Product[];
  hasNextPage: boolean;
  endCursor: string;
  error?: string;
}> {
  // Calculate date range based on timeRange
  const now = new Date();
  let postedAfter: Date;
  
  switch (timeRange) {
    case "daily":
      postedAfter = new Date(now.setDate(now.getDate() - 1));
      break;
    case "weekly":
      postedAfter = new Date(now.setDate(now.getDate() - 7));
      break;
    case "monthly":
      postedAfter = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case "yearly":
      postedAfter = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
  }
  
  const response = await executeQuery<LaunchArchiveResponse>(GET_LAUNCH_ARCHIVE_QUERY, {
    first,
    after,
    postedAfter: postedAfter.toISOString(),
    postedBefore: new Date().toISOString(),
  });
  
  if (response.error) {
    return { products: [], hasNextPage: false, endCursor: "", error: response.error };
  }
  
  const products = response.data.posts.edges.map(edge => transformProduct(edge.node as unknown as Record<string, unknown>));
  
  return {
    products,
    hasNextPage: response.data.posts.pageInfo.hasNextPage,
    endCursor: response.data.posts.pageInfo.endCursor,
  };
}

interface TopicResponse {
  topic?: {
    products: {
      edges: Array<{ node: Record<string, unknown> }>;
      pageInfo: { hasNextPage: boolean; endCursor: string };
    };
  };
}

export async function getProductsByTopic(
  topicSlug: string,
  first: number = 20,
  after?: string
): Promise<{
  products: Product[];
  hasNextPage: boolean;
  endCursor: string;
  error?: string;
}> {
  const response = await executeQuery<TopicResponse>(GET_PRODUCTS_BY_TOPIC_QUERY, { topicSlug, first, after });
  
  if (response.error) {
    return { products: [], hasNextPage: false, endCursor: "", error: response.error };
  }
  
  if (!response.data.topic) {
    return { products: [], hasNextPage: false, endCursor: "", error: "Topic not found" };
  }
  
  const products = response.data.topic.products.edges.map(edge => transformProduct(edge.node as unknown as Record<string, unknown>));
  
  return {
    products,
    hasNextPage: response.data.topic.products.pageInfo.hasNextPage,
    endCursor: response.data.topic.products.pageInfo.endCursor,
  };
}
