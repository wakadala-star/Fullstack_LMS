const express = require('express');
const { pool, createNotification } = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// Get fees (filtered by role)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query, params = [];

    if (req.user.role === 'student') {
      query = `SELECT f.*, u.name as student_name FROM fees f
               LEFT JOIN users u ON f.student_id = u.id
               WHERE f.student_id = $1 ORDER BY f.due_date DESC`;
      params = [req.user.id];
    } else if (req.user.role === 'parent') {
      query = `SELECT f.*, u.name as student_name FROM fees f
               LEFT JOIN users u ON f.student_id = u.id
               WHERE f.student_id IN (SELECT student_id FROM parent_student WHERE parent_id = $1)
               ORDER BY f.due_date DESC`;
      params = [req.user.id];
    } else {
      query = `SELECT f.*, u.name as student_name FROM fees f
               LEFT JOIN users u ON f.student_id = u.id
               ORDER BY f.due_date DESC`;
    }

    const result = await pool.query(query, params);

    // Attach payments to each fee
    const fees = await Promise.all(result.rows.map(async (fee) => {
      const payments = await pool.query(
        'SELECT * FROM fee_payments WHERE fee_id = $1 ORDER BY created_at DESC',
        [fee.id]
      );
      return {
        ...fee,
        amount: parseFloat(fee.amount),
        paid: parseFloat(fee.paid),
        balance: parseFloat(fee.balance),
        payments: payments.rows.map(p => ({
          id: p.id?.toString(),
          amount: parseFloat(p.amount),
          date: p.created_at,
          method: p.method,
          reference: p.reference,
        })),
      };
    }));

    res.json({ fees });
  } catch (error) {
    console.error('Get fees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create fee (admin)
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { student_id, description, amount, due_date } = req.body;

    if (!student_id || !description || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO fees (student_id, description, amount, paid, balance, due_date, status)
       VALUES ($1, $2, $3, 0, $3, $4, 'unpaid') RETURNING *`,
      [student_id, description, amount, due_date || null]
    );

    res.status(201).json({ fee: result.rows[0] });
  } catch (error) {
    console.error('Create fee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Process payment
router.post('/:id/pay', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, method, reference } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    const feeResult = await pool.query('SELECT * FROM fees WHERE id = $1', [id]);
    if (feeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Fee not found' });
    }

    const fee = feeResult.rows[0];
    const newPaid = parseFloat(fee.paid) + parseFloat(amount);
    const newBalance = parseFloat(fee.amount) - newPaid;
    const newStatus = newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

    await pool.query(
      'UPDATE fees SET paid = $1, balance = $2, status = $3 WHERE id = $4',
      [newPaid, Math.max(0, newBalance), newStatus, id]
    );

    await pool.query(
      'INSERT INTO fee_payments (fee_id, amount, method, reference) VALUES ($1, $2, $3, $4)',
      [id, amount, method || 'cash', reference || `PAY-${Date.now()}`]
    );

    // Notify student
    try {
      await createNotification(
        fee.student_id,
        'Payment Received',
        `Your payment of ${amount} for "${fee.description}" was received.`,
        'success'
      );
    } catch {}

    const updatedFee = await pool.query('SELECT * FROM fees WHERE id = $1', [id]);
    const payments = await pool.query('SELECT * FROM fee_payments WHERE fee_id = $1 ORDER BY created_at DESC', [id]);

    res.json({
      fee: {
        ...updatedFee.rows[0],
        amount: parseFloat(updatedFee.rows[0].amount),
        paid: parseFloat(updatedFee.rows[0].paid),
        balance: parseFloat(updatedFee.rows[0].balance),
        payments: payments.rows.map(p => ({
          id: p.id?.toString(),
          amount: parseFloat(p.amount),
          date: p.created_at,
          method: p.method,
          reference: p.reference,
        })),
      }
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete fee (admin)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM fees WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fee not found' });
    }
    res.json({ message: 'Fee deleted' });
  } catch (error) {
    console.error('Delete fee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
