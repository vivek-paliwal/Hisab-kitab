import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../utils/firebase';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';
import { formatCurrency } from '../utils/formatCurrency';

function SavingGoalsPage() {
  const [savingPlans, setSavingPlans] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [newPlan, setNewPlan] = useState({
    goalTitle: '',
    description: '',
    targetAmount: '',
    monthlyContribution: '',
    timeline: '',
    steps: ''
  });
  const [contributionAmount, setContributionAmount] = useState('');
  const [selectedGoalIndex, setSelectedGoalIndex] = useState(-1);
  const [editIndex, setEditIndex] = useState(-1);
  const { currentUser, userData } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (currentUser) {
      loadSavingPlans();
    }
  }, [currentUser]);

  const loadSavingPlans = async () => {
    if (!currentUser) return;
    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.savingPlans) {
          try {
            const plans = JSON.parse(userData.savingPlans);
            // Initialize saved amount if not present
            const plansWithSaved = plans.map(plan => ({
              ...plan,
              savedAmount: plan.savedAmount || 0,
              contributions: plan.contributions || []
            }));
            setSavingPlans(Array.isArray(plansWithSaved) ? plansWithSaved : []);
          } catch (error) {
            console.error("Error parsing saving plans:", error);
            setSavingPlans([]);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load saving plans:", error);
      showToast('Failed to load saving goals', 'error');
    }
  };

  const updateFirebasePlans = async (plans) => {
    if (!currentUser) return;
    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(userDocRef, {
        savingPlans: JSON.stringify(plans),
        savingPlans_updated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error updating saving plans:", error);
      throw error;
    }
  };

  const handleEdit = (plan, index) => {
    setEditingPlan({
      ...plan,
      steps: Array.isArray(plan.steps) ? plan.steps.join('\n') : ''
    });
    setEditIndex(index);
    setShowEditModal(true);
  };

  const handleDelete = async (index) => {
    if (window.confirm('Are you sure you want to delete this saving goal?')) {
      try {
        const newPlans = savingPlans.filter((_, i) => i !== index);
        setSavingPlans(newPlans);
        await updateFirebasePlans(newPlans);
        showToast('Saving goal deleted successfully!', 'success');
      } catch (error) {
        showToast('Failed to delete saving goal', 'error');
      }
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const newPlans = [...savingPlans];
      newPlans[editIndex] = {
        ...editingPlan,
        targetAmount: parseFloat(editingPlan.targetAmount),
        monthlyContribution: parseFloat(editingPlan.monthlyContribution),
        steps: editingPlan.steps.split('\n').filter(s => s.trim() !== ''),
        savedAmount: newPlans[editIndex].savedAmount || 0,
        contributions: newPlans[editIndex].contributions || []
      };
      setSavingPlans(newPlans);
      await updateFirebasePlans(newPlans);
      setShowEditModal(false);
      setEditingPlan(null);
      setEditIndex(-1);
      showToast('Saving goal updated successfully!', 'success');
    } catch (error) {
      showToast('Failed to update saving goal', 'error');
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const newGoal = {
        ...newPlan,
        targetAmount: parseFloat(newPlan.targetAmount),
        monthlyContribution: parseFloat(newPlan.monthlyContribution),
        steps: newPlan.steps.split('\n').filter(s => s.trim() !== ''),
        savedAmount: 0,
        contributions: [],
        createdAt: new Date().toISOString()
      };
      const newPlans = [...savingPlans, newGoal];
      setSavingPlans(newPlans);
      await updateFirebasePlans(newPlans);
      setShowAddModal(false);
      setNewPlan({
        goalTitle: '',
        description: '',
        targetAmount: '',
        monthlyContribution: '',
        timeline: '',
        steps: ''
      });
      showToast('Saving goal added successfully!', 'success');
    } catch (error) {
      showToast('Failed to add saving goal', 'error');
    }
  };

  const handleContribute = (index) => {
    setSelectedGoalIndex(index);
    setContributionAmount(savingPlans[index].monthlyContribution.toString());
    setShowContributeModal(true);
  };

  const handleContributionSubmit = async (e) => {
    e.preventDefault();
    try {
      const amount = parseFloat(contributionAmount);
      if (amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
      }

      const newPlans = [...savingPlans];
      const plan = newPlans[selectedGoalIndex];
      
      plan.savedAmount = (plan.savedAmount || 0) + amount;
      plan.contributions = plan.contributions || [];
      plan.contributions.push({
        amount: amount,
        date: new Date().toISOString(),
        id: Date.now().toString()
      });

      setSavingPlans(newPlans);
      await updateFirebasePlans(newPlans);

      // Also add as income transaction
      if (currentUser) {
        await addDoc(collection(db, "users", currentUser.uid, "transactions"), {
          type: 'income',
          description: `Savings contribution: ${plan.goalTitle}`,
          amount: amount,
          category: 'Savings',
          date: new Date().toISOString().split('T')[0],
          createdAt: serverTimestamp()
        });
      }

      setShowContributeModal(false);
      setContributionAmount('');
      showToast(`Successfully saved ${formatCurrency(amount, true)} towards ${plan.goalTitle}!`, 'success');
    } catch (error) {
      showToast('Failed to record contribution', 'error');
    }
  };

  const getProgressPercentage = (savedAmount, targetAmount) => {
    return targetAmount > 0 ? (savedAmount / targetAmount) * 100 : 0;
  };

  const getProgressColor = (percentage) => {
    if (percentage < 25) return 'bg-red-500';
    if (percentage < 50) return 'bg-orange-500';
    if (percentage < 75) return 'bg-yellow-500';
    if (percentage < 100) return 'bg-green-500';
    return 'bg-accent';
  };

  const getTimeRemaining = (timeline) => {
    // Simple implementation - you can make this more sophisticated
    return timeline;
  };

  const calculateMonthsToGoal = (savedAmount, targetAmount, monthlyContribution) => {
    const remaining = targetAmount - savedAmount;
    if (remaining <= 0) return 0;
    return Math.ceil(remaining / monthlyContribution);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Saving Goals" showProfile={true} showMenu={true} />
      
      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="bg-light-secondary dark:bg-brand-secondary p-8 rounded-2xl border border-light-tertiary dark:border-transparent shadow-2xl w-full max-w-lg m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-accent">Edit Saving Goal</h2>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-light-subtle dark:text-brand-subtle text-2xl font-bold hover:text-error"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Goal Title</label>
                <input 
                  type="text" 
                  value={editingPlan?.goalTitle || ''}
                  onChange={(e) => setEditingPlan(prev => ({ ...prev, goalTitle: e.target.value }))}
                  required 
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Description</label>
                <textarea 
                  rows="2" 
                  value={editingPlan?.description || ''}
                  onChange={(e) => setEditingPlan(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Target Amount</label>
                  <input 
                    type="number" 
                    value={editingPlan?.targetAmount || ''}
                    onChange={(e) => setEditingPlan(prev => ({ ...prev, targetAmount: e.target.value }))}
                    required 
                    min="0"
                    step="0.01"
                    className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Monthly Contribution</label>
                  <input 
                    type="number" 
                    value={editingPlan?.monthlyContribution || ''}
                    onChange={(e) => setEditingPlan(prev => ({ ...prev, monthlyContribution: e.target.value }))}
                    required 
                    min="0"
                    step="0.01"
                    className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Timeline</label>
                  <input 
                    type="text" 
                    value={editingPlan?.timeline || ''}
                    onChange={(e) => setEditingPlan(prev => ({ ...prev, timeline: e.target.value }))}
                    required 
                    placeholder="e.g., 6 months, 1 year"
                    className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Actionable Steps (one per line)</label>
                <textarea 
                  rows="3" 
                  value={editingPlan?.steps || ''}
                  onChange={(e) => setEditingPlan(prev => ({ ...prev, steps: e.target.value }))}
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
          <div className="bg-light-secondary dark:bg-brand-secondary p-8 rounded-2xl border border-light-tertiary dark:border-transparent shadow-2xl w-full max-w-lg m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-accent">Add Saving Goal</h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-light-subtle dark:text-brand-subtle text-2xl font-bold hover:text-error"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Goal Title</label>
                <input 
                  type="text" 
                  value={newPlan.goalTitle}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, goalTitle: e.target.value }))}
                  required 
                  placeholder="e.g., Emergency Fund, New Car, Vacation"
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Description</label>
                <textarea 
                  rows="2" 
                  value={newPlan.description}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What is this saving goal for?"
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Target Amount</label>
                  <input 
                    type="number" 
                    value={newPlan.targetAmount}
                    onChange={(e) => setNewPlan(prev => ({ ...prev, targetAmount: e.target.value }))}
                    required 
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Monthly Contribution</label>
                  <input 
                    type="number" 
                    value={newPlan.monthlyContribution}
                    onChange={(e) => setNewPlan(prev => ({ ...prev, monthlyContribution: e.target.value }))}
                    required 
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Timeline</label>
                  <input 
                    type="text" 
                    value={newPlan.timeline}
                    onChange={(e) => setNewPlan(prev => ({ ...prev, timeline: e.target.value }))}
                    required 
                    placeholder="e.g., 6 months, 1 year"
                    className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Actionable Steps (one per line)</label>
                <textarea 
                  rows="3" 
                  value={newPlan.steps}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, steps: e.target.value }))}
                  placeholder="Step 1: Set up automatic transfer&#10;Step 2: Review expenses monthly&#10;Step 3: Find additional income sources"
                  className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-accent text-white font-bold py-3 px-4 rounded-lg hover:bg-opacity-90 transition-transform transform hover:scale-105"
              >
                Add Saving Goal
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Contribution Modal */}
      {showContributeModal && (
        <div className="modal-overlay">
          <div className="bg-light-secondary dark:bg-brand-secondary p-8 rounded-2xl border border-light-tertiary dark:border-transparent shadow-2xl w-full max-w-md m-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-accent">Add Contribution</h2>
              <button 
                onClick={() => setShowContributeModal(false)}
                className="text-light-subtle dark:text-brand-subtle text-2xl font-bold hover:text-error"
              >
                &times;
              </button>
            </div>
            {selectedGoalIndex >= 0 && (
              <>
                <p className="text-lg font-semibold mb-4">{savingPlans[selectedGoalIndex].goalTitle}</p>
                <form onSubmit={handleContributionSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-light-subtle dark:text-brand-subtle">Contribution Amount</label>
                    <input 
                      type="number" 
                      value={contributionAmount}
                      onChange={(e) => setContributionAmount(e.target.value)}
                      required 
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      className="mt-1 block w-full bg-light-primary dark:bg-brand-tertiary border border-light-tertiary dark:border-brand-primary rounded-lg p-3 focus:ring-accent focus:border-accent transition"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setContributionAmount(savingPlans[selectedGoalIndex].monthlyContribution.toString())}
                        className="text-xs bg-light-tertiary dark:bg-brand-primary px-2 py-1 rounded"
                      >
                        Monthly ({formatCurrency(savingPlans[selectedGoalIndex].monthlyContribution, true)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setContributionAmount((savingPlans[selectedGoalIndex].monthlyContribution * 0.5).toString())}
                        className="text-xs bg-light-tertiary dark:bg-brand-primary px-2 py-1 rounded"
                      >
                        Half ({formatCurrency(savingPlans[selectedGoalIndex].monthlyContribution * 0.5, true)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setContributionAmount((savingPlans[selectedGoalIndex].monthlyContribution * 2).toString())}
                        className="text-xs bg-light-tertiary dark:bg-brand-primary px-2 py-1 rounded"
                      >
                        Double ({formatCurrency(savingPlans[selectedGoalIndex].monthlyContribution * 2, true)})
                      </button>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full bg-accent text-white font-bold py-3 px-4 rounded-lg hover:bg-opacity-90 transition-transform transform hover:scale-105"
                  >
                    Add Contribution
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <main className="flex-grow p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-light-secondary dark:bg-brand-secondary p-6 rounded-2xl border border-light-tertiary dark:border-transparent">
              <p className="text-sm text-light-subtle dark:text-brand-subtle">Total Goals</p>
              <p className="text-2xl font-bold text-accent">{savingPlans.length}</p>
            </div>
            <div className="bg-light-secondary dark:bg-brand-secondary p-6 rounded-2xl border border-light-tertiary dark:border-transparent">
              <p className="text-sm text-light-subtle dark:text-brand-subtle">Total Target</p>
              <p className="text-2xl font-bold">
                {formatCurrency(savingPlans.reduce((sum, plan) => sum + (plan.targetAmount || 0), 0), true)}
              </p>
            </div>
            <div className="bg-light-secondary dark:bg-brand-secondary p-6 rounded-2xl border border-light-tertiary dark:border-transparent">
              <p className="text-sm text-light-subtle dark:text-brand-subtle">Total Saved</p>
              <p className="text-2xl font-bold text-green-500">
                {formatCurrency(savingPlans.reduce((sum, plan) => sum + (plan.savedAmount || 0), 0), true)}
              </p>
            </div>
            <div className="bg-light-secondary dark:bg-brand-secondary p-6 rounded-2xl border border-light-tertiary dark:border-transparent">
              <p className="text-sm text-light-subtle dark:text-brand-subtle">Monthly Target</p>
              <p className="text-2xl font-bold">
                {formatCurrency(savingPlans.reduce((sum, plan) => sum + (plan.monthlyContribution || 0), 0), true)}
              </p>
            </div>
          </div>

          {/* Saving Goals */}
          <div className="space-y-6">
            {savingPlans.length === 0 ? (
              <div className="text-center py-12">
                <i className="fa-solid fa-piggy-bank text-6xl text-light-subtle dark:text-brand-subtle mb-4"></i>
                <p className="text-light-subtle dark:text-brand-subtle mb-4">You haven't created any saving goals yet.</p>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="bg-accent text-white font-bold py-3 px-6 rounded-lg hover:bg-opacity-90 transition"
                >
                  <i className="fa-solid fa-plus mr-2"></i>Create Manual Goal
                </button>
              </div>
            ) : (
              savingPlans.map((plan, index) => {
                const savedAmount = plan.savedAmount || 0;
                const percentage = getProgressPercentage(savedAmount, plan.targetAmount);
                const monthsRemaining = calculateMonthsToGoal(savedAmount, plan.targetAmount, plan.monthlyContribution);
                
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
                      <h3 className="text-xl font-bold text-accent">{plan.goalTitle}</h3>
                      <p className="text-sm text-light-subtle dark:text-brand-subtle mb-4">{plan.description}</p>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center mb-4">
                        <div>
                          <p className="text-xs text-light-subtle dark:text-brand-subtle">Target</p>
                          <p className="font-bold">{formatCurrency(plan.targetAmount, true)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-light-subtle dark:text-brand-subtle">Saved</p>
                          <p className="font-bold text-green-500">{formatCurrency(savedAmount, true)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-light-subtle dark:text-brand-subtle">Monthly</p>
                          <p className="font-bold">{formatCurrency(plan.monthlyContribution, true)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-light-subtle dark:text-brand-subtle">Timeline</p>
                          <p className="font-bold">{plan.timeline}</p>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span>{percentage.toFixed(1)}% Complete</span>
                          <span className="text-light-subtle dark:text-brand-subtle">
                            {monthsRemaining > 0 ? `${monthsRemaining} months to go` : 'Goal reached!'}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                          <div 
                            className={`h-3 rounded-full ${getProgressColor(percentage)} transition-all duration-500`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      {percentage >= 100 && (
                        <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-lg mb-4">
                          <p className="text-green-700 dark:text-green-400 font-semibold">
                            <i className="fa-solid fa-check-circle mr-2"></i>
                            Congratulations! You've reached your goal!
                          </p>
                        </div>
                      )}
                      
                      {plan.steps && plan.steps.length > 0 && (
                        <div className="mb-4">
                          <h4 className="font-semibold mb-2 text-sm">Action Steps:</h4>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            {plan.steps.map((step, stepIndex) => (
                              <li key={stepIndex} className="text-light-subtle dark:text-brand-subtle">{step}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Recent Contributions */}
                      {plan.contributions && plan.contributions.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-light-tertiary dark:border-brand-tertiary">
                          <p className="text-sm font-semibold mb-2">Recent Contributions:</p>
                          <div className="space-y-1">
                            {plan.contributions.slice(-3).reverse().map((contrib, idx) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span className="text-light-subtle dark:text-brand-subtle">
                                  {new Date(contrib.date).toLocaleDateString()}
                                </span>
                                <span className="font-semibold text-green-500">
                                  +{formatCurrency(contrib.amount, true)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <button 
                        onClick={() => handleContribute(index)}
                        className="mt-4 bg-accent text-white font-bold py-2 px-4 rounded-lg hover:bg-opacity-90 transition w-full sm:w-auto"
                      >
                        <i className="fa-solid fa-plus mr-2"></i>Add Contribution
                      </button>
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

export default SavingGoalsPage;