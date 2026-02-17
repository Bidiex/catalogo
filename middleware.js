export const config = {
    // Solo ejecutar middleware en rutas de catálogo
    matcher: '/c/:path*',
};

export default function middleware(request) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';

    // Lista exhaustiva de bots sociales
    const botRegex = /facebookexternalhit|whatsapp|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|pinterest|skypeuripreview|redditbot|applebot|googlebot|bingbot|yandex|baiduspider/i;

    const isBot = botRegex.test(userAgent);

    // Si es un bot y está intentando acceder a un catálogo
    if (isBot && url.pathname.startsWith('/c/')) {
        // Extraer slug
        const parts = url.pathname.split('/');
        // /c/SLUG -> ["", "c", "SLUG"]
        // Asegurarnos de obtener correctamente el slug
        const slug = parts[2];

        if (slug) {
            // Reescribir (Internal Rewrite) hacia la función serverless
            // Usamos el header x-middleware-rewrite que Vercel entiende nativamente
            const rewriteUrl = new URL(request.url);
            rewriteUrl.pathname = '/api/og';
            rewriteUrl.searchParams.set('slug', slug);

            return new Response(null, {
                headers: {
                    'x-middleware-rewrite': rewriteUrl.toString()
                }
            });
        }
    }

    // Si no es bot, dejar pasar (return undefined continúa la ejecución normal hacia vercel.json)
}
