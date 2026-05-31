/* =====================================================
   api.js — ApiService: todas as chamadas HTTP ao backend
   ===================================================== */

class ApiService {
    constructor(baseUrl) {
        this.base = baseUrl;
    }

    _authHeader(token) {
        return { 'Authorization': `Bearer ${token}` };
    }

    _jsonHeaders(token) {
        return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
    }

    /* --- Auth --- */
    registro(dados) {
        return fetch(`${this.base}/auth/registro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
    }

    login(email, senha, lat, lon) {
        const body = { email, senha };
        if (lat !== null && lon !== null) {
            body.latitude  = lat;
            body.longitude = lon;
        }
        return fetch(`${this.base}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    }

    /* Verifica se uma conta tem Modo Rua ativo (sem autenticação) */
    checkModoRua(email) {
        return fetch(`${this.base}/auth/modo-rua?email=${encodeURIComponent(email)}`);
    }

    solicitarOTP(email) {
        return fetch(`${this.base}/auth/otp/solicitar?email=${encodeURIComponent(email)}`, { method: 'POST' });
    }

    loginEmergencia(email, codigo) {
        return fetch(`${this.base}/auth/emergencia`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, codigo })
        });
    }

    /* --- Usuário --- */
    getUsuario(id, token) {
        return fetch(`${this.base}/usuarios/${id}`, { headers: this._authHeader(token) });
    }

    updateUsuario(id, token, dados) {
        return fetch(`${this.base}/usuarios/${id}`, {
            method: 'PUT',
            headers: this._jsonHeaders(token),
            body: JSON.stringify(dados)
        });
    }

    toggleModoRua(id, token) {
        return fetch(`${this.base}/usuarios/${id}/modo-rua`, {
            method: 'PATCH',
            headers: this._authHeader(token)
        });
    }

    /* --- Zonas Seguras --- */
    getZonas(usuarioId, token) {
        return fetch(`${this.base}/zonas-seguras/usuario/${usuarioId}`, { headers: this._authHeader(token) });
    }

    createZona(usuarioId, token, dados) {
        return fetch(`${this.base}/zonas-seguras/usuario/${usuarioId}`, {
            method: 'POST',
            headers: this._jsonHeaders(token),
            body: JSON.stringify(dados)
        });
    }

    updateZona(zonaId, token, dados) {
        return fetch(`${this.base}/zonas-seguras/${zonaId}`, {
            method: 'PUT',
            headers: this._jsonHeaders(token),
            body: JSON.stringify(dados)
        });
    }

    deleteZona(zonaId, token) {
        return fetch(`${this.base}/zonas-seguras/${zonaId}`, {
            method: 'DELETE',
            headers: this._authHeader(token)
        });
    }

    /* --- Alertas --- */
    getAlertas(usuarioId, token) {
        return fetch(`${this.base}/alertas/usuario/${usuarioId}`, { headers: this._authHeader(token) });
    }
}
