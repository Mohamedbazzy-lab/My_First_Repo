const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { orders, designs } = require('../data/store');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const SHAPES = new Set(['circle', 'square', 'rectangle', 'die-cut', 'oval']);
const MATERIALS = new Set(['vinyl', 'paper', 'holographic', 'transparent', 'glitter']);
const FINISHES = new Set(['glossy', 'matte']);
const SIZES = new Set(['2x2', '3x3', '4x4', '5x5', 'custom']);

router.post('/', requireAuth, (req, res) => {
  const { designId, shape, material, size, finish, quantity, shippingAddress } = req.body || {};

  if (!designId) return res.status(400).json({ error: 'designId is required' });
  const design = designs.find(d => d.id === designId && d.userId === req.user.id);
  if (!design) return res.status(404).json({ error: 'Design not found' });

  if (!SHAPES.has(shape)) return res.status(400).json({ error: 'Invalid shape' });
  if (!MATERIALS.has(material)) return res.status(400).json({ error: 'Invalid material' });
  if (!SIZES.has(size)) return res.status(400).json({ error: 'Invalid size' });
  if (!FINISHES.has(finish)) return res.status(400).json({ error: 'Invalid finish' });

  const qty = parseInt(quantity, 10);
  if (!Number.isInteger(qty) || qty < 10 || qty > 10000) {
    return res.status(400).json({ error: 'Quantity must be between 10 and 10000' });
  }
  if (!shippingAddress || String(shippingAddress).trim().length < 5) {
    return res.status(400).json({ error: 'A valid shipping address is required' });
  }

  const unitPrice = computeUnitPrice(material, size);
  const order = {
    id: uuidv4(),
    userId: req.user.id,
    designId,
    shape,
    material,
    size,
    finish,
    quantity: qty,
    unitPrice,
    total: Math.round(unitPrice * qty * 100) / 100,
    shippingAddress: String(shippingAddress).slice(0, 300),
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  res.status(201).json(order);
});

router.get('/', requireAuth, (req, res) => {
  const mine = orders.filter(o => o.userId === req.user.id);
  res.json(mine);
});

router.get('/:id', requireAuth, (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to view this order' });
  }
  res.json(order);
});

// Admin: view / manage all orders
router.get('/admin/all', requireAuth, requireAdmin, (req, res) => {
  res.json(orders);
});

router.patch('/admin/:id/status', requireAuth, requireAdmin, (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const { status } = req.body || {};
  const validStatuses = ['pending', 'in_production', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  order.status = status;
  res.json(order);
});

function computeUnitPrice(material, size) {
  const materialBase = { vinyl: 0.15, paper: 0.08, holographic: 0.25, transparent: 0.18, glitter: 0.28 };
  const sizeMultiplier = { '2x2': 1, '3x3': 1.4, '4x4': 1.8, '5x5': 2.2, custom: 2.5 };
  return Math.round((materialBase[material] || 0.15) * (sizeMultiplier[size] || 1) * 100) / 100;
}

module.exports = router;
