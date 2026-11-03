import { createClient } from 'jsr:@supabase/supabase-js@2'

interface ProductData {
  name: string
  description: string
  category: string
  price: number
  is_available: boolean
  image_url?: string
  extra_data?: Record<string, unknown>
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabase = createClient(
      Deno.env.get('SB_URL') || '',
      Deno.env.get('SB_SERVICE_ROLE_KEY') || ''
    )

    const body = await req.json() as { product: ProductData; variants?: unknown[] }
    const { product, variants = [] } = body

    // Validate required fields
    if (!product.name || !product.category || product.price === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, category, price' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Insert product
    const { data: insertedProduct, error: productError } = await supabase
      .from('product_catalog_items')
      .insert([{
        name: product.name,
        description: product.description || '',
        category: product.category,
        price: product.price,
        is_available: product.is_available ?? true,
        image_url: product.image_url || null,
        extra_data: product.extra_data || null,
      }])
      .select()

    if (productError) {
      console.error('Product insert error:', productError)
      return new Response(
        JSON.stringify({ error: productError.message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!insertedProduct || insertedProduct.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Failed to insert product' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const productId = insertedProduct[0].id

    // Insert variants if provided
    if (Array.isArray(variants) && variants.length > 0) {
      const variantsToInsert = variants.map((v: unknown) => {
        const variant = v as Record<string, unknown>
        return {
          product_id: productId,
          name: variant.name || '',
          sku: variant.sku || '',
          price_modifier: variant.price_modifier || 0,
          image_url: variant.image_url || null,
          extra_data: variant.extra_data || null,
        }
      })

      const { error: variantsError } = await supabase
        .from('product_variants')
        .insert(variantsToInsert)

      if (variantsError) {
        console.error('Variants insert error:', variantsError)
        return new Response(
          JSON.stringify({
            warning: 'Product created but variants failed',
            product: insertedProduct[0],
            variantError: variantsError.message,
          }),
          { status: 207, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        product: insertedProduct[0],
        variantsCount: variants.length,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
