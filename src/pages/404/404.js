document.addEventListener('DOMContentLoaded', () => {
    const goBackBtn = document.getElementById('go-back-btn');

    if (goBackBtn) {
        goBackBtn.addEventListener('click', () => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = '/';
            }
        });
    }

    // Simple animation for entrance
    const content = document.querySelector('.content-wrapper');
    content.style.opacity = '0';
    content.style.transform = 'translateY(20px)';

    setTimeout(() => {
        content.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        content.style.opacity = '1';
        content.style.transform = 'translateY(0)';
    }, 100);
});
