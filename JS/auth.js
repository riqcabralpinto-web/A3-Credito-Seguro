/* =====================================================
   auth.js — AuthController: cadastro, login e OTP
   ===================================================== */

class AuthController {
    constructor(api, locationSvc, ui) {
        this.api         = api;
        this.location    = locationSvc;
        this.ui          = ui;

        /* Sessão */
        this.email       = null;
        this.userId      = null;
        this.token       = null;
        this.modoRuaAtivo = true;

        /* Mapa do cadastro */
        this.registroLat    = null;
        this.registroLon    = null;
        this.registroMap    = null;
        this.registroMarker = null;
        this.registroCircle = null;

        /* Debounce busca de endereço */
        this._addressDebounce = null;
    }

    getSession() {
        return { userId: this.userId, token: this.token };
    }

    /* --- Toggle Modo Rua (tela de cadastro) --- */
    toggleModoRua() {
        this.modoRuaAtivo = !this.modoRuaAtivo;
        document.getElementById('toggle-modoRua').classList.toggle('on', this.modoRuaAtivo);
        const container = document.getElementById('registro-mapa-container');
        if (container) container.style.display = this.modoRuaAtivo ? 'block' : 'none';
    }

    /* --- Mapa do cadastro --- */
    initRegistroMap() {
        if (this.registroMap) return;

        // Usa localização real se disponível; caso contrário, centro do Brasil como fallback
        const lat = this.location.isReady() ? this.location.getLat() : -15.7801;
        const lon = this.location.isReady() ? this.location.getLon() : -47.9292;
        const zoom = this.location.isReady() ? 15 : 5;
        this.registroLat = lat;
        this.registroLon = lon;

        setTimeout(() => {
            this.registroMap = L.map('registro-map').setView([lat, lon], zoom);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(this.registroMap);

            this.registroMarker = L.marker([lat, lon], { draggable: true }).addTo(this.registroMap);
            this.registroCircle = L.circle([lat, lon], {
                radius: 500, color: '#CC092F', fillColor: '#CC092F', fillOpacity: 0.15
            }).addTo(this.registroMap);

            this._updateRegistroMapHint(lat, lon, !this.location.isReady());

            this.registroMarker.on('dragend', e => {
                const p = e.target.getLatLng();
                this.registroLat = p.lat;
                this.registroLon = p.lng;
                this.registroCircle.setLatLng(p);
                this._updateRegistroMapHint(p.lat, p.lng);
            });

            this.registroMap.on('click', e => {
                this.registroLat = e.latlng.lat;
                this.registroLon = e.latlng.lng;
                this.registroMarker.setLatLng(e.latlng);
                this.registroCircle.setLatLng(e.latlng);
                this._updateRegistroMapHint(this.registroLat, this.registroLon);
            });
        }, 150);
    }

    _updateRegistroMapHint(lat, lon, isDefault = false) {
        const el = document.getElementById('registro-map-hint');
        if (!el) return;
        if (isDefault) {
            el.textContent = '🔍 Pesquise um endereço ou use "minha localização" para posicionar o marcador';
        } else {
            el.textContent = `📍 ${lat.toFixed(5)}, ${lon.toFixed(5)} — Arraste o marcador para ajustar`;
        }
    }

    useCurrentLocation() {
        if (!this.location.isReady()) { window.app.location.retry(); return; }
        const lat = this.location.getLat();
        const lon = this.location.getLon();
        if (this.registroMap && this.registroMarker && this.registroCircle) {
            this.registroMap.setView([lat, lon], 15);
            this.registroMarker.setLatLng([lat, lon]);
            this.registroCircle.setLatLng([lat, lon]);
            this.registroLat = lat;
            this.registroLon = lon;
            this._updateRegistroMapHint(lat, lon);
        }
    }

