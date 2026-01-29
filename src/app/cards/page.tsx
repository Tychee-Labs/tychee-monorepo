"use client";

import { useState } from "react";
import { Plus, CreditCard as CreditCardIcon, Shield, Eye, EyeOff, Trash2 } from "lucide-react";

interface StoredCard {
    id: string;
    last4: string;
    network: string;
    status: string;
    expiresAt: string;
}

export default function CardsPage() {
    const [cards, setCards] = useState<StoredCard[]>([
        {
            id: "1",
            last4: "4242",
            network: "visa",
            status: "active",
            expiresAt: "12/26",
        },
    ]);
    const [showAddCard, setShowAddCard] = useState(false);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold gradient-text">Cards Hub</h1>
                    <p className="text-muted-foreground mt-2">
                        Securely tokenize your cards on Stellar blockchain with RBI compliance
                    </p>
                </div>
                <button
                    onClick={() => setShowAddCard(true)}
                    className="px-6 py-3 bg-gradient-to-r from-primary to-accent rounded-full text-white font-medium hover:shadow-glow transition-all flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Add Card
                </button>
            </div>

            {/* Security Banner (Nielsen: Help & Documentation) */}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cards.map((card) => (
                    <div key={card.id} className="card-visual relative group">
                        {/* Card Network Logo */}
                        <div className="absolute top-6 right-6">
                            <div className="text-white/80 text-sm font-semibold uppercase">
                                {card.network}
                            </div>
                        </div>

                        {/* Card Number */}
                        <div className="mt-12">
                            <div className="text-white/60 text-xs mb-2">CARD NUMBER</div>
                            <div className="text-white text-xl font-mono tracking-wider">
                                **** **** **** {card.last4}
                            </div>
                        </div>

                        {/* Card Expiry */}
                        <div className="mt-6 flex items-center justify-between">
                            <div>
                                <div className="text-white/60 text-xs mb-1">EXPIRES</div>
                                <div className="text-white font-mono">{card.expiresAt}</div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-medium ${card.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                }`}>
                                {card.status}
                            </div>
                        </div>

                        {/* Actions (Nielsen: User Control) */}
                        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-red-500/20 transition-colors">
                                <Trash2 className="w-4 h-4 text-white" />
                            </button>
                        </div>
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

            {/* Add Card Modal (Nielsen: Clear Feedback) */}
            {showAddCard && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="glass-card max-w-md w-full">
                        <h2 className="text-2xl font-bold mb-6">Add New Card</h2>

                        <form className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Card Number</label>
                                <input
                                    type="text"
                                    placeholder="1234 5678 9012 3456"
                                    className="w-full px-4 py-3 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                                    maxLength={19}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Expiry</label>
                                    <input
                                        type="text"
                                        placeholder="MM/YY"
                                        className="w-full px-4 py-3 bg-muted border border-border rounded-lg"
                                        maxLength={5}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">CVV</label>
                                    <input
                                        type="password"
                                        placeholder="123"
                                        className="w-full px-4 py-3 bg-muted border border-border rounded-lg"
                                        maxLength={3}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Cardholder Name</label>
                                <input
                                    type="text"
                                    placeholder="JOHN DOE"
                                    className="w-full px-4 py-3 bg-muted border border-border rounded-lg"
                                />
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowAddCard(false)}
                                    className="flex-1 px-4 py-3 bg-muted rounded-lg font-medium hover:bg-muted/80 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-accent rounded-lg text-white font-medium hover:shadow-glow transition-all"
                                >
                                    Tokenize Card
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
