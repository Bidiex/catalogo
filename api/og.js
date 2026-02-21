import { createClient } from '@supabase/supabase-js';

// Configuración para Edge Runtime
export const config = {
    runtime: 'edge',
};

// Inicializar cliente de Supabase
// Nota: Usamos process.env porque en Edge Runtime de Vercel las variables de entorno se acceden así
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const siteUrl = process.env.VITE_SITE_URL || 'https://traego.com';

export default async function handler(request) {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
        return new Response('Slug missing', { status: 400 });
    }

    // Si no hay credenciales, devolver error (fail-safe)
    if (!supabaseUrl || !supabaseKey) {
        console.error('Supabase credentials missing');
        return new Response('Internal Server Error', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // Consultar datos del negocio
        // Seleccionamos solo lo necesario para el preview en redes
        const { data: business, error } = await supabase
            .from('businesses')
            .select('name, description, banner_url, logo_url')
            .eq('slug', slug)
            .single();

        if (error || !business) {
            return generateResponse({
                title: 'Catálogo Digital - TraeGo',
                description: 'Haz tus pedidos fácil y rápido.',
                image: `${siteUrl}/hero-og.webp`, // Fallback image
                url: `${siteUrl}${url.pathname}`
            });
        }

        // Construir URLs absolutas para imágenes
        // Preferencia: Banner -> Logo -> Default
        let imageUrl = business.banner_url || business.logo_url;

        // Asegurar que la URL de la imagen sea absoluta si empieza con /
        if (imageUrl && !imageUrl.startsWith('http')) {
            // Asumimos que es relativo al proyecto local (ej. supabase storage path)
            // Si es un res.cloudinary o bucket supabase pero sin http, forzamos https://
            if (imageUrl.startsWith('//')) {
                imageUrl = `https:${imageUrl}`;
            } else if (imageUrl.startsWith('/')) {
                imageUrl = `${siteUrl}${imageUrl}`;
            } else {
                imageUrl = `${siteUrl}/${imageUrl}`;
            }
        }

        // Fallback final de imagen (imagen estática en public)
        if (!imageUrl) {
            imageUrl = `${siteUrl}/hero-og.webp`;
        }

        // Retornar HTML
        return generateResponse({
            title: `${business.name} - Catálogo Digital`,
            description: business.description || 'Mira nuestro menú y haz tu pedido por WhatsApp.',
            image: imageUrl,
            url: `${siteUrl}${url.pathname}`
        });

    } catch (err) {
        console.error('Error fetching OG data:', err);
        return new Response('Error generating preview', { status: 500 });
    }
}

function generateResponse({ title, description, image, url }) {
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="website" />
  
  <!-- Twitter Card tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${image}">
  
  <title>${escapeHtml(title)}</title>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <img src="${image}" alt="Preview" />
</body>
</html>
  `;

    return new Response(html, {
        headers: {
            'content-type': 'text/html;charset=UTF-8',
            'cache-control': 'public, max-age=60, s-maxage=60' // Cache corto para evitar stale data
        },
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