    /* --- Busca de endereço (cadastro) --- */
    async _buscarEndereco(query) {
        const statusEl      = document.getElementById('cep-registro-status');
        const suggestionsEl = document.getElementById('registro-address-suggestions');

        if (!query || query.length < 3) {
            suggestionsEl.style.display = 'none';
            statusEl.textContent = '';
            return;
        }

        statusEl.textContent = '🔍 Buscando...';
        statusEl.style.color = '#6b7280';

        const queryNorm = query.trim().toLowerCase();
        const jaTemBrasil = queryNorm.includes('brasil');
        const partes = query.split(',').map(p => p.trim()).filter(Boolean);
        const queries = [
            query,
            ...(jaTemBrasil ? [] : [query + ', Brasil']),
            ...(partes.length > 1 ? [partes[partes.length - 1] + ', Brasil'] : [])
        ];

        try {
            let data = [];
            for (const q of queries) {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&countrycodes=br&addressdetails=1`,
                    { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } }
                );
                if (res.status === 429) {
                    statusEl.textContent = '⚠ Muitas buscas. Aguarde um momento.';
                    statusEl.style.color = '#f59e0b';
                    return;
                }
                data = await res.json();
                if (data.length) break;
                await new Promise(r => setTimeout(r, 300));
            }

            if (!data.length) {
                statusEl.textContent = '⚠ Endereço não encontrado. Tente incluir cidade ou estado.';
                statusEl.style.color = '#f59e0b';
                suggestionsEl.style.display = 'none';
                return;
            }

            statusEl.textContent = '';
            suggestionsEl.innerHTML = '';
            suggestionsEl.style.display = 'block';

            data.forEach(place => {
                const item = document.createElement('div');
                item.className = 'address-suggestion-item';
                item.style.cssText = 'padding:10px 12px;cursor:pointer;border-bottom:1px solid #f0f0f0;font-size:13px;line-height:1.4;transition:background 0.15s;';
                const principais = place.display_name.split(',').slice(0, 3).join(',').trim();
                const complemento = place.display_name.split(',').slice(3).join(',').trim();
                item.innerHTML = `<span>📍</span> <span style="font-weight:500;">${principais}</span>`
                    + (complemento ? `<br><span style="font-size:11px;color:#888;padding-left:18px;">${complemento}</span>` : '');
                item.onmouseenter = () => item.style.background = '#fff8f8';
                item.onmouseleave = () => item.style.background = '';
                item.addEventListener('mousedown', e => { e.preventDefault(); this._selecionarEndereco(place); });
                suggestionsEl.appendChild(item);
            });

        } catch {
            statusEl.textContent = '❌ Erro ao buscar endereço. Verifique sua conexão.';
            statusEl.style.color = '#ef4444';
            suggestionsEl.style.display = 'none';
        }
    }

    _selecionarEndereco(place) {
        document.getElementById('registro-endereco-input').value = place.display_name;
        document.getElementById('registro-address-suggestions').style.display = 'none';

        const lat = parseFloat(place.lat);
        const lon = parseFloat(place.lon);

        if (this.registroMap && this.registroMarker && this.registroCircle) {
            this.registroMap.setView([lat, lon], 16);
            this.registroMarker.setLatLng([lat, lon]);
            this.registroCircle.setLatLng([lat, lon]);
            this.registroLat = lat;
            this.registroLon = lon;
            this._updateRegistroMapHint(lat, lon);
        }

        const el = document.getElementById('cep-registro-status');
        el.textContent = '✅ Endereço selecionado — confirme no mapa';
        el.style.color = '#16a34a';
    }

    onEnderecoInput(input) {
        const query = input.value.trim();
        clearTimeout(this._addressDebounce);
        if (query.length < 3) {
            document.getElementById('registro-address-suggestions').style.display = 'none';
            document.getElementById('cep-registro-status').textContent = '';
            return;
        }
        this._addressDebounce = setTimeout(() => this._buscarEndereco(query), 400);
    }

    fecharSugestoes() {
        setTimeout(() => {
            const el = document.getElementById('registro-address-suggestions');
            if (el) el.style.display = 'none';
        }, 200);
    }

    /* --- Cadastro --- */
    async register() {
        const nome     = document.getElementById('reg-nome').value.trim();
        const email    = document.getElementById('reg-email').value.trim();
        const senha    = document.getElementById('reg-senha').value;
        const emailSec = document.getElementById('reg-email2').value.trim();

        this.ui.clearStatus('register-status');

        if (!nome || !email || !senha) {
            this.ui.showStatus('register-status', 400, '❌ Preencha todos os campos obrigatórios.');
            return;
        }
        if (senha.length < 6) {
            this.ui.showStatus('register-status', 400, '❌ A senha deve ter pelo menos 6 caracteres.');
            return;
        }
        if (this.modoRuaAtivo && (!this.registroLat || !this.registroLon)) {
            this.ui.showStatus('register-status', 400, '❌ Selecione uma localização no mapa para ativar o Modo Rua.');
            return;
        }

        const btn = document.getElementById('btn-register');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>Criando conta...';

        try {
            const res  = await this.api.registro({ nome, email, senha, emailSecundario: emailSec || email });
            const data = await res.json();

            if (!res.ok) {
                this.ui.showStatus('register-status', res.status, this.ui.getStatusMsg(data, res.status));
                btn.disabled = false;
                btn.textContent = 'Criar conta e ativar proteção';
                return;
            }

            this.userId = data.id;
            this.email  = email;

            if (this.modoRuaAtivo) {
                const lr = await this.api.login(email, senha, this.registroLat, this.registroLon);
                const ld = await lr.json();
                this.token  = ld.token;
                this.userId = ld.id;
                await this.api.toggleModoRua(this.userId, this.token);
                await this.api.createZona(this.userId, this.token, {
                    latitude: this.registroLat, longitude: this.registroLon,
                    raioMetros: 500, descricao: 'Zona inicial'
                });
            }

            this._resetRegistroMap();
            btn.disabled = false;
            btn.textContent = 'Criar conta e ativar proteção';
            document.getElementById('login-email').value = email;
            this.ui.simShow('sim-login');
            await this.location.request();

        } catch {
            this.ui.showStatus('register-status', 500, '❌ Erro ao conectar ao servidor. Verifique se o backend está rodando.');
            btn.disabled = false;
            btn.textContent = 'Criar conta e ativar proteção';
        }
    }

    /* --- Login --- */
    async login() {
        const email = document.getElementById('login-email').value.trim();
        const senha = document.getElementById('login-senha').value;

        this.ui.clearStatus('login-status');
        if (!email || !senha) {
            this.ui.showStatus('login-status', 400, '❌ Preencha e-mail e senha.');
            return;
        }

        const btn = document.getElementById('btn-login');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>Verificando conta...';
        this.email = email;

        try {
            // 1. Verifica se o modo rua está ativo para este e-mail antes de pedir GPS
            let contaTemModoRua = false;
            try {
                const modoRuaRes = await this.api.checkModoRua(email);
                if (modoRuaRes.ok) {
                    const modoRuaData = await modoRuaRes.json();
                    contaTemModoRua = modoRuaData?.modoRuaAtivo === true;
                } else {
                    // Endpoint retornou erro: assume modo rua ativo por segurança
                    contaTemModoRua = true;
                }
            } catch {
                // Falha de rede: assume modo rua ativo por segurança (fail-safe)
                contaTemModoRua = true;
            }

            if (contaTemModoRua) {
                // 2. Modo Rua ativo: precisa de localização
                btn.innerHTML = '<span class="spinner"></span>Verificando localização...';
                await this.location.request();

                if (!this.location.isReady()) {
                    btn.disabled = false;
                    btn.textContent = 'Entrar na minha conta';
                    this.ui.showStatus('login-status', 400,
                        '📍 Esta conta tem o Modo Rua ativado. Permita o acesso à localização e tente novamente.');
                    return;
                }
            }

            // 3. Realiza o login (com ou sem coords)
            const lat = this.location.isReady() ? this.location.getLat() : null;
            const lon = this.location.isReady() ? this.location.getLon() : null;
            const res = await this.api.login(email, senha, lat, lon);
            btn.disabled = false;
            btn.textContent = 'Entrar na minha conta';

            if (res.status === 403) {
                document.getElementById('denied-location').textContent =
                    lat ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : 'Desconhecida';
                this.ui.simShow('sim-denied');
                return;
            }

            if (res.ok) {
                const data   = await res.json();
                this.token   = data.token;
                this.userId  = data.id;
                document.getElementById('success-name').textContent     = data.nome || 'Usuário';
                document.getElementById('success-badge').textContent    = '✓ Acesso Liberado';
                document.getElementById('success-subtitle').textContent = contaTemModoRua
                    ? 'Localização verificada — Modo Rua ativo'
                    : 'Login realizado com sucesso';
                this.ui.simShow('sim-success');
                this.ui.switchTab('conta');
                await window.app.perfil.loadProtection();
                await window.app.perfil.loadProfile();
            } else {
                let data = {};
                try { data = await res.json(); } catch {}
                this.ui.showStatus('login-status', res.status, this.ui.getStatusMsg(data, res.status));
            }
        } catch {
            this.ui.showStatus('login-status', 500, '❌ Erro ao conectar ao servidor. Verifique se o backend está rodando.');
            btn.disabled = false;
            btn.textContent = 'Entrar na minha conta';
        }
    }

    /* --- OTP / Emergência --- */
    async requestOTP() {
        if (!this.email) return;
        try {
            await this.api.solicitarOTP(this.email);
            document.getElementById('otp-email-info').textContent =
                'Código enviado para o e-mail secundário. Válido por 10 minutos.';
        } catch {}
    }

    goToEmergency() {
        this.requestOTP();
        this.ui.simShow('sim-emergency');
    }

    async submitOTP() {
        const codigo = document.getElementById('otp-code').value.trim();
        this.ui.clearStatus('emergency-status');

        if (codigo.length !== 6) {
            this.ui.showStatus('emergency-status', 400, '❌ Digite exatamente 6 dígitos.');
            return;
        }

        const btn = document.getElementById('btn-otp');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>Verificando...';

        try {
            const res = await this.api.loginEmergencia(this.email, codigo);
            btn.disabled = false;
            btn.textContent = 'Verificar código';

            if (res.ok) {
                const data  = await res.json();
                this.token  = data.token;
                this.userId = data.id;
                document.getElementById('success-name').textContent     = data.nome || 'Usuário';
                document.getElementById('success-badge').textContent    = '✓ Acesso via Emergência';
                document.getElementById('success-subtitle').textContent = 'Acesso liberado via código de emergência';
                this.ui.simShow('sim-success');
                this.ui.switchTab('conta');
                await window.app.perfil.loadProtection();
                await window.app.perfil.loadProfile();
            } else {
                let data = {};
                try { data = await res.json(); } catch {}
                this.ui.showStatus('emergency-status', res.status, this.ui.getStatusMsg(data, res.status));
            }
        } catch {
            this.ui.showStatus('emergency-status', 500, '❌ Erro ao conectar ao servidor.');
            btn.disabled = false;
            btn.textContent = 'Verificar código';
        }
    }

    /* --- Helpers privados --- */
    _resetRegistroMap() {
        if (this.registroMap) { this.registroMap.remove(); this.registroMap = null; }
        this.registroMarker = null;
        this.registroCircle = null;
        this.registroLat    = null;
        this.registroLon    = null;
    }

    _showMapLocationWarning(mapContainerId, hintId) {
        const mapEl = document.getElementById(mapContainerId);
        const hint  = document.getElementById(hintId);
        if (mapEl) {
            mapEl.style.background  = '#1a1a1a';
            mapEl.style.display     = 'flex';
            mapEl.style.alignItems  = 'center';
            mapEl.style.justifyContent = 'center';
            mapEl.innerHTML = `
                <div style="text-align:center;padding:20px;">
                    <p style="font-size:14px;color:#f59e0b;margin:0 0 12px;">⚠ Localização não disponível</p>
                    <p style="font-size:12px;color:#888;margin:0 0 14px;">
                        Permita o acesso à sua localização para usar o mapa,<br>
                        ou pesquise o endereço acima.
                    </p>
                    <button onclick="window.app.location.retry()"
                        style="background:#CC092F;color:white;border:none;border-radius:8px;
                               padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;">
                        🔄 Permitir localização
                    </button>
                </div>`;
        }
        if (hint) hint.textContent = '📍 Localização não disponível — pesquise um endereço';
    }
}
