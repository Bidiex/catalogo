/* 
 * analytics.js - Tracking events specific to TraeGo Google Analytics 4
 * Este archivo se carga en index.html y src/pages/login/index.html
 */

document.addEventListener('DOMContentLoaded', () => {
    // Helper para emitir el evento sin fallar si gtag no está definido
    const trackEvent = (eventName, eventParams) => {
        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, eventParams);
        } else {
            console.warn('Analytics: gtag() no está disponible', eventName, eventParams);
        }
    };

    /**
     * Registro de botones (CTA Clicks)
     */
    const trackingMap = [
        // 1. "Contratar Pro"
        {
            selector: '.pricing-card.featured .btn-pricing[href*="plan=pro"]',
            label: 'contratar_pro'
        },
        // 2. "Agendar demo Gratis"
        {
            selector: '.btn-demo',
            label: 'agendar_demo_gratis'
        },
        // 3a. "Comenzar Gratis" (Hero)
        {
            selector: '.btn-hero-primary',
            label: 'comenzar_gratis',
            location: 'hero'
        },
        // 3b. "Comenzar Gratis" (Pricing Plus)
        {
            selector: '.pricing-card:not(.featured) .btn-pricing',
            label: 'comenzar_gratis',
            location: 'pricing'
        },
        // 4. "Hablar con ventas"
        {
            selector: '.btn-pricing.btn-outline-gray',
            label: 'hablar_con_ventas'
        },
        // 5. "Crear mi catálogo ahora" (Sección CTA)
        {
            selector: '.btn-cta-large',
            label: 'crear_catalogo'
        },
        // 6a. "Crear cuenta" (Navbar en la landing)
        {
            selector: '.nav .btn-signup',
            label: 'crear_cuenta',
            location: 'header'
        },
        // 6b. "Crear cuenta" (Submit en el modal de registro del login)
        {
            selector: '#registerBtn',
            label: 'crear_cuenta_submit',
            location: 'login_form'
        }
    ];

    // Iterar sobre el mapa de seguimiento y añadir evento click
    trackingMap.forEach(item => {
        const elements = document.querySelectorAll(item.selector);
        elements.forEach(element => {
            element.addEventListener('click', () => {
                const eventParams = {
                    event_category: 'conversion',
                    event_label: item.label
                };
                // Agregar location si fue definido
                if (item.location) {
                    eventParams.event_location = item.location;
                }
                trackEvent('cta_click', eventParams);
            });
        });
    });

    /**
     * Registro de Visibilidad de Sección Pricing
     */
    const pricingSection = document.getElementById('pricing');
    if (pricingSection) {
        const observer = new IntersectionObserver((entries, observerInstance) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    trackEvent('view_pricing', {
                        event_category: 'engagement'
                    });
                    // Dejar de observar la sección tras el primer evento para no saturar GA4
                    observerInstance.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1 // Disparar cuando el 10% de la sección es visible en pantalla
        });

        observer.observe(pricingSection);
    }
});
