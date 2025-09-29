import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Account, Category, SalesData, User, IncentiveRule, FileData } from '../types';

export const useSupabase = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Categories
  const fetchCategories = async (): Promise<Category[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch categories');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const addCategory = async (category: Omit<Category, 'id' | 'created_at'>): Promise<Category | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([category])
        .select()
        .maybeSingle();
      
      if (error) throw error;
      
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add category');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateCategory = async (id: string, updates: Partial<Category>): Promise<Category | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Accounts
  const fetchAccounts = async (): Promise<Account[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch accounts');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const addAccount = async (account: Omit<Account, 'id' | 'created_at'>): Promise<Account | null> => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current user to ensure proper assignment
      const { data: currentUser } = await supabase.auth.getUser();
      
      const accountData = {
        ...account,
        category_id: account.category_id || null,
        user_id: account.user_id || currentUser?.user?.id || null
      };
      
      const { data, error } = await supabase
        .from('accounts')
        .insert([accountData])
        .select()
        .maybeSingle();
      
      if (error) throw error;
      
      // If account was created successfully and user is not superadmin, auto-assign to user
      if (data && currentUser?.user && accountData.user_id === currentUser.user.id) {
        try {
          // Get current user's managed accounts
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('managed_accounts, role')
            .eq('id', currentUser.user.id)
            .maybeSingle();
          
          if (!userError && userData && userData.role !== 'superadmin') {
            const currentManagedAccounts = userData.managed_accounts || [];
            if (!currentManagedAccounts.includes(data.id)) {
              const updatedManagedAccounts = [...currentManagedAccounts, data.id];
              
              // Update user's managed accounts
              await supabase
                .from('users')
                .update({ managed_accounts: updatedManagedAccounts })
                .eq('id', currentUser.user.id);
            }
          }
        } catch (assignError) {
          console.warn('Could not auto-assign account to user:', assignError);
          // Don't throw error here as account creation was successful
        }
      }
      
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add account');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateAccount = async (id: string, updates: Partial<Account>): Promise<Account | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Sales Data
  const fetchSalesData = async (): Promise<SalesData[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('sales_data')
        .select('*')
        .order('date', { ascending: false });
      
      if (error) throw error;
      
      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sales data');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const addSalesData = async (salesData: Omit<SalesData, 'id' | 'created_at'>[]): Promise<SalesData[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('sales_data')
        .upsert(salesData, { 
          onConflict: 'account_id,date',
          ignoreDuplicates: false 
        })
        .select();
      
      if (error) throw error;
      
      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add sales data');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const deleteSalesData = async (accountId: string, dateRange?: { start: string; end: string }): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('sales_data')
        .delete()
        .eq('account_id', accountId);
      
      if (dateRange) {
        query = query
          .gte('date', dateRange.start)
          .lte('date', dateRange.end);
      }
      
      const { error } = await query;
      
      if (error) throw error;
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sales data');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Users
  const fetchUsers = async (): Promise<User[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const addUser = async (user: Omit<User, 'id' | 'created_at'>): Promise<User | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([user])
        .select()
        .maybeSingle();
      
      if (error) throw error;
      
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (id: string, updates: Partial<User>): Promise<User | null> => {
    setLoading(true);
    setError(null);
    
    try {
      // For superadmin operations, we need to ensure proper permissions
      const { data: currentUser } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Incentive Rules
  const fetchIncentiveRules = async (): Promise<IncentiveRule[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: rulesData, error: rulesError } = await supabase
        .from('incentive_rules')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (rulesError) throw rulesError;
      
      const { data: tiersData, error: tiersError } = await supabase
        .from('incentive_tiers')
        .select('*')
        .order('revenue_threshold');
      
      if (tiersError) throw tiersError;
      
      // Combine rules with their tiers
      const rules: IncentiveRule[] = (rulesData || []).map(rule => ({
        ...rule,
        tiers: (tiersData || [])
          .filter(tier => tier.rule_id === rule.id)
          .map(tier => ({
            id: tier.id,
            revenue_threshold: tier.revenue_threshold,
            incentive_rate: tier.incentive_rate,
            created_at: tier.created_at,
          }))
      }));
      
      return rules;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch incentive rules');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const addIncentiveRule = async (rule: Omit<IncentiveRule, 'id' | 'created_at'>): Promise<IncentiveRule | null> => {
    setLoading(true);
    setError(null);
    
    try {
      // Insert the rule first
      const { data: ruleData, error: ruleError } = await supabase
        .from('incentive_rules')
        .insert([{
          name: rule.name,
          description: rule.description,
          min_commission_threshold: rule.min_commission_threshold,
          commission_rate_min: rule.commission_rate_min,
          commission_rate_max: rule.commission_rate_max,
          base_revenue_threshold: rule.base_revenue_threshold,
          is_active: rule.is_active,
        }])
        .select()
        .maybeSingle();
      
      if (ruleError) throw ruleError;
      
      // Insert the tiers
      if (rule.tiers && rule.tiers.length > 0) {
        const tiersToInsert = rule.tiers.map(tier => ({
          rule_id: ruleData.id,
          revenue_threshold: tier.revenue_threshold,
          incentive_rate: tier.incentive_rate,
        }));
        
        const { data: tiersData, error: tiersError } = await supabase
          .from('incentive_tiers')
          .insert(tiersToInsert)
          .select();
        
        if (tiersError) throw tiersError;
        
        // Return the complete rule with tiers
        return {
          ...ruleData,
          tiers: (tiersData || []).map(tier => ({
            id: tier.id,
            revenue_threshold: tier.revenue_threshold,
            incentive_rate: tier.incentive_rate,
            created_at: tier.created_at,
          }))
        };
      }
      
      return { ...ruleData, tiers: [] };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add incentive rule');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateIncentiveRule = async (id: string, updates: Partial<IncentiveRule>): Promise<IncentiveRule | null> => {
    setLoading(true);
    setError(null);
    
    try {
      // Update the rule
      const { data: ruleData, error: ruleError } = await supabase
        .from('incentive_rules')
        .update({
          name: updates.name,
          description: updates.description,
          min_commission_threshold: updates.min_commission_threshold,
          commission_rate_min: updates.commission_rate_min,
          commission_rate_max: updates.commission_rate_max,
          base_revenue_threshold: updates.base_revenue_threshold,
          is_active: updates.is_active,
        })
        .eq('id', id)
        .select()
        .maybeSingle();
      
      if (ruleError) throw ruleError;
      
      // Update tiers if provided
      if (updates.tiers) {
        // Delete existing tiers
        await supabase
          .from('incentive_tiers')
          .delete()
          .eq('rule_id', id);
        
        // Insert new tiers
        if (updates.tiers.length > 0) {
          const tiersToInsert = updates.tiers.map(tier => ({
            rule_id: id,
            revenue_threshold: tier.revenue_threshold,
            incentive_rate: tier.incentive_rate,
          }));
          
          const { data: tiersData, error: tiersError } = await supabase
            .from('incentive_tiers')
            .insert(tiersToInsert)
            .select();
          
          if (tiersError) throw tiersError;
          
          return {
            ...ruleData,
            tiers: (tiersData || []).map(tier => ({
              id: tier.id,
              revenue_threshold: tier.revenue_threshold,
              incentive_rate: tier.incentive_rate,
              created_at: tier.created_at,
            }))
          };
        }
      }
      
      // Fetch existing tiers if not updating them
      const { data: tiersData } = await supabase
        .from('incentive_tiers')
        .select('*')
        .eq('rule_id', id)
        .order('revenue_threshold');
      
      return {
        ...ruleData,
        tiers: (tiersData || []).map(tier => ({
          id: tier.id,
          revenue_threshold: tier.revenue_threshold,
          incentive_rate: tier.incentive_rate,
          created_at: tier.created_at,
        }))
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update incentive rule');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteIncentiveRule = async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('incentive_rules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete incentive rule');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Profile Management
  const updateProfile = async (userId: string, profileData: {
    name?: string;
    phone?: string;
    address?: string;
    bio?: string;
  }): Promise<User | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('users')
        .update(profileData)
        .eq('id', userId)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      // First verify current password by attempting to sign in
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user?.email) {
        throw new Error('No authenticated user found');
      }

      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentUser.user.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Files
  const fetchFiles = async (): Promise<FileData[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      
      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch files');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const addFile = async (file: Omit<FileData, 'id' | 'created_at' | 'updated_at'>): Promise<FileData | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('files')
        .insert([file])
        .select()
        .maybeSingle();
      
      if (error) throw error;
      
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add file');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateFile = async (id: string, updates: Partial<FileData>): Promise<FileData | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('files')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update file');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteFile = async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    // Categories
    fetchCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    // Accounts
    fetchAccounts,
    addAccount,
    updateAccount,
    deleteAccount,
    // Sales Data
    fetchSalesData,
    addSalesData,
    deleteSalesData,
    // Users
    fetchUsers,
    addUser,
    updateUser,
    deleteUser,
    // Incentive Rules
    fetchIncentiveRules,
    addIncentiveRule,
    updateIncentiveRule,
    deleteIncentiveRule,
    // Profile
    updateProfile,
    changePassword,
    // Files
    fetchFiles,
    addFile,
    updateFile,
    deleteFile,
  };
};