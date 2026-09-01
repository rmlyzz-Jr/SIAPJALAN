// ============================================================
// GLOBAL VARIABLES
// ============================================================
let currentUser = null;
let allData = [];
let rekapData = [];
let dashboardData = null;
let isLoggingIn = false;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let timPICData = {};
let deferredPrompt = null;
let isAppInstalled = false;
let gambarAduanFiles = [];
let editGambarTLFiles = [];
let grafikChart = null;

// ============================================================
// SPREADSHEET CONFIGURATION (Google Apps Script Backend URL)
// ============================================================
// ⚠️ GANTI DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyJv4tuZTeq3ipGjNxYv6Fg3p9ZP53h3vLWajs7w4ajB3-Hj26Bhmc4YtEdss2khkzW/exec'; 

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function formatTanggalRapi(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return days[date.getDay()] + ', ' + date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
    } catch(e) { return dateString; }
}

function toDateOnly(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0];
    } catch(e) { return ''; }
}

function formatRupiah(angka) {
    if (!angka) return '-';
    const clean = String(angka).replace(/[^0-9]/g, '');
    if (!clean) return '-';
    const number = parseInt(clean);
    if (isNaN(number)) return '-';
    return number.toLocaleString('id-ID');
}

function getStatusClass(status) {
    const map = { 
        'Baru': 'status-baru', 
        'Diproses': 'status-proses', 
        'Proses': 'status-proses',
        'Selesai': 'status-selesai', 
        'Ditolak': 'status-ditolak',
        'Ditunda': 'status-ditolak'
    };
    return map[status] || 'status-baru';
}

function getStatusText(status) {
    const map = {
        'Baru': '🟦 Baru',
        'Diproses': '🟨 Diproses',
        'Proses': '🟨 Proses',
        'Selesai': '✅ Selesai',
        'Ditolak': '❌ Ditolak',
        'Ditunda': '⏳ Ditunda'
    };
    return map[status] || status || 'Baru';
}

// ============================================================
// PWA - INSTALL APP HANDLING
// ============================================================
window.addEventListener('appinstalled', function(event) {
    isAppInstalled = true;
    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'none';
    showToast('✅ Aplikasi berhasil diinstall!', 'success');
});

window.addEventListener('beforeinstallprompt', function(event) {
    event.preventDefault();
    deferredPrompt = event;
    
    const installBanner = document.getElementById('installBanner');
    if (installBanner) {
        installBanner.style.display = 'flex';
    }
    
    if (window.matchMedia('(display-mode: standalone)').matches) {
        if (installBanner) installBanner.style.display = 'none';
        isAppInstalled = true;
    }
});

function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function(choiceResult) {
            if (choiceResult.outcome === 'accepted') {
                isAppInstalled = true;
                const banner = document.getElementById('installBanner');
                if (banner) banner.style.display = 'none';
                showToast('✅ Aplikasi berhasil diinstall!', 'success');
            } else {
                showToast('⚠️ Install dibatalkan', 'warning');
            }
            deferredPrompt = null;
        });
    } else {
        showToast('⚠️ Install tidak tersedia. Buka di Chrome untuk install.', 'warning');
    }
}

function closeInstallBanner() {
    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'none';
    localStorage.setItem('hideInstallBanner', 'true');
}

// Cek apakah banner harus disembunyikan
if (localStorage.getItem('hideInstallBanner') === 'true') {
    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'none';
}

if (window.matchMedia('(display-mode: standalone)').matches) {
    isAppInstalled = true;
    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'none';
}

// ============================================================
// SERVICE WORKER REGISTRATION
// ============================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('sw.js')
            .then(function(registration) {
                console.log('✅ ServiceWorker registered successfully');
                console.log('Scope:', registration.scope);
            })
            .catch(function(error) {
                console.log('❌ ServiceWorker registration failed:', error);
            });
    });
}

// ============================================================
// INIT
// ============================================================
window.onload = function() {
    console.log('🚀 SIAP JALAN v2.6 started');
    generateTahunOptions();
    loadStatusOptions();
    
    const savedUser = localStorage.getItem('siapjalan_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            // Cek validasi session
            showMainApp();
            return;
        } catch(e) {
            localStorage.removeItem('siapjalan_user');
        }
    }
    showLoginPage();
};

function generateTahunOptions() {
    const currentYear = new Date().getFullYear();
    const selects = ['inputTahun', 'filterRekapTahun', 'detailTahun'];
    selects.forEach(function(id) {
        const select = document.getElementById(id);
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">Pilih Tahun</option>';
        for (let y = currentYear; y >= currentYear - 10; y--) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y == currentVal) opt.selected = true;
            select.appendChild(opt);
        }
    });
}

function loadStatusOptions() {
    // Default status options
    const statusList = ['Baru', 'Diproses', 'Selesai', 'Ditolak'];
    populateStatusDropdowns(statusList);
}

function populateStatusDropdowns(statusList) {
    const selectIds = ['inputStatus', 'filterStatus', 'editStatus'];
    selectIds.forEach(function(id) {
        const select = document.getElementById(id);
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '';
        if (id === 'filterStatus') {
            const allOpt = document.createElement('option');
            allOpt.value = '';
            allOpt.textContent = 'Semua';
            select.appendChild(allOpt);
        }
        statusList.forEach(function(status) {
            const opt = document.createElement('option');
            opt.value = status;
            opt.textContent = getStatusText(status);
            if (status === currentVal) opt.selected = true;
            select.appendChild(opt);
        });
        if (!select.value && statusList.length > 0) {
            select.value = statusList[0];
        }
    });
}

// ============================================================
// SHOW/HIDE PAGES
// ============================================================
function showLoginPage() {
    const loginPage = document.getElementById('loginPage');
    const mainApp = document.getElementById('mainApp');
    if (loginPage) loginPage.style.display = 'flex';
    if (mainApp) mainApp.style.display = 'none';
    const username = document.getElementById('loginUsername');
    if (username) username.focus();
}

function showMainApp() {
    const loginPage = document.getElementById('loginPage');
    const mainApp = document.getElementById('mainApp');
    if (loginPage) loginPage.style.display = 'none';
    if (mainApp) mainApp.style.display = 'block';
    updateUserUI();
    setupAccess();
    loadTimList();
    
    if (currentUser) {
        const allowedTabs = getAllowedTabs();
        const defaultTab = allowedTabs[0] || 'tab2';
        switchTab(defaultTab);
        if (currentUser.role === 'admin') {
            generateKode();
            setDefaultDate();
        }
    }
    
    loadAduan();
    loadDashboard();
    loadUsers();
    loadRekap();
    loadTahunRekap();
    setFilterDates();
    
    if (currentUser) {
        const roleNames = { 'admin': 'Admin', 'operator': 'Operator', 'pegawai': 'Pegawai' };
        const roleName = roleNames[currentUser.role] || currentUser.role;
        let msg = 'ℹ️ Anda login sebagai ' + roleName;
        if (currentUser.role === 'operator' && currentUser.tim) {
            msg += ' - Tim: ' + currentUser.tim;
        }
        showToast(msg, 'info');
    }
}

// ============================================================
// GET ALLOWED TABS
// ============================================================
function getAllowedTabs() {
    if (!currentUser) return ['tab2'];
    switch(currentUser.role) {
        case 'admin': return ['tab1', 'tab2', 'tab3', 'tab4', 'tab5'];
        case 'operator': return ['tab2', 'tab3'];
        case 'pegawai': return ['tab2', 'tab5'];
        default: return ['tab2'];
    }
}

