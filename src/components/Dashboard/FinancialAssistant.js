import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { doc, updateDoc, collection, addDoc, serverTimestamp, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import { formatCurrency, formatCurrencyDetailed } from '../../utils/formatCurrency';

const FinancialAssistant = ({ transactions, setTransactions }) => {
  const [activeMode, setActiveMode] = useState('analysis');
  const [chatHistory, setChatHistory] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dynamicQuestions, setDynamicQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [planAnswers, setPlanAnswers] = useState([]);
  const [showSavePlan, setShowSavePlan] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [analysisContent, setAnalysisContent] = useState('');
  const [lastTransactionContext, setLastTransactionContext] = useState(null);
  const [conversationContext, setConversationContext] = useState([]);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [undoHistory, setUndoHistory] = useState([]);
  
  const { currentUser, userData, setUserData } = useAuth();
  const { showToast } = useToast();
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatHistory]);

  useEffect(() => {
    if (userData?.expenseAnalysisReport) {
      setAnalysisContent(userData.expenseAnalysisReport);
    } else {
      setAnalysisContent(getDefaultAnalysisContent());
    }
  }, [userData]);

  // Track the most recent transaction for updates
  useEffect(() => {
    if (transactions && transactions.length > 0) {
      const mostRecent = transactions[0]; // transactions are ordered by date desc
      setLastTransactionContext({
        id: mostRecent.id,
        action: 'exists',
        data: mostRecent
      });
    }
  }, [transactions]);

  const getTodayDate = () => {
    return '2025-07-14';
  };

  const getCurrentTime = () => {
    return '2025-07-14 06:14:11';
  };

  const verifyApiKey = async () => {
    if (!userData?.apiKey) {
      showToast('Please add your API key in settings to use AI features.', 'error');
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
      showToast('AI service is currently unavailable. Please check your API key.', 'error');
      return false;
    }
  };

  const getUserSalaryInfo = () => {
    // Try to get salary from various sources
    const onboardingAnswers = userData?.onboardingAnswers || {};
    const salary = onboardingAnswers.salary || onboardingAnswers.monthlyIncome || onboardingAnswers.income;
    
    // Also check for recurring income transactions
    const salaryTransactions = transactions
      .filter(t => t.type === 'income' && 
        (t.description.toLowerCase().includes('salary') || 
         t.description.toLowerCase().includes('income') ||
         t.category === 'Salary'))
      .slice(0, 3); // Get last 3 salary entries
    
    return {
      expectedSalary: salary,
      lastSalaryTransactions: salaryTransactions,
      lastSalaryAmount: salaryTransactions.length > 0 ? salaryTransactions[0].amount : null
    };
  };

  const getContextData = () => {
    // Calculate real-time stats
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const balance = totalIncome - totalExpenses;
    
    // Get category breakdown
    const categoryTotals = {};
    transactions.filter(t => t.type === 'expense').forEach(tx => {
      categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
    });
    
    const topCategories = Object.entries(categoryTotals)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    // Get recent transactions with more details
    const recentTransactions = transactions.slice(0, 20).map(tx => ({
      ...tx,
      formattedAmount: formatCurrency(tx.amount, true),
      detailedAmount: formatCurrencyDetailed(tx.amount)
    }));

    const salaryInfo = getUserSalaryInfo();

    return {
      user: {
        name: userData?.name || 'User',
        login: 'vivek-paliwal',
        email: userData?.email || '',
        occupation: userData?.onboardingAnswers?.occupation || 'Unknown',
        salaryInfo: salaryInfo
      },
      financial_summary: {
        total_income: totalIncome,
        total_expenses: totalExpenses,
        current_balance: balance,
        total_transactions: transactions.length,
        top_spending_categories: topCategories,
        all_categories: [...new Set(transactions.map(t => t.category))].sort()
      },
      recent_transactions: recentTransactions,
      last_transaction: lastTransactionContext ? lastTransactionContext.data : null,
      all_transactions: transactions,
      datetime: getCurrentTime()
    };
  };

  const getDefaultAnalysisContent = () => {
    const contextData = getContextData();
    
    if (contextData.financial_summary.total_transactions === 0) {
      return `
        <div class="space-y-3 text-sm">
          <p class="text-light-subtle dark:text-brand-subtle">Your expense analysis will appear here once you have some transactions.</p>
          <p class="text-light-subtle dark:text-brand-subtle">Add some transactions and click "Update Expense Analysis" to get personalized insights.</p>
        </div>
      `;
    }

    return `
      <div class="space-y-3 text-sm">
        <p class="font-semibold">Here's a quick look at your spending:</p>
        ${contextData.financial_summary.top_spending_categories.map(([category, amount], index) => `
          <div class="p-3 bg-light-secondary dark:bg-brand-secondary rounded-lg border border-light-tertiary dark:border-brand-primary">
            <p class="font-semibold">${index + 1}. ${category}</p>
            <p class="text-light-subtle dark:text-brand-subtle">You've spent ${formatCurrency(amount, true)} on ${category}. Consider tracking this category more closely to optimize your spending.</p>
          </div>
        `).join('')}
      </div>
    `;
  };

  const callGeminiAPI = async (prompt, options = {}) => {
    const isOnline = await verifyApiKey();
    if (!isOnline) return null;

    try {
      const contextData = getContextData();
      
      // Build conversation history context
      const conversationHistory = conversationContext.slice(-5).map(ctx => 
        `${ctx.role}: ${ctx.message}`
      ).join('\n');
      
      const systemPrompt = `
You are an intelligent financial assistant for ${contextData.user.name} (login: ${contextData.user.login}).

CURRENT CONTEXT:
- Current Date/Time: ${contextData.datetime} (UTC - YYYY-MM-DD HH:MM:SS)
- User: ${contextData.user.name}
- Login: ${contextData.user.login}
- Occupation: ${contextData.user.occupation}
- Expected Salary: ${contextData.user.salaryInfo.expectedSalary ? formatCurrency(contextData.user.salaryInfo.expectedSalary, true) : 'Not specified'}
- Last Salary Amount: ${contextData.user.salaryInfo.lastSalaryAmount ? formatCurrency(contextData.user.salaryInfo.lastSalaryAmount, true) : 'None recorded'}

FINANCIAL DATA:
- Total Income: ${formatCurrency(contextData.financial_summary.total_income, true)} (${formatCurrencyDetailed(contextData.financial_summary.total_income)})
- Total Expenses: ${formatCurrency(contextData.financial_summary.total_expenses, true)} (${formatCurrencyDetailed(contextData.financial_summary.total_expenses)})
- Current Balance: ${formatCurrency(contextData.financial_summary.current_balance, true)} (${formatCurrencyDetailed(contextData.financial_summary.current_balance)})
- Total Transactions: ${contextData.financial_summary.total_transactions}
- Available Categories: ${contextData.financial_summary.all_categories.join(', ')}

LAST TRANSACTION (for updates):
${contextData.last_transaction ? `- ID: ${contextData.last_transaction.id}
- Type: ${contextData.last_transaction.type}
- Description: ${contextData.last_transaction.description}
- Amount: ${formatCurrency(contextData.last_transaction.amount, true)} (${formatCurrencyDetailed(contextData.last_transaction.amount)})
- Category: ${contextData.last_transaction.category}
- Date: ${contextData.last_transaction.date}` : 'None'}

TOP SPENDING CATEGORIES:
${contextData.financial_summary.top_spending_categories.map(([cat, amt]) => `- ${cat}: ${formatCurrency(amt, true)} (${formatCurrencyDetailed(amt)})`).join('\n')}

RECENT TRANSACTIONS (Last 20):
${contextData.recent_transactions.map(tx => `- [${tx.id}] ${tx.type}: ${tx.description} - ${formatCurrency(tx.amount, true)} (${tx.category}) [${tx.date}]`).join('\n')}

RECENT SALARY TRANSACTIONS:
${contextData.user.salaryInfo.lastSalaryTransactions.map(tx => `- ${tx.date}: ${formatCurrency(tx.amount, true)}`).join('\n') || 'None'}

CONVERSATION HISTORY:
${conversationHistory}

INSTRUCTIONS:
- Be highly intelligent and understand context deeply
- When user mentions salary/income without amount:
  * First check if there's an expected salary in user data
  * Check for recent salary transactions
  * If no amount found anywhere, DO NOT use 0 - instead indicate that amount information is needed
  * Set amount to null or undefined when unknown
- ALWAYS ask for confirmation before executing transactions (set requiresConfirmation: true)
- Support multiple languages including Hindi/English mix
- Understand various phrasings: "delete all food", "remove electronics", "clear shopping", etc.
- For batch operations, be smart about filters (category, date range, amount range, etc.)
- Provide detailed insights when asked about spending patterns
- Be proactive in suggesting what the user might want
- Always use the correct user name: ${contextData.user.name}
- Use compact currency format (L/CR/K) in responses
- For corrections/updates without specific ID, use the last transaction
- Be conversational and helpful
- Current date for new transactions: ${getTodayDate()}

USER REQUEST: ${prompt}

${options.instructions || ''}
      `;

      const payload = {
        contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
        ...(options.schema && { 
          generationConfig: { 
            responseMimeType: "application/json", 
            responseSchema: options.schema 
          } 
        })
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${userData.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) throw new Error(`API request failed: ${response.status}`);
      
      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (error) {
      console.error("Gemini API Error:", error);
      showToast('AI service error. Please try again.', 'error');
      return null;
    }
  };

  const updateUserData = async (updates) => {
    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(userDocRef, updates);
      setUserData(prev => ({ ...prev, ...updates }));
    } catch (error) {
      console.error("Error updating user data:", error);
      throw error;
    }
  };

  const saveUndoState = (action, data) => {
    setUndoHistory(prev => [...prev, { action, data, timestamp: new Date() }]);
  };

  const executeUndo = async () => {
    if (undoHistory.length === 0) {
      showToast('Nothing to undo', 'info');
      return;
    }

    const lastAction = undoHistory[undoHistory.length - 1];
    setUndoHistory(prev => prev.slice(0, -1));

    try {
      switch (lastAction.action) {
        case 'add':
          // Delete the added transaction
          await deleteDoc(doc(db, "users", currentUser.uid, "transactions", lastAction.data.id));
          if (setTransactions) {
            setTransactions(prev => prev.filter(tx => tx.id !== lastAction.data.id));
          }
          showToast('Transaction addition undone', 'success');
          break;

        case 'delete':
          // Re-add the deleted transactions
          for (const tx of lastAction.data) {
            const docRef = await addDoc(collection(db, "users", currentUser.uid, "transactions"), {
              ...tx,
              createdAt: serverTimestamp()
            });
            if (setTransactions) {
              setTransactions(prev => [{...tx, id: docRef.id}, ...prev]);
            }
          }
          showToast(`Restored ${lastAction.data.length} transaction(s)`, 'success');
          break;

        case 'update':
          // Restore original values
          const updateRef = doc(db, "users", currentUser.uid, "transactions", lastAction.data.id);
          await updateDoc(updateRef, lastAction.data.original);
          if (setTransactions) {
            setTransactions(prev => prev.map(tx => 
              tx.id === lastAction.data.id ? { ...tx, ...lastAction.data.original } : tx
            ));
          }
          showToast('Transaction update undone', 'success');
          break;
      }

      setChatHistory(prev => [...prev, {
        type: 'ai',
        content: '<div class="text-sm text-success flex items-center gap-2"><i class="fa-solid fa-undo"></i> Last action has been undone</div>',
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error undoing action:', error);
      showToast('Failed to undo action', 'error');
    }
  };

  const executeTransactionOperations = async (operations) => {
    const results = [];
    
    try {
      for (const op of operations) {
        console.log('Executing operation:', op);
        
        switch (op.action) {
          case 'add':
            try {
              const docRef = await addDoc(collection(db, "users", currentUser.uid, "transactions"), {
                type: op.type,
                description: op.description,
                amount: parseFloat(op.amount),
                category: op.category,
                date: op.date || getTodayDate(),
                createdAt: serverTimestamp()
              });
              
              const newTransaction = {
                id: docRef.id,
                type: op.type,
                description: op.description,
                amount: parseFloat(op.amount),
                category: op.category,
                date: op.date || getTodayDate()
              };
              
              if (setTransactions) {
                setTransactions(prev => [newTransaction, ...prev]);
              }
              
              setLastTransactionContext({
                id: docRef.id,
                action: 'added',
                data: newTransaction
              });
              
              // Save undo state
              saveUndoState('add', newTransaction);
              
              results.push({ 
                success: true, 
                message: `Added ${op.type}: ${op.description} - ${formatCurrency(op.amount, true)}`,
                details: newTransaction
              });
            } catch (error) {
              console.error('Error adding transaction:', error);
              results.push({ success: false, message: `Failed to add transaction: ${error.message}` });
            }
            break;

          case 'update':
            try {
              let targetTransaction = null;
              
              // First try to find by transaction ID if provided
              if (op.transactionId) {
                targetTransaction = transactions.find(tx => tx.id === op.transactionId);
              }
              
              // If not found by ID or no ID provided, try to identify by properties
              if (!targetTransaction && op.identifyBy) {
                const matches = transactions.filter(tx => {
                  let match = true;
                  
                  // Match by description (partial match, case insensitive)
                  if (op.identifyBy.description) {
                    match = match && tx.description.toLowerCase().includes(op.identifyBy.description.toLowerCase());
                  }
                  
                  // Match by category
                  if (op.identifyBy.category) {
                    match = match && tx.category.toLowerCase() === op.identifyBy.category.toLowerCase();
                  }
                  
                  // Match by amount
                  if (op.identifyBy.amount !== undefined) {
                    match = match && Math.abs(tx.amount - op.identifyBy.amount) < 0.01;
                  }
                  
                  // Match by type
                  if (op.identifyBy.type) {
                    match = match && tx.type === op.identifyBy.type;
                  }
                  
                  return match;
                });
                
                if (matches.length === 1) {
                  targetTransaction = matches[0];
                } else if (matches.length > 1) {
                  // If multiple matches, use the most recent one
                  targetTransaction = matches[0]; // Assuming transactions are sorted by date desc
                }
              }
              
              // If still not found, try last transaction context
              if (!targetTransaction && lastTransactionContext) {
                targetTransaction = transactions.find(tx => tx.id === lastTransactionContext.id);
              }
              
              if (!targetTransaction) {
                results.push({ 
                  success: false, 
                  message: 'Could not find the transaction to update. Please be more specific.' 
                });
                break;
              }
              
              const updateRef = doc(db, "users", currentUser.uid, "transactions", targetTransaction.id);
              const updateData = {};
              
              if (op.amount !== undefined) updateData.amount = parseFloat(op.amount);
              if (op.description !== undefined) updateData.description = op.description;
              if (op.category !== undefined) updateData.category = op.category;
              if (op.type !== undefined) updateData.type = op.type;
              if (op.date !== undefined) updateData.date = op.date;
              
              await updateDoc(updateRef, updateData);
              
              if (setTransactions) {
                setTransactions(prev => prev.map(tx => 
                  tx.id === targetTransaction.id ? { ...tx, ...updateData } : tx
                ));
              }
              
              // Update last transaction context
              setLastTransactionContext({
                id: targetTransaction.id,
                action: 'updated',
                data: { ...targetTransaction, ...updateData }
              });
              
              // Save undo state
              saveUndoState('update', { id: targetTransaction.id, original: targetTransaction, updated: updateData });
              
              const updatedFields = Object.keys(updateData).map(key => {
                if (key === 'amount') return `amount to ${formatCurrency(updateData[key], true)}`;
                return `${key} to "${updateData[key]}"`;
              }).join(', ');
              
              results.push({ 
                success: true, 
                message: `Updated "${targetTransaction.description}" - ${updatedFields}`,
                details: updateData
              });
            } catch (error) {
              console.error('Error updating transaction:', error);
              results.push({ success: false, message: `Failed to update transaction: ${error.message}` });
            }
            break;

          case 'delete':
            try {
              let deletedTransactions = [];
              
              // Delete by specific IDs
              if (op.transactionIds && Array.isArray(op.transactionIds)) {
                for (const id of op.transactionIds) {
                  try {
                    const txToDelete = transactions.find(tx => tx.id === id);
                    if (txToDelete) {
                      await deleteDoc(doc(db, "users", currentUser.uid, "transactions", id));
                      deletedTransactions.push(txToDelete);
                    }
                  } catch (error) {
                    console.error(`Error deleting transaction ${id}:`, error);
                  }
                }
                
                if (setTransactions) {
                  setTransactions(prev => prev.filter(tx => !op.transactionIds.includes(tx.id)));
                }
              } 
              // Delete by identification criteria
              else if (op.identifyBy) {
                let toDelete = transactions.filter(tx => {
                  let match = true;
                  
                  if (op.identifyBy.description) {
                    match = match && tx.description.toLowerCase().includes(op.identifyBy.description.toLowerCase());
                  }
                  
                  if (op.identifyBy.category) {
                    match = match && tx.category.toLowerCase() === op.identifyBy.category.toLowerCase();
                  }
                  
                  if (op.identifyBy.amount !== undefined) {
                    match = match && Math.abs(tx.amount - op.identifyBy.amount) < 0.01;
                  }
                  
                  if (op.identifyBy.type) {
                    match = match && tx.type === op.identifyBy.type;
                  }
                  
                  return match;
                });
                
                for (const tx of toDelete) {
                  try {
                    await deleteDoc(doc(db, "users", currentUser.uid, "transactions", tx.id));
                    deletedTransactions.push(tx);
                  } catch (error) {
                    console.error(`Error deleting transaction ${tx.id}:`, error);
                  }
                }
                
                if (setTransactions) {
                  const deletedIds = toDelete.map(tx => tx.id);
                  setTransactions(prev => prev.filter(tx => !deletedIds.includes(tx.id)));
                }
              }
              // Delete by filter (existing logic)
              else if (op.filter) {
                let toDelete = transactions;
                
                if (op.filter.category) {
                  toDelete = toDelete.filter(tx => 
                    tx.category.toLowerCase() === op.filter.category.toLowerCase()
                  );
                }
                
                if (op.filter.type) {
                  toDelete = toDelete.filter(tx => tx.type === op.filter.type);
                }
                
                if (op.filter.dateFrom) {
                  toDelete = toDelete.filter(tx => tx.date >= op.filter.dateFrom);
                }
                
                if (op.filter.dateTo) {
                  toDelete = toDelete.filter(tx => tx.date <= op.filter.dateTo);
                }
                
                if (op.filter.amountMin !== undefined) {
                  toDelete = toDelete.filter(tx => tx.amount >= op.filter.amountMin);
                }
                
                if (op.filter.amountMax !== undefined) {
                  toDelete = toDelete.filter(tx => tx.amount <= op.filter.amountMax);
                }
                
                for (const tx of toDelete) {
                  try {
                    await deleteDoc(doc(db, "users", currentUser.uid, "transactions", tx.id));
                    deletedTransactions.push(tx);
                  } catch (error) {
                    console.error(`Error deleting transaction ${tx.id}:`, error);
                  }
                }
                
                if (setTransactions) {
                  const deletedIds = toDelete.map(tx => tx.id);
                  setTransactions(prev => prev.filter(tx => !deletedIds.includes(tx.id)));
                }
              }
              
              if (deletedTransactions.length > 0) {
                // Save undo state
                saveUndoState('delete', deletedTransactions);
                
                const totalDeleted = deletedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
                const descriptions = deletedTransactions.map(tx => tx.description).join(', ');
                
                results.push({ 
                  success: true, 
                  message: `Deleted ${deletedTransactions.length} transaction${deletedTransactions.length > 1 ? 's' : ''}: ${descriptions} (Total: ${formatCurrency(totalDeleted, true)})`,
                  details: { count: deletedTransactions.length, total: totalDeleted }
                });
              } else {
                results.push({ success: false, message: 'No transactions found matching the criteria' });
              }
            } catch (error) {
              console.error('Error deleting transactions:', error);
              results.push({ success: false, message: `Failed to delete transactions: ${error.message}` });
            }
            break;

          default:
            results.push({ success: false, message: `Unknown action: ${op.action}` });
        }
      }
    } catch (error) {
      console.error('Error executing operations:', error);
      results.push({ success: false, message: 'Failed to execute operations' });
    }
    
    return results;
  };

  const processUserInput = async (userMessage) => {
    // Add to conversation context
    setConversationContext(prev => [...prev, { role: 'user', message: userMessage }]);
    
    const prompt = `
Analyze this user input: "${userMessage}"

You need to understand the user's intent deeply. They might be:

1. TRANSACTION OPERATIONS:
   - ADD: "spent X on Y", "paid", "received", "got salary", "maine kharcha kiya", "income hua", etc.
   - UPDATE: "sorry X", "galti se", "actually", "change to", "update", corrections with just numbers
     * Can specify by description: "update phone purchase to 5000"
     * Can specify by category: "change food expense to 300"
     * Can specify by amount: "change 1000 transaction to 1500"
   - DELETE: "delete", "remove", "clear", "hatao", "saaf karo" - can be specific or batch
     * By description: "delete phone purchase", "remove coffee expense"
     * By category: "delete all food", "remove shopping transactions"
     * By amount: "delete 500 rupees transaction"
     * By date: "delete yesterday's", "remove last week's"
     * All: "delete all", "clear everything"
   - UNDO: "undo", "revert", "cancel last", "galti ho gayi"

2. QUERIES/ANALYSIS:
   - Balance/Summary: "balance", "total", "kitna hai", "how much"
   - Category analysis: "show food expenses", "electronics ka total"
   - Time-based: "today's spending", "this month's income"
   - Comparisons: "compare food vs shopping"
   - Insights: "where am I spending most", "saving tips"

3. GENERAL CONVERSATION:
   - Greetings, questions, advice, help requests
   - Financial advice and tips
   - Budget planning discussions

IMPORTANT RULES:
- For ALL transaction operations, set requiresConfirmation: true
- When user mentions salary without amount, intelligently use context
- For updates/deletes, try to identify transactions by description, category, or amount
- If user mentions a correction after adding a transaction, it's likely an UPDATE
- Numbers alone after a transaction usually mean amount correction
- "Delete all X" means delete all transactions in category X
- Understand relative dates: "yesterday", "last week", "this month"
- Support mixed language (Hindi-English)

When identifying transactions for update/delete:
- Use description match (partial or full)
- Use category match
- Use amount match
- Use combination of properties for better accuracy

Return a comprehensive analysis with confirmationMessage when needed.
    `;

    const schema = {
      type: "OBJECT",
      properties: {
        intent: { 
          type: "STRING", 
          enum: ["transaction_ops", "show_data", "general_chat", "complex_query", "undo"] 
        },
        subIntent: { 
          type: "STRING",
          description: "Specific sub-intent like 'add_expense', 'delete_batch', 'show_category_total', etc."
        },
        requiresConfirmation: { type: "BOOLEAN" },
        confirmationMessage: { type: "STRING" },
        operations: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              action: { type: "STRING", enum: ["add", "update", "delete"] },
              type: { type: "STRING", enum: ["income", "expense"] },
              description: { type: "STRING" },
              amount: { type: "NUMBER" },
              category: { type: "STRING" },
              date: { type: "STRING" },
              transactionId: { type: "STRING" },
              transactionIds: { type: "ARRAY", items: { type: "STRING" } },
              // Identification criteria for finding transactions
              identifyBy: {
                type: "OBJECT",
                properties: {
                  description: { type: "STRING" },
                  category: { type: "STRING" },
                  amount: { type: "NUMBER" },
                  type: { type: "STRING" },
                  dateRange: { type: "STRING" }
                }
              },
              filter: {
                type: "OBJECT",
                properties: {
                  category: { type: "STRING" },
                  type: { type: "STRING" },
                  dateFrom: { type: "STRING" },
                  dateTo: { type: "STRING" },
                  amountMin: { type: "NUMBER" },
                  amountMax: { type: "NUMBER" }
                }
              }
            }
          }
        },
        queryParams: {
          type: "OBJECT",
          properties: {
            type: { type: "STRING" },
            categories: { type: "ARRAY", items: { type: "STRING" } },
            dateRange: { type: "STRING" },
            sortBy: { type: "STRING" },
            groupBy: { type: "STRING" }
          }
        },
        response_html: { type: "STRING" },
        requiresData: { type: "BOOLEAN" },
        confidence: { type: "NUMBER" }
      },
      required: ["intent", "response_html"]
    };

    const response = await callGeminiAPI(prompt, { schema });
    
    if (response) {
      try {
        const parsed = JSON.parse(response);
        // Add AI response to conversation context
        setConversationContext(prev => [...prev, { role: 'assistant', message: parsed.response_html }]);
        return parsed;
      } catch (error) {
        console.error('Error parsing AI response:', error);
        return null;
      }
    }
    return null;
  };

  const handleConfirmation = async (confirmed) => {
    if (!pendingConfirmation) return;

    // First, update the confirmation message to remove buttons
    setChatHistory(prev => prev.map((msg, index) => {
      if (index === prev.length - 1 && msg.isConfirmation) {
        return {
          ...msg,
          content: msg.content.replace(/<div class="flex gap-2">[\s\S]*?<\/div>/, 
            `<div class="text-sm text-gray-500 italic">
              ${confirmed ? '✓ Confirmed' : '✗ Cancelled'}
            </div>`)
        };
      }
      return msg;
    }));

    setPendingConfirmation(null);

    if (confirmed) {
      // Execute the pending operations
      const results = await executeTransactionOperations(pendingConfirmation.operations);
      
      const successResults = results.filter(r => r.success);
      const failureResults = results.filter(r => !r.success);
      
      let responseContent = '';
      
      if (successResults.length > 0) {
        responseContent = `<div class="space-y-1">`;
        successResults.forEach(r => {
          responseContent += `<div class="text-sm text-success flex items-center gap-2">
            <i class="fa-solid fa-check-circle"></i>
            <span>${r.message}</span>
          </div>`;
        });
        responseContent += `</div>`;
        showToast(successResults.map(r => r.message).join(', '), 'success');
      }
      
      if (failureResults.length > 0) {
        if (!responseContent) responseContent = '<div class="space-y-1">';
        failureResults.forEach(r => {
          responseContent += `<div class="text-sm text-error flex items-center gap-2">
            <i class="fa-solid fa-times-circle"></i>
            <span>${r.message}</span>
          </div>`;
        });
        if (successResults.length === 0) responseContent += '</div>';
        showToast(failureResults.map(r => r.message).join(', '), 'error');
      }
      
      setChatHistory(prev => [...prev, {
        type: 'ai',
        content: responseContent,
        timestamp: new Date()
      }]);
    } else {
      setChatHistory(prev => [...prev, {
        type: 'ai',
        content: '<div class="text-sm text-gray-500">Operation cancelled</div>',
        timestamp: new Date()
      }]);
    }
  };

  const generateAnalysis = async () => {
    setLoading(true);
    
    setAnalysisContent('<div class="flex items-center gap-2 text-sm"><i class="fa-solid fa-spinner fa-spin"></i> Analyzing your expenses...</div>');

    const prompt = `Analyze my spending patterns and provide deep insights for each major category. Look for:
- Spending trends and patterns
- Unusual or concerning expenses
- Opportunities to save money
- Category comparisons
- Time-based patterns (if data permits)

Be specific, actionable, and use data to support your insights. Use compact currency format (L/CR/K).`;

    const instructions = `
      Return clean HTML content with sophisticated analysis. Format each insight as:
      <div class="p-3 bg-light-secondary dark:bg-brand-secondary rounded-lg border border-light-tertiary dark:border-brand-primary">
        <p class="font-semibold">[Number]. [Category/Insight Type]</p>
        <p class="text-light-subtle dark:text-brand-subtle">[Detailed analysis with specific numbers and actionable advice]</p>
      </div>
      
      Include:
      - Overall spending summary
      - Category-wise breakdown with insights
      - Saving opportunities identified
      - Budget recommendations based on patterns
      
      Wrap everything in a div with class "space-y-4 text-sm".
      Start with a personalized greeting using the user's name.
      Use compact currency format throughout.
    `;

    const analysis = await callGeminiAPI(prompt, { instructions });
    
    if (analysis) {
      const cleanAnalysis = analysis.replace(/```html|```/g, '').trim();
      setAnalysisContent(cleanAnalysis);
      
      await updateUserData({ 
        expenseAnalysisReport: cleanAnalysis,
        initialAnalysisGenerated: true 
      });
    }
    
    setLoading(false);
  };

  const startSavingsPlan = async () => {
    setActiveMode('saving');
    setLoading(true);
    setChatHistory([]);
    setConversationContext([]);
    
    const prompt = `Generate 5 personalized, intelligent questions for ${userData?.name} to create a comprehensive savings plan. Questions should be based on their current financial situation and spending patterns. Make questions specific and data-driven.`;

    const schema = {
      type: "ARRAY",
      items: { type: "STRING" }
    };

    const response = await callGeminiAPI(prompt, { schema });
    
    if (response) {
      try {
        const questions = JSON.parse(response);
        setDynamicQuestions(questions);
        setCurrentQuestionIndex(0);
        setPlanAnswers([]);
        
        setChatHistory([{
          type: 'ai',
          content: `<div class="space-y-2">
            <p class="font-bold text-accent text-sm">Let's create your personalized savings plan, ${userData?.name}!</p>
            <div class="bg-accent/10 p-2 rounded-lg">
              <p class="font-semibold text-xs">Question 1 of ${questions.length}</p>
              <p class="text-sm">${questions[0]}</p>
            </div>
          </div>`,
          timestamp: new Date()
        }]);
      } catch (error) {
        console.error('Error parsing questions:', error);
        showToast('Error generating questions. Please try again.', 'error');
      }
    }
    
    setLoading(false);
  };

  const startBudgetPlan = async () => {
    setActiveMode('budget');
    setLoading(true);
    setChatHistory([]);
    setConversationContext([]);
    
    const prompt = `Generate 5 personalized questions for ${userData?.name} to create a detailed monthly budget based on their spending patterns. Questions should help understand their priorities and constraints.`;

    const schema = {
      type: "ARRAY",
      items: { type: "STRING" }
    };

    const response = await callGeminiAPI(prompt, { schema });
    
    if (response) {
      try {
        const questions = JSON.parse(response);
        setDynamicQuestions(questions);
        setCurrentQuestionIndex(0);
        setPlanAnswers([]);
        
        setChatHistory([{
          type: 'ai',
          content: `<div class="space-y-2">
            <p class="font-bold text-accent text-sm">Let's create your personalized budget plan, ${userData?.name}!</p>
            <div class="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg">
              <p class="font-semibold text-xs">Question 1 of ${questions.length}</p>
              <p class="text-sm">${questions[0]}</p>
            </div>
          </div>`,
          timestamp: new Date()
        }]);
      } catch (error) {
        console.error('Error parsing questions:', error);
        showToast('Error generating questions. Please try again.', 'error');
      }
    }
    
    setLoading(false);
  };

  const startAIChat = () => {
    setActiveMode('chat');
    setConversationContext([]);
    setPendingConfirmation(null);
    const userName = userData?.name || 'there';
    setChatHistory([{
      type: 'ai',
      content: `<div class="space-y-2">
        <p class="font-bold text-accent text-sm">Hello ${userName}! I'm your smart AI financial assistant 🤖</p>
        <p class="text-sm">I can help you with:</p>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="bg-light-tertiary dark:bg-brand-primary p-2 rounded">
            <strong>Add:</strong> "spent 500 on food" / "got salary"
          </div>
          <div class="bg-light-tertiary dark:bg-brand-primary p-2 rounded">
            <strong>Update:</strong> "sorry 450" / "change to electronics"
          </div>
          <div class="bg-light-tertiary dark:bg-brand-primary p-2 rounded">
            <strong>Delete:</strong> "delete all food" / "remove last 3"
          </div>
          <div class="bg-light-tertiary dark:bg-brand-primary p-2 rounded">
            <strong>Show:</strong> "show expenses" / "food total?"
          </div>
        </div>
        <p class="text-xs text-accent mt-2">
          💡 Tips: I'll always confirm before making changes | Say "undo" to revert last action | 
          I understand Hindi/English mix too! 😊
        </p>
        ${undoHistory.length > 0 ? `
          <p class="text-xs text-light-subtle dark:text-brand-subtle">
            <i class="fa-solid fa-info-circle"></i> You can undo ${undoHistory.length} recent action(s)
          </p>
        ` : ''}
      </div>`,
      timestamp: new Date()
    }]);
  };

  const handleChatSubmit = async (e) => {
    e?.preventDefault();
    if (!currentInput.trim() || loading) return;

    if (activeMode === 'saving' || activeMode === 'budget') {
      await handleQuestionAnswer();
      return;
    }

    // Add user message
    setChatHistory(prev => [...prev, {
      type: 'user',
      content: currentInput,
      timestamp: new Date()
    }]);

    setLoading(true);
    const userMessage = currentInput;
    setCurrentInput('');

    try {
      // Check if we're waiting for additional information
      const lastContext = conversationContext[conversationContext.length - 1];
      if (lastContext && lastContext.message === 'waiting_for_amount' && lastContext.pendingOperation) {
        // Check if user provided just a number
        const amountMatch = userMessage.match(/^\d+(\.\d+)?$/);
        if (amountMatch) {
          const amount = parseFloat(amountMatch[0]);
          
          // Update the pending operation with the provided amount
          const updatedOperation = {
            ...lastContext.pendingOperation,
            operations: lastContext.pendingOperation.operations.map(op => {
              if (op.action === 'add' && (!op.amount || op.amount === 0)) {
                return { ...op, amount: amount };
              }
              return op;
            })
          };
          
          // Clear the waiting state
          setConversationContext(prev => prev.slice(0, -1));
          
          // Process the updated operation
          const aiResponse = updatedOperation;
          
          if (aiResponse.requiresConfirmation) {
            // Show confirmation with the updated amount
            setPendingConfirmation({
              operations: aiResponse.operations,
              response: aiResponse
            });
            
            const confirmationMessage = {
              type: 'ai',
              content: `
                <div class="space-y-3">
                  <div class="text-sm">Great! Now please confirm this operation:</div>
                  <div class="bg-light-tertiary dark:bg-brand-primary p-3 rounded-lg">
                    ${aiResponse.operations.map(op => {
                      if (op.action === 'add') {
                        return `<p class="text-sm"><strong>Add ${op.type}:</strong> ${op.description} - ${formatCurrency(op.amount, true)} (${op.category})</p>`;
                      }
                      return '';
                    }).join('')}
                  </div>
                  <div class="flex gap-2 confirmation-buttons">
                    <button data-action="confirm" class="bg-success text-white px-4 py-2 rounded-lg hover:bg-opacity-90 text-sm font-semibold">
                      <i class="fa-solid fa-check mr-1"></i> Yes, Confirm
                    </button>
                    <button data-action="cancel" class="bg-error text-white px-4 py-2 rounded-lg hover:bg-opacity-90 text-sm font-semibold">
                      <i class="fa-solid fa-times mr-1"></i> No, Cancel
                    </button>
                  </div>
                </div>
              `,
              timestamp: new Date(),
              isConfirmation: true
            };
            
            setChatHistory(prev => [...prev, confirmationMessage]);
            setLoading(false);
            return;
          }
        }
      }
      
      // Check if user wants to undo
      if (userMessage.toLowerCase().includes('undo') || 
          userMessage.toLowerCase().includes('revert') ||
          userMessage.toLowerCase().includes('cancel last')) {
        await executeUndo();
        setLoading(false);
        return;
      }

      // Process user input with enhanced AI
      const aiResponse = await processUserInput(userMessage);
      
      if (aiResponse) {
        if (aiResponse.intent === 'transaction_ops' && aiResponse.operations && aiResponse.operations.length > 0) {
          // Check if any operation has missing required information
          const operationsNeedingInfo = aiResponse.operations.filter(op => {
            if (op.action === 'add') {
              return !op.amount || op.amount === 0;
            }
            return false;
          });
          
          if (operationsNeedingInfo.length > 0) {
            // Ask for missing information
            const missingInfoMessages = operationsNeedingInfo.map(op => {
              if (op.action === 'add' && (!op.amount || op.amount === 0)) {
                return `I understood you want to add "${op.description}" as ${op.type}. How much is the amount?`;
              }
            }).filter(Boolean).join(' ');
            
            setChatHistory(prev => [...prev, {
              type: 'ai',
              content: `<div class="text-sm">
                <p>${missingInfoMessages}</p>
                <p class="text-xs text-light-subtle dark:text-brand-subtle mt-2">Please provide the amount to continue.</p>
              </div>`,
              timestamp: new Date(),
              needsInfo: true,
              pendingOperation: aiResponse
            }]);
            
            // Store the pending operation for when user provides the amount
            setConversationContext(prev => [...prev, { 
              role: 'assistant', 
              message: 'waiting_for_amount',
              pendingOperation: aiResponse
            }]);
            
            setLoading(false);
            return;
          }
          
          if (aiResponse.requiresConfirmation) {
            // Pre-process operations to find matching transactions
            const processedOperations = await Promise.all(aiResponse.operations.map(async op => {
              if ((op.action === 'update' || op.action === 'delete') && op.identifyBy) {
                // Find matching transactions
                const matches = transactions.filter(tx => {
                  let match = true;
                  
                  if (op.identifyBy.description) {
                    match = match && tx.description.toLowerCase().includes(op.identifyBy.description.toLowerCase());
                  }
                  
                  if (op.identifyBy.category) {
                    match = match && tx.category.toLowerCase() === op.identifyBy.category.toLowerCase();
                  }
                  
                  if (op.identifyBy.amount !== undefined) {
                    match = match && Math.abs(tx.amount - op.identifyBy.amount) < 0.01;
                  }
                  
                  if (op.identifyBy.type) {
                    match = match && tx.type === op.identifyBy.type;
                  }
                  
                  return match;
                });
                
                return { ...op, matchingTransactions: matches };
              }
              return op;
            }));
            
            // Show confirmation message
            setPendingConfirmation({
              operations: processedOperations,
              response: aiResponse
            });
            
            const confirmationMessage = {
              type: 'ai',
              content: `
                <div class="space-y-3">
                  <div class="text-sm">${aiResponse.confirmationMessage || 'Please confirm this operation:'}</div>
                  <div class="bg-light-tertiary dark:bg-brand-primary p-3 rounded-lg">
                    ${aiResponse.operations.map(op => {
                      if (op.action === 'add') {
                        return `<p class="text-sm"><strong>Add ${op.type}:</strong> ${op.description} - ${formatCurrency(op.amount, true)} (${op.category})</p>`;
                      } else if (op.action === 'update') {
                        return `<p class="text-sm"><strong>Update transaction:</strong> ${Object.entries(op).filter(([k, v]) => k !== 'action' && v !== undefined).map(([k, v]) => `${k}: ${k === 'amount' ? formatCurrency(v, true) : v}`).join(', ')}</p>`;
                      } else if (op.action === 'delete') {
                        if (op.filter?.category) {
                          return `<p class="text-sm"><strong>Delete all ${op.filter.category} transactions</strong></p>`;
                        } else if (op.transactionIds) {
                          return `<p class="text-sm"><strong>Delete ${op.transactionIds.length} transaction(s)</strong></p>`;
                        }
                        return `<p class="text-sm"><strong>Delete transactions</strong></p>`;
                      }
                    }).join('')}
                  </div>
                  <div class="flex gap-2">
                    <button data-action="confirm" class="bg-success text-white px-4 py-2 rounded-lg hover:bg-opacity-90 text-sm font-semibold">
                      <i class="fa-solid fa-check mr-1"></i> Yes, Confirm
                    </button>
                    <button data-action="cancel" class="bg-error text-white px-4 py-2 rounded-lg hover:bg-opacity-90 text-sm font-semibold">
                      <i class="fa-solid fa-times mr-1"></i> No, Cancel
                    </button>
                  </div>
                </div>
              `,
              timestamp: new Date(),
              isConfirmation: true
            };
            
            setChatHistory(prev => [...prev, confirmationMessage]);
          } else {
            // Execute without confirmation (shouldn't happen with new logic)
            const results = await executeTransactionOperations(aiResponse.operations);
            
            const successResults = results.filter(r => r.success);
            const failureResults = results.filter(r => !r.success);
            
            let responseContent = '';
            
            if (successResults.length > 0) {
              responseContent = `<div class="space-y-1">`;
              successResults.forEach(r => {
                responseContent += `<div class="text-sm text-success flex items-center gap-2">
                  <i class="fa-solid fa-check-circle"></i>
                  <span>${r.message}</span>
                </div>`;
              });
              responseContent += `</div>`;
              showToast(successResults.map(r => r.message).join(', '), 'success');
            }
            
            if (failureResults.length > 0) {
              if (!responseContent) responseContent = '<div class="space-y-1">';
              failureResults.forEach(r => {
                responseContent += `<div class="text-sm text-error flex items-center gap-2">
                  <i class="fa-solid fa-times-circle"></i>
                  <span>${r.message}</span>
                </div>`;
              });
              if (successResults.length === 0) responseContent += '</div>';
              showToast(failureResults.map(r => r.message).join(', '), 'error');
            }
            
            if (aiResponse.response_html && aiResponse.response_html.trim()) {
              responseContent += `<div class="mt-2">${aiResponse.response_html}</div>`;
            }
            
            setChatHistory(prev => [...prev, {
              type: 'ai',
              content: responseContent,
              timestamp: new Date()
            }]);
          }
        } else if (aiResponse.intent === 'show_data' || aiResponse.intent === 'complex_query') {
          // For data queries, show the AI's analytical response
          setChatHistory(prev => [...prev, {
            type: 'ai',
            content: aiResponse.response_html,
            timestamp: new Date()
          }]);
        } else if (aiResponse.response_html) {
          // General chat or other responses
          setChatHistory(prev => [...prev, {
            type: 'ai',
            content: aiResponse.response_html,
            timestamp: new Date()
          }]);
        }
      } else {
        // Fallback response
        setChatHistory(prev => [...prev, {
          type: 'ai',
          content: `<div class="text-sm">I didn't quite understand that. Could you rephrase? You can try:
            <ul class="list-disc list-inside mt-1 text-xs">
              <li>"Add 500 expense for food"</li>
              <li>"Show my balance"</li>
              <li>"Delete all shopping transactions"</li>
              <li>"I received my salary" (I'll use your usual amount)</li>
              <li>"Undo" to revert last action</li>
            </ul>
          </div>`,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Error processing user input:', error);
      showToast('Something went wrong. Please try again.', 'error');
      setChatHistory(prev => [...prev, {
        type: 'ai',
        content: `<div class="text-sm text-error">❌ Failed to process your request. Please try again.</div>`,
        timestamp: new Date()
      }]);
    }
    
    setLoading(false);
  };

  const handleQuestionAnswer = async () => {
    if (!currentInput.trim()) return;

    setChatHistory(prev => [...prev, {
      type: 'user',
      content: currentInput,
      timestamp: new Date()
    }]);

    const newAnswers = [...planAnswers, currentInput];
    setPlanAnswers(newAnswers);
    setCurrentInput('');

    if (currentQuestionIndex + 1 < dynamicQuestions.length) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      
      const bgColor = activeMode === 'saving' ? 'bg-accent/10' : 'bg-blue-100 dark:bg-blue-900/20';
      
      setChatHistory(prev => [...prev, {
        type: 'ai',
        content: `<div class="space-y-2">
          <div class="${bgColor} p-2 rounded-lg">
            <p class="font-semibold text-xs">Question ${nextIndex + 1} of ${dynamicQuestions.length}</p>
            <p class="text-sm">${dynamicQuestions[nextIndex]}</p>
          </div>
        </div>`,
        timestamp: new Date()
      }]);
    } else {
      await generateFinalPlan(newAnswers);
    }
  };

  const generateFinalPlan = async (answers) => {
    setLoading(true);
    
    setChatHistory(prev => [...prev, {
      type: 'ai',
      content: '<div class="flex items-center gap-2 text-sm"><i class="fa-solid fa-spinner fa-spin"></i> Creating your personalized plan based on your answers...</div>',
      timestamp: new Date()
    }]);

    const qaContext = dynamicQuestions.map((q, i) => `Q: ${q}\nA: ${answers[i] || 'No answer'}`).join('\n\n');
    
    const prompt = activeMode === 'saving'
      ? `Create a detailed, personalized savings plan for ${userData?.name} based on their Q&A responses and financial data. Consider their income, expenses, and goals mentioned. Use compact currency format (L/CR/K).`
      : `Create a comprehensive, realistic monthly budget for ${userData?.name} based on their Q&A responses and spending patterns. Allocate budget intelligently based on their priorities. Use compact currency format (L/CR/K).`;

    const schema = activeMode === 'saving' ? {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          goalTitle: { type: "STRING" },
          targetAmount: { type: "NUMBER" },
          monthlyContribution: { type: "NUMBER" },
          timeline: { type: "STRING" },
          description: { type: "STRING" },
          steps: { type: "ARRAY", items: { type: "STRING" } }
        }
      }
    } : {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          category: { type: "STRING" },
          budgetedAmount: { type: "NUMBER" },
          currentSpending: { type: "NUMBER" },
          suggestion: { type: "STRING" }
        }
      }
    };

    const instructions = `
      Based on this Q&A session:
      ${qaContext}
      
      And the user's financial data, create a comprehensive ${activeMode} plan in JSON format.
      Be specific and actionable. Consider their actual spending patterns and income.
      Use compact currency format (L for Lakhs, CR for Crores, K for Thousands) in descriptions.
    `;

    const planData = await callGeminiAPI(prompt, { schema, instructions });
    
    if (planData) {
      try {
        const plan = JSON.parse(planData);
        setGeneratedPlan(plan);
        
        const planHtml = formatPlanDisplay(plan);
        setChatHistory(prev => [...prev, {
          type: 'ai',
          content: planHtml,
          timestamp: new Date()
        }]);
        
        setShowSavePlan(true);
      } catch (error) {
        console.error('Error parsing plan:', error);
        showToast('Error generating plan. Please try again.', 'error');
      }
    }
    
    setLoading(false);
  };

  const formatPlanDisplay = (plan) => {
    if (activeMode === 'saving') {
      return `
        <div class="space-y-3">
          <h3 class="font-bold text-lg mb-2 flex items-center gap-2">
            <i class="fa-solid fa-piggy-bank text-accent"></i>
            Your Personalized Savings Plan
          </h3>
          ${plan.map((goal, index) => `
            <div class="p-3 bg-light-tertiary dark:bg-brand-primary rounded-lg border border-light-tertiary dark:border-brand-tertiary">
              <div class="flex justify-between items-start mb-2">
                <strong class="text-accent">${index + 1}. ${goal.goalTitle}</strong>
                <span class="text-xs bg-accent/20 px-2 py-1 rounded">${goal.timeline}</span>
              </div>
              <div class="grid grid-cols-2 gap-2 mb-2 text-sm">
                <div>
                  <span class="text-light-subtle dark:text-brand-subtle">Target:</span>
                  <strong class="ml-1">${formatCurrency(goal.targetAmount, true)}</strong>
                </div>
                <div>
                  <span class="text-light-subtle dark:text-brand-subtle">Monthly:</span>
                  <strong class="ml-1">${formatCurrency(goal.monthlyContribution, true)}</strong>
                </div>
              </div>
              <p class="text-sm text-light-subtle dark:text-brand-subtle mb-2">${goal.description}</p>
              ${goal.steps && goal.steps.length > 0 ? `
                <div class="mt-2">
                  <p class="text-xs font-semibold mb-1">Action Steps:</p>
                  <ul class="list-disc list-inside text-xs space-y-1">
                    ${goal.steps.map(step => `<li>${step}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `;
    } else {
      const totalBudget = plan.reduce((sum, item) => sum + item.budgetedAmount, 0);
      return `
        <div class="space-y-3">
          <h3 class="font-bold text-lg mb-2 flex items-center gap-2">
            <i class="fa-solid fa-chart-pie text-blue-500"></i>
            Your Monthly Budget Plan
          </h3>
          <div class="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-lg mb-3">
            <p class="text-sm">Total Monthly Budget: <strong>${formatCurrency(totalBudget, true)}</strong></p>
          </div>
          ${plan.map((item, index) => `
            <div class="p-3 bg-light-tertiary dark:bg-brand-primary rounded-lg border border-light-tertiary dark:border-brand-tertiary">
              <div class="flex justify-between items-center mb-2">
                <strong>${index + 1}. ${item.category}</strong>
                <span class="font-bold text-accent">${formatCurrency(item.budgetedAmount, true)}</span>
              </div>
              ${item.currentSpending !== undefined ? `
                <div class="text-xs mb-2">
                  <span class="text-light-subtle dark:text-brand-subtle">Current spending:</span>
                  <span class="ml-1 ${item.currentSpending > item.budgetedAmount ? 'text-error' : 'text-success'}">
                    ${formatCurrency(item.currentSpending, true)}
                  </span>
                </div>
              ` : ''}
              <p class="text-sm text-light-subtle dark:text-brand-subtle">${item.suggestion}</p>
            </div>
          `).join('')}
        </div>
      `;
    }
  };

  const savePlan = async () => {
    if (!generatedPlan) return;

    try {
      const planKey = activeMode === 'saving' ? 'savingPlans' : 'monthlyBudgetPlans';
      await updateUserData({
        [planKey]: JSON.stringify(generatedPlan),
        [`${planKey}_created`]: new Date().toISOString()
      });
      
      showToast('Plan saved successfully! Redirecting...', 'success');
      setShowSavePlan(false);
      
      // Small delay for user to see the success message
      setTimeout(() => {
        if (activeMode === 'saving') {
          window.location.href = '/saving-goals';
        } else {
          window.location.href = '/my-budget';
        }
      }, 1500);
    } catch (error) {
      console.error('Error saving plan:', error);
      showToast('Error saving plan. Please try again.', 'error');
    }
  };

  const renderContent = () => {
    if (activeMode === 'analysis') {
      return (
        <div className="bg-light-primary dark:bg-brand-tertiary rounded-lg p-4 overflow-y-auto border border-light-tertiary dark:border-brand-tertiary" style={{ height: '280px' }}>
          <div dangerouslySetInnerHTML={{ __html: analysisContent }} />
        </div>
      );
    }

    return (
      <div className="bg-light-primary dark:bg-brand-tertiary rounded-lg border border-light-tertiary dark:border-brand-tertiary flex flex-col" style={{ height: '280px' }}>
        <div 
          ref={chatRef}
          className="flex-grow p-3 overflow-y-auto space-y-2"
          onClick={(e) => {
            // Handle confirmation button clicks
            const target = e.target.closest('button[data-action]');
            if (target && pendingConfirmation) {
              const action = target.getAttribute('data-action');
              if (action === 'confirm') {
                // Get selected transactions from checkboxes
                const checkboxes = document.querySelectorAll('.transaction-select:checked');
                const selectedTransactions = {};
                
                checkboxes.forEach(checkbox => {
                  const opIndex = parseInt(checkbox.getAttribute('data-op-index'));
                  const txId = checkbox.getAttribute('data-tx-id');
                  
                  if (!selectedTransactions[opIndex]) {
                    selectedTransactions[opIndex] = [];
                  }
                  selectedTransactions[opIndex].push(txId);
                });
                
                // Modify operations to only include selected transactions
                const modifiedOperations = pendingConfirmation.operations.map((op, index) => {
                  if (op.matchingTransactions && selectedTransactions[index]) {
                    const selectedIds = selectedTransactions[index];
                    if (op.action === 'update') {
                      // For updates, only update the selected transaction (first one if multiple selected)
                      return { ...op, transactionId: selectedIds[0] };
                    } else if (op.action === 'delete') {
                      // For deletes, delete all selected
                      return { ...op, transactionIds: selectedIds };
                    }
                  }
                  return op;
                });
                
                handleConfirmation(true, modifiedOperations);
              } else if (action === 'cancel') {
                handleConfirmation(false);
              } else if (action === 'toggle-all') {
                // Toggle all checkboxes
                const checkboxes = document.querySelectorAll('.transaction-select');
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                checkboxes.forEach(cb => cb.checked = !allChecked);
              }
            }
          }}
        >
          {chatHistory.map((message, index) => (
            <div 
              key={index}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[80%] p-2 rounded-lg ${
                  message.type === 'user' 
                    ? 'chat-bubble-user' 
                    : 'chat-bubble-ai'
                }`}
              >
                {message.type === 'user' ? (
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: message.content }} />
                )}
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start">
              <div className="chat-bubble-ai p-2 rounded-lg">
                <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                <span className="text-sm">Processing...</span>
              </div>
            </div>
          )}
        </div>
        
        {showSavePlan && (
          <div className="p-2 border-t border-light-tertiary dark:border-brand-tertiary">
            <button 
              onClick={savePlan}
              className="w-full bg-success text-white font-bold py-2 px-4 rounded-lg hover:bg-opacity-90 transition"
            >
              Save Plan and View
            </button>
          </div>
        )}
        
        <div className="p-2 border-t border-light-tertiary dark:border-brand-tertiary">
          <form onSubmit={handleChatSubmit} className="flex gap-2">
            <input
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              placeholder={
                activeMode === 'saving' || activeMode === 'budget' 
                  ? "Type your answer..." 
                  : "Try: 'balance kitna hai' or 'maine 500 kharch kiya'"
              }
              disabled={loading || pendingConfirmation !== null}
              className="flex-grow bg-light-secondary dark:bg-brand-secondary border border-light-tertiary dark:border-brand-primary rounded-lg p-2 focus:ring-accent focus:border-accent transition disabled:opacity-50"
            />
            <button 
              type="submit"
              disabled={loading || !currentInput.trim() || pendingConfirmation !== null}
              className="bg-accent text-white font-bold py-2 px-4 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <i className="fa-solid fa-spinner fa-spin"></i>
              ) : (
                <i className="fa-solid fa-paper-plane"></i>
              )}
            </button>
            {undoHistory.length > 0 && !loading && !pendingConfirmation && (
              <button 
                type="button"
                onClick={executeUndo}
                className="bg-gray-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-opacity-90 transition"
                title={`Undo last action (${undoHistory.length} available)`}
              >
                <i className="fa-solid fa-undo"></i>
              </button>
            )}
          </form>
        </div>
      </div>
    );
  };

  return (
    <section className="bg-light-secondary dark:bg-brand-secondary p-6 rounded-2xl border border-light-tertiary dark:border-transparent flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-accent flex-shrink-0">Financial Assistant</h3>
        <button 
          onClick={() => {
            setActiveMode('analysis');
            generateAnalysis();
          }}
          disabled={loading}
          className="bg-accent text-white font-bold py-2 px-4 rounded-lg hover:bg-opacity-90 transition disabled:opacity-50 text-sm"
        >
          <i className="fa-solid fa-sync-alt mr-2"></i>
          Update Analysis
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 flex-grow">
        <div className="space-y-4 md:col-span-1">
          <button 
            onClick={() => setActiveMode('analysis')}
            disabled={loading}
            className="w-full bg-light-primary dark:bg-brand-tertiary p-4 rounded-lg text-left font-semibold border border-light-tertiary dark:border-brand-tertiary hover:bg-gray-200 dark:hover:bg-brand-primary transition disabled:opacity-50"
          >
            View Expense Analysis
          </button>
          
          <button 
            onClick={startBudgetPlan}
            disabled={loading}
            className="w-full bg-light-primary dark:bg-brand-tertiary p-4 rounded-lg text-left font-semibold border border-light-tertiary dark:border-brand-tertiary hover:bg-gray-200 dark:hover:bg-brand-primary transition disabled:opacity-50"
          >
            Create Monthly Budget
          </button>
          
          <button 
            onClick={startSavingsPlan}
            disabled={loading}
            className="w-full bg-light-primary dark:bg-brand-tertiary p-4 rounded-lg text-left font-semibold border border-light-tertiary dark:border-brand-tertiary hover:bg-gray-200 dark:hover:bg-brand-primary transition disabled:opacity-50"
          >
            Create Saving Plan
          </button>
          
          <button 
            onClick={startAIChat}
            disabled={loading}
            className="w-full bg-light-primary dark:bg-brand-tertiary p-4 rounded-lg text-left font-semibold border border-light-tertiary dark:border-brand-tertiary hover:bg-gray-200 dark:hover:bg-brand-primary transition disabled:opacity-50"
          >
            Chat with Assistant
          </button>
        </div>
        
        <div className="md:col-span-2">
          {renderContent()}
        </div>
      </div>
    </section>
  );
};

export default FinancialAssistant;