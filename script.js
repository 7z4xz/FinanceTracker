// ==========================================
// CONFIGURATION API
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbyz5rYEeXVJKExadajLkoalhZgtBFRuRq1YHIWyxWD2jcmLxkblpsPw6mWekP_FtJeZ/exec";

// Variabel Global
let trendChartInstance = null;
let categoryChartInstance = null;
let allTransactions = []; // Menyimpan semua data dari Google Sheets[cite: 7]
let currentChartRange = 7; // Default grafik menampilkan 7 hari terakhir (1W)[cite: 7]

// ==========================================
// UTAMA: DOM CONTENT LOADED (SATU PINTU)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Inisialisasi Aplikasi, Waktu, & Dark Mode[cite: 7]
    init();
    initTheme();

    // 2. Memuat Data Awal dari Google Sheets via API (Berdasarkan User Login)[cite: 7]
    loadTransactions();

    // Cek foto profil awal untuk navbar saat halaman dimuat
    (async function() {
        const username = localStorage.getItem("ledger_user");
        if (username) {
            try {
                const response = await fetch(API_URL, {
                    method: "POST",
                    body: JSON.stringify({ action: "get_profile", username: username })
                });
                const result = await response.json();
                if (result.status === "success" && result.photo) {
                    updateNavbarAvatar(result.photo);
                }
            } catch (e) {
                console.error(e);
            }
        }
    })();

    // Tampilkan URL API di halaman Settings[cite: 7]
    const settingApiInput = document.getElementById("display-api-url");
    if (settingApiInput) {
        settingApiInput.value = API_URL;
    }

    // 3. Deklarasi Elemen Modal & Form[cite: 7]
    const modal = document.getElementById("transaction-modal");
    const openModalBtn = document.getElementById("open-modal-btn");
    const closeModalBtn = document.getElementById("close-modal-btn");
    const cancelModalBtn = document.getElementById("cancel-btn");
    const transactionForm = document.getElementById("transaction-form");
    const submitBtn = document.getElementById("submit-btn");

    // Fungsi Buka Modal[cite: 7]
    if (openModalBtn && modal) {
        openModalBtn.addEventListener("click", () => {
            modal.classList.remove("hidden");
            setTimeout(() => modal.classList.add("active"), 10);
        });
    }

    // Fungsi Tutup Modal & Reset Form[cite: 7]
    const closeModal = () => {
        if (modal) {
            modal.classList.remove("active");
            setTimeout(() => {
                modal.classList.add("hidden");
            }, 300);
        }
        if (transactionForm) {
            transactionForm.reset();
        }
    };

    if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener("click", closeModal);
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });
    }

    // 4. Penanganan Submit Form Transaksi (Dengan Toggle Income/Expense & Auto Format Nominal)[cite: 7]
    if (transactionForm) {
        transactionForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const kategoriInput = document.getElementById("kategori");
            const nominalInput = document.getElementById("nominal");
            const deskripsiInput = document.getElementById("deskripsi");
            const selectedType = document.querySelector('input[name="jenis"]:checked');

            if (!nominalInput || !deskripsiInput || !selectedType) {
                alert("Elemen form tidak lengkap di HTML!");
                return;
            }

            // Ambil username user yang sedang aktif dari memori browser[cite: 7]
            const currentUsername = localStorage.getItem("ledger_user");

            // Bersihkan titik format ribuan pada nominal sebelum dikirim (Contoh: "50.000" jadi 50000)[cite: 7]
            const rawNominal = nominalInput.value.replace(/\./g, '');

            const formData = {
                action: "add_transaction", // <-- WAJIB AGAR MASUK KE TAB TRANSACTIONS DENGAN BENAR[cite: 7]
                username: currentUsername,  // <-- AGAR DATA TERKAIT DENGAN AKUN YANG LOGIN[cite: 7]
                jenis: selectedType.value,  // Mengambil nilai dari Toggle Switch (Income / Expense)[cite: 7]
                kategori: kategoriInput ? kategoriInput.value : "-",
                nominal: Number(rawNominal),
                deskripsi: deskripsiInput.value
            };

            if (submitBtn) {
                submitBtn.innerText = "Menyimpan...";
                submitBtn.disabled = true;
            }

            try {
                const response = await fetch(API_URL, {
                    method: "POST",
                    body: JSON.stringify(formData)
                });
                const result = await response.json();

                if (result.status === "success") {
                    alert("Transaksi berhasil disimpan!");
                    closeModal();
                    loadTransactions();
                } else {
                    alert("Gagal menyimpan: " + (result.message || "Terjadi kesalahan server."));
                }
            } catch (error) {
                console.error("Error kirim data:", error);
                alert("Gagal terhubung ke server. Periksa koneksi internet Anda.");
            } finally {
                if (submitBtn) {
                    submitBtn.innerText = "Simpan Transaksi";
                    submitBtn.disabled = false;
                }
            }
        });
    }

    // 4.1 Auto Format Titik Ribuan pada Input Nominal (Contoh: 50000 jadi 50.000)[cite: 7]
    const nominalInputField = document.getElementById("nominal");
    if (nominalInputField) {
        nominalInputField.addEventListener("input", function() {
            let value = this.value.replace(/[^0-9]/g, '');
            if (value) {
                this.value = parseInt(value, 10).toLocaleString('id-ID');
            } else {
                this.value = '';
            }
        });
    }

    // 5. FITUR HAPUS TRANSAKSI TERPILIH (MULTI-SELECT DELETE)[cite: 7]
    const deleteSelectedBtn = document.getElementById("delete-selected-btn");
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener("click", async () => {
            const selectedCheckboxes = document.querySelectorAll(".select-checkbox:checked");
            if (selectedCheckboxes.length === 0) return;

            const isConfirm = confirm(`Apakah Anda yakin ingin menghapus ${selectedCheckboxes.length} transaksi terpilih? Saldo akan dikalkulasi ulang.`);
            if (!isConfirm) return;

            const idsToDelete = Array.from(selectedCheckboxes).map(cb => cb.getAttribute("data-id"));

            deleteSelectedBtn.innerText = "Menghapus...";
            deleteSelectedBtn.disabled = true;

            try {
                const response = await fetch(API_URL, {
                    method: "POST",
                    body: JSON.stringify({ action: "delete_transactions", ids: idsToDelete })
                });
                const result = await response.json();

                if (result.status === "success") {
                    alert("Transaksi terpilih berhasil dihapus dan saldo diperbarui!");
                    loadTransactions(); // Otomatis me-refresh tabel, kartu balance, dan grafik kembali ke posisi semula[cite: 7]
                } else {
                    alert("Gagal menghapus transaksi.");
                }
            } catch (error) {
                console.error(error);
                alert("Terjadi kesalahan jaringan.");
            } finally {
                deleteSelectedBtn.innerText = "Hapus Terpilih";
                deleteSelectedBtn.disabled = false;
            }
        });
    }

    // 6. FITUR SIDEBAR PROFIL KANAN (SLIDE-IN PANEL)
    const profileBtn = document.getElementById("profile-btn");
    const profilePanel = document.getElementById("profile-panel");
    const profileOverlay = document.getElementById("profile-overlay");
    const closeProfileBtn = document.getElementById("close-profile-btn");
    const profileForm = document.getElementById("profile-form");
    const avatarInput = document.getElementById("avatar-input");
    const profileAvatarImg = document.getElementById("profile-avatar-img");

    let base64Avatar = "";

    if (profileBtn && profilePanel) {
        profileBtn.addEventListener("click", () => {
            profilePanel.classList.add("active");
            profileOverlay.classList.add("active");
            loadProfileData();
        });
    }

    const closeProfilePanel = () => {
        if (profilePanel) profilePanel.classList.remove("active");
        if (profileOverlay) profileOverlay.classList.remove("active");
    };

    if (closeProfileBtn) closeProfileBtn.addEventListener("click", closeProfilePanel);
    if (profileOverlay) profileOverlay.addEventListener("click", closeProfilePanel);

    // Konversi & Kompresi Otomatis Gambar Profil agar Ringan & Aman untuk Google Sheets
    if (avatarInput) {
        avatarInput.addEventListener("change", function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const img = new Image();
                    img.onload = function() {
                        const canvas = document.createElement('canvas');
                        const MAX_SIZE = 150;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                            if (width > MAX_SIZE) {
                                height *= MAX_SIZE / width;
                                width = MAX_SIZE;
                            }
                        } else {
                            if (height > MAX_SIZE) {
                                width *= MAX_SIZE / height;
                                height = MAX_SIZE;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        // Kompres ke format JPEG dengan kualitas 0.7 (sangat ringan)
                        base64Avatar = canvas.toDataURL('image/jpeg', 0.7);
                        profileAvatarImg.src = base64Avatar;
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Ambil Data Profil dari Server
    async function loadProfileData() {
        const username = localStorage.getItem("ledger_user");
        if (!username) return;

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                body: JSON.stringify({ action: "get_profile", username: username })
            });
            const result = await response.json();

            if (result.status === "success") {
                document.getElementById("profile-nama").value = result.nama || "";
                document.getElementById("profile-username").value = result.username || "";
                document.getElementById("profile-bio").value = result.bio || "";
                if (result.photo) {
                    base64Avatar = result.photo;
                    profileAvatarImg.src = base64Avatar;
                    updateNavbarAvatar(result.photo); // Update foto di navbar secara instan
                } else {
                    profileAvatarImg.src = "https://via.placeholder.com/100";
                    updateNavbarAvatar("");
                }
            }
        } catch (error) {
            console.error("Gagal memuat profil:", error);
        }
    }

    // Simpan Perubahan Profil (Termasuk Username & Transaksi Terkait)
    if (profileForm) {
        profileForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const oldUsername = localStorage.getItem("ledger_user");
            const newNama = document.getElementById("profile-nama").value;
            const newUsername = document.getElementById("profile-username").value;
            const newBio = document.getElementById("profile-bio").value;

            const saveProfileBtn = document.getElementById("save-profile-btn");
            saveProfileBtn.innerText = "Menyimpan...";
            saveProfileBtn.disabled = true;

            const payload = {
                action: "update_profile",
                oldUsername: oldUsername,
                newUsername: newUsername,
                nama: newNama,
                bio: newBio,
                photo: base64Avatar
            };

            try {
                const response = await fetch(API_URL, {
                    method: "POST",
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (result.status === "success") {
                    alert("Profil berhasil diperbarui!");
                    localStorage.setItem("ledger_user", result.username);
                    localStorage.setItem("ledger_name", result.nama);

                    updateNavbarAvatar(base64Avatar); // Update navbar langsung
                    updateGreeting();
                    closeProfilePanel();
                    loadTransactions();
                } else {
                    alert("Gagal memperbarui profil: " + (result.message || "Kesalahan server"));
                }
            } catch (error) {
                console.error(error);
                alert("Gagal terhubung ke server.");
            } finally {
                saveProfileBtn.innerText = "Simpan Perubahan";
                saveProfileBtn.disabled = false;
            }
        });
    }

    // 7. FITUR TOMBOL FILTER GRAFIK (1W, 1M, 3M, 1Y, All)[cite: 7]
    const filterBtns = document.querySelectorAll(".filter-btn");
    if (filterBtns.length > 0) {
        filterBtns.forEach(btn => {
            btn.addEventListener("click", (e) => {
                filterBtns.forEach(b => b.classList.remove("active"));
                e.target.classList.add("active");

                const range = e.target.getAttribute("data-range");
                currentChartRange = range === 'all' ? 'all' : parseInt(range);

                renderCharts(allTransactions, currentChartRange);
            });
        });
    }

    // 8. NAVIGASI SIDEBAR (KLIK & SCROLLSPY)[cite: 7]
    const navItems = document.querySelectorAll(".sidebar-nav .nav-item");
    const sections = document.querySelectorAll("main section[id]");

    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const targetId = item.getAttribute("data-target");
            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
                navItems.forEach(nav => nav.classList.remove("active"));
                item.classList.add("active");
            }
        });
    });

    const observerOptions = { root: null, rootMargin: "-10% 0px -50% 0px", threshold: 0 };
    const observer = new IntersectionObserver((entries) => {
        if (window.scrollY < 100) {
            navItems.forEach(item => item.classList.remove("active"));
            const dashboardNav = document.querySelector('[data-target="dashboard-section"]');
            if (dashboardNav) dashboardNav.classList.add("active");
            return;
        }
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const currentId = entry.target.getAttribute("id");
                navItems.forEach(item => {
                    item.classList.remove("active");
                    if (item.getAttribute("data-target") === currentId) item.classList.add("active");
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));

    // 9. HAMBARGER MENU MOBILE TOGGLE[cite: 7]
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const sidebar = document.querySelector(".sidebar");

    if (hamburgerBtn && sidebar) {
        hamburgerBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            sidebar.classList.toggle("mobile-open");
        });
        document.addEventListener("click", (e) => {
            if (window.innerWidth <= 768) {
                if (!sidebar.contains(e.target) && !hamburgerBtn.contains(e.target)) {
                    sidebar.classList.remove("mobile-open");
                }
            }
        });
        const navLinks = sidebar.querySelectorAll(".nav-item");
        navLinks.forEach(link => {
            link.addEventListener("click", () => {
                if (window.innerWidth <= 768) sidebar.classList.remove("mobile-open");
            });
        });
    }
});

