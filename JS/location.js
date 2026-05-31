/* =====================================================
   location.js — LocationService: geolocalização e permissões
   ===================================================== */

class LocationService {
    constructor() {
        this.lat     = null;
        this.lon     = null;
        this.denied  = false;
        this._banner = null;
    }

    /* Solicita a localização ao navegador. Retorna true se obtida, false se negada. */
    request() {
        return new Promise(resolve => {
            if (!navigator.geolocation) {
                this._onDenied('Seu navegador não suporta geolocalização.');
                resolve(false);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                pos => {
                    this.lat    = pos.coords.latitude;
                    this.lon    = pos.coords.longitude;
                    this.denied = false;
                    this._hideBanner();
                    this._updateLocationUI();
                    resolve(true);
                },
                err => {
                    const msg = err.code === 1
                        ? 'Você negou o acesso à localização. Permita nas configurações do navegador e tente novamente.'
                        : 'Não foi possível obter sua localização. Verifique se o GPS está ativo.';
                    this._onDenied(msg);
                    resolve(false);
                },
                { timeout: 10000 }
            );
        });
    }

    /* Tenta solicitar a permissão novamente */
    async retry() {
        this._hideBanner();
        const granted = await this.request();
        if (!granted) return;
        /* Se o mapa de registro estiver aberto, centraliza nele */
        if (window.app?.auth?.registroMap) {
            window.app.auth.useCurrentLocation();
        }
    }

    getLat()      { return this.lat; }
    getLon()      { return this.lon; }
    isReady()     { return this.lat !== null && this.lon !== null; }

    /* --- Privados --- */
    _onDenied(mensagem) {
        this.denied = true;
        this._showBanner(mensagem);
        this._updateLocationUI(true);
    }

    _showBanner(mensagem) {
        if (!this._banner) {
            this._banner = document.createElement('div');
            this._banner.id = 'location-denied-banner';
            this._banner.style.cssText = [
                'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);',
                'background:#1a1a1a;border:1.5px solid #CC092F;border-radius:12px;',
                'padding:14px 18px;max-width:420px;width:calc(100% - 40px);',
                'display:flex;align-items:flex-start;gap:12px;z-index:9999;',
                'box-shadow:0 8px 32px rgba(0,0,0,0.5);'
            ].join('');
            document.body.appendChild(this._banner);
        }
        this._banner.innerHTML = `
            <span style="font-size:20px;flex-shrink:0;">📍</span>
            <div style="flex:1;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#ff4d4d;">
                    Localização não disponível
                </p>
                <p style="margin:0 0 10px;font-size:12px;color:#aaa;line-height:1.5;">
                    ${mensagem}
                </p>
                <button onclick="window.app.location.retry()"
                    style="background:#CC092F;color:white;border:none;border-radius:8px;
                           padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;">
                    🔄 Tentar novamente
                </button>
            </div>
            <button onclick="document.getElementById('location-denied-banner').style.display='none'"
                style="background:none;border:none;color:#555;font-size:18px;cursor:pointer;
                       line-height:1;padding:0;flex-shrink:0;">✕</button>
        `;
        this._banner.style.display = 'flex';
    }

    _hideBanner() {
        if (this._banner) this._banner.style.display = 'none';
    }

    _updateLocationUI(denied = false) {
        const statusEl = document.getElementById('location-status');
        const loginEl  = document.getElementById('login-location-info');

        if (denied) {
            if (statusEl) statusEl.textContent = '⚠ Localização não disponível';
            if (loginEl)  loginEl.innerHTML = `
                <span style="color:#f59e0b;">⚠ Localização não disponível</span>
                <button onclick="window.app.location.retry()"
                    style="display:block;margin-top:6px;background:#CC092F;color:white;border:none;
                           border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer;font-weight:600;">
                    🔄 Permitir acesso
                </button>`;
        } else {
            if (statusEl) statusEl.textContent = `📍 ${this.lat.toFixed(4)}, ${this.lon.toFixed(4)}`;
            if (loginEl)  loginEl.textContent  = `${this.lat.toFixed(4)}, ${this.lon.toFixed(4)}`;
        }
    }
}
