/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Dev only: lets a phone on the same Wi-Fi load the dev scripts (otherwise the page renders but nothing is clickable).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "192.168.15.70"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
};

export default nextConfig;
