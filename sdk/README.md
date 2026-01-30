# @tychee/sdk

> **Regulatory-compliant card tokenization SDK for Stellar blockchain with Web3 self-custody**

[![npm version](https://img.shields.io/npm/v/@tychee/sdk.svg)](https://www.npmjs.com/package/@tychee/sdk)
[![License: BSL-1.1](https://img.shields.io/badge/License-BSL--1.1-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## Overview

`@tychee/sdk` is a TypeScript SDK for secure card tokenization on Stellar's Soroban smart contracts. It enables developers to integrate regulatory-compliant (Card-on-File Tokenization) card storage into their applications with true Web3 self-custody — **no server-side master keys**.

### Key Features

- 🔐 **Self-Custody Encryption** — User owns their encryption keys (derived from Stellar wallet)
- ⛓️ **Stellar Blockchain** — Fast, secure, low-cost transactions on Soroban
- 📋 **Regulatory Compliant** — Built for Card-on-File Tokenization guidelines
- 🔑 **Account Abstraction** — Gasless transactions and session keys
- 🛡️ **AES-256-GCM** — Industry-standard encryption (ring-compatible)
- ✅ **Luhn Validation** — Built-in card number validation
- 🎯 **TypeScript First** — Full type definitions included

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
  - [TycheeSDK](#tycheesdk)
  - [CardTokenizer](#cardtokenizer)
  - [RingCompatibleCrypto](#ringcompatiblecrypto)
- [Account Abstraction](#account-abstraction)
- [Security](#security)
- [Examples](#examples)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [License](#license)

---

## Installation

```bash
npm install @tychee/sdk
```

```bash
yarn add @tychee/sdk
```

```bash
pnpm add @tychee/sdk
```

### Peer Dependencies

The SDK requires the following peer dependencies:

```bash
npm install @stellar/stellar-sdk
```

---

## Quick Start

### 1. Initialize the SDK

```typescript
import { TycheeSDK } from '@tychee/sdk';

const sdk = new TycheeSDK({
  stellarNetwork: 'testnet',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
  tokenVaultAddress: 'CDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  useAccountAbstraction: false,
});

// Initialize with user's Stellar secret key
await sdk.initialize('SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
```

### 2. Tokenize a Card

```typescript
import { CardData } from '@tychee/sdk';

const cardData: CardData = {
  pan: '4242424242424242',
  cvv: '123',
  expiryMonth: '12',
  expiryYear: '26',
  cardholderName: 'John Doe',
  network: 'visa',
};

// Tokenize and store on Stellar blockchain
const tokenMetadata = await sdk.storeCard(cardData);

console.log('Card tokenized!');
console.log('Token Hash:', tokenMetadata.tokenHash);
console.log('Last 4 digits:', tokenMetadata.last4Digits);
console.log('Transaction ID:', tokenMetadata.sorobanTxId);
```

### 3. Retrieve and Decrypt

```typescript
// Retrieve encrypted token from blockchain
const token = await sdk.retrieveCard();

// Decrypt locally using user's key (only the user can decrypt)
if (token) {
  const decryptedCard = await sdk.decryptCard(Buffer.from(token.encryptedPayload));
  console.log('Card retrieved:', decryptedCard.cardholderName);
}
```

### 4. Revoke Token

```typescript
// Revoke token when no longer needed
const result = await sdk.revokeCard();

if (result.success) {
  console.log('Card token revoked:', result.txHash);
} else {
  console.error('Revocation failed:', result.error);
}
```

---

## Configuration

### TycheeConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `stellarNetwork` | `'testnet' \| 'mainnet'` | ✅ | Stellar network to use |
| `horizonUrl` | `string` | ✅ | Horizon API endpoint |
| `sorobanRpcUrl` | `string` | ✅ | Soroban RPC endpoint |
| `tokenVaultAddress` | `string` | ✅ | Deployed Token Vault contract address |
| `accountAbstractionAddress` | `string` | ❌ | Account Abstraction contract address |
| `useAccountAbstraction` | `boolean` | ✅ | Enable gasless transactions |
| `aaMode` | `'standard' \| 'sponsored' \| 'sessionKey' \| 'multisig'` | ❌ | AA mode (default: 'standard') |
| `gasSponsor` | `string` | ❌ | Sponsor address for gas fees |

### Environment-Specific Configuration

**Testnet:**

```typescript
const config = {
  stellarNetwork: 'testnet',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
  tokenVaultAddress: 'YOUR_TESTNET_CONTRACT_ID',
  useAccountAbstraction: false,
};
```

**Mainnet:**

```typescript
const config = {
  stellarNetwork: 'mainnet',
  horizonUrl: 'https://horizon.stellar.org',
  sorobanRpcUrl: 'https://soroban.stellar.org',
  tokenVaultAddress: 'YOUR_MAINNET_CONTRACT_ID',
  useAccountAbstraction: false,
};
```

---

## Core Concepts

### Web3 Self-Custody Encryption

Unlike traditional tokenization providers that use server-side master keys, Tychee derives encryption keys from the user's Stellar wallet:

```
User's Stellar Secret Key (SXXX...)
         ↓
    SHA-256 Hash
         ↓
   256-bit AES Key (client-side)
         ↓
  AES-256-GCM Encryption
         ↓
  Encrypted Payload → Soroban Smart Contract
```

**Benefits:**
- ✅ User owns their encryption keys
- ✅ No master key vulnerability
- ✅ True self-custody
- ✅ Only user can decrypt their data

### Token Lifecycle

```
1. TOKENIZE     → Card data encrypted client-side
2. STORE        → Encrypted payload stored on Soroban
3. RETRIEVE     → Fetch encrypted token from blockchain
4. DECRYPT      → Decrypt locally with user's key
5. REVOKE       → Permanently disable token access
```

---

## API Reference

### TycheeSDK

Main SDK class for card tokenization operations.

#### Constructor

```typescript
new TycheeSDK(config: TycheeConfig)
```

#### Methods

##### `initialize(secretKey: string): Promise<void>`

Initialize the SDK with user's Stellar secret key.

```typescript
await sdk.initialize('SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
```

##### `initializeReadOnly(publicKey: string): Promise<void>`

Initialize for read-only operations (no signing capability).

```typescript
await sdk.initializeReadOnly('GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
```

##### `getUserAddress(): string`

Get the user's Stellar public address.

```typescript
const address = sdk.getUserAddress();
// Returns: GXXXXXXX...
```

##### `storeCard(cardData: CardData): Promise<TokenMetadata>`

Tokenize and store a card on the blockchain.

```typescript
const metadata = await sdk.storeCard({
  pan: '4242424242424242',
  cvv: '123',
  expiryMonth: '12',
  expiryYear: '26',
  cardholderName: 'John Doe',
  network: 'visa',
});
```

**Returns:** `TokenMetadata` object with token hash, encrypted payload, and transaction ID.

##### `retrieveCard(): Promise<TokenMetadata | null>`

Retrieve encrypted token from blockchain.

```typescript
const token = await sdk.retrieveCard();
```

##### `decryptCard(encryptedPayload: Buffer): Promise<CardData>`

Decrypt card data locally using user's key.

```typescript
const cardData = await sdk.decryptCard(Buffer.from(token.encryptedPayload));
```

##### `revokeCard(): Promise<TransactionResult>`

Revoke card token.

```typescript
const result = await sdk.revokeCard();
if (result.success) {
  console.log('Revoked:', result.txHash);
}
```

##### `getAAMode(): Promise<string>`

Get current Account Abstraction mode.

```typescript
const mode = await sdk.getAAMode();
// Returns: 'standard' | 'sponsored' | 'sessionKey' | 'multisig'
```

##### `setAAMode(mode): Promise<TransactionResult>`

Set Account Abstraction mode.

```typescript
await sdk.setAAMode('sponsored');
```

---

### CardTokenizer

Utility class for card tokenization operations.

#### Static Methods

##### `encryptCard(cardData: CardData, encryptionKey: Buffer): Promise<EncryptResult>`

Encrypt card data.

```typescript
import { CardTokenizer, RingCompatibleCrypto } from '@tychee/sdk';

const key = await RingCompatibleCrypto.deriveUserKey(secretKey);
const { encryptedPayload, tokenHash, last4Digits } = await CardTokenizer.encryptCard(cardData, key);
```

##### `decryptCard(encryptedPayload: Buffer, encryptionKey: Buffer): Promise<CardData>`

Decrypt card data.

```typescript
const cardData = await CardTokenizer.decryptCard(encryptedPayload, key);
```

##### `validateCardNumber(pan: string): boolean`

Validate card number using Luhn algorithm.

```typescript
const isValid = CardTokenizer.validateCardNumber('4242424242424242');
// Returns: true
```

##### `detectCardNetwork(pan: string): string`

Auto-detect card network from PAN.

```typescript
const network = CardTokenizer.detectCardNetwork('4242424242424242');
// Returns: 'visa'

const network2 = CardTokenizer.detectCardNetwork('5555555555554444');
// Returns: 'mastercard'
```

**Supported Networks:**
- `visa` — Cards starting with 4
- `mastercard` — Cards starting with 51-55 or 2221-2720
- `rupay` — Cards starting with 60, 6521, 6522
- `amex` — Cards starting with 34 or 37

##### `maskCardNumber(pan: string): string`

Mask card number for display.

```typescript
const masked = CardTokenizer.maskCardNumber('4242424242424242');
// Returns: '************4242'
```

---

### RingCompatibleCrypto

AES-256-GCM encryption utilities compatible with Rust's `ring` library.

#### Static Methods

##### `generateKey(): Buffer`

Generate a random 256-bit encryption key.

```typescript
import { RingCompatibleCrypto } from '@tychee/sdk';

const key = RingCompatibleCrypto.generateKey();
// Returns: 32-byte Buffer
```

##### `deriveUserKey(secretKey: string): Promise<Buffer>`

Derive encryption key from Stellar secret key.

```typescript
const key = await RingCompatibleCrypto.deriveUserKey('SXXX...');
// Returns: 32-byte Buffer (SHA-256 of secret key)
```

##### `encrypt(data: Buffer, key: Buffer): Buffer`

Encrypt data using AES-256-GCM.

```typescript
const encrypted = RingCompatibleCrypto.encrypt(
  Buffer.from('sensitive data'),
  key
);
// Returns: IV (12 bytes) + Ciphertext + Auth Tag (16 bytes)
```

##### `decrypt(encryptedData: Buffer, key: Buffer): Buffer`

Decrypt AES-256-GCM encrypted data.

```typescript
const decrypted = RingCompatibleCrypto.decrypt(encrypted, key);
```

##### `hash(data: Buffer): Buffer`

Create SHA-256 hash.

```typescript
const hash = RingCompatibleCrypto.hash(Buffer.from('data'));
// Returns: 32-byte Buffer
```

---

## Account Abstraction

Enable gasless transactions and enhanced UX.

### Enable Gas Sponsorship

```typescript
const sdk = new TycheeSDK({
  // ... base config
  useAccountAbstraction: true,
  accountAbstractionAddress: 'AA_CONTRACT_ADDRESS',
  aaMode: 'sponsored',
  gasSponsor: 'SPONSOR_PUBLIC_KEY',
});

await sdk.initialize(userSecret);

// Transactions are now gas-free for the user
await sdk.storeCard(cardData); // User doesn't pay gas!
```

### Session Keys

For temporary, limited-permission access:

```typescript
await sdk.setAAMode('sessionKey');

// Use session key for limited operations
// (Session key management handled by AA contract)
```

### Multi-Signature

Enhanced security for high-value operations:

```typescript
await sdk.setAAMode('multisig');

// Requires multiple signers for operations
// (Multi-sig configuration via AA contract)
```

---

## Security

### Encryption Architecture

| Layer | Algorithm | Key Size | Purpose |
|-------|-----------|----------|---------|
| Key Derivation | SHA-256 | 256-bit | Stellar secret → AES key |
| Symmetric Encryption | AES-GCM | 256-bit | Card data encryption |
| Authentication | Ed25519 | 256-bit | Stellar signatures |
| Hashing | SHA-256 | 256-bit | Token indexing |

### Security Best Practices

1. **Never expose secret keys** — Initialize SDK server-side or in secure contexts
2. **Validate cards before tokenization** — Use `CardTokenizer.validateCardNumber()`
3. **Handle errors gracefully** — Wrap operations in try-catch
4. **Use testnet for development** — Never test with real cards on mainnet
5. **Revoke unused tokens** — Call `revokeCard()` when tokens are no longer needed

### Data Flow

```
[User's Card] → [Client-Side Encryption] → [Stellar Blockchain]
                     ↑
            User's Wallet Key
            (never leaves client)
```

---

## Examples

### React Integration

```tsx
import { useState } from 'react';
import { TycheeSDK, CardData } from '@tychee/sdk';

function TokenizeCard() {
  const [status, setStatus] = useState('');

  const handleTokenize = async () => {
    const sdk = new TycheeSDK({
      stellarNetwork: 'testnet',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
      tokenVaultAddress: process.env.NEXT_PUBLIC_TOKEN_VAULT_ADDRESS!,
      useAccountAbstraction: false,
    });

    // Get secret key from wallet (Freighter, etc.)
    await sdk.initialize(userSecretKey);

    const cardData: CardData = {
      pan: '4242424242424242',
      cvv: '123',
      expiryMonth: '12',
      expiryYear: '26',
      cardholderName: 'Test User',
      network: 'visa',
    };

    try {
      setStatus('Tokenizing...');
      const metadata = await sdk.storeCard(cardData);
      setStatus(`Success! Token: ${metadata.tokenHash.slice(0, 16)}...`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <div>
      <button onClick={handleTokenize}>Tokenize Card</button>
      <p>{status}</p>
    </div>
  );
}
```

### Node.js Backend

```typescript
import { TycheeSDK, CardTokenizer, RingCompatibleCrypto } from '@tychee/sdk';

async function tokenizeCard(userSecretKey: string, cardData: CardData) {
  const sdk = new TycheeSDK({
    stellarNetwork: process.env.STELLAR_NETWORK as 'testnet' | 'mainnet',
    horizonUrl: process.env.HORIZON_URL!,
    sorobanRpcUrl: process.env.SOROBAN_RPC_URL!,
    tokenVaultAddress: process.env.TOKEN_VAULT_ADDRESS!,
    useAccountAbstraction: false,
  });

  await sdk.initialize(userSecretKey);

  // Validate before tokenizing
  if (!CardTokenizer.validateCardNumber(cardData.pan)) {
    throw new Error('Invalid card number');
  }

  const metadata = await sdk.storeCard(cardData);
  
  return {
    success: true,
    tokenHash: metadata.tokenHash,
    last4: metadata.last4Digits,
    network: metadata.cardNetwork,
    txId: metadata.sorobanTxId,
  };
}
```

### Validation Only (No Blockchain)

```typescript
import { CardTokenizer } from '@tychee/sdk';

// Validate card number
const isValid = CardTokenizer.validateCardNumber('4242424242424242');
console.log('Valid:', isValid); // true

// Detect network
const network = CardTokenizer.detectCardNetwork('4242424242424242');
console.log('Network:', network); // 'visa'

// Mask for display
const masked = CardTokenizer.maskCardNumber('4242424242424242');
console.log('Masked:', masked); // '************4242'
```

---

## Error Handling

```typescript
import { TycheeSDK } from '@tychee/sdk';

try {
  await sdk.storeCard(cardData);
} catch (error) {
  if (error.message.includes('Invalid card number')) {
    // Handle validation error
  } else if (error.message.includes('SDK not initialized')) {
    // Handle initialization error
  } else if (error.message.includes('Token already exists')) {
    // Handle duplicate token error
  } else {
    // Handle network/blockchain errors
    console.error('Unexpected error:', error);
  }
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `SDK not initialized` | `initialize()` not called | Call `sdk.initialize(secretKey)` first |
| `Invalid card number` | Luhn check failed | Verify card number is correct |
| `Token already exists` | User already has a token | Call `revokeCard()` first |
| `Account abstraction not enabled` | AA config missing | Set `useAccountAbstraction: true` |

---

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build the SDK
npm run build
```

### Test Cards

| Network | Card Number | CVV | Expiry |
|---------|-------------|-----|--------|
| Visa | 4242424242424242 | Any 3 digits | Any future date |
| Mastercard | 5555555555554444 | Any 3 digits | Any future date |
| Amex | 378282246310005 | Any 4 digits | Any future date |

---

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import {
  TycheeSDK,
  TycheeConfig,
  CardData,
  TokenMetadata,
  TransactionResult,
  ZKProof,
  CardTokenizer,
  RingCompatibleCrypto,
  ClientCrypto,
  VERSION,
} from '@tychee/sdk';
```

---

## Requirements

- **Node.js**: 18.0.0 or higher
- **TypeScript**: 5.0 or higher (for development)
- **Stellar SDK**: @stellar/stellar-sdk ^12.0.0

---

## Browser Support

For browser usage, ensure you have the necessary polyfills for Node.js crypto:

```typescript
// For client-side key derivation, use ClientCrypto
import { ClientCrypto } from '@tychee/sdk';

await ClientCrypto.init(); // Initialize libsodium
const key = await ClientCrypto.deriveKeyFromSeed(seed);
```

---

## License

This SDK is licensed under the [Business Source License 1.1](LICENSE).

**Change Date:** January 27, 2029  
**Change License:** Apache License 2.0

See [LICENSE](LICENSE) for full terms.

---

## Links

- [GitHub Repository](https://github.com/Tychee-Labs/tychee)
- [Documentation](https://docs.tychee.store)
- [Stellar Developer Docs](https://developers.stellar.org/)

---

## Support

- 📧 Email: ops@tychee.store
- 💬 Discord: [Tychee Community](https://discord.gg/A4vBgXda93)
- 🐦 Twitter: [@TycheeSDK](https://x.com/TycheeSDK)

---

**Built with ❤️ by Tychee Labs at Singularity 2026 by Stellar India**
