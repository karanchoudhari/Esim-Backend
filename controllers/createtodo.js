const TODO = require("../models/todo");

module.exports.createtodo = async (req, res) => {
  try {
    const { title, description } = req.body;

    // Yahan TODO ka use karo, todo nahi
    const todo = await TODO.create({ title, description });

    res.status(201).json({
      message: "bna gya",
      data: todo
    });
  } catch (error) {
    res.status(500).json({
      message: "dikkat hai",
      error: error.message
    });
  }
};


module.exports.getTodo = async(req,res)=>{
    try {
        const tod = await TODO.find();
        return res.status(200).json({
            message:'milaaaa',
            data:tod
        })
    } catch (error) {
        res.status(501).json({
            message:'problemmm',
            error
        })
    }
}


module.exports.edittodo = async(req,res)=>{
try {
    const {id} = req.params;
  const {title,description}= req.body;

  const UpdateTodo = await TODO.findByIdAndUpdate(id,
    {title,description},
    {new:true}
  )

  if (!UpdateTodo) {
    return res.status(404).json({
      message:'cant update todo'
    })
  }

  res.status(200).json({
    message:'update ho gya'
  })
} catch (error) {
  res.status(501).json({
    message:'kuch gadbad hai',error
  })
}
}


module.exports.deletetodo = async (req, res) => {
  try {
    const { id } = req.params;

    const deletetodo = await TODO.findByIdAndDelete(id);

    if (!deletetodo) {
      return res.status(404).json({
        message: 'id not found'
      });
    }

    return res.status(200).json({
      message: 'Deleted successfully',
      data: deletetodo
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
};
