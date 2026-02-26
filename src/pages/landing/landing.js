// Landing Page Logic

import { supabase } from '../../config/supabase.js';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

document.addEventListener('DOMContentLoaded', () => {
    // GSAP Floating Animation for Food Elements
    const foodWrappers = document.querySelectorAll('.floating-food-wrapper');

    if (foodWrappers.length > 0) {
        // 1. Floating Effect (Yoyo)
        foodWrappers.forEach((el, index) => {
            gsap.to(el, {
                y: '-=20', // Move up 20px
                duration: 2 + (index * 0.5), // Different duration for each
                yoyo: true,
                repeat: -1,
                ease: "sine.inOut",
                delay: index * 0.2 // Stagger start
            });
        });

        // 2. Scroll Effect (Scatter) on Inner Image
        // Pizza (Top Left) -> Move Up Left
        gsap.to('.food-pizza-wrapper .food-item', {
            scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 },
            x: -250, y: -150, rotation: -20, scale: 0.8, opacity: 0
        });

        // Hotdog (Top Right) -> Move Up Right
        gsap.to('.food-hotdog-wrapper .food-item', {
            scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 },
            x: 250, y: -150, rotation: 20, scale: 0.8, opacity: 0
        });

        // Tacos (Bottom Left) -> Move Down Left
        gsap.to('.food-tacos-wrapper .food-item', {
            scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 },
            x: -250, y: 150, rotation: -15, scale: 0.8, opacity: 0
        });

        // Fries (Bottom Right) -> Move Down Right
        gsap.to('.food-fries-wrapper .food-item', {
            scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 },
            x: 250, y: 150, rotation: 15, scale: 0.8, opacity: 0
        });
    }

    // Smooth Scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Animation on scroll
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('appear');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.feature-card, .pricing-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Create animation styles
    const style = document.createElement('style');
    style.innerHTML = `
      .appear {
          opacity: 1 !important;
          transform: translateY(0) !important;
      }
  `;
    document.head.appendChild(style);

    // Call loadGlobalMetrics
    loadGlobalMetrics();
});

// Load global metrics from Supabase
async function loadGlobalMetrics() {
    try {
        const businessEl = document.getElementById('metric-business');
        const productsEl = document.getElementById('metric-products');
        const ordersEl = document.getElementById('metric-orders');

        if (!businessEl || !productsEl || !ordersEl) return;

        // Fetch counts securely (ensure RLS allows count queries)
        const [businessRes, productsRes, ordersRes] = await Promise.all([
            supabase.from('businesses').select('*', { count: 'exact', head: true }),
            supabase.from('products').select('*', { count: 'exact', head: true }),
            supabase.rpc('get_completed_orders_count')
        ]);

        if (businessRes.error) console.warn("Aviso métrica negocios:", businessRes.error);
        if (productsRes.error) console.warn("Aviso métrica productos:", productsRes.error);
        if (ordersRes.error) console.warn("Aviso métrica pedidos:", ordersRes.error);

        const bCount = businessRes.count || 0;
        const pCount = productsRes.count || 0;
        const oCount = ordersRes.data || 0;

        const animateValue = (el, end, duration) => {
            if (end === 0) {
                el.textContent = "0";
                return;
            }
            let start = 0;
            const startTime = performance.now();

            const step = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                const easeOut = progress * (2 - progress);
                el.textContent = Math.floor(easeOut * end).toLocaleString('es-CO');

                if (progress < 1) {
                    requestAnimationFrame(step);
                }
            };
            requestAnimationFrame(step);
        };

        // To make it look more impressive quickly, animate it
        animateValue(businessEl, bCount, 2000);
        animateValue(productsEl, pCount, 2000);
        animateValue(ordersEl, oCount, 2000);

    } catch (error) {
        console.error("Error al cargar métricas:", error);
    }
}
