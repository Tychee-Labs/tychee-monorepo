import { NextResponse } from 'next/server';
import { query, queryOne, queryRows } from '@/lib/db';

/**
 * Card Token Management API
 * Handles storing, retrieving, and revoking card tokens
 */

// GET - Get user's tokenized cards
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json(
                { error: 'userId is required' },
                { status: 400 }
            );
        }

        const cards = await queryRows(
            `SELECT id, token_hash, last_4_digits, card_network, status, created_at, expires_at
             FROM card_tokens
             WHERE user_id = $1 AND status != 'revoked'
             ORDER BY created_at DESC`,
            [userId]
        );

        return NextResponse.json({ cards });
    } catch (error: any) {
        console.error('Error fetching cards:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Store new tokenized card reference
export async function POST(request: Request) {
    try {
        const {
            userId,
            tokenHash,
            encryptedPayload,
            last4Digits,
            cardNetwork,
            sorobanContractAddress,
            sorobanTransactionId,
            expiresAt
        } = await request.json();

        // Validate required fields
        if (!userId || !tokenHash || !last4Digits || !cardNetwork) {
            return NextResponse.json(
                { error: 'Missing required fields: userId, tokenHash, last4Digits, cardNetwork' },
                { status: 400 }
            );
        }

        // Convert encrypted payload to bytea format
        const payload = encryptedPayload
            ? Buffer.from(encryptedPayload, 'base64')
            : null;

        const result = await queryOne(
            `INSERT INTO card_tokens (
                user_id, token_hash, encrypted_payload, last_4_digits, card_network,
                soroban_contract_address, soroban_transaction_id, status, expires_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
            RETURNING id, token_hash, last_4_digits, card_network, status, created_at`,
            [userId, tokenHash, payload, last4Digits, cardNetwork,
                sorobanContractAddress, sorobanTransactionId, expiresAt || null]
        );

        // Log to audit trail
        await query(
            `INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata)
             VALUES ($1, 'token_create', 'card_token', $2, $3)`,
            [userId, result.id, JSON.stringify({ cardNetwork, last4Digits })]
        );

        // Award points for adding a card (50 points)
        await query(
            `INSERT INTO rewards_ledger (user_id, points, tx_type, description)
             VALUES ($1, 50, 'bonus', 'Card tokenization bonus')`,
            [userId]
        );

        await query(
            `UPDATE user_points_balance
             SET total_points = total_points + 50, updated_at = NOW()
             WHERE user_id = $1`,
            [userId]
        );

        return NextResponse.json({
            success: true,
            card: result,
            pointsEarned: 50,
            message: 'Card tokenized successfully'
        });
    } catch (error: any) {
        console.error('Error storing card:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE - Revoke card token
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const cardId = searchParams.get('cardId');
        const userId = searchParams.get('userId');

        if (!cardId || !userId) {
            return NextResponse.json(
                { error: 'cardId and userId are required' },
                { status: 400 }
            );
        }

        // Verify ownership
        const existing = await queryOne(
            'SELECT id FROM card_tokens WHERE id = $1 AND user_id = $2',
            [cardId, userId]
        );

        if (!existing) {
            return NextResponse.json(
                { error: 'Card not found or access denied' },
                { status: 404 }
            );
        }

        // Update status to revoked
        await query(
            `UPDATE card_tokens
             SET status = 'revoked', updated_at = NOW()
             WHERE id = $1`,
            [cardId]
        );

        // Log to audit trail
        await query(
            `INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata)
             VALUES ($1, 'token_revoke', 'card_token', $2, $3)`,
            [userId, cardId, JSON.stringify({})]
        );

        return NextResponse.json({
            success: true,
            message: 'Card token revoked successfully'
        });
    } catch (error: any) {
        console.error('Error revoking card:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
