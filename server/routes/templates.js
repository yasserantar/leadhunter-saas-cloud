const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

// GET /api/templates - Get all templates
router.get('/',  async (req, res) => {
    try {
        const db = getDb();
        const templates = await db.prepare('SELECT * FROM templates ORDER BY created_at DESC').all();
        res.json({ success: true, data: templates });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ أثناء جلب القوالب' });
    }
});

// GET /api/templates/:id - Get single template
router.get('/:id',  async (req, res) => {
    try {
        const db = getDb();
        const template = await db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
        
        if (!template) {
            return res.status(404).json({ success: false, error: 'القالب غير موجود' });
        }
        res.json({ success: true, data: template });
    } catch (error) {
        console.error('Error fetching template:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ أثناء جلب القالب' });
    }
});

// POST /api/templates - Create template
router.post('/',  async (req, res) => {
    try {
        const db = getDb();
        const { name, subject, body_text, category, language, variables } = req.body;

        if (!name || !subject || !body_text) {
            return res.status(400).json({ success: false, error: 'الاسم والموضوع والمحتوى مطلوبين' });
        }

        const id = uuidv4();
        await db.prepare(`
            INSERT INTO templates (id, name, subject, body_text, category, language, variables)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, name, subject, body_text, category || 'general', language || 'ar', variables || '');

        res.status(201).json({ success: true, message: 'تم إنشاء القالب بنجاح', data: { id } });
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ أثناء إنشاء القالب' });
    }
});

// PUT /api/templates/:id - Update template
router.put('/:id',  async (req, res) => {
    try {
        const db = getDb();
        const { name, subject, body_text, category, language, variables } = req.body;

        if (!name || !subject || !body_text) {
            return res.status(400).json({ success: false, error: 'الاسم والموضوع والمحتوى مطلوبين' });
        }

        await db.prepare(`
            UPDATE templates 
            SET name = ?, subject = ?, body_text = ?, category = ?, language = ?, variables = ?
            WHERE id = ?
        `).run(name, subject, body_text, category, language, variables, req.params.id);

        res.json({ success: true, message: 'تم تحديث القالب بنجاح' });
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ أثناء تحديث القالب' });
    }
});

// DELETE /api/templates/:id - Delete template
router.delete('/:id',  async (req, res) => {
    try {
        const db = getDb();
        
        // Check if template is used in any campaign
        const inUse = await db.prepare('SELECT COUNT(*) as count FROM campaigns WHERE template_id = ?').get(req.params.id);
        if (inUse.count > 0) {
            return res.status(400).json({ success: false, error: 'لا يمكن حذف هذا القالب لأنه مستخدم في حملات موجودة' });
        }

        await db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'تم حذف القالب بنجاح' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ success: false, error: 'حدث خطأ أثناء حذف القالب' });
    }
});

module.exports = router;
