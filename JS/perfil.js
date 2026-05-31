/* =====================================================
   perfil.js — PerfilController: proteção, perfil e alertas
   ===================================================== */

class PerfilController {
    constructor(api, ui, getSession, getZonas) {
        this.api        = api;
        this.ui         = ui;
        this.getSession = getSession;   // () => { userId, token }
        this.getZonas   = getZonas;     // () => ZonasController instance

        this.modoRuaAtivo = false;
    }

    /* --- Proteção --- */
    async loadProtection() {
        const { userId, token } = this.getSession();
        if (!token || !userId) return;

        const [usuarioRes, zonasRes, alertasRes] = await Promise.allSettled([
            this.api.getUsuario(userId, token),
            this.api.getZonas(userId, token),
            this.api.getAlertas(userId, token)
        ]);

        /* Usuário */
        if (usuarioRes.status === 'fulfilled' && usuarioRes.value.ok) {
            const d = await usuarioRes.value.json();
            this.modoRuaAtivo = d.modoRuaAtivo;
            this._atualizarToggle();
            /* Aproveita para preencher perfil sem segunda chamada */
            const pNome  = document.getElementById('perfil-nome');
            const pTel   = document.getElementById('perfil-telefone');
            const pEmail = document.getElementById('perfil-email2');
            if (pNome)  pNome.value  = d.nome             || '';
            if (pTel)   pTel.value   = d.telefone          || '';
            if (pEmail) pEmail.value = d.emailSecundario   || '';
        } else {
            this._setModoRuaText('Erro ao carregar', '#ef4444');
        }

        /* Zonas */
        if (zonasRes.status === 'fulfilled' && zonasRes.value.ok) {
            this.getZonas().render(await zonasRes.value.json());
        } else {
            document.getElementById('zonas-list').innerHTML =
                zonasRes.status === 'rejected'
                    ? '<p class="empty-state">Sem conexão com o servidor.</p>'
                    : '<p class="empty-state">Erro ao carregar zonas.</p>';
        }

        /* Alertas */
        if (alertasRes.status === 'fulfilled' && alertasRes.value.ok) {
            this._renderAlertas(await alertasRes.value.json());
        } else {
            document.getElementById('alertas-list').innerHTML =
                alertasRes.status === 'rejected'
                    ? '<p class="empty-state">Sem conexão com o servidor.</p>'
                    : '<p class="empty-state">Erro ao carregar alertas.</p>';
        }
    }

    /* --- Perfil --- */
    async loadProfile() {
        const { userId, token } = this.getSession();
        if (!token || !userId) return;
        const pNome = document.getElementById('perfil-nome');
        if (pNome && pNome.value) return; /* já preenchido por loadProtection */
        try {
            const res = await this.api.getUsuario(userId, token);
            if (res.ok) {
                const d  = await res.json();
                if (pNome) pNome.value = d.nome || '';
                const pTel   = document.getElementById('perfil-telefone');
                const pEmail = document.getElementById('perfil-email2');
                if (pTel)   pTel.value   = d.telefone        || '';
                if (pEmail) pEmail.value = d.emailSecundario || '';
            }
        } catch {}
    }

    async saveProfile() {
        const { userId, token } = this.getSession();
        const nome            = document.getElementById('perfil-nome').value.trim();
        const telefone        = document.getElementById('perfil-telefone').value.trim();
        const emailSecundario = document.getElementById('perfil-email2').value.trim();

        this.ui.clearStatus('perfil-status');
        try {
            const res = await this.api.updateUsuario(userId, token, { nome, telefone, emailSecundario });
            if (res.ok) {
                this.ui.showStatus('perfil-status', 200, '✅ Perfil atualizado com sucesso!');
                document.getElementById('success-name').textContent = nome;
                setTimeout(() => this.ui.clearStatus('perfil-status'), 3000);
            } else {
                let data = {};
                try { data = await res.json(); } catch {}
                this.ui.showStatus('perfil-status', res.status, this.ui.getStatusMsg(data, res.status));
            }
        } catch {
            this.ui.showStatus('perfil-status', 500, '❌ Erro ao conectar ao servidor.');
        }
    }

    /* --- Modo Rua (app) --- */
    async toggleModoRuaApp() {
        const { userId, token } = this.getSession();
        if (!token || !userId) return;

        if (!this.modoRuaAtivo) {
            try {
                const res = await this.api.getZonas(userId, token);
                if (!res.ok) { this._setModoRuaText('Erro ao verificar zonas.', '#ef4444'); return; }
                const zonas = await res.json();
                if (!zonas || !zonas.length) { this._showModalObrigatorio(); return; }
            } catch {
                this._setModoRuaText('Sem conexão ao verificar zonas.', '#ef4444');
                return;
            }
        }

        try {
            const res = await this.api.toggleModoRua(userId, token);
            if (res.ok) {
                const d = await res.json();
                this.modoRuaAtivo = d.modoRuaAtivo;
                this._atualizarToggle();
            } else {
                this._setModoRuaText('Erro ao alterar o Modo Rua.', '#ef4444');
            }
        } catch {
            this._setModoRuaText('Sem conexão com o servidor.', '#ef4444');
        }
    }

    /* --- Privados --- */
    _setModoRuaText(texto, cor) {
        const el = document.getElementById('modo-rua-status-text');
        if (!el) return;
        el.textContent   = texto;
        el.style.color   = cor;
        el.style.fontSize = '12px';
        el.style.display = 'block';
    }

    _atualizarToggle() {
        const toggle = document.getElementById('toggle-modo-rua-app');
        if (!toggle) return;
        if (this.modoRuaAtivo) {
            toggle.classList.add('on');
            this._setModoRuaText('Ativo — Acesso restrito à zona segura', '#16a34a');
        } else {
            toggle.classList.remove('on');
            this._setModoRuaText('Inativo — Acesso liberado em qualquer local', '#6b7280');
        }
    }

    _showModalObrigatorio() {
        this._setModoRuaText('⚠ Adicione ao menos uma zona para ativar o Modo Rua', '#CC092F');
        setTimeout(() => this._atualizarToggle(), 3000);
        this.getZonas().openAdd();
    }

    _renderAlertas(alertas) {
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
}