// ============================================================
// ACCESS CONTROL
// ============================================================
function setupAccess() {
    const isAdmin = currentUser && currentUser.role === 'admin';
    const isOperator = currentUser && currentUser.role === 'operator';
    const isPegawai = currentUser && currentUser.role === 'pegawai';
    
    const tabInput = document.querySelector('[data-tab="tab1"]');
    const tabMaster = document.getElementById('tabMaster');
    const tabDashboard = document.querySelector('[data-tab="tab3"]');
    const tabRekap = document.getElementById('tabRekap');
    
    if (isAdmin) {
        if (tabInput) { tabInput.classList.remove('hidden-tab'); tabInput.disabled = false; }
        if (tabMaster) { tabMaster.classList.remove('hidden-tab'); tabMaster.disabled = false; }
        if (tabDashboard) { tabDashboard.classList.remove('hidden-tab'); tabDashboard.disabled = false; }
        if (tabRekap) { tabRekap.classList.remove('hidden-tab'); tabRekap.disabled = false; }
    } else if (isOperator) {
        if (tabInput) { tabInput.classList.add('hidden-tab'); }
        if (tabMaster) { tabMaster.classList.add('hidden-tab'); }
        if (tabDashboard) { tabDashboard.classList.remove('hidden-tab'); tabDashboard.disabled = false; }
        if (tabRekap) { tabRekap.classList.add('hidden-tab'); }
    } else if (isPegawai) {
        if (tabInput) { tabInput.classList.add('hidden-tab'); }
        if (tabMaster) { tabMaster.classList.add('hidden-tab'); }
        if (tabDashboard) { tabDashboard.classList.add('hidden-tab'); }
        if (tabRekap) { tabRekap.classList.remove('hidden-tab'); tabRekap.disabled = false; }
    }
    
    const filterTimGroup = document.getElementById('filterTimGroup');
    if (filterTimGroup) {
        filterTimGroup.style.display = isAdmin ? 'block' : 'none';
    }
    
    const activeTab = document.querySelector('.tab-panel.active');
    if (activeTab) {
        const tabId = activeTab.id;
        const allowedTabs = getAllowedTabs();
        if (!allowedTabs.includes(tabId)) {
            switchTab(allowedTabs[0] || 'tab2');
        }
    }
}

// ============================================================
// LOGIN
// ============================================================
function doLogin() {
    if (isLoggingIn) return;
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    
    if (!username || !password) {
        showLoginError('Username dan password harus diisi!');
        return;
    }
    
    isLoggingIn = true;
    const btn = document.getElementById('loginBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    }
    document.getElementById('loginError').style.display = 'none';
    
    fetch(SCRIPT_URL + '?action=login', {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        body: JSON.stringify({ username: username, password: password }),
        headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    })
    .then(function(response) { return response.json(); })
    .then(function(result) {
        isLoggingIn = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Masuk';
        }
        if (result.success) {
            currentUser = result.data;
            localStorage.setItem('siapjalan_user', JSON.stringify(currentUser));
            showMainApp();
            showToast('✅ Login berhasil! Selamat datang ' + currentUser.user, 'success');
        } else {
            showLoginError(result.message || 'Username atau password salah!');
        }
    })
    .catch(function(error) {
        isLoggingIn = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Masuk';
        }
        showLoginError('Terjadi kesalahan: ' + error.message);
    });
}

function showLoginError(message) {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
        document.getElementById('loginErrorMessage').textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(function() { errorDiv.style.display = 'none'; }, 5000);
    }
}

// ============================================================
// LOGOUT
// ============================================================
function logout() {
    if (confirm('Yakin ingin logout?')) {
        localStorage.removeItem('siapjalan_user');
        currentUser = null;
        showLoginPage();
        showToast('👋 Logout berhasil', 'info');
    }
}

// ============================================================
// UPDATE USER UI
// ============================================================
function updateUserUI() {
    if (currentUser) {
        const usernameDisplay = document.getElementById('usernameDisplay');
        const roleDisplay = document.getElementById('roleDisplay');
        const timDisplay = document.getElementById('timDisplay');
        
        if (usernameDisplay) usernameDisplay.textContent = currentUser.user;
        if (roleDisplay) {
            const roleNames = { 'admin': 'Admin', 'operator': 'Operator', 'pegawai': 'Pegawai' };
            roleDisplay.textContent = roleNames[currentUser.role] || currentUser.role;
        }
        if (timDisplay) {
            if (currentUser.role === 'operator' && currentUser.tim) {
                timDisplay.textContent = '🏷️ ' + currentUser.tim;
                timDisplay.style.display = 'inline-block';
            } else {
                timDisplay.style.display = 'none';
            }
        }
    }
}

// ============================================================
// CALL BACKEND FUNCTION
// ============================================================
function callBackend(action, data, callback) {
    const payload = { action: action, ...data };
    if (currentUser) {
        payload.user = currentUser;
    }
    
    fetch(SCRIPT_URL + '?action=' + action, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        body: JSON.stringify(payload),
        headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    })
    .then(function(response) { return response.json(); })
    .then(callback)
    .catch(function(error) {
        console.error('Error calling backend:', error);
        showToast('❌ Error: ' + error.message, 'error');
    });
}

// ============================================================
// SWITCH TAB
// ============================================================
function switchTab(tabId) {
    const allowedTabs = getAllowedTabs();
    if (!allowedTabs.includes(tabId)) {
        showToast('⛔ Anda tidak memiliki akses ke tab ini!', 'warning');
        return;
    }
    
    document.querySelectorAll('.tab-panel').forEach(function(el) {
        el.classList.remove('active');
    });
    const targetPanel = document.getElementById(tabId);
    if (targetPanel) targetPanel.classList.add('active');
    
    document.querySelectorAll('.tab-btn').forEach(function(el) {
        el.classList.remove('active');
        if (el.dataset.tab === tabId) el.classList.add('active');
    });
    
    if (tabId === 'tab3') loadDashboard();
    if (tabId === 'tab4') loadUsers();
    if (tabId === 'tab5') { loadRekap(); loadTahunRekap(); }
    if (tabId === 'tab1' && currentUser && currentUser.role === 'admin') {
        generateKode();
        setDefaultDate();
    }
}

// ============================================================
// ENTER KEY UNTUK LOGIN
// ============================================================
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const loginPage = document.getElementById('loginPage');
        if (loginPage && loginPage.style.display !== 'none') {
            doLogin();
        }
    }
});

// ============================================================
// SWITCH INPUT (TAB 1)
// ============================================================
function switchInput(element, type) {
    document.querySelectorAll('.tab1-sidebar .sidebar-item').forEach(function(el) {
        el.classList.remove('active');
    });
    element.classList.add('active');
    
    const formAduan = document.getElementById('formAduanContainer');
    const formPekerjaan = document.getElementById('formPekerjaanContainer');
    
    if (type === 'aduan') {
        if (formAduan) formAduan.style.display = 'block';
        if (formPekerjaan) formPekerjaan.style.display = 'none';
        generateKode();
        setDefaultDate();
    } else {
        if (formAduan) formAduan.style.display = 'none';
        if (formPekerjaan) formPekerjaan.style.display = 'block';
    }
}

// ============================================================
// LOAD TIM LIST
// ============================================================
function loadTimList(selectedTim, selectedPIC) {
    callBackend('getTimPICData', {}, function(result) {
        if (!result.success) {
            console.error('Error loading tim data:', result.message);
            // Fallback default tim
            const defaultTim = ['Tim A', 'Tim B', 'Tim C'];
            timPICData = { 'Tim A': 'PIC A', 'Tim B': 'PIC B', 'Tim C': 'PIC C' };
            populateTimDropdowns(defaultTim, selectedTim);
            return;
        }
        
        const timData = result.data || [];
        timPICData = {};
        const timList = [];
        
        if (Array.isArray(timData)) {
            timData.forEach(function(item) {
                const timName = item.TIM || item.tim || '';
                const picName = item.PIC || item.pic || '';
                if (timName) {
                    timPICData[timName] = picName;
                    timList.push(timName);
                }
            });
        }
        populateTimDropdowns(timList, selectedTim);
    });
}

