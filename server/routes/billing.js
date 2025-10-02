const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { Bill, Customer, Inventory } = require('../models/schemas');
const { requireAuth, requireAdmin } = require('./auth');

// Validation for bill creation
const validateBill = [
  body('total_amount').isFloat({ min: 0.01 }).withMessage('Total amount must be greater than 0'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('payment_method').optional().isIn(['cash', 'credit', 'bank_transfer', 'check', 'card']).withMessage('Invalid payment method'),
  body('customer_id').optional().custom((value) => {
    // Allow null/undefined for walk-in customers
    if (value === null || value === undefined || value === '') {
      return true;
    }
    // For MongoDB ObjectId validation
    if (typeof value === 'string' && value.match(/^[0-9a-fA-F]{24}$/)) {
      return true;
    }
    // For numeric IDs (if using auto-increment)
    if (typeof value === 'number' || (typeof value === 'string' && !isNaN(value))) {
      return true;
    }
    throw new Error('Invalid customer ID format');
  }),
  body('customer_name').optional().trim().isLength({ min: 1 }).withMessage('Customer name is required if no customer ID'),
  // Custom validation for items array
  body('items').custom((items) => {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('At least one item is required');
    }
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (!item.item_id) {
        throw new Error(`Item ${i + 1}: Item ID is required`);
      }
      
      if (!item.quantity || item.quantity < 1) {
        throw new Error(`Item ${i + 1}: Quantity must be at least 1`);
      }
      
      if (item.unit_price === undefined || item.unit_price < 0) {
        throw new Error(`Item ${i + 1}: Unit price must be non-negative`);
      }
    }
    
    return true;
  })
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('=== VALIDATION ERRORS ===');
    console.log('Errors:', JSON.stringify(errors.array(), null, 2));
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('========================');
    return res.status(400).json({ 
      error: 'Invalid input', 
      details: errors.array(),
      receivedData: req.body
    });
  }
  next();
};

