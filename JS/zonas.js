/* =====================================================
   zonas.js — ZonasController: CRUD de zonas e mapa Leaflet
   ===================================================== */

class ZonasController {
    constructor(api, locationSvc, ui, getSession) {
        this.api         = api;
        this.location    = locationSvc;
        this.ui          = ui;
        this.getSession  = getSession;   // () => { userId, token }

        this.zonaMap    = null;
        this.zonaMarker = null;
        this.zonaCircle = null;
        this.selectedLat = null;
        this.selectedLon = null;

        this._addressDebounce = null;
    }

    /* --- Mapa --- */
    initMap(lat, lon) {
        if (this.zonaMap) { this.zonaMap.remove(); this.zonaMap = null; this.zonaMarker = null; this.zonaCircle = null; }
        this.selectedLat = lat;
        this.selectedLon = lon;

        setTimeout(() => {
            this.zonaMap = L.map('zona-map').setView([lat, lon], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(this.zonaMap);

            const raio = parseInt(document.getElementById('modal-zona-raio').value);
            this.zonaMarker = L.marker([lat, lon], { draggable: true }).addTo(this.zonaMap);
            this.zonaCircle = L.circle([lat, lon], {
                radius: raio, color: '#CC092F', fillColor: '#CC092F', fillOpacity: 0.15
            }).addTo(this.zonaMap);

            this._updateMapHint(lat, lon);

            this.zonaMarker.on('dragend', e => {
                const p = e.target.getLatLng();
                this.selectedLat = p.lat;
                this.selectedLon = p.lng;
                this.zonaCircle.setLatLng(p);
                this._updateMapHint(p.lat, p.lng);
            });

            this.zonaMap.on('click', e => {
                this.selectedLat = e.latlng.lat;
                this.selectedLon = e.latlng.lng;
                this.zonaMarker.setLatLng(e.latlng);
                this.zonaCircle.setLatLng(e.latlng);
                this._updateMapHint(this.selectedLat, this.selectedLon);
            });
        }, 150);
    }

    _updateMapHint(lat, lon) {
        document.getElementById('map-coords-hint').textContent =
            `📍 ${lat.toFixed(5)}, ${lon.toFixed(5)} — Arraste o marcador para ajustar`;
    }

    updateRaioLabel(val) {
        document.getElementById('raio-label').textContent =
            val >= 1000 ? `${(val / 1000).toFixed(1)}km` : `${val}m`;
    }

    updateMapCircle() {
        if (this.zonaCircle)
            this.zonaCircle.setRadius(parseInt(document.getElementById('modal-zona-raio').value));
    }

    useCurrentLocation() {
        if (!this.location.isReady()) { window.app.location.retry(); return; }
        const lat = this.location.getLat();
        const lon = this.location.getLon();
        if (this.zonaMap && this.zonaMarker && this.zonaCircle) {
            this.zonaMap.setView([lat, lon], 15);
            this.zonaMarker.setLatLng([lat, lon]);
            this.zonaCircle.setLatLng([lat, lon]);
            this.selectedLat = lat;
            this.selectedLon = lon;
            this._updateMapHint(lat, lon);
        }
    }

    /* --- Busca de endereço --- */
    async _buscarEndereco(query) {
        const statusEl      = document.getElementById('endereco-zona-status');
        const suggestionsEl = document.getElementById('endereco-zona-suggestions');

        if (!query || query.length < 3) {
            suggestionsEl.style.display = 'none';
            statusEl.textContent = '';
            return;
        }

        statusEl.textContent = '🔍 Buscando...';
        statusEl.style.color = '#6b7280';

        const queryNorm   = query.trim().toLowerCase();
        const jaTemBrasil = queryNorm.includes('brasil');
        const partes      = query.split(',').map(p => p.trim()).filter(Boolean);
        const queries     = [
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
                const principais  = place.display_name.split(',').slice(0, 3).join(',').trim();
                const complemento = place.display_name.split(',').slice(3).join(',').trim();
                item.innerHTML = `<span>📍</span> <span style="font-weight:500;">${principais}</span>`
                    + (complemento ? `<br><span style="font-size:11px;color:#888;padding-left:18px;">${complemento}</span>` : '');
                item.onmouseenter = () => item.style.background = '#f0f7ff';
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
        document.getElementById('endereco-zona-input').value = place.display_name;
        document.getElementById('endereco-zona-suggestions').style.display = 'none';

        const lat = parseFloat(place.lat);
        const lon = parseFloat(place.lon);

        if (this.zonaMap && this.zonaMarker && this.zonaCircle) {
            this.zonaMap.setView([lat, lon], 16);
            this.zonaMarker.setLatLng([lat, lon]);
            this.zonaCircle.setLatLng([lat, lon]);
            this.selectedLat = lat;
            this.selectedLon = lon;
            this._updateMapHint(lat, lon);
        }

        const el = document.getElementById('endereco-zona-status');
        el.textContent = '✅ Endereço selecionado — confirme no mapa';
        el.style.color = '#16a34a';

        const addr    = place.address || {};
        const bairro  = addr.suburb || addr.neighbourhood || addr.quarter || '';
        const cidade  = addr.city || addr.town || addr.municipality || '';
        const descInput = document.getElementById('modal-zona-desc');
        if (!descInput.value.trim() && (bairro || cidade))
            descInput.value = [bairro, cidade].filter(Boolean).join(', ');
    }

    onEnderecoInput(input) {
        const query = input.value.trim();
        clearTimeout(this._addressDebounce);
        if (query.length < 3) {
            document.getElementById('endereco-zona-suggestions').style.display = 'none';
            document.getElementById('endereco-zona-status').textContent = '';
            return;
        }
        this._addressDebounce = setTimeout(() => this._buscarEndereco(query), 400);
    }

    fecharSugestoes() {
        setTimeout(() => {
            const el = document.getElementById('endereco-zona-suggestions');
            if (el) el.style.display = 'none';
        }, 200);
    }

    /* --- Modal --- */
    openAdd() {
        document.getElementById('modal-zona-title').textContent = 'Adicionar Zona Segura';
        document.getElementById('modal-zona-id').value          = '';
        document.getElementById('modal-zona-desc').value        = '';
        document.getElementById('endereco-zona-input').value    = '';
        document.getElementById('endereco-zona-status').textContent = '';
        document.getElementById('endereco-zona-suggestions').style.display = 'none';
        document.getElementById('modal-zona-raio').value        = 500;
        this.ui.clearStatus('modal-status');
        this.updateRaioLabel(500);
        document.getElementById('modal-zona').classList.add('open');

        const lat = this.location.getLat();
        const lon = this.location.getLon();
        if (lat && lon) {
            this.initMap(lat, lon);
        } else {
            this._showMapLocationWarning();
        }
    }

    openEdit(id, desc, lat, lon, raio) {
        document.getElementById('modal-zona-title').textContent = 'Editar Zona Segura';
        document.getElementById('modal-zona-id').value          = id;
        document.getElementById('modal-zona-desc').value        = desc;
        document.getElementById('endereco-zona-input').value    = '';
        document.getElementById('endereco-zona-status').textContent = '';
        document.getElementById('endereco-zona-suggestions').style.display = 'none';
        document.getElementById('modal-zona-raio').value        = raio;
        this.ui.clearStatus('modal-status');
        this.updateRaioLabel(raio);
        document.getElementById('modal-zona').classList.add('open');
        this.initMap(lat, lon);
    }

    closeModal() {
        document.getElementById('modal-zona').classList.remove('open');
        if (this.zonaMap) { this.zonaMap.remove(); this.zonaMap = null; }
    }

    async save() {
        const id   = document.getElementById('modal-zona-id').value;
        const desc = document.getElementById('modal-zona-desc').value.trim();
        const raio = parseFloat(document.getElementById('modal-zona-raio').value);
        const { userId, token } = this.getSession();

        this.ui.clearStatus('modal-status');
        if (!desc)              { this.ui.showStatus('modal-status', 400, '❌ Informe uma descrição para a zona.'); return; }
        if (!this.selectedLat)  { this.ui.showStatus('modal-status', 400, '❌ Selecione uma localização no mapa ou pesquise um endereço.'); return; }
        if (!userId)            { this.ui.showStatus('modal-status', 401, '❌ Sessão inválida. Faça login novamente.'); return; }

        const dados = { descricao: desc, latitude: this.selectedLat, longitude: this.selectedLon, raioMetros: raio };

        try {
            const res = id
                ? await this.api.updateZona(id, token, dados)
                : await this.api.createZona(userId, token, dados);

            if (res.ok) {
                this.closeModal();
                await window.app.perfil.loadProtection();
            } else {
                let data = {};
                try { data = await res.json(); } catch {}
                this.ui.showStatus('modal-status', res.status, this.ui.getStatusMsg(data, res.status));
            }
        } catch {
            this.ui.showStatus('modal-status', 500, '❌ Erro ao conectar ao servidor.');
        }
    }

    async delete(id) {
        if (!confirm('Deseja remover esta zona segura?')) return;
        const { token } = this.getSession();
        try {
            await this.api.deleteZona(id, token);
            await window.app.perfil.loadProtection();
        } catch {}
    }

    /* --- Renderização --- */
    render(zonas) {
        const el = document.getElementById('zonas-list');
        if (!zonas || !zonas.length) {
            el.innerHTML = '<p class="empty-state">Nenhuma zona segura cadastrada.<br>Adicione uma zona para usar o Modo Rua.</p>';
            return;
        }
        el.innerHTML = zonas.map(z => `
            <div class="zona-card">
                <div>
                    <p style="font-weight:600;font-size:13px;margin:0 0 2px;color:#111;">📍 ${z.descricao || 'Zona segura'}</p>
                    <p style="font-size:11px;color:#888;margin:0;">${z.raioMetros}m de raio</p>
                </div>
                <div style="display:flex;gap:6px;">
                    <button class="zona-btn zona-btn-edit" onclick="openEditZona(${z.id},'${z.descricao}',${z.latitude},${z.longitude},${z.raioMetros})">Editar</button>
                    <button class="zona-btn zona-btn-del"  onclick="deletarZona(${z.id})">✕</button>
                </div>
            </div>`).join('');
    }

    _showMapLocationWarning() {
        const mapEl = document.getElementById('zona-map');
        if (mapEl) {
            mapEl.style.cssText += 'background:#1a1a1a;display:flex;align-items:center;justify-content:center;';
            mapEl.innerHTML = `
                <div style="text-align:center;padding:20px;">
                    <p style="font-size:14px;color:#f59e0b;margin:0 0 10px;">⚠ Localização não disponível</p>
                    <p style="font-size:12px;color:#888;margin:0 0 12px;">Pesquise um endereço acima ou permita o acesso à localização.</p>
                    <button onclick="window.app.location.retry()"
                        style="background:#CC092F;color:white;border:none;border-radius:8px;
                               padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;">
                        🔄 Permitir localização
                    </button>
                </div>`;
        }
        document.getElementById('map-coords-hint').textContent = '📍 Localização não disponível — pesquise um endereço';
    }
}
