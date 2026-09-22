import { useEffect } from "react";
import { HelmetProvider, Helmet } from "react-helmet-async";
import { TooltipProvider } from "@/components/ui/tooltip";

export interface PageMetaProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "music.song" | "video.other" | "profile" | "article";
}

const PageMeta = ({
  title,
  description = "Stream, discover, and download authentic Zambian music, official music videos, and charts on ZedVevo.",
  image,
  url,
  type = "website",
}: PageMetaProps) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const currentUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  
  // Format absolute image URL for OpenGraph compatibility
  let absoluteImage = image || `${origin}/og-image.png`;
  if (absoluteImage && !absoluteImage.startsWith("http://") && !absoluteImage.startsWith("https://")) {
    absoluteImage = `${origin}${absoluteImage.startsWith("/") ? "" : "/"}${absoluteImage}`;
  }

  // Synchronize directly into DOM head for instant scraping/social preview reflection
  useEffect(() => {
    if (typeof document === "undefined") return;
    
    document.title = title;

    const setMetaTag = (selector: string, attrName: string, attrVal: string, content: string) => {
      let tag = document.querySelector(selector);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attrName, attrVal);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    setMetaTag('meta[name="description"]', "name", "description", description);
    setMetaTag('meta[property="og:title"]', "property", "og:title", title);
    setMetaTag('meta[property="og:description"]', "property", "og:description", description);
    setMetaTag('meta[property="og:image"]', "property", "og:image", absoluteImage);
    setMetaTag('meta[property="og:image:secure_url"]', "property", "og:image:secure_url", absoluteImage);
    setMetaTag('meta[property="og:url"]', "property", "og:url", currentUrl);
    setMetaTag('meta[property="og:type"]', "property", "og:type", type);
    setMetaTag('meta[property="og:site_name"]', "property", "og:site_name", "ZedVevo");

    setMetaTag('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    setMetaTag('meta[name="twitter:title"]', "name", "twitter:title", title);
    setMetaTag('meta[name="twitter:description"]', "name", "twitter:description", description);
    setMetaTag('meta[name="twitter:image"]', "name", "twitter:image", absoluteImage);
  }, [title, description, absoluteImage, currentUrl, type]);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:site_name" content="ZedVevo" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:image:secure_url" content={absoluteImage} />
      <meta property="og:url" content={currentUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@ZedVevo" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteImage} />
    </Helmet>
  );
};

export const AppWrapper = ({ children }: { children: React.ReactNode }) => (
  <HelmetProvider>
    <TooltipProvider>
      {children}
    </TooltipProvider>
  </HelmetProvider>
);

export default PageMeta;

