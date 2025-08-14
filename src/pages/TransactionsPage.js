import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../utils/firebase';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';

function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    category: ''
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [categories, setCategories] = useState([]);
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  // Real-time transaction listener
  useEffect(() => {
    if (currentUser) {
      const transactionsRef = collection(db, "users", currentUser.uid, "transactions");
      const q = query(transactionsRef, orderBy("date", "desc"));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const transactionData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTransactions(transactionData);
        
        // Extract unique categories
        const uniqueCategories = [...new Set(transactionData.map(tx => tx.category))];
        setCategories(uniqueCategories.sort());
      });

      return () => unsubscribe();
    }
  }, [currentUser]);

  // Apply filters
  useEffect(() => {
    let filtered = transactions;

    if (filters.search) {
      filtered = filtered.filter(tx => 
        tx.description.toLowerCase().includes(filters.search.toLowerCase()) ||
        tx.category.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    if (filters.type) {
      filtered = filtered.filter(tx => tx.type === filters.type);
    }

    if (filters.category) {
      filtered = filtered.filter(tx => tx.category === filters.category);
    }

    setFilteredTransactions(filtered);
  }, [transactions, filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEdit = (transaction) => {
    setEditingTransaction({
      ...transaction,
      date: new Date(transaction.date).toISOString().split('T')[0]
    });
    setShowEditModal(true);
  };

  const handleDelete = async (transactionId) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        await deleteDoc(doc(db, "users", currentUser.uid, "transactions", transactionId));
        showToast('Transaction deleted successfully.', 'success');
      } catch (error) {
        console.error('Error deleting transaction:', error);
        showToast('Failed to delete transaction.', 'error');
      }
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const { id, ...updateData } = editingTransaction;
      await updateDoc(doc(db, "users", currentUser.uid, "transactions", id), {
        ...updateData,
        amount: parseFloat(updateData.amount)
      });
      
      showToast('Transaction updated successfully!', 'success');
      setShowEditModal(false);
      setEditingTransaction(null);
    } catch (error) {
      console.error('Error updating transaction:', error);
      showToast('Failed to update transaction.', 'error');
    }
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Transaction History" showProfile={true} showMenu={true} />
      
      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="bg-light-secondary dark:bg-brand-secondary rounded-2xl shadow-2xl w-full max-w-md p-6 border border-light-tertiary dark:border-brand-primary">
            <h2 className="text-2xl font-bold mb-4 text-accent">Edit Transaction</h2>
            <form onSubmit={handleEditSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-light-subtle dark:text-brand-subtle mb-1">Description</label>
                <input 
                  type="text" 
                  value={editingTransaction.description}
                  onChange={(e) => setEditingTransaction(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition" 
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-light-subtle dark:text-brand-subtle mb-1">Amount</label>
                  <input 
                    type="number" 
                    value={editingTransaction.amount}
                    onChange={(e) => setEditingTransaction(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-light-subtle dark:text-brand-subtle mb-1">Date</label>
                  <input 
                    type="date" 
                    value={editingTransaction.date}
                    onChange={(e) => setEditingTransaction(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition" 
                    required 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-light-subtle dark:text-brand-subtle mb-1">Category</label>
                  <input 
                    type="text" 
                    value={editingTransaction.category}
                    onChange={(e) => setEditingTransaction(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-light-subtle dark:text-brand-subtle mb-1">Type</label>
                  <select 
                    value={editingTransaction.type}
                    onChange={(e) => setEditingTransaction(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition" 
                    required
                  >
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)}
                  className="bg-light-tertiary dark:bg-brand-tertiary px-6 py-2 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-brand-primary transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-accent text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main className="flex-grow p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto bg-light-secondary dark:bg-brand-secondary p-6 rounded-2xl border border-light-tertiary dark:border-transparent">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <input 
              type="text" 
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Search transactions..." 
              className="md:col-span-2 w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
            />
            <select 
              name="type"
              value={filters.type}
              onChange={handleFilterChange}
              className="w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
            >
              <option value="">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <select 
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
              className="w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Transactions Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-light-tertiary dark:border-brand-tertiary">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Description</th>
                  <th className="p-4">Category</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center p-8 text-light-subtle dark:text-brand-subtle">No transactions found.</td>
                  </tr>
                ) : (
                  filteredTransactions.map(tx => {
                    const isIncome = tx.type === 'income';
                    return (
                      <tr key={tx.id} className="border-b border-light-tertiary dark:border-brand-tertiary">
                        <td className="p-4 text-light-subtle dark:text-brand-subtle">{formatDate(tx.date)}</td>
                        <td className="p-4 font-semibold">{tx.description}</td>
                        <td className="p-4">{tx.category}</td>
                        <td className={`p-4 text-right font-semibold ${isIncome ? 'text-success' : 'text-error'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                        </td>
                        <td className="p-4 text-center space-x-2">
                          <button 
                            onClick={() => handleEdit(tx)}
                            className="p-1 text-light-subtle dark:text-brand-subtle hover:text-accent" 
                            title="Edit"
                          >
                            <i className="fa-solid fa-pencil"></i>
                          </button>
                          <button 
                            onClick={() => handleDelete(tx.id)}
                            className="p-1 text-light-subtle dark:text-brand-subtle hover:text-error" 
                            title="Delete"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default TransactionsPage;