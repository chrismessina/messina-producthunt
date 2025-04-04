import * as cheerio from "cheerio";
import { cleanText } from "../util/topicUtils";
import { Product, Topic, User, Shoutout } from "../types";
import { processImageUrl, ImgixFit } from "./imgix";
import { fetchSvgAsBase64 } from "../util/imageUtils";

// Interface for Apollo event data
interface ApolloEvent {
  type: string;
  result: {
    data: {
      homefeed?: {
        edges: Array<{
          node: {
            id: string;
            items: Array<ApolloPostItem>;
          };
        }>;
      };
      post?: ApolloPostItem;
      search?: {
        edges: Array<{
          node: ApolloPostItem;
        }>;
      };
      topics?: {
        edges: Array<{
          node: {
            id: string;
            name: string;
            slug: string;
            description?: string;
            followersCount?: number;
            postsCount?: number;
          };
        }>;
      };
    };
  };
}

// Interface for Apollo post item
interface ApolloPostItem {
  __typename: string;
  id: string;
  name: string;
  tagline: string;
  description?: string;
  slug: string;
  thumbnailImageUuid?: string;
  votesCount: number;
  commentsCount: number;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    username: string;
    profileImage: string;
  };
  hunter?: {
    id: string;
    name: string;
    username: string;
    profileImage: string;
  };
  makers?: Array<{
    id: string;
    name: string;
    username: string;
    profileImage: string;
  }>;
  topics?: {
    edges: Array<{
      node: {
        id: string;
        name: string;
        slug: string;
      };
    }>;
  };
  // Gallery and media fields for images
  media?: Array<{
    url?: string;
    imageUuid?: string;
    type?: string;
  }>;
  gallery?: Array<{
    url?: string;
    imageUuid?: string;
    type?: string;
  }>;
}

// Interface for RSS feed items
export interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  author: string;
  content: string;
  contentSnippet: string;
  id: string;
  isoDate: string;
  updated: string;
}

// Open Graph metadata interface
interface OpenGraphMetadata {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  canonicalUrl?: string; // The canonical URL for the page
  siteName?: string;
  type?: string;
}