// Debug endpoint to check inventory items
router.get('/debug-inventory', async (req, res) => {
  try {
    const items = await Inventory.find({}).limit(5);
    console.log('Sample inventory items:', items.map(item => ({
      id: item._id,
      name: item.name,
      selling_price: item.selling_price,
      quantity: item.quantity
    })));
    res.json({
      success: true,
      items: items.map(item => ({
        id: item._id,
        _id: item._id,
        name: item.name,
        selling_price: item.selling_price,
        quantity: item.quantity,
        category: item.category
      }))
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint - no validation
router.post('/debug', async (req, res) => {
  console.log('=== DEBUG BILL CREATION ===');
  console.log('Raw request body:', JSON.stringify(req.body, null, 2));
  console.log('Request headers:', req.headers);
  console.log('==========================');
  res.json({ 
    success: true, 
    message: 'Debug data received', 
    receivedData: req.body,
    headers: req.headers
  });
});

// Test bill creation without auth for debugging
router.post('/test-create', validateBill, handleValidation, async (req, res) => {
  try {
    console.log('Test bill creation request body:', JSON.stringify(req.body, null, 2));
    res.json({ 
      success: true, 
      message: 'Validation passed', 
      receivedData: req.body 
    });
  } catch (error) {
    console.error('Test bill creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new bill (temporarily without auth for debugging)
router.post('/no-auth', validateBill, handleValidation, async (req, res) => {
  console.log('Creating bill without auth - Request body:', JSON.stringify(req.body, null, 2));

  try {
    const { 
      customer_id, 
      customer_name, 
      total_amount, 
      discount = 0,
      tax = 0,
      items, 
      payment_method = 'cash',
      payment_status = 'paid'
    } = req.body;

    // Validate items and check stock
    const processedItems = [];
    let calculatedTotal = 0;

    for (const item of items) {
      const inventoryItem = await Inventory.findById(item.item_id);
      if (!inventoryItem) {
        return res.status(400).json({ 
          error: `Item not found: ${item.item_id}` 
        });
      }

      if (inventoryItem.quantity < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${inventoryItem.name}. Available: ${inventoryItem.quantity}, Requested: ${item.quantity}` 
        });
      }

      const itemTotal = item.quantity * item.unit_price;
      calculatedTotal += itemTotal;

      processedItems.push({
        item_id: item.item_id,
        item_name: inventoryItem.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: itemTotal
      });

      // Update inventory quantity
      await Inventory.findByIdAndUpdate(
        item.item_id,
        { 
          $inc: { quantity: -item.quantity },
          updated_at: new Date()
        }
      );
    }

    // Validate total amount
    const expectedTotal = calculatedTotal - discount + tax;
    if (Math.abs(total_amount - expectedTotal) > 0.01) {
      return res.status(400).json({ 
        error: `Total amount mismatch. Expected: ${expectedTotal}, Received: ${total_amount}` 
      });
    }

    // Create the bill
    const newBill = new Bill({
      customer_id: customer_id || null,
      customer_name: customer_name || 'Walk-in Customer',
      total_amount,
      discount,
      tax,
      payment_method,
      payment_status,
      items: processedItems,
      created_at: new Date()
    });

    const savedBill = await newBill.save();
    
    // Populate customer details if available
    let billWithCustomer = savedBill;
    if (customer_id) {
      billWithCustomer = await Bill.findById(savedBill._id).populate('customer_id', 'name contact email');
    }

    console.log('New bill created (no auth):', savedBill._id);
    res.status(201).json(billWithCustomer);

  } catch (error) {
    console.error('Error creating bill (no auth):', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new bill (with auth)
router.post('/', requireAuth, validateBill, handleValidation, async (req, res) => {

  console.log(req.body)

  try {
    const { 
      customer_id, 
      customer_name, 
      total_amount, 
      discount = 0,
      tax = 0,
      items, 
      payment_method = 'cash',
      payment_status = 'paid'
    } = req.body;

    // Validate items and check stock
    const processedItems = [];
    let calculatedTotal = 0;

    for (const item of items) {
      const inventoryItem = await Inventory.findById(item.item_id);
      if (!inventoryItem) {
        return res.status(400).json({ 
          error: `Item not found: ${item.item_id}` 
        });
      }

      if (inventoryItem.quantity < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${inventoryItem.name}. Available: ${inventoryItem.quantity}, Requested: ${item.quantity}` 
        });
      }

      const itemTotal = item.quantity * item.unit_price;
      calculatedTotal += itemTotal;

      processedItems.push({
        item_id: item.item_id,
        item_name: inventoryItem.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: itemTotal
      });

      // Update inventory quantity
      await Inventory.findByIdAndUpdate(
        item.item_id,
        { 
          $inc: { quantity: -item.quantity },
          updated_at: new Date()
        }
      );
    }

    // Validate total amount
    const expectedTotal = calculatedTotal - discount + tax;
    if (Math.abs(total_amount - expectedTotal) > 0.01) {
      return res.status(400).json({ 
        error: `Total amount mismatch. Expected: ${expectedTotal}, Received: ${total_amount}` 
      });
    }

    // Create the bill
    const newBill = new Bill({
      customer_id: customer_id || null,
      customer_name: customer_name || 'Walk-in Customer',
      total_amount,
      discount,
      tax,
      payment_method,
      payment_status,
      items: processedItems,
      created_at: new Date()
    });

    const savedBill = await newBill.save();
    
    // Populate customer details if available
    let billWithCustomer = savedBill;
    if (customer_id) {
      billWithCustomer = await Bill.findById(savedBill._id).populate('customer_id', 'name contact email');
    }

    console.log('New bill created:', savedBill._id);
    res.status(201).json(billWithCustomer);

  } catch (error) {
    console.error('Error creating bill:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update bill payment status
router.put('/:billId/payment', requireAuth, async (req, res) => {
  try {
    const { billId } = req.params;
    const { payment_status, payment_method } = req.body;

    if (!['paid', 'unpaid', 'partial'].includes(payment_status)) {
      return res.status(400).json({ error: 'Invalid payment status' });
    }

    const updatedBill = await Bill.findByIdAndUpdate(
      billId,
      { 
        payment_status,
        ...(payment_method && { payment_method })
      },
      { new: true }
    ).populate('customer_id', 'name contact email');

    if (!updatedBill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    console.log('Bill payment updated:', billId);
    res.json(updatedBill);

  } catch (error) {
    console.error('Error updating bill payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get bill details
router.get('/:billId', requireAuth, async (req, res) => {
  try {
    const { billId } = req.params;

    const bill = await Bill.findById(billId)
      .populate('customer_id', 'name contact email address')
      .populate('items.item_id', 'name category description');

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    res.json(bill);

  } catch (error) {
    console.error('Error fetching bill details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all bills with pagination and filtering
router.get('/', requireAuth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      customer_id, 
      payment_status, 
      start_date, 
      end_date,
      search 
    } = req.query;

    const filter = {};
    
    if (customer_id) {
      filter.customer_id = customer_id;
    }
    
    if (payment_status) {
      filter.payment_status = payment_status;
    }

    if (start_date || end_date) {
      filter.created_at = {};
      if (start_date) filter.created_at.$gte = new Date(start_date);
      if (end_date) filter.created_at.$lte = new Date(end_date);
    }

    if (search) {
      filter.$or = [
        { customer_name: { $regex: search, $options: 'i' } },
        { 'items.item_name': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bills, totalCount] = await Promise.all([
      Bill.find(filter)
        .populate('customer_id', 'name contact')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Bill.countDocuments(filter)
    ]);

    res.json({
      bills,
      total: totalCount,
      page: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      hasMore: skip + bills.length < totalCount
    });

  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete bill (only for admins and managers)
router.delete('/:billId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { billId } = req.params;

    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Restore inventory quantities
    for (const item of bill.items) {
      await Inventory.findByIdAndUpdate(
        item.item_id,
        { 
          $inc: { quantity: item.quantity },
          updated_at: new Date()
        }
      );
    }

    await Bill.findByIdAndDelete(billId);

    console.log('Bill deleted and inventory restored:', billId);
    res.json({ message: 'Bill deleted successfully and inventory restored' });

  } catch (error) {
    console.error('Error deleting bill:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get billing statistics
router.get('/stats/summary', requireAuth, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const dateFilter = {};
    if (start_date || end_date) {
      dateFilter.created_at = {};
      if (start_date) dateFilter.created_at.$gte = new Date(start_date);
      if (end_date) dateFilter.created_at.$lte = new Date(end_date);
    }

    const [
      totalBills,
      paidBills,
      unpaidBills,
      revenueStats
    ] = await Promise.all([
      Bill.countDocuments(dateFilter),
      Bill.countDocuments({ ...dateFilter, payment_status: 'paid' }),
      Bill.countDocuments({ ...dateFilter, payment_status: 'unpaid' }),
      Bill.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total_amount' },
            paidRevenue: {
              $sum: {
                $cond: [{ $eq: ['$payment_status', 'paid'] }, '$total_amount', 0]
              }
            },
            unpaidRevenue: {
              $sum: {
                $cond: [{ $eq: ['$payment_status', 'unpaid'] }, '$total_amount', 0]
              }
            },
            averageBillAmount: { $avg: '$total_amount' }
          }
        }
      ])
    ]);

    const stats = revenueStats[0] || {
      totalRevenue: 0,
      paidRevenue: 0,
      unpaidRevenue: 0,
      averageBillAmount: 0
    };

    res.json({
      totalBills,
      paidBills,
      unpaidBills,
      totalRevenue: Math.round(stats.totalRevenue * 100) / 100,
      paidRevenue: Math.round(stats.paidRevenue * 100) / 100,
      unpaidRevenue: Math.round(stats.unpaidRevenue * 100) / 100,
      averageBillAmount: Math.round(stats.averageBillAmount * 100) / 100
    });

  } catch (error) {
    console.error('Error getting billing stats:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;