/**
 * Browser-compatible wrapper for @tychee/sdk crypto utilities
 * Uses Web Crypto API instead of Node.js crypto
 * 
 * This mirrors the SDK's CardTokenizer API for client-side use
 */

/**
 * Card data structure (mirrors SDK type)
 */
export interface CardData {
    pan: string;
    cvv: string;
    expiryMonth: string;
    expiryYear: string;
    cardholderName: string;
    network: 'visa' | 'mastercard' | 'rupay' | 'amex';
}

/**
 * Helper to create a clean ArrayBuffer from Uint8Array
 */
function toArrayBuffer(data: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(data.length);
    new Uint8Array(buffer).set(data);
    return buffer;
}

/**
 * Card tokenization utilities (browser-compatible)
 * Ports the SDK's CardTokenizer for client-side use
 */
export class CardTokenizer {
    /**
     * Validate card number using Luhn algorithm
     */
    static validateCardNumber(pan: string): boolean {
        const cleaned = pan.replace(/[\s-]/g, '');
        if (!/^\d+$/.test(cleaned)) return false;
        if (cleaned.length < 13 || cleaned.length > 19) return false;

        let sum = 0;
        let isEven = false;

        for (let i = cleaned.length - 1; i >= 0; i--) {
            let digit = parseInt(cleaned[i], 10);

            if (isEven) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }

            sum += digit;
            isEven = !isEven;
        }

        return sum % 10 === 0;
    }

    /**
     * Detect card network from PAN
     */
    static detectCardNetwork(pan: string): string {
        const cleaned = pan.replace(/[\s-]/g, '');

        if (/^4/.test(cleaned)) return 'visa';
        if (/^5[1-5]/.test(cleaned) || /^2(22[1-9]|2[3-9]\d|[3-6]\d{2}|7[01]\d|720)/.test(cleaned)) {
            return 'mastercard';
        }
        if (/^(60|6521|6522)/.test(cleaned)) return 'rupay';
        if (/^3[47]/.test(cleaned)) return 'amex';

        return 'unknown';
    }

    /**
     * Mask card number for display
     */
    static maskCardNumber(pan: string): string {
        const cleaned = pan.replace(/[\s-]/g, '');
        if (cleaned.length < 4) return '*'.repeat(cleaned.length);

        const last4 = cleaned.slice(-4);
        const masked = '*'.repeat(cleaned.length - 4);
        return masked + last4;
    }

    /**
     * Encrypt card data using Web Crypto API (AES-256-GCM)
     */
    static async encryptCard(
        cardData: CardData,
        encryptionKey: Uint8Array
    ): Promise<{
        encryptedPayload: Uint8Array;
        tokenHash: string;
        last4Digits: string;
    }> {
        const plaintext = JSON.stringify({
            pan: cardData.pan,
            cvv: cardData.cvv,
            expiryMonth: cardData.expiryMonth,
            expiryYear: cardData.expiryYear,
            cardholderName: cardData.cardholderName,
            network: cardData.network,
        });

        const plaintextBytes = new TextEncoder().encode(plaintext);
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            toArrayBuffer(encryptionKey),
            { name: 'AES-GCM' },
            false,
            ['encrypt']
        );

        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: toArrayBuffer(iv) },
            cryptoKey,
            toArrayBuffer(plaintextBytes)
        );

        const encryptedPayload = new Uint8Array(iv.length + ciphertext.byteLength);
        encryptedPayload.set(iv, 0);
        encryptedPayload.set(new Uint8Array(ciphertext), iv.length);

        const hashBuffer = await crypto.subtle.digest('SHA-256', toArrayBuffer(plaintextBytes));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        return {
            encryptedPayload,
            tokenHash,
            last4Digits: cardData.pan.slice(-4),
        };
    }

    /**
     * Decrypt card data using Web Crypto API
     */
    static async decryptCard(
        encryptedPayload: Uint8Array,
        encryptionKey: Uint8Array
    ): Promise<CardData> {
        const iv = encryptedPayload.slice(0, 12);
        const ciphertext = encryptedPayload.slice(12);

        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            toArrayBuffer(encryptionKey),
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: toArrayBuffer(iv) },
            cryptoKey,
            toArrayBuffer(ciphertext)
        );

        return JSON.parse(new TextDecoder().decode(decrypted)) as CardData;
    }
}

/**
 * Client-side crypto utilities using Web Crypto API
 */
export class ClientCrypto {
    /**
     * Derive encryption key from wallet public key
     */
    static async deriveKeyFromWallet(publicKey: string): Promise<Uint8Array> {
        const keyMaterial = new TextEncoder().encode(`${publicKey}:tychee:coft:v1`);
        const hashBuffer = await crypto.subtle.digest('SHA-256', toArrayBuffer(keyMaterial));
        return new Uint8Array(hashBuffer);
    }

    /**
     * Create SHA-256 hash
     */
    static async hash(data: string): Promise<string> {
        const dataBuffer = new TextEncoder().encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', toArrayBuffer(dataBuffer));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}