// ==========================================
// FUNGSI PENDUKUNG / HELPER
// ==========================================

function init() {
    console.log("FinanceTracker App Started");
    updateGreeting(); 
}

// Fungsi untuk mengganti ikon default navbar dengan foto profil bulat
function updateNavbarAvatar(photoBase64) {
    const navImg = document.getElementById("navbar-profile-img");
    const navIcon = document.getElementById("navbar-default-icon");
    
    if (navImg && navIcon) {
        if (photoBase64 && photoBase64.trim() !== "") {
            navImg.src = photoBase64;
            navImg.style.display = "block";
            navIcon.style.display = "none";
        } else {
            navImg.style.display = "none";
            navIcon.style.display = "inline-block";
        }
    }
}

function updateGreeting() {
    const greetingEl = document.getElementById("greeting");
    const greetingNameEl = document.getElementById("greeting-name");
    
    if (!greetingEl) return;

    const currentHour = new Date().getHours();
    let greetingText = "Good Evening";

    if (currentHour >= 3 && currentHour < 12) {
        greetingText = "Good Morning";
    } else if (currentHour >= 12 && currentHour < 18) {
        greetingText = "Good Afternoon";
    } else {
        greetingText = "Good Evening";
    }

    greetingEl.innerText = greetingText;

    // Menampilkan Sapaan Personal dengan Nama User yang Sedang Login[cite: 7]
    if (greetingNameEl) {
        const userName = localStorage.getItem("ledger_name");
        if (userName) {
            greetingNameEl.innerText = `Selamat datang, ${userName}`;
        } else {
            greetingNameEl.innerText = "Selamat datang di Ledger";
        }
    }
}

