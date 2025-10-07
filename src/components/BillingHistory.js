import React, { useState, useEffect } from 'react';
import { Search, Filter, Calendar, DollarSign, User, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import apiClient from '../utils/api';

const BillingHistory = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    search: '',
    payment_status: '',
    start_date: '',
    end_date: ''
  });
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
    currentPage: 1,
    hasMore: false
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchBills();
  }, [filters.page, filters.limit]);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          queryParams.append(key, filters[key]);
        }
      });

      const response = await apiClient.client.get(`/billing?${queryParams.toString()}`);
      setBills(response.data.bills);
      setPagination({
        total: response.data.total,
        totalPages: response.data.totalPages,
        currentPage: response.data.page,
        hasMore: response.data.hasMore
      });
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, page: 1 }));
    fetchBills();
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const resetFilters = () => {
    setFilters({
      page: 1,
      limit: 10,
      search: '',
      payment_status: '',
      start_date: '',
      end_date: ''
    });
    setTimeout(fetchBills, 100);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return '#28A745';
      case 'pending':
        return '#F05C2D';
      case 'overdue':
        return '#dc3545';
      default:
        return '#6A71D8';
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const handleViewDetails = (bill) => {
    setSelectedBill(bill);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setTimeout(() => setSelectedBill(null), 300);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.titleSection}>
            <FileText size={32} color="#274B8C" />
            <h1 style={styles.title}>Billing History</h1>
          </div>
          <p style={styles.subtitle}>Track and manage all your billing records</p>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.searchFilterBar}>
          <form onSubmit={handleSearch} style={styles.searchForm}>
            <div style={styles.searchContainer}>
              <Search size={20} color="#7356B2" style={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search by customer name or item..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                style={styles.searchInput}
              />
            </div>
            <button type="submit" style={styles.searchButton}>
              Search
            </button>
          </form>

          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              ...styles.filterButton,
              backgroundColor: showFilters ? '#7356B2' : 'white'
            }}
          >
            <Filter size={18} color={showFilters ? 'white' : '#7356B2'} />
            <span style={{ color: showFilters ? 'white' : '#7356B2' }}>Filters</span>
          </button>
        </div>

        {showFilters && (
          <div style={styles.filtersPanel}>
            <div style={styles.filterGrid}>
              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Payment Status</label>
                <select
                  value={filters.payment_status}
                  onChange={(e) => handleFilterChange('payment_status', e.target.value)}
                  style={styles.filterSelect}
                >
                  <option value="">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Start Date</label>
                <input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                  style={styles.filterInput}
                />
              </div>

              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>End Date</label>
                <input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  style={styles.filterInput}
                />
              </div>

              <div style={styles.filterGroup}>
                <label style={styles.filterLabel}>Items per page</label>
                <select
                  value={filters.limit}
                  onChange={(e) => handleFilterChange('limit', e.target.value)}
                  style={styles.filterSelect}
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>

            <div style={styles.filterActions}>
              <button onClick={fetchBills} style={styles.applyButton}>
                Apply Filters
              </button>
              <button onClick={resetFilters} style={styles.resetButton}>
                Reset
              </button>
            </div>
          </div>
        )}

        <div style={styles.statsBar}>
          <div style={styles.statCard}>
            <FileText size={24} color="#274B8C" />
            <div>
              <p style={styles.statLabel}>Total Bills</p>
              <p style={styles.statValue}>{pagination.total}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <p style={styles.loadingText}>Loading bills...</p>
          </div>
        ) : bills.length === 0 ? (
          <div style={styles.emptyState}>
            <FileText size={64} color="#ccc" />
            <h3 style={styles.emptyTitle}>No bills found</h3>
            <p style={styles.emptyText}>Try adjusting your filters or search criteria</p>
          </div>
        ) : (
          <>
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.th}>Bill ID</th>
                    <th style={styles.th}>Customer</th>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Items</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill, index) => (
                    <tr key={bill._id} style={{
                      ...styles.tableRow,
                      backgroundColor: index % 2 === 0 ? '#f8f9fc' : 'white'
                    }}>
                      <td style={styles.td}>
                        <span style={styles.billId}>#{bill._id.slice(-6).toUpperCase()}</span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.customerCell}>
                          <User size={16} color="#7356B2" />
                          <span>{bill.customer_name || 'N/A'}</span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.dateCell}>
                          <Calendar size={16} color="#6A71D8" />
                          <span>{formatDate(bill.created_at)}</span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.itemCount}>{bill.items?.length || 0} items</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.amount}>{formatCurrency(bill.total_amount || 0)}</span>
                      </td>
                      <td style={styles.td}>
                        <button
                          onClick={() => handleViewDetails(bill)}
                          style={styles.detailsButton}
                        >
                          <FileText size={16} />
                          See Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={styles.pagination}>
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                style={{
                  ...styles.paginationButton,
                  opacity: pagination.currentPage === 1 ? 0.5 : 1,
                  cursor: pagination.currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronLeft size={18} />
                Previous
              </button>

              <div style={styles.paginationInfo}>
                <span style={styles.pageText}>
                  Page {pagination.currentPage} of {pagination.totalPages}
                </span>
              </div>

              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={!pagination.hasMore}
                style={{
                  ...styles.paginationButton,
                  opacity: !pagination.hasMore ? 0.5 : 1,
                  cursor: !pagination.hasMore ? 'not-allowed' : 'pointer'
                }}
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>
          </>
        )}
      </div>

      {showModal && selectedBill && (
        <div style={styles.modalOverlay} onClick={handleCloseModal}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleSection}>
                <FileText size={28} color="white" />
                <h2 style={styles.modalTitle}>Bill Details</h2>
              </div>
              <button onClick={handleCloseModal} style={styles.closeButton}>
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.billInfoGrid}>
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>Bill ID</div>
                  <div style={styles.infoValue}>
                    #{selectedBill._id.slice(-8).toUpperCase()}
                  </div>
                </div>

                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>Customer</div>
                  <div style={styles.infoValue}>{selectedBill.customer_name}</div>
                </div>

                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>Date</div>
                  <div style={styles.infoValue}>{formatDate(selectedBill.created_at)}</div>
                </div>

                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>Payment Method</div>
                  <div style={{...styles.infoValue, textTransform: 'capitalize'}}>
                    {selectedBill.payment_method}
                  </div>
                </div>
              </div>

              <div style={styles.itemsSection}>
                <h3 style={styles.sectionTitle}>Items</h3>
                <div style={styles.itemsList}>
                  {selectedBill.items.map((item, index) => (
                    <div key={item._id} style={styles.itemCard}>
                      <div style={styles.itemHeader}>
                        <span style={styles.itemNumber}>{index + 1}</span>
                        <span style={styles.itemName}>{item.item_name}</span>
                      </div>
                      <div style={styles.itemDetails}>
                        <div style={styles.itemDetail}>
                          <span style={styles.itemDetailLabel}>Quantity:</span>
                          <span style={styles.itemDetailValue}>{item.quantity}</span>
                        </div>
                        <div style={styles.itemDetail}>
                          <span style={styles.itemDetailLabel}>Unit Price:</span>
                          <span style={styles.itemDetailValue}>{formatCurrency(item.unit_price)}</span>
                        </div>
                        <div style={styles.itemDetail}>
                          <span style={styles.itemDetailLabel}>Total:</span>
                          <span style={styles.itemDetailValueBold}>{formatCurrency(item.total_price)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={styles.summarySection}>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>Subtotal</span>
                  <span style={styles.summaryValue}>
                    {formatCurrency(selectedBill.total_amount - selectedBill.tax + selectedBill.discount)}
                  </span>
                </div>
                {selectedBill.discount > 0 && (
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Discount</span>
                    <span style={{...styles.summaryValue, color: '#28A745'}}>
                      -{formatCurrency(selectedBill.discount)}
                    </span>
                  </div>
                )}
                {selectedBill.tax > 0 && (
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Tax</span>
                    <span style={styles.summaryValue}>{formatCurrency(selectedBill.tax)}</span>
                  </div>
                )}
                <div style={styles.summaryDivider}></div>
                <div style={styles.summaryRowTotal}>
                  <span style={styles.summaryLabelTotal}>Total Amount</span>
                  <span style={styles.summaryValueTotal}>{formatCurrency(selectedBill.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f7fa',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  header: {
    background: 'linear-gradient(135deg, #274B8C 0%, #7356B2 100%)',
    padding: '40px 24px',
    color: 'white',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto'
  },
  titleSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '8px'
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    margin: 0
  },
  subtitle: {
    fontSize: '16px',
    opacity: 0.9,
    margin: 0
  },
  content: {
    maxWidth: '1200px',
    margin: '-30px auto 0',
    padding: '0 24px 40px'
  },
  searchFilterBar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap'
  },
  searchForm: {
    display: 'flex',
    gap: '12px',
    flex: 1,
    minWidth: '300px'
  },
  searchContainer: {
    position: 'relative',
    flex: 1,
    display: 'flex',
    alignItems: 'center'
  },
  searchIcon: {
    position: 'absolute',
    left: '16px',
    pointerEvents: 'none'
  },
  searchInput: {
    width: '100%',
    padding: '14px 16px 14px 48px',
    border: '2px solid #e0e6ed',
    borderRadius: '12px',
    fontSize: '15px',
    outline: 'none',
    transition: 'all 0.3s',
    backgroundColor: 'white'
  },
  searchButton: {
    padding: '14px 28px',
    backgroundColor: '#6A71D8',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s',
    whiteSpace: 'nowrap'
  },
  filterButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 24px',
    border: '2px solid #7356B2',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s'
  },
  filtersPanel: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '16px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '20px'
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  filterLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#274B8C'
  },
  filterSelect: {
    padding: '10px 12px',
    border: '2px solid #e0e6ed',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer'
  },
  filterInput: {
    padding: '10px 12px',
    border: '2px solid #e0e6ed',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none'
  },
  filterActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end'
  },
  applyButton: {
    padding: '10px 24px',
    backgroundColor: '#28A745',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  resetButton: {
    padding: '10px 24px',
    backgroundColor: '#F05C2D',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  statsBar: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px'
  },
  statCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    flex: 1
  },
  statLabel: {
    fontSize: '14px',
    color: '#6c757d',
    margin: '0 0 4px 0'
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#274B8C',
    margin: 0
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: '24px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  tableHeader: {
    backgroundColor: '#274B8C',
    color: 'white'
  },
  th: {
    padding: '16px',
    textAlign: 'left',
    fontWeight: '600',
    fontSize: '14px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  tableRow: {
    transition: 'all 0.2s'
  },
  td: {
    padding: '16px',
    fontSize: '14px',
    color: '#2c3e50',
    borderBottom: '1px solid #e0e6ed'
  },
  billId: {
    fontWeight: '700',
    color: '#7356B2',
    fontFamily: 'monospace'
  },
  customerCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  dateCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  itemCount: {
    color: '#6A71D8',
    fontWeight: '600'
  },
  amount: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#28A745'
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  paginationButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: '#6A71D8',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s'
  },
  paginationInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  pageText: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#274B8C'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid #e0e6ed',
    borderTop: '4px solid #7356B2',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    marginTop: '20px',
    fontSize: '16px',
    color: '#6c757d'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  },
  emptyTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#2c3e50',
    margin: '16px 0 8px'
  },
  emptyText: {
    fontSize: '16px',
    color: '#6c757d',
    margin: 0
  },
  detailsButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: '#6A71D8',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s',
    whiteSpace: 'nowrap'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
    animation: 'fadeIn 0.3s ease-out'
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '20px',
    maxWidth: '700px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    animation: 'slideUp 0.3s ease-out',
    display: 'flex',
    flexDirection: 'column'
  },
  modalHeader: {
    background: 'linear-gradient(135deg, #274B8C 0%, #7356B2 100%)',
    padding: '24px 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: 'white'
  },
  modalTitleSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  modalTitle: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '700'
  },
  closeButton: {
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    color: 'white',
    fontSize: '32px',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
    transition: 'all 0.3s',
    fontWeight: '300'
  },
  modalBody: {
    padding: '28px',
    overflowY: 'auto',
    flex: 1
  },
  billInfoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
    marginBottom: '28px'
  },
  infoCard: {
    backgroundColor: '#f8f9fc',
    padding: '16px',
    borderRadius: '12px',
    border: '2px solid #e0e6ed'
  },
  infoLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px'
  },
  infoValue: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#274B8C'
  },
  itemsSection: {
    marginBottom: '28px'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#274B8C',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  itemCard: {
    backgroundColor: '#f8f9fc',
    padding: '16px',
    borderRadius: '12px',
    border: '2px solid #e0e6ed',
    transition: 'all 0.3s'
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid #e0e6ed'
  },
  itemNumber: {
    backgroundColor: '#7356B2',
    color: 'white',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '700',
    flexShrink: 0
  },
  itemName: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#2c3e50',
    flex: 1
  },
  itemDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px'
  },
  itemDetail: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  itemDetailLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  itemDetailValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#2c3e50'
  },
  itemDetailValueBold: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#6A71D8'
  },
  summarySection: {
    backgroundColor: '#f8f9fc',
    padding: '20px',
    borderRadius: '12px',
    border: '2px solid #e0e6ed'
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    fontSize: '15px'
  },
  summaryLabel: {
    color: '#6c757d',
    fontWeight: '600'
  },
  summaryValue: {
    color: '#2c3e50',
    fontWeight: '600'
  },
  summaryDivider: {
    height: '2px',
    backgroundColor: '#e0e6ed',
    margin: '12px 0'
  },
  summaryRowTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0 0'
  },
  summaryLabelTotal: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#274B8C'
  },
  summaryValueTotal: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#28A745'
  }
};

// Add keyframes for animations
const styleSheet = document.styleSheets[0];
if (styleSheet) {
  try {
    styleSheet.insertRule(`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `, styleSheet.cssRules.length);
    
    styleSheet.insertRule(`
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `, styleSheet.cssRules.length);
    
    styleSheet.insertRule(`
      @keyframes slideUp {
        from {
          transform: translateY(30px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `, styleSheet.cssRules.length);
  } catch (e) {
    // Silently fail if stylesheet rules can't be inserted
  }
}

export default BillingHistory;