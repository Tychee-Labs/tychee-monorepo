'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User {
    id: string;
    walletAddress: string;
    accountAbstractionEnabled: boolean;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isInitialized: boolean;
    error: string | null;
    login: () => Promise<void>;
    logout: () => void;
    walletAddress: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'tychee_user_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    // Mark as mounted on client
    useEffect(() => {
        setMounted(true);
    }, []);

    // Restore session on mount (client-side only)
    useEffect(() => {
        if (!mounted) return;

        const restoreSession = async () => {
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    const session = JSON.parse(stored);

                    // Dynamically import SDK to avoid SSR issues
                    const { initializeSDK, getUserAddress } = await import('./tychee-client');

                    // Re-initialize SDK with stored secret key
                    if (session.secretKey) {
                        await initializeSDK(session.secretKey);
                        setWalletAddress(getUserAddress());
                        setIsInitialized(true);
                    }

                    // Fetch user from API
                    const response = await fetch(`/api/users?userId=${session.userId}`);
                    const data = await response.json();

                    if (data.user) {
                        setUser(data.user);
                    }
                }
            } catch (err) {
                console.error('Failed to restore session:', err);
                localStorage.removeItem(STORAGE_KEY);
            } finally {
                setIsLoading(false);
            }
        };

        restoreSession();
    }, [mounted]);

    // Login - creates or retrieves user
    const login = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Dynamically import SDK to avoid SSR issues
            const { generateDemoKeypair, initializeSDK, fundTestnetAccount } = await import('./tychee-client');

            // For demo: generate new keypair
            // In production: integrate with wallet provider
            const keypair = generateDemoKeypair();

            // Fund the testnet account
            console.log('Funding testnet account...');
            const funded = await fundTestnetAccount(keypair.publicKey);
            if (!funded) {
                console.warn('Failed to fund account, continuing anyway for demo');
            }

            // Initialize SDK with the keypair
            await initializeSDK(keypair.secretKey);
            setWalletAddress(keypair.publicKey);
            setIsInitialized(true);

            // Register/retrieve user from API
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: keypair.publicKey,
                    enableAccountAbstraction: true
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to register user');
            }

            const newUser: User = {
                id: data.user?.id || data.userId,
                walletAddress: keypair.publicKey,
                accountAbstractionEnabled: true
            };

            setUser(newUser);

            // Store session (for demo purposes)
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                userId: newUser.id,
                secretKey: keypair.secretKey
            }));

        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Logout
    const logout = useCallback(() => {
        setUser(null);
        setWalletAddress(null);
        setIsInitialized(false);
        if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, []);

    // Show loading until mounted to avoid hydration mismatch
    if (!mounted) {
        return (
            <AuthContext.Provider value={{
                user: null,
                isLoading: true,
                isInitialized: false,
                error: null,
                login: async () => { },
                logout: () => { },
                walletAddress: null
            }}>
                {children}
            </AuthContext.Provider>
        );
    }

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            isInitialized,
            error,
            login,
            logout,
            walletAddress
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