// A. Mengambil Data dari Apps Script Berdasarkan Username Aktif (GET)[cite: 7]
async function loadTransactions() {
    if (!API_URL) return;

    // Ambil username user yang sedang aktif dari memori browser[cite: 7]
    const currentUsername = localStorage.getItem("ledger_user");

    try {
        // Kirim parameter username ke Apps Script agar hanya mengambil data milik user tersebut[cite: 7]
        const response = await fetch(`${API_URL}?username=${currentUsername}`);
        const result = await response.json();

        if (result.status === "success" && Array.isArray(result.data)) {
            allTransactions = result.data; 
            
            updateSummaryCards(allTransactions);
            renderTable(allTransactions);
            renderCharts(allTransactions, currentChartRange); 
        }
    } catch (error) {
        console.error("Gagal mengambil data transaksi:", error);
    }
}

// B. Menghitung Balance, Income, & Expense[cite: 7]
function updateSummaryCards(data) {
    let income = 0, expense = 0;

    data.forEach(item => {
        const jenis = (item.jenis || "").toLowerCase();
        const nominal = Number(item.nominal) || 0;

        if (jenis === "income" || jenis === "pemasukan") income += nominal;
        else if (jenis === "expense" || jenis === "pengeluaran") expense += nominal;
    });

    const balance = income - expense;
    const formatRp = num => "Rp" + num.toLocaleString("id-ID");

    const elBalance = document.getElementById("total-balance");
    const elIncome = document.getElementById("total-income");
    const elExpense = document.getElementById("total-expense");

    if (elBalance) elBalance.innerText = formatRp(balance);
    if (elIncome) elIncome.innerText = formatRp(income);
    if (elExpense) elExpense.innerText = formatRp(expense);
}

