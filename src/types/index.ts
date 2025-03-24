export interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  thumbnail: string;
  votesCount: number;
  commentsCount: number;
  createdAt: string;
  topics: Topic[];
  maker?: User;
}

export interface Topic {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  headline?: string;
  avatarUrl: string;
  profileImage?: string;
  websiteUrl?: string;
  twitterUsername?: string;
  productsCount?: number;
  followersCount?: number;
}

export interface Collection {
  id: string;
  name: string;
  title: string;
  description: string;
  productsCount: number;
  user: User;
}

export interface SavedProduct {
  id: string;
  productId: string;
  name: string;
  tagline: string;
  url: string;
  thumbnail: string;
  savedAt: string;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface ProductsResponse {
  posts: {
    edges: {
      node: Product;
    }[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
  };
}

export interface TopicsResponse {
  topics: {
    edges: {
      node: Topic;
    }[];
  };
}

export interface UserResponse {
  user: User;
}

export interface UpcomingProductsResponse {
  upcoming: {
    edges: {
      node: Product;
    }[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
  };
}

export interface LaunchArchiveResponse {
  posts: {
    edges: {
      node: Product;
    }[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
  };
}

export type TimeRange = "daily" | "weekly" | "monthly" | "yearly";
