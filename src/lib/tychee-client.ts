/**
 * Tychee Client - Browser-safe Demo Client
 * Provides tokenization using browser-native APIs only
 */

'use client';

// Define types inline
export interface CardData {
    pan: string;
    cvv: string;
    expiryMonth: string;
    expiryYear: string;
    cardholderName: string;
    network: 'visa' | 'mastercard' | 'rupay' | 'amex';
}

export interface TokenMetadata {
    userId: string;
    tokenHash: string;
    encryptedPayload: Uint8Array;
    last4Digits: string;
    cardNetwork: string;
    status: 'active' | 'revoked' | 'expired';
    createdAt: number;
    expiresAt: number;
    sorobanTxId?: string;
}

// Store user keypair in memory (for demo only)
let currentSecretKey: string | null = null;
let currentPublicKey: string | null = null;

/**
 * Initialize SDK with user's secret key
 */
export async function initializeSDK(secretKey: string): Promise<void> {
    currentSecretKey = secretKey;
    // For demo, we'll derive a public key-like string from the secret
    currentPublicKey = await derivePublicKey(secretKey);
}

/**
 * Derive a public key from secret (demo implementation)
 */
async function derivePublicKey(secretKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(secretKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // Format as Stellar-like address (starts with G)
    const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    return 'G' + hex.slice(0, 55);
}

/**
 * Initialize SDK in read-only mode with public key
 */
export async function initializeReadOnlySDK(publicKey: string): Promise<void> {
    currentPublicKey = publicKey;
    currentSecretKey = null;
}

/**
 * Get user's public address from SDK
 */
export function getUserAddress(): string | null {
    return currentPublicKey;
}

/**
 * Simple hash function for demo (browser-compatible)
 */
async function simpleHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Simple encryption for demo (browser-compatible)
 */
async function simpleEncrypt(data: string, key: CryptoKey): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        dataBuffer
    );

    // Combine IV + encrypted data
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);
    return result;
}

/**
 * Derive encryption key from secret key
 */
async function deriveKey(secretKey: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey.padEnd(32, '0').slice(0, 32));

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('tychee-salt-v1'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Tokenize a card (browser-safe demo implementation)
 */
export async function tokenizeCard(cardData: CardData): Promise<TokenMetadata> {
    if (!currentSecretKey || !currentPublicKey) {
        throw new Error('SDK not initialized. Call initializeSDK first.');
    }

    // Create card payload
    const payload = JSON.stringify({
        pan: cardData.pan,
        cvv: cardData.cvv,
        expiryMonth: cardData.expiryMonth,
        expiryYear: cardData.expiryYear,
        cardholderName: cardData.cardholderName,
        network: cardData.network
    });

    // Hash for token reference
    const tokenHash = await simpleHash(payload + Date.now());

    // Encrypt the payload
    const key = await deriveKey(currentSecretKey);
    const encryptedPayload = await simpleEncrypt(payload, key);

    // Calculate expiry from card data
    const expiryYear = parseInt(cardData.expiryYear);
    const expiryMonth = parseInt(cardData.expiryMonth);
    const fullYear = expiryYear < 100 ? 2000 + expiryYear : expiryYear;
    const expiresAt = new Date(fullYear, expiryMonth - 1).getTime();

    // Create mock Soroban transaction ID
    const sorobanTxId = 'tx_' + tokenHash.slice(0, 16);

    return {
        userId: currentPublicKey,
        tokenHash,
        encryptedPayload,
        last4Digits: cardData.pan.slice(-4),
        cardNetwork: cardData.network,
        status: 'active',
        createdAt: Date.now(),
        expiresAt,
        sorobanTxId
    };
}

/**
 * Retrieve card token from blockchain (demo stub)
 */
export async function retrieveCardToken(): Promise<TokenMetadata | null> {
    return null;
}

/**
 * Revoke card token (demo stub)
 */
export async function revokeCardToken(): Promise<{ success: boolean; txHash: string }> {
    return { success: true, txHash: 'demo_revoke_tx' };
}

/**
 * Generate a demo keypair for testing (browser-safe)
 * Uses Web Crypto API instead of Stellar SDK
 */
export function generateDemoKeypair(): { publicKey: string; secretKey: string } {
    // Generate random bytes for secret key
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const secretKey = 'S' + Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
        .slice(0, 55);

    // Derive public key synchronously for simplicity
    const publicKeyBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        publicKeyBytes[i] = randomBytes[i] ^ 0x42; // Simple transformation
    }
    const publicKey = 'G' + Array.from(publicKeyBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
        .slice(0, 55);

    return { publicKey, secretKey };
}

/**
 * Fund testnet account using Friendbot
 * For demo mode, we'll simulate success
 */
export async function fundTestnetAccount(publicKey: string): Promise<boolean> {
    // In demo mode, always return success
    // The actual Friendbot call requires a valid Stellar address
    console.log('Demo mode: Simulating testnet account funding for', publicKey.slice(0, 8) + '...');
    return true;
}
