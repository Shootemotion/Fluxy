/** @type {import('next').NextConfig} */

// Derive the Supabase host from the env var instead of hardcoding one project,
// so a fresh clone pointed at another Supabase project still renders avatars.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig = {
  images: {
    remotePatterns: [
      ...(supabaseHost ? [{ protocol: "https", hostname: supabaseHost }] : []),
      // Google account avatars, for the OAuth sign-in.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
