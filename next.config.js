/** @type {import('next').NextConfig} */
const nextConfig = {
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

        // Fix for "Critical dependency: require function is used in a way in which dependencies cannot be statically extracted"
        // arising from sodium-native being an optional dependency of stellar-sdk
        config.resolve.alias = {
            ...config.resolve.alias,
            'sodium-native': false,
        };

        return config;
    },
}

module.exports = nextConfig
