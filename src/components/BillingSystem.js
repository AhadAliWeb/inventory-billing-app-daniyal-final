import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import formatCurrency from '../utils/formatCurrency';
import './BillingSystem.css';

const BillingSystem = () => {
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customerType, setCustomerType] = useState('walkin'); // 'walkin' or 'regular'
  const [walkInId, setWalkInId] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', contact: '', email: '', address: '' });
  const [buyerTypes, setBuyerTypes] = useState([]);
  const [selectedBuyerType, setSelectedBuyerType] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showWholesaleInfo, setShowWholesaleInfo] = useState(false);
  const [editingPrices, setEditingPrices] = useState({});
  const [customPrices, setCustomPrices] = useState({});
  
  // Enhanced billing features
  const [taxRate, setTaxRate] = useState(5); // Default 5% VAT
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountType, setDiscountType] = useState('amount'); // 'amount' or 'percentage'
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [billHistory, setBillHistory] = useState([]);
  const [showBillHistory, setShowBillHistory] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState(null);
  const [recentItems, setRecentItems] = useState([]);
  const [favoriteItems, setFavoriteItems] = useState([]);
  const [showQuickActions, setShowQuickActions] = useState(false);

  useEffect(() => {
    loadItems();
    loadCustomers();
    loadBuyerTypes();
    loadBillHistory(); // Load history on component mount
    generateWalkInId(); // Generate initial Walk-in ID
  }, []);

  const generateWalkInId = () => {
    const timestamp = Date.now().toString().slice(-6);
    setWalkInId(`W${timestamp}`);
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim()) {
      alert('Customer name is required');
      return;
    }

    try {
      const response = await api.addCustomer(newCustomer);
      setCustomers([...customers, response]);
      setCustomerId(response.id.toString());
      setNewCustomer({ name: '', contact: '', email: '', address: '' });
      setShowAddCustomer(false);
      alert('Customer added successfully!');
    } catch (error) {
      console.error('Error adding customer:', error);
      alert('Error adding customer: ' + (error.response?.data?.error || error.message));
    }
  };

  // Add keyboard shortcuts for faster billing
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl/Cmd + Enter to create bill quickly
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (cart.length > 0 && customerId) {
          handleCreateBill();
        }
      }
      // Escape to clear cart
      if (e.key === 'Escape') {
        setCart([]);
        setCustomPrices({});
        setEditingPrices({});
      }
      // Ctrl/Cmd + P to preview
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (cart.length > 0) {
          setShowPreview(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [cart, customerId]);

  const loadItems = async () => {
    try {
      const data = await api.getInventory();
      setItems(data);
    } catch (error) {
      console.error('Error loading items:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      setCustomersLoading(true);
      const data = await api.getCustomers();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading customers:', error);
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  };

  const loadBuyerTypes = async () => {
    try {
      const response = await fetch('/api/pricing/buyer-types', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setBuyerTypes(data.buyerTypes);
        // Default to UAE Wholesale for quantity-based pricing
        const wholesaleType = data.buyerTypes.find(bt => bt.name === 'UAE Wholesale');
        if (wholesaleType) {
          setSelectedBuyerType(wholesaleType.id.toString());
        }
      }
    } catch (error) {
      console.error('Error loading buyer types:', error);
    }
  };

  const calculateQuantityPrice = async (item, quantity) => {
    if (!selectedBuyerType) return item.selling_price;
    
    try {
      const response = await fetch('/api/pricing/calculate-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          item_id: item.id,
          buyer_type_id: parseInt(selectedBuyerType),
          quantity: quantity
        })
      });
      const data = await response.json();
      if (data.success) {
        return data.pricing.final_price;
      }
    } catch (error) {
      console.error('Error calculating quantity price:', error);
    }
    return item.selling_price;
  };

  const addToCart = async (item) => {
    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    if (existingItem) {
      const newQuantity = existingItem.quantity + 1;
      const basePrice = await calculateQuantityPrice(item, newQuantity);
      const finalPrice = customPrices[item.id] || basePrice;
      setCart(cart.map(cartItem =>
        cartItem.id === item.id
          ? { ...cartItem, quantity: newQuantity, price: finalPrice, basePrice: basePrice }
          : cartItem
      ));
    } else {
      const basePrice = await calculateQuantityPrice(item, 1);
      const finalPrice = customPrices[item.id] || basePrice;
      setCart([...cart, { ...item, quantity: 1, price: finalPrice, basePrice: basePrice }]);
    }
  };

  const updateCartQuantity = async (id, quantity) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => item.id !== id));
      // Remove custom price when item is removed
      const newCustomPrices = { ...customPrices };
      delete newCustomPrices[id];
      setCustomPrices(newCustomPrices);
    } else {
      const item = items.find(item => item.id === id);
      if (quantity > item.quantity) {
        alert('Not enough stock available');
        return;
      }
      const basePrice = await calculateQuantityPrice(item, quantity);
      const finalPrice = customPrices[id] || basePrice;
      setCart(cart.map(cartItem =>
        cartItem.id === id ? { ...cartItem, quantity, price: finalPrice, basePrice: basePrice } : cartItem
      ));
    }
  };

  const updateCustomPrice = (id, newPrice) => {
    const price = parseFloat(newPrice) || 0;
    setCustomPrices({ ...customPrices, [id]: price });
    setCart(cart.map(cartItem =>
      cartItem.id === id ? { ...cartItem, price: price } : cartItem
    ));
  };

  const togglePriceEdit = (id) => {
    setEditingPrices({ ...editingPrices, [id]: !editingPrices[id] });
  };

  const resetToBasePrice = (id) => {
    const cartItem = cart.find(item => item.id === id);
    if (cartItem && cartItem.basePrice) {
      setCustomPrices({ ...customPrices, [id]: cartItem.basePrice });
      setCart(cart.map(cartItem =>
        cartItem.id === id ? { ...cartItem, price: cartItem.basePrice } : cartItem
      ));
    }
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const getDiscount = () => {
    const subtotal = getSubtotal();
    if (discountType === 'percentage') {
      return (subtotal * discountAmount) / 100;
    }
    return discountAmount;
  };

  const getTax = () => {
    const subtotalAfterDiscount = getSubtotal() - getDiscount();
    return (subtotalAfterDiscount * taxRate) / 100;
  };

  const getTotal = () => {
    return getSubtotal() - getDiscount() + getTax();
  };

  const loadBillHistory = async () => {
    try {
      const response = await fetch('/api/billing?limit=50', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      const data = await response.json();


      if (data.bills) {
        setBillHistory(data.bills);
        // Extract recent items from bill history
        const recentItemsSet = new Set();
        data.bills.slice(0, 10).forEach(bill => {
          bill.items?.forEach(item => {
            recentItemsSet.add(item.item_id);
          });
        });
        setRecentItems(Array.from(recentItemsSet).slice(0, 6));
      }
    } catch (error) {
      console.error('Error loading bill history:', error);
    }
  };

  console.log(items)


  // Quick actions for faster billing
  const addItemToCart = async (item, quantity = 1) => {
    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      const basePrice = await calculateQuantityPrice(item, newQuantity);
      const finalPrice = customPrices[item.id] || basePrice;
      setCart(cart.map(cartItem =>
        cartItem.id === item.id
          ? { ...cartItem, quantity: newQuantity, price: finalPrice, basePrice: basePrice }
          : cartItem
      ));
    } else {
      const basePrice = await calculateQuantityPrice(item, quantity);
      const finalPrice = customPrices[item.id] || basePrice;
      setCart([...cart, { ...item, quantity, price: finalPrice, basePrice: basePrice }]);
    }
  };

  const quickBillCreate = async () => {
    // Auto-set to Walk-in customer for quick billing
    setCustomerType('walkin');
    if (!walkInId) {
      generateWalkInId();
    }
    setTimeout(() => handleCreateBill(), 100);
  };

  const clearCart = () => {
    setCart([]);
    setCustomPrices({});
    setEditingPrices({});
    setDiscountAmount(0);
    setNotes('');
  };

  const duplicateLastBill = async () => {
    if (billHistory.length > 0) {
      const lastBill = billHistory[0];
      // Clear current cart and load last bill items
      setCart([]);
      setCustomPrices({});
      
      // Set customer
      if (lastBill.customer_id) {
        setCustomerId(lastBill.customer_id.toString());
      }
      
      // Add items from last bill
      if (lastBill.items) {
        for (const billItem of lastBill.items) {
          const item = items.find(i => i.id === billItem.item_id);
          if (item) {
            await addItemToCart(item, billItem.quantity);
          }
        }
      }
    }
  };

  const handleCreateBill = async () => {
    if (customerType === 'regular' && !customerId) {
      alert('Please select a customer');
      return;
    }
    if (customerType === 'walkin' && !walkInId.trim()) {
      alert('Walk-in ID is required');
      return;
    }
    if (cart.length === 0) {
      alert('Please add items to cart');
      return;
    }

    setLoading(true);
    try {
      const billItems = cart.map(item => ({
        item_id: item.id,
        quantity: item.quantity,
        unit_price: item.price
      }));

      const billData = {
        customer_id: customerType === 'regular' ? parseInt(customerId) : null,
        customer_name: customerType === 'walkin' ? `Walk-in Customer (${walkInId})` : customers.find(c => c.id.toString() === customerId)?.name,
        total_amount: getTotal(),
        discount: getDiscount(),
        tax: getTax(),
        items: billItems,
        payment_method: paymentMethod,
        notes: notes,
        buyer_type: selectedBuyerType ? parseInt(selectedBuyerType) : null
      };

      console.log('Creating bill with data:', billData);
      const response = await api.createBill(billData);
      
      // Reset form
      setCart([]);
      setCustomerId('');
      setWalkInId('');
      generateWalkInId();
      setShowPreview(false);
      setCustomPrices({});
      setEditingPrices({});
      setDiscountAmount(0);
      setNotes('');
      
      // Show success message with bill details
      alert(`Bill created successfully!\nBill ID: ${response.data?._id || 'Generated'}\nTotal: ${formatCurrency(getTotal())}`);
      
      loadItems(); // Refresh inventory
      loadBillHistory(); // Refresh bill history
    } catch (error) {
      console.error('Error creating bill:', error);
      console.error('Error response:', error.response?.data);
      
      let errorMessage = 'Error creating bill: ';
      if (error.response?.data?.details) {
        const details = error.response.data.details.map(d => d.msg).join(', ');
        errorMessage += details;
      } else {
        errorMessage += (error.response?.data?.error || error.message);
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const printBill = () => {
    const printWindow = window.open('', '_blank');
    const customer = customerType === 'regular' ? customers.find(c => c.id === Number(customerId)) : null;
    const customerName = customerType === 'walkin' ? `Walk-in Customer (${walkInId})` : (customer?.name || 'Unknown Customer');
    const customerContact = customerType === 'walkin' ? '' : (customer?.contact || '');
    const selectedBuyerTypeName = buyerTypes.find(bt => bt.id === parseInt(selectedBuyerType))?.name || '';
    const hasCustomPricing = Object.keys(customPrices).length > 0;
    const billNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('en-GB');
    const timeStr = currentDate.toLocaleTimeString('en-GB');
    
    const billContent = `
      <html>
        <head>
          <title>Enhanced Invoice - ${billNumber}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 20px; 
              color: #2c3e50; 
              background: #fff;
              line-height: 1.4;
            }
            .invoice-container { max-width: 800px; margin: 0 auto; }
            .bill-header { 
              background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
              color: white;
              text-align: center; 
              padding: 25px;
              border-radius: 10px 10px 0 0;
              margin-bottom: 0;
            }
            .bill-header h1 { font-size: 28px; margin-bottom: 8px; font-weight: 700; }
            .bill-header p { font-size: 16px; opacity: 0.9; }
            .bill-number { 
              background: #34495e;
              color: white;
              padding: 10px 20px;
              text-align: center;
              font-weight: bold;
              font-size: 16px;
            }
            .bill-details { 
              display: flex; 
              justify-content: space-between; 
              padding: 20px;
              background: #f8f9fa;
              border-left: 4px solid #3498db;
            }
            .customer-info, .bill-info { flex: 1; }
            .bill-info { text-align: right; }
            .section-title {
              color: #3498db;
              font-weight: 600;
              margin-bottom: 10px;
              font-size: 16px;
            }
            .info-row { margin-bottom: 6px; }
            .info-row strong { color: #2c3e50; }
            
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 20px 0;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            th { 
              background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
              color: white;
              padding: 15px 10px;
              font-weight: 600;
              text-align: left;
            }
            td { 
              padding: 12px 10px; 
              border-bottom: 1px solid #ecf0f1;
            }
            tr:hover { background: #f8f9fa; }
            .item-description { font-weight: 500; }
            .item-category { color: #7f8c8d; font-size: 12px; }
            
            .calculations-section {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid #27ae60;
            }
            .calc-row { 
              display: flex; 
              justify-content: space-between; 
              padding: 8px 0;
              border-bottom: 1px solid #ecf0f1;
            }
            .calc-row:last-child { border-bottom: none; }
            .calc-row.subtotal { font-size: 16px; }
            .calc-row.discount { color: #e74c3c; font-weight: 500; }
            .calc-row.tax { color: #f39c12; font-weight: 500; }
            .calc-row.total { 
              background: #2c3e50;
              color: white;
              font-weight: bold;
              font-size: 18px;
              margin: 15px -20px -20px -20px;
              padding: 15px 20px;
              border-radius: 0 0 8px 8px;
            }
            
            .payment-info {
              background: #e8f5e8;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid #27ae60;
            }
            
            .notes-section {
              background: #fff3cd;
              border: 1px solid #ffeaa7;
              border-radius: 8px;
              padding: 15px;
              margin: 20px 0;
            }
            .notes-title { color: #856404; font-weight: 600; margin-bottom: 8px; }
            .notes-content { color: #856404; }
            
            .footer {
              text-align: center;
              margin-top: 40px;
              padding: 20px;
              background: #f8f9fa;
              border-radius: 8px;
              border-top: 3px solid #3498db;
            }
            .footer h3 { color: #3498db; margin-bottom: 10px; }
            .footer p { color: #7f8c8d; font-size: 14px; }
            
            @media print {
              body { margin: 0; }
              .invoice-container { max-width: none; }
              .bill-header { border-radius: 0; }
              table { page-break-inside: avoid; }
              .footer { margin-top: 20px; }
            }
            
            @media screen and (max-width: 600px) {
              body { margin: 10px; }
              .bill-details { flex-direction: column; gap: 20px; }
              .bill-info { text-align: left; }
              table { font-size: 14px; }
              th, td { padding: 8px 6px; }
              .bill-header h1 { font-size: 24px; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="bill-header">
              <h1>🔌 LAPTOP CHARGER WHOLESALER PRO</h1>
              <p>Professional Inventory & Billing System</p>
              <div class="company-details">
                <p>📍 Dubai, UAE | 📞 +971-XX-XXXXXXX | 📧 info@chargerswholesaler.ae</p>
              </div>
            </div>
            
            <div class="bill-number">
              Invoice #${billNumber}
            </div>
            
            <div class="bill-details">
              <div class="customer-info">
                <div class="section-title">👤 Bill To</div>
                <div class="info-row"><strong>${customerName}</strong></div>
                ${customerContact ? `<div class="info-row">📞 ${customerContact}</div>` : ''}
                ${selectedBuyerTypeName ? `<div class="info-row">🏷️ ${selectedBuyerTypeName}</div>` : ''}
                ${customer?.email ? `<div class="info-row">📧 ${customer.email}</div>` : ''}
              </div>
              <div class="bill-info">
                <div class="section-title">📅 Invoice Details</div>
                <div class="info-row"><strong>Date:</strong> ${dateStr}</div>
                <div class="info-row"><strong>Time:</strong> ${timeStr}</div>
                <div class="info-row"><strong>Items:</strong> ${cart.length} items</div>
                <div class="info-row"><strong>Currency:</strong> AED</div>
                <div class="info-row"><strong>Payment:</strong> ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</div>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th style="width: 50%;">📦 Item Description</th>
                  <th style="width: 15%; text-align: center;">Qty</th>
                  <th style="width: 20%; text-align: right;">Unit Price</th>
                  <th style="width: 15%; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${cart.map(item => `
                  <tr>
                    <td>
                      <div class="item-description">${item.name}</div>
                      <div class="item-category">${item.category}</div>
                    </td>
                    <td style="text-align: center; font-weight: 500;">${item.quantity}</td>
                    <td style="text-align: right;">
                      ${formatCurrency(item.price)}
                      ${(item.basePrice && item.basePrice !== item.price) ? '<br><small style="color: #3498db;">(Custom Price)</small>' : ''}
                    </td>
                    <td style="text-align: right; font-weight: 500;">${formatCurrency(item.quantity * item.price)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="calculations-section">
              <div class="calc-row subtotal">
                <span>💰 Subtotal:</span>
                <span>${formatCurrency(getSubtotal())}</span>
              </div>
              ${getDiscount() > 0 ? `
                <div class="calc-row discount">
                  <span>🎯 Discount (${discountType === 'percentage' ? `${discountAmount}%` : 'Amount'}):</span>
                  <span>-${formatCurrency(getDiscount())}</span>
                </div>
              ` : ''}
              ${getTax() > 0 ? `
                <div class="calc-row tax">
                  <span>🏛️ Tax (${taxRate}%):</span>
                  <span>+${formatCurrency(getTax())}</span>
                </div>
              ` : ''}
              <div class="calc-row total">
                <span>💳 TOTAL AMOUNT:</span>
                <span>${formatCurrency(getTotal())}</span>
              </div>
            </div>
            
            <div class="payment-info">
              <strong>💳 Payment Method:</strong> ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}
            </div>
            
            ${notes ? `
              <div class="notes-section">
                <div class="notes-title">📝 Special Notes:</div>
                <div class="notes-content">${notes}</div>
              </div>
            ` : ''}
            
            <div class="footer">
              <h3>Thank You for Your Business! 🙏</h3>
              <p>This invoice was generated by the Advanced Inventory & Billing System</p>
              <p>For support or inquiries, please contact our customer service team</p>
            </div>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(billContent);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="billing-system">
      <div className="billing-header enhanced">
        <div className="billing-title">
          <h2>💳 Enhanced Billing System</h2>
          <p className="billing-subtitle">Create professional bills with advanced features</p>
        </div>
        
        {/* Quick Actions Panel */}
        <div className="quick-actions-panel">
          <button 
            onClick={() => setShowQuickActions(!showQuickActions)}
            className="quick-actions-toggle"
            title="Toggle Quick Actions"
          >
            ⚡ Quick Actions
          </button>
          
          {/* Express Billing Button */}
          <button 
            onClick={quickBillCreate} 
            className="express-bill-btn" 
            disabled={cart.length === 0}
            title="Express Bill - Auto-select Walk-in customer and create bill instantly"
          >
            🚀 Express Bill
          </button>
          
          {showQuickActions && (
            <div className="quick-actions-dropdown">
              <button onClick={clearCart} className="quick-action-btn" title="Clear cart (ESC)">
                🗑️ Clear Cart
              </button>
              <button onClick={duplicateLastBill} className="quick-action-btn" title="Duplicate last bill">
                📋 Repeat Last Bill
              </button>
              <button 
                onClick={() => setShowPreview(true)} 
                className="quick-action-btn"
                disabled={cart.length === 0}
                title="Preview bill (Ctrl+P)"
              >
                👁️ Preview
              </button>
              <button 
                onClick={() => setShowBillHistory(true)}
                className="quick-action-btn"
                title="View bill history"
              >
                📜 History
              </button>
            </div>
          )}
        </div>
        
        {/* Keyboard Shortcuts Info */}
        <div className="keyboard-shortcuts">
          <small>
            💡 <strong>Shortcuts:</strong> Ctrl+Enter (Quick Bill) | Ctrl+P (Preview) | ESC (Clear)
          </small>
        </div>
      </div>

      <div className="billing-content">
        <div className="billing-grid">
          <div className="items-section">
            <div className="section-header">
              <h3>📦 Select Items</h3>
              <div className="search-container">
                <input
                  type="text"
                  placeholder="Search items by name or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="M21 21l-4.35-4.35"></path>
                </svg>
              </div>
            </div>
            
            {/* Recent Items Quick Access */}
            {recentItems.length > 0 && (
              <div className="recent-items-section">
                <h4>🕒 Recently Used Items</h4>
                <div className="recent-items-grid">
                  {recentItems.slice(0, 4).map(itemId => {
                    const item = items.find(i => i.id === itemId);
                    return item ? (
                      <button
                        key={item.id}
                        onClick={() => addItemToCart(item)}
                        className="recent-item-btn"
                        disabled={item.quantity === 0}
                      >
                        <span className="item-name">{item.name}</span>
                        <span className="item-price">{formatCurrency(item.selling_price)}</span>
                      </button>
                    ) : null;
                  })}
                </div>
              </div>
            )}
            
            <div className="items-list">
              {filteredItems.length === 0 ? (
                <div className="no-items">
                  <div className="no-items-icon">📦</div>
                  <p>No items found</p>
                </div>
              ) : (
                filteredItems.map(item => (
                  <div key={item.id} className="item-card" onClick={() => addToCart(item)}>
                    <div className="item-info">
                      <h4>{item.name}</h4>
                      <p className="item-category">{item.category}</p>
                      <p className="item-stock">Stock: {item.quantity} units</p>
                    </div>
                    <div className="item-price">
                      <span className="price">{formatCurrency(item.selling_price)}</span>
                      <button className="add-btn" disabled={item.quantity === 0}>
                        {item.quantity === 0 ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="cart-section">
            <div className="section-header">
              <h3>🛒 Cart ({cart.length} items)</h3>
              
              {/* New Customer Type Selection */}
              <div className="customer-type-selector">
                <div className="customer-type-tabs">
                  <button 
                    onClick={() => {
                      setCustomerType('walkin');
                      setCustomerId('');
                      generateWalkInId();
                    }}
                    className={`customer-type-tab ${customerType === 'walkin' ? 'active' : ''}`}
                  >
                    🚶 Walk-in Customer
                  </button>
                  <button 
                    onClick={() => {
                      setCustomerType('regular');
                      setWalkInId('');
                    }}
                    className={`customer-type-tab ${customerType === 'regular' ? 'active' : ''}`}
                  >
                    👤 Regular Customer
                  </button>
                </div>

                {/* Walk-in Customer Section */}
                {customerType === 'walkin' && (
                  <div className="walkin-customer-section">
                    <div className="walkin-id-container">
                      <label>Walk-in Customer ID:</label>
                      <div className="walkin-id-input-group">
                        <input
                          type="text"
                          value={walkInId}
                          onChange={(e) => setWalkInId(e.target.value)}
                          placeholder="Enter Walk-in ID"
                          className="walkin-id-input"
                        />
                        <button 
                          onClick={generateWalkInId}
                          className="generate-id-btn"
                          title="Generate new Walk-in ID"
                        >
                          🔄 New ID
                        </button>
                      </div>
                      {walkInId && (
                        <div className="walkin-preview">
                          Customer: Walk-in Customer ({walkInId})
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Regular Customer Section */}
                {customerType === 'regular' && (
                  <div className="regular-customer-section">
                    <div className="customer-selection-row">
                      <select
                        value={customerId}
                        onChange={e => setCustomerId(e.target.value)}
                        className="customer-select-enhanced"
                      >
                        <option value="">🔍 Select Existing Customer...</option>
                        {customersLoading ? (
                          <option disabled>Loading customers...</option>
                        ) : customers && customers.length > 0 ? customers.map(c => (
                          <option key={c.id || Math.random()} value={c.id || ''}>
                            {c.name || 'Unknown'} {c.contact ? `(${c.contact})` : ''}
                          </option>
                        )) : (
                          <option disabled>No customers available</option>
                        )}
                      </select>
                      
                      <button 
                        onClick={() => setShowAddCustomer(true)}
                        className="add-customer-btn"
                        title="Add New Customer"
                      >
                        ➕ Add New
                      </button>
                    </div>
                    
                    {/* Selected Customer Info */}
                    {customerId && (
                      <div className="selected-customer-info">
                        <span className="customer-badge">
                          👤 {customers.find(c => c.id && c.id.toString() === customerId)?.name || 'Unknown Customer'}
                          {customers.find(c => c.id && c.id.toString() === customerId)?.contact && (
                            <small> • {customers.find(c => c.id && c.id.toString() === customerId)?.contact}</small>
                          )}
                        </span>
                        <button 
                          onClick={() => setCustomerId('')}
                          className="clear-customer-btn"
                          title="Clear customer selection"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {cart.length === 0 ? (
              <div className="empty-cart">
                <div className="empty-cart-icon">🛒</div>
                <p>Your cart is empty</p>
                <p className="empty-cart-hint">Click on items to add them</p>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map(item => (
                    <div key={item.id} className="cart-item">
                      <div className="cart-item-info">
                        <h4>{item.name}</h4>
                        <p className="cart-item-category">{item.category}</p>
                        {item.basePrice && item.basePrice !== item.price && (
                          <p style={{ fontSize: '12px', color: '#888' }}>
                            Base: {formatCurrency(item.basePrice)} → Custom: {formatCurrency(item.price)}
                          </p>
                        )}
                      </div>
                      <div className="cart-item-controls">
                        <div className="quantity-controls">
                          <button 
                            onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                            className="qty-btn"
                            disabled={item.quantity <= 1}
                          >
                            -
                          </button>
                          <span className="quantity">{item.quantity}</span>
                          <button 
                            onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                            className="qty-btn"
                          >
                            +
                          </button>
                        </div>
                        
                        <div className="price-controls" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {editingPrices[item.id] ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                  type="number"
                                  value={item.price}
                                  onChange={(e) => updateCustomPrice(item.id, e.target.value)}
                                  style={{
                                    width: '80px',
                                    padding: '4px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px'
                                  }}
                                  step="0.01"
                                  min="0"
                                />
                                <button
                                  onClick={() => togglePriceEdit(item.id)}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#4CAF50',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                >
                                  ✓
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span className="price">{formatCurrency(item.price)}</span>
                                <button
                                  onClick={() => togglePriceEdit(item.id)}
                                  style={{
                                    padding: '2px 6px',
                                    backgroundColor: '#2196F3',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                  title="Edit price"
                                >
                                  ✏️
                                </button>
                              </div>
                            )}
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <strong style={{ fontSize: '16px' }}>
                              Total: {formatCurrency(item.price * item.quantity)}
                            </strong>
                            <button 
                              onClick={() => removeFromCart(item.id)}
                              className="remove-btn"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </div>
                          
                          {item.basePrice && item.basePrice !== item.price && (
                            <button
                              onClick={() => resetToBasePrice(item.id)}
                              style={{
                                padding: '2px 6px',
                                backgroundColor: '#FF9800',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px'
                              }}
                              title="Reset to calculated price"
                            >
                              Reset Price
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="cart-summary enhanced">
                  {/* Enhanced Bill Summary */}
                  <div className="bill-summary-card">
                    <div className="summary-header">
                      <h3>📋 Bill Summary</h3>
                      <button 
                        onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                        className="toggle-advanced-btn"
                      >
                        {showAdvancedOptions ? '▼ Less Options' : '▲ More Options'}
                      </button>
                    </div>

                    {/* Advanced Options */}
                    {showAdvancedOptions && (
                      <div className="advanced-options">
                        {/* Tax Settings */}
                        <div className="option-group">
                          <label>🏛️ Tax Rate (%):</label>
                          <input
                            type="number"
                            value={taxRate}
                            onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                            min="0"
                            max="50"
                            step="0.1"
                            className="tax-input"
                          />
                        </div>

                        {/* Discount Settings */}
                        <div className="option-group">
                          <label>💰 Discount:</label>
                          <div className="discount-controls">
                            <input
                              type="number"
                              value={discountAmount}
                              onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className="discount-input"
                            />
                            <select
                              value={discountType}
                              onChange={(e) => setDiscountType(e.target.value)}
                              className="discount-type"
                            >
                              <option value="amount">AED</option>
                              <option value="percentage">%</option>
                            </select>
                          </div>
                        </div>

                        {/* Payment Method */}
                        <div className="option-group">
                          <label>💳 Payment Method:</label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="payment-method-select"
                          >
                            <option value="cash">💵 Cash</option>
                            <option value="card">💳 Card</option>
                            <option value="bank_transfer">🏦 Bank Transfer</option>
                            <option value="check">📝 Check</option>
                            <option value="credit">🕒 Credit</option>
                          </select>
                        </div>

                        {/* Notes */}
                        <div className="option-group">
                          <label>📝 Notes:</label>
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add any special notes for this bill..."
                            className="notes-textarea"
                            rows="2"
                          />
                        </div>
                      </div>
                    )}

                    {/* Bill Calculation */}
                    <div className="bill-calculation">
                      <div className="calc-row">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(getSubtotal())}</span>
                      </div>
                      
                      {getDiscount() > 0 && (
                        <div className="calc-row discount">
                          <span>Discount ({discountType === 'percentage' ? `${discountAmount}%` : 'Amount'}):</span>
                          <span>-{formatCurrency(getDiscount())}</span>
                        </div>
                      )}
                      
                      {getTax() > 0 && (
                        <div className="calc-row tax">
                          <span>Tax ({taxRate}%):</span>
                          <span>+{formatCurrency(getTax())}</span>
                        </div>
                      )}
                      
                      <div className="calc-row total">
                        <span><strong>Total Amount:</strong></span>
                        <span><strong>{formatCurrency(getTotal())}</strong></span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="cart-actions enhanced">
                      <button 
                        onClick={() => setShowPreview(true)}
                        disabled={cart.length === 0}
                        className="btn-preview"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        Preview Bill
                      </button>
                      
                      <button 
                        onClick={() => setShowBillHistory(true)}
                        className="btn-history"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M3 3v5h5M3.05 13a9 9 0 1 0 1.5-5.5L3 8"/>
                        </svg>
                        History
                      </button>
                      
                      <button 
                        onClick={handleCreateBill}
                        disabled={cart.length === 0 || (customerType === 'regular' && !customerId) || (customerType === 'walkin' && !walkInId) || loading}
                        className="create-bill-btn enhanced"
                      >
                        {loading ? (
                          <>
                            <div className="loading-spinner"></div>
                            Creating...
                          </>
                        ) : (
                          <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                              <polyline points="14,2 14,8 20,8"></polyline>
                              <line x1="16" y1="13" x2="8" y2="13"></line>
                              <line x1="16" y1="17" x2="8" y2="17"></line>
                              <polyline points="10,9 9,9 8,9"></polyline>
                            </svg>
                            Create Bill
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Bill Preview Modal */}
      {showPreview && (
        <div className="bill-preview-section">
          <div className="bill-preview-container">
            <div className="section-header">
              <h3>📄 Enhanced Bill Preview</h3>
              <button onClick={() => setShowPreview(false)} className="close-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className="bill-preview-content">
              <div className="bill-header-info">
                <div className="customer-info">
                  <h4>👤 Customer Details</h4>
                  <p><strong>Name:</strong> {
                    customerType === 'walkin' 
                      ? `Walk-in Customer (${walkInId})` 
                      : customers.find(c => c.id === Number(customerId))?.name || 'Unknown'
                  }</p>
                  <p><strong>Contact:</strong> {
                    customerType === 'walkin' 
                      ? 'N/A' 
                      : customers.find(c => c.id === Number(customerId))?.contact || 'N/A'
                  }</p>
                  <p><strong>Type:</strong> {customerType === 'walkin' ? 'Walk-in' : 'Regular'}</p>
                  <p><strong>Payment:</strong> {paymentMethod}</p>
                </div>
                <div className="bill-info">
                  <h4>📋 Bill Details</h4>
                  <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                  <p><strong>Time:</strong> {new Date().toLocaleTimeString()}</p>
                  <p><strong>Items:</strong> {cart.length} items</p>
                </div>
              </div>
              
              <div className="bill-items-table">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(item => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.name}</strong>
                          <br />
                          <small>{item.category}</small>
                        </td>
                        <td>{item.quantity}</td>
                        <td>{formatCurrency(item.price)}</td>
                        <td>{formatCurrency(item.quantity * item.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="bill-calculations-preview">
                <div className="calc-row">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(getSubtotal())}</span>
                </div>
                {getDiscount() > 0 && (
                  <div className="calc-row discount">
                    <span>Discount:</span>
                    <span>-{formatCurrency(getDiscount())}</span>
                  </div>
                )}
                {getTax() > 0 && (
                  <div className="calc-row tax">
                    <span>Tax ({taxRate}%):</span>
                    <span>+{formatCurrency(getTax())}</span>
                  </div>
                )}
                <div className="calc-row total">
                  <strong>Total Amount: {formatCurrency(getTotal())}</strong>
                </div>
              </div>

              {notes && (
                <div className="bill-notes">
                  <h4>📝 Notes:</h4>
                  <p>{notes}</p>
                </div>
              )}
              
              <div className="bill-actions">
                <button onClick={printBill} className="btn-print">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="6,9 6,2 18,2 18,9"></polyline>
                    <path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H18"></path>
                    <polyline points="6,14 6,18 18,18 18,14"></polyline>
                  </svg>
                  Print Bill
                </button>
                <button onClick={handleCreateBill} disabled={loading} className="btn-confirm">
                  {loading ? (
                    <>
                      <div className="loading-spinner-small"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="20,6 9,17 4,12"></polyline>
                      </svg>
                      Confirm & Create Bill
                    </>
                  )}
                </button>
                <button onClick={() => setShowPreview(false)} className="btn-cancel">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bill History Modal */}
      {showBillHistory && (
        <div className="bill-history-section">
          <div className="bill-history-container">
            <div className="section-header">
              <h3>📜 Bill History</h3>
              <button onClick={() => setShowBillHistory(false)} className="close-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className="bill-history-content">
              <div className="history-header">
                <button onClick={loadBillHistory} className="refresh-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M3 3v5h5M3.05 13a9 9 0 1 0 1.5-5.5L3 8"/>
                  </svg>
                  Refresh
                </button>
              </div>
              
              <div className="history-list">
                {billHistory.length === 0 ? (
                  <div className="no-history">
                    <p>📝 No bills found</p>
                    <p>Create your first bill to see history here</p>
                  </div>
                ) : (
                  billHistory.map(bill => (
                    <div key={bill._id} className="history-item">
                      <div className="bill-summary">
                        <div className="bill-id">Bill #{bill._id.slice(-6)}</div>
                        <div className="bill-customer">{bill.customer_name || 'Walk-in'}</div>
                        <div className="bill-amount">{formatCurrency(bill.total_amount)}</div>
                        <div className="bill-date">{new Date(bill.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="bill-status">
                        <span className={`status ${bill.payment_status}`}>
                          {bill.payment_status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomer && (
        <div className="add-customer-modal">
          <div className="add-customer-container">
            <div className="modal-header">
              <h3>➕ Add New Customer</h3>
              <button 
                onClick={() => {
                  setShowAddCustomer(false);
                  setNewCustomer({ name: '', contact: '', email: '', address: '' });
                }}
                className="close-btn"
              >
                ✕
              </button>
            </div>
            
            <div className="modal-content">
              <div className="form-group">
                <label>Customer Name *</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                  placeholder="Enter customer name"
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Contact Number</label>
                <input
                  type="text"
                  value={newCustomer.contact}
                  onChange={(e) => setNewCustomer({...newCustomer, contact: e.target.value})}
                  placeholder="Enter contact number"
                  className="form-input"
                />
              </div>
              
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                  placeholder="Enter email address"
                  className="form-input"
                />
              </div>
              
              <div className="form-group">
                <label>Address</label>
                <textarea
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                  placeholder="Enter address"
                  className="form-textarea"
                  rows="3"
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  onClick={() => {
                    setShowAddCustomer(false);
                    setNewCustomer({ name: '', contact: '', email: '', address: '' });
                  }}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddCustomer}
                  className="btn-confirm"
                  disabled={!newCustomer.name.trim()}
                >
                  Add Customer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingSystem;