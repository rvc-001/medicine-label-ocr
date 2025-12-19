/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow your specific mobile IP to access the dev server
  allowedDevOrigins: ["localhost:3000", "192.168.31.182:3000"],
  
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "192.168.31.182:3000"]
    }
  }
};

export default nextConfig;