// ==========================================
// CONFIGURATION API
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbyF4SASlVzCxMRZSDObqwnbZ9DjmzePEl4sJVNj0krBH_NqelFfeo2GjB9TPBNBG7i9/exec";

// Variabel Global
let trendChartInstance = null;
let categoryChartInstance = null;
let allTransactions = []; // Menyimpan semua data dari Google Sheets
let currentChartRange = 7; // Default grafik menampilkan 7 hari terakhir (1W)

// ==========================================
// UTAMA: DOM CONTENT LOADED (SATU PINTU)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Inisialisasi Aplikasi, Waktu, & Dark Mode
    init();
    initTheme();

    // 2. Memuat Data Awal dari Google Sheets via API
    loadTransactions();

    // Tampilkan URL API di halaman Settings
    const settingApiInput = document.getElementById("display-api-url");
    if (settingApiInput) {
        settingApiInput.value = API_URL;
    }

    // 3. Deklarasi Elemen Modal & Form
    const modal = document.getElementById("transaction-modal");
    const openModalBtn = document.getElementById("open-modal-btn");
    const closeModalBtn = document.getElementById("close-modal-btn");
    const cancelModalBtn = document.getElementById("cancel-btn");
    const transactionForm = document.getElementById("transaction-form");
    const submitBtn = document.getElementById("submit-btn");

    // Fungsi Buka Modal
    if (openModalBtn && modal) {
        openModalBtn.addEventListener("click", () => {
            modal.classList.remove("hidden");
            setTimeout(() => modal.classList.add("active"), 10);
        });
    }

    // Fungsi Tutup Modal & Reset Form
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

    // 4. Penanganan Submit Form Transaksi
    if (transactionForm) {
        transactionForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const jenisInput = document.getElementById("jenis");
            const kategoriInput = document.getElementById("kategori");
            const nominalInput = document.getElementById("nominal");
            const deskripsiInput = document.getElementById("deskripsi");

            if (!jenisInput || !nominalInput || !deskripsiInput) {
                alert("Elemen form tidak lengkap di HTML!");
                return;
            }

            const formData = {
                jenis: jenisInput.value,
                kategori: kategoriInput ? kategoriInput.value : "-",
                nominal: Number(nominalInput.value),
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

    // 5. FITUR RESET SEMUA DATA
    const resetBtn = document.getElementById("reset-btn");
    if (resetBtn) {
        resetBtn.addEventListener("click", async () => {
            const isConfirm = confirm("PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA data transaksi? Saldo akan kembali menjadi 0 dan data di Google Sheets akan dibersihkan.");
            
            if (isConfirm) {
                resetBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
                resetBtn.disabled = true;

                try {
                    const response = await fetch(API_URL, {
                        method: "POST",
                        body: JSON.stringify({ action: "reset" })
                    });
                    const result = await response.json();
                    
                    if (result.status === "success") {
                        alert("Semua data berhasil dibersihkan!");
                        loadTransactions(); 
                    } else {
                        alert("Gagal mereset: " + result.message);
                    }
                } catch (error) {
                    alert("Terjadi kesalahan jaringan saat mencoba mereset.");
                    console.error(error);
                } finally {
                    resetBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i>`;
                    resetBtn.disabled = false;
                }
            }
        });
    }

    // 6. FITUR TOMBOL FILTER GRAFIK (1W, 1M, 3M, 1Y, All)
    const filterBtns = document.querySelectorAll(".filter-btn");
    if (filterBtns.length > 0) {
        filterBtns.forEach(btn => {
            btn.addEventListener("click", (e) => {
                // Hapus warna aktif dari semua tombol, lalu aktifkan yang diklik
                filterBtns.forEach(b => b.classList.remove("active"));
                e.target.classList.add("active");

                // Ambil rentang waktu dari atribut data-range
                const range = e.target.getAttribute("data-range");
                currentChartRange = range === 'all' ? 'all' : parseInt(range);

                // Render ulang grafik menggunakan data yang tersimpan
                renderCharts(allTransactions, currentChartRange);
            });
        });
    }

    // 7. NAVIGASI SIDEBAR (KLIK & SCROLLSPY)
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

    // 8. HAMBARGER MENU MOBILE TOGGLE
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
    updateGreeting(); // Update teks sapaan sesuai waktu
}

function updateGreeting() {
    const greetingEl = document.getElementById("greeting");
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
}

// A. Mengambil Data dari Apps Script (GET)
async function loadTransactions() {
    if (!API_URL) return;

    try {
        const response = await fetch(API_URL);
        const result = await response.json();

        if (result.status === "success" && Array.isArray(result.data)) {
            allTransactions = result.data; // Simpan data secara global
            
            updateSummaryCards(allTransactions);
            renderTable(allTransactions);
            renderCharts(allTransactions, currentChartRange); // Render grafik dengan filter default
        }
    } catch (error) {
        console.error("Gagal mengambil data transaksi:", error);
    }
}

// B. Menghitung Balance, Income, & Expense
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

// C. Menampilkan 5 Transaksi Terbaru di Tabel
function renderTable(data) {
    const tbody = document.querySelector("tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    const recentData = data.slice(-5).reverse();

    recentData.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${item.tanggal || "-"}</td>
            <td>${item.deskripsi || "-"}</td>
            <td>${item.kategori || "-"}</td>
            <td>${item.jenis || "-"}</td>
            <td>Rp${(Number(item.nominal) || 0).toLocaleString("id-ID")}</td>
        `;
        tbody.appendChild(tr);
    });
}

// D. RENDER GRAFIK ANALYTICS (CHART.JS) - Tampilan Elegan & Dinamis
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
            // Jika format gagal diparsing (Invalid Date), lewatkan filter agar tetap muncul
            if (isNaN(txDate.getTime())) return true; 
            
            const diffTime = Math.abs(now - txDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= daysLimit;
        });
    }

    // Olah data transaksi harian untuk Line Chart berdasarkan data yang difilter
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
            
            // Kumpulkan kategori
            const kat = tx.kategori || "Lainnya";
            categoryMap[kat] = (categoryMap[kat] || 0) + nominal;
        }
    });

    const dates = Object.keys(dateMap);
    const incomeData = dates.map(d => dateMap[d].income);
    const expenseData = dates.map(d => dateMap[d].expense);

    // 1. Grafik Trend (Line Chart Elegan)
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

    // 2. Grafik Kategori Pengeluaran (Doughnut Elegan)
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

// E. Mengelola Dark / Light Mode (dan Update Chart Secara Otomatis)
function initTheme() {
    const themeToggleBtn = document.getElementById("theme-toggle");
    const themeIcon = themeToggleBtn ? themeToggleBtn.querySelector("i") : null;

    // Set tema awal saat dimuat
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        if (themeIcon) themeIcon.classList.replace("fa-moon", "fa-sun");
    }

    // Aksi Klik Tombol
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

            // === UPDATE WARNA GRAFIK AGAR MENGIKUTI TEMA ===
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