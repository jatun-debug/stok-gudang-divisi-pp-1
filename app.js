import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, query, where, getDocs, serverTimestamp, runTransaction, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const appId = 'default-inventory-app';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let userId = null, userName = null, allProducts = [], allHistories = [], isInitialHistoryLoad = true;

const DOMElements = {
    productForm: document.getElementById('productForm'),
    searchInput: document.getElementById('searchInput'),
    categoryFilter: document.getElementById('categoryFilter'),
    productListEl: document.getElementById('productList'),
    historyListEl: document.getElementById('historyList'),
    userNameDisplay: document.getElementById('userNameDisplay'),
    nameModal: document.getElementById('nameModal'),
    nameForm: document.getElementById('nameForm'),
    userNameInput: document.getElementById('userNameInput'),
    toastContainer: document.getElementById('toast-container'),
    deleteConfirmModal: document.getElementById('deleteConfirmModal'),
    deleteMessage: document.getElementById('deleteMessage'),
    cancelDelete: document.getElementById('cancelDelete'),
    confirmDelete: document.getElementById('confirmDelete'),
    categorySelect: document.getElementById('productCategorySelect'),
    newCategoryInput: document.getElementById('newCategoryInput'),
    clearFormBtn: document.getElementById('clearFormBtn'),
    editProductModal: document.getElementById('editProductModal'),
    editProductForm: document.getElementById('editProductForm'),
    cancelEdit: document.getElementById('cancelEdit'),
    exportProductsBtn: document.getElementById('exportProductsBtn'),
    exportHistoryBtn: document.getElementById('exportHistoryBtn'),
    productNameInput: document.getElementById('productName'),
    productSuggestions: document.getElementById('productSuggestions'),
    historyDateFilter: document.getElementById('historyDateFilter'),
    // --- Elemen-elemen baru untuk modal pengurangan stok
    subtractModal: document.getElementById('subtractModal'),
    subtractForm: document.getElementById('subtractForm'),
    subtractProductName: document.getElementById('subtractProductName'),
    subtractReason: document.getElementById('subtractReason'),
    cancelSubtract: document.getElementById('cancelSubtract'),
    subtractProductIdInput: document.getElementById('subtractProductId'),
    subtractProductAmountInput: document.getElementById('subtractProductAmount')
};