// C. Menampilkan Tabel Interaktif dengan Checkbox & Klik Baris[cite: 7]
function renderTable(data) {
    const tbody = document.querySelector("tbody");
    const theadTr = document.querySelector("table thead tr");
    if (!tbody || !theadTr) return;

    // Tambahkan kolom checkbox pada header tabel[cite: 7]
    theadTr.innerHTML = `
        <th style="width: 40px;"><input type="checkbox" id="select-all-checkbox" title="Pilih Semua"></th>
        <th>Date</th>
        <th>Description</th>
        <th>Category</th>
        <th>Type</th>
        <th>Amount</th>
    `;

    tbody.innerHTML = "";
    const recentData = data.slice(-5).reverse();

    if (recentData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-light);">Belum ada transaksi</td></tr>`;
        updateSelectedCount();
        return;
    }

    recentData.forEach(item => {
        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        tr.innerHTML = `
            <td><input type="checkbox" class="select-checkbox" data-id="${item.id}"></td>
            <td>${item.tanggal || "-"}</td>
            <td>${item.deskripsi || "-"}</td>
            <td>${item.kategori || "-"}</td>
            <td>${item.jenis || "-"}</td>
            <td>Rp${(Number(item.nominal) || 0).toLocaleString("id-ID")}</td>
        `;

        // Interaksi Klik Baris: Memicu centang checkbox saat baris diketuk[cite: 7]
        tr.addEventListener("click", (e) => {
            if (e.target.tagName !== 'INPUT') {
                const cb = tr.querySelector(".select-checkbox");
                cb.checked = !cb.checked;
                updateSelectedCount();
            }
        });

        // Perbarui perhitungan saat checkbox diklik langsung[cite: 7]
        const cbInput = tr.querySelector(".select-checkbox");
        cbInput.addEventListener("change", updateSelectedCount);

        tbody.appendChild(tr);
    });

    // Fitur "Pilih Semua" pada header[cite: 7]
    const selectAllCb = document.getElementById("select-all-checkbox");
    if (selectAllCb) {
        selectAllCb.addEventListener("change", (e) => {
            const checkboxes = document.querySelectorAll(".select-checkbox");
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            updateSelectedCount();
        });
    }
}

