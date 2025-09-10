const express = require('express');
const { createtodo, getTodo, edittodo, deletetodo } = require('../controllers/createtodo');
const router = express.Router();


router.post('/createtodo',createtodo);
router.get('/gettodo',getTodo);
router.put('/edittodo/:id',edittodo)
router.delete('/deletetodo/:id',deletetodo)


 
module.exports = router;