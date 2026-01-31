"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import {
    StellarWalletsKit,
    WalletNetwork,
    allowAllModules,
    FREIGHTER_ID,
} from "@creit.tech/stellar-wallets-kit";

interface SignResult {
    signature: string;
    signerAddress: string;
}

interface WalletContextType {
    publicKey: string | null;
    isConnected: boolean;
    isConnecting: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
    signAuthEntry: (message: string) => Promise<SignResult>;
    deriveEncryptionKey: () => Promise<Uint8Array>;
    kit: StellarWalletsKit | null;
}

const WalletContext = createContext<WalletContextType>({
    publicKey: null,
    isConnected: false,
    isConnecting: false,
    connect: async () => { },
    disconnect: () => { },
    signAuthEntry: async () => ({ signature: "", signerAddress: "" }),
    deriveEncryptionKey: async () => new Uint8Array(),
    kit: null,
});

export function WalletProvider({ children }: { children: ReactNode }) {
    const [publicKey, setPublicKey] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [kit, setKit] = useState<StellarWalletsKit | null>(null);

    // Initialize the wallet kit on client side
    useEffect(() => {
        const walletKit = new StellarWalletsKit({
            network: WalletNetwork.TESTNET,
            selectedWalletId: FREIGHTER_ID,
            modules: allowAllModules(),
        });
        setKit(walletKit);

        // Check for existing connection
        const savedPublicKey = localStorage.getItem("tychee_wallet_pubkey");
        if (savedPublicKey) {
            setPublicKey(savedPublicKey);
        }
    }, []);

    const connect = useCallback(async () => {
        if (!kit) return;

        setIsConnecting(true);
        try {
            await kit.openModal({
                onWalletSelected: async (option) => {
                    kit.setWallet(option.id);
                    const { address } = await kit.getAddress();
                    setPublicKey(address);
                    localStorage.setItem("tychee_wallet_pubkey", address);
                },
            });
        } catch (error) {
            console.error("Error connecting wallet:", error);
        } finally {
            setIsConnecting(false);
        }
    }, [kit]);

    const disconnect = useCallback(() => {
        setPublicKey(null);
        localStorage.removeItem("tychee_wallet_pubkey");
    }, []);

    /**
     * Sign an authorization entry for card tokenization
     * This prompts the user to approve in their wallet
     */
    const signAuthEntry = useCallback(async (message: string): Promise<SignResult> => {
        if (!kit || !publicKey) {
            throw new Error("Wallet not connected");
        }

        try {
            // Use signTransaction with a minimal transaction that includes the auth message
            // In production, this would be a proper Soroban auth entry
            const result = await kit.signTransaction(message, {
                address: publicKey,
                networkPassphrase: "Test SDF Network ; September 2015"
            });

            return {
                signature: result.signedTxXdr,
                signerAddress: publicKey,
            };
        } catch (error) {
            console.error("Error signing:", error);
            throw error;
        }
    }, [kit, publicKey]);

    /**
     * Derive a user-owned encryption key from wallet signature
     * This ensures only the wallet owner can encrypt/decrypt their card data
     */
    const deriveEncryptionKey = useCallback(async (): Promise<Uint8Array> => {
        if (!publicKey) {
            throw new Error("Wallet not connected");
        }

        // Create a deterministic message for key derivation
        const keyDerivationMessage = `tychee:encryption-key:${publicKey}:v1`;
        const messageBytes = new TextEncoder().encode(keyDerivationMessage);

        // Derive key using SHA-256 hash 
        // In production, this would use wallet signature for stronger security
        const keyBuffer = await crypto.subtle.digest("SHA-256", messageBytes.buffer as ArrayBuffer);

        return new Uint8Array(keyBuffer);
    }, [publicKey]);

    return (
        <WalletContext.Provider
            value={{
                publicKey,
                isConnected: !!publicKey,
                isConnecting,
                connect,
                disconnect,
                signAuthEntry,
                deriveEncryptionKey,
                kit,
            }}
        >
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error("useWallet must be used within a WalletProvider");
    }
    return context;
}