// Menghitung jumlah baris yang dicentang dan memunculkan tombol hapus[cite: 7]
function updateSelectedCount() {
    const checkedCheckboxes = document.querySelectorAll(".select-checkbox:checked");
    const count = checkedCheckboxes.length;
    const countSpan = document.getElementById("selected-count");
    const deleteBtn = document.getElementById("delete-selected-btn");

    if (countSpan) countSpan.innerText = count;
    if (deleteBtn) {
        deleteBtn.style.display = count > 0 ? "inline-block" : "none";
    }
}

// D. RENDER GRAFIK ANALYTICS (CHART.JS) - Tampilan Elegan & Dinamis[cite: 7]
function renderCharts(transactions, daysLimit = 7) {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const textColor = isDark ? '#94A3B8' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    const tooltipBg = isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(15, 23, 42, 0.9)';
    const tooltipText = isDark ? '#0F172A' : '#ffffff';

    // === LOGIKA FILTER WAKTU ===
    let filteredTx = transactions;
    if (daysLimit !== 'all') {
        const now = new Date();
        filteredTx = transactions.filter(tx => {
            const txDate = new Date(tx.tanggal);
            if (isNaN(txDate.getTime())) return true; 
            
            const diffTime = Math.abs(now - txDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= daysLimit;
        });
    }

    const dateMap = {};
    const categoryMap = {};

    filteredTx.forEach(tx => {
        const date = tx.tanggal || "Unk";
        const jenis = (tx.jenis || "").toLowerCase();
        const nominal = Number(tx.nominal) || 0;
        
        if (!dateMap[date]) dateMap[date] = { income: 0, expense: 0 };

        if (jenis === "income" || jenis === "pemasukan") {
            dateMap[date].income += nominal;
        } else if (jenis === "expense" || jenis === "pengeluaran") {
            dateMap[date].expense += nominal;
            
            const kat = tx.kategori || "Lainnya";
            categoryMap[kat] = (categoryMap[kat] || 0) + nominal;
        }
    });

    const dates = Object.keys(dateMap);
    const incomeData = dates.map(d => dateMap[d].income);
    const expenseData = dates.map(d => dateMap[d].expense);

    // 1. Grafik Trend (Line Chart Elegan)[cite: 7]
    const ctxTrend = document.getElementById("trendChart");
    if (ctxTrend) {
        if (trendChartInstance) trendChartInstance.destroy();
        const trendCtx = ctxTrend.getContext('2d');

        const incomeGradient = trendCtx.createLinearGradient(0, 0, 0, 300);
        incomeGradient.addColorStop(0, 'rgba(37, 99, 235, 0.2)');
        incomeGradient.addColorStop(1, 'rgba(37, 99, 235, 0)');

        const expenseGradient = trendCtx.createLinearGradient(0, 0, 0, 300);
        expenseGradient.addColorStop(0, 'rgba(220, 38, 38, 0.2)');
        expenseGradient.addColorStop(1, 'rgba(220, 38, 38, 0)');

        trendChartInstance = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: dates.length > 0 ? dates : ['Belum ada data'],
                datasets: [
                    {
                        label: 'Income',
                        data: incomeData.length > 0 ? incomeData : [0],
                        borderColor: '#2563EB',
                        backgroundColor: incomeGradient,
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#2563EB'
                    },
                    {
                        label: 'Expense',
                        data: expenseData.length > 0 ? expenseData : [0],
                        borderColor: '#DC2626',
                        backgroundColor: expenseGradient,
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#DC2626'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { 
                        position: 'top', 
                        labels: { usePointStyle: true, boxWidth: 8, font: { family: "'Inter', sans-serif" }, color: textColor } 
                    },
                    tooltip: { backgroundColor: tooltipBg, titleColor: tooltipText, bodyColor: tooltipText, padding: 12, cornerRadius: 10, displayColors: true }
                },
                scales: {
                    x: { grid: { display: false }, border: { display: false }, ticks: { font: { family: "'Inter', sans-serif" }, color: textColor } },
                    y: { grid: { color: gridColor, borderDash: [5, 5] }, border: { display: false }, ticks: { font: { family: "'Inter', sans-serif" }, color: textColor, padding: 10 } }
                }
            }
        });
    }

    // 2. Grafik Kategori Pengeluaran (Doughnut Elegan)[cite: 7]
    const ctxCat = document.getElementById("categoryChart");
    if (ctxCat) {
        if (categoryChartInstance) categoryChartInstance.destroy();

        const catLabels = Object.keys(categoryMap);
        const catData = Object.values(categoryMap);

        categoryChartInstance = new Chart(ctxCat, {
            type: 'doughnut',
            data: {
                labels: catLabels.length > 0 ? catLabels : ['Belum ada data'],
                datasets: [{
                    data: catData.length > 0 ? catData : [1],
                    backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444', '#06b6d4'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, font: { family: "'Inter', sans-serif" }, color: textColor } },
                    tooltip: { backgroundColor: tooltipBg, titleColor: tooltipText, bodyColor: tooltipText, padding: 12, cornerRadius: 10 }
                },
                cutout: '75%'
            }
        });
    }
}

