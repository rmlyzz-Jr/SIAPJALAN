// ============================================================
// GLOBAL VARIABLES
// ============================================================
let currentUser = null;
let allData = [];
let dashboardData = null;
let isLoggingIn = false;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let timPICData = {};

// ============================================================
// SPREADSHEET CONFIGURATION (Google Apps Script Backend URL)
// ============================================================
// Ganti dengan URL Web App Google Apps Script Anda
const SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

// ============================================================
// INIT - Service Worker Registration (PWA)
// ============================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('✅ ServiceWorker registered successfully');
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
    console.log('🚀 SIAP JALAN started');
    generateTahunOptions();
    
    const savedUser = localStorage.getItem('siapjalan_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
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
    const select = document.getElementById('inputTahun');
    if (!select) return;
    select.innerHTML = '<option value="">Pilih Tahun</option>';
    for (let y = currentYear; y >= currentYear - 10; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        select.appendChild(opt);
    }
}

// ============================================================
// SHOW/HIDE PAGES
// ============================================================
function showLoginPage() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginUsername').focus();
}

function showMainApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
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
        case 'admin': return ['tab1', 'tab2', 'tab3', 'tab4'];
        case 'operator': return ['tab2', 'tab3'];
        case 'pegawai': return ['tab2'];
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
    
    if (isAdmin) {
        if (tabInput) { tabInput.classList.remove('hidden-tab'); tabInput.disabled = false; }
        if (tabMaster) { tabMaster.classList.remove('hidden-tab'); tabMaster.disabled = false; }
        if (tabDashboard) { tabDashboard.classList.remove('hidden-tab'); tabDashboard.disabled = false; }
    } else if (isOperator) {
        if (tabInput) { tabInput.classList.add('hidden-tab'); }
        if (tabMaster) { tabMaster.classList.add('hidden-tab'); }
        if (tabDashboard) { tabDashboard.classList.remove('hidden-tab'); tabDashboard.disabled = false; }
    } else if (isPegawai) {
        if (tabInput) { tabInput.classList.add('hidden-tab'); }
        if (tabMaster) { tabMaster.classList.add('hidden-tab'); }
        if (tabDashboard) { tabDashboard.classList.add('hidden-tab'); }
    }
    
    const filterTimGroup = document.getElementById('filterTimGroup');
    if (!isAdmin) {
        filterTimGroup.style.display = 'none';
    } else {
        filterTimGroup.style.display = 'block';
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
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    document.getElementById('loginError').style.display = 'none';
    
    // Panggil backend Google Apps Script
    fetch(SCRIPT_URL + '?action=login', {
        method: 'POST',
        body: JSON.stringify({ username: username, password: password }),
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(result => {
        isLoggingIn = false;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Masuk';
        if (result.success) {
            currentUser = result.data;
            localStorage.setItem('siapjalan_user', JSON.stringify(currentUser));
            showMainApp();
            showToast('✅ Login berhasil! Selamat datang ' + currentUser.user, 'success');
        } else {
            showLoginError(result.message || 'Username atau password salah!');
        }
    })
    .catch(error => {
        isLoggingIn = false;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Masuk';
        showLoginError('Terjadi kesalahan: ' + error);
    });
}

function showLoginError(message) {
    const errorDiv = document.getElementById('loginError');
    document.getElementById('loginErrorMessage').textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(function() { errorDiv.style.display = 'none'; }, 5000);
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
        document.getElementById('usernameDisplay').textContent = currentUser.user;
        const roleNames = { 'admin': 'Admin', 'operator': 'Operator', 'pegawai': 'Pegawai' };
        let roleText = roleNames[currentUser.role] || currentUser.role;
        document.getElementById('roleDisplay').textContent = roleText;
        const timDisplay = document.getElementById('timDisplay');
        if (currentUser.role === 'operator' && currentUser.tim) {
            timDisplay.textContent = '🏷️ ' + currentUser.tim;
            timDisplay.style.display = 'inline-block';
        } else {
            timDisplay.style.display = 'none';
        }
    }
}

// ============================================================
// CALL BACKEND FUNCTION (Helper)
// ============================================================
function callBackend(action, data, callback) {
    const payload = { action: action, ...data };
    if (currentUser) {
        payload.user = currentUser;
    }
    
    fetch(SCRIPT_URL + '?action=' + action, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(callback)
    .catch(error => {
        console.error('Error calling backend:', error);
        showToast('❌ Error: ' + error, 'error');
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
        if (loginPage.style.display !== 'none') {
            doLogin();
        }
    }
});

// ============================================================
// LOAD TIM LIST
// ============================================================
function loadTimList(selectedTim, selectedPIC) {
    callBackend('getTimPICData', {}, function(result) {
        if (!result.success) {
            console.error('Error loading tim data:', result.message);
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
            select.innerHTML = '<option value="">Pilih Tim</option>';
            
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
        
        // Set PIC otomatis untuk inputTim
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
    });
}

// ============================================================
// GENERATE KODE
// ============================================================
function generateKode() {
    callBackend('generateKodeLaporan', {}, function(result) {
        if (result.success) {
            document.getElementById('inputKode').value = result.data;
        }
    });
}

// ============================================================
// SET DEFAULT DATE
// ============================================================
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('inputTanggal').value = today;
}

function setFilterDates() {
    callBackend('getTanggalTerlama', {}, function(result) {
        if (result.success && result.data) {
            document.getElementById('filterStartDate').value = result.data;
        }
    });
}

// ============================================================
// TOGGLE TIM FIELD
// ============================================================
function toggleTimField() {
    const role = document.getElementById('inputUserRole').value;
    const timGroup = document.getElementById('userTimGroup');
    if (role === 'admin') {
        timGroup.style.display = 'none';
    } else {
        timGroup.style.display = 'block';
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
        media: document.getElementById('inputMedia').value.trim(),
        status: document.getElementById('inputStatus').value,
        tim: document.getElementById('inputTim').value,
        pic: document.getElementById('inputPIC').value.trim(),
        jadwal: document.getElementById('inputJadwal').value,
        tindakLanjut: document.getElementById('inputTindakLanjut').value.trim(),
        keterangan: document.getElementById('inputKeterangan').value.trim(),
        gambar: document.getElementById('inputGambar').value.trim()
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
    
    showToast('⏳ Menyimpan data...', 'info');
    callBackend('insertAduan', data, function(result) {
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
// TAB 2 - LOAD ADUAN
// ============================================================
function loadAduan() {
    document.getElementById('loadingAduan').style.display = 'block';
    document.getElementById('tableContainer').style.display = 'none';
    
    const filter = {
        startDate: document.getElementById('filterStartDate').value,
        endDate: document.getElementById('filterEndDate').value,
        status: document.getElementById('filterStatus').value,
        tim: document.getElementById('filterTim').value,
        keyword: document.getElementById('filterKeyword').value.trim()
    };
    
    callBackend('getAllLaporanWeb', { filter: filter }, function(result) {
        document.getElementById('loadingAduan').style.display = 'none';
        document.getElementById('tableContainer').style.display = 'block';
        
        if (result.success) {
            allData = result.data || [];
            renderAduanTable(allData);
            document.getElementById('totalAduan').textContent = allData.length;
        } else {
            showToast('❌ ' + result.message, 'error');
            allData = [];
            renderAduanTable([]);
        }
    });
}

function renderAduanTable(data) {
    const tbody = document.getElementById('tableBodyAduan');
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" style="text-align:center;padding:40px;color:#999;"><i class="fas fa-inbox" style="font-size:40px;display:block;margin-bottom:10px;"></i>Tidak ada data</td></tr>`;
        return;
    }
    
    const isAdmin = currentUser && currentUser.role === 'admin';
    let html = '';
    data.forEach(function(item, index) {
        const statusClass = getStatusClass(item.STATUS);
        html += `<tr>
            <td>${index + 1}</td>
            <td>${item.TANGGAL || '-'}</td>
            <td><strong>${item['KODE LAPORAN'] || '-'}</strong></td>
            <td><span class="text-truncate" title="${item.DESKRIPSI || ''}">${item.DESKRIPSI || '-'}</span></td>
            <td>${item.PEMOHON || '-'}</td>
            <td><span class="text-truncate" title="${item['DETAIL LOKASI'] || ''}">${item['DETAIL LOKASI'] || '-'}</span></td>
            <td><span class="status-badge ${statusClass}">${item.STATUS || 'Baru'}</span></td>
            <td>${item.TIM || '-'}</td>
            <td>${item.PIC || '-'}</td>
            <td>${item.JADWAL || '-'}</td>
            <td><span class="text-truncate" title="${item['TINDAK LANJUT'] || ''}">${item['TINDAK LANJUT'] || '-'}</span></td>
            <td><span class="text-truncate" title="${item.KETERANGAN || ''}">${item.KETERANGAN || '-'}</span></td>
            <td>
                <button class="btn btn-primary btn-xs" onclick="showEditModal('${item['KODE LAPORAN']}')" title="Edit"><i class="fas fa-edit"></i></button>
                ${isAdmin ? `<button class="btn btn-danger btn-xs" onclick="hapusAduan('${item['KODE LAPORAN']}')" title="Hapus"><i class="fas fa-trash"></i></button>` : ''}
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

function getStatusClass(status) {
    const map = { 
        'Baru': 'status-baru', 
        'Diproses': 'status-proses', 
        'Selesai': 'status-selesai', 
        'Ditolak': 'status-ditolak',
        'Ditunda': 'status-ditolak'
    };
    return map[status] || 'status-baru';
}

// ============================================================
// TAB 2 - FILTER
// ============================================================
function resetFilter() {
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterTim').value = '';
    document.getElementById('filterKeyword').value = '';
    setFilterDates();
    loadAduan();
}

function refreshData() {
    showToast('🔄 Memuat ulang data...', 'info');
    loadAduan();
}

// ============================================================
// TAB 2 - EDIT ADUAN
// ============================================================
function showEditModal(kodeLaporan) {
    const item = allData.find(function(d) { return d['KODE LAPORAN'] === kodeLaporan; });
    if (!item) { showToast('❌ Data tidak ditemukan!', 'error'); return; }
    
    document.getElementById('editKodeLaporan').value = kodeLaporan;
    document.getElementById('editKode').value = kodeLaporan;
    document.getElementById('editJadwal').value = item.JADWAL || '';
    document.getElementById('editTindakLanjut').value = item['TINDAK LANJUT'] || '';
    document.getElementById('editKeterangan').value = item.KETERANGAN || '';
    document.getElementById('editStatus').value = item.STATUS || 'Baru';
    
    const selectedTim = item.TIM || '';
    const selectedPIC = item.PIC || '';
    loadTimList(selectedTim, selectedPIC);
    
    setTimeout(function() {
        document.getElementById('editPIC').value = selectedPIC;
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
        PIC: document.getElementById('editPIC').value.trim()
    };
    
    showToast('⏳ Mengupdate data...', 'info');
    callBackend('updateLaporanWeb', data, function(result) {
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
// TAB 2 - EXPORT
// ============================================================
function exportData() {
    if (!allData || allData.length === 0) {
        showToast('⚠️ Tidak ada data untuk diexport!', 'warning');
        return;
    }
    
    const headers = ['TANGGAL', 'KODE LAPORAN', 'DESKRIPSI', 'PEMOHON', 'DETAIL LOKASI', 'ASAL MEDIA', 'STATUS', 'NOTES', 'GAMBAR', 'TIM', 'PIC', 'JADWAL', 'TINDAK LANJUT', 'KETERANGAN', 'DISPOSISI'];
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
    document.getElementById('statTotal').textContent = data.total || 0;
    document.getElementById('statBaru').textContent = data.statusCount['Baru'] || 0;
    document.getElementById('statSelesai').textContent = data.statusCount['Selesai'] || 0;
    document.getElementById('statDiproses').textContent = (data.statusCount['Diproses'] || 0) + (data.statusCount['Proses'] || 0);
    
    renderTimRanking(data.timRanking);
    renderMonthlyStats(data.monthlyStats);
    renderBelumTindakLanjut(data.belumTindakLanjut);
}

function renderTimRanking(ranking) {
    const container = document.getElementById('timRankingContainer');
    if (!ranking || ranking.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-trophy"></i><p>Belum ada data tim</p></div>`;
        return;
    }
    
    let html = '<div class="ranking-list">';
    ranking.forEach(function(item, index) {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1);
        const picDisplay = item.pic ? `<span class="pic">👤 ${item.pic}</span>` : '';
        html += `<div class="ranking-item">
            <span class="rank">${medal}</span>
            <span class="name">${item.name}</span>
            ${picDisplay}
            <span class="count">${item.count} laporan</span>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

function renderMonthlyStats(monthlyStats) {
    const container = document.getElementById('monthlyStatsContainer');
    if (!monthlyStats || monthlyStats.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-alt"></i><p>Belum ada data bulanan</p></div>`;
        return;
    }
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    document.getElementById('monthLabel').textContent = monthNames[currentMonth] + ' ' + currentYear;
    
    const monthMap = {};
    monthlyStats.forEach(function(item) {
        monthMap[item.month] = item.count;
    });
    
    let html = '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;">';
    
    for (let i = 0; i < 12; i++) {
        const monthNum = String(i + 1).padStart(2, '0');
        const year = currentYear;
        const monthKey = year + '-' + monthNum;
        const count = monthMap[monthKey] || 0;
        const isCurrent = i === currentMonth;
        const isPast = i < currentMonth;
        const isFuture = i > currentMonth;
        
        let bgColor = 'var(--gray-50)';
        let textColor = 'var(--gray-600)';
        let borderColor = 'var(--gray-200)';
        let opacity = '1';
        
        if (isCurrent) {
            bgColor = 'var(--navy)';
            textColor = 'white';
            borderColor = 'var(--navy)';
        } else if (isPast && count > 0) {
            bgColor = 'rgba(245,180,0,0.15)';
            textColor = 'var(--navy)';
            borderColor = 'var(--gold)';
        } else if (isPast && count === 0) {
            bgColor = 'var(--gray-50)';
            textColor = 'var(--gray-400)';
            borderColor = 'var(--gray-200)';
        } else if (isFuture) {
            bgColor = '#fafafa';
            textColor = 'var(--gray-400)';
            borderColor = 'var(--gray-200)';
            opacity = '0.5';
        }
        
        html += `<div style="background:${bgColor};border-radius:8px;padding:12px 8px;text-align:center;border:2px solid ${borderColor};transition:all 0.3s ease;opacity:${opacity};cursor:${isFuture ? 'default' : 'pointer'};" 
              onmouseover="this.style.transform='scale(1.05)'" 
              onmouseout="this.style.transform='scale(1)'">
            <div style="font-size:22px;font-weight:700;color:${textColor};">${count}</div>
            <div style="font-size:11px;color:${isCurrent ? 'rgba(255,255,255,0.8)' : 'var(--gray-600)'};font-weight:${isCurrent ? '600' : '500'};">${monthNames[i]}</div>
        </div>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
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
    if (!data || data.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-check-circle" style="color:var(--success);"></i><p>Semua laporan sudah ditindaklanjuti!</p></div>`;
        return;
    }
    
    let html = '<div style="overflow-x:auto;"><table><thead><tr><th>No</th><th>Kode</th><th>Deskripsi</th><th>Tanggal</th><th>Tim</th><th>PIC</th><th>Hari</th></tr></thead><tbody>';
    data.forEach(function(item, index) {
        const color = item.hari > 30 ? 'var(--danger)' : item.hari > 14 ? 'var(--gold)' : 'var(--info)';
        html += `<tr>
            <td>${index + 1}</td>
            <td><strong>${item.kode}</strong></td>
            <td>${item.deskripsi || '-'}</td>
            <td>${item.tanggal || '-'}</td>
            <td>${item.tim || '-'}</td>
            <td>${item.pic || '-'}</td>
            <td><span style="color:${color};font-weight:600;">${item.hari} hari</span></td>
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
// MODAL HELPERS
// ============================================================
function closeModal(id) {
    document.getElementById(id).style.display = 'none';
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
            m.style.display = 'none';
        });
    }
});

console.log('✅ SIAP JALAN siap digunakan!');
