import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const partnerId = searchParams.get('partnerId');

        let query = `
      SELECT id, name, description, price, original_price, category, partner_id, 
             image_url, location_lat, location_lng, location_address, available
      FROM products
      WHERE available = true
    `;

        const params: any[] = [];

        if (category) {
            params.push(category);
            query += ` AND category = $${params.length}`;
        }

        if (partnerId) {
            params.push(partnerId);
            query += ` AND partner_id = $${params.length}`;
        }

        query += ` ORDER BY created_at DESC LIMIT 50`;

        const result = await sql.query(query, params);

        return NextResponse.json({ products: result.rows });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { name, description, price, originalPrice, category, partnerId, locationAddress } = await request.json();

        const result = await sql`
      INSERT INTO products (name, description, price, original_price, category, partner_id, location_address, available)
      VALUES (${name}, ${description}, ${price}, ${originalPrice}, ${category}, ${partnerId}, ${locationAddress}, true)
      RETURNING id
    `;

        return NextResponse.json({ success: true, productId: result.rows[0].id });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
