/* =====================================================
   perfil.js — Perfil do usuário e painel de proteção
   ===================================================== */

let modoRuaAppAtivo = false;

/* --- Proteção --- */
async function carregarProtecao() {
    if (!currentToken || !currentUserId) return;

    // Dispara todas as chamadas em paralelo — sem await sequencial
    const [usuarioRes, zonasRes, alertasRes] = await Promise.allSettled([
        apiGetUsuario(currentUserId, currentToken),
        apiGetZonas(currentUserId, currentToken),
        apiGetAlertas(currentUserId, currentToken)
    ]);

    // Usuário (compartilhado com carregarPerfil para evitar chamada duplicada)
    if (usuarioRes.status === 'fulfilled' && usuarioRes.value.ok) {
        const d = await usuarioRes.value.json();
        modoRuaAppAtivo = d.modoRuaAtivo;
        atualizarToggleModoRua();
        // Preenche perfil junto, sem segunda chamada ao backend
        const pNome = document.getElementById('perfil-nome');
        const pTel = document.getElementById('perfil-telefone');
        const pEmail = document.getElementById('perfil-email2');
        if (pNome) pNome.value = d.nome || '';
        if (pTel) pTel.value = d.telefone || '';
        if (pEmail) pEmail.value = d.emailSecundario || '';
    } else {
        setModoRuaText('Erro ao carregar', '#ef4444');
    }

    // Zonas
    if (zonasRes.status === 'fulfilled' && zonasRes.value.ok) {
        renderZonas(await zonasRes.value.json());
    } else {
        document.getElementById('zonas-list').innerHTML =
            zonasRes.status === 'rejected'
                ? '<p class="empty-state">Sem conexão com o servidor.</p>'
                : '<p class="empty-state">Erro ao carregar zonas.</p>';
    }

    // Alertas
    if (alertasRes.status === 'fulfilled' && alertasRes.value.ok) {
        renderAlertas(await alertasRes.value.json());
    } else {
        document.getElementById('alertas-list').innerHTML =
            alertasRes.status === 'rejected'
                ? '<p class="empty-state">Sem conexão com o servidor.</p>'
                : '<p class="empty-state">Erro ao carregar alertas.</p>';
    }
}

function setModoRuaText(texto, cor) {
    const el = document.getElementById('modo-rua-status-text');
    if (!el) return;
    el.textContent = texto;
    el.style.color = cor;
    el.style.fontSize = '12px';
    el.style.display = 'block';
}

function atualizarToggleModoRua() {
    const toggle = document.getElementById('toggle-modo-rua-app');
    if (!toggle) return;
    if (modoRuaAppAtivo) {
        toggle.classList.add('on');
        setModoRuaText('Ativo — Acesso restrito à zona segura', '#16a34a');
    } else {
        toggle.classList.remove('on');
        setModoRuaText('Inativo — Acesso liberado em qualquer local', '#6b7280');
    }
}

async function toggleModoRuaApp() {
    if (!currentToken || !currentUserId) return;

    // Validação só ao ATIVAR (estava correto), mas com feedback de erro
    if (!modoRuaAppAtivo) {
        try {
            const res = await apiGetZonas(currentUserId, currentToken);
            if (!res.ok) {
                setModoRuaText('Erro ao verificar zonas.', '#ef4444');
                return; // ← sai se não conseguir verificar
            }
            const zonas = await res.json();
            if (!zonas || zonas.length === 0) {
                showModalObrigatorio();
                return;
            }
        } catch (e) {
            setModoRuaText('Sem conexão ao verificar zonas.', '#ef4444');
            return; // ← não deixa continuar sem saber o estado
        }
    }

    try {
        const res = await apiToggleModoRua(currentUserId, currentToken);
        if (res.ok) {
            const d = await res.json();
            modoRuaAppAtivo = d.modoRuaAtivo;
            atualizarToggleModoRua();
        } else {
            setModoRuaText('Erro ao alterar o Modo Rua.', '#ef4444');
        }
    } catch (e) {
        setModoRuaText('Sem conexão com o servidor.', '#ef4444');
    }
}

function showModalObrigatorio() {
    setModoRuaText('⚠ Adicione ao menos uma zona para ativar o Modo Rua', '#CC092F');
    setTimeout(() => atualizarToggleModoRua(), 3000);
    openAddZona();
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
    // Dados já preenchidos por carregarProtecao (chamada paralela) — evita request duplicado
    if (!currentToken || !currentUserId) return;
    const pNome = document.getElementById('perfil-nome');
    if (pNome && pNome.value) return; // já foi preenchido
    try {
        const res = await apiGetUsuario(currentUserId, currentToken);
        if (res.ok) {
            const d = await res.json();
            if (pNome) pNome.value = d.nome || '';
            const pTel = document.getElementById('perfil-telefone');
            const pEmail = document.getElementById('perfil-email2');
            if (pTel) pTel.value = d.telefone || '';
            if (pEmail) pEmail.value = d.emailSecundario || '';
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