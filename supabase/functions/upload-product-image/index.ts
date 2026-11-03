import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SB_URL") || ""
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  }

  try {
    const { productId, variantId, imageFile, imageName } = await req.json()

    if (!productId || !imageFile) {
      return new Response(
        JSON.stringify({ error: "Missing productId or imageFile" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Upload to Storage
    const fileName = `${productId}/${variantId || 'main'}/${imageName || Date.now()}.webp`
    const { data, error } = await supabase.storage
      .from("product-images")
      .upload(fileName, imageFile, { upsert: true })

    if (error) throw error

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${fileName}`

    return new Response(JSON.stringify({ url: publicUrl }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    console.error("Error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    )
  }
})
