/* =====================================================
   main.js — Inicialização da aplicação
   Ordem de carregamento no site.html:
   1. api.js
   2. ui.js
   3. location.js
   4. auth.js
   5. zonas.js
   6. perfil.js
   7. main.js  ← este arquivo
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Inicializa ícones Lucide
    lucide.createIcons();

    // Inicia animações de scroll nas seções
    initScrollAnimations();

    // Captura localização do usuário ao carregar a página
    getLocation();
});