// E. Mengelola Dark / Light Mode (dan Update Chart Secara Otomatis)[cite: 7]
function initTheme() {
    const themeToggleBtn = document.getElementById("theme-toggle");
    const themeIcon = themeToggleBtn ? themeToggleBtn.querySelector("i") : null;

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        if (themeIcon) themeIcon.classList.replace("fa-moon", "fa-sun");
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", () => {
            const currentTheme = document.documentElement.getAttribute("data-theme");
            const targetTheme = currentTheme === "dark" ? "light" : "dark";

            document.documentElement.setAttribute("data-theme", targetTheme);
            localStorage.setItem("theme", targetTheme);

            if (themeIcon) {
                if (targetTheme === "dark") {
                    themeIcon.classList.replace("fa-moon", "fa-sun");
                } else {
                    themeIcon.classList.replace("fa-sun", "fa-moon");
                }
            }

            if (trendChartInstance || categoryChartInstance) {
                const isDark = targetTheme === "dark";
                const textColor = isDark ? '#94A3B8' : '#64748b';
                const gridColor = isDark ? '#334155' : '#e2e8f0';
                const tooltipBg = isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(15, 23, 42, 0.9)';
                const tooltipText = isDark ? '#0F172A' : '#ffffff';

                if (trendChartInstance) {
                    trendChartInstance.options.scales.x.ticks.color = textColor;
                    trendChartInstance.options.scales.y.ticks.color = textColor;
                    trendChartInstance.options.scales.y.grid.color = gridColor;
                    trendChartInstance.options.plugins.legend.labels.color = textColor;
                    trendChartInstance.options.plugins.tooltip.backgroundColor = tooltipBg;
                    trendChartInstance.options.plugins.tooltip.titleColor = tooltipText;
                    trendChartInstance.options.plugins.tooltip.bodyColor = tooltipText;
                    trendChartInstance.update();
                }

                if (categoryChartInstance) {
                    categoryChartInstance.options.plugins.legend.labels.color = textColor;
                    categoryChartInstance.options.plugins.tooltip.backgroundColor = tooltipBg;
                    categoryChartInstance.options.plugins.tooltip.titleColor = tooltipText;
                    categoryChartInstance.options.plugins.tooltip.bodyColor = tooltipText;
                    categoryChartInstance.update();
                }
            }
        });
    }
}

// ==========================================
// EFEK TAP / CLICK RIPPLE (ELEGANT UI)
// ==========================================
document.addEventListener("pointerdown", (e) => {
    const ripple = document.createElement("div");
    ripple.className = "click-ripple-effect";
    
    ripple.style.left = `${e.clientX}px`;
    ripple.style.top = `${e.clientY}px`;
    
    document.body.appendChild(ripple);

    ripple.addEventListener("animationend", () => {
        ripple.remove();
    });
});