import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const partnerId = searchParams.get('partnerId');
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');

        if (!partnerId) {
            return NextResponse.json({ error: 'partnerId is required' }, { status: 400 });
        }

        // Build date filter conditions - use a far past/future date if not provided
        const effectiveDateFrom = dateFrom || '1970-01-01';
        const effectiveDateTo = dateTo || '2099-12-31';

        // Get partner analytics
        const analytics = await sql`
            SELECT date, total_transactions, total_revenue, total_commission, unique_users
            FROM partner_analytics
            WHERE partner_id = ${partnerId}
            AND date >= ${effectiveDateFrom}
            AND date <= ${effectiveDateTo}
            ORDER BY date DESC
            LIMIT 90
        `;

        // Get partner details
        const partner = await sql`
            SELECT id, name, slug, description, logo_url, category, commission_rate, active
            FROM partners
            WHERE id = ${partnerId}
        `;

        return NextResponse.json({
            partner: partner.rows[0],
            analytics: analytics.rows,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { name, slug, description, category, commissionRate, webhookUrl } = await request.json();

        // Generate API key
        const apiKey = 'tych_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        const result = await sql`
            INSERT INTO partners (name, slug, description, category, api_key, commission_rate, webhook_url, active)
            VALUES (${name}, ${slug}, ${description}, ${category}, ${apiKey}, ${commissionRate}, ${webhookUrl}, true)
            RETURNING id, api_key
        `;

        return NextResponse.json({
            success: true,
            partnerId: result.rows[0].id,
            apiKey: result.rows[0].api_key
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
