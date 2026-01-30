/**
 * Tychee SDK - Core Engine
 * Main entry point for card tokenization SDK
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { TycheeConfig, CardData, TokenMetadata, TransactionResult, ExternalSigner, MessageSigner } from '../types';
import { CardTokenizer, RingCompatibleCrypto } from '../crypto';

export class TycheeSDK {
    private config: TycheeConfig;
    private server: StellarSdk.Horizon.Server;
    private contract?: StellarSdk.Contract;
    private aaContract?: StellarSdk.Contract;
    private userKeypair?: StellarSdk.Keypair;
    private userPublicKey?: string;  // For external signer mode
    private externalSigner?: ExternalSigner;
    private messageSigner?: MessageSigner;
    private derivedEncryptionKey?: Buffer;  // Cached encryption key from signature

    constructor(config: TycheeConfig) {
        this.config = config;

        // Initialize Stellar server
        this.server = new StellarSdk.Horizon.Server(config.horizonUrl);

        // Initialize contracts only if addresses are provided
        if (config.tokenVaultAddress && config.tokenVaultAddress.length > 0) {
            try {
                this.contract = new StellarSdk.Contract(config.tokenVaultAddress);
            } catch (e) {
                console.warn('Invalid tokenVaultAddress, contract operations will not be available');
            }
        }

        if (config.useAccountAbstraction && config.accountAbstractionAddress) {
            try {
                this.aaContract = new StellarSdk.Contract(config.accountAbstractionAddress);
            } catch (e) {
                console.warn('Invalid accountAbstractionAddress');
            }
        }
    }

    /**
     * Initialize SDK with user's keypair
     */
    async initialize(secretKey: string): Promise<void> {
        this.userKeypair = StellarSdk.Keypair.fromSecret(secretKey);
        this.userPublicKey = this.userKeypair.publicKey();
        console.log('Tychee SDK initialized for:', this.userPublicKey);
    }

    /**
     * Initialize SDK with external signer (for wallet extensions)
     * Uses signature-based key derivation for encryption
     */
    async initializeWithSigner(
        publicKey: string,
        signer: ExternalSigner,
        messageSigner?: MessageSigner
    ): Promise<void> {
        this.userPublicKey = publicKey;
        this.externalSigner = signer;
        this.messageSigner = messageSigner;

        // If we have a message signer, derive the encryption key now
        if (messageSigner) {
            await this.deriveEncryptionKeyFromSignature();
        }

        console.log('Tychee SDK initialized with external signer for:', publicKey);
    }

    /**
     * Derive encryption key from a signed message
     * This allows wallet extensions to be used for encryption
     */
    private async deriveEncryptionKeyFromSignature(): Promise<Buffer> {
        if (this.derivedEncryptionKey) {
            return this.derivedEncryptionKey;
        }

        if (!this.messageSigner || !this.userPublicKey) {
            throw new Error('Message signer not available. Cannot derive encryption key.');
        }

        // Use a deterministic message that will always produce the same signature
        const derivationMessage = `TYCHEE_KEY_DERIVATION:${this.userPublicKey}:v1`;

        const networkPassphrase = this.config.stellarNetwork === 'testnet'
            ? StellarSdk.Networks.TESTNET
            : StellarSdk.Networks.PUBLIC;

        const { signedMessage } = await this.messageSigner(derivationMessage, {
            networkPassphrase,
            address: this.userPublicKey,
        });

        // Derive encryption key from the signed message
        const crypto = await import('crypto');
        this.derivedEncryptionKey = crypto.createHash('sha256').update(signedMessage).digest();

        return this.derivedEncryptionKey;
    }

    /**
     * Initialize SDK with public key only (for read operations)
     */
    async initializeReadOnly(publicKey: string): Promise<void> {
        this.userPublicKey = publicKey;
        console.log('Tychee SDK initialized (read-only):', publicKey);
    }

    /**
     * Get user's public address
     */
    getUserAddress(): string {
        if (!this.userPublicKey && !this.userKeypair) {
            throw new Error('SDK not initialized. Call initialize() first.');
        }
        return this.userPublicKey || this.userKeypair!.publicKey();
    }

    /**
     * Check if SDK can perform write operations (store, revoke)
     */
    canWrite(): boolean {
        return !!(this.userKeypair || this.externalSigner);
    }

    /**
     * Check if SDK can encrypt/decrypt cards
     */
    canEncrypt(): boolean {
        return !!(this.userKeypair || this.derivedEncryptionKey);
    }

    /**
     * Tokenize and store a card on-chain
     */
    async storeCard(cardData: CardData): Promise<TokenMetadata> {
        const userAddress = this.getUserAddress();

        if (!this.canWrite()) {
            throw new Error('SDK not initialized for write operations');
        }

        if (!this.canEncrypt()) {
            throw new Error('SDK cannot encrypt - need secret key or message signer for key derivation');
        }

        // Validate card
        if (!CardTokenizer.validateCardNumber(cardData.pan)) {
            throw new Error('Invalid card number (failed Luhn check)');
        }

        // Auto-detect network if not specified
        if (!cardData.network || cardData.network === 'visa') {
            const detected = CardTokenizer.detectCardNetwork(cardData.pan) as any;
            if (detected !== 'unknown') {
                cardData.network = detected;
            }
        }

        // Get encryption key - either from secret key or derived from signature
        let encryptionKey: Buffer;
        if (this.userKeypair) {
            encryptionKey = await RingCompatibleCrypto.deriveUserKey(this.userKeypair.secret());
        } else if (this.derivedEncryptionKey) {
            encryptionKey = this.derivedEncryptionKey;
        } else {
            throw new Error('No encryption key available');
        }

        // Encrypt card data
        const { encryptedPayload, tokenHash, last4Digits } = await CardTokenizer.encryptCard(
            cardData,
            encryptionKey
        );

        // Calculate expiration timestamp (from card expiry)
        const expiryDate = new Date(
            parseInt('20' + cardData.expiryYear),
            parseInt(cardData.expiryMonth) - 1,
            1
        );
        expiryDate.setMonth(expiryDate.getMonth() + 1); // End of expiry month
        const expiresAt = Math.floor(expiryDate.getTime() / 1000);

        // Prepare contract invocation
        const stellarAddress = new StellarSdk.Address(userAddress);

        // Convert data to Soroban types
        const encryptedBytes = StellarSdk.nativeToScVal(encryptedPayload, { type: 'bytes' });
        const hashBytes = StellarSdk.nativeToScVal(tokenHash, { type: 'bytes' });
        const last4 = StellarSdk.nativeToScVal(last4Digits, { type: 'string' });
        const network = StellarSdk.nativeToScVal(cardData.network, { type: 'string' });
        const expiresAtVal = StellarSdk.nativeToScVal(expiresAt, { type: 'u64' });

        const networkPassphrase = this.config.stellarNetwork === 'testnet'
            ? StellarSdk.Networks.TESTNET
            : StellarSdk.Networks.PUBLIC;

        try {
            // Build transaction
            const account = await this.server.loadAccount(userAddress);

            const transaction = new StellarSdk.TransactionBuilder(account, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase,
            })
                .addOperation(
                    this.contract.call(
                        'store_token',
                        stellarAddress.toScVal(),
                        encryptedBytes,
                        hashBytes,
                        last4,
                        network,
                        expiresAtVal
                    )
                )
                .setTimeout(30)
                .build();

            // Sign transaction - either with keypair or external signer
            let signedTx: StellarSdk.Transaction;
            if (this.userKeypair) {
                transaction.sign(this.userKeypair);
                signedTx = transaction;
            } else if (this.externalSigner) {
                const { signedTxXdr } = await this.externalSigner(transaction.toXDR(), {
                    networkPassphrase,
                    address: userAddress,
                });
                signedTx = StellarSdk.TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase) as StellarSdk.Transaction;
            } else {
                throw new Error('No signer available');
            }

            const response = await this.server.submitTransaction(signedTx);

            console.log('Card stored on-chain:', response.hash);

            // Return metadata
            const metadata: TokenMetadata = {
                userId: userAddress,
                tokenHash: tokenHash.toString('hex'),
                encryptedPayload: new Uint8Array(encryptedPayload),
                last4Digits,
                cardNetwork: cardData.network,
                status: 'active',
                createdAt: Math.floor(Date.now() / 1000),
                expiresAt,
                sorobanTxId: response.hash,
            };

            return metadata;
        } catch (error) {
            console.error('Error storing card:', error);
            throw error;
        }
    }

    /**
     * Retrieve encrypted card token from on-chain
     */
    async retrieveCard(): Promise<TokenMetadata | null> {
        const userAddress = this.getUserAddress();

        if (!this.canWrite()) {
            throw new Error('SDK not initialized for operations');
        }

        const networkPassphrase = this.config.stellarNetwork === 'testnet'
            ? StellarSdk.Networks.TESTNET
            : StellarSdk.Networks.PUBLIC;

        try {
            const stellarAddress = new StellarSdk.Address(userAddress);

            const account = await this.server.loadAccount(userAddress);

            const transaction = new StellarSdk.TransactionBuilder(account, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase,
            })
                .addOperation(
                    this.contract.call('retrieve_token', stellarAddress.toScVal())
                )
                .setTimeout(30)
                .build();

            // Sign transaction
            let signedTx: StellarSdk.Transaction;
            if (this.userKeypair) {
                transaction.sign(this.userKeypair);
                signedTx = transaction;
            } else if (this.externalSigner) {
                const { signedTxXdr } = await this.externalSigner(transaction.toXDR(), {
                    networkPassphrase,
                    address: userAddress,
                });
                signedTx = StellarSdk.TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase) as StellarSdk.Transaction;
            } else {
                throw new Error('No signer available');
            }

            const response = await this.server.submitTransaction(signedTx);

            // Parse response (simplified - actual parsing depends on Soroban response format)
            console.log('Card retrieved:', response.hash);

            // In production, parse the actual response data
            return null; // Placeholder
        } catch (error: any) {
            // Expected error when account or contract doesn't exist
            console.warn('Could not retrieve card (account/contract may not exist):', error.message || error);
            return null;
        }
    }

    /**
     * Revoke card token
     */
    async revokeCard(): Promise<TransactionResult> {
        const userAddress = this.getUserAddress();

        if (!this.canWrite()) {
            throw new Error('SDK not initialized for operations');
        }

        const networkPassphrase = this.config.stellarNetwork === 'testnet'
            ? StellarSdk.Networks.TESTNET
            : StellarSdk.Networks.PUBLIC;

        try {
            const stellarAddress = new StellarSdk.Address(userAddress);

            const account = await this.server.loadAccount(userAddress);

            const transaction = new StellarSdk.TransactionBuilder(account, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase,
            })
                .addOperation(
                    this.contract.call('revoke_token', stellarAddress.toScVal())
                )
                .setTimeout(30)
                .build();

            // Sign transaction
            let signedTx: StellarSdk.Transaction;
            if (this.userKeypair) {
                transaction.sign(this.userKeypair);
                signedTx = transaction;
            } else if (this.externalSigner) {
                const { signedTxXdr } = await this.externalSigner(transaction.toXDR(), {
                    networkPassphrase,
                    address: userAddress,
                });
                signedTx = StellarSdk.TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase) as StellarSdk.Transaction;
            } else {
                throw new Error('No signer available');
            }

            const response = await this.server.submitTransaction(signedTx);

            return {
                success: true,
                txHash: response.hash,
            };
        } catch (error: any) {
            return {
                success: false,
                txHash: '',
                error: error.message,
            };
        }
    }

    /**
   * Decrypt card data locally (doesn't hit blockchain)
   * Uses user's secret key or signature-derived key for decryption
   */
    async decryptCard(encryptedPayload: Buffer): Promise<CardData> {
        if (!this.canEncrypt()) {
            throw new Error('SDK cannot decrypt - need secret key or message signer for key derivation');
        }

        // Get encryption key - either from secret key or derived from signature
        let encryptionKey: Buffer;
        if (this.userKeypair) {
            encryptionKey = await RingCompatibleCrypto.deriveUserKey(this.userKeypair.secret());
        } else if (this.derivedEncryptionKey) {
            encryptionKey = this.derivedEncryptionKey;
        } else {
            throw new Error('No encryption key available');
        }

        return await CardTokenizer.decryptCard(encryptedPayload, encryptionKey);
    }

    /**
     * Get account abstraction mode
     */
    async getAAMode(): Promise<string> {
        if (!this.config.useAccountAbstraction || !this.aaContract || !this.userKeypair) {
            return 'standard';
        }

        try {
            const userAddress = new StellarSdk.Address(this.userKeypair.publicKey());
            const account = await this.server.loadAccount(this.userKeypair.publicKey());

            const transaction = new StellarSdk.TransactionBuilder(account, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: this.config.stellarNetwork === 'testnet'
                    ? StellarSdk.Networks.TESTNET
                    : StellarSdk.Networks.PUBLIC,
            })
                .addOperation(
                    this.aaContract.call('get_mode', userAddress.toScVal())
                )
                .setTimeout(30)
                .build();

            transaction.sign(this.userKeypair);
            const response = await this.server.submitTransaction(transaction);

            // Parse mode from response
            return 'standard'; // Placeholder
        } catch (error) {
            console.error('Error getting AA mode:', error);
            return 'standard';
        }
    }

    /**
     * Set account abstraction mode
     */
    async setAAMode(mode: 'standard' | 'sponsored' | 'sessionKey' | 'multisig'): Promise<TransactionResult> {
        if (!this.config.useAccountAbstraction || !this.aaContract || !this.userKeypair) {
            throw new Error('Account abstraction not enabled');
        }

        try {
            const userAddress = new StellarSdk.Address(this.userKeypair.publicKey());
            const modeVal = StellarSdk.nativeToScVal(mode, { type: 'string' });

            const account = await this.server.loadAccount(this.userKeypair.publicKey());

            const transaction = new StellarSdk.TransactionBuilder(account, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: this.config.stellarNetwork === 'testnet'
                    ? StellarSdk.Networks.TESTNET
                    : StellarSdk.Networks.PUBLIC,
            })
                .addOperation(
                    this.aaContract.call('set_mode', userAddress.toScVal(), modeVal)
                )
                .setTimeout(30)
                .build();

            transaction.sign(this.userKeypair);
            const response = await this.server.submitTransaction(transaction);

            return {
                success: true,
                txHash: response.hash,
            };
        } catch (error: any) {
            return {
                success: false,
                txHash: '',
                error: error.message,
            };
        }
    }
}

export default TycheeSDK;
