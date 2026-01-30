"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, CreditCard as CreditCardIcon, Shield, Trash2, Loader2, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

// Define CardData type inline to avoid importing from SDK at module level
interface CardData {
    pan: string;
    cvv: string;
    expiryMonth: string;
    expiryYear: string;
    cardholderName: string;
    network: 'visa' | 'mastercard' | 'rupay' | 'amex';
}


interface StoredCard {
    id: string;
    last_4_digits: string;
    card_network: string;
    status: string;
    created_at: string;
    expires_at?: string;
}

export default function CardsPage() {
    const { user, isLoading: authLoading, login, walletAddress } = useAuth();
    const [cards, setCards] = useState<StoredCard[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showAddCard, setShowAddCard] = useState(false);
    const [isTokenizing, setIsTokenizing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form state
    const [cardNumber, setCardNumber] = useState("");
    const [expiry, setExpiry] = useState("");
    const [cvv, setCvv] = useState("");
    const [cardholderName, setCardholderName] = useState("");

    // Fetch user's cards
    const fetchCards = useCallback(async () => {
        if (!user?.id) return;

        setIsLoading(true);
        try {
            const response = await fetch(`/api/cards?userId=${user.id}`);
            const data = await response.json();
            if (data.cards) {
                setCards(data.cards);
            }
        } catch (err) {
            console.error('Failed to fetch cards:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        if (user?.id) {
            fetchCards();
        }
    }, [user?.id, fetchCards]);

    // Detect card network from number
    const detectCardNetwork = (pan: string): 'visa' | 'mastercard' | 'rupay' | 'amex' => {
        const cleanPan = pan.replace(/\s/g, '');
        if (cleanPan.startsWith('4')) return 'visa';
        if (cleanPan.startsWith('5') || cleanPan.startsWith('2')) return 'mastercard';
        if (cleanPan.startsWith('34') || cleanPan.startsWith('37')) return 'amex';
        if (cleanPan.startsWith('6')) return 'rupay';
        return 'visa';
    };

    // Handle card tokenization
    const handleTokenizeCard = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id) return;

        setIsTokenizing(true);
        setError(null);
        setSuccess(null);

        try {
            const cleanPan = cardNumber.replace(/\s/g, '');
            const [expiryMonth, expiryYear] = expiry.split('/');

            const cardData: CardData = {
                pan: cleanPan,
                cvv,
                expiryMonth,
                expiryYear,
                cardholderName: cardholderName.toUpperCase(),
                network: detectCardNetwork(cleanPan)
            };

            // Tokenize using SDK (encrypts and stores on Soroban)
            const { tokenizeCard } = await import('@/lib/tychee-client');
            const tokenMetadata = await tokenizeCard(cardData);

            // Store reference in our database
            const response = await fetch('/api/cards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    tokenHash: tokenMetadata.tokenHash,
                    encryptedPayload: Buffer.from(tokenMetadata.encryptedPayload).toString('base64'),
                    last4Digits: tokenMetadata.last4Digits,
                    cardNetwork: tokenMetadata.cardNetwork,
                    sorobanTransactionId: tokenMetadata.sorobanTxId,
                    expiresAt: new Date(tokenMetadata.expiresAt).toISOString()
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to store card');
            }

            setSuccess(`Card tokenized successfully! You earned ${result.pointsEarned} points.`);
            setShowAddCard(false);
            resetForm();
            fetchCards();

        } catch (err: any) {
            console.error('Tokenization error:', err);
            setError(err.message || 'Failed to tokenize card');
        } finally {
            setIsTokenizing(false);
        }
    };

    // Revoke card
    const handleRevokeCard = async (cardId: string) => {
        if (!user?.id || !confirm('Are you sure you want to revoke this card?')) return;

        try {
            const response = await fetch(`/api/cards?cardId=${cardId}&userId=${user.id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to revoke card');
            }

            setSuccess('Card revoked successfully');
            fetchCards();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const resetForm = () => {
        setCardNumber("");
        setExpiry("");
        setCvv("");
        setCardholderName("");
    };

    // Format card number with spaces
    const formatCardNumber = (value: string) => {
        const cleaned = value.replace(/\D/g, '');
        const groups = cleaned.match(/.{1,4}/g);
        return groups ? groups.join(' ') : cleaned;
    };

    // If not logged in, show login prompt
    if (!user && !authLoading) {
        return (
            <div className="space-y-8">
                <div className="text-center py-16">
                    <CreditCardIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h2 className="text-2xl font-bold mb-4">Connect to Manage Cards</h2>
                    <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                        Create a Stellar wallet to securely tokenize your cards on the blockchain.
                    </p>
                    <button
                        onClick={login}
                        className="px-8 py-4 bg-gradient-to-r from-primary to-accent rounded-full text-white font-semibold hover:shadow-glow transition-all flex items-center gap-2 mx-auto"
                    >
                        <LogIn className="w-5 h-5" />
                        Create Wallet & Connect
                    </button>
                </div>
            </div>
        );
    }

    if (authLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold gradient-text">Cards Hub</h1>
                    <p className="text-muted-foreground mt-2">
                        Securely tokenize your cards on Stellar blockchain with RBI compliance
                    </p>
                    {walletAddress && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono">
                            Wallet: {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
                        </p>
                    )}
                </div>
                <button
                    onClick={() => setShowAddCard(true)}
                    className="px-6 py-3 bg-gradient-to-r from-primary to-accent rounded-full text-white font-medium hover:shadow-glow transition-all flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Add Card
                </button>
            </div>

            {/* Status Messages */}
            {error && (
                <div className="p-4 bg-destructive/20 border border-destructive rounded-lg text-destructive">
                    {error}
                </div>
            )}
            {success && (
                <div className="p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400">
                    {success}
                </div>
            )}

            {/* Security Banner */}
            <div className="glass-card border-accent/30">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg">Bank-Grade Security</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Your card data is encrypted with AES-256-GCM and stored on-chain. We never store actual card numbers - only tokenized references. RBI CoFT compliant.
                        </p>
                    </div>
                </div>
            </div>

            {/* Cards List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cards.map((card) => (
                        <div key={card.id} className="card-visual relative group">
                            {/* Card Network Logo */}
                            <div className="absolute top-6 right-6">
                                <div className="text-white/80 text-sm font-semibold uppercase">
                                    {card.card_network}
                                </div>
                            </div>

                            {/* Card Number */}
                            <div className="mt-12">
                                <div className="text-white/60 text-xs mb-2">CARD NUMBER</div>
                                <div className="text-white text-xl font-mono tracking-wider">
                                    **** **** **** {card.last_4_digits}
                                </div>
                            </div>

                            {/* Card Status */}
                            <div className="mt-6 flex items-center justify-between">
                                <div>
                                    <div className="text-white/60 text-xs mb-1">TOKENIZED</div>
                                    <div className="text-white font-mono text-sm">
                                        {new Date(card.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-medium ${card.status === 'active'
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-red-500/20 text-red-400'
                                    }`}>
                                    {card.status}
                                </div>
                            </div>

                            {/* Actions */}
                            {card.status === 'active' && (
                                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleRevokeCard(card.id)}
                                        className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-red-500/20 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Add New Card Placeholder */}
                    <button
                        onClick={() => setShowAddCard(true)}
                        className="premium-card min-h-[200px] flex flex-col items-center justify-center text-muted-foreground hover:text-foreground border-dashed"
                    >
                        <Plus className="w-12 h-12 mb-4" />
                        <div className="font-semibold">Add New Card</div>
                    </button>
                </div>
            )}

            {/* Add Card Modal */}
            {showAddCard && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="glass-card max-w-md w-full">
                        <h2 className="text-2xl font-bold mb-6">Add New Card</h2>

                        <form onSubmit={handleTokenizeCard} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Card Number</label>
                                <input
                                    type="text"
                                    value={cardNumber}
                                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                                    placeholder="1234 5678 9012 3456"
                                    className="w-full px-4 py-3 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                                    maxLength={19}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Expiry</label>
                                    <input
                                        type="text"
                                        value={expiry}
                                        onChange={(e) => setExpiry(e.target.value)}
                                        placeholder="MM/YY"
                                        className="w-full px-4 py-3 bg-muted border border-border rounded-lg"
                                        maxLength={5}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">CVV</label>
                                    <input
                                        type="password"
                                        value={cvv}
                                        onChange={(e) => setCvv(e.target.value)}
                                        placeholder="123"
                                        className="w-full px-4 py-3 bg-muted border border-border rounded-lg"
                                        maxLength={4}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Cardholder Name</label>
                                <input
                                    type="text"
                                    value={cardholderName}
                                    onChange={(e) => setCardholderName(e.target.value)}
                                    placeholder="JOHN DOE"
                                    className="w-full px-4 py-3 bg-muted border border-border rounded-lg"
                                    required
                                />
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddCard(false);
                                        resetForm();
                                    }}
                                    className="flex-1 px-4 py-3 bg-muted rounded-lg font-medium hover:bg-muted/80 transition-colors"
                                    disabled={isTokenizing}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isTokenizing}
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-accent rounded-lg text-white font-medium hover:shadow-glow transition-all flex items-center justify-center gap-2"
                                >
                                    {isTokenizing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Tokenizing...
                                        </>
                                    ) : (
                                        'Tokenize Card'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
