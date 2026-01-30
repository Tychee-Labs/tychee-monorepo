# Changelog

All notable changes to the `@tychee/sdk` package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-01-30

### Added

- **TycheeSDK** - Main SDK class for card tokenization operations
  - `initialize()` - Initialize with user's Stellar secret key
  - `initializeReadOnly()` - Initialize for read-only operations
  - `storeCard()` - Tokenize and store card on Stellar blockchain
  - `retrieveCard()` - Retrieve encrypted token from blockchain
  - `decryptCard()` - Decrypt card data locally
  - `revokeCard()` - Revoke card token
  - `getAAMode()` - Get Account Abstraction mode
  - `setAAMode()` - Set Account Abstraction mode

- **RingCompatibleCrypto** - AES-256-GCM encryption utilities
  - `generateKey()` - Generate random 256-bit key
  - `encrypt()` - Encrypt data (ring-compatible format)
  - `decrypt()` - Decrypt data
  - `hash()` - SHA-256 hashing
  - `deriveUserKey()` - Derive key from Stellar secret key

- **CardTokenizer** - Card tokenization utilities
  - `encryptCard()` - Encrypt card data
  - `decryptCard()` - Decrypt card data
  - `validateCardNumber()` - Luhn algorithm validation
  - `detectCardNetwork()` - Auto-detect Visa, Mastercard, RuPay, Amex
  - `maskCardNumber()` - Mask card for display

- **ClientCrypto** - Browser-side encryption (libsodium.js)
  - `init()` - Initialize libsodium
  - `deriveKeyFromSeed()` - Argon2 key derivation
  - `sealedBoxEncrypt()` - XSalsa20-Poly1305 encryption

- **TypeScript Definitions** - Full type definitions for all exports

### Security

- User-owned encryption keys (derived from Stellar wallet)
- No server-side master keys
- AES-256-GCM authenticated encryption
- SHA-256 hashing for token indexing

### Documentation

- Comprehensive README with API reference
- Quick start guide
- Security documentation
- Example integrations (React, Node.js)
