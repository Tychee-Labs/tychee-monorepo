/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        NEXT_PUBLIC_STELLAR_NETWORK: process.env.STELLAR_NETWORK,
        NEXT_PUBLIC_STELLAR_HORIZON_URL: process.env.STELLAR_HORIZON_URL,
        NEXT_PUBLIC_SOROBAN_RPC_URL: process.env.SOROBAN_RPC_URL,
        NEXT_PUBLIC_SOROBAN_CONTRACT_ADDRESS: process.env.SOROBAN_CONTRACT_ADDRESS,
        NEXT_PUBLIC_ACCOUNT_ABSTRACTION_ADDRESS: process.env.ACCOUNT_ABSTRACTION_ADDRESS,
        NEXT_PUBLIC_USE_ACCOUNT_ABSTRACTION: process.env.USE_ACCOUNT_ABSTRACTION,
    },
    webpack: (config, { isServer }) => {
        // Handle Stellar SDK node modules on client-side
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                net: false,
                tls: false,
            };
        }
        return config;
    },
}

module.exports = nextConfig
