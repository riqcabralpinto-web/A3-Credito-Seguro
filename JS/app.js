/* ============================================================
   app.js — Funções de interface: tema e visibilidade do saldo
   ============================================================ */

let isBalanceVisible = true;

/**
 * Alterna a visibilidade do saldo no painel bancário.
 */
function toggleBalanceVisibility() {
    isBalanceVisible = !isBalanceVisible;

    const balanceVal = document.getElementById('balance-value');
    const eyeIcon    = document.getElementById('balance-eye-icon');

    if (!balanceVal || !eyeIcon) return;

    if (isBalanceVisible) {
        balanceVal.textContent = 'R$ 4.827,50';
        eyeIcon.setAttribute('data-lucide', 'eye');
    } else {
        balanceVal.textContent = 'R$ ••••••';
        eyeIcon.setAttribute('data-lucide', 'eye-off');
    }

    if (window.lucide) window.lucide.createIcons();
}

/**
 * Aplica o tema claro ('light') ou escuro ('dark') ao app bancário.
 * @param {'light'|'dark'} theme
 */
function setTheme(theme) {
    const container = document.getElementById('success-container');
    if (!container) return;

    if (theme === 'dark') {
        container.classList.add('theme-dark');
    } else {
        container.classList.remove('theme-dark');
    }
}
