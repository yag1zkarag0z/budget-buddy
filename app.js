/* ==========================================================================
   🧠 BUDGETBUDDY CORE FINANCE ENGINE & STORAGE PROXY
   ========================================================================== */

// --- 1. GLOBAL STATE (Uygulama Hafızası) ---
let transactions = [];
let expenseChart = null;

// --- 2. STORAGE SERVICE (Şemadaki StorageService Katmanı) ---
const StorageService = {
    // LocalStorage'dan verileri güvenli bir şekilde çeker (Try-Catch Sigortası)
    loadTransactions() {
        try {
            const data = localStorage.getItem('budget_transactions');
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error("StorageService Error: Data corruption detected.", error);
            return [];
        }
    },
    
    // Veriyi LocalStorage'a kaydeder (Şemadaki 4. ve 5. Adım)
    saveTransactions(data) {
        try {
            localStorage.setItem('budget_transactions', JSON.stringify(data));
            return true;
        } catch (error) {
            console.error("StorageService Error: Write operation failed.", error);
            return false;
        }
    }
};

// --- 3. FINANCE ENGINE (Hesaplama ve Veri Doğrulama Motoru) ---
const FinanceEngine = {
    // Veri Doğrulama Katmanı (Şemadaki 2. Adım)
    validate(description, amount) {
        if (!description.trim()) return { valid: false, message: "Description cannot be empty." };
        if (isNaN(amount) || amount <= 0) return { valid: false, message: "Amount must be a positive number." };
        return { valid: true };
    },

    // Metrikleri Hesaplar (Şemadaki 7. Adım)
    calculateMetrics() {
        return transactions.reduce((acc, tx) => {
            const amount = parseFloat(tx.amount);
            if (tx.type === 'income') {
                acc.income += amount;
                acc.balance += amount;
            } else {
                acc.expense += amount;
                acc.balance -= amount;
            }
            return acc;
        }, { income: 0, expense: 0, balance: 0 });
    },

    // Grafik için kategori bazlı gider dağılımını hesaplar
    calculateCategoryBreakdown() {
        const categories = { Food: 0, Rent: 0, Entertainment: 0, Other: 0 };
        
        transactions.forEach(tx => {
            // Sadece giderleri (expense) kategorilere bölüyoruz
            if (tx.type === 'expense' && categories[tx.category] !== undefined) {
                categories[tx.category] += parseFloat(tx.amount);
            }
        });

        return categories;
    }
};

