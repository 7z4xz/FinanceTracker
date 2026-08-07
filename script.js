// ==========================================
// CONFIGURATION API
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbyF4SASlVzCxMRZSDObqwnbZ9DjmzePEl4sJVNj0krBH_NqelFfeo2GjB9TPBNBG7i9/exec";

// Variabel Global untuk Chart.js
let trendChartInstance = null;
let categoryChartInstance = null;

// ==========================================
// UTAMA: DOM CONTENT LOADED (SATU PINTU)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Inisialisasi Aplikasi & Dark Mode
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

    // Fungsi Buka Modal (Menggunakan class 'active')
    if (openModalBtn && modal) {
        openModalBtn.addEventListener("click", () => {
            modal.classList.remove("hidden");
            setTimeout(() => modal.classList.add("active"), 10); // Trigger animasi
        });
    }

    // Fungsi Tutup Modal & Reset Form
    const closeModal = () => {
        if (modal) {
            modal.classList.remove("active"); // Hilangkan animasi dulu
            setTimeout(() => {
                modal.classList.add("hidden"); // Sembunyikan setelah animasi selesai
            }, 300);
        }
        if (transactionForm) {
            transactionForm.reset();
        }
    };

    if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
    if (cancelModalBtn) closeModalBtn.addEventListener("click", closeModal);

    // Tutup modal jika user klik area luar (overlay)
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                closeModal();
            }
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

    // 6 & 8. NAVIGASI SIDEBAR (KLIK & SCROLLSPY)
    const navItems = document.querySelectorAll(".sidebar-nav .nav-item");
    const sections = document.querySelectorAll("main section[id]");

    // A. Fungsi saat menu sidebar diklik (Smooth Scroll)
    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();

            const targetId = item.getAttribute("data-target");
            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

                navItems.forEach(nav => nav.classList.remove("active"));
                item.classList.add("active");
            }
        });
    });

    // B. Fungsi ScrollSpy (Warna biru pindah otomatis saat halaman di-scroll)
    const observerOptions = {
        root: null,
        rootMargin: "-10% 0px -50% 0px",
        threshold: 0
    };

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
                    if (item.getAttribute("data-target") === currentId) {
                        item.classList.add("active");
                    }
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => {
        observer.observe(section);
    });
});

// ==========================================
// FUNGSI PENDUKUNG / HELPER
// ==========================================

function init() {
    console.log("FinanceTracker App Started");
}

// A. Mengambil Data dari Apps Script (GET)
async function loadTransactions() {
    if (!API_URL) return;

    try {
        const response = await fetch(API_URL);
        const result = await response.json();

        if (result.status === "success" && Array.isArray(result.data)) {
            updateSummaryCards(result.data);
            renderTable(result.data);
            renderCharts(result.data); // Render grafik analitik otomatis
        }
    } catch (error) {
        console.error("Gagal mengambil data transaksi:", error);
    }
}

// B. Menghitung Balance, Income, & Expense
function updateSummaryCards(data) {
    let income = 0;
    let expense = 0;

    data.forEach(item => {
        const jenis = (item.jenis || "").toLowerCase();
        const nominal = Number(item.nominal) || 0;

        if (jenis === "income" || jenis === "pemasukan") {
            income += nominal;
        } else if (jenis === "expense" || jenis === "pengeluaran") {
            expense += nominal;
        }
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

// D. RENDER GRAFIK ANALYTICS (CHART.JS)
function renderCharts(transactions) {
    let totalIncome = 0;
    let totalExpense = 0;
    const categoryMap = {};

    transactions.forEach(tx => {
        const jenis = (tx.jenis || "").toLowerCase();
        const nominal = Number(tx.nominal) || 0;

        if (jenis === "income" || jenis === "pemasukan") {
            totalIncome += nominal;
        } else if (jenis === "expense" || jenis === "pengeluaran") {
            totalExpense += nominal;
            const kat = tx.kategori || "Lainnya";
            categoryMap[kat] = (categoryMap[kat] || 0) + nominal;
        }
    });

    // 1. Grafik Trend (Income vs Expense)
    const ctxTrend = document.getElementById("trendChart");
    if (ctxTrend) {
        if (trendChartInstance) trendChartInstance.destroy();
        
        trendChartInstance = new Chart(ctxTrend, {
            type: 'bar',
            data: {
                labels: ['Income', 'Expense'],
                datasets: [{
                    label: 'Total (Rp)',
                    data: [totalIncome, totalExpense],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } }
            }
        });
    }

    // 2. Grafik Kategori Pengeluaran
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
                    backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
                }]
            },
            options: {
                responsive: true
            }
        });
    }
}

// E. Mengelola Dark / Light Mode
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
        });
    }
}

// ------------------------------------------
    // 7. HAMBARGER MENU MOBILE TOGGLE
    // ------------------------------------------
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const sidebar = document.querySelector(".sidebar");

    if (hamburgerBtn && sidebar) {
        // Klik tombol hamburger untuk buka/tutup sidebar
        hamburgerBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            sidebar.classList.toggle("mobile-open");
        });

        // Tutup sidebar jika pengguna mengklik area luar sidebar di HP
        document.addEventListener("click", (e) => {
            if (window.innerWidth <= 768) {
                if (!sidebar.contains(e.target) && !hamburgerBtn.contains(e.target)) {
                    sidebar.classList.remove("mobile-open");
                }
            }
        });

        // Tutup sidebar otomatis saat salah satu menu diklik di HP
        const navLinks = sidebar.querySelectorAll(".nav-item");
        navLinks.forEach(link => {
            link.addEventListener("click", () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove("mobile-open");
                }
            });
        });
    }

// Tambahkan fungsi ini di script.js Anda
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

// Pastikan dipanggil di dalam fungsi init() atau DOMContentLoaded
function init() {
    console.log("FinanceTracker App Started");
    updateGreeting(); // <-- Panggil di sini
}