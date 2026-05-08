/* =====================================================
   ui.js — Navegação, mensagens de status e abas
   ===================================================== */

const HTTP_MSGS = {
    200: { type: 'success', text: '✅ Operação realizada com sucesso (200 OK)' },
    201: { type: 'success', text: '✅ Recurso criado com sucesso (201 Created)' },
    400: { type: 'error',   text: '❌ Dados inválidos ou incompletos (400 Bad Request)' },
    401: { type: 'error',   text: '❌ E-mail ou senha incorretos (401 Unauthorized)' },
    403: { type: 'warning', text: '⚠️ Acesso negado — você está fora da zona segura (403 Forbidden)' },
    404: { type: 'error',   text: '❌ Recurso não encontrado (404 Not Found)' },
    409: { type: 'error',   text: '❌ E-mail já cadastrado no sistema (409 Conflict)' },
    500: { type: 'error',   text: '❌ Erro interno do servidor — tente novamente (500 Internal Server Error)' },
};

/* --- Status messages --- */
function showStatus(elId, status, customMsg) {
    const el = document.getElementById(elId);
    if (!el) return;
    const preset = HTTP_MSGS[status] || { type: 'error', text: `Erro (${status})` };
    el.className = `status-msg ${preset.type}`;
    el.textContent = customMsg || preset.text;
    el.style.display = 'block';
}

function clearStatus(elId) {
    const el = document.getElementById(elId);
    if (el) el.style.display = 'none';
}

function getStatusMsg(data, status) {
    if (data && (data.erro || data.message)) return data.erro || data.message;
    const preset = HTTP_MSGS[status];
    return preset ? preset.text : `Erro HTTP ${status}`;
}

/* --- Navegação principal --- */
function showMainPage() {
    document.getElementById('main-view').classList.remove('hidden-page');
    document.getElementById('simulation-view').classList.add('hidden-page');
    window.scrollTo(0, 0);
}

function showSimulation() {
    document.getElementById('main-view').classList.add('hidden-page');
    document.getElementById('simulation-view').classList.remove('hidden-page');
    simShow('sim-intro');
    window.scrollTo(0, 0);
}

function simShow(id) {
    document.querySelectorAll('.sim-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
}

/* --- Abas do app bancário --- */
function switchTab(tab) {
    ['conta', 'protecao', 'perfil'].forEach(t => {
        document.getElementById(`tab-${t}`).classList.toggle('active', t === tab);
        document.getElementById(`panel-${t}`).style.display = t === tab ? 'block' : 'none';
    });
    if (tab === 'protecao') carregarProtecao();
    if (tab === 'perfil') carregarPerfil();
}

/* --- Animações de scroll --- */
function initScrollAnimations() {
    const observer = new IntersectionObserver(
        entries => entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('animate-fade-in');
                e.target.style.opacity = '1';
            }
        }),
        { threshold: 0.05 }
    );
    document.querySelectorAll('section').forEach(s => {
        if (s.id !== 'home') { s.style.opacity = '0'; observer.observe(s); }
    });
}