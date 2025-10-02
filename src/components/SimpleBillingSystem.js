import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import formatCurrency from '../utils/formatCurrency';

const SimpleBillingSystem = () => {
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Customer management
  const [customerType, setCustomerType] = useState('walkin');
  const [walkInId, setWalkInId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', contact: '', email: '', address: '' });
  
  // Bill settings
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(5);
  const [notes, setNotes] = useState('');
  
  // UI states
  const [showPreview, setShowPreview] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
    generateWalkInId();
  }, []);

  const loadData = async () => {
    try {
      const [itemsData, customersData] = await Promise.all([
        api.getInventory(),
        api.getCustomers()
      ]);
      console.log('Loaded items:', itemsData);
      console.log('Loaded customers:', customersData);
      setItems(Array.isArray(itemsData) ? itemsData.map(item => ({
        ...item,
        id: item._id || item.id  // Ensure we have both id and _id
      })) : []);
      setCustomers(Array.isArray(customersData) ? customersData.map(customer => ({
        ...customer,
        id: customer._id || customer.id  // Ensure we have both id and _id
      })) : []);
    } catch (error) {
      console.error('Error loading data:', error);
      setItems([]);
      setCustomers([]);
    }
  };

  const generateWalkInId = () => {
    const timestamp = Date.now().toString().slice(-6);
    setWalkInId(`W${timestamp}`);
  };

  const addToCart = (item) => {
    console.log('Adding item to cart:', item);
    const itemId = item._id || item.id;
    const existingItem = cart.find(cartItem => (cartItem._id || cartItem.id) === itemId);
    if (existingItem) {
      setCart(cart.map(cartItem =>
        (cartItem._id || cartItem.id) === itemId
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ));
    } else {
      setCart([...cart, { 
        ...item, 
        quantity: 1, 
        price: item.selling_price,
        _id: item._id,
        id: item._id || item.id  // Ensure we have both id and _id
      }]);
    }
  };

  const updateQuantity = (id, quantity) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => (item._id || item.id) !== id));
    } else {
      setCart(cart.map(item =>
        (item._id || item.id) === id ? { ...item, quantity } : item
      ));
    }
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => (item._id || item.id) !== id));
  };

  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const getDiscountAmount = () => {
    return (getSubtotal() * discount) / 100;
  };

  const getTaxAmount = () => {
    const subtotalAfterDiscount = getSubtotal() - getDiscountAmount();
    return (subtotalAfterDiscount * taxRate) / 100;
  };

  const getTotal = () => {
    return getSubtotal() - getDiscountAmount() + getTaxAmount();
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim()) {
      alert('Customer name is required');
      return;
    }

    try {
      const response = await api.addCustomer(newCustomer);
      setCustomers([...customers, response]);
      setSelectedCustomerId(response.id.toString());
      setNewCustomer({ name: '', contact: '', email: '', address: '' });
      setShowAddCustomer(false);
      alert('Customer added successfully!');
    } catch (error) {
      console.error('Error adding customer:', error);
      alert('Error adding customer: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCreateBill = async () => {
    // Validation
    if (cart.length === 0) {
      alert('Please add items to cart');
      return;
    }

    if (customerType === 'regular' && !selectedCustomerId) {
      alert('Please select a customer');
      return;
    }

    if (customerType === 'walkin' && !walkInId.trim()) {
      alert('Please enter Walk-in ID');
      return;
    }

    setLoading(true);
    try {
      const billItems = cart.map(item => ({
        item_id: item._id || item.id,  // Use _id (MongoDB format) as primary, fallback to id
        quantity: item.quantity,
        unit_price: item.price || item.selling_price
      }));

      const billData = {
        customer_id: customerType === 'regular' ? selectedCustomerId : null,
        customer_name: customerType === 'walkin' ? `Walk-in Customer (${walkInId})` : 
                      customers.find(c => c.id.toString() === selectedCustomerId)?.name,
        total_amount: getTotal(),
        discount: getDiscountAmount(),
        tax: getTaxAmount(),
        items: billItems,
        payment_method: paymentMethod,
        payment_status: 'paid',
        notes: notes
      };

      console.log('Creating bill with data:', billData);
      console.log('Cart items:', cart);
      console.log('Bill items:', billItems);
      const response = await api.createBill(billData);
      
      // Success - reset form
      setCart([]);
      setSelectedCustomerId('');
      generateWalkInId();
      setDiscount(0);
      setNotes('');
      setShowPreview(false);
      
      alert(`Bill created successfully!\nBill ID: ${response._id || 'Generated'}\nTotal: ${formatCurrency(getTotal())}`);
      
      // Refresh data
      loadData();
    } catch (error) {
      console.error('Error creating bill:', error);
      console.error('Error details:', error.response?.data);
      
      let errorMessage = 'Error creating bill: ';
      if (error.response?.data?.details) {
        const details = error.response.data.details.map(d => d.msg || d.message).join(', ');
        errorMessage += details;
      } else {
        errorMessage += (error.response?.data?.error || error.message);
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const printBill = () => {
    const printWindow = window.open('', '_blank');
    const customer = customerType === 'regular' ? 
      customers.find(c => c.id.toString() === selectedCustomerId) : null;
    const customerName = customerType === 'walkin' ? 
      `Walk-in Customer (${walkInId})` : (customer?.name || 'Unknown');
    const billNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const billContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${billNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .header h1 { color: #333; margin-bottom: 10px; }
            .details { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .customer-info, .bill-info { flex: 1; }
            .bill-info { text-align: right; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background: #f5f5f5; font-weight: bold; }
            .total-section { text-align: right; margin-top: 20px; }
            .total-row { margin: 5px 0; }
            .final-total { font-size: 18px; font-weight: bold; color: #333; border-top: 2px solid #333; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🔌 LAPTOP CHARGER WHOLESALER PRO</h1>
            <p>Professional Invoice</p>
            <p>Invoice #${billNumber}</p>
          </div>
          
          <div class="details">
            <div class="customer-info">
              <h3>Bill To:</h3>
              <p><strong>${customerName}</strong></p>
              ${customer?.contact ? `<p>Contact: ${customer.contact}</p>` : ''}
              ${customer?.email ? `<p>Email: ${customer.email}</p>` : ''}
            </div>
            <div class="bill-info">
              <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
              <p><strong>Payment:</strong> ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</p>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${cart.map(item => `
                <tr>
                  <td><strong>${item.name}</strong><br><small>${item.category}</small></td>
                  <td>${item.quantity}</td>
                  <td>${formatCurrency(item.price)}</td>
                  <td>${formatCurrency(item.quantity * item.price)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="total-section">
            <div class="total-row">Subtotal: ${formatCurrency(getSubtotal())}</div>
            ${getDiscountAmount() > 0 ? `<div class="total-row">Discount (${discount}%): -${formatCurrency(getDiscountAmount())}</div>` : ''}
            ${getTaxAmount() > 0 ? `<div class="total-row">Tax (${taxRate}%): +${formatCurrency(getTaxAmount())}</div>` : ''}
            <div class="final-total">Total Amount: ${formatCurrency(getTotal())}</div>
          </div>
          
          ${notes ? `<div style="margin-top: 30px;"><strong>Notes:</strong> ${notes}</div>` : ''}
          
          <div style="text-align: center; margin-top: 40px; color: #666;">
            <p>Thank you for your business!</p>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(billContent);
    printWindow.document.close();
    printWindow.print();
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomerId('');
    generateWalkInId();
    setDiscount(0);
    setNotes('');
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', background: '#f8f9fa', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #007bff, #0056b3)', 
        color: 'white', 
        padding: '20px', 
        borderRadius: '10px', 
        marginBottom: '20px', 
        textAlign: 'center' 
      }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '28px' }}>💳 Professional Billing System</h2>
        <p style={{ margin: 0, opacity: 0.9 }}>Complete Inventory & Customer Management</p>
      </div>

      {/* Quick Actions */}
      <div style={{ 
        display: 'flex', 
        gap: '15px', 
        justifyContent: 'center', 
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <button 
          onClick={clearCart}
          style={{
            background: '#6c757d',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          🗑️ Clear Cart
        </button>
        
        <button 
          onClick={() => {
            setCustomerType('walkin');
            generateWalkInId();
            if (cart.length > 0) {
              setTimeout(() => handleCreateBill(), 100);
            }
          }}
          disabled={cart.length === 0}
          style={{
            background: cart.length === 0 ? '#6c757d' : 'linear-gradient(135deg, #dc3545, #c82333)',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '5px',
            cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
            fontWeight: '700',
            fontSize: '16px'
          }}
        >
          🚀 Quick Walk-in Bill
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'start' }}>
        {/* Items Section */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#333', fontSize: '20px', borderBottom: '2px solid #e9ecef', paddingBottom: '15px' }}>
            📦 Select Items
          </h3>
          
          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 15px',
                border: '2px solid #e9ecef',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>
          
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {filteredItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                <div style={{ fontSize: '48px', marginBottom: '15px' }}>📦</div>
                <p>No items found</p>
              </div>
            ) : (
              filteredItems.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => addToCart(item)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '15px',
                    border: '2px solid #e9ecef',
                    borderRadius: '8px',
                    marginBottom: '10px',
                    cursor: item.quantity > 0 ? 'pointer' : 'not-allowed',
                    opacity: item.quantity > 0 ? 1 : 0.6,
                    transition: 'all 0.2s',
                    background: 'white'
                  }}
                  onMouseEnter={(e) => {
                    if (item.quantity > 0) {
                      e.target.style.borderColor = '#007bff';
                      e.target.style.background = '#f8f9fa';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.borderColor = '#e9ecef';
                    e.target.style.background = 'white';
                  }}
                >
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '16px' }}>{item.name}</h4>
                    <p style={{ color: '#6c757d', fontSize: '12px', margin: '0 0 5px 0' }}>{item.category}</p>
                    <p style={{ 
                      color: item.quantity > 0 ? '#28a745' : '#dc3545', 
                      fontSize: '12px', 
                      margin: 0,
                      fontWeight: '600'
                    }}>
                      {item.quantity > 0 ? `Stock: ${item.quantity}` : 'Out of Stock'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#28a745', marginBottom: '5px' }}>
                      {formatCurrency(item.selling_price)}
                    </div>
                    <button 
                      disabled={item.quantity === 0}
                      style={{
                        background: item.quantity === 0 ? '#6c757d' : '#007bff',
                        color: 'white',
                        border: 'none',
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        cursor: item.quantity === 0 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cart Section */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#333', fontSize: '20px', borderBottom: '2px solid #e9ecef', paddingBottom: '15px' }}>
            🛒 Cart ({cart.length} items)
          </h3>
          
          {/* Customer Selection */}
          <div style={{ 
            background: '#f8f9fa', 
            border: '2px solid #e9ecef', 
            borderRadius: '10px', 
            marginBottom: '20px',
            overflow: 'hidden'
          }}>
            {/* Customer Type Tabs */}
            <div style={{ display: 'flex', background: '#e9ecef' }}>
              <button 
                onClick={() => {
                  setCustomerType('walkin');
                  setSelectedCustomerId('');
                  generateWalkInId();
                }}
                style={{
                  flex: 1,
                  background: customerType === 'walkin' ? '#007bff' : 'transparent',
                  color: customerType === 'walkin' ? 'white' : '#6c757d',
                  border: 'none',
                  padding: '15px 20px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '16px'
                }}
              >
                🚶 Walk-in Customer
              </button>
              <button 
                onClick={() => {
                  setCustomerType('regular');
                  setWalkInId('');
                }}
                style={{
                  flex: 1,
                  background: customerType === 'regular' ? '#007bff' : 'transparent',
                  color: customerType === 'regular' ? 'white' : '#6c757d',
                  border: 'none',
                  padding: '15px 20px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '16px'
                }}
              >
                👤 Regular Customer
              </button>
            </div>

            {/* Walk-in Customer Section */}
            {customerType === 'walkin' && (
              <div style={{ padding: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>
                  Walk-in Customer ID:
                </label>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <input
                    type="text"
                    value={walkInId}
                    onChange={(e) => setWalkInId(e.target.value)}
                    placeholder="Enter Walk-in ID"
                    style={{
                      flex: 1,
                      padding: '12px 15px',
                      border: '2px solid #e9ecef',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      background: 'white'
                    }}
                  />
                  <button 
                    onClick={generateWalkInId}
                    style={{
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    🔄 New ID
                  </button>
                </div>
                {walkInId && (
                  <div style={{
                    background: '#d4edda',
                    border: '1px solid #c3e6cb',
                    padding: '12px 15px',
                    borderRadius: '6px',
                    color: '#155724',
                    fontWeight: '600'
                  }}>
                    Customer: Walk-in Customer ({walkInId})
                  </div>
                )}
              </div>
            )}

            {/* Regular Customer Section */}
            {customerType === 'regular' && (
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '12px 15px',
                      border: '2px solid #e9ecef',
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: 'white'
                    }}
                  >
                    <option value="">🔍 Select Customer...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.contact ? `(${c.contact})` : ''}
                      </option>
                    ))}
                  </select>
                  
                  <button 
                    onClick={() => setShowAddCustomer(true)}
                    style={{
                      background: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      padding: '12px 20px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    ➕ Add New
                  </button>
                </div>
                
                {selectedCustomerId && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'white',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '2px solid #28a745'
                  }}>
                    <span style={{
                      background: 'linear-gradient(135deg, #28a745, #20c997)',
                      color: 'white',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      👤 {customers.find(c => c.id.toString() === selectedCustomerId)?.name}
                    </span>
                    <button 
                      onClick={() => setSelectedCustomerId('')}
                      style={{
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Cart Items */}
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6c757d' }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>🛒</div>
              <p>Your cart is empty</p>
              <p style={{ fontSize: '14px', marginTop: '5px' }}>Click on items to add them</p>
            </div>
          ) : (
            <>
              <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '20px' }}>
                {cart.map(item => (
                  <div key={item._id || item.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '15px',
                    border: '1px solid #e9ecef',
                    borderRadius: '5px',
                    marginBottom: '10px',
                    background: '#f8f9fa'
                  }}>
                    <div>
                      <h4 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>{item.name}</h4>
                      <p style={{ color: '#6c757d', fontSize: '12px', margin: 0 }}>{item.category}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button 
                          onClick={() => updateQuantity(item._id || item.id, item.quantity - 1)}
                          style={{
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            width: '30px',
                            height: '30px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          -
                        </button>
                        <span style={{ fontWeight: 'bold', fontSize: '16px', minWidth: '30px', textAlign: 'center' }}>
                          {item.quantity}
                        </span>
                        <button 
                          onClick={() => updateQuantity(item._id || item.id, item.quantity + 1)}
                          style={{
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            width: '30px',
                            height: '30px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          +
                        </button>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '600', color: '#28a745' }}>
                          {formatCurrency(item.quantity * item.price)}
                        </div>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item._id || item.id)}
                        style={{
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          width: '25px',
                          height: '25px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Bill Summary */}
              <div style={{ 
                background: '#f8f9fa', 
                padding: '20px', 
                borderRadius: '8px', 
                border: '1px solid #e9ecef',
                marginBottom: '20px'
              }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>📋 Bill Summary</h3>
                
                {/* Settings */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#333' }}>
                      💰 Discount (%):
                    </label>
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      style={{ width: '80px', padding: '5px', border: '1px solid #ddd', borderRadius: '3px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#333' }}>
                      🏛️ Tax (%):
                    </label>
                    <input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      min="0"
                      max="50"
                      style={{ width: '80px', padding: '5px', border: '1px solid #ddd', borderRadius: '3px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#333' }}>
                    💳 Payment Method:
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '3px' }}
                  >
                    <option value="cash">💵 Cash</option>
                    <option value="card">💳 Card</option>
                    <option value="bank_transfer">🏦 Bank Transfer</option>
                    <option value="check">📝 Check</option>
                    <option value="credit">🕒 Credit</option>
                  </select>
                </div>

                {/* Calculations */}
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e9ecef' }}>
                    <span>Subtotal:</span>
                    <span>{formatCurrency(getSubtotal())}</span>
                  </div>
                  
                  {getDiscountAmount() > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e9ecef', color: '#dc3545' }}>
                      <span>Discount ({discount}%):</span>
                      <span>-{formatCurrency(getDiscountAmount())}</span>
                    </div>
                  )}
                  
                  {getTaxAmount() > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e9ecef', color: '#ffc107' }}>
                      <span>Tax ({taxRate}%):</span>
                      <span>+{formatCurrency(getTaxAmount())}</span>
                    </div>
                  )}
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    padding: '15px 0 10px 0', 
                    fontWeight: 'bold', 
                    fontSize: '18px', 
                    color: '#28a745',
                    borderTop: '2px solid #28a745',
                    marginTop: '10px'
                  }}>
                    <span>Total Amount:</span>
                    <span>{formatCurrency(getTotal())}</span>
                  </div>
                </div>

                {/* Notes */}
                <div style={{ marginTop: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#333' }}>
                    📝 Notes:
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any special notes..."
                    style={{ 
                      width: '100%', 
                      padding: '8px', 
                      border: '1px solid #ddd', 
                      borderRadius: '3px',
                      resize: 'vertical',
                      minHeight: '60px'
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => setShowPreview(true)}
                  disabled={cart.length === 0}
                  style={{
                    background: cart.length === 0 ? '#6c757d' : '#6c757d',
                    color: 'white',
                    border: 'none',
                    padding: '10px 15px',
                    borderRadius: '5px',
                    cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                    flex: 1
                  }}
                >
                  👁️ Preview
                </button>
                
                <button 
                  onClick={handleCreateBill}
                  disabled={
                    cart.length === 0 || 
                    (customerType === 'regular' && !selectedCustomerId) || 
                    (customerType === 'walkin' && !walkInId.trim()) || 
                    loading
                  }
                  style={{
                    background: (cart.length === 0 || 
                      (customerType === 'regular' && !selectedCustomerId) || 
                      (customerType === 'walkin' && !walkInId.trim()) || 
                      loading) ? '#6c757d' : '#28a745',
                    color: 'white',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '5px',
                    cursor: (cart.length === 0 || 
                      (customerType === 'regular' && !selectedCustomerId) || 
                      (customerType === 'walkin' && !walkInId.trim()) || 
                      loading) ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    flex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {loading ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #ffffff',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      📄 Create Bill
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bill Preview Modal */}
      {showPreview && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '10px',
            width: '100%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '20px',
              borderBottom: '2px solid #e9ecef'
            }}>
              <h3 style={{ margin: 0, color: '#333' }}>📄 Bill Preview</h3>
              <button 
                onClick={() => setShowPreview(false)}
                style={{
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  width: '35px',
                  height: '35px',
                  borderRadius: '50%',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: '30px' }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '30px', 
                marginBottom: '30px',
                padding: '20px',
                background: '#f8f9fa',
                borderRadius: '8px'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>👤 Customer Details</h4>
                  <p><strong>Name:</strong> {
                    customerType === 'walkin' 
                      ? `Walk-in Customer (${walkInId})` 
                      : customers.find(c => c.id.toString() === selectedCustomerId)?.name || 'Unknown'
                  }</p>
                  <p><strong>Type:</strong> {customerType === 'walkin' ? 'Walk-in' : 'Regular'}</p>
                  <p><strong>Payment:</strong> {paymentMethod}</p>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>📋 Bill Details</h4>
                  <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                  <p><strong>Time:</strong> {new Date().toLocaleTimeString()}</p>
                  <p><strong>Items:</strong> {cart.length} items</p>
                </div>
              </div>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                <thead>
                  <tr>
                    <th style={{ background: '#007bff', color: 'white', padding: '15px', textAlign: 'left' }}>Item</th>
                    <th style={{ background: '#007bff', color: 'white', padding: '15px', textAlign: 'center' }}>Qty</th>
                    <th style={{ background: '#007bff', color: 'white', padding: '15px', textAlign: 'right' }}>Price</th>
                    <th style={{ background: '#007bff', color: 'white', padding: '15px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(item => (
                    <tr key={item._id || item.id}>
                      <td style={{ padding: '12px 15px', borderBottom: '1px solid #e9ecef' }}>
                        <strong>{item.name}</strong><br />
                        <small>{item.category}</small>
                      </td>
                      <td style={{ padding: '12px 15px', borderBottom: '1px solid #e9ecef', textAlign: 'center' }}>
                        {item.quantity}
                      </td>
                      <td style={{ padding: '12px 15px', borderBottom: '1px solid #e9ecef', textAlign: 'right' }}>
                        {formatCurrency(item.price)}
                      </td>
                      <td style={{ padding: '12px 15px', borderBottom: '1px solid #e9ecef', textAlign: 'right' }}>
                        {formatCurrency(item.quantity * item.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div style={{ 
                background: '#f8f9fa', 
                padding: '20px', 
                borderRadius: '8px', 
                marginBottom: '20px' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span>Subtotal:</span>
                  <span>{formatCurrency(getSubtotal())}</span>
                </div>
                {getDiscountAmount() > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', color: '#dc3545' }}>
                    <span>Discount:</span>
                    <span>-{formatCurrency(getDiscountAmount())}</span>
                  </div>
                )}
                {getTaxAmount() > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', color: '#ffc107' }}>
                    <span>Tax:</span>
                    <span>+{formatCurrency(getTaxAmount())}</span>
                  </div>
                )}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  padding: '15px 0 10px 0', 
                  fontWeight: 'bold', 
                  fontSize: '18px', 
                  color: '#28a745',
                  borderTop: '2px solid #28a745',
                  marginTop: '10px'
                }}>
                  <span>Total Amount:</span>
                  <span>{formatCurrency(getTotal())}</span>
                </div>
              </div>

              {notes && (
                <div style={{ 
                  background: '#fff3cd', 
                  border: '1px solid #ffeaa7', 
                  borderRadius: '8px', 
                  padding: '15px', 
                  marginBottom: '20px' 
                }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>📝 Notes:</h4>
                  <p style={{ margin: 0, color: '#856404' }}>{notes}</p>
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button 
                  onClick={printBill}
                  style={{
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  🖨️ Print Bill
                </button>
                <button 
                  onClick={handleCreateBill}
                  disabled={loading}
                  style={{
                    background: loading ? '#6c757d' : '#28a745',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '5px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {loading ? 'Creating...' : '✅ Confirm & Create'}
                </button>
                <button 
                  onClick={() => setShowPreview(false)}
                  style={{
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '20px',
              borderBottom: '2px solid #e9ecef',
              background: '#f8f9fa',
              borderRadius: '12px 12px 0 0'
            }}>
              <h3 style={{ margin: 0, color: '#333', fontSize: '20px' }}>➕ Add New Customer</h3>
              <button 
                onClick={() => {
                  setShowAddCustomer(false);
                  setNewCustomer({ name: '', contact: '', email: '', address: '' });
                }}
                style={{
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: '25px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333' }}>
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                  placeholder="Enter customer name"
                  style={{
                    width: '100%',
                    padding: '12px 15px',
                    border: '2px solid #e9ecef',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333' }}>
                  Contact Number
                </label>
                <input
                  type="text"
                  value={newCustomer.contact}
                  onChange={(e) => setNewCustomer({...newCustomer, contact: e.target.value})}
                  placeholder="Enter contact number"
                  style={{
                    width: '100%',
                    padding: '12px 15px',
                    border: '2px solid #e9ecef',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                  placeholder="Enter email address"
                  style={{
                    width: '100%',
                    padding: '12px 15px',
                    border: '2px solid #e9ecef',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333' }}>
                  Address
                </label>
                <textarea
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                  placeholder="Enter address"
                  rows="3"
                  style={{
                    width: '100%',
                    padding: '12px 15px',
                    border: '2px solid #e9ecef',
                    borderRadius: '8px',
                    fontSize: '14px',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
              
              <div style={{ 
                display: 'flex', 
                gap: '15px', 
                justifyContent: 'flex-end',
                marginTop: '25px',
                paddingTop: '20px',
                borderTop: '1px solid #e9ecef'
              }}>
                <button 
                  onClick={() => {
                    setShowAddCustomer(false);
                    setNewCustomer({ name: '', contact: '', email: '', address: '' });
                  }}
                  style={{
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddCustomer}
                  disabled={!newCustomer.name.trim()}
                  style={{
                    background: !newCustomer.name.trim() ? '#adb5bd' : '#28a745',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '6px',
                    cursor: !newCustomer.name.trim() ? 'not-allowed' : 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Add Customer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default SimpleBillingSystem;
