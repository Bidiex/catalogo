
// ============================================
// TYPEWRITER EFFECT (desktop sidebar)
// ============================================
function initTypewriter() {
    const element = document.getElementById('typewriterText')
    if (!element) return

    const phrases = [
        'simple y rápido',
        'profesional',
        'sin comisiones',
        'en minutos',
        '100% personalizable'
    ]

    let phraseIndex = 0
    let charIndex = 0
    let isDeleting = false
    let typingSpeed = 100

    function type() {
        const currentPhrase = phrases[phraseIndex]

        if (isDeleting) {
            element.textContent = currentPhrase.substring(0, charIndex)
            charIndex--
            typingSpeed = 50
        } else {
            element.textContent = currentPhrase.substring(0, charIndex)
            charIndex++
            typingSpeed = 100
        }

        // When phrase is complete
        if (!isDeleting && charIndex === currentPhrase.length) {
            typingSpeed = 2000 // Pause at end
            isDeleting = true
        }

        // When deletion is complete
        if (isDeleting && charIndex === 0) {
            isDeleting = false
            phraseIndex = (phraseIndex + 1) % phrases.length
            typingSpeed = 500 // Pause before next phrase
        }

        setTimeout(type, typingSpeed)
    }

    type()
}

// Initialize typewriter on page load
if (window.innerWidth >= 1024) {
    initTypewriter()
}