const UI = {
    showModal(modal) { modal.classList.remove('invisible', 'opacity-0'); modal.querySelector('.modal-content').classList.remove('scale-95', 'opacity-0'); },
    closeModal(modal) { modal.classList.add('opacity-0'); modal.querySelector('.modal-content').classList.add('scale-95', 'opacity-0'); setTimeout(() => modal.classList.add('invisible'), 300); },
    showToast(message, type = 'info') {
        const colors = { info: 'bg-sky-500', success: 'bg-green-500', error: 'bg-red-500' };
        const toast = document.createElement('div');
        toast.className = `toast text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-lg transform translate-x-full opacity-0 ${colors[type]}`;
        toast.textContent = message;
        DOMElements.toastContainer.appendChild(toast);
        requestAnimationFrame(() => { toast.classList.remove('translate-x-full', 'opacity-0'); });
        setTimeout(() => { toast.classList.add('opacity-0'); toast.addEventListener('transitionend', () => toast.remove()); }, 4000);
    },
    showDeleteConfirm(productName, callback) { DOMElements.deleteMessage.textContent = `Produk "${productName}" akan dihapus permanen.`; this.showModal(DOMElements.deleteConfirmModal); DOMElements.confirmDelete.onclick = () => { this.closeModal(DOMElements.deleteConfirmModal); callback(true); }; DOMElements.cancelDelete.onclick = () => { this.closeModal(DOMElements.deleteConfirmModal); callback(false); }; },
    showEditModal(product) { DOMElements.editProductForm.editProductId.value = product.id; DOMElements.editProductForm.editProductName.value = product.name; DOMElements.editProductForm.editMinStock.value = product.minStock || 0; this.updateCategoryDropdowns(DOMElements.editProductForm.editProductCategory, product.category); this.showModal(DOMElements.editProductModal); },
    renderProducts() {
        const searchTerm = DOMElements.searchInput.value.toLowerCase();
        const selectedCategory = DOMElements.categoryFilter.value;
        const filtered = allProducts.filter(p => p.name.toLowerCase().includes(searchTerm) && (selectedCategory === 'all' || p.category === selectedCategory));
        DOMElements.productListEl.innerHTML = filtered.length === 0 ? '<tr><td colspan="4" class="text-center py-10 text-slate-400">Produk tidak ditemukan.</td></tr>'
        : filtered.map(p => {
            const isLow = p.stock <= p.minStock;
            return `<tr class="${isLow ? 'stock-low' : ''} transition-colors">
                <td class="px-6 py-4"><div class="text-sm font-medium text-white">${p.name}</div>${isLow ? '<div class="text-xs text-red-500 font-semibold">Stok menipis</div>' : ''}</td>
                <td class="px-6 py-4"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-sky-900/50 text-sky-300">${p.category}</span></td>
                <td class="px-6 py-4 text-center"><span class="text-lg font-semibold ${isLow ? 'text-red-500' : 'text-sky-400'}">${p.stock}</span><div class="text-xs text-slate-400">Min: ${p.minStock}</div></td>
                <td class="px-6 py-4 text-center text-sm font-medium"><button data-id="${p.id}" class="edit-btn text-slate-500 hover:text-sky-400 p-1 transition-colors" title="Edit Detail"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12V7a2 2 0 012-2h2.586l-4.586 4.586A2 2 0 015 12zM3 14a2 2 0 012-2h10a2 2 0 012 2v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2z" /></svg></button><button data-id="${p.id}" data-name="${p.name}" class="delete-btn text-slate-500 hover:text-red-500 p-1 transition-colors" title="Hapus Produk"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg></button></td>
            </tr>`
        }).join('');
    },
    updateCategoryDropdowns(element, selectedValue) {
        const categoryCounts = allProducts.reduce((acc, p) => {
            acc[p.category] = (acc[p.category] || 0) + 1;
            return acc;
        }, {});
        const categories = [...new Set(allProducts.map(p => p.category))].sort();

        if (element) { 
            element.innerHTML = ''; 
            categories.forEach(cat => element.innerHTML += `<option value="${cat}">${cat} (${categoryCounts[cat]})</option>`); 
            if (selectedValue) element.value = selectedValue; 
        } 
        else { 
            this.updateCategoryDropdowns(DOMElements.categoryFilter, DOMElements.categoryFilter.value); 
            DOMElements.categoryFilter.insertAdjacentHTML('afterbegin', `<option value="all">Semua Kategori (${allProducts.length})</option>`); 
            this.updateCategoryDropdowns(DOMElements.categorySelect, DOMElements.categorySelect.value); 
            DOMElements.categorySelect.insertAdjacentHTML('beforeend', '<option value="">Pilih Kategori</option><option value="--new--">-- Tambah Baru --</option>'); 
        }
    },
    renderProductSuggestions(searchTerm) {
        const normalizedSearchTerm = searchTerm.toLowerCase().trim();
        const productNames = [...new Set(allProducts.map(p => p.name))].sort();
        const filteredNames = productNames.filter(name => name.toLowerCase().includes(normalizedSearchTerm));
        
        DOMElements.productSuggestions.innerHTML = '';
        
        if (filteredNames.length > 0 && normalizedSearchTerm.length > 0) {
            filteredNames.forEach(name => {
                const suggestionEl = document.createElement('div');
                suggestionEl.className = 'flex items-center justify-between px-3 py-2 text-slate-200 hover:bg-slate-600 cursor-pointer';
                suggestionEl.innerHTML = `
                    <span class="suggestion-text">${name}</span>
                    <button type="button" class="delete-suggestion text-slate-400 hover:text-red-500" data-name="${name}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </button>
                `;
                DOMElements.productSuggestions.appendChild(suggestionEl);
                
                suggestionEl.querySelector('.suggestion-text').addEventListener('click', (e) => {
                    DOMElements.productNameInput.value = name;
                    UI.hideSuggestions();
                });
            });
            DOMElements.productSuggestions.classList.remove('hidden');
        } else {
            UI.hideSuggestions();
        }
    },
    hideSuggestions() {
        DOMElements.productSuggestions.classList.add('hidden');
    },
    renderHistory() {
        const selectedDate = DOMElements.historyDateFilter.value;
        const filteredHistories = selectedDate ? allHistories.filter(entry => {
            const entryDate = new Date(entry.timestamp.seconds * 1000);
            const formattedEntryDate = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`;
            return formattedEntryDate === selectedDate;
        }) : allHistories;

        DOMElements.historyListEl.innerHTML = filteredHistories.length === 0 ? '<tr><td colspan="6" class="text-center py-10 text-slate-400">Belum ada riwayat.</td></tr>' : filteredHistories.map(entry => { 
            const date = new Date(entry.timestamp.seconds * 1000).toLocaleString('id-ID'); 
            const isAddition = entry.type.includes('penambahan'); 
            const reasonDisplay = entry.reason ? `<td>${entry.reason}</td>` : `<td>-</td>`;
            return `<tr><td class="px-6 py-4 text-sm text-slate-400">${date}</td><td class="px-6 py-4 text-sm font-medium text-white">${entry.productName}</td><td class="px-6 py-4 text-sm font-semibold ${isAddition ? 'text-green-500' : 'text-red-500'}">${entry.type}</td><td class="px-6 py-4 text-sm font-semibold ${isAddition ? 'text-green-500' : 'text-red-500'}">${isAddition ? '+' : '-'}${entry.amount}</td><td class="px-6 py-4 text-sm text-white font-medium" title="ID: ${entry.userId}">${entry.userName || 'Tanpa Nama'}</td><td class="px-6 py-4 text-sm text-slate-400">${entry.reason || '-'}</td></tr>`; 
        }).join('');
    },
    resetForm() { DOMElements.productForm.reset(); DOMElements.newCategoryInput.classList.add('hidden'); }
};

function setupUser() { userName = localStorage.getItem('inventoryUserName'); if (userName) { DOMElements.userNameDisplay.textContent = userName; UI.closeModal(DOMElements.nameModal); } else { UI.showModal(DOMElements.nameModal); } }

const productsCollection = collection(db, `artifacts/${appId}/public/data/products`);
const historyCollection = collection(db, `artifacts/${appId}/public/data/history`);

function listenToData() {
    const loadingRowProducts = '<tr><td colspan="4" class="text-center py-10 text-slate-400"><span class="animate-pulse">Memuat data produk...</span></td></tr>';
    const loadingRowHistory = '<tr><td colspan="6" class="text-center py-10 text-slate-400"><span class="animate-pulse">Memuat riwayat...</span></td></tr>';
    DOMElements.productListEl.innerHTML = loadingRowProducts;
    DOMElements.historyListEl.innerHTML = loadingRowHistory;

    onSnapshot(query(productsCollection), (snapshot) => {
        allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.name.localeCompare(b.name));
        UI.updateCategoryDropdowns();
        UI.renderProducts();
    });
    onSnapshot(query(historyCollection), (snapshot) => {
        const changes = snapshot.docChanges();
        if (!isInitialHistoryLoad) {
            changes.forEach(change => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    if (data.userId !== userId) {
                        UI.showToast(`${data.userName} baru saja mengubah stok ${data.productName}.`);
                    }
                }
            });
        }
        allHistories = snapshot.docs.map(doc => doc.data()).sort((a, b) => b.timestamp.seconds - a.timestamp.seconds); 
        UI.renderHistory();
        isInitialHistoryLoad = false;
    });
}

function exportToXlsx(filename, rows) {
    if (rows.length === 0) {
        return UI.showToast("Tidak ada data untuk diekspor.", "error");
    }
    const dataToExport = rows.map(row => {
      const newRow = { ...row };
      if (newRow.timestamp && newRow.timestamp.seconds) {
        newRow.Waktu = new Date(newRow.timestamp.seconds * 1000).toLocaleString('id-ID');
        delete newRow.timestamp;
      }
      return newRow;
    });
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    XLSX.writeFile(workbook, filename);
}

// --- Event Listeners ---
DOMElements.searchInput.addEventListener('input', UI.renderProducts);
DOMElements.categoryFilter.addEventListener('change', UI.renderProducts);
DOMElements.clearFormBtn.addEventListener('click', UI.resetForm);
DOMElements.cancelEdit.addEventListener('click', () => UI.closeModal(DOMElements.editProductModal));
DOMElements.exportProductsBtn.addEventListener('click', () => exportToXlsx(`produk_stok_${new Date().toISOString().slice(0,10)}.xlsx`, allProducts.map(({id, createdAt, ...rest}) => rest)));
DOMElements.exportHistoryBtn.addEventListener('click', () => exportToXlsx(`riwayat_stok_${new Date().toISOString().slice(0,10)}.xlsx`, allHistories.map(({userId, ...rest}) => rest)));
DOMElements.categorySelect.addEventListener('change', (e) => { DOMElements.newCategoryInput.classList.toggle('hidden', e.target.value !== '--new--'); });
DOMElements.nameForm.addEventListener('submit', (e) => { e.preventDefault(); const name = DOMElements.userNameInput.value.trim(); if (name) { userName = name; localStorage.setItem('inventoryUserName', userName); DOMElements.userNameDisplay.textContent = name; UI.closeModal(DOMElements.nameModal); } });
DOMElements.productListEl.addEventListener('click', (e) => { const btn = e.target.closest('button'); if (!btn) return; const id = btn.dataset.id; const product = allProducts.find(p => p.id === id); if (btn.classList.contains('edit-btn')) { if (product) UI.showEditModal(product); } else if (btn.classList.contains('delete-btn')) { UI.showDeleteConfirm(btn.dataset.name, async (ok) => { if (ok) { try { await deleteDoc(doc(db, `artifacts/${appId}/public/data/products`, id)); UI.showToast(`Produk "${btn.dataset.name}" dihapus.`, 'success'); } catch (err) { UI.showToast("Gagal hapus produk.", "error"); } } }); } });
DOMElements.editProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = DOMElements.editProductForm.editProductId.value;
    const newName = DOMElements.editProductForm.editProductName.value.trim();
    const newCategory = DOMElements.editProductForm.editProductCategory.value;
    const newMinStock = parseInt(DOMElements.editProductForm.editMinStock.value);

    if (!id || !newName || !newCategory || isNaN(newMinStock)) {
        return UI.showToast("Semua kolom harus diisi.", "error");
    }

    const normalizedNewName = newName.toLowerCase().replace(/\s+/g, ' ').trim();

    try {
        const ref = doc(db, `artifacts/${appId}/public/data/products`, id);
        await runTransaction(db, async (t) => {
            t.update(ref, {
                name: newName,
                normalizedName: normalizedNewName,
                category: newCategory,
                minStock: newMinStock
            });
        });
        UI.showToast("Detail produk disimpan.", "success");
        UI.closeModal(DOMElements.editProductModal);
    } catch (err) {
        UI.showToast("Gagal simpan perubahan.", "error");
    }
});

// Modifikasi form utama: hanya menangani "Tambah Stok"
DOMElements.productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!userId || !userName) return UI.showToast("Harap masukkan nama Anda.", "error");

    const action = e.submitter.dataset.action;
    const productName = DOMElements.productForm.productName.value.trim();
    let category = DOMElements.categorySelect.value;
    if (category === '--new--') category = DOMElements.newCategoryInput.value.trim();
    
    const amount = parseFloat(DOMElements.productForm.changeAmount.value);
    const minStock = parseFloat(DOMElements.productForm.minStock.value);

    if (!productName || !category) {
        return UI.showToast("Nama produk dan kategori harus diisi.", "error");
    }
    if (isNaN(amount) || amount <= 0) {
        return UI.showToast("Jumlah harus berupa angka lebih dari 0.", "error");
    }
    if (isNaN(minStock) || minStock < 0) {
        return UI.showToast("Stok minimum harus berupa angka 0 atau lebih.", "error");
    }
    
    // Jika tombol "Kurangi Stok" yang diklik, tampilkan modal
    if (action === 'subtract') {
        const normalizedProductName = productName.toLowerCase().replace(/\s+/g, ' ').trim();
        const productQuery = query(collection(db, `artifacts/${appId}/public/data/products`), where("normalizedName", "==", normalizedProductName));
        const snapshot = await getDocs(productQuery);
        const existingDoc = snapshot.docs[0];

        if (!existingDoc) {
            UI.showToast("Tidak bisa mengurangi stok produk yang belum ada.", "error");
            return;
        }

        const productData = existingDoc.data();
        if (productData.stock < amount) {
            UI.showToast(`Stok tidak mencukupi: ${productData.stock}.`, "error");
            return;
        }

        DOMElements.subtractProductIdInput.value = existingDoc.id;
        DOMElements.subtractProductAmountInput.value = amount;
        DOMElements.subtractProductName.textContent = `Produk: ${productData.name}`;
        UI.showModal(DOMElements.subtractModal);
        return;
    }

    // Logika untuk "Tambah Stok"
    const normalizedProductName = productName.toLowerCase().replace(/\s+/g, ' ').trim();
    const addBtn = document.querySelector('button[data-action="add"]');
    const originalAddText = addBtn.innerHTML;

    addBtn.disabled = true;
    addBtn.innerHTML = '<span class="animate-pulse">Menyimpan...</span>';

    try {
        const productQuery = query(collection(db, `artifacts/${appId}/public/data/products`), where("normalizedName", "==", normalizedProductName));
        const snapshot = await getDocs(productQuery);
        const existingDoc = snapshot.docs[0];

        await runTransaction(db, async (transaction) => {
            let historyType = 'penambahan';
            if (existingDoc) {
                const productRef = existingDoc.ref;
                const productData = (await transaction.get(productRef)).data();
                transaction.update(productRef, { stock: productData.stock + amount });
            } else {
                const newProductRef = doc(collection(db, `artifacts/${appId}/public/data/products`));
                transaction.set(newProductRef, {
                    name: productName,
                    normalizedName: normalizedProductName,
                    category,
                    stock: amount,
                    minStock,
                    createdAt: serverTimestamp()
                });
                historyType = 'penambahan (baru)';
            }
            const newHistoryRef = doc(collection(db, `artifacts/${appId}/public/data/history`));
            transaction.set(newHistoryRef, { productName, type: historyType, amount, userId: userId, userName: userName, timestamp: serverTimestamp() });
        });

        UI.showToast(`Stok untuk "${productName}" berhasil diupdate.`, "success");
        UI.resetForm();
    } catch (error) {
        console.error("Transaction failed: ", error);
        UI.showToast(typeof error === 'string' ? error : "Gagal memproses transaksi.", "error");
    } finally {
        addBtn.disabled = false;
        addBtn.innerHTML = originalAddText;
    }
});

// Listener untuk form modal pengurangan stok
DOMElements.subtractForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = DOMElements.subtractProductIdInput.value;
    const amount = parseFloat(DOMElements.subtractProductAmountInput.value);
    const reason = DOMElements.subtractReason.value.trim();
    const productData = allProducts.find(p => p.id === id);

    if (!reason) {
        return UI.showToast("Alasan harus diisi.", "error");
    }

    const confirmBtn = document.querySelector('#subtractForm button[type="submit"]');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="animate-pulse">Menyimpan...</span>';

    try {
        await runTransaction(db, async (transaction) => {
            const productRef = doc(db, `artifacts/${appId}/public/data/products`, id);
            transaction.update(productRef, { stock: productData.stock - amount });
            const newHistoryRef = doc(collection(db, `artifacts/${appId}/public/data/history`));
            transaction.set(newHistoryRef, { 
                productName: productData.name, 
                type: 'pengurangan', 
                amount: amount, 
                userId: userId, 
                userName: userName, 
                timestamp: serverTimestamp(), 
                reason: reason 
            });
        });
        UI.showToast(`Stok untuk "${productData.name}" berhasil dikurangi.`, "success");
        UI.closeModal(DOMElements.subtractModal);
        UI.resetForm();
    } catch (error) {
        console.error("Transaction failed: ", error);
        UI.showToast(typeof error === 'string' ? error : "Gagal memproses transaksi.", "error");
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
    }
});

// Listener untuk tombol batal di modal pengurangan stok
DOMElements.cancelSubtract.addEventListener('click', () => {
    UI.closeModal(DOMElements.subtractModal);
});

DOMElements.productNameInput.addEventListener('input', (e) => {
    UI.renderProductSuggestions(e.target.value);
});

DOMElements.productSuggestions.addEventListener('click', (e) => {
    const btn = e.target.closest('.delete-suggestion');
    if (btn) {
        const productName = btn.dataset.name;
        UI.showDeleteConfirm(productName, async (ok) => {
            if (ok) {
                const productToDelete = allProducts.find(p => p.name === productName);
                if (productToDelete) {
                    try {
                        await deleteDoc(doc(db, `artifacts/${appId}/public/data/products`, productToDelete.id));
                        UI.showToast(`Produk "${productName}" dihapus.`, 'success');
                    } catch (err) {
                        UI.showToast("Gagal hapus produk.", "error");
                    }
                }
            }
        });
    }
});

document.addEventListener('click', (e) => {
    if (!DOMElements.productForm.contains(e.target)) {
        UI.hideSuggestions();
    }
});

DOMElements.historyDateFilter.addEventListener('change', UI.renderHistory);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        userId = user.uid;
        setupUser();
        listenToData();
    } else {
        try {
            if (typeof __initial_auth_token !== 'undefined') {
                await signInWithCustomToken(auth, __initial_auth_token);
            } else {
                await signInAnonymously(auth);
            }
        } catch (error) {
            console.error("Authentication failed:", error);
            UI.showToast("Gagal terhubung ke server.", "error");
        }
    }
});
