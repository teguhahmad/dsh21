import React, { useState, useMemo } from 'react';
import { BarChart3, Download, Calendar, Filter, Search, ChevronDown, Check, User } from 'lucide-react';
import { Account, SalesData, Category } from '../types';

interface DateFilter {
  startDate: string;
  endDate: string;
  preset: string;
}

interface ReportsProps {
  accounts: Account[];
  salesData: SalesData[];
  categories: Category[];
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
  currentUser?: {
    id: string;
    name: string;
    email: string;
    role: 'user' | 'superadmin';
    managed_accounts: string[];
  };
}

const Reports: React.FC<ReportsProps> = ({ accounts, salesData, categories, dateFilter, onDateFilterChange, currentUser }) => {
  // Filter accounts and sales data based on user role
  const filteredAccountsByRole = React.useMemo(() => {
    if (!currentUser) return [];
    
    if (currentUser.role === 'superadmin') {
      return accounts;
    } else {
      // Regular users can only see accounts they manage
      return accounts.filter(account => 
        currentUser.managed_accounts.includes(account.id)
      );
    }
  }, [accounts, currentUser]);

  const filteredSalesDataByUser = React.useMemo(() => {
    if (!currentUser) return [];
    
    if (currentUser.role === 'superadmin') {
      return salesData;
    } else {
      // Regular users can only see sales data for accounts they manage
      return salesData.filter(data => 
        currentUser.managed_accounts.includes(data.account_id)
      );
    }
  }, [salesData, currentUser]);

  const [selectedAccount, setSelectedAccount] = useState('all');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [accountSearchTerm, setAccountSearchTerm] = useState('');
  
  const getCategoryName = (categoryId: string) => {
    if (!categoryId) return 'Belum Diatur';
    const category = categories.find(cat => cat.id === categoryId);
    return category?.name || 'Belum Diatur';
  };

  const filteredData = useMemo(() => {
    let filtered = filteredSalesDataByUser;
    
    // Filter by account
    if (selectedAccount !== 'all') {
      filtered = filtered.filter(data => data.account_id === selectedAccount);
    }
    
    // Filter by date range
    if (dateFilter.preset === 'custom' && dateFilter.startDate && dateFilter.endDate) {
      const startDate = new Date(dateFilter.startDate);
      const endDate = new Date(dateFilter.endDate);
      filtered = filtered.filter(data => {
        const dataDate = new Date(data.date);
        return dataDate >= startDate && dataDate <= endDate;
      });
    } else if (dateFilter.preset !== 'all') {
      const daysAgo = parseInt(dateFilter.preset);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
      filtered = filtered.filter(data => new Date(data.date) >= cutoffDate);
    }
    
    return filtered;
  }, [filteredSalesDataByUser, selectedAccount, dateFilter]);

  const handleDateFilterChange = (field: string, value: string) => {
    const newFilter = { ...dateFilter, [field]: value };
    
    // Reset custom dates when switching to preset
    if (field === 'preset' && value !== 'custom') {
      newFilter.startDate = '';
      newFilter.endDate = '';
    }
    
    onDateFilterChange(newFilter);
  };

  // Filter accounts for dropdown search
  const filteredAccountsForDropdown = useMemo(() => {
    return filteredAccountsByRole.filter(account =>
      account.username.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
      account.email.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
      account.account_code.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
      getCategoryName(account.category_id).toLowerCase().includes(accountSearchTerm.toLowerCase())
    );
  }, [filteredAccountsByRole, accountSearchTerm, categories]);

  const getSelectedAccountName = () => {
    if (selectedAccount === 'all') return 'All Accounts';
    const account = filteredAccountsByRole.find(acc => acc.id === selectedAccount);
    return account ? `${account.username} (${account.account_code}) - ${getCategoryName(account.category_id)}` : 'Unknown Account';
  };

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccount(accountId);
    setShowAccountDropdown(false);
    setAccountSearchTerm('');
  };
  const reportMetrics = useMemo(() => {
    const totalCommission = filteredData.reduce((sum, data) => sum + data.gross_commission, 0);
    const totalRevenue = filteredData.reduce((sum, data) => sum + data.total_purchases, 0);
    const totalOrders = filteredData.reduce((sum, data) => sum + data.orders, 0);
    const totalClicks = filteredData.reduce((sum, data) => sum + data.clicks, 0);
    const totalProductsSold = filteredData.reduce((sum, data) => sum + data.products_sold, 0);
    const totalNewBuyers = filteredData.reduce((sum, data) => sum + data.new_buyers, 0);
    
    return {
      totalCommission,
      totalRevenue,
      totalOrders,
      totalClicks,
      totalProductsSold,
      totalNewBuyers,
      avgCommissionRate: totalRevenue > 0 ? (totalCommission / totalRevenue) * 100 : 0,
      conversionRate: totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0,
    };
  }, [filteredData]);

  // Calculate accumulated data per account
  const accumulatedData = useMemo(() => {
    const accountData = new Map();
    
    filteredData.forEach(data => {
      if (!accountData.has(data.account_id)) {
        accountData.set(data.account_id, {
          account_id: data.account_id,
          clicks: 0,
          orders: 0,
          gross_commission: 0,
          products_sold: 0,
          total_purchases: 0,
          new_buyers: 0,
          data_count: 0,
          date_range: { start: data.date, end: data.date }
        });
      }
      
      const accumulated = accountData.get(data.account_id);
      accumulated.clicks += data.clicks;
      accumulated.orders += data.orders;
      accumulated.gross_commission += data.gross_commission;
      accumulated.products_sold += data.products_sold;
      accumulated.total_purchases += data.total_purchases;
      accumulated.new_buyers += data.new_buyers;
      accumulated.data_count += 1;
      
      // Update date range
      if (data.date < accumulated.date_range.start) {
        accumulated.date_range.start = data.date;
      }
      if (data.date > accumulated.date_range.end) {
        accumulated.date_range.end = data.date;
      }
    });
    
    return Array.from(accountData.values())
      .sort((a, b) => b.gross_commission - a.gross_commission); // Sort by commission descending
  }, [filteredData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const exportToCSV = () => {
    // Use accumulated data that matches the web display
    const headers = [
      'Account',
      'Account Code',
      'Period',
      'Data Days',
      'Total Clicks',
      'Total Orders',
      'Total Commission (IDR)',
      'Total Revenue (IDR)',
      'Commission %',
      'Products Sold',
      'Conversion Rate %'
    ];

    const csvData = accumulatedData.map(data => {
      const account = filteredAccountsByRole.find(acc => acc.id === data.account_id);
      const convRate = data.clicks > 0 ? (data.orders / data.clicks) * 100 : 0;
      const commissionRate = data.total_purchases > 0 ? (data.gross_commission / data.total_purchases) * 100 : 0;
      
      return [
        account?.username || 'Unknown',
        account?.account_code || 'Unknown',
        data.date_range.start === data.date_range.end 
          ? new Date(data.date_range.start).toLocaleDateString('id-ID')
          : `${new Date(data.date_range.start).toLocaleDateString('id-ID')} - ${new Date(data.date_range.end).toLocaleDateString('id-ID')}`,
        data.data_count,
        data.clicks,
        data.orders,
        data.gross_commission,
        data.total_purchases,
        commissionRate.toFixed(2),
        data.products_sold,
        convRate.toFixed(2)
      ];
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accumulated-sales-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600">
            {currentUser?.role === 'superadmin' 
              ? 'Detailed sales and commission reports for all accounts'
              : `Detailed sales and commission reports for your ${filteredAccountsByRole.length} accounts`}
          </p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Account:</label>
            <div className="relative">
              <button
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className="flex items-center justify-between px-3 py-1 border border-gray-300 rounded text-sm bg-white hover:bg-gray-50 transition-colors min-w-[200px]"
              >
                <span className="truncate">{getSelectedAccountName()}</span>
                <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showAccountDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showAccountDropdown && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-80 overflow-hidden">
                  {/* Search Input */}
                  <div className="p-3 border-b border-gray-200">
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search accounts..."
                        value={accountSearchTerm}
                        onChange={(e) => setAccountSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        autoFocus
                      />
                    </div>
                  </div>
                  
                  {/* Options List */}
                  <div className="max-h-60 overflow-y-auto">
                    {/* All Accounts Option */}
                    <button
                      onClick={() => handleAccountSelect('all')}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                        selectedAccount === 'all' ? 'bg-purple-50 text-purple-700' : 'text-gray-900'
                      }`}
                    >
                      <span className="font-medium">All Accounts</span>
                      {selectedAccount === 'all' && <Check className="w-4 h-4 text-purple-600" />}
                    </button>
                    
                    {/* Account Options */}
                    {filteredAccountsForDropdown.length > 0 ? (
                      filteredAccountsForDropdown.map((account) => (
                        <button
                          key={account.id}
                          onClick={() => handleAccountSelect(account.id)}
                          className={`w-full text-left px-3 py-3 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                            selectedAccount === account.id ? 'bg-purple-50 text-purple-700' : 'text-gray-900'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-medium truncate">{account.username}</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 flex-shrink-0">
                                {account.account_code}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 space-y-0.5">
                              <div className="truncate">{account.email}</div>
                              <div className="flex items-center space-x-2">
                                <span className="truncate">{account.phone}</span>
                                <span className="text-blue-600 font-medium flex-shrink-0">
                                  {getCategoryName(account.category_id)}
                                </span>
                              </div>
                            </div>
                          </div>
                          {selectedAccount === account.id && <Check className="w-4 h-4 text-purple-600 flex-shrink-0 ml-2" />}
                        </button>
                      ))
                    ) : accountSearchTerm ? (
                      <div className="px-3 py-4 text-sm text-gray-500 text-center">
                        No accounts match your search
                      </div>
                    ) : (
                      <div className="px-3 py-4 text-sm text-gray-500 text-center">
                        No accounts available
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <label className="text-sm text-gray-600">Period:</label>
            <select 
              value={dateFilter.preset}
              onChange={(e) => handleDateFilterChange('preset', e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
              <option value="all">All time</option>
              <option value="custom">Custom range</option>
            </select>
          </div>
          
          {dateFilter.preset === 'custom' && (
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={dateFilter.startDate}
                onChange={(e) => handleDateFilterChange('startDate', e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={dateFilter.endDate}
                onChange={(e) => handleDateFilterChange('endDate', e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close dropdown */}
      {showAccountDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setShowAccountDropdown(false);
            setAccountSearchTerm('');
          }}
        />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(reportMetrics.totalCommission)}
          </div>
          <p className="text-sm text-gray-600">Total Commission</p>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(reportMetrics.totalRevenue)}
          </div>
          <p className="text-sm text-gray-600">Total Revenue</p>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="text-2xl font-bold text-purple-600">
            {reportMetrics.totalOrders.toLocaleString()}
          </div>
          <p className="text-sm text-gray-600">Total Orders</p>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="text-2xl font-bold text-orange-600">
            {reportMetrics.conversionRate.toFixed(2)}%
          </div>
          <p className="text-sm text-gray-600">Conversion Rate</p>
        </div>
      </div>

      {/* Accumulated Data Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Akumulasi Data</h3>
          <p className="text-sm text-gray-600 mt-1">
            Data penjualan terakumulasi per akun berdasarkan periode yang dipilih
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Clicks</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Orders</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Commission</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commission %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Products Sold</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conv. Rate</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {accumulatedData.map((data, index) => {
                const account = filteredAccountsByRole.find(acc => acc.id === data.account_id);
                const convRate = data.clicks > 0 ? (data.orders / data.clicks) * 100 : 0;
                const commissionRate = data.total_purchases > 0 ? (data.gross_commission / data.total_purchases) * 100 : 0;
                
                return (
                  <tr key={`${data.account_id}-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center mr-3">
                          <User className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{account?.username}</div>
                          <div className="text-sm text-gray-500">{account?.account_code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {data.date_range.start === data.date_range.end 
                          ? new Date(data.date_range.start).toLocaleDateString('id-ID')
                          : `${new Date(data.date_range.start).toLocaleDateString('id-ID')} - ${new Date(data.date_range.end).toLocaleDateString('id-ID')}`
                        }
                      </div>
                      <div className="text-xs text-gray-500">
                        {data.data_count} hari data
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {data.clicks.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {data.orders.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatCurrency(data.gross_commission)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(data.total_purchases)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">
                      {commissionRate.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {data.products_sold.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {convRate.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {accumulatedData.length === 0 && (
            <div className="text-center py-12">
              <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada data penjualan</h3>
              <p className="text-gray-600">
                {selectedAccount === 'all' 
                  ? 'Tidak ada akun yang memiliki data penjualan pada periode yang dipilih'
                  : 'Akun yang dipilih tidak memiliki data penjualan pada periode yang dipilih'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
