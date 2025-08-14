import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, collection, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../utils/firebase';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';

const steps = [
  { id: 1, title: "Account Setup" },
  { id: 2, title: "Monthly Income" },
  { id: 3, title: "Initial Expenses" },
  { id: 4, title: "Recurring Bills" },
  { id: 5, title: "Goals & Limits" },
  { id: 6, title: "Future Plans" }
];

function PersonalizePage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    initialBalance: '',
    additionalAccounts: [],
    monthlyIncomes: [],
    expenses: {},
    recurringExpenses: [],
    savingsGoal: '',
    budgetLimits: {},
    upcomingExpenses: '',
    longTermGoal: ''
  });
  const [loading, setLoading] = useState(false);
  const [initialIncomeAdded, setInitialIncomeAdded] = useState(false);
  const { currentUser, userData } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const topCategories = userData?.onboardingAnswers?.top_categories || [];
  const defaultCategories = ['Rent', 'Food', 'Travel', 'Shopping'];
  const combinedCategories = [...new Set([...topCategories, ...defaultCategories])].slice(0, 4);

  useEffect(() => {
    if (!initialIncomeAdded && userData?.onboardingAnswers?.occupation) {
      const occupation = userData.onboardingAnswers.occupation;
      if (occupation === 'Salaried') {
        addIncomeRow('Salary');
      } else if (occupation === 'Student') {
        addIncomeRow('Stipend/Allowance');
      } else {
        addIncomeRow('Primary Income');
      }
      setInitialIncomeAdded(true);
    }
  }, [userData, initialIncomeAdded]);

  const addAccountRow = () => {
    setFormData(prev => ({
      ...prev,
      additionalAccounts: [...prev.additionalAccounts, { name: '', balance: '' }]
    }));
  };

  const addIncomeRow = (source = '') => {
    const today = new Date().toISOString().split('T')[0];
    setFormData(prev => ({
      ...prev,
      monthlyIncomes: [...prev.monthlyIncomes, { source, amount: '', date: today }]
    }));
  };

  const removeIncomeRow = (index) => {
    setFormData(prev => ({
      ...prev,
      monthlyIncomes: prev.monthlyIncomes.filter((_, i) => i !== index)
    }));
  };

  const addRecurringRow = () => {
    setFormData(prev => ({
      ...prev,
      recurringExpenses: [...prev.recurringExpenses, { description: '', amount: '', dueDate: '' }]
    }));
  };

  const handleArrayChange = (arrayName, index, field, value) => {
    setFormData(prev => ({
      ...prev,
      [arrayName]: prev[arrayName].map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleExpenseChange = (category, value) => {
    setFormData(prev => ({
      ...prev,
      expenses: { ...prev.expenses, [category]: value }
    }));
  };

  const handleBudgetLimitChange = (category, value) => {
    setFormData(prev => ({
      ...prev,
      budgetLimits: { ...prev.budgetLimits, [category]: value }
    }));
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const batch = writeBatch(db);
      const transactionsColRef = collection(db, "users", currentUser.uid, "transactions");
      const today = new Date().toISOString().split('T')[0];

      // Add initial balance
      if (formData.initialBalance) {
        const initialBalanceDoc = doc(transactionsColRef);
        batch.set(initialBalanceDoc, {
          type: 'income',
          description: 'Initial Balance',
          amount: parseFloat(formData.initialBalance),
          category: 'Initial Balance',
          date: today,
          createdAt: serverTimestamp()
        });
      }

      // Add additional accounts
      formData.additionalAccounts.forEach(account => {
        if (account.name && account.balance) {
          const accountDoc = doc(transactionsColRef);
          batch.set(accountDoc, {
            type: 'income',
            description: `Initial Balance (${account.name})`,
            amount: parseFloat(account.balance),
            category: 'Initial Balance',
            date: today,
            createdAt: serverTimestamp()
          });
        }
      });

      // Add monthly incomes (filter out empty entries)
      formData.monthlyIncomes
        .filter(income => income.source && income.amount)
        .forEach(income => {
          const incomeDoc = doc(transactionsColRef);
          batch.set(incomeDoc, {
            type: 'income',
            description: income.source,
            amount: parseFloat(income.amount),
            category: 'Income',
            date: income.date || today,
            createdAt: serverTimestamp()
          });
        });

      // Add initial expenses
      Object.entries(formData.expenses).forEach(([category, amount]) => {
        if (amount) {
          const expenseDoc = doc(transactionsColRef);
          batch.set(expenseDoc, {
            type: 'expense',
            description: category,
            amount: parseFloat(amount),
            category: category,
            date: today,
            createdAt: serverTimestamp()
          });
        }
      });

      // Update user document with personalization data
      const userDocRef = doc(db, "users", currentUser.uid);
      const personalizationData = {
        recurringExpenses: formData.recurringExpenses.filter(expense => 
          expense.description && expense.amount && expense.dueDate
        ),
        savingsGoal: formData.savingsGoal ? parseFloat(formData.savingsGoal) : null,
        budgetLimits: Object.fromEntries(
          Object.entries(formData.budgetLimits).filter(([_, amount]) => amount)
        ),
        upcomingExpenses: formData.upcomingExpenses,
        longTermGoal: formData.longTermGoal,
        personalizationComplete: true
      };

      batch.update(userDocRef, personalizationData);

      await batch.commit();
      navigate('/dashboard');

    } catch (error) {
      console.error("Personalization Error:", error);
      showToast("An error occurred while saving. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Account Setup</h2>
            <p className="text-sm text-light-subtle dark:text-brand-subtle">Start with your current balances to get an accurate financial picture.</p>
            
            <div>
              <label className="font-semibold block mb-1">Primary Account Balance</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-light-subtle dark:text-brand-subtle">₹</span>
                <input 
                  type="number" 
                  value={formData.initialBalance}
                  onChange={(e) => setFormData(prev => ({ ...prev, initialBalance: e.target.value }))}
                  className="block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-2.5 pl-6 focus:ring-accent focus:border-accent transition" 
                  placeholder="50,000"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold block mb-1">Other Balances (UPI, other banks)</label>
              {formData.additionalAccounts.map((account, index) => (
                <div key={index} className="space-y-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-2 mt-2">
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-light-subtle dark:text-brand-subtle mb-1">Account Name</label>
                    <input 
                      type="text" 
                      placeholder="Account Name (e.g., Paytm)"
                      value={account.name}
                      onChange={(e) => handleArrayChange('additionalAccounts', index, 'name', e.target.value)}
                      className="bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-2.5 focus:ring-accent focus:border-accent transition"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-light-subtle dark:text-brand-subtle mb-1">Balance</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-light-subtle dark:text-brand-subtle">₹</span>
                      <input 
                        type="number" 
                        placeholder="Balance"
                        value={account.balance}
                        onChange={(e) => handleArrayChange('additionalAccounts', index, 'balance', e.target.value)}
                        className="bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-2.5 pl-6 focus:ring-accent focus:border-accent transition w-full"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button 
                type="button" 
                onClick={addAccountRow}
                className="w-full text-center py-2.5 bg-accent/10 dark:bg-accent/20 text-accent font-semibold rounded-lg hover:bg-accent/20 dark:hover:bg-accent/30 transition-colors mt-2"
              >
                <i className="fa-solid fa-plus mr-2"></i>Add Account
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Monthly Income</h2>
            <p className="text-sm text-light-subtle dark:text-brand-subtle">Log any income you've received so far this month.</p>
            
            {formData.monthlyIncomes.map((income, index) => (
              <div key={index} className="space-y-2 md:space-y-0 md:grid md:grid-cols-3 md:gap-2 relative">
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-light-subtle dark:text-brand-subtle mb-1">Source</label>
                  <input 
                    type="text" 
                    placeholder="Source"
                    value={income.source}
                    onChange={(e) => handleArrayChange('monthlyIncomes', index, 'source', e.target.value)}
                    className="bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-2.5 focus:ring-accent focus:border-accent transition"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-light-subtle dark:text-brand-subtle mb-1">Amount</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-light-subtle dark:text-brand-subtle">₹</span>
                    <input 
                      type="number" 
                      placeholder="15,000"
                      value={income.amount}
                      onChange={(e) => handleArrayChange('monthlyIncomes', index, 'amount', e.target.value)}
                      className="bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-2.5 pl-6 focus:ring-accent focus:border-accent transition w-full"
                    />
                  </div>
                </div>
                <div className="flex flex-col relative">
                  <label className="text-xs font-medium text-light-subtle dark:text-brand-subtle mb-1">Date</label>
                  <div className="flex gap-1">
                    <input 
                      type="date" 
                      value={income.date}
                      onChange={(e) => handleArrayChange('monthlyIncomes', index, 'date', e.target.value)}
                      className="bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-2.5 focus:ring-accent focus:border-accent transition flex-1"
                    />
                    {formData.monthlyIncomes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeIncomeRow(index)}
                        className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg p-2.5 transition-colors"
                        title="Remove this income entry"
                      >
                        <i className="fa-solid fa-trash-can text-sm"></i>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            <button 
              type="button" 
              onClick={() => addIncomeRow()}
              className="w-full text-center py-2.5 bg-accent/10 dark:bg-accent/20 text-accent font-semibold rounded-lg hover:bg-accent/20 dark:hover:bg-accent/30 transition-colors"
            >
              <i className="fa-solid fa-plus mr-2"></i>Add Income
            </button>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Initial Expenses</h2>
            <p className="text-sm text-light-subtle dark:text-brand-subtle">Enter major expenses you've already paid this month.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {combinedCategories.map(category => (
                <div key={category} className="flex flex-col">
                  <label className="text-xs font-medium text-light-subtle dark:text-brand-subtle mb-1">{category}</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-light-subtle dark:text-brand-subtle">₹</span>
                    <input 
                      type="number" 
                      placeholder="Amount"
                      value={formData.expenses[category] || ''}
                      onChange={(e) => handleExpenseChange(category, e.target.value)}
                      className="bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-2.5 pl-6 focus:ring-accent focus:border-accent transition w-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Recurring Payments</h2>
            <p className="text-sm text-light-subtle dark:text-brand-subtle">List fixed monthly payments like EMIs, subscriptions, or rent.</p>
            
            {formData.recurringExpenses.map((expense, index) => (
              <div key={index} className="space-y-2 md:space-y-0 md:grid md:grid-cols-3 md:gap-2">
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-light-subtle dark:text-brand-subtle mb-1">Description</label>
                  <input 
                    type="text" 
                    placeholder="Description (e.g., Netflix)"
                    value={expense.description}
                    onChange={(e) => handleArrayChange('recurringExpenses', index, 'description', e.target.value)}
                    className="bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-2.5 focus:ring-accent focus:border-accent transition"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-light-subtle dark:text-brand-subtle mb-1">Amount</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-light-subtle dark:text-brand-subtle">₹</span>
                    <input 
                      type="number" 
                      placeholder="Amount"
                      value={expense.amount}
                      onChange={(e) => handleArrayChange('recurringExpenses', index, 'amount', e.target.value)}
                      className="bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-2.5 pl-6 focus:ring-accent focus:border-accent transition w-full"
                    />
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-light-subtle dark:text-brand-subtle mb-1">Due Day</label>
                  <input 
                    type="number" 
                    placeholder="Due Day (1-31)"
                    value={expense.dueDate}
                    onChange={(e) => handleArrayChange('recurringExpenses', index, 'dueDate', e.target.value)}
                    className="bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-2.5 focus:ring-accent focus:border-accent transition"
                  />
                </div>
              </div>
            ))}
            
            <button 
              type="button" 
              onClick={addRecurringRow}
              className="w-full text-center py-2.5 bg-accent/10 dark:bg-accent/20 text-accent font-semibold rounded-lg hover:bg-accent/20 dark:hover:bg-accent/30 transition-colors"
            >
              <i className="fa-solid fa-plus mr-2"></i>Add Recurring Payment
            </button>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Goals & Limits</h2>
            <p className="text-sm text-light-subtle dark:text-brand-subtle">Set your financial targets for the month to stay on track.</p>
            
            <div>
              <label className="font-semibold block mb-1">Monthly Savings Goal</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-light-subtle dark:text-brand-subtle">₹</span>
                <input 
                  type="number" 
                  placeholder="10,000"
                  value={formData.savingsGoal}
                  onChange={(e) => setFormData(prev => ({ ...prev, savingsGoal: e.target.value }))}
                  className="bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-2.5 pl-6 focus:ring-accent focus:border-accent transition w-full"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold block mb-1">Category Budget Limits (Optional)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {combinedCategories.map(category => (
                  <div key={category} className="flex flex-col">
                    <label className="text-xs font-medium text-light-subtle dark:text-brand-subtle mb-1">{category} Limit</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-light-subtle dark:text-brand-subtle">₹</span>
                      <input 
                        type="number" 
                        placeholder="Limit Amount"
                        value={formData.budgetLimits[category] || ''}
                        onChange={(e) => handleBudgetLimitChange(category, e.target.value)}
                        className="bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-2.5 pl-6 focus:ring-accent focus:border-accent transition w-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Future Plans</h2>
            <p className="text-sm text-light-subtle dark:text-brand-subtle">A little planning goes a long way. What's on your financial horizon?</p>
            
            <div>
              <label className="font-semibold block mb-1">Planned Expenses</label>
              <textarea 
                rows="2" 
                placeholder="e.g., Trip to Goa, friend's wedding gift..."
                value={formData.upcomingExpenses}
                onChange={(e) => setFormData(prev => ({ ...prev, upcomingExpenses: e.target.value }))}
                className="bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-2.5 focus:ring-accent focus:border-accent transition w-full"
              />
            </div>
            
            <div>
              <label className="font-semibold block mb-1">Long-Term Goal</label>
              <textarea 
                rows="2" 
                placeholder="e.g., Saving for a car down payment..."
                value={formData.longTermGoal}
                onChange={(e) => setFormData(prev => ({ ...prev, longTermGoal: e.target.value }))}
                className="bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-2.5 focus:ring-accent focus:border-accent transition w-full"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const progressPercentage = (currentStep / steps.length) * 100;

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Dashboard Setup" />
      
      <main className="flex-grow flex items-center justify-center p-2 sm:p-4">
        <div className="w-full max-w-3xl mx-auto">
          <div className="bg-light-secondary dark:bg-brand-secondary rounded-2xl shadow-2xl border border-light-tertiary dark:border-brand-tertiary">
            <div className="p-4 sm:p-6">
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-bold text-accent">{steps[currentStep - 1].title}</span>
                  <span className="text-xs font-medium text-light-subtle dark:text-brand-subtle">Step {currentStep} of {steps.length}</span>
                </div>
                <div className="w-full bg-light-tertiary dark:bg-brand-tertiary rounded-full h-2">
                  <div 
                    className="bg-accent h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Step Content Area */}
              <div className="max-h-[60vh] overflow-y-auto">
                {renderStepContent()}
              </div>
            </div>
            
            {/* Navigation */}
            <div className="mt-4 p-4 bg-light-primary/50 dark:bg-brand-primary/50 rounded-b-2xl border-t border-light-tertiary dark:border-brand-tertiary flex justify-between items-center">
              <button 
                type="button" 
                onClick={handleBack}
                disabled={currentStep === 1}
                className={`bg-light-tertiary dark:bg-brand-tertiary text-gray-700 dark:text-white font-bold py-2.5 px-5 rounded-lg hover:bg-gray-300 dark:hover:bg-brand-primary transition ${currentStep === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <i className="fa-solid fa-arrow-left mr-2"></i>Back
              </button>
              
              <button 
                type="button" 
                onClick={handleNext}
                disabled={loading}
                className="w-36 bg-accent text-white font-bold py-2.5 px-5 rounded-lg hover:bg-orange-500 transition-transform transform hover:scale-105 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                    Saving...
                  </>
                ) : (
                  <>
                    <span>{currentStep === steps.length ? 'Finish' : 'Next'}</span>
                    <i className={`fa-solid ${currentStep === steps.length ? 'fa-check' : 'fa-arrow-right'} ml-2`}></i>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default PersonalizePage;