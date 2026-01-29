/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverActions: true,
    },
    webpack: (config, { isServer }) => {
        // Handle Soroban and Stellar SDK node modules
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                net: false,
                tls: false,
                crypto: false,
            };
        }
        return config;
    },
}

module.exports = nextConfig
