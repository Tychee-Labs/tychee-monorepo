import { NextResponse } from 'next/server';
import { query, queryOne, queryRows, isConnected } from '@/lib/db';

/**
 * User Management API
 * Handles user registration with Stellar wallet binding
 */

// GET - Get user by wallet address or ID
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get('walletAddress');
        const userId = searchParams.get('userId');

        if (!walletAddress && !userId) {
            return NextResponse.json(
                { error: 'walletAddress or userId is required' },
                { status: 400 }
            );
        }

        let user;
        if (userId) {
            user = await queryOne(
                `SELECT id, wallet_address, account_abstraction_enabled, created_at, updated_at
                 FROM users WHERE id = $1`,
                [userId]
            );
        } else {
            user = await queryOne(
                `SELECT id, wallet_address, account_abstraction_enabled, created_at, updated_at
                 FROM users WHERE wallet_address = $1`,
                [walletAddress]
            );
        }

        return NextResponse.json({ user });
    } catch (error: any) {
        console.error('Error fetching user:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Register new user with wallet binding
export async function POST(request: Request) {
    try {
        const { walletAddress, enableAccountAbstraction = true } = await request.json();

        if (!walletAddress) {
            return NextResponse.json(
                { error: 'walletAddress is required' },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existing = await queryOne(
            'SELECT id FROM users WHERE wallet_address = $1',
            [walletAddress]
        );

        if (existing) {
            return NextResponse.json({
                success: true,
                userId: existing.id,
                message: 'User already exists'
            });
        }

        // Create new user
        const result = await queryOne(
            `INSERT INTO users (wallet_address, account_abstraction_enabled)
             VALUES ($1, $2)
             RETURNING id, wallet_address, account_abstraction_enabled, created_at`,
            [walletAddress, enableAccountAbstraction]
        );

        // Initialize user points balance
        await query(
            `INSERT INTO user_points_balance (user_id, total_points, tier)
             VALUES ($1, 0, 'bronze')`,
            [result.id]
        );

        return NextResponse.json({
            success: true,
            user: result,
            message: 'User registered successfully'
        });
    } catch (error: any) {
        console.error('Error creating user:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT - Update user settings
export async function PUT(request: Request) {
    try {
        const { userId, enableAccountAbstraction } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        await query(
            `UPDATE users
             SET account_abstraction_enabled = $1, updated_at = NOW()
             WHERE id = $2`,
            [enableAccountAbstraction, userId]
        );

        return NextResponse.json({ success: true, message: 'User updated successfully' });
    } catch (error: any) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
