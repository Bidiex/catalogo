// Landing Page Logic

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
});