function populateTimDropdowns(timList, selectedTim) {
    const isAdmin = currentUser && currentUser.role === 'admin';
    const userTim = currentUser && currentUser.tim ? currentUser.tim : '';
    
    const selects = [
        { id: 'filterTim', filter: true },
        { id: 'editTim', filter: false },
        { id: 'inputUserTim', filter: false }
    ];
    
    if (isAdmin) selects.push({ id: 'inputTim', filter: false });
    
    selects.forEach(function(sel) {
        const select = document.getElementById(sel.id);
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="">' + (sel.filter ? 'Semua Tim' : 'Pilih Tim') + '</option>';
        
        let filteredTimList = timList;
        if (!isAdmin && userTim) {
            filteredTimList = timList.filter(function(tim) { return tim === userTim; });
        }
        
        filteredTimList.forEach(function(tim) {
            const opt = document.createElement('option');
            opt.value = tim;
            const pic = timPICData[tim] || '';
            opt.textContent = pic ? tim + ' - ' + pic : tim;
            if (tim === selectedTim || tim === currentVal) opt.selected = true;
            select.appendChild(opt);
        });
    });
    
    // Set PIC otomatis
    const inputTim = document.getElementById('inputTim');
    if (inputTim) {
        inputTim.onchange = function() {
            const selected = inputTim.value;
            document.getElementById('inputPIC').value = timPICData[selected] || '';
        };
        if (inputTim.value) {
            document.getElementById('inputPIC').value = timPICData[inputTim.value] || '';
        }
    }
    
    const editTim = document.getElementById('editTim');
    if (editTim) {
        editTim.onchange = function() {
            const selected = editTim.value;
            document.getElementById('editPIC').value = timPICData[selected] || '';
        };
        if (selectedTim) {
            editTim.value = selectedTim;
            document.getElementById('editPIC').value = timPICData[selectedTim] || '';
        }
    }
}

function updatePICFromTim(timSelectId, picInputId) {
    const timSelect = document.getElementById(timSelectId);
    const picInput = document.getElementById(picInputId);
    if (timSelect && picInput) {
        picInput.value = timPICData[timSelect.value] || '';
    }
}

// ============================================================
// GENERATE KODE
// ============================================================
function generateKode() {
    callBackend('generateKodeLaporan', {}, function(result) {
        const inputKode = document.getElementById('inputKode');
        if (result.success && inputKode) {
            inputKode.value = result.data;
        } else if (inputKode) {
            // Fallback generate kode lokal
            const now = new Date();
            const kode = 'ADUAN-' + now.getFullYear() + '-' + 
                         String(now.getMonth()+1).padStart(2,'0') + '-' + 
                         String(now.getDate()).padStart(2,'0') + '-' + 
                         String(Math.floor(Math.random()*1000)).padStart(3,'0');
            inputKode.value = kode;
        }
    });
}

// ============================================================
// SET DEFAULT DATE
// ============================================================
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    const inputTanggal = document.getElementById('inputTanggal');
    if (inputTanggal) inputTanggal.value = today;
}

function setFilterDates() {
    callBackend('getTanggalTerlama', {}, function(result) {
        const filterStart = document.getElementById('filterStartDate');
        if (result.success && result.data && filterStart) {
            filterStart.value = result.data;
        }
    });
}

// ============================================================
// TOGGLE TIM FIELD
// ============================================================
function toggleTimField() {
    const role = document.getElementById('inputUserRole');
    const timGroup = document.getElementById('userTimGroup');
    if (role && timGroup) {
        timGroup.style.display = role.value === 'admin' ? 'none' : 'block';
    }
}

// ============================================================
// TAB 1 - SIMPAN ADUAN
// ============================================================
function simpanAduan() {
    const data = {
        tanggal: document.getElementById('inputTanggal').value,
        kode: document.getElementById('inputKode').value,
        deskripsi: document.getElementById('inputDeskripsi').value.trim(),
        pemohon: document.getElementById('inputPemohon').value.trim(),
        lokasi: document.getElementById('inputLokasi').value.trim(),
        media: document.getElementById('inputMedia').value,
        status: document.getElementById('inputStatus').value,
        tim: document.getElementById('inputTim').value,
        pic: document.getElementById('inputPIC').value.trim(),
        jadwal: document.getElementById('inputJadwal').value,
        jenisPenanganan: document.getElementById('inputJenisPenanganan').value.trim(),
        tindakLanjut: document.getElementById('inputTindakLanjut').value.trim(),
        keterangan: document.getElementById('inputKeterangan').value.trim()
    };
    
    if (!data.deskripsi) {
        showToast('⚠️ Deskripsi harus diisi!', 'error');
        document.getElementById('inputDeskripsi').focus();
        return;
    }
    if (!data.tanggal) {
        showToast('⚠️ Tanggal harus diisi!', 'error');
        document.getElementById('inputTanggal').focus();
        return;
    }
    
    const btn = document.getElementById('btnSimpanAduan');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    }
    
    showToast('⏳ Menyimpan data...', 'info');
    callBackend('insertAduan', data, function(result) {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Simpan Aduan';
        }
        if (result.success) {
            showToast('✅ ' + result.message, 'success');
            document.getElementById('formAduan').reset();
            setDefaultDate();
            generateKode();
            loadAduan();
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    });
}

