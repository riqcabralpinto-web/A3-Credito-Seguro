/* =====================================================
   main.js — App: inicialização e wiring de dependências
   Ordem de carregamento no HTML:
   1. api.js        → ApiService
   2. location.js   → LocationService
   3. ui.js         → UIService
   4. auth.js       → AuthController
   5. zonas.js      → ZonasController
   6. perfil.js     → PerfilController
   7. main.js       ← este arquivo
   ===================================================== */

/* Namespace global — acessível por qualquer módulo e pelo HTML */
window.app = {};

document.addEventListener('DOMContentLoaded', () => {
    /* --- Instâncias --- */
    app.api      = new ApiService('https://api-creditoseguro.onrender.com');
    app.location = new LocationService();
    app.ui       = new UIService();

    app.auth     = new AuthController(app.api, app.location, app.ui);

    app.zonas    = new ZonasController(
        app.api,
        app.location,
        app.ui,
        () => app.auth.getSession()
    );

    app.perfil   = new PerfilController(
        app.api,
        app.ui,
        () => app.auth.getSession(),
        () => app.zonas
    );

    /* Wiring: switchTab precisa chamar perfil */
    app.ui.onProtectionTab = () => app.perfil.loadProtection();
    app.ui.onProfileTab    = () => app.perfil.loadProfile();

    /* --- Inicialização --- */
    lucide.createIcons();
    app.ui.initScrollAnimations();
    app.location.request();
});

/* =======================================================
   Funções globais — pontes entre atributos onclick do HTML
   e os métodos das classes. Mantidas para não exigir
   alterações nos atributos onclick do index.html.
   ======================================================= */

/* Navegação */
function showMainPage()   { app.ui.showMainPage(); }
function showSimulation() { app.ui.showSimulation(); }
function simShow(id)      { app.ui.simShow(id); }
function switchTab(tab)   { app.ui.switchTab(tab); }

/* Localização */
function getLocation()    { return app.location.request(); }
function getLat()         { return app.location.getLat(); }
function getLon()         { return app.location.getLon(); }

/* Auth */
function doLogin()        { app.auth.login(); }
function doRegister()     { app.auth.register(); }
function doOTP()          { app.auth.submitOTP(); }
function requestOTP()     { app.auth.requestOTP(); }
function goToEmergency()  { app.auth.goToEmergency(); }
function toggleModoRua()  { app.auth.toggleModoRua(); }
function initRegistroMap(){ app.auth.initRegistroMap(); }
function usarLocalizacaoAtualRegistro() { app.auth.useCurrentLocation(); }
function onEnderecoRegistroInput(el)    { app.auth.onEnderecoInput(el); }
function fecharSugestoesRegistro()      { app.auth.fecharSugestoes(); }

/* Zonas */
function openAddZona()              { app.zonas.openAdd(); }
function openEditZona(id, desc, lat, lon, raio) { app.zonas.openEdit(id, desc, lat, lon, raio); }
function closeModal()               { app.zonas.closeModal(); }
function salvarZona()               { app.zonas.save(); }
function deletarZona(id)            { app.zonas.delete(id); }
function usarLocalizacaoAtual()     { app.zonas.useCurrentLocation(); }
function updateRaioLabel(val)       { app.zonas.updateRaioLabel(val); }
function updateMapCircle()          { app.zonas.updateMapCircle(); }
function onEnderecoZonaInput(el)    { app.zonas.onEnderecoInput(el); }
function fecharSugestoesZona()      { app.zonas.fecharSugestoes(); }

/* Perfil */
function salvarPerfil()             { app.perfil.saveProfile(); }
function carregarProtecao()         { app.perfil.loadProtection(); }
function carregarPerfil()           { app.perfil.loadProfile(); }
function toggleModoRuaApp()         { app.perfil.toggleModoRuaApp(); }
