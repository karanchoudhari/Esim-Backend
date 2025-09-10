const express = require('express');
const router = express.Router();


router.get('/signup',(res,req)=>{
    return res.render("Signup");
})

export default router;