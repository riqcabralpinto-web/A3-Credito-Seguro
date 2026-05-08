/* =====================================================
   api.js — Todas as chamadas HTTP ao backend
   ===================================================== */

const API = 'http://localhost:8080';

function authHeader(token) {
    return { 'Authorization': `Bearer ${token}` };
}

function jsonHeaders(token) {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

/* --- Auth --- */
async function apiRegistro(dados) {
    return fetch(`${API}/auth/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });
}

async function apiLogin(email, senha, lat, lon) {
    return fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha, latitude: lat ?? -23.5505, longitude: lon ?? -46.6333 })
    });
}

async function apiSolicitarOTP(email) {
    return fetch(`${API}/auth/otp/solicitar?email=${encodeURIComponent(email)}`, { method: 'POST' });
}

async function apiLoginEmergencia(email, codigo) {
    return fetch(`${API}/auth/emergencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, codigo })
    });
}

/* --- Usuário --- */
async function apiGetUsuario(id, token) {
    return fetch(`${API}/usuarios/${id}`, { headers: authHeader(token) });
}

async function apiUpdateUsuario(id, token, dados) {
    return fetch(`${API}/usuarios/${id}`, {
        method: 'PUT',
        headers: jsonHeaders(token),
        body: JSON.stringify(dados)
    });
}

async function apiToggleModoRua(id, token) {
    return fetch(`${API}/usuarios/${id}/modo-rua`, {
        method: 'PATCH',
        headers: authHeader(token)
    });
}

/* --- Zonas Seguras --- */
async function apiGetZonas(usuarioId, token) {
    return fetch(`${API}/zonas-seguras/usuario/${usuarioId}`, { headers: authHeader(token) });
}

async function apiCreateZona(usuarioId, token, dados) {
    return fetch(`${API}/zonas-seguras/usuario/${usuarioId}`, {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify(dados)
    });
}

async function apiUpdateZona(zonaId, token, dados) {
    return fetch(`${API}/zonas-seguras/${zonaId}`, {
        method: 'PUT',
        headers: jsonHeaders(token),
        body: JSON.stringify(dados)
    });
}

async function apiDeleteZona(zonaId, token) {
    return fetch(`${API}/zonas-seguras/${zonaId}`, {
        method: 'DELETE',
        headers: authHeader(token)
    });
}

/* --- Alertas --- */
async function apiGetAlertas(usuarioId, token) {
    return fetch(`${API}/alertas/usuario/${usuarioId}`, { headers: authHeader(token) });
}