// ============================================================
// TAB 1 - SIMPAN PEKERJAAN
// ============================================================
function simpanPekerjaan() {
    const data = {
        namaPekerjaan: document.getElementById('inputNamaPekerjaan').value.trim(),
        pagu: document.getElementById('inputPagu').value.trim(),
        ppk: document.getElementById('inputPpk').value.trim(),
        pptk: document.getElementById('inputPptk').value.trim(),
        pengawas: document.getElementById('inputPengawas').value.trim(),
        admin: document.getElementById('inputAdmin').value.trim(),
        perencana: document.getElementById('inputPerencana').value.trim(),
        pejabatPengadaan: document.getElementById('inputPejabatPengadaan').value.trim(),
        tanggalAwal: document.getElementById('inputTanggalAwal').value,
        tanggalAkhir: document.getElementById('inputTanggalAkhir').value,
        nomorKontrak: document.getElementById('inputNomorKontrak').value.trim(),
        jenisPekerjaan: document.getElementById('inputJenisPekerjaan').value,
        tahun: document.getElementById('inputTahun').value,
        keterangan: document.getElementById('inputKeteranganPekerjaan').value.trim(),
        kodeRup: document.getElementById('inputKodeRup').value.trim(),
        hps: document.getElementById('inputHps').value.trim(),
        penyedia: document.getElementById('inputPenyedia').value.trim(),
        hargaTerkontrak: document.getElementById('inputHargaTerkontrak').value.trim(),
        tanggalSppbj: document.getElementById('inputTanggalSppbj').value,
        nomorSppbj: document.getElementById('inputNomorSppbj').value.trim(),
        tanggalSpk: document.getElementById('inputTanggalSpk').value,
        nomorSpk: document.getElementById('inputNomorSpk').value.trim(),
        tanggalSpmk: document.getElementById('inputTanggalSpmk').value,
        nomorSpmk: document.getElementById('inputNomorSpmk').value.trim(),
        bap: document.getElementById('inputBap').value.trim(),
        bast: document.getElementById('inputBast').value.trim()
    };
    
    if (!data.namaPekerjaan) {
        showToast('⚠️ Nama Pekerjaan harus diisi!', 'error');
        document.getElementById('inputNamaPekerjaan').focus();
        return;
    }
    if (!data.jenisPekerjaan) {
        showToast('⚠️ Jenis Pengadaan harus dipilih!', 'error');
        document.getElementById('inputJenisPekerjaan').focus();
        return;
    }
    if (!data.tahun) {
        showToast('⚠️ Tahun harus dipilih!', 'error');
        document.getElementById('inputTahun').focus();
        return;
    }
    
    showToast('⏳ Menyimpan data pekerjaan...', 'info');
    callBackend('insertPekerjaan', data, function(result) {
        if (result.success) {
            showToast('✅ ' + result.message, 'success');
            document.getElementById('formPekerjaan').reset();
            loadRekap();
            loadTahunRekap();
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    });
}

// ============================================================
// TAB 2 - LOAD ADUAN
// ============================================================
function loadAduan() {
    const loading = document.getElementById('loadingAduan');
    const tableContainer = document.getElementById('tableContainer');
    if (loading) loading.style.display = 'block';
    if (tableContainer) tableContainer.style.display = 'none';
    
    const filter = {
        startDate: document.getElementById('filterStartDate').value,
        endDate: document.getElementById('filterEndDate').value,
        status: document.getElementById('filterStatus').value,
        tim: document.getElementById('filterTim').value,
        keyword: document.getElementById('filterKeyword').value.trim()
    };
    
    callBackend('getAllLaporanWeb', { filter: filter }, function(result) {
        if (loading) loading.style.display = 'none';
        if (tableContainer) tableContainer.style.display = 'block';
        
        if (result.success) {
            allData = result.data || [];
            renderAduanTable(allData);
            const total = document.getElementById('totalAduan');
            if (total) total.textContent = allData.length;
        } else {
            showToast('❌ ' + result.message, 'error');
            allData = [];
            renderAduanTable([]);
        }
    });
}

function renderAduanTable(data) {
    const tbody = document.getElementById('tableBodyAduan');
    if (!tbody) return;
    
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" style="text-align:center;padding:40px;color:#999;"><i class="fas fa-inbox" style="font-size:40px;display:block;margin-bottom:10px;"></i>Tidak ada data</td></tr>`;
        return;
    }
    
    const isAdmin = currentUser && currentUser.role === 'admin';
    let html = '';
    data.forEach(function(item, index) {
        const statusClass = getStatusClass(item.STATUS);
        const jadwalFormatted = formatTanggalRapi(item.JADWAL);
        html += `<tr>
            <td>${index + 1}</td>
            <td>${item.TANGGAL || '-'}</td>
            <td><span class="clickable-name" onclick="showDetailAduan('${item['KODE LAPORAN'] || ''}')">${item['KODE LAPORAN'] || '-'}</span></td>
            <td><span class="text-truncate" title="${item.DESKRIPSI || ''}">${item.DESKRIPSI || '-'}</span></td>
            <td>${item.PEMOHON || '-'}</td>
            <td><span class="text-truncate" title="${item['DETAIL LOKASI'] || ''}">${item['DETAIL LOKASI'] || '-'}</span></td>
            <td><span class="status-badge ${statusClass}">${item.STATUS || 'Baru'}</span></td>
            <td>${item.PIC || '-'}</td>
            <td>${jadwalFormatted}</td>
            <td><span class="text-truncate" title="${item['TINDAK LANJUT'] || ''}">${item['TINDAK LANJUT'] || '-'}</span></td>
            <td><span class="text-truncate" title="${item.KETERANGAN || ''}">${item.KETERANGAN || '-'}</span></td>
            <td>
                <button class="btn btn-primary btn-xs" onclick="showEditModal('${item['KODE LAPORAN'] || ''}')" title="Edit"><i class="fas fa-edit"></i></button>
                ${isAdmin ? `<button class="btn btn-danger btn-xs" onclick="hapusAduan('${item['KODE LAPORAN'] || ''}')" title="Hapus"><i class="fas fa-trash"></i></button>` : ''}
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

// ============================================================
// TAB 2 - SHOW DETAIL ADUAN
// ============================================================
function showDetailAduan(kodeLaporan) {
    const item = allData.find(function(d) { return d['KODE LAPORAN'] === kodeLaporan; });
    if (!item) { 
        showToast('❌ Data tidak ditemukan!', 'error'); 
        return;
    }
    
    const container = document.getElementById('detailAduanContent');
    if (!container) return;
    
    const statusClass = getStatusClass(item.STATUS);
    const jadwalFormatted = formatTanggalRapi(item.JADWAL);
    
    let html = `<div class="modal-detail-aduan">
        <div class="detail-header">
            <div class="kode"><i class="fas fa-ticket-alt" style="color:var(--gold);margin-right:10px;"></i>${item['KODE LAPORAN'] || '-'}</div>
            <div class="tanggal"><i class="far fa-calendar-alt" style="margin-right:5px;"></i>${item.TANGGAL || '-'}</div>
        </div>
        <div class="detail-row"><div class="detail-label">Deskripsi</div><div class="detail-value">${item.DESKRIPSI || '-'}</div></div>
        <div class="detail-row"><div class="detail-label">Status</div><div class="detail-value"><span class="status-badge ${statusClass}">${item.STATUS || 'Baru'}</span></div></div>
        <div class="detail-row"><div class="detail-label">Pemohon</div><div class="detail-value">${item.PEMOHON || '-'}</div></div>
        <div class="detail-row"><div class="detail-label">Lokasi</div><div class="detail-value">${item['DETAIL LOKASI'] || '-'}</div></div>
        <div class="detail-row"><div class="detail-label">Asal Media</div><div class="detail-value">${item['ASAL MEDIA'] || '-'}</div></div>
        <div class="detail-row"><div class="detail-label">Tim</div><div class="detail-value">${item.TIM || '-'}</div></div>
        <div class="detail-row"><div class="detail-label">PIC</div><div class="detail-value">${item.PIC || '-'}</div></div>
        <div class="detail-row"><div class="detail-label">Jadwal</div><div class="detail-value">${jadwalFormatted}</div></div>
        <div class="detail-row"><div class="detail-label">Tindak Lanjut</div><div class="detail-value">${item['TINDAK LANJUT'] || '-'}</div></div>
        <div class="detail-row"><div class="detail-label">Keterangan</div><div class="detail-value">${item.KETERANGAN || '-'}</div></div>
        <div class="detail-row"><div class="detail-label">Gambar</div><div class="detail-value">${renderGambarDetail(item)}</div></div>
    </div>`;
    container.innerHTML = html;
    document.getElementById('modalDetailAduan').style.display = 'block';
}

function renderGambarDetail(item) {
    const gambarUrl = item.GAMBAR_URL || item.GAMBAR || '';
    if (!gambarUrl) {
        return '<div class="no-image"><i class="fas fa-image"></i> Tidak ada gambar</div>';
    }
    const urls = gambarUrl.split('|');
    let html = '<div style="display:flex;flex-wrap:wrap;gap:10px;">';
    urls.forEach(function(url, i) {
        if (url.trim()) {
            html += `<a href="${url.trim()}" target="_blank" style="border:2px solid var(--gold);border-radius:8px;padding:5px;display:inline-block;">
                <img src="${url.trim()}" style="max-width:150px;max-height:100px;object-fit:contain;border-radius:4px;" alt="Gambar ${i+1}">
            </a>`;
        }
    });
    html += '</div>';
    return html;
}

// ============================================================
// TAB 2 - EDIT ADUAN
// ============================================================
function showEditModal(kodeLaporan) {
    const item = allData.find(function(d) { return d['KODE LAPORAN'] === kodeLaporan; });
    if (!item) { showToast('❌ Data tidak ditemukan!', 'error'); return; }
    
    document.getElementById('editKodeLaporan').value = kodeLaporan;
    document.getElementById('editKode').value = kodeLaporan;
    document.getElementById('editTanggal').value = formatTanggalRapi(item.TANGGAL);
    document.getElementById('editDeskripsi').value = item.DESKRIPSI || '';
    document.getElementById('editPemohon').value = item.PEMOHON || '';
    document.getElementById('editLokasi').value = item['DETAIL LOKASI'] || '';
    document.getElementById('editMedia').value = item['ASAL MEDIA'] || '';
    document.getElementById('editJenisPenanganan').value = item['JENIS PENANGANAN'] || '';
    document.getElementById('editTindakLanjut').value = item['TINDAK LANJUT'] || '';
    document.getElementById('editKeterangan').value = item.KETERANGAN || '';
    document.getElementById('editJadwal').value = toDateOnly(item.JADWAL) || '';
    
    const statusSelect = document.getElementById('editStatus');
    if (statusSelect && item.STATUS) {
        statusSelect.value = item.STATUS;
    }
    
    // Render gambar
    const gambarContainer = document.getElementById('editGambarContainer');
    if (gambarContainer) {
        const gambarUrl = item.GAMBAR_URL || item.GAMBAR || '';
        if (!gambarUrl) {
            gambarContainer.innerHTML = '<div class="no-image"><i class="fas fa-image"></i> Tidak ada gambar</div>';
        } else {
            const urls = gambarUrl.split('|');
            let html = '<div style="display:flex;flex-wrap:wrap;gap:10px;">';
            urls.forEach(function(url, i) {
                if (url.trim()) {
                    html += `<div class="gambar-item"><img src="${url.trim()}" style="max-width:150px;max-height:120px;object-fit:contain;border-radius:4px;" alt="Gambar ${i+1}"><div class="gambar-label">📸 Gambar ${i+1}</div></div>`;
                }
            });
            html += '</div>';
            gambarContainer.innerHTML = html;
        }
    }
    
    const selectedTim = item.TIM || '';
    const selectedPIC = item.PIC || '';
    loadTimList(selectedTim, selectedPIC);
    
    setTimeout(function() {
        const editPIC = document.getElementById('editPIC');
        if (editPIC) editPIC.value = selectedPIC;
    }, 100);
    
    document.getElementById('modalEditAduan').style.display = 'block';
}

function updateAduan() {
    const data = {
        kodeLaporan: document.getElementById('editKodeLaporan').value,
        JADWAL: document.getElementById('editJadwal').value,
        'TINDAK LANJUT': document.getElementById('editTindakLanjut').value.trim(),
        KETERANGAN: document.getElementById('editKeterangan').value.trim(),
        STATUS: document.getElementById('editStatus').value,
        TIM: document.getElementById('editTim').value,
        PIC: document.getElementById('editPIC').value.trim(),
        'JENIS PENANGANAN': document.getElementById('editJenisPenanganan').value.trim()
    };
    
    const btn = document.getElementById('btnUpdateAduan');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengupdate...';
    }
    
    showToast('⏳ Mengupdate data...', 'info');
    callBackend('updateLaporanWeb', data, function(result) {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Update';
        }
        if (result.success) {
            showToast('✅ ' + result.message, 'success');
            closeModal('modalEditAduan');
            loadAduan();
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    });
}

// ============================================================
// TAB 2 - HAPUS ADUAN
// ============================================================
function hapusAduan(kodeLaporan) {
    if (!confirm('⚠️ Yakin ingin menghapus laporan ' + kodeLaporan + '?')) return;
    showToast('⏳ Menghapus data...', 'info');
    callBackend('deleteLaporanWeb', { kodeLaporan: kodeLaporan }, function(result) {
        if (result.success) {
            showToast('✅ ' + result.message, 'success');
            loadAduan();
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    });
}

// ============================================================
// TAB 2 - FILTER
// ============================================================
function resetFilter() {
    const filterStart = document.getElementById('filterStartDate');
    const filterEnd = document.getElementById('filterEndDate');
    const filterStatus = document.getElementById('filterStatus');
    const filterTim = document.getElementById('filterTim');
    const filterKeyword = document.getElementById('filterKeyword');
    
    if (filterStart) filterStart.value = '';
    if (filterEnd) filterEnd.value = '';
    if (filterStatus) filterStatus.value = '';
    if (filterTim) filterTim.value = '';
    if (filterKeyword) filterKeyword.value = '';
    setFilterDates();
    loadAduan();
}

function refreshData() {
    showToast('🔄 Memuat ulang data...', 'info');
    loadAduan();
}

// ============================================================
// TAB 2 - EXPORT
// ============================================================
function exportData() {
    if (!allData || allData.length === 0) {
        showToast('⚠️ Tidak ada data untuk diexport!', 'warning');
        return;
    }
    
    const headers = ['TANGGAL', 'KODE LAPORAN', 'DESKRIPSI', 'PEMOHON', 'DETAIL LOKASI', 'ASAL MEDIA', 'STATUS', 'TIM', 'PIC', 'JADWAL', 'TINDAK LANJUT', 'KETERANGAN'];
    let csv = '\uFEFF' + headers.join(',') + '\n';
    
    allData.forEach(function(item) {
        const row = headers.map(function(h) {
            let val = item[h] || '';
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                return '"' + val.replace(/"/g, '""') + '"';
            }
            return val;
        });
        csv += row.join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Laporan_Aduan_BINAMARGA_' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('✅ Ekspor berhasil!', 'success');
}

// ============================================================
// TAB 3 - DASHBOARD
// ============================================================
function loadDashboard() {
    callBackend('getDashboardData', {}, function(result) {
        if (result.success) {
            dashboardData = result.data;
            renderDashboard(dashboardData);
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    });
}

function renderDashboard(data) {
    const statTotal = document.getElementById('statTotal');
    const statBaru = document.getElementById('statBaru');
    const statSelesai = document.getElementById('statSelesai');
    const statDiproses = document.getElementById('statDiproses');
    
    if (statTotal) statTotal.textContent = data.total || 0;
    if (statBaru) statBaru.textContent = (data.statusCount && data.statusCount['Baru']) || 0;
    if (statSelesai) statSelesai.textContent = (data.statusCount && data.statusCount['Selesai']) || 0;
    if (statDiproses) statDiproses.textContent = (data.statusCount && ((data.statusCount['Diproses'] || 0) + (data.statusCount['Proses'] || 0))) || 0;
    
    renderTimRanking(data.timRanking);
    renderMonthlyStats(data.monthlyStats);
    renderBelumTindakLanjut(data.belumTindakLanjut);
    
    // Update waktu
    const now = new Date();
    const lastUpdate = document.getElementById('lastUpdateTime');
    if (lastUpdate) {
        lastUpdate.textContent = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + 
                                 ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
}

function renderTimRanking(ranking) {
    const container = document.getElementById('timRankingContainer');
    if (!container) return;
    
    if (!ranking || ranking.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-trophy"></i><p>Belum ada data tim</p></div>`;
        return;
    }
    
    let html = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:var(--navy);color:white;">
            <th style="padding:12px;text-align:center;">No</th>
            <th style="padding:12px;text-align:left;">Tim</th>
            <th style="padding:12px;text-align:center;">Total</th>
            <th style="padding:12px;text-align:center;">Selesai</th>
            <th style="padding:12px;text-align:center;">%</th>
            <th style="padding:12px;text-align:center;">PIC</th>
        </tr></thead><tbody>`;
    
    ranking.forEach(function(item, index) {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1);
        const total = item.count || 0;
        const selesai = item.selesai || 0;
        const persentase = total > 0 ? Math.round((selesai / total) * 100) : 0;
        const bgColor = index === 0 ? 'rgba(255,215,0,0.1)' : index === 1 ? 'rgba(192,192,192,0.1)' : index === 2 ? 'rgba(205,127,50,0.1)' : 'transparent';
        
        html += `<tr style="background:${bgColor};border-bottom:1px solid var(--gray-100);">
            <td style="padding:12px;text-align:center;font-size:20px;">${medal}</td>
            <td style="padding:12px;font-weight:600;color:var(--navy);">${item.name || '-'}</td>
            <td style="padding:12px;text-align:center;font-weight:600;">${total}</td>
            <td style="padding:12px;text-align:center;color:var(--success);font-weight:600;">${selesai}</td>
            <td style="padding:12px;text-align:center;"><span style="font-weight:600;color:${persentase >= 80 ? 'var(--success)' : persentase >= 50 ? 'var(--gold)' : 'var(--danger)'};">${persentase}%</span></td>
            <td style="padding:12px;text-align:center;">${item.pic || '-'}</td>
        </tr>`;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function renderMonthlyStats(monthlyStats) {
    const container = document.getElementById('monthlyStatsContainer');
    if (!container) return;
    
    if (!monthlyStats || monthlyStats.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-alt"></i><p>Belum ada data bulanan</p></div>`;
        return;
    }
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthLabel = document.getElementById('monthLabel');
    if (monthLabel) monthLabel.textContent = monthNames[currentMonth] + ' ' + currentYear;
    
    const monthMap = {};
    monthlyStats.forEach(function(item) {
        monthMap[item.month] = item.count;
    });
    
    let html = '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;">';
    
    for (let i = 0; i < 12; i++) {
        const monthNum = String(i + 1).padStart(2, '0');
        const monthKey = currentYear + '-' + monthNum;
        const count = monthMap[monthKey] || 0;
        const isCurrent = i === currentMonth;
        
        let bgColor = 'var(--gray-50)';
        let textColor = 'var(--gray-600)';
        let borderColor = 'var(--gray-200)';
        let opacity = '1';
        
        if (isCurrent && count > 0) {
            bgColor = 'var(--navy)';
            textColor = 'white';
            borderColor = 'var(--navy)';
        } else if (count > 0) {
            bgColor = 'rgba(245,180,0,0.15)';
            textColor = 'var(--navy)';
            borderColor = 'var(--gold)';
        } else if (i > currentMonth) {
            opacity = '0.5';
        }
        
        html += `<div style="background:${bgColor};border-radius:8px;padding:12px 8px;text-align:center;border:2px solid ${borderColor};opacity:${opacity};cursor:${count > 0 ? 'pointer' : 'default'};" onclick="${count > 0 ? `showMonthlyAduan('${monthKey}')` : ''}">
            <div style="font-size:22px;font-weight:700;color:${textColor};">${count}</div>
            <div style="font-size:11px;color:${isCurrent && count > 0 ? 'rgba(255,255,255,0.8)' : 'var(--gray-600)'};">${monthNames[i]}</div>
            ${count > 0 ? '<div style="font-size:9px;color:var(--gold-dark);margin-top:2px;">📊</div>' : ''}
        </div>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function showMonthlyAduan(monthKey) {
    const filtered = allData.filter(function(item) {
        return item.TANGGAL && item.TANGGAL.startsWith(monthKey);
    });
    
    if (filtered.length === 0) {
        showToast('⚠️ Tidak ada data untuk bulan ini', 'warning');
        return;
    }
    
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const parts = monthKey.split('-');
    const monthName = monthNames[parseInt(parts[1]) - 1] + ' ' + parts[0];
    document.getElementById('monthlyAduanTitle').textContent = monthName;
    
    const tbody = document.getElementById('monthlyAduanBody');
    let html = '';
    filtered.forEach(function(item, index) {
        const statusClass = getStatusClass(item.STATUS);
        html += `<tr>
            <td style="padding:8px;border:1px solid #ddd;text-align:center;">${index + 1}</td>
            <td style="padding:8px;border:1px solid #ddd;">${item.TANGGAL || '-'}</td>
            <td style="padding:8px;border:1px solid #ddd;"><strong>${item['KODE LAPORAN'] || '-'}</strong></td>
            <td style="padding:8px;border:1px solid #ddd;">${item.DESKRIPSI || '-'}</td>
            <td style="padding:8px;border:1px solid #ddd;">${item.PEMOHON || '-'}</td>
            <td style="padding:8px;border:1px solid #ddd;"><span class="status-badge ${statusClass}">${item.STATUS || 'Baru'}</span></td>
            <td style="padding:8px;border:1px solid #ddd;">${item.TIM || '-'}</td>
        </tr>`;
    });
    tbody.innerHTML = html;
    document.getElementById('modalMonthlyAduan').style.display = 'block';
}

function prevMonth() {
    if (currentMonth === 0) {
        currentMonth = 11;
        currentYear--;
    } else {
        currentMonth--;
    }
    loadDashboard();
}

function nextMonth() {
    if (currentMonth === 11) {
        currentMonth = 0;
        currentYear++;
    } else {
        currentMonth++;
    }
    loadDashboard();
}

function renderBelumTindakLanjut(data) {
    const container = document.getElementById('belumTindakLanjutContainer');
    if (!container) return;
    
    if (!data || data.length === 0) {
        container.innerHTML = `<div class="empty-state" style="padding:30px;"><i class="fas fa-check-circle" style="color:var(--success);font-size:40px;"></i><p style="margin-top:10px;color:var(--gray-500);">Semua laporan sudah ditindaklanjuti!</p></div>`;
        return;
    }
    
    let html = '<div style="overflow-x:auto;border-radius:12px;border:1px solid var(--gray-200);"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:var(--navy);color:white;"><th style="padding:12px;text-align:center;">No</th><th style="padding:12px;text-align:left;">Kode</th><th style="padding:12px;text-align:left;">Deskripsi</th><th style="padding:12px;text-align:center;">Tanggal</th><th style="padding:12px;text-align:center;">Tim</th><th style="padding:12px;text-align:center;">PIC</th><th style="padding:12px;text-align:center;">Hari</th></tr></thead><tbody>';
    
    data.forEach(function(item, index) {
        const hari = item.hari || 0;
        const color = hari > 30 ? '#dc3545' : hari > 14 ? '#F5B400' : '#17a2b8';
        const statusText = hari > 30 ? '🔴 Sangat Terlambat' : hari > 14 ? '🟡 Perlu Perhatian' : '🔵 Dalam Antrian';
        
        html += `<tr>
            <td style="padding:10px;text-align:center;">${index + 1}</td>
            <td style="padding:10px;font-weight:600;color:var(--navy);cursor:pointer;" onclick="showDetailAduan('${item.kode || ''}')">${item.kode || '-'}</td>
            <td style="padding:10px;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${item.deskripsi || ''}">${item.deskripsi || '-'}</td>
            <td style="padding:10px;text-align:center;">${item.tanggal || '-'}</td>
            <td style="padding:10px;text-align:center;">${item.tim || '-'}</td>
            <td style="padding:10px;text-align:center;">${item.pic || '-'}</td>
            <td style="padding:10px;text-align:center;"><span style="background:${color}20;color:${color};padding:4px 12px;border-radius:20px;font-weight:700;">${hari} hari</span></td>
        </tr>`;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// ============================================================
// TAB 4 - MASTER USER
// ============================================================
function loadUsers() {
    callBackend('getUserData', {}, function(result) {
        if (result.success) {
            renderUsers(result.data || []);
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    });
}

function renderUsers(users) {
    const tbody = document.getElementById('tableBodyUser');
    if (!tbody) return;
    
    if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:#999;">Belum ada user</td></tr>`;
        return;
    }
    
    let html = '';
    users.forEach(function(user, index) {
        const isAdmin = user.role === 'admin';
        html += `<tr>
            <td>${index + 1}</td>
            <td><strong>${user.user}</strong></td>
            <td><span class="status-badge ${isAdmin ? 'status-baru' : 'status-proses'}">${user.role}</span></td>
            <td>${user.tim || '-'}</td>
            <td>${user.user !== 'admin' ? `<button class="btn btn-danger btn-xs" onclick="hapusUser('${user.user}')"><i class="fas fa-trash"></i></button>` : '<span style="color:#999;font-size:12px;">Default</span>'}</td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

function simpanUser() {
    const username = document.getElementById('inputUserUsername').value.trim();
    const password = document.getElementById('inputUserPassword').value.trim();
    const role = document.getElementById('inputUserRole').value;
    const tim = document.getElementById('inputUserTim').value;
    
    if (!username) { showToast('⚠️ Username harus diisi!', 'error'); return; }
    if (!password || password.length < 3) { showToast('⚠️ Password minimal 3 karakter!', 'error'); return; }
    
    showToast('⏳ Menambahkan user...', 'info');
    callBackend('insertUser', { user: username, password: password, role: role, tim: tim }, function(result) {
        if (result.success) {
            showToast('✅ ' + result.message, 'success');
            document.getElementById('formUser').reset();
            loadUsers();
            loadTimList();
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    });
}

function hapusUser(username) {
    if (!confirm('⚠️ Yakin ingin menghapus user "' + username + '"?')) return;
    showToast('⏳ Menghapus user...', 'info');
    callBackend('deleteUser', { user: username }, function(result) {
        if (result.success) {
            showToast('✅ ' + result.message, 'success');
            loadUsers();
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    });
}

// ============================================================
// TAB 5 - REKAP PEKERJAAN
// ============================================================
function loadTahunRekap() {
    callBackend('getTahunRekap', {}, function(result) {
        const select = document.getElementById('filterRekapTahun');
        if (!select) return;
        
        const currentVal = select.value;
        select.innerHTML = '<option value="">Semua Tahun</option>';
        
        if (result.success && Array.isArray(result.data)) {
            result.data.forEach(function(tahun) {
                const opt = document.createElement('option');
                opt.value = tahun;
                opt.textContent = tahun;
                if (tahun === currentVal) opt.selected = true;
                select.appendChild(opt);
            });
        } else {
            // Fallback
            const currentYear = new Date().getFullYear();
            for (let y = currentYear; y >= currentYear - 10; y--) {
                const opt = document.createElement('option');
                opt.value = y;
                opt.textContent = y;
                if (y === currentVal) opt.selected = true;
                select.appendChild(opt);
            }
        }
    });
}

function loadRekap() {
    const loading = document.getElementById('loadingRekap');
    const tableContainer = document.getElementById('tableRekapContainer');
    if (loading) loading.style.display = 'block';
    if (tableContainer) tableContainer.style.display = 'none';
    
    // Ambil dari sidebar
    const activeJenis = document.querySelector('.rekap-sidebar .sidebar-item.active');
    let jenis = activeJenis ? activeJenis.dataset.jenis : '';
    
    const filter = {
        tahun: document.getElementById('filterRekapTahun').value,
        jenis: document.getElementById('filterRekapJenis').value || jenis,
        keyword: document.getElementById('filterRekapKeyword').value.trim()
    };
    
    callBackend('getPekerjaanData', { filter: filter }, function(result) {
        if (loading) loading.style.display = 'none';
        if (tableContainer) tableContainer.style.display = 'block';
        
        if (result.success) {
            rekapData = result.data || [];
            renderRekapTable(rekapData);
            const total = document.getElementById('totalRekap');
            if (total) total.textContent = rekapData.length;
        } else {
            showToast('❌ ' + result.message, 'error');
            rekapData = [];
            renderRekapTable([]);
        }
    });
}

function renderRekapTable(data) {
    const tbody = document.getElementById('tableBodyRekap');
    if (!tbody) return;
    
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="14" style="text-align:center;padding:40px;color:#999;"><i class="fas fa-inbox" style="font-size:40px;display:block;margin-bottom:10px;"></i>Tidak ada data</td></tr>`;
        return;
    }
    
    const isAdmin = currentUser && currentUser.role === 'admin';
    let html = '';
    data.forEach(function(item) {
        const jenisClass = item['JENIS PEKERJAAN'] === 'E-Purchasing' ? 'status-baru' : 
                           item['JENIS PEKERJAAN'] === 'Pengadaan Langsung' ? 'status-proses' : 
                           item['JENIS PEKERJAAN'] === 'Penunjukan Langsung' ? 'status-selesai' :
                           item['JENIS PEKERJAAN'] === 'Tender Cepat' ? 'status-proses' :
                           item['JENIS PEKERJAAN'] === 'Tender' ? 'status-baru' : 'status-default';
        
        const paguFormatted = formatRupiah(item['PAGU']);
        const hargaTerkontrakFormatted = formatRupiah(item['HARGA TERKONTRAK']);
        
        const aksiHtml = isAdmin ? 
            `<button class="btn btn-primary btn-xs" onclick="showDetailPekerjaan('${encodeURIComponent(item['NAMA PEKERJAAN'] || '')}')" title="Edit"><i class="fas fa-edit"></i></button>` :
            '<span style="color:#999;font-size:11px;">-</span>';
        
        html += `<tr>
            <td><span class="clickable-name" onclick="showDetailPekerjaan('${encodeURIComponent(item['NAMA PEKERJAAN'] || '')}')" title="Klik untuk detail">${item['NAMA PEKERJAAN'] || '-'}</span></td>
            <td>${paguFormatted}</td>
            <td>${item['PPK'] || '-'}</td>
            <td>${item['PPTK'] || '-'}</td>
            <td>${item['PENGAWAS'] || '-'}</td>
            <td>${item['ADMIN'] || '-'}</td>
            <td>${item['PERENCANA'] || '-'}</td>
            <td>${item['PEJABAT PENGADAAN'] || '-'}</td>
            <td>${item['TANGGAL AWAL'] || '-'}</td>
            <td>${item['TANGGAL AKHIR'] || '-'}</td>
            <td>${item['NOMOR KONTRAK'] || '-'}</td>
            <td><span class="status-badge ${jenisClass}">${item['JENIS PEKERJAAN'] || '-'}</span></td>
            <td>${item['TAHUN'] || '-'}</td>
            <td><span class="text-truncate" title="${item['KETERANGAN'] || ''}">${item['KETERANGAN'] || '-'}</span></td>
            <td>${aksiHtml}</td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

function filterRekapJenis(element, jenis) {
    document.querySelectorAll('.rekap-sidebar .sidebar-item').forEach(function(el) {
        el.classList.remove('active');
    });
    element.classList.add('active');
    document.getElementById('filterRekapJenis').value = jenis;
    loadRekap();
}

function resetFilterRekap() {
    const filterTahun = document.getElementById('filterRekapTahun');
    const filterJenis = document.getElementById('filterRekapJenis');
    const filterKeyword = document.getElementById('filterRekapKeyword');
    
    if (filterTahun) filterTahun.value = '';
    if (filterJenis) filterJenis.value = '';
    if (filterKeyword) filterKeyword.value = '';
    
    document.querySelectorAll('.rekap-sidebar .sidebar-item').forEach(function(el) {
        el.classList.remove('active');
        if (el.dataset.jenis === '') {
            el.classList.add('active');
        }
    });
    loadRekap();
}

function exportRekap() {
    if (!rekapData || rekapData.length === 0) {
        showToast('⚠️ Tidak ada data untuk diexport!', 'warning');
        return;
    }
    
    const headers = ['NAMA PEKERJAAN', 'PAGU', 'PPK', 'PPTK', 'PENGAWAS', 'ADMIN', 'PERENCANA', 'PEJABAT PENGADAAN', 'TANGGAL AWAL', 'TANGGAL AKHIR', 'NOMOR KONTRAK', 'JENIS PEKERJAAN', 'TAHUN', 'KETERANGAN'];
    let csv = '\uFEFF' + headers.join(',') + '\n';
    
    rekapData.forEach(function(item) {
        const row = headers.map(function(h) {
            let val = item[h] || '';
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                return '"' + val.replace(/"/g, '""') + '"';
            }
            return val;
        });
        csv += row.join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Rekap_Pekerjaan_BM_' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('✅ Ekspor rekap berhasil!', 'success');
}

// ============================================================
// SHOW DETAIL PEKERJAAN (TAB 5)
// ============================================================
function showDetailPekerjaan(namaPekerjaanEncoded) {
    const namaPekerjaan = decodeURIComponent(namaPekerjaanEncoded);
    const item = rekapData.find(function(d) { return d['NAMA PEKERJAAN'] === namaPekerjaan; });
    if (!item) { 
        showToast('❌ Data tidak ditemukan!', 'error'); 
        return;
    }
    
    document.getElementById('detailOriginalNama').value = namaPekerjaan;
    document.getElementById('detailNamaPekerjaan').value = item['NAMA PEKERJAAN'] || '';
    document.getElementById('detailJenisPekerjaan').value = item['JENIS PEKERJAAN'] || '';
    document.getElementById('detailPagu').value = item['PAGU'] || '';
    document.getElementById('detailPpk').value = item['PPK'] || '';
    document.getElementById('detailPptk').value = item['PPTK'] || '';
    document.getElementById('detailPengawas').value = item['PENGAWAS'] || '';
    document.getElementById('detailAdmin').value = item['ADMIN'] || '';
    document.getElementById('detailPerencana').value = item['PERENCANA'] || '';
    document.getElementById('detailPejabatPengadaan').value = item['PEJABAT PENGADAAN'] || '';
    document.getElementById('detailTanggalAwal').value = item['TANGGAL AWAL'] || '';
    document.getElementById('detailTanggalAkhir').value = item['TANGGAL AKHIR'] || '';
    document.getElementById('detailNomorKontrak').value = item['NOMOR KONTRAK'] || '';
    document.getElementById('detailTahun').value = item['TAHUN'] || '';
    document.getElementById('detailKodeRup').value = item['KODE RUP'] || '';
    document.getElementById('detailHps').value = item['HPS'] || '';
    document.getElementById('detailPenyedia').value = item['PENYEDIA'] || '';
    document.getElementById('detailHargaTerkontrak').value = item['HARGA TERKONTRAK'] || '';
    document.getElementById('detailKeteranganPekerjaan').value = item['KETERANGAN'] || '';
    document.getElementById('detailTanggalSppbj').value = item['TANGGAL SPPBJ'] || '';
    document.getElementById('detailNomorSppbj').value = item['NOMOR SPPBJ'] || '';
    document.getElementById('detailTanggalSpk').value = item['TANGGAL SPK'] || '';
    document.getElementById('detailNomorSpk').value = item['NOMOR SPK'] || '';
    document.getElementById('detailTanggalSpmk').value = item['TANGGAL SPMK'] || '';
    document.getElementById('detailNomorSpmk').value = item['NOMOR SPMK'] || '';
    document.getElementById('detailBap').value = item['BAP'] || '';
    document.getElementById('detailBast').value = item['BAST'] || '';
    
    document.getElementById('modalDetailPekerjaan').style.display = 'block';
}

function updatePekerjaan() {
    const data = {
        originalNama: document.getElementById('detailOriginalNama').value,
        namaPekerjaan: document.getElementById('detailNamaPekerjaan').value.trim(),
        jenisPekerjaan: document.getElementById('detailJenisPekerjaan').value,
        pagu: document.getElementById('detailPagu').value.trim(),
        ppk: document.getElementById('detailPpk').value.trim(),
        pptk: document.getElementById('detailPptk').value.trim(),
        pengawas: document.getElementById('detailPengawas').value.trim(),
        admin: document.getElementById('detailAdmin').value.trim(),
        perencana: document.getElementById('detailPerencana').value.trim(),
        pejabatPengadaan: document.getElementById('detailPejabatPengadaan').value.trim(),
        tanggalAwal: document.getElementById('detailTanggalAwal').value,
        tanggalAkhir: document.getElementById('detailTanggalAkhir').value,
        nomorKontrak: document.getElementById('detailNomorKontrak').value.trim(),
        tahun: document.getElementById('detailTahun').value,
        kodeRup: document.getElementById('detailKodeRup').value.trim(),
        hps: document.getElementById('detailHps').value.trim(),
        penyedia: document.getElementById('detailPenyedia').value.trim(),
        hargaTerkontrak: document.getElementById('detailHargaTerkontrak').value.trim(),
        tanggalSppbj: document.getElementById('detailTanggalSppbj').value,
        nomorSppbj: document.getElementById('detailNomorSppbj').value.trim(),
        tanggalSpk: document.getElementById('detailTanggalSpk').value,
        nomorSpk: document.getElementById('detailNomorSpk').value.trim(),
        tanggalSpmk: document.getElementById('detailTanggalSpmk').value,
        nomorSpmk: document.getElementById('detailNomorSpmk').value.trim(),
        bap: document.getElementById('detailBap').value.trim(),
        bast: document.getElementById('detailBast').value.trim(),
        keterangan: document.getElementById('detailKeteranganPekerjaan').value.trim()
    };
    
    if (!data.namaPekerjaan) {
        showToast('⚠️ Nama Pekerjaan harus diisi!', 'error');
        document.getElementById('detailNamaPekerjaan').focus();
        return;
    }
    if (!data.jenisPekerjaan) {
        showToast('⚠️ Jenis Pengadaan harus dipilih!', 'error');
        document.getElementById('detailJenisPekerjaan').focus();
        return;
    }
    if (!data.tahun) {
        showToast('⚠️ Tahun harus dipilih!', 'error');
        document.getElementById('detailTahun').focus();
        return;
    }
    
    if (!confirm('⚠️ Yakin ingin menyimpan perubahan untuk "' + data.originalNama + '"?')) return;
    
    showToast('⏳ Menyimpan perubahan...', 'info');
    callBackend('updatePekerjaan', data, function(result) {
        if (result.success) {
            showToast('✅ ' + result.message, 'success');
            closeModal('modalDetailPekerjaan');
            loadRekap();
            loadTahunRekap();
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    });
}

// ============================================================
// MODAL HELPERS
// ============================================================
function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

// ============================================================
// TOAST
// ============================================================
function showToast(message, type) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = 'toast toast-' + (type || 'info');
    toast.style.display = 'block';
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(function() {
        toast.style.display = 'none';
    }, 4000);
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(function(m) {
            if (m.style.display === 'block') {
                m.style.display = 'none';
            }
        });
    }
});

console.log('✅ SIAP JALAN v2.6 siap digunakan!');
