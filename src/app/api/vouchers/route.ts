import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        let query = `
      SELECT id, code, title, description, discount_type, discount_value, 
             min_purchase, partner_id, soroban_voucher_id, valid_from, valid_until, used, used_at
      FROM vouchers
      WHERE valid_until > NOW()
    `;

        const params: any[] = [];

        if (userId) {
            params.push(userId);
            query += ` AND (user_id = $${params.length} OR user_id IS NULL)`;
        } else {
            query += ` AND user_id IS NULL`; // Only unclaimed vouchers
        }

        query += ` ORDER BY created_at DESC LIMIT 50`;

        const result = await sql.query(query, params);

        return NextResponse.json({ vouchers: result.rows });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const {
            code, title, description, discountType, discountValue,
            minPurchase, partnerId, sorobanVoucherId, validUntil
        } = await request.json();

        const result = await sql`
      INSERT INTO vouchers (
        code, title, description, discount_type, discount_value,
        min_purchase, partner_id, soroban_voucher_id, valid_until
      )
      VALUES (
        ${code}, ${title}, ${description}, ${discountType}, ${discountValue},
        ${minPurchase}, ${partnerId}, ${sorobanVoucherId}, ${validUntil}
      )
      RETURNING id
    `;

        return NextResponse.json({ success: true, voucherId: result.rows[0].id });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Redeem voucher (PUT/PATCH)
export async function PUT(request: Request) {
    try {
        const { voucherId, userId } = await request.json();

        await sql`
      UPDATE vouchers
      SET user_id = ${userId}, used = true, used_at = NOW()
      WHERE id = ${voucherId} AND used = false
    `;

        return NextResponse.json({ success: true, message: 'Voucher redeemed successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
