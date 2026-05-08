/* =====================================================
   perfil.js — Perfil do usuário e painel de proteção
   ===================================================== */

let modoRuaAppAtivo = false;

/* --- Proteção --- */
async function carregarProtecao() {
    if (!currentToken || !currentUserId) return;

    // Modo Rua
    try {
        const res = await apiGetUsuario(currentUserId, currentToken);
        if (res.ok) {
            const d = await res.json();
            modoRuaAppAtivo = d.modoRuaAtivo;
            atualizarToggleModoRua();
        } else {
            document.getElementById('modo-rua-status-text').textContent = 'Erro ao carregar';
        }
    } catch (e) {
        document.getElementById('modo-rua-status-text').textContent = 'Sem conexão';
    }

    // Zonas
    try {
        const res = await apiGetZonas(currentUserId, currentToken);
        if (res.ok) { renderZonas(await res.json()); }
        else { document.getElementById('zonas-list').innerHTML = '<p class="empty-state">Erro ao carregar zonas.</p>'; }
    } catch (e) {
        document.getElementById('zonas-list').innerHTML = '<p class="empty-state">Sem conexão com o servidor.</p>';
    }

    // Alertas
    try {
        const res = await apiGetAlertas(currentUserId, currentToken);
        if (res.ok) { renderAlertas(await res.json()); }
        else { document.getElementById('alertas-list').innerHTML = '<p class="empty-state">Erro ao carregar alertas.</p>'; }
    } catch (e) {
        document.getElementById('alertas-list').innerHTML = '<p class="empty-state">Sem conexão com o servidor.</p>';
    }
}

function atualizarToggleModoRua() {
    document.getElementById('toggle-modo-rua-app').classList.toggle('on', modoRuaAppAtivo);
    document.getElementById('modo-rua-status-text').textContent = modoRuaAppAtivo
        ? 'Ativo — Acesso restrito à zona segura'
        : 'Inativo — Acesso liberado em qualquer local';
}

async function toggleModoRuaApp() {
    if (!currentToken || !currentUserId) return;
    try {
        const res = await apiToggleModoRua(currentUserId, currentToken);
        if (res.ok) {
            const d = await res.json();
            modoRuaAppAtivo = d.modoRuaAtivo;
            atualizarToggleModoRua();
        }
    } catch (e) {}
}

function renderAlertas(alertas) {
    const el = document.getElementById('alertas-list');
    if (!alertas || !alertas.length) {
        el.innerHTML = '<p class="empty-state">Nenhum alerta registrado ainda.</p>';
        return;
    }
    const icones = { ACESSO_NEGADO: '🔒', LOGIN_SUCESSO: '✅', ACESSO_EMERGENCIA: '🆘' };
    el.innerHTML = alertas.slice(0, 4).map(a => {
        const data = new Date(a.dataHora).toLocaleString('pt-BR');
        return `<div class="alerta-item">
            <span style="font-size:18px;">${icones[a.tipo] || 'ℹ'}</span>
            <div>
                <p style="margin:0;font-size:12px;color:#333;font-weight:500;">${a.mensagem}</p>
                <p style="margin:0;font-size:11px;color:#aaa;">${data}</p>
            </div>
        </div>`;
    }).join('');
}

/* --- Perfil --- */
async function carregarPerfil() {
    if (!currentToken || !currentUserId) return;
    try {
        const res = await apiGetUsuario(currentUserId, currentToken);
        if (res.ok) {
            const d = await res.json();
            document.getElementById('perfil-nome').value = d.nome || '';
            document.getElementById('perfil-telefone').value = d.telefone || '';
            document.getElementById('perfil-email2').value = d.emailSecundario || '';
        }
    } catch (e) {}
}

async function salvarPerfil() {
    const nome = document.getElementById('perfil-nome').value.trim();
    const telefone = document.getElementById('perfil-telefone').value.trim();
    const emailSecundario = document.getElementById('perfil-email2').value.trim();

    clearStatus('perfil-status');
    try {
        const res = await apiUpdateUsuario(currentUserId, currentToken, { nome, telefone, emailSecundario });
        if (res.ok) {
            showStatus('perfil-status', 200, '✅ Perfil atualizado com sucesso!');
            document.getElementById('success-name').textContent = nome;
            setTimeout(() => clearStatus('perfil-status'), 3000);
        } else {
            let data = {};
            try { data = await res.json(); } catch (e) {}
            showStatus('perfil-status', res.status, getStatusMsg(data, res.status));
        }
    } catch (e) {
        showStatus('perfil-status', 500, '❌ Erro ao conectar ao servidor.');
    }
}
