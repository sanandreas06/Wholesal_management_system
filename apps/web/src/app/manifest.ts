import type { MetadataRoute } from "next";

/** Makes WHOLESTRA installable as a web app: its own icon on the phone or computer, opening in its own window. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "WHOLESTRA",
    short_name: "WHOLESTRA",
    description: "Stock, sales, purchasing and money for every branch of your wholesale business.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#FFFFFF",
    theme_color: "#0B1B3E",
    categories: ["business", "productivity", "finance"],
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Dashboard", url: "/dashboard", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Sales", url: "/sales", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Inventory", url: "/inventory", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
