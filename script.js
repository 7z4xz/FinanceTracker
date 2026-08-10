// ==========================================
// CONFIGURATION API
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbyz5rYEeXVJKExadajLkoalhZgtBFRuRq1YHIWyxWD2jcmLxkblpsPw6mWekP_FtJeZ/exec";

// Variabel Global
let trendChartInstance = null;
let categoryChartInstance = null;
let allTransactions = []; // Menyimpan semua data dari Google Sheets
let currentChartRange = 1; // Default grafik menampilkan 1 hari terakhir (1D)

// ==========================================
// UTAMA: DOM CONTENT LOADED (SATU PINTU)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // A. PROTEKSI HALAMAN (ROUTE GUARDING)
    // ==========================================
    const currentUsername = localStorage.getItem("ledger_user");
    if (!currentUsername) {
        window.location.href = "login.html";
        return; 
    }

    // ==========================================
    // B. LOGIKA TOMBOL LOG OUT
    // ==========================================
    const logoutBtn = document.querySelector(".logout-item"); 
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            
            const isConfirm = await showConfirmDialog("Apakah Anda yakin ingin keluar dari aplikasi?");
            if (isConfirm) {
                localStorage.removeItem("ledger_user");
                localStorage.removeItem("ledger_name");
                window.location.href = "login.html";
            }
        });
    }

    init();
    initTheme();
    loadTransactions();

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

    const settingApiInput = document.getElementById("display-api-url");
    if (settingApiInput) settingApiInput.value = API_URL;

    // Deklarasi Elemen Modal & Form Transaksi
    const modal = document.getElementById("transaction-modal");
    const openModalBtn = document.getElementById("open-modal-btn");
    const closeModalBtn = document.getElementById("close-modal-btn");
    const cancelModalBtn = document.getElementById("cancel-btn");
    const transactionForm = document.getElementById("transaction-form");
    const submitBtn = document.getElementById("submit-btn");

    if (openModalBtn && modal) {
        openModalBtn.addEventListener("click", () => {
            modal.classList.remove("hidden");
            setTimeout(() => modal.classList.add("active"), 10);
            
            // Set input date & time secara terpisah dengan waktu lokal saat ini
            const tanggalInput = document.getElementById("tanggal-transaksi");
            const waktuInput = document.getElementById("waktu-transaksi");
            
            if (tanggalInput && waktuInput) {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');

                tanggalInput.value = `${year}-${month}-${day}`;
                waktuInput.value = `${hours}:${minutes}`;
            }
        });
    }

    const closeModal = () => {
        if (modal) {
            modal.classList.remove("active");
            setTimeout(() => modal.classList.add("hidden"), 300);
        }
        if (transactionForm) transactionForm.reset();
    };

    if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener("click", closeModal);
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });
    }

    if (transactionForm) {
        transactionForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const kategoriInput = document.getElementById("kategori");
            const nominalInput = document.getElementById("nominal");
            const deskripsiInput = document.getElementById("deskripsi");
            const tanggalInput = document.getElementById("tanggal-transaksi");
            const waktuInput = document.getElementById("waktu-transaksi");
            const selectedType = document.querySelector('input[name="jenis"]:checked');

            if (!nominalInput || !deskripsiInput || !selectedType) {
                showToast("Elemen form tidak lengkap di HTML!", "error");
                return;
            }

            const currentUsername = localStorage.getItem("ledger_user");
            const rawNominal = nominalInput.value.replace(/\./g, '');

            // Gabungkan tanggal dan waktu terpisah menjadi format standar
            const tglVal = tanggalInput ? tanggalInput.value : "";
            const wktVal = waktuInput ? waktuInput.value : "";
            const combinedTanggal = (tglVal && wktVal) ? `${tglVal}T${wktVal}` : tglVal;

            const formData = {
                action: "add_transaction", 
                username: currentUsername,  
                jenis: selectedType.value,  
                kategori: kategoriInput ? kategoriInput.value : "-",
                nominal: Number(rawNominal),
                deskripsi: deskripsiInput.value,
                tanggal: combinedTanggal
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
                    showToast("Transaksi berhasil disimpan!", "success");
                    closeModal();
                    loadTransactions();
                } else {
                    showToast("Gagal menyimpan: " + (result.message || "Terjadi kesalahan server."), "error");
                }
            } catch (error) {
                console.error("Error kirim data:", error);
                showToast("Gagal terhubung ke server.", "error");
            } finally {
                if (submitBtn) {
                    submitBtn.innerText = "Simpan Transaksi";
                    submitBtn.disabled = false;
                }
            }
        });
    }

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

    // ==========================================
    // WISHLIST INTERAKTIF
    // ==========================================
    const wishlistModal = document.getElementById("wishlist-modal");
    const openWishlistModalBtn = document.getElementById("open-wishlist-modal-btn");
    const closeWishlistModalBtn = document.getElementById("close-wishlist-modal-btn");
    const cancelWishlistBtn = document.getElementById("cancel-wishlist-btn");
    const wishlistForm = document.getElementById("wishlist-form");
    const wishlistHargaInput = document.getElementById("wishlist-harga");

    if (wishlistHargaInput) {
        wishlistHargaInput.addEventListener("input", function() {
            let value = this.value.replace(/[^0-9]/g, '');
            if (value) this.value = parseInt(value, 10).toLocaleString('id-ID');
            else this.value = '';
        });
    }

    if (openWishlistModalBtn && wishlistModal) {
        openWishlistModalBtn.addEventListener("click", () => {
            wishlistModal.classList.remove("hidden");
            setTimeout(() => wishlistModal.classList.add("active"), 10);
        });
    }

    const closeWishlistModal = () => {
        if (wishlistModal) {
            wishlistModal.classList.remove("active");
            setTimeout(() => wishlistModal.classList.add("hidden"), 300);
        }
        if (wishlistForm) wishlistForm.reset();
    };

    if (closeWishlistModalBtn) closeWishlistModalBtn.addEventListener("click", closeWishlistModal);
    if (cancelWishlistBtn) cancelWishlistBtn.addEventListener("click", closeWishlistModal);
    if (wishlistModal) {
        wishlistModal.addEventListener("click", (e) => {
            if (e.target === wishlistModal) closeWishlistModal();
        });
    }

    if (wishlistForm) {
        wishlistForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const namaInput = document.getElementById("wishlist-nama");
            const hargaInput = document.getElementById("wishlist-harga");

            if (!namaInput || !hargaInput) return;

            const rawHarga = hargaInput.value.replace(/\./g, '');
            const targetHarga = Number(rawHarga);

            if (targetHarga <= 0) {
                showToast("Target harga harus lebih dari 0!", "error");
                return;
            }

            const newWishlist = {
                id: 'WISH-' + Date.now(),
                nama: namaInput.value.trim(),
                harga: targetHarga
            };

            const wishlists = getWishlists();
            wishlists.push(newWishlist);
            saveWishlists(wishlists);

            showToast("Wishlist berhasil ditambahkan!", "success");
            closeWishlistModal();
            renderWishlists();
        });
    }

    // ==========================================
    // HAPUS TRANSAKSI TERPILIH
    // ==========================================
    const deleteSelectedBtn = document.getElementById("delete-selected-btn");
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener("click", async () => {
            const selectedCheckboxes = document.querySelectorAll(".select-checkbox:checked");
            if (selectedCheckboxes.length === 0) return;

            const isConfirm = await showConfirmDialog(`Apakah Anda yakin ingin menghapus ${selectedCheckboxes.length} transaksi terpilih? Saldo akan dikalkulasi ulang.`);
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
                    showToast("Transaksi terpilih berhasil dihapus!", "success");
                    loadTransactions(); 
                } else {
                    showToast("Gagal menghapus transaksi.", "error");
                }
            } catch (error) {
                console.error(error);
                showToast("Terjadi kesalahan jaringan.", "error");
            } finally {
                deleteSelectedBtn.innerText = "Hapus Terpilih";
                deleteSelectedBtn.disabled = false;
            }
        });
    }

    // ==========================================
    // SIDEBAR PROFIL KANAN
    // ==========================================
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
                        base64Avatar = canvas.toDataURL('image/jpeg', 0.7);
                        profileAvatarImg.src = base64Avatar;
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

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
                    updateNavbarAvatar(result.photo);
                } else {
                    profileAvatarImg.src = "https://via.placeholder.com/100";
                    updateNavbarAvatar("");
                }
            }
        } catch (error) {
            console.error("Gagal memuat profil:", error);
        }
    }

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
                    showToast("Profil berhasil diperbarui!", "success");
                    localStorage.setItem("ledger_user", result.username);
                    localStorage.setItem("ledger_name", result.nama);

                    updateNavbarAvatar(base64Avatar);
                    updateGreeting();
                    closeProfilePanel();
                    loadTransactions();
                } else {
                    showToast("Gagal memperbarui profil: " + (result.message || "Kesalahan server"), "error");
                }
            } catch (error) {
                console.error(error);
                showToast("Gagal terhubung ke server.", "error");
            } finally {
                saveProfileBtn.innerText = "Simpan Perubahan";
                saveProfileBtn.disabled = false;
            }
        });
    }

    // ==========================================
    // FILTER GRAFIK WAKTU
    // ==========================================
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

    // Navigasi & Hamburger Menu
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