// --- 4. DOM RENDER ENGINE (UI Katmanı - Şemadaki 8. Adım) ---
const UIEngine = {
    // Sayfadaki metrik kartlarını günceller (Tabular noları basar)
    updateMetricsCard() {
        const metrics = FinanceEngine.calculateMetrics();
        
        document.getElementById('total-income').innerText = `$${metrics.income.toFixed(2)}`;
        document.getElementById('total-expense').innerText = `$${metrics.expense.toFixed(2)}`;
        
        const balanceEl = document.getElementById('net-balance');
        balanceEl.innerText = `$${metrics.balance.toFixed(2)}`;
        
        // Bakiye eksiye düştüyse rengini soft kırmızı yap, artıdaysa indigo yap
        if (metrics.balance < 0) {
            balanceEl.style.color = "var(--fin-rose)";
        } else {
            balanceEl.style.color = "var(--fin-indigo)";
        }
    },

    // İşlem geçmişi tablosunu doldurur
    updateTable() {
        const historyBody = document.getElementById('transaction-history');
        historyBody.innerHTML = ''; // Eski satırları temizle

        if (transactions.length === 0) {
            historyBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 32px;">No transactions found. Add some to get started!</td></tr>`;
            return;
        }

        // En son eklenen işlem en üstte görünsün diye diziyi ters çevirip dönüyoruz
        [...transactions].reverse().forEach(tx => {
            const tr = document.createElement('tr');
            
            const badgeClass = tx.type === 'income' ? 'bg-income' : 'bg-expense';
            const valClass = tx.type === 'income' ? 'val-income' : 'val-expense';
            const prefix = tx.type === 'income' ? '+' : '-';

            tr.innerHTML = `
                <td>${tx.description}</td>
                <td><span class="badge ${badgeClass}">${tx.category}</span></td>
                <td style="text-transform: capitalize; color: var(--text-silver);">${tx.type}</td>
                <td class="${valClass}">${prefix}$${parseFloat(tx.amount).toFixed(2)}</td>
                <td>
                    <button class="delete-btn" onclick="UIEngine.handleDelete('${tx.id}')">
                        <i class="ph ph-trash"></i>
                    </button>
                </td>
            `;
            historyBody.appendChild(tr);
        });
    },

    // Chart.js Donut Grafiğini Günceller (Premium Lüks Renklerle)
    updateChart() {
        const ctx = document.getElementById('expenseChart').getContext('2d');
        const breakdown = FinanceEngine.calculateCategoryBreakdown();
        
        const dataValues = [breakdown.Food, breakdown.Rent, breakdown.Entertainment, breakdown.Other];
        const totalExpenses = dataValues.reduce((a, b) => a + b, 0);

        // Eğer hiç harcama yoksa grafiği boş göstermemek için nötr bir gri halka çiziyoruz
        if (totalExpenses === 0) {
            if (expenseChart) expenseChart.destroy();
            expenseChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['No Expenses'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['rgba(255, 255, 255, 0.05)'],
                        borderWidth: 0
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
            return;
        }

        // Eğer grafik zaten varsa verilerini güncelle, yoksa sıfırdan yarat (Performans Optimizasyonu)
        if (expenseChart) {
            expenseChart.data.datasets[0].data = dataValues;
            expenseChart.update();
        } else {
            expenseChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Food & Drinks', 'Rent & Bills', 'Entertainment', 'Other'],
                    datasets: [{
                        data: dataValues,
                        backgroundColor: [
                            '#10b981', // Food - Emerald
                            '#6366f1', // Rent - Indigo
                            '#f43f5e', // Entertainment - Rose
                            '#9ca3af'  // Other - Silver
                        ],
                        borderWidth: 1,
                        borderColor: '#030712' // Arka plan rengiyle uyumlu şık border çizgi
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#9ca3af',
                                font: { size: 12, family: 'sans-serif' },
                                boxWidth: 12,
                                padding: 16
                            }
                        }
                    },
                    cutout: '75%' // Ortadaki boşluğu genişleterek daha ince, modern bir halka yapıyoruz
                }
            });
        }
    },

    // Harcama ekleme formunun yönetimi (Şemadaki 1. Adım Başlangıcı)
    handleFormSubmit(e) {
        e.preventDefault();

        const description = document.getElementById('tx-description').value;
        const amount = parseFloat(document.getElementById('tx-amount').value);
        const type = document.getElementById('tx-type').value;
        const category = document.getElementById('tx-category').value;

        // Doğrulama kontrolü
        const check = FinanceEngine.validate(description, amount);
        if (!check.valid) {
            alert(check.message);
            return;
        }

        // Yeni Veri Paketi (Payload)
        const newTransaction = {
            id: '_' + Math.random().toString(36).substr(2, 9), // Basit benzersiz ID üretimi
            description,
            amount,
            type,
            category
        };

        // State'e ekle ve Storage'a göm (Şemadaki 3. ve 6. Adımlar)
        transactions.push(newTransaction);
        if (StorageService.saveTransactions(transactions)) {
            // UI Güncellemeleri
            this.updateMetricsCard();
            this.updateTable();
            this.updateChart();
            
            // Formu temizle
            document.getElementById('transaction-form').reset();
        }
    },

    // Silme Butonu Yönetimi (CRUD Yapısı)
    handleDelete(id) {
        // İlgili ID'ye sahip elemanı diziden ayıkla
        transactions = transactions.filter(tx => tx.id !== id);
        
        if (StorageService.saveTransactions(transactions)) {
            this.updateMetricsCard();
            this.updateTable();
            this.updateChart();
        }
    }
};

// --- 5. INITIALIZATION PROTOCOL (Uygulamayı Ateşleyen Alan) ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Verileri hafızadan yükle
    transactions = StorageService.loadTransactions();

    // 2. Form submit dinleyicisini bağla
    document.getElementById('transaction-form').addEventListener('submit', (e) => UIEngine.handleFormSubmit(e));

    // 3. Ekranı ilk verilerle render et
    UIEngine.updateMetricsCard();
    UIEngine.updateTable();
    UIEngine.updateChart();
});
