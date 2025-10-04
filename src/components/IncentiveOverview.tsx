import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar,
  Filter,
  User,
  Target,
  Award,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useSupabase } from '../hooks/useSupabase';
import { Account, SalesData, User as UserType, IncentiveRule } from '../types';

interface MonthlyIncentiveData {
  user_id: string;
  user_name: string;
  month: string;
  year: number;
  standard_commission_accounts: Account[];
  high_commission_accounts: Account[];
  standard_commission_revenue: number;
  high_commission_revenue: number;
  standard_commission_total: number;
  high_commission_total: number;
  standard_incentive: number;
  high_incentive: number;
  total_incentive: number;
  total_revenue: number;
  total_commission: number;
  qualifying_accounts_count: number;
}

interface IncentiveOverviewProps {
  currentUser?: UserType;
}

const IncentiveOverview: React.FC<IncentiveOverviewProps> = ({ currentUser }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [incentiveRules, setIncentiveRules] = useState<IncentiveRule[]>([]);

  const {
    fetchAccounts,
    fetchSalesData,
    fetchUsers,
    fetchIncentiveRules,
  } = useSupabase();

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [accountsData, salesDataResult, usersData, rulesData] = await Promise.all([
          fetchAccounts(),
          fetchSalesData(),
          fetchUsers(),
          fetchIncentiveRules(),
        ]);
        
        setAccounts(accountsData);
        setSalesData(salesDataResult);
        setUsers(usersData);
        setIncentiveRules(rulesData);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Get active incentive rule
  const activeRule = useMemo(() => {
    return incentiveRules.find(rule => rule.is_active) || null;
  }, [incentiveRules]);

  // Calculate tiered incentive
  const calculateTieredIncentive = (revenue: number, rule: IncentiveRule, category: 'standard' | 'high'): number => {
    if (revenue < rule.base_revenue_threshold) return 0;

    let incentive = 0;
    let remainingRevenue = revenue;

    // Apply tiered rates
    const sortedTiers = [...rule.tiers].sort((a, b) => a.revenue_threshold - b.revenue_threshold);

    for (let i = 0; i < sortedTiers.length; i++) {
      const tier = sortedTiers[i];
      const nextTier = sortedTiers[i + 1];

      if (remainingRevenue <= 0) break;

      const tierThreshold = tier.revenue_threshold;
      const nextThreshold = nextTier ? nextTier.revenue_threshold : Infinity;

      if (revenue > tierThreshold) {
        const applicableRevenue = Math.min(remainingRevenue, nextThreshold - tierThreshold);

        // Different rates for standard vs high commission
        let rate = tier.incentive_rate;
        if (category === 'high') {
          rate = rate * 1.2; // 20% bonus for high commission accounts
        }

        incentive += (applicableRevenue * rate) / 100;
        remainingRevenue -= applicableRevenue;
      }
    }

    return incentive;
  };

  // Calculate monthly incentive data
  const monthlyIncentiveData = useMemo(() => {
    if (!activeRule || accounts.length === 0 || salesData.length === 0 || users.length === 0) {
      return [];
    }

    const data: MonthlyIncentiveData[] = [];
    
    // Filter sales data for selected month/year
    const filteredSalesData = salesData.filter(sale => {
      const saleDate = new Date(sale.date);
      return saleDate.getMonth() + 1 === selectedMonth && saleDate.getFullYear() === selectedYear;
    });

    // Group sales data by user
    const userSalesMap = new Map<string, SalesData[]>();
    
    filteredSalesData.forEach(sale => {
      const account = accounts.find(acc => acc.id === sale.account_id);
      if (account && account.user_id) {
        if (!userSalesMap.has(account.user_id)) {
          userSalesMap.set(account.user_id, []);
        }
        userSalesMap.get(account.user_id)!.push(sale);
      }
    });

    // Calculate incentives for each user
    userSalesMap.forEach((userSales, userId) => {
      const user = users.find(u => u.id === userId);
      if (!user) return;

      // Group accounts by commission rate category
      const accountSalesMap = new Map<string, SalesData[]>();
      userSales.forEach(sale => {
        if (!accountSalesMap.has(sale.account_id)) {
          accountSalesMap.set(sale.account_id, []);
        }
        accountSalesMap.get(sale.account_id)!.push(sale);
      });

      const standardCommissionAccounts: Account[] = [];
      const highCommissionAccounts: Account[] = [];
      let standardCommissionRevenue = 0;
      let highCommissionRevenue = 0;
      let standardCommissionTotal = 0;
      let highCommissionTotal = 0;
      let qualifyingAccountsCount = 0;

      accountSalesMap.forEach((accountSales, accountId) => {
        const account = accounts.find(acc => acc.id === accountId);
        if (!account) return;

        // Calculate totals for this account
        const accountRevenue = accountSales.reduce((sum, sale) => sum + sale.total_purchases, 0);
        const accountCommission = accountSales.reduce((sum, sale) => sum + sale.gross_commission, 0);
        const commissionRate = accountRevenue > 0 ? (accountCommission / accountRevenue) * 100 : 0;

        // Check if account qualifies (meets minimum commission threshold)
        if (accountCommission >= activeRule.min_commission_threshold) {
          qualifyingAccountsCount++;

          // Categorize by commission rate
          if (commissionRate >= activeRule.commission_rate_min && commissionRate <= activeRule.commission_rate_max) {
            if (commissionRate < 6.5) { // Standard commission (< 6.5%)
              standardCommissionAccounts.push(account);
              standardCommissionRevenue += accountRevenue;
              standardCommissionTotal += accountCommission;
            } else { // High commission (>= 6.5%)
              highCommissionAccounts.push(account);
              highCommissionRevenue += accountRevenue;
              highCommissionTotal += accountCommission;
            }
          }
        }
      });

      // Calculate incentives using tiered system
      const standardIncentive = calculateTieredIncentive(standardCommissionRevenue, activeRule, 'standard');
      const highIncentive = calculateTieredIncentive(highCommissionRevenue, activeRule, 'high');

      data.push({
        user_id: userId,
        user_name: user.name,
        month: new Date(selectedYear, selectedMonth - 1).toLocaleDateString('id-ID', { month: 'long' }),
        year: selectedYear,
        standard_commission_accounts: standardCommissionAccounts,
        high_commission_accounts: highCommissionAccounts,
        standard_commission_revenue: standardCommissionRevenue,
        high_commission_revenue: highCommissionRevenue,
        standard_commission_total: standardCommissionTotal,
        high_commission_total: highCommissionTotal,
        standard_incentive: standardIncentive,
        high_incentive: highIncentive,
        total_incentive: standardIncentive + highIncentive,
        total_revenue: standardCommissionRevenue + highCommissionRevenue,
        total_commission: standardCommissionTotal + highCommissionTotal,
        qualifying_accounts_count: qualifyingAccountsCount,
      });
    });

    return data.sort((a, b) => b.total_incentive - a.total_incentive);
  }, [accounts, salesData, users, activeRule, selectedMonth, selectedYear]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('id-ID').format(num);
  };

  // Calculate user accounts overview with aggregated metrics
  const userAccountsOverview = useMemo(() => {
    if (!activeRule) return [];

    const overview = users.map(user => {
      const userAccounts = accounts.filter(acc => acc.user_id === user.id);

      // Calculate aggregated metrics for all accounts of this user
      let totalRevenue = 0;
      let totalCommission = 0;
      let qualifyingAccountsCount = 0;

      userAccounts.forEach(account => {
        // Filter sales data for selected month/year
        const accountSales = salesData.filter(sale => {
          const saleDate = new Date(sale.date);
          return sale.account_id === account.id &&
                 saleDate.getMonth() + 1 === selectedMonth &&
                 saleDate.getFullYear() === selectedYear;
        });

        const accountCommission = accountSales.reduce((sum, sale) => sum + sale.gross_commission, 0);

        // Only count accounts that meet the min_commission_threshold
        if (accountCommission >= activeRule.min_commission_threshold) {
          const accountRevenue = accountSales.reduce((sum, sale) => sum + sale.total_purchases, 0);
          totalRevenue += accountRevenue;
          totalCommission += accountCommission;
          qualifyingAccountsCount++;
        }
      });

      const avgCommissionRate = totalRevenue > 0 ? (totalCommission / totalRevenue) * 100 : 0;

      return {
        user_id: user.id,
        user_name: user.name,
        total_accounts: userAccounts.length,
        qualifying_accounts: qualifyingAccountsCount,
        total_revenue: totalRevenue,
        total_commission: totalCommission,
        avg_commission_rate: avgCommissionRate,
      };
    });
    return overview.sort((a, b) => b.total_revenue - a.total_revenue);
  }, [users, accounts, salesData, selectedMonth, selectedYear, activeRule]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalIncentive = monthlyIncentiveData.reduce((sum, data) => sum + data.total_incentive, 0);
    const totalRevenue = monthlyIncentiveData.reduce((sum, data) => sum + data.total_revenue, 0);
    const totalCommission = monthlyIncentiveData.reduce((sum, data) => sum + data.total_commission, 0);
    const totalQualifyingAccounts = monthlyIncentiveData.reduce((sum, data) => sum + data.qualifying_accounts_count, 0);

    return {
      totalIncentive,
      totalRevenue,
      totalCommission,
      totalQualifyingAccounts,
      totalUsers: monthlyIncentiveData.length,
    };
  }, [monthlyIncentiveData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Incentive Overview</h1>
            <p className="text-gray-600">Loading incentive calculations...</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incentive Overview</h1>
          <p className="text-gray-600">Monthly incentive calculations based on tiered commission structure</p>
        </div>
        
        {/* Month/Year Filter */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2024, i).toLocaleDateString('id-ID', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {Array.from({ length: 5 }, (_, i) => (
              <option key={2024 - i} value={2024 - i}>
                {2024 - i}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg flex items-center justify-center">
              <Award className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(summaryStats.totalIncentive)}</div>
              <p className="text-sm text-gray-600">Total Incentive</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(summaryStats.totalRevenue)}</div>
              <p className="text-sm text-gray-600">Total Revenue</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-red-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{summaryStats.totalUsers}</div>
              <p className="text-sm text-gray-600">Active Users</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{summaryStats.totalQualifyingAccounts}</div>
              <p className="text-sm text-gray-600">Qualifying Accounts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Incentive Rules Info */}
      {activeRule && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">{activeRule.name}</h3>
              <p className="text-blue-800 mb-3">{activeRule.description}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-blue-900">Min Commission:</span>
                  <div className="text-blue-800">{formatCurrency(activeRule.min_commission_threshold)}</div>
                </div>
                <div>
                  <span className="font-medium text-blue-900">Base Threshold:</span>
                  <div className="text-blue-800">{formatCurrency(activeRule.base_revenue_threshold)}</div>
                </div>
                <div>
                  <span className="font-medium text-blue-900">Commission Rate Range:</span>
                  <div className="text-blue-800">{activeRule.commission_rate_min}% - {activeRule.commission_rate_max}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Incentive Details */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            User Incentive Details - {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
          </h3>
        </div>
        
        {monthlyIncentiveData.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {monthlyIncentiveData.map((userData) => (
              <div key={userData.user_id} className="p-6">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedUser(expandedUser === userData.user_id ? null : userData.user_id)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                      <User className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">{userData.user_name}</h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>{userData.qualifying_accounts_count} qualifying accounts</span>
                        <span>•</span>
                        <span>{formatCurrency(userData.total_revenue)} revenue</span>
                        <span>•</span>
                        <span>{formatCurrency(userData.total_commission)} commission</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(userData.total_incentive)}
                      </div>
                      <div className="text-sm text-gray-500">Total Incentive</div>
                    </div>
                    {expandedUser === userData.user_id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
                
                {expandedUser === userData.user_id && (
                  <div className="mt-6 space-y-6">
                    {/* Category Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Standard Commission */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h5 className="font-semibold text-gray-900 mb-3">Standard Commission (&lt; 6.5%)</h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Accounts:</span>
                            <span className="font-medium">{userData.standard_commission_accounts.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Revenue:</span>
                            <span className="font-medium">{formatCurrency(userData.standard_commission_revenue)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Commission:</span>
                            <span className="font-medium">{formatCurrency(userData.standard_commission_total)}</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-200 pt-2">
                            <span className="text-gray-900 font-semibold">Incentive:</span>
                            <span className="font-bold text-green-600">{formatCurrency(userData.standard_incentive)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* High Commission */}
                      <div className="bg-purple-50 rounded-lg p-4">
                        <h5 className="font-semibold text-gray-900 mb-3">High Commission (≥ 6.5%)</h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Accounts:</span>
                            <span className="font-medium">{userData.high_commission_accounts.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Revenue:</span>
                            <span className="font-medium">{formatCurrency(userData.high_commission_revenue)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Commission:</span>
                            <span className="font-medium">{formatCurrency(userData.high_commission_total)}</span>
                          </div>
                          <div className="flex justify-between border-t border-purple-200 pt-2">
                            <span className="text-gray-900 font-semibold">Incentive:</span>
                            <span className="font-bold text-purple-600">{formatCurrency(userData.high_incentive)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Account Lists */}
                    {(userData.standard_commission_accounts.length > 0 || userData.high_commission_accounts.length > 0) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {userData.standard_commission_accounts.length > 0 && (
                          <div>
                            <h6 className="font-medium text-gray-900 mb-2">Standard Commission Accounts</h6>
                            <div className="space-y-1">
                              {userData.standard_commission_accounts.map((account) => (
                                <div key={account.id} className="text-sm text-gray-600 bg-white rounded px-3 py-2">
                                  <div className="font-medium">{account.username}</div>
                                  <div className="text-xs text-gray-500">{account.account_code}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {userData.high_commission_accounts.length > 0 && (
                          <div>
                            <h6 className="font-medium text-gray-900 mb-2">High Commission Accounts</h6>
                            <div className="space-y-1">
                              {userData.high_commission_accounts.map((account) => (
                                <div key={account.id} className="text-sm text-gray-600 bg-white rounded px-3 py-2">
                                  <div className="font-medium">{account.username}</div>
                                  <div className="text-xs text-gray-500">{account.account_code}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Incentive Data</h3>
            <p className="text-gray-600">
              No qualifying accounts found for {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        )}
      </div>

      {/* User Accounts Overview */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">User Accounts Overview</h3>
          <p className="text-sm text-gray-600 mt-1">
            Aggregated performance for {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        {userAccountsOverview.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User Name
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qualifying Accounts
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Revenue
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Commission
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Rate (%)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {userAccountsOverview.map((userOverview) => (
                  <tr key={userOverview.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-lg flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{userOverview.user_name}</div>
                          <div className="text-xs text-gray-500">
                            {userOverview.qualifying_accounts} of {userOverview.total_accounts} accounts
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800">
                        {userOverview.qualifying_accounts}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                      {formatCurrency(userOverview.total_revenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                      {formatCurrency(userOverview.total_commission)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        userOverview.avg_commission_rate >= 6.5
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {userOverview.avg_commission_rate.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Users Found</h3>
            <p className="text-gray-600">No users available in the system</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default IncentiveOverview;
