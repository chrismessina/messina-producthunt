// GraphQL queries for Product Hunt API

export const SEARCH_PRODUCTS_QUERY = `
  query SearchProducts($query: String!, $first: Int!, $after: String) {
    search(query: $query, types: [POST], first: $first, after: $after) {
      edges {
        node {
          ... on Post {
            id
            name
            tagline
            description
            url
            thumbnail {
              url
            }
            votesCount
            commentsCount
            createdAt
            topics {
              edges {
                node {
                  id
                  name
                  slug
                }
              }
            }
            user {
              id
              name
              username
              headline
              profileImage
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_TRENDING_PRODUCTS_QUERY = `
  query GetTrendingProducts($first: Int!, $after: String) {
    posts(first: $first, after: $after) {
      edges {
        node {
          id
          name
          tagline
          description
          url
          thumbnail {
            url
          }
          votesCount
          commentsCount
          createdAt
          topics {
            edges {
              node {
                id
                name
                slug
              }
            }
          }
          user {
            id
            name
            username
            headline
            profileImage
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_TOPICS_QUERY = `
  query GetTopics {
    topics {
      edges {
        node {
          id
          name
          slug
          description
        }
      }
    }
  }
`;

export const SEARCH_USERS_QUERY = `
  query SearchUsers($query: String!, $first: Int!) {
    search(first: $first, query: $query, types: [USER]) {
      edges {
        node {
          ... on User {
            id
            name
            username
            headline
            profileImage
            websiteUrl
            twitterUsername
            productsCount
            followersCount
          }
        }
      }
    }
  }
`;

export const GET_USER_BY_USERNAME_QUERY = `
  query GetUserByUsername($username: String!) {
    user(username: $username) {
      id
      name
      username
      headline
      profileImage
      websiteUrl
      twitterUsername
      productsCount
      followersCount
    }
  }
`;

export const GET_UPCOMING_PRODUCTS_QUERY = `
  query GetUpcomingProducts($first: Int!, $after: String) {
    upcoming(first: $first, after: $after) {
      edges {
        node {
          id
          name
          tagline
          description
          url
          thumbnail {
            url
          }
          votesCount
          commentsCount
          createdAt
          topics {
            edges {
              node {
                id
                name
                slug
              }
            }
          }
          user {
            id
            name
            username
            headline
            profileImage
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_LAUNCH_ARCHIVE_QUERY = `
  query GetLaunchArchive($first: Int!, $after: String, $postedAfter: DateTime, $postedBefore: DateTime) {
    posts(first: $first, after: $after, postedAfter: $postedAfter, postedBefore: $postedBefore) {
      edges {
        node {
          id
          name
          tagline
          description
          url
          thumbnail {
            url
          }
          votesCount
          commentsCount
          createdAt
          topics {
            edges {
              node {
                id
                name
                slug
              }
            }
          }
          user {
            id
            name
            username
            headline
            profileImage
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_PRODUCTS_BY_TOPIC_QUERY = `
  query GetProductsByTopic($topicSlug: String!, $first: Int!, $after: String) {
    topic(slug: $topicSlug) {
      id
      name
      description
      products: postsCollection(first: $first, after: $after) {
        edges {
          node {
            id
            name
            tagline
            description
            url
            thumbnail {
              url
            }
            votesCount
            commentsCount
            createdAt
            topics {
              edges {
                node {
                  id
                  name
                  slug
                }
              }
            }
            user {
              id
              name
              username
              headline
              profileImage
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;