// Helper function to replace all occurrences of 'undefined' with 'null' in JSON strings
// and handle other potential JSON parsing issues
function sanitizeJsonString(jsonString: string | undefined): string | undefined {
  if (!jsonString) return jsonString;

  // Replace undefined with null
  let sanitized = jsonString.replace(/undefined/g, "null");

  // Replace control characters that might break JSON parsing
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

  // Fix unescaped quotes and backslashes that might break JSON
  sanitized = sanitized.replace(/\\(?!["\\/bfnrt])/g, "\\\\");

  // Handle potential trailing commas in arrays and objects
  sanitized = sanitized.replace(/,\s*([}\]])/g, "$1");

  // Handle unescaped line breaks in strings
  sanitized = sanitized.replace(/([^\\])(["'])\s*[\n\r]+\s*(["'])/g, "$1$2 $3");

  // Handle potential non-whitespace characters after JSON
  try {
    // Try to parse the JSON to find where it ends
    JSON.parse(sanitized);
    return sanitized;
  } catch (error) {
    if (error instanceof SyntaxError && error.message.includes("position")) {
      // Extract position from error message
      const positionMatch = error.message.match(/position (\d+)/);
      if (positionMatch && positionMatch[1]) {
        const position = parseInt(positionMatch[1], 10);

        // Try to find a valid JSON substring
        try {
          // First try: take everything up to the error position
          const truncated = sanitized.substring(0, position);
          // Check if this is valid JSON by itself
          JSON.parse(truncated);
          return truncated;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_e1) {
          // Second try: look for the last valid closing bracket
          const lastValidJson = findLastValidJson(sanitized);
          if (lastValidJson) {
            return lastValidJson;
          }
        }
      }
    }

    // If all else fails, try a more aggressive approach
    return aggressiveSanitization(sanitized);
  }
}

// Helper function to find the last valid JSON in a string
function findLastValidJson(str: string): string | null {
  // Try to find the last valid JSON by looking for balanced brackets
  let bracketCount = 0;
  let lastClosingBracketPos = -1;

  for (let i = 0; i < str.length; i++) {
    if (str[i] === "[") bracketCount++;
    else if (str[i] === "]") {
      bracketCount--;
      if (bracketCount === 0) lastClosingBracketPos = i;
    }
  }

  if (lastClosingBracketPos > 0) {
    try {
      const candidate = str.substring(0, lastClosingBracketPos + 1);
      JSON.parse(candidate);
      return candidate;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_e) {
      // Not valid JSON, continue with other approaches
    }
  }

  return null;
}

// More aggressive sanitization for problematic JSON
function aggressiveSanitization(str: string): string {
  // Replace any potentially problematic sequences
  let result = str;

  // Replace any non-ASCII characters
  // eslint-disable-next-line no-control-regex
  result = result.replace(/[^\x00-\x7F]/g, "");

  // Replace any unescaped control characters
  // eslint-disable-next-line no-control-regex
  result = result.replace(/[\x00-\x1F\x7F-\x9F]/g, "");

  // Fix unbalanced quotes
  const quoteCount = (result.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    // Find the last quote and remove everything after it
    const lastQuotePos = result.lastIndexOf('"');
    if (lastQuotePos > 0) {
      result = result.substring(0, lastQuotePos + 1);
    }
  }

  // Ensure the string ends with proper JSON structure
  if (!result.endsWith("]")) {
    // Find the last closing bracket
    const lastBracketPos = result.lastIndexOf("]");
    if (lastBracketPos > 0) {
      result = result.substring(0, lastBracketPos + 1);
    }
  }

  return result;
}

// Extract username from a Product Hunt profile URL
function extractUsernameFromUrl(url: string): string {
  if (!url) return "";

  const urlPath = url.split("/");
  const lastPathSegment = urlPath[urlPath.length - 1];

  if (!lastPathSegment) {
    return "";
  }

  // Handle both formats: /@username and /username
  return lastPathSegment.startsWith("@") ? lastPathSegment.substring(1) : lastPathSegment;
}

// Ensure consistent tagline formatting by using the cleanText utility
function formatTagline(tagline: string | undefined | null): string {
  return cleanText(tagline);
}

// Clean up topic names by replacing incorrectly encoded characters
function cleanTopicName(name: string | undefined | null): string {
  return cleanText(name);
}

// Parse RSS feed from Product Hunt
export async function getFrontpageProducts(): Promise<{ products: Product[]; error?: string }> {
  try {
    const response = await fetch("https://www.producthunt.com/");

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Find the Apollo state data embedded in the script tag
    const scriptContent = $('script:contains("ApolloSSRDataTransport")').text();
    const apolloDataMatch = scriptContent.match(/"events":(\[.+\])\}\)/)?.[1];

    if (!apolloDataMatch) {
      throw new Error("Could not extract Apollo data from the page");
    }

    const sanitizedData = sanitizeJsonString(apolloDataMatch);

    if (!sanitizedData) {
      throw new Error("Failed to sanitize Apollo data");
    }

    let apolloData;
    try {
      apolloData = JSON.parse(sanitizedData) as ApolloEvent[];
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      throw new Error(
        `Failed to parse Apollo data: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
      );
    }

    // Find the homefeed data
    const homefeedEvent = apolloData.find((event) => event.type === "data" && event.result.data.homefeed);

    if (!homefeedEvent) {
      throw new Error("Could not find homefeed data");
    }

    // Get the featured products
    const featuredEdge = homefeedEvent.result.data.homefeed?.edges.find((edge) => edge.node.id === "FEATURED-0");

    if (!featuredEdge) {
      throw new Error("Could not find featured products");
    }

    // Extract product data
    const productItems = featuredEdge.node.items.filter((item) => item.__typename === "Post");

    // Transform to our Product type
    const products = productItems.map((item) => ({
      id: item.id,
      name: item.name,
      tagline: formatTagline(item.tagline),
      description: item.description || "",
      url: `https://www.producthunt.com/posts/${item.slug}`,
      thumbnail: item.thumbnailImageUuid ? `https://ph-files.imgix.net/${item.thumbnailImageUuid}` : "",
      votesCount: item.votesCount || 0,
      commentsCount: item.commentsCount || 0,
      createdAt: item.createdAt,
      maker: item.user
        ? {
            id: item.user.id,
            name: item.user.name,
            username: item.user.username,
            avatarUrl: item.user.profileImage,
            profileImage: item.user.profileImage,
          }
        : undefined,
      topics:
        item.topics?.edges?.map((edge) => ({
          id: edge.node.id,
          name: cleanTopicName(edge.node.name),
          slug: edge.node.slug,
        })) || [],
    }));

    return { products };
  } catch (error) {
    console.error("Error fetching frontpage products:", error);
    return { products: [], error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Enhance a product with Open Graph metadata and detailed information
// Scrape detailed product information from a Product Hunt page
async function scrapeDetailedProductInfo(product: Product): Promise<Product> {
  try {
    const response = await fetch(product.url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract canonical URL if available
    const canonicalUrl = $('link[rel="canonical"]').attr("href");
    if (canonicalUrl) {
      product.url = canonicalUrl;
    }

    // Find the Apollo state data embedded in the script tag
    const scriptContent = $('script:contains("ApolloSSRDataTransport")').text();
    const apolloDataMatch = scriptContent.match(/"events":(\[.+\])\}\)/)?.[1];

    // Initialize variables for the enhanced data
    let makers: User[] = [];
    let hunter: User | undefined;
    const galleryImages: string[] = [];
    const shoutouts: Shoutout[] = [];
    let weeklyRank: number | undefined;
    let dailyRank: number | undefined;
    let productHubUrl: string | undefined;
    let previousLaunches: number | undefined;

    // Extract data using Cheerio selectors

    // 1. Extract hunter and makers
    // First, try to extract data from the Apollo state which is more reliable
    if (apolloDataMatch) {
      const sanitizedData = sanitizeJsonString(apolloDataMatch);

      if (sanitizedData) {
        try {
          const apolloData = JSON.parse(sanitizedData) as ApolloEvent[];

          // Find the post data
          const postEvent = apolloData.find((event) => event.type === "data" && event.result.data.post);

          if (postEvent && postEvent.result.data.post) {
            const postData = postEvent.result.data.post;

            // Try to extract hunter from Apollo data
            if (postData.hunter) {
              hunter = {
                id: postData.hunter.id || "hunter",
                name: postData.hunter.name,
                username: postData.hunter.username,
                avatarUrl: postData.hunter.profileImage || "",
                profileImage: postData.hunter.profileImage,
                profileUrl: `https://www.producthunt.com/@${postData.hunter.username}`,
              };
            }

            // Try to extract makers from Apollo data
            if (postData.makers && Array.isArray(postData.makers)) {
              makers = postData.makers.map((maker) => ({
                id: maker.id || `maker-${maker.username}`,
                name: maker.name,
                username: maker.username,
                avatarUrl: maker.profileImage || "",
                profileImage: maker.profileImage,
                profileUrl: `https://www.producthunt.com/@${maker.username}`,
              }));
            }
          }
        } catch (parseError) {
          console.error("Error parsing Apollo data:", parseError);
        }
      }
    }

    // Fallback to HTML scraping if Apollo data didn't provide what we need

    // Look for hunter if not found in Apollo data
    if (!hunter) {
      // Try the more reliable selector from the "About" section first
      const aboutHunterEl = $(
        "#about_section > div.text-14.font-normal.text-dark-gray.text-gray-600 > div:nth-child(2) > a",
      );
      if (aboutHunterEl.length > 0) {
        const hunterUrl = aboutHunterEl.attr("href");
        // The name is the text content of the link itself in this case
        const hunterName = aboutHunterEl.text().trim();

        if (hunterName && hunterUrl) {
          // Try to find the hunter's avatar in the page
          let hunterImage = "";

          // Look for the hunter's image in the "Meet the team" section
          const teamSection = $('.styles_metadataItem__YJEgI:contains("Meet the team"), [data-test="team-section"]');
          if (teamSection.length > 0) {
            teamSection.find("a").each((i, el) => {
              const teamMemberEl = $(el);
              const teamMemberUrl = teamMemberEl.attr("href");

              // If this team member's URL matches the hunter's URL, get their image
              if (teamMemberUrl === hunterUrl) {
                hunterImage = teamMemberEl.find("img").attr("src") || "";
                return false; // Break the loop
              }
            });
          }

          // Extract username from the URL
          const username = extractUsernameFromUrl(hunterUrl);

          hunter = {
            id: "hunter",
            name: hunterName,
            username: username,
            avatarUrl: hunterImage,
            profileUrl: hunterUrl.startsWith("http") ? hunterUrl : `https://www.producthunt.com${hunterUrl}`,
          };
        }
      }

      // Fallback to looking for elements with hunter badge using the SVG clip-path attribute
      if (!hunter) {
        const hunterSvgEl = $('svg [clip-path="url(#HunterIcon_svg__a)"]');
        if (hunterSvgEl.length > 0) {
          // Find the parent anchor tag that contains the hunter profile link
          const hunterEl = hunterSvgEl.closest("a");
          const hunterUrl = hunterEl.attr("href");
          // Get the name from the nearest div with text
          const hunterName = hunterEl
            .find("div")
            .filter((i, el) => {
              return $(el).text().trim().length > 0;
            })
            .first()
            .text()
            .trim();
          const hunterImage = hunterEl.find("img").attr("src");

          if (hunterName && hunterUrl) {
            // Extract username from the URL
            const username = extractUsernameFromUrl(hunterUrl);

            hunter = {
              id: "hunter",
              name: hunterName,
              username: username,
              avatarUrl: hunterImage || "",
              profileUrl: hunterUrl.startsWith("http") ? hunterUrl : `https://www.producthunt.com${hunterUrl}`,
            };
          }
        }
      }

      // Final fallback to other hunter badge selectors
      if (!hunter) {
        const hunterBadgeEl = $('[data-test="hunter-badge"], span:contains("Hunter")');
        if (hunterBadgeEl.length > 0) {
          const hunterEl = hunterBadgeEl.closest("a");
          const hunterUrl = hunterEl.attr("href");
          const hunterName = hunterEl.find("div").first().text().trim() || hunterEl.text().trim();
          const hunterImage = hunterEl.find("img").attr("src");

          if (hunterName && hunterUrl) {
            // Extract username from the URL
            const username = extractUsernameFromUrl(hunterUrl);

            hunter = {
              id: "hunter",
              name: hunterName,
              username: username,
              avatarUrl: hunterImage || "",
              profileUrl: hunterUrl.startsWith("http") ? hunterUrl : `https://www.producthunt.com${hunterUrl}`,
            };
          }
        }
      }
    }

    // Look for makers if not found in Apollo data
    if (makers.length === 0) {
      // Look for maker section in metadata
      const makerSection = $('.styles_metadataItem__YJEgI:contains("Makers"), [data-test="makers-section"]');
      if (makerSection.length > 0) {
        makerSection.find("a").each((i, el) => {
          const makerEl = $(el);
          // Skip if this has a hunter badge
          if (makerEl.find('span:contains("Hunter")').length > 0) {
            return;
          }

          const makerUrl = makerEl.attr("href");
          const makerName = makerEl.text().trim();
          const makerImage = makerEl.find("img").attr("src");

          // Skip if this is the hunter we already identified
          if (hunter && makerUrl === hunter.profileUrl) {
            return;
          }

          if (makerName && makerUrl) {
            // Extract username from the URL
            const username = extractUsernameFromUrl(makerUrl);

            makers.push({
              id: `maker-${i}`,
              name: makerName,
              username: username,
              avatarUrl: makerImage || "",
              profileUrl: makerUrl.startsWith("http") ? makerUrl : `https://www.producthunt.com${makerUrl}`,
            });
          }
        });
      }
    }

    // If still no makers found, try to use the existing maker (but only if it's not the hunter)
    if (makers.length === 0 && product.maker) {
      // Make sure the maker is not the same as the hunter
      if (!hunter || hunter.username !== product.maker.username) {
        makers = [product.maker];
      }
    }

    // 2. Extract gallery images
    console.log('Looking for gallery images with data-sentry-component="Gallery"');

    // First try to find the gallery component by data-sentry-component attribute
    const galleryContainer = $('[data-sentry-component="Gallery"]');

    // Also look for any elements with 'gallery' in their class or id
    const galleryClassElements = $(
      '[class*="gallery" i], [id*="gallery" i], [class*="carousel" i], [id*="carousel" i]',
    );

    console.log(`Found ${galleryClassElements.length} elements with gallery/carousel in class or id`);

    if (galleryContainer.length > 0) {
      console.log('Found gallery container with data-sentry-component="Gallery"');

      // Find all images within the gallery container
      galleryContainer.find("img").each((i, el) => {
        const imgSrc = $(el).attr("src");
        // console.log(`Found gallery image: ${imgSrc}`);

        if (imgSrc && !galleryImages.includes(imgSrc)) {
          // Process the image URL to get a high-quality version
          let processedImgSrc = imgSrc;

          // SVGs will be processed later in enhanceProductWithMetadata
          // For other imgix images, ensure proper formatting
          if (!imgSrc.includes(".svg") && imgSrc.includes("imgix.net")) {
            processedImgSrc = processImageUrl(imgSrc, {
              fit: ImgixFit.CROP,
              auto: ["format", "compress"],
              width: 1200,
              height: 800,
            });
          }

          galleryImages.push(processedImgSrc);
        }
      });
    } else if (galleryClassElements.length > 0) {
      console.log("Found elements with gallery/carousel in class or id");

      // Find all images within these elements
      galleryClassElements.find("img").each((i, el) => {
        const imgSrc = $(el).attr("src");
        console.log(`Found gallery image: ${imgSrc}`);

        if (imgSrc && !galleryImages.includes(imgSrc)) {
          // Process the image URL to get a high-quality version
          let processedImgSrc = imgSrc;

          // SVGs will be processed later in enhanceProductWithMetadata
          // For other imgix images, ensure proper formatting
          if (!imgSrc.includes(".svg") && imgSrc.includes("imgix.net")) {
            processedImgSrc = processImageUrl(imgSrc, {
              fit: ImgixFit.CROP,
              auto: ["format", "compress"],
              width: 1200,
              height: 800,
            });
          }

          galleryImages.push(processedImgSrc);
        }
      });
    } else {
      console.log("No gallery containers found, falling back to class selectors");

      // Fallback to the old selectors if the gallery component isn't found
      $(".styles_imageContainer__Hm_9x img, .styles_image__wG8b_ img").each((i, el) => {
        const imgSrc = $(el).attr("src");
        if (imgSrc && !galleryImages.includes(imgSrc)) {
          // Process the image URL to get a high-quality version
          let processedImgSrc = imgSrc;

          // SVGs will be processed later in enhanceProductWithMetadata
          // For other imgix images, ensure proper formatting
          if (!imgSrc.includes(".svg") && imgSrc.includes("imgix.net")) {
            processedImgSrc = processImageUrl(imgSrc, {
              fit: ImgixFit.CROP,
              auto: ["format", "compress"],
              width: 1200,
              height: 800,
            });
          }

          galleryImages.push(processedImgSrc);
        }
      });
    }

    // Also look for SVG images that might be in the page
    $("svg").each((i, el) => {
      const svgSrc = $(el).attr("src");
      if (svgSrc && svgSrc.includes(".svg") && !galleryImages.includes(svgSrc)) {
        galleryImages.push(svgSrc);
      }
    });

    // If no gallery images found yet, try to extract them from the Apollo data
    if (galleryImages.length === 0 && apolloDataMatch) {
      console.log("Trying to extract gallery images from Apollo data");
      try {
        const sanitizedData = sanitizeJsonString(apolloDataMatch);

        if (sanitizedData) {
          const apolloData = JSON.parse(sanitizedData) as ApolloEvent[];

          // Find the post data
          const postEvent = apolloData.find((event) => event.type === "data" && event.result.data.post);

          if (postEvent && postEvent.result.data.post) {
            const postData = postEvent.result.data.post;

            // Look for media or gallery fields in the Apollo data
            if (postData.media && Array.isArray(postData.media)) {
              console.log(`Found ${postData.media.length} media items in Apollo data`);
              // Using 'any' as Apollo state structure can be complex/variable
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              postData.media.forEach((mediaItem: any) => {
                if (mediaItem.url && !galleryImages.includes(mediaItem.url)) {
                  console.log(`Adding media item from Apollo data: ${mediaItem.url}`);
                  galleryImages.push(mediaItem.url);
                } else if (mediaItem.imageUuid) {
                  const imgUrl = `https://ph-files.imgix.net/${mediaItem.imageUuid}`;
                  if (!galleryImages.includes(imgUrl)) {
                    console.log(`Adding gallery item with imageUuid from Apollo data: ${imgUrl}`);
                    galleryImages.push(imgUrl);
                  }
                }
              });
            }

            // Look for gallery field
            if (postData.gallery && Array.isArray(postData.gallery)) {
              console.log(`Found ${postData.gallery.length} gallery items in Apollo data`);
              // Using 'any' as Apollo state structure can be complex/variable
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              postData.gallery.forEach((galleryItem: any) => {
                if (galleryItem.url && !galleryImages.includes(galleryItem.url)) {
                  console.log(`Adding gallery item from Apollo data: ${galleryItem.url}`);
                  galleryImages.push(galleryItem.url);
                } else if (galleryItem.imageUuid) {
                  const imgUrl = `https://ph-files.imgix.net/${galleryItem.imageUuid}`;
                  if (!galleryImages.includes(imgUrl)) {
                    console.log(`Adding gallery item with imageUuid from Apollo data: ${imgUrl}`);
                    galleryImages.push(imgUrl);
                  }
                }
              });
            }
          }
        }
      } catch (error) {
        console.error("Error extracting gallery images from Apollo data:", error);
      }
    }

    console.log(`Found ${galleryImages.length} gallery images total`);

    // 3. Extract shoutouts (built with)
    $('.styles_builtWithContainer__hMCFG a, [data-test="built-with-item"]').each((i, el) => {
      const shoutoutLink = $(el).attr("href");
      const shoutoutName = $(el).find("div").first().text().trim() || $(el).text().trim();
      const shoutoutImg = $(el).find("img").attr("src");

      if (shoutoutName && shoutoutLink) {
        shoutouts.push({
          id: `shoutout-${i}`,
          name: shoutoutName,
          url: shoutoutLink.startsWith("http") ? shoutoutLink : `https://www.producthunt.com${shoutoutLink}`,
          thumbnail: shoutoutImg || "",
        });
      }
    });

    // 4. Extract ranks
    const rankText = $('.styles_rankContainer__Oc9ce, [data-test="product-rank"]').text();
    const dailyRankMatch = rankText.match(/#(\d+) Today/);
    const weeklyRankMatch = rankText.match(/#(\d+) This Week/);

    if (dailyRankMatch && dailyRankMatch[1]) {
      dailyRank = parseInt(dailyRankMatch[1], 10);
    }

    if (weeklyRankMatch && weeklyRankMatch[1]) {
      weeklyRank = parseInt(weeklyRankMatch[1], 10);
    }

    // 5. Check for product hub (multiple launches)
    const productHubLink = $('a:contains("See"), a:contains("previous launches")');
    if (productHubLink.length > 0) {
      const hubUrl = productHubLink.attr("href");
      if (hubUrl) {
        productHubUrl = hubUrl.startsWith("http") ? hubUrl : `https://www.producthunt.com${hubUrl}`;

        // Try to extract the number of previous launches
        const launchesText = productHubLink.text();
        const launchesMatch = launchesText.match(/(\d+)\s+previous/);
        if (launchesMatch && launchesMatch[1]) {
          previousLaunches = parseInt(launchesMatch[1], 10);
        }
      }
    }

    // If we have Apollo data, try to extract more accurate information
    if (apolloDataMatch) {
      const sanitizedData = sanitizeJsonString(apolloDataMatch);

      if (sanitizedData) {
        try {
          const apolloData = JSON.parse(sanitizedData) as ApolloEvent[];

          // Find the post data
          const postEvent = apolloData.find((event) => event.type === "data" && event.result.data.post);

          if (postEvent && postEvent.result.data.post) {
            const postData = postEvent.result.data.post;

            // Update vote and comment counts with more accurate data
            if (postData.votesCount !== undefined) {
              product.votesCount = postData.votesCount;
            }

            if (postData.commentsCount !== undefined) {
              product.commentsCount = postData.commentsCount;
            }

            // Extract additional maker information if available
            if (postData.user && makers.length === 0) {
              makers.push({
                id: postData.user.id,
                name: postData.user.name,
                username: postData.user.username,
                avatarUrl: postData.user.profileImage || "",
                profileImage: postData.user.profileImage,
                profileUrl: `https://www.producthunt.com/@${postData.user.username}`,
              });
            }
          }
        } catch (parseError) {
          console.error("Error parsing Apollo data:", parseError);
        }
      }
    }

    // Return the enhanced product
    return {
      ...product,
      makers: makers.length > 0 ? makers : undefined,
      hunter,
      galleryImages: galleryImages.length > 0 ? galleryImages : undefined,
      shoutouts: shoutouts.length > 0 ? shoutouts : undefined,
      weeklyRank,
      dailyRank,
      productHubUrl,
      previousLaunches,
    };
  } catch (error) {
    console.error(`Error scraping detailed product info for ${product.id}:`, error);
    return product;
  }
}

export async function enhanceProductWithMetadata(product: Product): Promise<Product> {
  try {
    const metadata = await scrapeOpenGraphMetadata(product.url);

    // Use canonical URL if available
    if (metadata.canonicalUrl) {
      product.url = metadata.canonicalUrl;
    }

    // Extract the product slug from the URL for image fallback
    let thumbnailUrl = metadata.image || product.thumbnail;
    const slugMatch = product.url.match(/posts\/([^/]+)$/);
    const slug = slugMatch ? slugMatch[1] : null;

    // If we have a slug but no valid thumbnail, try to construct a reliable URL
    if ((!thumbnailUrl || thumbnailUrl === "") && slug) {
      // Try to fetch the product page to find image references
      try {
        const response = await fetch(product.url);
        if (response.ok) {
          const html = await response.text();
          const $ = cheerio.load(html);

          // Look for image references in the page
          const ogImage = $('meta[property="og:image"]').attr("content");
          const twitterImage = $('meta[name="twitter:image"]').attr("content");

          // Use the first available image
          thumbnailUrl = ogImage || twitterImage || thumbnailUrl;
        }
      } catch (error) {
        console.error(`Error fetching product page for ${slug}:`, error);
      }

      // If we still don't have a valid thumbnail, use a fallback
      if (!thumbnailUrl || thumbnailUrl === "") {
        // Use a generic Product Hunt image with the product slug
        thumbnailUrl = `https://ph-files.imgix.net/${slug}?auto=format&fit=crop&h=512&w=1024`;
      }
    }

    // Process the thumbnail URL
    if (thumbnailUrl) {
      // If it's an SVG, convert to base64
      if (thumbnailUrl.includes(".svg")) {
        // We'll set this asynchronously later
        // For now, keep the original URL as a fallback
      } else if (thumbnailUrl.includes("imgix.net")) {
        // For other imgix images, ensure proper formatting
        thumbnailUrl = processImageUrl(thumbnailUrl, {
          fit: ImgixFit.CROP,
          auto: ["format", "compress"],
          width: 1024,
          height: 512,
        });
      }
    }

    // Get detailed product information
    const enhancedProduct = await scrapeDetailedProductInfo(product);

    // Process SVG to base64 if needed
    if (thumbnailUrl && thumbnailUrl.includes(".svg")) {
      try {
        const base64Thumbnail = await fetchSvgAsBase64(thumbnailUrl);
        thumbnailUrl = base64Thumbnail;
      } catch (error) {
        console.error(`Error converting SVG to base64: ${error}`);
        // Fall back to the original URL if base64 conversion fails
      }
    }

    // Process gallery images - convert any SVGs to base64
    if (enhancedProduct.galleryImages && enhancedProduct.galleryImages.length > 0) {
      const processedGalleryImages = await Promise.all(
        enhancedProduct.galleryImages.map(async (imgUrl) => {
          if (imgUrl.includes(".svg")) {
            try {
              return await fetchSvgAsBase64(imgUrl);
            } catch (error) {
              console.error(`Error converting gallery SVG to base64: ${error}`);
              return imgUrl; // Fall back to original URL
            }
          }
          return imgUrl;
        }),
      );
      enhancedProduct.galleryImages = processedGalleryImages;
    }

    // Store the original high-quality image from OpenGraph metadata as featuredImage
    const featuredImage = metadata.image || undefined;

    return {
      ...enhancedProduct,
      description: metadata.description || product.description,
      thumbnail: thumbnailUrl,
      featuredImage: featuredImage,
    };
  } catch (error) {
    console.error(`Error enhancing product ${product.id} with metadata:`, error);
    return product;
  }
}

// Scrape Open Graph metadata from a URL
export async function scrapeOpenGraphMetadata(url: string): Promise<OpenGraphMetadata> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const metadata: OpenGraphMetadata = {};

    // Extract Open Graph metadata using Cheerio (more reliable than regex)
    metadata.title = $('meta[property="og:title"]').attr("content") || "";
    metadata.description = $('meta[property="og:description"]').attr("content") || "";
    metadata.image = $('meta[property="og:image"]').attr("content") || "";
    metadata.url = $('meta[property="og:url"]').attr("content") || "";
    metadata.siteName = $('meta[property="og:site_name"]').attr("content") || "";
    metadata.type = $('meta[property="og:type"]').attr("content") || "";

    // Extract canonical URL
    metadata.canonicalUrl = $('link[rel="canonical"]').attr("href") || metadata.url || url;

    // If no Open Graph image is found, try other common image selectors
    if (!metadata.image) {
      // Try to find the product image in the page content
      const productImage =
        $(".styles_thumbnail__Xtg_i img").attr("src") ||
        $(".styles_media__jA_aZ img").attr("src") ||
        $('img[alt*="product"]').attr("src") ||
        $('img[alt*="Product"]').attr("src");

      if (productImage) {
        metadata.image = productImage;
      }
    }

    // Ensure image URL is absolute
    if (metadata.image && !metadata.image.startsWith("http")) {
      metadata.image = new URL(metadata.image, url).toString();
    }

    return metadata;
  } catch (error) {
    console.error("Error scraping Open Graph metadata:", error);
    return {};
  }
}

// Get detailed information about a specific product
export async function getProductDetails(productId: string): Promise<{ product?: Product; error?: string }> {
  try {
    const url = `https://www.producthunt.com/posts/${productId}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract canonical URL if available
    const canonicalUrl = $('link[rel="canonical"]').attr("href");

    // Find the Apollo state data embedded in the script tag
    const scriptContent = $('script:contains("ApolloSSRDataTransport")').text();
    const apolloDataMatch = scriptContent.match(/"events":(\[.+\])\}\)/)?.[1];

    if (!apolloDataMatch) {
      throw new Error("Could not extract Apollo data from the page");
    }

    const sanitizedData = sanitizeJsonString(apolloDataMatch);

    if (!sanitizedData) {
      throw new Error("Failed to sanitize Apollo data");
    }

    let apolloData;
    try {
      apolloData = JSON.parse(sanitizedData) as ApolloEvent[];
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      throw new Error(
        `Failed to parse Apollo data: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
      );
    }

    // Find the post data
    const postEvent = apolloData.find((event) => event.type === "data" && event.result.data.post);

    if (!postEvent || !postEvent.result.data.post) {
      throw new Error("Could not find post data");
    }

    const postData = postEvent.result.data.post;

    // Transform to our Product type
    const product: Product = {
      id: postData.id,
      name: postData.name,
      tagline: formatTagline(postData.tagline),
      description: postData.description || "",
      url: canonicalUrl || `https://www.producthunt.com/posts/${postData.slug}`,
      thumbnail: postData.thumbnailImageUuid ? `https://ph-files.imgix.net/${postData.thumbnailImageUuid}` : "",
      votesCount: postData.votesCount || 0,
      commentsCount: postData.commentsCount || 0,
      createdAt: postData.createdAt,
      maker: postData.user
        ? {
            id: postData.user.id,
            name: postData.user.name,
            username: postData.user.username,
            avatarUrl: postData.user.profileImage,
            profileImage: postData.user.profileImage,
          }
        : undefined,
      topics:
        postData.topics?.edges?.map((edge) => ({
          id: edge.node.id,
          name: cleanTopicName(edge.node.name),
          slug: edge.node.slug,
        })) || [],
    };

    // Enhance the product with gallery images and other detailed information
    try {
      const enhancedProduct = await enhanceProductWithMetadata(product);
      return { product: enhancedProduct };
    } catch (enhanceError) {
      console.error("Error enhancing product with metadata:", enhanceError);
      // If enhancement fails, return the basic product
      return { product };
    }
  } catch (error) {
    console.error("Error fetching product details:", error);
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Scrape trending products
export async function getTrendingProducts(): Promise<{ products: Product[]; error?: string }> {
  try {
    const response = await fetch("https://www.producthunt.com/");

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Find the Apollo state data embedded in the script tag
    const scriptContent = $('script:contains("ApolloSSRDataTransport")').text();
    const apolloDataMatch = scriptContent.match(/"events":(\[.+\])\}\)/)?.[1];

    if (!apolloDataMatch) {
      throw new Error("Could not extract Apollo data from the page");
    }

    const sanitizedData = sanitizeJsonString(apolloDataMatch);

    if (!sanitizedData) {
      throw new Error("Failed to sanitize Apollo data");
    }

    let apolloData;
    try {
      apolloData = JSON.parse(sanitizedData) as ApolloEvent[];
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      throw new Error(
        `Failed to parse Apollo data: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
      );
    }

    // Find the homefeed data
    const homefeedEvent = apolloData.find((event) => event.type === "data" && event.result.data.homefeed);

    if (!homefeedEvent || !homefeedEvent.result.data.homefeed) {
      throw new Error("Could not find homefeed data");
    }

    // Get the popular products (usually the second section)
    const popularEdge = homefeedEvent.result.data.homefeed.edges.find(
      (edge) => edge.node.id === "FEATURED-1" || edge.node.id === "POPULAR-0",
    );

    if (!popularEdge) {
      throw new Error("Could not find popular products");
    }

    // Extract product data
    const productItems = popularEdge.node.items.filter((item) => item.__typename === "Post");

    // Transform to our Product type
    const products = productItems.map((item) => ({
      id: item.id,
      name: item.name,
      tagline: formatTagline(item.tagline),
      description: item.description || "",
      url: `https://www.producthunt.com/posts/${item.slug}`,
      thumbnail: item.thumbnailImageUuid ? `https://ph-files.imgix.net/${item.thumbnailImageUuid}` : "",
      votesCount: item.votesCount || 0,
      commentsCount: item.commentsCount || 0,
      createdAt: item.createdAt,
      maker: item.user
        ? {
            id: item.user.id,
            name: item.user.name,
            username: item.user.username,
            avatarUrl: item.user.profileImage,
            profileImage: item.user.profileImage,
          }
        : undefined,
      topics:
        item.topics?.edges?.map((edge) => ({
          id: edge.node.id,
          name: cleanTopicName(edge.node.name),
          slug: edge.node.slug,
        })) || [],
    }));

    return { products };
  } catch (error) {
    console.error("Error fetching trending products:", error);
    return { products: [], error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Scrape topics
export async function getTopics(): Promise<{ topics: Topic[]; error?: string }> {
  try {
    const response = await fetch("https://www.producthunt.com/topics");

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Find the Apollo state data embedded in the script tag
    const scriptContent = $('script:contains("ApolloSSRDataTransport")').text();
    const apolloDataMatch = scriptContent.match(/"events":(\[.+\])\}\)/)?.[1];

    if (!apolloDataMatch) {
      throw new Error("Could not extract Apollo data from the page");
    }

    const sanitizedData = sanitizeJsonString(apolloDataMatch);

    if (!sanitizedData) {
      throw new Error("Failed to sanitize Apollo data");
    }

    let apolloData;
    try {
      apolloData = JSON.parse(sanitizedData) as ApolloEvent[];
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      throw new Error(
        `Failed to parse Apollo data: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
      );
    }

    // Find the topics data
    const topicsEvent = apolloData.find((event) => event.type === "data" && event.result.data.topics);

    if (!topicsEvent || !topicsEvent.result.data.topics) {
      throw new Error("Could not find topics data");
    }

    // Extract topics
    const topicsEdges = topicsEvent.result.data.topics.edges;

    // Transform to our Topic type
    const topics = topicsEdges.map((edge) => ({
      id: edge.node.id,
      name: cleanTopicName(edge.node.name),
      slug: edge.node.slug,
      description: edge.node.description || "",
      followersCount: edge.node.followersCount || 0,
      postsCount: edge.node.postsCount || 0,
    }));

    return { topics };
  } catch (error) {
    console.error("Error fetching topics:", error);
    return { topics: [], error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Search for products
export async function searchProducts(query: string): Promise<{ products: Product[]; error?: string }> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.producthunt.com/search?q=${encodedQuery}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Find the Apollo state data embedded in the script tag
    const scriptContent = $('script:contains("ApolloSSRDataTransport")').text();
    const apolloDataMatch = scriptContent.match(/"events":(\[.+\])\}\)/)?.[1];

    if (!apolloDataMatch) {
      throw new Error("Could not extract Apollo data from the page");
    }

    const sanitizedData = sanitizeJsonString(apolloDataMatch);

    if (!sanitizedData) {
      throw new Error("Failed to sanitize Apollo data");
    }

    let apolloData;
    try {
      apolloData = JSON.parse(sanitizedData) as ApolloEvent[];
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      throw new Error(
        `Failed to parse Apollo data: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
      );
    }

    // Find the search results data
    const searchEvent = apolloData.find((event) => event.type === "data" && event.result.data.search);

    if (!searchEvent || !searchEvent.result.data.search) {
      throw new Error("Could not find search results data");
    }

    // Extract product data
    const productItems = searchEvent.result.data.search.edges
      .filter((edge) => edge.node.__typename === "Post")
      .map((edge) => edge.node);

    // Transform to our Product type
    const products = productItems.map((item) => ({
      id: item.id,
      name: item.name,
      tagline: formatTagline(item.tagline),
      description: item.description || "",
      url: `https://www.producthunt.com/posts/${item.slug}`,
      thumbnail: item.thumbnailImageUuid ? `https://ph-files.imgix.net/${item.thumbnailImageUuid}` : "",
      votesCount: item.votesCount || 0,
      commentsCount: item.commentsCount || 0,
      createdAt: item.createdAt,
      maker: item.user
        ? {
            id: item.user.id,
            name: item.user.name,
            username: item.user.username,
            avatarUrl: item.user.profileImage,
            profileImage: item.user.profileImage,
          }
        : undefined,
      topics:
        item.topics?.edges?.map((edge) => ({
          id: edge.node.id,
          name: cleanTopicName(edge.node.name),
          slug: edge.node.slug,
        })) || [],
    }));

    return { products };
  } catch (error) {
    console.error("Error searching products:", error);
    return { products: [], error: error instanceof Error ? error.message : "Unknown error" };
  }
}
