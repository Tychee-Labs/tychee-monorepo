/**
 * Browser-compatible Soroban client for card tokenization
 * Builds transactions and uses Stellar Wallets Kit for signing
 */

import {
    TransactionBuilder,
    Networks,
    BASE_FEE,
    Address,
    nativeToScVal,
    Contract,
    SorobanRpc,
} from "@stellar/stellar-sdk";
import type { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";

// Environment config
const SOROBAN_RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
const TOKEN_VAULT_ADDRESS = process.env.NEXT_PUBLIC_SOROBAN_CONTRACT_ADDRESS || "";
const NETWORK_PASSPHRASE = Networks.TESTNET;

export interface StoreTokenParams {
    publicKey: string;
    encryptedPayload: Uint8Array;
    tokenHash: string;
    last4Digits: string;
    network: string;
    expiresAt: number;
}

export interface StoreTokenResult {
    success: boolean;
    txHash?: string;
    error?: string;
}

/**
 * Helper to convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

/**
 * Build a Soroban transaction for storing tokenized card data
 */
export async function buildStoreTokenTransaction(
    params: StoreTokenParams
): Promise<string> {
    const server = new SorobanRpc.Server(SOROBAN_RPC_URL);
    const contract = new Contract(TOKEN_VAULT_ADDRESS);

    // Load account
    const account = await server.getAccount(params.publicKey);

    // Convert data to Soroban types
    const userAddress = new Address(params.publicKey);
    const encryptedBytes = nativeToScVal(params.encryptedPayload, { type: "bytes" });
    const hashBytes = nativeToScVal(hexToBytes(params.tokenHash), { type: "bytes" });
    const last4 = nativeToScVal(params.last4Digits, { type: "string" });
    const network = nativeToScVal(params.network, { type: "string" });
    const expiresAtVal = nativeToScVal(params.expiresAt, { type: "u64" });

    // Build transaction
    const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(
            contract.call(
                "store_token",
                userAddress.toScVal(),
                encryptedBytes,
                hashBytes,
                last4,
                network,
                expiresAtVal
            )
        )
        .setTimeout(30)
        .build();

    // Prepare transaction for Soroban
    const preparedTx = await server.prepareTransaction(transaction);

    // Return XDR for wallet signing
    return preparedTx.toXDR();
}

/**
 * Sign and submit a transaction using Stellar Wallets Kit
 */
export async function signAndSubmitTransaction(
    kit: StellarWalletsKit,
    xdr: string,
    publicKey: string
): Promise<StoreTokenResult> {
    try {
        // Sign with wallet
        const { signedTxXdr } = await kit.signTransaction(xdr, {
            address: publicKey,
            networkPassphrase: NETWORK_PASSPHRASE,
        });

        // Submit to network
        const server = new SorobanRpc.Server(SOROBAN_RPC_URL);
        const tx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
        const response = await server.sendTransaction(tx);

        if (response.status === "PENDING") {
            // Wait for confirmation
            let getResponse = await server.getTransaction(response.hash);
            while (getResponse.status === "NOT_FOUND") {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                getResponse = await server.getTransaction(response.hash);
            }

            if (getResponse.status === "SUCCESS") {
                return { success: true, txHash: response.hash };
            } else {
                return { success: false, error: "Transaction failed" };
            }
        }

        return { success: true, txHash: response.hash };
    } catch (error: any) {
        console.error("Transaction error:", error);

        // Check for user rejection
        if (error.message?.includes("User rejected") || error.message?.includes("cancelled")) {
            return { success: false, error: "Transaction cancelled by user" };
        }

        return { success: false, error: error.message || "Transaction failed" };
    }
}

/**
 * Store tokenized card on-chain with wallet signing
 */
export async function storeCardOnChain(
    kit: StellarWalletsKit,
    params: StoreTokenParams
): Promise<StoreTokenResult> {
    try {
        // Build transaction
        const xdr = await buildStoreTokenTransaction(params);

        // Sign and submit
        return await signAndSubmitTransaction(kit, xdr, params.publicKey);
    } catch (error: any) {
        console.error("Store card error:", error);
        return { success: false, error: error.message };
    }
}
