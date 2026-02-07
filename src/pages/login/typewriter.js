// ============================================
// TYPEWRITER EFFECT (desktop sidebar)
// ============================================

const phrases = [
    'simple y rápido',
    'profesional',
    'sin comisiones',
    'en minutos',
    '100% personalizable'
];

const element = document.getElementById('typewriterText');
const typeSpeed = 100; // Speed associated with typing
const deleteSpeed = 50; // Speed associated with deleting
const pauseStart = 500; // Pause before typing next phrase
const pauseEnd = 2000; // Pause after typing phrase

function typeWriter(text, i, element, speed, isDeleting = false, phraseIndex = 0) {
    if (!element) return;

    // Handle typing
    if (!isDeleting && i <= text.length) {
        element.textContent = text.substring(0, i);
        i++;
        setTimeout(() => typeWriter(text, i, element, speed, false, phraseIndex), speed);
    }
    // Handle deleting
    else if (isDeleting && i >= 0) {
        element.textContent = text.substring(0, i);
        i--;
        setTimeout(() => typeWriter(text, i, element, deleteSpeed, true, phraseIndex), deleteSpeed);
    }
    // Finished typing, wait then delete
    else if (!isDeleting && i > text.length) {
        setTimeout(() => typeWriter(text, text.length, element, deleteSpeed, true, phraseIndex), pauseEnd);
    }
    // Finished deleting, move to next phrase
    else if (isDeleting && i < 0) {
        const nextPhraseIndex = (phraseIndex + 1) % phrases.length;
        const nextPhrase = phrases[nextPhraseIndex];
        setTimeout(() => typeWriter(nextPhrase, 0, element, typeSpeed, false, nextPhraseIndex), pauseStart);
    }
}

// Initialize on load
if (window.innerWidth >= 1024) {
    const startPhrase = phrases[0];
    if (element) {
        typeWriter(startPhrase, 0, element, typeSpeed);
    }
}
