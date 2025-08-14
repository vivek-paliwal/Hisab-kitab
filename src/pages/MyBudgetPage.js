import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../utils/firebase';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';
import { formatCurrency } from '../utils/formatCurrency';

function MyBudgetPage() {
  const [budgetPlans, setBudgetPlans] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [newPlan, setNewPlan] = useState({ category: '', budgetedAmount: '', suggestion: '' });
  const [editIndex, setEditIndex] = useState(-1);
  const [currentSpending, setCurrentSpending] = useState({});
  const [transactions, setTransactions] = useState([]);
  const { currentUser, userData } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (currentUser) {
      loadBudgetPlans();
      loadTransactions();
    }
  }, [currentUser]);

  const loadBudgetPlans = async () => {
    if (!currentUser) return;
    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.monthlyBudgetPlans) {
          try {
            const plans = JSON.parse(userData.monthlyBudgetPlans);
            setBudgetPlans(Array.isArray(plans) ? plans : []);
          } catch (error) {
            console.error("Error parsing budget plans:", error);
            setBudgetPlans([]);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load budget plans:", error);
      showToast('Failed to load budget plans', 'error');
    }
  };

  const loadTransactions = async () => {
    if (!currentUser) return;
    try {
      const transactionsRef = collection(db, "users", currentUser.uid, "transactions");
      const snapshot = await getDocs(transactionsRef);
      const transactionsList = [];
      snapshot.forEach((doc) => {
        transactionsList.push({ id: doc.id, ...doc.data() });
      });
      setTransactions(transactionsList);
      calculateCurrentSpending(transactionsList);
    } catch (error) {
      console.error("Error loading transactions:", error);
    }
  };

  const calculateCurrentSpending = (transactionsList) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const spending = {};
    transactionsList.forEach(transaction => {
      if (transaction.type === 'expense') {
        const transactionDate = new Date(transaction.date);
        if (transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear) {
          spending[transaction.category] = (spending[transaction.category] || 0) + transaction.amount;
        }
      }
    });
    setCurrentSpending(spending);
  };

  const updateFirebasePlans = async (plans) => {
    if (!currentUser) return;
    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(userDocRef, {
        monthlyBudgetPlans: JSON.stringify(plans),
        monthlyBudgetPlans_updated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error updating budget plans:", error);
      throw error;
    }
  };

  const handleEdit = (plan, index) => {
    setEditingPlan({ ...plan });
    setEditIndex(index);
    setShowEditModal(true);
  };

  const handleDelete = async (index) => {
    if (window.confirm('Are you sure you want to delete this budget item?')) {
      try {
        const newPlans = budgetPlans.filter((_, i) => i !== index);
        setBudgetPlans(newPlans);
        await updateFirebasePlans(newPlans);
        showToast('Budget item deleted successfully!', 'success');
      } catch (error) {
        showToast('Failed to delete budget item', 'error');
      }
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const newPlans = [...budgetPlans];
      newPlans[editIndex] = {
        ...editingPlan,
        budgetedAmount: parseFloat(editingPlan.budgetedAmount)
      };
      setBudgetPlans(newPlans);
      await updateFirebasePlans(newPlans);
      setShowEditModal(false);
      setEditingPlan(null);
      setEditIndex(-1);
      showToast('Budget item updated successfully!', 'success');
    } catch (error) {
      showToast('Failed to update budget item', 'error');
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const newBudgetItem = {
        category: newPlan.category,
        budgetedAmount: parseFloat(newPlan.budgetedAmount),
        suggestion: newPlan.suggestion || `Monitor your ${newPlan.category} spending carefully.`
      };
      const newPlans = [...budgetPlans, newBudgetItem];
      setBudgetPlans(newPlans);
      await updateFirebasePlans(newPlans);
      setShowAddModal(false);
      setNewPlan({ category: '', budgetedAmount: '', suggestion: '' });
      showToast('Budget item added successfully!', 'success');
    } catch (error) {
      showToast('Failed to add budget item', 'error');
    }
  };

  const getSpendingPercentage = (category, budgetedAmount) => {
    const spent = currentSpending[category] || 0;
    return budgetedAmount > 0 ? (spent / budgetedAmount) * 100 : 0;
  };

  const getProgressColor = (percentage) => {
    if (percentage <= 50) return 'bg-green-500';
    if (percentage <= 80) return 'bg-yellow-500';
    if (percentage <= 100) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getTotalBudget = () => {
    return budgetPlans.reduce((sum, plan) => sum + (plan.budgetedAmount || 0), 0);
  };

  const getTotalSpent = () => {
    return Object.values(currentSpending).reduce((sum, amount) => sum + amount, 0);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="My Budget" showProfile={true} showMenu={true} />
      
      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="bg-light-secondary dark:bg-brand-secondary p-8 rounded-2xl border border-light-tertiary dark:border-transparent shadow-2xl w-full max-w-md m-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-accent">Edit Budget Item</h2>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-light-subtle dark:text-brand-subtle text-2xl font-bold hover:text-error"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Category</label>
                <input 
                  type="text" 
                  value={editingPlan?.category || ''}
                  onChange={(e) => setEditingPlan(prev => ({ ...prev, category: e.target.value }))}
                  required 
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Budgeted Amount</label>
                <input 
                  type="number" 
                  value={editingPlan?.budgetedAmount || ''}
                  onChange={(e) => setEditingPlan(prev => ({ ...prev, budgetedAmount: e.target.value }))}
                  required 
                  min="0"
                  step="0.01"
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Suggestion</label>
                <textarea 
                  rows="3" 
                  value={editingPlan?.suggestion || ''}
                  onChange={(e) => setEditingPlan(prev => ({ ...prev, suggestion: e.target.value }))}
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-accent text-white font-bold py-3 px-4 rounded-lg hover:bg-opacity-90 transition-transform transform hover:scale-105"
              >
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="bg-light-secondary dark:bg-brand-secondary p-8 rounded-2xl border border-light-tertiary dark:border-transparent shadow-2xl w-full max-w-md m-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-accent">Add Budget Item</h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-light-subtle dark:text-brand-subtle text-2xl font-bold hover:text-error"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Category</label>
                <input 
                  type="text" 
                  value={newPlan.category}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, category: e.target.value }))}
                  required 
                  placeholder="e.g., Food, Transport, Entertainment"
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Budgeted Amount</label>
                <input 
                  type="number" 
                  value={newPlan.budgetedAmount}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, budgetedAmount: e.target.value }))}
                  required 
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Suggestion (Optional)</label>
                <textarea 
                  rows="3" 
                  value={newPlan.suggestion}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, suggestion: e.target.value }))}
                  placeholder="Add tips or reminders for this category"
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-accent text-white font-bold py-3 px-4 rounded-lg hover:bg-opacity-90 transition-transform transform hover:scale-105"
              >
                Add Budget Item
              </button>
            </form>
          </div>
        </div>
      )}

      <main className="flex-grow p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-light-secondary dark:bg-brand-secondary p-6 rounded-2xl border border-light-tertiary dark:border-transparent">
              <p className="text-sm text-light-subtle dark:text-brand-subtle">Total Budget</p>
              <p className="text-2xl font-bold text-accent">{formatCurrency(getTotalBudget(), true)}</p>
            </div>
            <div className="bg-light-secondary dark:bg-brand-secondary p-6 rounded-2xl border border-light-tertiary dark:border-transparent">
              <p className="text-sm text-light-subtle dark:text-brand-subtle">Total Spent</p>
              <p className="text-2xl font-bold">{formatCurrency(getTotalSpent(), true)}</p>
            </div>
            <div className="bg-light-secondary dark:bg-brand-secondary p-6 rounded-2xl border border-light-tertiary dark:border-transparent">
              <p className="text-sm text-light-subtle dark:text-brand-subtle">Remaining</p>
              <p className={`text-2xl font-bold ${getTotalBudget() - getTotalSpent() >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatCurrency(getTotalBudget() - getTotalSpent(), true)}
              </p>
            </div>
          </div>

          {/* Budget Items */}
          <div className="space-y-6">
            {budgetPlans.length === 0 ? (
              <div className="text-center py-12">
                <i className="fa-solid fa-wallet text-6xl text-light-subtle dark:text-brand-subtle mb-4"></i>
                <p className="text-light-subtle dark:text-brand-subtle mb-4">You haven't created a budget plan yet.</p>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="bg-accent text-white font-bold py-3 px-6 rounded-lg hover:bg-opacity-90 transition"
                >
                  <i className="fa-solid fa-plus mr-2"></i>Create Manual Budget
                </button>
              </div>
            ) : (
              budgetPlans.map((plan, index) => {
                const spent = currentSpending[plan.category] || 0;
                const percentage = getSpendingPercentage(plan.category, plan.budgetedAmount);
                const remaining = plan.budgetedAmount - spent;
                
                return (
                  <div key={index} className="bg-light-secondary dark:bg-brand-secondary p-6 rounded-2xl border border-light-tertiary dark:border-transparent relative">
                    <div className="absolute top-4 right-4 space-x-2">
                      <button 
                        onClick={() => handleEdit(plan, index)}
                        className="text-light-subtle dark:text-brand-subtle hover:text-accent" 
                        title="Edit"
                      >
                        <i className="fa-solid fa-pencil"></i>
                      </button>
                      <button 
                        onClick={() => handleDelete(index)}
                        className="text-light-subtle dark:text-brand-subtle hover:text-error" 
                        title="Delete"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                    
                    <div className="pr-16">
                      <h3 className="text-xl font-bold text-accent">{plan.category}</h3>
                      
                      <div className="grid grid-cols-3 gap-4 mt-4 mb-4">
                        <div>
                          <p className="text-xs text-light-subtle dark:text-brand-subtle">Budget</p>
                          <p className="font-bold">{formatCurrency(plan.budgetedAmount, true)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-light-subtle dark:text-brand-subtle">Spent</p>
                          <p className={`font-bold ${percentage > 100 ? 'text-red-500' : ''}`}>
                            {formatCurrency(spent, true)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-light-subtle dark:text-brand-subtle">Remaining</p>
                          <p className={`font-bold ${remaining < 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {formatCurrency(remaining, true)}
                          </p>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4">
                        <div 
                          className={`h-2.5 rounded-full ${getProgressColor(percentage)}`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-light-subtle dark:text-brand-subtle">
                          {percentage.toFixed(1)}% used
                        </span>
                        {percentage > 100 && (
                          <span className="text-red-500 font-semibold">
                            <i className="fa-solid fa-exclamation-triangle mr-1"></i>
                            Over budget!
                          </span>
                        )}
                      </div>
                      
                      {plan.suggestion && (
                        <p className="text-sm text-light-subtle dark:text-brand-subtle mt-3">
                          <i className="fa-solid fa-lightbulb mr-2 text-yellow-400"></i>
                          {plan.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default MyBudgetPage;