function getWishlists() {
    const username = localStorage.getItem("ledger_user");
    if (!username) return [];
    try {
        return JSON.parse(localStorage.getItem(`ledger_wishlists_${username}`)) || [];
    } catch(e) {
        return [];
    }
}

function saveWishlists(list) {
    const username = localStorage.getItem("ledger_user");
    if (!username) return;
    localStorage.setItem(`ledger_wishlists_${username}`, JSON.stringify(list));
}

function renderWishlists() {
    const container = document.getElementById("wishlist-container");
    if (!container) return;

    const wishlists = getWishlists();
    
    // Hitung total balance saat ini dari allTransactions
    let income = 0, expense = 0;
    allTransactions.forEach(item => {
        const jenis = (item.jenis || "").toLowerCase();
        const nominal = Number(item.nominal) || 0;
        if (jenis === "income" || jenis === "pemasukan") income += nominal;
        else if (jenis === "expense" || jenis === "pengeluaran") expense += nominal;
    });
    const currentBalance = income - expense;

    if (wishlists.length === 0) {
        container.innerHTML = `
            <div class="card" style="padding: 20px; text-align: center; color: var(--text-light);">
                Belum ada wishlist yang ditambahkan.
            </div>
        `;
        return;
    }

    container.innerHTML = "";
    wishlists.forEach(item => {
        let percentage = 0;
        if (item.harga > 0) {
            percentage = (currentBalance / item.harga) * 100;
            if (percentage < 0) percentage = 0;
            if (percentage > 100) percentage = 100; // Maksimal 100%
        }
        const percentFormatted = percentage.toFixed(1);

        const card = document.createElement("div");
        card.className = "card";
        card.style.cssText = "padding: 20px; position: relative;";
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div>
                    <h3 style="font-size: 16px; margin: 0 0 4px 0; color: var(--text);">${item.nama}</h3>
                    <span style="font-size: 13px; color: var(--text-light);">Target: Rp${item.harga.toLocaleString("id-ID")}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 15px; font-weight: 700; color: var(--primary);">${percentFormatted}%</span>
                    <button class="delete-wishlist-btn" data-id="${item.id}" title="Hapus Wishlist" style="background: none; border: none; color: var(--danger); cursor: pointer; font-size: 16px;"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
            <div style="background: var(--border-color, #334155); border-radius: 10px; height: 10px; width: 100%; overflow: hidden;">
                <div class="wishlist-bar-fill" style="background: linear-gradient(90deg, var(--primary), #10b981); width: 0%; height: 100%; border-radius: 10px; transition: width 1.2s cubic-bezier(0.25, 1, 0.5, 1);"></div>
            </div>
        `;

        // Tombol hapus wishlist item
        card.querySelector(".delete-wishlist-btn").addEventListener("click", async () => {
            const isConfirm = await showConfirmDialog(`Hapus wishlist "${item.nama}" dari daftar?`);
            if (isConfirm) {
                const updated = getWishlists().filter(w => w.id !== item.id);
                saveWishlists(updated);
                showToast("Wishlist berhasil dihapus.", "success");
                renderWishlists();
            }
        });

        container.appendChild(card);

        // Memicu animasi geser (gliding animation) dengan sedikit jeda waktu
        setTimeout(() => {
            const fillBar = card.querySelector(".wishlist-bar-fill");
            if (fillBar) {
                fillBar.style.width = `${percentFormatted}%`;
            }
        }, 50);
    });
}

function init() {
    console.log("FinanceTracker App Started");
    updateGreeting(); 
}

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

    if (greetingNameEl) {
        const userName = localStorage.getItem("ledger_name");
        if (userName) {
            greetingNameEl.innerText = `Selamat datang, ${userName}`;
        } else {
            greetingNameEl.innerText = "Selamat datang di Ledger";
        }
    }
}

async function loadTransactions() {
    if (!API_URL) return;

    const currentUsername = localStorage.getItem("ledger_user");

    try {
        const response = await fetch(`${API_URL}?username=${currentUsername}`);
        const result = await response.json();

        if (result.status === "success" && Array.isArray(result.data)) {
            allTransactions = result.data; 
            
            updateSummaryCards(allTransactions);
            renderTable(allTransactions);
            renderCharts(allTransactions, currentChartRange); 
            renderWishlists(); 
        }
    } catch (error) {
        console.error("Gagal mengambil data transaksi:", error);
    }
}

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

function renderTable(data) {
    const tbody = document.querySelector("tbody");
    const theadTr = document.querySelector("table thead tr");
    if (!tbody || !theadTr) return;

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

        tr.addEventListener("click", (e) => {
            if (e.target.tagName !== 'INPUT') {
                const cb = tr.querySelector(".select-checkbox");
                cb.checked = !cb.checked;
                updateSelectedCount();
            }
        });

        const cbInput = tr.querySelector(".select-checkbox");
        cbInput.addEventListener("change", updateSelectedCount);

        tbody.appendChild(tr);
    });

    const selectAllCb = document.getElementById("select-all-checkbox");
    if (selectAllCb) {
        selectAllCb.addEventListener("change", (e) => {
            const checkboxes = document.querySelectorAll(".select-checkbox");
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            updateSelectedCount();
        });
    }
}

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

// =======================================================
// RENDER GRAFIK ANALYTICS (TREN SALDO SATU GARIS)
// =======================================================
function renderCharts(transactions, daysLimit = 1) {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const textColor = isDark ? '#94A3B8' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    const tooltipBg = isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(15, 23, 42, 0.9)';
    const tooltipText = isDark ? '#0F172A' : '#ffffff';

    const sortedTx = [...transactions].sort((a, b) => {
        const dateA = new Date(a.tanggal).getTime();
        const dateB = new Date(b.tanggal).getTime();
        return (dateA || 0) - (dateB || 0);
    });

    let runningBalance = 0;
    const txWithBalance = sortedTx.map(tx => {
        const jenis = (tx.jenis || "").toLowerCase();
        const nominal = Number(tx.nominal) || 0;
        const isIncome = (jenis === "income" || jenis === "pemasukan");
        
        if (isIncome) runningBalance += nominal;
        else runningBalance -= nominal;
        
        return { ...tx, balance: runningBalance, isIncome };
    });

    let filteredTx = txWithBalance;
    if (daysLimit !== 'all') {
        const now = new Date();
        filteredTx = txWithBalance.filter(tx => {
            const txDate = new Date(tx.tanggal);
            if (isNaN(txDate.getTime())) return true; 
            const diffTime = Math.abs(now - txDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= daysLimit;
        });
    }

    const labels = [];
    const dataPoints = [];
    const pointColors = [];
    const categoryMap = {};

    const formatDateTime = (dateStr) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
        const day = d.getDate();
        const month = months[d.getMonth()];
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${day} ${month} ${hh}:${mm}`;
    };

    filteredTx.forEach(tx => {
        labels.push(formatDateTime(tx.tanggal));
        dataPoints.push(tx.balance);
        pointColors.push(tx.isIncome ? '#2563EB' : '#DC2626');

        if (!tx.isIncome) {
            const kat = tx.kategori || "Lainnya";
            const nominal = Number(tx.nominal) || 0;
            categoryMap[kat] = (categoryMap[kat] || 0) + nominal;
        }
    });

    const ctxTrend = document.getElementById("trendChart");
    if (ctxTrend) {
        if (trendChartInstance) trendChartInstance.destroy();
        const trendCtx = ctxTrend.getContext('2d');

        trendChartInstance = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: labels.length > 0 ? labels : ['Belum ada data'],
                datasets: [{
                    label: 'Total Saldo',
                    data: dataPoints.length > 0 ? dataPoints : [0],
                    borderWidth: 3,
                    tension: 0.3,
                    fill: false,
                    pointRadius: labels.length > 0 ? 5 : 0,
                    pointHoverRadius: 8,
                    pointBackgroundColor: pointColors.length > 0 ? pointColors : '#94A3B8',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    segment: {
                        borderColor: ctx => {
                            if (ctx.p0.parsed.y < ctx.p1.parsed.y) return '#2563EB';
                            if (ctx.p0.parsed.y > ctx.p1.parsed.y) return '#DC2626';
                            return '#94A3B8';
                        }
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: { 
                        backgroundColor: tooltipBg, 
                        titleColor: tooltipText, 
                        bodyColor: tooltipText, 
                        padding: 12, 
                        cornerRadius: 10, 
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return 'Total Saldo: Rp' + context.parsed.y.toLocaleString('id-ID');
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        grid: { display: false }, 
                        border: { display: false }, 
                        ticks: { font: { family: "'Inter', sans-serif" }, color: textColor, maxTicksLimit: 6 } 
                    },
                    y: { 
                        grid: { color: gridColor, borderDash: [5, 5] }, 
                        border: { display: false }, 
                        ticks: { font: { family: "'Inter', sans-serif" }, color: textColor, padding: 10 } 
                    }
                }
            }
        });
    }

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

function initTheme() {
    const lightRadio = document.getElementById("mode-light");
    const darkRadio = document.getElementById("mode-dark");
    const themeRadios = document.querySelectorAll('input[name="theme_mode"]');

    const savedTheme = localStorage.getItem("theme") || "light";
    
    if (savedTheme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        if (darkRadio) darkRadio.checked = true;
    } else {
        document.documentElement.setAttribute("data-theme", "light");
        if (lightRadio) lightRadio.checked = true;
    }

    themeRadios.forEach(radio => {
        radio.addEventListener("change", (e) => {
            const targetTheme = e.target.value;
            
            document.documentElement.setAttribute("data-theme", targetTheme);
            localStorage.setItem("theme", targetTheme);

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
    });
}

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

function showToast(message, type = "success") {
    let container = document.getElementById("toast-container");
    
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let iconClass = "fa-solid fa-circle-check"; 
    if (type === "error") iconClass = "fa-solid fa-circle-exclamation";
    if (type === "warning") iconClass = "fa-solid fa-triangle-exclamation";

    toast.innerHTML = `
        <i class="${iconClass} toast-icon"></i>
        <span style="flex: 1;">${message}</span>
        <i class="fa-solid fa-xmark toast-close"></i>
    `;

    container.appendChild(toast);

    const timer = setTimeout(() => {
        removeToast(toast);
    }, 3000);

    toast.querySelector(".toast-close").addEventListener("click", () => {
        clearTimeout(timer);
        removeToast(toast);
    });
}

function removeToast(toast) {
    toast.classList.add("toast-leave");
    toast.addEventListener("animationend", () => {
        toast.remove();
    });
}

function showConfirmDialog(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay active";
        overlay.style.zIndex = "10000"; 

        const box = document.createElement("div");
        box.className = "modal-box"; 
        box.style.maxWidth = "350px";
        box.innerHTML = `
            <div class="modal-header" style="margin-bottom: 15px;">
                <h2 style="font-size: 18px; color: var(--text);">Konfirmasi</h2>
            </div>
            <p style="margin-bottom: 25px; font-size: 14px; color: var(--text-light); line-height: 1.5;">${message}</p>
            <div class="modal-actions" style="margin-top: 0;">
                <button id="confirm-no" class="btn-secondary">Batal</button>
                <button id="confirm-yes" class="btn-primary" style="background: var(--danger);">Ya, Hapus</button>
            </div>
        `;
        
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const btnYes = box.querySelector("#confirm-yes");
        const btnNo = box.querySelector("#confirm-no");

        const closeDialog = (result) => {
            overlay.classList.remove("active");
            setTimeout(() => overlay.remove(), 300);
            resolve(result);
        };

        btnYes.onclick = () => closeDialog(true);
        btnNo.onclick = () => closeDialog(false);
    });
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker terdaftar!', reg))
            .catch(err => console.log('Gagal mendaftarkan Service Worker:', err));
    });
}