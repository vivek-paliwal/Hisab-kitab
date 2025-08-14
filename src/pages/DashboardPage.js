import React, { useState, useEffect, useRef } from 'react'; // 1. Import useRef
import { collection, onSnapshot, query, orderBy, addDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../utils/firebase';
import { formatCurrency, formatCurrencyDetailed } from '../utils/formatCurrency';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';
import Charts from '../components/Dashboard/Charts';
import FinancialAssistant from '../components/Dashboard/FinancialAssistant';

function DashboardPage() {
  const [transactions, setTransactions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    type: 'expense',
    description: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  const [autofillLoading, setAutofillLoading] = useState(false);
  const { currentUser, userData } = useAuth();
  const { showToast } = useToast();
  const isSubmitting = useRef(false); // 2. Add the ref to track submission state

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
      });

      return () => unsubscribe();
    }
  }, [currentUser?.uid]);

  // Calculate totals
  const totalIncome = transactions
    .filter(tx => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);
  
  const totalExpense = transactions
    .filter(tx => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);
  
  const balance = totalIncome - totalExpense;

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const verifyApiKey = async () => {
    if (!userData?.apiKey) {
      showToast('Please add your API key in settings to use AI autofill.', 'error');
      return false;
    }
    
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${userData.apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Hello" }] }] })
      });
      return response.ok;
    } catch (error) {
      console.error("API Key validation failed:", error);
      showToast('AI service is unavailable. Please check your API key.', 'error');
      return false;
    }
  };

  const handleAutofill = async () => {
    if (!formData.description.trim()) {
      showToast('Please enter a description first.', 'error');
      return;
    }

    const isOnline = await verifyApiKey();
    if (!isOnline) return;

    setAutofillLoading(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const prompt = `
        Analyze the following transaction description: "${formData.description}"
        
        Extract and determine:
        1. Transaction type: "income" or "expense" (be smart about detecting income keywords like salary, bonus, payment received, freelance, etc.)
        2. Amount: Extract any numeric amount mentioned, or return null if no amount is found
        3. Category: Choose the most appropriate category from these options:
           - Food (restaurants, groceries, snacks, dining)
           - Travel (transport, fuel, flights, hotels)
           - Shopping (clothes, accessories, general purchases)
           - Bills (utilities, rent, subscriptions, phone bills)
           - Entertainment (movies, games, events, streaming)
           - Health (medical, pharmacy, fitness, insurance)
           - Education (courses, books, tuition, training)
           - Electronics (gadgets, devices, tech purchases)
           - Income (salary, freelance, business income)
           - Investment (stocks, mutual funds, savings)
           - Personal (haircut, beauty, personal care)
           - Other (if none of the above fit)
        4. Date: Use today's date (${today}) unless a specific date is mentioned in the description
        
        Be intelligent about categorization. For example:
        - "bought iPhone" = Electronics, expense
        - "salary credited" = Income, income
        - "lunch at restaurant" = Food, expense
        - "uber ride" = Travel, expense
        - "netflix subscription" = Bills, expense
        - "freelance payment received" = Income, income
      `;

      const responseSchema = {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", enum: ["income", "expense"] },
          amount: { type: "NUMBER", description: "Extracted amount or null if not found" },
          category: { type: "STRING" },
          date: { type: "STRING", description: `Date in YYYY-MM-DD format. Default to ${today} if not specified.` }
        },
        required: ["type", "category", "date"]
      };

      const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: responseSchema
        }
      };

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${userData.apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
      
      const result = await response.json();
      
      if (result.candidates && result.candidates.length > 0) {
        const aiData = JSON.parse(result.candidates[0].content.parts[0].text);
        
        setFormData(prev => ({
          ...prev,
          type: aiData.type || 'expense',
          amount: aiData.amount ? aiData.amount.toString() : prev.amount,
          category: aiData.category || '',
          date: aiData.date || today
        }));

        showToast('Transaction details auto-filled successfully!', 'success');
      } else {
        throw new Error("No content received from AI.");
      }

    } catch (error) {
      console.error("Autofill Error:", error);
      showToast('Could not auto-fill details. Please fill manually.', 'error');
    } finally {
      setAutofillLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 3. Add this check to prevent double submissions
    if (isSubmitting.current) {
      return; // If already submitting, exit the function
    }

    isSubmitting.current = true; // Mark as submitting
    setLoading(true);

    try {
      const transactionsRef = collection(db, "users", currentUser.uid, "transactions");
      await addDoc(transactionsRef, {
        ...formData,
        amount: parseFloat(formData.amount),
        createdAt: serverTimestamp()
      });

      showToast('Transaction added successfully!', 'success');
      setFormData({
        type: 'expense',
        description: '',
        amount: '',
        category: '',
        date: new Date().toISOString().split('T')[0]
      });
      setShowModal(false);
    } catch (error) {
      console.error('Error adding transaction:', error);
      showToast('Failed to add transaction.', 'error');
    } finally {
      setLoading(false);
      isSubmitting.current = false; // 4. Reset the flag after completion
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Hisab-Kitab" showProfile={true} showMenu={true} />
      
      {/* Add Transaction Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="bg-light-secondary dark:bg-brand-secondary p-8 rounded-2xl border border-light-tertiary dark:border-transparent shadow-2xl w-full max-w-md m-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-accent">Add Transaction</h2>
              <button 
                onClick={() => setShowModal(false)}
                className="text-light-subtle dark:text-brand-subtle text-2xl font-bold hover:text-error"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Description</label>
                <div className="relative">
                  <input 
                    type="text" 
                    name="description"
                    value={formData.description}
                    onChange={handleFormChange}
                    required 
                    className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 pr-12 focus:ring-accent focus:border-accent transition" 
                    placeholder="e.g., Coffee with friends, Salary credited, Bought iPhone"
                  />
                  <button 
                    type="button"
                    onClick={handleAutofill}
                    disabled={autofillLoading || !formData.description.trim()}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-accent hover:text-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Auto-fill with AI"
                  >
                    {autofillLoading ? (
                      <i className="fa-solid fa-spinner fa-spin"></i>
                    ) : (
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-light-subtle dark:text-brand-subtle">
                  <i className="fa-solid fa-lightbulb mr-1"></i>
                  "Transaction Discription"
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Type</label>
                <select 
                  name="type"
                  value={formData.type}
                  onChange={handleFormChange}
                  required 
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Amount</label>
                <input 
                  type="number" 
                  name="amount"
                  value={formData.amount}
                  onChange={handleFormChange}
                  required 
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition" 
                  placeholder="e.g., 250"
                  step="0.01"
                  min="0"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Category</label>
                <input 
                  type="text" 
                  name="category"
                  value={formData.category}
                  onChange={handleFormChange}
                  required 
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition" 
                  placeholder="e.g., Food, Electronics, Bills"
                  list="category-suggestions"
                />
                <datalist id="category-suggestions">
                  <option value="Food" />
                  <option value="Travel" />
                  <option value="Shopping" />
                  <option value="Bills" />
                  <option value="Entertainment" />
                  <option value="Health" />
                  <option value="Education" />
                  <option value="Electronics" />
                  <option value="Income" />
                  <option value="Investment" />
                  <option value="Personal" />
                  <option value="Other" />
                </datalist>
              </div>
              
              <div>
                <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Date</label>
                <input 
                  type="date" 
                  name="date"
                  value={formData.date}
                  onChange={handleFormChange}
                  required 
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                />
              </div>
              
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-accent text-white font-bold py-3 px-4 rounded-lg hover:bg-opacity-90 transition-transform transform hover:scale-105 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                    Saving...
                  </>
                ) : (
                  'Save Transaction'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      <main className="flex-grow p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-3 space-y-6">
          {/* Summary Cards with Compact Formatting */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-light-secondary dark:bg-brand-secondary p-4 rounded-2xl border border-light-tertiary dark:border-transparent">
              <h3 className="font-medium text-light-subtle dark:text-brand-subtle text-sm">Total Income</h3>
              <p className="text-2xl font-bold text-success mt-1 leading-tight" title={formatCurrencyDetailed(totalIncome)}>
                {formatCurrency(totalIncome, true)}
              </p>
            </div>
            <div className="bg-light-secondary dark:bg-brand-secondary p-4 rounded-2xl border border-light-tertiary dark:border-transparent">
              <h3 className="font-medium text-light-subtle dark:text-brand-subtle text-sm">Total Expense</h3>
              <p className="text-2xl font-bold text-error mt-1 leading-tight" title={formatCurrencyDetailed(totalExpense)}>
                {formatCurrency(totalExpense, true)}
              </p>
            </div>
            <div className="bg-light-secondary dark:bg-brand-secondary p-4 rounded-2xl border border-light-tertiary dark:border-transparent">
              <h3 className="font-medium text-light-subtle dark:text-brand-subtle text-sm">Balance</h3>
              <p className={`text-2xl font-bold mt-1 leading-tight ${balance >= 0 ? 'text-success' : 'text-error'}`} title={formatCurrencyDetailed(balance)}>
                {formatCurrency(balance, true)}
              </p>
            </div>
          </section>

          {/* Charts */}
          <Charts transactions={transactions} />
          
          {/* Financial Assistant Panel */}
          <FinancialAssistant transactions={transactions} setTransactions={setTransactions} />
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 flex flex-col">
          {/* Recent Transactions Panel */}
          <section className="bg-light-secondary dark:bg-brand-secondary p-6 rounded-2xl flex flex-col border border-light-tertiary dark:border-transparent h-full">
            <h3 className="text-lg font-bold text-accent mb-4 flex-shrink-0">Recent Transactions</h3>
            <div className="mb-4 flex-shrink-0">
              <button 
                onClick={() => setShowModal(true)}
                className="w-full bg-accent text-white font-bold py-3 px-4 rounded-lg hover:bg-opacity-90 transition-transform transform hover:scale-105"
              >
                ADD Transaction
              </button>
            </div>
            <div className="overflow-y-auto -mr-6 pr-4 flex-grow" style={{ maxHeight: '92vh' }}>
              <table className="w-full text-left">
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="2" className="text-center py-4 text-light-subtle dark:text-brand-subtle">No transactions yet.</td>
                    </tr>
                  ) : (
                    transactions.slice(0, 15).map(tx => {
                      const isIncome = tx.type === 'income';
                      const iconClass = isIncome ? 'fa-briefcase' : 'fa-utensils';
                      return (
                        <tr key={tx.id} className="border-b border-light-tertiary dark:border-brand-tertiary">
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isIncome ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}`}>
                                <i className={`fa-solid ${iconClass}`}></i>
                              </div>
                              <div>
                                <p className="font-semibold text-light-text dark:text-brand-text text-sm">{tx.description}</p>
                                <p className="text-xs text-light-subtle dark:text-brand-subtle">{tx.category}</p>
                              </div>
                            </div>
                          </td>
                          <td className={`py-3 px-3 text-right font-semibold text-sm ${isIncome ? 'text-success' : 'text-error'}`} title={formatCurrencyDetailed(tx.amount)}>
                            {isIncome ? '+' : '-'}{formatCurrency(tx.amount, true)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex-shrink-0">
              <a 
                href="/transactions" 
                className="block w-full text-center bg-light-primary dark:bg-brand-tertiary text-light-subtle dark:text-brand-subtle font-semibold py-2 px-4 rounded-lg border border-light-tertiary dark:border-brand-tertiary hover:bg-gray-200 dark:hover:bg-brand-primary hover:text-light-text dark:hover:text-brand-text transition"
              >
                View All Transactions
              </a>
            </div>
          </section>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}

export default DashboardPage;