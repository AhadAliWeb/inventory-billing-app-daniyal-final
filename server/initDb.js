const mongoose = require('./database');
const { 
  Customer, 
  Vendor, 
  Inventory, 
  User, 
  BuyerType, 
  Account 
} = require('./models/schemas');
const bcrypt = require('bcrypt');

// Initialize MongoDB with default data
async function initializeDatabase() {
  console.log('Initializing MongoDB database...');

  try {
    // Wait for MongoDB connection
    await new Promise(resolve => {
      if (mongoose.connection.readyState === 1) {
        resolve();
      } else {
        mongoose.connection.once('open', resolve);
      }
    });

    console.log('MongoDB connected, initializing default data...');

    // Create default admin user if it doesn't exist
    const existingAdmin = await User.findOne({ username: 'admin' });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const adminUser = new User({
        username: 'admin',
        password: hashedPassword,
        full_name: 'System Administrator',
        email: 'admin@example.com',
        role: 'admin',
        is_active: true
      });
      await adminUser.save();
      console.log('Default admin user created (username: admin, password: admin123)');
    }

    // Create default buyer types
    const buyerTypes = [
      { name: 'Retail', description: 'Individual customers', discount_percentage: 0 },
      { name: 'Wholesale', description: 'Bulk buyers', discount_percentage: 10 },
      { name: 'Distributor', description: 'Business distributors', discount_percentage: 15 }
    ];

    for (const buyerType of buyerTypes) {
      const existing = await BuyerType.findOne({ name: buyerType.name });
      if (!existing) {
        await new BuyerType(buyerType).save();
        console.log(`Created buyer type: ${buyerType.name}`);
      }
    }

    // Create default accounts
    const accounts = [
      { name: 'Cash', type: 'cash', balance: 0, description: 'Cash payments' },
      { name: 'Bank Account', type: 'bank', balance: 0, description: 'Bank transactions' },
      { name: 'Digital Wallet', type: 'digital', balance: 0, description: 'Digital payments' }
    ];

    for (const account of accounts) {
      const existing = await Account.findOne({ name: account.name });
      if (!existing) {
        await new Account(account).save();
        console.log(`Created account: ${account.name}`);
      }
    }

    // Create sample customers
    const sampleCustomers = [
      { name: 'Walk-in Customer', contact: '', email: '', address: '' },
      { name: 'Regular Customer', contact: '123-456-7890', email: 'customer@example.com', address: '123 Main St' }
    ];

    for (const customer of sampleCustomers) {
      const existing = await Customer.findOne({ name: customer.name });
      if (!existing) {
        await new Customer(customer).save();
        console.log(`Created customer: ${customer.name}`);
      }
    }

    // Create sample vendors
    const sampleVendors = [
      { 
        name: 'Default Supplier', 
        contact: '987-654-3210', 
        email: 'supplier@example.com', 
        address: '456 Supply St',
        gst_number: 'GST123456789',
        total_dues: 0
      }
    ];

    for (const vendor of sampleVendors) {
      const existing = await Vendor.findOne({ name: vendor.name });
      if (!existing) {
        await new Vendor(vendor).save();
        console.log(`Created vendor: ${vendor.name}`);
      }
    }

    // Create sample inventory items for testing
    const sampleItems = [
      {
        name: 'HP Laptop Charger 65W',
        description: 'Original HP 65W laptop charger with cable',
        category: 'HP Chargers',
        quantity: 50,
        unit: 'piece',
        cost_price: 25.00,
        selling_price: 45.00,
        min_stock_level: 5,
        max_stock_level: 100,
        location: 'Shelf A1',
        supplier: 'Default Supplier',
        barcode: 'HP65W001',
        is_active: true
      },
      {
        name: 'Dell Laptop Charger 90W',
        description: 'Original Dell 90W laptop charger with cable',
        category: 'Dell Chargers',
        quantity: 35,
        unit: 'piece',
        cost_price: 30.00,
        selling_price: 55.00,
        min_stock_level: 5,
        max_stock_level: 100,
        location: 'Shelf A2',
        supplier: 'Default Supplier',
        barcode: 'DELL90W001',
        is_active: true
      },
      {
        name: 'MacBook Charger 60W MagSafe',
        description: 'Original Apple MacBook 60W MagSafe charger',
        category: 'Apple Chargers',
        quantity: 20,
        unit: 'piece',
        cost_price: 45.00,
        selling_price: 85.00,
        min_stock_level: 3,
        max_stock_level: 50,
        location: 'Shelf B1',
        supplier: 'Default Supplier',
        barcode: 'APPLE60W001',
        is_active: true
      },
      {
        name: 'Lenovo Laptop Charger 65W',
        description: 'Original Lenovo ThinkPad 65W charger',
        category: 'Lenovo Chargers',
        quantity: 40,
        unit: 'piece',
        cost_price: 28.00,
        selling_price: 50.00,
        min_stock_level: 5,
        max_stock_level: 80,
        location: 'Shelf A3',
        supplier: 'Default Supplier',
        barcode: 'LENOVO65W001',
        is_active: true
      },
      {
        name: 'Universal USB-C Charger 45W',
        description: 'Universal USB-C laptop charger 45W',
        category: 'Universal Chargers',
        quantity: 60,
        unit: 'piece',
        cost_price: 20.00,
        selling_price: 35.00,
        min_stock_level: 10,
        max_stock_level: 100,
        location: 'Shelf C1',
        supplier: 'Default Supplier',
        barcode: 'USBC45W001',
        is_active: true
      }
    ];

    for (const item of sampleItems) {
      const existing = await Inventory.findOne({ name: item.name });
      if (!existing) {
        await new Inventory(item).save();
        console.log(`Created inventory item: ${item.name}`);
      }
    }

    console.log('MongoDB database initialization completed successfully!');

  } catch (error) {
    console.error('Error initializing MongoDB database:', error);
    throw error;
  }
}

// Run the initialization
initializeDatabase()
  .then(() => {
    console.log('Database initialization completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error initializing database:', error);
    process.exit(1);
  });
