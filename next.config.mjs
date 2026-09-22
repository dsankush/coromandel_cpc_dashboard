/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      "/**": ["./data/**/*", "./report_data.csv"],
    },
  },
};

export default nextConfig;
